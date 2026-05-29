using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ServiceTask.Policies;

internal static class ServiceTaskPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("roomReleaseAfterService", StringComparison.OrdinalIgnoreCase) &&
            !IsTrue(request, "serviceTaskVerified"))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "service_task_verification_required_before_release", null);
        }

        return null;
    }

    private static bool IsTrue(ConfirmCardRequest request, string key)
    {
        if (request.FieldValues is null)
        {
            return false;
        }

        return RuntimeFieldAliases.BoolValue(request.FieldValues, key, false);
    }
}
