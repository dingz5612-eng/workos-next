using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ExpenseLedger.Policies;

internal static class ExpenseLedgerPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("expenseRecord", StringComparison.OrdinalIgnoreCase) &&
            IsNonCash(request) &&
            (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "expense_evidence_required:non_cash_expense", null);
        }

        return null;
    }

    private static bool IsNonCash(ConfirmCardRequest request)
    {
        var method = request.FieldValues is not null
            ? RuntimeFieldAliases.Value(request.FieldValues, "paymentMethod", "cash")
            : "cash";

        return !method.Equals("cash", StringComparison.OrdinalIgnoreCase);
    }
}
