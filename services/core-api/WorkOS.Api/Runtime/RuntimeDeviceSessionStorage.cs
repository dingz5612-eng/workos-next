namespace WorkOS.Api.Runtime;

internal sealed class RuntimeDeviceSessionStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeDeviceSessionStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public RuntimeDeviceSession Register(RuntimeDeviceSessionRequest request)
    {
        var now = DateTimeOffset.UtcNow;
        var deviceSessionId = $"devsess-{Guid.NewGuid():N}";
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into device_sessions(
                device_session_id, tenant_id, actor_id, device_id, device_trust_status,
                user_agent_hash, created_at_utc, last_seen_at_utc, revoked_at_utc)
            values (
                @deviceSessionId, @tenantId, @actorId, @deviceId, @deviceTrustStatus,
                @userAgentHash, @now, @now, null)
            on conflict(device_id) do update set
                tenant_id = excluded.tenant_id,
                actor_id = excluded.actor_id,
                device_trust_status = excluded.device_trust_status,
                user_agent_hash = excluded.user_agent_hash,
                last_seen_at_utc = excluded.last_seen_at_utc,
                revoked_at_utc = case
                    when excluded.device_trust_status = 'revoked' then coalesce(device_sessions.revoked_at_utc, excluded.last_seen_at_utc)
                    else null
                end
            returning device_session_id, tenant_id, actor_id, device_id, device_trust_status,
                      user_agent_hash, created_at_utc, last_seen_at_utc, revoked_at_utc
            """;
        command.Parameters.AddWithValue("deviceSessionId", deviceSessionId);
        command.Parameters.AddWithValue("tenantId", request.TenantId);
        command.Parameters.AddWithValue("actorId", request.ActorId);
        command.Parameters.AddWithValue("deviceId", request.DeviceId);
        command.Parameters.AddWithValue("deviceTrustStatus", NormalizeTrust(request.DeviceTrustStatus));
        command.Parameters.AddWithValue("userAgentHash", request.UserAgentHash);
        command.Parameters.AddWithValue("now", now);
        using var reader = command.ExecuteReader();
        reader.Read();
        return Read(reader);
    }

    public RuntimeDeviceSession? Find(string deviceId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select device_session_id, tenant_id, actor_id, device_id, device_trust_status,
                   user_agent_hash, created_at_utc, last_seen_at_utc, revoked_at_utc
            from device_sessions
            where device_id = @deviceId
            """;
        command.Parameters.AddWithValue("deviceId", deviceId);
        using var reader = command.ExecuteReader();
        return reader.Read() ? Read(reader) : null;
    }

    public RuntimeDeviceSession? Revoke(string deviceId, string actorId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            update device_sessions
            set device_trust_status = 'revoked',
                revoked_at_utc = coalesce(revoked_at_utc, @now),
                revoked_by = coalesce(revoked_by, @actorId),
                last_seen_at_utc = @now
            where device_id = @deviceId
            returning device_session_id, tenant_id, actor_id, device_id, device_trust_status,
                      user_agent_hash, created_at_utc, last_seen_at_utc, revoked_at_utc
            """;
        command.Parameters.AddWithValue("deviceId", deviceId);
        command.Parameters.AddWithValue("actorId", actorId);
        command.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
        using var reader = command.ExecuteReader();
        return reader.Read() ? Read(reader) : null;
    }

    private static RuntimeDeviceSession Read(Npgsql.NpgsqlDataReader reader) =>
        new(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetFieldValue<DateTimeOffset>(6),
            reader.GetFieldValue<DateTimeOffset>(7),
            reader.IsDBNull(8) ? null : reader.GetFieldValue<DateTimeOffset>(8));

    private static string NormalizeTrust(string value) =>
        value.Trim().ToLowerInvariant() switch
        {
            "trusted" => "trusted",
            "untrusted" => "untrusted",
            "revoked" => "revoked",
            _ => "unknown"
        };
}
