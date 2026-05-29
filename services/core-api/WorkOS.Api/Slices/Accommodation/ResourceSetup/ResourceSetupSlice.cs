namespace WorkOS.Api.Slices.Accommodation.ResourceSetup;

public static class ResourceSetupSlice
{
    public const string Id = "Accommodation.ResourceSetup";
    public const string WorkspaceId = "W-STAY-RESOURCE";

    public static readonly IReadOnlyList<string> Cards = new[] { "roomSetup", "bedSetup", "rateSetup", "roomReadiness", "roomBlock", "roomRelease" };
    public static readonly IReadOnlyList<string> Commands = new[] { "ConfigureRoom", "ConfigureBed", "ConfigureRate", "ChangeRoomReadiness", "BlockRoomOrBed", "ReleaseRoomOrBed" };
    public static readonly IReadOnlyList<string> Events = new[]
    {
        "Accommodation.RoomConfigured",
        "Accommodation.BedConfigured",
        "Accommodation.RateConfigured",
        "Accommodation.RoomReadinessChanged",
        "Accommodation.RoomBlocked",
        "Accommodation.RoomReleased",
        "Accommodation.BedBlocked",
        "Accommodation.BedReleased"
    };
    public static readonly IReadOnlyList<string> ProjectorRules = new[] { "PersistRoom", "PersistBed", "PersistRatePlan", "RefreshResourceLenses" };
    public static readonly IReadOnlyList<string> Tests = new[] { "resource_setup_full_production_chain", "resource_setup_rate_plan_lens" };
}
