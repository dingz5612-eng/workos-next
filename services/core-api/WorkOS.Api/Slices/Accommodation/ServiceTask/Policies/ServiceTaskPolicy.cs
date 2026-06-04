using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ServiceTask.Policies;

internal static class ServiceTaskPolicy
{
    public static ConfirmResult? Validate(string workspaceId, string cardId, ConfirmCardRequest request, IProjectionStore store)
    {
        var scopeFailure = ValidateResourceScope(cardId, request);
        if (scopeFailure is not null)
        {
            return scopeFailure;
        }

        if (cardId.Equals("roomReleaseAfterService", StringComparison.OrdinalIgnoreCase) &&
            !IsVerifiedForRelease(workspaceId, request, store))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "service_task_verification_required_before_release", null);
        }

        return null;
    }

    private static ConfirmResult? ValidateResourceScope(string cardId, ConfirmCardRequest request)
    {
        if (!cardId.Equals("serviceTaskCreate", StringComparison.OrdinalIgnoreCase) &&
            !cardId.Equals("roomReleaseAfterService", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var values = request.FieldValues ?? new Dictionary<string, string>();
        if (cardId.Equals("roomReleaseAfterService", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(RuntimeFieldAliases.Value(values, "taskId", string.Empty)))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "service_task_required_for_release", null);
        }

        var scope = RuntimeFieldAliases.Value(values, "resourceScope", string.Empty);
        if (string.IsNullOrWhiteSpace(scope))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "service_resource_scope_required", null);
        }

        if (!scope.Equals("room", StringComparison.OrdinalIgnoreCase) &&
            !scope.Equals("bed", StringComparison.OrdinalIgnoreCase) &&
            !scope.Equals("room_beds", StringComparison.OrdinalIgnoreCase))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "service_resource_scope_invalid", null);
        }

        if (scope.Equals("bed", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(RuntimeFieldAliases.Value(values, "bedId", string.Empty)))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "service_bed_required_for_bed_scope", null);
        }

        if ((scope.Equals("room", StringComparison.OrdinalIgnoreCase) ||
             scope.Equals("room_beds", StringComparison.OrdinalIgnoreCase)) &&
            string.IsNullOrWhiteSpace(RuntimeFieldAliases.Value(values, "roomId", string.Empty)))
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "service_room_required_for_room_scope", null);
        }

        return null;
    }

    private static bool IsVerifiedForRelease(string workspaceId, ConfirmCardRequest request, IProjectionStore store)
    {
        var values = request.FieldValues ?? new Dictionary<string, string>();
        var taskId = RuntimeFieldAliases.Value(values, "taskId", string.Empty);
        if (string.IsNullOrWhiteSpace(taskId))
        {
            return false;
        }

        var verifiedEvents = store.GetAuditEvents(workspaceId)
            .Where(item => item.EventType.Equals("Accommodation.ServiceTaskVerified", StringComparison.OrdinalIgnoreCase));

        verifiedEvents = verifiedEvents.Where(item =>
            RuntimeFieldAliases.Value(item.Payload, "taskId", string.Empty).Equals(taskId, StringComparison.OrdinalIgnoreCase));

        return verifiedEvents.Any(item =>
            RuntimeFieldAliases.Value(item.Payload, "verificationResult", string.Empty).Equals("approved", StringComparison.OrdinalIgnoreCase));
    }
}
