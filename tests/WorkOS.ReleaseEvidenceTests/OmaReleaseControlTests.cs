using System.Diagnostics;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.ReleaseEvidenceTests;

[TestClass]
public sealed class OmaReleaseControlTests
{
    [TestMethod]
    public void CurrentOmaPurityCheckPasses()
    {
        var result = RunNode("scripts/oma/check-current-oma.mjs");

        Assert.AreEqual(0, result.ExitCode, result.Output);
        StringAssert.Contains(result.Output, "OMA purity check: PASS");
    }

    [TestMethod]
    public void ReleaseGovernanceIsDeclaredAsCurrentOmaCapability()
    {
        using var contract = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "oma.current.json")));
        var capability = contract.RootElement.GetProperty("productCapabilities")
            .EnumerateArray()
            .FirstOrDefault(item => item.GetProperty("id").GetString() == "governance.release-control");

        Assert.AreNotEqual(JsonValueKind.Undefined, capability.ValueKind);
        Assert.AreEqual("identity", capability.GetProperty("module").GetString());
        Assert.IsTrue(capability.GetProperty("forbidden").EnumerateArray().Any(item => item.GetString() == "directBusinessFactWrite"));
    }

    [TestMethod]
    public void CiUsesOnlyCurrentOmaCheckNames()
    {
        var workflow = File.ReadAllText(RepoPath(".github", "workflows", "ci.yml"));

        foreach (var required in new[]
        {
            "OMA purity check",
            "Validate API boundaries",
            "Build mobile",
            "Backend unit tests",
            "Runtime contract tests"
        })
        {
            StringAssert.Contains(workflow, required);
        }

        foreach (var forbidden in new[]
        {
            string.Concat("v", "5", ".", "4"),
            string.Concat("v", "5", "_", "4"),
            string.Concat("v", "5", ".", "5"),
            string.Concat("v", "5", "_", "5"),
            string.Concat("O", "A", "M"),
            string.Concat("R", "T", "-"),
            string.Concat("attes", "tation"),
            string.Concat("evidence", " ", "phase")
        })
        {
            Assert.IsFalse(workflow.Contains(forbidden, StringComparison.OrdinalIgnoreCase), $"{forbidden} must not appear in current CI.");
        }
    }

    private static ProcessResult RunNode(params string[] arguments)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "node",
            WorkingDirectory = RepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Failed to start node.");
        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        process.WaitForExit();
        return new ProcessResult(process.ExitCode, output + error);
    }

    private static string RepoPath(params string[] segments)
    {
        return Path.Combine(new[] { RepoRoot() }.Concat(segments).ToArray());
    }

    private static string RepoRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        return current?.FullName ?? throw new InvalidOperationException("Could not locate repository root.");
    }

    private sealed record ProcessResult(int ExitCode, string Output);
}
