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
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ProcessedAtUtc,
    WorkspaceEvent Event);

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
    string AnalyticsKey);

public sealed record EvidenceRequirement(
    string Id,
    IReadOnlyDictionary<string, string> Label,
    bool Required,
    string Source,
    string AuditEventField);

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
    string ActorType,
    string ActorId,
    DateTimeOffset OccurredAtUtc,
    IReadOnlyDictionary<string, string> Payload,
    IReadOnlyList<string> ProjectionTargets);

public sealed record ConfirmCardRequest(
    string? Language,
    string? IdempotencyKey,
    IReadOnlyDictionary<string, string>? FieldValues,
    IReadOnlyList<string>? EvidenceIds);

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
    Forbidden,
    NotFound
}

public sealed record ConfirmResult(ConfirmStatus Status, string? Reason, object? Payload);

internal sealed record CardSeed(
    string Id,
    string Status,
    string ZhTitle,
    string RuTitle,
    string[] System,
    string[] Business,
    string[] Analytics);
