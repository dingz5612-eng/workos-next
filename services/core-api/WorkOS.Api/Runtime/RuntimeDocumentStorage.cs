using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeDocumentStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeDocumentStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory)
    {
        string? raw;
        using (var connection = connections.Open())
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "select body from runtime_documents where id = 'state'";
            raw = command.ExecuteScalar() as string;
        }

        if (!string.IsNullOrWhiteSpace(raw))
        {
            var seed = seedFactory();
            var persisted = JsonSerializer.Deserialize<RuntimeState>(raw, PostgresProjectionStore.JsonOptions) ?? seed;
            var migrated = ProjectionStateMigrator.Migrate(persisted, seed);
            var migratedJson = JsonSerializer.Serialize(migrated, PostgresProjectionStore.JsonOptions);
            if (!JsonEquivalent(raw, migratedJson))
            {
                SaveState(migrated);
            }

            return migrated;
        }

        var seeded = seedFactory();
        SaveState(seeded);
        return seeded;
    }

    private static bool JsonEquivalent(string left, string right)
    {
        using var leftDocument = JsonDocument.Parse(left);
        using var rightDocument = JsonDocument.Parse(right);
        return leftDocument.RootElement.ToString().Equals(rightDocument.RootElement.ToString(), StringComparison.Ordinal);
    }

    public void SaveState(RuntimeState state)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into runtime_documents(id, body, updated_at_utc)
            values ('state', @body::jsonb, @updatedAtUtc)
            on conflict(id) do update set body = excluded.body, updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(state, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("updatedAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }
}
