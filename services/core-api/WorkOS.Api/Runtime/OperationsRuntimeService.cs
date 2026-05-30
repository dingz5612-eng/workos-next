using System.Security.Cryptography;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public sealed class OperationsRuntimeService
{
    private const string AdapterSource = "operations_adapter";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };

    private readonly IOperationsRuntimeAdapter runtime;
    private readonly IOperationsCommandSubmissionStore submissions;

    public OperationsRuntimeService(
        ProjectionRuntime runtime,
        IOperationsCommandSubmissionStore submissions)
        : this(new ProjectionOperationsRuntimeAdapter(runtime), submissions)
    {
    }

    public OperationsRuntimeService(
        IOperationsRuntimeAdapter runtime,
        IOperationsCommandSubmissionStore submissions)
    {
        this.runtime = runtime;
        this.submissions = submissions;
    }

    public OperationCase? CreateCase(CreateOperationCaseRequest request) =>
        ResolveCase(request.CaseId, request.WorkspaceId, request.TenantId);

    public OperationCase? GetCase(string caseId) =>
        ResolveCase(caseId, null, null);

    public WorkItem? CreateWorkItem(CreateWorkItemRequest request)
    {
        var existing = string.IsNullOrWhiteSpace(request.WorkItemId)
            ? null
            : FindWorkItem(request.WorkItemId);
        if (existing is not null)
        {
            return ToWorkItem(existing);
        }

        var workspaceId = FirstNonEmpty(request.TargetWorkspaceId, request.WorkspaceId);
        if (!string.IsNullOrWhiteSpace(workspaceId) && !string.IsNullOrWhiteSpace(request.CardId))
        {
            var target = ResolveWorkspaceCard(workspaceId, request.CardId);
            if (target is not null)
            {
                return ToCompatibilityWorkItem(
                    request.WorkItemId ?? WorkItemIdFor(target.Workspace.Id, target.Card.Id),
                    request.WorkItemType ?? target.Card.Id,
                    request.TenantId ?? target.Workspace.Id,
                    target,
                    request.OwnerRole ?? target.Card.Confirmation.RequiredRole,
                    request.Payload ?? EmptyPayload,
                    "workspace-card");
            }
        }

        return null;
    }

    public IReadOnlyList<WorkItem> ListWorkItems(string? tenantId = null, string? caseId = null) =>
        runtime.GetProcessWorkItemIntents(tenantId)
            .Where(item => string.IsNullOrWhiteSpace(caseId) || PayloadValue(item.Payload, "caseId").Equals(caseId, StringComparison.OrdinalIgnoreCase))
            .Select(ToWorkItem)
            .ToArray();

    public WorkItem? GetWorkItem(string workItemId)
    {
        var existing = FindWorkItem(workItemId);
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
                target.Workspace.Id,
                target,
                target.Card.Confirmation.RequiredRole,
                EmptyPayload,
                "workspace-card");
    }

    public CompatibilityApiResult PrepareWorkspaceCard(string workspaceId, string cardId, PrepareCardRequest? request)
    {
        var workItem = ResolveOrCreateWorkspaceCardWorkItem(workspaceId, cardId);
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

    public CompatibilityApiResult ConfirmWorkspaceCard(
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        string actorToken,
        string requestId)
    {
        var legacyRequestFailure = ValidateLegacyConfirmRequiredFields(request);
        if (legacyRequestFailure is not null)
        {
            return new CompatibilityApiResult(
                StatusCodes.Status400BadRequest,
                new { error = "confirmation_invalid", Reason = legacyRequestFailure });
        }

        var workItem = ResolveOrCreateWorkspaceCardWorkItem(workspaceId, cardId);
        if (workItem is null)
        {
            return new CompatibilityApiResult(StatusCodes.Status404NotFound, new { error = "card_not_found", workspaceId, cardId });
        }

        var operationsRequest = new ConfirmWorkItemRequest(
            workspaceId,
            cardId,
            request.Language,
            request.IdempotencyKey,
            request.FieldValues,
            request.EvidenceIds,
            request.SubmissionId,
            request.CardInstanceId,
            request.AggregateRef,
            request.RequestId ?? requestId,
            request.DeviceId);
        var executed = ExecuteConfirmWorkItem(workItem.WorkItemId, operationsRequest, actorToken, requestId, allowLegacyDuplicatePayload: true);
        return LegacyConfirmResult(executed, workspaceId, cardId);
    }

    private static string? ValidateLegacyConfirmRequiredFields(ConfirmCardRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            return "Confirm requires an idempotency key.";
        }

        if (string.IsNullOrWhiteSpace(request.SubmissionId))
        {
            return "Confirm requires a submissionId.";
        }

        return string.IsNullOrWhiteSpace(request.CardInstanceId)
            ? "Confirm requires a cardInstanceId."
            : null;
    }

    public PrepareWorkItemResult? PrepareWorkItem(string workItemId, PrepareWorkItemRequest request) =>
        ExecutePrepareWorkItem(workItemId, request)?.Result;

    public ConfirmWorkItemResult ConfirmWorkItem(
        string workItemId,
        ConfirmWorkItemRequest request,
        string actorToken,
        string requestId) =>
        ExecuteConfirmWorkItem(workItemId, request, actorToken, requestId).Result;

    private PrepareWorkItemExecution? ExecutePrepareWorkItem(string workItemId, PrepareWorkItemRequest request)
    {
        var target = ResolveOperationTarget(workItemId, request.WorkspaceId, request.CardId);
        if (target is null)
        {
            return null;
        }

        var prepared = runtime.Prepare(target.Workspace.Id, target.Card.Id, request.ToPrepareCardRequest());
        if (prepared is null)
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
        return new PrepareWorkItemExecution(result, prepared, target);
    }

    private ConfirmWorkItemExecution ExecuteConfirmWorkItem(
        string workItemId,
        ConfirmWorkItemRequest request,
        string actorToken,
        string requestId,
        bool allowLegacyDuplicatePayload = false)
    {
        var target = ResolveOperationTarget(workItemId, request.WorkspaceId, request.CardId);
        if (target is null)
        {
            return new ConfirmWorkItemExecution(
                ConfirmWorkItemResult.NotFound(workItemId, request.SubmissionId, request.IdempotencyKey, "operation_work_item_not_found"),
                null);
        }

        var normalized = request.Normalize(workItemId, target.Workspace.Id, target.Card.Id);
        var payloadHash = ComputePayloadHash(workItemId, target, normalized);
        var tenantId = TenantIdFor(target);
        var sliceId = target.Workspace.Id;
        var commandSubmissionId = $"cmd-{ShortHash(tenantId, normalized.IdempotencyKey!)}";
        var previous = submissions.Find(tenantId, sliceId, normalized.IdempotencyKey!);
        if (previous is not null)
        {
            return ExistingSubmissionResult(previous, target, workItemId, normalized, payloadHash, allowLegacyDuplicatePayload);
        }

        var pendingRecord = new OperationsCommandSubmissionRecord(
            commandSubmissionId,
            null,
            tenantId,
            sliceId,
            target.Workspace.Id,
            target.Card.Id,
            normalized.IdempotencyKey!,
            payloadHash,
            DateTimeOffset.UtcNow,
            AdapterSource,
            "pending",
            null,
            CommandPayloadFor(workItemId, target, normalized, payloadHash));
        if (!submissions.TryBegin(pendingRecord))
        {
            previous = submissions.Find(tenantId, sliceId, normalized.IdempotencyKey!);
            return previous is not null
                ? ExistingSubmissionResult(previous, target, workItemId, normalized, payloadHash, allowLegacyDuplicatePayload)
                : new ConfirmWorkItemExecution(
                    ConfirmWorkItemResult.Conflict(
                        workItemId,
                        CaseIdFor(target.Intent, target.Workspace.Id),
                        normalized.SubmissionId,
                        normalized.IdempotencyKey,
                        payloadHash,
                        "command_submission_pending"),
                    null);
        }

        ConfirmResult confirm;
        try
        {
            confirm = runtime.Confirm(
                target.Workspace.Id,
                target.Card.Id,
                normalized.ToConfirmCardRequest(requestId),
                actorToken);
        }
        catch (Exception ex)
        {
            submissions.Rollback(commandSubmissionId);
            return new ConfirmWorkItemExecution(
                ConfirmWorkItemResult.Rejected(
                    StatusCodes.Status500InternalServerError,
                    "handler_failure",
                    ex.Message,
                    CaseIdFor(target.Intent, target.Workspace.Id),
                    workItemId,
                    normalized.SubmissionId,
                    normalized.IdempotencyKey,
                    payloadHash),
                null);
        }

        var result = ToConfirmWorkItemResult(confirm, target, workItemId, normalized, payloadHash);
        result = result with { CommandSubmissionId = commandSubmissionId };
        var processingStatus = result.StatusCode is StatusCodes.Status200OK
            ? ProcessingStatusFor(confirm.Status)
            : "rejected";
        submissions.Complete(pendingRecord with
        {
            ProcessingStatus = processingStatus,
            Result = result
        });

        return new ConfirmWorkItemExecution(result, confirm.Payload);
    }

    private static ConfirmWorkItemExecution ExistingSubmissionResult(
        OperationsCommandSubmissionRecord previous,
        OperationTarget target,
        string workItemId,
        ConfirmWorkItemRequest request,
        string payloadHash,
        bool allowLegacyDuplicatePayload)
    {
        if (!previous.PayloadHash.Equals(payloadHash, StringComparison.Ordinal))
        {
            if (allowLegacyDuplicatePayload && previous.Result is not null)
            {
                return new ConfirmWorkItemExecution(
                    previous.Result with
                    {
                        Source = AdapterSource,
                        PayloadHash = previous.PayloadHash,
                        CommandSubmissionId = previous.CommandSubmissionId
                    },
                    null);
            }

            return new ConfirmWorkItemExecution(
                ConfirmWorkItemResult.Conflict(
                    workItemId,
                    CaseIdFor(target.Intent, target.Workspace.Id),
                    request.SubmissionId,
                    request.IdempotencyKey,
                    payloadHash,
                    "same_idempotency_different_payload"),
                null);
        }

        if (previous.Result is not null)
        {
            return new ConfirmWorkItemExecution(
                previous.Result with
                {
                    Source = AdapterSource,
                    PayloadHash = payloadHash,
                    CommandSubmissionId = previous.CommandSubmissionId
                },
                null);
        }

        return new ConfirmWorkItemExecution(
            ConfirmWorkItemResult.Conflict(
                workItemId,
                CaseIdFor(target.Intent, target.Workspace.Id),
                request.SubmissionId,
                request.IdempotencyKey,
                payloadHash,
                "command_submission_pending"),
            null);
    }

    private static string ProcessingStatusFor(ConfirmStatus status) =>
        status switch
        {
            ConfirmStatus.Duplicate => "duplicate",
            ConfirmStatus.Confirmed or ConfirmStatus.ProjectionFailed => "committed",
            ConfirmStatus.Invalid or ConfirmStatus.Forbidden or ConfirmStatus.NotFound => "rejected",
            _ => "rejected"
        };

    private WorkItem? ResolveOrCreateWorkspaceCardWorkItem(string workspaceId, string cardId) =>
        CreateWorkItem(new CreateWorkItemRequest(
            WorkItemIdFor(workspaceId, cardId),
            workspaceId,
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

    private static CompatibilityApiResult LegacyConfirmResult(ConfirmWorkItemExecution executed, string workspaceId, string cardId)
    {
        var result = executed.Result;
        return result.StatusCode switch
        {
            StatusCodes.Status404NotFound => new CompatibilityApiResult(result.StatusCode, new { error = "card_not_found", workspaceId, cardId }),
            StatusCodes.Status400BadRequest => new CompatibilityApiResult(result.StatusCode, new { error = "confirmation_invalid", result.Reason }),
            StatusCodes.Status401Unauthorized => new CompatibilityApiResult(result.StatusCode, null),
            StatusCodes.Status403Forbidden => new CompatibilityApiResult(result.StatusCode, new { error = "confirmation_forbidden", result.Reason }),
            StatusCodes.Status500InternalServerError => new CompatibilityApiResult(result.StatusCode, new { error = result.Error ?? "handler_failure", result.Reason }),
            StatusCodes.Status409Conflict => new CompatibilityApiResult(result.StatusCode, new
            {
                error = result.Error ?? "idempotency_conflict",
                result.Reason,
                result.CaseId,
                result.WorkItemId,
                result.SubmissionId
            }),
            StatusCodes.Status422UnprocessableEntity => new CompatibilityApiResult(result.StatusCode, new { error = "business_rule_violation", result.Reason }),
            _ => new CompatibilityApiResult(StatusCodes.Status200OK, LegacyConfirmPayload(executed, workspaceId, cardId))
        };
    }

    private static object LegacyConfirmPayload(ConfirmWorkItemExecution executed, string workspaceId, string cardId)
    {
        var result = executed.Result;
        if (executed.CompatibilityPayload is ConfirmCardResponse response)
        {
            return new Dictionary<string, object?>
            {
                ["confirmed"] = response.Confirmed,
                ["commitStatus"] = response.CommitStatus,
                ["projectionStatus"] = response.ProjectionStatus,
                ["caseId"] = FirstNonEmpty(result.CaseId, response.CaseId, workspaceId),
                ["workItemId"] = FirstNonEmpty(result.WorkItemId, response.WorkItemId, WorkItemIdFor(workspaceId, cardId)),
                ["submissionId"] = FirstNonEmpty(result.SubmissionId, response.SubmissionId),
                ["resultEventIds"] = response.ResultEventIds,
                ["userMessage"] = response.UserMessage,
                ["clientInstruction"] = response.ClientInstruction,
                ["events"] = response.Events,
                ["workspace"] = response.Workspace,
                ["projection"] = response.Projection,
                ["source"] = result.Source,
                ["idempotencyKey"] = result.IdempotencyKey,
                ["payloadHash"] = result.PayloadHash,
                ["commandSubmissionId"] = result.CommandSubmissionId
            };
        }

        return new Dictionary<string, object?>
        {
            ["confirmed"] = result.Confirmed,
            ["commitStatus"] = result.CommitStatus,
            ["projectionStatus"] = result.ProjectionStatus,
            ["caseId"] = FirstNonEmpty(result.CaseId, workspaceId),
            ["workItemId"] = FirstNonEmpty(result.WorkItemId, WorkItemIdFor(workspaceId, cardId)),
            ["submissionId"] = result.SubmissionId,
            ["resultEventIds"] = result.ResultEventIds,
            ["userMessage"] = result.UserMessage,
            ["clientInstruction"] = result.ClientInstruction,
            ["events"] = Array.Empty<WorkspaceEvent>(),
            ["workspace"] = null,
            ["projection"] = null,
            ["source"] = result.Source,
            ["idempotencyKey"] = result.IdempotencyKey,
            ["payloadHash"] = result.PayloadHash,
            ["commandSubmissionId"] = result.CommandSubmissionId
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

        var intent = FindWorkItem(workItemId);
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

    private ProcessWorkItemIntentRecord? FindWorkItem(string workItemId) =>
        runtime.GetProcessWorkItemIntents()
            .FirstOrDefault(item => item.WorkItemId.Equals(workItemId, StringComparison.OrdinalIgnoreCase));

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
        string source) =>
        new(
            workItemId,
            workItemType,
            "available",
            CaseIdFor(target.Intent, target.Workspace.Id),
            tenantId,
            target.Workspace.Id,
            ownerRole,
            source,
            target.Intent?.SourceEventId,
            target.Intent?.CreatedAtUtc ?? DateTimeOffset.UtcNow,
            payload);

    private static OperationsAvailableAction[] AvailableActionsFor(CardProjection card) =>
        new[]
        {
            new OperationsAvailableAction(
                $"{card.Id}.confirm",
                "confirm",
                card.Confirmation.Label,
                card.Confirmation)
        };

    private static ConfirmWorkItemResult ToConfirmWorkItemResult(
        ConfirmResult confirm,
        OperationTarget target,
        string workItemId,
        ConfirmWorkItemRequest request,
        string payloadHash)
    {
        var caseId = CaseIdFor(target.Intent, target.Workspace.Id);
        if (confirm.Payload is ConfirmCardResponse response)
        {
            return new ConfirmWorkItemResult(
                StatusCodes.Status200OK,
                null,
                null,
                response.Confirmed,
                response.CommitStatus,
                response.ProjectionStatus,
                caseId,
                workItemId,
                response.SubmissionId,
                response.ResultEventIds,
                response.UserMessage,
                response.ClientInstruction,
                AdapterSource,
                request.IdempotencyKey!,
                payloadHash,
                null);
        }

        return confirm.Status switch
        {
            ConfirmStatus.NotFound => ConfirmWorkItemResult.NotFound(workItemId, request.SubmissionId, request.IdempotencyKey, "card_not_found"),
            ConfirmStatus.Invalid => ConfirmWorkItemResult.Rejected(StatusCodes.Status400BadRequest, "confirmation_invalid", confirm.Reason, caseId, workItemId, request.SubmissionId, request.IdempotencyKey, payloadHash),
            ConfirmStatus.Forbidden when ConfirmHttpStatusMapper.IsAuthenticationFailure(confirm.Reason) => ConfirmWorkItemResult.Rejected(StatusCodes.Status401Unauthorized, "actor_session_required", confirm.Reason, caseId, workItemId, request.SubmissionId, request.IdempotencyKey, payloadHash),
            ConfirmStatus.Forbidden when ConfirmHttpStatusMapper.IsAuthorizationForbidden(confirm.Reason) => ConfirmWorkItemResult.Rejected(StatusCodes.Status403Forbidden, "confirmation_forbidden", confirm.Reason, caseId, workItemId, request.SubmissionId, request.IdempotencyKey, payloadHash),
            ConfirmStatus.Forbidden => ConfirmWorkItemResult.Rejected(StatusCodes.Status422UnprocessableEntity, "business_rule_violation", confirm.Reason, caseId, workItemId, request.SubmissionId, request.IdempotencyKey, payloadHash),
            _ => ConfirmWorkItemResult.Rejected(StatusCodes.Status422UnprocessableEntity, "confirmation_not_committed", confirm.Reason, caseId, workItemId, request.SubmissionId, request.IdempotencyKey, payloadHash)
        };
    }

    private static IReadOnlyDictionary<string, object?> CommandPayloadFor(
        string workItemId,
        OperationTarget target,
        ConfirmWorkItemRequest request,
        string payloadHash) =>
        new Dictionary<string, object?>
        {
            ["source"] = AdapterSource,
            ["payloadHash"] = payloadHash,
            ["workItemId"] = workItemId,
            ["caseId"] = CaseIdFor(target.Intent, target.Workspace.Id),
            ["compatibilityTransition"] = new Dictionary<string, object?>
            {
                ["source"] = AdapterSource,
                ["compatibilityRuntime"] = "ProjectionRuntime.Confirm",
                ["workspaceId"] = target.Workspace.Id,
                ["cardId"] = target.Card.Id
            },
            ["request"] = new Dictionary<string, object?>
            {
                ["language"] = request.Language,
                ["submissionId"] = request.SubmissionId,
                ["cardInstanceId"] = request.CardInstanceId,
                ["aggregateRef"] = request.AggregateRef,
                ["fieldValues"] = Sorted(request.FieldValues),
                ["evidenceIds"] = request.EvidenceIds?.OrderBy(item => item, StringComparer.Ordinal).ToArray() ?? Array.Empty<string>(),
                ["deviceId"] = request.DeviceId
            }
        };

    private static string ComputePayloadHash(string workItemId, OperationTarget target, ConfirmWorkItemRequest request)
    {
        var payload = new SortedDictionary<string, object?>(StringComparer.Ordinal)
        {
            ["aggregateRef"] = request.AggregateRef,
            ["cardId"] = target.Card.Id,
            ["cardInstanceId"] = request.CardInstanceId,
            ["deviceId"] = request.DeviceId,
            ["evidenceIds"] = request.EvidenceIds?.OrderBy(item => item, StringComparer.Ordinal).ToArray() ?? Array.Empty<string>(),
            ["fieldValues"] = Sorted(request.FieldValues),
            ["language"] = request.Language,
            ["submissionId"] = request.SubmissionId,
            ["workItemId"] = workItemId,
            ["workspaceId"] = target.Workspace.Id
        };
        return $"sha256:{ShortHash(JsonSerializer.Serialize(payload, JsonOptions))}";
    }

    private static SortedDictionary<string, string> Sorted(IReadOnlyDictionary<string, string>? values) =>
        values is null
            ? new SortedDictionary<string, string>(StringComparer.Ordinal)
            : values.Aggregate(
                new SortedDictionary<string, string>(StringComparer.Ordinal),
                (items, item) =>
                {
                    items[item.Key] = item.Value;
                    return items;
                });

    private static string CaseIdFor(ProcessWorkItemIntentRecord? intent, string workspaceId) =>
        FirstNonEmpty(intent is null ? null : PayloadValue(intent.Payload, "caseId"), workspaceId) ?? workspaceId;

    private static string TenantIdFor(OperationTarget target) =>
        FirstNonEmpty(target.Intent?.TenantId, target.Workspace.Id) ?? target.Workspace.Id;

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

    private static (string WorkspaceId, string CardId)? SplitWorkItemId(string workItemId)
    {
        var decoded = Uri.UnescapeDataString(workItemId);
        var parts = decoded.Split(':', 2, StringSplitOptions.TrimEntries);
        return parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0]) && !string.IsNullOrWhiteSpace(parts[1])
            ? (parts[0], parts[1])
            : null;
    }

    private static string WorkItemIdFor(string workspaceId, string cardId) => $"{workspaceId}:{cardId}";

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

    object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null);

    ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken);
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

    public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
        runtime.Prepare(workspaceId, cardId, request);

    public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
        runtime.Confirm(workspaceId, cardId, request, actorToken);
}

public interface IOperationsCommandSubmissionStore
{
    OperationsCommandSubmissionRecord? Find(string tenantId, string sliceId, string idempotencyKey);

    bool TryBegin(OperationsCommandSubmissionRecord record);

    void Complete(OperationsCommandSubmissionRecord record);

    void Rollback(string commandSubmissionId);
}

public sealed class InMemoryOperationsCommandSubmissionStore : IOperationsCommandSubmissionStore
{
    private readonly Dictionary<string, OperationsCommandSubmissionRecord> records = new(StringComparer.OrdinalIgnoreCase);

    public IReadOnlyList<OperationsCommandSubmissionRecord> Records => records.Values.ToArray();

    public OperationsCommandSubmissionRecord? Find(string tenantId, string sliceId, string idempotencyKey) =>
        records.TryGetValue(Key(tenantId, idempotencyKey), out var record) ? record : null;

    public bool TryBegin(OperationsCommandSubmissionRecord record)
    {
        return records.TryAdd(Key(record.TenantId, record.IdempotencyKey), record);
    }

    public void Complete(OperationsCommandSubmissionRecord record)
    {
        records[Key(record.TenantId, record.IdempotencyKey)] = record;
    }

    public void Rollback(string commandSubmissionId)
    {
        var key = records.FirstOrDefault(item => item.Value.CommandSubmissionId.Equals(commandSubmissionId, StringComparison.OrdinalIgnoreCase)).Key;
        if (!string.IsNullOrWhiteSpace(key))
        {
            records.Remove(key);
        }
    }

    private static string Key(string tenantId, string idempotencyKey) =>
        $"{tenantId}|{idempotencyKey}";
}

public sealed class PostgresOperationsCommandSubmissionStore : IOperationsCommandSubmissionStore
{
    private const string MissingTable = "42P01";
    private const string MissingSchema = "3F000";
    private readonly PostgresConnectionFactory connections;

    public PostgresOperationsCommandSubmissionStore(string connectionString)
    {
        connections = new PostgresConnectionFactory(connectionString);
    }

    public OperationsCommandSubmissionRecord? Find(string tenantId, string sliceId, string idempotencyKey)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                select command_submission_id, release_id, tenant_id, slice_id, workspace_id,
                       card_id, idempotency_key, submitted_at_utc, command_payload, processing_status
                from shadow_runtime.command_submissions
                where tenant_id = @tenantId and idempotency_key = @idempotencyKey
                order by submitted_at_utc desc
                limit 1
                """;
            command.Parameters.AddWithValue("tenantId", tenantId);
            command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
            using var reader = command.ExecuteReader();
            return reader.Read() ? ReadSubmission(reader) : null;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            return null;
        }
    }

    public bool TryBegin(OperationsCommandSubmissionRecord record)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                insert into shadow_runtime.command_submissions(
                    command_submission_id, release_id, tenant_id, slice_id, workspace_id,
                    card_id, idempotency_key, submitted_at_utc, actor_ref, command_payload,
                    source_active_ref, source_shadow_ref, processing_status)
                values (
                    @commandSubmissionId, @releaseId, @tenantId, @sliceId, @workspaceId,
                    @cardId, @idempotencyKey, @submittedAtUtc, @actorRef::jsonb, @commandPayload::jsonb,
                    @sourceActiveRef, @sourceShadowRef, @processingStatus)
                on conflict do nothing
                """;
            command.Parameters.AddWithValue("commandSubmissionId", record.CommandSubmissionId);
            command.Parameters.AddWithValue("releaseId", (object?)record.ReleaseId ?? DBNull.Value);
            command.Parameters.AddWithValue("tenantId", record.TenantId);
            command.Parameters.AddWithValue("sliceId", record.SliceId);
            command.Parameters.AddWithValue("workspaceId", (object?)record.WorkspaceId ?? DBNull.Value);
            command.Parameters.AddWithValue("cardId", (object?)record.CardId ?? DBNull.Value);
            command.Parameters.AddWithValue("idempotencyKey", record.IdempotencyKey);
            command.Parameters.AddWithValue("submittedAtUtc", record.SubmittedAtUtc);
            command.Parameters.AddWithValue("actorRef", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new { source = record.Source }, PostgresProjectionStore.JsonOptions));
            command.Parameters.AddWithValue("commandPayload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new
            {
                source = record.Source,
                payloadHash = record.PayloadHash,
                command = record.CommandPayload,
                result = record.Result
            }, PostgresProjectionStore.JsonOptions));
            command.Parameters.AddWithValue("sourceActiveRef", (object?)$"{record.WorkspaceId}:{record.CardId}" ?? DBNull.Value);
            command.Parameters.AddWithValue("sourceShadowRef", (object?)record.CommandSubmissionId ?? DBNull.Value);
            command.Parameters.AddWithValue("processingStatus", record.ProcessingStatus);
            return command.ExecuteNonQuery() > 0;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            // Compatibility deployments may not have shadow_runtime yet; Operations continues through confirm.
            return true;
        }
    }

    public void Complete(OperationsCommandSubmissionRecord record)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                update shadow_runtime.command_submissions
                set command_payload = @commandPayload::jsonb,
                    processing_status = @processingStatus,
                    source_shadow_ref = @sourceShadowRef
                where command_submission_id = @commandSubmissionId
                """;
            command.Parameters.AddWithValue("commandSubmissionId", record.CommandSubmissionId);
            command.Parameters.AddWithValue("commandPayload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new
            {
                source = record.Source,
                payloadHash = record.PayloadHash,
                command = record.CommandPayload,
                result = record.Result
            }, PostgresProjectionStore.JsonOptions));
            command.Parameters.AddWithValue("processingStatus", record.ProcessingStatus);
            command.Parameters.AddWithValue("sourceShadowRef", (object?)record.CommandSubmissionId ?? DBNull.Value);
            command.ExecuteNonQuery();
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            // Compatibility deployments may not have shadow_runtime yet; Operations continues through confirm.
        }
    }

    public void Rollback(string commandSubmissionId)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                delete from shadow_runtime.command_submissions
                where command_submission_id = @commandSubmissionId
                  and processing_status = 'pending'
                """;
            command.Parameters.AddWithValue("commandSubmissionId", commandSubmissionId);
            command.ExecuteNonQuery();
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            // Compatibility deployments may not have shadow_runtime yet; Operations continues through confirm.
        }
    }

    private static OperationsCommandSubmissionRecord ReadSubmission(NpgsqlDataReader reader)
    {
        var commandPayload = JsonDocument.Parse(reader.GetString(8)).RootElement;
        var payloadHash = commandPayload.TryGetProperty("payloadHash", out var hashElement)
            ? hashElement.GetString() ?? string.Empty
            : string.Empty;
        var source = commandPayload.TryGetProperty("source", out var sourceElement)
            ? sourceElement.GetString() ?? "unknown"
            : "unknown";
        ConfirmWorkItemResult? result = null;
        if (commandPayload.TryGetProperty("result", out var resultElement) && resultElement.ValueKind == JsonValueKind.Object)
        {
            result = JsonSerializer.Deserialize<ConfirmWorkItemResult>(resultElement.GetRawText(), PostgresProjectionStore.JsonOptions);
        }

        return new OperationsCommandSubmissionRecord(
            reader.GetString(0),
            reader.IsDBNull(1) ? null : reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.GetString(6),
            payloadHash,
            reader.GetFieldValue<DateTimeOffset>(7),
            source,
            reader.GetString(9),
            result,
            new Dictionary<string, object?>());
    }
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
    string Source);

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
    IReadOnlyDictionary<string, string> Payload);

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
        var idempotencyKey = string.IsNullOrWhiteSpace(IdempotencyKey)
            ? $"op-{OperationsHash.Short(workItemId, workspaceId, cardId, Guid.NewGuid().ToString("N"))}"
            : IdempotencyKey;
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
}

public sealed record OperationsAvailableAction(
    string ActionId,
    string Kind,
    IReadOnlyDictionary<string, string> Label,
    ConfirmationPolicy ConfirmationPolicy);

public sealed record OperationsCommandSubmissionRecord(
    string CommandSubmissionId,
    string? ReleaseId,
    string TenantId,
    string SliceId,
    string? WorkspaceId,
    string? CardId,
    string IdempotencyKey,
    string PayloadHash,
    DateTimeOffset SubmittedAtUtc,
    string Source,
    string ProcessingStatus,
    ConfirmWorkItemResult? Result,
    IReadOnlyDictionary<string, object?> CommandPayload);

internal sealed record OperationTarget(
    WorkspaceProjection Workspace,
    CardProjection Card,
    ProcessWorkItemIntentRecord? Intent);

internal sealed record PrepareWorkItemExecution(
    PrepareWorkItemResult Result,
    object? CompatibilityPayload,
    OperationTarget Target);

internal sealed record ConfirmWorkItemExecution(
    ConfirmWorkItemResult Result,
    object? CompatibilityPayload);

internal static class OperationsHash
{
    public static string Short(params string[] parts)
    {
        var value = string.Join("|", parts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
