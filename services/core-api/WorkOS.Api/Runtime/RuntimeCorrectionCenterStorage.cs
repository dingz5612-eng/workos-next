using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeCorrectionCenterStorage : ICorrectionCenterStore
{
    private readonly PostgresConnectionFactory connections;
    private readonly RuntimeEventStorage events;
    private readonly ICheckoutServiceProcessRunSink processRunSink;

    public RuntimeCorrectionCenterStorage(
        PostgresConnectionFactory connections,
        RuntimeEventStorage events,
        ICheckoutServiceProcessRunSink processRunSink)
    {
        this.connections = connections;
        this.events = events;
        this.processRunSink = processRunSink;
    }

    public LedgerCorrectionRequestResult RequestCorrection(LedgerCorrectionRequestCommand command)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var now = DateTimeOffset.UtcNow;
        var correctionRequestId = $"corr-{Guid.NewGuid():N}";
        var eventId = $"corr-event-{Guid.NewGuid():N}";
        var status = IsHighRisk(command.RiskLevel) ? "pending_approval" : "requested";

        using (var insert = db.CreateCommand("""
            insert into ledger_correction_requests(
                correction_request_id, tenant_id, case_id, target_ledger_type, target_entry_id,
                target_object_type, target_object_id, correction_type, reason, requested_by,
                status, risk_level, created_at_utc, updated_at_utc)
            values (
                @correctionRequestId, @tenantId, @caseId, @targetLedgerType, @targetEntryId,
                @targetObjectType, @targetObjectId, @correctionType, @reason, @requestedBy,
                @status, @riskLevel, @createdAtUtc, @updatedAtUtc)
            """))
        {
            insert.Parameters.AddWithValue("correctionRequestId", correctionRequestId);
            AddCommandParameters(insert, command);
            insert.Parameters.AddWithValue("status", status);
            insert.Parameters.AddWithValue("createdAtUtc", now);
            insert.Parameters.AddWithValue("updatedAtUtc", now);
            insert.ExecuteNonQuery();
        }

        var workspaceEvent = Event(
            command.TenantId,
            eventId,
            CorrectionCenterEvents.LedgerCorrectionRequested,
            command.TargetEntryId,
            correctionRequestId,
            command.WorkItemId,
            "operator",
            command.RequestedBy,
            now,
            new Dictionary<string, string>
            {
                ["correctionRequestId"] = correctionRequestId,
                ["caseId"] = command.CaseId ?? string.Empty,
                ["workItemId"] = command.WorkItemId,
                ["targetLedgerType"] = command.TargetLedgerType,
                ["targetEntryId"] = command.TargetEntryId,
                ["targetObjectType"] = command.TargetObjectType,
                ["targetObjectId"] = command.TargetObjectId,
                ["correctionType"] = command.CorrectionType,
                ["riskLevel"] = command.RiskLevel,
                ["reason"] = command.Reason,
                ["status"] = status
            });
        events.InsertAuditEventAndOutbox(db, workspaceEvent, $"correction-request:{correctionRequestId}");
        InsertCorrectionAudit(db, command.TenantId, correctionRequestId, command.RequestedBy, "requested", new
        {
            command.WorkItemId,
            command.CaseId,
            command.TargetLedgerType,
            command.TargetEntryId,
            command.TargetObjectType,
            command.TargetObjectId,
            command.CorrectionType,
            command.RiskLevel,
            command.Reason
        }, now);
        InsertCorrectionCase(db, correctionRequestId, command, status, now);
        db.Commit();

        var intent = RecordCorrectionWorkItemIntent(command, correctionRequestId, eventId, status, now);
        return new LedgerCorrectionRequestResult(correctionRequestId, command.TenantId, status, command.RiskLevel, eventId, intent);
    }

    public LedgerCorrectionDecisionResult ApproveCorrection(LedgerCorrectionApproveCommand command)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var request = LoadRequestForUpdate(db, command.TenantId, command.CorrectionRequestId);
        if (request.Status is "rejected" or "applied" or "cancelled" or "superseded")
        {
            throw new InvalidOperationException("correction_request_not_approvable");
        }

        var now = DateTimeOffset.UtcNow;
        var approvalId = $"approval-{Guid.NewGuid():N}";
        var eventId = $"corr-event-{Guid.NewGuid():N}";
        using (var insert = db.CreateCommand("""
            insert into correction_approvals(
                approval_id, tenant_id, correction_request_id, approver_id, result, note, approved_at_utc)
            values (@approvalId, @tenantId, @correctionRequestId, @approverId, 'approved', @note, @approvedAtUtc)
            on conflict(tenant_id, correction_request_id, approver_id) do update set
                result = excluded.result,
                note = excluded.note,
                approved_at_utc = excluded.approved_at_utc
            """))
        {
            insert.Parameters.AddWithValue("approvalId", approvalId);
            insert.Parameters.AddWithValue("tenantId", command.TenantId);
            insert.Parameters.AddWithValue("correctionRequestId", command.CorrectionRequestId);
            insert.Parameters.AddWithValue("approverId", command.ApproverId);
            AddNullableTextParameter(insert, "note", command.Note);
            insert.Parameters.AddWithValue("approvedAtUtc", now);
            insert.ExecuteNonQuery();
        }

        UpdateRequestStatus(db, command.TenantId, command.CorrectionRequestId, "approved", now);
        UpdateCorrectionCaseStatus(db, command.TenantId, command.CorrectionRequestId, "approved", now);
        InsertDecisionEventAndAudit(
            db,
            request,
            eventId,
            CorrectionCenterEvents.LedgerCorrectionApproved,
            command.ApproverId,
            "approved",
            command.Note ?? string.Empty,
            now);
        db.Commit();
        return new LedgerCorrectionDecisionResult(command.CorrectionRequestId, command.TenantId, "approved", eventId);
    }

    public LedgerCorrectionDecisionResult RejectCorrection(LedgerCorrectionRejectCommand command)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var request = LoadRequestForUpdate(db, command.TenantId, command.CorrectionRequestId);
        if (request.Status is "applied" or "cancelled" or "superseded")
        {
            throw new InvalidOperationException("correction_request_not_rejectable");
        }

        var now = DateTimeOffset.UtcNow;
        var approvalId = $"approval-{Guid.NewGuid():N}";
        var eventId = $"corr-event-{Guid.NewGuid():N}";
        using (var insert = db.CreateCommand("""
            insert into correction_approvals(
                approval_id, tenant_id, correction_request_id, approver_id, result, note, approved_at_utc)
            values (@approvalId, @tenantId, @correctionRequestId, @approverId, 'rejected', @note, @approvedAtUtc)
            on conflict(tenant_id, correction_request_id, approver_id) do update set
                result = excluded.result,
                note = excluded.note,
                approved_at_utc = excluded.approved_at_utc
            """))
        {
            insert.Parameters.AddWithValue("approvalId", approvalId);
            insert.Parameters.AddWithValue("tenantId", command.TenantId);
            insert.Parameters.AddWithValue("correctionRequestId", command.CorrectionRequestId);
            insert.Parameters.AddWithValue("approverId", command.ApproverId);
            insert.Parameters.AddWithValue("note", command.Reason);
            insert.Parameters.AddWithValue("approvedAtUtc", now);
            insert.ExecuteNonQuery();
        }

        UpdateRequestStatus(db, command.TenantId, command.CorrectionRequestId, "rejected", now);
        UpdateCorrectionCaseStatus(db, command.TenantId, command.CorrectionRequestId, "closed", now);
        InsertDecisionEventAndAudit(
            db,
            request,
            eventId,
            CorrectionCenterEvents.LedgerCorrectionRejected,
            command.ApproverId,
            "rejected",
            command.Reason,
            now);
        db.Commit();
        return new LedgerCorrectionDecisionResult(command.CorrectionRequestId, command.TenantId, "rejected", eventId);
    }

    public LedgerCorrectionApplyResult ApplyCorrection(LedgerCorrectionApplyCommand command)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var request = LoadRequestForUpdate(db, command.TenantId, command.CorrectionRequestId);
        if (request.Status is "rejected" or "applied" or "cancelled" or "superseded")
        {
            throw new InvalidOperationException("correction_request_not_applicable");
        }

        if (IsHighRisk(request.RiskLevel) && !HasApprovedDecision(db, request.TenantId, request.CorrectionRequestId))
        {
            throw new InvalidOperationException("correction_approval_required_for_high_risk");
        }

        var now = DateTimeOffset.UtcNow;
        var reversalEventId = $"corr-event-{Guid.NewGuid():N}";
        var domainEventId = $"corr-event-{Guid.NewGuid():N}";
        var appliedEventId = $"corr-event-{Guid.NewGuid():N}";
        var reversalId = $"reversal-{Guid.NewGuid():N}";
        var correctionEntryId = $"correction-entry-{Guid.NewGuid():N}";
        var applyReason = string.IsNullOrWhiteSpace(command.Reason) ? request.Reason : command.Reason!;

        var target = LoadTarget(db, request);
        var applyOutcome = AppendLedgerEffect(db, request, command, target, domainEventId, now);
        var afterSnapshot = new Dictionary<string, object?>(target.BeforeSnapshot);
        afterSnapshot["correctionRequestId"] = request.CorrectionRequestId;
        afterSnapshot["correctionEventId"] = appliedEventId;
        afterSnapshot["ledgerEffectId"] = applyOutcome.AppendedLedgerEntryId;
        afterSnapshot["ledgerEffectAmount"] = applyOutcome.Amount;
        afterSnapshot["status"] = "corrected";

        InsertEventsForApply(db, request, command, target, reversalEventId, domainEventId, appliedEventId, applyOutcome, now);
        InsertReversalEntry(db, request, reversalId, reversalEventId, applyReason, command.ActorId, now);
        InsertCorrectionEntry(db, request, correctionEntryId, appliedEventId, target.BeforeSnapshot, afterSnapshot, now);
        var lateAdjustmentRecorded = InsertPeriodLateAdjustmentIfClosed(db, request, target, target.BeforeSnapshot, afterSnapshot, appliedEventId, now);

        var rebuilds = RebuildBalances(db, request, target, appliedEventId, now);
        UpdateRequestStatus(db, request.TenantId, request.CorrectionRequestId, "applied", now);
        UpdateCorrectionCaseStatus(db, request.TenantId, request.CorrectionRequestId, "applied", now);
        InsertCorrectionAudit(db, request.TenantId, request.CorrectionRequestId, command.ActorId, "applied", new
        {
            command.WorkItemId,
            request.TargetLedgerType,
            request.TargetEntryId,
            request.CorrectionType,
            reversalId,
            correctionEntryId,
            reversalEventId,
            domainEventId,
            appliedEventId,
            applyOutcome.DomainEventType,
            applyOutcome.AppendedLedgerEntryId,
            applyOutcome.Amount,
            lateAdjustmentRecorded
        }, now);
        db.Commit();

        return new LedgerCorrectionApplyResult(
            request.CorrectionRequestId,
            request.TenantId,
            "applied",
            request.TargetLedgerType,
            request.TargetEntryId,
            reversalId,
            correctionEntryId,
            new[] { reversalEventId, domainEventId, appliedEventId },
            rebuilds,
            lateAdjustmentRecorded);
    }

    private ProcessWorkItemIntentRecord RecordCorrectionWorkItemIntent(
        LedgerCorrectionRequestCommand command,
        string correctionRequestId,
        string eventId,
        string status,
        DateTimeOffset createdAtUtc)
    {
        var processRunId = $"process-{StableHash(command.TenantId, correctionRequestId, CorrectionCenterProcessRuleIds.CorrectionRequestedCreatesWorkItem)}";
        var workItemId = $"wi-correction-{StableHash(command.TenantId, correctionRequestId)}";
        var workItemType = IsHighRisk(command.RiskLevel) ? "ledgerCorrectionApproval" : "ledgerCorrectionApply";
        var intent = new ProcessWorkItemIntentRecord(
            $"intent-{StableHash(processRunId, workItemId)}",
            processRunId,
            command.TenantId,
            workItemId,
            workItemType,
            "CorrectionCenter",
            IsHighRisk(command.RiskLevel) ? "finance" : "operator",
            eventId,
            "open",
            createdAtUtc,
            new Dictionary<string, string>
            {
                ["correctionRequestId"] = correctionRequestId,
                ["sourceWorkItemId"] = command.WorkItemId,
                ["targetLedgerType"] = command.TargetLedgerType,
                ["targetEntryId"] = command.TargetEntryId,
                ["correctionType"] = command.CorrectionType,
                ["riskLevel"] = command.RiskLevel,
                ["requestStatus"] = status
            });
        var run = new ProcessRunRecord(
            processRunId,
            command.TenantId,
            eventId,
            CorrectionCenterEvents.LedgerCorrectionRequested,
            CorrectionCenterProcessRuleIds.CorrectionRequestedCreatesWorkItem,
            "completed",
            createdAtUtc,
            new Dictionary<string, string>
            {
                ["correctionRequestId"] = correctionRequestId,
                ["targetLedgerType"] = command.TargetLedgerType,
                ["targetEntryId"] = command.TargetEntryId
            });

        processRunSink.TryRecordProcessRun(run, new[] { intent }, Array.Empty<ProcessRequestEventIntentRecord>());
        return intent;
    }

    private static void AddCommandParameters(Npgsql.NpgsqlCommand command, LedgerCorrectionRequestCommand value)
    {
        command.Parameters.AddWithValue("tenantId", value.TenantId);
        AddNullableTextParameter(command, "caseId", value.CaseId);
        command.Parameters.AddWithValue("targetLedgerType", value.TargetLedgerType);
        command.Parameters.AddWithValue("targetEntryId", value.TargetEntryId);
        command.Parameters.AddWithValue("targetObjectType", value.TargetObjectType);
        command.Parameters.AddWithValue("targetObjectId", value.TargetObjectId);
        command.Parameters.AddWithValue("correctionType", value.CorrectionType);
        command.Parameters.AddWithValue("reason", value.Reason);
        command.Parameters.AddWithValue("requestedBy", value.RequestedBy);
        command.Parameters.AddWithValue("riskLevel", value.RiskLevel);
    }

    private static void InsertCorrectionCase(
        RuntimeDbSession db,
        string correctionRequestId,
        LedgerCorrectionRequestCommand command,
        string status,
        DateTimeOffset now)
    {
        using var insert = db.CreateCommand("""
            insert into correction_cases(
                correction_case_id, tenant_id, correction_request_id, case_id, owner_role,
                owner_actor_id, status, due_at_utc, body, created_at_utc, updated_at_utc)
            values (
                @correctionCaseId, @tenantId, @correctionRequestId, @caseId, @ownerRole,
                null, 'open', @dueAtUtc, @body::jsonb, @createdAtUtc, @updatedAtUtc)
            on conflict(tenant_id, correction_request_id) do nothing
            """);
        insert.Parameters.AddWithValue("correctionCaseId", $"ccase-{StableHash(command.TenantId, correctionRequestId)}");
        insert.Parameters.AddWithValue("tenantId", command.TenantId);
        insert.Parameters.AddWithValue("correctionRequestId", correctionRequestId);
        insert.Parameters.AddWithValue("caseId", string.IsNullOrWhiteSpace(command.CaseId) ? $"correction-case-{StableHash(command.TenantId, correctionRequestId)}" : command.CaseId!);
        insert.Parameters.AddWithValue("ownerRole", IsHighRisk(command.RiskLevel) ? "finance" : "operator");
        insert.Parameters.AddWithValue("dueAtUtc", now.AddHours(IsHighRisk(command.RiskLevel) ? 24 : 72));
        insert.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new
        {
            correctionRequestId,
            sourceWorkItemId = command.WorkItemId,
            command.TargetLedgerType,
            command.TargetEntryId,
            command.CorrectionType,
            command.RiskLevel,
            requestStatus = status
        }, PostgresProjectionStore.JsonOptions));
        insert.Parameters.AddWithValue("createdAtUtc", now);
        insert.Parameters.AddWithValue("updatedAtUtc", now);
        insert.ExecuteNonQuery();
    }

    private void InsertDecisionEventAndAudit(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        string eventId,
        string eventType,
        string actorId,
        string action,
        string note,
        DateTimeOffset now)
    {
        var workspaceEvent = Event(
            request.TenantId,
            eventId,
            eventType,
            request.TargetEntryId,
            request.CorrectionRequestId,
            request.CorrectionRequestId,
            "finance",
            actorId,
            now,
            new Dictionary<string, string>
            {
                ["correctionRequestId"] = request.CorrectionRequestId,
                ["targetLedgerType"] = request.TargetLedgerType,
                ["targetEntryId"] = request.TargetEntryId,
                ["correctionType"] = request.CorrectionType,
                ["riskLevel"] = request.RiskLevel,
                ["result"] = action,
                ["note"] = note
            });
        events.InsertAuditEventAndOutbox(db, workspaceEvent, $"correction-{action}:{request.CorrectionRequestId}:{actorId}");
        InsertCorrectionAudit(db, request.TenantId, request.CorrectionRequestId, actorId, action, new { note }, now);
    }

    private static LedgerCorrectionRequestRow LoadRequestForUpdate(RuntimeDbSession db, string tenantId, string correctionRequestId)
    {
        using var command = db.CreateCommand("""
            select correction_request_id, tenant_id, case_id, target_ledger_type, target_entry_id,
                   target_object_type, target_object_id, correction_type, reason, requested_by,
                   status, risk_level, created_at_utc, updated_at_utc
            from ledger_correction_requests
            where tenant_id = @tenantId
              and correction_request_id = @correctionRequestId
            for update
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("correctionRequestId", correctionRequestId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("correction_request_not_found");
        }

        return new LedgerCorrectionRequestRow(
            reader.GetString(0),
            reader.GetString(1),
            reader.IsDBNull(2) ? null : reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetString(6),
            reader.GetString(7),
            reader.GetString(8),
            reader.GetString(9),
            reader.GetString(10),
            reader.GetString(11),
            reader.GetFieldValue<DateTimeOffset>(12),
            reader.GetFieldValue<DateTimeOffset>(13));
    }

    private static void UpdateRequestStatus(RuntimeDbSession db, string tenantId, string correctionRequestId, string status, DateTimeOffset now)
    {
        using var command = db.CreateCommand("""
            update ledger_correction_requests
            set status = @status,
                updated_at_utc = @updatedAtUtc
            where tenant_id = @tenantId
              and correction_request_id = @correctionRequestId
            """);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("updatedAtUtc", now);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("correctionRequestId", correctionRequestId);
        command.ExecuteNonQuery();
    }

    private static void UpdateCorrectionCaseStatus(RuntimeDbSession db, string tenantId, string correctionRequestId, string status, DateTimeOffset now)
    {
        using var command = db.CreateCommand("""
            update correction_cases
            set status = @status,
                updated_at_utc = @updatedAtUtc
            where tenant_id = @tenantId
              and correction_request_id = @correctionRequestId
            """);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("updatedAtUtc", now);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("correctionRequestId", correctionRequestId);
        command.ExecuteNonQuery();
    }

    private static bool HasApprovedDecision(RuntimeDbSession db, string tenantId, string correctionRequestId)
    {
        using var command = db.CreateCommand("""
            select count(*)
            from correction_approvals
            where tenant_id = @tenantId
              and correction_request_id = @correctionRequestId
              and result = 'approved'
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("correctionRequestId", correctionRequestId);
        return Convert.ToInt32(command.ExecuteScalar() ?? 0) > 0;
    }

    private static LedgerTargetSnapshot LoadTarget(RuntimeDbSession db, LedgerCorrectionRequestRow request) =>
        request.TargetLedgerType switch
        {
            "payment" => request.CorrectionType == "allocation_reversal"
                ? LoadPaymentAllocationTarget(db, request)
                : LoadPaymentTarget(db, request),
            "deposit" or "refund" => LoadDepositTransactionTarget(db, request),
            "charge" => LoadChargeTarget(db, request),
            _ => throw new InvalidOperationException("correction_target_ledger_unsupported")
        };

    private static LedgerTargetSnapshot LoadPaymentAllocationTarget(RuntimeDbSession db, LedgerCorrectionRequestRow request)
    {
        using var command = db.CreateCommand("""
            select allocation.allocation_id, allocation.payment_id, allocation.workspace_id,
                   allocation.allocation_mode, allocation.allocated_amount, allocation.status,
                   allocation.created_event_id, allocation.occurred_at_utc, payment.folio_id, payment.currency
            from payment_allocations allocation
            join hostel_payments payment on payment.payment_id = allocation.payment_id
            where allocation.workspace_id = @tenantId
              and allocation.allocation_id = @targetEntryId
            """);
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        command.Parameters.AddWithValue("targetEntryId", request.TargetEntryId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("correction_target_entry_not_found");
        }

        var snapshot = new Dictionary<string, object?>
        {
            ["allocationId"] = reader.GetString(0),
            ["paymentId"] = reader.GetString(1),
            ["tenantId"] = reader.GetString(2),
            ["allocationMode"] = reader.GetString(3),
            ["allocatedAmount"] = reader.GetDecimal(4),
            ["status"] = reader.GetString(5),
            ["createdEventId"] = reader.GetString(6),
            ["occurredAtUtc"] = reader.GetFieldValue<DateTimeOffset>(7),
            ["stayId"] = reader.GetString(8),
            ["currency"] = reader.GetString(9)
        };
        return new LedgerTargetSnapshot(request.TargetEntryId, reader.GetString(2), reader.GetString(1), reader.GetString(8), null, reader.GetString(9), reader.GetDecimal(4), reader.GetFieldValue<DateTimeOffset>(7), snapshot, "payment_allocation");
    }

    private static LedgerTargetSnapshot LoadPaymentTarget(RuntimeDbSession db, LedgerCorrectionRequestRow request)
    {
        using var command = db.CreateCommand("""
            select payment_id, workspace_id, folio_id, amount, currency, method, purpose, status, created_event_id, updated_at_utc
            from hostel_payments
            where workspace_id = @tenantId
              and payment_id = @targetEntryId
            """);
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        command.Parameters.AddWithValue("targetEntryId", request.TargetEntryId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("correction_target_entry_not_found");
        }

        var snapshot = new Dictionary<string, object?>
        {
            ["paymentId"] = reader.GetString(0),
            ["tenantId"] = reader.GetString(1),
            ["stayId"] = reader.GetString(2),
            ["amount"] = reader.GetDecimal(3),
            ["currency"] = reader.GetString(4),
            ["method"] = reader.GetString(5),
            ["purpose"] = reader.GetString(6),
            ["status"] = reader.GetString(7),
            ["createdEventId"] = reader.GetString(8),
            ["updatedAtUtc"] = reader.GetFieldValue<DateTimeOffset>(9)
        };
        return new LedgerTargetSnapshot(request.TargetEntryId, reader.GetString(1), reader.GetString(0), reader.GetString(2), null, reader.GetString(4), reader.GetDecimal(3), reader.GetFieldValue<DateTimeOffset>(9), snapshot, "payment");
    }

    private static LedgerTargetSnapshot LoadDepositTransactionTarget(RuntimeDbSession db, LedgerCorrectionRequestRow request)
    {
        using var command = db.CreateCommand("""
            select transaction_id, deposit_id, workspace_id, transaction_type, amount, currency, status, actor_id, created_event_id, occurred_at_utc
            from deposit_transactions
            where workspace_id = @tenantId
              and transaction_id = @targetEntryId
            """);
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        command.Parameters.AddWithValue("targetEntryId", request.TargetEntryId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("correction_target_entry_not_found");
        }

        var snapshot = new Dictionary<string, object?>
        {
            ["transactionId"] = reader.GetString(0),
            ["depositId"] = reader.GetString(1),
            ["tenantId"] = reader.GetString(2),
            ["transactionType"] = reader.GetString(3),
            ["amount"] = reader.GetDecimal(4),
            ["currency"] = reader.GetString(5),
            ["status"] = reader.GetString(6),
            ["actorId"] = reader.GetString(7),
            ["createdEventId"] = reader.GetString(8),
            ["occurredAtUtc"] = reader.GetFieldValue<DateTimeOffset>(9)
        };
        return new LedgerTargetSnapshot(request.TargetEntryId, reader.GetString(2), null, null, reader.GetString(1), reader.GetString(5), reader.GetDecimal(4), reader.GetFieldValue<DateTimeOffset>(9), snapshot, "deposit_transaction");
    }

    private static LedgerTargetSnapshot LoadChargeTarget(RuntimeDbSession db, LedgerCorrectionRequestRow request)
    {
        using var command = db.CreateCommand("""
            select charge_id, workspace_id, stay_id, charge_type, period_start_utc, period_end_utc, amount, currency, reason, status, created_event_id, updated_at_utc
            from hostel_charges
            where workspace_id = @tenantId
              and charge_id = @targetEntryId
            """);
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        command.Parameters.AddWithValue("targetEntryId", request.TargetEntryId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("correction_target_entry_not_found");
        }

        var snapshot = new Dictionary<string, object?>
        {
            ["chargeId"] = reader.GetString(0),
            ["tenantId"] = reader.GetString(1),
            ["stayId"] = reader.GetString(2),
            ["chargeType"] = reader.GetString(3),
            ["periodStartUtc"] = reader.GetFieldValue<DateTimeOffset>(4),
            ["periodEndUtc"] = reader.GetFieldValue<DateTimeOffset>(5),
            ["amount"] = reader.GetDecimal(6),
            ["currency"] = reader.GetString(7),
            ["reason"] = reader.GetString(8),
            ["status"] = reader.GetString(9),
            ["createdEventId"] = reader.GetString(10),
            ["updatedAtUtc"] = reader.GetFieldValue<DateTimeOffset>(11)
        };
        return new LedgerTargetSnapshot(request.TargetEntryId, reader.GetString(1), null, reader.GetString(2), null, reader.GetString(7), reader.GetDecimal(6), reader.GetFieldValue<DateTimeOffset>(4), snapshot, "charge");
    }

    private static LedgerApplyOutcome AppendLedgerEffect(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        LedgerCorrectionApplyCommand command,
        LedgerTargetSnapshot target,
        string domainEventId,
        DateTimeOffset now) =>
        target.Kind switch
        {
            "payment_allocation" => AppendPaymentAllocationReversal(db, target, domainEventId, now),
            "payment" => AppendPaymentCorrection(db, target, command, domainEventId, now),
            "deposit_transaction" => AppendDepositTransactionReversal(db, target, domainEventId, now),
            "charge" => AppendChargeAdjustment(db, request, target, command, domainEventId, now),
            _ => throw new InvalidOperationException("correction_target_ledger_unsupported")
        };

    private static LedgerApplyOutcome AppendPaymentAllocationReversal(RuntimeDbSession db, LedgerTargetSnapshot target, string eventId, DateTimeOffset now)
    {
        var allocationId = $"allocation-correction-{StableHash(eventId)}";
        using var command = db.CreateCommand("""
            insert into payment_allocations(allocation_id, payment_id, workspace_id, allocation_mode, allocated_amount, status, created_event_id, occurred_at_utc)
            values (@allocationId, @paymentId, @tenantId, 'correction_reversal', @allocatedAmount, 'reversed', @createdEventId, @occurredAtUtc)
            """);
        command.Parameters.AddWithValue("allocationId", allocationId);
        command.Parameters.AddWithValue("paymentId", target.PaymentId!);
        command.Parameters.AddWithValue("tenantId", target.TenantId);
        command.Parameters.AddWithValue("allocatedAmount", NpgsqlDbType.Numeric, -Math.Abs(target.Amount));
        command.Parameters.AddWithValue("createdEventId", eventId);
        command.Parameters.AddWithValue("occurredAtUtc", now);
        command.ExecuteNonQuery();
        return new LedgerApplyOutcome(allocationId, -Math.Abs(target.Amount), CorrectionCenterEvents.PaymentAllocationReversed);
    }

    private static LedgerApplyOutcome AppendPaymentCorrection(RuntimeDbSession db, LedgerTargetSnapshot target, LedgerCorrectionApplyCommand apply, string eventId, DateTimeOffset now)
    {
        var reconciliationId = $"finance-correction-{StableHash(eventId)}";
        var amount = apply.AdjustmentAmount ?? -Math.Abs(target.Amount);
        using var command = db.CreateCommand("""
            insert into finance_reconciliations(
                reconciliation_id, workspace_id, payment_id, channel, confirmed_amount, currency,
                match_result, variance_amount, status, confirmed_by, created_event_id, updated_at_utc)
            values (
                @reconciliationId, @tenantId, @paymentId, 'correction', @confirmedAmount, @currency,
                'correction', 0, 'confirmed', @confirmedBy, @createdEventId, @updatedAtUtc)
            """);
        command.Parameters.AddWithValue("reconciliationId", reconciliationId);
        command.Parameters.AddWithValue("tenantId", target.TenantId);
        command.Parameters.AddWithValue("paymentId", target.PaymentId!);
        command.Parameters.AddWithValue("confirmedAmount", NpgsqlDbType.Numeric, amount);
        command.Parameters.AddWithValue("currency", target.Currency);
        command.Parameters.AddWithValue("confirmedBy", apply.ActorId);
        command.Parameters.AddWithValue("createdEventId", eventId);
        command.Parameters.AddWithValue("updatedAtUtc", now);
        command.ExecuteNonQuery();
        return new LedgerApplyOutcome(reconciliationId, amount, CorrectionCenterEvents.PaymentAdjustmentLite);
    }

    private static LedgerApplyOutcome AppendDepositTransactionReversal(RuntimeDbSession db, LedgerTargetSnapshot target, string eventId, DateTimeOffset now)
    {
        var transactionId = $"deposit-correction-{StableHash(eventId)}";
        var transactionType = Convert.ToString(target.BeforeSnapshot["transactionType"]) ?? "reversal";
        using var command = db.CreateCommand("""
            insert into deposit_transactions(transaction_id, deposit_id, workspace_id, transaction_type, amount, currency, status, actor_id, created_event_id, occurred_at_utc)
            values (@transactionId, @depositId, @tenantId, @transactionType, @amount, @currency, 'reversed', 'correction-center', @createdEventId, @occurredAtUtc)
            """);
        command.Parameters.AddWithValue("transactionId", transactionId);
        command.Parameters.AddWithValue("depositId", target.DepositId!);
        command.Parameters.AddWithValue("tenantId", target.TenantId);
        command.Parameters.AddWithValue("transactionType", transactionType);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, -Math.Abs(target.Amount));
        command.Parameters.AddWithValue("currency", target.Currency);
        command.Parameters.AddWithValue("createdEventId", eventId);
        command.Parameters.AddWithValue("occurredAtUtc", now);
        command.ExecuteNonQuery();
        return new LedgerApplyOutcome(transactionId, -Math.Abs(target.Amount), CorrectionCenterEvents.DepositEntryReversed);
    }

    private static LedgerApplyOutcome AppendChargeAdjustment(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        LedgerTargetSnapshot target,
        LedgerCorrectionApplyCommand apply,
        string eventId,
        DateTimeOffset now)
    {
        var chargeId = $"charge-correction-{StableHash(eventId)}";
        var amount = apply.AdjustmentAmount ?? -Math.Abs(target.Amount);
        var periodStart = target.OccurredAtUtc;
        var periodEnd = periodStart.AddDays(1);
        using var command = db.CreateCommand("""
            insert into hostel_charges(charge_id, workspace_id, stay_id, charge_type, period_start_utc, period_end_utc, amount, currency, reason, status, created_event_id, updated_at_utc)
            values (@chargeId, @tenantId, @stayId, 'correction_adjustment', @periodStartUtc, @periodEndUtc, @amount, @currency, @reason, 'assessed', @createdEventId, @updatedAtUtc)
            """);
        command.Parameters.AddWithValue("chargeId", chargeId);
        command.Parameters.AddWithValue("tenantId", target.TenantId);
        command.Parameters.AddWithValue("stayId", target.StayId!);
        command.Parameters.AddWithValue("periodStartUtc", periodStart);
        command.Parameters.AddWithValue("periodEndUtc", periodEnd);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, amount);
        command.Parameters.AddWithValue("currency", target.Currency);
        command.Parameters.AddWithValue("reason", request.Reason);
        command.Parameters.AddWithValue("createdEventId", eventId);
        command.Parameters.AddWithValue("updatedAtUtc", now);
        command.ExecuteNonQuery();
        return new LedgerApplyOutcome(chargeId, amount, CorrectionCenterEvents.ChargeAdjusted);
    }

    private void InsertEventsForApply(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        LedgerCorrectionApplyCommand command,
        LedgerTargetSnapshot target,
        string reversalEventId,
        string domainEventId,
        string appliedEventId,
        LedgerApplyOutcome outcome,
        DateTimeOffset now)
    {
        foreach (var (eventId, eventType) in new[]
        {
            (reversalEventId, CorrectionCenterEvents.LedgerEntryReversed),
            (domainEventId, outcome.DomainEventType),
            (appliedEventId, CorrectionCenterEvents.LedgerCorrectionApplied)
        })
        {
            var workspaceEvent = Event(
                request.TenantId,
                eventId,
                eventType,
                request.TargetEntryId,
                request.CorrectionRequestId,
                command.WorkItemId,
                "operator",
                command.ActorId,
                now,
                new Dictionary<string, string>
                {
                    ["correctionRequestId"] = request.CorrectionRequestId,
                    ["workItemId"] = command.WorkItemId,
                    ["targetLedgerType"] = request.TargetLedgerType,
                    ["targetEntryId"] = request.TargetEntryId,
                    ["targetObjectType"] = request.TargetObjectType,
                    ["targetObjectId"] = request.TargetObjectId,
                    ["correctionType"] = request.CorrectionType,
                    ["ledgerEffectId"] = outcome.AppendedLedgerEntryId,
                    ["ledgerEffectAmount"] = outcome.Amount.ToString(System.Globalization.CultureInfo.InvariantCulture),
                    ["stayId"] = target.StayId ?? string.Empty,
                    ["depositId"] = target.DepositId ?? string.Empty
                });
            events.InsertAuditEventAndOutbox(db, workspaceEvent, $"correction-apply:{request.CorrectionRequestId}:{eventType}");
        }
    }

    private static void InsertReversalEntry(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        string reversalId,
        string reversalEventId,
        string reason,
        string actorId,
        DateTimeOffset now)
    {
        using var command = db.CreateCommand("""
            insert into ledger_reversal_entries(
                reversal_id, tenant_id, correction_request_id, target_ledger_type,
                target_entry_id, reversal_event_id, reason, created_by, created_at_utc)
            values (
                @reversalId, @tenantId, @correctionRequestId, @targetLedgerType,
                @targetEntryId, @reversalEventId, @reason, @createdBy, @createdAtUtc)
            """);
        command.Parameters.AddWithValue("reversalId", reversalId);
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        command.Parameters.AddWithValue("correctionRequestId", request.CorrectionRequestId);
        command.Parameters.AddWithValue("targetLedgerType", request.TargetLedgerType);
        command.Parameters.AddWithValue("targetEntryId", request.TargetEntryId);
        command.Parameters.AddWithValue("reversalEventId", reversalEventId);
        command.Parameters.AddWithValue("reason", reason);
        command.Parameters.AddWithValue("createdBy", actorId);
        command.Parameters.AddWithValue("createdAtUtc", now);
        command.ExecuteNonQuery();
    }

    private static void InsertCorrectionEntry(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        string correctionEntryId,
        string correctionEventId,
        IReadOnlyDictionary<string, object?> beforeSnapshot,
        IReadOnlyDictionary<string, object?> afterSnapshot,
        DateTimeOffset now)
    {
        using var command = db.CreateCommand("""
            insert into ledger_correction_entries(
                correction_entry_id, tenant_id, correction_request_id, correction_event_id,
                before_snapshot, after_snapshot, created_at_utc)
            values (
                @correctionEntryId, @tenantId, @correctionRequestId, @correctionEventId,
                @beforeSnapshot::jsonb, @afterSnapshot::jsonb, @createdAtUtc)
            """);
        command.Parameters.AddWithValue("correctionEntryId", correctionEntryId);
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        command.Parameters.AddWithValue("correctionRequestId", request.CorrectionRequestId);
        command.Parameters.AddWithValue("correctionEventId", correctionEventId);
        command.Parameters.AddWithValue("beforeSnapshot", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(beforeSnapshot, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("afterSnapshot", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(afterSnapshot, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("createdAtUtc", now);
        command.ExecuteNonQuery();
    }

    private static bool InsertPeriodLateAdjustmentIfClosed(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        LedgerTargetSnapshot target,
        IReadOnlyDictionary<string, object?> beforeSnapshot,
        IReadOnlyDictionary<string, object?> afterSnapshot,
        string appliedEventId,
        DateTimeOffset now)
    {
        using var find = db.CreateCommand("""
            select period_id
            from period_reviews
            where workspace_id = @tenantId
              and status = 'closed'
              and @occurredAtUtc >= period_start_utc
              and @occurredAtUtc < period_end_utc
            order by period_end_utc desc
            limit 1
            """);
        find.Parameters.AddWithValue("tenantId", request.TenantId);
        find.Parameters.AddWithValue("occurredAtUtc", target.OccurredAtUtc);
        var periodId = Convert.ToString(find.ExecuteScalar());
        if (string.IsNullOrWhiteSpace(periodId))
        {
            return false;
        }

        using var insert = db.CreateCommand("""
            insert into period_late_adjustments(
                adjustment_id, period_id, workspace_id, adjustment_event_type,
                adjustment_payload, created_event_id, occurred_at_utc)
            values (
                @adjustmentId, @periodId, @tenantId, 'LedgerCorrectionApplied',
                @payload::jsonb, @createdEventId, @occurredAtUtc)
            on conflict(adjustment_id) do nothing
            """);
        insert.Parameters.AddWithValue("adjustmentId", $"late-correction-{StableHash(request.TenantId, request.CorrectionRequestId, appliedEventId)}");
        insert.Parameters.AddWithValue("periodId", periodId!);
        insert.Parameters.AddWithValue("tenantId", request.TenantId);
        insert.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new
        {
            request.CorrectionRequestId,
            request.TargetLedgerType,
            request.TargetEntryId,
            request.CorrectionType,
            before = beforeSnapshot,
            after = afterSnapshot,
            note = "Closed period snapshot is not edited; MR-10 handles late adjustment governance."
        }, PostgresProjectionStore.JsonOptions));
        insert.Parameters.AddWithValue("createdEventId", appliedEventId);
        insert.Parameters.AddWithValue("occurredAtUtc", now);
        insert.ExecuteNonQuery();
        return true;
    }

    private static IReadOnlyList<string> RebuildBalances(
        RuntimeDbSession db,
        LedgerCorrectionRequestRow request,
        LedgerTargetSnapshot target,
        string eventId,
        DateTimeOffset now)
    {
        var rebuilds = new List<string>();
        if (!string.IsNullOrWhiteSpace(target.StayId))
        {
            RebuildStayBalance(db, request.TenantId, target.StayId!, target.Currency, eventId, now);
            rebuilds.Add("StayBalance");
        }

        if (!string.IsNullOrWhiteSpace(target.DepositId))
        {
            RebuildDepositBalance(db, request.TenantId, target.DepositId!, target.Currency, eventId, now);
            rebuilds.Add("DepositBalance");
        }

        return rebuilds;
    }

    private static void RebuildStayBalance(RuntimeDbSession db, string tenantId, string stayId, string currency, string eventId, DateTimeOffset now)
    {
        using var command = db.CreateCommand("""
            with totals as (
                select
                    coalesce((select sum(amount) from hostel_charges where workspace_id = @tenantId and stay_id = @stayId), 0) as total_charges,
                    coalesce((
                        select sum(reconciliation.confirmed_amount)
                        from finance_reconciliations reconciliation
                        join hostel_payments payment on payment.payment_id = reconciliation.payment_id
                        where payment.workspace_id = @tenantId
                          and payment.folio_id = @stayId
                          and reconciliation.status = 'confirmed'
                    ), 0) as confirmed_payments,
                    coalesce((
                        select sum(allocation.allocated_amount)
                        from payment_allocations allocation
                        join hostel_payments payment on payment.payment_id = allocation.payment_id
                        where payment.workspace_id = @tenantId
                          and payment.folio_id = @stayId
                    ), 0) as allocated_payments
            )
            insert into stay_balances(
                stay_id, workspace_id, total_charges, confirmed_payments,
                allocated_payments, balance, currency, status, created_event_id, updated_at_utc)
            select
                @stayId, @tenantId, total_charges, confirmed_payments,
                allocated_payments, greatest(total_charges - allocated_payments, 0),
                @currency, 'correction_rebuilt', @eventId, @updatedAtUtc
            from totals
            on conflict(stay_id) do update set
                total_charges = excluded.total_charges,
                confirmed_payments = excluded.confirmed_payments,
                allocated_payments = excluded.allocated_payments,
                balance = excluded.balance,
                currency = excluded.currency,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("stayId", stayId);
        command.Parameters.AddWithValue("currency", currency);
        command.Parameters.AddWithValue("eventId", eventId);
        command.Parameters.AddWithValue("updatedAtUtc", now);
        command.ExecuteNonQuery();
    }

    private static void RebuildDepositBalance(RuntimeDbSession db, string tenantId, string depositId, string currency, string eventId, DateTimeOffset now)
    {
        using var command = db.CreateCommand("""
            with totals as (
                select
                    coalesce(sum(amount) filter (where transaction_type = 'confirmed'), 0) as confirmed,
                    coalesce(sum(amount) filter (where transaction_type = 'received'), 0) as received,
                    coalesce(sum(amount) filter (where transaction_type = 'deducted'), 0) as deducted,
                    coalesce(sum(amount) filter (where transaction_type = 'applied_to_balance'), 0) as applied,
                    coalesce(sum(amount) filter (where transaction_type = 'refund_paid'), 0) as refund_paid
                from deposit_transactions
                where workspace_id = @tenantId
                  and deposit_id = @depositId
            )
            update deposit_liabilities
            set received_amount = greatest((select received from totals), 0),
                liability_balance = greatest((select confirmed - deducted - applied - refund_paid from totals), 0),
                currency = @currency,
                status = 'correction_rebuilt',
                updated_at_utc = @updatedAtUtc
            where workspace_id = @tenantId
              and deposit_id = @depositId
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("depositId", depositId);
        command.Parameters.AddWithValue("currency", currency);
        command.Parameters.AddWithValue("eventId", eventId);
        command.Parameters.AddWithValue("updatedAtUtc", now);
        command.ExecuteNonQuery();
    }

    private static void InsertCorrectionAudit(
        RuntimeDbSession db,
        string tenantId,
        string correctionRequestId,
        string actorId,
        string action,
        object payload,
        DateTimeOffset now)
    {
        using var command = db.CreateCommand("""
            insert into correction_audit(
                audit_id, tenant_id, correction_request_id, actor_id, action, payload, occurred_at_utc)
            values (
                @auditId, @tenantId, @correctionRequestId, @actorId, @action, @payload::jsonb, @occurredAtUtc)
            """);
        command.Parameters.AddWithValue("auditId", $"correction-audit-{Guid.NewGuid():N}");
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("correctionRequestId", correctionRequestId);
        command.Parameters.AddWithValue("actorId", actorId);
        command.Parameters.AddWithValue("action", action);
        command.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(payload, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("occurredAtUtc", now);
        command.ExecuteNonQuery();
    }

    private static WorkspaceEvent Event(
        string tenantId,
        string eventId,
        string eventType,
        string correlationId,
        string causationId,
        string requestId,
        string actorType,
        string actorId,
        DateTimeOffset occurredAtUtc,
        IReadOnlyDictionary<string, string> payload) =>
        new(
            eventId,
            tenantId,
            "ledgerCorrection",
            eventType,
            correlationId,
            causationId,
            requestId,
            actorType,
            actorId,
            occurredAtUtc,
            payload,
            new[] { "CorrectionCenter" });

    private static bool IsHighRisk(string riskLevel) =>
        riskLevel.Equals("high", StringComparison.OrdinalIgnoreCase) ||
        riskLevel.Equals("critical", StringComparison.OrdinalIgnoreCase);

    private static void AddNullableTextParameter(Npgsql.NpgsqlCommand command, string name, string? value)
    {
        command.Parameters.AddWithValue(name, NpgsqlDbType.Text, (object?)value ?? DBNull.Value);
    }

    private static string StableHash(params string[] parts)
    {
        var value = string.Join("|", parts);
        var hash = 2166136261u;
        foreach (var ch in value)
        {
            hash ^= ch;
            hash *= 16777619;
        }

        return hash.ToString("x8", System.Globalization.CultureInfo.InvariantCulture);
    }

    private sealed record LedgerTargetSnapshot(
        string EntryId,
        string TenantId,
        string? PaymentId,
        string? StayId,
        string? DepositId,
        string Currency,
        decimal Amount,
        DateTimeOffset OccurredAtUtc,
        IReadOnlyDictionary<string, object?> BeforeSnapshot,
        string Kind);

    private sealed record LedgerApplyOutcome(
        string AppendedLedgerEntryId,
        decimal Amount,
        string DomainEventType);
}
