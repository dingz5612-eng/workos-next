using System.Security.Cryptography;
using System.Text;

namespace WorkOS.Api.Runtime;

public sealed class OperationsRuntimeService
{
    private readonly IOperationsRuntimeAdapter runtime;
    private readonly IOperationsCaseStore cases;
    private readonly IOperationsWorkItemStore workItems;

    public OperationsRuntimeService(
        ProjectionRuntime runtime)
        : this(new ProjectionOperationsRuntimeAdapter(runtime))
    {
    }

    public OperationsRuntimeService(
        ProjectionRuntime runtime,
        IOperationsCaseStore cases,
        IOperationsWorkItemStore workItems)
        : this(new ProjectionOperationsRuntimeAdapter(runtime), cases, workItems)
    {
    }

    public OperationsRuntimeService(
        IOperationsRuntimeAdapter runtime)
        : this(runtime, new InMemoryOperationsCaseStore(), new InMemoryOperationsWorkItemStore())
    {
    }

    public OperationsRuntimeService(
        IOperationsRuntimeAdapter runtime,
        IOperationsCaseStore cases,
        IOperationsWorkItemStore workItems)
    {
        this.runtime = runtime;
        this.cases = cases;
        this.workItems = workItems;
    }

    public OperationCase? CreateCase(CreateOperationCaseRequest request) =>
        PersistCase(request);

    public OperationCase? GetCase(string caseId) =>
        cases.Get(caseId) ?? ResolveCase(caseId, null, null);

    public WorkItem? CreateWorkItem(CreateWorkItemRequest request)
    {
        var persisted = string.IsNullOrWhiteSpace(request.WorkItemId)
            ? null
            : workItems.Get(request.WorkItemId);
        if (persisted is not null)
        {
            return persisted;
        }

        var projected = string.IsNullOrWhiteSpace(request.WorkItemId)
            ? null
            : ToWorkItemOrNull(FindProcessWorkItem(request.WorkItemId));
        if (projected is not null)
        {
            return projected;
        }

        if (!string.IsNullOrWhiteSpace(request.WorkItemId) &&
            !string.IsNullOrWhiteSpace(request.TenantId) &&
            !string.IsNullOrWhiteSpace(request.WorkItemType))
        {
            var caseId = FirstNonEmpty(PayloadValue(request.Payload ?? EmptyPayload, "caseId"), request.WorkspaceId, $"case-{request.TenantId}");
            PersistCase(new CreateOperationCaseRequest(caseId, request.TenantId, request.WorkspaceId));
            return workItems.Upsert(new WorkItem(
                request.WorkItemId,
                request.WorkItemType,
                "available",
                caseId,
                request.TenantId,
                request.WorkspaceId ?? string.Empty,
                request.OwnerRole ?? "operations",
                "operations-work-item-store",
                null,
                DateTimeOffset.UtcNow,
                request.Payload ?? EmptyPayload,
                $"work-item:{request.WorkItemType}:v1",
                null,
                "normal",
                "medium",
                $"{request.TenantId}:{request.WorkItemId}:confirm"));
        }

        return null;
    }

    public IReadOnlyList<WorkItem> ListWorkItems(string? tenantId = null, string? caseId = null) =>
        workItems.List(tenantId, caseId)
            .Concat(runtime.GetProcessWorkItemIntents(tenantId)
            .Where(item => string.IsNullOrWhiteSpace(caseId) || PayloadValue(item.Payload, "caseId").Equals(caseId, StringComparison.OrdinalIgnoreCase))
            .Select(ToWorkItem))
            .GroupBy(item => item.WorkItemId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToArray();

    public IReadOnlyList<OperationsWorkItemSurface> ListWorkItemSurfaces(string? tenantId = null, string? caseId = null) =>
        ListWorkItems(tenantId, caseId).Select(ToSurface).ToArray();

    public WorkItem? GetWorkItem(string workItemId)
    {
        var persisted = workItems.Get(workItemId);
        if (persisted is not null)
        {
            return persisted;
        }

        var existing = FindProcessWorkItem(workItemId);
        if (existing is not null)
        {
            return ToWorkItem(existing);
        }

        return null;
    }

    public OperationsWorkItemSurface? GetWorkItemSurface(string workItemId)
    {
        var workItem = GetWorkItem(workItemId);
        return workItem is null ? null : ToSurface(workItem);
    }

    public PrepareWorkItemResult? PrepareWorkItem(string workItemId, PrepareWorkItemRequest request) =>
        ExecutePrepareWorkItem(workItemId, request)?.Result;

    public void RecordWorkItemTransition(
        string tenantId,
        string caseId,
        string workItemId,
        string? fromState,
        string toState,
        string? submissionId,
        string reason,
        string? actorId)
    {
        if (workItems.Get(workItemId) is null)
        {
            return;
        }

        workItems.RecordTransition(new WorkItemTransitionRecord(
            $"wit-{OperationsHash.Short(tenantId, caseId, workItemId, submissionId ?? string.Empty, toState)}",
            tenantId,
            caseId,
            workItemId,
            fromState,
            toState,
            submissionId,
            reason,
            actorId,
            DateTimeOffset.UtcNow));
    }

    private PrepareWorkItemExecution? ExecutePrepareWorkItem(string workItemId, PrepareWorkItemRequest request)
    {
        var target = ResolveOperationTarget(workItemId, request.WorkspaceId, request.CardId);
        if (target is null)
        {
            return null;
        }

        var result = new PrepareWorkItemResult(
            workItemId,
            target.Card.Fields,
            target.Card.Evidence,
            AvailableActionsFor(target.Card),
            "prepared",
            CaseIdFor(target.Intent, target.Workspace.Id),
            target.Workspace.Id,
            target.Card.Id);
        return new PrepareWorkItemExecution(result, PreparePayload(target, request), target);
    }

    private static object PreparePayload(OperationTarget target, PrepareWorkItemRequest request)
    {
        var now = DateTimeOffset.UtcNow;
        var cardInstanceId = string.IsNullOrWhiteSpace(request.CardInstanceId)
            ? $"ci-{OperationsHash.Short(target.Workspace.Id, target.Card.Id, request.SubmissionId ?? string.Empty, request.AggregateRef ?? string.Empty)}"
            : request.CardInstanceId;
        var cardInstance = new CardInstanceRecord(
            cardInstanceId,
            target.Workspace.Id,
            target.Card.Id,
            request.AggregateRef,
            request.SubmissionId,
            null,
            "prepared",
            now,
            now);
        return new Dictionary<string, object?>
        {
            ["prepared"] = true,
            ["preparedAtUtc"] = now,
            ["workspaceId"] = target.Workspace.Id,
            ["cardId"] = target.Card.Id,
            ["cardInstance"] = cardInstance
        };
    }

    private OperationCase? PersistCase(CreateOperationCaseRequest request)
    {
        var existing = string.IsNullOrWhiteSpace(request.CaseId) ? null : cases.Get(request.CaseId);
        if (existing is not null)
        {
            var existingTenantId = FirstNonEmpty(request.TenantId, existing.TenantId);
            var existingWorkspaceId = FirstNonEmpty(request.WorkspaceId, existing.WorkspaceId);
            if (!SameText(existingTenantId, existing.TenantId) || !SameText(existingWorkspaceId, existing.WorkspaceId))
            {
                return cases.Upsert(existing with
                {
                    TenantId = existingTenantId,
                    WorkspaceId = existingWorkspaceId,
                    ProjectionStatus = "persisted",
                    Source = "operations-case-store"
                });
            }

            return existing;
        }

        var resolved = ResolveCase(request.CaseId, request.WorkspaceId, request.TenantId);
        if (resolved is not null)
        {
            return cases.Upsert(resolved with
            {
                CaseId = FirstNonEmpty(request.CaseId, resolved.CaseId) ?? resolved.CaseId,
                TenantId = FirstNonEmpty(request.TenantId, resolved.TenantId),
                WorkspaceId = FirstNonEmpty(request.WorkspaceId, resolved.WorkspaceId),
                CaseType = resolved.CaseType,
                DefinitionVersionId = resolved.DefinitionVersionId,
                OwnerRole = resolved.OwnerRole
            });
        }

        var tenantId = FirstNonEmpty(request.TenantId, request.WorkspaceId);
        var requestedCaseId = FirstNonEmpty(request.CaseId, request.WorkspaceId, tenantId is null ? null : $"case-{OperationsHash.Short(tenantId, "operations")}");
        if (string.IsNullOrWhiteSpace(requestedCaseId) || string.IsNullOrWhiteSpace(tenantId))
        {
            return null;
        }

        return cases.Upsert(new OperationCase(
            requestedCaseId,
            "open",
            tenantId,
            request.WorkspaceId,
            Array.Empty<string>(),
            "persisted",
            "operations-case-store",
            "operations.case",
            "OperationCase.v1",
            "operations",
            null));
    }

    private OperationCase? ResolveCase(string? caseId, string? workspaceId, string? tenantId)
    {
        var requestedCaseId = FirstNonEmpty(caseId, workspaceId);
        if (string.IsNullOrWhiteSpace(requestedCaseId))
        {
            return null;
        }

        var processItems = runtime.GetProcessWorkItemIntents(tenantId);
        var matchingCaseItems = processItems
            .Where(item => PayloadValue(item.Payload, "caseId").Equals(requestedCaseId, StringComparison.OrdinalIgnoreCase))
            .ToArray();
        if (matchingCaseItems.Length > 0)
        {
            return new OperationCase(
                requestedCaseId,
                StatusFor(matchingCaseItems.Select(item => item.Status)),
                matchingCaseItems[0].TenantId,
                FirstNonEmpty(matchingCaseItems[0].TargetWorkspaceId, workspaceId),
                matchingCaseItems.Select(item => item.WorkItemId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
                "projected",
                "process-work-item-intents");
        }

        var workspace = runtime.FindWorkspace(requestedCaseId) ?? (!string.IsNullOrWhiteSpace(workspaceId) ? runtime.FindWorkspace(workspaceId) : null);
        if (workspace is null)
        {
            return null;
        }

        var workspaceItems = processItems
            .Where(item => item.TargetWorkspaceId.Equals(workspace.Id, StringComparison.OrdinalIgnoreCase))
            .Select(item => item.WorkItemId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return new OperationCase(
            workspace.Id,
            "projected",
            tenantId ?? workspace.Id,
            workspace.Id,
            workspaceItems,
            "projected",
            "workspace-projection");
    }

    private OperationTarget? ResolveOperationTarget(
        string workItemId,
        string? workspaceId,
        string? cardId)
    {
        var persisted = workItems.Get(workItemId);
        if (persisted is not null)
        {
            var persistedCardId = FirstNonEmpty(
                cardId,
                PayloadValue(persisted.Payload, "cardId"),
                persisted.WorkItemType);
            var persistedTarget = ResolveWorkspaceCard(FirstNonEmpty(workspaceId, persisted.WorkspaceId) ?? string.Empty, persistedCardId ?? string.Empty);
            if (persistedTarget is not null)
            {
                return ApplyEffectiveCardContract(persisted, persistedTarget, persistedCardId);
            }
        }

        var intent = FindProcessWorkItem(workItemId);
        if (intent is not null)
        {
            var workspace = runtime.FindWorkspace(FirstNonEmpty(workspaceId, intent.TargetWorkspaceId) ?? string.Empty);
            if (workspace is not null)
            {
                var resolvedCardId = FirstNonEmpty(
                    cardId,
                    PayloadValue(intent.Payload, "cardId"),
                    PayloadValue(intent.Payload, "targetCardId"),
                    intent.WorkItemType);
                var card = workspace.Cards.FirstOrDefault(item => item.Id.Equals(resolvedCardId, StringComparison.OrdinalIgnoreCase))
                    ?? workspace.Cards.FirstOrDefault(item => item.Status.Equals("ready", StringComparison.OrdinalIgnoreCase))
                    ?? workspace.Cards.FirstOrDefault();
                if (card is not null)
                {
                    return ApplyEffectiveCardContract(ToWorkItem(intent), new OperationTarget(workspace, card, intent), resolvedCardId);
                }
            }
        }

        return null;
    }

    private OperationTarget? ResolveWorkspaceCard(string workspaceId, string cardId)
    {
        var workspace = runtime.FindWorkspace(workspaceId);
        var card = workspace?.Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        return workspace is null || card is null ? null : new OperationTarget(workspace, card, null);
    }

    private OperationTarget ApplyEffectiveCardContract(WorkItem workItem, OperationTarget target, string? requestedCardId)
    {
        var cardId = FirstNonEmpty(requestedCardId, target.Card.Id) ?? target.Card.Id;
        var templateWorkspaceId = FirstNonEmpty(
            PayloadValue(workItem.Payload, "templateWorkspaceId"),
            WorkspaceSeedCatalog.FindWorkspace(workItem.WorkspaceId)?.Id);
        var seed = WorkspaceSeedCatalog.FindCard(templateWorkspaceId, cardId);
        if (seed is null)
        {
            return target;
        }

        var effectiveCard = CardContractFactory.Create(seed) with
        {
            Status = EffectiveCardStatusFor(workItem, target.Card.Status),
            BlockerRules = target.Card.BlockerRules
        };
        var effectiveWorkspace = target.Workspace with
        {
            Cards = target.Workspace.Cards
                .Select(card => card.Id.Equals(effectiveCard.Id, StringComparison.OrdinalIgnoreCase) ? effectiveCard : card)
                .ToArray()
        };
        return target with
        {
            Workspace = effectiveWorkspace,
            Card = effectiveCard
        };
    }

    private OperationsWorkItemSurface ToSurface(WorkItem workItem)
    {
        var cardId = FirstNonEmpty(PayloadValue(workItem.Payload, "cardId"), workItem.WorkItemType) ?? string.Empty;
        var target = ResolveOperationTarget(workItem.WorkItemId, workItem.WorkspaceId, cardId);
        return OperationsWorkItemSurface.From(workItem, cardId, target?.Workspace, target?.Card);
    }

    private ProcessWorkItemIntentRecord? FindProcessWorkItem(string workItemId) =>
        runtime.GetProcessWorkItemIntents()
            .FirstOrDefault(item => item.WorkItemId.Equals(workItemId, StringComparison.OrdinalIgnoreCase));

    private static WorkItem? ToWorkItemOrNull(ProcessWorkItemIntentRecord? item) =>
        item is null ? null : ToWorkItem(item);

    private static WorkItem ToWorkItem(ProcessWorkItemIntentRecord item) =>
        new(
            item.WorkItemId,
            item.WorkItemType,
            item.Status,
            PayloadValue(item.Payload, "caseId"),
            item.TenantId,
            item.TargetWorkspaceId,
            item.OwnerRole,
            "process-work-item-intent",
            item.SourceEventId,
            item.CreatedAtUtc,
            item.Payload);

    private static OperationsAvailableAction[] AvailableActionsFor(CardProjection card) =>
        new[]
        {
            new OperationsAvailableAction(
                $"{card.Id}.confirm",
                "confirm",
                card.Confirmation.Label,
                card.Confirmation)
        };

    private static string CaseIdFor(ProcessWorkItemIntentRecord? intent, string workspaceId) =>
        FirstNonEmpty(intent is null ? null : PayloadValue(intent.Payload, "caseId"), workspaceId) ?? workspaceId;

    private static string EffectiveCardStatusFor(WorkItem workItem, string projectedStatus)
    {
        if (IsCorrectionWorkItem(workItem) && !IsTerminalStatus(workItem.Status))
        {
            return WorkItemStatusForCard(workItem.Status);
        }

        return projectedStatus;
    }

    private static bool IsCorrectionWorkItem(WorkItem workItem) =>
        PayloadValue(workItem.Payload, "correctionMode").Equals("append_only", StringComparison.OrdinalIgnoreCase) ||
        PayloadValue(workItem.Payload, "operationMode").Equals("correction", StringComparison.OrdinalIgnoreCase);

    private static string WorkItemStatusForCard(string status) =>
        status.Equals("available", StringComparison.OrdinalIgnoreCase) ||
        status.Equals("open", StringComparison.OrdinalIgnoreCase)
            ? "ready"
            : status;

    private static bool IsTerminalStatus(string status) =>
        new[] { "done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped" }
            .Contains(status, StringComparer.OrdinalIgnoreCase);

    private static string PayloadValue(IReadOnlyDictionary<string, string> payload, string key) =>
        payload.TryGetValue(key, out var value) ? value : string.Empty;

    private static string StatusFor(IEnumerable<string> statuses)
    {
        var values = statuses.Where(item => !string.IsNullOrWhiteSpace(item)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (values.Length == 0)
        {
            return "projected";
        }

        return values.Length == 1 ? values[0] : "mixed";
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static bool SameText(string? left, string? right) =>
        string.Equals(left ?? string.Empty, right ?? string.Empty, StringComparison.Ordinal);

    private static string ShortHash(params string[] parts)
    {
        var value = string.Join("|", parts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static readonly IReadOnlyDictionary<string, string> EmptyPayload = new Dictionary<string, string>();
}

public interface IOperationsRuntimeAdapter
{
    WorkspaceProjection? FindWorkspace(string workspaceId);

    IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null);
}

public sealed class ProjectionOperationsRuntimeAdapter : IOperationsRuntimeAdapter
{
    private readonly ProjectionRuntime runtime;

    public ProjectionOperationsRuntimeAdapter(ProjectionRuntime runtime)
    {
        this.runtime = runtime;
    }

    public WorkspaceProjection? FindWorkspace(string workspaceId) => runtime.FindWorkspace(workspaceId);

    public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
        runtime.GetProcessWorkItemIntents(tenantId);
}

public sealed record CreateOperationCaseRequest(
    string? CaseId = null,
    string? TenantId = null,
    string? WorkspaceId = null);

public sealed record CreateWorkItemRequest(
    string? WorkItemId = null,
    string? TenantId = null,
    string? WorkItemType = null,
    string? TargetWorkspaceId = null,
    string? WorkspaceId = null,
    string? CardId = null,
    string? OwnerRole = null,
    IReadOnlyDictionary<string, string>? Payload = null);

public sealed record OperationCase(
    string CaseId,
    string Status,
    string? TenantId,
    string? WorkspaceId,
    IReadOnlyList<string> WorkItemIds,
    string ProjectionStatus,
    string Source,
    string CaseType = "operations.case",
    string DefinitionVersionId = "OperationCase.v1",
    string OwnerRole = "operations",
    string? OwnerActorId = null);

public sealed record WorkItem(
    string WorkItemId,
    string WorkItemType,
    string Status,
    string? CaseId,
    string TenantId,
    string WorkspaceId,
    string OwnerRole,
    string Source,
    string? SourceEventId,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyDictionary<string, string> Payload,
    string DefinitionVersionId = "WorkItem.v1",
    DateTimeOffset? DueAtUtc = null,
    string? Priority = "normal",
    string? RiskLevel = "medium",
    string IdempotencyScope = "",
    string? OwnerActorId = null,
    string? BackupOwnerId = null,
    string? EscalationOwnerRole = null,
    IReadOnlyList<string>? RequiredEvidenceRefs = null,
    IReadOnlyList<string>? AffectedFactRefs = null);

public sealed record OperationsWorkItemSurface(
    string WorkItemId,
    string WorkItemType,
    string Status,
    string? CaseId,
    string TenantId,
    string WorkspaceId,
    string CardId,
    string OwnerRole,
    string Source,
    string? SourceEventId,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyDictionary<string, string> Payload,
    string DefinitionVersionId,
    DateTimeOffset? DueAtUtc,
    string? Priority,
    string? RiskLevel,
    string IdempotencyScope,
    string? OwnerActorId,
    string? BackupOwnerId,
    string? EscalationOwnerRole,
    IReadOnlyList<string>? RequiredEvidenceRefs,
    IReadOnlyList<string>? AffectedFactRefs,
    WorkspaceProjection? Workspace,
    CardProjection? Card)
{
    public static OperationsWorkItemSurface From(
        WorkItem workItem,
        string cardId,
        WorkspaceProjection? workspace,
        CardProjection? card) =>
        new(
            workItem.WorkItemId,
            workItem.WorkItemType,
            workItem.Status,
            workItem.CaseId,
            workItem.TenantId,
            workItem.WorkspaceId,
            cardId,
            workItem.OwnerRole,
            workItem.Source,
            workItem.SourceEventId,
            workItem.CreatedAtUtc,
            workItem.Payload,
            workItem.DefinitionVersionId,
            workItem.DueAtUtc,
            workItem.Priority,
            workItem.RiskLevel,
            workItem.IdempotencyScope,
            workItem.OwnerActorId,
            workItem.BackupOwnerId,
            workItem.EscalationOwnerRole,
            workItem.RequiredEvidenceRefs,
            workItem.AffectedFactRefs,
            workspace,
            card);
}

public sealed record PrepareWorkItemRequest(
    string? WorkspaceId = null,
    string? CardId = null,
    string? SubmissionId = null,
    string? CardInstanceId = null,
    string? AggregateRef = null)
{
    public PrepareCardRequest ToPrepareCardRequest() => new(SubmissionId, CardInstanceId, AggregateRef);
}

public sealed record ConfirmWorkItemRequest(
    string? WorkspaceId = null,
    string? CardId = null,
    string? Language = null,
    string? IdempotencyKey = null,
    IReadOnlyDictionary<string, string>? FieldValues = null,
    IReadOnlyList<string>? EvidenceIds = null,
    string? SubmissionId = null,
    string? CardInstanceId = null,
    string? AggregateRef = null,
    string? RequestId = null,
    string? DeviceId = null)
{
    public ConfirmWorkItemRequest Normalize(string workItemId, string workspaceId, string cardId)
    {
        var idempotencyKey = IdempotencyKey!.Trim();
        var submissionId = string.IsNullOrWhiteSpace(SubmissionId)
            ? $"op-sub-{OperationsHash.Short(workItemId, idempotencyKey)}"
            : SubmissionId;
        var cardInstanceId = string.IsNullOrWhiteSpace(CardInstanceId)
            ? $"op-ci-{OperationsHash.Short(workItemId, idempotencyKey, cardId)}"
            : CardInstanceId;
        return this with
        {
            WorkspaceId = workspaceId,
            CardId = cardId,
            Language = string.IsNullOrWhiteSpace(Language) ? "zh-CN" : Language,
            IdempotencyKey = idempotencyKey,
            SubmissionId = submissionId,
            CardInstanceId = cardInstanceId,
            FieldValues = FieldValues ?? new Dictionary<string, string>(),
            EvidenceIds = EvidenceIds ?? Array.Empty<string>()
        };
    }

    public ConfirmCardRequest ToConfirmCardRequest(string requestId) => new(
        Language,
        IdempotencyKey,
        FieldValues,
        EvidenceIds,
        SubmissionId,
        CardInstanceId,
        AggregateRef,
        RequestId ?? requestId,
        DeviceId);
}

public sealed record PrepareWorkItemResult(
    string WorkItemId,
    FieldSet FieldContract,
    IReadOnlyList<EvidenceRequirement> EvidenceRequirements,
    IReadOnlyList<OperationsAvailableAction> AvailableActions,
    string ProjectionStatus,
    string CaseId,
    string WorkspaceId,
    string CardId);

public sealed record ConfirmWorkItemResult(
    int StatusCode,
    string? Error,
    string? Reason,
    bool Confirmed,
    string CommitStatus,
    string ProjectionStatus,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    IReadOnlyList<string> ResultEventIds,
    string UserMessage,
    IReadOnlyDictionary<string, object> ClientInstruction,
    string Source,
    string? IdempotencyKey,
    string? PayloadHash,
    string? CommandSubmissionId,
    string? TraceUrl = null)
{
    public static ConfirmWorkItemResult NotFound(string workItemId, string? submissionId, string? idempotencyKey, string reason) =>
        Rejected(StatusCodes.Status404NotFound, "operation_work_item_not_found", reason, string.Empty, workItemId, submissionId, idempotencyKey, null);

    public static ConfirmWorkItemResult Conflict(
        string workItemId,
        string caseId,
        string? submissionId,
        string? idempotencyKey,
        string payloadHash,
        string reason) =>
        Rejected(StatusCodes.Status409Conflict, "idempotency_conflict", reason, caseId, workItemId, submissionId, idempotencyKey, payloadHash);

    public static ConfirmWorkItemResult Rejected(
        int statusCode,
        string error,
        string? reason,
        string caseId,
        string workItemId,
        string? submissionId,
        string? idempotencyKey,
        string? payloadHash) =>
        new(
            statusCode,
            error,
            reason,
            false,
            "not_committed",
            "not_projected",
            caseId,
            workItemId,
            submissionId ?? string.Empty,
            Array.Empty<string>(),
            reason ?? error,
            new Dictionary<string, object>
            {
                ["disableRetry"] = statusCode is StatusCodes.Status409Conflict,
                ["refreshProjection"] = false,
                ["observeOutbox"] = false
            },
            "operations_adapter",
            idempotencyKey,
            payloadHash,
            null);

    public static ConfirmWorkItemResult AdmissionRejected(
        string caseId,
        string workItemId,
        string? submissionId,
        string? idempotencyKey,
        AdmissionKernelDecision admission,
        WorkItemDefinitionResolution definition) =>
        new(
            StatusCodes.Status403Forbidden,
            "admission_rejected",
            admission.Reason,
            false,
            "not_committed",
            "not_projected",
            caseId,
            workItemId,
            submissionId ?? string.Empty,
            Array.Empty<string>(),
            admission.Reason,
            new Dictionary<string, object>
            {
                ["disableRetry"] = true,
                ["refreshProjection"] = false,
                ["observeOutbox"] = false,
                ["admission"] = admission.ToContract(),
                ["definition"] = definition.ToTrace(),
                ["definitionMode"] = definition.DefinitionMode
            },
            "operations_admission_kernel",
            idempotencyKey,
            null,
            null);
}

public sealed record OperationsAvailableAction(
    string ActionId,
    string Kind,
    IReadOnlyDictionary<string, string> Label,
    ConfirmationPolicy ConfirmationPolicy);

internal sealed record OperationTarget(
    WorkspaceProjection Workspace,
    CardProjection Card,
    ProcessWorkItemIntentRecord? Intent);

internal sealed record PrepareWorkItemExecution(
    PrepareWorkItemResult Result,
    object? CompatibilityPayload,
    OperationTarget Target);

internal static class OperationsHash
{
    public static string Short(params string[] parts)
    {
        var value = string.Join("|", parts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
