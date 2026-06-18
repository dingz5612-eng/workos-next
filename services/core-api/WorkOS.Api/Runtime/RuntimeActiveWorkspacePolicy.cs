namespace WorkOS.Api.Runtime;

internal static class RuntimeActiveWorkspacePolicy
{
    public static bool IsRetiredUserEntryWorkspaceId(string? workspaceId)
    {
        if (string.IsNullOrWhiteSpace(workspaceId))
        {
            return false;
        }

        var value = workspaceId.Trim();
        return value.StartsWith("W-STAY-", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("Dormitory.FirstGoldenChain", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("Dormitory.FirstGoldenChain-", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsCurrentUserReachable(WorkspaceProjection? workspace) =>
        workspace is not null && !IsRetiredUserEntryWorkspaceId(workspace.Id);

    public static IReadOnlyList<WorkspaceProjection> CurrentUserReachable(
        IEnumerable<WorkspaceProjection> workspaces) =>
        workspaces.Where(IsCurrentUserReachable).ToArray();
}
