using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeReconciliationMatchingStorage : IReconciliationMatchingStore
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeReconciliationMatchingStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public ReconciliationCandidateGenerationResult GenerateCandidates(ReconciliationCandidateGenerationRequest request)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);

        GeneratePaymentCandidates(db, request);
        GenerateDepositCandidates(db, request);
        GenerateRefundCandidates(db, request);
        MarkTransactionsWithCandidates(db, request);

        db.Commit();
        var candidates = GetCandidates(request.TenantId, request.BankTransactionId);
        return new ReconciliationCandidateGenerationResult(candidates.Count, candidates);
    }

    public IReadOnlyList<ReconciliationMatchCandidate> GetCandidates(string tenantId, string? bankTransactionId = null)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select
                candidate.candidate_id,
                candidate.tenant_id,
                candidate.bank_transaction_id,
                candidate.payment_id,
                candidate.deposit_id,
                candidate.refund_payment_id,
                candidate.score,
                candidate.candidate_type,
                candidate.reason,
                candidate.status,
                candidate.created_at_utc,
                transaction.external_ref,
                transaction.amount,
                transaction.currency,
                transaction.direction,
                transaction.description
            from payment_match_candidates candidate
            join bank_transactions transaction
              on transaction.bank_transaction_id = candidate.bank_transaction_id
             and transaction.tenant_id = candidate.tenant_id
            where candidate.tenant_id = @tenantId
              and (@bankTransactionId is null or candidate.bank_transaction_id = @bankTransactionId)
              and candidate.status in ('proposed', 'reviewing')
            order by candidate.created_at_utc, candidate.candidate_id
            """;
        command.Parameters.AddWithValue("tenantId", tenantId);
        AddNullableTextParameter(command, "bankTransactionId", bankTransactionId);

        using var reader = command.ExecuteReader();
        var items = new List<ReconciliationMatchCandidate>();
        while (reader.Read())
        {
            items.Add(ReadCandidate(reader));
        }

        return items;
    }

    public ReconciliationManualMatchResult AcceptCandidate(string candidateId, string actorId)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var candidate = LoadCandidateForUpdate(db, candidateId);
        if (candidate.Status is not "proposed" and not "reviewing")
        {
            throw new InvalidOperationException("reconciliation_candidate_not_acceptable");
        }

        EnsureTargetExists(candidate);
        EnsureNoActiveMatch(db, candidate);

        var matchId = $"match-{Guid.NewGuid():N}";
        var eventId = $"recon-event-{Guid.NewGuid():N}";
        var eventType = EventTypeFor(candidate);
        var matchedAtUtc = DateTimeOffset.UtcNow;
        InsertReconciliationAuditEvent(db, candidate, eventId, eventType, actorId, matchId, matchedAtUtc);
        InsertMatch(db, candidate, matchId, eventId, actorId, matchedAtUtc);
        UpdateCandidateStatus(db, candidate.CandidateId, "accepted");
        UpdateBankTransactionStatus(db, candidate.TenantId, candidate.BankTransactionId, "matched");

        db.Commit();
        return new ReconciliationManualMatchResult(
            matchId,
            candidate.TenantId,
            candidate.BankTransactionId,
            candidate.PaymentId,
            candidate.DepositId,
            candidate.RefundPaymentId,
            "matched",
            eventId,
            eventType,
            matchedAtUtc);
    }

    public ReconciliationCandidateDecisionResult RejectCandidate(string candidateId, string actorId, string reason)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var candidate = LoadCandidateForUpdate(db, candidateId);
        UpdateCandidateStatus(db, candidate.CandidateId, "rejected");
        db.Commit();
        return new ReconciliationCandidateDecisionResult(candidate.CandidateId, "rejected", reason);
    }

    public ReconciliationMismatchResult MarkMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        EnsureBankTransaction(db, request.TenantId, bankTransactionId);
        var mismatchId = $"mismatch-{Guid.NewGuid():N}";
        var createdAtUtc = DateTimeOffset.UtcNow;

        using (var command = db.CreateCommand("""
            insert into payment_mismatches(
                mismatch_id, tenant_id, bank_transaction_id, related_object_type, related_object_id,
                mismatch_type, reason, status, created_at_utc, resolved_at_utc)
            values (
                @mismatchId, @tenantId, @bankTransactionId, @relatedObjectType, @relatedObjectId,
                @mismatchType, @reason, 'open', @createdAtUtc, null)
            """))
        {
            command.Parameters.AddWithValue("mismatchId", mismatchId);
            command.Parameters.AddWithValue("tenantId", request.TenantId);
            command.Parameters.AddWithValue("bankTransactionId", bankTransactionId);
            command.Parameters.AddWithValue("relatedObjectType", (object?)request.RelatedObjectType ?? DBNull.Value);
            command.Parameters.AddWithValue("relatedObjectId", (object?)request.RelatedObjectId ?? DBNull.Value);
            command.Parameters.AddWithValue("mismatchType", request.MismatchType);
            command.Parameters.AddWithValue("reason", request.Reason ?? "manual_mismatch");
            command.Parameters.AddWithValue("createdAtUtc", createdAtUtc);
            command.ExecuteNonQuery();
        }

        UpdateBankTransactionStatus(db, request.TenantId, bankTransactionId, "mismatched");
        SupersedeOpenCandidatesForTransaction(db, request.TenantId, bankTransactionId);
        db.Commit();
        return new ReconciliationMismatchResult(
            mismatchId,
            request.TenantId,
            bankTransactionId,
            request.MismatchType,
            request.Reason ?? "manual_mismatch",
            "open",
            createdAtUtc);
    }

    public ReconciliationTransactionDecisionResult IgnoreTransaction(string bankTransactionId, string tenantId, string actorId, string reason)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        EnsureBankTransaction(db, tenantId, bankTransactionId);
        UpdateBankTransactionStatus(db, tenantId, bankTransactionId, "ignored");
        SupersedeOpenCandidatesForTransaction(db, tenantId, bankTransactionId);
        db.Commit();
        return new ReconciliationTransactionDecisionResult(bankTransactionId, "ignored", reason);
    }

    private static void GeneratePaymentCandidates(RuntimeDbSession db, ReconciliationCandidateGenerationRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_match_candidates(
                candidate_id, tenant_id, bank_transaction_id, payment_id, deposit_id, refund_payment_id,
                score, candidate_type, reason, status, created_at_utc)
            select
                'cand-' || md5(transaction.bank_transaction_id || ':payment:' || payment.payment_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                payment.payment_id,
                null,
                null,
                case when
                    (payment.receipt_no <> '' and (transaction.external_ref = payment.receipt_no or transaction.description ilike '%' || payment.receipt_no || '%')) or
                    transaction.description ilike '%' || payment.payment_id || '%' or
                    transaction.description ilike '%' || payment.folio_id || '%' or
                    transaction.description ilike '%' || payment.payer || '%'
                  then 0.9500 else 0.8000 end,
                'payment',
                case when
                    (payment.receipt_no <> '' and (transaction.external_ref = payment.receipt_no or transaction.description ilike '%' || payment.receipt_no || '%')) or
                    transaction.description ilike '%' || payment.payment_id || '%' or
                    transaction.description ilike '%' || payment.folio_id || '%' or
                    transaction.description ilike '%' || payment.payer || '%'
                  then 'amount_currency_time_window_reference_hint'
                  else 'amount_currency_time_window' end,
                'proposed',
                now()
            from bank_transactions transaction
            join hostel_payments payment
              on transaction.direction = 'credit'
             and transaction.amount = payment.amount
             and transaction.currency = payment.currency
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
            on conflict(candidate_id) do nothing
            """);
        AddGenerationParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void GenerateDepositCandidates(RuntimeDbSession db, ReconciliationCandidateGenerationRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_match_candidates(
                candidate_id, tenant_id, bank_transaction_id, payment_id, deposit_id, refund_payment_id,
                score, candidate_type, reason, status, created_at_utc)
            select
                'cand-' || md5(transaction.bank_transaction_id || ':deposit:' || deposit.deposit_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                null,
                deposit.deposit_id,
                null,
                case when transaction.description ilike '%' || deposit.deposit_id || '%' or transaction.description ilike '%' || deposit.folio_id || '%'
                  then 0.9000 else 0.7500 end,
                'deposit',
                case when transaction.description ilike '%' || deposit.deposit_id || '%' or transaction.description ilike '%' || deposit.folio_id || '%'
                  then 'amount_currency_time_window_reference_hint'
                  else 'amount_currency_time_window' end,
                'proposed',
                now()
            from bank_transactions transaction
            join deposit_liabilities deposit
              on transaction.direction = 'credit'
             and transaction.amount = deposit.received_amount
             and transaction.currency = deposit.currency
             and abs(extract(epoch from (transaction.occurred_at_utc - deposit.updated_at_utc))) <= @windowSeconds
            where transaction.tenant_id = @tenantId
              and transaction.status in ('imported', 'candidate_created')
              and deposit.received_amount > 0
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
              and not exists (
                  select 1 from payment_matches active_match
                  where active_match.tenant_id = transaction.tenant_id
                    and active_match.status = 'matched'
                    and (active_match.bank_transaction_id = transaction.bank_transaction_id or active_match.deposit_id = deposit.deposit_id)
              )
            on conflict(candidate_id) do nothing
            """);
        AddGenerationParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void GenerateRefundCandidates(RuntimeDbSession db, ReconciliationCandidateGenerationRequest request)
    {
        using var command = db.CreateCommand("""
            insert into payment_match_candidates(
                candidate_id, tenant_id, bank_transaction_id, payment_id, deposit_id, refund_payment_id,
                score, candidate_type, reason, status, created_at_utc)
            select
                'cand-' || md5(transaction.bank_transaction_id || ':refund:' || refund.transaction_id),
                transaction.tenant_id,
                transaction.bank_transaction_id,
                null,
                null,
                refund.transaction_id,
                case when transaction.description ilike '%' || refund.deposit_id || '%'
                  then 0.9000 else 0.7500 end,
                'refund',
                case when transaction.description ilike '%' || refund.deposit_id || '%'
                  then 'amount_currency_time_window_reference_hint'
                  else 'amount_currency_time_window' end,
                'proposed',
                now()
            from bank_transactions transaction
            join deposit_transactions refund
              on transaction.direction = 'debit'
             and refund.transaction_type = 'refund_paid'
             and transaction.amount = refund.amount
             and transaction.currency = refund.currency
             and abs(extract(epoch from (transaction.occurred_at_utc - refund.occurred_at_utc))) <= @windowSeconds
            where transaction.tenant_id = @tenantId
              and transaction.status in ('imported', 'candidate_created')
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
              and not exists (
                  select 1 from payment_matches active_match
                  where active_match.tenant_id = transaction.tenant_id
                    and active_match.status = 'matched'
                    and (active_match.bank_transaction_id = transaction.bank_transaction_id or active_match.refund_payment_id = refund.transaction_id)
              )
            on conflict(candidate_id) do nothing
            """);
        AddGenerationParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void MarkTransactionsWithCandidates(RuntimeDbSession db, ReconciliationCandidateGenerationRequest request)
    {
        using var command = db.CreateCommand("""
            update bank_transactions transaction
            set status = 'candidate_created'
            where transaction.tenant_id = @tenantId
              and transaction.status = 'imported'
              and (@bankTransactionId is null or transaction.bank_transaction_id = @bankTransactionId)
              and (@importId is null or transaction.import_id = @importId)
              and exists (
                  select 1 from payment_match_candidates candidate
                  where candidate.tenant_id = transaction.tenant_id
                    and candidate.bank_transaction_id = transaction.bank_transaction_id
                    and candidate.status in ('proposed', 'reviewing')
              )
            """);
        AddGenerationParameters(command, request);
        command.ExecuteNonQuery();
    }

    private static void AddGenerationParameters(Npgsql.NpgsqlCommand command, ReconciliationCandidateGenerationRequest request)
    {
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        AddNullableTextParameter(command, "bankTransactionId", request.BankTransactionId);
        AddNullableTextParameter(command, "importId", request.ImportId);
        command.Parameters.AddWithValue("windowSeconds", request.WindowDays * 24 * 60 * 60);
    }

    private static ReconciliationMatchCandidate LoadCandidateForUpdate(RuntimeDbSession db, string candidateId)
    {
        using var command = db.CreateCommand("""
            select
                candidate.candidate_id,
                candidate.tenant_id,
                candidate.bank_transaction_id,
                candidate.payment_id,
                candidate.deposit_id,
                candidate.refund_payment_id,
                candidate.score,
                candidate.candidate_type,
                candidate.reason,
                candidate.status,
                candidate.created_at_utc,
                transaction.external_ref,
                transaction.amount,
                transaction.currency,
                transaction.direction,
                transaction.description
            from payment_match_candidates candidate
            join bank_transactions transaction
              on transaction.bank_transaction_id = candidate.bank_transaction_id
             and transaction.tenant_id = candidate.tenant_id
            where candidate.candidate_id = @candidateId
            for update of candidate
            """);
        command.Parameters.AddWithValue("candidateId", candidateId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new InvalidOperationException("reconciliation_candidate_not_found");
        }

        return ReadCandidate(reader);
    }

    private static ReconciliationMatchCandidate ReadCandidate(Npgsql.NpgsqlDataReader reader) =>
        new(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.GetDecimal(6),
            reader.GetString(7),
            reader.GetString(8),
            reader.GetString(9),
            reader.GetFieldValue<DateTimeOffset>(10),
            reader.GetString(11),
            reader.GetDecimal(12),
            reader.GetString(13),
            reader.GetString(14),
            reader.GetString(15));

    private static void EnsureTargetExists(ReconciliationMatchCandidate candidate)
    {
        if (candidate.PaymentId is null && candidate.DepositId is null && candidate.RefundPaymentId is null)
        {
            throw new InvalidOperationException("reconciliation_candidate_target_required");
        }
    }

    private static void EnsureNoActiveMatch(RuntimeDbSession db, ReconciliationMatchCandidate candidate)
    {
        using var command = db.CreateCommand("""
            select count(*)
            from payment_matches
            where tenant_id = @tenantId
              and status = 'matched'
              and (
                    bank_transaction_id = @bankTransactionId
                 or (@paymentId is not null and payment_id = @paymentId)
                 or (@depositId is not null and deposit_id = @depositId)
                 or (@refundPaymentId is not null and refund_payment_id = @refundPaymentId)
              )
            """);
        command.Parameters.AddWithValue("tenantId", candidate.TenantId);
        command.Parameters.AddWithValue("bankTransactionId", candidate.BankTransactionId);
        AddNullableTextParameter(command, "paymentId", candidate.PaymentId);
        AddNullableTextParameter(command, "depositId", candidate.DepositId);
        AddNullableTextParameter(command, "refundPaymentId", candidate.RefundPaymentId);
        if (Convert.ToInt32(command.ExecuteScalar() ?? 0) > 0)
        {
            throw new InvalidOperationException("reconciliation_match_already_exists");
        }
    }

    private static void InsertReconciliationAuditEvent(
        RuntimeDbSession db,
        ReconciliationMatchCandidate candidate,
        string eventId,
        string eventType,
        string actorId,
        string matchId,
        DateTimeOffset matchedAtUtc)
    {
        var body = new
        {
            eventId,
            eventType,
            tenantId = candidate.TenantId,
            candidateId = candidate.CandidateId,
            matchId,
            bankTransactionId = candidate.BankTransactionId,
            paymentId = candidate.PaymentId,
            depositId = candidate.DepositId,
            refundPaymentId = candidate.RefundPaymentId,
            actorId,
            occurredAtUtc = matchedAtUtc,
            note = "Reconciliation match only; not a payment confirmation and not a money fact mutation."
        };

        using var command = db.CreateCommand("""
            insert into audit_events(
                event_id, idempotency_key, workspace_id, card_id, event_type,
                correlation_id, causation_id, request_id, actor_type, actor_id,
                occurred_at_utc, body)
            values (
                @eventId, @idempotencyKey, 'reconciliation', 'bank-statement-match', @eventType,
                @correlationId, @causationId, @requestId, 'finance', @actorId,
                @occurredAtUtc, @body::jsonb)
            on conflict(idempotency_key) do nothing
            """);
        command.Parameters.AddWithValue("eventId", eventId);
        command.Parameters.AddWithValue("idempotencyKey", $"reconciliation-match:{candidate.CandidateId}");
        command.Parameters.AddWithValue("eventType", eventType);
        command.Parameters.AddWithValue("correlationId", candidate.BankTransactionId);
        command.Parameters.AddWithValue("causationId", candidate.CandidateId);
        command.Parameters.AddWithValue("requestId", matchId);
        command.Parameters.AddWithValue("actorId", actorId);
        command.Parameters.AddWithValue("occurredAtUtc", matchedAtUtc);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(body, PostgresProjectionStore.JsonOptions));
        command.ExecuteNonQuery();
    }

    private static void InsertMatch(
        RuntimeDbSession db,
        ReconciliationMatchCandidate candidate,
        string matchId,
        string eventId,
        string actorId,
        DateTimeOffset matchedAtUtc)
    {
        using var command = db.CreateCommand("""
            insert into payment_matches(
                match_id, tenant_id, bank_transaction_id, payment_id, deposit_id, refund_payment_id,
                matched_by, matched_event_id, status, matched_at_utc)
            values (
                @matchId, @tenantId, @bankTransactionId, @paymentId, @depositId, @refundPaymentId,
                @matchedBy, @matchedEventId, 'matched', @matchedAtUtc)
            """);
        command.Parameters.AddWithValue("matchId", matchId);
        command.Parameters.AddWithValue("tenantId", candidate.TenantId);
        command.Parameters.AddWithValue("bankTransactionId", candidate.BankTransactionId);
        AddNullableTextParameter(command, "paymentId", candidate.PaymentId);
        AddNullableTextParameter(command, "depositId", candidate.DepositId);
        AddNullableTextParameter(command, "refundPaymentId", candidate.RefundPaymentId);
        command.Parameters.AddWithValue("matchedBy", actorId);
        command.Parameters.AddWithValue("matchedEventId", eventId);
        command.Parameters.AddWithValue("matchedAtUtc", matchedAtUtc);
        command.ExecuteNonQuery();
    }

    private static void AddNullableTextParameter(Npgsql.NpgsqlCommand command, string name, string? value)
    {
        command.Parameters.AddWithValue(name, NpgsqlDbType.Text, (object?)value ?? DBNull.Value);
    }

    private static void UpdateCandidateStatus(RuntimeDbSession db, string candidateId, string status)
    {
        using var command = db.CreateCommand("""
            update payment_match_candidates
            set status = @status
            where candidate_id = @candidateId
            """);
        command.Parameters.AddWithValue("candidateId", candidateId);
        command.Parameters.AddWithValue("status", status);
        command.ExecuteNonQuery();
    }

    private static void UpdateBankTransactionStatus(RuntimeDbSession db, string tenantId, string bankTransactionId, string status)
    {
        using var command = db.CreateCommand("""
            update bank_transactions
            set status = @status
            where tenant_id = @tenantId
              and bank_transaction_id = @bankTransactionId
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("bankTransactionId", bankTransactionId);
        command.Parameters.AddWithValue("status", status);
        if (command.ExecuteNonQuery() == 0)
        {
            throw new InvalidOperationException("reconciliation_bank_transaction_not_found");
        }
    }

    private static void EnsureBankTransaction(RuntimeDbSession db, string tenantId, string bankTransactionId)
    {
        using var command = db.CreateCommand("""
            select count(*)
            from bank_transactions
            where tenant_id = @tenantId
              and bank_transaction_id = @bankTransactionId
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("bankTransactionId", bankTransactionId);
        if (Convert.ToInt32(command.ExecuteScalar() ?? 0) == 0)
        {
            throw new InvalidOperationException("reconciliation_bank_transaction_not_found");
        }
    }

    private static void SupersedeOpenCandidatesForTransaction(RuntimeDbSession db, string tenantId, string bankTransactionId)
    {
        using var command = db.CreateCommand("""
            update payment_match_candidates
            set status = 'superseded'
            where tenant_id = @tenantId
              and bank_transaction_id = @bankTransactionId
              and status in ('proposed', 'reviewing')
            """);
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("bankTransactionId", bankTransactionId);
        command.ExecuteNonQuery();
    }

    private static string EventTypeFor(ReconciliationMatchCandidate candidate) =>
        candidate.CandidateType switch
        {
            "deposit" => "Reconciliation.DepositMatched",
            "refund" => "Reconciliation.RefundMatched",
            _ => "Reconciliation.PaymentMatched"
        };
}
