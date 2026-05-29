using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.LeadReservation.ProjectorRules;

internal sealed class LeadReservationProjectorRules : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.WorkspaceId.Equals("W-STAY-LEAD-RESERVATION", StringComparison.OrdinalIgnoreCase);

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        CardProgressProjectorRule.ApplyCardProgress(state, workspaceEvent);
}
