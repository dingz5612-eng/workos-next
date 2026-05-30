using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeReconciliationMismatchCaseStorage : IReconciliationMismatchCaseStore
{
    private readonly PostgresConnectionFactory connections;
    private readonly ICheckoutServiceProcessRunSink processRunSink;
    private readonly ReconciliationProcessManager processManager = new();

    public RuntimeReconciliationMismatchCaseStorage(
        PostgresConnectionFactory connections,
        ICheckoutServiceProcessRunSink processRunSink)
    {
        this.connections = connections;
        this.processRunSink = processRunSink;
    }

    public ReconciliationMismatchDetectionResult DetectMismatches(ReconciliationMismatchDetectionRequest request)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);

        InsertUnmatchedBankTransactions(db, request);
        InsertConfirmedPaymentsWithoutBankMatch(db, request);
        InsertAmountMismatches(db, request);
        InsertCurrencyMismatches(db, request);
        InsertDuplicateBankTransactions(db, request);
        InsertEvidenceAmountMismatches(db, request);
        InsertRefundsWithoutBankDebit(db, request);

        var cases = CreateCasesForOpenMismatches(db, request.TenantId, null, "runtime");
        db.Commit();

        var intents = DispatchProcessWorkItems(cases, "runtime");
        return new ReconciliationMismatchDetectionResult(cases.Count, cases, intents);
    }

    public ReconciliationCaseRecord CreateCaseForMismatch(string tenantId, string mismatchId, string actorId)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var cases = CreateCasesForOpenMismatches(db, tenantId, mismatchId, actorId);
        var record = cases.SingleOrDefault() ?? LoadExistingCase(db, tenantId, mismatchId);
        if (record is null)
        {
            throw new InvalidOperationException("reconciliation_mismatch_not_found");
        }

        db.Commit();
        DispatchProcessWorkItems(new[] { record }, actorId);
        return record;
    }

    private static void InsertUnmatchedBankTransactions(RuntimeDbSession db, ReconciliationMismatchDetectionRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            select
                'mismatch-' || md5(transaction.tenant_id || ':unmatched-bank:' || transaction.bank_transaction_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                null,
                null,
                'unmatched_bank_transaction',
                'Bank transaction has no open Payment, Deposit, or Refund candidate.',
                'open',
                now(),
                null
            from bank_transactions transaction
            where transaction.tenant_id = @tenantId
              and transaction.status in ('imported', 'candidate_created')
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
              and not exists (
                  select 1 from payment_match_candidates candidate
                  where candidate.tenant_id = transaction.tenant_id
                    and candidate.bank_transaction_id = transaction.bank_transaction_id
                    and candidate.status in ('proposed', 'reviewing')
              )
              and not exists (
                  select 1 from payment_matches active_match
                  where active_match.tenant_id = transaction.tenant_id
                    and active_match.bank_transaction_id = transaction.bank_transaction_id
                    and active_match.status = 'matched'
              )
            on conflict(mismatch_id) do nothing
            """);
        AddDetectionParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void InsertConfirmedPaymentsWithoutBankMatch(RuntimeDbSession db, ReconciliationMismatchDetectionRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            select
                'mismatch-' || md5(payment.workspace_id || ':confirmed-payment-no-bank-match:' || payment.payment_id),
                payment.workspace_id,
                null,
                'payment',
                payment.payment_id,
                'confirmed_payment_without_bank_match',
                'Confirmed payment has no bank match after the configured threshold.',
                'open',
                now(),
                null
            from hostel_payments payment
            where payment.workspace_id = @tenantId
              and payment.status = 'confirmed'
              and payment.updated_at_utc <= now() - (@paymentThresholdDays * interval '1 day')
              and not exists (
                  select 1 from payment_matches active_match
                  where active_match.tenant_id = payment.workspace_id
                    and active_match.payment_id = payment.payment_id
                    and active_match.status = 'matched'
              )
            on conflict(mismatch_id) do nothing
            """);
        AddDetectionParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void InsertAmountMismatches(RuntimeDbSession db, ReconciliationMismatchDetectionRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            select
                'mismatch-' || md5(transaction.tenant_id || ':amount:' || transaction.bank_transaction_id || ':' || payment.payment_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                'payment',
                payment.payment_id,
                'amount_mismatch',
                'Bank transaction and payment are in the time window with same currency but different amounts.',
                'open',
                now(),
                null
            from bank_transactions transaction
            join hostel_payments payment
              on payment.workspace_id = transaction.tenant_id
             and transaction.direction = 'credit'
             and transaction.currency = payment.currency
             and transaction.amount <> payment.amount
             and abs(extract(epoch from (transaction.occurred_at_utc - payment.updated_at_utc))) <= @windowSeconds
            where transaction.tenant_id = @tenantId
              and transaction.status in ('imported', 'candidate_created')
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
              and not exists (
                  select 1 from payment_matches active_match
                  where active_match.tenant_id = transaction.tenant_id
                    and active_match.status = 'matched'
                    and (active_match.bank_transaction_id = transaction.bank_transaction_id or active_match.payment_id = payment.payment_id)
              )
            on conflict(mismatch_id) do nothing
            """);
        AddDetectionParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void InsertCurrencyMismatches(RuntimeDbSession db, ReconciliationMismatchDetectionRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            select
                'mismatch-' || md5(transaction.tenant_id || ':currency:' || transaction.bank_transaction_id || ':' || payment.payment_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                'payment',
                payment.payment_id,
                'currency_mismatch',
                'Bank transaction and payment amounts align in the time window but currencies differ.',
                'open',
                now(),
                null
            from bank_transactions transaction
            join hostel_payments payment
              on payment.workspace_id = transaction.tenant_id
             and transaction.direction = 'credit'
             and transaction.amount = payment.amount
             and transaction.currency <> payment.currency
             and abs(extract(epoch from (transaction.occurred_at_utc - payment.updated_at_utc))) <= @windowSeconds
            where transaction.tenant_id = @tenantId
              and transaction.status in ('imported', 'candidate_created')
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
              and not exists (
                  select 1 from payment_matches active_match
                  where active_match.tenant_id = transaction.tenant_id
                    and active_match.status = 'matched'
                    and (active_match.bank_transaction_id = transaction.bank_transaction_id or active_match.payment_id = payment.payment_id)
              )
            on conflict(mismatch_id) do nothing
            """);
        AddDetectionParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void InsertDuplicateBankTransactions(RuntimeDbSession db, ReconciliationMismatchDetectionRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            select
                'mismatch-' || md5(transaction.tenant_id || ':duplicate-bank:' || transaction.bank_transaction_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                'bank_transaction',
                duplicate.bank_transaction_id,
                'duplicate_bank_transaction',
                'Bank transaction external reference, amount, currency, direction, and occurred date duplicate another row.',
                'open',
                now(),
                null
            from bank_transactions transaction
            join bank_transactions duplicate
              on duplicate.tenant_id = transaction.tenant_id
             and duplicate.bank_transaction_id <> transaction.bank_transaction_id
             and duplicate.external_ref = transaction.external_ref
             and duplicate.amount = transaction.amount
             and duplicate.currency = transaction.currency
             and duplicate.direction = transaction.direction
             and duplicate.occurred_at_utc::date = transaction.occurred_at_utc::date
             and duplicate.created_at_utc <= transaction.created_at_utc
            where transaction.tenant_id = @tenantId
              and transaction.status in ('imported', 'candidate_created')
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
            on conflict(mismatch_id) do nothing
            """);
        AddDetectionParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void InsertEvidenceAmountMismatches(RuntimeDbSession db, ReconciliationMismatchDetectionRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            select
                'mismatch-' || md5(transaction.tenant_id || ':evidence:' || transaction.bank_transaction_id || ':' || payment.payment_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                'payment',
                payment.payment_id,
                'evidence_mismatch',
                'Evidence amount differs from the related bank transaction.',
                'open',
                now(),
                null
            from bank_transactions transaction
            join hostel_payments payment
              on payment.workspace_id = transaction.tenant_id
             and transaction.direction = 'credit'
             and abs(extract(epoch from (transaction.occurred_at_utc - payment.updated_at_utc))) <= @windowSeconds
            join audit_events audit
              on audit.workspace_id = payment.workspace_id
             and audit.body ->> 'paymentId' = payment.payment_id
             and audit.body ? 'evidenceAmount'
             and audit.body ->> 'evidenceAmount' ~ '^-?[0-9]+(\.[0-9]+)?$'
             and (audit.body ->> 'evidenceAmount')::numeric <> transaction.amount
            where transaction.tenant_id = @tenantId
              and transaction.status in ('imported', 'candidate_created')
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
            on conflict(mismatch_id) do nothing
            """);
        AddDetectionParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void InsertRefundsWithoutBankDebit(RuntimeDbSession db, ReconciliationMismatchDetectionRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            select
                'mismatch-' || md5(deposit.workspace_id || ':refund-paid-no-bank-debit:' || refund.transaction_id),
                deposit.workspace_id,
                null,
                'refund',
                refund.transaction_id,
                'refund_paid_without_bank_debit',
                'Refund was paid but no corresponding bank debit exists after the configured threshold.',
                'open',
                now(),
                null
            from deposit_transactions refund
            join deposit_liabilities deposit
              on deposit.deposit_id = refund.deposit_id
            where deposit.workspace_id = @tenantId
              and refund.transaction_type = 'refund_paid'
              and refund.occurred_at_utc <= now() - (@refundThresholdDays * interval '1 day')
              and not exists (
                  select 1 from payment_matches active_match
                  where active_match.tenant_id = deposit.workspace_id
                    and active_match.refund_payment_id = refund.transaction_id
                    and active_match.status = 'matched'
              )
            on conflict(mismatch_id) do nothing
            """);
        AddDetectionParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static IReadOnlyList<ReconciliationCaseRecord> CreateCasesForOpenMismatches(
        RuntimeDbSession db,
        string tenantId,
        string? mismatchId,
        string actorId)
    {
        var rows = LoadMismatchesWithoutCases(db, tenantId, mismatchId);
        var cases = new List<ReconciliationCaseRecord>();
        foreach (var row in rows)
        {
            var record = CaseFor(row);
            InsertPaymentMismatchDetectedEvent(db, record, actorId);
            InsertReconciliationCase(db, record);
            cases.Add(record);
        }

        return cases;
    }

    private static IReadOnlyList<MismatchRow> LoadMismatchesWithoutCases(RuntimeDbSession db, string tenantId, string? mismatchId)
    {
        using var command = db.CreateCommand("""
            select
                mismatch.mismatch_id,
                mismatch.tenant_id,
                mismatch.bank_transaction_id,
                mismatch.related_object_type,
                mismatch.related_object_id,
                mismatch.mismatch_type,
                mismatch.reason,
                mismatch.created_at_utc
            from payment_mismatches mismatch
            where mismatch.tenant_id = @tenantId
              and mismatch.status = 'open'
              and (@mismatchId is null or mismatch.mismatch_id = @mismatchId)
              and not exists (
                  select 1 from reconciliation_cases reconciliation_case
                  where reconciliation_case.tenant_id = mismatch.tenant_id
                    and reconciliation_case.mismatch_id = mismatch.mismatch_id
              )
            order by mismatch.created_at_utc, mismatch.mismatch_id
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        AddNullableTextParameter(command, "mismatchId", mismatchId);

        using var reader = command.ExecuteReader();
        var rows = new List<MismatchRow>();
        while (reader.Read())
        {
            rows.Add(new MismatchRow(
                reader.GetString(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetString(5),
                reader.GetString(6),
                reader.GetFieldValue<DateTimeOffset>(7)));
        }

        return rows;
    }

    private static ReconciliationCaseRecord? LoadExistingCase(RuntimeDbSession db, string tenantId, string mismatchId)
    {
        using var command = db.CreateCommand("""
            select
                reconciliation_case_id,
                tenant_id,
                case_id,
                mismatch_id,
                mismatch_type,
                bank_transaction_id,
                related_object_type,
                related_object_id,
                owner_role,
                due_at_utc,
                blocker_severity,
                resolve_actions,
                status,
                opened_event_id,
                created_at_utc
            from reconciliation_cases
            where tenant_id = @tenantId
              and mismatch_id = @mismatchId
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("mismatchId", mismatchId);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadCase(reader) : null;
    }

    private static ReconciliationCaseRecord CaseFor(MismatchRow row)
    {
        var stable = StableHash(row.TenantId, row.MismatchId);
        var dueAtUtc = row.CreatedAtUtc.AddHours(48);
        return new ReconciliationCaseRecord(
            $"rcase-{stable}",
            row.TenantId,
            $"reconciliation-case-{stable}",
            row.MismatchId,
            row.MismatchType,
            row.BankTransactionId,
            row.RelatedObjectType,
            row.RelatedObjectId,
            "finance",
            dueAtUtc,
            SeverityFor(row.MismatchType),
            ResolveActionsFor(row.MismatchType),
            "open",
            $"recon-event-{stable}",
            row.CreatedAtUtc);
    }

    private static void InsertPaymentMismatchDetectedEvent(RuntimeDbSession db, ReconciliationCaseRecord record, string actorId)
    {
        var body = new
        {
            eventId = record.OpenedEventId,
            eventType = "PaymentMismatchDetected",
            tenantId = record.TenantId,
            reconciliationCaseId = record.ReconciliationCaseId,
            caseId = record.CaseId,
            mismatchId = record.MismatchId,
            mismatchType = record.MismatchType,
            bankTransactionId = record.BankTransactionId,
            relatedObjectType = record.RelatedObjectType,
            relatedObjectId = record.RelatedObjectId,
            ownerRole = record.OwnerRole,
            dueAtUtc = record.DueAtUtc,
            blockerSeverity = record.BlockerSeverity,
            resolveActions = record.ResolveActions,
            note = "Mismatch case only; does not mutate payment amount, deposit held amount, refund amount, or StayBalance."
        };

        using var command = db.CreateCommand("""
            insert into audit_events(
                event_id, idempotency_key, workspace_id, card_id, event_type,
                correlation_id, causation_id, request_id, actor_type, actor_id,
                occurred_at_utc, body)
            values (
                @eventId, @idempotencyKey, @tenantId, 'reconciliation-case', 'PaymentMismatchDetected',
                @correlationId, @causationId, @requestId, 'system', @actorId,
                @occurredAtUtc, @body::jsonb)
            on conflict(idempotency_key) do nothing
            """);
        command.Parameters.AddWithValue("eventId", record.OpenedEventId);
        command.Parameters.AddWithValue("idempotencyKey", $"reconciliation-mismatch-detected:{record.MismatchId}");
        command.Parameters.AddWithValue("tenantId", record.TenantId);
        command.Parameters.AddWithValue("correlationId", record.BankTransactionId ?? record.RelatedObjectId ?? record.CaseId);
        command.Parameters.AddWithValue("causationId", record.MismatchId);
        command.Parameters.AddWithValue("requestId", record.ReconciliationCaseId);
        command.Parameters.AddWithValue("actorId", actorId);
        command.Parameters.AddWithValue("occurredAtUtc", record.CreatedAtUtc);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(body, PostgresProjectionStore.JsonOptions));
        command.ExecuteNonQuery();
    }

    private static void InsertReconciliationCase(RuntimeDbSession db, ReconciliationCaseRecord record)
    {
        using var command = db.CreateCommand("""
            insert into reconciliation_cases(
                reconciliation_case_id, tenant_id, case_id, mismatch_id, mismatch_type,
                bank_transaction_id, related_object_type, related_object_id, status,
                assigned_role, assigned_actor_id, owner_role, due_at_utc, blocker_severity,
                resolve_actions, body, opened_event_id, closed_event_id, created_at_utc, updated_at_utc)
            values (
                @reconciliationCaseId, @tenantId, @caseId, @mismatchId, @mismatchType,
                @bankTransactionId, @relatedObjectType, @relatedObjectId, @status,
                @assignedRole, null, @ownerRole, @dueAtUtc, @blockerSeverity,
                @resolveActions::jsonb, @body::jsonb, @openedEventId, null, @createdAtUtc, @updatedAtUtc)
            on conflict(tenant_id, mismatch_id) do nothing
            """);
        command.Parameters.AddWithValue("reconciliationCaseId", record.ReconciliationCaseId);
        command.Parameters.AddWithValue("tenantId", record.TenantId);
        command.Parameters.AddWithValue("caseId", record.CaseId);
        command.Parameters.AddWithValue("mismatchId", record.MismatchId);
        command.Parameters.AddWithValue("mismatchType", record.MismatchType);
        AddNullableTextParameter(command, "bankTransactionId", record.BankTransactionId);
        AddNullableTextParameter(command, "relatedObjectType", record.RelatedObjectType);
        AddNullableTextParameter(command, "relatedObjectId", record.RelatedObjectId);
        command.Parameters.AddWithValue("status", record.Status);
        command.Parameters.AddWithValue("assignedRole", record.OwnerRole);
        command.Parameters.AddWithValue("ownerRole", record.OwnerRole);
        command.Parameters.AddWithValue("dueAtUtc", record.DueAtUtc);
        command.Parameters.AddWithValue("blockerSeverity", record.BlockerSeverity);
        command.Parameters.AddWithValue("resolveActions", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(record.ResolveActions, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(record, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("openedEventId", record.OpenedEventId);
        command.Parameters.AddWithValue("createdAtUtc", record.CreatedAtUtc);
        command.Parameters.AddWithValue("updatedAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }

    private IReadOnlyList<ProcessWorkItemIntentRecord> DispatchProcessWorkItems(
        IReadOnlyList<ReconciliationCaseRecord> cases,
        string actorId)
    {
        var intents = new List<ProcessWorkItemIntentRecord>();
        foreach (var record in cases)
        {
            var result = processManager.Handle(ToWorkspaceEvent(record, actorId), processRunSink);
            intents.AddRange(result.WorkItemIntents);
        }

        return intents;
    }

    private static WorkspaceEvent ToWorkspaceEvent(ReconciliationCaseRecord record, string actorId) =>
        new(
            record.OpenedEventId,
            record.TenantId,
            "reconciliation-case",
            "PaymentMismatchDetected",
            record.BankTransactionId ?? record.RelatedObjectId ?? record.CaseId,
            record.MismatchId,
            record.ReconciliationCaseId,
            "system",
            actorId,
            record.CreatedAtUtc,
            new Dictionary<string, string>
            {
                ["reconciliationCaseId"] = record.ReconciliationCaseId,
                ["caseId"] = record.CaseId,
                ["mismatchId"] = record.MismatchId,
                ["mismatchType"] = record.MismatchType,
                ["bankTransactionId"] = record.BankTransactionId ?? string.Empty,
                ["relatedObjectType"] = record.RelatedObjectType ?? string.Empty,
                ["relatedObjectId"] = record.RelatedObjectId ?? string.Empty,
                ["ownerRole"] = record.OwnerRole,
                ["dueAtUtc"] = record.DueAtUtc.ToString("O", System.Globalization.CultureInfo.InvariantCulture),
                ["blockerSeverity"] = record.BlockerSeverity,
                ["resolveActions"] = string.Join(",", record.ResolveActions),
                ["reconciliationWorkItemId"] = $"wi-{StableHash(record.TenantId, record.OpenedEventId, "reconciliation-review")}"
            },
            new[] { "ReconciliationCase" });

    private static ReconciliationCaseRecord ReadCase(Npgsql.NpgsqlDataReader reader) =>
        new(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetString(7),
            reader.GetString(8),
            reader.GetFieldValue<DateTimeOffset>(9),
            reader.GetString(10),
            JsonSerializer.Deserialize<IReadOnlyList<string>>(reader.GetString(11), PostgresProjectionStore.JsonOptions) ?? Array.Empty<string>(),
            reader.GetString(12),
            reader.GetString(13),
            reader.GetFieldValue<DateTimeOffset>(14));

    private static string SeverityFor(string mismatchType) =>
        mismatchType switch
        {
            "amount_mismatch" or "currency_mismatch" or "evidence_mismatch" or "refund_paid_without_bank_debit" => "P0",
            "duplicate_bank_transaction" or "confirmed_payment_without_bank_match" => "P1",
            _ => "P2"
        };

    private static IReadOnlyList<string> ResolveActionsFor(string mismatchType) =>
        mismatchType switch
        {
            "unmatched_bank_transaction" => new[] { "acceptManualMatch", "markBankTransactionIgnored", "closeAsExplained" },
            "confirmed_payment_without_bank_match" => new[] { "acceptManualMatch", "requestPaymentCorrection", "closeAsExplained" },
            "amount_mismatch" or "currency_mismatch" => new[] { "requestPaymentCorrection", "requestEvidenceCorrection", "createCorrectionRequest", "closeAsExplained" },
            "duplicate_bank_transaction" => new[] { "markBankTransactionIgnored", "createCorrectionRequest", "closeAsExplained" },
            "evidence_mismatch" => new[] { "requestEvidenceCorrection", "createCorrectionRequest", "closeAsExplained" },
            "refund_paid_without_bank_debit" => new[] { "acceptManualMatch", "createCorrectionRequest", "closeAsExplained" },
            _ => new[] { "createCorrectionRequest", "closeAsExplained" }
        };

    private static void AddDetectionParameters(Npgsql.NpgsqlCommand command, ReconciliationMismatchDetectionRequest request)
    {
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        AddNullableTextParameter(command, "bankTransactionId", request.BankTransactionId);
        AddNullableTextParameter(command, "importId", request.ImportId);
        command.Parameters.AddWithValue("windowSeconds", request.WindowDays * 24 * 60 * 60);
        command.Parameters.AddWithValue("paymentThresholdDays", request.ConfirmedPaymentThresholdDays);
        command.Parameters.AddWithValue("refundThresholdDays", request.RefundThresholdDays);
    }

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

    private sealed record MismatchRow(
        string MismatchId,
        string TenantId,
        string? BankTransactionId,
        string? RelatedObjectType,
        string? RelatedObjectId,
        string MismatchType,
        string Reason,
        DateTimeOffset CreatedAtUtc);
}
