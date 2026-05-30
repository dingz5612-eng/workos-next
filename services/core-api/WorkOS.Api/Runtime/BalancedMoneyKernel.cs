namespace WorkOS.Api.Runtime;

public static class BalancedMoneyKernel
{
    private static readonly string[] AmountFields =
    [
        "amount",
        "receivedAmount",
        "confirmedAmount",
        "paymentAmount",
        "depositAmount",
        "refundAmount",
        "deductionAmount",
        "expenseAmount",
        "settlementAmount"
    ];

    public static BalancedMoneyFacts FromEnvelope(CommandEnvelopeV1 envelope)
    {
        var cardId = ReadString(envelope.Payload, "cardId");
        var fieldValues = ReadDictionary(envelope.Payload, "fieldValues");
        var commandKind = ResolveCommandKind(envelope.CommandType, cardId);
        if (commandKind is null)
        {
            return BalancedMoneyFacts.Empty;
        }

        if (commandKind == "checkout_settlement")
        {
            return new BalancedMoneyFacts(
                Array.Empty<LedgerTransactionV1>(),
                Array.Empty<LedgerEntryV1>(),
                new Dictionary<string, object>
                {
                    ["moneyKernel"] = "balanced_money_kernel",
                    ["moneyBoundary"] = "checkout_reads_projection_only"
                });
        }

        var amount = ReadAmount(fieldValues);
        if (amount <= 0)
        {
            throw new InvalidOperationException("balanced_money_requires_positive_amount");
        }

        var currency = FirstNonEmpty(ReadString(fieldValues, "currency"), "KGS").ToUpperInvariant();
        var transactionId = $"ltx-{OperationsHash.Short(envelope.TenantId, envelope.WorkItemId, envelope.IdempotencyKey, commandKind)}";
        var debit = Entry(envelope.TenantId, transactionId, commandKind, "debit", amount, currency);
        var credit = Entry(envelope.TenantId, transactionId, commandKind, "credit", amount, currency);
        var transaction = new LedgerTransactionV1(
            envelope.TenantId,
            transactionId,
            envelope.CaseId,
            envelope.WorkItemId,
            string.Empty,
            currency,
            "balanced",
            commandKind);

        return new BalancedMoneyFacts(
            new[] { transaction },
            new[] { debit, credit },
            new Dictionary<string, object>
            {
                ["moneyKernel"] = "balanced_money_kernel",
                ["moneyCommand"] = commandKind,
                ["ledgerTransactionIds"] = new[] { transactionId },
                ["ledgerEntryIds"] = new[] { debit.EntryId, credit.EntryId },
                ["ledgerBalanceStatus"] = "balanced"
            });
    }

    private static LedgerEntryV1 Entry(
        string tenantId,
        string transactionId,
        string commandKind,
        string side,
        decimal amount,
        string currency)
    {
        var (accountId, accountType, role) = AccountFor(commandKind, side);
        return new LedgerEntryV1(
            tenantId,
            $"le-{OperationsHash.Short(transactionId, side, accountId)}",
            transactionId,
            side,
            amount,
            currency,
            accountId,
            accountType,
            role);
    }

    private static (string AccountId, string AccountType, string Role) AccountFor(string commandKind, string side) =>
        (commandKind, side) switch
        {
            ("deposit_receipt", "debit") => ("asset.cash_or_bank", "asset", "cash_or_bank_increase"),
            ("deposit_receipt", "credit") => ("liability.deposit", "liability", "deposit_liability_increase"),
            ("payment_receipt", "debit") => ("asset.cash_or_bank", "asset", "cash_or_bank_increase"),
            ("payment_receipt", "credit") => ("receivable.stay", "receivable", "ordinary_payment_allocation"),
            ("refund_deposit", "debit") => ("liability.deposit", "liability", "deposit_liability_decrease"),
            ("refund_deposit", "credit") => ("asset.cash_or_bank", "asset", "cash_or_bank_decrease"),
            ("deposit_deduction", "debit") => ("liability.deposit", "liability", "deposit_liability_decrease"),
            ("deposit_deduction", "credit") => ("receivable.stay", "receivable", "deposit_applied_to_stay_balance"),
            ("expense_record", "debit") => ("expense.operations", "expense", "expense_recognized"),
            ("expense_record", "credit") => ("asset.cash_or_bank", "asset", "cash_or_bank_decrease"),
            ("ledger_correction_apply", "debit") => ("correction.reversal", "correction", "correction_reversal_debit"),
            ("ledger_correction_apply", "credit") => ("correction.offset", "correction", "correction_offset_credit"),
            _ => throw new InvalidOperationException($"balanced_money_unknown_account:{commandKind}:{side}")
        };

    private static string? ResolveCommandKind(string commandType, string cardId)
    {
        var value = FirstNonEmpty(cardId, commandType).Replace(".", string.Empty, StringComparison.OrdinalIgnoreCase);
        if (value.Contains("depositReceipt", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("DepositReceipt", StringComparison.OrdinalIgnoreCase))
        {
            return "deposit_receipt";
        }

        if (value.Contains("paymentReceipt", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("PaymentReceipt", StringComparison.OrdinalIgnoreCase))
        {
            return "payment_receipt";
        }

        if (value.Contains("refundDeposit", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("depositRefundPayment", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("RefundDeposit", StringComparison.OrdinalIgnoreCase))
        {
            return "refund_deposit";
        }

        if (value.Contains("depositDeduction", StringComparison.OrdinalIgnoreCase))
        {
            return "deposit_deduction";
        }

        if (value.Contains("checkoutSettlement", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("CheckoutSettlement", StringComparison.OrdinalIgnoreCase))
        {
            return "checkout_settlement";
        }

        if (value.Contains("expenseRecord", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("ExpenseRecord", StringComparison.OrdinalIgnoreCase))
        {
            return "expense_record";
        }

        if (value.Contains("ledgerCorrectionApply", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("LedgerCorrectionApply", StringComparison.OrdinalIgnoreCase))
        {
            return "ledger_correction_apply";
        }

        return null;
    }

    private static IReadOnlyDictionary<string, object> ReadDictionary(IReadOnlyDictionary<string, object> payload, string key)
    {
        if (!payload.TryGetValue(key, out var value))
        {
            return new Dictionary<string, object>();
        }

        if (value is IReadOnlyDictionary<string, object> dictionary)
        {
            return dictionary;
        }

        return new Dictionary<string, object>();
    }

    private static decimal ReadAmount(IReadOnlyDictionary<string, object> values)
    {
        foreach (var field in AmountFields)
        {
            if (!values.TryGetValue(field, out var value))
            {
                continue;
            }

            if (value is decimal amount)
            {
                return amount;
            }

            if (decimal.TryParse(Convert.ToString(value), out var parsed))
            {
                return parsed;
            }
        }

        return 0m;
    }

    private static string ReadString(IReadOnlyDictionary<string, object> values, string key) =>
        values.TryGetValue(key, out var value) ? Convert.ToString(value) ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}

public sealed record BalancedMoneyFacts(
    IReadOnlyList<LedgerTransactionV1> LedgerTransactions,
    IReadOnlyList<LedgerEntryV1> LedgerEntries,
    IReadOnlyDictionary<string, object> ResponseFields)
{
    public static BalancedMoneyFacts Empty { get; } = new(
        Array.Empty<LedgerTransactionV1>(),
        Array.Empty<LedgerEntryV1>(),
        new Dictionary<string, object>());
}
