using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PaymentLedger.Policies;

internal static class PaymentLedgerPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request, IProjectionStore store)
    {
        if (cardId.Equals("paymentReceipt", StringComparison.OrdinalIgnoreCase) &&
            IsNonCash(request, "paymentMethod") &&
            (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "payment_evidence_required:non_cash_payment", null);
        }

        var missingRequired = MissingRequired(cardId, request);
        if (missingRequired is not null)
        {
            return missingRequired;
        }

        if (cardId.Equals("paymentReceipt", StringComparison.OrdinalIgnoreCase) &&
            IsDepositPurpose(Value(request, "paymentPurpose", string.Empty)))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "payment_deposit_purpose_forbidden", null);
        }

        if (cardId.Equals("paymentAllocation", StringComparison.OrdinalIgnoreCase))
        {
            var ledger = store.GetPaymentLedgerState(Value(request, "paymentId", string.Empty));
            var confirmed = ledger.ConfirmedAmount;
            var allocated = DecimalValue(request, "allocatedAmount", 0m);
            if (confirmed <= 0m)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "payment_ledger_state_required", null);
            }

            if (allocated > ledger.AvailableForAllocation)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "payment_allocation_exceeds_confirmed_amount", null);
            }
        }

        return null;
    }

    private static ConfirmResult? MissingRequired(string cardId, ConfirmCardRequest request)
    {
        var required = cardId switch
        {
            "paymentReceipt" => new[] { "stayId", "paymentId", "payerName", "paymentAmount", "currency", "paymentMethod", "paymentPurpose" },
            "paymentConfirmation" => new[] { "paymentId", "confirmedAmount", "confirmationResult" },
            "paymentAllocation" => new[] { "paymentId", "allocatedAmount" },
            _ => Array.Empty<string>()
        };

        foreach (var key in required)
        {
            if (string.IsNullOrWhiteSpace(Value(request, key, string.Empty)))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, $"missing_required_field:{key}", null);
            }
        }

        return null;
    }

    private static bool IsDepositPurpose(string purpose) =>
        purpose.Equals("deposit", StringComparison.OrdinalIgnoreCase) ||
        purpose.Equals("security_deposit", StringComparison.OrdinalIgnoreCase) ||
        purpose.Equals("deposit_rent", StringComparison.OrdinalIgnoreCase);

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
