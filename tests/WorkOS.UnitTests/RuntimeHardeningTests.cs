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
        Assert.AreEqual(StatusCodes.Status403Forbidden, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Forbidden, "trusted_device_required:payment.confirm", null)));
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Forbidden, "deposit_evidence_required", null)));
        Assert.AreEqual(StatusCodes.Status200OK, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Duplicate, null, null)));
        Assert.AreEqual(StatusCodes.Status200OK, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.ProjectionFailed, "projection_not_caught_up", null)));
        Assert.AreEqual(StatusCodes.Status200OK, ConfirmHttpStatusMapper.StatusCodeFor(new ConfirmResult(ConfirmStatus.Confirmed, null, null)));
    }

    [TestMethod]
    public void revoked_session_cannot_confirm()
    {
        var store = new ConfirmSemanticsStore(ProjectionMode.Pending);
        store.RevokeSession("session-token", "admin-1");
        var service = ConfirmService(store, requireTrustedDevice: true);
        var state = ConfirmState();

        var result = service.Confirm(state, "W-CONFIRM", "confirmCard", Request(new Dictionary<string, string>()), "session-token");

        Assert.AreEqual(ConfirmStatus.Forbidden, result.Status);
        Assert.AreEqual("actor_session_required", result.Reason);
        Assert.AreEqual(0, store.AuditEvents.Count);
        Assert.AreEqual(0, store.OutboxMessages.Count);
    }

    [TestMethod]
    public void high_risk_action_requires_trusted_device()
    {
        var store = new ConfirmSemanticsStore(ProjectionMode.Pending);
        store.RegisterDeviceSession(new RuntimeDeviceSessionRequest("T1", "user-1", "device-untrusted", "untrusted", "ua"));
        var service = ConfirmService(store, requireTrustedDevice: true);
        var state = new RuntimeState(
            new List<WorkspaceProjection> { Workspace("W-CONFIRM", Card("paymentConfirmation", "Accommodation.PaymentConfirmed") with { Confirmation = new ConfirmationPolicy(true, true, "operator", Text("Confirm")) }) },
            new List<WorkspaceEvent>(),
            new List<RuntimeUser> { new("user-1", "operator", "Operator", "operator", true) });

        var result = service.Confirm(
            state,
            "W-CONFIRM",
            "paymentConfirmation",
            Request(new Dictionary<string, string> { ["confirmedAmount"] = "5000" }) with { DeviceId = "device-untrusted" },
            "session-token");

        Assert.AreEqual(ConfirmStatus.Forbidden, result.Status);
        StringAssert.StartsWith(result.Reason, "trusted_device_required");
        Assert.AreEqual(0, store.AuditEvents.Count);
    }

    [TestMethod]
    public void ai_actor_cannot_confirm_terminal_action()
    {
        var store = new ConfirmSemanticsStore(ProjectionMode.Pending, actorRole: "ai");
        var service = ConfirmService(store);
        var state = new RuntimeState(
            new List<WorkspaceProjection>
            {
                Workspace("W-CONFIRM",
                    Card("finalBalanceClose", "Accommodation.FinalBalanceClosed") with
                    {
                        Confirmation = new ConfirmationPolicy(true, false, "ai", Text("Confirm"))
                    })
            },
            new List<WorkspaceEvent>(),
            new List<RuntimeUser> { new("user-1", "ai", "AI", "ai", true) });

        var result = service.Confirm(state, "W-CONFIRM", "finalBalanceClose", Request(new Dictionary<string, string>()), "session-token");

        Assert.AreEqual(ConfirmStatus.Forbidden, result.Status);
        Assert.AreEqual("ai_terminal_action_forbidden", result.Reason);
        Assert.AreEqual(0, store.AuditEvents.Count);
    }

    [TestMethod]
    public void role_forbidden_no_side_effects()
    {
        var store = new ConfirmSemanticsStore(ProjectionMode.Pending);
        var service = ConfirmService(store);
        var state = new RuntimeState(
            new List<WorkspaceProjection>
            {
                Workspace("W-CONFIRM",
                    Card("paymentConfirmation", "Accommodation.PaymentConfirmed") with
                    {
                        Confirmation = new ConfirmationPolicy(true, true, "finance", Text("Confirm"))
                    })
            },
            new List<WorkspaceEvent>(),
            new List<RuntimeUser> { new("user-1", "operator", "Operator", "operator", true) });

        var result = service.Confirm(state, "W-CONFIRM", "paymentConfirmation", Request(new Dictionary<string, string> { ["confirmedAmount"] = "100" }), "session-token");

        Assert.AreEqual(ConfirmStatus.Forbidden, result.Status);
        StringAssert.StartsWith(result.Reason, "role_confirmation_forbidden");
        Assert.AreEqual(0, store.AuditEvents.Count);
        Assert.AreEqual(0, store.OutboxMessages.Count);
    }

    [TestMethod]
    public void revoked_device_cannot_download_evidence()
    {
        var revoked = new RuntimeDeviceSession(
            "devsess-1",
            "T1",
            "actor-1",
            "device-1",
            "revoked",
            "ua",
            DateTimeOffset.UtcNow.AddDays(-1),
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow);

        Assert.IsFalse(RuntimeSecurityPolicy.TrustedDeviceCanPerformHighRiskAction(revoked));
    }

    [TestMethod]
    public void ledger_export_requires_capability_reason_audit()
    {
        var missingReason = RuntimeGovernanceExportPolicy.Validate(new GovernanceExportRequest(
            "ledger",
            "auditor-1",
            "auditor",
            new[] { "pc.export.ledger" },
            "pc-1",
            "trusted",
            "pc",
            ""));
        CollectionAssert.Contains(missingReason.Errors.ToArray(), "EXPORT_REASON_REQUIRED");
        Assert.IsFalse(missingReason.Allowed);

        var missingCapability = RuntimeGovernanceExportPolicy.Validate(new GovernanceExportRequest(
            "ledger",
            "viewer-1",
            "viewer",
            Array.Empty<string>(),
            "pc-1",
            "trusted",
            "pc",
            "month-end audit"));
        CollectionAssert.Contains(missingCapability.Errors.ToArray(), "EXPORT_CAPABILITY_REQUIRED");
        Assert.IsFalse(missingCapability.Allowed);

        var allowed = RuntimeGovernanceExportPolicy.Validate(new GovernanceExportRequest(
            "ledger",
            "auditor-1",
            "auditor",
            new[] { "pc.export.ledger" },
            "pc-1",
            "trusted",
            "pc",
            "month-end audit"));
        Assert.IsTrue(allowed.Allowed);
        Assert.IsFalse(string.IsNullOrWhiteSpace(allowed.AuditEventId));
        StringAssert.Contains(allowed.DownloadUrl, "expiresAtUtc=");
    }

    [TestMethod]
    public void high_risk_ops_require_capability_trusted_device_and_audit_reason()
    {
        RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "correction.approve",
            "finance-1",
            "finance",
            ["correction.approve"],
            "trusted",
            "pc",
            "approved after finance review");

        RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "release.cutover",
            "release-1",
            "release",
            ["release.cutover"],
            "trusted",
            "pc",
            "green gate result approved");

        AssertInvalidOperation(() => RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "release.cutover",
            "release-1",
            "release",
            Array.Empty<string>(),
            "trusted",
            "pc",
            "green gate result approved"));

        AssertInvalidOperation(() => RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "release.cutover",
            "release-1",
            "release",
            ["release.cutover"],
            "untrusted",
            "pc",
            "green gate result approved"));

        AssertInvalidOperation(() => RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "release.cutover",
            "release-1",
            "release",
            ["release.cutover"],
            "trusted",
            "pc",
            ""));
    }

    [TestMethod]
    public void file_signed_url_expires()
    {
        var now = DateTimeOffset.Parse("2026-05-30T00:00:00Z");
        var expiresAt = RuntimeSignedUrlPolicy.Expiration(now, 60 * 60);

        Assert.AreEqual(now.AddMinutes(15), expiresAt);
        Assert.IsTrue(RuntimeSignedUrlPolicy.IsUsable(expiresAt, now.AddMinutes(14)));
        Assert.IsFalse(RuntimeSignedUrlPolicy.IsUsable(expiresAt, now.AddMinutes(15).AddSeconds(1)));
    }

    [TestMethod]
    public void file_type_and_size_guards_reject_invalid_evidence_uploads()
    {
        AssertInvalidOperation(() =>
            RuntimeFileUploadPolicy.Validate(new EvidenceAttachmentRequest("x.exe", "application/x-msdownload", new string('a', 64), 100)));
        AssertInvalidOperation(() =>
            RuntimeFileUploadPolicy.Validate(new EvidenceAttachmentRequest("x.pdf", "application/pdf", new string('a', 64), RuntimeFileUploadPolicy.MaxEvidenceFileSizeBytes + 1)));
    }

    [TestMethod]
    public void cors_defaults_are_explicit_origin_allowlist()
    {
        var options = new RuntimeCorsOptions();

        Assert.IsTrue(options.AllowedOrigins.Length > 0);
        Assert.IsFalse(options.AllowedOrigins.Contains("*"));
        Assert.IsTrue(options.AllowedOrigins.All(origin =>
            origin.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase) ||
            origin.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase)));
    }

    [TestMethod]
    public void ConfirmProjectionPendingReturnsCommittedResponse()
    {
        var store = new ConfirmSemanticsStore(ProjectionMode.Pending);
        var service = ConfirmService(store);
        var state = ConfirmState();

        var result = service.Confirm(state, "W-CONFIRM", "confirmCard", Request(new Dictionary<string, string>()), "session-token");
        var payload = AssertConfirmResponse(result);

        Assert.AreEqual(ConfirmStatus.Confirmed, result.Status);
        Assert.AreEqual("committed", payload.CommitStatus);
        Assert.AreEqual("pending", payload.ProjectionStatus);
        Assert.AreEqual("已提交成功，视图同步中。", payload.UserMessage);
        CollectionAssert.AreEqual(store.AuditEvents.Select(item => item.EventId).ToArray(), payload.ResultEventIds.ToArray());
    }

    [TestMethod]
    public void ConfirmProjectionFailureDoesNotRollbackCommittedBusinessFact()
    {
        var store = new ConfirmSemanticsStore(ProjectionMode.Failed);
        var service = ConfirmService(store);
        var state = ConfirmState();

        var result = service.Confirm(state, "W-CONFIRM", "confirmCard", Request(new Dictionary<string, string>()), "session-token");
        var payload = AssertConfirmResponse(result);

        Assert.AreEqual(ConfirmStatus.Confirmed, result.Status);
        Assert.AreEqual("committed", payload.CommitStatus);
        Assert.AreEqual("failed", payload.ProjectionStatus);
        Assert.AreEqual(1, store.AuditEvents.Count);
        Assert.AreEqual(1, store.OutboxMessages.Count);
        Assert.AreEqual("projector_failed", store.OutboxMessages[0].LastError);
    }

    [TestMethod]
    public void DuplicateConfirmAfterPendingDoesNotCreateNewBusinessFact()
    {
        var store = new ConfirmSemanticsStore(ProjectionMode.Pending);
        var service = ConfirmService(store);
        var state = ConfirmState();
        var request = Request(new Dictionary<string, string>());

        var first = AssertConfirmResponse(service.Confirm(state, "W-CONFIRM", "confirmCard", request, "session-token"));
        var secondResult = service.Confirm(state, "W-CONFIRM", "confirmCard", request, "session-token");
        var second = AssertConfirmResponse(secondResult);

        Assert.AreEqual(ConfirmStatus.Duplicate, secondResult.Status);
        Assert.AreEqual("pending", first.ProjectionStatus);
        Assert.AreEqual("pending", second.ProjectionStatus);
        Assert.AreEqual(1, store.AuditEvents.Count);
        Assert.AreEqual(first.ResultEventIds[0], second.ResultEventIds[0]);
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

    private static ActionRuntimeService ConfirmService(IProjectionStore store, bool requireTrustedDevice = false) =>
        new(
            store,
            new WorkOS.Api.Slices.Policies.CardConfirmationPolicy(),
            new RuntimeQueryService(),
            SliceRuntimeCapabilityGate.LoadDefault(),
            new OutboxProjector(store),
            requireTrustedDevice);

    private static RuntimeState ConfirmState() =>
        new(
            new List<WorkspaceProjection> { Workspace("W-CONFIRM", Card("confirmCard", "Confirm.Event")) },
            new List<WorkspaceEvent>(),
            new List<RuntimeUser> { new("user-1", "operator", "Operator", "operator", true) });

    private static ConfirmCardResponse AssertConfirmResponse(ConfirmResult result)
    {
        Assert.IsNotNull(result.Payload);
        var payload = (ConfirmCardResponse)result.Payload!;
        Assert.IsTrue(payload.Confirmed);
        Assert.AreEqual("committed", payload.CommitStatus);
        Assert.AreEqual("W-CONFIRM", payload.CaseId);
        Assert.AreEqual("W-CONFIRM:confirmCard", payload.WorkItemId);
        Assert.AreEqual("sub-1", payload.SubmissionId);
        Assert.IsTrue((bool)payload.ClientInstruction["disableRetry"]);
        return payload;
    }

    private static void AssertInvalidOperation(Action action)
    {
        try
        {
            action();
        }
        catch (InvalidOperationException)
        {
            return;
        }

        Assert.Fail("Expected InvalidOperationException.");
    }

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
        public void RevokeSession(string token, string actorId) => throw new NotSupportedException();
        public RuntimeUser? FindUserBySessionToken(string token) => throw new NotSupportedException();
        public RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request) => throw new NotSupportedException();
        public RuntimeDeviceSession? FindDeviceSession(string deviceId) => null;
        public RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId) => throw new NotSupportedException();
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
        public EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request) => throw new NotSupportedException();
        public GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request) => RuntimeGovernanceExportPolicy.Validate(request);
        public ConfirmResult? ValidateEvidenceForConfirm(string workspaceId, string cardId, ConfirmCardRequest request, IReadOnlyList<EvidenceRequirement> requirements) => null;
        public BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request) => throw new NotSupportedException();
        public BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId) => throw new NotSupportedException();
        public ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request) => throw new NotSupportedException();
        public IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null) => throw new NotSupportedException();
        public ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string actorId) => throw new NotSupportedException();
        public ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string actorId, string reason) => throw new NotSupportedException();
        public ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId) => throw new NotSupportedException();
        public ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason) => throw new NotSupportedException();
        public ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request) => throw new NotSupportedException();
        public ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId) => throw new NotSupportedException();
        public LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command) => throw new NotSupportedException();
        public LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command) => throw new NotSupportedException();
        public LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command) => throw new NotSupportedException();
        public LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command) => throw new NotSupportedException();
        public IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null) => throw new NotSupportedException();
        public IReadOnlyList<OutboxMessage> GetOutboxMessages() => throw new NotSupportedException();
        public void MarkOutboxProcessed(string messageId, string workerId) => throw new NotSupportedException();
        public void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5) => throw new NotSupportedException();
        public CheckoutServiceProcessManagerResult ApplyCheckoutServiceProcessRules(WorkspaceEvent workspaceEvent) => CheckoutServiceProcessManagerResult.Empty;
        public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) => Array.Empty<ProcessRunRecord>();
        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) => Array.Empty<ProcessWorkItemIntentRecord>();
        public IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null) => Array.Empty<ProcessRequestEventIntentRecord>();
        public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent) => throw new NotSupportedException();
        public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) => throw new NotSupportedException();
        public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => throw new NotSupportedException();
        public IReadOnlyList<object> GetAccommodationLens(string lensId) => throw new NotSupportedException();
    }

    private enum ProjectionMode
    {
        Pending,
        Failed
    }

    private sealed class ConfirmSemanticsStore : IProjectionStore
    {
        private readonly ProjectionMode projectionMode;
        private readonly string actorRole;
        private readonly Dictionary<string, WorkspaceEvent> eventsByIdempotency = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, RuntimeDeviceSession> devices = new(StringComparer.OrdinalIgnoreCase);
        private bool sessionRevoked;

        public ConfirmSemanticsStore(ProjectionMode projectionMode, string actorRole = "operator")
        {
            this.projectionMode = projectionMode;
            this.actorRole = actorRole;
        }

        public List<WorkspaceEvent> AuditEvents { get; } = new();

        public List<OutboxMessage> OutboxMessages { get; } = new();

        public RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory) => seedFactory();

        public void SaveState(RuntimeState state) => throw new NotSupportedException();

        public RuntimeSession CreateSession(RuntimeUser user) => throw new NotSupportedException();

        public void RevokeSession(string token, string actorId)
        {
            if (token == "session-token")
            {
                sessionRevoked = true;
            }
        }

        public RuntimeUser? FindUserBySessionToken(string token) =>
            token == "session-token" && !sessionRevoked
                ? new RuntimeUser("user-1", actorRole, "Actor", actorRole, true)
                : null;

        public RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request)
        {
            var session = new RuntimeDeviceSession(
                $"devsess-{request.DeviceId}",
                request.TenantId,
                request.ActorId,
                request.DeviceId,
                request.DeviceTrustStatus,
                request.UserAgentHash,
                DateTimeOffset.UtcNow,
                DateTimeOffset.UtcNow,
                request.DeviceTrustStatus.Equals("revoked", StringComparison.OrdinalIgnoreCase) ? DateTimeOffset.UtcNow : null);
            devices[request.DeviceId] = session;
            return session;
        }

        public RuntimeDeviceSession? FindDeviceSession(string deviceId) =>
            devices.TryGetValue(deviceId, out var session) ? session : null;

        public RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId)
        {
            if (!devices.TryGetValue(deviceId, out var session))
            {
                return null;
            }

            var revoked = session with { DeviceTrustStatus = "revoked", RevokedAtUtc = DateTimeOffset.UtcNow };
            devices[deviceId] = revoked;
            return revoked;
        }

        public WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey) =>
            eventsByIdempotency.TryGetValue(idempotencyKey, out var workspaceEvent) ? workspaceEvent : null;

        public void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey) => throw new NotSupportedException();

        public void ApplySliceAggregate(WorkspaceEvent workspaceEvent) => throw new NotSupportedException();

        public WorkspaceEvent? CommitConfirmEvents(IReadOnlyList<IdempotentWorkspaceEvent> events)
        {
            foreach (var committed in events)
            {
                if (eventsByIdempotency.TryGetValue(committed.IdempotencyKey, out var existing))
                {
                    return existing;
                }

                AuditEvents.Add(committed.Event);
                eventsByIdempotency[committed.IdempotencyKey] = committed.Event;
                OutboxMessages.Add(OutboxFor(committed.Event));
            }

            return null;
        }

        public CardInstanceRecord PrepareCardInstance(string workspaceId, string cardId, PrepareCardRequest request) => throw new NotSupportedException();

        public CardInstanceRecord? FindCardInstance(string cardInstanceId) => throw new NotSupportedException();

        public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId) => throw new NotSupportedException();

        public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId) => throw new NotSupportedException();

        public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request) => throw new NotSupportedException();

        public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request) => throw new NotSupportedException();

        public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null) => throw new NotSupportedException();

        public EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request) => throw new NotSupportedException();

        public GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request) => RuntimeGovernanceExportPolicy.Validate(request);

        public ConfirmResult? ValidateEvidenceForConfirm(string workspaceId, string cardId, ConfirmCardRequest request, IReadOnlyList<EvidenceRequirement> requirements) => null;

        public BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request) => throw new NotSupportedException();

        public BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId) => throw new NotSupportedException();

        public ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request) => throw new NotSupportedException();

        public IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null) => throw new NotSupportedException();

        public ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string actorId) => throw new NotSupportedException();

        public ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string actorId, string reason) => throw new NotSupportedException();

        public ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId) => throw new NotSupportedException();

        public ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason) => throw new NotSupportedException();

        public ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request) => throw new NotSupportedException();

        public ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId) => throw new NotSupportedException();

        public LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command) => throw new NotSupportedException();

        public LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command) => throw new NotSupportedException();

        public LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command) => throw new NotSupportedException();

        public LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command) => throw new NotSupportedException();

        public DepositLedgerState GetDepositLedgerState(string depositId) => new(depositId, 0m, 0m, 0m, 0m, 0m);

        public PaymentLedgerState GetPaymentLedgerState(string paymentId) => new(paymentId, 0m, 0m);

        public IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null) =>
            Array.Empty<OutboxMessage>();

        public IReadOnlyList<OutboxMessage> GetOutboxMessages() => OutboxMessages;

        public void MarkOutboxProcessed(string messageId, string workerId) => throw new NotSupportedException();

        public void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5) => throw new NotSupportedException();

        public CheckoutServiceProcessManagerResult ApplyCheckoutServiceProcessRules(WorkspaceEvent workspaceEvent) => CheckoutServiceProcessManagerResult.Empty;

        public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) => Array.Empty<ProcessRunRecord>();

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) => Array.Empty<ProcessWorkItemIntentRecord>();

        public IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null) => Array.Empty<ProcessRequestEventIntentRecord>();

        public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent) => throw new NotSupportedException();

        public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) => AuditEvents;

        public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => Array.Empty<BehaviorEventRecord>();

        public IReadOnlyList<object> GetAccommodationLens(string lensId) => Array.Empty<object>();

        private OutboxMessage OutboxFor(WorkspaceEvent workspaceEvent)
        {
            var failed = projectionMode == ProjectionMode.Failed;
            return new OutboxMessage(
                $"outbox-{workspaceEvent.EventId}",
                workspaceEvent.EventId,
                workspaceEvent.WorkspaceId,
                workspaceEvent.CardId,
                workspaceEvent.EventType,
                workspaceEvent.CorrelationId,
                workspaceEvent.CausationId,
                workspaceEvent.RequestId,
                DateTimeOffset.UtcNow,
                null,
                workspaceEvent,
                AttemptCount: failed ? 1 : 0,
                DeadLetteredAtUtc: failed ? DateTimeOffset.UtcNow : null,
                LastError: failed ? "projector_failed" : null);
        }
    }
}
