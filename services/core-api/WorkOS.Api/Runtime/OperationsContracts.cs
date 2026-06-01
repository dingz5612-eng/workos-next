namespace WorkOS.Api.Runtime;

public sealed record CommandEnvelopeV1(
    string TenantId,
    string CommandType,
    string SchemaVersion,
    string DefinitionVersionId,
    string CaseId,
    string WorkItemId,
    string IdempotencyKey,
    string PayloadHash,
    IReadOnlyDictionary<string, object> Payload);

public sealed record OperationCaseV1(
    string TenantId,
    string CaseId,
    string CaseType,
    string DefinitionVersionId,
    string Status);

public sealed record WorkItemV1(
    string TenantId,
    string CaseId,
    string WorkItemId,
    string WorkItemType,
    string LifecycleState,
    string OwnerRole);

public sealed record CommandSubmissionV1(
    string TenantId,
    string SubmissionId,
    string CaseId,
    string WorkItemId,
    string IdempotencyKey,
    string PayloadHash,
    string Status);

public sealed record DomainEventV1(
    string TenantId,
    string EventId,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    string CausationId,
    string CorrelationId,
    string EventType);

public sealed record LedgerTransactionV1(
    string TenantId,
    string LedgerTransactionId,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    string Currency,
    string BalanceStatus,
    string TransactionType = "");

public sealed record LedgerEntryV1(
    string TenantId,
    string EntryId,
    string LedgerTransactionId,
    string DebitCredit,
    decimal Amount,
    string Currency,
    string AccountId = "",
    string AccountType = "",
    string EntryRole = "");

public sealed record WorkItemTransitionV1(
    string TenantId,
    string TransitionId,
    string CaseId,
    string WorkItemId,
    string FromState,
    string ToState,
    string SubmissionId);

public sealed record ProjectionCommitV1(
    string TenantId,
    string ProjectionCommitId,
    string ProjectionName,
    IReadOnlyList<string> SourceEventRefs,
    string CommitStatus);

public sealed record FactTraceV1(
    string TenantId,
    string TraceId,
    string CaseRef,
    string WorkItemRef,
    string SubmissionRef,
    IReadOnlyList<string> DomainEventRefs,
    IReadOnlyList<string> LedgerTransactionRefs,
    IReadOnlyList<string> LedgerEntryRefs,
    IReadOnlyList<string> ProjectionCommitRefs);

public sealed record RejectedCommandSubmissionV1(
    string TenantId,
    string SubmissionId,
    string CaseId,
    string WorkItemId,
    string Status,
    int StatusCode,
    string FailureCode,
    string FailureReason);

public sealed record RejectionTraceV1(
    string TenantId,
    string TraceId,
    string CaseRef,
    string WorkItemRef,
    string SubmissionRef,
    string PolicyRef,
    int StatusCode,
    string Reason,
    IReadOnlyList<string> EvidenceRefs,
    IReadOnlyList<string> DomainEventRefs,
    IReadOnlyList<string> LedgerTransactionRefs);

public sealed record ScenarioFactGraphV1(
    string TenantId,
    string ScenarioId,
    string ScenarioType,
    IReadOnlyList<string> CommandSubmissions,
    IReadOnlyList<string> RejectedCommandSubmissions,
    IReadOnlyList<string> WorkItems,
    IReadOnlyList<string> EvidenceRefs,
    IReadOnlyList<string> DomainEvents,
    IReadOnlyList<string> LedgerTransactions,
    IReadOnlyList<string> LedgerEntries,
    IReadOnlyList<string> ProjectionCommits,
    IReadOnlyList<string> LensOutputs,
    IReadOnlyList<string> SemanticShadowRefs,
    IReadOnlyList<string> GateImpactRefs);

public sealed record ShadowFactGraphV1(
    string TenantId,
    string GraphId,
    IReadOnlyList<string> SubmissionRefs,
    IReadOnlyList<string> DomainEventRefs,
    IReadOnlyList<string> LedgerTransactionRefs,
    IReadOnlyList<string> ProjectionRefs);
