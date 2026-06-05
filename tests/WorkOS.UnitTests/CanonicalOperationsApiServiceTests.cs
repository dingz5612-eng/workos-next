using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class CanonicalOperationsApiServiceTests
{
    [TestMethod]
    public void operations_confirm_uses_unit_of_work_and_exposes_fact_trace()
    {
        var service = Service(out var runtime, out var store);

        var result = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-s3"), OperatorActor(), "req-s3");
        var trace = service.GetSubmissionTrace(result.CommandSubmissionId!);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.AreEqual("committed", result.CommitStatus);
        Assert.AreEqual("pending", result.ProjectionStatus);
        Assert.AreEqual(0, runtime.ConfirmCount);
        Assert.AreEqual(1, store.DomainEvents.Count);
        Assert.AreEqual(result.CommandSubmissionId, trace?.SubmissionRef);
        Assert.AreEqual($"/api/operations/trace/submissions/{result.CommandSubmissionId}", result.TraceUrl);
        Assert.AreEqual(result.ResultEventIds[0], trace?.DomainEventRefs[0]);
        Assert.IsTrue(result.ClientInstruction.ContainsKey("admission"));
        Assert.IsTrue(result.ClientInstruction.ContainsKey("definition"));
        Assert.AreEqual("operations-runtime-native", result.ClientInstruction["definitionMode"]);
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.AreEqual(false, admission["productionAllowed"]);
        Assert.AreEqual(true, admission["confirmAllowed"]);
    }

    [TestMethod]
    public void operations_confirm_idempotency_conflict_does_not_write_second_domain_event()
    {
        var service = Service(out _, out var store);

        var first = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-conflict", "A101"), OperatorActor(), "req-1");
        var conflict = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-conflict", "B202"), OperatorActor(), "req-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual("idempotency_conflict", conflict.Error);
        Assert.AreEqual(1, store.DomainEvents.Count);
    }

    [TestMethod]
    public void operations_confirm_without_idempotency_key_returns_422_without_writing_domain_event()
    {
        var service = Service(out _, out var store);

        var result = service.ConfirmWorkItem(
            "W-S3:roomSetup",
            new ConfirmWorkItemRequest(
                Language: "zh-CN",
                FieldValues: new Dictionary<string, string> { ["roomNo"] = "A101" },
                EvidenceIds: Array.Empty<string>(),
                SubmissionId: "sub-missing-idempotency",
                CardInstanceId: "ci-missing-idempotency"),
            OperatorActor(),
            "req-missing-idempotency");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("idempotency_key_required", result.Error);
        Assert.IsEmpty(store.DomainEvents);
        Assert.IsEmpty(store.Submissions);
    }

    [TestMethod]
    public void operations_confirm_blocks_production_mode_before_unit_of_work()
    {
        var service = Service(out _, out var store);

        var result = service.ConfirmWorkItem(
            "W-S3:roomSetup",
            Request(
                "idem-production-blocked",
                fieldValues: new Dictionary<string, string>
                {
                    ["roomNo"] = "A101",
                    ["runtimeMode"] = "production"
                }),
            OperatorActor(),
            "req-production-blocked");

        Assert.AreEqual(StatusCodes.Status403Forbidden, result.StatusCode);
        Assert.AreEqual("admission_rejected", result.Error);
        Assert.IsFalse(result.Confirmed);
        Assert.IsEmpty(store.Submissions);
        Assert.IsTrue(result.ClientInstruction.ContainsKey("admission"));
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.AreEqual(false, admission["confirmAllowed"]);
        Assert.AreEqual(false, admission["productionAllowed"]);
    }

    [TestMethod]
    public void trace_routes_can_resolve_work_item_and_case_fact_graphs()
    {
        var service = Service(out _, out _);
        var result = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-trace"), OperatorActor(), "req-trace");

        var byWorkItem = service.GetWorkItemTraces("W-S3:roomSetup");
        var byCase = service.GetCaseTraces("W-S3");

        Assert.AreEqual(result.CommandSubmissionId, byWorkItem.Single().SubmissionRef);
        Assert.AreEqual(result.CommandSubmissionId, byCase.Single().SubmissionRef);
    }

    [TestMethod]
    public void fact_trace_contains_case_work_item_event_and_ledger_refs_for_money_confirm()
    {
        var service = Service(out _, out _);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-money-trace",
            TenantId: "tenant-s3",
            WorkItemType: "depositReceipt",
            WorkspaceId: "W-S3",
            CardId: "depositReceipt",
            OwnerRole: "finance",
            Payload: new Dictionary<string, string> { ["caseId"] = "case-money-trace" }));

        var result = service.ConfirmWorkItem(
            "wi-money-trace",
            Request("idem-money-trace", "A101", "depositReceipt", new Dictionary<string, string>
            {
                ["receivedAmount"] = "3000",
                ["currency"] = "KGS"
            }),
            FinanceActor(),
            "req-money-trace");
        var trace = service.GetSubmissionTrace(result.CommandSubmissionId!);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("case-money-trace", trace?.CaseRef);
        Assert.AreEqual("wi-money-trace", trace?.WorkItemRef);
        Assert.HasCount(1, trace!.DomainEventRefs);
        Assert.HasCount(1, trace.LedgerTransactionRefs);
        Assert.HasCount(2, trace.LedgerEntryRefs);
    }

    [TestMethod]
    public void operations_confirm_blocks_actor_role_that_does_not_own_work_item()
    {
        var service = Service(out _, out var store);

        var result = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-role-forbidden"), FinanceActor(), "req-role-forbidden");

        Assert.AreEqual(StatusCodes.Status403Forbidden, result.StatusCode);
        Assert.AreEqual("admission_rejected", result.Error);
        Assert.IsFalse(result.Confirmed);
        Assert.IsEmpty(store.DomainEvents);
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.AreEqual(false, admission["confirmAllowed"]);
        Assert.AreEqual("role_forbidden", admission["mode"]);
    }

    [TestMethod]
    public void operations_confirm_dispatches_next_work_item_from_shared_workspace_seed()
    {
        var service = Service(out _, out _);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-lead-capture-shared-flow",
            TenantId: "tenant-s3",
            WorkItemType: "leadCapture",
            WorkspaceId: "W-STAY-LEAD-RESERVATION-UNIT",
            CardId: "leadCapture",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-lead-shared-flow",
                ["cardId"] = "leadCapture",
                ["templateWorkspaceId"] = "W-STAY-LEAD-RESERVATION"
            }));

        var result = service.ConfirmWorkItem(
            "wi-lead-capture-shared-flow",
            Request("idem-lead-shared-flow", cardId: "leadCapture", fieldValues: new Dictionary<string, string>()),
            OperatorActor(),
            "req-lead-shared-flow");
        var next = service.ListWorkItems("tenant-s3")
            .SingleOrDefault(item => item.WorkspaceId == "W-STAY-LEAD-RESERVATION-UNIT" && item.Payload.TryGetValue("cardId", out var cardId) && cardId == "leadFollowUp");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsNotNull(next);
        Assert.AreEqual("available", next!.Status);
        Assert.AreEqual("operation_flow_process_manager", next.Payload["dispatchedBy"]);
        Assert.AreEqual("W-STAY-LEAD-RESERVATION", next.Payload["templateWorkspaceId"]);
        Assert.AreEqual("wi-lead-capture-shared-flow", next.Payload["sourceWorkItemId"]);
    }

    [TestMethod]
    public void operations_confirm_dispatches_next_work_item_with_next_card_owner_role()
    {
        var service = Service(out _, out _, ProjectionSeed.Create().Workspaces);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-deposit-receipt-shared-flow",
            TenantId: "tenant-s3",
            WorkItemType: "depositReceipt",
            WorkspaceId: "W-STAY-DEPOSIT-LEDGER",
            CardId: "depositReceipt",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-deposit-shared-flow",
                ["cardId"] = "depositReceipt",
                ["templateWorkspaceId"] = "W-STAY-DEPOSIT-LEDGER"
            }));

        var result = service.ConfirmWorkItem(
            "wi-deposit-receipt-shared-flow",
            Request("idem-deposit-owner-role", cardId: "depositReceipt", fieldValues: new Dictionary<string, string>
            {
                ["depositId"] = "deposit-owner-role-001",
                ["depositReceiptId"] = "deposit-receipt-owner-role-001",
                ["receivedAmount"] = "300",
                ["paymentMethod"] = "cash",
                ["payerName"] = "住客",
                ["receivedDate"] = "2026-06-05T10:30"
            }),
            OperatorActor(),
            "req-deposit-owner-role");
        var next = service.ListWorkItems("tenant-s3")
            .SingleOrDefault(item => item.WorkspaceId == "W-STAY-DEPOSIT-LEDGER" && item.Payload.TryGetValue("cardId", out var cardId) && cardId == "depositConfirmation");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsNotNull(next);
        Assert.AreEqual("finance", next!.OwnerRole);
        Assert.AreEqual("finance", next.Payload["ownerRole"]);
    }

    [TestMethod]
    public void lead_reservation_create_dispatches_cancel_branch_from_business_action()
    {
        var service = Service(out _, out _, ProjectionSeed.Create().Workspaces);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-reservation-create-cancel-flow",
            TenantId: "tenant-s3",
            WorkItemType: "reservationCreate",
            WorkspaceId: "W-STAY-LEAD-RESERVATION",
            CardId: "reservationCreate",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-reservation-branch-flow",
                ["cardId"] = "reservationCreate",
                ["templateWorkspaceId"] = "W-STAY-LEAD-RESERVATION"
            }));

        var result = service.ConfirmWorkItem(
            "wi-reservation-create-cancel-flow",
            Request("idem-reservation-cancel-branch", cardId: "reservationCreate", fieldValues: new Dictionary<string, string>
            {
                ["leadId"] = "lead-branch-001",
                ["reservationId"] = "reservation-branch-001",
                ["reservedBedCount"] = "1",
                ["reservedRoomId"] = "D02",
                ["reservedBedIds"] = "01",
                ["plannedCheckInDate"] = "2026-06-05T10:30",
                ["reservationHoldUntil"] = "2026-06-05T18:30",
                ["reservationDepositRequired"] = "false",
                ["reservationDepositAmount"] = "0",
                ["reservationNextAction"] = "cancel"
            }),
            OperatorActor(),
            "req-reservation-cancel-branch");
        var cancel = service.ListWorkItems("tenant-s3")
            .SingleOrDefault(item => item.WorkspaceId == "W-STAY-LEAD-RESERVATION" && item.Payload.TryGetValue("cardId", out var cardId) && cardId == "reservationCancel");
        var convert = service.ListWorkItems("tenant-s3")
            .SingleOrDefault(item => item.WorkspaceId == "W-STAY-LEAD-RESERVATION" && item.Payload.TryGetValue("cardId", out var cardId) && cardId == "reservationConvert");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsNotNull(cancel);
        Assert.IsNull(convert);
    }

    [TestMethod]
    public void operations_confirm_returns_422_for_finance_truth_business_rule_failure()
    {
        var service = Service(out _, out var store);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-money-business-blocked",
            TenantId: "tenant-s3",
            WorkItemType: "depositReceipt",
            WorkspaceId: "W-S3",
            CardId: "depositReceipt",
            OwnerRole: "finance",
            Payload: new Dictionary<string, string> { ["caseId"] = "case-money-business-blocked" }));

        var result = service.ConfirmWorkItem(
            "wi-money-business-blocked",
            Request("idem-money-business-blocked", "A101", "depositReceipt", new Dictionary<string, string>
            {
                ["receivedAmount"] = "3000",
                ["targetFact"] = "DepositFact"
            }),
            FinanceActor(),
            "req-money-business-blocked");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("operations_confirm_failed", result.Error);
        Assert.AreEqual("finance_truth_blocks_direct_fact_commit", result.Reason);
        Assert.IsEmpty(store.DomainEvents);
    }

    private static CanonicalOperationsApiService Service(
        out FakeCatalogRuntime runtime,
        out InMemoryOperationsStore store,
        IReadOnlyList<WorkspaceProjection>? workspaces = null)
    {
        runtime = new FakeCatalogRuntime(workspaces);
        var catalog = new OperationsRuntimeService(runtime);
        store = new InMemoryOperationsStore();
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

    private static ConfirmWorkItemRequest Request(
        string idempotencyKey,
        string roomNo = "A101",
        string cardId = "roomSetup",
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string> { ["roomNo"] = roomNo },
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static RuntimeActorContext OperatorActor() =>
        new(
            "u-operator-test",
            "operator",
            "tenant-s3",
            new[] { "workos.write", "operations.confirm" },
            "test",
            "actor-token");

    private static RuntimeActorContext FinanceActor() =>
        new(
            "u-finance-test",
            "finance",
            "tenant-s3",
            new[] { "workos.write", "operations.confirm", "finance.deposit.confirm", "finance.payment.confirm" },
            "test",
            "finance-token");

    private sealed class FakeCatalogRuntime : IOperationsRuntimeAdapter
    {
        private readonly IReadOnlyList<WorkspaceProjection> workspaces;
        private readonly IReadOnlyList<ProcessWorkItemIntentRecord> intents = new[]
        {
            new ProcessWorkItemIntentRecord(
                "intent-s3-room-setup",
                "process-run-s3",
                "tenant-s3",
                "W-S3:roomSetup",
                "roomSetup",
                "W-S3",
                "operator",
                "evt-intent-s3",
                "open",
                DateTimeOffset.UtcNow,
                new Dictionary<string, string>
                {
                    ["caseId"] = "W-S3",
                    ["cardId"] = "roomSetup"
                })
        };

        public FakeCatalogRuntime(IReadOnlyList<WorkspaceProjection>? workspaces = null)
        {
            this.workspaces = workspaces ?? new[] { Workspace("W-S3") };
        }

        public int ConfirmCount { get; private set; }

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            string.IsNullOrWhiteSpace(tenantId)
                ? intents
                : intents.Where(intent => intent.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase)).ToArray();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
            new { prepared = true };

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            new(ConfirmStatus.Confirmed, null, null);

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ConfirmCount++;
            throw new InvalidOperationException("canonical S3 confirm must not call legacy card confirm");
        }

        private static WorkspaceProjection Workspace(string workspaceId) =>
            new(
                "IntentWorkspaceProjection",
                workspaceId,
                "stay",
                $"task-{workspaceId}",
                Text("Operations"),
                Text("Operations"),
                new[] { Card("roomSetup"), DepositReceiptCard() },
                Text("Next"),
                Array.Empty<BlockerRule>());

        private static CardProjection Card(string cardId) =>
            new(
                "WorkspaceCardProjection",
                cardId,
                "ready",
                Text(cardId),
                new FieldSet(Array.Empty<FieldProjection>(), new[] { Field("roomNo") }, Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "operator", Text("Confirm")));

        private static CardProjection DepositReceiptCard() =>
            new(
                "WorkspaceCardProjection",
                "depositReceipt",
                "ready",
                Text("depositReceipt"),
                new FieldSet(
                    new[] { Field("depositId") },
                    new[] { Field("receivedAmount"), Field("currency") },
                    Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "finance", Text("Confirm")));

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
