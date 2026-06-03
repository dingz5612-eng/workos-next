using Microsoft.AspNetCore.Http;

namespace WorkOS.Api.Runtime;

public sealed class CanonicalOperationsApiService
{
    public const string ConfirmCommandType = "operations.work_item.confirm.v1";
    public static readonly SliceCommandHandlerDefinition ConfirmCommandDefinition = new(
        ConfirmCommandType,
        "operations.work-item-confirm",
        "work-item.confirm.v1",
        new[] { "DomainEvent", "WorkItem", "LedgerEntry" },
        "balanced-ledger-or-none",
        new[] { "confirm-request.evidenceIds" },
        "OperationsRuntimeProjection");

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
        string requestId) =>
        ConfirmWorkItem(workItemId, request, null, actorToken, requestId);

    public ConfirmWorkItemResult ConfirmWorkItem(
        string workItemId,
        ConfirmWorkItemRequest request,
        RuntimeActorContext actor,
        string requestId) =>
        ConfirmWorkItem(workItemId, request, actor, actor.SessionToken, requestId);

    private ConfirmWorkItemResult ConfirmWorkItem(
        string workItemId,
        ConfirmWorkItemRequest request,
        RuntimeActorContext? actorContext,
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

        var normalized = request.Normalize(workItemId, workItem.WorkspaceId, request.CardId ?? workItem.WorkItemType);
        var caseId = FirstNonEmpty(workItem.CaseId, $"case-{workItem.TenantId}");
        var definition = definitions.Resolve(workItem, normalized.CardId);
        var actor = actorContext ?? new RuntimeActorContext(
            actorToken,
            "compatibility",
            workItem.TenantId,
            Array.Empty<string>(),
            "compatibility-token",
            actorToken);
        var admissionDecision = admission.EvaluateConfirm(
            definition,
            actor,
            normalized.DeviceId,
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
            FirstNonEmpty(definition.DefinitionId, $"work-item:{workItem.WorkItemType}:v1"),
            normalized.IdempotencyKey!,
            PayloadFor(workItem, normalized, actor, definition, admissionDecision),
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

        var compatibilityMode = ReadString(envelope.Payload, "compatibilityMode");
        if (!string.IsNullOrWhiteSpace(compatibilityMode))
        {
            responseBody["compatibilityMode"] = compatibilityMode;
            eventPayload["compatibilityMode"] = compatibilityMode;
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
        ConfirmWorkItemRequest request,
        RuntimeActorContext actor,
        WorkItemDefinitionResolution definition,
        AdmissionKernelDecision admission) =>
        new Dictionary<string, object>
        {
            ["workspaceId"] = request.WorkspaceId ?? workItem.WorkspaceId,
            ["cardId"] = request.CardId ?? workItem.WorkItemType,
            ["submissionId"] = request.SubmissionId ?? string.Empty,
            ["cardInstanceId"] = request.CardInstanceId ?? string.Empty,
            ["aggregateRef"] = request.AggregateRef ?? string.Empty,
            ["deviceId"] = request.DeviceId ?? string.Empty,
            ["deviceTrustStatus"] = string.IsNullOrWhiteSpace(request.DeviceId) ? "not_provided" : "provided_unverified",
            ["surface"] = "operations-api",
            ["reason"] = admission.Reason,
            ["definition"] = definition.ToTrace(),
            ["definitionId"] = definition.DefinitionId,
            ["legacyCardId"] = definition.LegacyCardId,
            ["compatibilityMode"] = definition.CompatibilityMode,
            ["admission"] = admission.ToContract(),
            ["admissionDecisionRef"] = admission.AdmissionDecisionRef,
            ["actorId"] = actor.ActorId,
            ["actorRole"] = actor.Role,
            ["actorTenantId"] = actor.TenantId,
            ["authSource"] = actor.AuthSource,
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

    private static bool ProductionRequested(ConfirmWorkItemRequest request) =>
        request.FieldValues is not null &&
        ((request.FieldValues.TryGetValue("runtimeMode", out var runtimeMode) &&
            runtimeMode.Equals("production", StringComparison.OrdinalIgnoreCase)) ||
         (request.FieldValues.TryGetValue("productionConfirm", out var productionConfirm) &&
            productionConfirm.Equals("true", StringComparison.OrdinalIgnoreCase)));

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

        if (result.ResponseBody.TryGetValue("compatibilityMode", out var compatibilityMode))
        {
            clientInstruction["compatibilityMode"] = compatibilityMode!;
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
            string.IsNullOrWhiteSpace(result.SubmissionId) ? null : result.SubmissionId);
    }

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}
