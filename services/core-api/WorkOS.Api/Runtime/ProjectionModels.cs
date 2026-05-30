namespace WorkOS.Api.Runtime;

public sealed record RuntimeState(
    List<WorkspaceProjection> Workspaces,
    List<WorkspaceEvent> Events,
    List<RuntimeUser> Users,
    string SchemaVersion = RuntimeStateMigrator.CurrentSchemaVersion);

public sealed record OutboxMessage(
    string MessageId,
    string EventId,
    string WorkspaceId,
    string CardId,
    string EventType,
    string CorrelationId,
    string? CausationId,
    string RequestId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ProcessedAtUtc,
    WorkspaceEvent Event,
    string? ClaimedBy = null,
    DateTimeOffset? ClaimedAtUtc = null,
    DateTimeOffset? ClaimExpiresAtUtc = null,
    int AttemptCount = 0,
    DateTimeOffset? DeadLetteredAtUtc = null,
    string? LastError = null);

public sealed record ProjectionEnvelope(
    string Projection,
    string Version,
    IReadOnlyList<string> Languages,
    string SourceOfTruth,
    IReadOnlyList<WorkspaceProjection> Workspaces,
    IReadOnlyList<WorkspaceEvent> Events);

public sealed record WorkspaceProjection(
    string ProjectionType,
    string Id,
    string Domain,
    string TaskId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    IReadOnlyList<CardProjection> Cards,
    IReadOnlyDictionary<string, string> Next,
    IReadOnlyList<BlockerRule> Blockers);

public sealed record CardProjection(
    string ProjectionType,
    string Id,
    string Status,
    IReadOnlyDictionary<string, string> Title,
    FieldSet Fields,
    IReadOnlyList<EvidenceRequirement> Evidence,
    IReadOnlyList<SystemCheck> Checks,
    IReadOnlyList<BlockerRule> BlockerRules,
    IReadOnlyList<EventDefinition> Events,
    TransitionDefinition Transitions,
    ConfirmationPolicy Confirmation);

public sealed record FieldSet(
    IReadOnlyList<FieldProjection> System,
    IReadOnlyList<FieldProjection> Business,
    IReadOnlyList<FieldProjection> Analytics);

public sealed record FieldProjection(
    string Id,
    IReadOnlyDictionary<string, string> Label,
    string Layer,
    string Type,
    bool Required,
    string Source,
    bool VisibleToUser,
    string AnalyticsKey,
    FieldUi Ui,
    IReadOnlyDictionary<string, string> Help);

public sealed record FieldUi(
    string Control,
    string OptionSet,
    IReadOnlyList<FieldOption> Options,
    string DefaultValue,
    string DerivedFrom,
    bool Readonly);

public sealed record FieldOption(
    string Value,
    IReadOnlyDictionary<string, string> Label);

public sealed record EvidenceRequirement(
    string Id,
    IReadOnlyDictionary<string, string> Label,
    bool Required,
    string Source,
    string AuditEventField,
    IReadOnlyDictionary<string, string> Help);

public sealed record SystemCheck(
    string Id,
    IReadOnlyDictionary<string, string> Label,
    string Severity,
    string Result);

public sealed record BlockerRule(
    string Id,
    IReadOnlyDictionary<string, string> Title,
    string OwnerRole,
    IReadOnlyDictionary<string, string> UnblockAction);

public sealed record EventDefinition(
    string EventType,
    bool AuditRequired,
    IReadOnlyList<string> ProjectionTargets);

public sealed record TransitionDefinition(
    string OnPrepare,
    string OnConfirm,
    string OnBlock);

public sealed record ConfirmationPolicy(
    bool Required,
    bool ForbiddenForAi,
    string RequiredRole,
    IReadOnlyDictionary<string, string> Label);

public sealed record WorkspaceEvent(
    string EventId,
    string WorkspaceId,
    string CardId,
    string EventType,
    string CorrelationId,
    string? CausationId,
    string RequestId,
    string ActorType,
    string ActorId,
    DateTimeOffset OccurredAtUtc,
    IReadOnlyDictionary<string, string> Payload,
    IReadOnlyList<string> ProjectionTargets,
    IReadOnlyList<string>? EvidenceIds = null,
    string? SubmissionId = null,
    string? CardInstanceId = null,
    string? AggregateRef = null);

public sealed record ConfirmCardRequest(
    string? Language,
    string? IdempotencyKey,
    IReadOnlyDictionary<string, string>? FieldValues,
    IReadOnlyList<string>? EvidenceIds,
    string? SubmissionId = null,
    string? CardInstanceId = null,
    string? AggregateRef = null,
    string? RequestId = null,
    string? DeviceId = null);

public sealed record PrepareCardRequest(
    string? SubmissionId = null,
    string? CardInstanceId = null,
    string? AggregateRef = null);

public sealed record EvidenceDraftRequest(
    string WorkspaceId,
    string CardId,
    string CardInstanceId,
    string SubmissionId,
    string RequirementId,
    string? EvidenceId = null);

public sealed record EvidenceAttachmentRequest(
    string FileName,
    string ContentType,
    string ContentSha256,
    long SizeBytes);

public sealed record EvidenceDecisionRequest(
    string ActorId,
    string Reason = "");

public sealed record EvidenceObject(
    string EvidenceId,
    string WorkspaceId,
    string CardId,
    string CardInstanceId,
    string SubmissionId,
    string RequirementId,
    string Status,
    IReadOnlyList<EvidenceAttachment> Attachments,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? AttachedAtUtc,
    DateTimeOffset? VerifiedAtUtc,
    DateTimeOffset? RejectedAtUtc,
    string? UsedEventId,
    string? UsedSubmissionId);

public sealed record EvidenceAttachment(
    string AttachmentId,
    string EvidenceId,
    string FileName,
    string ContentType,
    string ContentSha256,
    long SizeBytes,
    DateTimeOffset AttachedAtUtc);

public sealed record CardInstanceRecord(
    string CardInstanceId,
    string WorkspaceId,
    string CardId,
    string? AggregateRef,
    string? SubmissionId,
    string? IdempotencyKey,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record LoginRequest(string Username, string Password);

public sealed record RuntimeSession(
    string Token,
    string UserId,
    DateTimeOffset IssuedAtUtc,
    DateTimeOffset ExpiresAtUtc,
    DateTimeOffset? RevokedAtUtc = null);

public sealed record RuntimeDeviceSession(
    string DeviceSessionId,
    string TenantId,
    string ActorId,
    string DeviceId,
    string DeviceTrustStatus,
    string UserAgentHash,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LastSeenAtUtc,
    DateTimeOffset? RevokedAtUtc);

public sealed record RuntimeDeviceSessionRequest(
    string TenantId,
    string ActorId,
    string DeviceId,
    string DeviceTrustStatus,
    string UserAgentHash);

public sealed record EvidenceSignedUrlRequest(
    string ActorId,
    string DeviceId,
    int TtlSeconds = 900,
    DateTimeOffset? NowUtc = null);

public sealed record EvidenceSignedUrlResponse(
    string EvidenceId,
    string AttachmentId,
    string Url,
    DateTimeOffset ExpiresAtUtc,
    string AuditEventId);

public sealed record GovernanceExportRequest(
    string ExportType,
    string ActorId,
    string ActorRole,
    IReadOnlyList<string>? ActorCapabilities,
    string DeviceId,
    string DeviceTrustStatus,
    string Surface,
    string Reason,
    DateTimeOffset? NowUtc = null);

public sealed record GovernanceExportResult(
    bool Allowed,
    string Status,
    string ExportType,
    string Reason,
    IReadOnlyList<string> Errors,
    string? DownloadUrl,
    DateTimeOffset ExpiresAtUtc,
    string AuditEventId);

public sealed record RuntimeUser(
    string UserId,
    string Username,
    string DisplayName,
    string Role,
    bool Enabled);

public sealed record BehaviorEventRecord(
    string EventId,
    string EventType,
    string? ObjectType,
    string? ObjectId,
    string Language,
    string? Source,
    DateTimeOffset OccurredAtUtc);

public enum ConfirmStatus
{
    Confirmed,
    Duplicate,
    Invalid,
    Forbidden,
    NotFound,
    ProjectionFailed
}

public sealed record ConfirmResult(ConfirmStatus Status, string? Reason, object? Payload);

public sealed record ConfirmCardResponse(
    bool Confirmed,
    string CommitStatus,
    string ProjectionStatus,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    IReadOnlyList<string> ResultEventIds,
    string UserMessage,
    IReadOnlyDictionary<string, object> ClientInstruction,
    IReadOnlyList<WorkspaceEvent> Events,
    WorkspaceProjection Workspace,
    ProjectionEnvelope? Projection = null);

public sealed record RuntimeObservation(
    string Service,
    string Version,
    string Persistence,
    int WorkspaceCount,
    int CardCount,
    int AuditEventCount,
    int OutboxCount,
    int PendingOutboxCount,
    int DeadLetterOutboxCount,
    int BehaviorEventCount,
    DateTimeOffset? LastAuditEventAtUtc,
    long ProjectionLagSeconds,
    IReadOnlyDictionary<string, int> FailedConfirmReasonDistribution,
    int SurfaceCoverageMissingCount,
    int LedgerInvariantViolationCount,
    string SchemaVersion,
    int ActiveArchitectureExceptionCount,
    IReadOnlyList<string> ActiveArchitectureExceptions,
    ProductionObservabilityMetrics ProductionMetrics);

public sealed record ProductionObservabilityMetrics(
    RuntimeProductionMetrics Runtime,
    OutboxProductionMetrics Outbox,
    ProjectionProductionMetrics Projection,
    MobileProductionMetrics Mobile,
    MoneyProductionMetrics Money,
    DepositProductionMetrics Deposit,
    CheckoutProductionMetrics Checkout,
    ControlPlaneProductionMetrics ControlPlane,
    DateTimeOffset GeneratedAtUtc);

public sealed record RuntimeProductionMetrics(
    long ConfirmLatencyP95Ms,
    int ConfirmLatencySampleCount,
    int ConfirmFailureCount,
    int IdempotencyConflictCount,
    int ForbiddenCount403,
    int ConflictCount409,
    int ValidationCount422,
    int HandlerFailureCount);

public sealed record OutboxProductionMetrics(
    long OutboxLagSeconds,
    int DeadLetterCount,
    int ReplayCount);

public sealed record ProjectionProductionMetrics(
    long ProjectionLagSeconds,
    int RebuildCount,
    int StaleLensCount);

public sealed record MobileProductionMetrics(
    long WorkItemBundleP95Ms,
    int WorkItemBundleSampleCount,
    int UploadFailureCount,
    int SubmitRetryCount,
    int DraftRecoveryCount);

public sealed record MoneyProductionMetrics(
    int PaymentConfirmWithoutEvidenceViolations,
    int AllocationOverAvailableViolations,
    int StayBalanceMismatchCount);

public sealed record DepositProductionMetrics(
    int AvailableRefundNegativeCount,
    int RefundFailedDoubleCount,
    int HeldAmountNegativeCount);

public sealed record CheckoutProductionMetrics(
    int OpenBlockers,
    int DuplicateBlockers,
    int FakeCloseAttempts);

public sealed record ControlPlaneProductionMetrics(
    string GateResultStatus,
    int RedShadowReports,
    int BlockingInvariantFailures,
    string ReleaseState);

internal sealed record CardSeed(
    string Id,
    string Status,
    string ZhTitle,
    string RuTitle,
    string[] System,
    string[] Business,
    string[] Analytics);
