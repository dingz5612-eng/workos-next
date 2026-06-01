using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryEvidenceScenarioTests
{
    [TestMethod]
    public void MissingEvidenceBlocksConfirmWithoutBusinessSideEffectThenEvidenceAllowsCommit()
    {
        var harness = DormitoryScenarioHarness.Create();
        var scenario = new DormitoryScenario(
            "dorm-cert-010",
            "DepositReceipt",
            "case-dorm-cert-010",
            "wi-dorm-cert-010",
            "idem-dorm-010",
            ["receipt-proof", "deposit-policy"],
            1000m);

        var policy = DormitoryEvidencePolicyLoader.LoadDefault();
        var blocked = EvidencePolicyEvaluator.Evaluate(policy, EvidenceRequest("Dorm.DepositConfirm", scenario, []));
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, blocked.StatusCode);
        Assert.AreEqual(0, harness.Store.DomainEvents.Count);

        var rejected = EvidencePolicyEvaluator.Evaluate(policy, EvidenceRequest("Dorm.DepositConfirm", scenario, [
            EvidenceRef("receipt-proof", scenario, "rejected")
        ]));
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, rejected.StatusCode);
        Assert.AreEqual(0, harness.Store.DomainEvents.Count);

        var wrongScope = EvidencePolicyEvaluator.Evaluate(policy, EvidenceRequest("Dorm.DepositConfirm", scenario, [
            new EvidencePolicyRef("receipt-proof", "tenant-dormitory", "wi-other", $"submission-{scenario.ScenarioId}", "verified")
        ]));
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, wrongScope.StatusCode);
        Assert.AreEqual(0, harness.Store.DomainEvents.Count);

        var accepted = EvidencePolicyEvaluator.Evaluate(policy, EvidenceRequest("Dorm.DepositConfirm", scenario, [
            EvidenceRef("receipt-proof", scenario, "verified"),
            EvidenceRef("deposit-policy", scenario, "verified")
        ]));
        Assert.AreEqual(StatusCodes.Status200OK, accepted.StatusCode);

        var committed = harness.Commit(scenario);
        Assert.AreEqual("committed", committed.CommitStatus);
        Assert.AreEqual(1, harness.Store.DomainEvents.Count);
        Assert.IsTrue(harness.Store.LedgerTransactions.Count > 0);
    }
    private static EvidencePolicyRequest EvidenceRequest(
        string workItemType,
        DormitoryScenario scenario,
        IReadOnlyList<EvidencePolicyRef> refs) =>
        new(
            workItemType,
            "tenant-dormitory",
            scenario.WorkItemId,
            $"submission-{scenario.ScenarioId}",
            refs);

    private static EvidencePolicyRef EvidenceRef(string requirementId, DormitoryScenario scenario, string status) =>
        new(requirementId, "tenant-dormitory", scenario.WorkItemId, $"submission-{scenario.ScenarioId}", status);
}
