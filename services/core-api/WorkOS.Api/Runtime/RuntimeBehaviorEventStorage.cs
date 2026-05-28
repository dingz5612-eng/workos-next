using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeBehaviorEventStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeBehaviorEventStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public void Append(BehaviorEventRecord behaviorEvent)
    {
        using var connection = connections.Open();
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
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(behaviorEvent, PostgresProjectionStore.JsonOptions));
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<BehaviorEventRecord> GetAll()
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "select body from behavior_events order by occurred_at_utc, event_id";
        using var reader = command.ExecuteReader();
        var items = new List<BehaviorEventRecord>();
        while (reader.Read())
        {
            var item = JsonSerializer.Deserialize<BehaviorEventRecord>(reader.GetString(0), PostgresProjectionStore.JsonOptions);
            if (item is not null)
            {
                items.Add(item);
            }
        }

        return items;
    }
}
