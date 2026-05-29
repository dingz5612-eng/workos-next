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
            return new ConfirmResult(ConfirmStatus.Forbidden, "A valid actor session token is required for confirmation.", null);
        }

        var policyFailure = confirmationPolicy.Authorize(card, actor);
        if (policyFailure is not null)
        {
            return policyFailure;
        }

        var depositPolicyFailure = DepositLedgerPolicy.Validate(card.Id, request);
        if (depositPolicyFailure is not null)
        {
            return depositPolicyFailure;
        }

        var paymentPolicyFailure = PaymentLedgerPolicy.Validate(card.Id, request);
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

        var existingEvent = store.FindEventByIdempotencyKey(request.IdempotencyKey);
        if (existingEvent is not null)
        {
            return new ConfirmResult(ConfirmStatus.Duplicate, null, new
            {
                confirmed = true,
                duplicate = true,
                workspaceId = workspace.Id,
                cardId = card.Id,
                @event = existingEvent,
                workspace,
                projection = queryService.Envelope(state)
            });
        }

        var eventDefinition = card.Events.First();
        var correlationId = request.IdempotencyKey;
        var workspaceEvent = new WorkspaceEvent(
            $"evt-{Guid.NewGuid():N}",
            workspace.Id,
            card.Id,
            eventDefinition.EventType,
            correlationId,
            null,
            request.RequestId ?? correlationId,
            actor.Role,
            actor.UserId,
            DateTimeOffset.UtcNow,
            request.FieldValues ?? new Dictionary<string, string>(),
            eventDefinition.ProjectionTargets);

        store.AppendAuditEventAndOutbox(workspaceEvent, request.IdempotencyKey);
        store.ApplySliceAggregate(workspaceEvent);

        return new ConfirmResult(ConfirmStatus.Confirmed, null, new
        {
            confirmed = true,
            duplicate = false,
            workspaceId = workspace.Id,
            cardId = card.Id,
            @event = workspaceEvent,
            workspace,
            projection = queryService.Envelope(state)
        });
    }
}
