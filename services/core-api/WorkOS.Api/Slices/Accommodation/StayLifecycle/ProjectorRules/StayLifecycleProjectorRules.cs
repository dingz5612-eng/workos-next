using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.StayLifecycle.ProjectorRules;

internal sealed class StayLifecycleProjectorRules : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.WorkspaceId.Equals("W-STAY-LIFECYCLE", StringComparison.OrdinalIgnoreCase);

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        CardProgressProjectorRule.ApplyCardProgress(state, workspaceEvent);
}
