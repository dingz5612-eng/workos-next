using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class PeriodActionPlanWorkItemTests
{
    [TestMethod]
    public void period_operations_diagnosed_suggests_action_plan_work_item()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-period-diagnosis", "Accommodation.PeriodOperationsDiagnosed", new Dictionary<string, string>
        {
            ["periodId"] = "PER-2026-05-01",
            ["issueCategory"] = "service_backlog",
            ["issueSummary"] = "cleaning backlog above threshold",
            ["priority"] = "high",
            ["dueAtUtc"] = "2026-06-03T00:00:00Z"
        }), sink);

        Assert.IsTrue(result.ProcessRuns.Any(item => item.ProcessRuleId == CheckoutServiceProcessRuleIds.PeriodOperationsDiagnosedSuggestsActionPlanWorkItem));
        var workItem = result.WorkItemIntents.Single(item => item.WorkItemType == "periodActionPlan");
        Assert.AreEqual("W-STAY-PERIOD-ANALYTICS", workItem.TargetWorkspaceId);
        Assert.AreEqual("manager", workItem.OwnerRole);
        Assert.AreEqual("true", workItem.Payload["suggestedActionPlan"]);
        Assert.AreEqual("PER-2026-05-01", workItem.Payload["periodId"]);
        Assert.AreEqual("high", workItem.Payload["priority"]);
        Assert.AreEqual("2026-06-03T00:00:00Z", workItem.Payload["dueAtUtc"]);
    }

    [TestMethod]
    public void action_plan_committed_creates_work_item()
    {
        var sink = new InMemoryProcessRunSink();
        var result = Manager().Handle(Event("evt-period-plan", "Accommodation.PeriodActionPlanCommitted", new Dictionary<string, string>
        {
            ["periodId"] = "PER-2026-05-01",
            ["actionPlanId"] = "period-plan-001",
            ["actionTitle"] = "increase weekday reservation conversion",
            ["ownerRole"] = "manager",
            ["dueAtUtc"] = "2026-06-05T00:00:00Z",
            ["priority"] = "high"
        }), sink);

        Assert.IsTrue(result.ProcessRuns.Any(item => item.ProcessRuleId == CheckoutServiceProcessRuleIds.PeriodActionPlanCommittedCreatesWorkItem));
        Assert.IsTrue(result.ProcessRuns.Any(item => item.ProcessRuleId == CheckoutServiceProcessRuleIds.PeriodActionPlanCommittedEmitsWorkItemCreated));
        var workItem = result.WorkItemIntents.Single(item => item.WorkItemType == "periodActionPlanExecution");
        Assert.AreEqual("W-STAY-PERIOD-ANALYTICS", workItem.TargetWorkspaceId);
        Assert.AreEqual("manager", workItem.OwnerRole);
        Assert.AreEqual("period-plan-001", workItem.Payload["actionPlanId"]);
        Assert.AreEqual("2026-06-05T00:00:00Z", workItem.Payload["dueAtUtc"]);
        Assert.AreEqual("high", workItem.Payload["priority"]);

        var createdEvent = result.RequestEventIntents.Single(item => item.RequestEventType == "Accommodation.PeriodActionPlanWorkItemCreated");
        Assert.AreEqual(workItem.WorkItemId, createdEvent.Payload["workItemId"]);
    }

    [TestMethod]
    public void action_plan_committed_not_completed()
    {
        var result = PeriodAnalyticsPolicy.Validate("periodActionPlan", Request(new Dictionary<string, string>
        {
            ["actionPlanId"] = "period-plan-001",
            ["ownerRole"] = "manager",
            ["dueAtUtc"] = "2026-06-05T00:00:00Z",
            ["priority"] = "high",
            ["actionStatus"] = "completed"
        }));

        Assert.IsNotNull(result);
        Assert.AreEqual(ConfirmStatus.Forbidden, result!.Status);
        Assert.AreEqual("period_action_plan_commit_cannot_complete", result.Reason);
    }

    [TestMethod]
    public void action_plan_completion_requires_work_item_confirm()
    {
        var result = PeriodAnalyticsPolicy.Validate("periodActionPlanComplete", Request(new Dictionary<string, string>
        {
            ["actionPlanId"] = "period-plan-001",
            ["completionResult"] = "done"
        }));

        Assert.IsNotNull(result);
        Assert.AreEqual(ConfirmStatus.Forbidden, result!.Status);
        Assert.AreEqual("period_action_plan_completion_requires_work_item_confirm", result.Reason);
    }

    [TestMethod]
    public void action_plan_has_owner_due_priority()
    {
        Assert.AreEqual("period_action_plan_owner_role_required", PeriodAnalyticsPolicy.Validate("periodActionPlan", Request(new Dictionary<string, string>
        {
            ["actionPlanId"] = "period-plan-001",
            ["dueAtUtc"] = "2026-06-05T00:00:00Z",
            ["priority"] = "high"
        }))?.Reason);

        Assert.AreEqual("period_action_plan_due_at_required", PeriodAnalyticsPolicy.Validate("periodActionPlan", Request(new Dictionary<string, string>
        {
            ["actionPlanId"] = "period-plan-001",
            ["ownerRole"] = "manager",
            ["priority"] = "high"
        }))?.Reason);

        Assert.AreEqual("period_action_plan_priority_required", PeriodAnalyticsPolicy.Validate("periodActionPlan", Request(new Dictionary<string, string>
        {
            ["actionPlanId"] = "period-plan-001",
            ["ownerRole"] = "manager",
            ["dueAtUtc"] = "2026-06-05T00:00:00Z"
        }))?.Reason);
    }

    private static CheckoutServiceProcessManager Manager() => new();

    private static ConfirmCardRequest Request(IReadOnlyDictionary<string, string> values) =>
        new("zh-CN", "test-submit", values, Array.Empty<string>());

    private static WorkspaceEvent Event(string eventId, string eventType, IReadOnlyDictionary<string, string> payload) =>
        new(
            eventId,
            "W-STAY-PERIOD-ANALYTICS",
            "periodActionPlan",
            eventType,
            $"corr-{eventId}",
            null,
            $"req-{eventId}",
            "operator",
            "actor-001",
            DateTimeOffset.Parse("2026-05-29T00:00:00Z"),
            payload,
            Array.Empty<string>());

    private sealed class InMemoryProcessRunSink : ICheckoutServiceProcessRunSink
    {
        private readonly HashSet<string> keys = new(StringComparer.Ordinal);

        public bool TryRecordProcessRun(
            ProcessRunRecord processRun,
            IReadOnlyList<ProcessWorkItemIntentRecord> workItemIntents,
            IReadOnlyList<ProcessRequestEventIntentRecord> requestEventIntents)
        {
            return keys.Add($"{processRun.TenantId}|{processRun.TriggerEventId}|{processRun.ProcessRuleId}");
        }
    }
}
