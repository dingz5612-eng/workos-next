using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PaymentLedger.Policies;

internal static class PaymentLedgerPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("paymentReceipt", StringComparison.OrdinalIgnoreCase) &&
            IsNonCash(request, "支付方式") &&
            (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "payment_evidence_required:non_cash_payment", null);
        }

        if (cardId.Equals("paymentAllocation", StringComparison.OrdinalIgnoreCase))
        {
            var confirmed = DecimalValue(request, "确认金额", 0m);
            var allocated = DecimalValue(request, "分配金额", 0m);
            if (confirmed > 0m && allocated > confirmed)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "payment_allocation_exceeds_confirmed_amount", null);
            }
        }

        return null;
    }

    private static bool IsNonCash(ConfirmCardRequest request, string methodKey)
    {
        var method = Value(request, methodKey, "现金");
        return !method.Equals("现金", StringComparison.OrdinalIgnoreCase) &&
            !method.Equals("cash", StringComparison.OrdinalIgnoreCase);
    }

    private static string Value(ConfirmCardRequest request, string key, string defaultValue) =>
        request.FieldValues is not null &&
        request.FieldValues.TryGetValue(key, out var value) &&
        !string.IsNullOrWhiteSpace(value)
            ? value
            : defaultValue;

    private static decimal DecimalValue(ConfirmCardRequest request, string key, decimal defaultValue) =>
        request.FieldValues is not null &&
        request.FieldValues.TryGetValue(key, out var value) &&
        decimal.TryParse(value, out var parsed)
            ? parsed
            : defaultValue;
}
