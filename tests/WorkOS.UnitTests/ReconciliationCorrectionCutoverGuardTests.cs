using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ReconciliationCorrectionCutoverGuardTests
{
    private static readonly string[] RequiredFeatureFlags =
    [
        "reconciliation.bank_import.enabled",
        "reconciliation.match_candidate.enabled",
        "reconciliation.manual_match.enabled",
        "reconciliation.mismatch_case.enabled",
        "correction.request.enabled",
        "correction.approve.enabled",
        "correction.apply.enabled",
        "correction.before_after_view.enabled"
    ];

    private static readonly string[] RequiredSlices =
    [
        "Reconciliation",
        "CorrectionCenter"
    ];

    private static readonly string[] RequiredDependencies =
    [
        "PaymentLedger",
        "DepositLedger",
        "StayBalanceProjection",
        "EvidenceSecureSubstrate",
        "PCFinanceLite",
        "GateResultRunner",
        "InvariantRunner"
    ];

    private static readonly string[] RequiredInvariants =
    [
        "bank.import_does_not_create_payment_fact",
        "reconciliation.bank_transaction_single_match_default",
        "ledger.no_edit_old_entry",
        "correction.requires_reason",
        "correction.high_risk_requires_approval",
        "balance.rebuild_after_correction"
    ];

    [TestMethod]
    public void ReconciliationCorrectionCutoverConfigDeclaresFlagsSlicesDependenciesAndPilotScope()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "reconciliation-correction-cutover.config.json")));
        var root = document.RootElement;

        var flags = root.GetProperty("feature_flags").EnumerateArray().ToArray();
        CollectionAssert.AreEquivalent(
            RequiredFeatureFlags,
            flags.Select(flag => flag.GetProperty("flag_key").GetString()).ToArray());

        foreach (var flag in flags)
        {
            Assert.AreEqual("shadow", flag.GetProperty("status").GetString(), $"{flag.GetProperty("flag_key").GetString()} status");

            var scope = flag.GetProperty("scope_rules");
            Assert.IsTrue(scope.TryGetProperty("tenantIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing tenantIds scope");
            Assert.IsTrue(scope.TryGetProperty("sliceIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing sliceIds scope");
            Assert.IsTrue(scope.TryGetProperty("roles", out _), $"{flag.GetProperty("flag_key").GetString()} missing roles scope");
            Assert.IsTrue(scope.TryGetProperty("actorIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing actorIds scope");
            Assert.IsTrue(scope.TryGetProperty("deviceIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing deviceIds scope");
            Assert.IsTrue(scope.TryGetProperty("deviceTrust", out _), $"{flag.GetProperty("flag_key").GetString()} missing deviceTrust scope");
            Assert.IsTrue(scope.TryGetProperty("amount", out var amount), $"{flag.GetProperty("flag_key").GetString()} missing amount scope");
            Assert.IsTrue(scope.TryGetProperty("percentage", out _), $"{flag.GetProperty("flag_key").GetString()} missing percentage scope");
            Assert.AreEqual("KGS", amount.GetProperty("currency").GetString());
            Assert.AreEqual(1000, amount.GetProperty("lte").GetInt32());
        }

        var cutovers = root.GetProperty("slice_cutover_states").EnumerateArray().ToArray();
        CollectionAssert.AreEquivalent(
            RequiredSlices,
            cutovers.Select(cutover => cutover.GetProperty("slice_id").GetString()).ToArray());

        foreach (var cutover in cutovers)
        {
            Assert.AreEqual("shadow", cutover.GetProperty("runtime_mode").GetString());
            Assert.AreEqual("legacy", cutover.GetProperty("previous_runtime_mode").GetString());

            var dependencies = cutover.GetProperty("dependency_status");
            foreach (var dependency in RequiredDependencies)
            {
                Assert.IsTrue(dependencies.TryGetProperty(dependency, out var status), $"{cutover.GetProperty("slice_id").GetString()} missing dependency {dependency}");
                Assert.IsFalse(string.IsNullOrWhiteSpace(status.GetString()), $"{dependency} status");
            }

            Assert.AreEqual("active_stable", dependencies.GetProperty("PaymentLedger").GetString());
            Assert.AreEqual("active_stable", dependencies.GetProperty("DepositLedger").GetString());

            var pilot = cutover.GetProperty("pilot_scope");
            CollectionAssert.Contains(pilot.GetProperty("roles").EnumerateArray().Select(item => item.GetString()).ToArray(), "finance");
            Assert.AreEqual("KGS", pilot.GetProperty("amount").GetProperty("currency").GetString());
            Assert.AreEqual(1000, pilot.GetProperty("amount").GetProperty("lte").GetInt32());
            Assert.IsTrue(pilot.GetProperty("manual_match_only").GetBoolean());
            Assert.IsFalse(pilot.GetProperty("automation_enabled").GetBoolean());

            var routing = cutover.GetProperty("routing");
            foreach (var mode in new[] { "shadow", "pilot", "active", "rollback" })
            {
                Assert.IsTrue(routing.TryGetProperty(mode, out var route), $"{cutover.GetProperty("slice_id").GetString()} missing {mode} routing");
                Assert.IsFalse(string.IsNullOrWhiteSpace(route.GetString()), $"{cutover.GetProperty("slice_id").GetString()} {mode} routing");
            }
        }

        var activePolicy = root.GetProperty("active_policy");
        Assert.IsTrue(activePolicy.GetProperty("manual_import_enabled").GetBoolean());
        Assert.IsTrue(activePolicy.GetProperty("manual_match_enabled").GetBoolean());
        Assert.IsFalse(activePolicy.GetProperty("full_auto_matching_enabled").GetBoolean());
        Assert.IsFalse(activePolicy.GetProperty("automation_enabled").GetBoolean());

        var rollbackPolicy = root.GetProperty("rollback_policy");
        Assert.AreEqual("legacy_or_off", rollbackPolicy.GetProperty("reconciliation_runtime_mode").GetString());
        Assert.AreEqual("off", rollbackPolicy.GetProperty("correction_apply_feature").GetString());
        Assert.IsFalse(rollbackPolicy.GetProperty("delete_appended_corrections").GetBoolean());
    }

    [TestMethod]
    public void ReconciliationCorrectionShadowCompareConfigDeclaresGreenYellowRedGradeContract()
    {
        var config = RunnerJson.Read<ShadowCompareConfig>(RepoPath("docs", "v5.4", "reconciliation-correction-shadow-compare.config.json"));

        Assert.AreEqual("reconciliation-correction-center", config.Name);
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "bank_import");
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "manual_match");
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "correction_apply");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "import counts match expected");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "no PaymentConfirmed created by import");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "correction applies append-only");
        CollectionAssert.Contains(config.YellowRules!.ToArray(), "display-only mismatch");
        CollectionAssert.Contains(config.YellowRules!.ToArray(), "candidate score mismatch only");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "bank import created business fact");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "correction edited old entry");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "high-risk correction without approval");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "correction caused balance rebuild mismatch");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "shadow consumed by official projector");
    }

    [TestMethod]
    public void InvariantDefinitionsIncludeReconciliationCorrectionGuards()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "invariant-definitions.json")));
        var invariants = document.RootElement.GetProperty("invariants").EnumerateArray().ToArray();
        var byKey = invariants.ToDictionary(item => item.GetProperty("invariant_key").GetString()!, StringComparer.Ordinal);

        foreach (var key in RequiredInvariants)
        {
            Assert.IsTrue(byKey.TryGetValue(key, out var invariant), $"missing invariant {key}");
            Assert.AreEqual("blocking", invariant.GetProperty("mode").GetString(), $"{key} mode");
            Assert.AreEqual("P0", invariant.GetProperty("severity").GetString(), $"{key} severity");
            Assert.AreEqual("skeleton", invariant.GetProperty("source_type").GetString(), $"{key} source type");
            Assert.AreEqual("docs/v5.4/reconciliation-correction-cutover.config.json", invariant.GetProperty("check_ref").GetString(), $"{key} check_ref");
        }
    }

    [TestMethod]
    public async Task ReconciliationCorrectionInvariantSkeletonsPassArchitectureGuards()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-recon-correction-cutover-{Guid.NewGuid():N}"));
        try
        {
            var definitionsPath = Path.Combine(temp.FullName, "invariants.json");
            var outputPath = Path.Combine(temp.FullName, "out.json");
            RunnerJson.Write(definitionsPath, new InvariantDefinitionFile(
                RequiredInvariants.Select(key => new InvariantDefinition(
                    key,
                    key,
                    "blocking",
                    "P0",
                    "skeleton",
                    null,
                    "reconciliation-correction-cutover")).ToArray()));

            var results = await InvariantRunner.Run(RunnerOptions.Parse(new[]
            {
                "--dry-run=true",
                $"--definitions={definitionsPath}",
                $"--out={outputPath}"
            }));

            Assert.AreEqual(RequiredInvariants.Length, results.Count);
            foreach (var result in results)
            {
                Assert.AreEqual("passed", result.Status, result.InvariantKey);
                Assert.AreEqual(0, result.ViolationCount, result.InvariantKey);
            }
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public async Task ReconciliationCorrectionShadowCompareSkeletonGeneratesGreenReportWithGradeContract()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-recon-correction-shadow-{Guid.NewGuid():N}"));
        try
        {
            var outputPath = Path.Combine(temp.FullName, "shadow.json");
            var report = await ShadowCompareRunner.Run(RunnerOptions.Parse(new[]
            {
                "--dry-run=true",
                "--mode=skeleton",
                "--releaseId=release-mr-09",
                "--mrId=MR-09",
                "--tenantId=test-tenant",
                "--sliceId=Reconciliation",
                "--config=docs/v5.4/reconciliation-correction-shadow-compare.config.json",
                $"--out={outputPath}"
            }));

            Assert.AreEqual("green", report.Grade);
            Assert.AreEqual("scr-v54-reconciliation-correction-center", report.ShadowCompareReportId);
            Assert.AreEqual("Reconciliation", report.SliceId);
            Assert.IsTrue(report.CompareScope.ContainsKey("grade_rules"));
            Assert.IsTrue(File.Exists(outputPath));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void RedReconciliationCorrectionShadowReportBlocksActiveGateDecision()
    {
        var decision = GateDecisionCalculator.Calculate(new GateDecisionInput(
            [Invariant("inv-recon-pass", "bank.import_does_not_create_payment_fact", "blocking", "P0", "passed")],
            [ShadowReport("red")],
            ["finance-signoff"],
            new HashSet<string>(),
            RequireBusinessSignoff: true));

        Assert.AreEqual("blocked", decision.Status);
        Assert.AreEqual("P0", decision.Severity);
        Assert.IsTrue(decision.NoGoItems.Any(item => item.Contains("scr-v54-reconciliation-correction-center-red", StringComparison.Ordinal)));
    }

    [TestMethod]
    public void Mr09ReleaseEvidencePackageIsLinkedAndMachineGenerated()
    {
        using var manifest = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-09-release-manifest.json")));
        using var gate = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-09-gate-result.json")));
        using var rollback = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-09-rollback-instruction.json")));
        using var compensation = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-09-compensation-instruction.json")));
        using var shadow = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-09-shadow-compare-report.json")));

        Assert.AreEqual("release-mr-09", manifest.RootElement.GetProperty("release_id").GetString());
        Assert.AreEqual("MR-09", manifest.RootElement.GetProperty("mr_id").GetString());
        Assert.AreEqual("gate-mr-09-reconciliation-correction", manifest.RootElement.GetProperty("gate_result_id").GetString());
        Assert.AreEqual(manifest.RootElement.GetProperty("gate_result_id").GetString(), gate.RootElement.GetProperty("gate_result_id").GetString());
        Assert.AreEqual("gate-runner", gate.RootElement.GetProperty("generated_by").GetString());
        Assert.AreEqual("passed", gate.RootElement.GetProperty("status").GetString());
        Assert.AreEqual("green", shadow.RootElement.GetProperty("grade").GetString());
        Assert.AreEqual("rollback", rollback.RootElement.GetProperty("instruction_type").GetString());
        Assert.AreEqual("runtime_mode", rollback.RootElement.GetProperty("rollback_kind").GetString());
        Assert.AreEqual("compensating", compensation.RootElement.GetProperty("instruction_type").GetString());
        Assert.AreEqual("business_correction", compensation.RootElement.GetProperty("rollback_kind").GetString());

        var rollbackForbidden = rollback.RootElement.GetProperty("scope").GetProperty("forbidden_actions").EnumerateArray().Select(item => item.GetString()).ToArray();
        var compensationForbidden = compensation.RootElement.GetProperty("scope").GetProperty("forbidden_actions").EnumerateArray().Select(item => item.GetString()).ToArray();
        CollectionAssert.Contains(rollbackForbidden, "SQL edit old ledger entry");
        CollectionAssert.Contains(rollbackForbidden, "create PaymentConfirmed from bank import");
        CollectionAssert.Contains(compensationForbidden, "edit original ledger entry");
        CollectionAssert.Contains(compensationForbidden, "delete original correction");
    }

    private static InvariantCheckEvidence Invariant(string id, string key, string mode, string severity, string status)
    {
        return new InvariantCheckEvidence(
            id,
            "release-mr-09",
            "test-tenant",
            "Reconciliation",
            key,
            key,
            mode,
            severity,
            "skeleton",
            null,
            "docs/v5.4/reconciliation-correction-cutover.config.json",
            status,
            new Dictionary<string, object>(),
            new Dictionary<string, object>(),
            status == "passed" ? 0 : 1,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            "test",
            "ci-test",
            DateTimeOffset.UtcNow);
    }

    private static ShadowCompareEvidence ShadowReport(string grade)
    {
        return new ShadowCompareEvidence(
            $"scr-v54-reconciliation-correction-center-{grade}",
            "release-mr-09",
            "test-tenant",
            "Reconciliation",
            new Dictionary<string, object>
            {
                ["name"] = "reconciliation-correction-center",
                ["type"] = "count"
            },
            "legacy finance reconciliation and ledger correction workflow",
            "public.audit_events",
            "shadow_runtime.domain_events",
            DateTimeOffset.UtcNow,
            grade,
            0,
            0,
            grade == "green" ? 0 : 1,
            0,
            0,
            Array.Empty<IReadOnlyDictionary<string, object>>(),
            new Dictionary<string, object>(),
            "shadow-compare-runner",
            "ci-test");
    }

    private static string RepoRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return current!.FullName;
    }

    private static string RepoPath(params string[] segments)
    {
        return Path.Combine(new[] { RepoRoot() }.Concat(segments).ToArray());
    }
}
