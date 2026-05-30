namespace WorkOS.Api.Runtime;

public sealed partial class ProjectionRuntime
{
    public object? Login(LoginRequest request)
    {
        lock (gate) return authSessionService.Login(state, request);
    }

    public void RevokeSession(string token, string actorId)
    {
        lock (gate) store.RevokeSession(token, actorId);
    }

    public RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request)
    {
        lock (gate) return store.RegisterDeviceSession(request);
    }

    public RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId)
    {
        lock (gate) return store.RevokeDeviceSession(deviceId, actorId);
    }

    public GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request)
    {
        lock (gate) return store.RequestGovernanceExport(request);
    }

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) =>
        store.GetAuditEvents(workspaceId);

    public IReadOnlyList<OutboxMessage> GetOutboxMessages() => store.GetOutboxMessages();

    public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) =>
        store.GetProcessRuns(tenantId);

    public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
        store.GetProcessWorkItemIntents(tenantId);

    public IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null) =>
        store.GetProcessRequestEventIntents(tenantId);

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => store.GetBehaviorEvents();

    public RuntimeObservation Observe()
    {
        lock (gate)
        {
            var events = store.GetAuditEvents();
            var outbox = store.GetOutboxMessages();
            var behaviorEvents = store.GetBehaviorEvents();
            var lastAuditAt = events.OrderByDescending(item => item.OccurredAtUtc).FirstOrDefault()?.OccurredAtUtc;
            var activeExceptions = ArchitectureExceptionCatalog.LoadDefault().ActiveRuleIds();
            var surfacePolicies = RuntimeSurfacePolicyCatalog.LoadDefault();
            var projectionLagSeconds = lastAuditAt is null
                ? 0
                : Math.Max(0, Convert.ToInt64((DateTimeOffset.UtcNow - lastAuditAt.Value).TotalSeconds));
            var databaseMetrics = store is PostgresProjectionStore postgresStore
                ? postgresStore.GetProductionObservabilityDatabaseSnapshot()
                : ProductionObservabilityDatabaseSnapshot.Empty;
            var productionMetrics = ProductionObservabilityMetricsBuilder.Build(
                outbox,
                behaviorEvents,
                failedConfirmReasons,
                confirmLatencyMs,
                databaseMetrics,
                projectionLagSeconds,
                DateTimeOffset.UtcNow);

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
                behaviorEvents.Count,
                lastAuditAt,
                projectionLagSeconds,
                new Dictionary<string, int>(failedConfirmReasons, StringComparer.OrdinalIgnoreCase),
                surfacePolicies.MissingSurfaceCoverageCount(state),
                0,
                state.SchemaVersion,
                activeExceptions.Count,
                activeExceptions,
                productionMetrics);
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
