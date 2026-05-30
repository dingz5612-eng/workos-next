using Microsoft.AspNetCore.Http;

namespace WorkOS.Api.Runtime;

public sealed class LegacyWorkspaceCardAdapter
{
    private readonly CanonicalOperationsApiService operations;
    private readonly LegacyWorkItemResolver workItems;
    private readonly LegacyCompatibilityPolicy policy;
    private readonly LegacyCardRequestMapper requests;
    private readonly LegacyCardResponseMapper responses;

    public LegacyWorkspaceCardAdapter(
        CanonicalOperationsApiService operations,
        LegacyWorkItemResolver workItems,
        LegacyCompatibilityPolicy policy,
        LegacyCardRequestMapper requests,
        LegacyCardResponseMapper responses)
    {
        this.operations = operations;
        this.workItems = workItems;
        this.policy = policy;
        this.requests = requests;
        this.responses = responses;
    }

    public CompatibilityApiResult PrepareWorkspaceCard(string workspaceId, string cardId, PrepareCardRequest? request)
    {
        var workItem = workItems.ResolveOrCreate(operations, workspaceId, cardId);
        if (workItem is null)
        {
            return responses.CardNotFound(workspaceId, cardId);
        }

        var prepared = operations.PrepareWorkItem(workItem.WorkItemId, requests.ToPrepareRequest(workspaceId, cardId, request));
        return prepared is null
            ? responses.CardNotFound(workspaceId, cardId)
            : responses.Prepared(prepared, request);
    }

    public CompatibilityApiResult ConfirmWorkspaceCard(
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        string actorToken,
        string requestId)
    {
        var policyResult = policy.Validate(workspaceId, cardId, request, actorToken);
        if (policyResult.Status is not ConfirmStatus.Confirmed)
        {
            return responses.PolicyRejected(policyResult, workspaceId, cardId, request);
        }

        var workItem = workItems.ResolveOrCreate(operations, workspaceId, cardId);
        if (workItem is null)
        {
            return responses.CardNotFound(workspaceId, cardId);
        }

        var result = operations.ConfirmWorkItem(
            workItem.WorkItemId,
            requests.ToConfirmRequest(workspaceId, cardId, request, requestId),
            actorToken,
            requestId);
        return responses.Confirmed(result, workspaceId, cardId);
    }
}

public sealed class LegacyCardRequestMapper
{
    public PrepareWorkItemRequest ToPrepareRequest(string workspaceId, string cardId, PrepareCardRequest? request) =>
        new(
            workspaceId,
            cardId,
            request?.SubmissionId,
            request?.CardInstanceId,
            request?.AggregateRef);

    public ConfirmWorkItemRequest ToConfirmRequest(
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        string requestId) =>
        new(
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
}

public sealed class LegacyCardResponseMapper
{
    public CompatibilityApiResult CardNotFound(string workspaceId, string cardId) =>
        new(StatusCodes.Status404NotFound, new { error = "card_not_found", workspaceId, cardId });

    public CompatibilityApiResult Prepared(PrepareWorkItemResult prepared, PrepareCardRequest? request) =>
        new(
            StatusCodes.Status200OK,
            new Dictionary<string, object?>
            {
                ["prepared"] = true,
                ["preparedAtUtc"] = DateTimeOffset.UtcNow,
                ["workspaceId"] = prepared.WorkspaceId,
                ["cardId"] = prepared.CardId,
                ["workItemId"] = prepared.WorkItemId,
                ["caseId"] = prepared.CaseId,
                ["submissionId"] = request?.SubmissionId,
                ["cardInstanceId"] = request?.CardInstanceId,
                ["aggregateRef"] = request?.AggregateRef,
                ["card"] = new Dictionary<string, object?>
                {
                    ["id"] = prepared.CardId,
                    ["fields"] = prepared.FieldContract,
                    ["evidence"] = prepared.EvidenceRequirements
                },
                ["allowedActions"] = prepared.AvailableActions.Select(action => new Dictionary<string, object?>
                {
                    ["actionId"] = action.ActionId,
                    ["kind"] = action.Kind,
                    ["label"] = action.Label,
                    ["confirmationPolicy"] = action.ConfirmationPolicy
                }).ToArray(),
                ["checks"] = Array.Empty<object>(),
                ["blockers"] = Array.Empty<object>(),
                ["fieldDefaults"] = prepared.FieldContract.Business.ToDictionary(field => field.Id, _ => string.Empty)
            });

    public CompatibilityApiResult PolicyRejected(
        ConfirmResult policyResult,
        string workspaceId,
        string cardId,
        ConfirmCardRequest request)
    {
        var statusCode = ConfirmHttpStatusMapper.StatusCodeFor(policyResult);
        return statusCode switch
        {
            StatusCodes.Status404NotFound => CardNotFound(workspaceId, cardId),
            StatusCodes.Status400BadRequest => new CompatibilityApiResult(statusCode, new { error = "confirmation_invalid", Reason = policyResult.Reason }),
            StatusCodes.Status401Unauthorized => new CompatibilityApiResult(statusCode, null),
            StatusCodes.Status403Forbidden => new CompatibilityApiResult(statusCode, new { error = "confirmation_forbidden", policyResult.Reason }),
            StatusCodes.Status409Conflict => new CompatibilityApiResult(statusCode, new
            {
                error = "idempotency_conflict",
                policyResult.Reason,
                caseId = workspaceId,
                workItemId = LegacyWorkItemResolver.WorkItemIdFor(workspaceId, cardId),
                request.SubmissionId
            }),
            StatusCodes.Status422UnprocessableEntity => new CompatibilityApiResult(statusCode, new { error = "business_rule_violation", policyResult.Reason }),
            _ => new CompatibilityApiResult(StatusCodes.Status500InternalServerError, new { error = "legacy_compatibility_policy_failed", policyResult.Reason })
        };
    }

    public CompatibilityApiResult Confirmed(ConfirmWorkItemResult result, string workspaceId, string cardId) =>
        result.StatusCode switch
        {
            StatusCodes.Status404NotFound => CardNotFound(workspaceId, cardId),
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
                result.SubmissionId,
                result.CommandSubmissionId
            }),
            StatusCodes.Status422UnprocessableEntity => new CompatibilityApiResult(result.StatusCode, new { error = "business_rule_violation", result.Reason }),
            _ => new CompatibilityApiResult(StatusCodes.Status200OK, Payload(result, workspaceId, cardId))
        };

    private static Dictionary<string, object?> Payload(ConfirmWorkItemResult result, string workspaceId, string cardId) =>
        new()
        {
            ["confirmed"] = result.Confirmed,
            ["commitStatus"] = result.CommitStatus,
            ["projectionStatus"] = result.ProjectionStatus,
            ["caseId"] = FirstNonEmpty(result.CaseId, workspaceId),
            ["workItemId"] = FirstNonEmpty(result.WorkItemId, LegacyWorkItemResolver.WorkItemIdFor(workspaceId, cardId)),
            ["submissionId"] = result.SubmissionId,
            ["resultEventIds"] = result.ResultEventIds,
            ["userMessage"] = result.UserMessage,
            ["clientInstruction"] = result.ClientInstruction,
            ["events"] = Array.Empty<WorkspaceEvent>(),
            ["workspace"] = null,
            ["projection"] = null,
            ["source"] = result.Source,
            ["compatibilitySource"] = "legacy_workspace_card_adapter",
            ["idempotencyKey"] = result.IdempotencyKey,
            ["payloadHash"] = result.PayloadHash,
            ["commandSubmissionId"] = result.CommandSubmissionId,
            ["traceUrl"] = string.IsNullOrWhiteSpace(result.CommandSubmissionId)
                ? null
                : $"/api/operations/trace/submissions/{result.CommandSubmissionId}"
        };

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}

public sealed class LegacyWorkItemResolver
{
    public WorkItem? ResolveOrCreate(CanonicalOperationsApiService operations, string workspaceId, string cardId) =>
        operations.CreateWorkItem(new CreateWorkItemRequest(
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
            })) ?? operations.GetWorkItem(WorkItemIdFor(workspaceId, cardId));

    public static string WorkItemIdFor(string workspaceId, string cardId) => $"{workspaceId}:{cardId}";
}

public sealed class LegacyCompatibilityPolicy
{
    private readonly OperationsRuntimeService catalog;

    public LegacyCompatibilityPolicy(OperationsRuntimeService catalog)
    {
        this.catalog = catalog;
    }

    public ConfirmResult Validate(
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        string actorToken) =>
        catalog.ValidateWorkspaceCardConfirmPolicy(workspaceId, cardId, request, actorToken);
}
