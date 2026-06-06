using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryRuntimeAdmissionGuardTests
{
    [TestMethod]
    public void rejected_permission_replay_leaves_auditable_submission_without_business_facts()
    {
        var store = DormitoryRuntimeReplayHarness.CreatePostgresStore();
        var unitOfWork = DormitoryRuntimeReplayHarness.CreateUnitOfWork(store);
        var suffix = Guid.NewGuid().ToString("N");
        var request = DormitoryRuntimeReplayHarness.Request(
            tenantId: "tenant-d1-test",
            caseId: $"case-d1-admission-{suffix}",
            workItemId: $"wi-d1-admission-{suffix}",
            cardId: "roomSetup",
            idempotencyKey: $"idem-d1-admission-{suffix}",
            fields: new Dictionary<string, object>
            {
                ["runtimeReplayPolicy"] = "permission_denied_403",
                ["roomId"] = "room-denied"
            });

        var result = unitOfWork.Commit(request);
        var trace = store.GetFactTraceBySubmission(result.SubmissionId);

        Assert.AreEqual(403, result.StatusCode);
        Assert.AreEqual("not_committed", result.CommitStatus);
        Assert.IsNotNull(trace);
        Assert.HasCount(0, trace.DomainEventRefs);
        Assert.HasCount(0, trace.LedgerTransactionRefs);
        Assert.HasCount(0, trace.LedgerEntryRefs);
    }

    [TestMethod]
    public void d1_contract_keeps_repair_parts_hr_l0_and_blocks_business_production_go()
    {
        using var contract = DormitoryRuntimeReplayHarness.ReadJson("docs/contracts/oam.dormitory-runtime-replay.json");
        var boundary = contract.RootElement.GetProperty("runtimeBoundary");

        Assert.AreEqual("OAM Current Controlled Domain", boundary.GetProperty("dormitoryStatus").GetString());
        Assert.IsFalse(boundary.GetProperty("dormitoryProductionAllowed").GetBoolean());
        Assert.AreEqual("OAM Contract Preview", boundary.GetProperty("repairStatus").GetString());
        Assert.AreEqual("OAM Contract Preview", boundary.GetProperty("partsStatus").GetString());
        Assert.AreEqual("OAM Contract Preview", boundary.GetProperty("hrStatus").GetString());
        Assert.IsFalse(boundary.GetProperty("businessProductionGo").GetBoolean());
    }
}
