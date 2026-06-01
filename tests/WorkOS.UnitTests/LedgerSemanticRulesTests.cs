using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class LedgerSemanticRulesTests
{
    [TestMethod]
    public void DepositReceiptRejectsBalancedRevenueCredit()
    {
        var transaction = new LedgerTransactionV1("tenant-001", "ltx-bad-deposit", "case-001", "wi-001", "sub-001", "KGS", "balanced", "deposit_receipt");
        var entries = new[]
        {
            Entry("le-debit", transaction.LedgerTransactionId, "debit", 100m, "KGS", "asset.cash_or_bank", "asset", "cash_or_bank_increase"),
            Entry("le-credit", transaction.LedgerTransactionId, "credit", 100m, "KGS", "revenue.deposit", "revenue", "deposit_revenue_attempt")
        };

        var error = ThrowsInvalidOperation(() => LedgerSemanticRules.Validate(transaction, entries));

        StringAssert.Contains(error.Message, "finance_semantic_deposit_receipt_credit_requires_liability");
    }

    [TestMethod]
    public void RefundDepositRequiresOriginalDepositLiabilityAccount()
    {
        var transaction = new LedgerTransactionV1("tenant-001", "ltx-bad-refund", "case-001", "wi-001", "sub-001", "KGS", "balanced", "refund_deposit");
        var entries = new[]
        {
            Entry("le-debit", transaction.LedgerTransactionId, "debit", 100m, "KGS", "liability.deposit", "liability", "deposit_liability_decrease"),
            Entry("le-credit", transaction.LedgerTransactionId, "credit", 100m, "KGS", "asset.cash_or_bank", "asset", "cash_or_bank_decrease")
        };

        var error = ThrowsInvalidOperation(() => LedgerSemanticRules.Validate(transaction, entries));

        Assert.AreEqual("finance_semantic_refund_requires_original_liability", error.Message);
    }

    [TestMethod]
    public void CurrencyMismatchFailsSemanticValidation()
    {
        var transaction = new LedgerTransactionV1("tenant-001", "ltx-currency", "case-001", "wi-001", "sub-001", "KGS", "balanced", "payment_receipt");
        var entries = new[]
        {
            Entry("le-debit", transaction.LedgerTransactionId, "debit", 100m, "KGS", "asset.cash_or_bank", "asset", "cash_or_bank_increase"),
            Entry("le-credit", transaction.LedgerTransactionId, "credit", 100m, "USD", "receivable.stay", "receivable", "ordinary_payment_allocation")
        };

        var error = ThrowsInvalidOperation(() => LedgerSemanticRules.Validate(transaction, entries));

        Assert.AreEqual("finance_semantic_currency_mismatch", error.Message);
    }

    [TestMethod]
    public void FinanceTruthPipelineProducesExpectedAccountSemantics()
    {
        var deposit = FinanceTruthPipeline.Commit(Basis("deposit_receipt", "basis-deposit", depositAccountId: "deposit-account-001"));
        var payment = FinanceTruthPipeline.Commit(Basis("payment_receipt", "basis-payment"));
        var refund = FinanceTruthPipeline.Commit(Basis("refund_deposit", "basis-refund", depositAccountId: "deposit-account-001"));

        Assert.AreEqual("liability", deposit.LedgerEntries.Single(item => item.DebitCredit == "credit").AccountType);
        Assert.AreEqual("receivable", payment.LedgerEntries.Single(item => item.DebitCredit == "credit").AccountType);
        Assert.AreEqual("deposit-account-001", refund.LedgerEntries.Single(item => item.DebitCredit == "debit").AccountId);
    }

    [TestMethod]
    public void FinanceCaseCarriesOwnerEvidenceAndTrace()
    {
        var financeCase = new FinanceCase("finance-case-001", "tenant-001", "case-001", "wi-finance", "payment mismatch")
        {
            OwnerRole = "finance",
            EvidenceRefs = new[] { "evidence-bank-row-001" },
            TraceRef = "trace-submission-001"
        };

        Assert.AreEqual("finance", financeCase.OwnerRole);
        CollectionAssert.Contains(financeCase.EvidenceRefs.ToArray(), "evidence-bank-row-001");
        Assert.AreEqual("trace-submission-001", financeCase.TraceRef);
    }

    private static MoneyBasis Basis(string basisType, string basisId, string? depositAccountId = null) =>
        new("tenant-001", "case-001", "wi-001", basisId, basisType, 100m, "KGS", "FinanceTruthPack", DepositAccountId: depositAccountId);

    private static LedgerEntryV1 Entry(string id, string transactionId, string side, decimal amount, string currency, string accountId, string accountType, string role) =>
        new("tenant-001", id, transactionId, side, amount, currency, accountId, accountType, role);

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
