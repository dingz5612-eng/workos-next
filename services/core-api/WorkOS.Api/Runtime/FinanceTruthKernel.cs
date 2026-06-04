namespace WorkOS.Api.Runtime;

public static class FinanceTruthPipeline
{
    public static FinanceTruthOutcome Route(MoneyBasis basis)
    {
        if (basis.Amount <= 0)
        {
            return FinanceTruthOutcome.Blocked("finance_truth_requires_positive_amount");
        }

        if (basis.TargetFact is "PaymentFact" or "DepositFact" or "LedgerEntry")
        {
            return FinanceTruthOutcome.Blocked("finance_truth_blocks_direct_fact_commit");
        }

        if (basis.BasisType.Equals("bank_import_payment_confirmed", StringComparison.OrdinalIgnoreCase))
        {
            return FinanceTruthOutcome.Blocked("finance_truth_blocks_bank_import_direct_payment_confirmed");
        }

        if (basis.BasisType.Equals("unclear_money", StringComparison.OrdinalIgnoreCase))
        {
            return FinanceTruthOutcome.Unclear(new UnclearMoneyCase(
                $"unclear-{OperationsUnitOfWorkHash.Short(basis.TenantId, basis.BasisId)}",
                basis.TenantId,
                basis.CaseId,
                basis.WorkItemId,
                basis.Amount,
                basis.Currency,
                "unclear_money_requires_finance_review"));
        }

        return FinanceTruthOutcome.Committed(Commit(basis));
    }

    public static FinanceCommit Commit(MoneyBasis basis)
    {
        var transactionId = $"ltx-{OperationsUnitOfWorkHash.Short(basis.TenantId, basis.WorkItemId, basis.BasisId, basis.BasisType)}";
        return Commit(basis, transactionId);
    }

    public static FinanceCommit Commit(MoneyBasis basis, string transactionId)
    {
        if (basis.Amount <= 0)
        {
            throw new InvalidOperationException("finance_truth_requires_positive_amount");
        }

        if (basis.TargetFact is "PaymentFact" or "DepositFact" or "LedgerEntry")
        {
            throw new InvalidOperationException("finance_truth_blocks_direct_fact_commit");
        }

        if (basis.BasisType.Equals("bank_import_payment_confirmed", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("finance_truth_blocks_bank_import_direct_payment_confirmed");
        }

        if (basis.BasisType.Equals("refund_deposit", StringComparison.OrdinalIgnoreCase) ||
            basis.BasisType.Equals("deposit_deduction", StringComparison.OrdinalIgnoreCase))
        {
            RequireDepositAccountReference(basis);
        }

        if (basis.BasisType.Equals("ledger_correction_apply", StringComparison.OrdinalIgnoreCase) &&
            basis.CorrectionMode is not ("reversal" or "compensation"))
        {
            throw new InvalidOperationException("finance_truth_correction_requires_reversal_or_compensation");
        }

        var transaction = new LedgerTransactionV1(
            basis.TenantId,
            transactionId,
            basis.CaseId,
            basis.WorkItemId,
            string.Empty,
            basis.Currency,
            "balanced",
            basis.BasisType);
        var entries = new[]
        {
            Entry(basis, transactionId, "debit"),
            Entry(basis, transactionId, "credit")
        };

        ValidateBalanced(transaction, entries);
        return new FinanceCommit(
            $"fc-{OperationsUnitOfWorkHash.Short(transactionId)}",
            basis,
            transaction,
            entries,
            FinanceReceipt.FromBasis(basis, transactionId));
    }

    public static void ValidateBalanced(LedgerTransactionV1 transaction, IReadOnlyList<LedgerEntryV1> entries)
    {
        if (!transaction.BalanceStatus.Equals("balanced", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("finance_truth_rejects_unbalanced_transaction_status");
        }

        var debit = entries
            .Where(item => item.LedgerTransactionId.Equals(transaction.LedgerTransactionId, StringComparison.OrdinalIgnoreCase))
            .Where(item => item.DebitCredit.Equals("debit", StringComparison.OrdinalIgnoreCase))
            .Sum(item => item.Amount);
        var credit = entries
            .Where(item => item.LedgerTransactionId.Equals(transaction.LedgerTransactionId, StringComparison.OrdinalIgnoreCase))
            .Where(item => item.DebitCredit.Equals("credit", StringComparison.OrdinalIgnoreCase))
            .Sum(item => item.Amount);
        if (debit <= 0 || debit != credit)
        {
            throw new InvalidOperationException("finance_truth_rejects_unbalanced_transaction");
        }

        LedgerSemanticRules.Validate(transaction, entries);
    }

    private static void RequireDepositAccountReference(MoneyBasis basis)
    {
        if (string.IsNullOrWhiteSpace(basis.DepositAccountId))
        {
            throw new InvalidOperationException("finance_truth_requires_original_deposit_account");
        }
    }

    private static LedgerEntryV1 Entry(MoneyBasis basis, string transactionId, string side)
    {
        var (accountId, accountType, role) = AccountFor(basis.BasisType, side);
        if ((basis.BasisType.Equals("refund_deposit", StringComparison.OrdinalIgnoreCase) ||
             basis.BasisType.Equals("deposit_deduction", StringComparison.OrdinalIgnoreCase)) &&
            accountId == "liability.deposit")
        {
            accountId = basis.DepositAccountId!;
        }

        return new LedgerEntryV1(
            basis.TenantId,
            $"le-{OperationsUnitOfWorkHash.Short(transactionId, side, accountId)}",
            transactionId,
            side,
            basis.Amount,
            basis.Currency,
            accountId,
            accountType,
            role);
    }

    private static (string AccountId, string AccountType, string Role) AccountFor(string basisType, string side) =>
        (basisType, side) switch
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
            _ => throw new InvalidOperationException($"finance_truth_unknown_account:{basisType}:{side}")
        };
}

public sealed class DepositAccountService
{
    public DepositAccountSnapshot Open(MoneyBasis depositReceipt)
    {
        if (!depositReceipt.BasisType.Equals("deposit_receipt", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("deposit_account_opens_from_deposit_receipt_only");
        }

        return new DepositAccountSnapshot(
            FirstNonEmpty(depositReceipt.DepositAccountId, $"deposit-account-{OperationsUnitOfWorkHash.Short(depositReceipt.TenantId, depositReceipt.CaseId)}"),
            depositReceipt.TenantId,
            depositReceipt.CaseId,
            depositReceipt.WorkItemId,
            depositReceipt.Amount,
            0m,
            0m,
            depositReceipt.Currency,
            "held");
    }

    public DepositAccountSnapshot ApplyDeduction(DepositAccountSnapshot account, decimal amount)
    {
        EnsureAvailable(account, amount);
        return account with { DeductedAmount = account.DeductedAmount + amount, Status = "settling" };
    }

    public DepositAccountSnapshot ApplyRefund(DepositAccountSnapshot account, decimal amount)
    {
        EnsureAvailable(account, amount);
        return account with { RefundedAmount = account.RefundedAmount + amount, Status = account.AvailableLiability == amount ? "closed" : "settling" };
    }

    private static void EnsureAvailable(DepositAccountSnapshot account, decimal amount)
    {
        if (string.IsNullOrWhiteSpace(account.DepositAccountId))
        {
            throw new InvalidOperationException("finance_truth_requires_original_deposit_account");
        }

        if (amount <= 0 || amount > account.AvailableLiability)
        {
            throw new InvalidOperationException("deposit_refund_or_deduction_exceeds_available_liability");
        }
    }

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}

public sealed class DepositRefundService
{
    public MoneyBasis CreateRefundBasis(DepositAccountSnapshot account, decimal amount, string workItemId, string basisId)
    {
        if (amount <= 0 || amount > account.AvailableLiability)
        {
            throw new InvalidOperationException("deposit_refund_or_deduction_exceeds_available_liability");
        }

        return new MoneyBasis(
            account.TenantId,
            account.CaseId,
            workItemId,
            basisId,
            "refund_deposit",
            amount,
            account.Currency,
            "FinanceTruthPack",
            "MoneyBasis",
            account.DepositAccountId,
            "reversal",
            Array.Empty<string>());
    }
}

public sealed class PaymentAllocationService
{
    public FinanceReceipt AllocateOrdinaryPayment(FinanceCommit commit, string stayId)
    {
        if (!commit.Basis.BasisType.Equals("payment_receipt", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("payment_allocation_accepts_ordinary_payment_only");
        }

        if (commit.LedgerEntries.Any(item => item.AccountId.Contains("deposit", StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("ordinary_payment_must_not_mix_with_deposit");
        }

        return commit.Receipt with { LensTargetRef = stayId };
    }
}

public sealed class LedgerProjectionRebuilder
{
    public LedgerProjectionRebuildResult Rebuild(IEnumerable<FinanceCommit> commits)
    {
        var list = commits.ToArray();
        foreach (var commit in list)
        {
            FinanceTruthPipeline.ValidateBalanced(commit.LedgerTransaction, commit.LedgerEntries);
        }

        var depositLiability = list.SelectMany(item => item.LedgerEntries)
            .Where(item => item.AccountType.Equals("liability", StringComparison.OrdinalIgnoreCase) &&
                item.AccountId.Contains("deposit", StringComparison.OrdinalIgnoreCase))
            .Sum(item => item.DebitCredit.Equals("credit", StringComparison.OrdinalIgnoreCase) ? item.Amount : -item.Amount);
        var ordinaryPayments = list
            .Where(item => item.Basis.BasisType.Equals("payment_receipt", StringComparison.OrdinalIgnoreCase))
            .Sum(item => item.Basis.Amount);

        return new LedgerProjectionRebuildResult(list.Length, depositLiability, ordinaryPayments, "consistent");
    }
}

public sealed record MoneyBasis(
    string TenantId,
    string CaseId,
    string WorkItemId,
    string BasisId,
    string BasisType,
    decimal Amount,
    string Currency,
    string SourcePack,
    string TargetFact = "MoneyBasis",
    string? DepositAccountId = null,
    string CorrectionMode = "reversal",
    IReadOnlyList<string>? EvidenceRefs = null)
{
    public static MoneyBasis FromEnvelope(CommandEnvelopeV1 envelope, string basisType)
    {
        var values = ReadDictionary(envelope.Payload, "fieldValues");
        return new MoneyBasis(
            envelope.TenantId,
            envelope.CaseId,
            envelope.WorkItemId,
            FirstNonEmpty(ReadString(envelope.Payload, "submissionId"), envelope.IdempotencyKey),
            basisType,
            ReadAmount(values),
            FirstNonEmpty(ReadString(values, "currency"), "KGS").ToUpperInvariant(),
            FirstNonEmpty(ReadString(values, "sourcePack"), "FinanceTruthPack"),
            FirstNonEmpty(ReadString(values, "targetFact"), "MoneyBasis"),
            FirstNonEmpty(ReadString(values, "depositAccountId"), ReadString(values, "depositId")),
            FirstNonEmpty(ReadString(values, "correctionMode"), "reversal"),
            ReadStringArray(envelope.Payload, "evidenceIds"));
    }

    private static IReadOnlyDictionary<string, object> ReadDictionary(IReadOnlyDictionary<string, object> payload, string key) =>
        payload.TryGetValue(key, out var value) && value is IReadOnlyDictionary<string, object> dictionary
            ? dictionary
            : new Dictionary<string, object>();

    private static IReadOnlyList<string> ReadStringArray(IReadOnlyDictionary<string, object> payload, string key) =>
        payload.TryGetValue(key, out var value) && value is IEnumerable<string> values
            ? values.ToArray()
            : Array.Empty<string>();

    private static decimal ReadAmount(IReadOnlyDictionary<string, object> values)
    {
        foreach (var field in new[] { "amount", "receivedAmount", "confirmedAmount", "paymentAmount", "depositAmount", "refundAmount", "deductionAmount", "adjustmentAmount", "expenseAmount", "settlementAmount" })
        {
            if (values.TryGetValue(field, out var value) &&
                decimal.TryParse(Convert.ToString(value), out var parsed))
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

public sealed record FinanceTruthOutcome(string Status, FinanceCommit? Commit, UnclearMoneyCase? UnclearCase, string Code)
{
    public static FinanceTruthOutcome Committed(FinanceCommit commit) => new("committed", commit, null, "finance_truth_committed");

    public static FinanceTruthOutcome Unclear(UnclearMoneyCase unclearCase) => new("unclear", null, unclearCase, "unclear_money_case_created");

    public static FinanceTruthOutcome Blocked(string code) => new("blocked", null, null, code);
}

public sealed record FinanceCommit(
    string FinanceCommitId,
    MoneyBasis Basis,
    LedgerTransactionV1 LedgerTransaction,
    IReadOnlyList<LedgerEntryV1> LedgerEntries,
    FinanceReceipt Receipt);

public sealed record FinanceReceipt(
    string ReceiptId,
    string ReceiptType,
    string SourceTruthFact,
    string LedgerTransactionRef,
    string LensTargetRef)
{
    public static FinanceReceipt FromBasis(MoneyBasis basis, string transactionId)
    {
        var (receiptType, truthFact, lensTarget) = basis.BasisType switch
        {
            "deposit_receipt" => ("DepositReceipt", "DepositFact", basis.DepositAccountId ?? string.Empty),
            "refund_deposit" => ("FinanceReceipt", "DepositFact", basis.DepositAccountId ?? string.Empty),
            "deposit_deduction" => ("FinanceReceipt", "DepositFact", basis.DepositAccountId ?? string.Empty),
            "payment_receipt" => ("PaymentReceipt", "PaymentFact", basis.WorkItemId),
            "ledger_correction_apply" => ("FinanceReceipt", "LedgerTransaction", basis.WorkItemId),
            _ => ("FinanceReceipt", "LedgerTransaction", basis.WorkItemId)
        };
        return new FinanceReceipt(
            $"fr-{OperationsUnitOfWorkHash.Short(transactionId, receiptType)}",
            receiptType,
            truthFact,
            transactionId,
            lensTarget);
    }
}

public sealed record FinanceIntake(string IntakeId, MoneyBasis Basis, string Status);

public sealed record FinanceCase(string FinanceCaseId, string TenantId, string CaseId, string WorkItemId, string Reason)
{
    public string OwnerRole { get; init; } = "finance";

    public IReadOnlyList<string> EvidenceRefs { get; init; } = Array.Empty<string>();

    public string TraceRef { get; init; } = string.Empty;
}

public sealed record FinanceReviewWorkItem(string WorkItemId, string FinanceCaseId, string OwnerRole, string Status);

public sealed record UnclearMoneyCase(string CaseId, string TenantId, string SourceCaseId, string SourceWorkItemId, decimal Amount, string Currency, string Reason);

public sealed record DepositAccountSnapshot(
    string DepositAccountId,
    string TenantId,
    string CaseId,
    string WorkItemId,
    decimal HeldAmount,
    decimal DeductedAmount,
    decimal RefundedAmount,
    string Currency,
    string Status)
{
    public decimal AvailableLiability => HeldAmount - DeductedAmount - RefundedAmount;
}

public sealed record LedgerProjectionRebuildResult(
    int CommitCount,
    decimal DepositLiabilityBalance,
    decimal OrdinaryPaymentTotal,
    string ConsistencyStatus);
