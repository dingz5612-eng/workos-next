namespace WorkOS.Api.Runtime;

internal static class OperationBranchResolver
{
    public static string NextCardId(
        WorkspaceSeed seed,
        string workspaceId,
        string cardId,
        IReadOnlyDictionary<string, string>? fieldValues = null)
    {
        var cards = seed.Cards;
        var currentIndex = cards.ToList().FindIndex(card => card.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        if (currentIndex < 0)
        {
            return string.Empty;
        }

        if (IsLeadReservationWorkspace(workspaceId) &&
            cardId.Equals("reservationCreate", StringComparison.OrdinalIgnoreCase))
        {
            var nextAction = RuntimeFieldAliases.Value(fieldValues ?? new Dictionary<string, string>(), "reservationNextAction", "convert");
            var branchCardId = nextAction.Contains("cancel", StringComparison.OrdinalIgnoreCase)
                ? "reservationCancel"
                : "reservationConvert";
            var branchIndex = cards.ToList().FindIndex(card => card.Id.Equals(branchCardId, StringComparison.OrdinalIgnoreCase));
            return branchIndex >= 0 ? cards[branchIndex].Id : string.Empty;
        }

        return currentIndex + 1 < cards.Count ? cards[currentIndex + 1].Id : string.Empty;
    }

    private static bool IsLeadReservationWorkspace(string workspaceId) =>
        workspaceId.Equals("W-STAY-LEAD-RESERVATION", StringComparison.OrdinalIgnoreCase) ||
        workspaceId.StartsWith("W-STAY-LEAD-RESERVATION-", StringComparison.OrdinalIgnoreCase);
}
