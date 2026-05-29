namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.Commands;

public sealed record ConfigureRoomCommand(string WorkspaceId, string CardId, string RoomNo, string RoomType, int BedCount);
public sealed record ConfigureBedCommand(string WorkspaceId, string CardId, string RoomId, string BedNo, string BedType);
public sealed record ConfigureRateCommand(string WorkspaceId, string CardId, string RoomId, decimal MonthlyRatePerBed, string Currency);
public sealed record ChangeRoomReadinessCommand(string WorkspaceId, string CardId, string RoomId, string AvailabilityStatus);
public sealed record BlockRoomOrBedCommand(string WorkspaceId, string CardId, string RoomId, string BedId, string Scope);
public sealed record ReleaseRoomOrBedCommand(string WorkspaceId, string CardId, string RoomId, string BedId, string Scope, DateTimeOffset AvailableAtUtc);
