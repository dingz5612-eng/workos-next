namespace WorkOS.Api.Slices.Accommodation.ResourceSetup;

public static class ResourceSetupSlice
{
    public const string Id = "Accommodation.ResourceSetup";
    public const string WorkspaceId = "W-STAY-RESOURCE";

    public static readonly IReadOnlyList<string> Cards = new[] { "room", "bed", "activate" };
    public static readonly IReadOnlyList<string> Commands = new[] { "CreateRoom", "CreateBed", "ActivateResource" };
    public static readonly IReadOnlyList<string> Events = new[] { "RoomCreated", "BedCreated", "BedActivated" };
    public static readonly IReadOnlyList<string> ProjectorRules = new[] { "AdvanceCardStatus", "RefreshWorkQueue", "RefreshSearchProjection" };
    public static readonly IReadOnlyList<string> Tests = new[] { "room_to_bed_to_activate_event_chain", "resource_setup_projection_refresh" };
}
