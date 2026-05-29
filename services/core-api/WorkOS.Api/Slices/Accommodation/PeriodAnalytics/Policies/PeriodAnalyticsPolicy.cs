using System.Globalization;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;

internal static class PeriodAnalyticsPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("periodFinanceReview", StringComparison.OrdinalIgnoreCase))
        {
            if (BoolValue(request, "depositReceivedIncludedInRevenue", "押金计入收入"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_deposit_revenue_forbidden", null);
            }

            if (BoolValue(request, "depositRefundIncludedInExpense", "押金退款计入支出"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_deposit_refund_expense_forbidden", null);
            }
        }

        if (cardId.Equals("periodClose", StringComparison.OrdinalIgnoreCase))
        {
            if (!BoolValue(request, "metricsReviewed", "指标已复核"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_metrics_review", null);
            }

            if (!BoolValue(request, "financeReviewed", "财务已复核"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_finance_review", null);
            }

            if (!BoolValue(request, "operationsDiagnosed", "运营已诊断"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_operations_diagnosis", null);
            }

            var blockingIssueCount = DecimalValue(request, "blockingIssueCount", "阻断问题数量", 0m);
            var actionPlanCount = DecimalValue(request, "actionPlanCount", "行动计划数量", 0m);
            if (blockingIssueCount > 0m && actionPlanCount <= 0m)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_action_plan_for_high_risk", null);
            }
        }

        return null;
    }

    private static bool BoolValue(ConfirmCardRequest request, string canonicalKey, string zhKey) =>
        Value(request, canonicalKey, Value(request, zhKey, "否")) switch
        {
            "true" or "True" or "TRUE" or "yes" or "Yes" or "YES" or "是" or "已复核" or "已诊断" => true,
            _ => false
        };

    private static string Value(ConfirmCardRequest request, string key, string defaultValue) =>
        request.FieldValues is not null &&
        request.FieldValues.TryGetValue(key, out var value) &&
        !string.IsNullOrWhiteSpace(value)
            ? value
            : defaultValue;

    private static decimal DecimalValue(ConfirmCardRequest request, string canonicalKey, string zhKey, decimal defaultValue)
    {
        var value = Value(request, canonicalKey, Value(request, zhKey, string.Empty));
        return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;
    }
}
