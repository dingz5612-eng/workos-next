using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public sealed record DeadLetterReplayRequest(
    string Action,
    string? MessageId = null,
    string? EventType = null,
    string? TenantId = null,
    string? ActorId = null,
    string? Reason = null,
    int Take = 50,
    bool IncludeBody = false,
    string? ActorRole = null,
    IReadOnlyList<string>? ActorCapabilities = null,
    string? DeviceId = null,
    string? DeviceTrustStatus = null,
    string Surface = "pc");

public sealed record DeadLetterReplayResult(
    string Action,
    string Status,
    string? ActorId,
    string? Reason,
    int MessageCount,
    int UnhandledP0DeadLetterCount,
    IReadOnlyList<DeadLetterReplayMessageResult> Messages,
    DateTimeOffset CreatedAtUtc);

public sealed record DeadLetterReplayMessageResult(
    string MessageId,
    string EventId,
    string TenantId,
    string EventType,
    string Status,
    int AttemptCount,
    DateTimeOffset? DeadLetteredAtUtc,
    string? LastError,
    string? Body);

internal sealed record OutboxDeadLetterReplayAuditWrite(
    string ReplayAuditId,
    string MessageId,
    string TenantId,
    string EventId,
    string EventType,
    string Action,
    string Status,
    string ActorId,
    string Reason,
    int AttemptCount,
    DateTimeOffset? DeadLetteredAtUtc,
    string DetailsJson,
    DateTimeOffset CreatedAtUtc);

internal interface IOutboxDeadLetterReplayStore
{
    IReadOnlyList<OutboxMessage> ListDeadLetters(string? tenantId, string? eventType, int take);

    OutboxMessage? FindMessage(string messageId);

    bool ReleaseDeadLetter(string messageId);

    void WriteReplayAudit(OutboxDeadLetterReplayAuditWrite audit);

    int CountUnhandledP0DeadLetters();
}

internal sealed class OutboxDeadLetterReplayService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly IOutboxDeadLetterReplayStore store;

    public OutboxDeadLetterReplayService(IOutboxDeadLetterReplayStore store)
    {
        this.store = store;
    }

    public DeadLetterReplayResult Run(DeadLetterReplayRequest request) =>
        NormalizeAction(request.Action) switch
        {
            "list" => List(request),
            "inspect" => Inspect(request),
            "replay" => Replay(request),
            "ignore" => MarkIgnored(request),
            _ => throw new InvalidOperationException($"dead_letter_unknown_action:{request.Action}")
        };

    private DeadLetterReplayResult List(DeadLetterReplayRequest request)
    {
        var messages = store.ListDeadLetters(request.TenantId, request.EventType, NormalizeTake(request.Take))
            .Select(message => ToResult(message, "dead_lettered", request.IncludeBody))
            .ToArray();

        return Result(request, "listed", messages);
    }

    private DeadLetterReplayResult Inspect(DeadLetterReplayRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.MessageId))
        {
            throw new InvalidOperationException("dead_letter_message_id_required");
        }

        var message = store.FindMessage(request.MessageId);
        if (message is null)
        {
            return Result(request, "not_found", []);
        }

        return Result(request, "inspected", [ToResult(message, StatusFor(message), includeBody: true)]);
    }

    private DeadLetterReplayResult Replay(DeadLetterReplayRequest request)
    {
        ValidateMutatingRequest(request);

        if (!string.IsNullOrWhiteSpace(request.MessageId))
        {
            var message = store.FindMessage(request.MessageId);
            if (message is null)
            {
                return Result(request, "not_found", []);
            }

            return Result(request, ReplayOne(message, request));
        }

        if (string.IsNullOrWhiteSpace(request.EventType) && string.IsNullOrWhiteSpace(request.TenantId))
        {
            throw new InvalidOperationException("dead_letter_replay_filter_required");
        }

        var messages = store.ListDeadLetters(request.TenantId, request.EventType, NormalizeTake(request.Take))
            .Select(message => ReplayOne(message, request).Single())
            .ToArray();
        var status = messages.Length == 0
            ? "empty"
            : messages.All(item => item.Status == "replay_queued") ? "replay_queued" : "partial";

        return Result(request, status, messages);
    }

    private DeadLetterReplayResult MarkIgnored(DeadLetterReplayRequest request)
    {
        ValidateMutatingRequest(request);
        if (string.IsNullOrWhiteSpace(request.MessageId))
        {
            throw new InvalidOperationException("dead_letter_message_id_required");
        }

        var message = store.FindMessage(request.MessageId);
        if (message is null)
        {
            return Result(request, "not_found", []);
        }

        var status = message.ProcessedAtUtc is not null
            ? "already_processed"
            : message.DeadLetteredAtUtc is null ? "already_pending" : "ignored";
        WriteAudit(message, "ignore", status, request);

        return Result(request, status, [ToResult(message, status, request.IncludeBody)]);
    }

    private IReadOnlyList<DeadLetterReplayMessageResult> ReplayOne(
        OutboxMessage message,
        DeadLetterReplayRequest request)
    {
        var status = StatusForReplay(message);
        if (status == "replay_queued")
        {
            status = store.ReleaseDeadLetter(message.MessageId) ? "replay_queued" : "already_pending";
        }

        WriteAudit(message, "replay", status, request);
        return [ToResult(message, status, request.IncludeBody)];
    }

    private void WriteAudit(
        OutboxMessage message,
        string action,
        string status,
        DeadLetterReplayRequest request)
    {
        var actorId = request.ActorId ?? throw new InvalidOperationException("dead_letter_replay_actor_required");
        var reason = request.Reason ?? throw new InvalidOperationException("dead_letter_replay_reason_required");
        var createdAt = DateTimeOffset.UtcNow;
        var details = JsonSerializer.Serialize(new
        {
            action,
            status,
            message.MessageId,
            message.EventId,
            tenantId = message.WorkspaceId,
            message.EventType,
            message.AttemptCount,
            message.DeadLetteredAtUtc,
            message.LastError,
            replayScope = new
            {
                request.MessageId,
                request.EventType,
                request.TenantId
            },
            authorization = new
            {
                request.ActorRole,
                request.DeviceId,
                request.DeviceTrustStatus,
                request.Surface,
                request.ActorCapabilities
            }
        }, JsonOptions);

        store.WriteReplayAudit(new OutboxDeadLetterReplayAuditWrite(
            $"outbox-replay-audit-{Guid.NewGuid():N}",
            message.MessageId,
            message.WorkspaceId,
            message.EventId,
            message.EventType,
            action,
            status,
            actorId,
            reason,
            message.AttemptCount,
            message.DeadLetteredAtUtc,
            details,
            createdAt));
    }

    private DeadLetterReplayResult Result(
        DeadLetterReplayRequest request,
        IReadOnlyList<DeadLetterReplayMessageResult> messages)
    {
        var status = messages.Count == 0 ? "empty" : messages.Single().Status;
        return Result(request, status, messages);
    }

    private DeadLetterReplayResult Result(
        DeadLetterReplayRequest request,
        string status,
        IReadOnlyList<DeadLetterReplayMessageResult> messages) =>
        new(
            NormalizeAction(request.Action),
            status,
            request.ActorId,
            request.Reason,
            messages.Count,
            store.CountUnhandledP0DeadLetters(),
            messages,
            DateTimeOffset.UtcNow);

    private static DeadLetterReplayMessageResult ToResult(
        OutboxMessage message,
        string status,
        bool includeBody) =>
        new(
            message.MessageId,
            message.EventId,
            message.WorkspaceId,
            message.EventType,
            status,
            message.AttemptCount,
            message.DeadLetteredAtUtc,
            message.LastError,
            includeBody ? JsonSerializer.Serialize(message, JsonOptions) : null);

    private static string StatusForReplay(OutboxMessage message)
    {
        if (message.ProcessedAtUtc is not null)
        {
            return "already_processed";
        }

        return message.DeadLetteredAtUtc is null ? "already_pending" : "replay_queued";
    }

    private static string StatusFor(OutboxMessage message)
    {
        if (message.ProcessedAtUtc is not null)
        {
            return "already_processed";
        }

        return message.DeadLetteredAtUtc is null ? "pending" : "dead_lettered";
    }

    private static void ValidateMutatingRequest(DeadLetterReplayRequest request)
    {
        RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "deadletter.replay",
            request.ActorId,
            request.ActorRole,
            request.ActorCapabilities,
            request.DeviceTrustStatus,
            request.Surface,
            request.Reason);
    }

    private static int NormalizeTake(int take) => take <= 0 ? 50 : Math.Min(take, 500);

    private static string NormalizeAction(string action) =>
        string.IsNullOrWhiteSpace(action) ? "list" : action.Trim().ToLowerInvariant();
}

public static class OutboxDeadLetterReplayCli
{
    public static int Run(string[] args)
    {
        try
        {
            var parsed = Parse(args);
            var result = RunPostgres(parsed.ConnectionString, parsed.Request, parsed.MigrationsPath);
            Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                WriteIndented = true
            }));
            return result.Status == "failed" ? 1 : 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    public static DeadLetterReplayResult RunPostgres(
        string connectionString,
        DeadLetterReplayRequest request,
        string? migrationsPath = null)
    {
        var connections = new PostgresConnectionFactory(connectionString);
        new PostgresMigrationRunner(connections, migrationsPath).Run();
        var store = new PostgresOutboxDeadLetterReplayStore(connections);
        return new OutboxDeadLetterReplayService(store).Run(request);
    }

    internal static OutboxDeadLetterReplayCliOptions Parse(string[] args)
    {
        var action = "list";
        var start = 0;
        if (args.Length > 0 && !args[0].StartsWith("--", StringComparison.Ordinal))
        {
            action = args[0];
            start = 1;
        }

        var flags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = start; i < args.Length; i++)
        {
            var arg = args[i];
            if (!arg.StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var key = arg[2..];
            if (key is "include-body")
            {
                flags.Add(key);
                continue;
            }

            if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"dead_letter_missing_value:{arg}");
            }

            values[key] = args[++i];
        }

        values.TryGetValue("message-id", out var messageId);
        values.TryGetValue("event-type", out var eventType);
        values.TryGetValue("tenant", out var tenantId);
        values.TryGetValue("actor", out var actorId);
        values.TryGetValue("reason", out var reason);
        values.TryGetValue("actor-role", out var actorRole);
        values.TryGetValue("capabilities", out var capabilities);
        values.TryGetValue("device-id", out var deviceId);
        values.TryGetValue("device-trust", out var deviceTrustStatus);
        values.TryGetValue("surface", out var surface);
        values.TryGetValue("connection-string", out var connectionString);
        values.TryGetValue("migrations-path", out var migrationsPath);
        var take = values.TryGetValue("take", out var takeText) && int.TryParse(takeText, out var parsedTake)
            ? parsedTake
            : 50;

        connectionString = string.IsNullOrWhiteSpace(connectionString)
            ? Environment.GetEnvironmentVariable("WORKOS_RUNTIME_CONNECTION")
              ?? Environment.GetEnvironmentVariable("ConnectionStrings__WorkOSRuntime")
              ?? "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev"
            : connectionString;

        return new OutboxDeadLetterReplayCliOptions(
            new DeadLetterReplayRequest(
                action,
                messageId,
                eventType,
                tenantId,
                actorId,
                reason,
                take,
                flags.Contains("include-body") || action.Equals("inspect", StringComparison.OrdinalIgnoreCase),
                actorRole,
                SplitCapabilities(capabilities),
                deviceId,
                deviceTrustStatus,
                string.IsNullOrWhiteSpace(surface) ? "pc" : surface),
            connectionString,
            migrationsPath ?? Environment.GetEnvironmentVariable("WORKOS_MIGRATIONS_PATH"));
    }

    private static IReadOnlyList<string> SplitCapabilities(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

internal sealed record OutboxDeadLetterReplayCliOptions(
    DeadLetterReplayRequest Request,
    string ConnectionString,
    string? MigrationsPath);

internal sealed class PostgresOutboxDeadLetterReplayStore : IOutboxDeadLetterReplayStore
{
    private readonly PostgresConnectionFactory connections;

    public PostgresOutboxDeadLetterReplayStore(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public IReadOnlyList<OutboxMessage> ListDeadLetters(string? tenantId, string? eventType, int take)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select body, processed_at_utc, claimed_by, claimed_at_utc, claim_expires_at_utc,
                   attempt_count, dead_lettered_at_utc, last_error
            from outbox_messages
            where processed_at_utc is null
              and dead_lettered_at_utc is not null
              and (@tenantId is null or workspace_id = @tenantId)
              and (@eventType is null or event_type = @eventType)
            order by dead_lettered_at_utc, created_at_utc, message_id
            limit @take
            """;
        command.Parameters.AddWithValue("tenantId", (object?)tenantId ?? DBNull.Value);
        command.Parameters.AddWithValue("eventType", (object?)eventType ?? DBNull.Value);
        command.Parameters.AddWithValue("take", take);
        return ReadMessages(command);
    }

    public OutboxMessage? FindMessage(string messageId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select body, processed_at_utc, claimed_by, claimed_at_utc, claim_expires_at_utc,
                   attempt_count, dead_lettered_at_utc, last_error
            from outbox_messages
            where message_id = @messageId
            """;
        command.Parameters.AddWithValue("messageId", messageId);
        return ReadMessages(command).SingleOrDefault();
    }

    public bool ReleaseDeadLetter(string messageId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            update outbox_messages
            set dead_lettered_at_utc = null,
                claimed_by = null,
                claimed_at_utc = null,
                claim_expires_at_utc = null,
                last_error = null
            where message_id = @messageId
              and processed_at_utc is null
              and dead_lettered_at_utc is not null
            """;
        command.Parameters.AddWithValue("messageId", messageId);
        return command.ExecuteNonQuery() == 1;
    }

    public void WriteReplayAudit(OutboxDeadLetterReplayAuditWrite audit)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into outbox_dead_letter_replay_audits(
                replay_audit_id, message_id, tenant_id, event_id, event_type,
                action, status, actor_id, reason, attempt_count,
                dead_lettered_at_utc, details, created_at_utc)
            values (
                @replayAuditId, @messageId, @tenantId, @eventId, @eventType,
                @action, @status, @actorId, @reason, @attemptCount,
                @deadLetteredAtUtc, @details::jsonb, @createdAtUtc)
            """;
        command.Parameters.AddWithValue("replayAuditId", audit.ReplayAuditId);
        command.Parameters.AddWithValue("messageId", audit.MessageId);
        command.Parameters.AddWithValue("tenantId", audit.TenantId);
        command.Parameters.AddWithValue("eventId", audit.EventId);
        command.Parameters.AddWithValue("eventType", audit.EventType);
        command.Parameters.AddWithValue("action", audit.Action);
        command.Parameters.AddWithValue("status", audit.Status);
        command.Parameters.AddWithValue("actorId", audit.ActorId);
        command.Parameters.AddWithValue("reason", audit.Reason);
        command.Parameters.AddWithValue("attemptCount", audit.AttemptCount);
        command.Parameters.AddWithValue("deadLetteredAtUtc", (object?)audit.DeadLetteredAtUtc ?? DBNull.Value);
        command.Parameters.AddWithValue("details", NpgsqlDbType.Jsonb, audit.DetailsJson);
        command.Parameters.AddWithValue("createdAtUtc", audit.CreatedAtUtc);
        command.ExecuteNonQuery();
    }

    public int CountUnhandledP0DeadLetters()
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select count(*)::int
            from outbox_messages item
            where item.processed_at_utc is null
              and item.dead_lettered_at_utc is not null
              and not exists (
                  select 1
                  from outbox_dead_letter_replay_audits audit
                  where audit.message_id = item.message_id
                    and audit.action = 'ignore'
                    and audit.status = 'ignored'
                    and audit.created_at_utc >= item.dead_lettered_at_utc
              )
            """;
        return (int)command.ExecuteScalar()!;
    }

    private static IReadOnlyList<OutboxMessage> ReadMessages(NpgsqlCommand command)
    {
        using var reader = command.ExecuteReader();
        var messages = new List<OutboxMessage>();
        while (reader.Read())
        {
            var item = JsonSerializer.Deserialize<OutboxMessage>(reader.GetString(0), PostgresProjectionStore.JsonOptions);
            if (item is null)
            {
                continue;
            }

            DateTimeOffset? processedAtUtc = reader.IsDBNull(1) ? null : reader.GetFieldValue<DateTimeOffset>(1);
            var claimedBy = reader.IsDBNull(2) ? null : reader.GetString(2);
            DateTimeOffset? claimedAtUtc = reader.IsDBNull(3) ? null : reader.GetFieldValue<DateTimeOffset>(3);
            DateTimeOffset? claimExpiresAtUtc = reader.IsDBNull(4) ? null : reader.GetFieldValue<DateTimeOffset>(4);
            var attemptCount = reader.GetInt32(5);
            DateTimeOffset? deadLetteredAtUtc = reader.IsDBNull(6) ? null : reader.GetFieldValue<DateTimeOffset>(6);
            var lastError = reader.IsDBNull(7) ? null : reader.GetString(7);
            messages.Add(item with
            {
                ProcessedAtUtc = processedAtUtc,
                ClaimedBy = claimedBy,
                ClaimedAtUtc = claimedAtUtc,
                ClaimExpiresAtUtc = claimExpiresAtUtc,
                AttemptCount = attemptCount,
                DeadLetteredAtUtc = deadLetteredAtUtc,
                LastError = lastError
            });
        }

        return messages;
    }
}
