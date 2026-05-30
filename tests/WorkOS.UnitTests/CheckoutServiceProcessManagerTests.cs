using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class CheckoutServiceProcessManagerTests
{
    [TestMethod]
    public void checkout_started_creates_room_inspection_work_item()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-checkout-started", "Accommodation.ResidentCheckedOut", new Dictionary<string, string>
        {
            ["checkoutId"] = "checkout-001",
            ["stayId"] = "stay-001"
        }), sink);

        AssertHasRun(result, CheckoutServiceProcessRuleIds.CheckoutStartedCreatesRoomInspectionWorkItem);
        var workItem = SingleWorkItem(result, "roomInspection");
        Assert.AreEqual("W-STAY-CHECKOUT-SETTLEMENT", workItem.TargetWorkspaceId);
        Assert.AreEqual("checkout-001", workItem.Payload["checkoutId"]);
        Assert.AreEqual("stay-001", workItem.Payload["stayId"]);
    }

    [TestMethod]
    public void room_inspected_damage_creates_deposit_settlement_work_item()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-room-inspected-damage", "Accommodation.RoomInspected", new Dictionary<string, string>
        {
            ["checkoutId"] = "checkout-001",
            ["damageChargeAmount"] = "125.50"
        }), sink);

        AssertHasRun(result, CheckoutServiceProcessRuleIds.RoomInspectedDamageCreatesDepositSettlementWorkItem);
        var workItem = SingleWorkItem(result, "depositSettlement");
        Assert.AreEqual("finance", workItem.OwnerRole);
        Assert.AreEqual("125.50", workItem.Payload["damageAmount"]);
        Assert.AreEqual("false", workItem.Payload["writesDepositEntry"]);
    }

    [TestMethod]
    public void room_inspected_cleaning_creates_service_task()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-room-inspected-cleaning", "Accommodation.RoomInspected", new Dictionary<string, string>
        {
            ["checkoutId"] = "checkout-001",
            ["cleaningRequired"] = "true",
            ["roomId"] = "room-001",
            ["bedId"] = "bed-001"
        }), sink);

        AssertHasRun(result, CheckoutServiceProcessRuleIds.RoomInspectedCleaningCreatesServiceTaskWorkItem);
        var workItem = SingleWorkItem(result, "serviceTaskCreate");
        Assert.AreEqual("W-STAY-SERVICE-TASK", workItem.TargetWorkspaceId);
        Assert.AreEqual("cleaning", workItem.Payload["taskType"]);
        Assert.AreEqual("room-001", workItem.Payload["roomId"]);
        Assert.AreEqual("bed-001", workItem.Payload["bedId"]);
    }

    [TestMethod]
    public void service_verified_creates_resource_release_request_work_item()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-service-verified", "Accommodation.ServiceTaskVerified", new Dictionary<string, string>
        {
            ["caseId"] = "case-001",
            ["taskId"] = "task-001",
            ["roomId"] = "room-001",
            ["bedId"] = "bed-001"
        }), sink);

        AssertHasRun(result, CheckoutServiceProcessRuleIds.ServiceTaskVerifiedCreatesResourceReleaseWorkItem);
        var workItem = SingleWorkItem(result, "resourceReleaseRequest");
        Assert.AreEqual("W-STAY-RESOURCE", workItem.TargetWorkspaceId);
        Assert.AreEqual("false", workItem.Payload["writesBedStatus"]);
        Assert.AreEqual("case-001", workItem.Payload["caseId"]);
    }

    [TestMethod]
    public void resource_release_requested_routes_to_resource_inventory()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-release-requested", "Accommodation.BedReleaseAfterServiceRequested", new Dictionary<string, string>
        {
            ["caseId"] = "case-001",
            ["bedId"] = "bed-001"
        }), sink);

        AssertHasRun(result, CheckoutServiceProcessRuleIds.ResourceReleaseRequestedRoutesToResourceInventory);
        var request = SingleRequest(result, "Accommodation.ResourceReleaseRoutedToResourceInventory");
        Assert.AreEqual("Accommodation.ResourceSetup", request.TargetSliceId);
        Assert.AreEqual("false", request.Payload["writesBedStatus"]);
    }

    [TestMethod]
    public void bed_released_triggers_case_closure_check()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-bed-released", "Accommodation.BedReleased", new Dictionary<string, string>
        {
            ["checkoutId"] = "checkout-001",
            ["bedId"] = "bed-001"
        }), sink);

        AssertHasRun(result, CheckoutServiceProcessRuleIds.BedReleasedEvaluatesCaseClosurePolicy);
        var request = SingleRequest(result, "Accommodation.CaseClosurePolicyEvaluationRequested");
        Assert.AreEqual("Accommodation.CheckOutSettlement", request.TargetSliceId);
        Assert.AreEqual("false", request.Payload["closesCaseWithoutClosurePolicy"]);
        Assert.AreEqual("bed-001", request.Payload["bedId"]);
    }

    [TestMethod]
    public void process_dedupe_prevents_duplicate_work_items()
    {
        var sink = new InMemoryProcessRunSink();
        var workspaceEvent = Event("evt-dedupe", "Accommodation.ResidentCheckedOut", new Dictionary<string, string>
        {
            ["checkoutId"] = "checkout-001"
        });

        var first = Manager().Handle(workspaceEvent, sink);
        var second = Manager().Handle(workspaceEvent, sink);

        Assert.AreEqual(1, first.ProcessRuns.Count);
        Assert.AreEqual(1, first.WorkItemIntents.Count);
        Assert.AreEqual(0, second.ProcessRuns.Count);
        Assert.AreEqual(0, second.WorkItemIntents.Count);
        Assert.AreEqual(1, sink.WorkItemIntents.Count);
        Assert.AreEqual(1, sink.ProcessRuns.Count);
    }

    private static CheckoutServiceProcessManager Manager() => new();

    private static WorkspaceEvent Event(string eventId, string eventType, IReadOnlyDictionary<string, string> payload) =>
        new(
            eventId,
            "tenant-001",
            "card-001",
            eventType,
            $"corr-{eventId}",
            null,
            $"req-{eventId}",
            "operator",
            "actor-001",
            DateTimeOffset.Parse("2026-05-29T00:00:00Z"),
            payload,
            Array.Empty<string>());

    private static void AssertHasRun(CheckoutServiceProcessManagerResult result, string ruleId) =>
        Assert.IsTrue(result.ProcessRuns.Any(item => item.ProcessRuleId == ruleId), $"missing process run {ruleId}");

    private static ProcessWorkItemIntentRecord SingleWorkItem(CheckoutServiceProcessManagerResult result, string workItemType) =>
        result.WorkItemIntents.Single(item => item.WorkItemType == workItemType);

    private static ProcessRequestEventIntentRecord SingleRequest(CheckoutServiceProcessManagerResult result, string requestEventType) =>
        result.RequestEventIntents.Single(item => item.RequestEventType == requestEventType);

    private sealed class InMemoryProcessRunSink : ICheckoutServiceProcessRunSink
    {
        private readonly HashSet<string> keys = new(StringComparer.Ordinal);

        public List<ProcessRunRecord> ProcessRuns { get; } = new();

        public List<ProcessWorkItemIntentRecord> WorkItemIntents { get; } = new();

        public List<ProcessRequestEventIntentRecord> RequestEventIntents { get; } = new();

        public bool TryRecordProcessRun(
            ProcessRunRecord processRun,
            IReadOnlyList<ProcessWorkItemIntentRecord> workItemIntents,
            IReadOnlyList<ProcessRequestEventIntentRecord> requestEventIntents)
        {
            var key = $"{processRun.TenantId}|{processRun.TriggerEventId}|{processRun.ProcessRuleId}";
            if (!keys.Add(key))
            {
                return false;
            }

            ProcessRuns.Add(processRun);
            WorkItemIntents.AddRange(workItemIntents);
            RequestEventIntents.AddRange(requestEventIntents);
            return true;
        }
    }
}
