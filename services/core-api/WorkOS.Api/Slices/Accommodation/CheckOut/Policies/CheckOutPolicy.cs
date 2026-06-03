using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.CheckOut.Policies;

internal static class CheckOutPolicy
{
    public static ConfirmResult? Validate(string workspaceId, string cardId, ConfirmCardRequest request)
    {
        return null;
    }
}
