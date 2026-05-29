using System.Globalization;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;

internal static class PeriodAnalyticsPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("periodFinanceReview", StringComparison.OrdinalIgnoreCase))
        {
            if (BoolValue(request, "depositReceivedIncludedInRevenue"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_deposit_revenue_forbidden", null);
            }

            if (BoolValue(request, "depositRefundIncludedInExpense"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_deposit_refund_expense_forbidden", null);
            }
        }

        if (cardId.Equals("periodClose", StringComparison.OrdinalIgnoreCase))
        {
            if (!BoolValue(request, "metricsReviewed"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_metrics_review", null);
            }

            if (!BoolValue(request, "financeReviewed"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_finance_review", null);
            }

            if (!BoolValue(request, "operationsDiagnosed"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_operations_diagnosis", null);
            }

            var blockingIssueCount = DecimalValue(request, "blockingIssueCount", 0m);
            var actionPlanCount = DecimalValue(request, "actionPlanCount", 0m);
            if (blockingIssueCount > 0m && actionPlanCount <= 0m)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_action_plan_for_high_risk", null);
            }
        }

        return null;
    }

    private static bool BoolValue(ConfirmCardRequest request, string canonicalKey) =>
        Value(request, canonicalKey, "false") switch
        {
            "true" or "True" or "TRUE" or "yes" or "Yes" or "YES" or "是" or "已复核" or "已诊断" => true,
            _ => false
        };

    private static string Value(ConfirmCardRequest request, string key, string defaultValue) =>
        request.FieldValues is not null
            ? RuntimeFieldAliases.Value(request.FieldValues, key, defaultValue)
            : defaultValue;

    private static decimal DecimalValue(ConfirmCardRequest request, string canonicalKey, decimal defaultValue)
    {
        var value = Value(request, canonicalKey, string.Empty);
        return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;
    }
}
