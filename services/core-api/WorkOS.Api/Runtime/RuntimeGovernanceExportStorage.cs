namespace WorkOS.Api.Runtime;

internal sealed class RuntimeGovernanceExportStorage
{
    private readonly PostgresConnectionFactory connections;
    private readonly RuntimeBehaviorEventStorage behaviorEvents;

    public RuntimeGovernanceExportStorage(PostgresConnectionFactory connections, RuntimeBehaviorEventStorage behaviorEvents)
    {
        this.connections = connections;
        this.behaviorEvents = behaviorEvents;
    }

    public GovernanceExportResult Request(GovernanceExportRequest request)
    {
        var result = RuntimeGovernanceExportPolicy.Validate(request);
        WriteAudit(request, result);
        behaviorEvents.Append(new BehaviorEventRecord(
            result.AuditEventId,
            "PCGovernanceExportRequested",
            "governance_export",
            request.ExportType,
            "zh-CN",
            result.Status,
            DateTimeOffset.UtcNow));
        return result;
    }

    private void WriteAudit(GovernanceExportRequest request, GovernanceExportResult result)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into governance_export_audits(
                audit_event_id, export_type, actor_id, device_id, status, reason,
                expires_at_utc, occurred_at_utc)
            values (
                @auditEventId, @exportType, @actorId, @deviceId, @status, @reason,
                @expiresAtUtc, @occurredAtUtc)
            on conflict(audit_event_id) do nothing
            """;
        command.Parameters.AddWithValue("auditEventId", result.AuditEventId);
        command.Parameters.AddWithValue("exportType", result.ExportType);
        command.Parameters.AddWithValue("actorId", request.ActorId);
        command.Parameters.AddWithValue("deviceId", request.DeviceId);
        command.Parameters.AddWithValue("status", result.Status);
        command.Parameters.AddWithValue("reason", result.Reason);
        command.Parameters.AddWithValue("expiresAtUtc", result.ExpiresAtUtc);
        command.Parameters.AddWithValue("occurredAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }
}
