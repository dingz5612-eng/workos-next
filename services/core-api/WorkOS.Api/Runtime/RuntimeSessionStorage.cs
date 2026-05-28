using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeSessionStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeSessionStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public RuntimeSession CreateSession(RuntimeUser user)
    {
        var session = new RuntimeSession(
            $"sess-{Guid.NewGuid():N}",
            user.UserId,
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow.AddHours(8));

        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into runtime_sessions(token, user_id, issued_at_utc, expires_at_utc, body)
            values (@token, @userId, @issuedAtUtc, @expiresAtUtc, @body::jsonb)
            """;
        command.Parameters.AddWithValue("token", session.Token);
        command.Parameters.AddWithValue("userId", session.UserId);
        command.Parameters.AddWithValue("issuedAtUtc", session.IssuedAtUtc);
        command.Parameters.AddWithValue("expiresAtUtc", session.ExpiresAtUtc);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(session, PostgresProjectionStore.JsonOptions));
        command.ExecuteNonQuery();
        return session;
    }

    public string? FindUserIdBySessionToken(string token)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "select user_id from runtime_sessions where token = @token and expires_at_utc > @now";
        command.Parameters.AddWithValue("token", token);
        command.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
        return command.ExecuteScalar() as string;
    }
}
