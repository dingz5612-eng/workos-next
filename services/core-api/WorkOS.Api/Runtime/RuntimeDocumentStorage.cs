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
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "select body from runtime_documents where id = 'state'";
        var raw = command.ExecuteScalar() as string;
        if (!string.IsNullOrWhiteSpace(raw))
        {
            return JsonSerializer.Deserialize<RuntimeState>(raw, PostgresProjectionStore.JsonOptions) ?? seedFactory();
        }

        var seeded = seedFactory();
        SaveState(seeded);
        return seeded;
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
