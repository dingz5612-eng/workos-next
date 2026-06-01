using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryFinanceRuntimeCloseTests
{
    [TestMethod]
    public void deposit_payment_refund_and_compensation_use_finance_truth_accounts()
    {
        var deposit = FinanceTruthPipeline.Commit(new MoneyBasis(
            "tenant-d1-test",
            "case-d1-finance",
            "wi-d1-deposit",
            "basis-deposit",
            "deposit_receipt",
            1200m,
            "KGS",
            "FinanceTruthPack",
            DepositAccountId: "deposit-account-d1-test"));
        var payment = FinanceTruthPipeline.Commit(new MoneyBasis(
            "tenant-d1-test",
            "case-d1-finance",
            "wi-d1-payment",
            "basis-payment",
            "payment_receipt",
            650m,
            "KGS",
            "FinanceTruthPack"));
        var refund = FinanceTruthPipeline.Commit(new MoneyBasis(
            "tenant-d1-test",
            "case-d1-finance",
            "wi-d1-refund",
            "basis-refund",
            "refund_deposit",
            300m,
            "KGS",
            "FinanceTruthPack",
            DepositAccountId: "deposit-account-d1-test"));
        var compensation = FinanceTruthPipeline.Commit(new MoneyBasis(
            "tenant-d1-test",
            "case-d1-finance",
            "wi-d1-compensation",
            "basis-compensation",
            "ledger_correction_apply",
            25m,
            "KGS",
            "FinanceTruthPack",
            CorrectionMode: "compensation"));

        var allEntries = deposit.LedgerEntries.Concat(payment.LedgerEntries).Concat(refund.LedgerEntries).Concat(compensation.LedgerEntries).ToArray();
        Assert.IsTrue(deposit.LedgerEntries.Any(item => item.AccountType == "liability"), "deposit receipt must create liability.");
        Assert.IsFalse(deposit.LedgerEntries.Any(item => item.AccountType == "revenue"), "deposit receipt must not create revenue.");
        Assert.IsFalse(payment.LedgerEntries.Any(item => item.AccountId.Contains("deposit", StringComparison.OrdinalIgnoreCase)), "ordinary payment must not mix deposit accounts.");
        Assert.IsTrue(refund.LedgerEntries.Any(item => item.AccountId == "deposit-account-d1-test"), "refund must reference original deposit account.");
        Assert.IsTrue(compensation.LedgerEntries.All(item => item.AccountType == "correction"), "rollback drill compensation must be append-only correction ledger.");

        foreach (var tx in new[] { deposit, payment, refund, compensation })
        {
            FinanceTruthPipeline.ValidateBalanced(tx.LedgerTransaction, tx.LedgerEntries);
        }
        Assert.IsFalse(allEntries.Any(item => item.AccountType == "revenue" && item.AccountId.Contains("deposit", StringComparison.OrdinalIgnoreCase)));
    }
}
