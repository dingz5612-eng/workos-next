using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ExpenseLedger.Policies;

internal static class ExpenseLedgerPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        return null;
    }
}
