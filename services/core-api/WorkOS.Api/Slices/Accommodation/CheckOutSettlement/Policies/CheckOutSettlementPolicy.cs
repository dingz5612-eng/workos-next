using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.CheckOutSettlement.Policies;

internal static class CheckOutSettlementPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("finalBalanceClose", StringComparison.OrdinalIgnoreCase) &&
            IsFalse(request, "押金结算已请求"))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "checkout_deposit_settlement_required", null);
        }

        if (cardId.Equals("bedRelease", StringComparison.OrdinalIgnoreCase) &&
            IsFalse(request, "退住已开始"))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "checkout_start_required_before_bed_release", null);
        }

        return null;
    }

    private static bool IsFalse(ConfirmCardRequest request, string key)
    {
        if (request.FieldValues is null || !request.FieldValues.TryGetValue(key, out var value))
        {
            return false;
        }

        return value.Equals("否", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("false", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("no", StringComparison.OrdinalIgnoreCase);
    }
}
