using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;

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

        var blocked = DormitoryEvidencePolicy.Evaluate(scenario, providedEvidence: []);
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, blocked.StatusCode);
        Assert.AreEqual(0, harness.Store.DomainEvents.Count);

        var rejected = DormitoryEvidencePolicy.Evaluate(scenario, scenario.EvidenceIds, rejectedEvidence: ["receipt-proof"]);
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, rejected.StatusCode);
        Assert.AreEqual(0, harness.Store.DomainEvents.Count);

        var accepted = DormitoryEvidencePolicy.Evaluate(scenario, scenario.EvidenceIds);
        Assert.AreEqual(StatusCodes.Status200OK, accepted.StatusCode);

        var committed = harness.Commit(scenario);
        Assert.AreEqual("committed", committed.CommitStatus);
        Assert.AreEqual(1, harness.Store.DomainEvents.Count);
        Assert.IsTrue(harness.Store.LedgerTransactions.Count > 0);
    }
}

internal static class DormitoryEvidencePolicy
{
    public static DormitoryEvidenceDecision Evaluate(
        DormitoryScenario scenario,
        IReadOnlyList<string> providedEvidence,
        IReadOnlyList<string>? rejectedEvidence = null)
    {
        var rejected = rejectedEvidence ?? Array.Empty<string>();
        if (scenario.EvidenceIds.Any(required => !providedEvidence.Contains(required, StringComparer.OrdinalIgnoreCase)))
        {
            return new DormitoryEvidenceDecision(StatusCodes.Status422UnprocessableEntity, "missing_required_evidence");
        }

        if (rejected.Any())
        {
            return new DormitoryEvidenceDecision(StatusCodes.Status422UnprocessableEntity, "rejected_evidence_blocks_confirm");
        }

        return new DormitoryEvidenceDecision(StatusCodes.Status200OK, "evidence_accepted");
    }
}

internal sealed record DormitoryEvidenceDecision(int StatusCode, string Reason);
