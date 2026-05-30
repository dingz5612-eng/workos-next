namespace WorkOS.Api.Runtime;

public sealed partial class PostgresProjectionStore
{
    public GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request) =>
        governanceExports.Request(request);

    public IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null) =>
        outbox.ClaimPending(workerId, take, lease ?? TimeSpan.FromMinutes(2));

    public IReadOnlyList<OutboxMessage> GetOutboxMessages() => outbox.GetAll();

    public void MarkOutboxProcessed(string messageId, string workerId) =>
        outbox.MarkProcessed(messageId, workerId);

    public void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5) =>
        outbox.MarkFailed(messageId, workerId, error, maxRetries);

    public CheckoutServiceProcessManagerResult ApplyCheckoutServiceProcessRules(WorkspaceEvent workspaceEvent) =>
        checkoutServiceProcessManager.Handle(workspaceEvent, processManagerStorage);

    public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) =>
        processManagerStorage.GetProcessRuns(tenantId);

    public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
        processManagerStorage.GetWorkItemIntents(tenantId);

    public IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null) =>
        processManagerStorage.GetRequestEventIntents(tenantId);

    public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent) =>
        behaviorEvents.Append(behaviorEvent);

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) =>
        events.GetAuditEvents(workspaceId);

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => behaviorEvents.GetAll();

    public ProductionObservabilityDatabaseSnapshot GetProductionObservabilityDatabaseSnapshot() =>
        productionObservability.GetSnapshot();

    public IReadOnlyList<object> GetAccommodationLens(string lensId) =>
        aggregateLenses.GetAccommodationLens(lensId);
}
