namespace WorkOS.Api.Runtime;

public sealed partial class PostgresProjectionStore
{
    public BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request) =>
        bankStatementImports.Preview(request);

    public BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId) =>
        bankStatementImports.Confirm(request, actorId);

    public ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request) =>
        reconciliationMatching.GenerateCandidates(request);

    public IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null) =>
        reconciliationMatching.GetCandidates(tenantId, bankTransactionId);

    public ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string actorId) =>
        reconciliationMatching.AcceptCandidate(candidateId, actorId);

    public ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string actorId, string reason) =>
        reconciliationMatching.RejectCandidate(candidateId, actorId, reason);

    public ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId)
    {
        var mismatch = reconciliationMatching.MarkMismatch(bankTransactionId, request, actorId);
        reconciliationMismatchCases.CreateCaseForMismatch(mismatch.TenantId, mismatch.MismatchId, actorId);
        return mismatch;
    }

    public ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason) =>
        reconciliationMatching.IgnoreTransaction(bankTransactionId, tenantId, actorId, reason);

    public ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request)
    {
        reconciliationMatching.GenerateCandidates(new ReconciliationCandidateGenerationRequest(
            request.TenantId,
            request.BankTransactionId,
            request.ImportId,
            request.WindowDays));
        return reconciliationMismatchCases.DetectMismatches(request);
    }

    public ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId) =>
        reconciliationMismatchCases.CreateCaseForMismatch(tenantId, mismatchId, actorId);

    public LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command) =>
        new LedgerCorrectionRequestCommandHandler(correctionCenter).Handle(command);

    public LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command) =>
        new LedgerCorrectionApproveCommandHandler(correctionCenter).Handle(command);

    public LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command) =>
        new LedgerCorrectionRejectCommandHandler(correctionCenter).Handle(command);

    public LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command) =>
        new LedgerCorrectionApplyCommandHandler(correctionCenter).Handle(command);

    public DepositLedgerState GetDepositLedgerState(string depositId) =>
        accommodationLedgers.GetDepositLedgerState(depositId);

    public PaymentLedgerState GetPaymentLedgerState(string paymentId) =>
        accommodationLedgers.GetPaymentLedgerState(paymentId);
}
