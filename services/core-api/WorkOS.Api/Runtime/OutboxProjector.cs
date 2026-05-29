using WorkOS.Api.Slices.Accommodation.CheckOutSettlement.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.DepositLedger.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.PaymentLedger.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.ServiceTask.ProjectorRules;

namespace WorkOS.Api.Runtime;

public sealed class OutboxProjector
{
    private readonly IProjectionStore store;
    private readonly IReadOnlyList<IOutboxProjectorRule> rules;

    public OutboxProjector(IProjectionStore store)
    {
        this.store = store;
        rules = new IOutboxProjectorRule[]
        {
            new DepositLedgerProjectorRules(),
            new PaymentLedgerProjectorRules(),
            new CheckoutProjectorRules(),
            new ServiceTaskProjectorRules(),
            new PeriodAnalyticsProjectorRules(),
            new CardProgressProjectorRule()
        };
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

    private void ApplyEventToReadModel(RuntimeState state, WorkspaceEvent workspaceEvent)
    {
        foreach (var rule in rules)
        {
            if (rule.AppliesTo(workspaceEvent))
            {
                rule.Apply(state, workspaceEvent);
                return;
            }
        }
    }
}

internal interface IOutboxProjectorRule
{
    bool AppliesTo(WorkspaceEvent workspaceEvent);

    void Apply(RuntimeState state, WorkspaceEvent workspaceEvent);
}

internal sealed class CardProgressProjectorRule : IOutboxProjectorRule
{
    public bool AppliesTo(WorkspaceEvent workspaceEvent) => true;

    public void Apply(RuntimeState state, WorkspaceEvent workspaceEvent) =>
        ApplyCardProgress(state, workspaceEvent);

    public static void ApplyCardProgress(RuntimeState state, WorkspaceEvent workspaceEvent)
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
