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

    public ActionRuntimeService(
        IProjectionStore store,
        CardConfirmationPolicy confirmationPolicy,
        RuntimeQueryService queryService,
        SliceRuntimeCapabilityGate capabilityGate)
    {
        this.store = store;
        this.confirmationPolicy = confirmationPolicy;
        this.queryService = queryService;
        this.capabilityGate = capabilityGate;
    }

    public object? Prepare(RuntimeState state, string workspaceId, string cardId)
    {
        var workspace = queryService.FindWorkspace(state, workspaceId);
        var card = workspace?.Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        if (workspace is null || card is null)
        {
            return null;
        }

        return new
        {
            prepared = true,
            preparedAtUtc = DateTimeOffset.UtcNow,
            workspaceId = workspace.Id,
            cardId = card.Id,
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

        request = request with { FieldValues = NormalizeFieldValues(card, request.FieldValues) };

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

        var correlationId = request.IdempotencyKey;
        var requestId = request.RequestId ?? correlationId;
        var normalizedFieldValues = request.FieldValues ?? new Dictionary<string, string>();
        var evidenceIds = request.EvidenceIds ?? Array.Empty<string>();
        var events = new List<WorkspaceEvent>();
        var committedEvents = new List<IdempotentWorkspaceEvent>();
        string? causationId = null;
        foreach (var eventDefinition in EventSelectionPolicy.EventsForConfirm(card))
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
                evidenceIds);

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
            return new ConfirmResult(ConfirmStatus.Duplicate, null, new
            {
                confirmed = true,
                duplicate = true,
                workspaceId = workspace.Id,
                cardId = card.Id,
                @event = existingEvent,
                events = new[] { existingEvent },
                workspace,
                projection = queryService.Envelope(state)
            });
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
            projection = queryService.Envelope(state)
        });
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

        foreach (var field in card.Fields.Business)
        {
            var zhLabel = field.Label.TryGetValue("zh-CN", out var zh) ? zh : string.Empty;
            if (!string.IsNullOrWhiteSpace(zhLabel) &&
                rawValues is not null &&
                rawValues.TryGetValue(zhLabel, out var labelValue) &&
                !normalized.ContainsKey(field.Id))
            {
                normalized[field.Id] = RuntimeFieldAliases.NormalizeValue(field.Id, labelValue);
            }
        }

        return normalized;
    }
}
