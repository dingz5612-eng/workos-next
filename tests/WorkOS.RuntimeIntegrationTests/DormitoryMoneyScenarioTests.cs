using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryMoneyScenarioTests
{
    [TestMethod]
    public void DepositPaymentRefundAndCorrectionProduceBalancedLedgerTransactions()
    {
        var harness = DormitoryScenarioHarness.Create();
        var scenarios = new[]
        {
            new DormitoryScenario("dorm-cert-002", "DepositReceipt", "case-dorm-cert-002", "wi-dorm-cert-002", "idem-dorm-002", ["receipt-proof"], 1000m),
            new DormitoryScenario("dorm-cert-003", "PaymentReceipt", "case-dorm-cert-003", "wi-dorm-cert-003", "idem-dorm-003", ["payment-receipt"], 650m),
            new DormitoryScenario("dorm-cert-005", "RefundDeposit", "case-dorm-cert-005", "wi-dorm-cert-005", "idem-dorm-005", ["refund-approval"], 400m),
            new DormitoryScenario("dorm-cert-006", "LedgerCorrectionApply", "case-dorm-cert-006", "wi-dorm-cert-006", "idem-dorm-006", ["correction-approval"], 25m)
        };

        foreach (var scenario in scenarios)
        {
            var result = harness.Commit(scenario);
            Assert.AreEqual("committed", result.CommitStatus);
            var transactions = harness.Store.LedgerTransactions.Where(item => item.SubmissionId == result.SubmissionId).ToArray();
            Assert.AreEqual(1, transactions.Length);
            Assert.AreEqual("balanced", transactions[0].BalanceStatus);

            var entries = harness.Store.LedgerEntries.Where(item => item.LedgerTransactionId == transactions[0].LedgerTransactionId).ToArray();
            Assert.AreEqual(2, entries.Length);
            Assert.AreEqual(entries.Where(item => item.DebitCredit == "debit").Sum(item => item.Amount), entries.Where(item => item.DebitCredit == "credit").Sum(item => item.Amount));
        }
    }

    [TestMethod]
    public void DepositIsLiabilityAndOrdinaryPaymentDoesNotUseDepositAccount()
    {
        var harness = DormitoryScenarioHarness.Create();

        var deposit = harness.Commit(new DormitoryScenario("dorm-cert-002", "DepositReceipt", "case-dorm-cert-002", "wi-dorm-cert-002", "idem-deposit-liability", ["receipt-proof"], 1000m));
        var depositTx = harness.Store.LedgerTransactions.Single(item => item.SubmissionId == deposit.SubmissionId);
        var depositCredit = harness.Store.LedgerEntries.Single(item => item.LedgerTransactionId == depositTx.LedgerTransactionId && item.DebitCredit == "credit");
        Assert.AreEqual("liability", depositCredit.AccountType);
        Assert.AreEqual("liability.deposit", depositCredit.AccountId);

        var payment = harness.Commit(new DormitoryScenario("dorm-cert-003", "PaymentReceipt", "case-dorm-cert-003", "wi-dorm-cert-003", "idem-payment-allocation", ["payment-receipt"], 650m));
        var paymentTx = harness.Store.LedgerTransactions.Single(item => item.SubmissionId == payment.SubmissionId);
        Assert.IsFalse(harness.Store.LedgerEntries
            .Where(item => item.LedgerTransactionId == paymentTx.LedgerTransactionId)
            .Any(item => item.AccountId.Contains("deposit", StringComparison.OrdinalIgnoreCase)));
    }
}
