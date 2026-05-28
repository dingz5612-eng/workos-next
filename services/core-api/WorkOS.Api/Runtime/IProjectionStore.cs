namespace WorkOS.Api.Runtime;

public interface IProjectionStore
{
    RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory);

    void SaveState(RuntimeState state);

    RuntimeSession CreateSession(RuntimeUser user);

    RuntimeUser? FindUserBySessionToken(string token);

    WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey);

    void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey);

    void ApplySliceAggregate(WorkspaceEvent workspaceEvent);

    IReadOnlyList<OutboxMessage> GetPendingOutboxMessages(int take = 50);

    IReadOnlyList<OutboxMessage> GetOutboxMessages();

    void MarkOutboxProcessed(string messageId);

    void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent);

    IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null);

    IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents();
}
