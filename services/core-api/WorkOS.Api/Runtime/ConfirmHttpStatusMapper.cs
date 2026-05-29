using Microsoft.AspNetCore.Http;

namespace WorkOS.Api.Runtime;

internal static class ConfirmHttpStatusMapper
{
    public static int StatusCodeFor(ConfirmResult result) =>
        result.Status switch
        {
            ConfirmStatus.NotFound => StatusCodes.Status404NotFound,
            ConfirmStatus.Invalid => StatusCodes.Status400BadRequest,
            ConfirmStatus.Forbidden when IsAuthenticationFailure(result.Reason) => StatusCodes.Status401Unauthorized,
            ConfirmStatus.Forbidden when IsAuthorizationForbidden(result.Reason) => StatusCodes.Status403Forbidden,
            ConfirmStatus.Forbidden => StatusCodes.Status422UnprocessableEntity,
            ConfirmStatus.Duplicate => StatusCodes.Status409Conflict,
            ConfirmStatus.ProjectionFailed => StatusCodes.Status500InternalServerError,
            _ => StatusCodes.Status200OK
        };

    public static bool IsAuthenticationFailure(string? reason) =>
        reason?.Equals("actor_session_required", StringComparison.OrdinalIgnoreCase) == true ||
        reason?.Equals("invalid_actor_token", StringComparison.OrdinalIgnoreCase) == true;

    public static bool IsAuthorizationForbidden(string? reason) =>
        reason?.StartsWith("ai_confirmation_forbidden", StringComparison.OrdinalIgnoreCase) == true ||
        reason?.StartsWith("role_confirmation_forbidden", StringComparison.OrdinalIgnoreCase) == true ||
        reason?.StartsWith("slice_runtime_forbidden", StringComparison.OrdinalIgnoreCase) == true;
}
