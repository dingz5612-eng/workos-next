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
        Assert.AreEqual("Dorm.RoomSetupConfirm", started.WorkItem.WorkItemType);
        Assert.AreEqual("roomSetup", started.WorkItem.Payload["cardId"]);
        Assert.AreEqual("definition.dormitory.roomSetupConfirm.v1", started.WorkItem.Payload["definitionId"]);
        Assert.IsFalse(started.WorkItem.Payload.ContainsKey("definitionSourceCardId"));
        StringAssert.Contains(started.WorkItem.Payload["definitionMigrationRefs"], "cert.roomSetupConfirm");
        Assert.AreEqual("operations-work-item-store", started.WorkItem.Source);
        Assert.HasCount(1, cases.List("tenant-start"));
        Assert.HasCount(1, workItems.List("tenant-start"));
        Assert.HasCount(1, started.OperationWorkItems);
    }

    [TestMethod]
    public void workspace_start_returns_only_current_case_work_items()
    {
        var workspace = FakeOperationsRuntime.Workspace("W-STAY-RESOURCE-202606040101");
        var service = Service(out _, out _, out _, workspaces: new[] { workspace });
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
        operations.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-previous-start-room",
            TenantId: "tenant-start",
            WorkItemType: "Dorm.RoomSetupConfirm",
            WorkspaceId: "W-STAY-RESOURCE-OLD",
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "W-STAY-RESOURCE-OLD",
                ["cardId"] = "roomSetup",
                ["definitionId"] = "definition.dormitory.roomSetupConfirm.v1"
            }));

        var started = operations.StartWorkspaceCase(workspace, "W-STAY-RESOURCE", actor);

        Assert.HasCount(1, started.OperationWorkItems);
        Assert.AreEqual(started.WorkItem.WorkItemId, started.OperationWorkItems.Single().WorkItemId);
        Assert.AreEqual(workspace.Id, started.OperationWorkItems.Single().WorkspaceId);
        Assert.IsFalse(started.OperationWorkItems.Any(item => item.WorkItemId == "wi-previous-start-room"));
    }

    [TestMethod]
    public void finance_direct_start_workspaces_bind_operations_start_context()
    {
        foreach (var scenario in new[]
        {
            new { TemplateWorkspaceId = "W-STAY-DEPOSIT-LEDGER", WorkspaceId = "W-STAY-DEPOSIT-LEDGER-202606050001", CardId = "depositAssessment", StatusKey = "depositStatus" },
            new { TemplateWorkspaceId = "W-STAY-PAYMENT-LEDGER", WorkspaceId = "W-STAY-PAYMENT-LEDGER-202606050001", CardId = "paymentReceipt", StatusKey = "paymentStatus" }
        })
        {
            var workspace = FakeOperationsRuntime.Workspace(scenario.WorkspaceId) with
            {
                Cards = new[] { FakeOperationsRuntime.Card(scenario.CardId) }
            };
            var service = Service(out _, out _, out _, workspaces: new[] { workspace });
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
                scenario.TemplateWorkspaceId,
                new RuntimeActorContext(
                    "finance-1",
                    "finance",
                    "tenant-start",
                    new[] { "workos.write", "operations.confirm", "finance.deposit.confirm", "finance.payment.confirm" },
                    "test",
                    "token-start"));

            Assert.AreEqual("operations-start-context", started.WorkItem.Payload["startContextSource"]);
            Assert.AreEqual("business-anchor-context", started.WorkItem.Payload["startContextKind"]);
            StringAssert.StartsWith(started.WorkItem.Payload["stayId"], "stay-");
            StringAssert.StartsWith(started.WorkItem.Payload["roomId"], "room-d02-22-");
            StringAssert.StartsWith(started.WorkItem.Payload["bedId"], "bed-d02-22-01-");
            Assert.AreEqual("真实浏览器验收", started.WorkItem.Payload["residentName"]);
            Assert.AreEqual("13800001234", started.WorkItem.Payload["phone"]);
            Assert.AreEqual("D02", started.WorkItem.Payload["buildingName"]);
            Assert.AreEqual("22", started.WorkItem.Payload["roomNo"]);
            Assert.IsTrue(started.WorkItem.Payload.ContainsKey(scenario.StatusKey));
        }
    }

    [TestMethod]
    public void finance_direct_start_context_uses_business_anchor_query_for_human_memory_keys()
    {
        var workspace = FakeOperationsRuntime.Workspace("W-STAY-DEPOSIT-LEDGER-202606050002") with
        {
            Cards = new[] { FakeOperationsRuntime.Card("depositAssessment") }
        };
        var service = Service(out _, out _, out _, workspaces: new[] { workspace });
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
            "W-STAY-DEPOSIT-LEDGER",
            new RuntimeActorContext(
                "finance-1",
                "finance",
                "tenant-start",
                new[] { "workos.write", "operations.confirm", "finance.deposit.confirm" },
                "test",
                "token-start"),
            anchorQuery: "D03 / 305 / 02 下铺 / 张三 / 13812341234");

        Assert.AreEqual("business-anchor-context", started.WorkItem.Payload["startContextKind"]);
        Assert.AreEqual("D03 / 305 / 02 下铺 / 张三 / 13812341234", started.WorkItem.Payload["anchorQuery"]);
        Assert.AreEqual("张三", started.WorkItem.Payload["residentName"]);
        Assert.AreEqual("13812341234", started.WorkItem.Payload["phone"]);
        Assert.AreEqual("D03", started.WorkItem.Payload["buildingName"]);
        Assert.AreEqual("305", started.WorkItem.Payload["roomNo"]);
        Assert.AreEqual("02", started.WorkItem.Payload["bedNo"]);
        Assert.AreEqual("lower", started.WorkItem.Payload["bedType"]);
        Assert.AreEqual("下铺", started.WorkItem.Payload["bedTypeLabel"]);
        StringAssert.StartsWith(started.WorkItem.Payload["roomId"], "room-d03-305-");
        StringAssert.StartsWith(started.WorkItem.Payload["bedId"], "bed-d03-305-02-");
    }

    [TestMethod]
    public void operations_confirm_dispatches_generated_resource_lifecycle_work_item_without_seed_rate_plan()
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
        var next = workItems.List("tenant-start").SingleOrDefault(item =>
            item.WorkspaceId == workspace.Id &&
            item.Payload.TryGetValue("cardId", out var cardId) &&
            cardId == "bedSetup");
        Assert.IsNotNull(next);
        Assert.AreEqual("definition.dormitory.bedSetupConfirm.v1", next!.Payload["definitionId"]);
        Assert.IsFalse(next.Payload.ContainsKey("definitionSourceCardId"));
        StringAssert.Contains(next.Payload["definitionMigrationRefs"], "cert.bedSetupConfirm");
        Assert.IsFalse(workItems.List("tenant-start").Any(item =>
            item.WorkspaceId == workspace.Id &&
            item.Payload.TryGetValue("cardId", out var cardId) &&
            cardId == "rateSetup"));
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

        CollectionAssert.Contains(preparedBusinessIds, "bedCount");
        CollectionAssert.Contains(preparedBusinessIds, "bedLabels");
        CollectionAssert.Contains(preparedBusinessIds, "bedType");
        CollectionAssert.DoesNotContain(preparedBusinessIds, "bedNo");
        CollectionAssert.DoesNotContain(preparedBusinessIds, "bedLabel");
        CollectionAssert.DoesNotContain(preparedBusinessIds, "bedStatus");
        CollectionAssert.DoesNotContain(preparedBusinessIds, "blockedReason");
        CollectionAssert.DoesNotContain(surfaceBusinessIds, "bedNo");
        CollectionAssert.DoesNotContain(surfaceBusinessIds, "bedLabel");
        CollectionAssert.DoesNotContain(surfaceBusinessIds, "bedStatus");
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
    public void current_persisted_work_item_reopens_not_started_projection_card_as_ready()
    {
        var workspace = FakeOperationsRuntime.ResourceWorkspace("W-STAY-RESOURCE-202606040006");
        var service = Service(out _, out _, out _, workspaces: new[] { workspace });
        var workItem = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-current-bed-setup",
            TenantId: "tenant-start",
            WorkItemType: "Dorm.BedSetup",
            WorkspaceId: workspace.Id,
            CardId: "bedSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = workspace.Id,
                ["cardId"] = "bedSetup",
                ["templateWorkspaceId"] = "W-STAY-RESOURCE",
                ["definitionId"] = "definition.bedSetup.v1"
            }));

        var surface = service.GetWorkItemSurface(workItem!.WorkItemId);

        Assert.AreEqual("notStarted", workspace.Cards[1].Status);
        Assert.AreEqual("available", workItem.Status);
        Assert.AreEqual("ready", surface!.Card!.Status);
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

    [TestMethod]
    public void work_item_listing_can_scope_to_workspace_and_active_items()
    {
        var workspaceA = FakeOperationsRuntime.Workspace("W-SCOPE-A");
        var workspaceB = FakeOperationsRuntime.Workspace("W-SCOPE-B");
        var service = Service(out _, out _, out _, workspaces: new[] { workspaceA, workspaceB });
        var activeA = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-scope-active-a",
            TenantId: "tenant-scope",
            WorkItemType: "Dorm.RoomSetupConfirm",
            WorkspaceId: workspaceA.Id,
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = workspaceA.Id,
                ["cardId"] = "roomSetup",
                ["definitionId"] = "definition.dormitory.roomSetupConfirm.v1"
            }));
        var closedA = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-scope-closed-a",
            TenantId: "tenant-scope",
            WorkItemType: "Dorm.RoomSetupConfirm",
            WorkspaceId: workspaceA.Id,
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = workspaceA.Id,
                ["cardId"] = "roomSetup",
                ["definitionId"] = "definition.dormitory.roomSetupConfirm.v1"
            }));
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-scope-active-b",
            TenantId: "tenant-scope",
            WorkItemType: "Dorm.RoomSetupConfirm",
            WorkspaceId: workspaceB.Id,
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = workspaceB.Id,
                ["cardId"] = "roomSetup",
                ["definitionId"] = "definition.dormitory.roomSetupConfirm.v1"
            }));
        service.RecordWorkItemTransition(
            "tenant-scope",
            workspaceA.Id,
            closedA!.WorkItemId,
            closedA.Status,
            "confirmed",
            "sub-scope-closed-a",
            "test_confirmed",
            "operator-1");

        var scoped = service.ListWorkItemSurfaces("tenant-scope", workspaceId: workspaceA.Id);
        var activeScoped = service.ListWorkItemSurfaces("tenant-scope", workspaceId: workspaceA.Id, activeOnly: true);

        Assert.IsNotNull(activeA);
        CollectionAssert.AreEquivalent(
            new[] { "wi-scope-active-a", "wi-scope-closed-a" },
            scoped.Select(item => item.WorkItemId).ToArray());
        CollectionAssert.AreEquivalent(
            new[] { "wi-scope-active-a" },
            activeScoped.Select(item => item.WorkItemId).ToArray());
        Assert.IsFalse(activeScoped.Any(item => item.WorkspaceId == workspaceB.Id));
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
