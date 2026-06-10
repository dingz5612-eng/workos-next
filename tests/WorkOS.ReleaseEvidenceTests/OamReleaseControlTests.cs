using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.ReleaseEvidenceTests;

[TestClass]
public sealed class OamReleaseControlTests
{
    [TestMethod]
    public void CurrentOamPurityCheckPasses()
    {
        var result = RunNode("scripts/oam/check-current-oam.mjs");

        Assert.AreEqual(0, result.ExitCode, result.Output);
        StringAssert.Contains(result.Output, "OAM purity check: PASS");
    }

    [TestMethod]
    public void ReleaseGovernanceIsDeclaredAsCurrentOamCapability()
    {
        using var contract = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "oam.current.json")));
        var capability = contract.RootElement.GetProperty("productCapabilities")
            .EnumerateArray()
            .FirstOrDefault(item => item.GetProperty("id").GetString() == "governance.release-control");

        Assert.AreNotEqual(JsonValueKind.Undefined, capability.ValueKind);
        Assert.AreEqual("identity", capability.GetProperty("module").GetString());
        Assert.IsTrue(capability.GetProperty("forbidden").EnumerateArray().Any(item => item.GetString() == "directBusinessFactWrite"));
    }

    [TestMethod]
    public void CiUsesOnlyCurrentOamCheckNames()
    {
        var workflow = File.ReadAllText(RepoPath(".github", "workflows", "ci.yml"));

        foreach (var required in new[]
        {
            "OAM purity check",
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
            string.Concat("O", "M", "A"),
            string.Concat("R", "T", "-"),
            string.Concat("attes", "tation"),
            string.Concat("evidence", " ", "phase")
        })
        {
            Assert.IsFalse(ContainsForbiddenToken(workflow, forbidden), $"{forbidden} must not appear in current CI.");
        }
    }

    [TestMethod]
    public void CiArtifactNameMatchesCurrentOamEvidenceContract()
    {
        var workflow = File.ReadAllText(RepoPath(".github", "workflows", "ci.yml"));
        var generator = File.ReadAllText(RepoPath("scripts", "oam", "generate-current-evidence-root.mjs"));
        var checker = File.ReadAllText(RepoPath("scripts", "oam", "check-current-evidence-root.mjs"));
        const string expectedArtifactName = "workosnext-current-oam-evidence-${{ github.run_id }}";

        StringAssert.Contains(workflow, $"name: {expectedArtifactName}");
        StringAssert.Contains(generator, $"artifactName = \"{expectedArtifactName}\"");
        StringAssert.Contains(checker, expectedArtifactName);
    }

    [TestMethod]
    public void CiAndLocalControlPlaneGateCoverCurrentOamCoreChecks()
    {
        var workflow = File.ReadAllText(RepoPath(".github", "workflows", "ci.yml"));
        var localGate = File.ReadAllText(RepoPath("scripts", "oam", "run-control-plane-checks.ps1"));
        foreach (var script in CurrentOamCoreCheckScripts())
        {
            StringAssert.Contains(workflow, script);
            StringAssert.Contains(localGate, script);
        }
    }

    [TestMethod]
    public void RepositoryDoesNotContainPreviousStageTokens()
    {
        var forbidden = new[]
        {
            string.Concat("R", "F", "6"),
            string.Concat("R", "F", "7"),
            string.Concat("W", "-", "R", "F", "7"),
            string.Concat("tenant", "-", "r", "f", "7")
        };

        foreach (var file in EnumerateRepositoryTextFiles())
        {
            var text = File.ReadAllText(file);
            foreach (var token in forbidden)
            {
                Assert.IsFalse(ContainsForbiddenToken(text, token), $"{RelativeToRepo(file)} must not contain previous stage token {token}.");
            }
        }
    }

    private static bool ContainsForbiddenToken(string text, string token)
    {
        if (token.All(char.IsLetterOrDigit))
        {
            return Regex.IsMatch(text, $@"\b{Regex.Escape(token)}\b", RegexOptions.IgnoreCase);
        }

        return text.Contains(token, StringComparison.OrdinalIgnoreCase);
    }

    private static IEnumerable<string> EnumerateRepositoryTextFiles()
    {
        var root = RepoRoot();
        var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".cs",
            ".js",
            ".mjs",
            ".json",
            ".yml",
            ".yaml",
            ".md",
            ".sql",
            ".ps1"
        };

        return Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Where(file => allowedExtensions.Contains(Path.GetExtension(file)))
            .Where(file => !RelativeToRepo(file).Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                .Any(segment => segment is ".git" or ".tmp" or ".codex-run" or ".codex-runtime" or "node_modules" or "bin" or "obj" or "dist" or "TestResults"))
            .Where(file => !RelativeToRepo(file).Replace('\\', '/').StartsWith("artifacts/oam/test-results/", StringComparison.OrdinalIgnoreCase))
            .Where(file => !RelativeToRepo(file).Replace('\\', '/').StartsWith("artifacts/oam/checks/", StringComparison.OrdinalIgnoreCase));
    }

    private static string RelativeToRepo(string file) =>
        Path.GetRelativePath(RepoRoot(), file);

    private static IReadOnlyList<string> CurrentOamCoreCheckScripts() =>
        new[]
        {
            "scripts/oam/check-current-oam.mjs",
            "scripts/oam/check-system-operating-kernel.mjs",
            "scripts/oam/check-oam-kernel-graph.mjs",
            "scripts/oam/check-file-lifecycle-policy.mjs",
            "scripts/oam/check-retired-reference-blocker.mjs",
            "scripts/oam/generate-system-derived-contracts.mjs",
            "scripts/oam/check-derived-contract-consistency.mjs",
            "scripts/oam/check-system-handoff-contract.mjs",
            "scripts/oam/check-system-failure-routing-contract.mjs",
            "scripts/validate-contracts.mjs",
            "scripts/check-rule-authority.mjs",
            "scripts/check-local-path-references.mjs",
            "scripts/check-api-boundaries.mjs",
            "scripts/check-runtime-write-paths.mjs",
            "scripts/check-policy-as-code.mjs",
            "scripts/check-domain-packs.mjs",
            "scripts/check-truth-owners.mjs",
            "scripts/check-finance-truth.mjs",
            "scripts/check-ledger-semantic-rules.mjs",
            "scripts/finance/check-finance-semantic-truth.mjs",
            "scripts/check-shared-governance-boundary.mjs",
            "scripts/check-dormitory-golden-domain.mjs",
            "scripts/check-language-kernel.mjs",
            "scripts/check-search-kernel.mjs",
            "scripts/check-admission-kernel.mjs",
            "scripts/check-account-actor-kernel.mjs"
        };

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
