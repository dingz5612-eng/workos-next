using System.Text.Json;
using Npgsql;

namespace WorkOS.Api.Runtime;

public sealed class OperationsOutboxProjectionStore
{
    private const string MissingTable = "42P01";
    private const string UndefinedColumn = "42703";
    private readonly PostgresConnectionFactory connections;

    public OperationsOutboxProjectionStore(string connectionString)
    {
        connections = new PostgresConnectionFactory(connectionString);
    }

    public IReadOnlyList<OperationsOutboxMessage> ClaimPending(string workerId, int take = 50, TimeSpan? lease = null)
    {
        try
        {
            using var connection = connections.Open();
            using var transaction = connection.BeginTransaction();
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                with claimable as (
                    select message_id
                    from operations_outbox_messages
                    where processed_at_utc is null
                      and dead_lettered_at_utc is null
                      and (claim_expires_at_utc is null or claim_expires_at_utc < @now)
                    order by created_at_utc, message_id
                    for update skip locked
                    limit @take
                )
                update operations_outbox_messages item
                set claimed_by = @workerId,
                    claimed_at_utc = @now,
                    claim_expires_at_utc = @claimExpiresAtUtc,
                    attempt_count = item.attempt_count + 1,
                    last_error = null
                from claimable
                where item.message_id = claimable.message_id
                returning item.message_id, item.event_id, item.submission_id, item.tenant_id,
                          item.case_id, item.work_item_id, item.message_type, item.created_at_utc,
                          item.payload, item.processed_at_utc, item.claimed_by, item.claimed_at_utc,
                          item.claim_expires_at_utc, item.attempt_count, item.dead_lettered_at_utc, item.last_error
                """;
            var now = DateTimeOffset.UtcNow;
            command.Parameters.AddWithValue("take", take);
            command.Parameters.AddWithValue("workerId", workerId);
            command.Parameters.AddWithValue("now", now);
            command.Parameters.AddWithValue("claimExpiresAtUtc", now.Add(lease ?? TimeSpan.FromSeconds(30)));
            var messages = ReadMessages(command);
            transaction.Commit();
            return messages;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or UndefinedColumn)
        {
            return Array.Empty<OperationsOutboxMessage>();
        }
    }

    public void MarkProcessed(string messageId, string workerId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            update operations_outbox_messages
            set processed_at_utc = @processedAtUtc,
                claimed_by = null,
                claimed_at_utc = null,
                claim_expires_at_utc = null,
                last_error = null
            where message_id = @messageId
              and claimed_by = @workerId
              and processed_at_utc is null
              and dead_lettered_at_utc is null
            """;
        command.Parameters.AddWithValue("messageId", messageId);
        command.Parameters.AddWithValue("workerId", workerId);
        command.Parameters.AddWithValue("processedAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }

    public void MarkFailed(string messageId, string workerId, string error, int maxRetries = 5)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            update operations_outbox_messages
            set claimed_by = null,
                claimed_at_utc = null,
                claim_expires_at_utc = null,
                last_error = @error,
                dead_lettered_at_utc = case when attempt_count >= @maxRetries then @failedAtUtc else dead_lettered_at_utc end
            where message_id = @messageId
              and claimed_by = @workerId
              and processed_at_utc is null
              and dead_lettered_at_utc is null
            """;
        command.Parameters.AddWithValue("messageId", messageId);
        command.Parameters.AddWithValue("workerId", workerId);
        command.Parameters.AddWithValue("error", error.Length > 2000 ? error[..2000] : error);
        command.Parameters.AddWithValue("maxRetries", maxRetries);
        command.Parameters.AddWithValue("failedAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }

    private static IReadOnlyList<OperationsOutboxMessage> ReadMessages(NpgsqlCommand command)
    {
        using var reader = command.ExecuteReader();
        var messages = new List<OperationsOutboxMessage>();
        while (reader.Read())
        {
            messages.Add(new OperationsOutboxMessage(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetString(2),
                reader.GetString(6),
                JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(8), PostgresProjectionStore.JsonOptions)
                    ?? new Dictionary<string, object>(),
                reader.GetFieldValue<DateTimeOffset>(7),
                reader.IsDBNull(9) ? null : reader.GetFieldValue<DateTimeOffset>(9),
                reader.IsDBNull(10) ? null : reader.GetString(10),
                reader.IsDBNull(11) ? null : reader.GetFieldValue<DateTimeOffset>(11),
                reader.IsDBNull(12) ? null : reader.GetFieldValue<DateTimeOffset>(12),
                reader.GetInt32(13),
                reader.IsDBNull(14) ? null : reader.GetFieldValue<DateTimeOffset>(14),
                reader.IsDBNull(15) ? null : reader.GetString(15)));
        }

        return messages;
    }
}
