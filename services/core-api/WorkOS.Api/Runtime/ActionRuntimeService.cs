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

    public ActionRuntimeService(
        IProjectionStore store,
        CardConfirmationPolicy confirmationPolicy,
        RuntimeQueryService queryService,
        SliceRuntimeCapabilityGate capabilityGate,
        OutboxProjector outboxProjector)
    {
        this.store = store;
        this.confirmationPolicy = confirmationPolicy;
        this.queryService = queryService;
        this.capabilityGate = capabilityGate;
        this.outboxProjector = outboxProjector;
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
            var projection = ProjectCommittedEvents(state, new[] { existingEvent });
            if (projection is null)
            {
                return new ConfirmResult(ConfirmStatus.ProjectionFailed, "projection_not_caught_up", null);
            }

            return new ConfirmResult(ConfirmStatus.Duplicate, null, new
            {
                confirmed = true,
                duplicate = true,
                workspaceId = workspace.Id,
                cardId = card.Id,
                @event = existingEvent,
                events = new[] { existingEvent },
                workspace,
                projection
            });
        }

        var confirmedProjection = ProjectCommittedEvents(state, events);
        if (confirmedProjection is null)
        {
            return new ConfirmResult(ConfirmStatus.ProjectionFailed, "projection_not_caught_up", null);
        }

        return new ConfirmResult(ConfirmStatus.Confirmed, null, new
        {
            confirmed = true,
            duplicate = false,
            workspaceId = workspace.Id,
            cardId = card.Id,
            @event = events[0],
            events,
            workspace,
            projection = confirmedProjection
        });
    }

    private ProjectionEnvelope? ProjectCommittedEvents(RuntimeState state, IReadOnlyList<WorkspaceEvent> events)
    {
        for (var round = 0; round < 8; round++)
        {
            if (events.All(workspaceEvent => state.Events.Any(item => item.EventId == workspaceEvent.EventId)))
            {
                return queryService.Envelope(state);
            }

            if (outboxProjector.ProcessPending(state) == 0)
            {
                break;
            }
        }

        return events.All(workspaceEvent => state.Events.Any(item => item.EventId == workspaceEvent.EventId))
            ? queryService.Envelope(state)
            : null;
    }

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
