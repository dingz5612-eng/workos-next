namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.Tests;

public static class ResourceSetupSliceTests
{
    public const string EventChain = "Accommodation.RoomConfigured -> Accommodation.BedConfigured -> Accommodation.RateConfigured -> Accommodation.RoomReadinessChanged -> Accommodation.RoomBlocked -> Accommodation.RoomReleased";
}
