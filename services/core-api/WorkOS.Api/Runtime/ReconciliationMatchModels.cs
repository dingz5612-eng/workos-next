namespace WorkOS.Api.Runtime;

public sealed record ReconciliationCandidateGenerationRequest(
    string TenantId,
    string? BankTransactionId = null,
    string? ImportId = null,
    int WindowDays = 3);

public sealed record ReconciliationCandidateGenerationResult(
    int CandidateCount,
    IReadOnlyList<ReconciliationMatchCandidate> Candidates);

public sealed record ReconciliationMatchCandidate(
    string CandidateId,
    string TenantId,
    string BankTransactionId,
    string? PaymentId,
    string? DepositId,
    string? RefundPaymentId,
    decimal Score,
    string CandidateType,
    string Reason,
    string Status,
    DateTimeOffset CreatedAtUtc,
    string ExternalRef,
    decimal Amount,
    string Currency,
    string Direction,
    string Description);

public sealed record ReconciliationMatchDecisionRequest(
    string? Reason = null);

public sealed record ReconciliationManualMatchResult(
    string MatchId,
    string TenantId,
    string BankTransactionId,
    string? PaymentId,
    string? DepositId,
    string? RefundPaymentId,
    string Status,
    string MatchedEventId,
    string MatchedEventType,
    DateTimeOffset MatchedAtUtc);

public sealed record ReconciliationCandidateDecisionResult(
    string CandidateId,
    string Status,
    string Reason);

public sealed record ReconciliationMismatchRequest(
    string TenantId,
    string MismatchType = "manual_review",
    string? Reason = null,
    string? RelatedObjectType = null,
    string? RelatedObjectId = null);

public sealed record ReconciliationTransactionDecisionRequest(
    string TenantId,
    string? Reason = null);

public sealed record ReconciliationMismatchResult(
    string MismatchId,
    string TenantId,
    string BankTransactionId,
    string MismatchType,
    string Reason,
    string Status,
    DateTimeOffset CreatedAtUtc);

public sealed record ReconciliationTransactionDecisionResult(
    string BankTransactionId,
    string Status,
    string Reason);
