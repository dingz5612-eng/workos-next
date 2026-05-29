using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.DepositLedger.ProjectorRules;

internal sealed class DepositLedgerProjectorRules : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.WorkspaceId.Equals("W-STAY-DEPOSIT-LEDGER", StringComparison.OrdinalIgnoreCase);

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        CardProgressProjectorRule.ApplyCardProgress(state, workspaceEvent);
}
