using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.PolicyAsCodeTests;

[TestClass]
public sealed class PolicyAsCodeTests
{
    [TestMethod]
    public void EvidencePolicyFileDrivesRuntimeBehavior()
    {
        var policy = DormitoryEvidencePolicyLoader.LoadDefault();
        var request = EvidenceRequest([]);

        var missing = EvidencePolicyEvaluator.Evaluate(policy, request);
        Assert.IsFalse(missing.Allowed);
        Assert.AreEqual("missing_required_evidence", missing.Code);
        Assert.AreEqual(422, missing.StatusCode);

        var rejected = EvidencePolicyEvaluator.Evaluate(policy, EvidenceRequest([
            Evidence("receipt-proof", "rejected"),
            Evidence("deposit-policy", "verified")
        ]));
        Assert.IsFalse(rejected.Allowed);
        Assert.AreEqual("rejected_evidence_blocks_confirm", rejected.Code);

        var wrongScope = EvidencePolicyEvaluator.Evaluate(policy, EvidenceRequest([
            new EvidencePolicyRef("receipt-proof", "tenant-dormitory", "wi-other", "sub-001", "verified"),
            Evidence("deposit-policy", "verified")
        ]));
        Assert.IsFalse(wrongScope.Allowed);
        Assert.AreEqual("wrong_scope_evidence_blocks_confirm", wrongScope.Code);

        var accepted = EvidencePolicyEvaluator.Evaluate(policy, EvidenceRequest([
            Evidence("receipt-proof", "verified"),
            Evidence("deposit-policy", "verified")
        ]));
        Assert.IsTrue(accepted.Allowed);
        Assert.AreEqual("evidence_accepted", accepted.Code);

        using var temp = new TemporaryPolicyFile("docs", "business", "dormitory", "evidence-policy.yml");
        temp.Replace("\"missingEvidenceBlocksConfirm\": true", "\"missingEvidenceBlocksConfirm\": false");
        var editedPolicy = DormitoryEvidencePolicyLoader.LoadFromFile(temp.Path);

        var editedDecision = EvidencePolicyEvaluator.Evaluate(editedPolicy, request);
        Assert.IsTrue(editedDecision.Allowed, "Changing evidence-policy.yml must change runtime evaluator behavior.");
    }

    [TestMethod]
    public void AdmissionAndSurfacePolicyBlockL0ProductionLikeExposure()
    {
        var repair = BusinessAdmissionPolicyLoader.LoadDefault()
            .Single(item => item.BusinessLineId.Equals("repair", StringComparison.OrdinalIgnoreCase));

        var admission = AdmissionPolicyEvaluator.EvaluateProductionConfirm(repair);
        Assert.IsFalse(admission.Allowed);
        Assert.AreEqual("admission_blocks_production_confirm", admission.Code);

        var repairSurfaces = LoadSurfaceSnapshots()
            .Where(item => item.SliceId.StartsWith("Repair.", StringComparison.OrdinalIgnoreCase))
            .ToArray();
        Assert.IsTrue(repairSurfaces.Length >= 1);

        foreach (var surface in repairSurfaces)
        {
            var decision = SurfacePolicyEvaluator.EvaluateL0SurfaceAlignment(repair, surface);
            Assert.IsTrue(decision.Allowed, $"{surface.SliceId} must stay contract-preview / prepare_only while Repair is L0.");
        }
    }

    [TestMethod]
    public void FinanceTruthOwnerPermissionAndCutoverPoliciesBlockP0Paths()
    {
        var finance = FinancePolicyEvaluator.Evaluate(new FinancePolicyRequest("business-domain", "LedgerEntry"));
        Assert.IsFalse(finance.Allowed);
        Assert.AreEqual("finance_policy_blocks_direct_money_fact", finance.Code);

        var depositRevenue = FinancePolicyEvaluator.Evaluate(new FinancePolicyRequest("finance-kernel", "DepositRevenue"));
        Assert.IsFalse(depositRevenue.Allowed);
        Assert.AreEqual("finance_policy_blocks_deposit_as_revenue", depositRevenue.Code);

        var truth = TruthOwnerPolicyEvaluator.EvaluateOwnershipClaim("DormitoryDomainPack", "PaymentFact");
        Assert.IsFalse(truth.Allowed);
        Assert.AreEqual("truth_owner_policy_blocks_central_truth_claim", truth.Code);

        var permission = PermissionPolicyEvaluator.EvaluateHighRisk(new PermissionPolicyRequest(
            "deposit.refund.pay",
            "frontdesk",
            [],
            "deposit.refund.pay",
            "trusted",
            "refund approval"));
        Assert.IsFalse(permission.Allowed);
        Assert.AreEqual("permission_policy_requires_capability", permission.Code);

        var cutover = CutoverPolicyEvaluator.Evaluate(new CutoverPolicyRequest(
            "active_locked",
            "red",
            "scr-oma-current-shadow-domain-events-vs-audit-events",
            "rollback-mr-00-control-plane-bootstrap",
            "real"));
        Assert.IsFalse(cutover.Allowed);
        Assert.AreEqual("cutover_policy_blocks_red_shadow", cutover.Code);

        var missingRollback = CutoverPolicyEvaluator.Evaluate(new CutoverPolicyRequest(
            "active_locked",
            "green",
            "scr-green",
            null,
            "real"));
        Assert.IsFalse(missingRollback.Allowed);
        Assert.AreEqual("cutover_policy_blocks_missing_rollback", missingRollback.Code);
    }

    [TestMethod]
    public void PolicyDocumentsExposeRuntimeAndGateBindings()
    {
        foreach (var file in new[]
        {
            "evidence-policy.yml",
            "admission-policy.yml",
            "surface-policy.yml",
            "finance-policy.yml",
            "truth-owner-policy.yml",
            "permission-policy.yml",
            "cutover-policy.yml",
            "invariant-policy.yml"
        })
        {
            var policy = PolicyLoader.LoadPolicy(file);
            Assert.IsFalse(string.IsNullOrWhiteSpace(policy.PolicyId));
            Assert.IsTrue(policy.RuntimeBinding.ContainsKey("loader"));
            Assert.IsTrue(policy.RuntimeBinding.ContainsKey("evaluator"));
            Assert.IsTrue(policy.GateBinding.ContainsKey("gateInput"));
            Assert.IsTrue(policy.GateBinding.ContainsKey("failureSeverity"));
        }
    }

    private static EvidencePolicyRequest EvidenceRequest(IReadOnlyList<EvidencePolicyRef> refs) =>
        new("Dorm.DepositConfirm", "tenant-dormitory", "wi-001", "sub-001", refs);

    private static EvidencePolicyRef Evidence(string requirementId, string status) =>
        new(requirementId, "tenant-dormitory", "wi-001", "sub-001", status);

    private static IReadOnlyList<SurfacePolicySnapshot> LoadSurfaceSnapshots()
    {
        var path = PolicyLoader.LocateRepoFile("docs", "contracts", "runtime-surface-policy.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        return document.RootElement.GetProperty("policies")
            .EnumerateArray()
            .Select(item => new SurfacePolicySnapshot(
                item.GetProperty("sliceId").GetString() ?? string.Empty,
                item.GetProperty("home").GetProperty("section").GetString() ?? string.Empty,
                item.GetProperty("workbench").GetProperty("queueRule").GetString() ?? string.Empty,
                item.GetProperty("search").GetProperty("intentTags").EnumerateArray().Select(value => value.GetString() ?? string.Empty).ToArray(),
                item.GetProperty("learning").GetProperty("section").GetString() ?? string.Empty))
            .ToArray();
    }

    private sealed class TemporaryPolicyFile : IDisposable
    {
        public TemporaryPolicyFile(params string[] sourceSegments)
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"workos-policy-{Guid.NewGuid():N}.json");
            var source = PolicyLoader.LocateRepoFile(sourceSegments);
            File.Copy(source, Path);
        }

        public string Path { get; }

        public void Replace(string oldValue, string newValue)
        {
            var text = File.ReadAllText(Path);
            Assert.IsTrue(text.Contains(oldValue), $"Temp policy did not contain {oldValue}");
            File.WriteAllText(Path, text.Replace(oldValue, newValue));
        }

        public void Dispose()
        {
            if (File.Exists(Path))
            {
                File.Delete(Path);
            }
        }
    }
}
