using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PaymentLedger.Policies;

internal static class PaymentLedgerPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("paymentReceipt", StringComparison.OrdinalIgnoreCase) &&
            IsNonCash(request, "paymentMethod") &&
            (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "payment_evidence_required:non_cash_payment", null);
        }

        if (cardId.Equals("paymentAllocation", StringComparison.OrdinalIgnoreCase))
        {
            var confirmed = DecimalValue(request, "confirmedAmount", 0m);
            var allocated = DecimalValue(request, "allocatedAmount", 0m);
            if (confirmed > 0m && allocated > confirmed)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "payment_allocation_exceeds_confirmed_amount", null);
            }
        }

        return null;
    }

    private static bool IsNonCash(ConfirmCardRequest request, string methodKey)
    {
        var method = Value(request, methodKey, "cash");
        return !method.Equals("cash", StringComparison.OrdinalIgnoreCase);
    }

    private static string Value(ConfirmCardRequest request, string key, string defaultValue) =>
        request.FieldValues is not null
            ? RuntimeFieldAliases.Value(request.FieldValues, key, defaultValue)
            : defaultValue;

    private static decimal DecimalValue(ConfirmCardRequest request, string key, decimal defaultValue) =>
        request.FieldValues is not null
            ? RuntimeFieldAliases.DecimalValue(request.FieldValues, key, defaultValue)
            : defaultValue;
}
