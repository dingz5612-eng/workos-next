using WorkOS.Api.Slices.Policies;

namespace WorkOS.Api.Runtime;

public sealed class ActionRuntimeService
{
    private readonly IProjectionStore store;
    private readonly CardConfirmationPolicy confirmationPolicy;
    private readonly RuntimeQueryService queryService;

    public ActionRuntimeService(
        IProjectionStore store,
        CardConfirmationPolicy confirmationPolicy,
        RuntimeQueryService queryService)
    {
        this.store = store;
        this.confirmationPolicy = confirmationPolicy;
        this.queryService = queryService;
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
