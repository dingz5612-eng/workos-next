using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class BalancedMoneyKernelTests
{
    [TestMethod]
    public void migration_defines_balanced_money_model_and_append_only_ledger_entries()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "031_balanced_money_kernel.sql"));

        foreach (var term in new[]
        {
            "create table if not exists ledger_accounts",
            "create table if not exists ledger_transactions",
            "create table if not exists ledger_entries",
            "create table if not exists deposit_accounts",
            "create table if not exists deposit_balance_projection",
            "create table if not exists charges",
            "create table if not exists payments",
            "alter table payment_allocations",
            "create table if not exists stay_balance_projection",
            "ck_ledger_transactions_balance_status",
            "balance_status = 'balanced'",
            "forbid_balanced_ledger_entry_mutation",
            "trg_ledger_entries_forbid_update",
            "trg_ledger_entries_forbid_delete",
            "Deposits are liability, not revenue"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"S5 migration must declare {term}.");
        }
    }

    [TestMethod]
    public void deposit_receipt_credits_liability_not_revenue()
    {
        var facts = BalancedMoneyKernel.FromEnvelope(Envelope("depositReceipt", "1500.00"));

        Assert.AreEqual(1, facts.LedgerTransactions.Count);
        Assert.AreEqual("balanced", facts.LedgerTransactions[0].BalanceStatus);
        CollectionAssert.Contains(facts.LedgerEntries.Select(item => item.AccountType).ToArray(), "liability");
        CollectionAssert.DoesNotContain(facts.LedgerEntries.Select(item => item.AccountType).ToArray(), "revenue");
    }

    [TestMethod]
    public void refund_deposit_reverses_liability_through_balanced_transaction()
    {
        var facts = BalancedMoneyKernel.FromEnvelope(Envelope("depositRefundPayment", "300.00"));
        var debit = facts.LedgerEntries.Single(item => item.DebitCredit == "debit");
        var credit = facts.LedgerEntries.Single(item => item.DebitCredit == "credit");

        Assert.AreEqual("deposit-account-001", debit.AccountId);
        Assert.AreEqual("liability", debit.AccountType);
        Assert.AreEqual("asset.cash_or_bank", credit.AccountId);
        Assert.AreEqual(debit.Amount, credit.Amount);
    }

    [TestMethod]
    public void checkout_settlement_does_not_fabricate_deposit_ledger_facts()
    {
        var facts = BalancedMoneyKernel.FromEnvelope(Envelope("checkoutSettlement", "900.00"));

        Assert.AreEqual(0, facts.LedgerTransactions.Count);
        Assert.AreEqual(0, facts.LedgerEntries.Count);
        Assert.AreEqual("checkout_reads_projection_only", facts.ResponseFields["moneyBoundary"]);
    }

    [TestMethod]
    public void payment_adjustment_uses_surface_adjustment_amount()
    {
        var facts = BalancedMoneyKernel.FromEnvelope(Envelope("paymentAdjustment", "25.00", "adjustmentAmount"));

        Assert.AreEqual(1, facts.LedgerTransactions.Count);
        Assert.AreEqual("balanced", facts.LedgerTransactions[0].BalanceStatus);
        Assert.IsTrue(facts.LedgerEntries.All(item => item.Amount == 25.00m));
    }

    private static CommandEnvelopeV1 Envelope(string cardId, string amount, string amountField = "amount") =>
        new(
            "tenant-001",
            CanonicalOperationsApiService.ConfirmCommandType,
            "CommandEnvelope.v1",
            $"work-item:{cardId}:v1",
            "case-001",
            $"work-{cardId}",
            $"idem-{cardId}",
            "sha256:test",
            new Dictionary<string, object>
            {
                ["cardId"] = cardId,
                ["fieldValues"] = new Dictionary<string, object>
                {
                    [amountField] = amount,
                    ["currency"] = "KGS",
                    ["depositAccountId"] = cardId.Contains("refund", StringComparison.OrdinalIgnoreCase)
                        ? "deposit-account-001"
                        : string.Empty
                }
            });

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
