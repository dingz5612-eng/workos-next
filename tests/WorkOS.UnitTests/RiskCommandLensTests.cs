using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class RiskCommandLensTests
{
    [TestMethod]
    public void risk_command_includes_debt_risk_from_stay_balance()
    {
        var items = RiskCommandLensBuilder.Build(new[] { Input("risk-debt-guests", "debt_risk", amount: 9300m, currency: "KGS", sourceTables: ["stay_balances"], ledgerRefs: ["stay-001"], eventIds: ["evt-debt"]) });

        var debt = items.Single(item => item.riskType == "debt_risk");
        Assert.AreEqual(9300m, debt.amount);
        Assert.AreEqual("KGS", debt.currency);
        CollectionAssert.Contains(debt.sourceOfTruthTables.ToArray(), "stay_balances");
        CollectionAssert.Contains(debt.relatedLedgerRefs.ToArray(), "stay-001");
    }

    [TestMethod]
    public void risk_command_includes_deposit_liability_from_deposit_ledger()
    {
        var items = RiskCommandLensBuilder.Build(new[] { Input("risk-deposit-liability", "deposit_liability", amount: 3000m, currency: "KGS", sourceTables: ["deposit_liabilities"], ledgerRefs: ["dep-001"], eventIds: ["evt-deposit"]) });

        var deposit = items.Single(item => item.riskType == "deposit_liability");
        Assert.AreEqual(3000m, deposit.amount);
        Assert.AreEqual("finance", deposit.ownerRole);
        CollectionAssert.Contains(deposit.sourceOfTruthTables.ToArray(), "deposit_liabilities");
    }

    [TestMethod]
    public void risk_command_includes_payment_pending_from_payment_risk_lens()
    {
        var items = RiskCommandLensBuilder.Build(new[] { Input("risk-payment-pending-confirmation", "payment_pending_confirmation", amount: 1200m, count: 2, currency: "KGS", sourceTables: ["hostel_payments"], ledgerRefs: ["pay-001"], eventIds: ["evt-payment"]) });

        var payment = items.Single(item => item.riskType == "payment_pending_confirmation");
        Assert.AreEqual(2, payment.count);
        Assert.AreEqual("openPaymentConfirmationQueue", payment.resolveAction);
        CollectionAssert.Contains(payment.sourceOfTruthTables.ToArray(), "hostel_payments");
    }

    [TestMethod]
    public void risk_command_includes_blocked_beds_from_resource_inventory()
    {
        var items = RiskCommandLensBuilder.Build(new[] { Input("risk-blocked-beds", "blocked_beds", count: 3, sourceTables: ["accommodation_beds", "service_tasks"], ledgerRefs: ["bed-001"], workItemIds: ["task-001"], eventIds: ["evt-bed"]) });

        var blockedBeds = items.Single(item => item.riskType == "blocked_beds");
        Assert.AreEqual(3, blockedBeds.count);
        Assert.IsNull(blockedBeds.amount);
        CollectionAssert.Contains(blockedBeds.sourceOfTruthTables.ToArray(), "accommodation_beds");
        CollectionAssert.Contains(blockedBeds.relatedWorkItemIds.ToArray(), "task-001");
    }

    [TestMethod]
    public void every_risk_has_drilldown_refs()
    {
        var items = RiskCommandLensBuilder.Build(new[]
        {
            Input("risk-debt-guests", "debt_risk", amount: 1m, currency: "KGS", sourceTables: ["stay_balances"], ledgerRefs: ["stay-001"], eventIds: ["evt-debt"]),
            Input("risk-deposit-liability", "deposit_liability", amount: 1m, currency: "KGS", sourceTables: ["deposit_liabilities"], ledgerRefs: ["dep-001"], eventIds: ["evt-deposit"]),
            Input("risk-payment-pending-confirmation", "payment_pending_confirmation", amount: 1m, count: 1, currency: "KGS", sourceTables: ["hostel_payments"], ledgerRefs: ["pay-001"], eventIds: ["evt-payment"]),
            Input("risk-refund-payment-pending", "refund_payment_pending", amount: 1m, count: 1, currency: "KGS", sourceTables: ["deposit_transactions"], ledgerRefs: ["refund-001"], eventIds: ["evt-refund"]),
            Input("risk-blocked-beds", "blocked_beds", count: 1, sourceTables: ["accommodation_beds"], ledgerRefs: ["bed-001"], eventIds: ["evt-bed"]),
            Input("risk-service-backlog", "service_task_backlog", count: 1, sourceTables: ["service_tasks"], ledgerRefs: ["task-001"], workItemIds: ["task-001"], eventIds: ["evt-task"]),
            Input("risk-open-periods", "period_not_closed", count: 1, sourceTables: ["period_reviews"], ledgerRefs: ["period-001"], eventIds: ["evt-period"]),
            Input("risk-reconciliation-mismatch", "reconciliation_mismatch", count: 1, sourceTables: ["payment_mismatches", "reconciliation_cases"], ledgerRefs: ["mismatch-001"], eventIds: ["evt-mismatch"]),
            Input("risk-high-risk-correction", "high_risk_correction", count: 1, sourceTables: ["ledger_correction_requests"], ledgerRefs: ["correction-001"], eventIds: ["evt-correction"]),
            Input("risk-overdue-work-items", "overdue_work_items", count: 1, sourceTables: ["process_work_item_intents"], workItemIds: ["work-001"], eventIds: ["evt-work"]),
            Input("risk-open-blockers", "open_blockers", count: 1, sourceTables: ["process_request_event_intents"], ledgerRefs: ["blocker-001"], workItemIds: ["work-blocker"], eventIds: ["evt-blocker"])
        });

        Assert.AreEqual(11, items.Count);
        foreach (var item in items)
        {
            Assert.AreEqual(RiskCommandLensBuilder.LensName, item.lens);
            Assert.IsFalse(string.IsNullOrWhiteSpace(item.drilldownUrl), $"{item.riskType} must have a drilldown URL.");
            Assert.IsFalse(string.IsNullOrWhiteSpace(item.severityReason), $"{item.riskType} must explain severity.");
            Assert.IsTrue(item.relatedLedgerRefs.Count > 0 || item.relatedWorkItemIds.Count > 0 || item.relatedEvidenceRefs.Count > 0 || item.relatedEventIds.Count > 0, $"{item.riskType} must carry source refs.");
        }
    }

    [TestMethod]
    public void no_demo_risk_count()
    {
        var items = RiskCommandLensBuilder.Build(new[]
        {
            Input("risk-demo-count", "demo_count", count: 99, sourceTables: ["demoQueue"], ledgerRefs: ["demo-risk"])
        });

        Assert.AreEqual(0, items.Count);
    }

    private static RiskCommandLensInput Input(
        string riskId,
        string riskType,
        decimal? amount = null,
        long? count = null,
        string? currency = null,
        string[]? sourceTables = null,
        string[]? ledgerRefs = null,
        string[]? workItemIds = null,
        string[]? eventIds = null) =>
        new(
            riskId,
            riskType,
            riskType.Contains("blocked", StringComparison.OrdinalIgnoreCase) ? "P1" : "P2",
            $"{riskType} severity derived from backend facts.",
            amount,
            count,
            currency,
            "finance",
            null,
            riskType,
            null,
            workItemIds ?? [],
            ledgerRefs ?? [],
            [],
            eventIds ?? [],
            riskType switch
            {
                "payment_pending_confirmation" => "openPaymentConfirmationQueue",
                _ => $"resolve-{riskType}"
            },
            null,
            $"/pc/risk/{riskType}",
            sourceTables ?? [],
            0);
}
