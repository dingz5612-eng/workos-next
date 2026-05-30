using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class PeriodAnalyticsSchemaTests
{
    [TestMethod]
    public void period_schema_migration()
    {
        var migration = ReadMigration();

        foreach (var table in new[]
        {
            "period_reviews",
            "period_scopes",
            "period_metric_snapshots",
            "period_finance_snapshots",
            "period_operation_snapshots",
            "period_action_plans",
            "period_late_adjustments",
            "expense_ledger_status",
            "risk_command_snapshots"
        })
        {
            Assert.IsTrue(migration.Contains(table, StringComparison.OrdinalIgnoreCase), $"migration must include {table}");
        }

        foreach (var column in new[]
        {
            "period_review_id",
            "tenant_id",
            "period_key",
            "scope_id",
            "opened_by",
            "opened_at_utc",
            "closed_event_id",
            "source_high_watermark",
            "source_projection_versions",
            "source_ledger_versions",
            "source_lens_versions",
            "expense_status",
            "created_work_item_id",
            "due_at_utc",
            "linked_correction_id",
            "source",
            "note",
            "risk_snapshot_id"
        })
        {
            Assert.IsTrue(migration.Contains(column, StringComparison.OrdinalIgnoreCase), $"migration must declare {column}");
        }

        foreach (var status in new[]
        {
            "open",
            "scope_confirmed",
            "metrics_reviewed",
            "finance_reviewed",
            "operations_diagnosed",
            "action_plan_committed",
            "closed",
            "reopened_for_late_adjustment"
        })
        {
            Assert.IsTrue(migration.Contains($"'{status}'", StringComparison.OrdinalIgnoreCase), $"period_review status must include {status}");
        }
    }

    [TestMethod]
    public void period_scope_freeze_fields()
    {
        var migration = ReadMigration();

        foreach (var term in new[]
        {
            "period_scope_freeze_fields",
            "PeriodScopeConfirmed freezes scope boundaries",
            "old.frozen_at_utc is not null",
            "new.period_start is distinct from old.period_start",
            "new.period_end is distinct from old.period_end",
            "new.timezone is distinct from old.timezone",
            "new.business_day_cutoff is distinct from old.business_day_cutoff",
            "trg_period_scopes_freeze_fields",
            "before insert or update on period_scopes"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"scope freeze migration must include {term}");
        }
    }

    [TestMethod]
    public void period_snapshot_append_only_after_close()
    {
        var migration = ReadMigration();

        foreach (var term in new[]
        {
            "period_review_is_closed",
            "guard_period_snapshot_append_only_after_close",
            "period_snapshot_append_only_after_close",
            "append period_late_adjustments instead of writing snapshots after PeriodReviewClosed",
            "before insert or update on period_metric_snapshots",
            "before insert or update on period_finance_snapshots",
            "before insert or update on period_operation_snapshots",
            "normalize_period_action_plan_v54",
            "trg_period_action_plans_normalize_v54",
            "normalize_period_late_adjustment_v54",
            "trg_period_late_adjustments_normalize_v54",
            "forbid_period_late_adjustment_mutation",
            "period_late_adjustments_append_only",
            "period_late_adjustment_requires_closed_period",
            "period_late_adjustment_requires_before_after",
            "linked_correction_id := coalesce",
            "late_adjustment_id := coalesce(new.late_adjustment_id, new.adjustment_id)",
            "before update on period_late_adjustments",
            "before delete on period_late_adjustments"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"snapshot append-only migration must include {term}");
        }
    }

    [TestMethod]
    public void expense_status_required()
    {
        var migration = ReadMigration();
        var financeSection = SectionStartingAt(migration, "alter table period_finance_snapshots");

        foreach (var term in new[]
        {
            "expense_status text",
            "expense_status = coalesce(expense_status, 'not_integrated')",
            "expense_status in ('not_integrated', 'manual_imported', 'ledger_verified')",
            "expense_status <> 'zero_by_default'",
            "create table if not exists expense_ledger_status",
            "tenant_id text primary key",
            "status text not null",
            "source text not null",
            "note text not null",
            "ck_expense_ledger_status_status",
            "ck_period_action_plans_owner_due_priority",
            "expense_status <> 'ledger_verified'",
            "expenseSource",
            "expenseStatusWarning",
            "periodProfitMetricStatus",
            "periodNetProfit",
            "profitMetricUnavailableReason",
            "not_integrated",
            "lower(generated_by) not in ('user', 'manual', 'frontend')",
            "FinanceSnapshot cannot accept user hand-filled final numbers",
            "expense_status_required"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"expense status guard must include {term}");
        }

        Assert.IsTrue(financeSection.Contains("source_ledger_versions jsonb", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(financeSection.Contains("generated_by text", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(migration.Contains("expense_status text not null default 'verified'", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(migration.Contains("expense_status text not null default 'zero_by_default'", StringComparison.OrdinalIgnoreCase));
    }

    private static string ReadMigration() =>
        File.ReadAllText(RepoPath("infra", "db", "migrations", "021_period_analytics_v54_schema.sql"));

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

    private static string SectionStartingAt(string source, string marker)
    {
        var start = source.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        Assert.IsTrue(start >= 0, $"Could not find section marker {marker}.");
        var next = source.IndexOf("alter table", start + marker.Length, StringComparison.OrdinalIgnoreCase);
        return next < 0
            ? source[start..]
            : source[start..next];
    }
}
