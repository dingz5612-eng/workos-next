using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ContractGovernanceTests
{
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

    [TestMethod]
    public void OptionValuesAreStableEnumCodes()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "slice-manifest.json")));
        var manifestText = document.RootElement.ToString();
        Assert.IsFalse(manifestText.Contains("\"确认\""), "Contracts must not use localized labels as enum values.");
        Assert.IsFalse(manifestText.Contains("\"拒绝\""), "Contracts must not use localized labels as enum values.");
    }

    [TestMethod]
    public void RuntimeApiPathsAreGeneratedFromOpenApi()
    {
        var openApi = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "workos-runtime.openapi.json")));
        var generated = File.ReadAllText(RepoPath("apps", "mobile", "src", "generated", "runtimeApiPaths.js"));
        foreach (var path in openApi.RootElement.GetProperty("paths").EnumerateObject().Select(item => item.Name))
        {
            if (path == "/health" || path.StartsWith("/api/", StringComparison.Ordinal))
            {
                Assert.IsTrue(generated.Contains(path.Split('/').Last().Replace("-", ""), StringComparison.OrdinalIgnoreCase) ||
                    generated.Contains(path.Replace("{workspaceId}", "${workspaceId}").Replace("{cardId}", "${cardId}").Replace("{lensId}", "${lensId}")),
                    $"Generated runtime API paths should cover {path}");
            }
        }
    }

    [TestMethod]
    public void PolicyContractRegistersStableDecisionCodes()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "policy-contract.json")));
        var codes = document.RootElement.GetProperty("decisionCodes").EnumerateArray().Select(item => item.GetString()).ToHashSet();
        foreach (var code in new[] { "business_rule_violation", "idempotency_duplicate", "idempotency_conflict", "invalid_actor_token" })
        {
            Assert.IsTrue(codes.Contains(code), $"Policy contract must include {code}.");
        }
    }

    [TestMethod]
    public void ProductionSlicesDeclareRuntimeSurfacePolicy()
    {
        using var manifest = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "slice-manifest.json")));
        using var policyDocument = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "runtime-surface-policy.json")));
        var policies = policyDocument.RootElement.GetProperty("policies").EnumerateArray()
            .ToDictionary(item => item.GetProperty("sliceId").GetString()!);

        foreach (var slice in manifest.RootElement.GetProperty("slices").EnumerateArray().Where(item => item.GetProperty("status").GetString() == "production-slice"))
        {
            var sliceId = slice.GetProperty("id").GetString()!;
            var workspaceId = slice.GetProperty("workspaceId").GetString()!;
            Assert.IsTrue(policies.ContainsKey(sliceId), $"Production slice {sliceId} must declare RuntimeSurfacePolicy.");
            var policy = policies[sliceId];
            Assert.AreEqual(workspaceId, policy.GetProperty("workspaceId").GetString(), $"RuntimeSurfacePolicy workspace mismatch for {sliceId}.");
            Assert.IsTrue(policy.GetProperty("home").GetProperty("visible").GetBoolean() || !string.IsNullOrWhiteSpace(policy.GetProperty("hiddenReason").GetString()), $"{sliceId} must be home-visible or explicitly hidden.");
            Assert.IsTrue(policy.GetProperty("workbench").GetProperty("visible").GetBoolean() || !string.IsNullOrWhiteSpace(policy.GetProperty("hiddenReason").GetString()), $"{sliceId} must be workbench-visible or explicitly hidden.");
            Assert.IsTrue(policy.GetProperty("search").GetProperty("visible").GetBoolean() || !string.IsNullOrWhiteSpace(policy.GetProperty("hiddenReason").GetString()), $"{sliceId} must be search-visible or explicitly hidden.");
            Assert.IsTrue(policy.GetProperty("learning").GetProperty("visible").GetBoolean() || !string.IsNullOrWhiteSpace(policy.GetProperty("hiddenReason").GetString()), $"{sliceId} must be learning-visible or explicitly hidden.");
        }
    }

    [TestMethod]
    public void AuthoritativeLensesDeclareFreshnessAndSourceTables()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "accommodation-lens-contract.json")));
        var lenses = document.RootElement.GetProperty("lenses").EnumerateArray().ToDictionary(item => item.GetProperty("id").GetString()!);

        foreach (var lensId in new[] { "payment-risk", "checkout-queue", "service-task-queue", "risk-command", "period-performance", "room-revenue-potential", "lead-funnel" })
        {
            Assert.IsTrue(lenses.ContainsKey(lensId), $"Lens contract must include {lensId}.");
            var lens = lenses[lensId];
            Assert.IsTrue(lens.GetProperty("sourceOfTruthTables").GetArrayLength() > 0, $"{lensId} must declare source-of-truth tables.");
            Assert.AreEqual("projectionLagSeconds", lens.GetProperty("freshness").GetProperty("lagMetric").GetString(), $"{lensId} must declare projection lag metric.");
            Assert.IsFalse(string.IsNullOrWhiteSpace(lens.GetProperty("crossCheck").GetString()), $"{lensId} must declare a cross-check.");
        }
    }
}
