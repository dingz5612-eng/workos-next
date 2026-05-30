using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class V54GateRunnerDecisionTests
{
    [TestMethod]
    public void GateDecisionBlocksOnP0BlockingFailedInvariant()
    {
        var decision = Calculate([Invariant("inv-p0", "runtime.control_plane_tables_exist", "blocking", "P0", "failed")], [Report("green")], ["signoff"]);
        Assert.AreEqual("blocked", decision.Status);
        Assert.AreEqual("P0", decision.Severity);
    }

    [TestMethod]
    public void GateDecisionBlocksOnRedShadowReport()
    {
        var decision = Calculate([Invariant("inv-pass", "api.no_page_specific_business_write", "blocking", "P0", "passed")], [Report("red")], ["signoff"]);
        Assert.AreEqual("blocked", decision.Status);
        Assert.AreEqual("P0", decision.Severity);
    }

    [TestMethod]
    public void GateDecisionWarnsOnP2ObservingWarning()
    {
        var decision = Calculate([Invariant("inv-p2", "runtime.warning", "observing", "P2", "warning")], [Report("green")], ["signoff"]);
        Assert.AreEqual("warning", decision.Status);
        Assert.AreEqual("P2", decision.Severity);
    }

    [TestMethod]
    public void GateDecisionPassesWhenAllInputsPassAndSignoffExists()
    {
        var decision = Calculate([Invariant("inv-pass", "api.no_page_specific_business_write", "blocking", "P0", "passed")], [Report("green")], ["business-approved"]);
        Assert.AreEqual("passed", decision.Status);
    }

    [TestMethod]
    public async Task ManualPassedStatusDoesNotBypassComputedBlockedResult()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-gate-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "invariants.json");
            var shadowPath = Path.Combine(temp.FullName, "shadow.json");
            var gatePath = Path.Combine(temp.FullName, "gate.json");
            RunnerJson.Write(invariantPath, new[] { Invariant("inv-p0", "runtime.control_plane_tables_exist", "blocking", "P0", "failed") });
            RunnerJson.Write(shadowPath, Report("green"));

            await GateRunner.Run(RunnerOptions.Parse(new[]
            {
                "--dry-run=true",
                "--status=passed",
                $"--invariant={invariantPath}",
                $"--shadow={shadowPath}",
                "--business-signoff=business-approved",
                $"--out={gatePath}"
            }));

            var gate = RunnerJson.Read<GateResultEvidence>(gatePath);
            Assert.AreEqual("blocked", gate.Status);
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    private static GateDecision Calculate(
        IReadOnlyList<InvariantCheckEvidence> invariants,
        IReadOnlyList<ShadowCompareEvidence> reports,
        IReadOnlyList<string> signoffs)
    {
        return GateDecisionCalculator.Calculate(new GateDecisionInput(invariants, reports, signoffs, new HashSet<string>(), RequireBusinessSignoff: true));
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

    private static ShadowCompareEvidence Report(string grade)
    {
        return new ShadowCompareEvidence(
            $"scr-{grade}",
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
