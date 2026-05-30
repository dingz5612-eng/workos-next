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
    public void OperationsApiAllowlistDeclaresV2ClassifiedWriteRoutes()
    {
        using var allowlist = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "operations-api-allowlist.json")));
        var root = allowlist.RootElement;

        Assert.AreEqual(2, root.GetProperty("version").GetInt32());
        AssertArrayRouteContains(root, "businessWriteAllowlist", "POST /api/operations/work-items/{workItemId}/confirm");
        AssertArrayRouteContains(root, "operationsRuntimeWriteAllowlist", "POST /api/operations/cases");
        AssertArrayRouteContains(root, "operationsRuntimeWriteAllowlist", "POST /api/operations/work-items/{workItemId}/prepare");
        AssertArrayRouteContains(root, "compatibilityWriteAllowlist", "POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm");
        AssertArrayRouteContains(root, "evidenceFileWriteAllowlist", "POST /api/evidence/{evidenceId}/attachments");
        AssertArrayRouteContains(root, "authDeviceWriteAllowlist", "POST /api/auth/login");
        AssertArrayRouteContains(root, "mobileExperienceWriteAllowlist", "POST /api/mobile/drafts");
        AssertArrayRouteContains(root, "behaviorEventWriteAllowlist", "POST /api/behavior-events");
        AssertArrayContains(root, "forbiddenBusinessWritePatterns", "POST /api/payment/confirm");
        AssertArrayContains(root, "forbiddenBusinessWritePatterns", "POST /api/mobile/*/confirm");
    }

    [TestMethod]
    public void GovernanceWriteAllowlistDeclaresRequiredGuards()
    {
        using var allowlist = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "v5.4", "operations-api-allowlist.json")));
        var root = allowlist.RootElement;

        var reconciliation = FindRouteEntry(root, "governanceWriteAllowlist", "POST /api/reconciliation/match-candidates/{candidateId}/accept");
        Assert.IsNotNull(reconciliation, "governanceWriteAllowlist must classify reconciliation accept");
        Assert.AreEqual(false, reconciliation.Value.GetProperty("writesBusinessFacts").GetBoolean());
        Assert.AreEqual(false, reconciliation.Value.GetProperty("usesOperationsConfirm").GetBoolean());
        Assert.AreEqual(true, reconciliation.Value.GetProperty("writesOnlyControlGovernanceOrProvisionalRecords").GetBoolean());
        Assert.AreEqual(true, reconciliation.Value.GetProperty("appendOnly").GetBoolean());

        var correctionApply = FindRouteEntry(root, "governanceWriteAllowlist", "POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/apply");
        Assert.IsNotNull(correctionApply, "governanceWriteAllowlist must classify correction apply");
        Assert.AreEqual(true, correctionApply.Value.GetProperty("writesBusinessFacts").GetBoolean());
        Assert.AreEqual(false, correctionApply.Value.GetProperty("usesOperationsConfirm").GetBoolean());
        Assert.AreEqual(false, correctionApply.Value.GetProperty("writesOnlyControlGovernanceOrProvisionalRecords").GetBoolean());
        Assert.AreEqual(true, correctionApply.Value.GetProperty("appendOnly").GetBoolean());
        Assert.AreEqual(true, correctionApply.Value.GetProperty("appendOnlyCorrectionService").GetBoolean());
        Assert.IsTrue(correctionApply.Value.GetProperty("invariantEvidence").EnumerateArray().Any());
    }

    [TestMethod]
    public void ApiBoundaryScriptContainsV2ClassifierSelfTests()
    {
        var script = File.ReadAllText(RepoPath("scripts", "check-api-boundaries.mjs"));
        Assert.IsTrue(script.Contains("self-test"));
        Assert.IsTrue(script.Contains("simulated-payment-forbidden.cs"));
        Assert.IsTrue(script.Contains("simulated-reconciliation-unclassified.cs"));
        Assert.IsTrue(script.Contains("simulated-correction-unclassified.cs"));
        Assert.IsTrue(script.Contains("simulated-operations-confirm.cs"));
        Assert.IsTrue(script.Contains("simulated-evidence-attachment.cs"));
        Assert.IsTrue(script.Contains("/api/payment/confirm"));
        Assert.IsTrue(script.Contains("/api/reconciliation/match-candidates/{id}/accept"));
        Assert.IsTrue(script.Contains("/api/correction-center/ledger-correction-requests/{correctionRequestId}/apply"));
        Assert.IsTrue(script.Contains("/api/operations/work-items/{workItemId}/confirm"));
        Assert.IsTrue(script.Contains("/api/evidence/{evidenceId}/attachments"));
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
    public void ApiBoundaryScanWritesV2JsonReport()
    {
        var temp = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"workos-api-boundary-{Guid.NewGuid():N}"));
        try
        {
            var reportPath = Path.Combine(temp.FullName, "api-boundary-check-v2.json");
            var startInfo = new ProcessStartInfo("node")
            {
                WorkingDirectory = RepoRoot(),
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            startInfo.ArgumentList.Add("scripts/check-api-boundaries.mjs");
            startInfo.ArgumentList.Add($"--out={reportPath}");

            using var process = Process.Start(startInfo);
            Assert.IsNotNull(process, "Could not start API boundary scan.");
            Assert.IsTrue(process!.WaitForExit(30000), "API boundary scan timed out.");

            var output = process.StandardOutput.ReadToEnd();
            var error = process.StandardError.ReadToEnd();
            Assert.AreEqual(0, process.ExitCode, output + error);

            using var report = JsonDocument.Parse(File.ReadAllText(reportPath));
            var root = report.RootElement;
            Assert.AreEqual(2, root.GetProperty("version").GetInt32());
            Assert.AreEqual("passed", root.GetProperty("status").GetString());
            Assert.AreEqual(0, root.GetProperty("violation_count").GetInt32());
            Assert.AreEqual(0, root.GetProperty("unclassified_write_route_count").GetInt32());
            Assert.AreEqual(0, root.GetProperty("multi_classified_write_route_count").GetInt32());
            Assert.IsTrue(root.GetProperty("write_route_count").GetInt32() > 0);
        }
        finally
        {
            temp.Delete(recursive: true);
        }
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
            "POST /api/operations/work-items/{workItemId}/confirm"
        })
        {
            var path = route.Split(' ', 2)[1];
            Assert.IsTrue(endpoints.Contains($"\"{path}\"", StringComparison.Ordinal), $"Operations endpoints must map {route}");
            Assert.IsTrue(program.Contains(route, StringComparison.Ordinal), $"DemoBootstrap.runtimeApis must advertise {route}");
            Assert.IsTrue(openApi.Contains($"\"{path}\"", StringComparison.Ordinal), $"OpenAPI must document {route}");
        }

        foreach (var apiPathKey in new[] { "operationsCases", "operationsCase", "operationsWorkItems", "operationsWorkItem", "operationsPrepare", "operationsConfirm" })
        {
            Assert.IsTrue(generatedPaths.Contains($"{apiPathKey}:", StringComparison.Ordinal), $"generated runtime API paths must include {apiPathKey}");
        }
    }

    private static JsonElement? FindRouteEntry(JsonElement root, string propertyName, string expected)
    {
        foreach (var item in root.GetProperty(propertyName).EnumerateArray())
        {
            var route = item.ValueKind == JsonValueKind.String
                ? item.GetString()
                : item.GetProperty("route").GetString();
            if (string.Equals(route, expected, StringComparison.Ordinal))
            {
                return item;
            }
        }

        return null;
    }

    private static void AssertArrayRouteContains(JsonElement root, string propertyName, string expected)
    {
        Assert.IsNotNull(FindRouteEntry(root, propertyName, expected), $"{propertyName} must contain {expected}");
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
