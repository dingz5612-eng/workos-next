using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.CheckOutSettlement.Policies;
using WorkOS.Api.Slices.Accommodation.DepositLedger.Policies;
using WorkOS.Api.Slices.Accommodation.PaymentLedger.Policies;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;
using WorkOS.Api.Slices.Accommodation.ServiceTask.Policies;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class RuntimeHardeningTests
{
    [TestMethod]
    public void EventSelectionPolicySelectsConditionalAndMultiEventDispatch()
    {
        var depositConfirmation = Card("depositConfirmation",
            "Accommodation.DepositConfirmed",
            "Accommodation.DepositRejected");

        var confirmed = EventSelectionPolicy.PlanForConfirm(
            depositConfirmation,
            Request(new Dictionary<string, string> { ["confirmationResult"] = "confirmed" }));
        CollectionAssert.AreEqual(
            new[] { "Accommodation.DepositConfirmed" },
            confirmed.Events.Select(item => item.EventType).ToArray());
        Assert.AreEqual("conditional", confirmed.DispatchMode);

        var rejected = EventSelectionPolicy.PlanForConfirm(
            depositConfirmation,
            Request(new Dictionary<string, string> { ["confirmationResult"] = "rejected" }));
        CollectionAssert.AreEqual(
            new[] { "Accommodation.DepositRejected" },
            rejected.Events.Select(item => item.EventType).ToArray());

        var paymentAllocation = EventSelectionPolicy.PlanForConfirm(
            Card("paymentAllocation", "Accommodation.PaymentAllocated", "Accommodation.BalanceRecalculated"),
            Request(new Dictionary<string, string> { ["allocatedAmount"] = "100" }));
        CollectionAssert.AreEqual(
            new[] { "Accommodation.PaymentAllocated", "Accommodation.BalanceRecalculated" },
            paymentAllocation.Events.Select(item => item.EventType).ToArray());
        Assert.AreEqual("all", paymentAllocation.DispatchMode);
    }

    [TestMethod]
    public void EventSelectionPolicyAddsEvidenceAndServiceBlockEvents()
    {
        var depositReceipt = EventSelectionPolicy.PlanForConfirm(
            Card("depositReceipt", "Accommodation.DepositReceived", "Accommodation.DepositEvidenceSubmitted"),
            Request(new Dictionary<string, string> { ["depositId"] = "DEP-1" }, "evidence-1"));
        CollectionAssert.AreEqual(
            new[] { "Accommodation.DepositReceived", "Accommodation.DepositEvidenceSubmitted" },
            depositReceipt.Events.Select(item => item.EventType).ToArray());

        var serviceTask = EventSelectionPolicy.PlanForConfirm(
            Card("serviceTaskCreate", "Accommodation.ServiceTaskCreated", "Accommodation.RoomBlockedForService", "Accommodation.BedBlockedForService"),
            Request(new Dictionary<string, string> { ["blocksAvailability"] = "true", ["bedId"] = "B-1" }));
        CollectionAssert.AreEqual(
            new[] { "Accommodation.ServiceTaskCreated", "Accommodation.RoomBlockedForService", "Accommodation.BedBlockedForService" },
            serviceTask.Events.Select(item => item.EventType).ToArray());
    }

    [TestMethod]
    public void EventSelectionPolicyCoversEveryMultiEventCardAndSplitsPeriodActionPlan()
    {
        foreach (var cardId in EventContractCatalog.MultiEventCardIds())
        {
            Assert.IsTrue(EventSelectionPolicy.HasExplicitPolicyFor(cardId), $"{cardId} must declare an explicit dispatch policy");
        }

        var committed = EventSelectionPolicy.PlanForConfirm(
            Card("periodActionPlan", "Accommodation.PeriodActionPlanCommitted"),
            Request(new Dictionary<string, string> { ["actionStatus"] = "in_progress" }));
        CollectionAssert.AreEqual(
            new[] { "Accommodation.PeriodActionPlanCommitted" },
            committed.Events.Select(item => item.EventType).ToArray());
        Assert.AreEqual("single", committed.DispatchMode);

        var completed = EventSelectionPolicy.PlanForConfirm(
            Card("periodActionPlanComplete", "Accommodation.PeriodActionPlanCompleted"),
            Request(new Dictionary<string, string> { ["actionStatus"] = "completed" }));
        CollectionAssert.AreEqual(
            new[] { "Accommodation.PeriodActionPlanCompleted" },
            completed.Events.Select(item => item.EventType).ToArray());
        Assert.AreEqual("single", completed.DispatchMode);
    }

    [TestMethod]
    public void LedgerPoliciesTrustBackendStateInsteadOfRequestAmounts()
    {
        var store = new FakeStore(
            new DepositLedgerState("D-1", HeldAmount: 100m, DeductedAmount: 0m, AppliedToBalanceAmount: 0m, RefundApprovedAmount: 0m, RefundPaidAmount: 0m),
            new PaymentLedgerState("P-1", ConfirmedAmount: 100m, AllocatedAmount: 90m));

        var depositResult = DepositLedgerPolicy.Validate("depositRefundApproval", Request(new Dictionary<string, string>
        {
            ["depositId"] = "D-1",
            ["heldAmount"] = "999999",
            ["refundAmount"] = "101"
        }), store);
        Assert.AreEqual(ConfirmStatus.Forbidden, depositResult?.Status);
        Assert.AreEqual("deposit_refund_exceeds_held_amount", depositResult?.Reason);

        var paymentResult = PaymentLedgerPolicy.Validate("paymentAllocation", Request(new Dictionary<string, string>
        {
            ["paymentId"] = "P-1",
            ["confirmedAmount"] = "999999",
            ["allocatedAmount"] = "20"
        }), store);
        Assert.AreEqual(ConfirmStatus.Forbidden, paymentResult?.Status);
        Assert.AreEqual("payment_allocation_exceeds_confirmed_amount", paymentResult?.Reason);
    }

    [TestMethod]
    public void LedgerPoliciesRejectMissingFactsAndDepositPurposeInPaymentLedger()
    {
        var store = new FakeStore(
            new DepositLedgerState("D-1", HeldAmount: 100m, DeductedAmount: 0m, AppliedToBalanceAmount: 0m, RefundApprovedAmount: 0m, RefundPaidAmount: 0m),
            new PaymentLedgerState("P-1", ConfirmedAmount: 100m, AllocatedAmount: 0m));

        var missingDepositAmount = DepositLedgerPolicy.Validate("depositReceipt", Request(new Dictionary<string, string>
        {
            ["depositId"] = "D-1",
            ["currency"] = "KGS",
            ["paymentMethod"] = "cash"
        }), store);
        Assert.AreEqual(ConfirmStatus.Forbidden, missingDepositAmount?.Status);
        Assert.AreEqual("missing_required_field:receivedAmount", missingDepositAmount?.Reason);

        var depositPurpose = PaymentLedgerPolicy.Validate("paymentReceipt", Request(new Dictionary<string, string>
        {
            ["stayId"] = "S-1",
            ["paymentId"] = "P-1",
            ["payerName"] = "Guest",
            ["paymentAmount"] = "100",
            ["currency"] = "KGS",
            ["paymentMethod"] = "cash",
            ["paymentPurpose"] = "deposit"
        }), store);
        Assert.AreEqual(ConfirmStatus.Forbidden, depositPurpose?.Status);
        Assert.AreEqual("payment_deposit_purpose_forbidden", depositPurpose?.Reason);
    }

    [TestMethod]
    public void AccommodationBoundaryPoliciesRejectInvalidOwnershipTransitions()
    {
        var checkout = CheckOutSettlementPolicy.Validate(
            "finalBalanceClose",
            Request(new Dictionary<string, string> { ["depositSettlementRequested"] = "false" }));
        Assert.AreEqual("checkout_deposit_settlement_required", checkout?.Reason);

        var service = ServiceTaskPolicy.Validate(
            "roomReleaseAfterService",
            Request(new Dictionary<string, string> { ["serviceTaskVerified"] = "false" }));
        Assert.AreEqual("service_task_verification_required_before_release", service?.Reason);

        var period = PeriodAnalyticsPolicy.Validate(
            "periodFinanceReview",
            Request(new Dictionary<string, string> { ["depositReceivedIncludedInRevenue"] = "true" }));
        Assert.AreEqual("period_deposit_revenue_forbidden", period?.Reason);
    }

    [TestMethod]
    public void ConfirmHttpStatusMapperKeepsAuthAuthorizationAndBusinessRulesSeparate()
    {
        Assert.AreEqual(StatusCodes.Status404NotFound, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.NotFound, null, null)));
        Assert.AreEqual(StatusCodes.Status400BadRequest, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Invalid, "canonical_field_id_required", null)));
        Assert.AreEqual(StatusCodes.Status401Unauthorized, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Forbidden, "actor_session_required", null)));
        Assert.AreEqual(StatusCodes.Status403Forbidden, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Forbidden, "slice_runtime_forbidden:Slice:contract-only", null)));
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Forbidden, "deposit_evidence_required", null)));
        Assert.AreEqual(StatusCodes.Status409Conflict, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Duplicate, null, null)));
        Assert.AreEqual(StatusCodes.Status200OK, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Confirmed, null, null)));
    }

    [TestMethod]
    public void ProjectionStateMigratorMergesNewContractsAndPreservesCardStatus()
    {
        var persisted = new RuntimeState(
            new List<WorkspaceProjection>
            {
                Workspace("W-OLD", Card("existingCard", "Old.Event") with { Status = "blocked" })
            },
            new List<WorkspaceEvent>
            {
                Event("evt-1")
            },
            new List<RuntimeUser>
            {
                new("custom-user", "custom", "Custom", "operator", true)
            });

        var current = new RuntimeState(
            new List<WorkspaceProjection>
            {
                Workspace("W-OLD", Card("existingCard", "New.Event"), Card("newCard", "New.CardEvent")),
                Workspace("W-NEW", Card("firstCard", "First.Event"))
            },
            new List<WorkspaceEvent>(),
            new List<RuntimeUser>
            {
                new("u-operator", "operator", "Operator", "operator", true)
            });

        var migrated = ProjectionStateMigrator.Migrate(persisted, current);
        Assert.IsTrue(migrated.Workspaces.Any(item => item.Id == "W-NEW"));
        Assert.AreEqual("blocked", migrated.Workspaces.Single(item => item.Id == "W-OLD").Cards.Single(item => item.Id == "existingCard").Status);
        Assert.IsTrue(migrated.Workspaces.Single(item => item.Id == "W-OLD").Cards.Any(item => item.Id == "newCard"));
        Assert.IsTrue(migrated.Events.Any(item => item.EventId == "evt-1"));
        Assert.IsTrue(migrated.Users.Any(item => item.UserId == "custom-user"));
        Assert.AreEqual(RuntimeStateMigrator.CurrentSchemaVersion, migrated.SchemaVersion);
    }

    [TestMethod]
    public void RuntimeStateMigratorUpgradesOldDocumentsWithoutDroppingRuntimeFacts()
    {
        var oldState = new RuntimeState(
            new List<WorkspaceProjection> { Workspace("W-OLD", Card("oldCard", "Old.Event")) },
            new List<WorkspaceEvent> { Event("evt-old") },
            new List<RuntimeUser> { new("legacy-user", "legacy", "Legacy", "operator", true) },
            "won-13-runtime-document");

        var migrated = RuntimeStateMigrator.Migrate(oldState);
        Assert.AreEqual(RuntimeStateMigrator.CurrentSchemaVersion, migrated.SchemaVersion);
        Assert.IsTrue(migrated.Workspaces.Any(item => item.Id == "W-OLD"));
        Assert.IsTrue(migrated.Events.Any(item => item.EventId == "evt-old"));
        Assert.IsTrue(migrated.Users.Any(item => item.UserId == "legacy-user"));
        Assert.IsTrue(RuntimeStateMigrator.Entries.Any(item => item.Contains("card-instance-evidence", StringComparison.OrdinalIgnoreCase)));
    }

    [TestMethod]
    public void FieldContractValidatorRejectsInvalidStableOptionValues()
    {
        var card = Card("roomSetup", "Accommodation.RoomConfigured") with
        {
            Fields = new FieldSet(
                Array.Empty<FieldProjection>(),
                new[]
                {
                    new FieldProjection(
                        "roomType",
                        Text("房型"),
                        "business",
                        "select",
                        true,
                        "optionSet",
                        true,
                        string.Empty,
                        new FieldUi("select", "roomType", new[] { new FieldOption("four_bed", Text("四人间")) }, string.Empty, string.Empty, false),
                        Text("help"))
                },
                Array.Empty<FieldProjection>())
        };

        var result = FieldContractValidator.Validate(card, Request(new Dictionary<string, string> { ["roomType"] = "四人间" }));
        Assert.AreEqual(ConfirmStatus.Forbidden, result?.Status);
        Assert.AreEqual("invalid_option_value:roomType", result?.Reason);
    }

    private static ConfirmCardRequest Request(IReadOnlyDictionary<string, string> values, params string[] evidenceIds) =>
        new("zh-CN", "idem-1", values, evidenceIds, "sub-1", "instance-1", null);

    private static CardProjection Card(string id, params string[] eventTypes) =>
        new(
            "WorkspaceCardProjection",
            id,
            "ready",
            Text(id),
            new FieldSet(Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>()),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            eventTypes.Select(item => new EventDefinition(item, true, Array.Empty<string>())).ToArray(),
            new TransitionDefinition("ready", "confirmed", "blocked"),
            new ConfirmationPolicy(true, true, "operator", Text("Confirm")));

    private static WorkspaceProjection Workspace(string id, params CardProjection[] cards) =>
        new("IntentWorkspaceProjection", id, "stay", $"task-{id}", Text(id), Text(id), cards, Text("next"), Array.Empty<BlockerRule>());

    private static WorkspaceEvent Event(string id) =>
        new(id, "W", "card", "Event", "corr", null, "req", "operator", "u", DateTimeOffset.UtcNow, new Dictionary<string, string>(), Array.Empty<string>());

    private static IReadOnlyDictionary<string, string> Text(string value) =>
        new Dictionary<string, string> { ["zh-CN"] = value, ["ru-RU"] = value };

    private sealed class FakeStore : IProjectionStore
    {
        private readonly DepositLedgerState depositState;
        private readonly PaymentLedgerState paymentState;

        public FakeStore(DepositLedgerState depositState, PaymentLedgerState paymentState)
        {
            this.depositState = depositState;
            this.paymentState = paymentState;
        }

        public DepositLedgerState GetDepositLedgerState(string depositId) => depositState;
        public PaymentLedgerState GetPaymentLedgerState(string paymentId) => paymentState;

        public RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory) => seedFactory();
        public void SaveState(RuntimeState state) => throw new NotSupportedException();
        public RuntimeSession CreateSession(RuntimeUser user) => throw new NotSupportedException();
        public RuntimeUser? FindUserBySessionToken(string token) => throw new NotSupportedException();
        public WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey) => throw new NotSupportedException();
        public void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey) => throw new NotSupportedException();
        public void ApplySliceAggregate(WorkspaceEvent workspaceEvent) => throw new NotSupportedException();
        public WorkspaceEvent? CommitConfirmEvents(IReadOnlyList<IdempotentWorkspaceEvent> events) => throw new NotSupportedException();
        public CardInstanceRecord PrepareCardInstance(string workspaceId, string cardId, PrepareCardRequest request) => throw new NotSupportedException();
        public CardInstanceRecord? FindCardInstance(string cardInstanceId) => throw new NotSupportedException();
        public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId) => throw new NotSupportedException();
        public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId) => throw new NotSupportedException();
        public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request) => throw new NotSupportedException();
        public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request) => throw new NotSupportedException();
        public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null) => throw new NotSupportedException();
        public ConfirmResult? ValidateEvidenceForConfirm(string workspaceId, string cardId, ConfirmCardRequest request, IReadOnlyList<EvidenceRequirement> requirements) => null;
        public IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null) => throw new NotSupportedException();
        public IReadOnlyList<OutboxMessage> GetOutboxMessages() => throw new NotSupportedException();
        public void MarkOutboxProcessed(string messageId, string workerId) => throw new NotSupportedException();
        public void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5) => throw new NotSupportedException();
        public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent) => throw new NotSupportedException();
        public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) => throw new NotSupportedException();
        public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => throw new NotSupportedException();
        public IReadOnlyList<object> GetAccommodationLens(string lensId) => throw new NotSupportedException();
    }
}
