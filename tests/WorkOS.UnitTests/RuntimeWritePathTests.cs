using System.Diagnostics;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class RuntimeWritePathTests
{
    [TestMethod]
    public void runtime_write_path_guard_self_test_passes()
    {
        var result = RunNode("scripts/check-runtime-write-paths.mjs", "--self-test");

        Assert.AreEqual(0, result.ExitCode, result.Output);
        StringAssert.Contains(result.Output, "Runtime write path guard self-test: PASS");
    }

    [TestMethod]
    public void runtime_write_path_guard_passes_current_source()
    {
        var result = RunNode("scripts/check-runtime-write-paths.mjs");

        Assert.AreEqual(0, result.ExitCode, result.Output);
        StringAssert.Contains(result.Output, "Runtime write path guard: PASS");
    }

    private static ProcessResult RunNode(params string[] arguments)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "node",
            WorkingDirectory = RepositoryRoot(),
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
        return new ProcessResult(process.ExitCode, $"{output}{error}");
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "WorkOSNext.sln")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Could not locate repository root.");
    }

    private sealed record ProcessResult(int ExitCode, string Output);
}
