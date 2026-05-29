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

    public IReadOnlyList<OutboxMessage> ClaimPending(string workerId, int take, TimeSpan lease)
    {
        using var connection = connections.Open();
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            with claimable as (
                select message_id
                from outbox_messages
                where processed_at_utc is null
                  and dead_lettered_at_utc is null
                  and (claim_expires_at_utc is null or claim_expires_at_utc < @now)
                order by created_at_utc, message_id
                for update skip locked
                limit @take
            )
            update outbox_messages item
            set claimed_by = @workerId,
                claimed_at_utc = @now,
                claim_expires_at_utc = @claimExpiresAtUtc,
                attempt_count = item.attempt_count + 1,
                last_error = null
            from claimable
            where item.message_id = claimable.message_id
            returning item.body, item.processed_at_utc, item.claimed_by, item.claimed_at_utc, item.claim_expires_at_utc, item.attempt_count, item.dead_lettered_at_utc, item.last_error
            """;
        command.Parameters.AddWithValue("take", take);
        command.Parameters.AddWithValue("workerId", workerId);
        var now = DateTimeOffset.UtcNow;
        command.Parameters.AddWithValue("now", now);
        command.Parameters.AddWithValue("claimExpiresAtUtc", now.Add(lease));
        var messages = ReadMessages(command);
        transaction.Commit();
        return messages;
    }

    public IReadOnlyList<OutboxMessage> GetAll()
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "select body, processed_at_utc, claimed_by, claimed_at_utc, claim_expires_at_utc, attempt_count, dead_lettered_at_utc, last_error from outbox_messages order by created_at_utc, message_id";
        return ReadMessages(command);
    }

    public void MarkProcessed(string messageId, string workerId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            update outbox_messages
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

    public void MarkFailed(string messageId, string workerId, string error, int maxRetries)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            update outbox_messages
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
        }

        return messages;
    }
}
