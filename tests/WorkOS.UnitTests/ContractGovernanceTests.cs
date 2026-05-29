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
}
