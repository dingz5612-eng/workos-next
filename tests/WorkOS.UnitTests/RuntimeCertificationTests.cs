using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class RuntimeCertificationTests
{
    [TestMethod]
    public void CertificationScenarioDocumentDefinesReplayablePack()
    {
        var file = RunnerJson.Read<RuntimeCertificationScenarioFile>(RepoPath("docs", "v5.4", "certification-scenarios.json"));
        var ids = file.Scenarios.Select(item => item.ScenarioId).ToArray();

        CollectionAssert.AreEqual(
            Enumerable.Range(1, 14).Select(item => $"cert-{item:000}").ToArray(),
            ids);
        Assert.IsTrue(file.Scenarios.All(item => !string.IsNullOrWhiteSpace(item.ExpectedOutcome)));
        Assert.IsTrue(file.Scenarios.Any(item => item.ExpectedOutcome == "semantic_shadow_red_blocked"));
        Assert.IsTrue(file.Scenarios.Any(item => item.ExpectedOutcome == "missing_rollback_blocked"));
        Assert.IsTrue(file.Scenarios.Any(item => item.ExpectedOutcome == "missing_signoff_blocked"));
    }

    [TestMethod]
    public async Task RuntimeCertificationRunnerReplaysScenariosAndEmitsGateEvidence()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-cert-{Guid.NewGuid():N}"));
        try
        {
            var reportPath = Path.Combine(temp.FullName, "certification.json");
            var invariantPath = Path.Combine(temp.FullName, "invariants.json");
            var shadowPath = Path.Combine(temp.FullName, "shadow.json");

            await RuntimeCertificationRunner.Run(RunnerOptions.Parse(new[]
            {
                "--ciRunId=ci-cert",
                $"--out={reportPath}",
                $"--invariantOut={invariantPath}",
                $"--shadowOut={shadowPath}"
            }));

            var report = RunnerJson.Read<RuntimeCertificationEvidence>(reportPath);
            var invariants = RunnerJson.Read<List<InvariantCheckEvidence>>(invariantPath);
            var shadow = RunnerJson.Read<ShadowCompareEvidence>(shadowPath);

            Assert.AreEqual("passed", report.Status);
            Assert.AreEqual(14, report.ScenarioCount);
            Assert.AreEqual(14, report.PassedScenarioCount);
            Assert.AreEqual("green", shadow.Grade);
            Assert.IsTrue(invariants.Any(item => item.InvariantKey == "runtime.certification.pack_green" && item.Status == "passed"));
            Assert.IsTrue(report.Scenarios.All(item => item.Replayable));
            Assert.IsTrue(report.Scenarios.All(item => item.InvariantChecks.Count >= 3));

            var scenario012 = report.Scenarios.Single(item => item.ScenarioId == "cert-012");
            Assert.AreEqual("red", scenario012.SemanticShadowResult);
            Assert.AreEqual("red", scenario012.GateImpact);

            var committedMoney = report.Scenarios.Where(item => item.LedgerTransactionRefs.Count > 0).ToArray();
            Assert.IsTrue(committedMoney.Length >= 4, "money certification scenarios must emit ledger transaction refs");
            Assert.IsTrue(committedMoney.All(item => item.FactTrace?.LedgerTransactionRefs.Count > 0));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public async Task CertificationRedInvariantMakesFormalGateFail()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-cert-gate-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "invariants.json");
            var shadowPath = Path.Combine(temp.FullName, "shadow.json");
            var rollbackPath = Path.Combine(temp.FullName, "rollback.json");
            var gatePath = Path.Combine(temp.FullName, "gate.json");

            RunnerJson.Write(invariantPath, new[]
            {
                Invariant("runtime.certification.pack_green", "failed")
            });
            RunnerJson.Write(shadowPath, Report("green"));
            File.WriteAllText(rollbackPath, """
                {
                  "rollback_instruction_id": "rollback-cert",
                  "instruction_type": "rollback"
                }
                """);

            await ExpectInvalidOperation(() =>
                GateRunner.Run(RunnerOptions.Parse(new[]
                {
                    "--dry-run=true",
                    "--formal-release-gate=true",
                    "--require-business-signoff=false",
                    "--ciRunId=ci-cert",
                    $"--rollback={rollbackPath}",
                    $"--invariant={invariantPath}",
                    $"--shadow={shadowPath}",
                    $"--out={gatePath}"
                })));

            var gate = RunnerJson.Read<GateResultEvidence>(gatePath);
            Assert.AreEqual("blocked", gate.Status);
            Assert.IsTrue(gate.NoGoItems.Any(item => item.Contains("runtime.certification.pack_green", StringComparison.Ordinal)));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public async Task RedShadowAndMissingSignoffRemainFormalGateBlockers()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-cert-shadow-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "invariants.json");
            var redShadowPath = Path.Combine(temp.FullName, "red-shadow.json");
            var greenShadowPath = Path.Combine(temp.FullName, "green-shadow.json");
            var rollbackPath = Path.Combine(temp.FullName, "rollback.json");
            var redGatePath = Path.Combine(temp.FullName, "red-gate.json");
            var signoffGatePath = Path.Combine(temp.FullName, "signoff-gate.json");

            RunnerJson.Write(invariantPath, new[] { Invariant("runtime.certification.pack_green", "passed") });
            RunnerJson.Write(redShadowPath, Report("red"));
            RunnerJson.Write(greenShadowPath, Report("green"));
            File.WriteAllText(rollbackPath, """
                {
                  "rollback_instruction_id": "rollback-cert",
                  "instruction_type": "rollback"
                }
                """);

            await ExpectInvalidOperation(() =>
                GateRunner.Run(RunnerOptions.Parse(new[]
                {
                    "--dry-run=true",
                    "--formal-release-gate=true",
                    "--require-business-signoff=false",
                    "--ciRunId=ci-cert",
                    $"--rollback={rollbackPath}",
                    $"--invariant={invariantPath}",
                    $"--shadow={redShadowPath}",
                    $"--out={redGatePath}"
                })));
            var redGate = RunnerJson.Read<GateResultEvidence>(redGatePath);
            Assert.AreEqual("blocked", redGate.Status);
            Assert.IsTrue(redGate.NoGoItems.Any(item => item.Contains("Red shadow compare report", StringComparison.Ordinal)));

            await ExpectInvalidOperation(() =>
                GateRunner.Run(RunnerOptions.Parse(new[]
                {
                    "--dry-run=true",
                    "--formal-release-gate=true",
                    "--ciRunId=ci-cert",
                    $"--rollback={rollbackPath}",
                    $"--invariant={invariantPath}",
                    $"--shadow={greenShadowPath}",
                    $"--out={signoffGatePath}"
                })));
            var signoffGate = RunnerJson.Read<GateResultEvidence>(signoffGatePath);
            Assert.AreEqual("not_run", signoffGate.Status);
            Assert.IsTrue(signoffGate.NoGoItems.Any(item => item.Contains("Business signoff refs are missing", StringComparison.Ordinal)));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void SemanticShadowRulesCoverRuntimeCertificationRedRules()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "shadow-compare-semantic-rules.json")));
        var root = document.RootElement;
        var checks = root.GetProperty("checks").EnumerateArray().Select(item => item.GetProperty("check_id").GetString()).ToArray();
        CollectionAssert.Contains(checks, "shadow.evidence_state");
        CollectionAssert.Contains(checks, "shadow.domain_event_graph");
        CollectionAssert.Contains(checks, "shadow.work_item_timeline");

        var redRules = string.Join("\n", root.GetProperty("grade_rules").GetProperty("red").EnumerateArray().Select(item => item.GetString()));
        Assert.IsTrue(redRules.Contains("evidence hash mismatch", StringComparison.Ordinal));
        Assert.IsTrue(redRules.Contains("missing domain event", StringComparison.Ordinal));
        Assert.IsTrue(redRules.Contains("work item final status mismatch", StringComparison.Ordinal));

        var runner = File.ReadAllText(RepoPath("tools", "control-plane", "WorkOS.ControlPlaneRunners", "ShadowCompareRunner.cs"));
        Assert.IsTrue(runner.Contains("EvidenceStateCompare", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("DomainEventGraphCompare", StringComparison.Ordinal));
        Assert.IsTrue(runner.Contains("WorkItemTimelineCompare", StringComparison.Ordinal));
    }

    private static InvariantCheckEvidence Invariant(string key, string status) =>
        new(
            $"inv-{key.Replace('.', '-')}",
            "v5.4-runtime-certification",
            "tenant-a",
            "operations-runtime",
            key,
            key,
            "blocking",
            "P0",
            "runtime-certification",
            null,
            "scripts/v5_4/certify-runtime.mjs",
            status,
            new Dictionary<string, object>(),
            new Dictionary<string, object>(),
            status == "passed" ? 0 : 1,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            "test",
            "ci-test",
            DateTimeOffset.UtcNow);

    private static ShadowCompareEvidence Report(string grade) =>
        new(
            $"scr-cert-{grade}",
            "v5.4-runtime-certification",
            "tenant-a",
            "operations-runtime",
            new Dictionary<string, object> { ["type"] = "semantic_certification_fact_graph" },
            "legacy-runtime",
            "operations-runtime",
            "semantic-shadow",
            DateTimeOffset.UtcNow,
            grade,
            1,
            grade == "green" ? 1 : 0,
            grade == "green" ? 0 : 1,
            0,
            0,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            new Dictionary<string, object> { ["status"] = grade == "green" ? "semantic_green" : "semantic_red" },
            "test",
            "ci-test");

    private static async Task ExpectInvalidOperation(Func<Task> action)
    {
        try
        {
            await action();
            Assert.Fail("Expected InvalidOperationException.");
        }
        catch (InvalidOperationException)
        {
        }
    }

    private static string RepoPath(params string[] parts)
    {
        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        return Path.Combine(new[] { current?.FullName ?? Directory.GetCurrentDirectory() }.Concat(parts).ToArray());
    }
}
