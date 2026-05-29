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
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("taskId", Value(workspaceEvent, "taskId", StableId("task", workspaceEvent)));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("taskType", Value(workspaceEvent, "taskType", "清洁"));
        command.Parameters.AddWithValue("roomId", Value(workspaceEvent, "roomId", "A301"));
        command.Parameters.AddWithValue("bedId", Value(workspaceEvent, "bedId", "A301-02"));
        command.Parameters.AddWithValue("urgency", Value(workspaceEvent, "urgency", "中"));
        command.Parameters.AddWithValue("blocksAvailability", BoolValue(workspaceEvent, "blocksAvailability", true));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("actualCostAmount", NpgsqlDbType.Numeric, 0m);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static bool BoolValue(WorkspaceEvent workspaceEvent, string key, bool defaultValue) =>
        RuntimeFieldAliases.BoolValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
