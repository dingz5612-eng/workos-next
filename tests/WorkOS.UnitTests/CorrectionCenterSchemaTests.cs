using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class CorrectionCenterSchemaTests
{
    [TestMethod]
    public void correction_request_requires_reason()
    {
        var migration = ReadCorrectionMigration();
        var requestTable = CreateTableSection(migration, "ledger_correction_requests");

        Assert.IsTrue(requestTable.Contains("reason text not null", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(requestTable.Contains("ck_ledger_correction_requests_reason_required", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(requestTable.Contains("length(trim(reason)) > 0", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void high_risk_correction_requires_approval()
    {
        var migration = ReadCorrectionMigration();

        foreach (var term in new[]
        {
            "risk_level in ('low', 'medium', 'high', 'critical')",
            "result in ('approved', 'rejected')",
            "correction_request_has_required_approval",
            "guard_high_risk_reversal_approval",
            "guard_high_risk_correction_approval",
            "high_risk_correction_requires_approval",
            "before insert on ledger_reversal_entries",
            "before insert on ledger_correction_entries"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"Correction Center must enforce approval guard term: {term}");
        }
    }

    [TestMethod]
    public void ledger_entry_update_forbidden_or_guarded()
    {
        var migration = ReadCorrectionMigration();

        foreach (var term in new[]
        {
            "forbid_correction_ledger_entry_update",
            "forbid_legacy_ledger_entry_update",
            "guard_hostel_payments_fact_update",
            "guard_finance_reconciliations_fact_update",
            "guard_hostel_charges_fact_update",
            "ledger_entry_update_forbidden_or_guarded",
            "before update on ledger_reversal_entries",
            "before update on ledger_correction_entries",
            "before update on hostel_payments",
            "before update on finance_reconciliations",
            "before update on hostel_charges",
            "before update on deposit_transactions",
            "before update on payment_allocations",
            "append a reversal or correction entry instead of editing ledger facts"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"Correction Center must include append-only guard term: {term}");
        }

        foreach (var protectedFactColumn in new[]
        {
            "new.amount is distinct from old.amount",
            "new.currency is distinct from old.currency",
            "new.purpose is distinct from old.purpose",
            "new.confirmed_amount is distinct from old.confirmed_amount",
            "new.variance_amount is distinct from old.variance_amount",
            "new.charge_type is distinct from old.charge_type",
            "new.period_start_utc is distinct from old.period_start_utc"
        })
        {
            Assert.IsTrue(migration.Contains(protectedFactColumn, StringComparison.OrdinalIgnoreCase), $"Legacy ledger fact column must be guarded: {protectedFactColumn}");
        }

        Assert.IsFalse(migration.Contains("update hostel_payments set", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(migration.Contains("update deposit_transactions set", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(migration.Contains("update payment_allocations set", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void before_after_snapshots_are_displayable()
    {
        var migration = ReadCorrectionMigration();
        var correctionEntries = CreateTableSection(migration, "ledger_correction_entries");

        Assert.IsTrue(correctionEntries.Contains("before_snapshot jsonb not null", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(correctionEntries.Contains("after_snapshot jsonb not null", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(correctionEntries.Contains("jsonb_typeof(before_snapshot) = 'object'", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(correctionEntries.Contains("jsonb_typeof(after_snapshot) = 'object'", StringComparison.OrdinalIgnoreCase));
    }

    private static string ReadCorrectionMigration() =>
        File.ReadAllText(RepoPath("infra", "db", "migrations", "020_correction_center_schema.sql"));

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

    private static string CreateTableSection(string migration, string tableName)
    {
        var start = migration.IndexOf($"create table if not exists {tableName}", StringComparison.OrdinalIgnoreCase);
        Assert.IsTrue(start >= 0, $"Could not find create table section for {tableName}.");

        var next = migration.IndexOf("create table if not exists", start + 1, StringComparison.OrdinalIgnoreCase);
        return next < 0
            ? migration[start..]
            : migration[start..next];
    }
}
