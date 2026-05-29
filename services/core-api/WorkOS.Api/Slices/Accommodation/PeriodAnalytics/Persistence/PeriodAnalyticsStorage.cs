using System.Globalization;
using System.Text.Json;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Persistence;

internal sealed class PeriodAnalyticsStorage
{
    private readonly PostgresConnectionFactory connections;

    public PeriodAnalyticsStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public bool Apply(WorkspaceEvent workspaceEvent)
    {
        switch (workspaceEvent.EventType)
        {
            case "Accommodation.PeriodScopeConfirmed":
                UpsertPeriodReview(workspaceEvent, "scoped");
                return true;
            case "Accommodation.PeriodMetricsReviewed":
                InsertFrozenMetricSnapshot(workspaceEvent);
                return true;
            case "Accommodation.PeriodFinanceReviewed":
                UpsertFinanceSnapshot(workspaceEvent);
                AppendLateAdjustment(workspaceEvent);
                return true;
            case "Accommodation.PeriodOperationsDiagnosed":
                UpsertOperationDiagnosis(workspaceEvent);
                AppendLateAdjustment(workspaceEvent);
                return true;
            case "Accommodation.PeriodActionPlanCommitted":
            case "Accommodation.PeriodActionPlanCompleted":
                UpsertActionPlan(workspaceEvent);
                AppendLateAdjustment(workspaceEvent);
                return true;
            case "Accommodation.PeriodReviewClosed":
                UpsertPeriodReview(workspaceEvent, "closed");
                return true;
            default:
                return false;
        }
    }

    private void UpsertPeriodReview(WorkspaceEvent workspaceEvent, string status)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into period_reviews(period_id, workspace_id, period_year, period_no, period_start_utc, period_end_utc, status, closed_result, created_event_id, updated_at_utc)
            values (@periodId, @workspaceId, @periodYear, @periodNo, @periodStartUtc, @periodEndUtc, @status, @closedResult, @createdEventId, @updatedAtUtc)
            on conflict(period_id) do update set
                status = excluded.status,
                closed_result = excluded.closed_result,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("periodYear", IntValue(workspaceEvent, "periodYear", "年份", 2026));
        command.Parameters.AddWithValue("periodNo", IntValue(workspaceEvent, "periodNo", "周期编号", 1));
        command.Parameters.AddWithValue("periodStartUtc", DateValue(workspaceEvent, "periodStartAt", "周期开始时间", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("periodEndUtc", DateValue(workspaceEvent, "periodEndAt", "周期结束时间", workspaceEvent.OccurredAtUtc.AddDays(10)));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("closedResult", Value(workspaceEvent, "closeResult", "关闭结果", string.Empty));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void InsertFrozenMetricSnapshot(WorkspaceEvent workspaceEvent)
    {
        var availableBedNight = DecimalValue(workspaceEvent, "availableBedNight", "可售床夜", 0m);
        var bedNightSold = DecimalValue(workspaceEvent, "bedNightSold", "已售床夜", 0m);
        var newLeadCount = DecimalValue(workspaceEvent, "newLeadCount", "新线索数", 0m);
        var reservationCount = DecimalValue(workspaceEvent, "reservationCount", "预订数", 0m);
        var checkInCount = DecimalValue(workspaceEvent, "checkInCount", "入住人数", 0m);

        var occupancy = Ratio(bedNightSold, availableBedNight);
        var leadToReservation = Ratio(reservationCount, newLeadCount);
        var reservationToCheckIn = Ratio(checkInCount, reservationCount);

        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into period_metric_snapshots(
                period_id, workspace_id, available_bed_night, bed_night_sold,
                average_occupancy_rate, average_occupancy_rate_status,
                new_lead_count, reservation_count, lead_to_reservation_rate, lead_to_reservation_rate_status,
                check_in_count, reservation_to_check_in_rate, reservation_to_check_in_rate_status,
                snapshot_frozen, created_event_id, frozen_at_utc)
            values (
                @periodId, @workspaceId, @availableBedNight, @bedNightSold,
                @averageOccupancyRate, @averageOccupancyRateStatus,
                @newLeadCount, @reservationCount, @leadToReservationRate, @leadToReservationRateStatus,
                @checkInCount, @reservationToCheckInRate, @reservationToCheckInRateStatus,
                true, @createdEventId, @frozenAtUtc)
            on conflict(period_id) do nothing
            """;
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("availableBedNight", NpgsqlDbType.Numeric, availableBedNight);
        command.Parameters.AddWithValue("bedNightSold", NpgsqlDbType.Numeric, bedNightSold);
        command.Parameters.AddWithValue("averageOccupancyRate", NpgsqlDbType.Numeric, occupancy.Value);
        command.Parameters.AddWithValue("averageOccupancyRateStatus", occupancy.Status);
        command.Parameters.AddWithValue("newLeadCount", NpgsqlDbType.Numeric, newLeadCount);
        command.Parameters.AddWithValue("reservationCount", NpgsqlDbType.Numeric, reservationCount);
        command.Parameters.AddWithValue("leadToReservationRate", NpgsqlDbType.Numeric, leadToReservation.Value);
        command.Parameters.AddWithValue("leadToReservationRateStatus", leadToReservation.Status);
        command.Parameters.AddWithValue("checkInCount", NpgsqlDbType.Numeric, checkInCount);
        command.Parameters.AddWithValue("reservationToCheckInRate", NpgsqlDbType.Numeric, reservationToCheckIn.Value);
        command.Parameters.AddWithValue("reservationToCheckInRateStatus", reservationToCheckIn.Status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("frozenAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertFinanceSnapshot(WorkspaceEvent workspaceEvent)
    {
        var rentRevenue = DecimalValue(workspaceEvent, "rentRevenue", "房租收入", 0m);
        var otherRevenue = DecimalValue(workspaceEvent, "otherRevenue", "其他收入", 0m);
        var approvedExpense = DecimalValue(workspaceEvent, "approvedExpenseAmount", "已确认支出", 0m);
        var depositReceived = DecimalValue(workspaceEvent, "depositReceivedAmount", "周期押金收取", 0m);
        var depositRefunded = DecimalValue(workspaceEvent, "depositRefundedAmount", "周期押金退还", 0m);
        var depositDeducted = DecimalValue(workspaceEvent, "depositDeductedAmount", "周期押金扣除", 0m);
        var depositApplied = DecimalValue(workspaceEvent, "depositAppliedToBalanceAmount", "押金抵欠金额", 0m);

        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into period_finance_snapshots(
                period_id, workspace_id, rent_revenue, other_revenue, confirmed_payment_amount, pending_payment_amount,
                deposit_received_amount, deposit_refunded_amount, deposit_deducted_amount, deposit_applied_to_balance_amount,
                deposit_liability_end, approved_expense_amount, pending_expense_amount, period_net_cash_flow,
                ending_debt_amount, finance_exception_count, created_event_id, updated_at_utc)
            values (
                @periodId, @workspaceId, @rentRevenue, @otherRevenue, @confirmedPaymentAmount, @pendingPaymentAmount,
                @depositReceivedAmount, @depositRefundedAmount, @depositDeductedAmount, @depositAppliedToBalanceAmount,
                @depositLiabilityEnd, @approvedExpenseAmount, @pendingExpenseAmount, @periodNetCashFlow,
                @endingDebtAmount, @financeExceptionCount, @createdEventId, @updatedAtUtc)
            on conflict(period_id) do update set
                rent_revenue = excluded.rent_revenue,
                other_revenue = excluded.other_revenue,
                approved_expense_amount = excluded.approved_expense_amount,
                period_net_cash_flow = excluded.period_net_cash_flow,
                finance_exception_count = excluded.finance_exception_count,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("rentRevenue", NpgsqlDbType.Numeric, rentRevenue);
        command.Parameters.AddWithValue("otherRevenue", NpgsqlDbType.Numeric, otherRevenue);
        command.Parameters.AddWithValue("confirmedPaymentAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "confirmedPaymentAmount", "已确认普通收款", 0m));
        command.Parameters.AddWithValue("pendingPaymentAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "pendingPaymentAmount", "待确认普通收款", 0m));
        command.Parameters.AddWithValue("depositReceivedAmount", NpgsqlDbType.Numeric, depositReceived);
        command.Parameters.AddWithValue("depositRefundedAmount", NpgsqlDbType.Numeric, depositRefunded);
        command.Parameters.AddWithValue("depositDeductedAmount", NpgsqlDbType.Numeric, depositDeducted);
        command.Parameters.AddWithValue("depositAppliedToBalanceAmount", NpgsqlDbType.Numeric, depositApplied);
        command.Parameters.AddWithValue("depositLiabilityEnd", NpgsqlDbType.Numeric, depositReceived - depositRefunded - depositDeducted - depositApplied);
        command.Parameters.AddWithValue("approvedExpenseAmount", NpgsqlDbType.Numeric, approvedExpense);
        command.Parameters.AddWithValue("pendingExpenseAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "pendingExpenseAmount", "待确认支出", 0m));
        command.Parameters.AddWithValue("periodNetCashFlow", NpgsqlDbType.Numeric, rentRevenue + otherRevenue - approvedExpense);
        command.Parameters.AddWithValue("endingDebtAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "endingDebtAmount", "期末欠款", 0m));
        command.Parameters.AddWithValue("financeExceptionCount", IntValue(workspaceEvent, "financeExceptionCount", "财务异常数", 0));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertOperationDiagnosis(WorkspaceEvent workspaceEvent)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into period_operation_diagnoses(
                diagnosis_id, period_id, workspace_id, issue_category, issue_summary, root_cause,
                blocked_bed_days, unfinished_task_count, overdue_task_count, debtor_count,
                created_event_id, updated_at_utc)
            values (
                @diagnosisId, @periodId, @workspaceId, @issueCategory, @issueSummary, @rootCause,
                @blockedBedDays, @unfinishedTaskCount, @overdueTaskCount, @debtorCount,
                @createdEventId, @updatedAtUtc)
            on conflict(diagnosis_id) do update set
                issue_category = excluded.issue_category,
                issue_summary = excluded.issue_summary,
                root_cause = excluded.root_cause,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("diagnosisId", StableId("period-diagnosis", workspaceEvent));
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("issueCategory", Value(workspaceEvent, "issueCategory", "主要问题分类", "入住率"));
        command.Parameters.AddWithValue("issueSummary", Value(workspaceEvent, "issueSummary", "主要问题", string.Empty));
        command.Parameters.AddWithValue("rootCause", Value(workspaceEvent, "rootCause", "根因分析", string.Empty));
        command.Parameters.AddWithValue("blockedBedDays", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "blockedBedDays", "阻断床位天数", 0m));
        command.Parameters.AddWithValue("unfinishedTaskCount", IntValue(workspaceEvent, "unfinishedTaskCount", "期末未完成任务", 0));
        command.Parameters.AddWithValue("overdueTaskCount", IntValue(workspaceEvent, "overdueTaskCount", "超时任务数", 0));
        command.Parameters.AddWithValue("debtorCount", IntValue(workspaceEvent, "debtorCount", "欠款住客数", 0));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertActionPlan(WorkspaceEvent workspaceEvent)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into period_action_plans(
                action_plan_id, period_id, workspace_id, action_title, action_type, target_metric,
                target_value, owner_name, priority, status, created_event_id, updated_at_utc)
            values (
                @actionPlanId, @periodId, @workspaceId, @actionTitle, @actionType, @targetMetric,
                @targetValue, @ownerName, @priority, @status, @createdEventId, @updatedAtUtc)
            on conflict(action_plan_id) do update set
                action_title = excluded.action_title,
                action_type = excluded.action_type,
                target_metric = excluded.target_metric,
                target_value = excluded.target_value,
                owner_name = excluded.owner_name,
                priority = excluded.priority,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("actionPlanId", Value(workspaceEvent, "actionPlanId", "行动计划", StableId("period-action", workspaceEvent)));
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("actionTitle", Value(workspaceEvent, "actionTitle", "行动标题", string.Empty));
        command.Parameters.AddWithValue("actionType", Value(workspaceEvent, "actionType", "行动类型", "提升入住率"));
        command.Parameters.AddWithValue("targetMetric", Value(workspaceEvent, "targetMetric", "目标指标", "平均入住率"));
        command.Parameters.AddWithValue("targetValue", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "targetValue", "目标值", 0m));
        command.Parameters.AddWithValue("ownerName", Value(workspaceEvent, "ownerName", "负责人", string.Empty));
        command.Parameters.AddWithValue("priority", Value(workspaceEvent, "priority", "优先级", "中"));
        command.Parameters.AddWithValue("status", Value(workspaceEvent, "actionStatus", "行动状态", "进行中"));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void AppendLateAdjustment(WorkspaceEvent workspaceEvent)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into period_late_adjustments(adjustment_id, period_id, workspace_id, adjustment_event_type, adjustment_payload, created_event_id, occurred_at_utc)
            values (@adjustmentId, @periodId, @workspaceId, @adjustmentEventType, @adjustmentPayload, @createdEventId, @occurredAtUtc)
            on conflict(adjustment_id) do nothing
            """;
        command.Parameters.AddWithValue("adjustmentId", $"period-adjustment-{workspaceEvent.EventId}".ToLowerInvariant());
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("adjustmentEventType", workspaceEvent.EventType);
        command.Parameters.AddWithValue("adjustmentPayload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(workspaceEvent.Payload, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("occurredAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static (decimal Value, string Status) Ratio(decimal numerator, decimal denominator) =>
        denominator == 0m
            ? (0m, "not_applicable")
            : (numerator / denominator, "calculated");

    private static string PeriodId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "periodId", "经营周期", StableId("period", workspaceEvent));

    private static string Value(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, string defaultValue)
    {
        if (workspaceEvent.Payload.TryGetValue(canonicalKey, out var canonical) && !string.IsNullOrWhiteSpace(canonical))
        {
            return canonical;
        }

        return workspaceEvent.Payload.TryGetValue(zhKey, out var zh) && !string.IsNullOrWhiteSpace(zh)
            ? zh
            : defaultValue;
    }

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, decimal defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, zhKey, string.Empty);
        return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;
    }

    private static int IntValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, int defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, zhKey, string.Empty);
        return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;
    }

    private static DateTimeOffset DateValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, DateTimeOffset defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, zhKey, string.Empty);
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : defaultValue.ToUniversalTime();
    }

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
