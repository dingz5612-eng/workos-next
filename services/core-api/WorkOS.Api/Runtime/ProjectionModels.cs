namespace WorkOS.Api.Runtime;

public sealed record RuntimeState(
    List<WorkspaceProjection> Workspaces,
    List<WorkspaceEvent> Events,
    List<RuntimeUser> Users);

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
    int RetryCount = 0,
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
    IReadOnlyList<string>? EvidenceIds = null);

public sealed record ConfirmCardRequest(
    string? Language,
    string? IdempotencyKey,
    IReadOnlyDictionary<string, string>? FieldValues,
    IReadOnlyList<string>? EvidenceIds,
    string? RequestId = null);

public sealed record LoginRequest(string Username, string Password);

public sealed record RuntimeSession(
    string Token,
    string UserId,
    DateTimeOffset IssuedAtUtc,
    DateTimeOffset ExpiresAtUtc);

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
    NotFound
}

public sealed record ConfirmResult(ConfirmStatus Status, string? Reason, object? Payload);

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
    DateTimeOffset? LastAuditEventAtUtc);

internal sealed record CardSeed(
    string Id,
    string Status,
    string ZhTitle,
    string RuTitle,
    string[] System,
    string[] Business,
    string[] Analytics);
