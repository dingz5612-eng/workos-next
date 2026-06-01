using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class WorkItemLifecycleTests
{
    [TestMethod]
    public void confirmed_work_item_records_single_transition_and_duplicate_does_not_advance_state_twice()
    {
        var service = Service(out var workItems);
        var workItem = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-lifecycle-001",
            TenantId: "tenant-rf7",
            WorkItemType: "runtimeAudit",
            WorkspaceId: "W-RF7",
            CardId: "runtimeAudit",
            OwnerRole: "operations",
            Payload: new Dictionary<string, string> { ["caseId"] = "case-rf7" }));

        var first = service.ConfirmWorkItem("wi-lifecycle-001", Request("idem-rf7"), "actor-token", "req-rf7-1");
        var duplicate = service.ConfirmWorkItem("wi-lifecycle-001", Request("idem-rf7"), "actor-token", "req-rf7-2");

        Assert.IsNotNull(workItem);
        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, duplicate.StatusCode);
        Assert.AreEqual(first.CommandSubmissionId, duplicate.CommandSubmissionId);
        Assert.AreEqual("confirmed", service.GetWorkItem("wi-lifecycle-001")!.Status);
        Assert.HasCount(1, workItems.Transitions);
        Assert.AreEqual(first.CommandSubmissionId, workItems.Transitions[0].SubmissionId);
    }

    [TestMethod]
    public void idempotency_conflict_does_not_advance_work_item_state()
    {
        var service = Service(out var workItems);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-lifecycle-409",
            TenantId: "tenant-rf7",
            WorkItemType: "runtimeAudit",
            WorkspaceId: "W-RF7",
            CardId: "runtimeAudit",
            OwnerRole: "operations",
            Payload: new Dictionary<string, string> { ["caseId"] = "case-rf7-409" }));

        var first = service.ConfirmWorkItem("wi-lifecycle-409", Request("idem-conflict", "A101"), "actor-token", "req-rf7-409-1");
        var conflict = service.ConfirmWorkItem("wi-lifecycle-409", Request("idem-conflict", "B202"), "actor-token", "req-rf7-409-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual("confirmed", service.GetWorkItem("wi-lifecycle-409")!.Status);
        Assert.HasCount(1, workItems.Transitions);
    }

    private static CanonicalOperationsApiService Service(out InMemoryOperationsWorkItemStore workItems)
    {
        var runtime = new FakeRuntime();
        var cases = new InMemoryOperationsCaseStore();
        workItems = new InMemoryOperationsWorkItemStore();
        var catalog = new OperationsRuntimeService(runtime, new InMemoryOperationsCommandSubmissionStore(), cases, workItems);
        var store = new InMemoryOperationsStore();
        var router = new SliceCommandHandlerRouter()
            .Register(CanonicalOperationsApiService.ConfirmCommandType, CanonicalOperationsApiService.HandleConfirmCommand);
        var unitOfWork = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            router);
        return new CanonicalOperationsApiService(catalog, unitOfWork, store);
    }

    private static ConfirmWorkItemRequest Request(string idempotencyKey, string roomNo = "A101") =>
        new(
            Language: "zh-CN",
            IdempotencyKey: idempotencyKey,
            FieldValues: new Dictionary<string, string> { ["roomNo"] = roomNo },
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private sealed class FakeRuntime : IOperationsRuntimeAdapter
    {
        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaceId.Equals("W-RF7", StringComparison.OrdinalIgnoreCase) ? Workspace(workspaceId) : null;

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            Array.Empty<ProcessWorkItemIntentRecord>();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
            new { prepared = true };

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            new(ConfirmStatus.Confirmed, null, null);

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            throw new InvalidOperationException("canonical confirm must not call legacy runtime");

        private static WorkspaceProjection Workspace(string workspaceId) =>
            new(
                "IntentWorkspaceProjection",
                workspaceId,
                "stay",
                $"task-{workspaceId}",
                Text("RF7"),
                Text("RF7"),
                new[] { Card("runtimeAudit") },
                Text("Next"),
                Array.Empty<BlockerRule>());

        private static CardProjection Card(string cardId) =>
            new(
                "WorkspaceCardProjection",
                cardId,
                "ready",
                Text(cardId),
                new FieldSet(Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "operator", Text("Confirm")));

        private static IReadOnlyDictionary<string, string> Text(string value) =>
            new Dictionary<string, string>
            {
                ["zh-CN"] = value,
                ["ru-RU"] = value
            };
    }
}
