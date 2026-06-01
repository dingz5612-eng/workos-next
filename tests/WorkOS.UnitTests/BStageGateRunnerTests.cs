using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class BStageGateRunnerTests
{
    [TestMethod]
    public void BusinessLineAdmissionGuardBlocksL0ProductionConfirm()
    {
        var registry = BusinessLineAdmissionRegistry.LoadDefault();
        var guard = new BusinessLineAdmissionGuard(new BusinessLineAdmissionEvaluator(registry));

        var repair = guard.EnsureCanConfirm("repair");
        var parts = guard.EnsureCanConfirm("parts");

        Assert.IsFalse(repair.Allowed);
        Assert.IsFalse(parts.Allowed);
        Assert.AreEqual(403, repair.StatusCode);
        Assert.AreEqual(403, parts.StatusCode);
    }

    [TestMethod]
    public async Task BStageGateRunnerPassesOnlyWithMachineEvidence()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-b-stage-{Guid.NewGuid():N}"));
        try
        {
            var b1 = Path.Combine(temp.FullName, "b1.json");
            var b2 = Path.Combine(temp.FullName, "b2.json");
            var inv = Path.Combine(temp.FullName, "inv.json");
            var shadow = Path.Combine(temp.FullName, "shadow.json");
            var b3 = Path.Combine(temp.FullName, "b3.json");
            var surface = Path.Combine(temp.FullName, "surface.json");
            var rollback = Path.Combine(temp.FullName, "rollback.json");
            var signoff = Path.Combine(temp.FullName, "signoff.json");
            var output = Path.Combine(temp.FullName, "b-stage-gate.json");

            RunnerJson.Write(b1, Check("B1"));
            RunnerJson.Write(b3, Check("B3"));
            RunnerJson.Write(surface, Check("surface"));
            RunnerJson.Write(b2, CertificationReport());
            RunnerJson.Write(inv, new[] { Invariant("runtime.certification.pack_green", "passed") });
            RunnerJson.Write(shadow, Shadow("green"));
            File.WriteAllText(rollback, """
                {
                  "rollback_instruction_id": "rollback-b-stage-test",
                  "instruction_type": "rollback"
                }
                """);
            File.WriteAllText(signoff, """
                {
                  "approved": true,
                  "signoff_id": "business-signoff-test"
                }
                """);

            var result = await BStageGateRunner.Run(RunnerOptions.Parse([
                "--sourceMode=real",
                $"--b1={b1}",
                $"--b2={b2}",
                $"--b2Invariant={inv}",
                $"--b2Shadow={shadow}",
                $"--b3={b3}",
                $"--surface={surface}",
                $"--rollback={rollback}",
                $"--businessSignoff={signoff}",
                $"--out={output}"
            ]));

            Assert.AreEqual("passed", result.Status);
            Assert.AreEqual(0, result.NoGoItems.Count);
            Assert.IsTrue(File.Exists(output));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    private static BStageCheckResult Check(string name) =>
        new(name, "passed", "real", [$"node {name}"], [$"evidence:{name}"]);

    private static RuntimeCertificationEvidence CertificationReport() =>
        new(
            "cert-b2-test",
            "v5.4-dormitory-golden-pilot",
            "tenant-dormitory",
            "dormitory",
            "passed",
            "real",
            DateTimeOffset.UtcNow,
            "test",
            "ci-test",
            1,
            1,
            0,
            [RejectedScenario()],
            ["inv-runtime-certification-pack-green"],
            ["scr-b2-green"],
            new Dictionary<string, object>());

    private static RuntimeCertificationScenarioResult RejectedScenario() =>
        new(
            "dorm-cert-010",
            "missing evidence",
            "cmd-dorm-cert-010",
            "sub-dorm-cert-010",
            CanonicalOperationsApiService.ConfirmCommandType,
            "case-dorm-cert-010",
            "wi-dorm-cert-010",
            true,
            "passed",
            "business_blocked_422",
            "business_blocked_422",
            "not_committed",
            "not_projected",
            [],
            [],
            [],
            ["receipt-proof"],
            new FactTraceV1("tenant-dormitory", "trace-sub-dorm-cert-010", "case-dorm-cert-010", "wi-dorm-cert-010", "sub-dorm-cert-010", [], [], [], []),
            new RejectedCommandSubmissionV1("tenant-dormitory", "sub-dorm-cert-010", "case-dorm-cert-010", "wi-dorm-cert-010", "rejected", 422, "missing_required_evidence", "missing_required_evidence"),
            new RejectionTraceV1("tenant-dormitory", "rej-trace-sub-dorm-cert-010", "case-dorm-cert-010", "wi-dorm-cert-010", "sub-dorm-cert-010", "evidence-policy", 422, "missing_required_evidence", ["receipt-proof"], [], []),
            "green",
            ["runtime.certification.dorm-cert-010.fact_trace"],
            "422",
            "dual_compare",
            "evidence-required-before-confirm",
            null);

    private static InvariantCheckEvidence Invariant(string key, string status) =>
        new(
            $"inv-{key.Replace('.', '-')}",
            "v5.4-dormitory-golden-pilot",
            "tenant-dormitory",
            "dormitory",
            key,
            key,
            "blocking",
            "P0",
            "b-stage-test",
            null,
            "scripts/v5_4/b-gate-runner.mjs",
            status,
            new Dictionary<string, object>(),
            new Dictionary<string, object>(),
            status == "passed" ? 0 : 1,
            [],
            "test",
            "ci-test",
            DateTimeOffset.UtcNow)
        {
            SourceMode = "real"
        };

    private static ShadowCompareEvidence Shadow(string grade) =>
        new(
            $"scr-b2-{grade}",
            "v5.4-dormitory-golden-pilot",
            "tenant-dormitory",
            "dormitory",
            new Dictionary<string, object>(),
            "legacy",
            "runtime",
            "semantic-shadow",
            DateTimeOffset.UtcNow,
            grade,
            1,
            grade == "green" ? 1 : 0,
            grade == "green" ? 0 : 1,
            0,
            0,
            [],
            new Dictionary<string, object>(),
            "test",
            "ci-test")
        {
            SourceMode = "real"
        };
}
