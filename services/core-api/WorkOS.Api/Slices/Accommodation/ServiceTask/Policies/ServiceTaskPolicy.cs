using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ServiceTask.Policies;

internal static class ServiceTaskPolicy
{
    public static ConfirmResult? Validate(string workspaceId, string cardId, ConfirmCardRequest request, IProjectionStore store)
    {
        if (cardId.Equals("roomReleaseAfterService", StringComparison.OrdinalIgnoreCase) &&
            !IsVerifiedForRelease(workspaceId, request, store))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "service_task_verification_required_before_release", null);
        }

        return null;
    }

    private static bool IsVerifiedForRelease(string workspaceId, ConfirmCardRequest request, IProjectionStore store)
    {
        var values = request.FieldValues ?? new Dictionary<string, string>();
        if (RuntimeFieldAliases.BoolValue(values, "serviceTaskVerified", false))
        {
            return true;
        }

        var taskId = RuntimeFieldAliases.Value(values, "taskId", string.Empty);
        var verifiedEvents = store.GetAuditEvents(workspaceId)
            .Where(item => item.EventType.Equals("Accommodation.ServiceTaskVerified", StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(taskId))
        {
            verifiedEvents = verifiedEvents.Where(item =>
                RuntimeFieldAliases.Value(item.Payload, "taskId", string.Empty).Equals(taskId, StringComparison.OrdinalIgnoreCase));
        }

        return verifiedEvents.Any(item =>
            RuntimeFieldAliases.Value(item.Payload, "verificationResult", string.Empty).Equals("approved", StringComparison.OrdinalIgnoreCase));
    }
}
