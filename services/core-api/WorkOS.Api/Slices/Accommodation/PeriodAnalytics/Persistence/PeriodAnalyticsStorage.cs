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
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var applied = Apply(workspaceEvent, db);
        db.Commit();
        return applied;
    }

    public bool Apply(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        switch (workspaceEvent.EventType)
        {
            case "Accommodation.PeriodScopeConfirmed":
                UpsertPeriodReview(workspaceEvent, db, "scoped");
                return true;
            case "Accommodation.PeriodMetricsReviewed":
                if (IsPeriodClosed(db, PeriodId(workspaceEvent), workspaceEvent.WorkspaceId))
                {
                    AppendLateAdjustment(workspaceEvent, db);
                    return true;
                }

                InsertFrozenMetricSnapshot(workspaceEvent, db);
                return true;
            case "Accommodation.PeriodFinanceReviewed":
                if (IsPeriodClosed(db, PeriodId(workspaceEvent), workspaceEvent.WorkspaceId))
                {
                    AppendLateAdjustment(workspaceEvent, db);
                    return true;
                }

                UpsertFinanceSnapshot(workspaceEvent, db);
                return true;
            case "Accommodation.PeriodOperationsDiagnosed":
                if (IsPeriodClosed(db, PeriodId(workspaceEvent), workspaceEvent.WorkspaceId))
                {
                    AppendLateAdjustment(workspaceEvent, db);
                    return true;
                }

                InsertOperationSnapshot(workspaceEvent, db);
                UpsertOperationDiagnosis(workspaceEvent, db);
                return true;
            case "Accommodation.PeriodActionPlanCommitted":
            case "Accommodation.PeriodActionPlanCompleted":
                UpsertActionPlan(workspaceEvent, db);
                MarkActionPlanWorkItemCompleted(workspaceEvent, db);
                AppendLateAdjustment(workspaceEvent, db);
                return true;
            case "Accommodation.PeriodReviewClosed":
                FreezeFinalSnapshots(workspaceEvent, db);
                UpsertPeriodReview(workspaceEvent, db, "closed");
                return true;
            default:
                return false;
        }
    }

    private void UpsertPeriodReview(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into period_reviews(
                period_id, workspace_id, period_year, period_no, period_start_utc, period_end_utc,
                status, closed_result, created_event_id, updated_at_utc,
                period_review_id, tenant_id, period_key, scope_id, opened_by, opened_at_utc,
                closed_event_id, closed_at_utc, source_high_watermark, created_at_utc)
            values (
                @periodId, @workspaceId, @periodYear, @periodNo, @periodStartUtc, @periodEndUtc,
                @status, @closedResult, @createdEventId, @updatedAtUtc,
                @periodReviewId, @tenantId, @periodKey, @scopeId, @openedBy, @openedAtUtc,
                @closedEventId, @closedAtUtc, @sourceHighWatermark, @createdAtUtc)
            on conflict(period_id) do update set
                status = excluded.status,
                closed_result = excluded.closed_result,
                closed_event_id = coalesce(excluded.closed_event_id, period_reviews.closed_event_id),
                closed_at_utc = coalesce(excluded.closed_at_utc, period_reviews.closed_at_utc),
                source_high_watermark = excluded.source_high_watermark,
                updated_at_utc = excluded.updated_at_utc
            """);
        var periodId = PeriodId(workspaceEvent);
        var periodYear = IntValue(workspaceEvent, "periodYear", 2026);
        var periodNo = IntValue(workspaceEvent, "periodNo", 1);
        var isClosed = status.Equals("closed", StringComparison.OrdinalIgnoreCase);
        command.Parameters.AddWithValue("periodId", periodId);
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("periodYear", periodYear);
        command.Parameters.AddWithValue("periodNo", periodNo);
        command.Parameters.AddWithValue("periodStartUtc", DateValue(workspaceEvent, "periodStartAt", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("periodEndUtc", DateValue(workspaceEvent, "periodEndAt", workspaceEvent.OccurredAtUtc.AddDays(10)));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("closedResult", Value(workspaceEvent, "closeResult", string.Empty));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("periodReviewId", periodId);
        command.Parameters.AddWithValue("tenantId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("periodKey", $"{periodYear}-{periodNo:00}");
        command.Parameters.AddWithValue("scopeId", $"scope-{periodId}");
        command.Parameters.AddWithValue("openedBy", workspaceEvent.ActorId);
        command.Parameters.AddWithValue("openedAtUtc", DateValue(workspaceEvent, "periodStartAt", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("closedEventId", isClosed ? workspaceEvent.EventId : DBNull.Value);
        command.Parameters.AddWithValue("closedAtUtc", isClosed ? workspaceEvent.OccurredAtUtc : DBNull.Value);
        command.Parameters.AddWithValue("sourceHighWatermark", workspaceEvent.EventId);
        command.Parameters.AddWithValue("createdAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static void FreezeFinalSnapshots(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        var periodId = PeriodId(workspaceEvent);
        var closedAt = workspaceEvent.OccurredAtUtc;
        var closeVersion = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["PeriodReviewClosed"] = workspaceEvent.EventId,
            ["closedAtUtc"] = closedAt
        }, PostgresProjectionStore.JsonOptions);

        using (var command = db.CreateCommand("""
            update period_metric_snapshots
            set snapshot_frozen = true,
                frozen_at_utc = coalesce(frozen_at_utc, @closedAtUtc),
                source_event_high_watermark = @sourceHighWatermark,
                source_projection_versions = coalesce(source_projection_versions, '{}'::jsonb) || @closeVersion::jsonb
            where period_id = @periodId
            """))
        {
            command.Parameters.AddWithValue("periodId", periodId);
            command.Parameters.AddWithValue("closedAtUtc", closedAt);
            command.Parameters.AddWithValue("sourceHighWatermark", workspaceEvent.EventId);
            command.Parameters.AddWithValue("closeVersion", NpgsqlDbType.Jsonb, closeVersion);
            command.ExecuteNonQuery();
        }

        using (var command = db.CreateCommand("""
            update period_finance_snapshots
            set source_event_high_watermark = @sourceHighWatermark,
                source_ledger_versions = coalesce(source_ledger_versions, '{}'::jsonb) || @closeVersion::jsonb
            where period_id = @periodId
            """))
        {
            command.Parameters.AddWithValue("periodId", periodId);
            command.Parameters.AddWithValue("sourceHighWatermark", workspaceEvent.EventId);
            command.Parameters.AddWithValue("closeVersion", NpgsqlDbType.Jsonb, closeVersion);
            command.ExecuteNonQuery();
        }

        using (var command = db.CreateCommand("""
            update period_operation_snapshots
            set source_event_high_watermark = @sourceHighWatermark,
                source_lens_versions = coalesce(source_lens_versions, '{}'::jsonb) || @closeVersion::jsonb
            where period_review_id = @periodId
            """))
        {
            command.Parameters.AddWithValue("periodId", periodId);
            command.Parameters.AddWithValue("sourceHighWatermark", workspaceEvent.EventId);
            command.Parameters.AddWithValue("closeVersion", NpgsqlDbType.Jsonb, closeVersion);
            command.ExecuteNonQuery();
        }
    }

    private void InsertFrozenMetricSnapshot(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        var availableBedNight = DecimalValue(workspaceEvent, "availableBedNight", 0m);
        var bedNightSold = DecimalValue(workspaceEvent, "bedNightSold", 0m);
        var newLeadCount = DecimalValue(workspaceEvent, "newLeadCount", 0m);
        var reservationCount = DecimalValue(workspaceEvent, "reservationCount", 0m);
        var checkInCount = DecimalValue(workspaceEvent, "checkInCount", 0m);

        var occupancy = Ratio(bedNightSold, availableBedNight);
        var leadToReservation = Ratio(reservationCount, newLeadCount);
        var reservationToCheckIn = Ratio(checkInCount, reservationCount);

        using var command = db.CreateCommand("""
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
            """);
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

    private void UpsertFinanceSnapshot(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        var snapshot = FinanceSnapshotGenerator.Generate(db);
        var approvedExpenseAmount = snapshot.ExpenseStatus == FinanceSnapshotGenerator.ExpenseNotIntegrated
            ? 0m
            : snapshot.ApprovedExpenseAmount ?? 0m;
        var pendingExpenseAmount = snapshot.ExpenseStatus == FinanceSnapshotGenerator.ExpenseNotIntegrated
            ? 0m
            : snapshot.PendingExpenseAmount ?? 0m;

        using var command = db.CreateCommand("""
            insert into period_finance_snapshots(
                period_id, workspace_id, rent_revenue, other_revenue, confirmed_payment_amount, pending_payment_amount,
                deposit_received_amount, deposit_refunded_amount, deposit_deducted_amount, deposit_applied_to_balance_amount,
                deposit_liability_end, approved_expense_amount, pending_expense_amount, period_net_cash_flow,
                ending_debt_amount, finance_exception_count, created_event_id, updated_at_utc,
                snapshot_id, tenant_id, period_review_id, body, source_ledger_versions, expense_status,
                source_event_high_watermark, generated_at_utc, generated_by)
            values (
                @periodId, @workspaceId, @rentRevenue, @otherRevenue, @confirmedPaymentAmount, @pendingPaymentAmount,
                @depositReceivedAmount, @depositRefundedAmount, @depositDeductedAmount, @depositAppliedToBalanceAmount,
                @depositLiabilityEnd, @approvedExpenseAmount, @pendingExpenseAmount, @periodNetCashFlow,
                @endingDebtAmount, @financeExceptionCount, @createdEventId, @updatedAtUtc,
                @snapshotId, @tenantId, @periodReviewId, @body::jsonb, @sourceLedgerVersions::jsonb,
                @expenseStatus, @sourceEventHighWatermark, @generatedAtUtc, @generatedBy)
            on conflict(period_id) do nothing
            """);
        var periodId = PeriodId(workspaceEvent);
        command.Parameters.AddWithValue("periodId", periodId);
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("rentRevenue", NpgsqlDbType.Numeric, snapshot.OrdinaryPaymentAllocated);
        command.Parameters.AddWithValue("otherRevenue", NpgsqlDbType.Numeric, 0m);
        command.Parameters.AddWithValue("confirmedPaymentAmount", NpgsqlDbType.Numeric, snapshot.OrdinaryPaymentConfirmed);
        command.Parameters.AddWithValue("pendingPaymentAmount", NpgsqlDbType.Numeric, snapshot.PendingOrdinaryPayment);
        command.Parameters.AddWithValue("depositReceivedAmount", NpgsqlDbType.Numeric, snapshot.DepositReceived);
        command.Parameters.AddWithValue("depositRefundedAmount", NpgsqlDbType.Numeric, snapshot.DepositRefundPaid);
        command.Parameters.AddWithValue("depositDeductedAmount", NpgsqlDbType.Numeric, snapshot.DepositDeducted);
        command.Parameters.AddWithValue("depositAppliedToBalanceAmount", NpgsqlDbType.Numeric, snapshot.DepositAppliedToBalance);
        command.Parameters.AddWithValue("depositLiabilityEnd", NpgsqlDbType.Numeric, snapshot.DepositLiabilityEnd);
        command.Parameters.AddWithValue("approvedExpenseAmount", NpgsqlDbType.Numeric, approvedExpenseAmount);
        command.Parameters.AddWithValue("pendingExpenseAmount", NpgsqlDbType.Numeric, pendingExpenseAmount);
        command.Parameters.AddWithValue("periodNetCashFlow", NpgsqlDbType.Numeric, snapshot.PeriodNetCashFlow);
        command.Parameters.AddWithValue("endingDebtAmount", NpgsqlDbType.Numeric, snapshot.OutstandingDebt);
        command.Parameters.AddWithValue("financeExceptionCount", snapshot.ReconciliationMismatchCount + snapshot.CorrectionPendingCount);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("snapshotId", periodId);
        command.Parameters.AddWithValue("tenantId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("periodReviewId", periodId);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(snapshot.Body, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("sourceLedgerVersions", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(snapshot.SourceLedgerVersions, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("expenseStatus", snapshot.ExpenseStatus);
        command.Parameters.AddWithValue("sourceEventHighWatermark", snapshot.SourceEventHighWatermark);
        command.Parameters.AddWithValue("generatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("generatedBy", "period-finance-snapshot-generator");
        command.ExecuteNonQuery();
    }

    private void UpsertOperationDiagnosis(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
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
            """);
        command.Parameters.AddWithValue("diagnosisId", StableId("period-diagnosis", workspaceEvent));
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("issueCategory", Value(workspaceEvent, "issueCategory", "occupancy"));
        command.Parameters.AddWithValue("issueSummary", Value(workspaceEvent, "issueSummary", string.Empty));
        command.Parameters.AddWithValue("rootCause", Value(workspaceEvent, "rootCause", string.Empty));
        command.Parameters.AddWithValue("blockedBedDays", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "blockedBedDays", 0m));
        command.Parameters.AddWithValue("unfinishedTaskCount", IntValue(workspaceEvent, "unfinishedTaskCount", 0));
        command.Parameters.AddWithValue("overdueTaskCount", IntValue(workspaceEvent, "overdueTaskCount", 0));
        command.Parameters.AddWithValue("debtorCount", IntValue(workspaceEvent, "debtorCount", 0));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void InsertOperationSnapshot(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        var snapshot = OperationSnapshotGenerator.Generate(db);
        var periodId = PeriodId(workspaceEvent);
        using var command = db.CreateCommand("""
            insert into period_operation_snapshots(
                snapshot_id, tenant_id, period_review_id, body, source_lens_versions,
                source_event_high_watermark, generated_at_utc, generated_by)
            values (
                @snapshotId, @tenantId, @periodReviewId, @body::jsonb,
                @sourceLensVersions::jsonb, @sourceEventHighWatermark,
                @generatedAtUtc, @generatedBy)
            on conflict(snapshot_id) do nothing
            """);
        command.Parameters.AddWithValue("snapshotId", periodId);
        command.Parameters.AddWithValue("tenantId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("periodReviewId", periodId);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(snapshot.Body, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("sourceLensVersions", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(snapshot.SourceLensVersions, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("sourceEventHighWatermark", snapshot.SourceEventHighWatermark);
        command.Parameters.AddWithValue("generatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("generatedBy", "period-operation-snapshot-generator");
        command.ExecuteNonQuery();
    }

    private void UpsertActionPlan(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        var isCompleted = workspaceEvent.EventType.Equals("Accommodation.PeriodActionPlanCompleted", StringComparison.OrdinalIgnoreCase);
        var actionPlanId = Value(workspaceEvent, "actionPlanId", StableId("period-action", workspaceEvent));
        var createdWorkItemId = Value(workspaceEvent, "actionPlanWorkItemId",
            Value(workspaceEvent, "workItemId", StableId("period-action-work-item", workspaceEvent)));
        var status = isCompleted
            ? "completed"
            : NormalizeCommittedStatus(Value(workspaceEvent, "actionStatus", "committed"));
        var dueAtUtc = DateValue(workspaceEvent, "dueAtUtc",
            DateValue(workspaceEvent, "dueAt", workspaceEvent.OccurredAtUtc.AddDays(7)));

        using var command = db.CreateCommand("""
            insert into period_action_plans(
                action_plan_id, period_id, workspace_id, action_title, action_type, target_metric,
                target_value, owner_name, priority, status, created_event_id, updated_at_utc,
                tenant_id, period_review_id, title, description, owner_role, owner_actor_id,
                created_work_item_id, committed_event_id, completed_event_id, due_at_utc)
            values (
                @actionPlanId, @periodId, @workspaceId, @actionTitle, @actionType, @targetMetric,
                @targetValue, @ownerName, @priority, @status, @createdEventId, @updatedAtUtc,
                @tenantId, @periodReviewId, @title, @description, @ownerRole, @ownerActorId,
                @createdWorkItemId, @committedEventId, @completedEventId, @dueAtUtc)
            on conflict(action_plan_id) do update set
                action_title = excluded.action_title,
                action_type = excluded.action_type,
                target_metric = excluded.target_metric,
                target_value = excluded.target_value,
                owner_name = excluded.owner_name,
                priority = excluded.priority,
                status = excluded.status,
                title = excluded.title,
                description = excluded.description,
                owner_role = excluded.owner_role,
                owner_actor_id = excluded.owner_actor_id,
                created_work_item_id = coalesce(period_action_plans.created_work_item_id, excluded.created_work_item_id),
                committed_event_id = coalesce(period_action_plans.committed_event_id, excluded.committed_event_id),
                completed_event_id = coalesce(excluded.completed_event_id, period_action_plans.completed_event_id),
                due_at_utc = excluded.due_at_utc,
                updated_at_utc = excluded.updated_at_utc
            """);
        var periodId = PeriodId(workspaceEvent);
        var actionTitle = Value(workspaceEvent, "actionTitle", string.Empty);
        var actionType = Value(workspaceEvent, "actionType", "increase_occupancy");
        var targetMetric = Value(workspaceEvent, "targetMetric", "average_occupancy_rate");
        var ownerRole = Value(workspaceEvent, "ownerRole", Value(workspaceEvent, "ownerName", "manager"));
        command.Parameters.AddWithValue("actionPlanId", actionPlanId);
        command.Parameters.AddWithValue("periodId", PeriodId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("actionTitle", actionTitle);
        command.Parameters.AddWithValue("actionType", actionType);
        command.Parameters.AddWithValue("targetMetric", targetMetric);
        command.Parameters.AddWithValue("targetValue", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "targetValue", 0m));
        command.Parameters.AddWithValue("ownerName", Value(workspaceEvent, "ownerName", string.Empty));
        command.Parameters.AddWithValue("priority", Value(workspaceEvent, "priority", "normal"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("tenantId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("periodReviewId", periodId);
        command.Parameters.AddWithValue("title", actionTitle);
        command.Parameters.AddWithValue("description", $"{actionType}:{targetMetric}");
        command.Parameters.AddWithValue("ownerRole", ownerRole);
        command.Parameters.AddWithValue("ownerActorId", DbValue(Value(workspaceEvent, "ownerActorId", string.Empty)));
        command.Parameters.AddWithValue("createdWorkItemId", DbValue(createdWorkItemId));
        command.Parameters.AddWithValue("committedEventId", isCompleted ? DBNull.Value : workspaceEvent.EventId);
        command.Parameters.AddWithValue("completedEventId", isCompleted ? workspaceEvent.EventId : DBNull.Value);
        command.Parameters.AddWithValue("dueAtUtc", dueAtUtc);
        command.ExecuteNonQuery();
    }

    private static string NormalizeCommittedStatus(string status) =>
        status.Equals("completed", StringComparison.OrdinalIgnoreCase) ? "committed" : status;

    private static void MarkActionPlanWorkItemCompleted(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        if (!workspaceEvent.EventType.Equals("Accommodation.PeriodActionPlanCompleted", StringComparison.OrdinalIgnoreCase) ||
            !TableExists(db, "process_work_item_intents"))
        {
            return;
        }

        var workItemId = Value(workspaceEvent, "actionPlanWorkItemId", Value(workspaceEvent, "workItemId", string.Empty));
        if (string.IsNullOrWhiteSpace(workItemId))
        {
            return;
        }

        using var command = db.CreateCommand("""
            update process_work_item_intents
            set status = 'completed',
                body = jsonb_set(
                    body,
                    '{payload,completedByEventId}',
                    to_jsonb(@completedByEventId::text),
                    true)
            where tenant_id = @tenantId
              and work_item_id = @workItemId
              and work_item_type = 'periodActionPlanExecution'
            """);
        command.Parameters.AddWithValue("tenantId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("workItemId", workItemId);
        command.Parameters.AddWithValue("completedByEventId", workspaceEvent.EventId);
        command.ExecuteNonQuery();
    }

    private void AppendLateAdjustment(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        var periodId = PeriodId(workspaceEvent);
        if (!IsPeriodClosed(db, periodId, workspaceEvent.WorkspaceId))
        {
            return;
        }

        var linkedCorrectionId = Value(workspaceEvent, "linkedCorrectionId",
            Value(workspaceEvent, "correctionRequestId", string.Empty));
        var reason = Value(workspaceEvent, "reason",
            Value(workspaceEvent, "adjustmentReason", workspaceEvent.EventType));
        var body = JsonSerializer.Serialize(new
        {
            before = PeriodSnapshotView(db, periodId),
            after = new
            {
                workspaceEvent.EventType,
                workspaceEvent.EventId,
                payload = workspaceEvent.Payload
            },
            reason,
            actor = workspaceEvent.ActorId,
            linkedCorrectionId = string.IsNullOrWhiteSpace(linkedCorrectionId) ? null : linkedCorrectionId
        }, PostgresProjectionStore.JsonOptions);

        using var command = db.CreateCommand("""
            insert into period_late_adjustments(
                adjustment_id, period_id, workspace_id, adjustment_event_type, adjustment_payload,
                created_event_id, occurred_at_utc, late_adjustment_id, tenant_id, period_review_id,
                adjustment_type, reason, linked_correction_id, body, event_id, created_by, created_at_utc)
            values (
                @adjustmentId, @periodId, @workspaceId, @adjustmentEventType, @adjustmentPayload,
                @createdEventId, @occurredAtUtc, @lateAdjustmentId, @tenantId, @periodReviewId,
                @adjustmentType, @reason, @linkedCorrectionId, @body::jsonb, @eventId, @createdBy, @createdAtUtc)
            on conflict(adjustment_id) do nothing
            """);
        var adjustmentId = $"period-adjustment-{workspaceEvent.EventId}".ToLowerInvariant();
        command.Parameters.AddWithValue("adjustmentId", adjustmentId);
        command.Parameters.AddWithValue("periodId", periodId);
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("adjustmentEventType", workspaceEvent.EventType);
        command.Parameters.AddWithValue("adjustmentPayload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(workspaceEvent.Payload, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("occurredAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("lateAdjustmentId", adjustmentId);
        command.Parameters.AddWithValue("tenantId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("periodReviewId", periodId);
        command.Parameters.AddWithValue("adjustmentType", Value(workspaceEvent, "adjustmentType", workspaceEvent.EventType));
        command.Parameters.AddWithValue("reason", reason);
        command.Parameters.AddWithValue("linkedCorrectionId", DbValue(linkedCorrectionId));
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, body);
        command.Parameters.AddWithValue("eventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("createdBy", workspaceEvent.ActorId);
        command.Parameters.AddWithValue("createdAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static bool IsPeriodClosed(RuntimeDbSession db, string periodId, string tenantId)
    {
        using var command = db.CreateCommand("""
            select exists (
                select 1
                from period_reviews
                where (period_id = @periodId or period_review_id = @periodId)
                  and (workspace_id = @tenantId or tenant_id = @tenantId)
                  and status = 'closed'
            )
            """);
        command.Parameters.AddWithValue("periodId", periodId);
        command.Parameters.AddWithValue("tenantId", tenantId);
        return Convert.ToBoolean(command.ExecuteScalar());
    }

    private static object PeriodSnapshotView(RuntimeDbSession db, string periodId)
    {
        using var command = db.CreateCommand("""
            select jsonb_build_object(
                'periodReview', (
                    select to_jsonb(review)
                    from period_reviews review
                    where review.period_id = @periodId
                    limit 1
                ),
                'metricSnapshot', (
                    select jsonb_build_object(
                        'snapshotId', snapshot_id,
                        'body', body,
                        'sourceProjectionVersions', source_projection_versions,
                        'sourceEventHighWatermark', source_event_high_watermark
                    )
                    from period_metric_snapshots
                    where period_id = @periodId
                    limit 1
                ),
                'financeSnapshot', (
                    select jsonb_build_object(
                        'snapshotId', snapshot_id,
                        'body', body,
                        'sourceLedgerVersions', source_ledger_versions,
                        'sourceEventHighWatermark', source_event_high_watermark
                    )
                    from period_finance_snapshots
                    where period_id = @periodId
                    limit 1
                ),
                'operationSnapshot', (
                    select jsonb_build_object(
                        'snapshotId', snapshot_id,
                        'body', body,
                        'sourceLensVersions', source_lens_versions,
                        'sourceEventHighWatermark', source_event_high_watermark
                    )
                    from period_operation_snapshots
                    where period_review_id = @periodId
                    limit 1
                )
            )::text
            """);
        command.Parameters.AddWithValue("periodId", periodId);
        var json = Convert.ToString(command.ExecuteScalar());
        return string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, object?>()
            : JsonSerializer.Deserialize<JsonElement>(json!);
    }

    private static (decimal Value, string Status) Ratio(decimal numerator, decimal denominator) =>
        denominator == 0m
            ? (0m, "not_applicable")
            : (numerator / denominator, "calculated");

    private static string PeriodId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "periodId", StableId("period", workspaceEvent));

    private static string Value(WorkspaceEvent workspaceEvent, string canonicalKey, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string canonicalKey, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static int IntValue(WorkspaceEvent workspaceEvent, string canonicalKey, int defaultValue) =>
        RuntimeFieldAliases.IntValue(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static DateTimeOffset DateValue(WorkspaceEvent workspaceEvent, string canonicalKey, DateTimeOffset defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, string.Empty);
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : defaultValue.ToUniversalTime();
    }

    private static bool TableExists(RuntimeDbSession db, string tableName)
    {
        using var command = db.CreateCommand("select to_regclass(@tableName) is not null");
        command.Parameters.AddWithValue("tableName", tableName);
        return Convert.ToBoolean(command.ExecuteScalar());
    }

    private static object DbValue(string value) =>
        string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
