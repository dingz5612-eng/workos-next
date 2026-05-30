using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class CheckoutServiceCutoverGuardTests
{
    private static readonly string[] RequiredFeatureFlags =
    [
        "checkout.start.enabled",
        "checkout.room_inspection.enabled",
        "checkout.damage_assessment.enabled",
        "service_task.enabled",
        "service_task.verify.enabled",
        "blocker_engine.enabled",
        "case_closure_policy.enabled",
        "claim_sla_lite.enabled"
    ];

    private static readonly string[] RequiredSlices =
    [
        "CheckoutSettlement",
        "ServiceTask",
        "BlockerEngine"
    ];

    private static readonly string[] RequiredInvariants =
    [
        "case.closed_has_no_open_blocker",
        "case.close_requires_closure_policy",
        "blocker.no_duplicate_open_resolution",
        "service.cannot_directly_change_bed_status",
        "checkout.cannot_directly_write_deposit_entry",
        "checkout.cleaning_required_before_release"
    ];

    [TestMethod]
    public void CheckoutServiceCutoverConfigDeclaresFlagsSlicesDependenciesAndPilotScope()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "checkout-service-cutover.config.json")));
        var root = document.RootElement;

        var flags = root.GetProperty("feature_flags").EnumerateArray().ToArray();
        CollectionAssert.AreEquivalent(
            RequiredFeatureFlags,
            flags.Select(flag => flag.GetProperty("flag_key").GetString()).ToArray());

        foreach (var flag in flags)
        {
            var scope = flag.GetProperty("scope_rules");
            Assert.IsTrue(scope.TryGetProperty("tenantIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing tenantIds scope");
            Assert.IsTrue(scope.TryGetProperty("sliceIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing sliceIds scope");
            Assert.IsTrue(scope.TryGetProperty("roles", out _), $"{flag.GetProperty("flag_key").GetString()} missing roles scope");
            Assert.IsTrue(scope.TryGetProperty("actorIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing actorIds scope");
            Assert.IsTrue(scope.TryGetProperty("deviceIds", out _), $"{flag.GetProperty("flag_key").GetString()} missing deviceIds scope");
            Assert.IsTrue(scope.TryGetProperty("deviceTrust", out _), $"{flag.GetProperty("flag_key").GetString()} missing deviceTrust scope");
            Assert.IsTrue(scope.TryGetProperty("amount", out _), $"{flag.GetProperty("flag_key").GetString()} missing amount scope");
            Assert.IsTrue(scope.TryGetProperty("percentage", out _), $"{flag.GetProperty("flag_key").GetString()} missing percentage scope");
        }

        var cutovers = root.GetProperty("slice_cutover_states").EnumerateArray().ToArray();
        CollectionAssert.AreEquivalent(
            RequiredSlices,
            cutovers.Select(cutover => cutover.GetProperty("slice_id").GetString()).ToArray());

        foreach (var cutover in cutovers)
        {
            Assert.AreEqual("shadow", cutover.GetProperty("runtime_mode").GetString());
            var dependencies = cutover.GetProperty("dependency_status");
            foreach (var dependency in new[] { "ResourceInventory", "StayLifecycle", "PaymentLedger", "DepositLedger", "StayBalanceProjection", "EvidenceSecureSubstrate", "ClaimSkeleton" })
            {
                Assert.IsTrue(dependencies.TryGetProperty(dependency, out _), $"{cutover.GetProperty("slice_id").GetString()} missing dependency {dependency}");
            }

            var pilotRoles = cutover.GetProperty("pilot_scope").GetProperty("roles").EnumerateArray().Select(item => item.GetString()).ToHashSet();
            foreach (var role in new[] { "manager", "operator", "cleaner", "finance" })
            {
                Assert.IsTrue(pilotRoles.Contains(role), $"{cutover.GetProperty("slice_id").GetString()} pilot missing role {role}");
            }

            Assert.IsTrue(cutover.GetProperty("pilot_scope").TryGetProperty("selectedRoomIds", out _));
            Assert.IsTrue(cutover.GetProperty("pilot_scope").TryGetProperty("selectedStayIds", out _));
        }
    }

    [TestMethod]
    public void CheckoutServiceShadowCompareConfigDeclaresGreenYellowRedGradeContract()
    {
        var config = RunnerJson.Read<ShadowCompareConfig>(RepoPath("docs", "v5.4", "checkout-service-shadow-compare.config.json"));

        Assert.AreEqual("checkout-service-blocker-engine", config.Name);
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "checkout_timeline");
        CollectionAssert.Contains(config.CompareScopes!.ToArray(), "case_blockers");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "expected WorkItems created");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "no direct DepositEntry write");
        CollectionAssert.Contains(config.GreenRules!.ToArray(), "no direct BedStatus write");
        CollectionAssert.Contains(config.YellowRules!.ToArray(), "timeline display mismatch");
        CollectionAssert.Contains(config.YellowRules!.ToArray(), "non-critical dueAt mismatch");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "Case closed with open blocker");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "duplicate blockers");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "service directly changed BedStatus");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "checkout directly wrote DepositEntry");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "bed released before cleaning/service verified");
        CollectionAssert.Contains(config.RedRules!.ToArray(), "shadow consumed by official projector");
    }

    [TestMethod]
    public void InvariantDefinitionsIncludeCheckoutServiceBlockerGuards()
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
        }
    }

    [TestMethod]
    public async Task CheckoutServiceInvariantSkeletonsPassArchitectureGuards()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-checkout-service-cutover-{Guid.NewGuid():N}"));
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
                    "checkout-service-cutover")).ToArray()));

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
    public async Task CheckoutServiceShadowCompareSkeletonGeneratesGreenReportWithGradeContract()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-checkout-service-shadow-{Guid.NewGuid():N}"));
        try
        {
            var outputPath = Path.Combine(temp.FullName, "shadow.json");
            var report = await ShadowCompareRunner.Run(RunnerOptions.Parse(new[]
            {
                "--dry-run=true",
                "--mode=skeleton",
                "--releaseId=release-mr-08",
                "--mrId=MR-08",
                "--tenantId=test-tenant",
                "--sliceId=CheckoutSettlement",
                "--config=docs/v5.4/checkout-service-shadow-compare.config.json",
                $"--out={outputPath}"
            }));

            Assert.AreEqual("green", report.Grade);
            Assert.AreEqual("scr-v54-checkout-service-blocker-engine", report.ShadowCompareReportId);
            Assert.AreEqual("CheckoutSettlement", report.SliceId);
            Assert.IsTrue(report.CompareScope.ContainsKey("grade_rules"));
            Assert.IsTrue(File.Exists(outputPath));
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void Mr08ReleaseEvidencePackageIsLinkedAndAppendOnly()
    {
        using var manifest = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-08-release-manifest.json")));
        using var gate = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-08-gate-result.json")));
        using var rollback = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-08-rollback-instruction.json")));
        using var compensation = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-08-compensation-instruction.json")));
        using var shadow = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "mr-08-shadow-compare-report.json")));

        Assert.AreEqual("release-mr-08", manifest.RootElement.GetProperty("release_id").GetString());
        Assert.AreEqual("MR-08", manifest.RootElement.GetProperty("mr_id").GetString());
        Assert.AreEqual("gate-mr-08-checkout-service-blocker", manifest.RootElement.GetProperty("gate_result_id").GetString());
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
        foreach (var forbidden in new[] { "delete CheckoutCaseClosed event", "delete BedReleased event", "SQL update bed status" })
        {
            CollectionAssert.Contains(rollbackForbidden, forbidden);
            CollectionAssert.Contains(compensationForbidden, forbidden);
        }
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
