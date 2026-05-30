using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class PeriodRiskPcGovernanceCutoverGuardTests
{
    private static readonly string[] RequiredFeatureFlags =
    [
        "period.review.enabled",
        "period.finance_snapshot.enabled",
        "period.operation_snapshot.enabled",
        "period.close.enabled",
        "period.late_adjustment.enabled",
        "risk_command.enabled",
        "pc_governance_full.enabled",
        "admin.role_capability.enabled",
        "export.ledger.enabled"
    ];

    private static readonly string[] RequiredSlices =
    [
        "PeriodAnalytics",
        "RiskCommand",
        "PCGovernance"
    ];

    private static readonly string[] RequiredDependencies =
    [
        "PaymentLedger",
        "DepositLedger",
        "ResourceInventory",
        "StayLifecycle",
        "CheckoutSettlement",
        "ServiceTask",
        "BlockerEngine",
        "Reconciliation",
        "CorrectionCenter",
        "ExpenseLedgerStatus",
        "PCGovernanceAuth"
    ];

    private static readonly string[] RequiredPilotRoles =
    [
        "boss",
        "manager",
        "finance",
        "admin"
    ];

    private static readonly string[] RequiredInvariants =
    [
        "period.finance_snapshot_from_ledgers",
        "period.expense_not_integrated_not_zero",
        "period.close_freezes_snapshot",
        "period.late_adjustment_append_only",
        "risk.all_items_drill_down",
        "pc.export_has_audit"
    ];

    [TestMethod]
    public void PeriodRiskPcGovernanceCutoverConfigDeclaresFlagsSlicesDependenciesAndPilotScope()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "period-risk-pc-governance-cutover.config.json")));
        var root = document.RootElement;

        var flags = root.GetProperty("feature_flags").EnumerateArray().ToArray();
        CollectionAssert.AreEquivalent(
            RequiredFeatureFlags,
            flags.Select(flag => flag.GetProperty("flag_key").GetString()).ToArray());

        foreach (var flag in flags)
        {
            Assert.AreEqual("shadow", flag.GetProperty("status").GetString(), $"{flag.GetProperty("flag_key").GetString()} status");
            var scope = flag.GetProperty("scope_rules");
            foreach (var scopeKey in new[] { "tenantIds", "sliceIds", "roles", "actorIds", "deviceIds", "deviceTrust", "amount", "percentage" })
            {
                Assert.IsTrue(scope.TryGetProperty(scopeKey, out _), $"{flag.GetProperty("flag_key").GetString()} missing {scopeKey} scope");
            }

            Assert.AreEqual("KGS", scope.GetProperty("amount").GetProperty("currency").GetString());
            CollectionAssert.Contains(scope.GetProperty("deviceTrust").EnumerateArray().Select(item => item.GetString()).ToArray(), "trusted");
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

            Assert.AreEqual("active", dependencies.GetProperty("PaymentLedger").GetString());
            Assert.AreEqual("active", dependencies.GetProperty("DepositLedger").GetString());
            Assert.AreEqual("active", dependencies.GetProperty("ResourceInventory").GetString());
            Assert.AreEqual("active", dependencies.GetProperty("StayLifecycle").GetString());
            Assert.AreEqual("pilot_or_active", dependencies.GetProperty("Reconciliation").GetString());
            Assert.AreEqual("pilot_or_active", dependencies.GetProperty("CorrectionCenter").GetString());
            Assert.AreEqual("declared", dependencies.GetProperty("ExpenseLedgerStatus").GetString());
            Assert.AreEqual("ready", dependencies.GetProperty("PCGovernanceAuth").GetString());

            var pilot = cutover.GetProperty("pilot_scope");
            var roles = pilot.GetProperty("roles").EnumerateArray().Select(item => item.GetString()).ToArray();
            foreach (var role in RequiredPilotRoles)
            {
                CollectionAssert.Contains(roles, role, $"{cutover.GetProperty("slice_id").GetString()} pilot missing role {role}");
            }

            Assert.AreEqual("test-tenant", pilot.GetProperty("tenantIds").EnumerateArray().Single().GetString());
            Assert.AreEqual("trusted", pilot.GetProperty("deviceTrust").EnumerateArray().Single().GetString());
            Assert.AreEqual(31, pilot.GetProperty("period_range").GetProperty("max_days").GetInt32());
            Assert.IsFalse(pilot.GetProperty("export").GetProperty("enabled").GetBoolean());
            Assert.IsTrue(pilot.GetProperty("export").GetProperty("requires_audit").GetBoolean());
            CollectionAssert.Contains(pilot.GetProperty("export").GetProperty("allowed_roles").EnumerateArray().Select(item => item.GetString()).ToArray(), "admin");

            var routing = cutover.GetProperty("routing");
            foreach (var mode in new[] { "shadow", "pilot", "active", "rollback" })
            {
                Assert.IsTrue(routing.TryGetProperty(mode, out var route), $"{cutover.GetProperty("slice_id").GetString()} missing {mode} routing");
                Assert.IsFalse(string.IsNullOrWhiteSpace(route.GetString()), $"{cutover.GetProperty("slice_id").GetString()} {mode} routing");
            }
        }

        var active = root.GetProperty("active_policy");
        Assert.IsTrue(active.GetProperty("risk_command_official").GetBoolean());
        Assert.IsTrue(active.GetProperty("period_review_official").GetBoolean());
        Assert.IsTrue(active.GetProperty("pc_governance_available_by_role").GetBoolean());
        Assert.IsTrue(active.GetProperty("export_enabled_with_audit").GetBoolean());
        Assert.IsTrue(active.GetProperty("export_requires_reason").GetBoolean());
        Assert.IsTrue(active.GetProperty("export_download_url_expires").GetBoolean());
        Assert.IsTrue(active.GetProperty("high_risk_export_requires_trusted_pc").GetBoolean());

        var rollback = root.GetProperty("rollback_policy");
        Assert.AreEqual("disabled", rollback.GetProperty("PeriodAnalytics").GetString());
        Assert.AreEqual("previous_dashboard_or_limited_risks", rollback.GetProperty("RiskCommand").GetString());
        Assert.AreEqual("feature_flags_off", rollback.GetProperty("PCGovernance").GetString());
        Assert.IsFalse(rollback.GetProperty("delete_closed_period_snapshots").GetBoolean());
        Assert.AreEqual("LateAdjustment_or_correction_note", rollback.GetProperty("bad_snapshot_strategy").GetString());
    }

    [TestMethod]
    public void PeriodRiskPcGovernanceShadowCompareConfigDeclaresGreenYellowRedGradeContract()
    {
        var config = RunnerJson.Read<ShadowCompareConfig>(RepoPath("docs", "v5.4", "period-risk-pc-governance-shadow-compare.config.json"));

        Assert.AreEqual("period-risk-pc-governance", config.Name);
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "period_finance_snapshot");
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "period_operation_snapshot");
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "risk_command_items");
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "pc_governance_surface");
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "export_audit");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "snapshots generated from ledgers/lenses");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "all risk items drilldown");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "no user-filled finance facts");
        CollectionAssert.Contains(config.YellowRules!.ToArray(), "display-only mismatch");
        CollectionAssert.Contains(config.YellowRules!.ToArray(), "non-critical risk label mismatch");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "user-filled finance snapshot");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "expense missing displayed as zero");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "risk item without drilldown");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "period close overwrites snapshot");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "late adjustment updates original snapshot");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "shadow consumed by official projector");
    }

    [TestMethod]
    public void InvariantDefinitionsIncludePeriodRiskPcGovernanceGuards()
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
            Assert.AreEqual("docs/v5.4/period-risk-pc-governance-cutover.config.json", invariant.GetProperty("check_ref").GetString(), $"{key} check_ref");
        }
    }

    [TestMethod]
    public async Task PeriodRiskPcGovernanceInvariantSkeletonsPassArchitectureGuards()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-period-risk-pc-cutover-{Guid.NewGuid():N}"));
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
                    "period-risk-pc-governance-cutover")).ToArray()));

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
    public async Task PeriodRiskPcGovernanceShadowCompareSkeletonGeneratesGreenReportWithGradeContract()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-period-risk-pc-shadow-{Guid.NewGuid():N}"));
        try
        {
            var outputPath = Path.Combine(temp.FullName, "shadow.json");
            var report = await ShadowCompareRunner.Run(RunnerOptions.Parse(new[]
            {
                "--dry-run=true",
                "--mode=skeleton",
                "--releaseId=release-mr-10",
                "--mrId=MR-10",
                "--tenantId=test-tenant",
                "--sliceId=PeriodAnalytics",
                "--config=docs/v5.4/period-risk-pc-governance-shadow-compare.config.json",
                $"--out={outputPath}"
            }));

            Assert.AreEqual("green", report.Grade);
            Assert.AreEqual("scr-v54-period-risk-pc-governance", report.ShadowCompareReportId);
            Assert.AreEqual("PeriodAnalytics", report.SliceId);
            Assert.IsTrue(report.CompareScope.ContainsKey("grade_rules"));
            Assert.IsTrue(File.Exists(outputPath));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void RedPeriodRiskPcGovernanceShadowReportBlocksActiveGateDecision()
    {
        var decision = GateDecisionCalculator.Calculate(new GateDecisionInput(
            [Invariant("inv-period-pass", "period.finance_snapshot_from_ledgers", "blocking", "P0", "passed")],
            [ShadowReport("red")],
            ["business-signoff"],
            new HashSet<string>(),
            RequireBusinessSignoff: true));

        Assert.AreEqual("blocked", decision.Status);
        Assert.AreEqual("P0", decision.Severity);
        Assert.IsTrue(decision.NoGoItems.Any(item => item.Contains("scr-v54-period-risk-pc-governance-red", StringComparison.Ordinal)));
    }

    [TestMethod]
    public void Mr10ReleaseEvidencePackageIsLinkedAndMachineGenerated()
    {
        using var manifest = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-10-release-manifest.json")));
        using var gate = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-10-gate-result.json")));
        using var rollback = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-10-rollback-instruction.json")));
        using var compensation = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-10-compensation-instruction.json")));
        using var shadow = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-10-shadow-compare-report.json")));

        Assert.AreEqual("release-mr-10", manifest.RootElement.GetProperty("release_id").GetString());
        Assert.AreEqual("MR-10", manifest.RootElement.GetProperty("mr_id").GetString());
        Assert.AreEqual("gate-mr-10-period-risk-pc-governance", manifest.RootElement.GetProperty("gate_result_id").GetString());
        Assert.AreEqual(manifest.RootElement.GetProperty("gate_result_id").GetString(), gate.RootElement.GetProperty("gate_result_id").GetString());
        Assert.AreEqual("gate-runner", gate.RootElement.GetProperty("generated_by").GetString());
        Assert.AreEqual("passed", gate.RootElement.GetProperty("status").GetString());
        Assert.AreEqual("green", shadow.RootElement.GetProperty("grade").GetString());
        Assert.AreEqual("rollback", rollback.RootElement.GetProperty("instruction_type").GetString());
        Assert.AreEqual("runtime_mode", rollback.RootElement.GetProperty("rollback_kind").GetString());
        Assert.AreEqual("compensating", compensation.RootElement.GetProperty("instruction_type").GetString());
        Assert.AreEqual("business_correction", compensation.RootElement.GetProperty("rollback_kind").GetString());

        var rollbackSlices = rollback.RootElement.GetProperty("scope").GetProperty("slices").EnumerateArray().Select(item => item.GetString()).ToArray();
        CollectionAssert.Contains(rollbackSlices, "PeriodAnalytics");
        CollectionAssert.Contains(rollbackSlices, "RiskCommand");
        CollectionAssert.Contains(rollbackSlices, "PCGovernance");

        var compensationActions = compensation.RootElement.GetProperty("scope").GetProperty("compensating_actions").EnumerateArray().Select(item => item.GetString()).ToArray();
        CollectionAssert.Contains(compensationActions, "PeriodLateAdjustmentRecorded");
        CollectionAssert.Contains(compensationActions, "Correction note");
        CollectionAssert.Contains(compensationActions, "Risk item re-generation");

        var rollbackForbidden = rollback.RootElement.GetProperty("scope").GetProperty("forbidden_actions").EnumerateArray().Select(item => item.GetString()).ToArray();
        var compensationForbidden = compensation.RootElement.GetProperty("scope").GetProperty("forbidden_actions").EnumerateArray().Select(item => item.GetString()).ToArray();
        CollectionAssert.Contains(rollbackForbidden, "delete closed period snapshot");
        CollectionAssert.Contains(rollbackForbidden, "delete export audit");
        CollectionAssert.Contains(compensationForbidden, "edit original closed period snapshot");
        CollectionAssert.Contains(compensationForbidden, "delete export audit");
    }

    private static InvariantCheckEvidence Invariant(string id, string key, string mode, string severity, string status)
    {
        return new InvariantCheckEvidence(
            id,
            "release-mr-10",
            "test-tenant",
            "PeriodAnalytics",
            key,
            key,
            mode,
            severity,
            "skeleton",
            null,
            "docs/v5.4/period-risk-pc-governance-cutover.config.json",
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
            $"scr-v54-period-risk-pc-governance-{grade}",
            "release-mr-10",
            "test-tenant",
            "PeriodAnalytics",
            new Dictionary<string, object>
            {
                ["name"] = "period-risk-pc-governance",
                ["type"] = "count"
            },
            "previous dashboard, limited risk surface, and legacy governance review workflow",
            "public.audit_events",
            "shadow_runtime.lens_snapshots",
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
