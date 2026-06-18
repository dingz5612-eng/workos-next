namespace WorkOS.Api.Runtime;

public sealed class RuntimeQueryService
{
    public ProjectionEnvelope Envelope(RuntimeState state) => new(
        "IntentWorkspaceProjection",
        "0.13.0-backend-runtime",
        new[] { "zh-CN", "ru-RU", "ky-KG" },
        "IntentWorkspaceProjection + WorkspaceCardProjection",
        RuntimeActiveWorkspacePolicy.CurrentUserReachable(state.Workspaces),
        state.Events
            .Where(item => !RuntimeActiveWorkspacePolicy.IsRetiredUserEntryWorkspaceId(item.WorkspaceId))
            .ToArray());

    public WorkspaceProjection? FindWorkspace(RuntimeState state, string workspaceId) =>
        state.Workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

    public WorkspaceProjection? FindUserReachableWorkspace(RuntimeState state, string workspaceId) =>
        state.Workspaces.FirstOrDefault(workspace =>
            RuntimeActiveWorkspacePolicy.IsCurrentUserReachable(workspace) &&
            workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));
}
