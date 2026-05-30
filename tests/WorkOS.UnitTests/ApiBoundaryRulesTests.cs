using System.Diagnostics;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ApiBoundaryRulesTests
{
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

    [TestMethod]
    public void OperationsApiAllowlistDeclaresPrimaryCompatibilityAndForbiddenRoutes()
    {
        using var allowlist = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "operations-api-allowlist.json")));
        var root = allowlist.RootElement;

        AssertArrayContains(root, "businessWriteAllowlist", "POST /api/operations/work-items/{workItemId}/confirm");
        AssertArrayContains(root, "operationsApiAllowlist", "POST /api/operations/cases");
        AssertArrayContains(root, "operationsApiAllowlist", "POST /api/operations/work-items/{workItemId}/confirm");
        AssertArrayContains(root, "compatibilityApiAllowlist", "POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm");
        AssertArrayContains(root, "forbiddenBusinessWritePatterns", "POST /api/payment/confirm");
        AssertArrayContains(root, "forbiddenBusinessWritePatterns", "POST /api/mobile/*/confirm");
    }

    [TestMethod]
    public void ApiBoundaryScriptContainsSimulatedForbiddenRouteSelfTest()
    {
        var script = File.ReadAllText(RepoPath("scripts", "check-api-boundaries.mjs"));
        Assert.IsTrue(script.Contains("--self-test"));
        Assert.IsTrue(script.Contains("simulated-forbidden.cs"));
        Assert.IsTrue(script.Contains("/api/payment/confirm"));
        Assert.IsTrue(script.Contains("simulated forbidden route was not detected"));
    }

    [TestMethod]
    public void ApiBoundarySelfTestDetectsSimulatedForbiddenRoute()
    {
        var startInfo = new ProcessStartInfo("node", "scripts/check-api-boundaries.mjs --self-test")
        {
            WorkingDirectory = RepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        using var process = Process.Start(startInfo);
        Assert.IsNotNull(process, "Could not start API boundary self-test.");
        Assert.IsTrue(process.WaitForExit(30000), "API boundary self-test timed out.");

        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        var combinedOutput = output + error;
        Assert.AreEqual(0, process.ExitCode, combinedOutput);
        Assert.IsTrue(output.Contains("API boundary self-test: PASS"), combinedOutput);
    }

    [TestMethod]
    public void NoPageSpecificCheckoutCloseApiIsExposed()
    {
        var program = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Program.cs"));
        var generatedPaths = File.ReadAllText(RepoPath("apps", "mobile", "src", "generated", "runtimeApiPaths.js"));
        var apiClient = File.ReadAllText(RepoPath("apps", "mobile", "src", "apiClient.js"));

        Assert.IsFalse(program.Contains("/api/checkout/close", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(generatedPaths.Contains("/api/checkout/close", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(apiClient.Contains("/api/checkout/close", StringComparison.OrdinalIgnoreCase));
    }

    private static void AssertArrayContains(JsonElement root, string propertyName, string expected)
    {
        var values = root.GetProperty(propertyName)
            .EnumerateArray()
            .Select(item => item.GetString())
            .ToHashSet(StringComparer.Ordinal);
        Assert.IsTrue(values.Contains(expected), $"{propertyName} must contain {expected}");
    }
}
