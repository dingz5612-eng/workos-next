using WorkOS.Api.Slices.Accommodation.CheckOutSettlement.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.DepositLedger.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.LeadReservation.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.PaymentLedger.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.ServiceTask.ProjectorRules;
using WorkOS.Api.Slices.Accommodation.StayLifecycle.ProjectorRules;

namespace WorkOS.Api.Runtime;

public sealed class OutboxProjector
{
    private readonly IProjectionStore store;
    private readonly IReadOnlyList<IOutboxProjectorRule> rules;
    private readonly string workerId = $"projection-{Environment.MachineName}-{Guid.NewGuid():N}";

    public OutboxProjector(IProjectionStore store)
    {
        this.store = store;
        rules = new IOutboxProjectorRule[]
        {
            new LeadReservationProjectorRules(),
            new StayLifecycleProjectorRules(),
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
        foreach (var message in store.ClaimPendingOutboxMessages(workerId))
        {
            try
            {
                ApplyEventToReadModel(state, message.Event);
                store.SaveState(state);
                store.MarkOutboxProcessed(message.MessageId, workerId);
                processed++;
            }
            catch (Exception ex)
            {
                store.MarkOutboxFailed(message.MessageId, workerId, ex.Message);
            }
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
                store.ApplyCheckoutServiceProcessRules(workspaceEvent);
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
        var nextCardIndex = NextCardIndex(workspace.Id, cards, cardIndex);
        if (nextCardIndex >= 0 && cards[nextCardIndex].Status == "notStarted")
        {
            cards[nextCardIndex] = cards[nextCardIndex] with { Status = "ready" };
        }

        MarkSkippedBranchCards(workspace.Id, cards, cardIndex);

        state.Workspaces[workspaceIndex] = workspace with
        {
            Cards = cards,
            Blockers = cards.SelectMany(item => item.BlockerRules).ToArray()
        };
        state.Events.Add(workspaceEvent);
    }

    private static int NextCardIndex(string workspaceId, IReadOnlyList<CardProjection> cards, int cardIndex)
    {
        if (IsLeadReservationWorkspace(workspaceId) &&
            cards[cardIndex].Id.Equals("reservationCreate", StringComparison.OrdinalIgnoreCase))
        {
            var convertIndex = cards.ToList().FindIndex(card => card.Id.Equals("reservationConvert", StringComparison.OrdinalIgnoreCase));
            if (convertIndex > cardIndex)
            {
                return convertIndex;
            }
        }

        return cardIndex + 1 < cards.Count ? cardIndex + 1 : -1;
    }

    private static bool IsLeadReservationWorkspace(string workspaceId) =>
        workspaceId.Equals("W-STAY-LEAD-RESERVATION", StringComparison.OrdinalIgnoreCase) ||
        workspaceId.StartsWith("W-STAY-LEAD-RESERVATION-", StringComparison.OrdinalIgnoreCase);

    private static void MarkSkippedBranchCards(string workspaceId, IList<CardProjection> cards, int cardIndex)
    {
        if (!IsLeadReservationWorkspace(workspaceId) ||
            !cards[cardIndex].Id.Equals("reservationCreate", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var cancelIndex = cards.ToList().FindIndex(card => card.Id.Equals("reservationCancel", StringComparison.OrdinalIgnoreCase));
        if (cancelIndex >= 0 && cards[cancelIndex].Status == "notStarted")
        {
            cards[cancelIndex] = cards[cancelIndex] with { Status = "skipped" };
        }
    }
}
