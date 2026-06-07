using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class RuntimeScenarioFactoryTests
{
    [TestMethod]
    public void committed_money_scenario_emits_fact_graph_and_balanced_ledger_refs()
    {
        var runner = new RuntimeScenarioRunner("tenant-scenario");

        var result = runner.Run(new ExecutableScenarioDefinition(
            ScenarioId: "scenario-committed-money",
            Name: "deposit confirm",
            ScenarioType: "committed_scenario",
            ExpectedOutcome: "committed_projected",
            CardId: "DepositReceipt",
            WorkItemType: "Dorm.DepositConfirm",
            MoneyCommand: true,
            Amount: 500m,
            EvidenceRefs: ["receipt-proof"]));

        Assert.AreEqual("passed", result.Status);
        Assert.IsNotNull(result.CommandSubmission);
        Assert.IsNull(result.RejectedCommandSubmission);
        Assert.IsNotNull(result.FactTrace);
        Assert.IsNotEmpty(result.DomainEventRefs);
        Assert.IsNotEmpty(result.LedgerTransactionRefs);
        Assert.IsGreaterThanOrEqualTo(2, result.LedgerEntryRefs.Count);
        CollectionAssert.Contains(result.FactGraph.CommandSubmissions.ToArray(), result.CommandSubmission!.SubmissionId);
    }

    [TestMethod]
    public void rejected_command_scenario_emits_rejection_trace_without_business_facts()
    {
        var runner = new RuntimeScenarioRunner("tenant-scenario");

        var result = runner.Run(new ExecutableScenarioDefinition(
            ScenarioId: "dorm-cert-008",
            Name: "permission denied",
            ScenarioType: "rejected_command_scenario",
            ExpectedOutcome: "permission_denied_403",
            CardId: "ExceptionResolve",
            WorkItemType: "Dorm.ExceptionResolve",
            RejectionStatusCode: StatusCodes.Status403Forbidden,
            RejectionReason: "permission_denied",
            EvidenceRefs: ["exception-audit"]));

        Assert.AreEqual("passed", result.Status);
        Assert.IsNotNull(result.RejectedCommandSubmission);
        Assert.IsNotNull(result.RejectionTrace);
        Assert.AreEqual(StatusCodes.Status403Forbidden, result.RejectedCommandSubmission!.StatusCode);
        Assert.AreEqual("permission_denied", result.RejectionTrace!.Reason);
        Assert.IsEmpty(result.DomainEventRefs);
        Assert.IsEmpty(result.LedgerTransactionRefs);
        Assert.IsNotNull(result.FactTrace);
    }

    [TestMethod]
    public void idempotency_conflict_scenario_has_rejection_trace_and_no_new_side_effect()
    {
        var runner = new RuntimeScenarioRunner("tenant-scenario");

        var result = runner.Run(new ExecutableScenarioDefinition(
            ScenarioId: "dorm-cert-009",
            Name: "duplicate submit conflict",
            ScenarioType: "rejected_command_scenario",
            ExpectedOutcome: "idempotency_conflict_409",
            CardId: "PaymentReceipt",
            WorkItemType: "Dorm.PaymentConfirm",
            MoneyCommand: true,
            Amount: 300m,
            EvidenceRefs: ["payment-receipt"]));

        Assert.AreEqual("passed", result.Status);
        Assert.IsTrue(result.NoDuplicateSideEffect);
        Assert.IsNotNull(result.CommandSubmission);
        Assert.IsNotNull(result.RejectedCommandSubmission);
        Assert.IsNotNull(result.RejectionTrace);
        Assert.AreEqual(StatusCodes.Status409Conflict, result.RejectedCommandSubmission!.StatusCode);
    }

    [TestMethod]
    public void gate_only_blocked_scenario_has_gate_evidence_without_business_facts()
    {
        var runner = new RuntimeScenarioRunner("tenant-scenario");

        var result = runner.Run(new ExecutableScenarioDefinition(
            ScenarioId: "gate-red-shadow",
            Name: "red shadow gate",
            ScenarioType: "gate_only_blocked_scenario",
            ExpectedOutcome: "semantic_shadow_red_blocked",
            WorkItemType: "Gate.SemanticShadowReview",
            GateResultRef: "gate-red-shadow",
            ShadowCompareReportRef: "shadow-red",
            RollbackBlockerRef: "rollback-required",
            EvidenceRefs: ["shadow-compare-report"]));

        Assert.AreEqual("passed", result.Status);
        Assert.IsNull(result.CommandSubmission);
        Assert.IsNull(result.RejectedCommandSubmission);
        Assert.IsEmpty(result.DomainEventRefs);
        Assert.IsEmpty(result.LedgerTransactionRefs);
        CollectionAssert.Contains(result.FactGraph.GateImpactRefs.ToArray(), "gate-red-shadow");
        CollectionAssert.Contains(result.FactGraph.GateImpactRefs.ToArray(), "rollback-required");
        CollectionAssert.Contains(result.FactGraph.SemanticShadowRefs.ToArray(), "shadow-red");
    }
}
