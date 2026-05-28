using System.Text.Json;
using Npgsql;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeOutboxStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeOutboxStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public IReadOnlyList<OutboxMessage> GetPending(int take)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select body, processed_at_utc from outbox_messages
            where processed_at_utc is null
            order by created_at_utc, message_id
            limit @take
            """;
        command.Parameters.AddWithValue("take", take);
        return ReadMessages(command);
    }

    public IReadOnlyList<OutboxMessage> GetAll()
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "select body, processed_at_utc from outbox_messages order by created_at_utc, message_id";
        return ReadMessages(command);
    }

    public void MarkProcessed(string messageId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            update outbox_messages
            set processed_at_utc = @processedAtUtc
            where message_id = @messageId
            """;
        command.Parameters.AddWithValue("messageId", messageId);
        command.Parameters.AddWithValue("processedAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }

    private static IReadOnlyList<OutboxMessage> ReadMessages(NpgsqlCommand command)
    {
        using var reader = command.ExecuteReader();
        var messages = new List<OutboxMessage>();
        while (reader.Read())
        {
            var item = JsonSerializer.Deserialize<OutboxMessage>(reader.GetString(0), PostgresProjectionStore.JsonOptions);
            if (item is not null)
            {
                DateTimeOffset? processedAtUtc = reader.IsDBNull(1) ? null : reader.GetFieldValue<DateTimeOffset>(1);
                messages.Add(item with { ProcessedAtUtc = processedAtUtc });
            }
        }

        return messages;
    }
}
