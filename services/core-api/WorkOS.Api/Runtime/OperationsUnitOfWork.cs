using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public sealed class OperationsUnitOfWork
{
    private readonly CommandEnvelopeBuilder envelopeBuilder;
    private readonly CommandSubmissionService submissions;
    private readonly IdempotencyService idempotency;
    private readonly PayloadHashService payloadHash;
    private readonly SliceCommandHandlerRouter handlers;

    public OperationsUnitOfWork(
        CommandEnvelopeBuilder envelopeBuilder,
        CommandSubmissionService submissions,
        IdempotencyService idempotency,
        PayloadHashService payloadHash,
        SliceCommandHandlerRouter handlers)
    {
        this.envelopeBuilder = envelopeBuilder;
        this.submissions = submissions;
        this.idempotency = idempotency;
        this.payloadHash = payloadHash;
        this.handlers = handlers;
    }

    public OperationsCommitResult Commit(OperationsCommandRequest request)
    {
        ValidateRequest(request);

        var scope = IdempotencyService.ScopeFor(request);
        var hash = payloadHash.Compute(request.Payload);
        var existing = idempotency.Evaluate(request.TenantId, scope, request.IdempotencyKey, hash);
        if (existing.Result is not null)
        {
            return existing.Result;
        }

        var envelope = envelopeBuilder.Build(request, hash);
        var submission = OperationsCommandSubmission.Pending(
            $"cmd-{OperationsUnitOfWorkHash.Short(request.TenantId, scope, request.IdempotencyKey)}",
            scope,
            envelope);

        if (!submissions.TryBegin(submission))
        {
            var raced = idempotency.Evaluate(request.TenantId, scope, request.IdempotencyKey, hash);
            return raced.Result ?? OperationsCommitResult.Conflict(
                request,
                hash,
                "command_submission_pending");
        }

        try
        {
            var handled = handlers.Handle(envelope);
            ValidateLedgerBoundary(handled);

            var materialized = Materialize(request, submission, handled);
            var stableResponse = OperationsStableResponse.From(request, submission, hash, handled, materialized);
            submissions.Complete(submission, materialized, stableResponse);
            return OperationsCommitResult.FromStableResponse(stableResponse, duplicate: false);
        }
        catch (Exception ex)
        {
            submissions.Rollback(submission.SubmissionId);
            return OperationsCommitResult.Failed(request, hash, "handler_failure", ex.Message);
        }
    }

    private static OperationsFactBatch Materialize(
        OperationsCommandRequest request,
        OperationsCommandSubmission submission,
        SliceCommandHandlerResult handled)
    {
        var correlationId = string.IsNullOrWhiteSpace(request.CorrelationId)
            ? submission.SubmissionId
            : request.CorrelationId!;
        var causationId = string.IsNullOrWhiteSpace(request.CausationId)
            ? submission.SubmissionId
            : request.CausationId!;

        var events = handled.DomainEvents
            .Select((item, index) => new OperationsDomainEvent(
                request.TenantId,
                string.IsNullOrWhiteSpace(item.EventId)
                    ? $"evt-{OperationsUnitOfWorkHash.Short(submission.SubmissionId, item.EventType, index.ToString())}"
                    : item.EventId,
                request.CaseId,
                request.WorkItemId,
                submission.SubmissionId,
                causationId,
                correlationId,
                item.EventType,
                item.Payload,
                DateTimeOffset.UtcNow))
            .ToArray();

        var workItemEvents = handled.WorkItemEvents
            .Select((item, index) => new OperationsWorkItemEvent(
                request.TenantId,
                string.IsNullOrWhiteSpace(item.WorkItemEventId)
                    ? $"wie-{OperationsUnitOfWorkHash.Short(submission.SubmissionId, item.EventType, index.ToString())}"
                    : item.WorkItemEventId,
                request.CaseId,
                request.WorkItemId,
                submission.SubmissionId,
                item.EventType,
                item.FromState,
                item.ToState,
                item.Payload,
                DateTimeOffset.UtcNow))
            .ToArray();

        var outbox = handled.OutboxMessages
            .Select((item, index) => new OperationsOutboxMessage(
                string.IsNullOrWhiteSpace(item.MessageId)
                    ? $"out-{OperationsUnitOfWorkHash.Short(submission.SubmissionId, item.EventId ?? index.ToString())}"
                    : item.MessageId,
                item.EventId ?? events.FirstOrDefault()?.EventId ?? submission.SubmissionId,
                request.TenantId,
                request.CaseId,
                request.WorkItemId,
                submission.SubmissionId,
                item.MessageType,
                item.Payload,
                DateTimeOffset.UtcNow))
            .ToArray();

        return new OperationsFactBatch(events, workItemEvents, outbox);
    }

    private static void ValidateRequest(OperationsCommandRequest request)
    {
        foreach (var (name, value) in new[]
        {
            ("tenantId", request.TenantId),
            ("caseId", request.CaseId),
            ("workItemId", request.WorkItemId),
            ("commandType", request.CommandType),
            ("schemaVersion", request.SchemaVersion),
            ("definitionVersionId", request.DefinitionVersionId),
            ("idempotencyKey", request.IdempotencyKey)
        })
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException($"operations_uow_requires_{name}");
            }
        }
    }

    private static void ValidateLedgerBoundary(SliceCommandHandlerResult handled)
    {
        if (handled.LedgerEntries.Count == 0)
        {
            return;
        }

        var transactionIds = handled.LedgerTransactions
            .Select(item => item.LedgerTransactionId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (transactionIds.Count == 0 ||
            handled.LedgerEntries.Any(item => !transactionIds.Contains(item.LedgerTransactionId)))
        {
            throw new InvalidOperationException("operations_uow_rejects_ledger_entry_without_transaction");
        }
    }
}

public sealed class CommandEnvelopeBuilder
{
    public CommandEnvelopeV1 Build(OperationsCommandRequest request, string payloadHash) =>
        new(
            request.TenantId,
            request.CommandType,
            request.SchemaVersion,
            request.DefinitionVersionId,
            request.CaseId,
            request.WorkItemId,
            request.IdempotencyKey,
            payloadHash,
            request.Payload);
}

public sealed class CommandSubmissionService
{
    private readonly OperationsWriteStore writes;

    public CommandSubmissionService(OperationsWriteStore writes)
    {
        this.writes = writes;
    }

    public bool TryBegin(OperationsCommandSubmission submission) =>
        writes.TryBeginCommandSubmission(submission);

    public void Complete(
        OperationsCommandSubmission submission,
        OperationsFactBatch facts,
        OperationsStableResponse response) =>
        writes.CompleteCommandSubmission(submission, facts, response);

    public void Rollback(string submissionId) =>
        writes.RollbackCommandSubmission(submissionId);
}

public sealed class IdempotencyService
{
    private readonly OperationsReadStore reads;

    public IdempotencyService(OperationsReadStore reads)
    {
        this.reads = reads;
    }

    public IdempotencyDecision Evaluate(string tenantId, string scope, string idempotencyKey, string payloadHash)
    {
        var existing = reads.FindCommandSubmission(tenantId, scope, idempotencyKey);
        if (existing is null)
        {
            return IdempotencyDecision.New();
        }

        if (!existing.PayloadHash.Equals(payloadHash, StringComparison.Ordinal))
        {
            return IdempotencyDecision.Conflict(existing, "same_idempotency_different_payload");
        }

        return existing.StableResponse is null
            ? IdempotencyDecision.Conflict(existing, "command_submission_pending")
            : IdempotencyDecision.Duplicate(existing);
    }

    public static string ScopeFor(OperationsCommandRequest request) =>
        string.IsNullOrWhiteSpace(request.IdempotencyScope)
            ? $"{request.TenantId}:{request.WorkItemId}"
            : request.IdempotencyScope!;
}

public sealed class PayloadHashService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string Compute(IReadOnlyDictionary<string, object> payload)
    {
        var normalized = Normalize(payload);
        var json = JsonSerializer.Serialize(normalized, JsonOptions);
        return $"sha256:{OperationsUnitOfWorkHash.Short(json)}";
    }

    private static SortedDictionary<string, object?> Normalize(IReadOnlyDictionary<string, object> payload)
    {
        var normalized = new SortedDictionary<string, object?>(StringComparer.Ordinal);
        foreach (var (key, value) in payload)
        {
            normalized[key] = NormalizeValue(value);
        }

        return normalized;
    }

    private static object? NormalizeValue(object? value) =>
        value switch
        {
            null => null,
            string => value,
            bool => value,
            int => value,
            long => value,
            decimal => value,
            double => value,
            IReadOnlyDictionary<string, object> dictionary => Normalize(dictionary),
            IEnumerable<string> strings => strings.OrderBy(item => item, StringComparer.Ordinal).ToArray(),
            _ => value.ToString()
        };
}

public sealed class SliceCommandHandlerRouter
{
    private readonly Dictionary<string, Func<CommandEnvelopeV1, SliceCommandHandlerResult>> handlers = new(StringComparer.OrdinalIgnoreCase);

    public SliceCommandHandlerRouter Register(string commandType, Func<CommandEnvelopeV1, SliceCommandHandlerResult> handler)
    {
        handlers[commandType] = handler;
        return this;
    }

    public SliceCommandHandlerResult Handle(CommandEnvelopeV1 envelope)
    {
        if (!handlers.TryGetValue(envelope.CommandType, out var handler))
        {
            throw new InvalidOperationException($"operations_handler_not_registered:{envelope.CommandType}");
        }

        return handler(envelope);
    }
}

public sealed class FactResponseStore
{
    private readonly OperationsReadStore reads;

    public FactResponseStore(OperationsReadStore reads)
    {
        this.reads = reads;
    }

    public OperationsStableResponse? FindStableResponse(string tenantId, string scope, string idempotencyKey) =>
        reads.FindCommandSubmission(tenantId, scope, idempotencyKey)?.StableResponse;
}

public interface OperationsWriteStore
{
    bool TryBeginCommandSubmission(OperationsCommandSubmission submission);

    void CompleteCommandSubmission(
        OperationsCommandSubmission submission,
        OperationsFactBatch facts,
        OperationsStableResponse response);

    void RollbackCommandSubmission(string submissionId);
}

public interface OperationsReadStore
{
    OperationsCommandSubmission? FindCommandSubmission(string tenantId, string scope, string idempotencyKey);

    FactTraceV1? GetFactTrace(string tenantId, string submissionId);

    FactTraceV1? GetFactTraceBySubmission(string submissionId);

    IReadOnlyList<FactTraceV1> GetFactTracesByWorkItem(string workItemId);

    IReadOnlyList<FactTraceV1> GetFactTracesByCase(string caseId);
}

public sealed class InMemoryOperationsStore : OperationsWriteStore, OperationsReadStore
{
    private readonly Dictionary<string, OperationsCommandSubmission> submissions = new(StringComparer.OrdinalIgnoreCase);

    public IReadOnlyList<OperationsCommandSubmission> Submissions => submissions.Values.ToArray();

    public List<OperationsDomainEvent> DomainEvents { get; } = new();

    public List<OperationsWorkItemEvent> WorkItemEvents { get; } = new();

    public List<OperationsOutboxMessage> OutboxMessages { get; } = new();

    public List<string> WriteLog { get; } = new();

    public bool TryBeginCommandSubmission(OperationsCommandSubmission submission)
    {
        var key = Key(submission.TenantId, submission.IdempotencyScope, submission.IdempotencyKey);
        if (submissions.ContainsKey(key))
        {
            return false;
        }

        submissions[key] = submission;
        WriteLog.Add($"CommandSubmission:{submission.SubmissionId}:pending");
        return true;
    }

    public void CompleteCommandSubmission(
        OperationsCommandSubmission submission,
        OperationsFactBatch facts,
        OperationsStableResponse response)
    {
        DomainEvents.AddRange(facts.DomainEvents);
        WorkItemEvents.AddRange(facts.WorkItemEvents);
        OutboxMessages.AddRange(facts.OutboxMessages);
        WriteLog.AddRange(facts.DomainEvents.Select(item => $"DomainEvent:{item.EventId}"));
        WriteLog.AddRange(facts.WorkItemEvents.Select(item => $"WorkItemEvent:{item.WorkItemEventId}"));
        WriteLog.AddRange(facts.OutboxMessages.Select(item => $"Outbox:{item.MessageId}"));

        submissions[Key(submission.TenantId, submission.IdempotencyScope, submission.IdempotencyKey)] = submission with
        {
            Status = response.CommitStatus == "committed" ? "committed" : "rejected",
            StableResponse = response,
            CompletedAtUtc = DateTimeOffset.UtcNow
        };
        WriteLog.Add($"CommandSubmission:{submission.SubmissionId}:complete");
    }

    public void RollbackCommandSubmission(string submissionId)
    {
        var match = submissions.FirstOrDefault(item => item.Value.SubmissionId.Equals(submissionId, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(match.Key) && match.Value.Status == "pending")
        {
            submissions.Remove(match.Key);
            WriteLog.Add($"CommandSubmission:{submissionId}:rollback");
        }
    }

    public OperationsCommandSubmission? FindCommandSubmission(string tenantId, string scope, string idempotencyKey) =>
        submissions.TryGetValue(Key(tenantId, scope, idempotencyKey), out var submission)
            ? submission
            : null;

    public FactTraceV1? GetFactTrace(string tenantId, string submissionId)
    {
        var submission = submissions.Values.FirstOrDefault(item =>
            item.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase) &&
            item.SubmissionId.Equals(submissionId, StringComparison.OrdinalIgnoreCase));
        if (submission is null)
        {
            return null;
        }

        var events = DomainEvents
            .Where(item => item.SubmissionId.Equals(submissionId, StringComparison.OrdinalIgnoreCase))
            .Select(item => item.EventId)
            .ToArray();
        return new FactTraceV1(
            tenantId,
            $"trace-{submissionId}",
            submission.CaseId,
            submission.WorkItemId,
            submissionId,
            events,
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>());
    }

    public FactTraceV1? GetFactTraceBySubmission(string submissionId)
    {
        var submission = submissions.Values.FirstOrDefault(item =>
            item.SubmissionId.Equals(submissionId, StringComparison.OrdinalIgnoreCase));
        return submission is null ? null : GetFactTrace(submission.TenantId, submission.SubmissionId);
    }

    public IReadOnlyList<FactTraceV1> GetFactTracesByWorkItem(string workItemId) =>
        submissions.Values
            .Where(item => item.WorkItemId.Equals(workItemId, StringComparison.OrdinalIgnoreCase))
            .Select(item => GetFactTrace(item.TenantId, item.SubmissionId))
            .OfType<FactTraceV1>()
            .ToArray();

    public IReadOnlyList<FactTraceV1> GetFactTracesByCase(string caseId) =>
        submissions.Values
            .Where(item => item.CaseId.Equals(caseId, StringComparison.OrdinalIgnoreCase))
            .Select(item => GetFactTrace(item.TenantId, item.SubmissionId))
            .OfType<FactTraceV1>()
            .ToArray();

    private static string Key(string tenantId, string scope, string idempotencyKey) =>
        $"{tenantId}|{scope}|{idempotencyKey}";
}

public sealed class PostgresOperationsStore : OperationsWriteStore, OperationsReadStore
{
    private const string MissingTable = "42P01";
    private readonly PostgresConnectionFactory connections;

    public PostgresOperationsStore(string connectionString)
    {
        connections = new PostgresConnectionFactory(connectionString);
    }

    public bool TryBeginCommandSubmission(OperationsCommandSubmission submission)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into operations_command_submissions(
                submission_id, tenant_id, case_id, work_item_id, idempotency_scope,
                idempotency_key, payload_hash, command_type, schema_version,
                definition_version_id, status, submitted_at_utc, envelope)
            values (
                @submissionId, @tenantId, @caseId, @workItemId, @idempotencyScope,
                @idempotencyKey, @payloadHash, @commandType, @schemaVersion,
                @definitionVersionId, @status, @submittedAtUtc, @envelope::jsonb)
            on conflict do nothing
            """;
        command.Parameters.AddWithValue("submissionId", submission.SubmissionId);
        command.Parameters.AddWithValue("tenantId", submission.TenantId);
        command.Parameters.AddWithValue("caseId", submission.CaseId);
        command.Parameters.AddWithValue("workItemId", submission.WorkItemId);
        command.Parameters.AddWithValue("idempotencyScope", submission.IdempotencyScope);
        command.Parameters.AddWithValue("idempotencyKey", submission.IdempotencyKey);
        command.Parameters.AddWithValue("payloadHash", submission.PayloadHash);
        command.Parameters.AddWithValue("commandType", submission.CommandType);
        command.Parameters.AddWithValue("schemaVersion", submission.SchemaVersion);
        command.Parameters.AddWithValue("definitionVersionId", submission.DefinitionVersionId);
        command.Parameters.AddWithValue("status", submission.Status);
        command.Parameters.AddWithValue("submittedAtUtc", submission.SubmittedAtUtc);
        command.Parameters.AddWithValue("envelope", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(submission.Envelope, PostgresProjectionStore.JsonOptions));
        return command.ExecuteNonQuery() > 0;
    }

    public void CompleteCommandSubmission(
        OperationsCommandSubmission submission,
        OperationsFactBatch facts,
        OperationsStableResponse response)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        foreach (var domainEvent in facts.DomainEvents)
        {
            using var command = db.CreateCommand("""
                insert into operations_domain_events(
                    event_id, submission_id, tenant_id, case_id, work_item_id,
                    causation_id, correlation_id, event_type, occurred_at_utc, payload)
                values (
                    @eventId, @submissionId, @tenantId, @caseId, @workItemId,
                    @causationId, @correlationId, @eventType, @occurredAtUtc, @payload::jsonb)
                """);
            command.Parameters.AddWithValue("eventId", domainEvent.EventId);
            command.Parameters.AddWithValue("submissionId", domainEvent.SubmissionId);
            command.Parameters.AddWithValue("tenantId", domainEvent.TenantId);
            command.Parameters.AddWithValue("caseId", domainEvent.CaseId);
            command.Parameters.AddWithValue("workItemId", domainEvent.WorkItemId);
            command.Parameters.AddWithValue("causationId", domainEvent.CausationId);
            command.Parameters.AddWithValue("correlationId", domainEvent.CorrelationId);
            command.Parameters.AddWithValue("eventType", domainEvent.EventType);
            command.Parameters.AddWithValue("occurredAtUtc", domainEvent.OccurredAtUtc);
            command.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(domainEvent.Payload, PostgresProjectionStore.JsonOptions));
            command.ExecuteNonQuery();
        }

        foreach (var workItemEvent in facts.WorkItemEvents)
        {
            using var command = db.CreateCommand("""
                insert into operations_work_item_events(
                    work_item_event_id, submission_id, tenant_id, case_id, work_item_id,
                    event_type, from_state, to_state, occurred_at_utc, payload)
                values (
                    @eventId, @submissionId, @tenantId, @caseId, @workItemId,
                    @eventType, @fromState, @toState, @occurredAtUtc, @payload::jsonb)
                """);
            command.Parameters.AddWithValue("eventId", workItemEvent.WorkItemEventId);
            command.Parameters.AddWithValue("submissionId", workItemEvent.SubmissionId);
            command.Parameters.AddWithValue("tenantId", workItemEvent.TenantId);
            command.Parameters.AddWithValue("caseId", workItemEvent.CaseId);
            command.Parameters.AddWithValue("workItemId", workItemEvent.WorkItemId);
            command.Parameters.AddWithValue("eventType", workItemEvent.EventType);
            command.Parameters.AddWithValue("fromState", (object?)workItemEvent.FromState ?? DBNull.Value);
            command.Parameters.AddWithValue("toState", (object?)workItemEvent.ToState ?? DBNull.Value);
            command.Parameters.AddWithValue("occurredAtUtc", workItemEvent.OccurredAtUtc);
            command.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(workItemEvent.Payload, PostgresProjectionStore.JsonOptions));
            command.ExecuteNonQuery();
        }

        foreach (var outbox in facts.OutboxMessages)
        {
            using var command = db.CreateCommand("""
                insert into operations_outbox_messages(
                    message_id, event_id, submission_id, tenant_id, case_id,
                    work_item_id, message_type, created_at_utc, payload)
                values (
                    @messageId, @eventId, @submissionId, @tenantId, @caseId,
                    @workItemId, @messageType, @createdAtUtc, @payload::jsonb)
                """);
            command.Parameters.AddWithValue("messageId", outbox.MessageId);
            command.Parameters.AddWithValue("eventId", outbox.EventId);
            command.Parameters.AddWithValue("submissionId", outbox.SubmissionId);
            command.Parameters.AddWithValue("tenantId", outbox.TenantId);
            command.Parameters.AddWithValue("caseId", outbox.CaseId);
            command.Parameters.AddWithValue("workItemId", outbox.WorkItemId);
            command.Parameters.AddWithValue("messageType", outbox.MessageType);
            command.Parameters.AddWithValue("createdAtUtc", outbox.CreatedAtUtc);
            command.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(outbox.Payload, PostgresProjectionStore.JsonOptions));
            command.ExecuteNonQuery();
        }

        using (var responseCommand = db.CreateCommand("""
            insert into operations_fact_responses(
                response_id, submission_id, tenant_id, status_code, commit_status,
                projection_status, stable_response)
            values (
                @responseId, @submissionId, @tenantId, @statusCode, @commitStatus,
                @projectionStatus, @stableResponse::jsonb)
            """))
        {
            responseCommand.Parameters.AddWithValue("responseId", response.ResponseId);
            responseCommand.Parameters.AddWithValue("submissionId", response.SubmissionId);
            responseCommand.Parameters.AddWithValue("tenantId", response.TenantId);
            responseCommand.Parameters.AddWithValue("statusCode", response.StatusCode);
            responseCommand.Parameters.AddWithValue("commitStatus", response.CommitStatus);
            responseCommand.Parameters.AddWithValue("projectionStatus", response.ProjectionStatus);
            responseCommand.Parameters.AddWithValue("stableResponse", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(response, PostgresProjectionStore.JsonOptions));
            responseCommand.ExecuteNonQuery();
        }

        using (var complete = db.CreateCommand("""
            update operations_command_submissions
            set status = @status,
                completed_at_utc = @completedAtUtc,
                stable_response = @stableResponse::jsonb
            where submission_id = @submissionId
            """))
        {
            complete.Parameters.AddWithValue("submissionId", submission.SubmissionId);
            complete.Parameters.AddWithValue("status", response.CommitStatus == "committed" ? "committed" : "rejected");
            complete.Parameters.AddWithValue("completedAtUtc", DateTimeOffset.UtcNow);
            complete.Parameters.AddWithValue("stableResponse", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(response, PostgresProjectionStore.JsonOptions));
            complete.ExecuteNonQuery();
        }

        db.Commit();
    }

    public void RollbackCommandSubmission(string submissionId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            delete from operations_command_submissions
            where submission_id = @submissionId and status = 'pending'
            """;
        command.Parameters.AddWithValue("submissionId", submissionId);
        command.ExecuteNonQuery();
    }

    public OperationsCommandSubmission? FindCommandSubmission(string tenantId, string scope, string idempotencyKey)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                select submission_id, tenant_id, case_id, work_item_id, idempotency_scope,
                       idempotency_key, payload_hash, command_type, schema_version,
                       definition_version_id, status, submitted_at_utc, completed_at_utc,
                       envelope, stable_response
                from operations_command_submissions
                where tenant_id = @tenantId
                  and idempotency_scope = @scope
                  and idempotency_key = @idempotencyKey
                limit 1
                """;
            command.Parameters.AddWithValue("tenantId", tenantId);
            command.Parameters.AddWithValue("scope", scope);
            command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
            using var reader = command.ExecuteReader();
            return reader.Read() ? ReadSubmission(reader) : null;
        }
        catch (PostgresException ex) when (ex.SqlState == MissingTable)
        {
            return null;
        }
    }

    public FactTraceV1? GetFactTrace(string tenantId, string submissionId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select case_id, work_item_id
            from operations_command_submissions
            where tenant_id = @tenantId and submission_id = @submissionId
            """;
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("submissionId", submissionId);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return null;
        }

        var caseId = reader.GetString(0);
        var workItemId = reader.GetString(1);
        reader.Close();

        return new FactTraceV1(
            tenantId,
            $"trace-{submissionId}",
            caseId,
            workItemId,
            submissionId,
            LoadRefs(connection, "operations_domain_events", "event_id", tenantId, submissionId),
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>());
    }

    public FactTraceV1? GetFactTraceBySubmission(string submissionId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select tenant_id
            from operations_command_submissions
            where submission_id = @submissionId
            limit 1
            """;
        command.Parameters.AddWithValue("submissionId", submissionId);
        var tenantId = command.ExecuteScalar() as string;
        return string.IsNullOrWhiteSpace(tenantId) ? null : GetFactTrace(tenantId, submissionId);
    }

    public IReadOnlyList<FactTraceV1> GetFactTracesByWorkItem(string workItemId) =>
        LoadTraces("work_item_id", workItemId);

    public IReadOnlyList<FactTraceV1> GetFactTracesByCase(string caseId) =>
        LoadTraces("case_id", caseId);

    private static OperationsCommandSubmission ReadSubmission(NpgsqlDataReader reader)
    {
        var envelope = JsonSerializer.Deserialize<CommandEnvelopeV1>(reader.GetString(13), PostgresProjectionStore.JsonOptions)
            ?? throw new InvalidOperationException("operations_command_submission_envelope_invalid");
        OperationsStableResponse? stableResponse = null;
        if (!reader.IsDBNull(14))
        {
            stableResponse = JsonSerializer.Deserialize<OperationsStableResponse>(reader.GetString(14), PostgresProjectionStore.JsonOptions);
        }

        return new OperationsCommandSubmission(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetString(6),
            reader.GetString(7),
            reader.GetString(8),
            reader.GetString(9),
            reader.GetString(10),
            reader.GetFieldValue<DateTimeOffset>(11),
            reader.IsDBNull(12) ? null : reader.GetFieldValue<DateTimeOffset>(12),
            envelope,
            stableResponse);
    }

    private static string[] LoadRefs(
        NpgsqlConnection connection,
        string table,
        string column,
        string tenantId,
        string submissionId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"select {column} from {table} where tenant_id = @tenantId and submission_id = @submissionId order by {column}";
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("submissionId", submissionId);
        using var reader = command.ExecuteReader();
        var values = new List<string>();
        while (reader.Read())
        {
            values.Add(reader.GetString(0));
        }

        return values.ToArray();
    }

    private IReadOnlyList<FactTraceV1> LoadTraces(string column, string value)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"""
            select tenant_id, submission_id
            from operations_command_submissions
            where {column} = @value
            order by submitted_at_utc, submission_id
            """;
        command.Parameters.AddWithValue("value", value);
        using var reader = command.ExecuteReader();
        var refs = new List<(string TenantId, string SubmissionId)>();
        while (reader.Read())
        {
            refs.Add((reader.GetString(0), reader.GetString(1)));
        }

        return refs
            .Select(item => GetFactTrace(item.TenantId, item.SubmissionId))
            .OfType<FactTraceV1>()
            .ToArray();
    }
}

public sealed record OperationsCommandRequest(
    string TenantId,
    string CaseId,
    string WorkItemId,
    string CommandType,
    string SchemaVersion,
    string DefinitionVersionId,
    string IdempotencyKey,
    IReadOnlyDictionary<string, object> Payload,
    string ActorId,
    string? IdempotencyScope = null,
    string? CausationId = null,
    string? CorrelationId = null);

public sealed record OperationsCommandSubmission(
    string SubmissionId,
    string TenantId,
    string CaseId,
    string WorkItemId,
    string IdempotencyScope,
    string IdempotencyKey,
    string PayloadHash,
    string CommandType,
    string SchemaVersion,
    string DefinitionVersionId,
    string Status,
    DateTimeOffset SubmittedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    CommandEnvelopeV1 Envelope,
    OperationsStableResponse? StableResponse)
{
    public static OperationsCommandSubmission Pending(
        string submissionId,
        string scope,
        CommandEnvelopeV1 envelope) =>
        new(
            submissionId,
            envelope.TenantId,
            envelope.CaseId,
            envelope.WorkItemId,
            scope,
            envelope.IdempotencyKey,
            envelope.PayloadHash,
            envelope.CommandType,
            envelope.SchemaVersion,
            envelope.DefinitionVersionId,
            "pending",
            DateTimeOffset.UtcNow,
            null,
            envelope,
            null);
}

public sealed record IdempotencyDecision(OperationsCommitResult? Result)
{
    public static IdempotencyDecision New() => new((OperationsCommitResult?)null);

    public static IdempotencyDecision Duplicate(OperationsCommandSubmission submission) =>
        new(OperationsCommitResult.FromStableResponse(submission.StableResponse!, duplicate: true));

    public static IdempotencyDecision Conflict(OperationsCommandSubmission submission, string reason) =>
        new(OperationsCommitResult.Conflict(
            submission.TenantId,
            submission.CaseId,
            submission.WorkItemId,
            submission.IdempotencyKey,
            submission.PayloadHash,
            reason));
}

public sealed record SliceCommandHandlerResult(
    string CommitStatus,
    string ProjectionStatus,
    int StatusCode,
    IReadOnlyDictionary<string, object> ResponseBody,
    IReadOnlyList<OperationsDomainEventDraft> DomainEvents,
    IReadOnlyList<OperationsWorkItemEventDraft> WorkItemEvents,
    IReadOnlyList<OperationsOutboxMessageDraft> OutboxMessages,
    IReadOnlyList<LedgerTransactionV1> LedgerTransactions,
    IReadOnlyList<LedgerEntryV1> LedgerEntries)
{
    public static SliceCommandHandlerResult Committed(
        IReadOnlyDictionary<string, object> responseBody,
        IReadOnlyList<OperationsDomainEventDraft> domainEvents,
        IReadOnlyList<OperationsWorkItemEventDraft>? workItemEvents = null,
        IReadOnlyList<OperationsOutboxMessageDraft>? outboxMessages = null,
        string projectionStatus = "projected") =>
        new(
            "committed",
            projectionStatus,
            StatusCodes.Status200OK,
            responseBody,
            domainEvents,
            workItemEvents ?? Array.Empty<OperationsWorkItemEventDraft>(),
            outboxMessages ?? Array.Empty<OperationsOutboxMessageDraft>(),
            Array.Empty<LedgerTransactionV1>(),
            Array.Empty<LedgerEntryV1>());

    public static SliceCommandHandlerResult Rejected(
        int statusCode,
        string reason) =>
        new(
            "not_committed",
            "not_projected",
            statusCode,
            new Dictionary<string, object> { ["reason"] = reason },
            Array.Empty<OperationsDomainEventDraft>(),
            Array.Empty<OperationsWorkItemEventDraft>(),
            Array.Empty<OperationsOutboxMessageDraft>(),
            Array.Empty<LedgerTransactionV1>(),
            Array.Empty<LedgerEntryV1>());
}

public sealed record OperationsDomainEventDraft(
    string EventType,
    IReadOnlyDictionary<string, object> Payload,
    string? EventId = null);

public sealed record OperationsWorkItemEventDraft(
    string EventType,
    string? FromState,
    string? ToState,
    IReadOnlyDictionary<string, object> Payload,
    string? WorkItemEventId = null);

public sealed record OperationsOutboxMessageDraft(
    string MessageType,
    IReadOnlyDictionary<string, object> Payload,
    string? EventId = null,
    string? MessageId = null);

public sealed record OperationsFactBatch(
    IReadOnlyList<OperationsDomainEvent> DomainEvents,
    IReadOnlyList<OperationsWorkItemEvent> WorkItemEvents,
    IReadOnlyList<OperationsOutboxMessage> OutboxMessages);

public sealed record OperationsDomainEvent(
    string TenantId,
    string EventId,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    string CausationId,
    string CorrelationId,
    string EventType,
    IReadOnlyDictionary<string, object> Payload,
    DateTimeOffset OccurredAtUtc);

public sealed record OperationsWorkItemEvent(
    string TenantId,
    string WorkItemEventId,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    string EventType,
    string? FromState,
    string? ToState,
    IReadOnlyDictionary<string, object> Payload,
    DateTimeOffset OccurredAtUtc);

public sealed record OperationsOutboxMessage(
    string MessageId,
    string EventId,
    string TenantId,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    string MessageType,
    IReadOnlyDictionary<string, object> Payload,
    DateTimeOffset CreatedAtUtc);

public sealed record OperationsStableResponse(
    string ResponseId,
    string TenantId,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    string IdempotencyKey,
    string PayloadHash,
    int StatusCode,
    string CommitStatus,
    string ProjectionStatus,
    IReadOnlyList<string> DomainEventIds,
    IReadOnlyDictionary<string, object> Body)
{
    public static OperationsStableResponse From(
        OperationsCommandRequest request,
        OperationsCommandSubmission submission,
        string payloadHash,
        SliceCommandHandlerResult handled,
        OperationsFactBatch facts) =>
        new(
            $"rsp-{OperationsUnitOfWorkHash.Short(submission.SubmissionId)}",
            request.TenantId,
            request.CaseId,
            request.WorkItemId,
            submission.SubmissionId,
            request.IdempotencyKey,
            payloadHash,
            handled.StatusCode,
            handled.CommitStatus,
            handled.ProjectionStatus,
            facts.DomainEvents.Select(item => item.EventId).ToArray(),
            handled.ResponseBody);
}

public sealed record OperationsCommitResult(
    string Status,
    bool Duplicate,
    int StatusCode,
    string? Reason,
    string TenantId,
    string CaseId,
    string WorkItemId,
    string SubmissionId,
    string IdempotencyKey,
    string PayloadHash,
    string CommitStatus,
    string ProjectionStatus,
    IReadOnlyList<string> DomainEventIds,
    IReadOnlyDictionary<string, object> ResponseBody)
{
    public static OperationsCommitResult FromStableResponse(OperationsStableResponse response, bool duplicate) =>
        new(
            duplicate ? "duplicate" : response.CommitStatus,
            duplicate,
            response.StatusCode,
            null,
            response.TenantId,
            response.CaseId,
            response.WorkItemId,
            response.SubmissionId,
            response.IdempotencyKey,
            response.PayloadHash,
            response.CommitStatus,
            response.ProjectionStatus,
            response.DomainEventIds,
            response.Body);

    public static OperationsCommitResult Conflict(OperationsCommandRequest request, string payloadHash, string reason) =>
        Conflict(request.TenantId, request.CaseId, request.WorkItemId, request.IdempotencyKey, payloadHash, reason);

    public static OperationsCommitResult Conflict(
        string tenantId,
        string caseId,
        string workItemId,
        string idempotencyKey,
        string payloadHash,
        string reason) =>
        new(
            "conflict",
            false,
            StatusCodes.Status409Conflict,
            reason,
            tenantId,
            caseId,
            workItemId,
            string.Empty,
            idempotencyKey,
            payloadHash,
            "not_committed",
            "not_projected",
            Array.Empty<string>(),
            new Dictionary<string, object> { ["reason"] = reason });

    public static OperationsCommitResult Failed(
        OperationsCommandRequest request,
        string payloadHash,
        string error,
        string reason) =>
        new(
            "failed",
            false,
            StatusCodes.Status500InternalServerError,
            reason,
            request.TenantId,
            request.CaseId,
            request.WorkItemId,
            string.Empty,
            request.IdempotencyKey,
            payloadHash,
            "not_committed",
            "not_projected",
            Array.Empty<string>(),
            new Dictionary<string, object> { ["error"] = error, ["reason"] = reason });
}

internal static class OperationsUnitOfWorkHash
{
    public static string Short(params string[] parts)
    {
        var value = string.Join("|", parts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
