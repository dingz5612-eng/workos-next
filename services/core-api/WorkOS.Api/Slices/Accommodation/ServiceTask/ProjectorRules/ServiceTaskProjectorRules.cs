using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ServiceTask.ProjectorRules;

internal sealed class ServiceTaskProjectorRules : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.WorkspaceId.Equals("W-STAY-SERVICE-TASK", StringComparison.OrdinalIgnoreCase);

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        CardProgressProjectorRule.ApplyCardProgress(state, workspaceEvent);
}
