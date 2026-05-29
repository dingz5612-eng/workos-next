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

    WorkspaceEvent? CommitConfirmEvents(IReadOnlyList<IdempotentWorkspaceEvent> events);

    DepositLedgerState GetDepositLedgerState(string depositId);

    PaymentLedgerState GetPaymentLedgerState(string paymentId);

    IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null);

    IReadOnlyList<OutboxMessage> GetOutboxMessages();

    void MarkOutboxProcessed(string messageId, string workerId);

    void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5);

    void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent);

    IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null);

    IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents();

    IReadOnlyList<object> GetAccommodationLens(string lensId);
}
