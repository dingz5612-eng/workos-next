using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class CutoverStateMachineTests
{
    [TestMethod]
    public void CutoverStateMachineDocumentDefinesS7StatesAndNoProductionShortcuts()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "cutover-state-machine.json")));
        var root = document.RootElement;
        var states = root.GetProperty("states").EnumerateArray().Select(item => item.GetString()).ToArray();
        CollectionAssert.AreEqual(CutoverStateMachine.States, states);
        Assert.IsFalse(root.GetProperty("production_activation").GetProperty("all_tenant_switch_allowed").GetBoolean());
        Assert.IsFalse(root.GetProperty("production_activation").GetProperty("dormitory_production_ready").GetBoolean());
        Assert.IsFalse(root.GetProperty("production_activation").GetProperty("repair_production_ready").GetBoolean());
        Assert.IsFalse(root.GetProperty("production_activation").GetProperty("parts_production_ready").GetBoolean());
    }

    [TestMethod]
    public void LegalTransitionsRequireTheirSpecificEvidence()
    {
        Assert.IsTrue(CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest(
            "off",
            "shadow",
            SchemaPass: true,
            ContractPass: true)).Allowed);
        Assert.IsFalse(CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest("off", "shadow")).Allowed);

        Assert.IsTrue(CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest(
            "shadow",
            "dual_compare",
            CertificationPass: true)).Allowed);
        Assert.IsFalse(CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest("shadow", "dual_compare")).Allowed);

        Assert.IsTrue(CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest(
            "dual_compare",
            "adapter_primary",
            SemanticShadowGreen: true)).Allowed);
        Assert.IsFalse(CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest("dual_compare", "adapter_primary")).Allowed);

        Assert.IsTrue(CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest(
            "adapter_primary",
            "operations_primary",
            BusinessSignoffPresent: true,
            RollbackInstructionPresent: true)).Allowed);
        var blocked = CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest(
            "adapter_primary",
            "operations_primary",
            BusinessSignoffPresent: true));
        Assert.IsFalse(blocked.Allowed);
        CollectionAssert.Contains(blocked.Blockers.ToArray(), "operations_primary_requires_signoff_and_rollback");
    }

    [TestMethod]
    public void RedShadowHoldsOrRollsBackInsteadOfActivating()
    {
        var active = CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest(
            "dual_compare",
            "adapter_primary",
            SemanticShadowGreen: true,
            RedShadow: true));
        Assert.IsFalse(active.Allowed);
        Assert.IsTrue(active.Hold);
        Assert.IsTrue(active.RollbackRecommended);

        var rollback = CutoverStateMachine.EvaluateTransition(new CutoverTransitionRequest(
            "operations_primary",
            "rollback",
            RedShadow: true));
        Assert.IsTrue(rollback.Allowed);
        Assert.AreEqual("rollback_to_legacy_or_hold", rollback.WritePath);
    }

    [TestMethod]
    public void SliceCutoverStateDecidesTargetedWritePath()
    {
        var target = new CutoverFeatureFlagTarget(
            TenantIds: ["tenant-a"],
            SliceIds: ["operations-runtime"],
            RoleIds: ["manager"],
            ActorIds: ["actor-1"],
            DeviceIds: ["device-1"],
            MinAmount: 10m,
            MaxAmount: 500m);
        var context = new CutoverFeatureFlagContext(
            "tenant-a",
            "operations-runtime",
            "manager",
            "actor-1",
            "device-1",
            120m);

        var decision = CutoverStateMachine.DecideRuntimePath("operations_primary", target, context);
        Assert.IsTrue(decision.Targeted);
        Assert.AreEqual("operations_runtime", decision.WritePath);

        var outsideAmount = context with { Amount = 1000m };
        var fallback = CutoverStateMachine.DecideRuntimePath("operations_primary", target, outsideAmount);
        Assert.IsFalse(fallback.Targeted);
        Assert.AreEqual("legacy_workspace_card", fallback.WritePath);
    }

    [TestMethod]
    public async Task CutoverStateRunnerTurnsIllegalTransitionIntoGateBlockingInvariant()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-cutover-{Guid.NewGuid():N}"));
        try
        {
            var invariantPath = Path.Combine(temp.FullName, "cutover-invariants.json");
            var shadowPath = Path.Combine(temp.FullName, "shadow.json");
            var rollbackPath = Path.Combine(temp.FullName, "rollback.json");
            var gatePath = Path.Combine(temp.FullName, "gate.json");

            try
            {
                await CutoverStateRunner.Run(RunnerOptions.Parse(new[]
                {
                    "--from=adapter_primary",
                    "--to=operations_primary",
                    "--business-signoff=true",
                    "--fail-on-blocked=true",
                    $"--out={invariantPath}"
                }));
                Assert.Fail("Missing rollback instruction must block operations_primary transition.");
            }
            catch (InvalidOperationException)
            {
            }

            RunnerJson.Write(shadowPath, Report("green"));
            File.WriteAllText(rollbackPath, """
                {
                  "rollback_instruction_id": "rollback-cutover",
                  "instruction_type": "rollback"
                }
                """);

            try
            {
                await GateRunner.Run(RunnerOptions.Parse(new[]
                {
                    "--dry-run=true",
                    "--formal-release-gate=true",
                    "--require-business-signoff=false",
                    "--ciRunId=ci-cutover",
                    $"--rollback={rollbackPath}",
                    $"--invariant={invariantPath}",
                    $"--shadow={shadowPath}",
                    $"--out={gatePath}"
                }));
                Assert.Fail("Formal gate should fail on illegal cutover transition invariant.");
            }
            catch (InvalidOperationException)
            {
            }

            var gate = RunnerJson.Read<GateResultEvidence>(gatePath);
            Assert.AreEqual("blocked", gate.Status);
            Assert.IsTrue(gate.NoGoItems.Any(item => item.Contains("cutover.illegal_transition_blocked", StringComparison.Ordinal)));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void ReleaseControlReadModelStillExposesRealCutoverState()
    {
        var source = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ControlPlaneReadStore.cs"));
        Assert.IsTrue(source.Contains("SliceCutoverStateRead", StringComparison.Ordinal));
        Assert.IsTrue(source.Contains("runtime_mode", StringComparison.Ordinal));
        Assert.IsTrue(source.Contains("SliceRuntimeMode", StringComparison.Ordinal));
        Assert.IsTrue(source.Contains("rollback_instruction_id", StringComparison.Ordinal));
    }

    private static ShadowCompareEvidence Report(string grade) =>
        new(
            $"scr-cutover-{grade}",
            "v5.4-cutover-state",
            "tenant-a",
            "operations-runtime",
            new Dictionary<string, object> { ["type"] = "semantic_cutover" },
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
