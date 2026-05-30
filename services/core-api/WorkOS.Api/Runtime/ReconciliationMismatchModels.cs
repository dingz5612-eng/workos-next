namespace WorkOS.Api.Runtime;

public sealed record ReconciliationMismatchDetectionRequest(
    string TenantId,
    string? BankTransactionId = null,
    string? ImportId = null,
    int WindowDays = 3,
    int ConfirmedPaymentThresholdDays = 3,
    int RefundThresholdDays = 3);

public sealed record ReconciliationCaseRecord(
    string ReconciliationCaseId,
    string TenantId,
    string CaseId,
    string MismatchId,
    string MismatchType,
    string? BankTransactionId,
    string? RelatedObjectType,
    string? RelatedObjectId,
    string OwnerRole,
    DateTimeOffset DueAtUtc,
    string BlockerSeverity,
    IReadOnlyList<string> ResolveActions,
    string Status,
    string OpenedEventId,
    DateTimeOffset CreatedAtUtc);

public sealed record ReconciliationMismatchDetectionResult(
    int MismatchCount,
    IReadOnlyList<ReconciliationCaseRecord> Cases,
    IReadOnlyList<ProcessWorkItemIntentRecord> WorkItemIntents);
