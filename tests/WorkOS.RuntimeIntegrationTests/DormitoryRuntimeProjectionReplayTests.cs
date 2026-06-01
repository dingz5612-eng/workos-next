using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryRuntimeProjectionReplayTests
{
    [TestMethod]
    public void d1_replay_contract_requires_projection_checkpoint_lens_and_fact_trace_db_assertions()
    {
        var contract = DormitoryRuntimeReplayHarness.ReadText("docs/go-live/dormitory/runtime-replay-contract.yml");
        var runner = DormitoryRuntimeReplayHarness.ReadText("scripts/go-live/run-dormitory-live-api-db-scenarios.mjs");

        foreach (var required in new[] { "ProjectionCheckpoint", "Lens", "FactTrace", "projection_checkpoints", "deposit_balance_projection", "/api/lenses/accommodation" })
        {
            StringAssert.Contains(contract + runner, required);
        }

        Assert.IsFalse(contract.Contains(".tmp/", StringComparison.Ordinal), "D1 final evidence refs must not use .tmp.");
        StringAssert.Contains(runner, "dbAssertions");
        StringAssert.Contains(runner, "lensOutputs");
    }
}
