using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class LedgerInspectionJobTests
{
    [TestMethod]
    public void payment_allocation_invariant_job()
    {
        var output = RunWithViolation("ledger.payment_allocation_lte_confirmed_available");

        var check = Check(output, "ledger.payment_allocation_lte_confirmed_available");
        Assert.AreEqual("failed", check.Status);
        Assert.AreEqual("P0", check.Severity);
        Assert.AreEqual("failed", output.Report.Status);
        Assert.AreEqual("failed", output.DashboardSummary.Status);
        CollectionAssert.Contains(output.Report.NoGoItems.ToArray(), "P0:ledger.payment_allocation_lte_confirmed_available:1");
    }

    [TestMethod]
    public void deposit_available_refund_invariant_job()
    {
        var output = RunWithViolation("ledger.deposit_refund_lte_available_refund");

        var check = Check(output, "ledger.deposit_refund_lte_available_refund");
        Assert.AreEqual("failed", check.Status);
        Assert.AreEqual("openRefundCorrectionRequest", output.DashboardSummary.CriticalItems.Single().ResolveAction);
        Assert.AreEqual(1, output.DashboardSummary.P0Failures);
    }

    [TestMethod]
    public void stay_balance_rebuild_job()
    {
        var output = RunWithViolation(null);

        var check = Check(output, "ledger.stay_balance_projection_matches_rebuild");
        Assert.AreEqual("passed", check.Status);
        Assert.AreEqual("ledger-inspection-job", check.GeneratedBy);
        Assert.AreEqual("passed", output.Status);
        CollectionAssert.Contains(output.Report.GoItems.ToArray(), "ledger.stay_balance_projection_matches_rebuild");
    }

    [TestMethod]
    public void period_snapshot_consistency_job()
    {
        var output = RunWithViolation("period.finance_snapshot_source_consistency");

        var check = Check(output, "period.finance_snapshot_source_consistency");
        Assert.AreEqual("failed", check.Status);
        Assert.AreEqual("P1", check.Severity);
        Assert.AreEqual("regeneratePeriodFinanceSnapshot", output.DashboardSummary.CriticalItems.Single().ResolveAction);
        Assert.IsTrue(output.Report.Metadata.ContainsKey("pc_dashboard_summary"));
    }

    [TestMethod]
    public void ledger_inspection_definitions_cover_required_checks()
    {
        var keys = LedgerInspectionDefinitions.All.Select(definition => definition.InvariantKey).ToArray();

        CollectionAssert.AreEquivalent(new[]
        {
            "ledger.payment_allocation_lte_confirmed_available",
            "ledger.deposit_held_amount_non_negative",
            "ledger.deposit_refund_lte_available_refund",
            "ledger.refund_failed_not_double_counted",
            "ledger.stay_balance_projection_matches_rebuild",
            "ledger.deposit_balance_projection_matches_rebuild",
            "period.finance_snapshot_source_consistency",
            "correction.applied_balance_consistency"
        }, keys);
    }

    private static LedgerInspectionRunOutput RunWithViolation(string? violatedKey)
    {
        var service = new LedgerInspectionJobService(new FakeLedgerInspectionEvaluator(violatedKey));
        return service.Run(new LedgerInspectionRunContext(
            "ledger-inspection-test",
            "release-test",
            "MR-test",
            "tenant-test",
            "LedgerInspection",
            "ci-test",
            "release_gate",
            "ledger-inspection-job",
            DateTimeOffset.Parse("2026-05-30T00:00:00Z")));
    }

    private static InvariantCheckEvidence Check(LedgerInspectionRunOutput output, string key) =>
        output.InvariantChecks.Single(check => check.InvariantKey == key);

    private sealed class FakeLedgerInspectionEvaluator : ILedgerInspectionInvariantEvaluator
    {
        private readonly string? violatedKey;

        public FakeLedgerInspectionEvaluator(string? violatedKey)
        {
            this.violatedKey = violatedKey;
        }

        public SqlInvariantResult ExecuteInvariantSql(string sql)
        {
            var key = LedgerInspectionDefinitions.All.Single(definition =>
                sql.Contains($"invariant:{definition.InvariantKey}", StringComparison.Ordinal)).InvariantKey;
            if (!key.Equals(violatedKey, StringComparison.Ordinal))
            {
                return new SqlInvariantResult(
                    0,
                    new Dictionary<string, object> { ["checked"] = key },
                    new Dictionary<string, object> { ["violations"] = 0 },
                    Array.Empty<IReadOnlyDictionary<string, object>>());
            }

            return new SqlInvariantResult(
                1,
                new Dictionary<string, object> { ["checked"] = key, ["violation_count"] = 1 },
                new Dictionary<string, object> { ["violations"] = 0 },
                new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["invariant_key"] = key, ["sample"] = "fixture" } });
        }
    }
}
