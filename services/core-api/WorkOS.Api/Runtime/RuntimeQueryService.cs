namespace WorkOS.Api.Runtime;

public sealed class RuntimeQueryService
{
    public ProjectionEnvelope Envelope(RuntimeState state) => new(
        "IntentWorkspaceProjection",
        "0.13.0-backend-runtime",
        new[] { "zh-CN", "ru-RU" },
        "IntentWorkspaceProjection + WorkspaceCardProjection",
        state.Workspaces,
        state.Events);

    public WorkspaceProjection? FindWorkspace(RuntimeState state, string workspaceId) =>
        state.Workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));
}
