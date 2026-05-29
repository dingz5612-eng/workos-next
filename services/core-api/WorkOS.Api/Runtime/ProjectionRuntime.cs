using WorkOS.Api.Slices.Policies;

namespace WorkOS.Api.Runtime;

public sealed class ProjectionRuntime
{
    private readonly object gate = new();
    private readonly IProjectionStore store;
    private readonly RuntimeQueryService queryService = new();
    private readonly LensQueryService lensQueryService;
    private readonly ActionRuntimeService actionRuntimeService;
    private readonly AuthSessionService authSessionService;
    private readonly OutboxProjector outboxProjector;
    private RuntimeState state;

    private ProjectionRuntime(IProjectionStore store, RuntimeAuthOptions authOptions)
    {
        this.store = store;
        var searchProjectionService = new SearchProjectionService();
        lensQueryService = new LensQueryService(searchProjectionService);
        actionRuntimeService = new ActionRuntimeService(store, new CardConfirmationPolicy(), queryService, SliceRuntimeCapabilityGate.LoadDefault());
        authSessionService = new AuthSessionService(store, authOptions);
        outboxProjector = new OutboxProjector(store);
        state = store.LoadOrSeed(ProjectionSeed.Create);
    }

    public static ProjectionRuntime OpenPostgres(
        string connectionString,
        RuntimeAuthOptions? authOptions = null,
        string? migrationsPath = null) =>
        new(new PostgresProjectionStore(connectionString, migrationsPath), authOptions ?? new RuntimeAuthOptions());

    public ProjectionEnvelope GetAll()
    {
        lock (gate)
        {
            return queryService.Envelope(state);
        }
    }

    public WorkspaceProjection? FindWorkspace(string workspaceId)
    {
        lock (gate)
        {
            return queryService.FindWorkspace(state, workspaceId);
        }
    }

    public IReadOnlyList<object> GetWorkQueue()
    {
        lock (gate)
        {
            return lensQueryService.GetWorkQueue(state);
        }
    }

    public IReadOnlyList<object> Search(string? q)
    {
        lock (gate)
        {
            return lensQueryService.Search(state, q);
        }
    }

    public IReadOnlyList<object> GetAccommodationLens(string lensId)
    {
        lock (gate)
        {
            return store.GetAccommodationLens(lensId);
        }
    }

    public object? Prepare(string workspaceId, string cardId)
    {
        lock (gate)
        {
            return actionRuntimeService.Prepare(state, workspaceId, cardId);
        }
    }

    public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
    {
        lock (gate)
        {
            return actionRuntimeService.Confirm(state, workspaceId, cardId, request, actorToken);
        }
    }

    public object? Login(LoginRequest request)
    {
        lock (gate)
        {
            return authSessionService.Login(state, request);
        }
    }

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) => store.GetAuditEvents(workspaceId);

    public IReadOnlyList<OutboxMessage> GetOutboxMessages() => store.GetOutboxMessages();

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => store.GetBehaviorEvents();

    public RuntimeObservation Observe()
    {
        lock (gate)
        {
            var events = store.GetAuditEvents();
            var outbox = store.GetOutboxMessages();
            return new RuntimeObservation(
                "WorkOSNext Core API",
                "0.13.0-backend-runtime",
                "postgresql",
                state.Workspaces.Count,
                state.Workspaces.Sum(workspace => workspace.Cards.Count),
                events.Count,
                outbox.Count,
                outbox.Count(message => message.ProcessedAtUtc is null),
                store.GetBehaviorEvents().Count,
                events.OrderByDescending(item => item.OccurredAtUtc).FirstOrDefault()?.OccurredAtUtc);
        }
    }

    public BehaviorEventRecord AppendBehaviorEvent(BehaviorEventRecord behaviorEvent)
    {
        store.AppendBehaviorEvent(behaviorEvent);
        return behaviorEvent;
    }

    public int ProcessPendingOutbox()
    {
        lock (gate)
        {
            return outboxProjector.ProcessPending(state);
        }
    }
}
