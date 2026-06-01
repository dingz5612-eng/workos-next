using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryRuntimeProofTests
{
    [TestMethod]
    public void oam03_runtime_proof_contract_requires_live_api_db_chain()
    {
        var contract = DormitoryRuntimeReplayHarness.ReadText("docs/proof/runtime-proof-contract.yml");
        var proofPack = DormitoryRuntimeReplayHarness.ReadText("docs/go-live/dormitory/runtime-proof-pack.yml");
        var runner = DormitoryRuntimeReplayHarness.ReadText("scripts/proof/run-runtime-proof.mjs");
        var checker = DormitoryRuntimeReplayHarness.ReadText("scripts/proof/check-runtime-proof-result.mjs");

        foreach (var required in new[]
        {
            "live_api_db",
            "persisted_work_item_runtime_model",
            "prepare_command_submission_trace",
            "confirm_through_operations_unit_of_work",
            "committed_domain_event",
            "money_ledger_transaction",
            "rejected_command_submission",
            "rejected_has_no_domain_event_or_ledger",
            "projection_lens_replay",
            "trace_api_chain",
            "compatibility_fallback_not_used"
        })
        {
            StringAssert.Contains(contract + proofPack + runner + checker, required);
        }

        foreach (var route in new[]
        {
            "/api/operations/cases",
            "/api/operations/work-items",
            "/api/operations/work-items/{workItemId}/prepare",
            "/api/operations/work-items/{workItemId}/confirm",
            "/api/operations/trace/submissions/{submissionId}",
            "/api/operations/trace/work-items/{workItemId}",
            "/api/operations/trace/cases/{caseId}"
        })
        {
            StringAssert.Contains(contract + proofPack + runner, route);
        }

        StringAssert.Contains(runner, "scripts/go-live/run-dormitory-live-api-db-scenarios.mjs");
        StringAssert.Contains(runner, "synthetic_business_fact_forbidden");
        Assert.IsFalse(contract.Contains(".tmp/", StringComparison.Ordinal), "OAM-03 final evidence refs must not use .tmp.");
    }

    [TestMethod]
    public void oam03_runtime_proof_pack_keeps_l1_boundaries()
    {
        var contract = DormitoryRuntimeReplayHarness.ReadText("docs/proof/runtime-proof-contract.yml");
        var proofPack = DormitoryRuntimeReplayHarness.ReadText("docs/go-live/dormitory/runtime-proof-pack.yml");

        StringAssert.Contains(contract + proofPack, "\"dormitoryL2Allowed\": false");
        StringAssert.Contains(contract + proofPack, "\"businessProductionAllowed\": false");
        StringAssert.Contains(contract + proofPack, "\"repairPartsHrProductionAllowed\": false");
    }
}
