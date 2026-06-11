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
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-current-resource-readiness-unit-of-work",
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.ResourceReadinessConfirm",
            WorkspaceId: "W-DORM-MAINLINE",
            CardId: "cert.resourceReadinessConfirm",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-current-resource-readiness",
                ["cardId"] = "cert.resourceReadinessConfirm",
                ["definitionId"] = "definition.dormitory.resourceReadinessConfirm.v1"
            }));

        var result = service.ConfirmWorkItem(
            "wi-current-resource-readiness-unit-of-work",
            Request("idem-current-resource-readiness", cardId: "cert.resourceReadinessConfirm", fieldValues: new Dictionary<string, string>()),
            OperatorActor(),
            "req-current-resource-readiness");
        var trace = service.GetSubmissionTrace(result.CommandSubmissionId!);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.AreEqual("committed", result.CommitStatus);
        Assert.AreEqual("pending", result.ProjectionStatus);
        Assert.AreEqual(0, runtime.ConfirmCount);
        Assert.HasCount(1, store.DomainEvents);
        Assert.AreEqual(result.CommandSubmissionId, trace?.SubmissionRef);
        Assert.AreEqual($"/api/operations/trace/submissions/{result.CommandSubmissionId}", result.TraceUrl);
        Assert.AreEqual(result.ResultEventIds[0], trace?.DomainEventRefs[0]);
        Assert.IsTrue(result.ClientInstruction.ContainsKey("admission"));
        Assert.IsTrue(result.ClientInstruction.ContainsKey("definition"));
        Assert.AreEqual("oam-certification-current", result.ClientInstruction["definitionMode"]);
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.IsFalse((bool)admission["productionAllowed"]);
        Assert.IsTrue((bool)admission["confirmAllowed"]);
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
        Assert.HasCount(1, store.DomainEvents);
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
        Assert.IsFalse((bool)admission["confirmAllowed"]);
        Assert.IsFalse((bool)admission["productionAllowed"]);
    }

    [TestMethod]
    public void operations_confirm_blocks_unresolved_definition_before_unit_of_work()
    {
        var service = Service(
            out _,
            out var store,
            definitions: new WorkItemDefinitionRegistryService(Array.Empty<WorkItemDefinition>()));

        var result = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-unresolved-definition"), OperatorActor(), "req-unresolved-definition");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("admission_rejected", result.Error);
        Assert.IsFalse(result.Confirmed);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.AreEqual("prepare_only", admission["mode"]);
        Assert.IsFalse((bool)admission["confirmAllowed"]);
        Assert.IsFalse((bool)admission["productionAllowed"]);
        var definition = (IReadOnlyDictionary<string, object>)result.ClientInstruction["definition"];
        Assert.IsFalse((bool)definition["resolved"]);
        var noGo = (IReadOnlyList<string>)admission["noGoItems"];
        CollectionAssert.Contains(noGo.ToArray(), "definition_not_resolved_for_production_confirm");
    }

    [TestMethod]
    public void operations_confirm_does_not_resolve_definition_from_card_id_fallback()
    {
        var service = Service(
            out _,
            out var store,
            definitions: RegistryWith(Definition("roomSetup", "Dorm.StrictDefinitionOnly", "W-S3")));
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-card-fallback-blocked",
            TenantId: "tenant-s3",
            WorkItemType: "roomSetup",
            WorkspaceId: "W-S3",
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-card-fallback-blocked",
                ["cardId"] = "roomSetup"
            }));

        var result = service.ConfirmWorkItem(
            "wi-card-fallback-blocked",
            Request("idem-card-fallback-blocked", fieldValues: new Dictionary<string, string>()),
            OperatorActor(),
            "req-card-fallback-blocked");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("admission_rejected", result.Error);
        Assert.IsFalse(result.Confirmed);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        var definition = (IReadOnlyDictionary<string, object>)result.ClientInstruction["definition"];
        Assert.IsFalse((bool)definition["resolved"]);
        Assert.AreEqual("definition_registry_not_resolved", definition["reason"]);
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
            WorkItemType: "Dorm.DepositReceipt",
            WorkspaceId: "W-S3",
            CardId: "depositReceipt",
            OwnerRole: "finance",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-money-trace",
                ["cardId"] = "depositReceipt",
                ["definitionId"] = "definition.depositReceipt.v1"
            }));

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
        Assert.IsFalse((bool)admission["confirmAllowed"]);
        Assert.AreEqual("role_forbidden", admission["mode"]);
    }

    [TestMethod]
    public void high_risk_confirm_requires_verified_device_reason_and_evidence_before_unit_of_work()
    {
        var service = Service(out _, out var store);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-high-risk-device-missing",
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.DepositConfirmation",
            WorkspaceId: "W-STAY-DEPOSIT-LEDGER",
            CardId: "depositConfirmation",
            OwnerRole: "finance",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-high-risk-device-missing",
                ["cardId"] = "depositConfirmation",
                ["definitionId"] = "definition.depositConfirmation.v1"
            }));

        var result = service.ConfirmWorkItem(
            "wi-high-risk-device-missing",
            Request("idem-high-risk-device-missing", cardId: "depositConfirmation", fieldValues: new Dictionary<string, string>()),
            FinanceActor(),
            "req-high-risk-device-missing");

        Assert.AreEqual(StatusCodes.Status403Forbidden, result.StatusCode);
        Assert.AreEqual("admission_rejected", result.Error);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.IsFalse((bool)admission["confirmAllowed"]);
        var noGo = (IReadOnlyList<string>)admission["noGoItems"];
        CollectionAssert.Contains(noGo.ToArray(), "trusted_device_required");
        CollectionAssert.Contains(noGo.ToArray(), "high_risk_reason_required");
        CollectionAssert.Contains(noGo.ToArray(), "high_risk_evidence_refs_required");
    }

    [TestMethod]
    public void high_risk_confirm_with_verified_device_reason_and_evidence_reaches_unit_of_work()
    {
        var service = Service(out var runtime, out var store);
        runtime.UpsertDevice(Device("tenant-s3", "u-finance-test", "device-trusted", "trusted"));
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-high-risk-trusted",
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.DepositConfirmation",
            WorkspaceId: "W-STAY-DEPOSIT-LEDGER",
            CardId: "depositConfirmation",
            OwnerRole: "finance",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-high-risk-trusted",
                ["cardId"] = "depositConfirmation",
                ["definitionId"] = "definition.depositConfirmation.v1"
            }));

        var result = service.ConfirmWorkItem(
            "wi-high-risk-trusted",
            Request("idem-high-risk-trusted", cardId: "depositConfirmation", fieldValues: new Dictionary<string, string>()) with
            {
                EvidenceIds = new[] { "ev-high-risk-trusted" },
                DeviceId = "device-trusted",
                DeviceTrustStatus = "untrusted",
                Surface = "pc",
                Reason = "财务复核通过，允许进入内部试点确认。"
            },
            FinanceActor(),
            "req-high-risk-trusted");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("committed", result.CommitStatus);
        Assert.HasCount(1, store.Submissions);
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.IsTrue((bool)admission["confirmAllowed"]);
        Assert.IsFalse((bool)admission["productionAllowed"]);
    }

    [TestMethod]
    public void high_risk_confirm_ignores_self_reported_trusted_device_before_unit_of_work()
    {
        var service = Service(out _, out var store);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-high-risk-self-reported",
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.DepositConfirmation",
            WorkspaceId: "W-STAY-DEPOSIT-LEDGER",
            CardId: "depositConfirmation",
            OwnerRole: "finance",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-high-risk-self-reported",
                ["cardId"] = "depositConfirmation",
                ["definitionId"] = "definition.depositConfirmation.v1"
            }));

        var result = service.ConfirmWorkItem(
            "wi-high-risk-self-reported",
            Request("idem-high-risk-self-reported", cardId: "depositConfirmation", fieldValues: new Dictionary<string, string>()) with
            {
                EvidenceIds = new[] { "ev-self-reported" },
                DeviceId = "device-client-only",
                DeviceTrustStatus = "trusted",
                Surface = "pc",
                Reason = "客户端自报 trusted 不能作为准入事实。"
            },
            FinanceActor(),
            "req-high-risk-self-reported");

        Assert.AreEqual(StatusCodes.Status403Forbidden, result.StatusCode);
        Assert.AreEqual("admission_rejected", result.Error);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
    }

    [TestMethod]
    public void high_risk_confirm_blocks_untrusted_and_revoked_server_devices()
    {
        var untrustedService = Service(out var untrustedRuntime, out var untrustedStore);
        untrustedRuntime.UpsertDevice(Device("tenant-s3", "u-finance-test", "device-untrusted", "untrusted"));
        untrustedService.CreateWorkItem(HighRiskWorkItem("wi-high-risk-untrusted", "case-high-risk-untrusted", "depositConfirmation"));

        var untrusted = untrustedService.ConfirmWorkItem(
            "wi-high-risk-untrusted",
            TrustedHighRiskRequest("idem-high-risk-untrusted", "device-untrusted"),
            FinanceActor(),
            "req-high-risk-untrusted");

        Assert.AreEqual(StatusCodes.Status403Forbidden, untrusted.StatusCode);
        Assert.IsEmpty(untrustedStore.Submissions);
        var untrustedAdmission = (IReadOnlyDictionary<string, object>)untrusted.ClientInstruction["admission"];
        CollectionAssert.Contains(((IReadOnlyList<string>)untrustedAdmission["noGoItems"]).ToArray(), "trusted_device_unverified");

        var revokedService = Service(out var revokedRuntime, out var revokedStore);
        revokedRuntime.UpsertDevice(Device("tenant-s3", "u-finance-test", "device-revoked", "revoked", DateTimeOffset.UtcNow));
        revokedService.CreateWorkItem(HighRiskWorkItem("wi-high-risk-revoked", "case-high-risk-revoked", "depositConfirmation"));

        var revoked = revokedService.ConfirmWorkItem(
            "wi-high-risk-revoked",
            TrustedHighRiskRequest("idem-high-risk-revoked", "device-revoked"),
            FinanceActor(),
            "req-high-risk-revoked");

        Assert.AreEqual(StatusCodes.Status403Forbidden, revoked.StatusCode);
        Assert.IsEmpty(revokedStore.Submissions);
        var revokedAdmission = (IReadOnlyDictionary<string, object>)revoked.ClientInstruction["admission"];
        CollectionAssert.Contains(((IReadOnlyList<string>)revokedAdmission["noGoItems"]).ToArray(), "trusted_device_revoked");
    }

    [TestMethod]
    public void verified_device_context_blocks_tenant_mismatch()
    {
        var context = VerifiedDeviceTrustContext.FromServerSession(
            "device-cross-tenant",
            "tenant-s3",
            "pc",
            Device("tenant-other", "u-finance-test", "device-cross-tenant", "trusted"));

        Assert.IsFalse(context.Verified);
        Assert.AreEqual("trusted_device_tenant_mismatch", context.NoGoItem);
    }

    [TestMethod]
    public void operations_confirm_does_not_dispatch_next_work_item_from_shared_workspace_seed()
    {
        var service = Service(
            out _,
            out _,
            definitions: RegistryWith(Definition("leadCapture", "leadCapture", "W-STAY-LEAD-RESERVATION")));
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
        Assert.IsNull(next);
    }

    [TestMethod]
    public void operations_confirm_dispatches_next_work_item_from_generated_transition_policy()
    {
        var service = Service(out _, out _);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-room-setup-confirm-generated-flow",
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.RoomSetupConfirm",
            WorkspaceId: "W-DORM-MAINLINE",
            CardId: "cert.roomSetupConfirm",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-generated-room-flow",
                ["cardId"] = "cert.roomSetupConfirm",
                ["definitionId"] = "definition.dormitory.roomSetupConfirm.v1"
            }));

        var result = service.ConfirmWorkItem(
            "wi-room-setup-confirm-generated-flow",
            Request("idem-generated-room-flow", cardId: "cert.roomSetupConfirm", fieldValues: new Dictionary<string, string>()),
            OperatorActor(),
            "req-generated-room-flow");
        var next = service.ListWorkItems("tenant-s3")
            .SingleOrDefault(item => item.WorkspaceId == "W-DORM-MAINLINE" && item.Payload.TryGetValue("cardId", out var cardId) && cardId == "bedSetup");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsNotNull(next);
        Assert.AreEqual("Dorm.BedSetupConfirm", next!.WorkItemType);
        Assert.AreEqual("definition.dormitory.bedSetupConfirm.v1", next.Payload["definitionId"]);
        Assert.IsFalse(next.Payload.ContainsKey("definitionSourceCardId"));
        StringAssert.Contains(next.Payload["definitionMigrationRefs"], "cert.bedSetupConfirm");
        Assert.AreEqual("generated_transition_policy", next.Payload["dispatchedBy"]);
        Assert.AreEqual("docs/oam/kernel/oam-kernel-graph.generated.json", next.Payload["generatedTransitionSource"]);
    }

    [TestMethod]
    public void lead_reservation_create_does_not_dispatch_from_business_action_without_generated_policy()
    {
        var service = Service(
            out _,
            out _,
            ProjectionSeed.Create().Workspaces,
            definitions: RegistryWith(Definition("reservationCreate", "reservationCreate", "W-STAY-LEAD-RESERVATION")));
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
        Assert.IsNull(cancel);
        Assert.IsNull(convert);
    }

    [TestMethod]
    public void operations_confirm_returns_422_for_finance_truth_business_rule_failure()
    {
        var service = Service(out _, out var store);
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-money-business-blocked",
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.DepositReceipt",
            WorkspaceId: "W-S3",
            CardId: "depositReceipt",
            OwnerRole: "finance",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-money-business-blocked",
                ["cardId"] = "depositReceipt",
                ["definitionId"] = "definition.depositReceipt.v1"
            }));

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
        IReadOnlyList<WorkspaceProjection>? workspaces = null,
        WorkItemDefinitionRegistryService? definitions = null)
    {
        runtime = new FakeCatalogRuntime(workspaces);
        var catalog = new OperationsRuntimeService(runtime);
        store = new InMemoryOperationsStore();
        var router = new SliceCommandHandlerRouter()
            .Register(CanonicalOperationsApiService.ConfirmCommandDefinition, CanonicalOperationsApiService.HandleConfirmCommand);
        var unitOfWork = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            router);
        return new CanonicalOperationsApiService(catalog, unitOfWork, store, definitions);
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

    private static ConfirmWorkItemRequest TrustedHighRiskRequest(string idempotencyKey, string deviceId) =>
        Request(idempotencyKey, cardId: "depositConfirmation", fieldValues: new Dictionary<string, string>()) with
        {
            EvidenceIds = new[] { $"ev-{idempotencyKey}" },
            DeviceId = deviceId,
            Surface = "pc",
            Reason = "财务复核通过，允许进入内部试点确认。"
        };

    private static CreateWorkItemRequest HighRiskWorkItem(string workItemId, string caseId, string cardId) =>
        new(
            WorkItemId: workItemId,
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.DepositConfirmation",
            WorkspaceId: "W-STAY-DEPOSIT-LEDGER",
            CardId: cardId,
            OwnerRole: "finance",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = caseId,
                ["cardId"] = cardId,
                ["definitionId"] = "definition.depositConfirmation.v1"
            });

    private static RuntimeDeviceSession Device(
        string tenantId,
        string actorId,
        string deviceId,
        string trust,
        DateTimeOffset? revokedAtUtc = null) =>
        new(
            $"devsess-{deviceId}",
            tenantId,
            actorId,
            deviceId,
            trust,
            $"ua-{deviceId}",
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow,
            revokedAtUtc);

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

    private static WorkItemDefinitionRegistryService RegistryWith(params WorkItemDefinition[] definitions) =>
        new(WorkItemDefinitionRegistryService.LoadDefault().Definitions.Concat(definitions).ToArray());

    private static WorkItemDefinition Definition(string sourceCardId, string workItemType, string workspaceId) =>
        new(
            $"definition.test.{sourceCardId}.v1",
            "dormitory",
            "Accommodation.TestFixture",
            workspaceId,
            workItemType,
            $"Test.{sourceCardId}.Confirm",
            "Accommodation.TestFixture",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    sourceCardId,
                    true,
                    false,
                    false,
                    false,
                    false,
                    false,
                    "docs/contracts/definition/source-id-migration-fence.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "LedgerEntry", "LedgerTransaction", "PaymentFact", "DepositFact", "FinancialFact", "DashboardSummary", "Profile", "SharedReceipt" },
            "field.test.v1",
            "evidence.test.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            $"surface.test.{sourceCardId}",
            false,
            "operations-runtime-native",
            "当前 OAM 测试夹具定义，仅用于确认未解析 definition 不再被隐式放行。");

    private sealed class FakeCatalogRuntime : IOperationsRuntimeAdapter
    {
        private readonly IReadOnlyList<WorkspaceProjection> workspaces;
        private readonly Dictionary<string, RuntimeDeviceSession> devices = new(StringComparer.OrdinalIgnoreCase);
        private readonly IReadOnlyList<ProcessWorkItemIntentRecord> intents = new[]
        {
            new ProcessWorkItemIntentRecord(
                "intent-s3-room-setup",
                "process-run-s3",
                "tenant-s3",
                "W-S3:roomSetup",
                "Dorm.RoomSetup",
                "W-S3",
                "operator",
                "evt-intent-s3",
                "open",
                DateTimeOffset.UtcNow,
                new Dictionary<string, string>
                {
                    ["caseId"] = "W-S3",
                    ["cardId"] = "roomSetup",
                    ["definitionId"] = "definition.roomSetup.v1"
                })
        };

        public FakeCatalogRuntime(IReadOnlyList<WorkspaceProjection>? workspaces = null)
        {
            this.workspaces = workspaces ?? new[] { Workspace("W-S3") };
        }

        public int ConfirmCount { get; private set; }

        public void UpsertDevice(RuntimeDeviceSession session) =>
            devices[$"{session.TenantId}:{session.DeviceId}"] = session;

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            string.IsNullOrWhiteSpace(tenantId)
                ? intents
                : intents.Where(intent => intent.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase)).ToArray();

        public RuntimeDeviceSession? FindDeviceSession(string tenantId, string deviceId) =>
            devices.TryGetValue($"{tenantId}:{deviceId}", out var session) ? session : null;

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
            new { prepared = true };

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            new(ConfirmStatus.Confirmed, null, null);

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ConfirmCount++;
            throw new InvalidOperationException("canonical S3 confirm must not call source card confirm");
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
