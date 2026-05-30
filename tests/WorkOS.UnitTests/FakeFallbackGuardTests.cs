using System.Diagnostics;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class FakeFallbackGuardTests
{
    [TestMethod]
    public void ProductionFakeFallbackCheckCatchesSimulatedBadLiteral()
    {
        var result = RunNode("scripts/check-no-production-fake-fallback.mjs", "--self-test");

        Assert.AreEqual(0, result.ExitCode, result.Output);
        StringAssert.Contains(result.Output, "self-test: PASS");
    }

    [TestMethod]
    public void ProductionPathsDoNotContainBannedFakeFallbackLiterals()
    {
        var result = RunNode("scripts/check-no-production-fake-fallback.mjs");

        Assert.AreEqual(0, result.ExitCode, result.Output);
        StringAssert.Contains(result.Output, "PASS");
        StringAssert.Contains(result.Output.Replace('\\', '/'), "apps/mobile/dist");
    }

    [TestMethod]
    public async Task StopBadFactsInvariantGeneratesRuntimeNoProductionDemoFallbackResult()
    {
        using var temp = new TempDirectory();
        var definitionsPath = Path.Combine(temp.Path, "invariant-definitions.json");
        var outputPath = Path.Combine(temp.Path, "invariant-results.json");
        File.WriteAllText(definitionsPath, """
        {
          "invariants": [
            {
              "invariant_key": "runtime.no_production_demo_fallback",
              "description": "Production runtime paths must not contain banned demo/fake business fallback literals.",
              "mode": "blocking",
              "severity": "P0",
              "source_type": "file+dist-scan",
              "check_sql": null,
              "check_ref": "scripts/check-no-production-fake-fallback.mjs (backend + apps/mobile/src + apps/mobile/dist)"
            }
          ]
        }
        """);

        var previousDirectory = Directory.GetCurrentDirectory();
        Directory.SetCurrentDirectory(FindRepoRoot());
        try
        {
            await InvariantRunner.Run(RunnerOptions.Parse([
                "--dry-run=true",
                $"--definitions={definitionsPath}",
                $"--out={outputPath}"
            ]));
        }
        finally
        {
            Directory.SetCurrentDirectory(previousDirectory);
        }

        var results = RunnerJson.Read<InvariantCheckEvidence[]>(outputPath);
        Assert.AreEqual(1, results.Length);
        Assert.AreEqual("runtime.no_production_demo_fallback", results[0].InvariantKey);
        Assert.IsTrue(results[0].Status is "passed" or "failed");
        Assert.AreEqual("blocking", results[0].Mode);
        Assert.AreEqual("P0", results[0].Severity);
        Assert.AreEqual("file+dist-scan", results[0].SourceType);
        Assert.AreEqual("invariant-runner", results[0].GeneratedBy);
    }

    private static CommandResult RunNode(params string[] arguments)
    {
        var startInfo = new ProcessStartInfo("node")
        {
            WorkingDirectory = FindRepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not start node.");
        process.WaitForExit(30000);
        return new CommandResult(process.ExitCode, process.StandardOutput.ReadToEnd() + process.StandardError.ReadToEnd());
    }

    private static string FindRepoRoot()
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "WorkOSNext.sln")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new InvalidOperationException("Could not locate WorkOSNext repository root.");
    }

    private sealed record CommandResult(int ExitCode, string Output);

    private sealed class TempDirectory : IDisposable
    {
        public string Path { get; } = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"workos-fake-fallback-{Guid.NewGuid():N}");

        public TempDirectory()
        {
            Directory.CreateDirectory(Path);
        }

        public void Dispose()
        {
            Directory.Delete(Path, recursive: true);
        }
    }
}
