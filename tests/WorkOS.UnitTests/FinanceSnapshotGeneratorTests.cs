using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Persistence;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class FinanceSnapshotGeneratorTests
{
    [TestMethod]
    public void finance_snapshot_generated_from_ledgers()
    {
        var snapshot = FinanceSnapshotGenerator.Generate(State(
            ordinaryPaymentReceived: 1200m,
            ordinaryPaymentConfirmed: 1000m,
            ordinaryPaymentAllocated: 900m,
            outstandingDebt: 300m,
            depositLiabilityStart: 100m,
            depositLiabilityEnd: 400m,
            depositReceived: 500m,
            depositRefundPaid: 50m,
            depositAppliedToBalance: 25m,
            cashHandoverPending: 2,
            reconciliationMismatchCount: 3,
            correctionPendingCount: 4,
            expenseStatus: FinanceSnapshotGenerator.ExpenseLedgerVerified,
            approvedExpenseAmount: 80m,
            pendingExpenseAmount: 0m));

        Assert.AreEqual(1200m, snapshot.OrdinaryPaymentReceived);
        Assert.AreEqual(1000m, snapshot.OrdinaryPaymentConfirmed);
        Assert.AreEqual(900m, snapshot.OrdinaryPaymentAllocated);
        Assert.AreEqual(300m, snapshot.OutstandingDebt);
        Assert.AreEqual(2, snapshot.CashHandoverPending);
        Assert.AreEqual(3, snapshot.ReconciliationMismatchCount);
        Assert.AreEqual(4, snapshot.CorrectionPendingCount);
        Assert.AreEqual("PaymentLedger:v1", snapshot.SourceLedgerVersions["PaymentLedger"]);
        Assert.AreEqual("ledger-events:123", snapshot.SourceEventHighWatermark);
        Assert.AreEqual(1000m, snapshot.Body["ordinaryPaymentConfirmed"]);
        Assert.AreEqual(FinanceSnapshotGenerator.ExpenseLedgerVerified, snapshot.Body["expenseStatus"]);
        Assert.AreEqual("ExpenseLedger", snapshot.Body["expenseSource"]);
    }

    [TestMethod]
    public void period_net_cash_flow_excludes_deposit()
    {
        var snapshot = FinanceSnapshotGenerator.Generate(State(
            ordinaryPaymentConfirmed: 1000m,
            depositReceived: 9000m,
            depositRefundPaid: 8000m,
            depositAppliedToBalance: 7000m,
            expenseStatus: FinanceSnapshotGenerator.ExpenseLedgerVerified,
            approvedExpenseAmount: 100m));

        Assert.AreEqual(900m, snapshot.PeriodNetCashFlow);
        Assert.AreEqual(900m, snapshot.Body["periodNetCashFlow"]);
    }

    [TestMethod]
    public void deposit_liability_from_deposit_ledger()
    {
        var snapshot = FinanceSnapshotGenerator.Generate(State(
            depositLiabilityStart: 200m,
            depositLiabilityEnd: 750m,
            depositReceived: 1000m,
            depositRefundPaid: 100m,
            depositAppliedToBalance: 150m));

        Assert.AreEqual(200m, snapshot.DepositLiabilityStart);
        Assert.AreEqual(750m, snapshot.DepositLiabilityEnd);
        Assert.AreEqual(750m, snapshot.Body["depositLiabilityEnd"]);
    }

    [TestMethod]
    public void ending_debt_from_stay_balance()
    {
        var snapshot = FinanceSnapshotGenerator.Generate(State(outstandingDebt: 1234m));

        Assert.AreEqual(1234m, snapshot.OutstandingDebt);
        Assert.AreEqual(1234m, snapshot.Body["outstandingDebt"]);
    }

    [TestMethod]
    public void expense_not_integrated_not_zero()
    {
        var snapshot = FinanceSnapshotGenerator.Generate(State(
            ordinaryPaymentConfirmed: 1000m,
            expenseStatus: FinanceSnapshotGenerator.ExpenseNotIntegrated,
            approvedExpenseAmount: null,
            pendingExpenseAmount: null));

        Assert.AreEqual(FinanceSnapshotGenerator.ExpenseNotIntegrated, snapshot.ExpenseStatus);
        Assert.IsNull(snapshot.ApprovedExpenseAmount);
        Assert.IsNull(snapshot.Body["approvedExpenseAmount"], "Missing ExpenseLedger must not be displayed as zero.");
        Assert.IsNull(snapshot.Body["pendingExpenseAmount"], "Missing ExpenseLedger must not be displayed as zero.");
        Assert.AreEqual(FinanceSnapshotGenerator.ExpenseNotIntegratedWarning, snapshot.Body["expenseStatusWarning"]);
        Assert.AreEqual("disabled", snapshot.Body["periodProfitMetricStatus"]);
        Assert.IsNull(snapshot.Body["periodNetProfit"], "Missing ExpenseLedger must not produce a final profit metric.");
        Assert.AreEqual(1000m, snapshot.PeriodNetCashFlow);
    }

    [TestMethod]
    public void period_profit_metric_disabled_when_expense_not_integrated()
    {
        var snapshot = FinanceSnapshotGenerator.Generate(State(
            ordinaryPaymentConfirmed: 1000m,
            expenseStatus: FinanceSnapshotGenerator.ExpenseNotIntegrated));

        Assert.AreEqual("disabled", snapshot.Body["periodProfitMetricStatus"]);
        Assert.AreEqual(FinanceSnapshotGenerator.ExpenseNotIntegratedWarning, snapshot.Body["profitMetricUnavailableReason"]);
        Assert.IsNull(snapshot.Body["periodNetProfit"]);
        CollectionAssert.Contains(((IEnumerable<string>)snapshot.Body["rules"]!).ToArray(), "expense.not_integrated_disables_profit_metric");
    }

    [TestMethod]
    public void pc_shows_expense_status_warning()
    {
        var snapshot = FinanceSnapshotGenerator.Generate(State(expenseStatus: FinanceSnapshotGenerator.ExpenseNotIntegrated));

        Assert.AreEqual(FinanceSnapshotGenerator.ExpenseNotIntegratedWarning, snapshot.Body["expenseStatusWarning"]);
        Assert.AreEqual("disabled", snapshot.Body["periodProfitMetricStatus"]);
        Assert.AreEqual(FinanceSnapshotGenerator.ExpenseNotIntegrated, snapshot.Body["expenseStatus"]);
    }

    [TestMethod]
    public void user_input_finance_amount_rejected()
    {
        var result = PeriodAnalyticsPolicy.Validate("periodFinanceReview", new ConfirmCardRequest(
            "zh-CN",
            "period-finance-user-input",
            new Dictionary<string, string>
            {
                ["ordinaryPaymentReceived"] = "999999"
            },
            Array.Empty<string>()));

        Assert.IsNotNull(result);
        Assert.AreEqual(ConfirmStatus.Forbidden, result!.Status);
        Assert.AreEqual("period_finance_snapshot_user_input_forbidden:ordinaryPaymentReceived", result.Reason);
    }

    private static FinanceSnapshotLedgerState State(
        decimal ordinaryPaymentReceived = 0m,
        decimal ordinaryPaymentConfirmed = 0m,
        decimal ordinaryPaymentAllocated = 0m,
        decimal outstandingDebt = 0m,
        decimal depositLiabilityStart = 0m,
        decimal depositLiabilityEnd = 0m,
        decimal depositReceived = 0m,
        decimal depositRefundPaid = 0m,
        decimal depositAppliedToBalance = 0m,
        decimal depositDeducted = 0m,
        int cashHandoverPending = 0,
        int reconciliationMismatchCount = 0,
        int correctionPendingCount = 0,
        string expenseStatus = FinanceSnapshotGenerator.ExpenseNotIntegrated,
        decimal? approvedExpenseAmount = null,
        decimal? pendingExpenseAmount = null) =>
        new(
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
            expenseStatus,
            approvedExpenseAmount,
            pendingExpenseAmount,
            new Dictionary<string, object>
            {
                ["PaymentLedger"] = "PaymentLedger:v1",
                ["DepositLedger"] = "DepositLedger:v1",
                ["ExpenseLedger"] = expenseStatus
            },
            "ledger-events:123");
}
