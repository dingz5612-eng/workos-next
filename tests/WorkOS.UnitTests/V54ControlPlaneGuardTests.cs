using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class V54ControlPlaneGuardTests
{
    private static string RepoRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return current!.FullName;
    }

    private static string RepoPath(params string[] segments)
    {
        return Path.Combine(new[] { RepoRoot() }.Concat(segments).ToArray());
    }

    [TestMethod]
    public void V54WorkflowDeclaresFirstBatchGuardSkeleton()
    {
        var workflow = File.ReadAllText(RepoPath(".github", "workflows", "v5_4_control_plane.yml"));
        var localCommand = File.ReadAllText(RepoPath("scripts", "v5_4", "run-control-plane-checks.ps1"));
        var docs = File.ReadAllText(RepoPath("docs", "v5.4", "ci-control-plane.md"));

        foreach (var guard in new[]
        {
            "architecture-guard",
            "api-boundary-check",
            "control-plane-migration",
            "shadow-namespace-isolation",
            "invariant-runner",
            "shadow-compare-runner",
            "gate-runner",
            "release-manifest-validate"
        })
        {
            Assert.IsTrue(workflow.Contains(guard), $"workflow must include {guard}");
            Assert.IsTrue(localCommand.Contains(guard), $"local command must include {guard}");
            Assert.IsTrue(docs.Contains(guard), $"docs must include {guard}");
        }
    }

    [TestMethod]
    public async Task GateRunnerGeneratesNotRunGateResultFixture()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-v54-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "invariant-check.not_run.json");
            var shadowPath = Path.Combine(temp.FullName, "shadow-compare-report.not_run.json");
            var gatePath = Path.Combine(temp.FullName, "gate-result.not_run.json");

            RunnerJson.Write(invariantPath, new[]
            {
                Invariant("inv-v5-4-skeleton-not-run", "api.no_page_specific_business_write", "blocking", "P0", "passed")
            });
            RunnerJson.Write(shadowPath, Report("scr-v5-4-skeleton-not-run", "green"));
            await GateRunner.Run(RunnerOptions.Parse(new[]
            {
                "--dry-run=true",
                "--id=gate-v5-4-skeleton-not-run",
                $"--invariant={invariantPath}",
                $"--shadow={shadowPath}",
                $"--out={gatePath}"
            }));

            using var gate = JsonDocument.Parse(File.ReadAllText(gatePath));
            var root = gate.RootElement;
            Assert.AreEqual("gate-v5-4-skeleton-not-run", root.GetProperty("gate_result_id").GetString());
            Assert.AreEqual("not_run", root.GetProperty("status").GetString());
            Assert.AreEqual("gate-runner", root.GetProperty("generated_by").GetString());
            Assert.AreEqual("inv-v5-4-skeleton-not-run", root.GetProperty("invariant_check_refs")[0].GetString());
            Assert.AreEqual("scr-v5-4-skeleton-not-run", root.GetProperty("shadow_compare_report_refs")[0].GetString());
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    private static InvariantCheckEvidence Invariant(string id, string key, string mode, string severity, string status)
    {
        return new InvariantCheckEvidence(
            id,
            "v5.4-first-batch",
            "tenant-a",
            "slice-a",
            key,
            key,
            mode,
            severity,
            "skeleton",
            null,
            null,
            status,
            new Dictionary<string, object>(),
            new Dictionary<string, object>(),
            status == "passed" ? 0 : 1,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            "test",
            "ci-test",
            DateTimeOffset.UtcNow);
    }

    private static ShadowCompareEvidence Report(string id, string grade)
    {
        return new ShadowCompareEvidence(
            id,
            "v5.4-first-batch",
            "tenant-a",
            "slice-a",
            new Dictionary<string, object>(),
            null,
            "public.audit_events",
            "shadow_runtime.domain_events",
            DateTimeOffset.UtcNow,
            grade,
            0,
            0,
            grade == "green" ? 0 : 1,
            0,
            0,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            new Dictionary<string, object>(),
            "test",
            "ci-test");
    }
}
