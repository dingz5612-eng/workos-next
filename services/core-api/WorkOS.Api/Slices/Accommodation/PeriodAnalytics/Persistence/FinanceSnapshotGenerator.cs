using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Persistence;

internal static class FinanceSnapshotGenerator
{
    public const string ExpenseNotIntegrated = "not_integrated";
    public const string ExpenseManualImported = "manual_imported";
    public const string ExpenseLedgerVerified = "ledger_verified";
    public const string ExpenseNotIntegratedWarning = "支出账本未接入，利润类指标不可用或待确认";

    private static readonly string[] OrdinaryForbiddenPurposes =
    [
        "deposit",
        "deposit_rent",
        "deposit_refund"
    ];

    public static FinanceSnapshot Generate(RuntimeDbSession db)
    {
        var ordinaryPaymentReceived = Decimal(db, $"""
            select coalesce(sum(amount), 0)
            from hostel_payments
            where lower(coalesce(nullif(trim(purpose), ''), 'rent')) not in ({SqlLiterals(OrdinaryForbiddenPurposes)})
            """);
        var ordinaryPaymentConfirmed = Decimal(db, $"""
            select coalesce(sum(reconciliation.confirmed_amount), 0)
            from finance_reconciliations reconciliation
            join hostel_payments payment on payment.payment_id = reconciliation.payment_id
            where reconciliation.status = 'confirmed'
              and lower(coalesce(nullif(trim(payment.purpose), ''), 'rent')) not in ({SqlLiterals(OrdinaryForbiddenPurposes)})
            """);
        var ordinaryPaymentAllocated = Decimal(db, $"""
            select coalesce(sum(allocation.allocated_amount), 0)
            from payment_allocations allocation
            join hostel_payments payment on payment.payment_id = allocation.payment_id
            where lower(coalesce(nullif(trim(payment.purpose), ''), 'rent')) not in ({SqlLiterals(OrdinaryForbiddenPurposes)})
            """);
        var outstandingDebt = Decimal(db, "select coalesce(sum(greatest(balance, 0)), 0) from stay_balances");

        var depositReceived = DepositReceived(db);
        var depositRefundPaid = DepositTransactionTotal(db, "refund_paid");
        var depositAppliedToBalance = DepositTransactionTotal(db, "applied_to_balance");
        var depositDeducted = DepositTransactionTotal(db, "deducted");
        var depositLiabilityEnd = Math.Max(depositReceived - depositRefundPaid - depositAppliedToBalance - depositDeducted, 0m);
        var depositLiabilityStart = Math.Max(depositLiabilityEnd - depositReceived + depositRefundPaid + depositAppliedToBalance + depositDeducted, 0m);

        var cashHandoverPending = TableExists(db, "cash_handover_tasks")
            ? Integer(db, "select count(*) from cash_handover_tasks where status not in ('completed', 'closed', 'cancelled')")
            : 0;
        var reconciliationMismatchCount = TableExists(db, "payment_mismatches")
            ? Integer(db, "select count(*) from payment_mismatches where status in ('open', 'resolving')")
            : 0;
        var correctionPendingCount = TableExists(db, "ledger_correction_requests")
            ? Integer(db, "select count(*) from ledger_correction_requests where status in ('requested', 'pending_approval', 'approved')")
            : 0;
        var expense = ExpenseLedgerStatus(db);

        return Generate(new FinanceSnapshotLedgerState(
            ordinaryPaymentReceived,
            ordinaryPaymentConfirmed,
            ordinaryPaymentAllocated,
            outstandingDebt,
            depositLiabilityStart,
            depositLiabilityEnd,
            depositReceived,
            depositRefundPaid,
            depositAppliedToBalance,
            depositDeducted,
            cashHandoverPending,
            reconciliationMismatchCount,
            correctionPendingCount,
            expense.Status,
            expense.ApprovedExpenseAmount,
            expense.PendingExpenseAmount,
            SourceLedgerVersions(db),
            SourceEventHighWatermark(db)));
    }

    public static FinanceSnapshot Generate(FinanceSnapshotLedgerState state)
    {
        if (state.ExpenseStatus is not ExpenseNotIntegrated and not ExpenseManualImported and not ExpenseLedgerVerified)
        {
            throw new InvalidOperationException($"unsupported_expense_status:{state.ExpenseStatus}");
        }

        var expenseIntegrated = state.ExpenseStatus != ExpenseNotIntegrated;
        var approvedExpense = expenseIntegrated ? state.ApprovedExpenseAmount ?? 0m : 0m;
        var periodNetCashFlow = state.OrdinaryPaymentConfirmed - approvedExpense;
        var periodNetProfit = expenseIntegrated ? periodNetCashFlow : (decimal?)null;
        var pendingPayment = Math.Max(state.OrdinaryPaymentReceived - state.OrdinaryPaymentConfirmed, 0m);

        var body = new Dictionary<string, object?>
        {
            ["ordinaryPaymentReceived"] = state.OrdinaryPaymentReceived,
            ["ordinaryPaymentConfirmed"] = state.OrdinaryPaymentConfirmed,
            ["ordinaryPaymentAllocated"] = state.OrdinaryPaymentAllocated,
            ["pendingOrdinaryPayment"] = pendingPayment,
            ["outstandingDebt"] = state.OutstandingDebt,
            ["depositLiabilityStart"] = state.DepositLiabilityStart,
            ["depositLiabilityEnd"] = state.DepositLiabilityEnd,
            ["depositReceived"] = state.DepositReceived,
            ["depositRefundPaid"] = state.DepositRefundPaid,
            ["depositAppliedToBalance"] = state.DepositAppliedToBalance,
            ["depositDeducted"] = state.DepositDeducted,
            ["cashHandoverPending"] = state.CashHandoverPending,
            ["reconciliationMismatchCount"] = state.ReconciliationMismatchCount,
            ["correctionPendingCount"] = state.CorrectionPendingCount,
            ["expenseStatus"] = state.ExpenseStatus,
            ["expenseSource"] = expenseIntegrated ? "ExpenseLedger" : ExpenseNotIntegrated,
            ["expenseStatusWarning"] = expenseIntegrated ? null : ExpenseNotIntegratedWarning,
            ["approvedExpenseAmount"] = expenseIntegrated ? state.ApprovedExpenseAmount : null,
            ["pendingExpenseAmount"] = expenseIntegrated ? state.PendingExpenseAmount : null,
            ["periodNetCashFlow"] = periodNetCashFlow,
            ["periodProfitMetricStatus"] = expenseIntegrated ? "available" : "disabled",
            ["periodNetProfit"] = periodNetProfit,
            ["profitMetricUnavailableReason"] = expenseIntegrated ? null : ExpenseNotIntegratedWarning,
            ["rules"] = new[]
            {
                "deposit.receipt_is_not_revenue",
                "deposit.refund_is_not_expense",
                "deposit.apply_to_balance_is_not_new_cashflow",
                "period.net_cash_flow_excludes_deposit",
                "finance_snapshot_from_ledgers_only",
                "expense.not_integrated_disables_profit_metric"
            }
        };

        return new FinanceSnapshot(
            state.OrdinaryPaymentReceived,
            state.OrdinaryPaymentConfirmed,
            state.OrdinaryPaymentAllocated,
            pendingPayment,
            state.OutstandingDebt,
            state.DepositLiabilityStart,
            state.DepositLiabilityEnd,
            state.DepositReceived,
            state.DepositRefundPaid,
            state.DepositAppliedToBalance,
            state.DepositDeducted,
            state.CashHandoverPending,
            state.ReconciliationMismatchCount,
            state.CorrectionPendingCount,
            state.ExpenseStatus,
            state.ApprovedExpenseAmount,
            state.PendingExpenseAmount,
            periodNetCashFlow,
            body,
            state.SourceLedgerVersions,
            state.SourceEventHighWatermark);
    }

    private static ExpenseStatusSnapshot ExpenseLedgerStatus(RuntimeDbSession db)
    {
        if (!TableExists(db, "expense_ledger_status"))
        {
            return new ExpenseStatusSnapshot(ExpenseNotIntegrated, null, null);
        }

        var configuredStatus = Text(db, """
            select coalesce(
                case
                    when bool_or(status = 'manual_imported') then 'manual_imported'
                    when bool_or(status = 'ledger_verified') then 'ledger_verified'
                    else 'not_integrated'
                end,
                'not_integrated')
            from expense_ledger_status
            """);
        if (configuredStatus == ExpenseNotIntegrated)
        {
            return new ExpenseStatusSnapshot(ExpenseNotIntegrated, null, null);
        }

        if (!TableExists(db, "expenses"))
        {
            return new ExpenseStatusSnapshot(ExpenseNotIntegrated, null, null);
        }

        var rowCount = Integer(db, "select count(*) from expenses");
        if (rowCount == 0)
        {
            return new ExpenseStatusSnapshot(configuredStatus, 0m, 0m);
        }

        var pendingExpense = Decimal(db, "select coalesce(sum(amount), 0) from expenses where status not in ('approved', 'rejected')");
        var approvedExpense = Decimal(db, "select coalesce(sum(approved_amount), 0) from expenses where status = 'approved'");
        var status = configuredStatus == ExpenseManualImported || pendingExpense > 0m
            ? ExpenseManualImported
            : ExpenseLedgerVerified;
        return new ExpenseStatusSnapshot(status, approvedExpense, pendingExpense);
    }

    private static decimal DepositReceived(RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            select coalesce(sum(greatest(received_amount, confirmed_amount)), 0)
            from (
                select
                    deposit_id,
                    coalesce(sum(amount) filter (where transaction_type in ('received', 'received_pending')), 0) as received_amount,
                    coalesce(sum(amount) filter (where transaction_type in ('confirmed', 'confirmed_received')), 0) as confirmed_amount
                from deposit_transactions
                group by deposit_id
            ) deposit_totals
            """);
        return Convert.ToDecimal(command.ExecuteScalar() ?? 0m);
    }

    private static decimal DepositTransactionTotal(RuntimeDbSession db, string transactionType)
    {
        using var command = db.CreateCommand("""
            select coalesce(sum(amount), 0)
            from deposit_transactions
            where transaction_type = @transactionType
            """);
        command.Parameters.AddWithValue("transactionType", transactionType);
        return Convert.ToDecimal(command.ExecuteScalar() ?? 0m);
    }

    private static IReadOnlyDictionary<string, object> SourceLedgerVersions(RuntimeDbSession db)
    {
        return new Dictionary<string, object>
        {
            ["PaymentLedger"] = $"hostel_payments:{TableCount(db, "hostel_payments")};finance_reconciliations:{TableCount(db, "finance_reconciliations")};payment_allocations:{TableCount(db, "payment_allocations")}",
            ["DepositLedger"] = $"deposit_transactions:{TableCount(db, "deposit_transactions")};deposit_liabilities:{TableCount(db, "deposit_liabilities")}",
            ["ExpenseLedgerStatus"] = TableExists(db, "expense_ledger_status") ? $"expense_ledger_status:{TableCount(db, "expense_ledger_status")}" : ExpenseNotIntegrated,
            ["ExpenseLedger"] = TableExists(db, "expenses") ? $"expenses:{TableCount(db, "expenses")}" : ExpenseNotIntegrated,
            ["CashSession"] = TableExists(db, "cash_handover_tasks") ? $"cash_handover_tasks:{TableCount(db, "cash_handover_tasks")}" : ExpenseNotIntegrated,
            ["Reconciliation"] = TableExists(db, "payment_mismatches") ? $"payment_mismatches:{TableCount(db, "payment_mismatches")}" : ExpenseNotIntegrated,
            ["Correction"] = TableExists(db, "ledger_correction_requests") ? $"ledger_correction_requests:{TableCount(db, "ledger_correction_requests")}" : ExpenseNotIntegrated
        };
    }

    private static string SourceEventHighWatermark(RuntimeDbSession db) =>
        string.Join("|", new[]
        {
            $"payments:{MaxText(db, "hostel_payments", "created_event_id")}",
            $"reconciliations:{MaxText(db, "finance_reconciliations", "created_event_id")}",
            $"allocations:{MaxText(db, "payment_allocations", "created_event_id")}",
            $"deposits:{MaxText(db, "deposit_transactions", "created_event_id")}",
            $"balances:{MaxText(db, "stay_balances", "created_event_id")}",
            $"expenses:{MaxText(db, "expenses", "created_event_id")}"
        });

    private static string MaxText(RuntimeDbSession db, string tableName, string columnName)
    {
        if (!TableExists(db, tableName))
        {
            return ExpenseNotIntegrated;
        }

        using var command = db.CreateCommand($"select coalesce(max({columnName}), '') from {tableName}");
        return Convert.ToString(command.ExecuteScalar()) ?? string.Empty;
    }

    private static int TableCount(RuntimeDbSession db, string tableName)
    {
        if (!TableExists(db, tableName))
        {
            return 0;
        }

        return Integer(db, $"select count(*) from {tableName}");
    }

    private static bool TableExists(RuntimeDbSession db, string tableName)
    {
        using var command = db.CreateCommand("select to_regclass(@tableName) is not null");
        command.Parameters.AddWithValue("tableName", tableName);
        return Convert.ToBoolean(command.ExecuteScalar());
    }

    private static decimal Decimal(RuntimeDbSession db, string sql)
    {
        using var command = db.CreateCommand(sql);
        return Convert.ToDecimal(command.ExecuteScalar() ?? 0m);
    }

    private static int Integer(RuntimeDbSession db, string sql)
    {
        using var command = db.CreateCommand(sql);
        return Convert.ToInt32(command.ExecuteScalar() ?? 0);
    }

    private static string Text(RuntimeDbSession db, string sql)
    {
        using var command = db.CreateCommand(sql);
        return Convert.ToString(command.ExecuteScalar()) ?? string.Empty;
    }

    private static string SqlLiterals(IEnumerable<string> values) =>
        string.Join(", ", values.Select(value => $"'{value.Replace("'", "''", StringComparison.Ordinal)}'"));

    private sealed record ExpenseStatusSnapshot(
        string Status,
        decimal? ApprovedExpenseAmount,
        decimal? PendingExpenseAmount);
}

internal sealed record FinanceSnapshotLedgerState(
    decimal OrdinaryPaymentReceived,
    decimal OrdinaryPaymentConfirmed,
    decimal OrdinaryPaymentAllocated,
    decimal OutstandingDebt,
    decimal DepositLiabilityStart,
    decimal DepositLiabilityEnd,
    decimal DepositReceived,
    decimal DepositRefundPaid,
    decimal DepositAppliedToBalance,
    decimal DepositDeducted,
    int CashHandoverPending,
    int ReconciliationMismatchCount,
    int CorrectionPendingCount,
    string ExpenseStatus,
    decimal? ApprovedExpenseAmount,
    decimal? PendingExpenseAmount,
    IReadOnlyDictionary<string, object> SourceLedgerVersions,
    string SourceEventHighWatermark);

internal sealed record FinanceSnapshot(
    decimal OrdinaryPaymentReceived,
    decimal OrdinaryPaymentConfirmed,
    decimal OrdinaryPaymentAllocated,
    decimal PendingOrdinaryPayment,
    decimal OutstandingDebt,
    decimal DepositLiabilityStart,
    decimal DepositLiabilityEnd,
    decimal DepositReceived,
    decimal DepositRefundPaid,
    decimal DepositAppliedToBalance,
    decimal DepositDeducted,
    int CashHandoverPending,
    int ReconciliationMismatchCount,
    int CorrectionPendingCount,
    string ExpenseStatus,
    decimal? ApprovedExpenseAmount,
    decimal? PendingExpenseAmount,
    decimal PeriodNetCashFlow,
    IReadOnlyDictionary<string, object?> Body,
    IReadOnlyDictionary<string, object> SourceLedgerVersions,
    string SourceEventHighWatermark);
