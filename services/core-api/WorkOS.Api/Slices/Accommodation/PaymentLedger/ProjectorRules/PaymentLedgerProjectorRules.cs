using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PaymentLedger.ProjectorRules;

internal sealed class PaymentLedgerProjectorRules : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.WorkspaceId.Equals("W-STAY-PAYMENT-LEDGER", StringComparison.OrdinalIgnoreCase);

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        CardProgressProjectorRule.ApplyCardProgress(state, workspaceEvent);
}
