using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ReconciliationMatchingTests
{
    [TestMethod]
    public void match_candidate_created_for_same_amount_payment()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMatchingStorage.cs"));

        Assert.IsTrue(storage.Contains("insert into payment_match_candidates", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("transaction.amount = payment.amount", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("transaction.currency = payment.currency", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("abs(extract(epoch", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("'payment'", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("on conflict(candidate_id) do nothing", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void manual_match_does_not_confirm_payment()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMatchingStorage.cs"));
        var program = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Program.cs"));

        Assert.IsTrue(storage.Contains("Reconciliation.PaymentMatched", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("Reconciliation.DepositMatched", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("Reconciliation.RefundMatched", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("PaymentConfirmed", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(program.Contains("/api/payment/confirm", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void manual_match_does_not_change_stay_balance()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMatchingStorage.cs"));

        Assert.IsFalse(storage.Contains("insert into stay_balances", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("update stay_balances", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("payment_allocations", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("payment_matches", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void bank_transaction_cannot_match_twice_by_default()
    {
        var migration = ReadReconciliationMigrations();

        Assert.IsTrue(migration.Contains("ux_payment_matches_active_bank_transaction", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("on payment_matches(tenant_id, bank_transaction_id)", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("where status = 'matched'", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void payment_cannot_match_twice_by_default()
    {
        var migration = ReadReconciliationMigrations();

        Assert.IsTrue(migration.Contains("ux_payment_matches_active_payment", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("on payment_matches(tenant_id, payment_id)", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("where status = 'matched' and payment_id is not null", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void reconciliation_matching_patch_migration_is_idempotent()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "018_reconciliation_matching_manual_decisions.sql"));

        Assert.IsTrue(migration.Contains("add column if not exists refund_payment_id", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("ux_payment_match_candidates_refund_target", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("ux_payment_matches_active_refund_payment", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("duplicate_object", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void rejected_candidate_not_used_in_risk_summary()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMatchingStorage.cs"));

        Assert.IsTrue(storage.Contains("candidate.status in ('proposed', 'reviewing')", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("set status = @status", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("\"rejected\"", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("candidate.status <> 'rejected'", StringComparison.OrdinalIgnoreCase),
            "Candidate risk queries should use an allowlist of open statuses, not a loose rejected-only filter.");
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

    private static string ReadReconciliationMigrations() =>
        string.Concat(
            File.ReadAllText(RepoPath("infra", "db", "migrations", "017_reconciliation_runtime.sql")),
            Environment.NewLine,
            File.ReadAllText(RepoPath("infra", "db", "migrations", "018_reconciliation_matching_manual_decisions.sql")));
}
