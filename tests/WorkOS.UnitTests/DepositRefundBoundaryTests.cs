using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class DepositRefundBoundaryTests
{
    [TestMethod]
    public void RefundMustReferenceOriginalDepositAccount()
    {
        var missingAccount = new MoneyBasis(
            "tenant-001",
            "case-001",
            "wi-refund",
            "basis-refund",
            "refund_deposit",
            100m,
            "KGS",
            "FinanceTruthPack");

        var error = ThrowsInvalidOperation(() => FinanceTruthPipeline.Commit(missingAccount));
        Assert.AreEqual("finance_truth_requires_original_deposit_account", error.Message);
    }

    [TestMethod]
    public void RefundOrDeductionCannotExceedAvailableLiability()
    {
        var service = new DepositAccountService();
        var account = service.Open(new MoneyBasis(
            "tenant-001",
            "case-001",
            "wi-deposit",
            "basis-deposit",
            "deposit_receipt",
            1000m,
            "KGS",
            "DormitoryDomainPack",
            DepositAccountId: "deposit-account-001"));

        var refund = new DepositRefundService().CreateRefundBasis(account, 400m, "wi-refund", "basis-refund");
        var commit = FinanceTruthPipeline.Commit(refund);
        Assert.AreEqual("FinanceReceipt", commit.Receipt.ReceiptType);
        Assert.AreEqual("deposit-account-001", commit.LedgerEntries.Single(item => item.DebitCredit == "debit").AccountId);

        var afterRefund = service.ApplyRefund(account, 400m);
        Assert.AreEqual(600m, afterRefund.AvailableLiability);

        var error = ThrowsInvalidOperation(() =>
            new DepositRefundService().CreateRefundBasis(afterRefund, 700m, "wi-refund-2", "basis-refund-2"));
        Assert.AreEqual("deposit_refund_or_deduction_exceeds_available_liability", error.Message);
    }

    [TestMethod]
    public void RefundIsLiabilityDecreaseNotExpense()
    {
        var basis = new MoneyBasis(
            "tenant-001",
            "case-001",
            "wi-refund",
            "basis-refund",
            "refund_deposit",
            300m,
            "KGS",
            "FinanceTruthPack",
            DepositAccountId: "deposit-account-001");
        var commit = FinanceTruthPipeline.Commit(basis);

        CollectionAssert.Contains(commit.LedgerEntries.Select(item => item.AccountType).ToArray(), "liability");
        CollectionAssert.DoesNotContain(commit.LedgerEntries.Select(item => item.AccountType).ToArray(), "expense");
    }

    private static InvalidOperationException ThrowsInvalidOperation(Action action)
    {
        try
        {
            action();
        }
        catch (InvalidOperationException ex)
        {
            return ex;
        }

        Assert.Fail("Expected InvalidOperationException.");
        throw new InvalidOperationException("Expected InvalidOperationException.");
    }
}
