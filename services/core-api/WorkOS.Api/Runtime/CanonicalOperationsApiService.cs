using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace WorkOS.Api.Runtime;

public sealed class CanonicalOperationsApiService
{
    public const string ConfirmCommandType = "operations.work_item.confirm.v1";
    public static readonly SliceCommandHandlerDefinition ConfirmCommandDefinition = new(
        ConfirmCommandType,
        "operations.work-item-confirm",
        "work-item.confirm.v1",
        new[] { "DomainEvent", "WorkItem", "LedgerEntry" },
        new[] { "PaymentFact", "DepositFact", "FinancialFact", "DashboardSummary", "Profile", "SharedReceipt" },
        "balanced-ledger-or-none",
        new[] { "confirm-request.evidenceIds" },
        "OperationsRuntimeProjection",
        "MoneyKernelPack");

    private const string Source = "operations_unit_of_work";
    private const string PayloadFieldValues = "fieldValues";
    private readonly OperationsRuntimeService catalog;
    private readonly OperationsUnitOfWork unitOfWork;
    private readonly OperationsReadStore traces;
    private readonly WorkItemDefinitionRegistryService definitions;
    private readonly AdmissionKernelService admission;

    public CanonicalOperationsApiService(
        OperationsRuntimeService catalog,
        OperationsUnitOfWork unitOfWork,
        OperationsReadStore traces,
        WorkItemDefinitionRegistryService? definitions = null,
        AdmissionKernelService? admission = null)
    {
        this.catalog = catalog;
        this.unitOfWork = unitOfWork;
        this.traces = traces;
        this.definitions = definitions ?? WorkItemDefinitionRegistryService.LoadDefault();
        this.admission = admission ?? new AdmissionKernelService();
    }

    public OperationCase? CreateCase(CreateOperationCaseRequest request) =>
        catalog.CreateCase(request);

    public OperationCase? GetCase(string caseId) =>
        catalog.GetCase(caseId);

    public WorkItem? CreateWorkItem(CreateWorkItemRequest request) =>
        catalog.CreateWorkItem(request);

    public OperationsWorkspaceStartResult StartWorkspaceCase(
        WorkspaceProjection workspace,
        string templateWorkspaceId,
        RuntimeActorContext actor,
        IReadOnlyDictionary<string, string>? anchorPayload = null,
        string? anchorQuery = null)
    {
        var card = workspace.Cards.FirstOrDefault(item => item.Status.Equals("ready", StringComparison.OrdinalIgnoreCase))
            ?? workspace.Cards.FirstOrDefault();
        if (card is null)
        {
            throw new InvalidOperationException("operation_workspace_start_template_has_no_cards");
        }

        var definition = ResolveStartDefinition(templateWorkspaceId, card.Id);
        var routeCardId = RouteCardIdForRuntime(workspace.Id, definition.Definition, card.Id);
        var ownerRole = FirstNonEmpty(card.Confirmation.RequiredRole, actor.Role, "operator");
        var admissionDecision = StartAdmissionDecision(definition, actor, ownerRole);
        var operationCase = CreateCase(new CreateOperationCaseRequest(workspace.Id, actor.TenantId, workspace.Id))
            ?? throw new InvalidOperationException("operation_workspace_start_case_not_resolved");
        var createdWorkItem = CreateWorkItem(new CreateWorkItemRequest(
            OperationsWorkItemIdFor(workspace.Id, StartWorkItemIdentityKey(definition, routeCardId)),
            actor.TenantId,
            FirstNonEmpty(definition.Definition?.WorkItemType, card.Id),
            workspace.Id,
            workspace.Id,
            routeCardId,
            ownerRole,
            StartWorkspacePayload(
                workspace,
                templateWorkspaceId,
                routeCardId,
                definition.DefinitionId,
                definition.MigrationRefs,
                operationCase.CaseId,
                actor,
                anchorPayload,
                anchorQuery))) ??
            throw new InvalidOperationException("operation_workspace_start_work_item_not_resolved");
        var workItem = createdWorkItem with
        {
            Admission = admissionDecision.ToContract(),
            AdmissionDecisionRef = admissionDecision.AdmissionDecisionRef
        };

        return new OperationsWorkspaceStartResult(
            workspace,
            operationCase,
            workItem,
            ListWorkItems(actor.TenantId).Select(item => AttachAdmission(item, actor)).ToArray());
    }

    public IReadOnlyList<WorkItem> ListWorkItems(string? tenantId = null, string? caseId = null) =>
        catalog.ListWorkItems(tenantId, caseId);

    public IReadOnlyList<OperationsWorkItemSurface> ListWorkItemSurfaces(string? tenantId = null, string? caseId = null) =>
        catalog.ListWorkItemSurfaces(tenantId, caseId);

    public IReadOnlyList<OperationsWorkItemSurface> ListWorkItemSurfaces(RuntimeActorContext actor, string? caseId = null) =>
        catalog.ListWorkItemSurfaces(actor.TenantId, caseId)
            .Select(item => AttachAdmission(item, actor))
            .ToArray();

    public WorkItem? GetWorkItem(string workItemId) =>
        catalog.GetWorkItem(workItemId);

    public OperationsWorkItemSurface? GetWorkItemSurface(string workItemId) =>
        catalog.GetWorkItemSurface(workItemId);

    public OperationsWorkItemSurface? GetWorkItemSurface(string workItemId, RuntimeActorContext actor)
    {
        var surface = catalog.GetWorkItemSurface(workItemId);
        return surface is null ? null : AttachAdmission(surface, actor);
    }

    private WorkItem AttachAdmission(WorkItem workItem, RuntimeActorContext actor)
    {
        if (workItem.Admission is not null)
        {
            return workItem;
        }

        var definition = definitions.Resolve(workItem);
        var decision = StartAdmissionDecision(definition, actor, workItem.OwnerRole);
        return workItem with
        {
            Admission = decision.ToContract(),
            AdmissionDecisionRef = decision.AdmissionDecisionRef
        };
    }

    private OperationsWorkItemSurface AttachAdmission(OperationsWorkItemSurface surface, RuntimeActorContext actor)
    {
        if (surface.Admission is not null)
        {
            return surface;
        }

        var workItem = new WorkItem(
            surface.WorkItemId,
            surface.WorkItemType,
            surface.Status,
            surface.CaseId,
            surface.TenantId,
            surface.WorkspaceId,
            surface.OwnerRole,
            surface.Source,
            surface.SourceEventId,
            surface.CreatedAtUtc,
            surface.Payload,
            surface.DefinitionVersionId,
            surface.DueAtUtc,
            surface.Priority,
            surface.RiskLevel,
            surface.IdempotencyScope,
            surface.OwnerActorId,
            surface.BackupOwnerId,
            surface.EscalationOwnerRole,
            surface.RequiredEvidenceRefs,
            surface.AffectedFactRefs);
        var admitted = AttachAdmission(workItem, actor);
        return surface with
        {
            Admission = admitted.Admission,
            AdmissionDecisionRef = admitted.AdmissionDecisionRef
        };
    }

    private AdmissionKernelDecision StartAdmissionDecision(
        WorkItemDefinitionResolution definition,
        RuntimeActorContext actor,
        string? ownerRole)
    {
        if (!definition.Resolved)
        {
            return AdmissionKernelDecision.UnresolvedDefinition(definition);
        }

        return admission.EvaluateConfirm(
            definition,
            actor,
            ownerRole,
            VerifiedDeviceTrustContext.FromServerSession(null, actor.TenantId, "operations-start", null),
            null,
            Array.Empty<string>(),
            false);
    }

    public PrepareWorkItemResult? PrepareWorkItem(string workItemId, PrepareWorkItemRequest request) =>
        catalog.PrepareWorkItem(workItemId, request);

    public ConfirmWorkItemResult ConfirmWorkItem(
        string workItemId,
        ConfirmWorkItemRequest request,
        RuntimeActorContext actor,
        string requestId)
    {
        if (string.IsNullOrWhiteSpace(actor.SessionToken))
        {
            return ConfirmWorkItemResult.Rejected(
                StatusCodes.Status401Unauthorized,
                "actor_session_required",
                "canonical_operations_confirm_requires_actor_token",
                string.Empty,
                workItemId,
                request.SubmissionId,
                request.IdempotencyKey,
                null);
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            return ConfirmWorkItemResult.Rejected(
                StatusCodes.Status422UnprocessableEntity,
                "idempotency_key_required",
                "operations_confirm_requires_idempotency_key",
                string.Empty,
                workItemId,
                request.SubmissionId,
                request.IdempotencyKey,
                null);
        }

        var workItem = catalog.GetWorkItem(workItemId);
        if (workItem is null)
        {
            return ConfirmWorkItemResult.NotFound(workItemId, request.SubmissionId, request.IdempotencyKey, "operation_work_item_not_found");
        }

        var effectiveCardId = FirstNonEmpty(request.CardId, PayloadValue(workItem.Payload, "cardId"), workItem.WorkItemType);
        var normalized = request.Normalize(workItemId, workItem.WorkspaceId, effectiveCardId);
        var caseId = FirstNonEmpty(workItem.CaseId, $"case-{workItem.TenantId}");
        var fieldKeyFailure = ValidateFieldKeys(workItem.WorkItemId, normalized);
        if (!string.IsNullOrWhiteSpace(fieldKeyFailure))
        {
            return ConfirmWorkItemResult.Rejected(
                StatusCodes.Status400BadRequest,
                "unknown_field_key",
                fieldKeyFailure,
                caseId,
                workItem.WorkItemId,
                normalized.SubmissionId,
                normalized.IdempotencyKey,
                null);
        }

        var definition = definitions.Resolve(workItem);
        if (!definition.Resolved)
        {
            var unresolvedDecision = AdmissionKernelDecision.UnresolvedDefinition(definition);
            return ConfirmWorkItemResult.AdmissionRejected(
                caseId,
                workItem.WorkItemId,
                normalized.SubmissionId,
                normalized.IdempotencyKey,
                unresolvedDecision,
                definition,
                StatusCodes.Status422UnprocessableEntity);
        }

        var deviceTrust = VerifiedDeviceTrustContext.FromServerSession(
            normalized.DeviceId,
            actor.TenantId,
            "operations-api",
            catalog.FindDeviceSession(actor.TenantId, normalized.DeviceId));
        var admissionDecision = admission.EvaluateConfirm(
            definition,
            actor,
            workItem.OwnerRole,
            deviceTrust,
            HighRiskReason(normalized),
            normalized.EvidenceIds,
            ProductionRequested(normalized));
        if (!admissionDecision.ConfirmAllowed)
        {
            return ConfirmWorkItemResult.AdmissionRejected(
                caseId,
                workItem.WorkItemId,
                normalized.SubmissionId,
                normalized.IdempotencyKey,
                admissionDecision,
                definition);
        }

        var command = new OperationsCommandRequest(
            workItem.TenantId,
            caseId,
            workItem.WorkItemId,
            ConfirmCommandType,
            "CommandEnvelope.v1",
            definition.DefinitionId,
            normalized.IdempotencyKey!,
            PayloadFor(workItem, normalized, actor, definition, admissionDecision, deviceTrust),
            actor.ActorId,
            $"{workItem.TenantId}:{workItem.WorkItemId}:confirm",
            normalized.SubmissionId,
            requestId);

        var commit = unitOfWork.Commit(command);
        if (commit is { StatusCode: StatusCodes.Status200OK, CommitStatus: "committed", Duplicate: false })
        {
            catalog.RecordWorkItemTransition(
                workItem.TenantId,
                caseId,
                workItem.WorkItemId,
                workItem.Status,
                "confirmed",
                commit.SubmissionId,
                "operations_confirm_committed",
                actor.ActorId);
            DispatchNextOperationWorkItem(
                workItem,
                definition,
                normalized.FieldValues,
                actor,
                caseId);
        }

        return ToConfirmResult(commit, normalized);
    }

    private void DispatchNextOperationWorkItem(
        WorkItem current,
        WorkItemDefinitionResolution currentDefinition,
        IReadOnlyDictionary<string, string>? fieldValues,
        RuntimeActorContext actor,
        string caseId)
    {
        if (IsCorrectionWorkItem(current))
        {
            return;
        }

        var transition = GeneratedTransitionPolicy.ResolveNext(current, currentDefinition, fieldValues);
        if (transition is null)
        {
            return;
        }

        var nextDefinition = definitions.FindByDefinitionId(transition.NextDefinitionId);
        if (nextDefinition is null)
        {
            return;
        }

        var nextCardId = RouteCardIdForRuntime(current.WorkspaceId, nextDefinition, nextDefinition.MigrationSourceCardId);
        catalog.CreateWorkItem(new CreateWorkItemRequest(
            OperationsWorkItemIdFor(current.WorkspaceId, nextDefinition.DefinitionId),
            current.TenantId,
            nextDefinition.WorkItemType,
            current.WorkspaceId,
            current.WorkspaceId,
            nextCardId,
            ConfirmationPolicyCatalog.OwnerRoleForCard(nextCardId),
            new Dictionary<string, string>
            {
                ["caseId"] = caseId,
                ["cardId"] = nextCardId,
                ["definitionId"] = nextDefinition.DefinitionId,
                ["definitionMigrationRefs"] = MigrationRefsJson(nextDefinition.MigrationRefs),
                ["generatedTransitionPolicyId"] = transition.PolicyId,
                ["generatedTransitionSource"] = GeneratedTransitionPolicy.SourceContract,
                ["operationAxis"] = "DomainEvent -> GeneratedTransitionPolicy -> WorkItem",
                ["sourceWorkItemId"] = current.WorkItemId,
                ["ownerRole"] = ConfirmationPolicyCatalog.OwnerRoleForCard(nextCardId),
                ["dispatchedBy"] = "generated_transition_policy"
            }));
    }

    private static string OperationsWorkItemIdFor(string workspaceId, string cardId) =>
        $"wi-{OperationsHash.Short(workspaceId, cardId, "operations-runtime")}";

    private static IReadOnlyDictionary<string, string> StartWorkspacePayload(
        WorkspaceProjection workspace,
        string templateWorkspaceId,
        string cardId,
        string definitionId,
        IReadOnlyList<DefinitionMigrationRef> migrationRefs,
        string caseId,
        RuntimeActorContext actor,
        IReadOnlyDictionary<string, string>? anchorPayload = null,
        string? anchorQuery = null)
    {
        var payload = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["caseId"] = caseId,
            ["cardId"] = cardId,
            ["templateWorkspaceId"] = templateWorkspaceId,
            ["definitionId"] = definitionId,
            ["definitionMigrationRefs"] = MigrationRefsJson(migrationRefs),
            ["operationAxis"] = "Definition -> OperationCase -> WorkItem",
            ["startedByActorId"] = actor.ActorId
        };
        foreach (var (key, value) in DormitoryDirectStartContext(workspace.Id, templateWorkspaceId, cardId, actor, anchorPayload, anchorQuery))
        {
            payload[key] = value;
        }

        return payload;
    }

    private static IReadOnlyDictionary<string, string> DormitoryDirectStartContext(
        string workspaceId,
        string templateWorkspaceId,
        string cardId,
        RuntimeActorContext actor,
        IReadOnlyDictionary<string, string>? anchorPayload = null,
        string? anchorQuery = null)
    {
        if (!IsDormitoryDirectStartContextWorkspace(templateWorkspaceId))
        {
            return new Dictionary<string, string>();
        }

        var anchor = ResolveDormitoryAnchor(anchorPayload, anchorQuery);
        var suffix = OperationsHash.Short(workspaceId, templateWorkspaceId, cardId, anchor.StableKey, "business-anchor-context")[..12];
        var context = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["startContextSource"] = "operations-start-context",
            ["startContextKind"] = "business-anchor-context",
            ["startContextBoundByActorId"] = actor.ActorId,
            ["anchorQuery"] = anchor.Query,
            ["stayId"] = $"stay-{suffix}",
            ["residentId"] = $"resident-{suffix}",
            ["residentName"] = anchor.ResidentName,
            ["phone"] = anchor.Phone,
            ["buildingName"] = anchor.BuildingName,
            ["roomNo"] = anchor.RoomNo,
            ["roomId"] = $"room-d02-22-{suffix}",
            ["bedNo"] = anchor.BedNo,
            ["bedId"] = $"bed-d02-22-01-{suffix}",
            ["bedType"] = anchor.BedType,
            ["bedTypeLabel"] = anchor.BedTypeLabel
        };
        context["roomId"] = $"room-{Slug(anchor.BuildingName)}-{Slug(anchor.RoomNo)}-{suffix}";
        context["bedId"] = $"bed-{Slug(anchor.BuildingName)}-{Slug(anchor.RoomNo)}-{Slug(anchor.BedNo)}-{suffix}";

        if (templateWorkspaceId.Equals("W-STAY-DEPOSIT-LEDGER", StringComparison.OrdinalIgnoreCase))
        {
            context["depositStatus"] = "押金待评估";
        }
        else if (templateWorkspaceId.Equals("W-STAY-PAYMENT-LEDGER", StringComparison.OrdinalIgnoreCase))
        {
            context["paymentStatus"] = "普通收款待登记";
        }
        else if (templateWorkspaceId.Equals("W-STAY-CHECKOUT-SETTLEMENT", StringComparison.OrdinalIgnoreCase))
        {
            context["checkoutStatus"] = "退住待办理";
        }

        return context;
    }

    private static bool IsDormitoryDirectStartContextWorkspace(string templateWorkspaceId) =>
        new[]
        {
            "W-STAY-DEPOSIT-LEDGER",
            "W-STAY-PAYMENT-LEDGER",
            "W-STAY-CHECKOUT-SETTLEMENT"
        }.Contains(templateWorkspaceId, StringComparer.OrdinalIgnoreCase);

    private WorkItemDefinitionResolution ResolveStartDefinition(string templateWorkspaceId, string uiRouteCardId)
    {
        return definitions.ResolveStartAdapter(templateWorkspaceId, uiRouteCardId);
    }

    private static string StartWorkItemIdentityKey(WorkItemDefinitionResolution definition, string routeCardId) =>
        definition.Resolved && !string.IsNullOrWhiteSpace(definition.DefinitionId)
            ? definition.DefinitionId
            : routeCardId;

    private static string RouteCardIdForRuntime(string workspaceId, WorkItemDefinition? definition, string fallbackCardId) =>
        IsAcceptedCapabilityWorkspace(workspaceId) && !string.IsNullOrWhiteSpace(definition?.WorkItemType)
            ? definition.WorkItemType
            : UiRouteCardIdForDefinition(definition, fallbackCardId);

    private static bool IsAcceptedCapabilityWorkspace(string workspaceId) =>
        workspaceId.Equals(AcceptedCapabilityRuntimeProjection.WorkspaceId, StringComparison.OrdinalIgnoreCase) ||
        workspaceId.StartsWith($"{AcceptedCapabilityRuntimeProjection.WorkspaceId}-", StringComparison.OrdinalIgnoreCase);

    private static string UiRouteCardIdForDefinition(WorkItemDefinition? definition, string fallbackCardId) =>
        definition?.DefinitionId switch
        {
            "definition.dormitory.roomSetupConfirm.v1" => "roomSetup",
            "definition.dormitory.bedSetupConfirm.v1" => "bedSetup",
            "definition.dormitory.resourceReadinessConfirm.v1" => "roomReadiness",
            _ => fallbackCardId
        };

    private sealed record DormitoryAnchor(
        string Query,
        string StableKey,
        string ResidentName,
        string Phone,
        string BuildingName,
        string RoomNo,
        string BedNo,
        string BedType,
        string BedTypeLabel);

    private static DormitoryAnchor ResolveDormitoryAnchor(IReadOnlyDictionary<string, string>? payload, string? query)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (payload is not null)
        {
            foreach (var item in payload)
            {
                if (!string.IsNullOrWhiteSpace(item.Value)) values[item.Key] = item.Value.Trim();
            }
        }

        var rawQuery = FirstNonEmpty(query, Value(values, "anchorQuery"), Value(values, "businessAnchor"), Value(values, "phone"), Value(values, "roomNo"), Value(values, "residentName")) ?? "";
        var phone = FirstNonEmpty(Value(values, "phone"), PhoneFromQuery(rawQuery), Digits(rawQuery, 7), "13800001234");
        var roomParts = RoomParts(rawQuery);
        var building = FirstNonEmpty(Value(values, "buildingName"), Value(values, "buildingId"), roomParts.Building, "D02");
        var roomNo = FirstNonEmpty(Value(values, "roomNo"), roomParts.RoomNo, "22");
        var bedNo = FirstNonEmpty(Value(values, "bedNo"), roomParts.BedNo, "01");
        var resident = FirstNonEmpty(Value(values, "residentName"), Value(values, "customerName"), Value(values, "leadName"), NameFromQuery(rawQuery), "真实浏览器验收");
        var bedType = FirstNonEmpty(Value(values, "bedType"), BedTypeFromQuery(rawQuery), "upper");
        var bedTypeLabel = BedTypeLabelFor(bedType);
        var stable = FirstNonEmpty(Value(values, "stayId"), rawQuery, $"{resident}|{phone}|{building}|{roomNo}|{bedNo}") ?? "";
        return new DormitoryAnchor(rawQuery, stable, resident, phone, building, roomNo, bedNo, bedType, bedTypeLabel);
    }

    private static string Value(IReadOnlyDictionary<string, string> values, string key) =>
        values.TryGetValue(key, out var value) ? value : "";

    private static string? Digits(string value, int minLength)
    {
        var digits = new string((value ?? "").Where(char.IsDigit).ToArray());
        return digits.Length >= minLength ? digits : null;
    }

    private static string? PhoneFromQuery(string value)
    {
        var parts = (value ?? "")
            .Split(new[] { '/', '／', '·', ',', '，', ' ', '\t', '-' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(item => new string(item.Where(char.IsDigit).ToArray()))
            .Where(item => item.Length is >= 7 and <= 16)
            .ToArray();
        return parts.FirstOrDefault(item => item.Length >= 11) ?? parts.FirstOrDefault();
    }

    private static (string Building, string RoomNo, string BedNo) RoomParts(string value)
    {
        var parts = (value ?? "")
            .Split(new[] { '/', '／', '·', ',', '，', ' ', '\t', '-' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToArray();
        var building = parts.FirstOrDefault(item => item.Any(char.IsLetter) && item.Any(char.IsDigit)) ?? "";
        var roomNo = parts.FirstOrDefault(item => item.Any(char.IsDigit) && !item.Any(char.IsLetter) && item.Length >= 2) ?? "";
        var bedNo = parts.LastOrDefault(item => item.All(char.IsDigit) && item.Length <= 2) ?? "";
        return (building, roomNo, bedNo);
    }

    private static string NameFromQuery(string value)
    {
        var tokens = (value ?? "")
            .Split(new[] { '/', '／', '·', ',', '，', ' ', '\t', '-' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(item => item.Any(ch => char.IsLetter(ch) || IsCjk(ch)) && !item.Any(char.IsDigit) && !IsBedTypeToken(item))
            .ToArray();
        return tokens.FirstOrDefault() ?? "";
    }

    private static bool IsCjk(char value) =>
        value >= 0x4E00 && value <= 0x9FFF;

    private static bool IsBedTypeToken(string value)
    {
        var text = value ?? "";
        return text.Contains("上铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("下铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("平铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("upper", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("lower", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("whole", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("flat", StringComparison.OrdinalIgnoreCase);
    }

    private static string BedTypeFromQuery(string value)
    {
        var text = value ?? "";
        if (text.Contains("下铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("lower", StringComparison.OrdinalIgnoreCase))
        {
            return "lower";
        }

        if (text.Contains("平铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("whole", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("flat", StringComparison.OrdinalIgnoreCase))
        {
            return "whole";
        }

        if (text.Contains("上铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("upper", StringComparison.OrdinalIgnoreCase))
        {
            return "upper";
        }

        return string.Empty;
    }

    private static string BedTypeLabelFor(string value) =>
        value.Equals("lower", StringComparison.OrdinalIgnoreCase) ? "下铺" :
        value.Equals("whole", StringComparison.OrdinalIgnoreCase) ? "平铺" :
        value.Equals("flat", StringComparison.OrdinalIgnoreCase) ? "平铺" : "上铺";

    private static string Slug(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? "x"
            : FirstNonEmpty(new string(value.Trim().ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray()).Trim('-'), "x");

    public FactTraceV1? GetSubmissionTrace(string submissionId) =>
        traces.GetFactTraceBySubmission(submissionId);

    public IReadOnlyList<FactTraceV1> GetWorkItemTraces(string workItemId) =>
        traces.GetFactTracesByWorkItem(workItemId);

    public IReadOnlyList<FactTraceV1> GetCaseTraces(string caseId) =>
        traces.GetFactTracesByCase(caseId);

    public static SliceCommandHandlerResult HandleConfirmCommand(CommandEnvelopeV1 envelope)
    {
        var replayPolicy = ResolveRuntimeReplayPolicy(envelope);
        if (replayPolicy is not null)
        {
            return SliceCommandHandlerResult.Rejected(replayPolicy.Value.StatusCode, replayPolicy.Value.Reason);
        }

        BalancedMoneyFacts moneyFacts;
        try
        {
            moneyFacts = BalancedMoneyKernel.FromEnvelope(envelope);
        }
        catch (InvalidOperationException ex) when (ex.Message.StartsWith("finance_truth_", StringComparison.OrdinalIgnoreCase))
        {
            return SliceCommandHandlerResult.Rejected(StatusCodes.Status422UnprocessableEntity, ex.Message);
        }

        var eventId = $"evt-{OperationsHash.Short(envelope.TenantId, envelope.WorkItemId, envelope.IdempotencyKey, "confirmed")}";
        var responseBody = new Dictionary<string, object>
        {
            ["confirmed"] = true,
            ["userMessage"] = "Committed through OperationsUnitOfWork.",
            ["source"] = Source,
            ["workItemId"] = envelope.WorkItemId,
            ["caseId"] = envelope.CaseId
        };
        foreach (var (key, value) in moneyFacts.ResponseFields)
        {
            responseBody[key] = value;
        }

        var eventPayload = new Dictionary<string, object>
        {
            ["commandType"] = envelope.CommandType,
            ["definitionVersionId"] = envelope.DefinitionVersionId,
            ["payloadHash"] = envelope.PayloadHash,
            ["input"] = envelope.Payload
        };
        var definition = ReadObject(envelope.Payload, "definition");
        if (definition is not null)
        {
            responseBody["definition"] = definition;
            eventPayload["definition"] = definition;
        }

        var admission = ReadObject(envelope.Payload, "admission");
        if (admission is not null)
        {
            responseBody["admission"] = admission;
            eventPayload["admission"] = admission;
        }

        var definitionMode = ReadString(envelope.Payload, "definitionMode");
        if (!string.IsNullOrWhiteSpace(definitionMode))
        {
            responseBody["definitionMode"] = definitionMode;
            eventPayload["definitionMode"] = definitionMode;
        }

        var admissionDecisionRef = ReadString(envelope.Payload, "admissionDecisionRef");
        if (!string.IsNullOrWhiteSpace(admissionDecisionRef))
        {
            responseBody["admissionDecisionRef"] = admissionDecisionRef;
            eventPayload["admissionDecisionRef"] = admissionDecisionRef;
        }

        if (moneyFacts.LedgerTransactions.Count > 0)
        {
            eventPayload["ledgerTransactionIds"] = moneyFacts.LedgerTransactions.Select(item => item.LedgerTransactionId).ToArray();
        }

        return SliceCommandHandlerResult.Committed(
            responseBody,
            new[]
            {
                new OperationsDomainEventDraft("OperationsWorkItemConfirmed", eventPayload, eventId)
            },
            new[]
            {
                new OperationsWorkItemEventDraft(
                    "WorkItemConfirmed",
                    "prepared",
                    "confirmed",
                    new Dictionary<string, object>
                    {
                        ["eventId"] = eventId,
                        ["source"] = Source
                    })
            },
            new[]
            {
                new OperationsOutboxMessageDraft(
                    "operations.work_item.confirmed",
                    new Dictionary<string, object>
                    {
                        ["eventId"] = eventId,
                        ["workItemId"] = envelope.WorkItemId,
                        ["caseId"] = envelope.CaseId,
                        ["workspaceId"] = ReadString(envelope.Payload, "workspaceId"),
                        ["cardId"] = ReadString(envelope.Payload, "cardId"),
                        ["submissionId"] = ReadString(envelope.Payload, "submissionId"),
                        ["cardInstanceId"] = ReadString(envelope.Payload, "cardInstanceId"),
                        ["aggregateRef"] = ReadString(envelope.Payload, "aggregateRef"),
                        ["actorId"] = ReadString(envelope.Payload, "actorId"),
                        ["actorRole"] = ReadString(envelope.Payload, "actorRole"),
                        ["operationMode"] = ReadString(envelope.Payload, "operationMode"),
                        ["correctionMode"] = ReadString(envelope.Payload, "correctionMode"),
                        ["sourceWorkItemId"] = ReadString(envelope.Payload, "sourceWorkItemId"),
                        ["sourceSubmissionId"] = ReadString(envelope.Payload, "sourceSubmissionId"),
                        ["fieldValues"] = ReadObject(envelope.Payload, PayloadFieldValues) ?? new Dictionary<string, object>(),
                        ["evidenceIds"] = ReadStringArray(envelope.Payload, "evidenceIds")
                    },
                    eventId)
            },
            projectionStatus: "pending",
            ledgerTransactions: moneyFacts.LedgerTransactions,
            ledgerEntries: moneyFacts.LedgerEntries);
    }

    private static (int StatusCode, string Reason)? ResolveRuntimeReplayPolicy(CommandEnvelopeV1 envelope)
    {
        var fieldValues = ReadFieldValues(envelope);
        var policy = ReadString(fieldValues, "runtimeReplayPolicy");
        if (policy.Equals("permission_denied_403", StringComparison.OrdinalIgnoreCase))
        {
            return (StatusCodes.Status403Forbidden, "permission_denied");
        }

        if (policy.Equals("missing_evidence_422", StringComparison.OrdinalIgnoreCase) &&
            ReadStringArray(envelope.Payload, "evidenceIds").Count == 0)
        {
            return (StatusCodes.Status422UnprocessableEntity, "missing_required_evidence");
        }

        return null;
    }

    private static IReadOnlyDictionary<string, object> PayloadFor(
        WorkItem workItem,
        ConfirmWorkItemRequest request,
        RuntimeActorContext actor,
        WorkItemDefinitionResolution definition,
        AdmissionKernelDecision admission,
        VerifiedDeviceTrustContext deviceTrust) =>
        new Dictionary<string, object>
        {
            ["workspaceId"] = request.WorkspaceId ?? workItem.WorkspaceId,
            ["cardId"] = request.CardId ?? workItem.WorkItemType,
            ["submissionId"] = request.SubmissionId ?? string.Empty,
            ["cardInstanceId"] = request.CardInstanceId ?? string.Empty,
            ["aggregateRef"] = request.AggregateRef ?? string.Empty,
            ["deviceId"] = request.DeviceId ?? string.Empty,
            ["deviceTrustStatus"] = deviceTrust.DeviceTrustStatus,
            ["surface"] = deviceTrust.Surface,
            ["tenantMatched"] = deviceTrust.TenantMatched,
            ["deviceRevokedAtUtc"] = deviceTrust.RevokedAtUtc?.ToString("O") ?? string.Empty,
            ["reason"] = FirstNonEmpty(HighRiskReason(request), admission.Reason),
            ["definition"] = definition.ToTrace(),
            ["definitionId"] = definition.DefinitionId,
            ["definitionMigrationRefs"] = definition.MigrationRefs,
            ["definitionMode"] = definition.DefinitionMode,
            ["admission"] = admission.ToContract(),
            ["admissionDecisionRef"] = admission.AdmissionDecisionRef,
            ["actorId"] = actor.ActorId,
            ["actorRole"] = actor.Role,
            ["actorTenantId"] = actor.TenantId,
            ["authSource"] = actor.AuthSource,
            ["operationMode"] = PayloadValue(workItem.Payload, "operationMode"),
            ["correctionMode"] = PayloadValue(workItem.Payload, "correctionMode"),
            ["sourceWorkItemId"] = PayloadValue(workItem.Payload, "sourceWorkItemId"),
            ["sourceSubmissionId"] = PayloadValue(workItem.Payload, "sourceSubmissionId"),
            ["fieldValues"] = (request.FieldValues ?? new Dictionary<string, string>())
                .ToDictionary(item => item.Key, item => (object)item.Value),
            ["evidenceIds"] = request.EvidenceIds ?? Array.Empty<string>(),
            ["source"] = Source
        };

    private static string HighRiskReason(ConfirmWorkItemRequest request) =>
        FirstNonEmpty(
            request.Reason,
            FieldValue(request.FieldValues, "reason"),
            FieldValue(request.FieldValues, "auditReason"),
            FieldValue(request.FieldValues, "correctionReason"),
            FieldValue(request.FieldValues, "approvalReason"));

    private static bool IsCorrectionWorkItem(WorkItem workItem) =>
        PayloadValue(workItem.Payload, "correctionMode").Equals("append_only", StringComparison.OrdinalIgnoreCase) ||
        PayloadValue(workItem.Payload, "operationMode").Equals("correction", StringComparison.OrdinalIgnoreCase);

    private string? ValidateFieldKeys(string workItemId, ConfirmWorkItemRequest request)
    {
        var values = request.FieldValues ?? new Dictionary<string, string>();
        if (values.Count == 0)
        {
            return null;
        }

        var prepared = catalog.PrepareWorkItem(workItemId, new PrepareWorkItemRequest(
            request.WorkspaceId,
            request.CardId,
            request.SubmissionId,
            request.CardInstanceId,
            request.AggregateRef));
        if (prepared is null)
        {
            return "field_contract_not_resolved";
        }

        var allowed = prepared.FieldContract.System
            .Concat(prepared.FieldContract.Business)
            .Concat(prepared.FieldContract.Analytics)
            .Select(field => field.Id)
            .ToHashSet(StringComparer.Ordinal);
        foreach (var key in ReservedControlFieldKeys)
        {
            allowed.Add(key);
        }
        foreach (var key in AcceptedCapabilityDerivedFieldKeys(request.WorkspaceId, request.CardId))
        {
            allowed.Add(key);
        }
        var unknown = values.Keys.FirstOrDefault(key => !allowed.Contains(key));
        return string.IsNullOrWhiteSpace(unknown) ? null : $"unknown_field_key:{unknown}";
    }

    private static IReadOnlyList<string> AcceptedCapabilityDerivedFieldKeys(string? workspaceId, string? cardId)
    {
        if (!IsAcceptedCapabilityWorkspace(workspaceId ?? string.Empty))
        {
            return Array.Empty<string>();
        }

        return AcceptedCapabilityRuntimeProjection.DerivedFieldKeys(cardId);
    }

    private static readonly string[] ReservedControlFieldKeys =
    {
        "runtimeMode",
        "productionConfirm",
        "runtimeReplayPolicy",
        "sourcePack",
        "targetFact",
        "depositAccountId",
        "correctionMode"
    };

    private static IReadOnlyDictionary<string, object> ReadFieldValues(CommandEnvelopeV1 envelope) =>
        ReadObject(envelope.Payload, PayloadFieldValues) is IReadOnlyDictionary<string, object> fields
            ? fields
            : new Dictionary<string, object>();

    private static object? ReadObject(IReadOnlyDictionary<string, object> values, string key) =>
        values.TryGetValue(key, out var value) ? value : null;

    private static IReadOnlyList<string> ReadStringArray(IReadOnlyDictionary<string, object> values, string key) =>
        values.TryGetValue(key, out var value) && value is IEnumerable<string> list
            ? list.ToArray()
            : Array.Empty<string>();

    private static string ReadString(IReadOnlyDictionary<string, object> values, string key) =>
        values.TryGetValue(key, out var value) ? Convert.ToString(value) ?? string.Empty : string.Empty;

    private static bool ProductionRequested(ConfirmWorkItemRequest request) =>
        request.FieldValues is not null &&
        ((request.FieldValues.TryGetValue("runtimeMode", out var runtimeMode) &&
            runtimeMode.Equals("production", StringComparison.OrdinalIgnoreCase)) ||
         (request.FieldValues.TryGetValue("productionConfirm", out var productionConfirm) &&
            productionConfirm.Equals("true", StringComparison.OrdinalIgnoreCase)));

    private static string FieldValue(IReadOnlyDictionary<string, string>? values, string key) =>
        values is not null && values.TryGetValue(key, out var value) ? value : string.Empty;

    private static string PayloadValue(IReadOnlyDictionary<string, string> payload, string key) =>
        payload.TryGetValue(key, out var value) ? value : string.Empty;

    private static string MigrationRefsJson(IReadOnlyList<DefinitionMigrationRef>? migrationRefs) =>
        JsonSerializer.Serialize(migrationRefs ?? Array.Empty<DefinitionMigrationRef>(), new JsonSerializerOptions(JsonSerializerDefaults.Web));

    private static ConfirmWorkItemResult ToConfirmResult(OperationsCommitResult result, ConfirmWorkItemRequest request)
    {
        var userMessage = result.ResponseBody.TryGetValue("userMessage", out var message)
            ? message?.ToString() ?? result.Reason ?? result.Status
            : result.Reason ?? result.Status;
        var error = result.StatusCode switch
        {
            StatusCodes.Status200OK => null,
            StatusCodes.Status409Conflict => "idempotency_conflict",
            _ => "operations_confirm_failed"
        };
        var clientInstruction = new Dictionary<string, object>
        {
            ["disableRetry"] = result.StatusCode is StatusCodes.Status409Conflict,
            ["refreshProjection"] = result.ProjectionStatus is not "projected",
            ["observeOutbox"] = result.CommitStatus == "committed"
        };
        if (result.ResponseBody.TryGetValue("admission", out var admission))
        {
            clientInstruction["admission"] = admission!;
        }

        if (result.ResponseBody.TryGetValue("definition", out var definition))
        {
            clientInstruction["definition"] = definition!;
        }

        if (result.ResponseBody.TryGetValue("definitionMode", out var definitionMode))
        {
            clientInstruction["definitionMode"] = definitionMode!;
        }

        return new ConfirmWorkItemResult(
            result.StatusCode,
            error,
            result.Reason,
            result.CommitStatus == "committed",
            result.CommitStatus,
            result.ProjectionStatus,
            result.CaseId,
            result.WorkItemId,
            request.SubmissionId ?? result.SubmissionId,
            result.DomainEventIds,
            userMessage,
            clientInstruction,
            Source,
            result.IdempotencyKey,
            result.PayloadHash,
            string.IsNullOrWhiteSpace(result.SubmissionId) ? null : result.SubmissionId,
            string.IsNullOrWhiteSpace(result.SubmissionId) ? null : $"/api/operations/trace/submissions/{Uri.EscapeDataString(result.SubmissionId)}");
    }

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}

public sealed record OperationsWorkspaceStartResult(
    WorkspaceProjection Workspace,
    OperationCase OperationCase,
    WorkItem WorkItem,
    IReadOnlyList<WorkItem> OperationWorkItems);

internal static class GeneratedTransitionPolicy
{
    public const string SourceContract = "docs/oam/kernel/oam-kernel-graph.generated.json";

    private static readonly IReadOnlyList<GeneratedTransitionRule> Rules = new[]
    {
        new GeneratedTransitionRule(
            "generated-transition.dormitory.room-setup-to-bed-setup.v1",
            "definition.dormitory.roomSetupConfirm.v1",
            "definition.dormitory.bedSetupConfirm.v1"),
        new GeneratedTransitionRule(
            "generated-transition.dormitory.bed-setup-to-resource-readiness.v1",
            "definition.dormitory.bedSetupConfirm.v1",
            "definition.dormitory.resourceReadinessConfirm.v1")
    };

    public static GeneratedTransitionDecision? ResolveNext(
        WorkItem current,
        WorkItemDefinitionResolution currentDefinition,
        IReadOnlyDictionary<string, string>? fieldValues)
    {
        if (!currentDefinition.Resolved || string.IsNullOrWhiteSpace(currentDefinition.DefinitionId))
        {
            return null;
        }

        var rule = Rules.FirstOrDefault(item =>
            item.FromDefinitionId.Equals(currentDefinition.DefinitionId, StringComparison.OrdinalIgnoreCase));
        return rule is null
            ? null
            : new GeneratedTransitionDecision(rule.PolicyId, rule.NextDefinitionId, SourceContract);
    }
}

internal sealed record GeneratedTransitionRule(
    string PolicyId,
    string FromDefinitionId,
    string NextDefinitionId);

internal sealed record GeneratedTransitionDecision(
    string PolicyId,
    string NextDefinitionId,
    string Source);
