using WorkOS.Api.Slices.Policies;
using WorkOS.Api.Slices.Accommodation.DepositLedger.Policies;
using WorkOS.Api.Slices.Accommodation.PaymentLedger.Policies;
using WorkOS.Api.Slices.Accommodation.CheckOutSettlement.Policies;
using WorkOS.Api.Slices.Accommodation.ServiceTask.Policies;
using WorkOS.Api.Slices.Accommodation.ExpenseLedger.Policies;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;

namespace WorkOS.Api.Runtime;

public sealed class ActionRuntimeService
{
    private readonly IProjectionStore store;
    private readonly CardConfirmationPolicy confirmationPolicy;
    private readonly RuntimeQueryService queryService;
    private readonly SliceRuntimeCapabilityGate capabilityGate;
    private readonly OutboxProjector outboxProjector;
    private readonly bool requireTrustedDeviceForHighRiskActions;

    public ActionRuntimeService(
        IProjectionStore store,
        CardConfirmationPolicy confirmationPolicy,
        RuntimeQueryService queryService,
        SliceRuntimeCapabilityGate capabilityGate,
        OutboxProjector outboxProjector,
        bool requireTrustedDeviceForHighRiskActions = false)
    {
        this.store = store;
        this.confirmationPolicy = confirmationPolicy;
        this.queryService = queryService;
        this.capabilityGate = capabilityGate;
        this.outboxProjector = outboxProjector;
        this.requireTrustedDeviceForHighRiskActions = requireTrustedDeviceForHighRiskActions;
    }

    public object? Prepare(RuntimeState state, string workspaceId, string cardId, PrepareCardRequest? request = null)
    {
        var workspace = queryService.FindWorkspace(state, workspaceId);
        var card = workspace?.Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        if (workspace is null || card is null)
        {
            return null;
        }

        var cardInstance = store.PrepareCardInstance(workspace.Id, card.Id, request ?? new PrepareCardRequest());

        return new
        {
            prepared = true,
            preparedAtUtc = DateTimeOffset.UtcNow,
            workspaceId = workspace.Id,
            cardId = card.Id,
            cardInstance,
            card,
            allowedActions = new[]
            {
                new
                {
                    actionId = $"{card.Id}.confirm",
                    kind = "confirm",
                    label = card.Confirmation.Label,
                    confirmationPolicy = card.Confirmation
                }
            },
            checks = card.Checks,
            blockers = card.BlockerRules,
            fieldDefaults = card.Fields.Business.ToDictionary(field => field.Id, _ => string.Empty)
        };
    }

    public ConfirmResult Confirm(
        RuntimeState state,
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        string actorToken)
    {
        var workspace = queryService.FindWorkspace(state, workspaceId);
        var card = workspace?.Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        if (workspace is null || card is null)
        {
            return new ConfirmResult(ConfirmStatus.NotFound, null, null);
        }

        var capabilityFailure = capabilityGate.ForbidConfirmIfContractOnly(workspace.Id);
        if (capabilityFailure is not null)
        {
            return capabilityFailure;
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "Confirm requires an idempotency key.", null);
        }
        if (string.IsNullOrWhiteSpace(request.SubmissionId))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "Confirm requires a submissionId.", null);
        }
        if (string.IsNullOrWhiteSpace(request.CardInstanceId))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "Confirm requires a cardInstanceId.", null);
        }

        var actor = store.FindUserBySessionToken(actorToken);
        if (actor is null)
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "actor_session_required", null);
        }

        var policyFailure = confirmationPolicy.Authorize(card, actor);
        if (policyFailure is not null)
        {
            return policyFailure;
        }

        var deviceFailure = RuntimeSecurityPolicy.ValidateConfirm(
            card,
            actor,
            request,
            ResolveDeviceSession(request),
            requireTrustedDeviceForHighRiskActions);
        if (deviceFailure is not null)
        {
            return deviceFailure;
        }

        var idempotentEvent = store.FindEventByIdempotencyKey(request.IdempotencyKey);
        if (idempotentEvent is not null)
        {
            return CommittedResult(
                ConfirmStatus.Duplicate,
                state,
                workspace,
                card,
                request,
                new[] { idempotentEvent });
        }

        var fieldKeyFailure = ValidateCanonicalFieldKeys(request.FieldValues);
        if (fieldKeyFailure is not null)
        {
            return fieldKeyFailure;
        }

        request = request with { FieldValues = NormalizeFieldValues(card, request.FieldValues) };

        var aggregateFailure = ValidateLedgerAggregateRef(workspace.Id, card.Id, request);
        if (aggregateFailure is not null)
        {
            return aggregateFailure;
        }

        var fieldContractFailure = FieldContractValidator.Validate(card, request);
        if (fieldContractFailure is not null)
        {
            return fieldContractFailure;
        }

        var evidenceFailure = ValidateEvidenceObject(workspace.Id, card, request);
        if (evidenceFailure is not null)
        {
            return evidenceFailure;
        }

        var depositPolicyFailure = DepositLedgerPolicy.Validate(card.Id, request, store);
        if (depositPolicyFailure is not null)
        {
            return depositPolicyFailure;
        }

        var paymentPolicyFailure = PaymentLedgerPolicy.Validate(card.Id, request, store);
        if (paymentPolicyFailure is not null)
        {
            return paymentPolicyFailure;
        }

        var checkoutPolicyFailure = CheckOutSettlementPolicy.Validate(card.Id, request);
        if (checkoutPolicyFailure is not null)
        {
            return checkoutPolicyFailure;
        }

        var servicePolicyFailure = ServiceTaskPolicy.Validate(card.Id, request);
        if (servicePolicyFailure is not null)
        {
            return servicePolicyFailure;
        }

        var expensePolicyFailure = ExpenseLedgerPolicy.Validate(card.Id, request);
        if (expensePolicyFailure is not null)
        {
            return expensePolicyFailure;
        }

        var periodPolicyFailure = PeriodAnalyticsPolicy.Validate(card.Id, request);
        if (periodPolicyFailure is not null)
        {
            return periodPolicyFailure;
        }

        var correlationId = request.SubmissionId ?? request.IdempotencyKey;
        var requestId = request.RequestId ?? correlationId;
        var normalizedFieldValues = request.FieldValues ?? new Dictionary<string, string>();
        var evidenceIds = request.EvidenceIds ?? Array.Empty<string>();
        var events = new List<WorkspaceEvent>();
        var committedEvents = new List<IdempotentWorkspaceEvent>();
        string? causationId = null;
        var dispatchPlan = EventSelectionPolicy.PlanForConfirm(card, request);
        foreach (var eventDefinition in dispatchPlan.Events)
        {
            var workspaceEvent = new WorkspaceEvent(
                $"evt-{Guid.NewGuid():N}",
                workspace.Id,
                card.Id,
                eventDefinition.EventType,
                correlationId,
                causationId,
                requestId,
                actor.Role,
                actor.UserId,
                DateTimeOffset.UtcNow,
                normalizedFieldValues,
                eventDefinition.ProjectionTargets,
                evidenceIds,
                request.SubmissionId,
                request.CardInstanceId,
                request.AggregateRef);

            var eventIdempotencyKey = events.Count == 0
                ? request.IdempotencyKey
                : $"{request.IdempotencyKey}:{eventDefinition.EventType}";
            committedEvents.Add(new IdempotentWorkspaceEvent(workspaceEvent, eventIdempotencyKey));
            events.Add(workspaceEvent);
            causationId = workspaceEvent.EventId;
        }

        var existingEvent = store.CommitConfirmEvents(committedEvents);
        if (existingEvent is not null)
        {
            return CommittedResult(
                ConfirmStatus.Duplicate,
                state,
                workspace,
                card,
                request,
                new[] { existingEvent });
        }

        return CommittedResult(
            ConfirmStatus.Confirmed,
            state,
            workspace,
            card,
            request,
            events);
    }

    public ConfirmResult ValidateConfirm(
        RuntimeState state,
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        string actorToken)
    {
        var workspace = queryService.FindWorkspace(state, workspaceId);
        var card = workspace?.Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        if (workspace is null || card is null)
        {
            return new ConfirmResult(ConfirmStatus.NotFound, null, null);
        }

        var requiredFieldFailure = ValidateRequiredConfirmFields(request);
        if (requiredFieldFailure is not null)
        {
            return requiredFieldFailure;
        }

        var capabilityFailure = capabilityGate.ForbidConfirmIfContractOnly(workspace.Id);
        if (capabilityFailure is not null)
        {
            return capabilityFailure;
        }

        var actor = store.FindUserBySessionToken(actorToken);
        if (actor is null)
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "actor_session_required", null);
        }

        var policyFailure = confirmationPolicy.Authorize(card, actor);
        if (policyFailure is not null)
        {
            return policyFailure;
        }

        var deviceFailure = RuntimeSecurityPolicy.ValidateConfirm(
            card,
            actor,
            request,
            ResolveDeviceSession(request),
            requireTrustedDeviceForHighRiskActions);
        if (deviceFailure is not null)
        {
            return deviceFailure;
        }

        var fieldKeyFailure = ValidateCanonicalFieldKeys(request.FieldValues);
        if (fieldKeyFailure is not null)
        {
            return fieldKeyFailure;
        }

        request = request with { FieldValues = NormalizeFieldValues(card, request.FieldValues) };

        var aggregateFailure = ValidateLedgerAggregateRef(workspace.Id, card.Id, request);
        if (aggregateFailure is not null)
        {
            return aggregateFailure;
        }

        var fieldContractFailure = FieldContractValidator.Validate(card, request);
        if (fieldContractFailure is not null)
        {
            return fieldContractFailure;
        }

        var evidenceFailure = ValidateEvidenceObject(workspace.Id, card, request);
        if (evidenceFailure is not null)
        {
            return evidenceFailure;
        }

        var depositPolicyFailure = DepositLedgerPolicy.Validate(card.Id, request, store);
        if (depositPolicyFailure is not null)
        {
            return depositPolicyFailure;
        }

        var paymentPolicyFailure = PaymentLedgerPolicy.Validate(card.Id, request, store);
        if (paymentPolicyFailure is not null)
        {
            return paymentPolicyFailure;
        }

        var checkoutPolicyFailure = CheckOutSettlementPolicy.Validate(card.Id, request);
        if (checkoutPolicyFailure is not null)
        {
            return checkoutPolicyFailure;
        }

        var servicePolicyFailure = ServiceTaskPolicy.Validate(card.Id, request);
        if (servicePolicyFailure is not null)
        {
            return servicePolicyFailure;
        }

        var expensePolicyFailure = ExpenseLedgerPolicy.Validate(card.Id, request);
        if (expensePolicyFailure is not null)
        {
            return expensePolicyFailure;
        }

        var periodPolicyFailure = PeriodAnalyticsPolicy.Validate(card.Id, request);
        if (periodPolicyFailure is not null)
        {
            return periodPolicyFailure;
        }

        return new ConfirmResult(ConfirmStatus.Confirmed, null, null);
    }

    private static ConfirmResult? ValidateRequiredConfirmFields(ConfirmCardRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "Confirm requires an idempotency key.", null);
        }

        if (string.IsNullOrWhiteSpace(request.SubmissionId))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "Confirm requires a submissionId.", null);
        }

        return string.IsNullOrWhiteSpace(request.CardInstanceId)
            ? new ConfirmResult(ConfirmStatus.Invalid, "Confirm requires a cardInstanceId.", null)
            : null;
    }

    private ConfirmResult CommittedResult(
        ConfirmStatus status,
        RuntimeState state,
        WorkspaceProjection workspace,
        CardProjection card,
        ConfirmCardRequest request,
        IReadOnlyList<WorkspaceEvent> events)
    {
        var projection = ProjectCommittedEvents(state, events);
        var projectionStatus = projection.Status;
        var response = new ConfirmCardResponse(
            Confirmed: true,
            CommitStatus: "committed",
            ProjectionStatus: projectionStatus,
            CaseId: workspace.Id,
            WorkItemId: WorkItemIdFor(workspace.Id, card.Id),
            SubmissionId: request.SubmissionId ?? events[0].SubmissionId ?? events[0].CorrelationId,
            ResultEventIds: events.Select(item => item.EventId).ToArray(),
            UserMessage: UserMessageFor(projectionStatus, request.Language),
            ClientInstruction: ClientInstructionFor(projectionStatus),
            Events: events,
            Workspace: workspace,
            Projection: projection.Envelope);

        return new ConfirmResult(status, null, response);
    }

    private ProjectionCommitState ProjectCommittedEvents(RuntimeState state, IReadOnlyList<WorkspaceEvent> events)
    {
        for (var round = 0; round < 8; round++)
        {
            if (events.All(workspaceEvent => state.Events.Any(item => item.EventId == workspaceEvent.EventId)))
            {
                return new ProjectionCommitState("projected", queryService.Envelope(state));
            }

            var processed = outboxProjector.ProcessPending(state);
            if (events.All(workspaceEvent => state.Events.Any(item => item.EventId == workspaceEvent.EventId)))
            {
                return new ProjectionCommitState("projected", queryService.Envelope(state));
            }

            var outboxStatus = ProjectionStatusFromOutbox(events);
            if (outboxStatus == "failed")
            {
                return new ProjectionCommitState("failed", null);
            }

            if (processed == 0)
            {
                break;
            }
        }

        return events.All(workspaceEvent => state.Events.Any(item => item.EventId == workspaceEvent.EventId))
            ? new ProjectionCommitState("projected", queryService.Envelope(state))
            : new ProjectionCommitState(ProjectionStatusFromOutbox(events), null);
    }

    private string ProjectionStatusFromOutbox(IReadOnlyList<WorkspaceEvent> events)
    {
        var eventIds = events.Select(item => item.EventId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var outboxMessages = store.GetOutboxMessages().Where(item => eventIds.Contains(item.EventId)).ToArray();
        return outboxMessages.Any(item => item.DeadLetteredAtUtc is not null || !string.IsNullOrWhiteSpace(item.LastError))
            ? "failed"
            : "pending";
    }

    private static IReadOnlyDictionary<string, object> ClientInstructionFor(string projectionStatus) =>
        new Dictionary<string, object>
        {
            ["disableRetry"] = true,
            ["refreshProjection"] = projectionStatus is "projected" or "pending",
            ["observeOutbox"] = projectionStatus == "failed"
        };

    private static string UserMessageFor(string projectionStatus, string? language) =>
        language?.Equals("ru-RU", StringComparison.OrdinalIgnoreCase) == true
            ? projectionStatus switch
            {
                "projected" => "Отправлено успешно.",
                "failed" => "Отправлено успешно; синхронизация представления не удалась, система зафиксировала это для обработки.",
                _ => "Отправлено успешно, представление синхронизируется."
            }
            : projectionStatus switch
            {
                "projected" => "已提交成功。",
                "failed" => "已提交成功，视图同步失败，系统已记录并会继续处理。",
                _ => "已提交成功，视图同步中。"
            };

    private static string WorkItemIdFor(string workspaceId, string cardId) =>
        $"{workspaceId}:{cardId}";

    private sealed record ProjectionCommitState(string Status, ProjectionEnvelope? Envelope);

    private static IReadOnlyDictionary<string, string> NormalizeFieldValues(
        CardProjection card,
        IReadOnlyDictionary<string, string>? rawValues)
    {
        var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (rawValues is not null)
        {
            foreach (var (key, value) in rawValues)
            {
                var canonicalKey = RuntimeFieldAliases.CanonicalKey(key);
                normalized[canonicalKey] = RuntimeFieldAliases.NormalizeValue(canonicalKey, value);
            }
        }

        return normalized;
    }

    private static ConfirmResult? ValidateCanonicalFieldKeys(IReadOnlyDictionary<string, string>? rawValues)
    {
        if (rawValues is null)
        {
            return null;
        }

        foreach (var key in rawValues.Keys)
        {
            if (!RuntimeFieldAliases.CanonicalKey(key).Equals(key, StringComparison.Ordinal) ||
                key.Any(IsCjkCharacter))
            {
                return new ConfirmResult(ConfirmStatus.Invalid, "canonical_field_id_required", null);
            }
        }

        return null;
    }

    private static bool IsCjkCharacter(char value) =>
        value is >= '\u3400' and <= '\u9fff';

    private ConfirmResult? ValidateEvidenceObject(string workspaceId, CardProjection card, ConfirmCardRequest request)
    {
        var evidenceIds = request.EvidenceIds?.Where(item => !string.IsNullOrWhiteSpace(item)).ToArray() ?? Array.Empty<string>();
        if (evidenceIds.Length == 0 && !RequiresEvidenceObject(card.Id, request))
        {
            return null;
        }

        return store.ValidateEvidenceForConfirm(workspaceId, card.Id, request, card.Evidence);
    }

    private static bool RequiresEvidenceObject(string cardId, ConfirmCardRequest request)
    {
        return cardId.Equals("depositReceipt", StringComparison.OrdinalIgnoreCase) && IsNonCash(request, "paymentMethod") ||
            cardId.Equals("paymentReceipt", StringComparison.OrdinalIgnoreCase) && IsNonCash(request, "paymentMethod") ||
            cardId.Equals("expenseRecord", StringComparison.OrdinalIgnoreCase) && IsNonCash(request, "paymentMethod");
    }

    private static bool IsNonCash(ConfirmCardRequest request, string methodKey)
    {
        var method = request.FieldValues is not null
            ? RuntimeFieldAliases.Value(request.FieldValues, methodKey, "cash")
            : "cash";
        return !method.Equals("cash", StringComparison.OrdinalIgnoreCase);
    }

    private RuntimeDeviceSession? ResolveDeviceSession(ConfirmCardRequest request)
    {
        var deviceId = request.DeviceId;
        if (string.IsNullOrWhiteSpace(deviceId) && request.FieldValues is not null)
        {
            deviceId = RuntimeFieldAliases.Value(request.FieldValues, "deviceId", string.Empty);
        }

        return string.IsNullOrWhiteSpace(deviceId)
            ? null
            : store.FindDeviceSession(deviceId);
    }

    private static ConfirmResult? ValidateLedgerAggregateRef(string workspaceId, string cardId, ConfirmCardRequest request)
    {
        if (!workspaceId.Contains("LEDGER", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.AggregateRef))
        {
            return null;
        }

        return new ConfirmResult(ConfirmStatus.Forbidden, "aggregate_ref_required:ledger_card", null);
    }
}
