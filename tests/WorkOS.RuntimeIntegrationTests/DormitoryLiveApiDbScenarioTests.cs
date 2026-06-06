using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryLiveApiDbScenarioTests
{
    [TestMethod]
    public void d1_runner_executes_operations_api_and_rejects_synthetic_mode()
    {
        var runner = DormitoryRuntimeReplayHarness.ReadText("scripts/oma/run-dormitory-live-api-db-scenarios.mjs");
        var contract = DormitoryRuntimeReplayHarness.ReadText("docs/contracts/oma.dormitory-runtime-replay.json");

        foreach (var required in new[]
        {
            "/api/operations/cases",
            "/api/operations/work-items",
            "/api/evidence/drafts",
            "/api/operations/work-items/{workItemId}/prepare",
            "/api/operations/work-items/{workItemId}/confirm",
            "/api/operations/trace/submissions/{submissionId}",
            "/api/operations/trace/work-items/{workItemId}",
            "/api/operations/trace/cases/{caseId}"
        })
        {
            StringAssert.Contains(runner + contract, required);
        }

        StringAssert.Contains(runner, "const sourceMode = \"real_api_db\"");
        StringAssert.Contains(runner, "retiredWorkspaceCardWritePathUsed");
        Assert.IsFalse(runner.Contains("POST\", \"/api/workspaces/", StringComparison.Ordinal), "D1 ordinary replay must not call workspace/card confirm routes.");
        StringAssert.Contains(contract, "\"allowSyntheticDomainEvent\": false");
        StringAssert.Contains(contract, "\"allowSyntheticLedgerTransaction\": false");
    }
}
