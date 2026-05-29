using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ServiceTask.Policies;

internal static class ServiceTaskPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("roomReleaseAfterService", StringComparison.OrdinalIgnoreCase) &&
            !IsTrue(request, "服务任务已验收"))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "service_task_verification_required_before_release", null);
        }

        return null;
    }

    private static bool IsTrue(ConfirmCardRequest request, string key)
    {
        if (request.FieldValues is null || !request.FieldValues.TryGetValue(key, out var value))
        {
            return false;
        }

        return value.Equals("是", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("yes", StringComparison.OrdinalIgnoreCase);
    }
}
