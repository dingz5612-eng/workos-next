using System.Diagnostics;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ApiBoundaryRulesTests
{
    [TestMethod]
    public void OamContractDeclaresOnlyOneOrdinaryBusinessWriteRoute()
    {
        using var contract = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "oam.current.json")));
        var root = contract.RootElement;
        var boundary = root.GetProperty("apiBoundary");
        var writeRoutes = boundary.GetProperty("writeRoutes");

        Assert.AreEqual("POST /api/operations/work-items/{workItemId}/confirm", root.GetProperty("primaryWritePath").GetString());
        var businessRoutes = writeRoutes.GetProperty("businessConfirm").EnumerateArray().Select(item => item.GetString()).ToArray();
        CollectionAssert.AreEqual(
            new[] { "POST /api/operations/work-items/{workItemId}/confirm" },
            businessRoutes);

        foreach (var category in new[]
        {
            "prepareOnly",
            "workItemCreation",
            "identitySession",
            "accountGovernance",
            "evidenceObject",
            "reconciliationGovernance",
            "correctionCenter",
            "pcGovernance",
            "projectionMaintenance",
            "mobileAuxiliary",
            "behaviorEvent"
        })
        {
            Assert.IsTrue(writeRoutes.TryGetProperty(category, out var routes), $"{category} must be declared.");
            Assert.IsTrue(routes.ValueKind == JsonValueKind.Array, $"{category} must be an array.");
            Assert.IsTrue(boundary.GetProperty("routePolicies").TryGetProperty(category, out _), $"{category} must have a route policy.");
        }
    }

    [TestMethod]
    public void ApiBoundaryGuardSelfTestPasses()
    {
        var result = RunNode("scripts/check-api-boundaries.mjs", "--self-test");

        Assert.AreEqual(0, result.ExitCode, result.Output);
        StringAssert.Contains(result.Output, "API boundary self-test: PASS");
    }

    [TestMethod]
    public void ApiBoundaryScanWritesCurrentOamReport()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-api-boundary-{Guid.NewGuid():N}"));
        try
        {
            var reportPath = Path.Combine(temp.FullName, "api-boundary-check.json");
            var result = RunNode("scripts/check-api-boundaries.mjs", $"--out={reportPath}");

            Assert.AreEqual(0, result.ExitCode, result.Output);
            using var report = JsonDocument.Parse(File.ReadAllText(reportPath));
            var root = report.RootElement;

            Assert.AreEqual("oam.current.v1", root.GetProperty("version").GetString());
            Assert.AreEqual("passed", root.GetProperty("status").GetString());
            Assert.AreEqual(0, root.GetProperty("violation_count").GetInt32());
            Assert.AreEqual(0, root.GetProperty("unclassified_write_route_count").GetInt32());
            Assert.AreEqual(0, root.GetProperty("boundary_only_write_route_count").GetInt32());
            Assert.AreEqual(1, root.GetProperty("business_write_route_count").GetInt32());
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    [TestMethod]
    public void NoRetiredPageSpecificBusinessWriteApiIsExposed()
    {
        var source = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Program.cs"))
            + File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeEndpoints.cs"))
            + File.ReadAllText(RepoPath("apps", "mobile", "src", "generated", "runtimeApiPaths.js"))
            + File.ReadAllText(RepoPath("apps", "mobile", "src", "apiClient.js"));

        foreach (var forbidden in new[]
        {
            "/api/workspaces/{workspaceId}/cards/{cardId}/confirm",
            "/api/payment/confirm",
            "/api/checkout/close",
            "confirmCard(",
            "prepareCard("
        })
        {
            Assert.IsFalse(source.Contains(forbidden, StringComparison.OrdinalIgnoreCase), $"{forbidden} must stay retired.");
        }
    }

    [TestMethod]
    public void OperationsRuntimeRoutesAreRegisteredAdvertisedAndGenerated()
    {
        var program = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Program.cs"));
        var endpoints = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeEndpoints.cs"));
        var generatedPaths = File.ReadAllText(RepoPath("apps", "mobile", "src", "generated", "runtimeApiPaths.js"));
        var openApi = File.ReadAllText(RepoPath("docs", "contracts", "workos-runtime.openapi.json"));

        Assert.IsTrue(program.Contains("app.MapOperationsRuntimeEndpoints();", StringComparison.Ordinal));

        foreach (var route in new[]
        {
            "POST /api/operations/cases",
            "GET /api/operations/cases/{caseId}",
            "POST /api/operations/work-items",
            "GET /api/operations/work-items",
            "GET /api/operations/work-items/{workItemId}",
            "POST /api/operations/work-items/{workItemId}/prepare",
            "POST /api/operations/work-items/{workItemId}/confirm",
            "GET /api/operations/trace/submissions/{submissionId}",
            "GET /api/operations/trace/work-items/{workItemId}",
            "GET /api/operations/trace/cases/{caseId}"
        })
        {
            var path = route.Split(' ', 2)[1];
            Assert.IsTrue(endpoints.Contains($"\"{path}\"", StringComparison.Ordinal), $"Operations endpoints must map {route}");
            Assert.IsTrue(program.Contains(route, StringComparison.Ordinal), $"DemoBootstrap.runtimeApis must advertise {route}");
            Assert.IsTrue(openApi.Contains($"\"{path}\"", StringComparison.Ordinal), $"OpenAPI must document {route}");
        }

        foreach (var apiPathKey in new[] { "operationsCases", "operationsCase", "operationsWorkItems", "operationsWorkItem", "operationsPrepare", "operationsConfirm", "operationsTraceSubmission", "operationsTraceWorkItem", "operationsTraceCase" })
        {
            Assert.IsTrue(generatedPaths.Contains($"{apiPathKey}:", StringComparison.Ordinal), $"generated runtime API paths must include {apiPathKey}");
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
