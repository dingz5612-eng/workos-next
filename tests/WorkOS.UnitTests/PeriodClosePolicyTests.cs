using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class PeriodClosePolicyTests
{
    [TestMethod]
    public void period_close_requires_finance_review()
    {
        var result = PeriodAnalyticsPolicy.Validate("periodClose", Request(new Dictionary<string, string>
        {
            ["scopeConfirmed"] = "true",
            ["metricsReviewed"] = "true",
            ["financeReviewed"] = "false",
            ["operationsDiagnosed"] = "true",
            ["businessSignoffCompleted"] = "true",
            ["noBlockingInvariantViolation"] = "true",
            ["actionPlanSkipped"] = "true"
        }));

        Assert.AreEqual(ConfirmStatus.Forbidden, result?.Status);
        Assert.AreEqual("period_close_requires_finance_review", result?.Reason);
    }

    [TestMethod]
    public void period_close_requires_business_signoff()
    {
        var result = PeriodAnalyticsPolicy.Validate("periodClose", Request(new Dictionary<string, string>
        {
            ["scopeConfirmed"] = "true",
            ["metricsReviewed"] = "true",
            ["financeReviewed"] = "true",
            ["operationsDiagnosed"] = "true",
            ["businessSignoffCompleted"] = "false",
            ["noBlockingInvariantViolation"] = "true",
            ["actionPlanSkipped"] = "true"
        }));

        Assert.AreEqual(ConfirmStatus.Forbidden, result?.Status);
        Assert.AreEqual("period_close_requires_business_signoff", result?.Reason);
    }

    [TestMethod]
    public void period_close_blocks_invariant_violation()
    {
        var result = PeriodAnalyticsPolicy.Validate("periodClose", Request(new Dictionary<string, string>
        {
            ["scopeConfirmed"] = "true",
            ["metricsReviewed"] = "true",
            ["financeReviewed"] = "true",
            ["operationsDiagnosed"] = "true",
            ["businessSignoffCompleted"] = "true",
            ["noBlockingInvariantViolation"] = "false",
            ["blockingInvariantViolationCount"] = "1",
            ["actionPlanSkipped"] = "true"
        }));

        Assert.AreEqual(ConfirmStatus.Forbidden, result?.Status);
        Assert.AreEqual("period_close_blocking_invariant_violation", result?.Reason);
    }

    [TestMethod]
    public void period_close_requires_committed_or_skipped_action_plan()
    {
        var result = PeriodAnalyticsPolicy.Validate("periodClose", Request(new Dictionary<string, string>
        {
            ["scopeConfirmed"] = "true",
            ["metricsReviewed"] = "true",
            ["financeReviewed"] = "true",
            ["operationsDiagnosed"] = "true",
            ["businessSignoffCompleted"] = "true",
            ["noBlockingInvariantViolation"] = "true",
            ["blockingIssueCount"] = "0",
            ["actionPlanCount"] = "0"
        }));

        Assert.AreEqual(ConfirmStatus.Forbidden, result?.Status);
        Assert.AreEqual("period_close_requires_action_plan_or_skip", result?.Reason);
    }

    private static ConfirmCardRequest Request(IReadOnlyDictionary<string, string> values) =>
        new("zh-CN", "period-close-policy-test", values, Array.Empty<string>());
}
