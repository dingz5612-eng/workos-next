namespace WorkOS.Api.Runtime;

internal interface IReconciliationMatchingStore
{
    ReconciliationCandidateGenerationResult GenerateCandidates(ReconciliationCandidateGenerationRequest request);

    IReadOnlyList<ReconciliationMatchCandidate> GetCandidates(string tenantId, string? bankTransactionId = null);

    ReconciliationManualMatchResult AcceptCandidate(string candidateId, string actorId);

    ReconciliationCandidateDecisionResult RejectCandidate(string candidateId, string actorId, string reason);

    ReconciliationMismatchResult MarkMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId);

    ReconciliationTransactionDecisionResult IgnoreTransaction(string bankTransactionId, string tenantId, string actorId, string reason);
}

internal sealed class ReconciliationMatchingService
{
    private readonly IReconciliationMatchingStore store;

    public ReconciliationMatchingService(IReconciliationMatchingStore store)
    {
        this.store = store;
    }

    public ReconciliationCandidateGenerationResult GenerateCandidates(ReconciliationCandidateGenerationRequest request)
    {
        var normalized = request with
        {
            TenantId = Required(request.TenantId, "tenant_required"),
            WindowDays = Math.Clamp(request.WindowDays <= 0 ? 3 : request.WindowDays, 1, 30)
        };

        return store.GenerateCandidates(normalized);
    }

    public IReadOnlyList<ReconciliationMatchCandidate> GetCandidates(string tenantId, string? bankTransactionId = null) =>
        store.GetCandidates(Required(tenantId, "tenant_required"), bankTransactionId);

    public ReconciliationManualMatchResult AcceptCandidate(string candidateId, string actorId) =>
        store.AcceptCandidate(Required(candidateId, "candidate_required"), Actor(actorId));

    public ReconciliationCandidateDecisionResult RejectCandidate(string candidateId, string actorId, string reason) =>
        store.RejectCandidate(Required(candidateId, "candidate_required"), Actor(actorId), DefaultReason(reason, "manual_rejected"));

    public ReconciliationMismatchResult MarkMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId) =>
        store.MarkMismatch(
            Required(bankTransactionId, "bank_transaction_required"),
            request with
            {
                TenantId = Required(request.TenantId, "tenant_required"),
                MismatchType = DefaultReason(request.MismatchType, "manual_review"),
                Reason = DefaultReason(request.Reason, "manual_mismatch")
            },
            Actor(actorId));

    public ReconciliationTransactionDecisionResult IgnoreTransaction(string bankTransactionId, string tenantId, string actorId, string reason) =>
        store.IgnoreTransaction(
            Required(bankTransactionId, "bank_transaction_required"),
            Required(tenantId, "tenant_required"),
            Actor(actorId),
            DefaultReason(reason, "manual_ignored"));

    private static string Required(string? value, string reason)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"reconciliation_{reason}");
        }

        return value.Trim();
    }

    private static string Actor(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "runtime" : value.Trim();

    private static string DefaultReason(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
}
