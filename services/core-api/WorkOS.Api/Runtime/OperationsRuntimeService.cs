using System.Security.Cryptography;
using System.Reflection;
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
            return StabilizePersistedWorkItem(persisted, request);
        }

        var projected = string.IsNullOrWhiteSpace(request.WorkItemId)
            ? null
            : ToWorkItemOrNull(FindProcessWorkItem(request.WorkItemId));
        if (projected is not null)
        {
            return projected;
        }

        var workspaceId = FirstNonEmpty(request.TargetWorkspaceId, request.WorkspaceId);
        if (!string.IsNullOrWhiteSpace(workspaceId) && !string.IsNullOrWhiteSpace(request.CardId))
        {
            var target = ResolveWorkspaceCard(workspaceId, request.CardId);
            if (target is not null)
            {
                var caseId = FirstNonEmpty(PayloadValue(request.Payload ?? EmptyPayload, "caseId"), CaseIdFor(target.Intent, target.Workspace.Id)) ?? target.Workspace.Id;
                var tenantId = FirstNonEmpty(request.TenantId, target.Intent?.TenantId, RuntimeActorAuthorization.DefaultTenantId)!;
                PersistCase(new CreateOperationCaseRequest(caseId, tenantId, target.Workspace.Id));
                return workItems.Upsert(ToCompatibilityWorkItem(
                    request.WorkItemId ?? WorkItemIdFor(target.Workspace.Id, target.Card.Id),
                    request.WorkItemType ?? target.Card.Id,
                    tenantId,
                    target,
                    request.OwnerRole ?? target.Card.Confirmation.RequiredRole,
                    request.Payload ?? EmptyPayload,
                    "workspace-card"));
            }
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

        var target = ResolveOperationTarget(workItemId, null, null);
        return target is null
            ? null
            : ToCompatibilityWorkItem(
                workItemId,
                target.Card.Id,
                TenantIdFor(target),
                target,
                target.Card.Confirmation.RequiredRole,
                EmptyPayload,
                "workspace-card");
    }

    public CompatibilityApiResult PrepareWorkspaceCard(string workspaceId, string cardId, PrepareCardRequest? request, string? tenantId = null)
    {
        var workItem = ResolveOrCreateWorkspaceCardWorkItem(workspaceId, cardId, tenantId);
        if (workItem is null)
        {
            return new CompatibilityApiResult(StatusCodes.Status404NotFound, new { error = "card_not_found", workspaceId, cardId });
        }

        var prepared = ExecutePrepareWorkItem(
            workItem.WorkItemId,
            new PrepareWorkItemRequest(
                workspaceId,
                cardId,
                request?.SubmissionId,
                request?.CardInstanceId,
                request?.AggregateRef));
        if (prepared is null)
        {
            return new CompatibilityApiResult(StatusCodes.Status404NotFound, new { error = "card_not_found", workspaceId, cardId });
        }

        return new CompatibilityApiResult(
            StatusCodes.Status200OK,
            LegacyPreparePayload(prepared));
    }

    public ConfirmResult ValidateWorkspaceCardConfirmPolicy(
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        string actorToken) =>
        runtime.ValidateConfirm(workspaceId, cardId, request, actorToken);

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
        return new PrepareWorkItemExecution(result, CompatibilityPreparePayload(target, request), target);
    }

    private WorkItem? ResolveOrCreateWorkspaceCardWorkItem(string workspaceId, string cardId, string? tenantId = null) =>
        CreateWorkItem(new CreateWorkItemRequest(
            WorkItemIdFor(workspaceId, cardId),
            FirstNonEmpty(tenantId, RuntimeActorAuthorization.DefaultTenantId),
            cardId,
            workspaceId,
            workspaceId,
            cardId,
            null,
            new Dictionary<string, string>
            {
                ["caseId"] = workspaceId,
                ["cardId"] = cardId,
                ["compatibilityRoute"] = "workspace-card"
            }));


    private static object LegacyPreparePayload(PrepareWorkItemExecution prepared)
    {
        var target = prepared.Target;
        var cardInstance = PropertyValue(prepared.CompatibilityPayload, "cardInstance");
        return new Dictionary<string, object?>
        {
            ["prepared"] = true,
            ["preparedAtUtc"] = PropertyValue(prepared.CompatibilityPayload, "preparedAtUtc") ?? DateTimeOffset.UtcNow,
            ["workspaceId"] = target.Workspace.Id,
            ["cardId"] = target.Card.Id,
            ["workItemId"] = prepared.Result.WorkItemId,
            ["caseId"] = prepared.Result.CaseId,
            ["cardInstance"] = cardInstance,
            ["card"] = target.Card,
            ["allowedActions"] = prepared.Result.AvailableActions.Select(action => new Dictionary<string, object?>
            {
                ["actionId"] = action.ActionId,
                ["kind"] = action.Kind,
                ["label"] = action.Label,
                ["confirmationPolicy"] = action.ConfirmationPolicy
            }).ToArray(),
            ["checks"] = target.Card.Checks,
            ["blockers"] = target.Card.BlockerRules,
            ["fieldDefaults"] = target.Card.Fields.Business.ToDictionary(field => field.Id, _ => string.Empty)
        };
    }

    private static object CompatibilityPreparePayload(OperationTarget target, PrepareWorkItemRequest request)
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

    private static object? PropertyValue(object? source, string name)
    {
        if (source is null)
        {
            return null;
        }

        if (source is IReadOnlyDictionary<string, object?> dictionary && dictionary.TryGetValue(name, out var dictionaryValue))
        {
            return dictionaryValue;
        }

        var property = source.GetType().GetProperty(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.IgnoreCase);
        return property?.GetValue(source);
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

    private WorkItem StabilizePersistedWorkItem(WorkItem existing, CreateWorkItemRequest request)
    {
        var payload = request.Payload ?? existing.Payload;
        if (!IsWorkspaceCardCompatibility(existing, request, payload))
        {
            return existing;
        }

        var tenantId = FirstNonEmpty(request.TenantId, existing.TenantId) ?? existing.TenantId;
        var workspaceId = FirstNonEmpty(request.TargetWorkspaceId, request.WorkspaceId, existing.WorkspaceId) ?? existing.WorkspaceId;
        var caseId = FirstNonEmpty(PayloadValue(payload, "caseId"), existing.CaseId, workspaceId);
        var workItemType = FirstNonEmpty(request.WorkItemType, existing.WorkItemType) ?? existing.WorkItemType;
        var ownerRole = FirstNonEmpty(request.OwnerRole, existing.OwnerRole) ?? existing.OwnerRole;
        var idempotencyScope = $"{tenantId}:{existing.WorkItemId}:confirm";

        PersistCase(new CreateOperationCaseRequest(caseId, tenantId, workspaceId));
        if (SameText(existing.TenantId, tenantId) &&
            SameText(existing.WorkspaceId, workspaceId) &&
            SameText(existing.CaseId, caseId) &&
            SameText(existing.WorkItemType, workItemType) &&
            SameText(existing.OwnerRole, ownerRole) &&
            SameText(existing.IdempotencyScope, idempotencyScope) &&
            SamePayload(existing.Payload, payload))
        {
            return existing;
        }

        return workItems.Upsert(existing with
        {
            TenantId = tenantId,
            WorkspaceId = workspaceId,
            CaseId = caseId,
            WorkItemType = workItemType,
            OwnerRole = ownerRole,
            Payload = payload,
            IdempotencyScope = idempotencyScope,
            Source = "workspace-card"
        });
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
        if (!string.IsNullOrWhiteSpace(workspaceId) && !string.IsNullOrWhiteSpace(cardId))
        {
            var explicitTarget = ResolveWorkspaceCard(workspaceId, cardId);
            if (explicitTarget is not null)
            {
                return explicitTarget;
            }
        }

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
                return persistedTarget;
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
                    return new OperationTarget(workspace, card, intent);
                }
            }
        }

        var routeTarget = SplitWorkItemId(workItemId);
        return routeTarget is null ? null : ResolveWorkspaceCard(routeTarget.Value.WorkspaceId, routeTarget.Value.CardId);
    }

    private OperationTarget? ResolveWorkspaceCard(string workspaceId, string cardId)
    {
        var workspace = runtime.FindWorkspace(workspaceId);
        var card = workspace?.Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        return workspace is null || card is null ? null : new OperationTarget(workspace, card, null);
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

    private static WorkItem ToCompatibilityWorkItem(
        string workItemId,
        string workItemType,
        string tenantId,
        OperationTarget target,
        string ownerRole,
        IReadOnlyDictionary<string, string> payload,
        string source)
    {
        var caseId = FirstNonEmpty(PayloadValue(payload, "caseId"), CaseIdFor(target.Intent, target.Workspace.Id));
        return new(
            workItemId,
            workItemType,
            "available",
            caseId,
            tenantId,
            target.Workspace.Id,
            ownerRole,
            source,
            target.Intent?.SourceEventId,
            target.Intent?.CreatedAtUtc ?? DateTimeOffset.UtcNow,
            payload,
            $"work-item:{workItemType}:v1",
            null,
            "normal",
            "medium",
            $"{tenantId}:{workItemId}:confirm",
            null,
            null,
            ownerRole);
    }

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

    private static string TenantIdFor(OperationTarget target) =>
        FirstNonEmpty(target.Intent?.TenantId, RuntimeActorAuthorization.DefaultTenantId) ?? RuntimeActorAuthorization.DefaultTenantId;

    private static bool IsWorkspaceCardCompatibility(
        WorkItem existing,
        CreateWorkItemRequest request,
        IReadOnlyDictionary<string, string> payload) =>
        existing.Source.Equals("workspace-card", StringComparison.OrdinalIgnoreCase) ||
        PayloadValue(payload, "compatibilityRoute").Equals("workspace-card", StringComparison.OrdinalIgnoreCase) ||
        (!string.IsNullOrWhiteSpace(request.TargetWorkspaceId) && !string.IsNullOrWhiteSpace(request.CardId));

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
        (left ?? string.Empty).Equals(right ?? string.Empty, StringComparison.OrdinalIgnoreCase);

    private static bool SamePayload(IReadOnlyDictionary<string, string> left, IReadOnlyDictionary<string, string> right) =>
        left.Count == right.Count &&
        left.All(item => right.TryGetValue(item.Key, out var value) &&
            value.Equals(item.Value, StringComparison.Ordinal));

    private static (string WorkspaceId, string CardId)? SplitWorkItemId(string workItemId)
    {
        var decoded = Uri.UnescapeDataString(workItemId);
        var parts = decoded.Split(':', 2, StringSplitOptions.TrimEntries);
        return parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0]) && !string.IsNullOrWhiteSpace(parts[1])
            ? (parts[0], parts[1])
            : null;
    }

    private static string WorkItemIdFor(string workspaceId, string cardId) => $"wi-{OperationsHash.Short(workspaceId, cardId)}";

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

    ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken);
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

    public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
        runtime.ValidateConfirm(workspaceId, cardId, request, actorToken);
}

public sealed record CreateOperationCaseRequest(
    string? CaseId = null,
    string? TenantId = null,
    string? WorkspaceId = null);

public sealed record CompatibilityApiResult(int StatusCode, object? Payload);

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
    string? CommandSubmissionId)
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
                ["compatibilityMode"] = definition.CompatibilityMode
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
