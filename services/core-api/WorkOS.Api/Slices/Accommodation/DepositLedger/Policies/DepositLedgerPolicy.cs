using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.DepositLedger.Policies;

internal static class DepositLedgerPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request, IProjectionStore store)
    {
        if (cardId.Equals("depositReceipt", StringComparison.OrdinalIgnoreCase) &&
            IsNonCash(request, "paymentMethod") &&
            (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_evidence_required:non_cash_deposit", null);
        }

        var missingRequired = MissingRequired(cardId, request);
        if (missingRequired is not null)
        {
            return missingRequired;
        }

        if (cardId.Equals("depositRefundApproval", StringComparison.OrdinalIgnoreCase))
        {
            var ledger = store.GetDepositLedgerState(Value(request, "depositId", string.Empty));
            var held = ledger.HeldAmount;
            var deduction = DecimalValue(request, "deductionAmount", 0m);
            var applyToBalance = DecimalValue(request, "applyToBalanceAmount", 0m);
            var refund = DecimalValue(request, "refundAmount", 0m);
            if (held <= 0m)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_ledger_state_required", null);
            }

            if (deduction + applyToBalance + refund > ledger.AvailableForSettlement)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_refund_exceeds_held_amount", null);
            }
        }

        if (cardId.Equals("depositDeduction", StringComparison.OrdinalIgnoreCase))
        {
            var ledger = store.GetDepositLedgerState(Value(request, "depositId", string.Empty));
            var deduction = DecimalValue(request, "deductionAmount", 0m);
            if (ledger.HeldAmount <= 0m)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_ledger_state_required", null);
            }

            if (deduction > ledger.AvailableForSettlement)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_refund_exceeds_held_amount", null);
            }
        }

        if (cardId.Equals("depositRefundPayment", StringComparison.OrdinalIgnoreCase))
        {
            var ledger = store.GetDepositLedgerState(Value(request, "depositId", string.Empty));
            if (ledger.RefundApprovedAmount <= ledger.RefundPaidAmount)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "deposit_refund_approval_required", null);
            }
        }

        return null;
    }

    private static ConfirmResult? MissingRequired(string cardId, ConfirmCardRequest request)
    {
        var required = cardId switch
        {
            "depositAssessment" => new[] { "stayId", "requiredDepositAmount", "currency" },
            "depositReceipt" => new[] { "depositId", "receivedAmount", "currency", "paymentMethod" },
            "depositConfirmation" => new[] { "depositReceiptId", "confirmedAmount", "confirmationResult" },
            "depositDeduction" => new[] { "depositId" },
            "depositRefundApproval" => new[] { "depositId" },
            "depositRefundPayment" => new[] { "depositId", "refundAmount", "refundMethod" },
            _ => Array.Empty<string>()
        };

        foreach (var key in required)
        {
            if (string.IsNullOrWhiteSpace(Value(request, key, string.Empty)))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, $"missing_required_field:{key}", null);
            }
        }

        if (cardId.Equals("depositRefundApproval", StringComparison.OrdinalIgnoreCase) &&
            DecimalValue(request, "deductionAmount", 0m) <= 0m &&
            DecimalValue(request, "applyToBalanceAmount", 0m) <= 0m &&
            DecimalValue(request, "refundAmount", 0m) <= 0m)
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "missing_required_field:settlementAmount", null);
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
