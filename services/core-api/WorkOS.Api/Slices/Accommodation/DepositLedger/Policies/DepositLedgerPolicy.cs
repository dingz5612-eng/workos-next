using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.DepositLedger.Policies;

internal static class DepositLedgerPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("depositReceipt", StringComparison.OrdinalIgnoreCase) &&
            IsNonCash(request, "支付方式") &&
            (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_evidence_required:non_cash_deposit", null);
        }

        if (cardId.Equals("depositRefundApproval", StringComparison.OrdinalIgnoreCase))
        {
            var held = DecimalValue(request, "当前持有押金", 0m);
            var deduction = DecimalValue(request, "扣除金额", 0m);
            var applyToBalance = DecimalValue(request, "抵扣欠款金额", 0m);
            if (held > 0m && deduction + applyToBalance > held)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_refund_exceeds_held_amount", null);
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
