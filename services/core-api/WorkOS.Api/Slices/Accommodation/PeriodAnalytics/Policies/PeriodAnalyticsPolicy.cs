using System.Globalization;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Policies;

internal static class PeriodAnalyticsPolicy
{
    private static readonly HashSet<string> UserSuppliedFinanceAmountFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "rentRevenue",
        "otherRevenue",
        "ordinaryPaymentReceived",
        "ordinaryPaymentConfirmed",
        "ordinaryPaymentAllocated",
        "confirmedPaymentAmount",
        "pendingPaymentAmount",
        "depositReceivedAmount",
        "depositRefundedAmount",
        "depositRefundPaid",
        "depositDeductedAmount",
        "depositAppliedToBalanceAmount",
        "depositLiabilityStart",
        "depositLiabilityEnd",
        "approvedExpenseAmount",
        "pendingExpenseAmount",
        "periodNetCashFlow",
        "endingDebtAmount",
        "outstandingDebt",
        "financeExceptionCount",
        "cashHandoverPending",
        "reconciliationMismatchCount",
        "correctionPendingCount"
    };

    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (cardId.Equals("periodFinanceReview", StringComparison.OrdinalIgnoreCase))
        {
            var userSuppliedAmount = FirstUserSuppliedFinanceAmount(request);
            if (userSuppliedAmount is not null)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, $"period_finance_snapshot_user_input_forbidden:{userSuppliedAmount}", null);
            }

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
            if (!BoolValue(request, "scopeConfirmed"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_scope_confirmed", null);
            }

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

            if (!BoolValue(request, "noBlockingInvariantViolation") ||
                DecimalValue(request, "blockingInvariantViolationCount", 0m) > 0m)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_blocking_invariant_violation", null);
            }

            if (!BoolValue(request, "businessSignoffCompleted"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_business_signoff", null);
            }

            var blockingIssueCount = DecimalValue(request, "blockingIssueCount", 0m);
            var actionPlanCount = DecimalValue(request, "actionPlanCount", 0m);
            var actionPlanCommitted = BoolValue(request, "actionPlanCommitted") || actionPlanCount > 0m;
            var actionPlanSkipped = BoolValue(request, "actionPlanSkipped");
            if (blockingIssueCount > 0m && !actionPlanCommitted && !actionPlanSkipped)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_action_plan_for_high_risk", null);
            }

            if (!actionPlanCommitted && !actionPlanSkipped)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_close_requires_action_plan_or_skip", null);
            }
        }

        if (cardId.Equals("periodActionPlan", StringComparison.OrdinalIgnoreCase))
        {
            if (Value(request, "actionStatus", string.Empty).Equals("completed", StringComparison.OrdinalIgnoreCase) ||
                !string.IsNullOrWhiteSpace(Value(request, "completionResult", string.Empty)))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_action_plan_commit_cannot_complete", null);
            }

            if (string.IsNullOrWhiteSpace(Value(request, "ownerRole", Value(request, "ownerName", string.Empty))))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_action_plan_owner_role_required", null);
            }

            if (string.IsNullOrWhiteSpace(Value(request, "dueAtUtc", Value(request, "dueAt", string.Empty))))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_action_plan_due_at_required", null);
            }

            if (string.IsNullOrWhiteSpace(Value(request, "priority", string.Empty)))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "period_action_plan_priority_required", null);
            }
        }

        if (cardId.Equals("periodActionPlanComplete", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(Value(request, "actionPlanWorkItemId", Value(request, "workItemId", string.Empty))))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "period_action_plan_completion_requires_work_item_confirm", null);
        }

        return null;
    }

    private static string? FirstUserSuppliedFinanceAmount(ConfirmCardRequest request)
    {
        if (request.FieldValues is null)
        {
            return null;
        }

        foreach (var (key, value) in request.FieldValues)
        {
            var canonicalKey = RuntimeFieldAliases.CanonicalKey(key);
            if (UserSuppliedFinanceAmountFields.Contains(canonicalKey) && !string.IsNullOrWhiteSpace(value))
            {
                return canonicalKey;
            }
        }

        return null;
    }

    private static bool BoolValue(ConfirmCardRequest request, string canonicalKey) =>
        Value(request, canonicalKey, "false") switch
        {
            "true" or "True" or "TRUE" or "yes" or "Yes" or "YES" or "1" => true,
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
