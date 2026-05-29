using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeEventStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeEventStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "select body from audit_events where idempotency_key = @idempotencyKey";
        command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
        var raw = command.ExecuteScalar() as string;
        return string.IsNullOrWhiteSpace(raw) ? null : JsonSerializer.Deserialize<WorkspaceEvent>(raw, PostgresProjectionStore.JsonOptions);
    }

    public void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        InsertAuditEventAndOutbox(db, workspaceEvent, idempotencyKey);
        db.Commit();
    }

    public bool InsertAuditEventAndOutbox(RuntimeDbSession db, WorkspaceEvent workspaceEvent, string idempotencyKey)
    {
        using (var command = db.CreateCommand("""
            insert into audit_events(event_id, idempotency_key, workspace_id, card_id, event_type, correlation_id, causation_id, request_id, actor_type, actor_id, occurred_at_utc, body)
            values (@eventId, @idempotencyKey, @workspaceId, @cardId, @eventType, @correlationId, @causationId, @requestId, @actorType, @actorId, @occurredAtUtc, @body::jsonb)
            on conflict(idempotency_key) do nothing
            """))
        {
            command.Parameters.AddWithValue("eventId", workspaceEvent.EventId);
            command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
            command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
            command.Parameters.AddWithValue("cardId", workspaceEvent.CardId);
            command.Parameters.AddWithValue("eventType", workspaceEvent.EventType);
            command.Parameters.AddWithValue("correlationId", workspaceEvent.CorrelationId);
            command.Parameters.AddWithValue("causationId", (object?)workspaceEvent.CausationId ?? DBNull.Value);
            command.Parameters.AddWithValue("requestId", workspaceEvent.RequestId);
            command.Parameters.AddWithValue("actorType", workspaceEvent.ActorType);
            command.Parameters.AddWithValue("actorId", workspaceEvent.ActorId);
            command.Parameters.AddWithValue("occurredAtUtc", workspaceEvent.OccurredAtUtc);
            command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(workspaceEvent, PostgresProjectionStore.JsonOptions));
            if (command.ExecuteNonQuery() == 0)
            {
                return false;
            }
        }

        var outboxMessage = new OutboxMessage(
            $"out-{Guid.NewGuid():N}",
            workspaceEvent.EventId,
            workspaceEvent.WorkspaceId,
            workspaceEvent.CardId,
            workspaceEvent.EventType,
            workspaceEvent.CorrelationId,
            workspaceEvent.EventId,
            workspaceEvent.RequestId,
            DateTimeOffset.UtcNow,
            null,
            workspaceEvent);

        using (var command = db.CreateCommand("""
            insert into outbox_messages(message_id, event_id, idempotency_key, workspace_id, card_id, event_type, correlation_id, causation_id, request_id, created_at_utc, processed_at_utc, body)
            values (@messageId, @eventId, @idempotencyKey, @workspaceId, @cardId, @eventType, @correlationId, @causationId, @requestId, @createdAtUtc, @processedAtUtc, @body::jsonb)
            on conflict(message_id) do nothing
            """))
        {
            command.Parameters.AddWithValue("messageId", outboxMessage.MessageId);
            command.Parameters.AddWithValue("eventId", outboxMessage.EventId);
            command.Parameters.AddWithValue("idempotencyKey", idempotencyKey);
            command.Parameters.AddWithValue("workspaceId", outboxMessage.WorkspaceId);
            command.Parameters.AddWithValue("cardId", outboxMessage.CardId);
            command.Parameters.AddWithValue("eventType", outboxMessage.EventType);
            command.Parameters.AddWithValue("correlationId", outboxMessage.CorrelationId);
            command.Parameters.AddWithValue("causationId", (object?)outboxMessage.CausationId ?? DBNull.Value);
            command.Parameters.AddWithValue("requestId", outboxMessage.RequestId);
            command.Parameters.AddWithValue("createdAtUtc", outboxMessage.CreatedAtUtc);
            command.Parameters.AddWithValue("processedAtUtc", DBNull.Value);
            command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(outboxMessage, PostgresProjectionStore.JsonOptions));
            command.ExecuteNonQuery();
        }

        return true;
    }

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = workspaceId is null
            ? "select body from audit_events order by occurred_at_utc, event_id"
            : "select body from audit_events where workspace_id = @workspaceId order by occurred_at_utc, event_id";
        if (workspaceId is not null)
        {
            command.Parameters.AddWithValue("workspaceId", workspaceId);
        }

        using var reader = command.ExecuteReader();
        var items = new List<WorkspaceEvent>();
        while (reader.Read())
        {
            var item = JsonSerializer.Deserialize<WorkspaceEvent>(reader.GetString(0), PostgresProjectionStore.JsonOptions);
            if (item is not null)
            {
                items.Add(item);
            }
        }

        return items;
    }
}
