namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.Commands;

public sealed record CreateRoomCommand(string WorkspaceId, string CardId, string RoomNo, string RoomType);
public sealed record CreateBedCommand(string WorkspaceId, string CardId, string RoomNo, string BedNo, string BunkType);
public sealed record ActivateResourceCommand(string WorkspaceId, string CardId, string Scope, DateTimeOffset AvailableAtUtc);
