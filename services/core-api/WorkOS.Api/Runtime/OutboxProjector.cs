namespace WorkOS.Api.Runtime;

public sealed class OutboxProjector
{
    private readonly IProjectionStore store;

    public OutboxProjector(IProjectionStore store)
    {
        this.store = store;
    }

    public int ProcessPending(RuntimeState state)
    {
        var processed = 0;
        foreach (var message in store.GetPendingOutboxMessages())
        {
            ApplyEventToReadModel(state, message.Event);
            store.SaveState(state);
            store.MarkOutboxProcessed(message.MessageId);
            processed++;
        }

        return processed;
    }

    private static void ApplyEventToReadModel(RuntimeState state, WorkspaceEvent workspaceEvent)
    {
        if (state.Events.Any(item => item.EventId == workspaceEvent.EventId))
        {
            return;
        }

        var workspaceIndex = state.Workspaces.FindIndex(workspace => workspace.Id.Equals(workspaceEvent.WorkspaceId, StringComparison.OrdinalIgnoreCase));
        if (workspaceIndex < 0)
        {
            return;
        }

        var workspace = state.Workspaces[workspaceIndex];
        var cards = workspace.Cards.ToList();
        var cardIndex = cards.FindIndex(card => card.Id.Equals(workspaceEvent.CardId, StringComparison.OrdinalIgnoreCase));
        if (cardIndex < 0)
        {
            return;
        }

        cards[cardIndex] = cards[cardIndex] with { Status = "done", BlockerRules = Array.Empty<BlockerRule>() };
        if (cardIndex + 1 < cards.Count && cards[cardIndex + 1].Status == "notStarted")
        {
            cards[cardIndex + 1] = cards[cardIndex + 1] with { Status = "ready" };
        }

        state.Workspaces[workspaceIndex] = workspace with
        {
            Cards = cards,
            Blockers = cards.SelectMany(item => item.BlockerRules).ToArray()
        };
        state.Events.Add(workspaceEvent);
    }
}
