using System.Diagnostics;
using WorkOS.Api.Slices.Policies;

namespace WorkOS.Api.Runtime;

public sealed partial class ProjectionRuntime
{
    private readonly object gate = new();
    private readonly IProjectionStore store;
    private readonly RuntimeQueryService queryService = new();
    private readonly LensQueryService lensQueryService;
    private readonly ActionRuntimeService actionRuntimeService;
    private readonly AuthSessionService authSessionService;
    private readonly OutboxProjector outboxProjector;
    private readonly Dictionary<string, int> failedConfirmReasons = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<long> confirmLatencyMs = new();
    private RuntimeState state;

    private ProjectionRuntime(IProjectionStore store, RuntimeAuthOptions authOptions)
    {
        this.store = store;
        var searchProjectionService = new SearchProjectionService();
        lensQueryService = new LensQueryService(searchProjectionService);
        authSessionService = new AuthSessionService(store, authOptions);
        outboxProjector = new OutboxProjector(store);
        actionRuntimeService = new ActionRuntimeService(
            store,
            new CardConfirmationPolicy(),
            queryService,
            SliceRuntimeCapabilityGate.LoadDefault(),
            outboxProjector,
            authOptions.RequireTrustedDeviceForHighRiskActions);
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
            var stopwatch = Stopwatch.StartNew();
            var result = actionRuntimeService.Confirm(state, workspaceId, cardId, request, actorToken);
            stopwatch.Stop();
            confirmLatencyMs.Add(stopwatch.ElapsedMilliseconds);
            if (confirmLatencyMs.Count > 1024)
            {
                confirmLatencyMs.RemoveRange(0, confirmLatencyMs.Count - 1024);
            }

            if (result.Status is not ConfirmStatus.Confirmed and not ConfirmStatus.Duplicate)
            {
                var key = string.IsNullOrWhiteSpace(result.Reason) ? result.Status.ToString() : result.Reason;
                failedConfirmReasons[key] = failedConfirmReasons.GetValueOrDefault(key) + 1;
            }

            return result;
        }
    }

}
