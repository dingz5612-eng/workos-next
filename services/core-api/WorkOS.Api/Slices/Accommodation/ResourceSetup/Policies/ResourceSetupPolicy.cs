namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.Policies;

public static class ResourceSetupPolicy
{
    public const string RequiredRole = "operator";
    public const string AggregateGate = "Room, Bed, and ResourceActivation must become persisted aggregate roots before this slice is production-grade.";
}
