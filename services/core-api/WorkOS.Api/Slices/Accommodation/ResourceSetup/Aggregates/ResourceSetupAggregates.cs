namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.Aggregates;

public sealed record RoomAggregate(
    string RoomId,
    string WorkspaceId,
    string RoomNo,
    string RoomType,
    int Capacity,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record BedAggregate(
    string BedId,
    string WorkspaceId,
    string RoomId,
    string BedNo,
    string BunkType,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);
