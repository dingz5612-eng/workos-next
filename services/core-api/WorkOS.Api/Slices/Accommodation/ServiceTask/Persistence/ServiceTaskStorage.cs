using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ServiceTask.Persistence;

internal sealed class ServiceTaskStorage
{
    private readonly PostgresConnectionFactory connections;

    public ServiceTaskStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public bool Apply(WorkspaceEvent workspaceEvent)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        var applied = Apply(workspaceEvent, db);
        db.Commit();
        return applied;
    }

    public bool Apply(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        switch (workspaceEvent.EventType)
        {
            case "Accommodation.ServiceTaskCreated":
            case "Accommodation.RoomBlockedForService":
            case "Accommodation.BedBlockedForService":
                UpsertTask(workspaceEvent, db, "pending");
                return true;
            case "Accommodation.ServiceTaskAssigned":
                UpsertTask(workspaceEvent, db, "assigned");
                return true;
            case "Accommodation.ServiceTaskCompleted":
                UpsertTask(workspaceEvent, db, "completed");
                return true;
            case "Accommodation.ServiceTaskVerified":
                UpsertTask(workspaceEvent, db, "verified");
                return true;
            case "Accommodation.RoomReleaseAfterServiceRequested":
            case "Accommodation.BedReleaseAfterServiceRequested":
                UpsertTask(workspaceEvent, db, "release_requested");
                return true;
            default:
                return false;
        }
    }

    private void UpsertTask(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into service_tasks(task_id, workspace_id, task_type, room_id, bed_id, urgency, blocks_availability, status, actual_cost_amount, created_event_id, updated_at_utc)
            values (@taskId, @workspaceId, @taskType, @roomId, @bedId, @urgency, @blocksAvailability, @status, @actualCostAmount, @createdEventId, @updatedAtUtc)
            on conflict(task_id) do update set
                task_type = excluded.task_type,
                urgency = excluded.urgency,
                blocks_availability = excluded.blocks_availability,
                status = excluded.status,
                actual_cost_amount = excluded.actual_cost_amount,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("taskId", Value(workspaceEvent, "任务", StableId("task", workspaceEvent)));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("taskType", Value(workspaceEvent, "任务类型", "清洁"));
        command.Parameters.AddWithValue("roomId", Value(workspaceEvent, "房间", "A301"));
        command.Parameters.AddWithValue("bedId", Value(workspaceEvent, "床位", "A301-02"));
        command.Parameters.AddWithValue("urgency", Value(workspaceEvent, "紧急程度", "中"));
        command.Parameters.AddWithValue("blocksAvailability", BoolValue(workspaceEvent, "是否阻断可售", true));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("actualCostAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "实际成本", 0m));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        workspaceEvent.Payload.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : defaultValue;

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        workspaceEvent.Payload.TryGetValue(key, out var value) && decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : defaultValue;

    private static bool BoolValue(WorkspaceEvent workspaceEvent, string key, bool defaultValue)
    {
        if (!workspaceEvent.Payload.TryGetValue(key, out var value))
        {
            return defaultValue;
        }

        return value.Equals("是", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
