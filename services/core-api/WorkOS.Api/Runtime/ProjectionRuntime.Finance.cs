namespace WorkOS.Api.Runtime;

public sealed partial class ProjectionRuntime
{
    public BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request)
    {
        lock (gate) return store.PreviewBankStatementImport(request);
    }

    public BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId)
    {
        lock (gate) return store.ConfirmBankStatementImport(request, actorId);
    }

    public ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request)
    {
        lock (gate) return store.GenerateReconciliationMatchCandidates(request);
    }

    public IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null)
    {
        lock (gate) return store.GetReconciliationMatchCandidates(tenantId, bankTransactionId);
    }

    public ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string actorId)
    {
        lock (gate) return store.AcceptReconciliationMatchCandidate(candidateId, actorId);
    }

    public ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string actorId, string reason)
    {
        lock (gate) return store.RejectReconciliationMatchCandidate(candidateId, actorId, reason);
    }

    public ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId)
    {
        lock (gate) return store.MarkBankTransactionMismatch(bankTransactionId, request, actorId);
    }

    public ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason)
    {
        lock (gate) return store.IgnoreBankTransaction(bankTransactionId, tenantId, actorId, reason);
    }

    public ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request)
    {
        lock (gate) return store.DetectReconciliationMismatches(request);
    }

    public ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId)
    {
        lock (gate) return store.CreateReconciliationCaseForMismatch(tenantId, mismatchId, actorId);
    }

    public LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command)
    {
        lock (gate) return store.RequestLedgerCorrection(command);
    }

    public LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command)
    {
        lock (gate) return store.ApproveLedgerCorrection(command);
    }

    public LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command)
    {
        lock (gate) return store.RejectLedgerCorrection(command);
    }

    public LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command)
    {
        lock (gate) return store.ApplyLedgerCorrection(command);
    }
}
