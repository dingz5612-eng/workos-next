using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.ResourceSetup.Events;

namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.Persistence;

internal sealed class ResourceSetupStorage
{
    private readonly PostgresConnectionFactory connections;

    public ResourceSetupStorage(PostgresConnectionFactory connections)
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
        if (!workspaceEvent.WorkspaceId.Equals("W-STAY-RESOURCE", StringComparison.Ordinal))
        {
            return false;
        }

        switch (workspaceEvent.EventType)
        {
            case ResourceSetupEvents.RoomConfigured:
                UpsertRoom(workspaceEvent, db, RoomStatus(workspaceEvent, "configured"));
                return true;
            case ResourceSetupEvents.BedConfigured:
                UpsertBed(workspaceEvent, db, BedStatus(workspaceEvent, "available"));
                return true;
            case ResourceSetupEvents.RateConfigured:
                UpsertRatePlan(workspaceEvent, db);
                return true;
            case ResourceSetupEvents.RoomReadinessChanged:
                UpsertRoom(workspaceEvent, db, AvailabilityStatus(workspaceEvent, "available"));
                return true;
            case ResourceSetupEvents.RoomBlocked:
                UpdateResourceStatus(workspaceEvent, db, "blocked");
                return true;
            case ResourceSetupEvents.RoomReleased:
                UpdateResourceStatus(workspaceEvent, db, "available");
                return true;
            case ResourceSetupEvents.BedBlocked:
                if (!TargetsBed(workspaceEvent))
                {
                    return true;
                }

                UpdateBedStatus(workspaceEvent, db, "blocked");
                return true;
            case ResourceSetupEvents.BedReleased:
                if (!TargetsBed(workspaceEvent))
                {
                    return true;
                }

                UpdateBedStatus(workspaceEvent, db, "available");
                return true;
            default:
                return false;
        }
    }

    private void UpsertRoom(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into accommodation_rooms(room_id, workspace_id, room_no, room_type, capacity, status, created_event_id, updated_at_utc)
            values (@roomId, @workspaceId, @roomNo, @roomType, @capacity, @status, @createdEventId, @updatedAtUtc)
            on conflict(room_id) do update set
                room_no = excluded.room_no,
                room_type = excluded.room_type,
                capacity = excluded.capacity,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("roomNo", RoomNo(workspaceEvent));
        command.Parameters.AddWithValue("roomType", Value(workspaceEvent, "roomType", "房型", "四人间"));
        command.Parameters.AddWithValue("capacity", IntValue(workspaceEvent, "bedCount", "床位数", 4));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertBed(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into accommodation_beds(bed_id, workspace_id, room_id, bed_no, bunk_type, status, created_event_id, updated_at_utc)
            values (@bedId, @workspaceId, @roomId, @bedNo, @bunkType, @status, @createdEventId, @updatedAtUtc)
            on conflict(bed_id) do update set
                room_id = excluded.room_id,
                bed_no = excluded.bed_no,
                bunk_type = excluded.bunk_type,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("bedId", BedId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        command.Parameters.AddWithValue("bedNo", BedNo(workspaceEvent));
        command.Parameters.AddWithValue("bunkType", Value(workspaceEvent, "bedType", "床位类型", "下铺"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertRatePlan(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into accommodation_rate_plans(rate_plan_id, workspace_id, room_id, daily_rate_per_bed, weekly_rate_per_bed, monthly_rate_per_bed, currency, effective_from_utc, status, created_event_id, updated_at_utc)
            values (@ratePlanId, @workspaceId, @roomId, @dailyRate, @weeklyRate, @monthlyRate, @currency, @effectiveFromUtc, @status, @createdEventId, @updatedAtUtc)
            on conflict(rate_plan_id) do update set
                room_id = excluded.room_id,
                daily_rate_per_bed = excluded.daily_rate_per_bed,
                weekly_rate_per_bed = excluded.weekly_rate_per_bed,
                monthly_rate_per_bed = excluded.monthly_rate_per_bed,
                currency = excluded.currency,
                effective_from_utc = excluded.effective_from_utc,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("ratePlanId", Value(workspaceEvent, "ratePlanId", "价格规则", $"rate-{RoomNo(workspaceEvent)}".ToLowerInvariant()));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        command.Parameters.AddWithValue("dailyRate", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "dailyRatePerBed", "每床日价", 350m));
        command.Parameters.AddWithValue("weeklyRate", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "weeklyRatePerBed", "每床周价", 2100m));
        command.Parameters.AddWithValue("monthlyRate", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "monthlyRatePerBed", "每床月价", 9300m));
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "币种", "KGS"));
        command.Parameters.AddWithValue("effectiveFromUtc", NpgsqlDbType.TimestampTz, DateValue(workspaceEvent, "effectiveFrom", "生效日期", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("status", "active");
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpdateResourceStatus(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        if (TargetsBed(workspaceEvent))
        {
            UpdateBedStatus(workspaceEvent, db, status);
            return;
        }

        UpsertRoom(workspaceEvent, db, status);
    }

    private void UpdateBedStatus(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        UpsertBed(workspaceEvent, db, status);
    }

    private static string RoomId(WorkspaceEvent workspaceEvent)
    {
        var explicitId = Value(workspaceEvent, "roomId", "房间", string.Empty);
        return string.IsNullOrWhiteSpace(explicitId)
            ? $"room-{RoomNo(workspaceEvent)}".ToLowerInvariant()
            : explicitId;
    }

    private static string BedId(WorkspaceEvent workspaceEvent)
    {
        var explicitId = Value(workspaceEvent, "bedId", "床位", string.Empty);
        return string.IsNullOrWhiteSpace(explicitId)
            ? $"bed-{BedNo(workspaceEvent)}".ToLowerInvariant()
            : explicitId;
    }

    private static string RoomNo(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "roomNo", "房间号", "A302");

    private static string BedNo(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "bedNo", "床位号", "A302-01");

    private static bool TargetsBed(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "resourceScope", "阻断范围", string.Empty).Equals("bed", StringComparison.OrdinalIgnoreCase) ||
        Value(workspaceEvent, "resourceScope", "释放范围", string.Empty).Equals("bed", StringComparison.OrdinalIgnoreCase) ||
        !string.IsNullOrWhiteSpace(Value(workspaceEvent, "bedId", "床位", string.Empty));

    private static string RoomStatus(WorkspaceEvent workspaceEvent, string defaultValue)
    {
        var readiness = Value(workspaceEvent, "availabilityStatus", "可售状态", string.Empty);
        return string.IsNullOrWhiteSpace(readiness) ? defaultValue : readiness;
    }

    private static string BedStatus(WorkspaceEvent workspaceEvent, string defaultValue)
    {
        var status = Value(workspaceEvent, "bedStatus", "初始床位状态", string.Empty);
        return string.IsNullOrWhiteSpace(status) ? defaultValue : status;
    }

    private static string AvailabilityStatus(WorkspaceEvent workspaceEvent, string defaultValue)
    {
        var status = Value(workspaceEvent, "availabilityStatus", "可售状态", string.Empty);
        return string.IsNullOrWhiteSpace(status) ? defaultValue : status;
    }

    private static string Value(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static int IntValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, int defaultValue) =>
        RuntimeFieldAliases.IntValue(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static DateTimeOffset DateValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, DateTimeOffset defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, zhKey, string.Empty);
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : defaultValue.ToUniversalTime();
    }
}
