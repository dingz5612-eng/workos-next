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

    CardInstanceRecord PrepareCardInstance(string workspaceId, string cardId, PrepareCardRequest request);

    CardInstanceRecord? FindCardInstance(string cardInstanceId);

    EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId);

    EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId);

    EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request);

    EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request);

    IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null);

    ConfirmResult? ValidateEvidenceForConfirm(string workspaceId, string cardId, ConfirmCardRequest request, IReadOnlyList<EvidenceRequirement> requirements);

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
