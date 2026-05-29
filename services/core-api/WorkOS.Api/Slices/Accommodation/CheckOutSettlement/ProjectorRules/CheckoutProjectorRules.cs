using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.CheckOutSettlement.ProjectorRules;

internal sealed class CheckoutProjectorRules : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.WorkspaceId.Equals("W-STAY-CHECKOUT-SETTLEMENT", StringComparison.OrdinalIgnoreCase);

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        CardProgressProjectorRule.ApplyCardProgress(state, workspaceEvent);
}
