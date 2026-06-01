using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class MoneyAllocationPropertyTests
{
    [TestMethod]
    public void OrdinaryPaymentAllocatesWithoutTouchingDepositLiability()
    {
        foreach (var amount in new[] { 1m, 125.50m, 9999.99m })
        {
            var basis = Basis("payment_receipt", amount);
            var commit = FinanceTruthPipeline.Commit(basis);
            var receipt = new PaymentAllocationService().AllocateOrdinaryPayment(commit, "stay-001");

            Assert.AreEqual("PaymentReceipt", receipt.ReceiptType);
            Assert.AreEqual("stay-001", receipt.LensTargetRef);
            Assert.IsFalse(commit.LedgerEntries.Any(item => item.AccountId.Contains("deposit", StringComparison.OrdinalIgnoreCase)));
            Assert.AreEqual(
                commit.LedgerEntries.Where(item => item.DebitCredit == "debit").Sum(item => item.Amount),
                commit.LedgerEntries.Where(item => item.DebitCredit == "credit").Sum(item => item.Amount));
        }
    }

    [TestMethod]
    public void BankImportCannotDirectlyConfirmPaymentFact()
    {
        var outcome = FinanceTruthPipeline.Route(Basis("bank_import_payment_confirmed", 650m) with
        {
            SourcePack = "BankImportAdapter",
            TargetFact = "PaymentFact"
        });

        Assert.AreEqual("blocked", outcome.Status);
        Assert.AreEqual("finance_truth_blocks_direct_fact_commit", outcome.Code);
    }

    [TestMethod]
    public void UnclearMoneyCreatesReviewCaseBeforeLedgerCommit()
    {
        var outcome = FinanceTruthPipeline.Route(Basis("unclear_money", 88m));

        Assert.AreEqual("unclear", outcome.Status);
        Assert.IsNotNull(outcome.UnclearCase);
        Assert.IsNull(outcome.Commit);
    }

    private static MoneyBasis Basis(string type, decimal amount) => new(
        "tenant-001",
        "case-001",
        "wi-001",
        $"basis-{type}-{amount}",
        type,
        amount,
        "KGS",
        "DormitoryDomainPack");
}
