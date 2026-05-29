using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PeriodAnalytics.ProjectorRules;

internal sealed class PeriodAnalyticsProjectorRules : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.WorkspaceId.Equals("W-STAY-PERIOD-ANALYTICS", StringComparison.OrdinalIgnoreCase);

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        CardProgressProjectorRule.ApplyCardProgress(state, workspaceEvent);
}
