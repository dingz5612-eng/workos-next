using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class LedgerMutationKillTests
{
    [TestMethod]
    public void MigrationBlocksLedgerEntryUpdateAndDelete()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "031_balanced_money_kernel.sql"));

        StringAssert.Contains(migration, "forbid_balanced_ledger_entry_mutation");
        StringAssert.Contains(migration, "trg_ledger_entries_forbid_update");
        StringAssert.Contains(migration, "trg_ledger_entries_forbid_delete");
        StringAssert.Contains(migration, "reversal or compensating transaction");
    }

    [TestMethod]
    public void OperationsUnitOfWorkRejectsUnbalancedLedgerTransaction()
    {
        var store = new InMemoryOperationsStore();
        var definition = new SliceCommandHandlerDefinition(
            "test.unbalanced",
            "finance.semantic-test",
            "definition-test",
            new[] { "DomainEvent", "LedgerEntry" },
            Array.Empty<string>(),
            "balanced-ledger-or-none",
            new[] { "semantic-test" },
            "FinanceTruthProjection",
            "MoneyKernelPack");
        var router = new SliceCommandHandlerRouter()
            .Register(definition, _ => SliceCommandHandlerResult.Committed(
                new Dictionary<string, object> { ["ok"] = false },
                new[] { new OperationsDomainEventDraft("UnbalancedAttempted", new Dictionary<string, object>()) },
                ledgerTransactions: new[]
                {
                    new LedgerTransactionV1("tenant-001", "ltx-unbalanced", "case-001", "wi-001", "", "KGS", "balanced", "payment_receipt")
                },
                ledgerEntries: new[]
                {
                    new LedgerEntryV1("tenant-001", "le-debit", "ltx-unbalanced", "debit", 100m, "KGS", "asset.cash_or_bank", "asset", "cash_or_bank_increase"),
                    new LedgerEntryV1("tenant-001", "le-credit", "ltx-unbalanced", "credit", 99m, "KGS", "receivable.stay", "receivable", "ordinary_payment_allocation")
                }));
        var uow = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            router);

        var result = uow.Commit(new OperationsCommandRequest(
            "tenant-001",
            "case-001",
            "wi-001",
            "test.unbalanced",
            "CommandEnvelope.v1",
            "definition-test",
            "idem-unbalanced",
            new Dictionary<string, object>(),
            "actor-001",
            "tenant-001:wi-001:confirm"));

        Assert.AreEqual("failed", result.Status);
        Assert.AreEqual("not_committed", result.CommitStatus);
        Assert.AreEqual(0, store.LedgerTransactions.Count);
        Assert.IsTrue(store.Submissions.Single().FailureReason!.Contains("operations_uow_rejects_unbalanced_ledger_transaction", StringComparison.OrdinalIgnoreCase));
    }

    private static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }
}
