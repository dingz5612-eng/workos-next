namespace WorkOS.Api.Runtime;

public static class LedgerSemanticRules
{
    public static void Validate(LedgerTransactionV1 transaction, IReadOnlyList<LedgerEntryV1> entries)
    {
        if (entries.Any(item => !item.Currency.Equals(transaction.Currency, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("finance_semantic_currency_mismatch");
        }

        var transactionType = transaction.TransactionType.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(transactionType))
        {
            return;
        }

        switch (transactionType)
        {
            case "deposit_receipt":
                RequireSide(entries, transactionType, "debit", "asset", "asset.cash_or_bank");
                RequireSide(entries, transactionType, "credit", "liability", "liability.deposit");
                ForbidAccountType(entries, transactionType, "revenue");
                break;
            case "payment_receipt":
                RequireSide(entries, transactionType, "debit", "asset", "asset.cash_or_bank");
                RequireSide(entries, transactionType, "credit", "receivable", "receivable.stay");
                ForbidAccountId(entries, transactionType, "liability.deposit");
                break;
            case "refund_deposit":
                var refundDebit = RequireSide(entries, transactionType, "debit", "liability");
                if (refundDebit.AccountId.Equals("liability.deposit", StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrWhiteSpace(refundDebit.AccountId))
                {
                    throw new InvalidOperationException("finance_semantic_refund_requires_original_liability");
                }
                RequireSide(entries, transactionType, "credit", "asset", "asset.cash_or_bank");
                ForbidAccountType(entries, transactionType, "expense");
                ForbidAccountType(entries, transactionType, "revenue");
                break;
            case "deposit_deduction":
                var deductionDebit = RequireSide(entries, transactionType, "debit", "liability");
                if (deductionDebit.AccountId.Equals("liability.deposit", StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrWhiteSpace(deductionDebit.AccountId))
                {
                    throw new InvalidOperationException("finance_semantic_deduction_requires_original_liability");
                }
                RequireSide(entries, transactionType, "credit", "receivable", "receivable.stay");
                ForbidAccountType(entries, transactionType, "revenue");
                break;
            case "ledger_correction_apply":
                RequireSide(entries, transactionType, "debit", "correction", "correction.reversal");
                RequireSide(entries, transactionType, "credit", "correction", "correction.offset");
                break;
            case "expense_record":
                RequireSide(entries, transactionType, "debit", "expense", "expense.operations");
                RequireSide(entries, transactionType, "credit", "asset", "asset.cash_or_bank");
                break;
            default:
                throw new InvalidOperationException($"finance_semantic_unknown_basis_type:{transactionType}");
        }
    }

    private static LedgerEntryV1 RequireSide(
        IReadOnlyList<LedgerEntryV1> entries,
        string transactionType,
        string side,
        string expectedAccountType,
        string? expectedAccountId = null)
    {
        var entry = entries.SingleOrDefault(item => item.DebitCredit.Equals(side, StringComparison.OrdinalIgnoreCase));
        if (entry is null)
        {
            throw new InvalidOperationException($"finance_semantic_{transactionType}_missing_{side}");
        }

        if (!entry.AccountType.Equals(expectedAccountType, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"finance_semantic_{transactionType}_{side}_requires_{expectedAccountType}");
        }

        if (!string.IsNullOrWhiteSpace(expectedAccountId) &&
            !entry.AccountId.Equals(expectedAccountId, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"finance_semantic_{transactionType}_{side}_requires_{expectedAccountId.Replace('.', '_')}");
        }

        return entry;
    }

    private static void ForbidAccountType(IReadOnlyList<LedgerEntryV1> entries, string transactionType, string forbidden)
    {
        if (entries.Any(item => item.AccountType.Equals(forbidden, StringComparison.OrdinalIgnoreCase) ||
            item.AccountId.Contains(forbidden, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException($"finance_semantic_{transactionType}_forbids_{forbidden}");
        }
    }

    private static void ForbidAccountId(IReadOnlyList<LedgerEntryV1> entries, string transactionType, string forbidden)
    {
        if (entries.Any(item => item.AccountId.Equals(forbidden, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException($"finance_semantic_{transactionType}_forbids_{forbidden.Replace('.', '_')}");
        }
    }
}
