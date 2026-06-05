using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.ResourceSetup;
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
        switch (workspaceEvent.EventType)
        {
            case "Accommodation.RoomBlockedForService":
                UpdateResourceStatus(workspaceEvent, db, "blocked");
                return true;
            case "Accommodation.BedBlockedForService":
                UpdateBedStatus(workspaceEvent, db, "blocked");
                return true;
            case "Accommodation.RoomReleaseAfterServiceRequested":
                UpdateResourceStatus(workspaceEvent, db, "available");
                return true;
            case "Accommodation.BedReleaseAfterServiceRequested":
                UpdateBedStatus(workspaceEvent, db, "available");
                return true;
        }

        if (!IsResourceSetupWorkspace(workspaceEvent.WorkspaceId))
        {
            return false;
        }

        switch (workspaceEvent.EventType)
        {
            case ResourceSetupEvents.RoomConfigured:
                UpsertRoom(workspaceEvent, db, RoomStatus(workspaceEvent, "configured"));
                return true;
            case ResourceSetupEvents.BedConfigured:
                UpsertBeds(workspaceEvent, db, BedStatus(workspaceEvent, "available"));
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

    private static bool IsResourceSetupWorkspace(string workspaceId) =>
        workspaceId.Equals("W-STAY-RESOURCE", StringComparison.Ordinal) ||
        workspaceId.StartsWith("W-STAY-RESOURCE-", StringComparison.Ordinal);

    private void UpsertRoom(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into accommodation_rooms(room_id, workspace_id, room_no, room_type, capacity, status, created_event_id, updated_at_utc)
            values (@roomId, @workspaceId, @roomNo, @roomType, @capacity, @status, @createdEventId, @updatedAtUtc)
            on conflict(room_id) do update set
                room_no = coalesce(nullif(excluded.room_no, ''), accommodation_rooms.room_no),
                room_type = coalesce(nullif(excluded.room_type, ''), accommodation_rooms.room_type),
                capacity = case when excluded.capacity > 0 then excluded.capacity else accommodation_rooms.capacity end,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("roomNo", RoomNo(workspaceEvent));
        command.Parameters.AddWithValue("roomType", Value(workspaceEvent, "roomType", "four_bed"));
        command.Parameters.AddWithValue("capacity", IntValue(workspaceEvent, "bedCount", 4));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertBed(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        UpsertBedRecord(workspaceEvent, db, status, BedId(workspaceEvent), BedNo(workspaceEvent), Value(workspaceEvent, "bedType", "lower"));
    }

    private void UpsertBeds(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        var labels = BedLabels(workspaceEvent);
        var layoutTypes = BedLayoutTypes(workspaceEvent);
        if (labels.Count == 0)
        {
            UpsertBed(workspaceEvent, db, status);
            return;
        }

        for (var index = 0; index < labels.Count; index++)
        {
            var label = labels[index];
            var bedId = BedIdForLabel(workspaceEvent, label, index);
            var bedNo = BedNoForLabel(workspaceEvent, label, index);
            var bunkType = BedTypeForLabel(workspaceEvent, label, index, layoutTypes);
            UpsertBedRecord(workspaceEvent, db, status, bedId, bedNo, bunkType);
        }
    }

    private void UpsertBedRecord(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status, string bedId, string bedNo, string bunkType)
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
        command.Parameters.AddWithValue("bedId", bedId);
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        command.Parameters.AddWithValue("bedNo", bedNo);
        command.Parameters.AddWithValue("bunkType", bunkType);
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
        command.Parameters.AddWithValue("ratePlanId", Value(workspaceEvent, "ratePlanId", $"rate-{RoomId(workspaceEvent)}".ToLowerInvariant()));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        command.Parameters.AddWithValue("dailyRate", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "dailyRatePerBed", 350m));
        command.Parameters.AddWithValue("weeklyRate", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "weeklyRatePerBed", 2100m));
        command.Parameters.AddWithValue("monthlyRate", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "monthlyRatePerBed", 0m));
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "KGS"));
        command.Parameters.AddWithValue("effectiveFromUtc", NpgsqlDbType.TimestampTz, DateValue(workspaceEvent, "effectiveFrom", workspaceEvent.OccurredAtUtc));
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

        if (TargetsRoomBeds(workspaceEvent))
        {
            UpdateAllBedsForRoom(workspaceEvent, db, status);
            return;
        }

        using var update = db.CreateCommand("""
            update accommodation_rooms
            set status = @status,
                updated_at_utc = @updatedAtUtc
            where room_id = @roomId
            """);
        update.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        update.Parameters.AddWithValue("status", status);
        update.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        if (update.ExecuteNonQuery() > 0)
        {
            return;
        }

        UpsertRoom(workspaceEvent, db, status);
    }

    private void UpdateBedStatus(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var update = db.CreateCommand("""
            update accommodation_beds
            set status = @status,
                updated_at_utc = @updatedAtUtc
            where bed_id = @bedId
            """);
        update.Parameters.AddWithValue("bedId", BedId(workspaceEvent));
        update.Parameters.AddWithValue("status", status);
        update.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        if (update.ExecuteNonQuery() > 0)
        {
            return;
        }

        UpsertBed(workspaceEvent, db, status);
    }

    private void UpdateAllBedsForRoom(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var update = db.CreateCommand("""
            update accommodation_beds
            set status = @status,
                updated_at_utc = @updatedAtUtc
            where room_id = @roomId
            """);
        update.Parameters.AddWithValue("roomId", RoomId(workspaceEvent));
        update.Parameters.AddWithValue("status", status);
        update.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        update.ExecuteNonQuery();
    }

    private static string RoomId(WorkspaceEvent workspaceEvent)
    {
        var explicitId = Value(workspaceEvent, "roomId", string.Empty);
        return string.IsNullOrWhiteSpace(explicitId)
            ? $"room-{RoomNo(workspaceEvent)}".ToLowerInvariant()
            : explicitId;
    }

    private static string BedId(WorkspaceEvent workspaceEvent)
    {
        var explicitId = Value(workspaceEvent, "bedId", string.Empty);
        return string.IsNullOrWhiteSpace(explicitId)
            ? $"bed-{BedNo(workspaceEvent)}".ToLowerInvariant()
            : explicitId;
    }

    private static string RoomNo(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "roomNo", string.Empty);

    private static string BedNo(WorkspaceEvent workspaceEvent)
    {
        var explicitNo = Value(workspaceEvent, "bedNo", string.Empty);
        if (!string.IsNullOrWhiteSpace(explicitNo))
        {
            return explicitNo;
        }

        var explicitId = Value(workspaceEvent, "bedId", string.Empty);
        return string.IsNullOrWhiteSpace(explicitId) ? $"bed-{workspaceEvent.EventId}" : explicitId;
    }

    private static IReadOnlyList<string> BedLabels(WorkspaceEvent workspaceEvent)
    {
        var explicitLabels = Value(workspaceEvent, "bedLabels", string.Empty);
        var labels = SplitLabels(explicitLabels);
        if (labels.Count > 0)
        {
            return labels;
        }

        var bedCount = IntValue(workspaceEvent, "bedCount", 0);
        return bedCount > 0
            ? Enumerable.Range(1, Math.Min(bedCount, 20)).Select(index => index.ToString("00", CultureInfo.InvariantCulture)).ToArray()
            : Array.Empty<string>();
    }

    private static IReadOnlyList<string> SplitLabels(string value) =>
        value.Split(new[] { ',', '，', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(label => !string.IsNullOrWhiteSpace(label))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static string BedIdForLabel(WorkspaceEvent workspaceEvent, string label, int index)
    {
        var explicitId = Value(workspaceEvent, "bedId", string.Empty);
        if (index == 0 && !string.IsNullOrWhiteSpace(explicitId))
        {
            return explicitId;
        }

        return $"bed-{Slug(RoomId(workspaceEvent))}-{Slug(label)}".ToLowerInvariant();
    }

    private static string BedNoForLabel(WorkspaceEvent workspaceEvent, string label, int index)
    {
        var explicitNo = Value(workspaceEvent, "bedNo", string.Empty);
        if (index == 0 && !string.IsNullOrWhiteSpace(explicitNo))
        {
            return explicitNo;
        }

        var roomNo = RoomNo(workspaceEvent);
        return !string.IsNullOrWhiteSpace(roomNo) && !label.StartsWith(roomNo, StringComparison.OrdinalIgnoreCase)
            ? $"{roomNo}-{label}"
            : label;
    }

    private static IReadOnlyDictionary<string, string> BedLayoutTypes(WorkspaceEvent workspaceEvent)
    {
        if (!BedLayoutContract.TryParse(Value(workspaceEvent, "bedLayout", string.Empty), out var layout) || layout.Count == 0)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        return layout
            .GroupBy(entry => entry.Label, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Type, StringComparer.OrdinalIgnoreCase);
    }

    private static string BedTypeForLabel(WorkspaceEvent workspaceEvent, string label, int index, IReadOnlyDictionary<string, string> layoutTypes)
    {
        if (layoutTypes.TryGetValue(label, out var layoutType) && !string.IsNullOrWhiteSpace(layoutType))
        {
            return layoutType;
        }

        return BedLayoutContract.BedTypeForTemplate(Value(workspaceEvent, "bedType", string.Empty), index);
    }

    private static string Slug(string value) =>
        string.Concat(value.Select(character => char.IsLetterOrDigit(character) ? char.ToLowerInvariant(character) : '-')).Trim('-');

    private static bool TargetsBed(WorkspaceEvent workspaceEvent) =>
        !string.IsNullOrWhiteSpace(Value(workspaceEvent, "resourceScope", string.Empty))
            ? Value(workspaceEvent, "resourceScope", string.Empty).Equals("bed", StringComparison.OrdinalIgnoreCase)
            : !string.IsNullOrWhiteSpace(Value(workspaceEvent, "bedId", string.Empty));

    private static bool TargetsRoomBeds(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "resourceScope", string.Empty).Equals("room_beds", StringComparison.OrdinalIgnoreCase);

    private static string RoomStatus(WorkspaceEvent workspaceEvent, string defaultValue)
    {
        var readiness = Value(workspaceEvent, "availabilityStatus", string.Empty);
        return string.IsNullOrWhiteSpace(readiness) ? defaultValue : readiness;
    }

    private static string BedStatus(WorkspaceEvent workspaceEvent, string defaultValue)
    {
        var status = Value(workspaceEvent, "bedStatus", string.Empty);
        return string.IsNullOrWhiteSpace(status) ? defaultValue : status;
    }

    private static string AvailabilityStatus(WorkspaceEvent workspaceEvent, string defaultValue)
    {
        var status = Value(workspaceEvent, "availabilityStatus", string.Empty);
        return string.IsNullOrWhiteSpace(status) ? defaultValue : status;
    }

    private static string Value(WorkspaceEvent workspaceEvent, string canonicalKey, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static int IntValue(WorkspaceEvent workspaceEvent, string canonicalKey, int defaultValue) =>
        RuntimeFieldAliases.IntValue(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string canonicalKey, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static DateTimeOffset DateValue(WorkspaceEvent workspaceEvent, string canonicalKey, DateTimeOffset defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, string.Empty);
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : defaultValue.ToUniversalTime();
    }
}
