using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.CheckOutSettlement.Policies;

internal static class CheckOutSettlementPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("finalBalanceClose", StringComparison.OrdinalIgnoreCase) &&
            IsFalse(request, "depositSettlementRequested"))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "checkout_deposit_settlement_required", null);
        }

        if (cardId.Equals("bedRelease", StringComparison.OrdinalIgnoreCase) &&
            IsFalse(request, "checkoutStarted"))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "checkout_start_required_before_bed_release", null);
        }

        return null;
    }

    private static bool IsFalse(ConfirmCardRequest request, string key)
    {
        if (request.FieldValues is null)
        {
            return false;
        }

        return !RuntimeFieldAliases.BoolValue(request.FieldValues, key, true);
    }
}
