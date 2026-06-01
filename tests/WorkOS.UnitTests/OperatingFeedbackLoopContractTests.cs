using System.Diagnostics;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OperatingFeedbackLoopContractTests
{
    private static readonly string[] RequiredMetrics =
    [
        "salableBedNightConversionEfficiency",
        "checkinProcessingDuration",
        "checkoutTurnoverDuration",
        "serviceTaskCompletionDuration",
        "unconfirmedPaymentAmount",
        "depositLiabilityAccuracy",
        "outstandingBalance",
        "reconciliationExceptionRate",
        "evidenceMissingRate",
        "duplicateConfirmRate",
        "blockedBedDays",
        "overdueTaskCount",
        "exceptionClosureRate",
        "slaAchievementRate",
        "periodActionCompletionRate"
    ];

    [TestMethod]
    public void MetricDeviationPolicyDefinesEveryOperatingMetricContract()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "operations", "metric-deviation-policy.yml")));
        var metrics = document.RootElement.GetProperty("metrics").EnumerateArray().ToArray();
        var metricIds = metrics.Select(item => item.GetProperty("metricId").GetString()).ToHashSet(StringComparer.Ordinal);

        foreach (var metricId in RequiredMetrics)
        {
            Assert.IsTrue(metricIds.Contains(metricId), $"Metric policy must include {metricId}.");
            var metric = metrics.Single(item => item.GetProperty("metricId").GetString() == metricId);
            foreach (var field in new[] { "source", "freshness", "owner", "stalePolicy", "correctionWorkItem", "freezePolicy", "deviationRiskSignal" })
            {
                Assert.IsFalse(string.IsNullOrWhiteSpace(metric.GetProperty(field).GetString()), $"{metricId} must define {field}.");
            }
        }
    }

    [TestMethod]
    public void RiskSignalPolicyDeclaresClosedLoopAssertions()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "operations", "risk-signal-policy.yml")));
        var root = document.RootElement;
        var assertions = root.GetProperty("closedLoopAssertions");

        foreach (var flag in new[] {
            "metricDeviationCreatesRiskSignal",
            "riskSignalCreatesWorkItem",
            "workItemHasOwnerSlaEscalation",
            "resolutionEventUpdatesLens",
            "periodReviewFreezesResult",
            "repeatedRiskLinksTrainingOrPolicy",
            "wrongMetricCreatesCorrectionWorkItem"
        })
        {
            Assert.IsTrue(assertions.GetProperty(flag).GetBoolean(), $"{flag} must be true.");
        }

        Assert.IsFalse(assertions.GetProperty("managementCockpitWritesBusinessFacts").GetBoolean());
        Assert.IsFalse(assertions.GetProperty("repairPartsHrProductionAllowed").GetBoolean());

        foreach (var signal in root.GetProperty("riskSignals").EnumerateArray())
        {
            foreach (var field in new[] { "owner", "sla", "escalation", "generatedWorkItemType", "resolutionEvent", "lensUpdate", "periodReview", "trainingUpdate", "policyUpdate" })
            {
                Assert.IsFalse(string.IsNullOrWhiteSpace(signal.GetProperty(field).GetString()), $"RiskSignal must define {field}.");
            }

            Assert.IsTrue(signal.GetProperty("correctionWorkItemRequired").GetBoolean());
        }
    }

    [TestMethod]
    public void OperatingFeedbackLoopCheckerSelfTestPasses()
    {
        var startInfo = new ProcessStartInfo("node", "scripts/check-operating-feedback-loop.mjs --self-test")
        {
            WorkingDirectory = RepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        using var process = Process.Start(startInfo);
        Assert.IsNotNull(process, "Could not start operating feedback loop self-test.");
        Assert.IsTrue(process!.WaitForExit(30000), "Operating feedback loop self-test timed out.");

        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        Assert.AreEqual(0, process.ExitCode, output + error);
        Assert.IsTrue(output.Contains("Operating Feedback Loop self-test: PASS", StringComparison.Ordinal), output + error);
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
