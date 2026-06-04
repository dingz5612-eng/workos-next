using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OperationsRuntimeServiceTests
{
    [TestMethod]
    public void catalog_resolves_persisted_operation_case_and_work_item()
    {
        var service = Service(out _, out var cases, out var workItems);

        var operationCase = service.CreateCase(new CreateOperationCaseRequest("case-runtime-001", "tenant-runtime", "W-OPS"));
        var workItem = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-runtime-001",
            TenantId: "tenant-runtime",
            WorkItemType: "roomSetup",
            WorkspaceId: "W-OPS",
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string> { ["caseId"] = "case-runtime-001" }));

        Assert.IsNotNull(operationCase);
        Assert.IsNotNull(workItem);
        Assert.AreEqual("case-runtime-001", service.GetCase("case-runtime-001")!.CaseId);
        Assert.AreEqual("wi-runtime-001", service.GetWorkItem("wi-runtime-001")!.WorkItemId);
        Assert.HasCount(1, cases.List());
        Assert.HasCount(1, workItems.List());
    }

    [TestMethod]
    public void workspace_start_binds_operation_case_and_work_item()
    {
        var workspace = FakeOperationsRuntime.Workspace("W-STAY-RESOURCE-202606040001");
        var service = Service(out _, out var cases, out var workItems, workspaces: new[] { workspace });
        var store = new InMemoryOperationsStore();
        var unitOfWork = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            new SliceCommandHandlerRouter().Register(
                CanonicalOperationsApiService.ConfirmCommandDefinition,
                CanonicalOperationsApiService.HandleConfirmCommand));
        var operations = new CanonicalOperationsApiService(service, unitOfWork, store);

        var started = operations.StartWorkspaceCase(
            workspace,
            "W-STAY-RESOURCE",
            new RuntimeActorContext(
                "operator-1",
                "operator",
                "tenant-start",
                new[] { "workos.write", "operations.confirm" },
                "test",
                "token-start"));

        Assert.AreEqual(workspace.Id, started.OperationCase.CaseId);
        StringAssert.StartsWith(started.WorkItem.WorkItemId, "wi-");
        Assert.AreEqual("Dorm.RoomSetup", started.WorkItem.WorkItemType);
        Assert.AreEqual("roomSetup", started.WorkItem.Payload["cardId"]);
        Assert.AreEqual("definition.roomSetup.v1", started.WorkItem.Payload["definitionId"]);
        Assert.AreEqual("operations-work-item-store", started.WorkItem.Source);
        Assert.HasCount(1, cases.List("tenant-start"));
        Assert.HasCount(1, workItems.List("tenant-start"));
        Assert.HasCount(1, started.OperationWorkItems);
    }

    [TestMethod]
    public void operations_confirm_dispatches_next_resource_lifecycle_work_item()
    {
        var workspace = FakeOperationsRuntime.ResourceWorkspace("W-STAY-RESOURCE-202606040002");
        var service = Service(out _, out _, out var workItems, workspaces: new[] { workspace });
        var store = new InMemoryOperationsStore();
        var unitOfWork = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            new SliceCommandHandlerRouter().Register(
                CanonicalOperationsApiService.ConfirmCommandDefinition,
                CanonicalOperationsApiService.HandleConfirmCommand));
        var operations = new CanonicalOperationsApiService(service, unitOfWork, store);
        var actor = new RuntimeActorContext(
            "operator-1",
            "operator",
            "tenant-start",
            new[] { "workos.write", "operations.confirm" },
            "test",
            "token-start");
        var started = operations.StartWorkspaceCase(workspace, "W-STAY-RESOURCE", actor);

        var result = operations.ConfirmWorkItem(
            started.WorkItem.WorkItemId,
            new ConfirmWorkItemRequest(
                Language: "zh-CN",
                IdempotencyKey: "idem-resource-next",
                FieldValues: new Dictionary<string, string> { ["roomNo"] = "A101" },
                EvidenceIds: Array.Empty<string>(),
                SubmissionId: "sub-resource-next",
                CardInstanceId: "ci-resource-next"),
            actor,
            "req-resource-next");

        Assert.IsTrue(result.Confirmed);
        Assert.IsTrue(workItems.List("tenant-start").Any(item =>
            item.WorkspaceId == workspace.Id &&
            item.Payload.TryGetValue("cardId", out var cardId) &&
            cardId == "bedSetup"));
    }

    [TestMethod]
    public void prepare_and_surface_use_active_definition_contract_not_stale_projection_fields()
    {
        var staleWorkspace = FakeOperationsRuntime.ResourceWorkspace("W-STAY-RESOURCE-202606040003") with
        {
            Cards = new[]
            {
                FakeOperationsRuntime.Card("roomSetup"),
                FakeOperationsRuntime.Card("bedSetup", "roomId", "bedNo", "bedLabel", "blockedReason") with { Status = "ready" }
            }
        };
        var service = Service(out _, out _, out _, workspaces: new[] { staleWorkspace });
        var workItem = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-bed-stale-contract",
            TenantId: "tenant-start",
            WorkItemType: "Dorm.BedSetup",
            WorkspaceId: staleWorkspace.Id,
            CardId: "bedSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = staleWorkspace.Id,
                ["cardId"] = "bedSetup",
                ["templateWorkspaceId"] = "W-STAY-RESOURCE",
                ["definitionId"] = "definition.bedSetup.v1"
            }));

        var prepared = service.PrepareWorkItem(workItem!.WorkItemId, new PrepareWorkItemRequest(staleWorkspace.Id, "bedSetup"));
        var preparedBusinessIds = prepared!.FieldContract.Business.Select(item => item.Id).ToArray();
        var surface = service.GetWorkItemSurface(workItem.WorkItemId);
        var surfaceBusinessIds = surface!.Card!.Fields.Business.Select(item => item.Id).ToArray();

        CollectionAssert.Contains(preparedBusinessIds, "bedNo");
        CollectionAssert.Contains(preparedBusinessIds, "bedLabel");
        CollectionAssert.Contains(preparedBusinessIds, "bedStatus");
        CollectionAssert.DoesNotContain(preparedBusinessIds, "blockedReason");
        CollectionAssert.DoesNotContain(surfaceBusinessIds, "blockedReason");
    }

    [TestMethod]
    public void correction_work_item_reopens_completed_card_as_new_operations_task()
    {
        var completedWorkspace = FakeOperationsRuntime.ResourceWorkspace("W-STAY-RESOURCE-202606040004") with
        {
            Cards = new[]
            {
                FakeOperationsRuntime.Card("roomSetup") with { Status = "done" },
                FakeOperationsRuntime.Card("bedSetup") with { Status = "ready" }
            }
        };
        var service = Service(out _, out _, out _, workspaces: new[] { completedWorkspace });
        var workItem = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-correction-room-setup",
            TenantId: "tenant-start",
            WorkItemType: "Dorm.RoomSetup",
            WorkspaceId: completedWorkspace.Id,
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = completedWorkspace.Id,
                ["cardId"] = "roomSetup",
                ["templateWorkspaceId"] = "W-STAY-RESOURCE",
                ["definitionId"] = "definition.roomSetup.v1",
                ["operationMode"] = "correction",
                ["correctionMode"] = "append_only"
            }));

        var surface = service.GetWorkItemSurface(workItem!.WorkItemId);

        Assert.AreEqual("available", workItem.Status);
        Assert.AreEqual("ready", surface!.Card!.Status);
        CollectionAssert.Contains(surface.Card.Fields.Business.Select(item => item.Id).ToArray(), "roomNo");
    }

    [TestMethod]
    public void correction_confirm_does_not_dispatch_next_resource_lifecycle_work_item()
    {
        var workspace = FakeOperationsRuntime.ResourceWorkspace("W-STAY-RESOURCE-202606040005");
        var service = Service(out _, out _, out var workItems, workspaces: new[] { workspace });
        var store = new InMemoryOperationsStore();
        var unitOfWork = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            new SliceCommandHandlerRouter().Register(
                CanonicalOperationsApiService.ConfirmCommandDefinition,
                CanonicalOperationsApiService.HandleConfirmCommand));
        var operations = new CanonicalOperationsApiService(service, unitOfWork, store);
        var actor = new RuntimeActorContext(
            "operator-1",
            "operator",
            "tenant-start",
            new[] { "workos.write", "operations.confirm" },
            "test",
            "token-start");
        var correction = operations.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-correction-no-next",
            TenantId: "tenant-start",
            WorkItemType: "Dorm.RoomSetup",
            WorkspaceId: workspace.Id,
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = workspace.Id,
                ["cardId"] = "roomSetup",
                ["templateWorkspaceId"] = "W-STAY-RESOURCE",
                ["definitionId"] = "definition.roomSetup.v1",
                ["operationMode"] = "correction",
                ["correctionMode"] = "append_only",
                ["sourceWorkItemId"] = "wi-original-room"
            }));

        var result = operations.ConfirmWorkItem(
            correction!.WorkItemId,
            new ConfirmWorkItemRequest(
                Language: "zh-CN",
                IdempotencyKey: "idem-correction-no-next",
                FieldValues: new Dictionary<string, string>
                {
                    ["roomNo"] = "A101",
                    ["correctionMode"] = "append_only"
                },
                EvidenceIds: Array.Empty<string>(),
                SubmissionId: "sub-correction-no-next",
                CardInstanceId: "ci-correction-no-next"),
            actor,
            "req-correction-no-next");

        Assert.IsTrue(result.Confirmed);
        Assert.IsFalse(workItems.List("tenant-start").Any(item =>
            item.WorkItemId != correction.WorkItemId &&
            item.Payload.TryGetValue("cardId", out var cardId) &&
            cardId == "bedSetup"));
    }

    private static OperationsRuntimeService Service(
        out FakeOperationsRuntime runtime,
        out InMemoryOperationsCaseStore cases,
        out InMemoryOperationsWorkItemStore workItems,
        IReadOnlyList<WorkspaceProjection>? workspaces = null)
    {
        runtime = new FakeOperationsRuntime(workspaces);
        cases = new InMemoryOperationsCaseStore();
        workItems = new InMemoryOperationsWorkItemStore();
        return new OperationsRuntimeService(runtime, cases, workItems);
    }

    private sealed class FakeOperationsRuntime : IOperationsRuntimeAdapter
    {
        private readonly IReadOnlyList<WorkspaceProjection> workspaces;

        public FakeOperationsRuntime(
            IReadOnlyList<WorkspaceProjection>? workspaces = null)
        {
            this.workspaces = workspaces ?? new[] { Workspace("W-OPS") };
        }

        public int PrepareCount { get; private set; }

        public int ConfirmCount { get; private set; }

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            Array.Empty<ProcessWorkItemIntentRecord>();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null)
        {
            PrepareCount++;
            return new { prepared = true };
        }

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ConfirmCount++;
            throw new InvalidOperationException("OperationsRuntimeService must not commit facts directly.");
        }

        public static WorkspaceProjection Workspace(string workspaceId) =>
            new(
                "IntentWorkspaceProjection",
                workspaceId,
                "stay",
                $"task-{workspaceId}",
                Text("Operations"),
                Text("Operations"),
                new[] { Card("roomSetup") },
                Text("Next"),
                Array.Empty<BlockerRule>());

        public static WorkspaceProjection ResourceWorkspace(string workspaceId) =>
            Workspace(workspaceId) with
            {
                Cards = new[] { Card("roomSetup"), Card("bedSetup") with { Status = "notStarted" } }
            };

        public static CardProjection Card(string cardId, params string[] businessFieldIds)
        {
            var fieldIds = businessFieldIds.Length == 0 ? new[] { "roomNo" } : businessFieldIds;
            return new(
                "WorkspaceCardProjection",
                cardId,
                "ready",
                Text(cardId),
                new FieldSet(Array.Empty<FieldProjection>(), fieldIds.Select(Field).ToArray(), Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "operator", Text("Confirm")));
        }

        private static FieldProjection Field(string fieldId) =>
            new(
                fieldId,
                Text(fieldId),
                "business",
                "text",
                true,
                "runtime",
                true,
                fieldId,
                new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
                Text(fieldId));

        private static IReadOnlyDictionary<string, string> Text(string value) =>
            new Dictionary<string, string>
            {
                ["zh-CN"] = value,
                ["ru-RU"] = value
            };
    }
}
