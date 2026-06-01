using Microsoft.AspNetCore.Http;

namespace WorkOS.Api.Runtime;

public sealed class CanonicalOperationsApiService
{
    public const string ConfirmCommandType = "operations.work_item.confirm.v1";

    private const string Source = "operations_unit_of_work";
    private const string PayloadFieldValues = "fieldValues";
    private readonly OperationsRuntimeService catalog;
    private readonly OperationsUnitOfWork unitOfWork;
    private readonly OperationsReadStore traces;

    public CanonicalOperationsApiService(
        OperationsRuntimeService catalog,
        OperationsUnitOfWork unitOfWork,
        OperationsReadStore traces)
    {
        this.catalog = catalog;
        this.unitOfWork = unitOfWork;
        this.traces = traces;
    }

    public OperationCase? CreateCase(CreateOperationCaseRequest request) =>
        catalog.CreateCase(request);

    public OperationCase? GetCase(string caseId) =>
        catalog.GetCase(caseId);

    public WorkItem? CreateWorkItem(CreateWorkItemRequest request) =>
        catalog.CreateWorkItem(request);

    public IReadOnlyList<WorkItem> ListWorkItems(string? tenantId = null, string? caseId = null) =>
        catalog.ListWorkItems(tenantId, caseId);

    public WorkItem? GetWorkItem(string workItemId) =>
        catalog.GetWorkItem(workItemId);

    public PrepareWorkItemResult? PrepareWorkItem(string workItemId, PrepareWorkItemRequest request) =>
        catalog.PrepareWorkItem(workItemId, request);

    public ConfirmWorkItemResult ConfirmWorkItem(
        string workItemId,
        ConfirmWorkItemRequest request,
        string actorToken,
        string requestId)
    {
        if (string.IsNullOrWhiteSpace(actorToken))
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

        var workItem = catalog.GetWorkItem(workItemId);
        if (workItem is null)
        {
            return ConfirmWorkItemResult.NotFound(workItemId, request.SubmissionId, request.IdempotencyKey, "operation_work_item_not_found");
        }

        var normalized = request.Normalize(workItemId, workItem.WorkspaceId, request.CardId ?? workItem.WorkItemType);
        var caseId = FirstNonEmpty(workItem.CaseId, $"case-{workItem.TenantId}");
        var command = new OperationsCommandRequest(
            workItem.TenantId,
            caseId,
            workItem.WorkItemId,
            ConfirmCommandType,
            "CommandEnvelope.v1",
            $"work-item:{workItem.WorkItemType}:v1",
            normalized.IdempotencyKey!,
            PayloadFor(workItem, normalized),
            actorToken,
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
                actorToken);
        }

        return ToConfirmResult(commit, normalized);
    }

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

        var moneyFacts = BalancedMoneyKernel.FromEnvelope(envelope);
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
                        ["caseId"] = envelope.CaseId
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
        ConfirmWorkItemRequest request) =>
        new Dictionary<string, object>
        {
            ["workspaceId"] = request.WorkspaceId ?? workItem.WorkspaceId,
            ["cardId"] = request.CardId ?? workItem.WorkItemType,
            ["submissionId"] = request.SubmissionId ?? string.Empty,
            ["cardInstanceId"] = request.CardInstanceId ?? string.Empty,
            ["aggregateRef"] = request.AggregateRef ?? string.Empty,
            ["deviceId"] = request.DeviceId ?? string.Empty,
            ["fieldValues"] = (request.FieldValues ?? new Dictionary<string, string>())
                .ToDictionary(item => item.Key, item => (object)item.Value),
            ["evidenceIds"] = request.EvidenceIds ?? Array.Empty<string>(),
            ["source"] = Source
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
            new Dictionary<string, object>
            {
                ["disableRetry"] = result.StatusCode is StatusCodes.Status409Conflict,
                ["refreshProjection"] = result.ProjectionStatus is not "projected",
                ["observeOutbox"] = result.CommitStatus == "committed"
            },
            Source,
            result.IdempotencyKey,
            result.PayloadHash,
            string.IsNullOrWhiteSpace(result.SubmissionId) ? null : result.SubmissionId);
    }

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}
