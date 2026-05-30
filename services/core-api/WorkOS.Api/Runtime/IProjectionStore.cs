namespace WorkOS.Api.Runtime;

public interface IProjectionStore
{
    RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory);

    void SaveState(RuntimeState state);

    RuntimeSession CreateSession(RuntimeUser user);

    void RevokeSession(string token, string actorId);

    RuntimeUser? FindUserBySessionToken(string token);

    RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request);

    RuntimeDeviceSession? FindDeviceSession(string deviceId);

    RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId);

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

    EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request);

    GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request);

    ConfirmResult? ValidateEvidenceForConfirm(string workspaceId, string cardId, ConfirmCardRequest request, IReadOnlyList<EvidenceRequirement> requirements);

    BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request);

    BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId);

    ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request);

    IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null);

    ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string actorId);

    ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string actorId, string reason);

    ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId);

    ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason);

    ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request);

    ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId);

    LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command);

    LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command);

    LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command);

    LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command);

    DepositLedgerState GetDepositLedgerState(string depositId);

    PaymentLedgerState GetPaymentLedgerState(string paymentId);

    IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null);

    IReadOnlyList<OutboxMessage> GetOutboxMessages();

    void MarkOutboxProcessed(string messageId, string workerId);

    void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5);

    CheckoutServiceProcessManagerResult ApplyCheckoutServiceProcessRules(WorkspaceEvent workspaceEvent);

    IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null);

    IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null);

    IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null);

    void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent);

    IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null);

    IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents();

    IReadOnlyList<object> GetAccommodationLens(string lensId);
}
