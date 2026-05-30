using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class DormitoryCertificationGateTests
{
    [TestMethod]
    public async Task DormitoryCertificationRunnerReplaysTenScenarioPack()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-dorm-cert-{Guid.NewGuid():N}"));
        try
        {
            var reportPath = Path.Combine(temp.FullName, "dormitory-certification.json");
            var invariantPath = Path.Combine(temp.FullName, "dormitory-invariants.json");
            var shadowPath = Path.Combine(temp.FullName, "dormitory-shadow.json");

            await DormitoryCertificationRunner.Run(RunnerOptions.Parse(new[]
            {
                "--ciRunId=ci-dormitory",
                $"--out={reportPath}",
                $"--invariantOut={invariantPath}",
                $"--shadowOut={shadowPath}"
            }));

            var report = RunnerJson.Read<RuntimeCertificationEvidence>(reportPath);
            var invariants = RunnerJson.Read<List<InvariantCheckEvidence>>(invariantPath);
            var shadow = RunnerJson.Read<ShadowCompareEvidence>(shadowPath);

            Assert.AreEqual("passed", report.Status);
            Assert.AreEqual("dormitory", report.SliceId);
            Assert.AreEqual(10, report.ScenarioCount);
            Assert.AreEqual(10, report.PassedScenarioCount);
            Assert.AreEqual("green", shadow.Grade);
            Assert.IsTrue(report.Scenarios.Any(item => item.ScenarioId == "dorm-cert-002" && item.LedgerTransactionRefs.Count > 0));
            Assert.IsTrue(report.Scenarios.Any(item => item.ScenarioId == "dorm-cert-010" && item.OutcomeStatus == "business_blocked_422"));
            Assert.IsTrue(invariants.Any(item => item.InvariantKey == "runtime.certification.pack_green" && item.Status == "passed"));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public async Task DormitoryGateBlocksRedShadowP0InvariantAndMissingRollback()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-dorm-gate-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "invariants.json");
            var p0InvariantPath = Path.Combine(temp.FullName, "p0-invariants.json");
            var redShadowPath = Path.Combine(temp.FullName, "red-shadow.json");
            var greenShadowPath = Path.Combine(temp.FullName, "green-shadow.json");
            var rollbackPath = Path.Combine(temp.FullName, "rollback.json");
            var redGatePath = Path.Combine(temp.FullName, "red-gate.json");
            var p0GatePath = Path.Combine(temp.FullName, "p0-gate.json");
            var rollbackGatePath = Path.Combine(temp.FullName, "rollback-gate.json");

            RunnerJson.Write(invariantPath, new[] { Invariant("runtime.certification.pack_green", "passed") });
            RunnerJson.Write(p0InvariantPath, new[] { Invariant("runtime.certification.pack_green", "failed") });
            RunnerJson.Write(redShadowPath, Shadow("red"));
            RunnerJson.Write(greenShadowPath, Shadow("green"));
            File.WriteAllText(rollbackPath, """
                {
                  "rollback_instruction_id": "rollback-dormitory",
                  "instruction_type": "rollback"
                }
                """);

            await ExpectBlocked(redGatePath, invariantPath, redShadowPath, rollbackPath, "Red shadow compare report");
            await ExpectBlocked(p0GatePath, p0InvariantPath, greenShadowPath, rollbackPath, "runtime.certification.pack_green");
            await ExpectBlocked(rollbackGatePath, invariantPath, greenShadowPath, null, "Formal release gate requires an existing rollback instruction");
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    private static async Task ExpectBlocked(
        string gatePath,
        string invariantPath,
        string shadowPath,
        string? rollbackPath,
        string expectedNoGo)
    {
        var args = new List<string>
        {
            "--dry-run=true",
            "--formal-release-gate=true",
            "--require-business-signoff=false",
            "--ciRunId=ci-dormitory",
            $"--invariant={invariantPath}",
            $"--shadow={shadowPath}",
            $"--out={gatePath}"
        };
        if (rollbackPath is not null)
        {
            args.Add($"--rollback={rollbackPath}");
        }

        try
        {
            await GateRunner.Run(RunnerOptions.Parse(args));
            Assert.Fail("GateRunner should block invalid Dormitory certification evidence.");
        }
        catch (InvalidOperationException)
        {
        }
        var gate = RunnerJson.Read<GateResultEvidence>(gatePath);
        Assert.AreEqual("blocked", gate.Status);
        Assert.IsTrue(gate.NoGoItems.Any(item => item.Contains(expectedNoGo, StringComparison.Ordinal)));
    }

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
            "dormitory-certification",
            null,
            "scripts/v5_4/certify-dormitory.mjs",
            status,
            new Dictionary<string, object>(),
            new Dictionary<string, object>(),
            status == "passed" ? 0 : 1,
            status == "passed" ? Array.Empty<IReadOnlyDictionary<string, object>>() : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["scenario"] = "dormitory" } },
            "dormitory-certification-runner",
            "ci-dormitory",
            DateTimeOffset.UtcNow)
        {
            SourceMode = "real"
        };

    private static ShadowCompareEvidence Shadow(string grade) =>
        new(
            $"scr-dormitory-{grade}",
            "v5.4-dormitory-golden-pilot",
            "tenant-dormitory",
            "dormitory",
            new Dictionary<string, object> { ["type"] = "dormitory-semantic-shadow" },
            "legacy-dormitory",
            "operations-dormitory",
            "semantic-shadow-fact-graph",
            DateTimeOffset.UtcNow,
            grade,
            1,
            grade == "red" ? 0 : 1,
            grade == "red" ? 1 : 0,
            0,
            0,
            grade == "red"
                ? new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["reason"] = "money amount mismatch" } }
                : Array.Empty<IReadOnlyDictionary<string, object>>(),
            new Dictionary<string, object> { ["mode"] = "dormitory-certification" },
            "dormitory-certification-runner",
            "ci-dormitory")
        {
            SourceMode = "real"
        };
}
