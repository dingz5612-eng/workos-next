namespace WorkOS.Api.Runtime;

internal static class EventSelectionPolicy
{
    public static IReadOnlyList<EventDefinition> EventsForConfirm(CardProjection card)
    {
        if (card.Events.Count == 0)
        {
            throw new InvalidOperationException($"Card '{card.Id}' declares no confirm events.");
        }

        return card.Events;
    }
}
