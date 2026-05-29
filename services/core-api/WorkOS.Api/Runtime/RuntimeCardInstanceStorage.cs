namespace WorkOS.Api.Runtime;

internal sealed class RuntimeCardInstanceStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeCardInstanceStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public CardInstanceRecord Prepare(string workspaceId, string cardId, PrepareCardRequest request)
    {
        var cardInstanceId = string.IsNullOrWhiteSpace(request.CardInstanceId)
            ? $"ci-{Guid.NewGuid():N}"
            : request.CardInstanceId!;
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        Upsert(db, workspaceId, cardId, cardInstanceId, request.SubmissionId, request.AggregateRef, null, "prepared");
        db.Commit();
        return Find(cardInstanceId) ?? throw new InvalidOperationException($"Card instance {cardInstanceId} was not persisted.");
    }

    public CardInstanceRecord? Find(string cardInstanceId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select card_instance_id, workspace_id, card_id, aggregate_ref, submission_id, idempotency_key, status, created_at_utc, updated_at_utc
            from card_instances
            where card_instance_id = @cardInstanceId
            """;
        command.Parameters.AddWithValue("cardInstanceId", cardInstanceId);
        using var reader = command.ExecuteReader();
        return reader.Read() ? Read(reader) : null;
    }

    public void MarkSubmitted(RuntimeDbSession db, WorkspaceEvent workspaceEvent, string idempotencyKey)
    {
        Upsert(db, workspaceEvent.WorkspaceId, workspaceEvent.CardId, workspaceEvent.CardInstanceId!, workspaceEvent.SubmissionId, workspaceEvent.AggregateRef, idempotencyKey, "submitted");
    }

    public void MarkConfirmed(RuntimeDbSession db, WorkspaceEvent workspaceEvent, string idempotencyKey)
    {
        Upsert(db, workspaceEvent.WorkspaceId, workspaceEvent.CardId, workspaceEvent.CardInstanceId!, workspaceEvent.SubmissionId, workspaceEvent.AggregateRef, idempotencyKey, "confirmed");
    }

    private static void Upsert(
        RuntimeDbSession db,
        string workspaceId,
        string cardId,
        string cardInstanceId,
        string? submissionId,
        string? aggregateRef,
        string? idempotencyKey,
        string status)
    {
        var now = DateTimeOffset.UtcNow;
        using var command = db.CreateCommand("""
            insert into card_instances(
                card_instance_id, workspace_id, card_id, aggregate_ref, submission_id, idempotency_key,
                status, created_at_utc, prepared_at_utc, submitted_at_utc, confirmed_at_utc, updated_at_utc)
            values (
                @cardInstanceId, @workspaceId, @cardId, @aggregateRef, @submissionId, @idempotencyKey,
                @status, @now,
                case when @status = 'prepared' then @now else null end,
                case when @status = 'submitted' then @now else null end,
                case when @status = 'confirmed' then @now else null end,
                @now)
            on conflict(card_instance_id) do update set
                workspace_id = excluded.workspace_id,
                card_id = excluded.card_id,
                aggregate_ref = coalesce(excluded.aggregate_ref, card_instances.aggregate_ref),
                submission_id = coalesce(excluded.submission_id, card_instances.submission_id),
                idempotency_key = coalesce(excluded.idempotency_key, card_instances.idempotency_key),
                status = excluded.status,
                prepared_at_utc = coalesce(card_instances.prepared_at_utc, excluded.prepared_at_utc),
                submitted_at_utc = coalesce(card_instances.submitted_at_utc, excluded.submitted_at_utc),
                confirmed_at_utc = coalesce(card_instances.confirmed_at_utc, excluded.confirmed_at_utc),
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("cardInstanceId", cardInstanceId);
        command.Parameters.AddWithValue("workspaceId", workspaceId);
        command.Parameters.AddWithValue("cardId", cardId);
        command.Parameters.AddWithValue("aggregateRef", (object?)aggregateRef ?? DBNull.Value);
        command.Parameters.AddWithValue("submissionId", (object?)submissionId ?? DBNull.Value);
        command.Parameters.AddWithValue("idempotencyKey", (object?)idempotencyKey ?? DBNull.Value);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("now", now);
        command.ExecuteNonQuery();
    }

    private static CardInstanceRecord Read(Npgsql.NpgsqlDataReader reader) =>
        new(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.GetString(6),
            reader.GetFieldValue<DateTimeOffset>(7),
            reader.GetFieldValue<DateTimeOffset>(8));
}
