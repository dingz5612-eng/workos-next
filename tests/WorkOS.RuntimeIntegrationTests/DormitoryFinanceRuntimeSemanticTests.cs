using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryFinanceRuntimeSemanticTests
{
    [TestMethod]
    public void OperationsUnitOfWorkRejectsBalancedButWrongDepositAccountSemantics()
    {
        var store = new InMemoryOperationsStore();
        var router = new SliceCommandHandlerRouter()
            .Register(CanonicalOperationsApiService.ConfirmCommandDefinition, _ => SliceCommandHandlerResult.Committed(
                new Dictionary<string, object> { ["accepted"] = true },
                new[] { new OperationsDomainEventDraft("Accommodation.DepositReceived", new Dictionary<string, object>()) },
                ledgerTransactions: new[]
                {
                    new LedgerTransactionV1("tenant-001", "ltx-bad-deposit", "case-001", "wi-001", "", "KGS", "balanced", "deposit_receipt")
                },
                ledgerEntries: new[]
                {
                    new LedgerEntryV1("tenant-001", "le-debit", "ltx-bad-deposit", "debit", 500m, "KGS", "asset.cash_or_bank", "asset", "cash_or_bank_increase"),
                    new LedgerEntryV1("tenant-001", "le-credit", "ltx-bad-deposit", "credit", 500m, "KGS", "revenue.deposit", "revenue", "deposit_revenue_attempt")
                }));
        var unitOfWork = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            router);

        var result = unitOfWork.Commit(Request("idem-bad-deposit"));

        Assert.AreEqual(StatusCodes.Status500InternalServerError, result.StatusCode);
        Assert.AreEqual("not_committed", result.CommitStatus);
        Assert.AreEqual("failed", store.Submissions.Single().Status);
        Assert.IsTrue(store.Submissions.Single().FailureReason!.Contains("finance_semantic_deposit_receipt", StringComparison.OrdinalIgnoreCase));
        Assert.AreEqual(0, store.DomainEvents.Count);
        Assert.AreEqual(0, store.LedgerTransactions.Count);
        Assert.AreEqual(0, store.LedgerEntries.Count);
    }

    [TestMethod]
    public void FinanceRuntimeCloseRejectsBalancedRefundWithoutOriginalDepositAccount()
    {
        var transaction = new LedgerTransactionV1("tenant-001", "ltx-bad-refund", "case-001", "wi-refund", "sub-refund", "KGS", "balanced", "refund_deposit");
        var entries = new[]
        {
            new LedgerEntryV1("tenant-001", "le-debit", transaction.LedgerTransactionId, "debit", 250m, "KGS", "liability.deposit", "liability", "deposit_liability_decrease"),
            new LedgerEntryV1("tenant-001", "le-credit", transaction.LedgerTransactionId, "credit", 250m, "KGS", "asset.cash_or_bank", "asset", "cash_or_bank_decrease")
        };

        var error = ThrowsInvalidOperation(() => LedgerSemanticRules.Validate(transaction, entries));

        Assert.AreEqual("finance_semantic_refund_requires_original_liability", error.Message);
    }

    private static OperationsCommandRequest Request(string idempotencyKey) =>
        new(
            "tenant-001",
            "case-001",
            "wi-001",
            CanonicalOperationsApiService.ConfirmCommandType,
            "CommandEnvelope.v1",
            "definition-finance-semantic",
            idempotencyKey,
            new Dictionary<string, object>
            {
                ["cardId"] = "depositReceipt",
                ["fieldValues"] = new Dictionary<string, object>
                {
                    ["amount"] = "500.00",
                    ["currency"] = "KGS"
                }
            },
            "actor-001",
            "tenant-001:wi-001:confirm");

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
