namespace WorkOS.Api.Runtime;

public sealed partial class ProjectionRuntime
{
    public bool ProjectOperationsOutboxMessage(OperationsOutboxMessage message)
    {
        var workspaceEvent = OperationsOutboxProjectionMapper.ToWorkspaceEvent(message);
        if (workspaceEvent is null)
        {
            return false;
        }

        lock (gate)
        {
            if (!state.Workspaces.Any(workspace => workspace.Id.Equals(workspaceEvent.WorkspaceId, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException("operations_projection_workspace_not_found");
            }

            var workspace = state.Workspaces.First(item => item.Id.Equals(workspaceEvent.WorkspaceId, StringComparison.OrdinalIgnoreCase));
            if (!workspace.Cards.Any(card => card.Id.Equals(workspaceEvent.CardId, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException("operations_projection_card_not_found");
            }

            store.AppendAuditEventAndOutbox(workspaceEvent, $"operations:{message.MessageId}");
            outboxProjector.ProcessPending(state);
            return true;
        }
    }
}
