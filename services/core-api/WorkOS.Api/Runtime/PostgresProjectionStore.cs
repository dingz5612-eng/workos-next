using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public sealed class PostgresProjectionStore : IProjectionStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly string connectionString;

    public PostgresProjectionStore(string connectionString)
    {
        this.connectionString = connectionString;
        RunMigrations();
    }

    public RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "select body from runtime_documents where id = 'state'";
        var raw = command.ExecuteScalar() as string;
        if (!string.IsNullOrWhiteSpace(raw))
        {
            return JsonSerializer.Deserialize<RuntimeState>(raw, JsonOptions) ?? seedFactory();
        }

        var seeded = seedFactory();
        SaveState(seeded);
        return seeded;
    }

    public void SaveState(RuntimeState state)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into runtime_documents(id, body, updated_at_utc)
            values ('state', @body::jsonb, @updatedAtUtc)
            on conflict(id) do update set body = excluded.body, updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(state, JsonOptions));
        command.Parameters.AddWithValue("updatedAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }

    public RuntimeSession CreateSession(RuntimeUser user)
    {
        var session = new RuntimeSession(
            $"sess-{Guid.NewGuid():N}",
            user.UserId,
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow.AddHours(8));

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into runtime_sessions(token, user_id, issued_at_utc, expires_at_utc, body)
            values (@token, @userId, @issuedAtUtc, @expiresAtUtc, @body::jsonb)
            """;
        command.Parameters.AddWithValue("token", session.Token);
        command.Parameters.AddWithValue("userId", session.UserId);
        command.Parameters.AddWithValue("issuedAtUtc", session.IssuedAtUtc);
        command.Parameters.AddWithValue("expiresAtUtc", session.ExpiresAtUtc);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(session, JsonOptions));
        command.ExecuteNonQuery();
        return session;
    }

    public RuntimeUser? FindUserBySessionToken(string token)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "select user_id from runtime_sessions where token = @token and expires_at_utc > @now";
        command.Parameters.AddWithValue("token", token);
        command.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
        var userId = command.ExecuteScalar() as string;
        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        var state = LoadOrSeed(ProjectionSeed.Create);
        return state.Users.FirstOrDefault(user => user.Enabled && user.UserId == userId);
    }

    public WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "select body from audit_events where idempotency_key = @idempotencyKey";
        command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
        var raw = command.ExecuteScalar() as string;
        return string.IsNullOrWhiteSpace(raw) ? null : JsonSerializer.Deserialize<WorkspaceEvent>(raw, JsonOptions);
    }

    public void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey)
    {
        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();

        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
            insert into audit_events(event_id, idempotency_key, workspace_id, card_id, event_type, actor_type, actor_id, occurred_at_utc, body)
            values (@eventId, @idempotencyKey, @workspaceId, @cardId, @eventType, @actorType, @actorId, @occurredAtUtc, @body::jsonb)
            on conflict(event_id) do nothing
            """;
            command.Parameters.AddWithValue("eventId", workspaceEvent.EventId);
            command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
            command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
            command.Parameters.AddWithValue("cardId", workspaceEvent.CardId);
            command.Parameters.AddWithValue("eventType", workspaceEvent.EventType);
            command.Parameters.AddWithValue("actorType", workspaceEvent.ActorType);
            command.Parameters.AddWithValue("actorId", workspaceEvent.ActorId);
            command.Parameters.AddWithValue("occurredAtUtc", workspaceEvent.OccurredAtUtc);
            command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(workspaceEvent, JsonOptions));
            command.ExecuteNonQuery();
        }

        var outboxMessage = new OutboxMessage(
            $"out-{Guid.NewGuid():N}",
            workspaceEvent.EventId,
            workspaceEvent.WorkspaceId,
            workspaceEvent.CardId,
            workspaceEvent.EventType,
            DateTimeOffset.UtcNow,
            null,
            workspaceEvent);

        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
            insert into outbox_messages(message_id, event_id, idempotency_key, workspace_id, card_id, event_type, created_at_utc, processed_at_utc, body)
            values (@messageId, @eventId, @idempotencyKey, @workspaceId, @cardId, @eventType, @createdAtUtc, @processedAtUtc, @body::jsonb)
            on conflict(message_id) do nothing
            """;
            command.Parameters.AddWithValue("messageId", outboxMessage.MessageId);
            command.Parameters.AddWithValue("eventId", outboxMessage.EventId);
            command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
            command.Parameters.AddWithValue("workspaceId", outboxMessage.WorkspaceId);
            command.Parameters.AddWithValue("cardId", outboxMessage.CardId);
            command.Parameters.AddWithValue("eventType", outboxMessage.EventType);
            command.Parameters.AddWithValue("createdAtUtc", outboxMessage.CreatedAtUtc);
            command.Parameters.AddWithValue("processedAtUtc", DBNull.Value);
            command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(outboxMessage, JsonOptions));
            command.ExecuteNonQuery();
        }

        transaction.Commit();
    }

    public IReadOnlyList<OutboxMessage> GetPendingOutboxMessages(int take = 50)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select body, processed_at_utc from outbox_messages
            where processed_at_utc is null
            order by created_at_utc, message_id
            limit @take
            """;
        command.Parameters.AddWithValue("take", take);
        return ReadOutboxMessages(command);
    }

    public IReadOnlyList<OutboxMessage> GetOutboxMessages()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "select body, processed_at_utc from outbox_messages order by created_at_utc, message_id";
        return ReadOutboxMessages(command);
    }

    public void MarkOutboxProcessed(string messageId)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        var processedAtUtc = DateTimeOffset.UtcNow;
        command.CommandText = """
            update outbox_messages
            set processed_at_utc = @processedAtUtc
            where message_id = @messageId
            """;
        command.Parameters.AddWithValue("messageId", messageId);
        command.Parameters.AddWithValue("processedAtUtc", processedAtUtc);
        command.ExecuteNonQuery();
    }

    public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into behavior_events(event_id, event_type, object_type, object_id, language, source, occurred_at_utc, body)
            values (@eventId, @eventType, @objectType, @objectId, @language, @source, @occurredAtUtc, @body::jsonb)
            on conflict(event_id) do nothing
            """;
        command.Parameters.AddWithValue("eventId", behaviorEvent.EventId);
        command.Parameters.AddWithValue("eventType", behaviorEvent.EventType);
        command.Parameters.AddWithValue("objectType", (object?)behaviorEvent.ObjectType ?? DBNull.Value);
        command.Parameters.AddWithValue("objectId", (object?)behaviorEvent.ObjectId ?? DBNull.Value);
        command.Parameters.AddWithValue("language", behaviorEvent.Language);
        command.Parameters.AddWithValue("source", (object?)behaviorEvent.Source ?? DBNull.Value);
        command.Parameters.AddWithValue("occurredAtUtc", behaviorEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(behaviorEvent, JsonOptions));
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = workspaceId is null
            ? "select body from audit_events order by occurred_at_utc, event_id"
            : "select body from audit_events where workspace_id = @workspaceId order by occurred_at_utc, event_id";
        if (workspaceId is not null)
        {
            command.Parameters.AddWithValue("workspaceId", workspaceId);
        }

        using var reader = command.ExecuteReader();
        var events = new List<WorkspaceEvent>();
        while (reader.Read())
        {
            var raw = reader.GetString(0);
            var item = JsonSerializer.Deserialize<WorkspaceEvent>(raw, JsonOptions);
            if (item is not null)
            {
                events.Add(item);
            }
        }

        return events;
    }

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "select body from behavior_events order by occurred_at_utc, event_id";
        using var reader = command.ExecuteReader();
        var events = new List<BehaviorEventRecord>();
        while (reader.Read())
        {
            var raw = reader.GetString(0);
            var item = JsonSerializer.Deserialize<BehaviorEventRecord>(raw, JsonOptions);
            if (item is not null)
            {
                events.Add(item);
            }
        }

        return events;
    }

    private NpgsqlConnection OpenConnection()
    {
        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private void RunMigrations()
    {
        using var connection = OpenConnection();
        using var bootstrap = connection.CreateCommand();
        bootstrap.CommandText = """
            create table if not exists schema_migrations (
                migration_id text primary key,
                applied_at_utc timestamptz not null
            );
            """;
        bootstrap.ExecuteNonQuery();

        ApplyMigration(connection, "001_runtime_core", """
            create table if not exists runtime_documents (
                id text primary key,
                body jsonb not null,
                updated_at_utc timestamptz not null
            );

            create table if not exists audit_events (
                event_id text primary key,
                idempotency_key text null unique,
                workspace_id text not null,
                card_id text not null,
                event_type text not null,
                actor_type text not null,
                actor_id text not null,
                occurred_at_utc timestamptz not null,
                body jsonb not null
            );

            create index if not exists ix_audit_events_workspace on audit_events(workspace_id, occurred_at_utc);

            create table if not exists outbox_messages (
                message_id text primary key,
                event_id text not null,
                idempotency_key text null,
                workspace_id text not null,
                card_id text not null,
                event_type text not null,
                created_at_utc timestamptz not null,
                processed_at_utc timestamptz null,
                body jsonb not null
            );

            create index if not exists ix_outbox_pending on outbox_messages(processed_at_utc, created_at_utc);

            create table if not exists behavior_events (
                event_id text primary key,
                event_type text not null,
                object_type text null,
                object_id text null,
                language text not null,
                source text null,
                occurred_at_utc timestamptz not null,
                body jsonb not null
            );

            create index if not exists ix_behavior_events_object on behavior_events(object_type, object_id, occurred_at_utc);
            """);
        ApplyMigration(connection, "002_runtime_sessions", """
            create table if not exists runtime_sessions (
                token text primary key,
                user_id text not null,
                issued_at_utc timestamptz not null,
                expires_at_utc timestamptz not null,
                body jsonb not null
            );

            create index if not exists ix_runtime_sessions_user on runtime_sessions(user_id, expires_at_utc);
            """);
        ApplyMigration(connection, "003_idempotency_columns", """
            alter table audit_events add column if not exists idempotency_key text null;
            create unique index if not exists ux_audit_events_idempotency_key
                on audit_events(idempotency_key)
                where idempotency_key is not null;
            alter table outbox_messages add column if not exists idempotency_key text null;
            """);
    }

    private static void ApplyMigration(NpgsqlConnection connection, string migrationId, string sql)
    {
        using var exists = connection.CreateCommand();
        exists.CommandText = "select 1 from schema_migrations where migration_id = @migrationId";
        exists.Parameters.AddWithValue("migrationId", migrationId);
        if (exists.ExecuteScalar() is not null)
        {
            return;
        }

        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        command.ExecuteNonQuery();

        using var insert = connection.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = "insert into schema_migrations(migration_id, applied_at_utc) values (@migrationId, @appliedAtUtc)";
        insert.Parameters.AddWithValue("migrationId", migrationId);
        insert.Parameters.AddWithValue("appliedAtUtc", DateTimeOffset.UtcNow);
        insert.ExecuteNonQuery();
        transaction.Commit();
    }

    private static IReadOnlyList<OutboxMessage> ReadOutboxMessages(NpgsqlCommand command)
    {
        using var reader = command.ExecuteReader();
        var messages = new List<OutboxMessage>();
        while (reader.Read())
        {
            var raw = reader.GetString(0);
            var item = JsonSerializer.Deserialize<OutboxMessage>(raw, JsonOptions);
            if (item is not null)
            {
                DateTimeOffset? processedAtUtc = reader.IsDBNull(1) ? null : reader.GetFieldValue<DateTimeOffset>(1);
                messages.Add(item with { ProcessedAtUtc = processedAtUtc });
            }
        }

        return messages;
    }
}
