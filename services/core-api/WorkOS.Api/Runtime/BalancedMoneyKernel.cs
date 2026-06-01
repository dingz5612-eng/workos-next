namespace WorkOS.Api.Runtime;

public static class BalancedMoneyKernel
{
    public static BalancedMoneyFacts FromEnvelope(CommandEnvelopeV1 envelope)
    {
        var cardId = ReadString(envelope.Payload, "cardId");
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

        var transactionId = $"ltx-{OperationsHash.Short(envelope.TenantId, envelope.WorkItemId, envelope.IdempotencyKey, commandKind)}";
        var commit = FinanceTruthPipeline.Commit(MoneyBasis.FromEnvelope(envelope, commandKind), transactionId);

        return new BalancedMoneyFacts(
            new[] { commit.LedgerTransaction },
            commit.LedgerEntries,
            new Dictionary<string, object>
            {
                ["moneyKernel"] = "finance_truth_pipeline",
                ["moneyCommand"] = commandKind,
                ["ledgerTransactionIds"] = new[] { transactionId },
                ["ledgerEntryIds"] = commit.LedgerEntries.Select(item => item.EntryId).ToArray(),
                ["ledgerBalanceStatus"] = "balanced",
                ["financeCommitId"] = commit.FinanceCommitId,
                ["financeReceiptId"] = commit.Receipt.ReceiptId
            });
    }

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
