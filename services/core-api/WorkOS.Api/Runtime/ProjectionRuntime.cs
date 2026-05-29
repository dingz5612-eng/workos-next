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
    private readonly Dictionary<string, int> failedConfirmReasons = new(StringComparer.OrdinalIgnoreCase);
    private RuntimeState state;

    private ProjectionRuntime(IProjectionStore store, RuntimeAuthOptions authOptions)
    {
        this.store = store;
        var searchProjectionService = new SearchProjectionService();
        lensQueryService = new LensQueryService(searchProjectionService);
        authSessionService = new AuthSessionService(store, authOptions);
        outboxProjector = new OutboxProjector(store);
        actionRuntimeService = new ActionRuntimeService(store, new CardConfirmationPolicy(), queryService, SliceRuntimeCapabilityGate.LoadDefault(), outboxProjector);
        state = store.LoadOrSeed(ProjectionSeed.Create);
    }

    public static ProjectionRuntime OpenPostgres(
        string connectionString,
        RuntimeAuthOptions? authOptions = null,
        string? migrationsPath = null) =>
        new(new PostgresProjectionStore(connectionString, migrationsPath), authOptions ?? new RuntimeAuthOptions());

    public ProjectionEnvelope GetAll()
    {
        lock (gate) return queryService.Envelope(state);
    }

    public WorkspaceProjection? FindWorkspace(string workspaceId)
    {
        lock (gate) return queryService.FindWorkspace(state, workspaceId);
    }

    public IReadOnlyList<object> GetWorkQueue()
    {
        lock (gate) return lensQueryService.GetWorkQueue(state);
    }

    public IReadOnlyList<object> GetHomeSurface()
    {
        lock (gate) return lensQueryService.GetHomeSurface(state);
    }

    public IReadOnlyList<object> Search(string? q)
    {
        lock (gate) return lensQueryService.Search(state, q);
    }

    public IReadOnlyList<object> GetLearningCatalog()
    {
        lock (gate) return lensQueryService.GetLearningCatalog(state);
    }

    public IReadOnlyList<object> GetAccommodationLens(string lensId)
    {
        lock (gate) return store.GetAccommodationLens(lensId);
    }

    public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null)
    {
        lock (gate) return actionRuntimeService.Prepare(state, workspaceId, cardId, request);
    }

    public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
    {
        lock (gate)
        {
            var result = actionRuntimeService.Confirm(state, workspaceId, cardId, request, actorToken);
            if (result.Status is not ConfirmStatus.Confirmed and not ConfirmStatus.Duplicate)
            {
                var key = string.IsNullOrWhiteSpace(result.Reason) ? result.Status.ToString() : result.Reason;
                failedConfirmReasons[key] = failedConfirmReasons.GetValueOrDefault(key) + 1;
            }

            return result;
        }
    }

    public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId)
    {
        lock (gate) return store.CreateEvidenceDraft(request, actorId);
    }

    public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId)
    {
        lock (gate) return store.AttachEvidence(evidenceId, request, actorId);
    }

    public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate) return store.VerifyEvidence(evidenceId, request);
    }

    public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate) return store.RejectEvidence(evidenceId, request);
    }

    public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null) => store.GetEvidenceObjects(evidenceId);

    public object? Login(LoginRequest request)
    {
        lock (gate) return authSessionService.Login(state, request);
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
            var lastAuditAt = events.OrderByDescending(item => item.OccurredAtUtc).FirstOrDefault()?.OccurredAtUtc;
            var activeExceptions = ArchitectureExceptionCatalog.LoadDefault().ActiveRuleIds();
            var surfacePolicies = RuntimeSurfacePolicyCatalog.LoadDefault();
            return new RuntimeObservation(
                "WorkOSNext Core API",
                "0.13.0-backend-runtime",
                "postgresql",
                state.Workspaces.Count,
                state.Workspaces.Sum(workspace => workspace.Cards.Count),
                events.Count,
                outbox.Count,
                outbox.Count(message => message.ProcessedAtUtc is null && message.DeadLetteredAtUtc is null),
                outbox.Count(message => message.DeadLetteredAtUtc is not null),
                store.GetBehaviorEvents().Count,
                lastAuditAt,
                lastAuditAt is null ? 0 : Math.Max(0, Convert.ToInt64((DateTimeOffset.UtcNow - lastAuditAt.Value).TotalSeconds)),
                new Dictionary<string, int>(failedConfirmReasons, StringComparer.OrdinalIgnoreCase),
                surfacePolicies.MissingSurfaceCoverageCount(state),
                0,
                state.SchemaVersion,
                activeExceptions.Count,
                activeExceptions);
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
