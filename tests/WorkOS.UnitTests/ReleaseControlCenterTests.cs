using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ReleaseControlCenterTests
{
    private static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }

    [TestMethod]
    public void ControlPlaneReadApisAreDeclaredReadOnly()
    {
        var program = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Program.cs"));
        foreach (var route in new[]
        {
            "MapGet(\"/api/control-plane/releases\"",
            "MapGet(\"/api/control-plane/releases/{releaseId}\"",
            "MapGet(\"/api/control-plane/gate-results/{gateResultId}\"",
            "MapGet(\"/api/control-plane/shadow-compare-reports/{id}\"",
            "MapGet(\"/api/control-plane/invariant-checks\"",
            "MapGet(\"/api/control-plane/rollback-instructions/{id}\""
        })
        {
            Assert.IsTrue(program.Contains(route), $"Program.cs must declare {route}");
        }

        Assert.IsFalse(program.Contains("MapPost(\"/api/control-plane/"), "Release Control Center must be read-only in the first batch.");
        Assert.IsFalse(program.Contains("MapPut(\"/api/control-plane/"), "Release Control Center must not update runtime mode directly.");
    }

    [TestMethod]
    public void ControlPlaneReadStoreExposesRequiredCenterFields()
    {
        var source = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ControlPlaneReadStore.cs"));
        foreach (var term in new[]
        {
            "ReleaseControlSummary",
            "MrId",
            "ReleaseStatus",
            "GateResultStatus",
            "ShadowGrade",
            "InvariantSeverityCounts",
            "FeatureFlagStatus",
            "SliceRuntimeMode",
            "RollbackInstructionId",
            "AcceptanceProgress",
            "ReleaseAdmissionStatus",
            "BusinessSignoffRefs",
            "CiRunId",
            "control_plane.release_manifests",
            "control_plane.gate_results",
            "control_plane.shadow_compare_reports",
            "control_plane.runtime_invariant_checks",
            "control_plane.rollback_instructions"
        })
        {
            Assert.IsTrue(source.Contains(term), $"ControlPlaneReadStore must expose {term}");
        }
    }

    [TestMethod]
    public void red_shadow_report_blocks_active()
    {
        var admission = ReleaseAdmissionPolicy.Evaluate(
            Gate("passed", ["business-signoff-1"]),
            [Shadow("red")],
            [Invariant("blocking", "P0", "passed", 0)],
            Rollback());

        Assert.IsFalse(admission.CanActivate);
        CollectionAssert.Contains(admission.ActiveBlockers.ToArray(), "red_shadow_report");
    }

    [TestMethod]
    public void missing_rollback_instruction_blocks_active()
    {
        var admission = ReleaseAdmissionPolicy.Evaluate(
            Gate("passed", ["business-signoff-1"]),
            [Shadow("green")],
            [Invariant("blocking", "P0", "passed", 0)],
            null);

        Assert.IsFalse(admission.CanActivate);
        CollectionAssert.Contains(admission.ActiveBlockers.ToArray(), "rollback_instruction_missing");
    }

    [TestMethod]
    public void business_signoff_required_for_locked()
    {
        var admission = ReleaseAdmissionPolicy.Evaluate(
            Gate("passed", []),
            [Shadow("green")],
            [Invariant("blocking", "P0", "passed", 0)],
            Rollback());

        Assert.IsTrue(admission.CanActivate);
        Assert.IsFalse(admission.CanLock);
        CollectionAssert.Contains(admission.LockedBlockers.ToArray(), "business_signoff_missing");
    }

    [TestMethod]
    public void p0_blocking_invariant_blocks_active()
    {
        var admission = ReleaseAdmissionPolicy.Evaluate(
            Gate("passed", ["business-signoff-1"]),
            [Shadow("green")],
            [Invariant("blocking", "P0", "failed", 1)],
            Rollback());

        Assert.IsFalse(admission.CanActivate);
        CollectionAssert.Contains(admission.ActiveBlockers.ToArray(), "p0_blocking_invariant_failed");
    }

    private static GateResultRead Gate(string status, IReadOnlyList<string> businessSignoffRefs) =>
        new(
            "gate-1",
            "release-1",
            "MR-1",
            "tenant-1",
            "slice-1",
            "release-gate",
            "release",
            status,
            "P0",
            "ci-1",
            ["test-ref"],
            ["inv-1"],
            ["shadow-1"],
            businessSignoffRefs,
            Array.Empty<string>(),
            ["go"],
            Array.Empty<string>(),
            "gate-runner",
            DateTimeOffset.UtcNow,
            "input-hash",
            "result-hash");

    private static ShadowCompareReportRead Shadow(string grade) =>
        new(
            $"shadow-{grade}",
            "release-1",
            "tenant-1",
            "slice-1",
            new Dictionary<string, object> { ["scope"] = "release" },
            null,
            null,
            null,
            DateTimeOffset.UtcNow,
            grade,
            1,
            grade == "red" ? 0 : 1,
            grade == "red" ? 1 : 0,
            0,
            0,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            new Dictionary<string, object>(),
            "shadow-compare-runner",
            "ci-1");

    private static RuntimeInvariantCheckRead Invariant(string mode, string severity, string status, int violationCount) =>
        new(
            "inv-1",
            "release-1",
            "tenant-1",
            "slice-1",
            "runtime.control_plane_tables_exist",
            "Control plane exists",
            mode,
            severity,
            "skeleton",
            null,
            null,
            status,
            new Dictionary<string, object>(),
            new Dictionary<string, object>(),
            violationCount,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            "invariant-runner",
            "ci-1",
            DateTimeOffset.UtcNow);

    private static RollbackInstructionRead Rollback() =>
        new(
            "rollback-1",
            "release-1",
            "rollback",
            "runtime_mode",
            "Rollback to legacy",
            new Dictionary<string, object>(),
            ["shadow", "pilot", "active"],
            ["rollback"],
            ["set runtime_mode rollback"],
            ["verify gate"],
            "release",
            "medium",
            true,
            true,
            false,
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow);
}
