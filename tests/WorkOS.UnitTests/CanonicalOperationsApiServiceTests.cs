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
        var service = Service(out var runtime, out var store, workspaces: new[] { AcceptedCapabilityRuntimeProjection.Workspace() });
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
                ["definitionId"] = "definition.dormitory.resourceReadinessConfirm.v1",
                ["bedCount"] = "2",
                ["createdBedCount"] = "2"
            }));

        var result = service.ConfirmWorkItem(
            "wi-current-resource-readiness-unit-of-work",
            Request("idem-current-resource-readiness", cardId: "cert.resourceReadinessConfirm", fieldValues: new Dictionary<string, string>
            {
                ["readinessState"] = "passed"
            }) with
            {
                EvidenceIds = new[] { "ev-readiness-positive" }
            },
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
    public void operations_workspace_start_attaches_admission_to_work_items()
    {
        var service = Service(
            out var runtime,
            out _,
            workspaces: new[] { AcceptedCapabilityRuntimeProjection.Workspace() });
        var workspace = runtime.FindWorkspace(AcceptedCapabilityRuntimeProjection.WorkspaceId)!;

        var result = service.StartWorkspaceCase(workspace, AcceptedCapabilityRuntimeProjection.WorkspaceId, OperatorActor());

        Assert.IsNotNull(result.WorkItem.Admission);
        Assert.AreEqual(result.WorkItem.AdmissionDecisionRef, result.WorkItem.Admission["admissionDecisionRef"]);
        Assert.IsTrue((bool)result.WorkItem.Admission["confirmAllowed"]);
        Assert.IsNotNull(result.WorkItem.BusinessTitle);
        Assert.IsNotNull(result.WorkItem.BusinessSummary);
        Assert.IsNotNull(result.WorkItem.LegalActions);
        Assert.AreEqual("confirm_allowed_production_blocked", result.WorkItem.AdmissionDecision);
        Assert.AreEqual("lodging.resource-basic-readiness", result.WorkItem.SourceScenario);
        Assert.AreEqual(2, result.WorkItem.LegalActions!.Count);
        Assert.AreEqual("openWorkItem", result.WorkItem.LegalActions[0].Action);
        Assert.IsFalse(result.WorkItem.LegalActions[0].WriteBusinessFact);
        Assert.AreEqual("submitWorkItem", result.WorkItem.LegalActions[1].Action);
        Assert.IsTrue(result.WorkItem.LegalActions[1].Allowed);
        Assert.IsTrue(result.WorkItem.LegalActions[1].WriteBusinessFact);
        var listed = result.OperationWorkItems.First(item => item.WorkItemId == result.WorkItem.WorkItemId);
        Assert.IsNotNull(listed.Admission);
        Assert.AreEqual(result.WorkItem.AdmissionDecisionRef, listed.AdmissionDecisionRef);
        Assert.IsNotNull(listed.BusinessTitle);
        Assert.IsNotNull(listed.BusinessSummary);
        Assert.IsNotNull(listed.LegalActions);
        Assert.AreEqual(result.WorkItem.AdmissionDecision, listed.AdmissionDecision);
        Assert.AreEqual(result.WorkItem.SourceScenario, listed.SourceScenario);
        Assert.AreEqual(result.WorkItem.LegalActions.Count, listed.LegalActions!.Count);
    }

    [TestMethod]
    public void definition_registry_resolves_start_adapter_without_promoting_workspace_card_identity()
    {
        var registry = WorkItemDefinitionRegistryService.LoadDefault();
        var adapterDefinition = registry.ResolveStartAdapter("W-STAY-LEAD-RESERVATION", "leadCapture");
        var currentKeyDefinition = registry.ResolveStartAdapter("W-DORM-MAINLINE", "cert.roomSetupConfirm");
        var dynamicCurrentKeyDefinition = registry.ResolveStartAdapter("W-DORM-MAINLINE-20260617173941-case", "cert.roomSetupConfirm");
        var directWorkspaceCard = registry.ResolveByWorkspaceCard("W-STAY-LEAD-RESERVATION", "leadCapture");

        Assert.IsTrue(adapterDefinition.Resolved);
        Assert.AreEqual("definition.dormitory.leadCapture.v1", adapterDefinition.DefinitionId);
        Assert.AreEqual("oam-certification-current", adapterDefinition.Definition?.DefinitionMode);
        Assert.IsTrue(currentKeyDefinition.Resolved);
        Assert.AreEqual("definition.dormitory.roomSetupConfirm.v1", currentKeyDefinition.DefinitionId);
        Assert.AreEqual("oam-certification-current", currentKeyDefinition.Definition?.DefinitionMode);
        Assert.IsTrue(dynamicCurrentKeyDefinition.Resolved);
        Assert.AreEqual("definition.dormitory.roomSetupConfirm.v1", dynamicCurrentKeyDefinition.DefinitionId);
        Assert.AreEqual("oam-certification-current", dynamicCurrentKeyDefinition.Definition?.DefinitionMode);
        Assert.IsFalse(directWorkspaceCard.Resolved);
    }

    [TestMethod]
    public void definition_registry_does_not_fallback_to_workspace_card_for_unregistered_start_adapter()
    {
        var registry = WorkItemDefinitionRegistryService.LoadDefault();

        var missingAdapter = registry.ResolveStartAdapter("W-STAY-UNKNOWN", "legacyCard");

        Assert.IsFalse(missingAdapter.Resolved);
        Assert.AreEqual("start_adapter_not_registered", missingAdapter.Reason);
        Assert.IsTrue(missingAdapter.MigrationRefs.All(item =>
            item.ReadOnly &&
            !item.Executable &&
            !item.AffectsAdmission &&
            !item.AffectsRuntimeConfirm &&
            !item.AffectsBusinessIdentity &&
            !item.AffectsLedger));
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
        Assert.IsEmpty(store.WorkItemEvents);
        Assert.IsEmpty(store.OutboxMessages);
        Assert.IsEmpty(store.LedgerTransactions);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.WriteLog);
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
    public void operations_confirm_blocks_missing_admission_policy_before_unit_of_work()
    {
        var service = Service(
            out _,
            out var store,
            definitions: RegistryWith(Definition(
                "missingAdmission",
                "Dorm.MissingAdmission",
                "W-S3",
                admissionPolicyRef: string.Empty)));
        service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-missing-admission-policy",
            TenantId: "tenant-s3",
            WorkItemType: "Dorm.MissingAdmission",
            WorkspaceId: "W-S3",
            CardId: "missingAdmission",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-missing-admission-policy",
                ["cardId"] = "missingAdmission",
                ["definitionId"] = "definition.test.missingAdmission.v1"
            }));

        var result = service.ConfirmWorkItem(
            "wi-missing-admission-policy",
            Request("idem-missing-admission-policy", cardId: "missingAdmission", fieldValues: new Dictionary<string, string>()),
            OperatorActor(),
            "req-missing-admission-policy");

        Assert.AreEqual(StatusCodes.Status403Forbidden, result.StatusCode);
        Assert.AreEqual("admission_rejected", result.Error);
        Assert.IsFalse(result.Confirmed);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        Assert.IsEmpty(store.WorkItemEvents);
        Assert.IsEmpty(store.OutboxMessages);
        Assert.IsEmpty(store.LedgerTransactions);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.WriteLog);
        var admission = (IReadOnlyDictionary<string, object>)result.ClientInstruction["admission"];
        Assert.IsFalse((bool)admission["prepareAllowed"]);
        Assert.IsFalse((bool)admission["confirmAllowed"]);
        Assert.IsFalse((bool)admission["productionAllowed"]);
        var noGo = (IReadOnlyList<string>)admission["noGoItems"];
        CollectionAssert.Contains(noGo.ToArray(), "missing_admission_contract");
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
        var service = Service(out _, out _, workspaces: new[] { AcceptedCapabilityRuntimeProjection.Workspace() });
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
            Request("idem-generated-room-flow", cardId: "cert.roomSetupConfirm", fieldValues: new Dictionary<string, string>
            {
                ["roomNo"] = "A101",
                ["capacity"] = "2"
            }) with
            {
                WorkspaceId = AcceptedCapabilityRuntimeProjection.WorkspaceId,
                EvidenceIds = new[] { "ev-room-positive" }
            },
            OperatorActor(),
            "req-generated-room-flow");
        var next = service.ListWorkItems("tenant-s3")
            .SingleOrDefault(item => item.WorkspaceId == "W-DORM-MAINLINE" && item.Payload.TryGetValue("cardId", out var cardId) && cardId == "cert.bedSetupConfirm");

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
    public void accepted_capability_duplicate_room_is_rejected_by_generated_rules_before_unit_of_work()
    {
        var service = Service(out _, out var store, workspaces: new[] { AcceptedCapabilityRuntimeProjection.Workspace() });
        service.CreateWorkItem(AcceptedCapabilityWorkItem(
            "wi-generated-duplicate-room",
            "Dorm.RoomSetupConfirm",
            "definition.dormitory.roomSetupConfirm.v1"));

        var result = service.ConfirmWorkItem(
            "wi-generated-duplicate-room",
            Request("idem-generated-duplicate-room", cardId: "cert.roomSetupConfirm", fieldValues: new Dictionary<string, string>
            {
                ["roomNo"] = "duplicate-room",
                ["capacity"] = "2"
            }) with
            {
                WorkspaceId = AcceptedCapabilityRuntimeProjection.WorkspaceId,
                EvidenceIds = new[] { "ev-room-photo" }
            },
            OperatorActor(),
            "req-generated-duplicate-room");

        Assert.AreEqual(StatusCodes.Status409Conflict, result.StatusCode);
        Assert.AreEqual("room_already_exists", result.Error);
        Assert.AreEqual("generated_capability_runtime_rules", result.Source);
        Assert.IsFalse(result.Confirmed);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        Assert.IsEmpty(store.WorkItemEvents);
        Assert.IsEmpty(store.OutboxMessages);
    }

    [TestMethod]
    public void accepted_capability_forged_stable_ref_is_rejected_by_generated_rules()
    {
        var service = Service(out _, out var store, workspaces: new[] { AcceptedCapabilityRuntimeProjection.Workspace() });
        service.CreateWorkItem(AcceptedCapabilityWorkItem(
            "wi-generated-forged-ref",
            "Dorm.RoomSetupConfirm",
            "definition.dormitory.roomSetupConfirm.v1"));

        var result = service.ConfirmWorkItem(
            "wi-generated-forged-ref",
            Request("idem-generated-forged-ref", cardId: "cert.roomSetupConfirm", fieldValues: new Dictionary<string, string>
            {
                ["roomNo"] = "A101",
                ["capacity"] = "2",
                ["roomStableRef"] = "forged-room-ref"
            }) with
            {
                WorkspaceId = AcceptedCapabilityRuntimeProjection.WorkspaceId,
                EvidenceIds = new[] { "ev-room-photo" }
            },
            OperatorActor(),
            "req-generated-forged-ref");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("readonly_stable_ref_violation", result.Error);
        Assert.AreEqual("generated_capability_runtime_rules", result.Source);
        Assert.IsEmpty(store.Submissions);
        Assert.IsTrue(result.ClientInstruction.ContainsKey("generatedRuleId"));
    }

    [TestMethod]
    public void accepted_capability_forged_room_or_bed_id_is_rejected_by_generated_rules()
    {
        var service = Service(out _, out var store, workspaces: new[] { AcceptedCapabilityRuntimeProjection.Workspace() });
        service.CreateWorkItem(AcceptedCapabilityWorkItem(
            "wi-generated-forged-room-id",
            "Dorm.RoomSetupConfirm",
            "definition.dormitory.roomSetupConfirm.v1"));
        service.CreateWorkItem(AcceptedCapabilityWorkItem(
            "wi-generated-forged-bed-id",
            "Dorm.BedSetupConfirm",
            "definition.dormitory.bedSetupConfirm.v1",
            new Dictionary<string, string>
            {
                ["bedCount"] = "2"
            }));

        var forgedRoom = service.ConfirmWorkItem(
            "wi-generated-forged-room-id",
            Request("idem-generated-forged-room-id", cardId: "cert.roomSetupConfirm", fieldValues: new Dictionary<string, string>
            {
                ["roomNo"] = "A102",
                ["capacity"] = "2",
                ["roomId"] = "forged-room-id"
            }) with
            {
                WorkspaceId = AcceptedCapabilityRuntimeProjection.WorkspaceId,
                EvidenceIds = new[] { "ev-room-photo" }
            },
            OperatorActor(),
            "req-generated-forged-room-id");
        var forgedBed = service.ConfirmWorkItem(
            "wi-generated-forged-bed-id",
            Request("idem-generated-forged-bed-id", cardId: "cert.bedSetupConfirm", fieldValues: new Dictionary<string, string>
            {
                ["bedId"] = "forged-bed-id"
            }) with
            {
                WorkspaceId = AcceptedCapabilityRuntimeProjection.WorkspaceId,
                EvidenceIds = new[] { "ev-bed-photo" }
            },
            OperatorActor(),
            "req-generated-forged-bed-id");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, forgedRoom.StatusCode);
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, forgedBed.StatusCode);
        Assert.AreEqual("readonly_stable_ref_violation", forgedRoom.Error);
        Assert.AreEqual("readonly_stable_ref_violation", forgedBed.Error);
        Assert.AreEqual("generated_capability_runtime_rules", forgedRoom.Source);
        Assert.AreEqual("generated_capability_runtime_rules", forgedBed.Source);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        Assert.IsEmpty(store.OutboxMessages);
    }

    [TestMethod]
    public void accepted_capability_readiness_state_is_closed_by_generated_invariants()
    {
        var service = Service(out _, out var store, workspaces: new[] { AcceptedCapabilityRuntimeProjection.Workspace() });
        service.CreateWorkItem(AcceptedCapabilityWorkItem(
            "wi-generated-invalid-readiness",
            "Dorm.ResourceReadinessConfirm",
            "definition.dormitory.resourceReadinessConfirm.v1",
            new Dictionary<string, string>
            {
                ["bedCount"] = "2",
                ["createdBedCount"] = "2"
            }));

        var result = service.ConfirmWorkItem(
            "wi-generated-invalid-readiness",
            Request("idem-generated-invalid-readiness", cardId: "cert.resourceReadinessConfirm", fieldValues: new Dictionary<string, string>
            {
                ["readinessState"] = "ready"
            }) with
            {
                WorkspaceId = AcceptedCapabilityRuntimeProjection.WorkspaceId,
                EvidenceIds = new[] { "ev-readiness-photo" }
            },
            OperatorActor(),
            "req-generated-invalid-readiness");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("invalid_readiness_state", result.Error);
        Assert.AreEqual("generated_capability_runtime_rules", result.Source);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
    }

    [TestMethod]
    public void scenario2_operation_inspection_confirm_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario2Workspace() },
            definitions: RegistryWith(Scenario2Definition("Dorm.OperationInspectionConfirm")));
        service.CreateWorkItem(Scenario2WorkItem(
            "wi-scenario2-inspection",
            "Dorm.OperationInspectionConfirm",
            new Dictionary<string, string>
            {
                ["baseReadySnapshotRef"] = "br-301-ready"
            }));

        var result = service.ConfirmWorkItem(
            "wi-scenario2-inspection",
            Scenario2Request("idem-scenario2-inspection", "Dorm.OperationInspectionConfirm", new Dictionary<string, string>
            {
                ["cleaningInspectionResult"] = "通过",
                ["maintenanceInspectionResult"] = "通过",
                ["safetyInspectionResult"] = "通过",
                ["facilityInspectionResult"] = "通过",
                ["inspectionConclusion"] = "通过"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario2-inspection" }
            },
            OperatorActor(),
            "req-scenario2-inspection");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario2_missing_basic_readiness_is_rejected_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario2Workspace() },
            definitions: RegistryWith(Scenario2Definition("Dorm.OperationInspectionConfirm")));
        service.CreateWorkItem(Scenario2WorkItem("wi-scenario2-no-base-ready", "Dorm.OperationInspectionConfirm"));

        var result = service.ConfirmWorkItem(
            "wi-scenario2-no-base-ready",
            Scenario2Request("idem-scenario2-no-base-ready", "Dorm.OperationInspectionConfirm", new Dictionary<string, string>
            {
                ["inspectionConclusion"] = "通过"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario2-no-base-ready" }
            },
            OperatorActor(),
            "req-scenario2-no-base-ready");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("upstream_basic_readiness_missing", result.Error);
        Assert.AreEqual("generated_capability_runtime_rules", result.Source);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario2_missing_evidence_is_rejected_without_projection_refresh()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario2Workspace() },
            definitions: RegistryWith(Scenario2Definition("Dorm.OperationInspectionConfirm")));
        service.CreateWorkItem(Scenario2WorkItem(
            "wi-scenario2-no-evidence",
            "Dorm.OperationInspectionConfirm",
            new Dictionary<string, string>
            {
                ["baseReadySnapshotRef"] = "br-301-ready"
            }));

        var result = service.ConfirmWorkItem(
            "wi-scenario2-no-evidence",
            Scenario2Request("idem-scenario2-no-evidence", "Dorm.OperationInspectionConfirm", new Dictionary<string, string>
            {
                ["inspectionConclusion"] = "通过"
            }),
            OperatorActor(),
            "req-scenario2-no-evidence");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("operation_evidence_missing", result.Error);
        Assert.IsFalse((bool)result.ClientInstruction["refreshProjection"]);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario2_rejects_forged_internal_reference_before_unit_of_work()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario2Workspace() },
            definitions: RegistryWith(Scenario2Definition("Dorm.OperationInspectionConfirm")));
        service.CreateWorkItem(Scenario2WorkItem(
            "wi-scenario2-forged-room-id",
            "Dorm.OperationInspectionConfirm",
            new Dictionary<string, string>
            {
                ["baseReadySnapshotRef"] = "br-301-ready"
            }));

        var result = service.ConfirmWorkItem(
            "wi-scenario2-forged-room-id",
            Scenario2Request("idem-scenario2-forged-room-id", "Dorm.OperationInspectionConfirm", new Dictionary<string, string>
            {
                ["roomId"] = "forged-room-id",
                ["inspectionConclusion"] = "通过"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario2-forged-room-id" }
            },
            OperatorActor(),
            "req-scenario2-forged-room-id");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("forged_internal_reference", result.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario2_status_change_blocks_open_blocker_concurrency_and_cross_scenario_attempts()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario2Workspace() },
            definitions: RegistryWith(Scenario2Definition("Dorm.OperationStatusChangeConfirm")));
        service.CreateWorkItem(Scenario2WorkItem(
            "wi-scenario2-open-blocker",
            "Dorm.OperationStatusChangeConfirm",
            Scenario2ReadyPayload()));
        service.CreateWorkItem(Scenario2WorkItem(
            "wi-scenario2-concurrency",
            "Dorm.OperationStatusChangeConfirm",
            Scenario2ReadyPayload(new Dictionary<string, string>
            {
                ["currentStatusVersion"] = "2"
            })));
        service.CreateWorkItem(Scenario2WorkItem(
            "wi-scenario2-cross-scenario",
            "Dorm.OperationStatusChangeConfirm",
            Scenario2ReadyPayload()));

        var openBlocker = service.ConfirmWorkItem(
            "wi-scenario2-open-blocker",
            Scenario2Request("idem-scenario2-open-blocker", "Dorm.OperationStatusChangeConfirm", new Dictionary<string, string>
            {
                ["newOperationStatus"] = "可运营",
                ["hasOpenBlocker"] = "true"
            }) with
            {
                EvidenceIds = new[] { "ev-open-blocker" }
            },
            OperatorActor(),
            "req-scenario2-open-blocker");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario2-concurrency",
            Scenario2Request("idem-scenario2-concurrency", "Dorm.OperationStatusChangeConfirm", new Dictionary<string, string>
            {
                ["newOperationStatus"] = "维修中",
                ["expectedStatusVersion"] = "1"
            }) with
            {
                EvidenceIds = new[] { "ev-concurrency" }
            },
            OperatorActor(),
            "req-scenario2-concurrency");
        var crossScenario = service.ConfirmWorkItem(
            "wi-scenario2-cross-scenario",
            Scenario2Request("idem-scenario2-cross-scenario", "Dorm.OperationStatusChangeConfirm", new Dictionary<string, string>
            {
                ["newOperationStatus"] = "可运营",
                ["targetNextAction"] = "price"
            }) with
            {
                EvidenceIds = new[] { "ev-cross-scenario" }
            },
            OperatorActor(),
            "req-scenario2-cross-scenario");

        Assert.AreEqual("unclosed_blocker_for_operable", openBlocker.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_status_conflict", concurrency.Error);
        Assert.AreEqual("cross_scenario_price_reservation_forbidden", crossScenario.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario2_restore_requires_closed_blockers_and_recheck_evidence()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario2Workspace() },
            definitions: RegistryWith(Scenario2Definition("Dorm.OperationRestoreConfirm")));
        service.CreateWorkItem(Scenario2WorkItem(
            "wi-scenario2-restore-no-recheck",
            "Dorm.OperationRestoreConfirm",
            Scenario2ReadyPayload(new Dictionary<string, string>
            {
                ["allBlockersClosed"] = "true"
            })));

        var result = service.ConfirmWorkItem(
            "wi-scenario2-restore-no-recheck",
            Scenario2Request("idem-scenario2-restore-no-recheck", "Dorm.OperationRestoreConfirm", new Dictionary<string, string>
            {
                ["recheckResult"] = "未通过"
            }) with
            {
                EvidenceIds = new[] { "ev-restore-no-recheck" }
            },
            OperatorActor(),
            "req-scenario2-restore-no-recheck");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("restore_without_recheck_pass", result.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario3_accommodation_product_confirm_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario3Workspace() },
            definitions: RegistryWith(Scenario3Definition("Dorm.AccommodationProductConfirm")));
        service.CreateWorkItem(Scenario3WorkItem(
            "wi-scenario3-product-confirm",
            "Dorm.AccommodationProductConfirm",
            Scenario3ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario3-product-confirm",
            Scenario3Request("idem-scenario3-product-confirm", "Dorm.AccommodationProductConfirm", new Dictionary<string, string>
            {
                ["productName"] = "301 房间整房按晚价",
                ["sellableUnit"] = "整房",
                ["resourceBindingSelection"] = "301 房间",
                ["productEnabled"] = "true"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario3-product-binding" }
            },
            OperatorActor(),
            "req-scenario3-product-confirm");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario3_requires_operable_upstream_and_blocks_operation_blockers_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario3Workspace() },
            definitions: RegistryWith(Scenario3Definition("Dorm.AccommodationProductConfirm")));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-not-operable", "Dorm.AccommodationProductConfirm"));
        service.CreateWorkItem(Scenario3WorkItem(
            "wi-scenario3-operation-blocked",
            "Dorm.AccommodationProductConfirm",
            Scenario3ReadyPayload(new Dictionary<string, string>
            {
                ["operationBlocked"] = "true",
                ["operationBlockerReason"] = "设施待处理"
            })));

        var notOperable = service.ConfirmWorkItem(
            "wi-scenario3-not-operable",
            Scenario3Request("idem-scenario3-not-operable", "Dorm.AccommodationProductConfirm", new Dictionary<string, string>
            {
                ["productName"] = "301 房间价格草稿",
                ["resourceBindingSelection"] = "301 房间"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario3-not-operable" }
            },
            OperatorActor(),
            "req-scenario3-not-operable");
        var blocked = service.ConfirmWorkItem(
            "wi-scenario3-operation-blocked",
            Scenario3Request("idem-scenario3-operation-blocked", "Dorm.AccommodationProductConfirm", new Dictionary<string, string>
            {
                ["productName"] = "301 房间价格草稿",
                ["resourceBindingSelection"] = "301 房间"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario3-operation-blocked" }
            },
            OperatorActor(),
            "req-scenario3-operation-blocked");

        Assert.AreEqual("upstream_operable_required", notOperable.Error);
        Assert.AreEqual("operation_blocked_for_pricing", blocked.Error);
        Assert.AreEqual("generated_capability_runtime_rules", notOperable.Source);
        Assert.AreEqual("generated_capability_runtime_rules", blocked.Source);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario3_rate_plan_definition_blocks_invalid_price_currency_period_and_finance_facts()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario3Workspace() },
            definitions: RegistryWith(Scenario3Definition("Dorm.RatePlanDefinitionConfirm")));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-negative-price", "Dorm.RatePlanDefinitionConfirm", Scenario3ReadyPayload()));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-missing-currency", "Dorm.RatePlanDefinitionConfirm", Scenario3ReadyPayload()));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-missing-period", "Dorm.RatePlanDefinitionConfirm", Scenario3ReadyPayload()));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-payment-attempt", "Dorm.RatePlanDefinitionConfirm", Scenario3ReadyPayload()));

        var negativePrice = service.ConfirmWorkItem(
            "wi-scenario3-negative-price",
            Scenario3Request("idem-scenario3-negative-price", "Dorm.RatePlanDefinitionConfirm", new Dictionary<string, string>
            {
                ["basePrice"] = "-1",
                ["currency"] = "CNY",
                ["pricingPeriod"] = "按晚"
            }) with { EvidenceIds = new[] { "ev-scenario3-negative-price" } },
            OperatorActor(),
            "req-scenario3-negative-price");
        var missingCurrency = service.ConfirmWorkItem(
            "wi-scenario3-missing-currency",
            Scenario3Request("idem-scenario3-missing-currency", "Dorm.RatePlanDefinitionConfirm", new Dictionary<string, string>
            {
                ["basePrice"] = "180",
                ["pricingPeriod"] = "按晚"
            }) with { EvidenceIds = new[] { "ev-scenario3-missing-currency" } },
            OperatorActor(),
            "req-scenario3-missing-currency");
        var missingPeriod = service.ConfirmWorkItem(
            "wi-scenario3-missing-period",
            Scenario3Request("idem-scenario3-missing-period", "Dorm.RatePlanDefinitionConfirm", new Dictionary<string, string>
            {
                ["basePrice"] = "180",
                ["currency"] = "CNY"
            }) with { EvidenceIds = new[] { "ev-scenario3-missing-period" } },
            OperatorActor(),
            "req-scenario3-missing-period");
        var paymentAttempt = service.ConfirmWorkItem(
            "wi-scenario3-payment-attempt",
            Scenario3Request("idem-scenario3-payment-attempt", "Dorm.RatePlanDefinitionConfirm", new Dictionary<string, string>
            {
                ["basePrice"] = "180",
                ["currency"] = "CNY",
                ["pricingPeriod"] = "按晚",
                ["paymentIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario3-payment-attempt" } },
            OperatorActor(),
            "req-scenario3-payment-attempt");

        Assert.AreEqual("price_value_invalid", negativePrice.Error);
        Assert.AreEqual("currency_required", missingCurrency.Error);
        Assert.AreEqual("pricing_period_required", missingPeriod.Error);
        Assert.AreEqual("deposit_payment_forbidden", paymentAttempt.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario3_price_activation_blocks_date_conflict_and_effective_inline_edit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario3Workspace() },
            definitions: RegistryWith(Scenario3Definition("Dorm.PriceVersionActivate")));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-date-invalid", "Dorm.PriceVersionActivate", Scenario3ReadyPayload()));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-price-conflict", "Dorm.PriceVersionActivate", Scenario3ReadyPayload()));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-inline-edit", "Dorm.PriceVersionActivate", Scenario3ReadyPayload()));

        var dateInvalid = service.ConfirmWorkItem(
            "wi-scenario3-date-invalid",
            Scenario3Request("idem-scenario3-date-invalid", "Dorm.PriceVersionActivate", new Dictionary<string, string>
            {
                ["effectiveDate"] = "2026-07-10",
                ["expiryDate"] = "2026-07-01"
            }) with { EvidenceIds = new[] { "ev-scenario3-date-invalid" } },
            OperatorActor(),
            "req-scenario3-date-invalid");
        var priceConflict = service.ConfirmWorkItem(
            "wi-scenario3-price-conflict",
            Scenario3Request("idem-scenario3-price-conflict", "Dorm.PriceVersionActivate", new Dictionary<string, string>
            {
                ["dateRangeConflict"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario3-price-conflict" } },
            OperatorActor(),
            "req-scenario3-price-conflict");
        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario3-inline-edit",
            Scenario3Request("idem-scenario3-inline-edit", "Dorm.PriceVersionActivate", new Dictionary<string, string>
            {
                ["priceStatus"] = "已生效",
                ["editInPlace"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario3-inline-edit" } },
            OperatorActor(),
            "req-scenario3-inline-edit");

        Assert.AreEqual("date_range_invalid", dateInvalid.Error);
        Assert.AreEqual("price_date_conflict", priceConflict.Error);
        Assert.AreEqual("post_effective_inline_edit_forbidden", inlineEdit.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario3_disable_and_void_block_forged_duplicate_concurrency_and_readonly_writes()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario3Workspace() },
            definitions: RegistryWith(
                Scenario3Definition("Dorm.PriceDisable"),
                Scenario3Definition("Dorm.PriceDraftVoid")));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-forged-price-id", "Dorm.PriceDisable", Scenario3ReadyPayload()));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-duplicate-submit", "Dorm.PriceDraftVoid", Scenario3ReadyPayload()));
        service.CreateWorkItem(Scenario3WorkItem(
            "wi-scenario3-concurrency",
            "Dorm.PriceDisable",
            Scenario3ReadyPayload(new Dictionary<string, string> { ["currentPriceVersion"] = "2" })));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-readonly-write", "Dorm.PriceDraftVoid", Scenario3ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario3-forged-price-id",
            Scenario3Request("idem-scenario3-forged-price-id", "Dorm.PriceDisable", new Dictionary<string, string>
            {
                ["priceVersionId"] = "forged-price-version"
            }) with { EvidenceIds = new[] { "ev-scenario3-forged-price-id" } },
            OperatorActor(),
            "req-scenario3-forged-price-id");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario3-duplicate-submit",
            Scenario3Request("idem-scenario3-duplicate-submit", "Dorm.PriceDraftVoid", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario3-duplicate-submit" } },
            OperatorActor(),
            "req-scenario3-duplicate-submit");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario3-concurrency",
            Scenario3Request("idem-scenario3-concurrency", "Dorm.PriceDisable", new Dictionary<string, string>
            {
                ["expectedPriceVersion"] = "1"
            }) with { EvidenceIds = new[] { "ev-scenario3-concurrency" } },
            OperatorActor(),
            "req-scenario3-concurrency");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario3-readonly-write",
            Scenario3Request("idem-scenario3-readonly-write", "Dorm.PriceDraftVoid", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }) with { EvidenceIds = new[] { "ev-scenario3-readonly-write" } },
            OperatorActor(),
            "req-scenario3-readonly-write");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_price_version_conflict", concurrency.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario3_blocks_cross_scenario_quote_reservation_attempts_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario3Workspace() },
            definitions: RegistryWith(Scenario3Definition("Dorm.RatePlanDefinitionConfirm")));
        service.CreateWorkItem(Scenario3WorkItem("wi-scenario3-cross-scenario", "Dorm.RatePlanDefinitionConfirm", Scenario3ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario3-cross-scenario",
            Scenario3Request("idem-scenario3-cross-scenario", "Dorm.RatePlanDefinitionConfirm", new Dictionary<string, string>
            {
                ["basePrice"] = "180",
                ["currency"] = "CNY",
                ["pricingPeriod"] = "按晚",
                ["targetNextAction"] = "quote"
            }) with { EvidenceIds = new[] { "ev-scenario3-cross-scenario" } },
            OperatorActor(),
            "req-scenario3-cross-scenario");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual("cross_scenario_quote_reservation_forbidden", result.Error);
        Assert.AreEqual("generated_capability_runtime_rules", result.Source);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario4_inquiry_register_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario4Workspace() },
            definitions: RegistryWith(Scenario4Definition("Dorm.InquiryRegister")));
        service.CreateWorkItem(Scenario4WorkItem(
            "wi-scenario4-inquiry-register",
            "Dorm.InquiryRegister",
            Scenario4ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario4-inquiry-register",
            Scenario4Request("idem-scenario4-inquiry-register", "Dorm.InquiryRegister", new Dictionary<string, string>
            {
                ["customerName"] = "张三",
                ["contactPhone"] = "13800000000",
                ["customerSource"] = "电话询价"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario4-inquiry-register" }
            },
            OperatorActor(),
            "req-scenario4-inquiry-register");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario4_stay_demand_blocks_invalid_dates_and_guest_count_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario4Workspace() },
            definitions: RegistryWith(Scenario4Definition("Dorm.StayDemandConfirm")));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-invalid-dates", "Dorm.StayDemandConfirm", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-invalid-guests", "Dorm.StayDemandConfirm", Scenario4ReadyPayload()));

        var invalidDates = service.ConfirmWorkItem(
            "wi-scenario4-invalid-dates",
            Scenario4Request("idem-scenario4-invalid-dates", "Dorm.StayDemandConfirm", new Dictionary<string, string>
            {
                ["checkInDate"] = "2026-07-10",
                ["checkOutDate"] = "2026-07-10",
                ["guestCount"] = "2"
            }) with { EvidenceIds = new[] { "ev-scenario4-invalid-dates" } },
            OperatorActor(),
            "req-scenario4-invalid-dates");
        var invalidGuests = service.ConfirmWorkItem(
            "wi-scenario4-invalid-guests",
            Scenario4Request("idem-scenario4-invalid-guests", "Dorm.StayDemandConfirm", new Dictionary<string, string>
            {
                ["checkInDate"] = "2026-07-10",
                ["checkOutDate"] = "2026-07-12",
                ["guestCount"] = "0"
            }) with { EvidenceIds = new[] { "ev-scenario4-invalid-guests" } },
            OperatorActor(),
            "req-scenario4-invalid-guests");

        Assert.AreEqual("date_range_invalid", invalidDates.Error);
        Assert.AreEqual("guest_count_invalid", invalidGuests.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario4_quote_draft_blocks_missing_product_price_operation_validity_and_snapshot_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario4Workspace() },
            definitions: RegistryWith(Scenario4Definition("Dorm.QuoteDraftGenerate")));
        service.CreateWorkItem(Scenario4WorkItem(
            "wi-scenario4-missing-product",
            "Dorm.QuoteDraftGenerate",
            Scenario4ReadyPayload(new Dictionary<string, string>
            {
                ["productSummary"] = "",
                ["productRef"] = "",
                ["quoteOptionSelection"] = "",
                ["productChoice"] = ""
            })));
        service.CreateWorkItem(Scenario4WorkItem(
            "wi-scenario4-missing-price",
            "Dorm.QuoteDraftGenerate",
            Scenario4ReadyPayload(new Dictionary<string, string>
            {
                ["priceVersionRef"] = "",
                ["priceStatus"] = "",
                ["canEnterInquiryQuote"] = "false"
            })));
        service.CreateWorkItem(Scenario4WorkItem(
            "wi-scenario4-operation-blocked",
            "Dorm.QuoteDraftGenerate",
            Scenario4ReadyPayload(new Dictionary<string, string>
            {
                ["operationBlocked"] = "true",
                ["operationBlockerReason"] = "维修中"
            })));
        service.CreateWorkItem(Scenario4WorkItem(
            "wi-scenario4-missing-validity",
            "Dorm.QuoteDraftGenerate",
            Scenario4ReadyPayload(new Dictionary<string, string>
            {
                ["quoteValidityOption"] = "",
                ["validUntil"] = ""
            })));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-snapshot-mismatch", "Dorm.QuoteDraftGenerate", Scenario4ReadyPayload()));

        var missingProduct = service.ConfirmWorkItem(
            "wi-scenario4-missing-product",
            Scenario4Request("idem-scenario4-missing-product", "Dorm.QuoteDraftGenerate") with { EvidenceIds = new[] { "ev-scenario4-missing-product" } },
            OperatorActor(),
            "req-scenario4-missing-product");
        var missingPrice = service.ConfirmWorkItem(
            "wi-scenario4-missing-price",
            Scenario4Request("idem-scenario4-missing-price", "Dorm.QuoteDraftGenerate") with { EvidenceIds = new[] { "ev-scenario4-missing-price" } },
            OperatorActor(),
            "req-scenario4-missing-price");
        var operationBlocked = service.ConfirmWorkItem(
            "wi-scenario4-operation-blocked",
            Scenario4Request("idem-scenario4-operation-blocked", "Dorm.QuoteDraftGenerate") with { EvidenceIds = new[] { "ev-scenario4-operation-blocked" } },
            OperatorActor(),
            "req-scenario4-operation-blocked");
        var missingValidity = service.ConfirmWorkItem(
            "wi-scenario4-missing-validity",
            Scenario4Request("idem-scenario4-missing-validity", "Dorm.QuoteDraftGenerate") with { EvidenceIds = new[] { "ev-scenario4-missing-validity" } },
            OperatorActor(),
            "req-scenario4-missing-validity");
        var snapshotMismatch = service.ConfirmWorkItem(
            "wi-scenario4-snapshot-mismatch",
            Scenario4Request("idem-scenario4-snapshot-mismatch", "Dorm.QuoteDraftGenerate", new Dictionary<string, string>
            {
                ["snapshotMismatch"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario4-snapshot-mismatch" } },
            OperatorActor(),
            "req-scenario4-snapshot-mismatch");

        Assert.AreEqual("valid_product_required", missingProduct.Error);
        Assert.AreEqual("effective_price_required", missingPrice.Error);
        Assert.AreEqual("operation_blocked_for_quote", operationBlocked.Error);
        Assert.AreEqual("quote_validity_required", missingValidity.Error);
        Assert.AreEqual("price_snapshot_mismatch", snapshotMismatch.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario4_quote_send_and_version_block_discount_inline_edit_and_missing_evidence_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario4Workspace() },
            definitions: RegistryWith(
                Scenario4Definition("Dorm.QuoteVersionConfirm"),
                Scenario4Definition("Dorm.QuoteSend"),
                Scenario4Definition("Dorm.QuoteClose")));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-inline-edit", "Dorm.QuoteVersionConfirm", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-discount-over-authority", "Dorm.QuoteSend", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-missing-evidence", "Dorm.QuoteClose", Scenario4ReadyPayload()));

        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario4-inline-edit",
            Scenario4Request("idem-scenario4-inline-edit", "Dorm.QuoteVersionConfirm", new Dictionary<string, string>
            {
                ["quoteStatus"] = "报价已发送",
                ["editInPlace"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario4-inline-edit" } },
            OperatorActor(),
            "req-scenario4-inline-edit");
        var discount = service.ConfirmWorkItem(
            "wi-scenario4-discount-over-authority",
            Scenario4Request("idem-scenario4-discount-over-authority", "Dorm.QuoteSend", new Dictionary<string, string>
            {
                ["discountOverAuthority"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario4-discount-over-authority" } },
            OperatorActor(),
            "req-scenario4-discount-over-authority");
        var missingEvidence = service.ConfirmWorkItem(
            "wi-scenario4-missing-evidence",
            Scenario4Request("idem-scenario4-missing-evidence", "Dorm.QuoteClose"),
            OperatorActor(),
            "req-scenario4-missing-evidence");

        Assert.AreEqual("post_issue_inline_edit_forbidden", inlineEdit.Error);
        Assert.AreEqual("discount_approval_required", discount.Error);
        Assert.AreEqual("quote_evidence_missing", missingEvidence.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario4_requote_and_reservation_prep_block_expired_cross_scenario_duplicate_concurrency_forged_and_finance_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario4Workspace() },
            definitions: RegistryWith(
                Scenario4Definition("Dorm.ReservationPreparationStart"),
                Scenario4Definition("Dorm.RequoteCreate"),
                Scenario4Definition("Dorm.QuoteClose"),
                Scenario4Definition("Dorm.QuoteDraftGenerate")));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-expired-prep", "Dorm.ReservationPreparationStart", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-cross-scenario", "Dorm.RequoteCreate", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-duplicate", "Dorm.QuoteClose", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem(
            "wi-scenario4-concurrency",
            "Dorm.RequoteCreate",
            Scenario4ReadyPayload(new Dictionary<string, string> { ["currentQuoteVersion"] = "2" })));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-forged-ref", "Dorm.QuoteDraftGenerate", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-finance-fact", "Dorm.RequoteCreate", Scenario4ReadyPayload()));
        service.CreateWorkItem(Scenario4WorkItem("wi-scenario4-readonly-write", "Dorm.QuoteDraftGenerate", Scenario4ReadyPayload()));

        var expiredPrep = service.ConfirmWorkItem(
            "wi-scenario4-expired-prep",
            Scenario4Request("idem-scenario4-expired-prep", "Dorm.ReservationPreparationStart", new Dictionary<string, string>
            {
                ["quoteExpired"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario4-expired-prep" } },
            OperatorActor(),
            "req-scenario4-expired-prep");
        var crossScenario = service.ConfirmWorkItem(
            "wi-scenario4-cross-scenario",
            Scenario4Request("idem-scenario4-cross-scenario", "Dorm.RequoteCreate", new Dictionary<string, string>
            {
                ["targetNextAction"] = "reservation",
                ["inventoryHoldIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario4-cross-scenario" } },
            OperatorActor(),
            "req-scenario4-cross-scenario");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario4-duplicate",
            Scenario4Request("idem-scenario4-duplicate", "Dorm.QuoteClose", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario4-duplicate" } },
            OperatorActor(),
            "req-scenario4-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario4-concurrency",
            Scenario4Request("idem-scenario4-concurrency", "Dorm.RequoteCreate", new Dictionary<string, string>
            {
                ["expectedQuoteVersion"] = "1"
            }) with { EvidenceIds = new[] { "ev-scenario4-concurrency" } },
            OperatorActor(),
            "req-scenario4-concurrency");
        var forged = service.ConfirmWorkItem(
            "wi-scenario4-forged-ref",
            Scenario4Request("idem-scenario4-forged-ref", "Dorm.QuoteDraftGenerate", new Dictionary<string, string>
            {
                ["productId"] = "forged-product"
            }) with { EvidenceIds = new[] { "ev-scenario4-forged-ref" } },
            OperatorActor(),
            "req-scenario4-forged-ref");
        var finance = service.ConfirmWorkItem(
            "wi-scenario4-finance-fact",
            Scenario4Request("idem-scenario4-finance-fact", "Dorm.RequoteCreate", new Dictionary<string, string>
            {
                ["paymentIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario4-finance-fact" } },
            OperatorActor(),
            "req-scenario4-finance-fact");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario4-readonly-write",
            Scenario4Request("idem-scenario4-readonly-write", "Dorm.QuoteDraftGenerate", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }) with { EvidenceIds = new[] { "ev-scenario4-readonly-write" } },
            OperatorActor(),
            "req-scenario4-readonly-write");

        Assert.AreEqual("quote_expired_for_reservation_preparation", expiredPrep.Error);
        Assert.AreEqual("cross_scenario_inventory_reservation_forbidden", crossScenario.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_quote_version_conflict", concurrency.Error);
        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("finance_fact_forbidden", finance.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario5_booking_preparation_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario5Workspace() },
            definitions: RegistryWith(Scenario5Definition("Dorm.BookingPreparationStart")));
        service.CreateWorkItem(Scenario5WorkItem(
            "wi-scenario5-booking-prep",
            "Dorm.BookingPreparationStart",
            Scenario5ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario5-booking-prep",
            Scenario5Request("idem-scenario5-booking-prep", "Dorm.BookingPreparationStart", new Dictionary<string, string>
            {
                ["continueReservation"] = "true"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario5-booking-prep" }
            },
            OperatorActor(),
            "req-scenario5-booking-prep");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario5_booking_preparation_blocks_quote_snapshot_contact_dates_and_guests_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario5Workspace() },
            definitions: RegistryWith(Scenario5Definition("Dorm.BookingPreparationStart")));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-quote-expired", "Dorm.BookingPreparationStart", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-no-snapshot", "Dorm.BookingPreparationStart", Scenario5ReadyPayload(new Dictionary<string, string>
        {
            ["quotePriceSnapshot"] = "",
            ["quoteSnapshotRef"] = "",
            ["priceSnapshot"] = ""
        })));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-no-contact", "Dorm.BookingPreparationStart", Scenario5ReadyPayload(new Dictionary<string, string>
        {
            ["contactPhone"] = ""
        })));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-invalid-dates", "Dorm.BookingPreparationStart", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-invalid-guests", "Dorm.BookingPreparationStart", Scenario5ReadyPayload()));

        var quoteExpired = service.ConfirmWorkItem(
            "wi-scenario5-quote-expired",
            Scenario5Request("idem-scenario5-quote-expired", "Dorm.BookingPreparationStart", new Dictionary<string, string>
            {
                ["quoteExpired"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-quote-expired" } },
            OperatorActor(),
            "req-scenario5-quote-expired");
        var noSnapshot = service.ConfirmWorkItem(
            "wi-scenario5-no-snapshot",
            Scenario5Request("idem-scenario5-no-snapshot", "Dorm.BookingPreparationStart") with { EvidenceIds = new[] { "ev-scenario5-no-snapshot" } },
            OperatorActor(),
            "req-scenario5-no-snapshot");
        var noContact = service.ConfirmWorkItem(
            "wi-scenario5-no-contact",
            Scenario5Request("idem-scenario5-no-contact", "Dorm.BookingPreparationStart") with { EvidenceIds = new[] { "ev-scenario5-no-contact" } },
            OperatorActor(),
            "req-scenario5-no-contact");
        var invalidDates = service.ConfirmWorkItem(
            "wi-scenario5-invalid-dates",
            Scenario5Request("idem-scenario5-invalid-dates", "Dorm.BookingPreparationStart", new Dictionary<string, string>
            {
                ["checkInDate"] = "2026-07-12",
                ["checkOutDate"] = "2026-07-12"
            }) with { EvidenceIds = new[] { "ev-scenario5-invalid-dates" } },
            OperatorActor(),
            "req-scenario5-invalid-dates");
        var invalidGuests = service.ConfirmWorkItem(
            "wi-scenario5-invalid-guests",
            Scenario5Request("idem-scenario5-invalid-guests", "Dorm.BookingPreparationStart", new Dictionary<string, string>
            {
                ["guestCount"] = "0"
            }) with { EvidenceIds = new[] { "ev-scenario5-invalid-guests" } },
            OperatorActor(),
            "req-scenario5-invalid-guests");

        Assert.AreEqual("quote_expired_for_booking", quoteExpired.Error);
        Assert.AreEqual("quote_price_snapshot_required", noSnapshot.Error);
        Assert.AreEqual("contact_required", noContact.Error);
        Assert.AreEqual("date_range_invalid", invalidDates.Error);
        Assert.AreEqual("guest_count_invalid", invalidGuests.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario5_availability_and_inventory_hold_block_resource_price_operation_and_lock_conflicts_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario5Workspace() },
            definitions: RegistryWith(
                Scenario5Definition("Dorm.AvailabilityRecheck"),
                Scenario5Definition("Dorm.InventoryHoldCreate")));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-no-price", "Dorm.AvailabilityRecheck", Scenario5ReadyPayload(new Dictionary<string, string>
        {
            ["priceVersionRef"] = "",
            ["priceStatus"] = ""
        })));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-operation-blocked", "Dorm.AvailabilityRecheck", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-stayed", "Dorm.AvailabilityRecheck", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-reserved", "Dorm.AvailabilityRecheck", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-locked", "Dorm.AvailabilityRecheck", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-unavailable", "Dorm.AvailabilityRecheck", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-no-hold-until", "Dorm.InventoryHoldCreate", Scenario5ReadyPayload(new Dictionary<string, string>
        {
            ["holdUntil"] = "",
            ["holdDurationOption"] = "",
            ["holdMinutes"] = ""
        })));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-concurrent-hold", "Dorm.InventoryHoldCreate", Scenario5ReadyPayload()));

        var noPrice = service.ConfirmWorkItem(
            "wi-scenario5-no-price",
            Scenario5Request("idem-scenario5-no-price", "Dorm.AvailabilityRecheck") with { EvidenceIds = new[] { "ev-scenario5-no-price" } },
            OperatorActor(),
            "req-scenario5-no-price");
        var operationBlocked = service.ConfirmWorkItem(
            "wi-scenario5-operation-blocked",
            Scenario5Request("idem-scenario5-operation-blocked", "Dorm.AvailabilityRecheck", new Dictionary<string, string>
            {
                ["operationBlocked"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-operation-blocked" } },
            OperatorActor(),
            "req-scenario5-operation-blocked");
        var stayed = service.ConfirmWorkItem(
            "wi-scenario5-stayed",
            Scenario5Request("idem-scenario5-stayed", "Dorm.AvailabilityRecheck", new Dictionary<string, string>
            {
                ["stayOccupied"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-stayed" } },
            OperatorActor(),
            "req-scenario5-stayed");
        var reserved = service.ConfirmWorkItem(
            "wi-scenario5-reserved",
            Scenario5Request("idem-scenario5-reserved", "Dorm.AvailabilityRecheck", new Dictionary<string, string>
            {
                ["reservationExists"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-reserved" } },
            OperatorActor(),
            "req-scenario5-reserved");
        var locked = service.ConfirmWorkItem(
            "wi-scenario5-locked",
            Scenario5Request("idem-scenario5-locked", "Dorm.AvailabilityRecheck", new Dictionary<string, string>
            {
                ["resourceLocked"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-locked" } },
            OperatorActor(),
            "req-scenario5-locked");
        var unavailable = service.ConfirmWorkItem(
            "wi-scenario5-unavailable",
            Scenario5Request("idem-scenario5-unavailable", "Dorm.AvailabilityRecheck", new Dictionary<string, string>
            {
                ["resourceUnavailable"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-unavailable" } },
            OperatorActor(),
            "req-scenario5-unavailable");
        var noHoldUntil = service.ConfirmWorkItem(
            "wi-scenario5-no-hold-until",
            Scenario5Request("idem-scenario5-no-hold-until", "Dorm.InventoryHoldCreate") with { EvidenceIds = new[] { "ev-scenario5-no-hold-until" } },
            OperatorActor(),
            "req-scenario5-no-hold-until");
        var concurrentHold = service.ConfirmWorkItem(
            "wi-scenario5-concurrent-hold",
            Scenario5Request("idem-scenario5-concurrent-hold", "Dorm.InventoryHoldCreate", new Dictionary<string, string>
            {
                ["concurrentHoldConflict"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-concurrent-hold" } },
            OperatorActor(),
            "req-scenario5-concurrent-hold");

        Assert.AreEqual("effective_price_required", noPrice.Error);
        Assert.AreEqual("operation_blocked_for_booking", operationBlocked.Error);
        Assert.AreEqual("resource_already_stayed", stayed.Error);
        Assert.AreEqual("resource_already_reserved", reserved.Error);
        Assert.AreEqual("resource_already_locked", locked.Error);
        Assert.AreEqual("resource_unavailable_or_occupied", unavailable.Error);
        Assert.AreEqual("hold_until_required", noHoldUntil.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrentHold.StatusCode);
        Assert.AreEqual("concurrent_inventory_hold_conflict", concurrentHold.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario5_reservation_confirmation_blocks_hold_snapshot_reservation_number_refs_and_cross_scenario_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario5Workspace() },
            definitions: RegistryWith(
                Scenario5Definition("Dorm.ReservationDraftConfirm"),
                Scenario5Definition("Dorm.ReservationConfirm")));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-missing-hold", "Dorm.ReservationDraftConfirm", Scenario5ReadyPayload(new Dictionary<string, string>
        {
            ["inventoryHoldActive"] = "false",
            ["inventoryHoldSummary"] = "",
            ["holdStatus"] = ""
        })));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-expired-hold", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-snapshot-mismatch", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-user-reservation-no", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-forged-ref", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-finance", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-checkin", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-readonly", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-duplicate", "Dorm.ReservationConfirm", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-concurrency", "Dorm.ReservationConfirm", Scenario5ReadyPayload(new Dictionary<string, string>
        {
            ["currentReservationVersion"] = "2"
        })));

        var missingHold = service.ConfirmWorkItem(
            "wi-scenario5-missing-hold",
            Scenario5Request("idem-scenario5-missing-hold", "Dorm.ReservationDraftConfirm") with { EvidenceIds = new[] { "ev-scenario5-missing-hold" } },
            OperatorActor(),
            "req-scenario5-missing-hold");
        var expiredHold = service.ConfirmWorkItem(
            "wi-scenario5-expired-hold",
            Scenario5Request("idem-scenario5-expired-hold", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["holdExpired"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-expired-hold" } },
            OperatorActor(),
            "req-scenario5-expired-hold");
        var snapshotMismatch = service.ConfirmWorkItem(
            "wi-scenario5-snapshot-mismatch",
            Scenario5Request("idem-scenario5-snapshot-mismatch", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["snapshotMismatch"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-snapshot-mismatch" } },
            OperatorActor(),
            "req-scenario5-snapshot-mismatch");
        var reservationNo = service.ConfirmWorkItem(
            "wi-scenario5-user-reservation-no",
            Scenario5Request("idem-scenario5-user-reservation-no", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["reservationNo"] = "R-MANUAL"
            }) with { EvidenceIds = new[] { "ev-scenario5-user-reservation-no" } },
            OperatorActor(),
            "req-scenario5-user-reservation-no");
        var forged = service.ConfirmWorkItem(
            "wi-scenario5-forged-ref",
            Scenario5Request("idem-scenario5-forged-ref", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["roomId"] = "forged-room"
            }) with { EvidenceIds = new[] { "ev-scenario5-forged-ref" } },
            OperatorActor(),
            "req-scenario5-forged-ref");
        var finance = service.ConfirmWorkItem(
            "wi-scenario5-finance",
            Scenario5Request("idem-scenario5-finance", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["paymentIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-finance" } },
            OperatorActor(),
            "req-scenario5-finance");
        var checkIn = service.ConfirmWorkItem(
            "wi-scenario5-checkin",
            Scenario5Request("idem-scenario5-checkin", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["checkInIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-checkin" } },
            OperatorActor(),
            "req-scenario5-checkin");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario5-readonly",
            Scenario5Request("idem-scenario5-readonly", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }) with { EvidenceIds = new[] { "ev-scenario5-readonly" } },
            OperatorActor(),
            "req-scenario5-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario5-duplicate",
            Scenario5Request("idem-scenario5-duplicate", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario5-duplicate" } },
            OperatorActor(),
            "req-scenario5-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario5-concurrency",
            Scenario5Request("idem-scenario5-concurrency", "Dorm.ReservationConfirm", new Dictionary<string, string>
            {
                ["expectedReservationVersion"] = "1"
            }) with { EvidenceIds = new[] { "ev-scenario5-concurrency" } },
            OperatorActor(),
            "req-scenario5-concurrency");

        Assert.AreEqual("inventory_hold_required", missingHold.Error);
        Assert.AreEqual("hold_expired_for_reservation", expiredHold.Error);
        Assert.AreEqual("price_snapshot_mismatch", snapshotMismatch.Error);
        Assert.AreEqual("reservation_no_user_input_forbidden", reservationNo.Error);
        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("finance_fact_forbidden", finance.Error);
        Assert.AreEqual("cross_scenario_checkin_payment_forbidden", checkIn.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_reservation_version_conflict", concurrency.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario5_hold_release_expire_and_summary_commands_require_generated_evidence_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario5Workspace() },
            definitions: RegistryWith(
                Scenario5Definition("Dorm.InventoryHoldRelease"),
                Scenario5Definition("Dorm.InventoryHoldExpire"),
                Scenario5Definition("Dorm.ReservationSummaryOutput")));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-hold-release", "Dorm.InventoryHoldRelease", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-hold-expire", "Dorm.InventoryHoldExpire", Scenario5ReadyPayload()));
        service.CreateWorkItem(Scenario5WorkItem("wi-scenario5-summary-output", "Dorm.ReservationSummaryOutput", Scenario5ReadyPayload()));

        var release = service.ConfirmWorkItem(
            "wi-scenario5-hold-release",
            Scenario5Request("idem-scenario5-hold-release", "Dorm.InventoryHoldRelease"),
            OperatorActor(),
            "req-scenario5-hold-release");
        var expire = service.ConfirmWorkItem(
            "wi-scenario5-hold-expire",
            Scenario5Request("idem-scenario5-hold-expire", "Dorm.InventoryHoldExpire"),
            OperatorActor(),
            "req-scenario5-hold-expire");
        var summary = service.ConfirmWorkItem(
            "wi-scenario5-summary-output",
            Scenario5Request("idem-scenario5-summary-output", "Dorm.ReservationSummaryOutput"),
            OperatorActor(),
            "req-scenario5-summary-output");

        Assert.AreEqual("reservation_evidence_missing", release.Error);
        Assert.AreEqual("reservation_evidence_missing", expire.Error);
        Assert.AreEqual("reservation_evidence_missing", summary.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario6_payment_case_start_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario6Workspace() },
            definitions: RegistryWith(Scenario6Definition("Dorm.PaymentDepositCaseStart")));
        service.CreateWorkItem(Scenario6WorkItem(
            "wi-scenario6-payment-case-start",
            "Dorm.PaymentDepositCaseStart",
            Scenario6ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario6-payment-case-start",
            Scenario6Request("idem-scenario6-payment-case-start", "Dorm.PaymentDepositCaseStart", new Dictionary<string, string>
            {
                ["startPaymentDepositProcessing"] = "true"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario6-payment-case-start" }
            },
            OperatorActor(),
            "req-scenario6-payment-case-start");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario6_supporting_commands_use_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario6Workspace() },
            definitions: RegistryWith(
                Scenario6Definition("Dorm.PaymentDepositRequirementConfirm"),
                Scenario6Definition("Dorm.FinanceReviewRequest"),
                Scenario6Definition("Dorm.FinanceGateReturn"),
                Scenario6Definition("Dorm.FinanceEvidenceSupplement"),
                Scenario6Definition("Dorm.FinanceReadySummaryOutput")));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-requirement-confirm", "Dorm.PaymentDepositRequirementConfirm", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-review-request", "Dorm.FinanceReviewRequest", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-gate-return", "Dorm.FinanceGateReturn", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-evidence-supplement", "Dorm.FinanceEvidenceSupplement", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-ready-summary", "Dorm.FinanceReadySummaryOutput", Scenario6ReadyPayload()));

        var requirement = service.ConfirmWorkItem(
            "wi-scenario6-requirement-confirm",
            Scenario6Request("idem-scenario6-requirement-confirm", "Dorm.PaymentDepositRequirementConfirm"),
            OperatorActor(),
            "req-scenario6-requirement-confirm");
        var review = service.ConfirmWorkItem(
            "wi-scenario6-review-request",
            Scenario6Request("idem-scenario6-review-request", "Dorm.FinanceReviewRequest", new Dictionary<string, string>
            {
                ["viaFinanceGate"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-review-request" } },
            OperatorActor(),
            "req-scenario6-review-request");
        var returned = service.ConfirmWorkItem(
            "wi-scenario6-gate-return",
            Scenario6Request("idem-scenario6-gate-return", "Dorm.FinanceGateReturn", new Dictionary<string, string>
            {
                ["viaFinanceGate"] = "true",
                ["actorRole"] = "finance"
            }),
            OperatorActor(),
            "req-scenario6-gate-return");
        var supplement = service.ConfirmWorkItem(
            "wi-scenario6-evidence-supplement",
            Scenario6Request("idem-scenario6-evidence-supplement", "Dorm.FinanceEvidenceSupplement") with
            {
                EvidenceIds = new[] { "ev-scenario6-evidence-supplement" }
            },
            OperatorActor(),
            "req-scenario6-evidence-supplement");
        var summary = service.ConfirmWorkItem(
            "wi-scenario6-ready-summary",
            Scenario6Request("idem-scenario6-ready-summary", "Dorm.FinanceReadySummaryOutput"),
            OperatorActor(),
            "req-scenario6-ready-summary");

        Assert.AreEqual(StatusCodes.Status200OK, requirement.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, review.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, returned.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, supplement.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, summary.StatusCode);
        Assert.HasCount(5, store.Submissions);
        Assert.HasCount(5, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario6_payment_deposit_and_guarantee_blocks_invalid_business_inputs_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario6Workspace() },
            definitions: RegistryWith(
                Scenario6Definition("Dorm.PaymentDepositCaseStart"),
                Scenario6Definition("Dorm.PaymentReceiptSubmit"),
                Scenario6Definition("Dorm.DepositGuaranteeSubmit")));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-not-confirmed", "Dorm.PaymentDepositCaseStart", Scenario6ReadyPayload(new Dictionary<string, string>
        {
            ["reservationConfirmed"] = "false",
            ["reservationStatus"] = "待确认"
        })));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-cancelled", "Dorm.PaymentDepositCaseStart", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-no-price", "Dorm.PaymentDepositCaseStart", Scenario6ReadyPayload(new Dictionary<string, string>
        {
            ["priceSnapshot"] = "",
            ["priceSnapshotRef"] = "",
            ["reservationPriceSnapshot"] = "",
            ["quotePriceSnapshot"] = ""
        })));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-invalid-source", "Dorm.PaymentDepositCaseStart", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-no-evidence", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-bad-amount", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload(new Dictionary<string, string>
        {
            ["receivedAmount"] = "0",
            ["depositAmount"] = "0",
            ["amount"] = "0"
        })));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-currency", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-deposit-income", "Dorm.DepositGuaranteeSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-guarantee-payment", "Dorm.DepositGuaranteeSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-guarantee-validity", "Dorm.DepositGuaranteeSubmit", Scenario6ReadyPayload(new Dictionary<string, string>
        {
            ["depositOption"] = "担保",
            ["guaranteeRequired"] = "true",
            ["guaranteeValidUntil"] = "",
            ["preAuthorizationValidUntil"] = ""
        })));

        var notConfirmed = service.ConfirmWorkItem(
            "wi-scenario6-not-confirmed",
            Scenario6Request("idem-scenario6-not-confirmed", "Dorm.PaymentDepositCaseStart") with { EvidenceIds = new[] { "ev-scenario6-not-confirmed" } },
            OperatorActor(),
            "req-scenario6-not-confirmed");
        var cancelled = service.ConfirmWorkItem(
            "wi-scenario6-cancelled",
            Scenario6Request("idem-scenario6-cancelled", "Dorm.PaymentDepositCaseStart", new Dictionary<string, string>
            {
                ["reservationCancelled"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-cancelled" } },
            OperatorActor(),
            "req-scenario6-cancelled");
        var noPrice = service.ConfirmWorkItem(
            "wi-scenario6-no-price",
            Scenario6Request("idem-scenario6-no-price", "Dorm.PaymentDepositCaseStart") with { EvidenceIds = new[] { "ev-scenario6-no-price" } },
            OperatorActor(),
            "req-scenario6-no-price");
        var invalidSource = service.ConfirmWorkItem(
            "wi-scenario6-invalid-source",
            Scenario6Request("idem-scenario6-invalid-source", "Dorm.PaymentDepositCaseStart", new Dictionary<string, string>
            {
                ["amountSource"] = "manualFinal"
            }) with { EvidenceIds = new[] { "ev-scenario6-invalid-source" } },
            OperatorActor(),
            "req-scenario6-invalid-source");
        var noEvidence = service.ConfirmWorkItem(
            "wi-scenario6-no-evidence",
            Scenario6Request("idem-scenario6-no-evidence", "Dorm.PaymentReceiptSubmit"),
            OperatorActor(),
            "req-scenario6-no-evidence");
        var badAmount = service.ConfirmWorkItem(
            "wi-scenario6-bad-amount",
            Scenario6Request("idem-scenario6-bad-amount", "Dorm.PaymentReceiptSubmit") with { EvidenceIds = new[] { "ev-scenario6-bad-amount" } },
            OperatorActor(),
            "req-scenario6-bad-amount");
        var currency = service.ConfirmWorkItem(
            "wi-scenario6-currency",
            Scenario6Request("idem-scenario6-currency", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["currency"] = "USD",
                ["expectedCurrency"] = "CNY"
            }) with { EvidenceIds = new[] { "ev-scenario6-currency" } },
            OperatorActor(),
            "req-scenario6-currency");
        var depositIncome = service.ConfirmWorkItem(
            "wi-scenario6-deposit-income",
            Scenario6Request("idem-scenario6-deposit-income", "Dorm.DepositGuaranteeSubmit", new Dictionary<string, string>
            {
                ["depositAccountingCategory"] = "收入"
            }) with { EvidenceIds = new[] { "ev-scenario6-deposit-income" } },
            OperatorActor(),
            "req-scenario6-deposit-income");
        var guaranteePayment = service.ConfirmWorkItem(
            "wi-scenario6-guarantee-payment",
            Scenario6Request("idem-scenario6-guarantee-payment", "Dorm.DepositGuaranteeSubmit", new Dictionary<string, string>
            {
                ["guaranteeAsPayment"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-guarantee-payment" } },
            OperatorActor(),
            "req-scenario6-guarantee-payment");
        var guaranteeValidity = service.ConfirmWorkItem(
            "wi-scenario6-guarantee-validity",
            Scenario6Request("idem-scenario6-guarantee-validity", "Dorm.DepositGuaranteeSubmit") with { EvidenceIds = new[] { "ev-scenario6-guarantee-validity" } },
            OperatorActor(),
            "req-scenario6-guarantee-validity");

        Assert.AreEqual("reservation_not_confirmed", notConfirmed.Error);
        Assert.AreEqual("reservation_cancelled", cancelled.Error);
        Assert.AreEqual("price_snapshot_required", noPrice.Error);
        Assert.AreEqual("payment_requirement_source_invalid", invalidSource.Error);
        Assert.AreEqual("receipt_evidence_required", noEvidence.Error);
        Assert.AreEqual("amount_must_be_positive", badAmount.Error);
        Assert.AreEqual("currency_mismatch", currency.Error);
        Assert.AreEqual("deposit_marked_as_income_forbidden", depositIncome.Error);
        Assert.AreEqual("guarantee_marked_as_payment_forbidden", guaranteePayment.Error);
        Assert.AreEqual("guarantee_validity_required", guaranteeValidity.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario6_finance_gate_internal_refs_and_cross_scenario_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario6Workspace() },
            definitions: RegistryWith(
                Scenario6Definition("Dorm.PaymentReceiptSubmit"),
                Scenario6Definition("Dorm.FinanceGateConfirm")));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-forged-ref", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-ledger", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-readonly", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-post-submission-edit", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-duplicate", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-concurrency", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload(new Dictionary<string, string>
        {
            ["currentFinanceVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-checkin", "Dorm.PaymentReceiptSubmit", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-gate-route", "Dorm.FinanceGateConfirm", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-gate-role", "Dorm.FinanceGateConfirm", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-gate-evidence", "Dorm.FinanceGateConfirm", Scenario6ReadyPayload()));
        service.CreateWorkItem(Scenario6WorkItem("wi-scenario6-confirmed-edit", "Dorm.FinanceGateConfirm", Scenario6ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario6-forged-ref",
            Scenario6Request("idem-scenario6-forged-ref", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["paymentId"] = "pay-forged",
                ["reservationId"] = "res-forged",
                ["depositId"] = "dep-forged",
                ["ledgerEntryId"] = "ledger-forged"
            }) with { EvidenceIds = new[] { "ev-scenario6-forged-ref" } },
            OperatorActor(),
            "req-scenario6-forged-ref");
        var ledger = service.ConfirmWorkItem(
            "wi-scenario6-ledger",
            Scenario6Request("idem-scenario6-ledger", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["directLedgerWrite"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-ledger" } },
            OperatorActor(),
            "req-scenario6-ledger");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario6-readonly",
            Scenario6Request("idem-scenario6-readonly", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }) with { EvidenceIds = new[] { "ev-scenario6-readonly" } },
            OperatorActor(),
            "req-scenario6-readonly");
        var postSubmissionEdit = service.ConfirmWorkItem(
            "wi-scenario6-post-submission-edit",
            Scenario6Request("idem-scenario6-post-submission-edit", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["financeStatus"] = "待财务确认",
                ["inlineEditAttempt"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-post-submission-edit" } },
            OperatorActor(),
            "req-scenario6-post-submission-edit");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario6-duplicate",
            Scenario6Request("idem-scenario6-duplicate", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-duplicate" } },
            OperatorActor(),
            "req-scenario6-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario6-concurrency",
            Scenario6Request("idem-scenario6-concurrency", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["expectedFinanceVersion"] = "1"
            }) with { EvidenceIds = new[] { "ev-scenario6-concurrency" } },
            OperatorActor(),
            "req-scenario6-concurrency");
        var checkIn = service.ConfirmWorkItem(
            "wi-scenario6-checkin",
            Scenario6Request("idem-scenario6-checkin", "Dorm.PaymentReceiptSubmit", new Dictionary<string, string>
            {
                ["checkInIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-checkin" } },
            OperatorActor(),
            "req-scenario6-checkin");
        var gateRoute = service.ConfirmWorkItem(
            "wi-scenario6-gate-route",
            Scenario6Request("idem-scenario6-gate-route", "Dorm.FinanceGateConfirm") with { EvidenceIds = new[] { "ev-scenario6-gate-route" } },
            OperatorActor(),
            "req-scenario6-gate-route");
        var gateRole = service.ConfirmWorkItem(
            "wi-scenario6-gate-role",
            Scenario6Request("idem-scenario6-gate-role", "Dorm.FinanceGateConfirm", new Dictionary<string, string>
            {
                ["viaFinanceGate"] = "true",
                ["actorRole"] = "operator"
            }) with { EvidenceIds = new[] { "ev-scenario6-gate-role" } },
            OperatorActor(),
            "req-scenario6-gate-role");
        var gateEvidence = service.ConfirmWorkItem(
            "wi-scenario6-gate-evidence",
            Scenario6Request("idem-scenario6-gate-evidence", "Dorm.FinanceGateConfirm", new Dictionary<string, string>
            {
                ["viaFinanceGate"] = "true",
                ["actorRole"] = "finance"
            }),
            OperatorActor(),
            "req-scenario6-gate-evidence");
        var confirmedEdit = service.ConfirmWorkItem(
            "wi-scenario6-confirmed-edit",
            Scenario6Request("idem-scenario6-confirmed-edit", "Dorm.FinanceGateConfirm", new Dictionary<string, string>
            {
                ["viaFinanceGate"] = "true",
                ["actorRole"] = "finance",
                ["financeStatus"] = "财务已确认",
                ["inlineEditAttempt"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario6-confirmed-edit" } },
            OperatorActor(),
            "req-scenario6-confirmed-edit");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("ledger_write_forbidden", ledger.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual("post_submission_inline_edit_forbidden", postSubmissionEdit.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_finance_version_conflict", concurrency.Error);
        Assert.AreEqual("cross_scenario_checkin_forbidden", checkIn.Error);
        Assert.AreEqual("finance_gate_required", gateRoute.Error);
        Assert.AreEqual("unauthorized_finance_confirmation", gateRole.Error);
        Assert.AreEqual("finance_evidence_missing", gateEvidence.Error);
        Assert.AreEqual("confirmed_finance_inline_edit_forbidden", confirmedEdit.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario7_checkin_draft_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario7Workspace() },
            definitions: RegistryWith(Scenario7Definition("Dorm.CheckInDraftStart")));
        service.CreateWorkItem(Scenario7WorkItem(
            "wi-scenario7-checkin-draft",
            "Dorm.CheckInDraftStart",
            Scenario7ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario7-checkin-draft",
            Scenario7Request("idem-scenario7-checkin-draft", "Dorm.CheckInDraftStart", new Dictionary<string, string>
            {
                ["startCheckInProcessing"] = "true"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario7-checkin-draft" }
            },
            OperatorActor(),
            "req-scenario7-checkin-draft");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario7_supporting_commands_use_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario7Workspace() },
            definitions: RegistryWith(
                Scenario7Definition("Dorm.GuestIdentityVerify"),
                Scenario7Definition("Dorm.CheckInAgreementFinanceReview"),
                Scenario7Definition("Dorm.RoomBedHandoverRecheck"),
                Scenario7Definition("Dorm.StayConfirm"),
                Scenario7Definition("Dorm.StayCredentialIssue"),
                Scenario7Definition("Dorm.CheckInManualReviewRequest"),
                Scenario7Definition("Dorm.CheckInCorrectionRequest")));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-identity", "Dorm.GuestIdentityVerify", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-agreement", "Dorm.CheckInAgreementFinanceReview", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-handover", "Dorm.RoomBedHandoverRecheck", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-stay-confirm", "Dorm.StayConfirm", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-credential", "Dorm.StayCredentialIssue", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["stayConfirmed"] = "true",
            ["stayStatus"] = "已入住"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-manual-review", "Dorm.CheckInManualReviewRequest", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-correction", "Dorm.CheckInCorrectionRequest", Scenario7ReadyPayload()));

        var identity = service.ConfirmWorkItem(
            "wi-scenario7-identity",
            Scenario7Request("idem-scenario7-identity", "Dorm.GuestIdentityVerify") with { EvidenceIds = new[] { "ev-scenario7-identity" } },
            OperatorActor(),
            "req-scenario7-identity");
        var agreement = service.ConfirmWorkItem(
            "wi-scenario7-agreement",
            Scenario7Request("idem-scenario7-agreement", "Dorm.CheckInAgreementFinanceReview") with { EvidenceIds = new[] { "ev-scenario7-agreement" } },
            OperatorActor(),
            "req-scenario7-agreement");
        var handover = service.ConfirmWorkItem(
            "wi-scenario7-handover",
            Scenario7Request("idem-scenario7-handover", "Dorm.RoomBedHandoverRecheck") with { EvidenceIds = new[] { "ev-scenario7-handover" } },
            OperatorActor(),
            "req-scenario7-handover");
        var stay = service.ConfirmWorkItem(
            "wi-scenario7-stay-confirm",
            Scenario7Request("idem-scenario7-stay-confirm", "Dorm.StayConfirm") with { EvidenceIds = new[] { "ev-scenario7-stay-confirm" } },
            OperatorActor(),
            "req-scenario7-stay-confirm");
        var credential = service.ConfirmWorkItem(
            "wi-scenario7-credential",
            Scenario7Request("idem-scenario7-credential", "Dorm.StayCredentialIssue") with { EvidenceIds = new[] { "ev-scenario7-credential" } },
            OperatorActor(),
            "req-scenario7-credential");
        var manualReview = service.ConfirmWorkItem(
            "wi-scenario7-manual-review",
            Scenario7Request("idem-scenario7-manual-review", "Dorm.CheckInManualReviewRequest") with { EvidenceIds = new[] { "ev-scenario7-manual-review" } },
            OperatorActor(),
            "req-scenario7-manual-review");
        var correction = service.ConfirmWorkItem(
            "wi-scenario7-correction",
            Scenario7Request("idem-scenario7-correction", "Dorm.CheckInCorrectionRequest") with { EvidenceIds = new[] { "ev-scenario7-correction" } },
            OperatorActor(),
            "req-scenario7-correction");

        Assert.AreEqual(StatusCodes.Status200OK, identity.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, agreement.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, handover.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, stay.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, credential.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, manualReview.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, correction.StatusCode);
        Assert.HasCount(7, store.Submissions);
        Assert.HasCount(7, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario7_checkin_blocks_business_rule_failures_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario7Workspace() },
            definitions: RegistryWith(
                Scenario7Definition("Dorm.CheckInDraftStart"),
                Scenario7Definition("Dorm.GuestIdentityVerify"),
                Scenario7Definition("Dorm.CheckInAgreementFinanceReview"),
                Scenario7Definition("Dorm.RoomBedHandoverRecheck")));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-invalid-reservation", "Dorm.CheckInDraftStart", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["reservationConfirmed"] = "false",
            ["reservationStatus"] = "待确认"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-cancelled", "Dorm.CheckInDraftStart", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-expired", "Dorm.CheckInDraftStart", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-converted", "Dorm.CheckInDraftStart", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-finance-unmet", "Dorm.CheckInAgreementFinanceReview", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["financeReady"] = "false",
            ["financeStatus"] = "待财务补齐"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-manager-exception", "Dorm.CheckInAgreementFinanceReview", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["financeReady"] = "false",
            ["financeStatus"] = "待财务补齐",
            ["managerExceptionApproval"] = "true",
            ["authorizedManager"] = "false",
            ["managerExceptionEvidenceBound"] = "false"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-identity-evidence", "Dorm.GuestIdentityVerify", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["identityEvidenceBound"] = "false"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-identity-failed", "Dorm.GuestIdentityVerify", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-guest-mismatch", "Dorm.GuestIdentityVerify", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-agreement", "Dorm.CheckInAgreementFinanceReview", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["agreementConfirmed"] = "false",
            ["agreementStatus"] = "未确认"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-resource-unavailable", "Dorm.RoomBedHandoverRecheck", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["resourceAvailableForCheckIn"] = "false",
            ["resourceAvailability"] = "不可入住"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-resource-occupied", "Dorm.RoomBedHandoverRecheck", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-resource-blocked", "Dorm.RoomBedHandoverRecheck", Scenario7ReadyPayload()));

        var invalidReservation = service.ConfirmWorkItem(
            "wi-scenario7-invalid-reservation",
            Scenario7Request("idem-scenario7-invalid-reservation", "Dorm.CheckInDraftStart") with { EvidenceIds = new[] { "ev-scenario7-invalid-reservation" } },
            OperatorActor(),
            "req-scenario7-invalid-reservation");
        var cancelled = service.ConfirmWorkItem(
            "wi-scenario7-cancelled",
            Scenario7Request("idem-scenario7-cancelled", "Dorm.CheckInDraftStart", new Dictionary<string, string>
            {
                ["reservationCancelled"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-cancelled" } },
            OperatorActor(),
            "req-scenario7-cancelled");
        var expired = service.ConfirmWorkItem(
            "wi-scenario7-expired",
            Scenario7Request("idem-scenario7-expired", "Dorm.CheckInDraftStart", new Dictionary<string, string>
            {
                ["reservationExpired"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-expired" } },
            OperatorActor(),
            "req-scenario7-expired");
        var converted = service.ConfirmWorkItem(
            "wi-scenario7-converted",
            Scenario7Request("idem-scenario7-converted", "Dorm.CheckInDraftStart", new Dictionary<string, string>
            {
                ["reservationAlreadyConverted"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-converted" } },
            OperatorActor(),
            "req-scenario7-converted");
        var finance = service.ConfirmWorkItem(
            "wi-scenario7-finance-unmet",
            Scenario7Request("idem-scenario7-finance-unmet", "Dorm.CheckInAgreementFinanceReview") with { EvidenceIds = new[] { "ev-scenario7-finance-unmet" } },
            OperatorActor(),
            "req-scenario7-finance-unmet");
        var managerException = service.ConfirmWorkItem(
            "wi-scenario7-manager-exception",
            Scenario7Request("idem-scenario7-manager-exception", "Dorm.CheckInAgreementFinanceReview") with { EvidenceIds = Array.Empty<string>() },
            OperatorActor(),
            "req-scenario7-manager-exception");
        var identityEvidence = service.ConfirmWorkItem(
            "wi-scenario7-identity-evidence",
            Scenario7Request("idem-scenario7-identity-evidence", "Dorm.GuestIdentityVerify"),
            OperatorActor(),
            "req-scenario7-identity-evidence");
        var identityFailed = service.ConfirmWorkItem(
            "wi-scenario7-identity-failed",
            Scenario7Request("idem-scenario7-identity-failed", "Dorm.GuestIdentityVerify", new Dictionary<string, string>
            {
                ["identityVerificationResult"] = "失败"
            }) with { EvidenceIds = new[] { "ev-scenario7-identity-failed" } },
            OperatorActor(),
            "req-scenario7-identity-failed");
        var guestMismatch = service.ConfirmWorkItem(
            "wi-scenario7-guest-mismatch",
            Scenario7Request("idem-scenario7-guest-mismatch", "Dorm.GuestIdentityVerify", new Dictionary<string, string>
            {
                ["guestMismatch"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-guest-mismatch" } },
            OperatorActor(),
            "req-scenario7-guest-mismatch");
        var agreement = service.ConfirmWorkItem(
            "wi-scenario7-agreement",
            Scenario7Request("idem-scenario7-agreement-block", "Dorm.CheckInAgreementFinanceReview") with { EvidenceIds = new[] { "ev-scenario7-agreement-block" } },
            OperatorActor(),
            "req-scenario7-agreement-block");
        var resourceUnavailable = service.ConfirmWorkItem(
            "wi-scenario7-resource-unavailable",
            Scenario7Request("idem-scenario7-resource-unavailable", "Dorm.RoomBedHandoverRecheck") with { EvidenceIds = new[] { "ev-scenario7-resource-unavailable" } },
            OperatorActor(),
            "req-scenario7-resource-unavailable");
        var resourceOccupied = service.ConfirmWorkItem(
            "wi-scenario7-resource-occupied",
            Scenario7Request("idem-scenario7-resource-occupied", "Dorm.RoomBedHandoverRecheck", new Dictionary<string, string>
            {
                ["resourceOccupied"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-resource-occupied" } },
            OperatorActor(),
            "req-scenario7-resource-occupied");
        var resourceBlocked = service.ConfirmWorkItem(
            "wi-scenario7-resource-blocked",
            Scenario7Request("idem-scenario7-resource-blocked", "Dorm.RoomBedHandoverRecheck", new Dictionary<string, string>
            {
                ["resourceBlocked"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-resource-blocked" } },
            OperatorActor(),
            "req-scenario7-resource-blocked");

        Assert.AreEqual("reservation_not_valid", invalidReservation.Error);
        Assert.AreEqual("reservation_cancelled", cancelled.Error);
        Assert.AreEqual("reservation_expired", expired.Error);
        Assert.AreEqual("reservation_already_converted", converted.Error);
        Assert.AreEqual("finance_rule_unmet_without_exception", finance.Error);
        Assert.AreEqual("manager_exception_approval_required", managerException.Error);
        Assert.AreEqual("identity_evidence_required", identityEvidence.Error);
        Assert.AreEqual("identity_verification_failed", identityFailed.Error);
        Assert.AreEqual("guest_mismatch_without_approval", guestMismatch.Error);
        Assert.AreEqual("agreement_not_confirmed", agreement.Error);
        Assert.AreEqual("resource_not_available_for_checkin", resourceUnavailable.Error);
        Assert.AreEqual("resource_already_occupied", resourceOccupied.Error);
        Assert.AreEqual("resource_blocked_for_checkin", resourceBlocked.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario7_internal_refs_search_duplicate_concurrency_and_cross_scenario_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario7Workspace() },
            definitions: RegistryWith(
                Scenario7Definition("Dorm.StayConfirm"),
                Scenario7Definition("Dorm.StayCredentialIssue")));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-forged-ref", "Dorm.StayConfirm", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-stay-no", "Dorm.StayConfirm", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-readonly", "Dorm.StayConfirm", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-duplicate", "Dorm.StayConfirm", Scenario7ReadyPayload()));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-concurrency", "Dorm.StayConfirm", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["currentOccupancyVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-credential-before-stay", "Dorm.StayCredentialIssue", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["stayConfirmed"] = "false",
            ["stayStatus"] = "待入住"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-inline-edit", "Dorm.StayConfirm", Scenario7ReadyPayload(new Dictionary<string, string>
        {
            ["stayConfirmed"] = "true",
            ["stayStatus"] = "已入住"
        })));
        service.CreateWorkItem(Scenario7WorkItem("wi-scenario7-cross-scenario", "Dorm.StayConfirm", Scenario7ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario7-forged-ref",
            Scenario7Request("idem-scenario7-forged-ref", "Dorm.StayConfirm", new Dictionary<string, string>
            {
                ["stayId"] = "stay-forged",
                ["residentId"] = "resident-forged",
                ["reservationId"] = "reservation-forged",
                ["credentialId"] = "credential-forged",
                ["roomId"] = "room-forged",
                ["bedId"] = "bed-forged"
            }) with { EvidenceIds = new[] { "ev-scenario7-forged-ref" } },
            OperatorActor(),
            "req-scenario7-forged-ref");
        var stayNo = service.ConfirmWorkItem(
            "wi-scenario7-stay-no",
            Scenario7Request("idem-scenario7-stay-no", "Dorm.StayConfirm", new Dictionary<string, string>
            {
                ["stayNo"] = "S-MANUAL"
            }) with { EvidenceIds = new[] { "ev-scenario7-stay-no" } },
            OperatorActor(),
            "req-scenario7-stay-no");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario7-readonly",
            Scenario7Request("idem-scenario7-readonly", "Dorm.StayConfirm", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }) with { EvidenceIds = new[] { "ev-scenario7-readonly" } },
            OperatorActor(),
            "req-scenario7-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario7-duplicate",
            Scenario7Request("idem-scenario7-duplicate", "Dorm.StayConfirm", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-duplicate" } },
            OperatorActor(),
            "req-scenario7-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario7-concurrency",
            Scenario7Request("idem-scenario7-concurrency", "Dorm.StayConfirm", new Dictionary<string, string>
            {
                ["expectedOccupancyVersion"] = "1"
            }) with { EvidenceIds = new[] { "ev-scenario7-concurrency" } },
            OperatorActor(),
            "req-scenario7-concurrency");
        var credentialBeforeStay = service.ConfirmWorkItem(
            "wi-scenario7-credential-before-stay",
            Scenario7Request("idem-scenario7-credential-before-stay", "Dorm.StayCredentialIssue") with { EvidenceIds = new[] { "ev-scenario7-credential-before-stay" } },
            OperatorActor(),
            "req-scenario7-credential-before-stay");
        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario7-inline-edit",
            Scenario7Request("idem-scenario7-inline-edit", "Dorm.StayConfirm", new Dictionary<string, string>
            {
                ["inlineEditAttempt"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-inline-edit" } },
            OperatorActor(),
            "req-scenario7-inline-edit");
        var crossScenario = service.ConfirmWorkItem(
            "wi-scenario7-cross-scenario",
            Scenario7Request("idem-scenario7-cross-scenario", "Dorm.StayConfirm", new Dictionary<string, string>
            {
                ["checkoutIntent"] = "true",
                ["refundIntent"] = "true",
                ["directLedgerWrite"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario7-cross-scenario" } },
            OperatorActor(),
            "req-scenario7-cross-scenario");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("stay_no_user_input_forbidden", stayNo.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_checkin", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_occupancy_conflict", concurrency.Error);
        Assert.AreEqual("credential_before_checkin_forbidden", credentialBeforeStay.Error);
        Assert.AreEqual("confirmed_checkin_inline_edit_forbidden", inlineEdit.Error);
        Assert.AreEqual("cross_scenario_checkout_refund_forbidden", crossScenario.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario8_status_change_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario8Workspace() },
            definitions: RegistryWith(Scenario8Definition("Dorm.StayStatusChange")));
        service.CreateWorkItem(Scenario8WorkItem(
            "wi-scenario8-status-change",
            "Dorm.StayStatusChange",
            Scenario8ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario8-status-change",
            Scenario8Request("idem-scenario8-status-change", "Dorm.StayStatusChange", new Dictionary<string, string>
            {
                ["newStatus"] = "待跟进",
                ["statusNote"] = "住客申请晚间跟进"
            }) with
            {
                EvidenceIds = new[] { "ev-scenario8-status-change" }
            },
            OperatorActor(),
            "req-scenario8-status-change");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario8_supporting_commands_use_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario8Workspace() },
            definitions: RegistryWith(
                Scenario8Definition("Dorm.StayManagementContextView"),
                Scenario8Definition("Dorm.StayStatusChange"),
                Scenario8Definition("Dorm.ResidentServiceRequestRegister"),
                Scenario8Definition("Dorm.ResidentServiceProgressUpdate"),
                Scenario8Definition("Dorm.ResidentIncidentRegister"),
                Scenario8Definition("Dorm.ResidentIncidentClose"),
                Scenario8Definition("Dorm.StayExtensionRequestSubmit"),
                Scenario8Definition("Dorm.BedTransferRequestSubmit"),
                Scenario8Definition("Dorm.AccessCredentialStatusChange"),
                Scenario8Definition("Dorm.CheckoutPreparationSnapshotCreate"),
                Scenario8Definition("Dorm.StayManagementCorrectionRequest")));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-context", "Dorm.StayManagementContextView", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-service", "Dorm.ResidentServiceRequestRegister", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-service-progress", "Dorm.ResidentServiceProgressUpdate", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-incident", "Dorm.ResidentIncidentRegister", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-incident-close", "Dorm.ResidentIncidentClose", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-extension", "Dorm.StayExtensionRequestSubmit", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-transfer", "Dorm.BedTransferRequestSubmit", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-credential", "Dorm.AccessCredentialStatusChange", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-checkout-prep", "Dorm.CheckoutPreparationSnapshotCreate", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-correction", "Dorm.StayManagementCorrectionRequest", Scenario8ReadyPayload()));

        var context = service.ConfirmWorkItem(
            "wi-scenario8-context",
            Scenario8Request("idem-scenario8-context", "Dorm.StayManagementContextView") with { EvidenceIds = new[] { "ev-scenario8-context" } },
            OperatorActor(),
            "req-scenario8-context");
        var serviceRequest = service.ConfirmWorkItem(
            "wi-scenario8-service",
            Scenario8Request("idem-scenario8-service", "Dorm.ResidentServiceRequestRegister") with { EvidenceIds = new[] { "ev-scenario8-service" } },
            OperatorActor(),
            "req-scenario8-service");
        var serviceProgress = service.ConfirmWorkItem(
            "wi-scenario8-service-progress",
            Scenario8Request("idem-scenario8-service-progress", "Dorm.ResidentServiceProgressUpdate") with { EvidenceIds = new[] { "ev-scenario8-service-progress" } },
            OperatorActor(),
            "req-scenario8-service-progress");
        var incident = service.ConfirmWorkItem(
            "wi-scenario8-incident",
            Scenario8Request("idem-scenario8-incident", "Dorm.ResidentIncidentRegister") with { EvidenceIds = new[] { "ev-scenario8-incident" } },
            OperatorActor(),
            "req-scenario8-incident");
        var incidentClose = service.ConfirmWorkItem(
            "wi-scenario8-incident-close",
            Scenario8Request("idem-scenario8-incident-close", "Dorm.ResidentIncidentClose") with { EvidenceIds = new[] { "ev-scenario8-incident-close" } },
            OperatorActor(),
            "req-scenario8-incident-close");
        var extension = service.ConfirmWorkItem(
            "wi-scenario8-extension",
            Scenario8Request("idem-scenario8-extension", "Dorm.StayExtensionRequestSubmit") with { EvidenceIds = new[] { "ev-scenario8-extension" } },
            OperatorActor(),
            "req-scenario8-extension");
        var transfer = service.ConfirmWorkItem(
            "wi-scenario8-transfer",
            Scenario8Request("idem-scenario8-transfer", "Dorm.BedTransferRequestSubmit") with { EvidenceIds = new[] { "ev-scenario8-transfer" } },
            OperatorActor(),
            "req-scenario8-transfer");
        var credential = service.ConfirmWorkItem(
            "wi-scenario8-credential",
            Scenario8Request("idem-scenario8-credential", "Dorm.AccessCredentialStatusChange") with { EvidenceIds = new[] { "ev-scenario8-credential" } },
            OperatorActor(),
            "req-scenario8-credential");
        var checkoutPrep = service.ConfirmWorkItem(
            "wi-scenario8-checkout-prep",
            Scenario8Request("idem-scenario8-checkout-prep", "Dorm.CheckoutPreparationSnapshotCreate") with { EvidenceIds = new[] { "ev-scenario8-checkout-prep" } },
            OperatorActor(),
            "req-scenario8-checkout-prep");
        var correction = service.ConfirmWorkItem(
            "wi-scenario8-correction",
            Scenario8Request("idem-scenario8-correction", "Dorm.StayManagementCorrectionRequest") with { EvidenceIds = new[] { "ev-scenario8-correction" } },
            OperatorActor(),
            "req-scenario8-correction");

        foreach (var result in new[] { context, serviceRequest, serviceProgress, incident, incidentClose, extension, transfer, credential, checkoutPrep, correction })
        {
            Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        }
        Assert.HasCount(10, store.Submissions);
        Assert.HasCount(10, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario8_in_stay_blocks_business_rule_failures_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario8Workspace() },
            definitions: RegistryWith(
                Scenario8Definition("Dorm.StayManagementContextView"),
                Scenario8Definition("Dorm.StayStatusChange"),
                Scenario8Definition("Dorm.ResidentServiceRequestRegister"),
                Scenario8Definition("Dorm.ResidentIncidentRegister"),
                Scenario8Definition("Dorm.StayExtensionRequestSubmit"),
                Scenario8Definition("Dorm.BedTransferRequestSubmit"),
                Scenario8Definition("Dorm.AccessCredentialStatusChange"),
                Scenario8Definition("Dorm.CheckoutPreparationSnapshotCreate")));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-no-stay", "Dorm.StayManagementContextView", Scenario8ReadyPayload(new Dictionary<string, string>
        {
            ["effectiveStay"] = "false",
            ["stayConfirmed"] = "false",
            ["stayStatus"] = "待入住"
        })));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-checkedout-service", "Dorm.ResidentServiceRequestRegister", Scenario8ReadyPayload(new Dictionary<string, string>
        {
            ["stayStatus"] = "已退房",
            ["checkoutCompleted"] = "true"
        })));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-no-occupancy", "Dorm.StayStatusChange", Scenario8ReadyPayload(new Dictionary<string, string>
        {
            ["currentOccupancyBound"] = "false",
            ["occupancyStatus"] = "缺失"
        })));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-target-occupied", "Dorm.BedTransferRequestSubmit", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-target-blocked", "Dorm.BedTransferRequestSubmit", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-extension-date", "Dorm.StayExtensionRequestSubmit", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-service-finance", "Dorm.ResidentServiceRequestRegister", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-incident-refund", "Dorm.ResidentIncidentRegister", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-high-risk", "Dorm.ResidentIncidentRegister", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-credential-no-stay", "Dorm.AccessCredentialStatusChange", Scenario8ReadyPayload(new Dictionary<string, string>
        {
            ["effectiveStay"] = "false",
            ["stayConfirmed"] = "false",
            ["stayStatus"] = "待入住"
        })));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-checkout-release", "Dorm.CheckoutPreparationSnapshotCreate", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-unauthorized", "Dorm.StayStatusChange", Scenario8ReadyPayload()));

        var noStay = service.ConfirmWorkItem(
            "wi-scenario8-no-stay",
            Scenario8Request("idem-scenario8-no-stay", "Dorm.StayManagementContextView") with { EvidenceIds = new[] { "ev-scenario8-no-stay" } },
            OperatorActor(),
            "req-scenario8-no-stay");
        var checkedOut = service.ConfirmWorkItem(
            "wi-scenario8-checkedout-service",
            Scenario8Request("idem-scenario8-checkedout-service", "Dorm.ResidentServiceRequestRegister") with { EvidenceIds = new[] { "ev-scenario8-checkedout-service" } },
            OperatorActor(),
            "req-scenario8-checkedout-service");
        var noOccupancy = service.ConfirmWorkItem(
            "wi-scenario8-no-occupancy",
            Scenario8Request("idem-scenario8-no-occupancy", "Dorm.StayStatusChange") with { EvidenceIds = new[] { "ev-scenario8-no-occupancy" } },
            OperatorActor(),
            "req-scenario8-no-occupancy");
        var targetOccupied = service.ConfirmWorkItem(
            "wi-scenario8-target-occupied",
            Scenario8Request("idem-scenario8-target-occupied", "Dorm.BedTransferRequestSubmit", new Dictionary<string, string>
            {
                ["targetBedOccupied"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario8-target-occupied" } },
            OperatorActor(),
            "req-scenario8-target-occupied");
        var targetBlocked = service.ConfirmWorkItem(
            "wi-scenario8-target-blocked",
            Scenario8Request("idem-scenario8-target-blocked", "Dorm.BedTransferRequestSubmit", new Dictionary<string, string>
            {
                ["targetResourceStatus"] = "维修中"
            }) with { EvidenceIds = new[] { "ev-scenario8-target-blocked" } },
            OperatorActor(),
            "req-scenario8-target-blocked");
        var extensionDate = service.ConfirmWorkItem(
            "wi-scenario8-extension-date",
            Scenario8Request("idem-scenario8-extension-date", "Dorm.StayExtensionRequestSubmit", new Dictionary<string, string>
            {
                ["newPlannedCheckoutDate"] = "2026-07-19"
            }) with { EvidenceIds = new[] { "ev-scenario8-extension-date" } },
            OperatorActor(),
            "req-scenario8-extension-date");
        var serviceFinance = service.ConfirmWorkItem(
            "wi-scenario8-service-finance",
            Scenario8Request("idem-scenario8-service-finance", "Dorm.ResidentServiceRequestRegister", new Dictionary<string, string>
            {
                ["expenseIntent"] = "true",
                ["paymentIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario8-service-finance" } },
            OperatorActor(),
            "req-scenario8-service-finance");
        var incidentRefund = service.ConfirmWorkItem(
            "wi-scenario8-incident-refund",
            Scenario8Request("idem-scenario8-incident-refund", "Dorm.ResidentIncidentRegister", new Dictionary<string, string>
            {
                ["refundIntent"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario8-incident-refund" } },
            OperatorActor(),
            "req-scenario8-incident-refund");
        var highRisk = service.ConfirmWorkItem(
            "wi-scenario8-high-risk",
            Scenario8Request("idem-scenario8-high-risk", "Dorm.ResidentIncidentRegister", new Dictionary<string, string>
            {
                ["highRiskIncident"] = "true",
                ["managerReviewed"] = "false",
                ["reviewEvidenceBound"] = "false"
            }),
            OperatorActor(),
            "req-scenario8-high-risk");
        var credentialNoStay = service.ConfirmWorkItem(
            "wi-scenario8-credential-no-stay",
            Scenario8Request("idem-scenario8-credential-no-stay", "Dorm.AccessCredentialStatusChange") with { EvidenceIds = new[] { "ev-scenario8-credential-no-stay" } },
            OperatorActor(),
            "req-scenario8-credential-no-stay");
        var checkoutRelease = service.ConfirmWorkItem(
            "wi-scenario8-checkout-release",
            Scenario8Request("idem-scenario8-checkout-release", "Dorm.CheckoutPreparationSnapshotCreate", new Dictionary<string, string>
            {
                ["releaseRoom"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario8-checkout-release" } },
            OperatorActor(),
            "req-scenario8-checkout-release");
        var unauthorized = service.ConfirmWorkItem(
            "wi-scenario8-unauthorized",
            Scenario8Request("idem-scenario8-unauthorized", "Dorm.StayStatusChange", new Dictionary<string, string>
            {
                ["actorRole"] = "guest"
            }) with { EvidenceIds = new[] { "ev-scenario8-unauthorized" } },
            OperatorActor(),
            "req-scenario8-unauthorized");

        Assert.AreEqual("no_effective_stay", noStay.Error);
        Assert.AreEqual("stay_already_checked_out", checkedOut.Error);
        Assert.AreEqual("current_occupancy_required", noOccupancy.Error);
        Assert.AreEqual("target_bed_occupied", targetOccupied.Error);
        Assert.AreEqual("target_resource_blocked_for_transfer", targetBlocked.Error);
        Assert.AreEqual("extension_date_invalid", extensionDate.Error);
        Assert.AreEqual("service_finance_write_forbidden", serviceFinance.Error);
        Assert.AreEqual("incident_refund_forbidden", incidentRefund.Error);
        Assert.AreEqual("high_risk_incident_review_required", highRisk.Error);
        Assert.AreEqual("credential_without_effective_stay_forbidden", credentialNoStay.Error);
        Assert.AreEqual("checkout_preparation_release_forbidden", checkoutRelease.Error);
        Assert.AreEqual("unauthorized_in_stay_action", unauthorized.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario8_internal_refs_search_duplicate_concurrency_and_cross_scenario_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario8Workspace() },
            definitions: RegistryWith(
                Scenario8Definition("Dorm.StayStatusChange"),
                Scenario8Definition("Dorm.BedTransferRequestSubmit")));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-forged-ref", "Dorm.StayStatusChange", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-readonly", "Dorm.StayStatusChange", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-duplicate", "Dorm.StayStatusChange", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-concurrency", "Dorm.BedTransferRequestSubmit", Scenario8ReadyPayload(new Dictionary<string, string>
        {
            ["currentOccupancyVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-inline-edit", "Dorm.StayStatusChange", Scenario8ReadyPayload()));
        service.CreateWorkItem(Scenario8WorkItem("wi-scenario8-cross-scenario", "Dorm.StayStatusChange", Scenario8ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario8-forged-ref",
            Scenario8Request("idem-scenario8-forged-ref", "Dorm.StayStatusChange", new Dictionary<string, string>
            {
                ["stayId"] = "stay-forged",
                ["occupancyId"] = "occupancy-forged",
                ["bedId"] = "bed-forged",
                ["credentialId"] = "credential-forged"
            }) with { EvidenceIds = new[] { "ev-scenario8-forged-ref" } },
            OperatorActor(),
            "req-scenario8-forged-ref");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario8-readonly",
            Scenario8Request("idem-scenario8-readonly", "Dorm.StayStatusChange", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }) with { EvidenceIds = new[] { "ev-scenario8-readonly" } },
            OperatorActor(),
            "req-scenario8-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario8-duplicate",
            Scenario8Request("idem-scenario8-duplicate", "Dorm.StayStatusChange", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario8-duplicate" } },
            OperatorActor(),
            "req-scenario8-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario8-concurrency",
            Scenario8Request("idem-scenario8-concurrency", "Dorm.BedTransferRequestSubmit", new Dictionary<string, string>
            {
                ["expectedOccupancyVersion"] = "1"
            }) with { EvidenceIds = new[] { "ev-scenario8-concurrency" } },
            OperatorActor(),
            "req-scenario8-concurrency");
        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario8-inline-edit",
            Scenario8Request("idem-scenario8-inline-edit", "Dorm.StayStatusChange", new Dictionary<string, string>
            {
                ["inlineEditAttempt"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario8-inline-edit" } },
            OperatorActor(),
            "req-scenario8-inline-edit");
        var crossScenario = service.ConfirmWorkItem(
            "wi-scenario8-cross-scenario",
            Scenario8Request("idem-scenario8-cross-scenario", "Dorm.StayStatusChange", new Dictionary<string, string>
            {
                ["refundIntent"] = "true",
                ["roomReleaseIntent"] = "true",
                ["directLedgerWrite"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario8-cross-scenario" } },
            OperatorActor(),
            "req-scenario8-cross-scenario");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_in_stay_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_occupancy_conflict", concurrency.Error);
        Assert.AreEqual("confirmed_fact_inline_edit_forbidden", inlineEdit.Error);
        Assert.AreEqual("cross_scenario_checkout_refund_ledger_forbidden", crossScenario.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario9_checkout_confirm_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario9Workspace() },
            definitions: RegistryWith(Scenario9Definition("Dorm.CheckoutConfirm")));
        service.CreateWorkItem(Scenario9WorkItem(
            "wi-scenario9-checkout-confirm",
            "Dorm.CheckoutConfirm",
            Scenario9ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario9-checkout-confirm",
            Scenario9Request("idem-scenario9-checkout-confirm", "Dorm.CheckoutConfirm") with
            {
                EvidenceIds = new[] { "ev-scenario9-checkout-confirm" }
            },
            OperatorActor(),
            "req-scenario9-checkout-confirm");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario9_supporting_commands_use_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario9Workspace() },
            definitions: RegistryWith(
                Scenario9Definition("Dorm.CheckoutCaseDraftStart"),
                Scenario9Definition("Dorm.CheckoutHandoverConfirm"),
                Scenario9Definition("Dorm.CheckoutInspectionConfirm"),
                Scenario9Definition("Dorm.CheckoutFeeCalculationGenerate"),
                Scenario9Definition("Dorm.CustomerSettlementConfirm"),
                Scenario9Definition("Dorm.CheckoutFinanceRequestCreate"),
                Scenario9Definition("Dorm.ResourceRecoveryRequestCreate"),
                Scenario9Definition("Dorm.CheckoutCorrectionRequest")));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-draft", "Dorm.CheckoutCaseDraftStart", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-handover", "Dorm.CheckoutHandoverConfirm", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-inspection", "Dorm.CheckoutInspectionConfirm", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-fee", "Dorm.CheckoutFeeCalculationGenerate", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-customer", "Dorm.CustomerSettlementConfirm", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-finance", "Dorm.CheckoutFinanceRequestCreate", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-resource", "Dorm.ResourceRecoveryRequestCreate", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-correction", "Dorm.CheckoutCorrectionRequest", Scenario9ReadyPayload()));

        var draft = service.ConfirmWorkItem(
            "wi-scenario9-draft",
            Scenario9Request("idem-scenario9-draft", "Dorm.CheckoutCaseDraftStart") with { EvidenceIds = new[] { "ev-scenario9-draft" } },
            OperatorActor(),
            "req-scenario9-draft");
        var handover = service.ConfirmWorkItem(
            "wi-scenario9-handover",
            Scenario9Request("idem-scenario9-handover", "Dorm.CheckoutHandoverConfirm") with { EvidenceIds = new[] { "ev-scenario9-handover" } },
            OperatorActor(),
            "req-scenario9-handover");
        var inspection = service.ConfirmWorkItem(
            "wi-scenario9-inspection",
            Scenario9Request("idem-scenario9-inspection", "Dorm.CheckoutInspectionConfirm") with { EvidenceIds = new[] { "ev-scenario9-inspection" } },
            OperatorActor(),
            "req-scenario9-inspection");
        var fee = service.ConfirmWorkItem(
            "wi-scenario9-fee",
            Scenario9Request("idem-scenario9-fee", "Dorm.CheckoutFeeCalculationGenerate") with { EvidenceIds = new[] { "ev-scenario9-fee" } },
            OperatorActor(),
            "req-scenario9-fee");
        var customer = service.ConfirmWorkItem(
            "wi-scenario9-customer",
            Scenario9Request("idem-scenario9-customer", "Dorm.CustomerSettlementConfirm") with { EvidenceIds = new[] { "ev-scenario9-customer" } },
            OperatorActor(),
            "req-scenario9-customer");
        var finance = service.ConfirmWorkItem(
            "wi-scenario9-finance",
            Scenario9Request("idem-scenario9-finance", "Dorm.CheckoutFinanceRequestCreate") with { EvidenceIds = new[] { "ev-scenario9-finance" } },
            OperatorActor(),
            "req-scenario9-finance");
        var resource = service.ConfirmWorkItem(
            "wi-scenario9-resource",
            Scenario9Request("idem-scenario9-resource", "Dorm.ResourceRecoveryRequestCreate") with { EvidenceIds = new[] { "ev-scenario9-resource" } },
            OperatorActor(),
            "req-scenario9-resource");
        var correction = service.ConfirmWorkItem(
            "wi-scenario9-correction",
            Scenario9Request("idem-scenario9-correction", "Dorm.CheckoutCorrectionRequest") with { EvidenceIds = new[] { "ev-scenario9-correction" } },
            OperatorActor(),
            "req-scenario9-correction");

        foreach (var result in new[] { draft, handover, inspection, fee, customer, finance, resource, correction })
        {
            Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        }
        Assert.HasCount(8, store.Submissions);
        Assert.HasCount(8, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario9_checkout_blocks_business_rule_failures_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario9Workspace() },
            definitions: RegistryWith(
                Scenario9Definition("Dorm.CheckoutCaseDraftStart"),
                Scenario9Definition("Dorm.CheckoutHandoverConfirm"),
                Scenario9Definition("Dorm.CheckoutInspectionConfirm"),
                Scenario9Definition("Dorm.CheckoutFeeCalculationGenerate"),
                Scenario9Definition("Dorm.CustomerSettlementConfirm"),
                Scenario9Definition("Dorm.CheckoutConfirm"),
                Scenario9Definition("Dorm.CheckoutFinanceRequestCreate"),
                Scenario9Definition("Dorm.ResourceRecoveryRequestCreate")));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-no-stay", "Dorm.CheckoutCaseDraftStart", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["effectiveStay"] = "false",
            ["stayConfirmed"] = "false",
            ["stayStatus"] = "待入住"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-already-checked-out", "Dorm.CheckoutCaseDraftStart", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["checkoutCompleted"] = "true",
            ["checkoutStatus"] = "已退房"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-no-occupancy", "Dorm.CheckoutConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["currentOccupancyBound"] = "false",
            ["occupancyStatus"] = "缺失"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-high-risk", "Dorm.CheckoutCaseDraftStart", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["highRiskIncidentBlocksCheckout"] = "true"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-no-time", "Dorm.CheckoutHandoverConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["actualCheckoutAt"] = ""
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-proxy-no-evidence", "Dorm.CheckoutHandoverConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["handoverType"] = "代办",
            ["handoverNote"] = "",
            ["handoverEvidenceBound"] = "false"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-no-credential", "Dorm.CheckoutConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["credentialReturned"] = "false",
            ["credentialReturnStatus"] = "未回收",
            ["credentialExceptionExplained"] = "false"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-no-inspection", "Dorm.CheckoutInspectionConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["inspectionEvidenceBound"] = "false",
            ["checkoutInspectionCompleted"] = "false"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-damage-missing", "Dorm.CheckoutInspectionConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["hasDamage"] = "true",
            ["damageDescription"] = "",
            ["damageEvidenceBound"] = "false"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-fee-invalid", "Dorm.CheckoutFeeCalculationGenerate", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["feeSourceValid"] = "false"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-ledger-truth", "Dorm.CheckoutFeeCalculationGenerate", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["finalLedgerTruthInput"] = "true"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-customer-missing", "Dorm.CheckoutConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["customerConfirmedSettlement"] = "false",
            ["customerConfirmationStatus"] = "待客户确认"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-dispute", "Dorm.CustomerSettlementConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["hasDispute"] = "true"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-finance-bypass", "Dorm.CheckoutFinanceRequestCreate", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["directRefund"] = "true"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-operational-direct", "Dorm.ResourceRecoveryRequestCreate", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["resourceRecoveryTargetStatus"] = "可运营"
        })));

        var noStay = service.ConfirmWorkItem("wi-scenario9-no-stay", Scenario9Request("idem-scenario9-no-stay", "Dorm.CheckoutCaseDraftStart"), OperatorActor(), "req-scenario9-no-stay");
        var alreadyCheckedOut = service.ConfirmWorkItem("wi-scenario9-already-checked-out", Scenario9Request("idem-scenario9-already-checked-out", "Dorm.CheckoutCaseDraftStart"), OperatorActor(), "req-scenario9-already-checked-out");
        var noOccupancy = service.ConfirmWorkItem("wi-scenario9-no-occupancy", Scenario9Request("idem-scenario9-no-occupancy", "Dorm.CheckoutConfirm") with { EvidenceIds = new[] { "ev-scenario9-no-occupancy" } }, OperatorActor(), "req-scenario9-no-occupancy");
        var highRisk = service.ConfirmWorkItem("wi-scenario9-high-risk", Scenario9Request("idem-scenario9-high-risk", "Dorm.CheckoutCaseDraftStart"), OperatorActor(), "req-scenario9-high-risk");
        var noTime = service.ConfirmWorkItem("wi-scenario9-no-time", Scenario9Request("idem-scenario9-no-time", "Dorm.CheckoutHandoverConfirm") with { EvidenceIds = new[] { "ev-scenario9-no-time" } }, OperatorActor(), "req-scenario9-no-time");
        var proxy = service.ConfirmWorkItem("wi-scenario9-proxy-no-evidence", Scenario9Request("idem-scenario9-proxy-no-evidence", "Dorm.CheckoutHandoverConfirm"), OperatorActor(), "req-scenario9-proxy-no-evidence");
        var noCredential = service.ConfirmWorkItem("wi-scenario9-no-credential", Scenario9Request("idem-scenario9-no-credential", "Dorm.CheckoutConfirm") with { EvidenceIds = new[] { "ev-scenario9-no-credential" } }, OperatorActor(), "req-scenario9-no-credential");
        var noInspection = service.ConfirmWorkItem("wi-scenario9-no-inspection", Scenario9Request("idem-scenario9-no-inspection", "Dorm.CheckoutInspectionConfirm"), OperatorActor(), "req-scenario9-no-inspection");
        var damage = service.ConfirmWorkItem("wi-scenario9-damage-missing", Scenario9Request("idem-scenario9-damage-missing", "Dorm.CheckoutInspectionConfirm"), OperatorActor(), "req-scenario9-damage-missing");
        var feeInvalid = service.ConfirmWorkItem("wi-scenario9-fee-invalid", Scenario9Request("idem-scenario9-fee-invalid", "Dorm.CheckoutFeeCalculationGenerate"), OperatorActor(), "req-scenario9-fee-invalid");
        var ledgerTruth = service.ConfirmWorkItem("wi-scenario9-ledger-truth", Scenario9Request("idem-scenario9-ledger-truth", "Dorm.CheckoutFeeCalculationGenerate"), OperatorActor(), "req-scenario9-ledger-truth");
        var customerMissing = service.ConfirmWorkItem("wi-scenario9-customer-missing", Scenario9Request("idem-scenario9-customer-missing", "Dorm.CheckoutConfirm") with { EvidenceIds = new[] { "ev-scenario9-customer-missing" } }, OperatorActor(), "req-scenario9-customer-missing");
        var dispute = service.ConfirmWorkItem("wi-scenario9-dispute", Scenario9Request("idem-scenario9-dispute", "Dorm.CustomerSettlementConfirm"), OperatorActor(), "req-scenario9-dispute");
        var financeBypass = service.ConfirmWorkItem("wi-scenario9-finance-bypass", Scenario9Request("idem-scenario9-finance-bypass", "Dorm.CheckoutFinanceRequestCreate"), OperatorActor(), "req-scenario9-finance-bypass");
        var operationalDirect = service.ConfirmWorkItem("wi-scenario9-operational-direct", Scenario9Request("idem-scenario9-operational-direct", "Dorm.ResourceRecoveryRequestCreate"), OperatorActor(), "req-scenario9-operational-direct");

        Assert.AreEqual("no_effective_stay", noStay.Error);
        Assert.AreEqual("stay_already_checked_out", alreadyCheckedOut.Error);
        Assert.AreEqual("current_occupancy_required", noOccupancy.Error);
        Assert.AreEqual("high_risk_incident_blocks_normal_checkout", highRisk.Error);
        Assert.AreEqual("actual_checkout_time_required", noTime.Error);
        Assert.AreEqual("proxy_or_abnormal_handover_evidence_required", proxy.Error);
        Assert.AreEqual("credential_return_required", noCredential.Error);
        Assert.AreEqual("inspection_evidence_required", noInspection.Error);
        Assert.AreEqual("damage_description_evidence_required", damage.Error);
        Assert.AreEqual("fee_source_invalid", feeInvalid.Error);
        Assert.AreEqual("final_ledger_truth_manual_input_forbidden", ledgerTruth.Error);
        Assert.AreEqual("customer_confirmation_required", customerMissing.Error);
        Assert.AreEqual("disputed_settlement_requires_review", dispute.Error);
        Assert.AreEqual("finance_gate_required_for_refund_or_topup", financeBypass.Error);
        Assert.AreEqual("resource_operational_direct_restore_forbidden", operationalDirect.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario9_internal_refs_search_duplicate_concurrency_and_direct_finance_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario9Workspace() },
            definitions: RegistryWith(
                Scenario9Definition("Dorm.CheckoutConfirm"),
                Scenario9Definition("Dorm.CheckoutCaseDraftStart")));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-forged-ref", "Dorm.CheckoutConfirm", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-readonly", "Dorm.CheckoutConfirm", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-duplicate", "Dorm.CheckoutConfirm", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-concurrency", "Dorm.CheckoutConfirm", Scenario9ReadyPayload(new Dictionary<string, string>
        {
            ["currentCheckoutVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-inline-edit", "Dorm.CheckoutConfirm", Scenario9ReadyPayload()));
        service.CreateWorkItem(Scenario9WorkItem("wi-scenario9-direct-finance", "Dorm.CheckoutConfirm", Scenario9ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario9-forged-ref",
            Scenario9Request("idem-scenario9-forged-ref", "Dorm.CheckoutConfirm", new Dictionary<string, string>
            {
                ["stayId"] = "stay-forged",
                ["checkoutCaseId"] = "checkout-forged",
                ["refundId"] = "refund-forged",
                ["ledgerEntryId"] = "ledger-forged"
            }) with { EvidenceIds = new[] { "ev-scenario9-forged-ref" } },
            OperatorActor(),
            "req-scenario9-forged-ref");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario9-readonly",
            Scenario9Request("idem-scenario9-readonly", "Dorm.CheckoutConfirm", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }) with { EvidenceIds = new[] { "ev-scenario9-readonly" } },
            OperatorActor(),
            "req-scenario9-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario9-duplicate",
            Scenario9Request("idem-scenario9-duplicate", "Dorm.CheckoutConfirm", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario9-duplicate" } },
            OperatorActor(),
            "req-scenario9-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario9-concurrency",
            Scenario9Request("idem-scenario9-concurrency", "Dorm.CheckoutConfirm", new Dictionary<string, string>
            {
                ["expectedCheckoutVersion"] = "1"
            }) with { EvidenceIds = new[] { "ev-scenario9-concurrency" } },
            OperatorActor(),
            "req-scenario9-concurrency");
        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario9-inline-edit",
            Scenario9Request("idem-scenario9-inline-edit", "Dorm.CheckoutConfirm", new Dictionary<string, string>
            {
                ["confirmedCheckout"] = "true",
                ["inlineEditAttempt"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario9-inline-edit" } },
            OperatorActor(),
            "req-scenario9-inline-edit");
        var directFinance = service.ConfirmWorkItem(
            "wi-scenario9-direct-finance",
            Scenario9Request("idem-scenario9-direct-finance", "Dorm.CheckoutConfirm", new Dictionary<string, string>
            {
                ["directRefundWrite"] = "true",
                ["directLedgerWrite"] = "true"
            }) with { EvidenceIds = new[] { "ev-scenario9-direct-finance" } },
            OperatorActor(),
            "req-scenario9-direct-finance");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_checkout_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_checkout_conflict", concurrency.Error);
        Assert.AreEqual("confirmed_checkout_inline_edit_forbidden", inlineEdit.Error);
        Assert.AreEqual("direct_payment_refund_ledger_forbidden", directFinance.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario10_cancel_closure_uses_generated_contract_before_commit()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario10Workspace() },
            definitions: RegistryWith(Scenario10Definition("Dorm.CancelNoShowConfirmClosure")));
        service.CreateWorkItem(Scenario10WorkItem(
            "wi-scenario10-confirm",
            "Dorm.CancelNoShowConfirmClosure",
            Scenario10ReadyPayload()));

        var result = service.ConfirmWorkItem(
            "wi-scenario10-confirm",
            Scenario10Request("idem-scenario10-confirm", "Dorm.CancelNoShowConfirmClosure") with
            {
                EvidenceIds = new[] { "ev-scenario10-confirm" }
            },
            OperatorActor(),
            "req-scenario10-confirm");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.HasCount(1, store.Submissions);
        Assert.HasCount(1, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario10_supporting_commands_use_generated_contract_before_commit()
    {
        var commands = new[]
        {
            "Dorm.CancelNoShowCaseDraftStart",
            "Dorm.CancellationCaseDraftStart",
            "Dorm.NoShowCaseDraftStart",
            "Dorm.CancelNoShowReasonCustomerConfirm",
            "Dorm.CancelNoShowPolicyCalculationGenerate",
            "Dorm.CancelNoShowInventoryReleaseRequestConfirm",
            "Dorm.CancelNoShowFinanceProcessingRequestCreate",
            "Dorm.CancellationConfirm",
            "Dorm.NoShowConfirm",
            "Dorm.CancelNoShowDisputeReview",
            "Dorm.CancelNoShowFollowUpRecord",
            "Dorm.CancelNoShowFinanceEvidenceSupplement",
            "Dorm.CancelNoShowCorrectionRequest"
        };
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario10Workspace() },
            definitions: RegistryWith(commands.Select(Scenario10Definition).ToArray()));

        foreach (var command in commands)
        {
            service.CreateWorkItem(Scenario10WorkItem($"wi-scenario10-{command.Replace(".", "-")}", command, Scenario10ReadyPayload()));
        }

        var results = commands.Select(command => service.ConfirmWorkItem(
            $"wi-scenario10-{command.Replace(".", "-")}",
            Scenario10Request($"idem-scenario10-{command.Replace(".", "-")}", command) with { EvidenceIds = new[] { $"ev-scenario10-{command.Replace(".", "-")}" } },
            OperatorActor(),
            $"req-scenario10-{command.Replace(".", "-")}")).ToArray();

        foreach (var result in results)
        {
            Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        }
        Assert.HasCount(commands.Length, store.Submissions);
        Assert.HasCount(commands.Length, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario10_cancel_noshow_refund_blocks_business_rule_failures_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario10Workspace() },
            definitions: RegistryWith(
                Scenario10Definition("Dorm.CancellationCaseDraftStart"),
                Scenario10Definition("Dorm.NoShowConfirm"),
                Scenario10Definition("Dorm.CancelNoShowPolicyCalculationGenerate"),
                Scenario10Definition("Dorm.CancelNoShowInventoryReleaseRequestConfirm"),
                Scenario10Definition("Dorm.CancelNoShowFinanceProcessingRequestCreate"),
                Scenario10Definition("Dorm.CancelNoShowConfirmClosure"),
                Scenario10Definition("Dorm.CancellationConfirm")));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-no-reservation", "Dorm.CancellationCaseDraftStart", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["effectiveReservation"] = "false",
            ["reservationConfirmed"] = "false",
            ["reservationStatus"] = "待确认"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-no-payment", "Dorm.CancelNoShowFinanceProcessingRequestCreate", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["paymentDepositSnapshotBound"] = "false",
            ["financeStatus"] = "缺失"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-no-settlement-intent", "Dorm.CancelNoShowFinanceProcessingRequestCreate", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["checkoutRefundFollowUp"] = "true",
            ["settlementIntentBound"] = "false",
            ["checkoutSettlementDirection"] = ""
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-checked-in", "Dorm.CancellationConfirm", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["alreadyCheckedIn"] = "true",
            ["checkInStatus"] = "已入住"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-checked-out", "Dorm.CancellationConfirm", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["alreadyCheckedOut"] = "true",
            ["checkoutStatus"] = "已退房"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-already-cancelled", "Dorm.CancellationCaseDraftStart", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["alreadyCancelled"] = "true"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-hold-time", "Dorm.NoShowConfirm", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["noShowHoldTimeElapsed"] = "false"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-customer-missing", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["customerConfirmed"] = "false",
            ["customerConfirmationStatus"] = "待客户确认"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-dispute", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["hasDispute"] = "true"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-policy-missing", "Dorm.CancelNoShowPolicyCalculationGenerate", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["policyAmountSourceValid"] = "false"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-manual-refund", "Dorm.CancelNoShowPolicyCalculationGenerate", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["manualFinalRefundAmount"] = "true"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-scope-invalid", "Dorm.CancelNoShowInventoryReleaseRequestConfirm", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["inventoryReleaseScopeValid"] = "false"
        })));

        var noReservation = service.ConfirmWorkItem("wi-scenario10-no-reservation", Scenario10Request("idem-scenario10-no-reservation", "Dorm.CancellationCaseDraftStart"), OperatorActor(), "req-scenario10-no-reservation");
        var noPayment = service.ConfirmWorkItem("wi-scenario10-no-payment", Scenario10Request("idem-scenario10-no-payment", "Dorm.CancelNoShowFinanceProcessingRequestCreate"), OperatorActor(), "req-scenario10-no-payment");
        var noSettlement = service.ConfirmWorkItem("wi-scenario10-no-settlement-intent", Scenario10Request("idem-scenario10-no-settlement-intent", "Dorm.CancelNoShowFinanceProcessingRequestCreate"), OperatorActor(), "req-scenario10-no-settlement-intent");
        var checkedIn = service.ConfirmWorkItem("wi-scenario10-checked-in", Scenario10Request("idem-scenario10-checked-in", "Dorm.CancellationConfirm"), OperatorActor(), "req-scenario10-checked-in");
        var checkedOut = service.ConfirmWorkItem("wi-scenario10-checked-out", Scenario10Request("idem-scenario10-checked-out", "Dorm.CancellationConfirm"), OperatorActor(), "req-scenario10-checked-out");
        var alreadyCancelled = service.ConfirmWorkItem("wi-scenario10-already-cancelled", Scenario10Request("idem-scenario10-already-cancelled", "Dorm.CancellationCaseDraftStart"), OperatorActor(), "req-scenario10-already-cancelled");
        var holdTime = service.ConfirmWorkItem("wi-scenario10-hold-time", Scenario10Request("idem-scenario10-hold-time", "Dorm.NoShowConfirm"), OperatorActor(), "req-scenario10-hold-time");
        var customerMissing = service.ConfirmWorkItem("wi-scenario10-customer-missing", Scenario10Request("idem-scenario10-customer-missing", "Dorm.CancelNoShowConfirmClosure"), OperatorActor(), "req-scenario10-customer-missing");
        var dispute = service.ConfirmWorkItem("wi-scenario10-dispute", Scenario10Request("idem-scenario10-dispute", "Dorm.CancelNoShowConfirmClosure"), OperatorActor(), "req-scenario10-dispute");
        var policyMissing = service.ConfirmWorkItem("wi-scenario10-policy-missing", Scenario10Request("idem-scenario10-policy-missing", "Dorm.CancelNoShowPolicyCalculationGenerate"), OperatorActor(), "req-scenario10-policy-missing");
        var manualRefund = service.ConfirmWorkItem("wi-scenario10-manual-refund", Scenario10Request("idem-scenario10-manual-refund", "Dorm.CancelNoShowPolicyCalculationGenerate"), OperatorActor(), "req-scenario10-manual-refund");
        var scopeInvalid = service.ConfirmWorkItem("wi-scenario10-scope-invalid", Scenario10Request("idem-scenario10-scope-invalid", "Dorm.CancelNoShowInventoryReleaseRequestConfirm"), OperatorActor(), "req-scenario10-scope-invalid");

        Assert.AreEqual("no_effective_reservation", noReservation.Error);
        Assert.AreEqual("payment_deposit_snapshot_required", noPayment.Error);
        Assert.AreEqual("settlement_intent_required_for_checkout_refund", noSettlement.Error);
        Assert.AreEqual("reservation_already_checked_in", checkedIn.Error);
        Assert.AreEqual("reservation_already_checked_out", checkedOut.Error);
        Assert.AreEqual("reservation_already_cancelled", alreadyCancelled.Error);
        Assert.AreEqual("noshow_hold_time_not_elapsed", holdTime.Error);
        Assert.AreEqual("customer_confirmation_required", customerMissing.Error);
        Assert.AreEqual("dispute_requires_review", dispute.Error);
        Assert.AreEqual("policy_amount_source_missing", policyMissing.Error);
        Assert.AreEqual("final_refund_manual_input_forbidden", manualRefund.Error);
        Assert.AreEqual("inventory_release_scope_invalid", scopeInvalid.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario10_internal_refs_search_duplicate_concurrency_and_direct_finance_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario10Workspace() },
            definitions: RegistryWith(Scenario10Definition("Dorm.CancelNoShowConfirmClosure")));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-forged-ref", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload()));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-readonly", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload()));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-duplicate", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload()));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-concurrency", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload(new Dictionary<string, string>
        {
            ["currentCancellationVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-inline-edit", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload()));
        service.CreateWorkItem(Scenario10WorkItem("wi-scenario10-direct-finance", "Dorm.CancelNoShowConfirmClosure", Scenario10ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario10-forged-ref",
            Scenario10Request("idem-scenario10-forged-ref", "Dorm.CancelNoShowConfirmClosure", new Dictionary<string, string>
            {
                ["reservationId"] = "reservation-forged",
                ["refundId"] = "refund-forged",
                ["paymentId"] = "payment-forged",
                ["depositId"] = "deposit-forged",
                ["ledgerEntryId"] = "ledger-forged"
            }),
            OperatorActor(),
            "req-scenario10-forged-ref");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario10-readonly",
            Scenario10Request("idem-scenario10-readonly", "Dorm.CancelNoShowConfirmClosure", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }),
            OperatorActor(),
            "req-scenario10-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario10-duplicate",
            Scenario10Request("idem-scenario10-duplicate", "Dorm.CancelNoShowConfirmClosure", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }),
            OperatorActor(),
            "req-scenario10-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario10-concurrency",
            Scenario10Request("idem-scenario10-concurrency", "Dorm.CancelNoShowConfirmClosure", new Dictionary<string, string>
            {
                ["expectedCancellationVersion"] = "1"
            }),
            OperatorActor(),
            "req-scenario10-concurrency");
        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario10-inline-edit",
            Scenario10Request("idem-scenario10-inline-edit", "Dorm.CancelNoShowConfirmClosure", new Dictionary<string, string>
            {
                ["confirmedCancellation"] = "true",
                ["inlineEditAttempt"] = "true"
            }),
            OperatorActor(),
            "req-scenario10-inline-edit");
        var directFinance = service.ConfirmWorkItem(
            "wi-scenario10-direct-finance",
            Scenario10Request("idem-scenario10-direct-finance", "Dorm.CancelNoShowConfirmClosure", new Dictionary<string, string>
            {
                ["directRefundWrite"] = "true",
                ["directLedgerWrite"] = "true"
            }),
            OperatorActor(),
            "req-scenario10-direct-finance");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_cancellation_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_cancellation_conflict", concurrency.Error);
        Assert.AreEqual("confirmed_closure_inline_edit_forbidden", inlineEdit.Error);
        Assert.AreEqual("direct_refund_payment_ledger_forbidden", directFinance.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario11_work_commands_use_generated_contract_before_commit()
    {
        var commands = new[]
        {
            "Dorm.ServiceWorkCaseDraftStart",
            "Dorm.HousekeepingTaskCreate",
            "Dorm.MaintenanceTaskCreate",
            "Dorm.InspectionTaskCreate",
            "Dorm.OutOfServiceRequestDraftStart",
            "Dorm.WorkAssignmentDispatch",
            "Dorm.WorkProgressUpdate",
            "Dorm.WorkCompletionSubmit",
            "Dorm.WorkVerificationConfirm",
            "Dorm.WorkReworkRequest",
            "Dorm.OutOfServiceOrRecoveryRecommendationCreate",
            "Dorm.ExpenseIntentSubmit",
            "Dorm.TaskEvidenceSupplement",
            "Dorm.ServiceWorkCorrectionRequest"
        };
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario11Workspace() },
            definitions: RegistryWith(commands.Select(Scenario11Definition).ToArray()));

        foreach (var command in commands)
        {
            service.CreateWorkItem(Scenario11WorkItem($"wi-scenario11-{command.Replace(".", "-")}", command, Scenario11ReadyPayload()));
        }

        var results = commands.Select(command => service.ConfirmWorkItem(
            $"wi-scenario11-{command.Replace(".", "-")}",
            Scenario11Request($"idem-scenario11-{command.Replace(".", "-")}", command) with { EvidenceIds = new[] { $"ev-scenario11-{command.Replace(".", "-")}" } },
            OperatorActor(),
            $"req-scenario11-{command.Replace(".", "-")}")).ToArray();

        foreach (var result in results)
        {
            Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        }
        Assert.HasCount(commands.Length, store.Submissions);
        Assert.HasCount(commands.Length, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario11_housekeeping_maintenance_blocks_failures_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario11Workspace() },
            definitions: RegistryWith(
                Scenario11Definition("Dorm.ServiceWorkCaseDraftStart"),
                Scenario11Definition("Dorm.WorkAssignmentDispatch"),
                Scenario11Definition("Dorm.WorkCompletionSubmit"),
                Scenario11Definition("Dorm.WorkVerificationConfirm"),
                Scenario11Definition("Dorm.OutOfServiceOrRecoveryRecommendationCreate"),
                Scenario11Definition("Dorm.ExpenseIntentSubmit")));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-no-source", "Dorm.ServiceWorkCaseDraftStart", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["legalWorkSource"] = "false",
            ["operationBlockSummaryBound"] = "false",
            ["inStayServiceRequestBound"] = "false",
            ["checkoutRecoveryRequestBound"] = "false",
            ["releaseAfterCancellationBound"] = "false"
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-no-assignee", "Dorm.WorkAssignmentDispatch", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["assigneeBound"] = "false",
            ["responsiblePerson"] = ""
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-no-scope", "Dorm.WorkAssignmentDispatch", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["assigneeBound"] = "true",
            ["workScopeBound"] = "false",
            ["resourceScopeBound"] = "false",
            ["roomDisplayName"] = "",
            ["bedDisplayName"] = "",
            ["resourceDisplayName"] = ""
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-no-completion-evidence", "Dorm.WorkCompletionSubmit", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["completionDescription"] = "",
            ["completionEvidenceBound"] = "false",
            ["completionPhotoBound"] = "false"
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-not-completed", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["completionSubmitted"] = "false",
            ["workCompleted"] = "false",
            ["workStatus"] = "处理中"
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-failed-no-rework", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["verificationFailed"] = "true",
            ["verificationResult"] = "验收不通过",
            ["reworkCreated"] = "false",
            ["exceptionCreated"] = "false",
            ["nextAction"] = ""
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-unresolved-recovery", "Dorm.OutOfServiceOrRecoveryRecommendationCreate", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["recoveryRecommendation"] = "true",
            ["unresolvedMaintenance"] = "true"
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-no-expense-evidence", "Dorm.ExpenseIntentSubmit", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["expenseEvidenceBound"] = "false",
            ["supplierVoucherBound"] = "false",
            ["expenseBasis"] = ""
        })));

        var noSource = service.ConfirmWorkItem("wi-scenario11-no-source", Scenario11Request("idem-scenario11-no-source", "Dorm.ServiceWorkCaseDraftStart"), OperatorActor(), "req-scenario11-no-source");
        var noAssignee = service.ConfirmWorkItem("wi-scenario11-no-assignee", Scenario11Request("idem-scenario11-no-assignee", "Dorm.WorkAssignmentDispatch"), OperatorActor(), "req-scenario11-no-assignee");
        var noScope = service.ConfirmWorkItem("wi-scenario11-no-scope", Scenario11Request("idem-scenario11-no-scope", "Dorm.WorkAssignmentDispatch"), OperatorActor(), "req-scenario11-no-scope");
        var noEvidence = service.ConfirmWorkItem("wi-scenario11-no-completion-evidence", Scenario11Request("idem-scenario11-no-completion-evidence", "Dorm.WorkCompletionSubmit"), OperatorActor(), "req-scenario11-no-completion-evidence");
        var notCompleted = service.ConfirmWorkItem("wi-scenario11-not-completed", Scenario11Request("idem-scenario11-not-completed", "Dorm.WorkVerificationConfirm"), OperatorActor(), "req-scenario11-not-completed");
        var noRework = service.ConfirmWorkItem("wi-scenario11-failed-no-rework", Scenario11Request("idem-scenario11-failed-no-rework", "Dorm.WorkVerificationConfirm"), OperatorActor(), "req-scenario11-failed-no-rework");
        var unresolved = service.ConfirmWorkItem("wi-scenario11-unresolved-recovery", Scenario11Request("idem-scenario11-unresolved-recovery", "Dorm.OutOfServiceOrRecoveryRecommendationCreate"), OperatorActor(), "req-scenario11-unresolved-recovery");
        var noExpenseEvidence = service.ConfirmWorkItem("wi-scenario11-no-expense-evidence", Scenario11Request("idem-scenario11-no-expense-evidence", "Dorm.ExpenseIntentSubmit"), OperatorActor(), "req-scenario11-no-expense-evidence");

        Assert.AreEqual("no_legal_work_source", noSource.Error);
        Assert.AreEqual("missing_work_assignee", noAssignee.Error);
        Assert.AreEqual("missing_work_scope", noScope.Error);
        Assert.AreEqual("completion_evidence_required", noEvidence.Error);
        Assert.AreEqual("completion_required_before_verification", notCompleted.Error);
        Assert.AreEqual("verification_failure_requires_rework", noRework.Error);
        Assert.AreEqual("unresolved_maintenance_recovery_forbidden", unresolved.Error);
        Assert.AreEqual("expense_evidence_required", noExpenseEvidence.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario11_internal_refs_search_duplicate_concurrency_and_direct_writes_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario11Workspace() },
            definitions: RegistryWith(Scenario11Definition("Dorm.WorkVerificationConfirm")));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-forged-ref", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload()));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-readonly", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload()));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-duplicate", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload()));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-concurrency", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload(new Dictionary<string, string>
        {
            ["currentWorkVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-direct-operation", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload()));
        service.CreateWorkItem(Scenario11WorkItem("wi-scenario11-direct-ledger", "Dorm.WorkVerificationConfirm", Scenario11ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario11-forged-ref",
            Scenario11Request("idem-scenario11-forged-ref", "Dorm.WorkVerificationConfirm", new Dictionary<string, string>
            {
                ["roomId"] = "room-forged",
                ["bedId"] = "bed-forged",
                ["taskId"] = "task-forged"
            }),
            OperatorActor(),
            "req-scenario11-forged-ref");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario11-readonly",
            Scenario11Request("idem-scenario11-readonly", "Dorm.WorkVerificationConfirm", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }),
            OperatorActor(),
            "req-scenario11-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario11-duplicate",
            Scenario11Request("idem-scenario11-duplicate", "Dorm.WorkVerificationConfirm", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }),
            OperatorActor(),
            "req-scenario11-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario11-concurrency",
            Scenario11Request("idem-scenario11-concurrency", "Dorm.WorkVerificationConfirm", new Dictionary<string, string>
            {
                ["expectedWorkVersion"] = "1"
            }),
            OperatorActor(),
            "req-scenario11-concurrency");
        var directOperation = service.ConfirmWorkItem(
            "wi-scenario11-direct-operation",
            Scenario11Request("idem-scenario11-direct-operation", "Dorm.WorkVerificationConfirm", new Dictionary<string, string>
            {
                ["directOperationalRestore"] = "true"
            }),
            OperatorActor(),
            "req-scenario11-direct-operation");
        var directLedger = service.ConfirmWorkItem(
            "wi-scenario11-direct-ledger",
            Scenario11Request("idem-scenario11-direct-ledger", "Dorm.WorkVerificationConfirm", new Dictionary<string, string>
            {
                ["directLedgerWrite"] = "true"
            }),
            OperatorActor(),
            "req-scenario11-direct-ledger");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_work_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_work_conflict", concurrency.Error);
        Assert.AreEqual("direct_operational_restore_forbidden", directOperation.Error);
        Assert.AreEqual("direct_expense_ledger_forbidden", directLedger.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario12_channel_corporate_commands_use_generated_contract_before_commit()
    {
        var commands = new[]
        {
            "Dorm.ChannelCorporateProfileDraftStart",
            "Dorm.ChannelPartnerProfileCreate",
            "Dorm.CorporateCustomerProfileCreate",
            "Dorm.CorporateAgreementDraftSubmit",
            "Dorm.CorporateAgreementApproveActivate",
            "Dorm.ChannelProductEligibilityBind",
            "Dorm.ChannelPublicationRuleConfigure",
            "Dorm.ChannelPublicationEnable",
            "Dorm.CommissionSettlementIntentSubmit",
            "Dorm.ChannelCorporateAuditDecision",
            "Dorm.ChannelPause",
            "Dorm.ChannelDisable",
            "Dorm.CorporateAgreementRenew",
            "Dorm.ChannelCorporateDailyMaintenance",
            "Dorm.ChannelCorporateEvidenceSupplement",
            "Dorm.ChannelCorporateCorrectionRequest"
        };
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario12Workspace() },
            definitions: RegistryWith(commands.Select(Scenario12Definition).ToArray()));

        foreach (var command in commands)
        {
            service.CreateWorkItem(Scenario12WorkItem($"wi-scenario12-{command.Replace(".", "-")}", command, Scenario12ReadyPayload()));
        }

        var results = commands.Select(command => service.ConfirmWorkItem(
            $"wi-scenario12-{command.Replace(".", "-")}",
            Scenario12Request($"idem-scenario12-{command.Replace(".", "-")}", command) with { EvidenceIds = new[] { $"ev-scenario12-{command.Replace(".", "-")}" } },
            OperatorActor(),
            $"req-scenario12-{command.Replace(".", "-")}")).ToArray();

        foreach (var result in results)
        {
            Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        }
        Assert.HasCount(commands.Length, store.Submissions);
        Assert.HasCount(commands.Length, store.DomainEvents);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.LedgerTransactions);
    }

    [TestMethod]
    public void scenario12_channel_corporate_blocks_business_failures_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario12Workspace() },
            definitions: RegistryWith(
                Scenario12Definition("Dorm.ChannelCorporateProfileDraftStart"),
                Scenario12Definition("Dorm.ChannelPublicationEnable"),
                Scenario12Definition("Dorm.CorporateAgreementDraftSubmit"),
                Scenario12Definition("Dorm.ChannelProductEligibilityBind"),
                Scenario12Definition("Dorm.ChannelPublicationRuleConfigure"),
                Scenario12Definition("Dorm.CommissionSettlementIntentSubmit")));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-no-profile", "Dorm.ChannelCorporateProfileDraftStart", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["businessProfileBound"] = "false",
            ["channelName"] = "",
            ["corporateName"] = "",
            ["businessProfileName"] = "",
            ["contactName"] = "",
            ["contactPhone"] = "",
            ["email"] = ""
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-no-evidence", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["keyEvidenceBound"] = "false",
            ["licenseEvidenceBound"] = "false",
            ["agreementEvidenceBound"] = "false",
            ["authorizationEvidenceBound"] = "false",
            ["contractEvidenceBound"] = "false"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-bad-dates", "Dorm.CorporateAgreementDraftSubmit", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["agreementStartDate"] = "2026-12-31",
            ["agreementEndDate"] = "2026-01-01"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-no-approval", "Dorm.ChannelProductEligibilityBind", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["agreementApproved"] = "false",
            ["approvalRecordBound"] = "false",
            ["approvalState"] = "协议待审核"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-expired", "Dorm.ChannelPublicationRuleConfigure", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["agreementExpired"] = "true"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-inactive-product", "Dorm.ChannelProductEligibilityBind", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["inactiveProduct"] = "true"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-missing-price", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["missingEffectivePrice"] = "true",
            ["effectivePriceBound"] = "false",
            ["effectivePriceVersionBound"] = "false",
            ["priceVersionDisplay"] = ""
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-operation-blocked", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["operationBlocked"] = "true"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-no-eligibility", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["eligibilityValid"] = "false",
            ["agreementEffective"] = "false",
            ["productPriceEligibilityBound"] = "false",
            ["publicationCheckPassed"] = "false"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-no-commission-evidence", "Dorm.CommissionSettlementIntentSubmit", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["commissionEvidenceBound"] = "false",
            ["settlementEvidenceBound"] = "false",
            ["contractEvidenceBound"] = "false",
            ["commissionBasis"] = "",
            ["settlementDescription"] = ""
        })));

        var noProfile = service.ConfirmWorkItem("wi-scenario12-no-profile", Scenario12Request("idem-scenario12-no-profile", "Dorm.ChannelCorporateProfileDraftStart"), OperatorActor(), "req-scenario12-no-profile");
        var noEvidence = service.ConfirmWorkItem("wi-scenario12-no-evidence", Scenario12Request("idem-scenario12-no-evidence", "Dorm.ChannelPublicationEnable"), OperatorActor(), "req-scenario12-no-evidence");
        var badDates = service.ConfirmWorkItem("wi-scenario12-bad-dates", Scenario12Request("idem-scenario12-bad-dates", "Dorm.CorporateAgreementDraftSubmit"), OperatorActor(), "req-scenario12-bad-dates");
        var noApproval = service.ConfirmWorkItem("wi-scenario12-no-approval", Scenario12Request("idem-scenario12-no-approval", "Dorm.ChannelProductEligibilityBind"), OperatorActor(), "req-scenario12-no-approval");
        var expired = service.ConfirmWorkItem("wi-scenario12-expired", Scenario12Request("idem-scenario12-expired", "Dorm.ChannelPublicationRuleConfigure"), OperatorActor(), "req-scenario12-expired");
        var inactive = service.ConfirmWorkItem("wi-scenario12-inactive-product", Scenario12Request("idem-scenario12-inactive-product", "Dorm.ChannelProductEligibilityBind"), OperatorActor(), "req-scenario12-inactive-product");
        var missingPrice = service.ConfirmWorkItem("wi-scenario12-missing-price", Scenario12Request("idem-scenario12-missing-price", "Dorm.ChannelPublicationEnable"), OperatorActor(), "req-scenario12-missing-price");
        var operationBlocked = service.ConfirmWorkItem("wi-scenario12-operation-blocked", Scenario12Request("idem-scenario12-operation-blocked", "Dorm.ChannelPublicationEnable"), OperatorActor(), "req-scenario12-operation-blocked");
        var noEligibility = service.ConfirmWorkItem("wi-scenario12-no-eligibility", Scenario12Request("idem-scenario12-no-eligibility", "Dorm.ChannelPublicationEnable"), OperatorActor(), "req-scenario12-no-eligibility");
        var noCommissionEvidence = service.ConfirmWorkItem("wi-scenario12-no-commission-evidence", Scenario12Request("idem-scenario12-no-commission-evidence", "Dorm.CommissionSettlementIntentSubmit"), OperatorActor(), "req-scenario12-no-commission-evidence");

        Assert.AreEqual("missing_required_business_profile", noProfile.Error);
        Assert.AreEqual("missing_key_evidence", noEvidence.Error);
        Assert.AreEqual("invalid_agreement_date_range", badDates.Error);
        Assert.AreEqual("agreement_approval_required", noApproval.Error);
        Assert.AreEqual("expired_agreement_forbidden", expired.Error);
        Assert.AreEqual("inactive_product_price_forbidden", inactive.Error);
        Assert.AreEqual("missing_effective_price", missingPrice.Error);
        Assert.AreEqual("operation_blocked_publication_forbidden", operationBlocked.Error);
        Assert.AreEqual("channel_publish_requires_valid_eligibility", noEligibility.Error);
        Assert.AreEqual("commission_settlement_evidence_required", noCommissionEvidence.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario12_internal_refs_search_duplicate_concurrency_and_direct_writes_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario12Workspace() },
            definitions: RegistryWith(Scenario12Definition("Dorm.ChannelPublicationEnable")));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-forged-ref", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-readonly", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-duplicate", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-concurrency", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload(new Dictionary<string, string>
        {
            ["currentAgreementVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-direct-rateplan", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-direct-quote", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-direct-inventory", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-direct-ledger", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));
        service.CreateWorkItem(Scenario12WorkItem("wi-scenario12-inline-edit", "Dorm.ChannelPublicationEnable", Scenario12ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario12-forged-ref",
            Scenario12Request("idem-scenario12-forged-ref", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["channelId"] = "channel-forged",
                ["agreementId"] = "agreement-forged",
                ["productId"] = "product-forged",
                ["priceVersionId"] = "price-version-forged"
            }),
            OperatorActor(),
            "req-scenario12-forged-ref");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario12-readonly",
            Scenario12Request("idem-scenario12-readonly", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }),
            OperatorActor(),
            "req-scenario12-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario12-duplicate",
            Scenario12Request("idem-scenario12-duplicate", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["simulateDuplicateSubmission"] = "true"
            }),
            OperatorActor(),
            "req-scenario12-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario12-concurrency",
            Scenario12Request("idem-scenario12-concurrency", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["expectedAgreementVersion"] = "1"
            }),
            OperatorActor(),
            "req-scenario12-concurrency");
        var directRatePlan = service.ConfirmWorkItem(
            "wi-scenario12-direct-rateplan",
            Scenario12Request("idem-scenario12-direct-rateplan", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["directRatePlanTruthWrite"] = "true"
            }),
            OperatorActor(),
            "req-scenario12-direct-rateplan");
        var directQuote = service.ConfirmWorkItem(
            "wi-scenario12-direct-quote",
            Scenario12Request("idem-scenario12-direct-quote", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["generateQuoteOrReservation"] = "true"
            }),
            OperatorActor(),
            "req-scenario12-direct-quote");
        var directInventory = service.ConfirmWorkItem(
            "wi-scenario12-direct-inventory",
            Scenario12Request("idem-scenario12-direct-inventory", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["channelPublishLocksInventory"] = "true"
            }),
            OperatorActor(),
            "req-scenario12-direct-inventory");
        var directLedger = service.ConfirmWorkItem(
            "wi-scenario12-direct-ledger",
            Scenario12Request("idem-scenario12-direct-ledger", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["directLedgerWrite"] = "true"
            }),
            OperatorActor(),
            "req-scenario12-direct-ledger");
        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario12-inline-edit",
            Scenario12Request("idem-scenario12-inline-edit", "Dorm.ChannelPublicationEnable", new Dictionary<string, string>
            {
                ["publicationEnabled"] = "true",
                ["inlineEditAttempt"] = "true"
            }),
            OperatorActor(),
            "req-scenario12-inline-edit");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("readonly_result_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_channel_submission", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_channel_conflict", concurrency.Error);
        Assert.AreEqual("direct_rateplan_truth_write_forbidden", directRatePlan.Error);
        Assert.AreEqual("direct_quote_reservation_forbidden", directQuote.Error);
        Assert.AreEqual("direct_inventory_hold_forbidden", directInventory.Error);
        Assert.AreEqual("direct_finance_ledger_forbidden", directLedger.Error);
        Assert.AreEqual("confirmed_agreement_inline_edit_forbidden", inlineEdit.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario13_reporting_audit_review_commands_use_generated_contract_before_commit()
    {
        var commands = new[]
        {
            "Dorm.ReportScopeSelect",
            "Dorm.ReportDataQualityCheck",
            "Dorm.BusinessReportSnapshotGenerate",
            "Dorm.FinanceReviewSnapshotGenerate",
            "Dorm.AuditFindingCreate",
            "Dorm.ReviewConclusionActionPlanCreate",
            "Dorm.ActionPlanCreate",
            "Dorm.IssueTrackingItemCreate",
            "Dorm.ReportPublish",
            "Dorm.ReportExportRecordCreate",
            "Dorm.ReportArchive"
        };
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario13Workspace() },
            definitions: RegistryWith(commands.Select(Scenario13Definition).ToArray()));

        foreach (var command in commands)
        {
            var id = $"wi-scenario13-{command.Replace(".", "-")}";
            service.CreateWorkItem(Scenario13WorkItem(id, command, Scenario13ReadyPayload()));
            var result = service.ConfirmWorkItem(
                id,
                Scenario13Request($"idem-scenario13-{command.Replace(".", "-")}", command),
                OperatorActor(),
                $"req-scenario13-{command.Replace(".", "-")}");

            Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode, command);
            Assert.AreEqual("committed", result.CommitStatus, command);
        }

        Assert.AreEqual(commands.Length, store.DomainEvents.Count);
        Assert.IsEmpty(store.LedgerTransactions);
        Assert.IsEmpty(store.LedgerEntries);
    }

    [TestMethod]
    public void scenario13_reporting_audit_review_blocks_quality_and_finance_failures_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario13Workspace() },
            definitions: RegistryWith(
                Scenario13Definition("Dorm.ReportScopeSelect"),
                Scenario13Definition("Dorm.BusinessReportSnapshotGenerate"),
                Scenario13Definition("Dorm.FinanceReviewSnapshotGenerate"),
                Scenario13Definition("Dorm.AuditFindingCreate"),
                Scenario13Definition("Dorm.ReportPublish")));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-no-scope", "Dorm.ReportScopeSelect", Scenario13ReadyPayload(new Dictionary<string, string>
        {
            ["reportScopeReady"] = "false",
            ["reportName"] = "",
            ["periodStart"] = "",
            ["periodEnd"] = ""
        })));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-no-permission", "Dorm.BusinessReportSnapshotGenerate", Scenario13ReadyPayload(new Dictionary<string, string>
        {
            ["permissionEnvelopeBound"] = "false"
        })));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-no-lineage", "Dorm.BusinessReportSnapshotGenerate", Scenario13ReadyPayload(new Dictionary<string, string>
        {
            ["lineageEnvelopeBound"] = "false"
        })));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-stale", "Dorm.ReportPublish", Scenario13ReadyPayload(new Dictionary<string, string>
        {
            ["staleFreshnessEnvelope"] = "true"
        })));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-ui-metric", "Dorm.BusinessReportSnapshotGenerate", Scenario13ReadyPayload()));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-non-finance", "Dorm.FinanceReviewSnapshotGenerate", Scenario13ReadyPayload()));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-audit-direct-fix", "Dorm.AuditFindingCreate", Scenario13ReadyPayload()));

        var noScope = service.ConfirmWorkItem("wi-scenario13-no-scope", Scenario13Request("idem-scenario13-no-scope", "Dorm.ReportScopeSelect"), OperatorActor(), "req-scenario13-no-scope");
        var noPermission = service.ConfirmWorkItem("wi-scenario13-no-permission", Scenario13Request("idem-scenario13-no-permission", "Dorm.BusinessReportSnapshotGenerate"), OperatorActor(), "req-scenario13-no-permission");
        var noLineage = service.ConfirmWorkItem("wi-scenario13-no-lineage", Scenario13Request("idem-scenario13-no-lineage", "Dorm.BusinessReportSnapshotGenerate"), OperatorActor(), "req-scenario13-no-lineage");
        var stale = service.ConfirmWorkItem("wi-scenario13-stale", Scenario13Request("idem-scenario13-stale", "Dorm.ReportPublish"), OperatorActor(), "req-scenario13-stale");
        var uiMetric = service.ConfirmWorkItem("wi-scenario13-ui-metric", Scenario13Request("idem-scenario13-ui-metric", "Dorm.BusinessReportSnapshotGenerate", new Dictionary<string, string>
        {
            ["uiStateMetricCalculation"] = "true"
        }), OperatorActor(), "req-scenario13-ui-metric");
        var nonFinance = service.ConfirmWorkItem("wi-scenario13-non-finance", Scenario13Request("idem-scenario13-non-finance", "Dorm.FinanceReviewSnapshotGenerate", new Dictionary<string, string>
        {
            ["financeTruthSource"] = "business-runtime"
        }), OperatorActor(), "req-scenario13-non-finance");
        var auditDirectFix = service.ConfirmWorkItem("wi-scenario13-audit-direct-fix", Scenario13Request("idem-scenario13-audit-direct-fix", "Dorm.AuditFindingCreate", new Dictionary<string, string>
        {
            ["auditDirectSourceFix"] = "true"
        }), OperatorActor(), "req-scenario13-audit-direct-fix");

        Assert.AreEqual("missing_report_scope", noScope.Error);
        Assert.AreEqual("missing_permission_envelope", noPermission.Error);
        Assert.AreEqual("missing_lineage_envelope", noLineage.Error);
        Assert.AreEqual("stale_freshness_envelope", stale.Error);
        Assert.AreEqual("ui_state_metric_forbidden", uiMetric.Error);
        Assert.AreEqual("non_finance_gate_truth_forbidden", nonFinance.Error);
        Assert.AreEqual("audit_direct_source_fix_forbidden", auditDirectFix.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void scenario13_internal_refs_search_duplicate_concurrency_and_direct_writes_fail_without_side_effects()
    {
        var service = Service(
            out _,
            out var store,
            workspaces: new[] { Scenario13Workspace() },
            definitions: RegistryWith(Scenario13Definition("Dorm.ReportPublish")));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-forged-ref", "Dorm.ReportPublish", Scenario13ReadyPayload()));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-readonly", "Dorm.ReportPublish", Scenario13ReadyPayload()));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-duplicate", "Dorm.ReportPublish", Scenario13ReadyPayload()));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-concurrency", "Dorm.ReportPublish", Scenario13ReadyPayload(new Dictionary<string, string>
        {
            ["currentReportVersion"] = "2"
        })));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-inline-edit", "Dorm.ReportPublish", Scenario13ReadyPayload()));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-business-write", "Dorm.ReportPublish", Scenario13ReadyPayload()));
        service.CreateWorkItem(Scenario13WorkItem("wi-scenario13-ledger-write", "Dorm.ReportPublish", Scenario13ReadyPayload()));

        var forged = service.ConfirmWorkItem(
            "wi-scenario13-forged-ref",
            Scenario13Request("idem-scenario13-forged-ref", "Dorm.ReportPublish", new Dictionary<string, string>
            {
                ["reportId"] = "report-forged",
                ["metricId"] = "metric-forged",
                ["ledgerEntryId"] = "ledger-forged"
            }),
            OperatorActor(),
            "req-scenario13-forged-ref");
        var readonlyWrite = service.ConfirmWorkItem(
            "wi-scenario13-readonly",
            Scenario13Request("idem-scenario13-readonly", "Dorm.ReportPublish", new Dictionary<string, string>
            {
                ["surface"] = "search"
            }),
            OperatorActor(),
            "req-scenario13-readonly");
        var duplicate = service.ConfirmWorkItem(
            "wi-scenario13-duplicate",
            Scenario13Request("idem-scenario13-duplicate", "Dorm.ReportPublish", new Dictionary<string, string>
            {
                ["simulateDuplicatePublish"] = "true"
            }),
            OperatorActor(),
            "req-scenario13-duplicate");
        var concurrency = service.ConfirmWorkItem(
            "wi-scenario13-concurrency",
            Scenario13Request("idem-scenario13-concurrency", "Dorm.ReportPublish", new Dictionary<string, string>
            {
                ["expectedReportVersion"] = "1"
            }),
            OperatorActor(),
            "req-scenario13-concurrency");
        var inlineEdit = service.ConfirmWorkItem(
            "wi-scenario13-inline-edit",
            Scenario13Request("idem-scenario13-inline-edit", "Dorm.ReportPublish", new Dictionary<string, string>
            {
                ["reportPublished"] = "true",
                ["inlineEditAttempt"] = "true"
            }),
            OperatorActor(),
            "req-scenario13-inline-edit");
        var businessWrite = service.ConfirmWorkItem(
            "wi-scenario13-business-write",
            Scenario13Request("idem-scenario13-business-write", "Dorm.ReportPublish", new Dictionary<string, string>
            {
                ["directBusinessFactWrite"] = "true"
            }),
            OperatorActor(),
            "req-scenario13-business-write");
        var ledgerWrite = service.ConfirmWorkItem(
            "wi-scenario13-ledger-write",
            Scenario13Request("idem-scenario13-ledger-write", "Dorm.ReportPublish", new Dictionary<string, string>
            {
                ["directLedgerWrite"] = "true"
            }),
            OperatorActor(),
            "req-scenario13-ledger-write");

        Assert.AreEqual("forged_internal_reference", forged.Error);
        Assert.AreEqual("readonly_search_write_attempt", readonlyWrite.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, duplicate.StatusCode);
        Assert.AreEqual("duplicate_report_publish", duplicate.Error);
        Assert.AreEqual(StatusCodes.Status409Conflict, concurrency.StatusCode);
        Assert.AreEqual("concurrent_report_publish_conflict", concurrency.Error);
        Assert.AreEqual("published_report_inline_edit_forbidden", inlineEdit.Error);
        Assert.AreEqual("direct_business_fact_write_forbidden", businessWrite.Error);
        Assert.AreEqual("direct_ledger_fact_write_forbidden", ledgerWrite.Error);
        AssertNoSideEffects(store);
    }

    [TestMethod]
    public void lead_reservation_create_is_rejected_without_generated_policy()
    {
        var service = Service(
            out _,
            out var store,
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

        Assert.AreEqual(StatusCodes.Status400BadRequest, result.StatusCode);
        Assert.AreEqual("unknown_field_key", result.Error);
        Assert.AreEqual("field_contract_not_resolved", result.Reason);
        Assert.IsNull(cancel);
        Assert.IsNull(convert);
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        Assert.IsEmpty(store.WorkItemEvents);
        Assert.IsEmpty(store.OutboxMessages);
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

    private static ConfirmWorkItemRequest Scenario2Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario2WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario2DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s3",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario2ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["baseReadySnapshotRef"] = "br-301-ready",
            ["inspectionRef"] = "insp-301-pass",
            ["currentStatusVersion"] = "1"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario2Definition(string workItemType) =>
        new(
            Scenario2DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario2.ResourceOperationStatus",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario2.ResourceOperationStatus",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "LedgerEntry", "LedgerTransaction", "PaymentFact", "DepositFact", "FinancialFact", "DashboardSummary", "Profile", "SharedReceipt" },
            "field.dormitory.scenario2.generated.v1",
            "evidence.dormitory.scenario2.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario2.generated.v1",
            false,
            "scenario2-generated-runtime-test",
            "场景 2 运行层测试定义；业务规则来自 DormitoryScenario2ResourceOperationStatus.generated.json。");

    private static string Scenario2DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.OperationInspectionConfirm" => "definition.dormitory.scenario2.operationInspectionConfirm.v1",
            "Dorm.OperationStatusChangeConfirm" => "definition.dormitory.scenario2.operationStatusChangeConfirm.v1",
            "Dorm.OperationBlockerUpdate" => "definition.dormitory.scenario2.operationBlockerUpdate.v1",
            "Dorm.OperationRestoreConfirm" => "definition.dormitory.scenario2.operationRestoreConfirm.v1",
            _ => $"definition.dormitory.scenario2.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario2Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario2-resource-operation-status",
            LocalizedText("房源运营就绪与状态维护"),
            LocalizedText("运营检查、状态维护、阻断和恢复确认"),
            new[]
            {
                Scenario2Card("Dorm.OperationInspectionConfirm"),
                Scenario2Card("Dorm.OperationStatusChangeConfirm"),
                Scenario2Card("Dorm.OperationBlockerUpdate"),
                Scenario2Card("Dorm.OperationRestoreConfirm")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario2Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario2Fields("baseReadySnapshotRef", "inspectionRef", "currentStatusVersion"),
                Scenario2Fields(
                    "cleaningInspectionResult",
                    "maintenanceInspectionResult",
                    "safetyInspectionResult",
                    "facilityInspectionResult",
                    "inspectionConclusion",
                    "newOperationStatus",
                    "hasOpenBlocker",
                    "expectedStatusVersion",
                    "targetNextAction",
                    "allBlockersClosed",
                    "recheckResult"),
                Scenario2Fields(
                    "operationStatusId",
                    "inspectionId",
                    "roomId",
                    "bedId",
                    "workItemId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario2Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario2",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario3Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario3WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario3DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s3",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario3ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["operationStatus"] = "可运营",
            ["canEnterPriceMaintenance"] = "true",
            ["operationStatusSnapshotRef"] = "op-301-operable",
            ["currentPriceVersion"] = "1"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario3Definition(string workItemType) =>
        new(
            Scenario3DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario3.ProductAndPricing",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario3.ProductAndPricing",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "LedgerEntry", "LedgerTransaction", "PaymentFact", "DepositFact", "FinancialFact", "Quote", "Reservation", "InventoryHold", "DashboardSummary" },
            "field.dormitory.scenario3.generated.v1",
            "evidence.dormitory.scenario3.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario3.generated.v1",
            false,
            "scenario3-generated-runtime-test",
            "场景 3 运行层测试定义；业务规则来自 DormitoryScenario3ProductAndPricing.generated.json。");

    private static string Scenario3DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.AccommodationProductConfirm" => "definition.dormitory.scenario3.accommodationProductConfirm.v1",
            "Dorm.RatePlanDefinitionConfirm" => "definition.dormitory.scenario3.ratePlanDefinitionConfirm.v1",
            "Dorm.PriceVersionActivate" => "definition.dormitory.scenario3.priceVersionActivate.v1",
            "Dorm.PriceDisable" => "definition.dormitory.scenario3.priceDisable.v1",
            "Dorm.PriceDraftVoid" => "definition.dormitory.scenario3.priceDraftVoid.v1",
            _ => $"definition.dormitory.scenario3.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario3Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario3-product-and-pricing",
            LocalizedText("住宿商品与价格"),
            LocalizedText("商品、价格方案、价格版本和维护确认"),
            new[]
            {
                Scenario3Card("Dorm.AccommodationProductConfirm"),
                Scenario3Card("Dorm.RatePlanDefinitionConfirm"),
                Scenario3Card("Dorm.PriceVersionActivate"),
                Scenario3Card("Dorm.PriceDisable"),
                Scenario3Card("Dorm.PriceDraftVoid")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario3Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario3Fields("operationStatus", "canEnterPriceMaintenance", "operationStatusSnapshotRef", "currentPriceVersion"),
                Scenario3Fields(
                    "productName",
                    "sellableUnit",
                    "resourceBindingSelection",
                    "productEnabled",
                    "basePrice",
                    "currency",
                    "pricingPeriod",
                    "effectiveDate",
                    "expiryDate",
                    "dateRangeConflict",
                    "priceStatus",
                    "editInPlace",
                    "targetNextAction",
                    "expectedPriceVersion",
                    "paymentIntent",
                    "depositIntent",
                    "ledgerIntent",
                    "simulateDuplicateSubmission",
                    "surface"),
                Scenario3Fields(
                    "productId",
                    "ratePlanId",
                    "priceVersionId",
                    "roomId",
                    "bedId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario3Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario3",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario4Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario4WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario4DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s4",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario4ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["productSummary"] = "301 房间整房按晚价",
            ["productRef"] = "product-301-whole-room",
            ["quoteOptionSelection"] = "301 房间整房",
            ["productChoice"] = "301 房间整房",
            ["priceVersionRef"] = "price-version-301-night-v1",
            ["priceStatus"] = "已生效",
            ["canEnterInquiryQuote"] = "true",
            ["operationStatus"] = "可运营",
            ["operationBlockerReason"] = "无",
            ["quoteValidityOption"] = "今晚 20:00",
            ["validUntil"] = "2099-12-31",
            ["priceSnapshot"] = "price-snapshot-301-v1",
            ["currentQuoteVersion"] = "1"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario4Definition(string workItemType) =>
        new(
            Scenario4DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario4.InquiryAndQuote",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario4.InquiryAndQuote",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "LedgerEntry", "LedgerTransaction", "PaymentFact", "DepositFact", "FinancialFact", "InventoryHold", "Reservation", "Stay", "DashboardSummary" },
            "field.dormitory.scenario4.generated.v1",
            "evidence.dormitory.scenario4.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario4.generated.v1",
            false,
            "scenario4-generated-runtime-test",
            "场景 4 运行层测试定义；业务规则来自 DormitoryScenario4InquiryAndQuote.generated.json。");

    private static string Scenario4DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.InquiryRegister" => "definition.dormitory.scenario4.inquiryRegister.v1",
            "Dorm.StayDemandConfirm" => "definition.dormitory.scenario4.stayDemandConfirm.v1",
            "Dorm.QuoteDraftGenerate" => "definition.dormitory.scenario4.quoteDraftGenerate.v1",
            "Dorm.QuoteVersionConfirm" => "definition.dormitory.scenario4.quoteVersionConfirm.v1",
            "Dorm.QuoteSend" => "definition.dormitory.scenario4.quoteSend.v1",
            "Dorm.QuoteClose" => "definition.dormitory.scenario4.quoteClose.v1",
            "Dorm.RequoteCreate" => "definition.dormitory.scenario4.requoteCreate.v1",
            "Dorm.ReservationPreparationStart" => "definition.dormitory.scenario4.reservationPreparationStart.v1",
            _ => $"definition.dormitory.scenario4.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario4Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario4-inquiry-and-quote",
            LocalizedText("询价与报价"),
            LocalizedText("询价登记、需求确认、报价生成、发送和跟进"),
            new[]
            {
                Scenario4Card("Dorm.InquiryRegister"),
                Scenario4Card("Dorm.StayDemandConfirm"),
                Scenario4Card("Dorm.QuoteDraftGenerate"),
                Scenario4Card("Dorm.QuoteVersionConfirm"),
                Scenario4Card("Dorm.QuoteSend"),
                Scenario4Card("Dorm.QuoteClose"),
                Scenario4Card("Dorm.RequoteCreate"),
                Scenario4Card("Dorm.ReservationPreparationStart")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario4Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario4Fields("productSummary", "productRef", "priceVersionRef", "priceStatus", "canEnterInquiryQuote", "operationStatus", "operationBlockerReason", "currentQuoteVersion"),
                Scenario4Fields(
                    "customerName",
                    "contactPhone",
                    "contactMobile",
                    "contactMethod",
                    "contactValue",
                    "customerSource",
                    "checkInDate",
                    "checkOutDate",
                    "guestCount",
                    "quoteOptionSelection",
                    "productChoice",
                    "operationBlocked",
                    "hasOperationBlocker",
                    "blockerOpen",
                    "quoteValidityOption",
                    "validUntil",
                    "validityHours",
                    "discountOverAuthority",
                    "snapshotMismatch",
                    "priceSnapshotMismatch",
                    "quoteExpired",
                    "validityExpired",
                    "quoteStatus",
                    "editInPlace",
                    "inlineEditIssuedQuote",
                    "overwriteIssuedQuote",
                    "targetNextAction",
                    "inventoryHoldIntent",
                    "reservationIntent",
                    "stayIntent",
                    "paymentIntent",
                    "depositIntent",
                    "refundIntent",
                    "ledgerIntent",
                    "simulateDuplicateSubmission",
                    "expectedQuoteVersion",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario4Fields(
                    "inquiryId",
                    "customerId",
                    "quoteId",
                    "quoteVersionId",
                    "productId",
                    "ratePlanId",
                    "roomId",
                    "bedId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario4Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario4",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario5Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario5WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario5DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s5",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario5ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["customerName"] = "张三",
            ["contactPhone"] = "13800000000",
            ["checkInDate"] = "2026-07-10",
            ["checkOutDate"] = "2026-07-12",
            ["guestCount"] = "2",
            ["quoteNo"] = "BJ-20260710-001",
            ["quoteValidUntil"] = "2099-12-31",
            ["quotePriceSnapshot"] = "quote-price-snapshot-301-v1",
            ["quoteSnapshotRef"] = "quote-snapshot-301-v1",
            ["priceSnapshot"] = "price-snapshot-301-v1",
            ["priceVersionRef"] = "price-version-301-night-v1",
            ["priceStatus"] = "已生效",
            ["operationStatus"] = "可运营",
            ["operationBlockerReason"] = "无",
            ["resourceAvailability"] = "可订",
            ["holdUntil"] = "2099-12-31",
            ["holdDurationOption"] = "30 分钟",
            ["holdStatus"] = "已锁定",
            ["inventoryHoldActive"] = "true",
            ["inventoryHoldSummary"] = "301 房间已锁定至 20:00",
            ["currentReservationVersion"] = "1",
            ["currentHoldVersion"] = "1"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario5Definition(string workItemType) =>
        new(
            Scenario5DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario5.ReservationAndInventoryHold",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario5.ReservationAndInventoryHold",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "LedgerEntry", "LedgerTransaction", "PaymentFact", "DepositFact", "FinancialFact", "Stay", "CheckIn", "DashboardSummary" },
            "field.dormitory.scenario5.generated.v1",
            "evidence.dormitory.scenario5.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario5.generated.v1",
            false,
            "scenario5-generated-runtime-test",
            "场景 5 运行层测试定义；业务规则来自 DormitoryScenario5ReservationAndInventoryHold.generated.json。");

    private static string Scenario5DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.BookingPreparationStart" => "definition.dormitory.scenario5.bookingPreparationStart.v1",
            "Dorm.AvailabilityRecheck" => "definition.dormitory.scenario5.availabilityRecheck.v1",
            "Dorm.InventoryHoldCreate" => "definition.dormitory.scenario5.inventoryHoldCreate.v1",
            "Dorm.InventoryHoldRelease" => "definition.dormitory.scenario5.inventoryHoldRelease.v1",
            "Dorm.InventoryHoldExpire" => "definition.dormitory.scenario5.inventoryHoldExpire.v1",
            "Dorm.ReservationDraftConfirm" => "definition.dormitory.scenario5.reservationDraftConfirm.v1",
            "Dorm.ReservationConfirm" => "definition.dormitory.scenario5.reservationConfirm.v1",
            "Dorm.ReservationSummaryOutput" => "definition.dormitory.scenario5.reservationSummaryOutput.v1",
            _ => $"definition.dormitory.scenario5.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario5Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario5-reservation-and-inventory-hold",
            LocalizedText("预订与库存锁定"),
            LocalizedText("报价承接、可订复核、库存锁定和确认预订"),
            new[]
            {
                Scenario5Card("Dorm.BookingPreparationStart"),
                Scenario5Card("Dorm.AvailabilityRecheck"),
                Scenario5Card("Dorm.InventoryHoldCreate"),
                Scenario5Card("Dorm.InventoryHoldRelease"),
                Scenario5Card("Dorm.InventoryHoldExpire"),
                Scenario5Card("Dorm.ReservationDraftConfirm"),
                Scenario5Card("Dorm.ReservationConfirm"),
                Scenario5Card("Dorm.ReservationSummaryOutput")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario5Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario5Fields("customerName", "contactPhone", "checkInDate", "checkOutDate", "guestCount", "quoteNo", "quoteValidUntil", "quotePriceSnapshot", "quoteSnapshotRef", "priceSnapshot", "priceVersionRef", "priceStatus", "operationStatus", "operationBlockerReason", "resourceAvailability", "holdUntil", "holdStatus", "inventoryHoldSummary", "currentReservationVersion", "currentHoldVersion"),
                Scenario5Fields(
                    "continueReservation",
                    "returnToRequote",
                    "closeReservationPreparation",
                    "resourceChoice",
                    "roomOrBedChoice",
                    "holdDurationOption",
                    "holdMinutes",
                    "lockInventory",
                    "reservationNotes",
                    "customerConfirmationMethod",
                    "specialRequestsSupplement",
                    "confirmReservation",
                    "backToEdit",
                    "releaseHold",
                    "viewReservation",
                    "startCheckInPreparation",
                    "quoteExpired",
                    "quoteValidityExpired",
                    "quoteStatus",
                    "dateRangeInvalid",
                    "operationBlocked",
                    "hasOperationBlocker",
                    "blockerOpen",
                    "priceEffective",
                    "quotePriceStillValid",
                    "stayOccupied",
                    "occupiedByStay",
                    "resourceOccupancyStatus",
                    "reservationExists",
                    "reservedByOther",
                    "resourceReservationStatus",
                    "resourceLocked",
                    "lockedByOther",
                    "activeHoldExists",
                    "resourceHoldStatus",
                    "resourceUnavailable",
                    "resourceOccupied",
                    "concurrentHoldConflict",
                    "simulateConcurrentHold",
                    "atomicLockConflict",
                    "inventoryHoldActive",
                    "hasInventoryHold",
                    "holdExpired",
                    "inventoryHoldExpired",
                    "snapshotMismatch",
                    "priceSnapshotMismatch",
                    "priceSnapshotStatus",
                    "paymentIntent",
                    "depositIntent",
                    "refundIntent",
                    "ledgerIntent",
                    "checkInIntent",
                    "stayIntent",
                    "targetNextAction",
                    "simulateDuplicateSubmission",
                    "expectedReservationVersion",
                    "expectedHoldVersion",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario5Fields(
                    "bookingRequestId",
                    "inventoryHoldId",
                    "holdId",
                    "reservationId",
                    "reservationNo",
                    "quoteId",
                    "productId",
                    "ratePlanId",
                    "roomId",
                    "bedId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario5Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario5",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario6Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario6WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario6DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s6",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario6ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["reservationConfirmed"] = "true",
            ["reservationStatus"] = "已预订",
            ["reservationNo"] = "YD-20260710-001",
            ["customerName"] = "张三",
            ["contactPhone"] = "13800000000",
            ["checkInDate"] = "2026-07-10",
            ["checkOutDate"] = "2026-07-12",
            ["guestCount"] = "2",
            ["roomOrBedSummary"] = "1 号楼 3 层 301 房间",
            ["priceSnapshot"] = "price-snapshot-301-v1",
            ["priceSnapshotRef"] = "price-snapshot-301-v1",
            ["reservationPriceSnapshot"] = "reservation-price-snapshot-301-v1",
            ["quotePriceSnapshot"] = "quote-price-snapshot-301-v1",
            ["quoteVersionRef"] = "quote-version-301-v1",
            ["depositPolicyRef"] = "deposit-policy-301-v1",
            ["amountSource"] = "priceSnapshot",
            ["requirementSource"] = "priceSnapshot",
            ["expectedCurrency"] = "CNY",
            ["currency"] = "CNY",
            ["receivedAmount"] = "540",
            ["depositAmount"] = "300",
            ["financeConfirmedAmount"] = "540",
            ["amount"] = "540",
            ["depositOption"] = "押金",
            ["guaranteeRequired"] = "false",
            ["guaranteeValidUntil"] = "2026-08-10",
            ["currentFinanceVersion"] = "1",
            ["currentRequirementVersion"] = "1",
            ["actorRole"] = "operator"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario6Definition(string workItemType) =>
        new(
            Scenario6DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario6.PaymentDepositAndGuarantee",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario6.PaymentDepositAndGuarantee",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "LedgerEntry", "LedgerTransaction", "PaymentFact", "DepositFact", "FinancialFact", "Stay", "CheckIn", "Checkout", "Refund", "InventoryHold", "DashboardSummary" },
            "field.dormitory.scenario6.generated.v1",
            "evidence.dormitory.scenario6.generated.v1",
            "risk.standard.v1",
            "ledger.finance_gate_only.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario6.generated.v1",
            false,
            "scenario6-generated-runtime-test",
            "场景 6 运行层测试定义；业务规则来自 DormitoryScenario6PaymentDepositAndGuarantee.generated.json。");

    private static string Scenario6DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.PaymentDepositCaseStart" => "definition.dormitory.scenario6.paymentDepositCaseStart.v1",
            "Dorm.PaymentDepositRequirementConfirm" => "definition.dormitory.scenario6.paymentDepositRequirementConfirm.v1",
            "Dorm.PaymentReceiptSubmit" => "definition.dormitory.scenario6.paymentReceiptSubmit.v1",
            "Dorm.DepositGuaranteeSubmit" => "definition.dormitory.scenario6.depositGuaranteeSubmit.v1",
            "Dorm.FinanceReviewRequest" => "definition.dormitory.scenario6.financeReviewRequest.v1",
            "Dorm.FinanceGateConfirm" => "definition.dormitory.scenario6.financeGateConfirm.v1",
            "Dorm.FinanceGateReturn" => "definition.dormitory.scenario6.financeGateReturn.v1",
            "Dorm.FinanceEvidenceSupplement" => "definition.dormitory.scenario6.financeEvidenceSupplement.v1",
            "Dorm.FinanceReadySummaryOutput" => "definition.dormitory.scenario6.financeReadySummaryOutput.v1",
            _ => $"definition.dormitory.scenario6.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario6Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario6-payment-deposit-and-guarantee",
            LocalizedText("收款、押金与担保"),
            LocalizedText("承接确认预订，提交收款凭证、押金或担保并进入财务确认"),
            new[]
            {
                Scenario6Card("Dorm.PaymentDepositCaseStart"),
                Scenario6Card("Dorm.PaymentDepositRequirementConfirm"),
                Scenario6Card("Dorm.PaymentReceiptSubmit"),
                Scenario6Card("Dorm.DepositGuaranteeSubmit"),
                Scenario6Card("Dorm.FinanceReviewRequest"),
                Scenario6Card("Dorm.FinanceGateConfirm"),
                Scenario6Card("Dorm.FinanceGateReturn"),
                Scenario6Card("Dorm.FinanceEvidenceSupplement"),
                Scenario6Card("Dorm.FinanceReadySummaryOutput")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario6Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario6Fields("reservationConfirmed", "reservationStatus", "reservationNo", "customerName", "contactPhone", "checkInDate", "checkOutDate", "guestCount", "roomOrBedSummary", "priceSnapshot", "priceSnapshotRef", "reservationPriceSnapshot", "quotePriceSnapshot", "quoteVersionRef", "depositPolicyRef", "expectedCurrency", "currentFinanceVersion", "currentRequirementVersion"),
                Scenario6Fields(
                    "startPaymentDepositProcessing",
                    "amountSource",
                    "requirementSource",
                    "currency",
                    "receivedAmount",
                    "depositAmount",
                    "financeConfirmedAmount",
                    "amount",
                    "depositOption",
                    "guaranteeRequired",
                    "guaranteeValidUntil",
                    "preAuthorizationValidUntil",
                    "reservationCancelled",
                    "manualFinalFinanceTruth",
                    "userOverridesFinanceTruth",
                    "currencyMismatch",
                    "depositAsIncome",
                    "depositMarkedIncome",
                    "depositAccountingCategory",
                    "guaranteeAsPayment",
                    "guaranteeMarkedPaid",
                    "preAuthorizationAsPayment",
                    "guaranteeStatus",
                    "inlineEditSubmittedEvidence",
                    "overwriteSubmittedEvidence",
                    "financeStatus",
                    "inlineEditAttempt",
                    "inlineEditConfirmedFinance",
                    "viaFinanceGate",
                    "financeGateTask",
                    "actorRole",
                    "authorizedFinanceRole",
                    "financeRole",
                    "ledgerWriteAttempt",
                    "directLedgerWrite",
                    "bypassFinanceGate",
                    "checkInIntent",
                    "stayIntent",
                    "directCheckInAttempt",
                    "targetNextAction",
                    "simulateDuplicateSubmission",
                    "idempotencyAlreadyProcessed",
                    "expectedFinanceVersion",
                    "expectedRequirementVersion",
                    "expectedVersion",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario6Fields(
                    "paymentId",
                    "depositId",
                    "guaranteeId",
                    "ledgerEntryId",
                    "ledgerTransactionId",
                    "reservationId",
                    "paymentCaseId",
                    "financeReviewRequestId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario6Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario6",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario7Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario7WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario7DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s7",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario7ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["reservationConfirmed"] = "true",
            ["validReservation"] = "true",
            ["reservationStatus"] = "已预订",
            ["reservationNo"] = "R202606200001",
            ["customerName"] = "张三",
            ["contactPhone"] = "13800000000",
            ["checkInDate"] = "2026-07-10",
            ["checkOutDate"] = "2026-07-12",
            ["guestCount"] = "1",
            ["roomOrBedSummary"] = "1 号楼 3 层 301 房间 / 床位 01",
            ["priceSnapshot"] = "price-snapshot-301-v1",
            ["financeStatus"] = "财务已确认",
            ["financeReady"] = "true",
            ["depositStatus"] = "押金已确认",
            ["guaranteeStatus"] = "担保已确认",
            ["resourceAvailability"] = "可入住",
            ["resourceAvailableForCheckIn"] = "true",
            ["resourceStatus"] = "可运营",
            ["resourceCleaned"] = "true",
            ["identityVerificationResult"] = "通过",
            ["identityEvidenceBound"] = "true",
            ["guestMatchesReservation"] = "true",
            ["agreementConfirmed"] = "true",
            ["agreementStatus"] = "已确认",
            ["handoverConfirmed"] = "true",
            ["currentOccupancyVersion"] = "1",
            ["currentStayVersion"] = "1",
            ["actorRole"] = "operator"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario7Definition(string workItemType) =>
        new(
            Scenario7DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario7.CheckInProcessing",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario7.CheckInProcessing",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "CheckoutCase", "DashboardSummary" },
            "field.dormitory.scenario7.generated.v1",
            "evidence.dormitory.scenario7.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario7.generated.v1",
            false,
            "scenario7-generated-runtime-test",
            "场景 7 运行层测试定义；业务规则来自 DormitoryScenario7CheckInProcessing.generated.json。");

    private static string Scenario7DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.CheckInDraftStart" => "definition.dormitory.scenario7.checkInDraftStart.v1",
            "Dorm.GuestIdentityVerify" => "definition.dormitory.scenario7.guestIdentityVerify.v1",
            "Dorm.CheckInAgreementFinanceReview" => "definition.dormitory.scenario7.checkInAgreementFinanceReview.v1",
            "Dorm.RoomBedHandoverRecheck" => "definition.dormitory.scenario7.roomBedHandoverRecheck.v1",
            "Dorm.StayConfirm" => "definition.dormitory.scenario7.stayConfirm.v1",
            "Dorm.StayCredentialIssue" => "definition.dormitory.scenario7.stayCredentialIssue.v1",
            "Dorm.CheckInManualReviewRequest" => "definition.dormitory.scenario7.checkInManualReviewRequest.v1",
            "Dorm.CheckInCorrectionRequest" => "definition.dormitory.scenario7.checkInCorrectionRequest.v1",
            _ => $"definition.dormitory.scenario7.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario7Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario7-check-in-processing",
            LocalizedText("入住办理"),
            LocalizedText("承接确认预订，核验身份、协议、财务摘要和房间床位交付后确认入住"),
            new[]
            {
                Scenario7Card("Dorm.CheckInDraftStart"),
                Scenario7Card("Dorm.GuestIdentityVerify"),
                Scenario7Card("Dorm.CheckInAgreementFinanceReview"),
                Scenario7Card("Dorm.RoomBedHandoverRecheck"),
                Scenario7Card("Dorm.StayConfirm"),
                Scenario7Card("Dorm.StayCredentialIssue"),
                Scenario7Card("Dorm.CheckInManualReviewRequest"),
                Scenario7Card("Dorm.CheckInCorrectionRequest")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario7Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario7Fields("reservationConfirmed", "validReservation", "reservationStatus", "reservationNo", "customerName", "contactPhone", "checkInDate", "checkOutDate", "guestCount", "roomOrBedSummary", "priceSnapshot", "financeStatus", "financeReady", "depositStatus", "guaranteeStatus", "resourceAvailability", "resourceStatus", "currentOccupancyVersion", "currentStayVersion"),
                Scenario7Fields(
                    "startCheckInProcessing",
                    "reservationCancelled",
                    "reservationExpired",
                    "reservationAlreadyConverted",
                    "reservationConvertedToStay",
                    "managerExceptionApproval",
                    "managerExceptionRequested",
                    "exceptionCheckIn",
                    "authorizedManager",
                    "managerApproved",
                    "managerExceptionEvidenceBound",
                    "identityEvidenceBound",
                    "identityDocumentBound",
                    "identityVerificationResult",
                    "identityVerificationFailed",
                    "guestMismatch",
                    "guestMismatchWithReservation",
                    "guestMatchesReservation",
                    "guestMismatchApproved",
                    "guestMismatchApprovalEvidence",
                    "agreementConfirmed",
                    "agreementStatus",
                    "resourceAvailableForCheckIn",
                    "resourceAvailable",
                    "resourceOccupied",
                    "occupancyExists",
                    "occupancyStatus",
                    "roomBedAvailability",
                    "resourceBlocked",
                    "maintenanceBlocked",
                    "salePaused",
                    "resourceAbnormal",
                    "operationStatus",
                    "stayConfirmed",
                    "stayStatus",
                    "checkInStatus",
                    "inlineEditAttempt",
                    "inlineEditConfirmedStay",
                    "overwriteConfirmedStay",
                    "checkoutIntent",
                    "refundIntent",
                    "paymentIntent",
                    "depositIntent",
                    "ledgerWriteAttempt",
                    "directLedgerWrite",
                    "targetNextAction",
                    "simulateDuplicateSubmission",
                    "idempotencyAlreadyProcessed",
                    "expectedOccupancyVersion",
                    "expectedStayVersion",
                    "expectedVersion",
                    "surface",
                    "readonlyWriteAttempt",
                    "stayNo"),
                Scenario7Fields(
                    "stayId",
                    "residentId",
                    "reservationId",
                    "credentialId",
                    "roomId",
                    "bedId",
                    "occupancyId",
                    "checkInCaseId",
                    "identityVerificationId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario7Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario7",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario8Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario8WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario8DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s8",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario8ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["effectiveStay"] = "true",
            ["stayConfirmed"] = "true",
            ["stayStatus"] = "正常在住",
            ["stayDisplayNo"] = "S202606200001",
            ["residentName"] = "张三",
            ["residentPhone"] = "13800000000",
            ["roomBedSummary"] = "301-02 床位",
            ["checkInDate"] = "2026-07-10",
            ["oldPlannedCheckoutDate"] = "2026-07-20",
            ["currentPlannedCheckoutDate"] = "2026-07-20",
            ["newPlannedCheckoutDate"] = "2026-07-25",
            ["credentialStatus"] = "有效",
            ["financeStatus"] = "财务已确认",
            ["currentOccupancyBound"] = "true",
            ["validOccupancy"] = "true",
            ["occupancyStatus"] = "在住占用",
            ["currentOccupancyVersion"] = "1",
            ["currentStayVersion"] = "1",
            ["targetResourceAvailable"] = "true",
            ["targetBedAvailable"] = "true",
            ["targetResourceAvailability"] = "可换入",
            ["targetResourceStatus"] = "可运营",
            ["targetOccupancyStatus"] = "空置",
            ["actorRole"] = "operator",
            ["factStatus"] = "confirmed"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario8Definition(string workItemType) =>
        new(
            Scenario8DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario8.InStayManagement",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario8.InStayManagement",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "CheckoutSettlement", "CheckoutCase", "RoomRelease", "DashboardSummary" },
            "field.dormitory.scenario8.generated.v1",
            "evidence.dormitory.scenario8.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario8.generated.v1",
            false,
            "scenario8-generated-runtime-test",
            "场景 8 运行层测试定义；业务规则来自 DormitoryScenario8InStayManagement.generated.json。");

    private static string Scenario8DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.StayManagementContextView" => "definition.dormitory.scenario8.stayManagementContextView.v1",
            "Dorm.StayStatusChange" => "definition.dormitory.scenario8.stayStatusChange.v1",
            "Dorm.ResidentServiceRequestRegister" => "definition.dormitory.scenario8.residentServiceRequestRegister.v1",
            "Dorm.ResidentServiceProgressUpdate" => "definition.dormitory.scenario8.residentServiceProgressUpdate.v1",
            "Dorm.ResidentIncidentRegister" => "definition.dormitory.scenario8.residentIncidentRegister.v1",
            "Dorm.ResidentIncidentClose" => "definition.dormitory.scenario8.residentIncidentClose.v1",
            "Dorm.StayExtensionRequestSubmit" => "definition.dormitory.scenario8.stayExtensionRequestSubmit.v1",
            "Dorm.BedTransferRequestSubmit" => "definition.dormitory.scenario8.bedTransferRequestSubmit.v1",
            "Dorm.AccessCredentialStatusChange" => "definition.dormitory.scenario8.accessCredentialStatusChange.v1",
            "Dorm.CheckoutPreparationSnapshotCreate" => "definition.dormitory.scenario8.checkoutPreparationSnapshotCreate.v1",
            "Dorm.StayManagementCorrectionRequest" => "definition.dormitory.scenario8.stayManagementCorrectionRequest.v1",
            _ => $"definition.dormitory.scenario8.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario8Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario8-in-stay-management",
            LocalizedText("在住管理"),
            LocalizedText("承接已确认入住后的在住状态、服务、异常、续住、换房换床、凭证和退房准备"),
            new[]
            {
                Scenario8Card("Dorm.StayManagementContextView"),
                Scenario8Card("Dorm.StayStatusChange"),
                Scenario8Card("Dorm.ResidentServiceRequestRegister"),
                Scenario8Card("Dorm.ResidentServiceProgressUpdate"),
                Scenario8Card("Dorm.ResidentIncidentRegister"),
                Scenario8Card("Dorm.ResidentIncidentClose"),
                Scenario8Card("Dorm.StayExtensionRequestSubmit"),
                Scenario8Card("Dorm.BedTransferRequestSubmit"),
                Scenario8Card("Dorm.AccessCredentialStatusChange"),
                Scenario8Card("Dorm.CheckoutPreparationSnapshotCreate"),
                Scenario8Card("Dorm.StayManagementCorrectionRequest")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario8Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario8Fields("effectiveStay", "stayConfirmed", "stayStatus", "stayDisplayNo", "residentName", "residentPhone", "roomBedSummary", "checkInDate", "oldPlannedCheckoutDate", "currentPlannedCheckoutDate", "credentialStatus", "financeStatus", "currentOccupancyBound", "validOccupancy", "occupancyStatus", "currentOccupancyVersion", "currentStayVersion"),
                Scenario8Fields(
                    "newStatus",
                    "statusNote",
                    "serviceContent",
                    "serviceObject",
                    "urgency",
                    "expectedCompletionTime",
                    "serviceGeneratesPayment",
                    "serviceGeneratesExpense",
                    "expenseIntent",
                    "directExpenseWrite",
                    "incidentDescription",
                    "incidentSeverity",
                    "highRiskIncident",
                    "managerReviewed",
                    "responsiblePersonReviewed",
                    "reviewEvidenceBound",
                    "incidentRefundIntent",
                    "refundIntent",
                    "newPlannedCheckoutDate",
                    "extensionDateInvalid",
                    "paymentIntent",
                    "depositIntent",
                    "directPaymentWrite",
                    "financeFactWriteAttempt",
                    "targetResourceAvailable",
                    "targetBedAvailable",
                    "targetResourceAvailability",
                    "targetResourceStatus",
                    "targetBedOccupied",
                    "targetOccupancyExists",
                    "targetOccupancyStatus",
                    "targetResourceBlocked",
                    "targetMaintenanceBlocked",
                    "targetSalePaused",
                    "targetResourceAbnormal",
                    "credentialAction",
                    "checkoutCompleted",
                    "alreadyCheckedOut",
                    "releaseRoom",
                    "roomReleaseIntent",
                    "resourceReleaseIntent",
                    "checkoutSettlementIntent",
                    "settlementIntent",
                    "checkoutIntent",
                    "ledgerWriteAttempt",
                    "directLedgerWrite",
                    "targetNextAction",
                    "simulateDuplicateSubmission",
                    "idempotencyAlreadyProcessed",
                    "expectedOccupancyVersion",
                    "expectedTransferVersion",
                    "expectedStayVersion",
                    "expectedVersion",
                    "actorRole",
                    "role",
                    "unauthorizedAction",
                    "rolePermissionDenied",
                    "factStatus",
                    "confirmedFact",
                    "stayStatusConfirmed",
                    "inlineEditAttempt",
                    "editInPlace",
                    "overwriteConfirmedFact",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario8Fields(
                    "stayId",
                    "occupancyId",
                    "credentialId",
                    "serviceRequestId",
                    "incidentId",
                    "roomId",
                    "bedId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario8Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario8",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario9Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario9WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario9DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s9",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario9ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["effectiveStay"] = "true",
            ["stayConfirmed"] = "true",
            ["stayStatus"] = "正常在住",
            ["stayDisplayNo"] = "S202606200001",
            ["residentName"] = "张三",
            ["residentPhone"] = "13800000000",
            ["roomBedSummary"] = "301-02 床位",
            ["checkInDate"] = "2026-06-10",
            ["plannedCheckoutDate"] = "2026-06-16",
            ["currentOccupancyBound"] = "true",
            ["validOccupancy"] = "true",
            ["occupancyStatus"] = "在住占用",
            ["currentCheckoutVersion"] = "1",
            ["currentOccupancyVersion"] = "1",
            ["actualCheckoutAt"] = "2026-06-16T10:00:00",
            ["handoverType"] = "本人办理",
            ["handoverNote"] = "客户本人交接",
            ["handoverEvidenceBound"] = "true",
            ["credentialReturned"] = "true",
            ["credentialReturnStatus"] = "已回收",
            ["inspectionEvidenceBound"] = "true",
            ["checkoutInspectionCompleted"] = "true",
            ["damageEvidenceBound"] = "true",
            ["feeSourceValid"] = "true",
            ["priceSnapshotBound"] = "true",
            ["financeSnapshotBound"] = "true",
            ["customerConfirmedSettlement"] = "true",
            ["customerConfirmationStatus"] = "客户确认",
            ["resourceRecoveryTargetStatus"] = "待保洁",
            ["actorRole"] = "operator",
            ["factStatus"] = "draft"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario9Definition(string workItemType) =>
        new(
            Scenario9DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario9.CheckoutSettlement",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario9.CheckoutSettlement",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "RoomOperationStatus=可运营", "DashboardSummary" },
            "field.dormitory.scenario9.generated.v1",
            "evidence.dormitory.scenario9.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario9.generated.v1",
            false,
            "scenario9-generated-runtime-test",
            "场景 9 运行层测试定义；业务规则来自 DormitoryScenario9CheckoutSettlement.generated.json。");

    private static string Scenario9DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.CheckoutCaseDraftStart" => "definition.dormitory.scenario9.checkoutCaseDraftStart.v1",
            "Dorm.CheckoutHandoverConfirm" => "definition.dormitory.scenario9.checkoutHandoverConfirm.v1",
            "Dorm.CheckoutInspectionConfirm" => "definition.dormitory.scenario9.checkoutInspectionConfirm.v1",
            "Dorm.CheckoutFeeCalculationGenerate" => "definition.dormitory.scenario9.checkoutFeeCalculationGenerate.v1",
            "Dorm.CustomerSettlementConfirm" => "definition.dormitory.scenario9.customerSettlementConfirm.v1",
            "Dorm.CheckoutConfirm" => "definition.dormitory.scenario9.checkoutConfirm.v1",
            "Dorm.CheckoutFinanceRequestCreate" => "definition.dormitory.scenario9.checkoutFinanceRequestCreate.v1",
            "Dorm.ResourceRecoveryRequestCreate" => "definition.dormitory.scenario9.resourceRecoveryRequestCreate.v1",
            "Dorm.CheckoutCorrectionRequest" => "definition.dormitory.scenario9.checkoutCorrectionRequest.v1",
            _ => $"definition.dormitory.scenario9.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario9Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario9-checkout-settlement",
            LocalizedText("退房结算"),
            LocalizedText("承接有效在住记录后的退房、交接、验房、费用核算、客户确认、财务处理请求和资源恢复请求"),
            new[]
            {
                Scenario9Card("Dorm.CheckoutCaseDraftStart"),
                Scenario9Card("Dorm.CheckoutHandoverConfirm"),
                Scenario9Card("Dorm.CheckoutInspectionConfirm"),
                Scenario9Card("Dorm.CheckoutFeeCalculationGenerate"),
                Scenario9Card("Dorm.CustomerSettlementConfirm"),
                Scenario9Card("Dorm.CheckoutConfirm"),
                Scenario9Card("Dorm.CheckoutFinanceRequestCreate"),
                Scenario9Card("Dorm.ResourceRecoveryRequestCreate"),
                Scenario9Card("Dorm.CheckoutCorrectionRequest")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario9Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario9Fields("effectiveStay", "stayConfirmed", "stayStatus", "stayDisplayNo", "residentName", "residentPhone", "roomBedSummary", "checkInDate", "plannedCheckoutDate", "currentOccupancyBound", "validOccupancy", "occupancyStatus", "currentCheckoutVersion", "currentOccupancyVersion", "checkoutStatus", "credentialReturnStatus", "customerConfirmationStatus", "resourceRecoveryTargetStatus"),
                Scenario9Fields(
                    "actualCheckoutAt",
                    "actualCheckoutTime",
                    "handoverType",
                    "handoverNote",
                    "handoverEvidenceBound",
                    "abnormalCheckoutNote",
                    "credentialReturned",
                    "credentialReturnRecorded",
                    "credentialExceptionExplained",
                    "credentialExceptionNote",
                    "inspectionEvidenceBound",
                    "roomInspectionEvidenceBound",
                    "checkoutInspectionCompleted",
                    "hasDamage",
                    "hasLostItem",
                    "inspectionResult",
                    "damageDescription",
                    "lostItemDescription",
                    "damageEvidenceBound",
                    "feeSourceValid",
                    "feeSourceInvalid",
                    "priceSnapshotBound",
                    "financeSnapshotBound",
                    "authorizedAdjustmentBound",
                    "finalLedgerTruthInput",
                    "manualLedgerTruth",
                    "ledgerEntryConfirmed",
                    "customerConfirmedSettlement",
                    "customerSettlementConfirmed",
                    "confirmationStatus",
                    "hasDispute",
                    "customerRejected",
                    "directRefund",
                    "directTopUpCollection",
                    "paymentConfirmed",
                    "refundConfirmed",
                    "restoreOperationalDirectly",
                    "resourceOperationalConfirmed",
                    "markRoomOperational",
                    "targetOperationStatus",
                    "directPaymentWrite",
                    "directRefundWrite",
                    "directLedgerWrite",
                    "ledgerWriteAttempt",
                    "paymentFactWriteAttempt",
                    "refundFactWriteAttempt",
                    "highRiskIncidentBlocksCheckout",
                    "checkoutBlockedByIncident",
                    "incidentRiskLevel",
                    "riskLevel",
                    "simulateDuplicateSubmission",
                    "idempotencyAlreadyProcessed",
                    "expectedCheckoutVersion",
                    "expectedOccupancyVersion",
                    "expectedStayVersion",
                    "expectedVersion",
                    "actorRole",
                    "role",
                    "unauthorizedAction",
                    "rolePermissionDenied",
                    "factStatus",
                    "confirmedCheckout",
                    "checkoutConfirmed",
                    "inlineEditAttempt",
                    "editInPlace",
                    "overwriteConfirmedFact",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario9Fields(
                    "stayId",
                    "checkoutCaseId",
                    "settlementId",
                    "refundId",
                    "ledgerEntryId",
                    "roomId",
                    "bedId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId",
                    "paymentId",
                    "ledgerTransactionId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario9Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario9",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario10Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario10WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario10DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s10",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario10ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["effectiveReservation"] = "true",
            ["reservationConfirmed"] = "true",
            ["reservationStatus"] = "已预订",
            ["reservationDisplayNo"] = "R202606200001",
            ["customerName"] = "张三",
            ["customerPhone"] = "13800000000",
            ["roomBedSummary"] = "301-02 床位",
            ["stayDateRange"] = "2026-06-20 至 2026-06-25",
            ["priceSnapshotBound"] = "true",
            ["inventoryHoldHistoryBound"] = "true",
            ["paymentDepositSnapshotBound"] = "true",
            ["paymentSummaryBound"] = "true",
            ["depositSummaryBound"] = "true",
            ["financeStatus"] = "已财务确认",
            ["checkInStatus"] = "未入住",
            ["stayStatus"] = "未入住",
            ["checkoutStatus"] = "未退房",
            ["settlementIntentBound"] = "true",
            ["checkoutRefundFollowUp"] = "false",
            ["currentCancellationVersion"] = "1",
            ["currentReservationVersion"] = "1",
            ["noShowHoldTimeElapsed"] = "true",
            ["customerConfirmed"] = "true",
            ["customerConfirmationStatus"] = "客户确认",
            ["customerConfirmationEvidenceBound"] = "true",
            ["policyAmountSourceValid"] = "true",
            ["policySnapshotBound"] = "true",
            ["financeSnapshotBound"] = "true",
            ["inventoryReleaseScopeValid"] = "true",
            ["reservationResourceBound"] = "true",
            ["releasedDateRangeBound"] = "true",
            ["actorRole"] = "operator",
            ["factStatus"] = "draft"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario10Definition(string workItemType) =>
        new(
            Scenario10DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario10.CancelNoShowRefund",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario10.CancelNoShowRefund",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "Stay", "CheckoutCase", "RoomOperationStatus=可运营", "DashboardSummary" },
            "field.dormitory.scenario10.generated.v1",
            "evidence.dormitory.scenario10.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario10.generated.v1",
            false,
            "scenario10-generated-runtime-test",
            "场景 10 运行层测试定义；业务规则来自 DormitoryScenario10CancelNoShowRefund.generated.json。");

    private static string Scenario10DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.CancelNoShowCaseDraftStart" => "definition.dormitory.scenario10.cancelNoShowCaseDraftStart.v1",
            "Dorm.CancellationCaseDraftStart" => "definition.dormitory.scenario10.cancellationCaseDraftStart.v1",
            "Dorm.NoShowCaseDraftStart" => "definition.dormitory.scenario10.noShowCaseDraftStart.v1",
            "Dorm.CancelNoShowReasonCustomerConfirm" => "definition.dormitory.scenario10.reasonCustomerConfirm.v1",
            "Dorm.CancelNoShowPolicyCalculationGenerate" => "definition.dormitory.scenario10.policyCalculationGenerate.v1",
            "Dorm.CancelNoShowInventoryReleaseRequestConfirm" => "definition.dormitory.scenario10.inventoryReleaseRequestConfirm.v1",
            "Dorm.CancelNoShowFinanceProcessingRequestCreate" => "definition.dormitory.scenario10.financeProcessingRequestCreate.v1",
            "Dorm.CancelNoShowConfirmClosure" => "definition.dormitory.scenario10.confirmClosure.v1",
            "Dorm.CancellationConfirm" => "definition.dormitory.scenario10.cancellationConfirm.v1",
            "Dorm.NoShowConfirm" => "definition.dormitory.scenario10.noShowConfirm.v1",
            "Dorm.CancelNoShowDisputeReview" => "definition.dormitory.scenario10.disputeReview.v1",
            "Dorm.CancelNoShowFollowUpRecord" => "definition.dormitory.scenario10.followUpRecord.v1",
            "Dorm.CancelNoShowFinanceEvidenceSupplement" => "definition.dormitory.scenario10.financeEvidenceSupplement.v1",
            "Dorm.CancelNoShowCorrectionRequest" => "definition.dormitory.scenario10.correctionRequest.v1",
            _ => $"definition.dormitory.scenario10.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario10Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario10-cancel-noshow-refund",
            LocalizedText("取消、未到店与退款处理"),
            LocalizedText("承接预订和财务摘要后的取消、未到店、政策金额计算、库存释放、退款/扣费请求和证据留存"),
            new[]
            {
                Scenario10Card("Dorm.CancelNoShowCaseDraftStart"),
                Scenario10Card("Dorm.CancellationCaseDraftStart"),
                Scenario10Card("Dorm.NoShowCaseDraftStart"),
                Scenario10Card("Dorm.CancelNoShowReasonCustomerConfirm"),
                Scenario10Card("Dorm.CancelNoShowPolicyCalculationGenerate"),
                Scenario10Card("Dorm.CancelNoShowInventoryReleaseRequestConfirm"),
                Scenario10Card("Dorm.CancelNoShowFinanceProcessingRequestCreate"),
                Scenario10Card("Dorm.CancelNoShowConfirmClosure"),
                Scenario10Card("Dorm.CancellationConfirm"),
                Scenario10Card("Dorm.NoShowConfirm"),
                Scenario10Card("Dorm.CancelNoShowDisputeReview"),
                Scenario10Card("Dorm.CancelNoShowFollowUpRecord"),
                Scenario10Card("Dorm.CancelNoShowFinanceEvidenceSupplement"),
                Scenario10Card("Dorm.CancelNoShowCorrectionRequest")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario10Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario10Fields("effectiveReservation", "reservationConfirmed", "reservationStatus", "reservationDisplayNo", "customerName", "customerPhone", "roomBedSummary", "stayDateRange", "priceSnapshotBound", "inventoryHoldHistoryBound", "paymentDepositSnapshotBound", "paymentSummaryBound", "depositSummaryBound", "financeStatus", "checkInStatus", "stayStatus", "checkoutStatus", "settlementIntentBound", "currentCancellationVersion", "currentReservationVersion"),
                Scenario10Fields(
                    "checkoutRefundFollowUp",
                    "checkoutSettlementDirection",
                    "alreadyCheckedIn",
                    "effectiveCheckin",
                    "checkInRecordExists",
                    "alreadyCheckedOut",
                    "checkoutCompleted",
                    "alreadyCancelled",
                    "reservationCancelled",
                    "noShowHoldTimeElapsed",
                    "latestHoldTimeElapsed",
                    "customerConfirmed",
                    "customerConfirmationStatus",
                    "customerConfirmationBound",
                    "customerConfirmationEvidenceBound",
                    "hasDispute",
                    "customerRejected",
                    "policyAmountSourceValid",
                    "policyAmountSourceMissing",
                    "policySnapshotBound",
                    "financeSnapshotBound",
                    "manualFinalRefundAmount",
                    "finalRefundManualInput",
                    "manualLedgerTruth",
                    "ledgerEntryConfirmed",
                    "inventoryReleaseScopeValid",
                    "releaseOtherReservationResource",
                    "reservationResourceBound",
                    "releasedDateRangeBound",
                    "directRefund",
                    "directFeeCollection",
                    "paymentConfirmed",
                    "refundConfirmed",
                    "directPaymentWrite",
                    "directRefundWrite",
                    "directLedgerWrite",
                    "ledgerWriteAttempt",
                    "paymentFactWriteAttempt",
                    "refundFactWriteAttempt",
                    "simulateDuplicateSubmission",
                    "idempotencyAlreadyProcessed",
                    "expectedCancellationVersion",
                    "expectedReservationVersion",
                    "expectedVersion",
                    "actorRole",
                    "role",
                    "unauthorizedAction",
                    "rolePermissionDenied",
                    "factStatus",
                    "confirmedCancellation",
                    "closureConfirmed",
                    "inlineEditAttempt",
                    "editInPlace",
                    "overwriteConfirmedFact",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario10Fields(
                    "cancellationCaseId",
                    "refundId",
                    "paymentId",
                    "depositId",
                    "ledgerEntryId",
                    "reservationId",
                    "roomId",
                    "bedId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId",
                    "ledgerTransactionId",
                    "checkoutCaseId",
                    "stayId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario10Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario10",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario11Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario11WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario11DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s11",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario11ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["legalWorkSource"] = "true",
            ["sourceScenario"] = "scenario9",
            ["sourceSummaryBound"] = "true",
            ["operationBlockSummaryBound"] = "true",
            ["serviceRequestSummaryBound"] = "true",
            ["checkoutRecoveryRequestBound"] = "true",
            ["releaseResourceSummaryBound"] = "true",
            ["roomDisplayName"] = "301 房间",
            ["bedDisplayName"] = "301-02 床位",
            ["resourceDisplayName"] = "301 房间 / 301-02 床位",
            ["workScopeBound"] = "true",
            ["resourceScopeBound"] = "true",
            ["assigneeBound"] = "true",
            ["responsiblePerson"] = "王师傅",
            ["actorRole"] = "operator",
            ["workStatus"] = "待验收",
            ["completionSubmitted"] = "true",
            ["workCompleted"] = "true",
            ["completionDescription"] = "保洁和维修已完成",
            ["completionEvidenceBound"] = "true",
            ["completionPhotoBound"] = "true",
            ["verificationPassed"] = "true",
            ["verificationResult"] = "验收通过",
            ["blockReasonResolved"] = "true",
            ["recoveryRecommendation"] = "false",
            ["recoverySuggestion"] = "阻断原因已处理，建议场景包 2 复核运营状态",
            ["outOfServiceReason"] = "设施异常需暂停开放",
            ["riskDescription"] = "需复核安全风险",
            ["expenseEvidenceBound"] = "true",
            ["supplierVoucherBound"] = "true",
            ["expenseBasis"] = "维修单和供应商凭证",
            ["currentWorkVersion"] = "1",
            ["currentVerificationVersion"] = "1",
            ["factStatus"] = "draft"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario11Definition(string workItemType) =>
        new(
            Scenario11DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "RoomOperationStatus=可运营", "Reservation", "Stay", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "DashboardSummary" },
            "field.dormitory.scenario11.generated.v1",
            "evidence.dormitory.scenario11.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario11.generated.v1",
            false,
            "scenario11-generated-runtime-test",
            "场景 11 运行层测试定义；业务规则来自 DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json。");

    private static string Scenario11DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.ServiceWorkCaseDraftStart" => "definition.dormitory.scenario11.serviceWorkCaseDraftStart.v1",
            "Dorm.HousekeepingTaskCreate" => "definition.dormitory.scenario11.housekeepingTaskCreate.v1",
            "Dorm.MaintenanceTaskCreate" => "definition.dormitory.scenario11.maintenanceTaskCreate.v1",
            "Dorm.InspectionTaskCreate" => "definition.dormitory.scenario11.inspectionTaskCreate.v1",
            "Dorm.OutOfServiceRequestDraftStart" => "definition.dormitory.scenario11.outOfServiceRequestDraftStart.v1",
            "Dorm.WorkAssignmentDispatch" => "definition.dormitory.scenario11.workAssignmentDispatch.v1",
            "Dorm.WorkProgressUpdate" => "definition.dormitory.scenario11.workProgressUpdate.v1",
            "Dorm.WorkCompletionSubmit" => "definition.dormitory.scenario11.workCompletionSubmit.v1",
            "Dorm.WorkVerificationConfirm" => "definition.dormitory.scenario11.workVerificationConfirm.v1",
            "Dorm.WorkReworkRequest" => "definition.dormitory.scenario11.workReworkRequest.v1",
            "Dorm.OutOfServiceOrRecoveryRecommendationCreate" => "definition.dormitory.scenario11.outOfServiceOrRecoveryRecommendationCreate.v1",
            "Dorm.ExpenseIntentSubmit" => "definition.dormitory.scenario11.expenseIntentSubmit.v1",
            "Dorm.TaskEvidenceSupplement" => "definition.dormitory.scenario11.taskEvidenceSupplement.v1",
            "Dorm.ServiceWorkCorrectionRequest" => "definition.dormitory.scenario11.serviceWorkCorrectionRequest.v1",
            _ => $"definition.dormitory.scenario11.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario11Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario11-housekeeping-maintenance-outofservice",
            LocalizedText("房务、维修与停售协同"),
            LocalizedText("承接运营阻断、在住服务、退房待恢复和取消释放资源后的房务维修作业闭环"),
            new[]
            {
                Scenario11Card("Dorm.ServiceWorkCaseDraftStart"),
                Scenario11Card("Dorm.HousekeepingTaskCreate"),
                Scenario11Card("Dorm.MaintenanceTaskCreate"),
                Scenario11Card("Dorm.InspectionTaskCreate"),
                Scenario11Card("Dorm.OutOfServiceRequestDraftStart"),
                Scenario11Card("Dorm.WorkAssignmentDispatch"),
                Scenario11Card("Dorm.WorkProgressUpdate"),
                Scenario11Card("Dorm.WorkCompletionSubmit"),
                Scenario11Card("Dorm.WorkVerificationConfirm"),
                Scenario11Card("Dorm.WorkReworkRequest"),
                Scenario11Card("Dorm.OutOfServiceOrRecoveryRecommendationCreate"),
                Scenario11Card("Dorm.ExpenseIntentSubmit"),
                Scenario11Card("Dorm.TaskEvidenceSupplement"),
                Scenario11Card("Dorm.ServiceWorkCorrectionRequest")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario11Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario11Fields("legalWorkSource", "sourceScenario", "sourceSummaryBound", "operationBlockSummaryBound", "serviceRequestSummaryBound", "checkoutRecoveryRequestBound", "releaseResourceSummaryBound", "roomDisplayName", "bedDisplayName", "resourceDisplayName", "workScopeBound", "resourceScopeBound", "assigneeBound", "responsiblePerson", "workStatus", "currentWorkVersion", "currentVerificationVersion"),
                Scenario11Fields(
                    "actorRole",
                    "role",
                    "unauthorizedAction",
                    "rolePermissionDenied",
                    "noLegalSource",
                    "invalidResourceScope",
                    "roomBedScopeMismatch",
                    "crossResourceScopeAttempt",
                    "completionSubmitted",
                    "workCompleted",
                    "completionDescription",
                    "completionEvidenceBound",
                    "completionPhotoBound",
                    "repairOrderBound",
                    "housekeepingRecordBound",
                    "verificationPassed",
                    "verificationFailed",
                    "verificationResult",
                    "reworkCreated",
                    "exceptionCreated",
                    "abnormalPendingCreated",
                    "nextAction",
                    "outOfServiceRecommendation",
                    "recommendationType",
                    "outOfServiceReason",
                    "pauseReason",
                    "riskDescription",
                    "recoveryRecommendation",
                    "unresolvedMaintenance",
                    "outOfServiceUnclosed",
                    "exceptionUnclosed",
                    "blockReasonUnresolved",
                    "blockReasonResolved",
                    "recoverySuggestion",
                    "expenseEvidenceBound",
                    "supplierVoucherBound",
                    "invoiceBound",
                    "quoteBound",
                    "expenseBasis",
                    "directOperationalRestore",
                    "operationStatusWriteAttempt",
                    "setRoomOperational",
                    "resourceOperationalConfirmed",
                    "directLedgerWrite",
                    "ledgerWriteAttempt",
                    "expenseLedgerConfirmed",
                    "paymentFactWriteAttempt",
                    "refundFactWriteAttempt",
                    "simulateDuplicateSubmission",
                    "idempotencyAlreadyProcessed",
                    "expectedWorkVersion",
                    "expectedVerificationVersion",
                    "expectedVersion",
                    "currentVersion",
                    "factStatus",
                    "workAssigned",
                    "workVerified",
                    "inlineEditAttempt",
                    "editInPlace",
                    "overwriteConfirmedFact",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario11Fields(
                    "taskId",
                    "workItemId",
                    "roomId",
                    "bedId",
                    "stayId",
                    "serviceRequestId",
                    "serviceWorkCaseId",
                    "workAssignmentId",
                    "expenseIntentId",
                    "ledgerEntryId",
                    "reservationId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario11Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario11",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario12Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario12WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario12DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s12",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario12ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["businessProfileBound"] = "true",
            ["channelName"] = "携程渠道",
            ["corporateName"] = "某某公司",
            ["businessProfileName"] = "某某公司协议客户",
            ["contactName"] = "李经理",
            ["contactPhone"] = "13800000000",
            ["email"] = "channel@example.test",
            ["actorRole"] = "operator",
            ["keyEvidenceBound"] = "true",
            ["licenseEvidenceBound"] = "true",
            ["agreementEvidenceBound"] = "true",
            ["authorizationEvidenceBound"] = "true",
            ["contractEvidenceBound"] = "true",
            ["agreementStartDate"] = "2026-01-01",
            ["agreementEndDate"] = "2026-12-31",
            ["agreementApproved"] = "true",
            ["approvalRecordBound"] = "true",
            ["approvalState"] = "协议已生效",
            ["agreementEffective"] = "true",
            ["agreementExpired"] = "false",
            ["agreementStatus"] = "协议已生效",
            ["productEffective"] = "true",
            ["priceVersionEffective"] = "true",
            ["effectivePriceBound"] = "true",
            ["effectivePriceVersionBound"] = "true",
            ["priceVersionDisplay"] = "301 整房按晚价",
            ["eligibilityValid"] = "true",
            ["productPriceEligibilityBound"] = "true",
            ["publicationCheckPassed"] = "true",
            ["publicationAction"] = "enable",
            ["publicationStatus"] = "发布已启用",
            ["operationBlocked"] = "false",
            ["maintenanceBlocked"] = "false",
            ["outOfService"] = "false",
            ["stopSale"] = "false",
            ["operationStatus"] = "可运营",
            ["commissionEvidenceBound"] = "true",
            ["settlementEvidenceBound"] = "true",
            ["commissionBasis"] = "协议佣金说明",
            ["settlementDescription"] = "月结说明",
            ["currentChannelVersion"] = "1",
            ["currentAgreementVersion"] = "1",
            ["currentPublicationVersion"] = "1",
            ["factStatus"] = "draft"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario12Definition(string workItemType) =>
        new(
            Scenario12DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario12.ChannelCorporateCustomer",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario12.ChannelCorporateCustomer",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "RatePlan 金额真值", "Quote", "Reservation", "InventoryHold", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "DashboardSummary" },
            "field.dormitory.scenario12.generated.v1",
            "evidence.dormitory.scenario12.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario12.generated.v1",
            false,
            "scenario12-generated-runtime-test",
            "场景 12 运行层测试定义；业务规则来自 DormitoryScenario12ChannelCorporateCustomer.generated.json。");

    private static string Scenario12DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.ChannelCorporateProfileDraftStart" => "definition.dormitory.scenario12.channelCorporateProfileDraftStart.v1",
            "Dorm.ChannelPartnerProfileCreate" => "definition.dormitory.scenario12.channelPartnerProfileCreate.v1",
            "Dorm.CorporateCustomerProfileCreate" => "definition.dormitory.scenario12.corporateCustomerProfileCreate.v1",
            "Dorm.CorporateAgreementDraftSubmit" => "definition.dormitory.scenario12.corporateAgreementDraftSubmit.v1",
            "Dorm.CorporateAgreementApproveActivate" => "definition.dormitory.scenario12.corporateAgreementApproveActivate.v1",
            "Dorm.ChannelProductEligibilityBind" => "definition.dormitory.scenario12.channelProductEligibilityBind.v1",
            "Dorm.ChannelPublicationRuleConfigure" => "definition.dormitory.scenario12.channelPublicationRuleConfigure.v1",
            "Dorm.ChannelPublicationEnable" => "definition.dormitory.scenario12.channelPublicationEnable.v1",
            "Dorm.CommissionSettlementIntentSubmit" => "definition.dormitory.scenario12.commissionSettlementIntentSubmit.v1",
            "Dorm.ChannelCorporateAuditDecision" => "definition.dormitory.scenario12.channelCorporateAuditDecision.v1",
            "Dorm.ChannelPause" => "definition.dormitory.scenario12.channelPause.v1",
            "Dorm.ChannelDisable" => "definition.dormitory.scenario12.channelDisable.v1",
            "Dorm.CorporateAgreementRenew" => "definition.dormitory.scenario12.corporateAgreementRenew.v1",
            "Dorm.ChannelCorporateDailyMaintenance" => "definition.dormitory.scenario12.channelCorporateDailyMaintenance.v1",
            "Dorm.ChannelCorporateEvidenceSupplement" => "definition.dormitory.scenario12.channelCorporateEvidenceSupplement.v1",
            "Dorm.ChannelCorporateCorrectionRequest" => "definition.dormitory.scenario12.channelCorporateCorrectionRequest.v1",
            _ => $"definition.dormitory.scenario12.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario12Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario12-channel-corporate-customer",
            LocalizedText("渠道与企业客户"),
            LocalizedText("维护渠道、企业客户、合作协议、发布规则、佣金结算意向和证据"),
            new[]
            {
                Scenario12Card("Dorm.ChannelCorporateProfileDraftStart"),
                Scenario12Card("Dorm.ChannelPartnerProfileCreate"),
                Scenario12Card("Dorm.CorporateCustomerProfileCreate"),
                Scenario12Card("Dorm.CorporateAgreementDraftSubmit"),
                Scenario12Card("Dorm.CorporateAgreementApproveActivate"),
                Scenario12Card("Dorm.ChannelProductEligibilityBind"),
                Scenario12Card("Dorm.ChannelPublicationRuleConfigure"),
                Scenario12Card("Dorm.ChannelPublicationEnable"),
                Scenario12Card("Dorm.CommissionSettlementIntentSubmit"),
                Scenario12Card("Dorm.ChannelCorporateAuditDecision"),
                Scenario12Card("Dorm.ChannelPause"),
                Scenario12Card("Dorm.ChannelDisable"),
                Scenario12Card("Dorm.CorporateAgreementRenew"),
                Scenario12Card("Dorm.ChannelCorporateDailyMaintenance"),
                Scenario12Card("Dorm.ChannelCorporateEvidenceSupplement"),
                Scenario12Card("Dorm.ChannelCorporateCorrectionRequest")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario12Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario12Fields("businessProfileBound", "channelName", "corporateName", "businessProfileName", "contactName", "contactPhone", "email", "actorRole", "agreementStartDate", "agreementEndDate", "agreementStatus", "currentChannelVersion", "currentAgreementVersion", "currentPublicationVersion"),
                Scenario12Fields(
                    "role",
                    "unauthorizedAction",
                    "rolePermissionDenied",
                    "keyEvidenceBound",
                    "licenseEvidenceBound",
                    "agreementEvidenceBound",
                    "authorizationEvidenceBound",
                    "contractEvidenceBound",
                    "invalidAgreementDates",
                    "agreementDateRangeInvalid",
                    "agreementApproved",
                    "approvalRecordBound",
                    "approvalState",
                    "agreementEffective",
                    "agreementExpired",
                    "productEffective",
                    "priceVersionEffective",
                    "inactiveProduct",
                    "inactivePriceVersion",
                    "missingEffectivePrice",
                    "effectivePriceBound",
                    "effectivePriceVersionBound",
                    "priceVersionDisplay",
                    "eligibilityValid",
                    "productPriceEligibilityBound",
                    "publicationCheckPassed",
                    "publicationAction",
                    "publicationStatus",
                    "operationBlocked",
                    "maintenanceBlocked",
                    "outOfService",
                    "stopSale",
                    "operationStatus",
                    "commissionEvidenceBound",
                    "settlementEvidenceBound",
                    "commissionBasis",
                    "settlementDescription",
                    "simulateDuplicateSubmission",
                    "idempotencyAlreadyProcessed",
                    "expectedChannelVersion",
                    "expectedAgreementVersion",
                    "expectedPublicationVersion",
                    "expectedVersion",
                    "currentVersion",
                    "directRatePlanTruthWrite",
                    "ratePlanTruthWriteAttempt",
                    "priceTruthWriteAttempt",
                    "ratePlanAmount",
                    "directQuoteWrite",
                    "quoteWriteAttempt",
                    "directReservationWrite",
                    "reservationWriteAttempt",
                    "generateQuoteOrReservation",
                    "directInventoryHold",
                    "inventoryHoldWriteAttempt",
                    "lockInventory",
                    "channelPublishLocksInventory",
                    "directLedgerWrite",
                    "ledgerWriteAttempt",
                    "commissionLedgerConfirmed",
                    "settlementLedgerConfirmed",
                    "paymentFactWriteAttempt",
                    "refundFactWriteAttempt",
                    "channelEnabled",
                    "publicationEnabled",
                    "factStatus",
                    "inlineEditAttempt",
                    "editInPlace",
                    "overwriteConfirmedFact",
                    "surface",
                    "readonlyWriteAttempt"),
                Scenario12Fields(
                    "channelId",
                    "corporateAccountId",
                    "agreementId",
                    "productId",
                    "priceVersionId",
                    "ratePlanId",
                    "quoteId",
                    "reservationId",
                    "inventoryHoldId",
                    "paymentId",
                    "refundId",
                    "ledgerEntryId",
                    "ledgerTransactionId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario12Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario12",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static ConfirmWorkItemRequest Scenario13Request(
        string idempotencyKey,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null) =>
        new(
            Language: "zh-CN",
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            IdempotencyKey: idempotencyKey,
            FieldValues: fieldValues ?? new Dictionary<string, string>(),
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static CreateWorkItemRequest Scenario13WorkItem(
        string workItemId,
        string workItemType,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = workItemType,
            ["definitionId"] = Scenario13DefinitionId(workItemType)
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s13",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: workItemType,
            OwnerRole: "operator",
            Payload: values);
    }

    private static IReadOnlyDictionary<string, string> Scenario13ReadyPayload(IReadOnlyDictionary<string, string>? extra = null)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["reportScopeReady"] = "true",
            ["reportName"] = "6 月经营复盘",
            ["reportScopeName"] = "6 月经营复盘",
            ["periodStart"] = "2026-06-01",
            ["periodEnd"] = "2026-06-30",
            ["actorRole"] = "operator",
            ["permissionEnvelopeBound"] = "true",
            ["lineageEnvelopeBound"] = "true",
            ["freshnessEnvelopeBound"] = "true",
            ["freshnessStatus"] = "fresh",
            ["evidenceCompleteness"] = "true",
            ["financeTruthSource"] = "finance-gate",
            ["reportPublished"] = "false",
            ["reportStatus"] = "报表草稿",
            ["currentReportVersion"] = "1"
        };
        foreach (var (key, value) in extra ?? new Dictionary<string, string>())
        {
            values[key] = value;
        }

        return values;
    }

    private static WorkItemDefinition Scenario13Definition(string workItemType) =>
        new(
            Scenario13DefinitionId(workItemType),
            "dormitory",
            "Dormitory.Scenario13.ReportingAuditReview",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            workItemType,
            workItemType,
            "Dormitory.Scenario13.ReportingAuditReview",
            new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    workItemType,
                    true,
                    false,
                    false,
                    true,
                    true,
                    false,
                    "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json")
            },
            new[] { "DomainEvent", "WorkItem" },
            new[] { "Room", "Bed", "OperationStatus", "RatePlan", "Quote", "Reservation", "Stay", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "DashboardSummary" },
            "field.dormitory.scenario13.generated.v1",
            "evidence.dormitory.scenario13.generated.v1",
            "risk.standard.v1",
            "ledger.none.v1",
            "admission.prepare_only_or_l1_observation.v1",
            "surface.dormitory.scenario13.generated.v1",
            false,
            "scenario13-generated-runtime-test",
            "场景 13 运行层测试定义；业务规则来自 DormitoryScenario13ReportingAuditReview.generated.json。");

    private static string Scenario13DefinitionId(string workItemType) =>
        workItemType switch
        {
            "Dorm.ReportScopeSelect" => "definition.dormitory.scenario13.reportScopeSelect.v1",
            "Dorm.ReportDataQualityCheck" => "definition.dormitory.scenario13.reportDataQualityCheck.v1",
            "Dorm.BusinessReportSnapshotGenerate" => "definition.dormitory.scenario13.businessReportSnapshotGenerate.v1",
            "Dorm.FinanceReviewSnapshotGenerate" => "definition.dormitory.scenario13.financeReviewSnapshotGenerate.v1",
            "Dorm.AuditFindingCreate" => "definition.dormitory.scenario13.auditFindingCreate.v1",
            "Dorm.ReviewConclusionActionPlanCreate" => "definition.dormitory.scenario13.reviewConclusionActionPlanCreate.v1",
            "Dorm.ActionPlanCreate" => "definition.dormitory.scenario13.actionPlanCreate.v1",
            "Dorm.IssueTrackingItemCreate" => "definition.dormitory.scenario13.issueTrackingItemCreate.v1",
            "Dorm.ReportPublish" => "definition.dormitory.scenario13.reportPublish.v1",
            "Dorm.ReportExportRecordCreate" => "definition.dormitory.scenario13.reportExportRecordCreate.v1",
            "Dorm.ReportArchive" => "definition.dormitory.scenario13.reportArchive.v1",
            _ => $"definition.dormitory.scenario13.{workItemType}.v1"
        };

    private static WorkspaceProjection Scenario13Workspace() =>
        new(
            "WorkspaceCardProjection",
            AcceptedCapabilityRuntimeProjection.WorkspaceId,
            "stay",
            "task-scenario13-reporting-audit-review",
            LocalizedText("经营报表、审计与复盘"),
            LocalizedText("读取 1-12 和 finance-gate 摘要，生成报表、审计发现、复盘和行动计划"),
            new[]
            {
                Scenario13Card("Dorm.ReportScopeSelect"),
                Scenario13Card("Dorm.ReportDataQualityCheck"),
                Scenario13Card("Dorm.BusinessReportSnapshotGenerate"),
                Scenario13Card("Dorm.FinanceReviewSnapshotGenerate"),
                Scenario13Card("Dorm.AuditFindingCreate"),
                Scenario13Card("Dorm.ReviewConclusionActionPlanCreate"),
                Scenario13Card("Dorm.ActionPlanCreate"),
                Scenario13Card("Dorm.IssueTrackingItemCreate"),
                Scenario13Card("Dorm.ReportPublish"),
                Scenario13Card("Dorm.ReportExportRecordCreate"),
                Scenario13Card("Dorm.ReportArchive")
            },
            LocalizedText("查看合法下一步动作"),
            Array.Empty<BlockerRule>());

    private static CardProjection Scenario13Card(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(
                Scenario13Fields("reportScopeReady", "reportName", "reportScopeName", "periodStart", "periodEnd", "actorRole", "permissionEnvelopeBound", "lineageEnvelopeBound", "freshnessEnvelopeBound", "freshnessStatus", "financeTruthSource", "currentReportVersion"),
                Scenario13Fields(
                    "role",
                    "unauthorizedAction",
                    "rolePermissionDenied",
                    "evidenceCompleteness",
                    "staleFreshnessEnvelope",
                    "dataExpired",
                    "uiStateMetricCalculation",
                    "metricFromUiState",
                    "calculateFromVisiblePage",
                    "nonFinanceGateTruth",
                    "financeTruthFromBusinessRuntime",
                    "paymentTruthFromReport",
                    "ledgerTruthFromReport",
                    "auditDirectSourceFix",
                    "directRoomFix",
                    "directReservationFix",
                    "directLedgerFix",
                    "fixOriginalFactInReport",
                    "reportPublished",
                    "reportStatus",
                    "inlineEditAttempt",
                    "editInPlace",
                    "overwritePublishedReport",
                    "directBusinessFactWrite",
                    "writeRoomBedOperation",
                    "writePriceQuoteReservationStay",
                    "writeOriginalBusinessFact",
                    "modifySourceScenarioFact",
                    "directLedgerWrite",
                    "ledgerWriteAttempt",
                    "paymentDepositRefundWriteAttempt",
                    "writeFinanceFact",
                    "simulateDuplicatePublish",
                    "idempotencyAlreadyProcessed",
                    "expectedReportVersion",
                    "expectedVersion",
                    "currentVersion",
                    "surface",
                    "readonlyWriteAttempt",
                    "searchWriteAttempt"),
                Scenario13Fields(
                    "reportId",
                    "metricId",
                    "ledgerEntryId",
                    "reservationId",
                    "stayId",
                    "roomId",
                    "bedId",
                    "paymentId",
                    "depositId",
                    "refundId",
                    "stableRef",
                    "projectionVersion",
                    "digest",
                    "domainEventId")),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("确认")));

    private static FieldProjection[] Scenario13Fields(params string[] fieldIds) =>
        fieldIds.Select(fieldId => new FieldProjection(
            fieldId,
            LocalizedText(fieldId),
            "business",
            "text",
            false,
            "generated-scenario13",
            true,
            fieldId,
            new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
            LocalizedText(fieldId))).ToArray();

    private static void AssertNoSideEffects(InMemoryOperationsStore store)
    {
        Assert.IsEmpty(store.Submissions);
        Assert.IsEmpty(store.DomainEvents);
        Assert.IsEmpty(store.WorkItemEvents);
        Assert.IsEmpty(store.OutboxMessages);
        Assert.IsEmpty(store.LedgerTransactions);
        Assert.IsEmpty(store.LedgerEntries);
        Assert.IsEmpty(store.WriteLog);
    }

    private static CreateWorkItemRequest AcceptedCapabilityWorkItem(
        string workItemId,
        string workItemType,
        string definitionId,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        var cardId = CurrentMainlineRouteCardId(workItemType);
        var values = new Dictionary<string, string>(payload ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["caseId"] = $"case-{workItemId}",
            ["cardId"] = cardId,
            ["definitionId"] = definitionId,
            ["buildingContextRef"] = "building:tenant-s3:d01"
        };
        return new(
            WorkItemId: workItemId,
            TenantId: "tenant-s3",
            WorkItemType: workItemType,
            WorkspaceId: AcceptedCapabilityRuntimeProjection.WorkspaceId,
            CardId: cardId,
            OwnerRole: "operator",
            Payload: values);
    }

    private static string CurrentMainlineRouteCardId(string workItemType)
    {
        var suffix = workItemType.Split('.', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? string.Empty;
        return string.IsNullOrWhiteSpace(suffix)
            ? workItemType
            : $"cert.{char.ToLowerInvariant(suffix[0])}{suffix[1..]}";
    }

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

    private static WorkspaceProjection StartAdapterWorkspace(string workspaceId, string cardId) =>
        new(
            "WorkspaceCardProjection",
            workspaceId,
            "stay",
            $"task-{workspaceId}",
            LocalizedText("Operations"),
            LocalizedText("Operations"),
            new[] { StartAdapterCard(cardId) },
            LocalizedText("Next"),
            Array.Empty<BlockerRule>());

    private static CardProjection StartAdapterCard(string cardId) =>
        new(
            "WorkspaceCardProjection",
            cardId,
            "ready",
            LocalizedText(cardId),
            new FieldSet(Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>()),
            Array.Empty<EvidenceRequirement>(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            Array.Empty<EventDefinition>(),
            new TransitionDefinition("prepare", "confirm", "block"),
            new ConfirmationPolicy(true, false, "operator", LocalizedText("Confirm")));

    private static IReadOnlyDictionary<string, string> LocalizedText(string value) =>
        new Dictionary<string, string>
        {
            ["zh-CN"] = value,
            ["ru-RU"] = value
        };

    private static WorkItemDefinition Definition(
        string sourceCardId,
        string workItemType,
        string workspaceId,
        string admissionPolicyRef = "admission.prepare_only_or_l1_observation.v1") =>
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
            admissionPolicyRef,
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
