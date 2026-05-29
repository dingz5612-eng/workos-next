using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.LeadReservation.Persistence;

internal sealed class LeadReservationStorage
{
    private readonly PostgresConnectionFactory connections;

    public LeadReservationStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public bool Apply(WorkspaceEvent workspaceEvent)
    {
        switch (workspaceEvent.EventType)
        {
            case "Accommodation.LeadCaptured":
                UpsertLead(workspaceEvent, Value(workspaceEvent, "leadStatus", "线索状态", "new"));
                return true;
            case "Accommodation.LeadStatusChanged":
                UpsertLead(workspaceEvent, Value(workspaceEvent, "leadStatus", "线索状态", "callback"));
                return true;
            case "Accommodation.ReservationCreated":
                UpsertReservation(workspaceEvent, "created");
                return true;
            case "Accommodation.ReservationCancelled":
                UpsertReservation(workspaceEvent, "cancelled");
                return true;
            case "Accommodation.ReservationExpired":
                UpsertReservation(workspaceEvent, "expired");
                return true;
            case "Accommodation.ReservationConvertedToStay":
                UpsertReservation(workspaceEvent, "converted_to_stay");
                return true;
            default:
                return false;
        }
    }

    private void UpsertLead(WorkspaceEvent workspaceEvent, string status)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into hostel_leads(lead_id, workspace_id, guest_name, phone, beds_needed, stay_duration, source_channel, status, created_event_id, updated_at_utc)
            values (@leadId, @workspaceId, @guestName, @phone, @bedsNeeded, @stayDuration, @sourceChannel, @status, @createdEventId, @updatedAtUtc)
            on conflict(lead_id) do update set
                guest_name = excluded.guest_name,
                phone = excluded.phone,
                beds_needed = excluded.beds_needed,
                stay_duration = excluded.stay_duration,
                source_channel = excluded.source_channel,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("leadId", LeadId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("guestName", Value(workspaceEvent, "leadName", "线索姓名", "张三"));
        command.Parameters.AddWithValue("phone", Value(workspaceEvent, "phone", "电话", "+996 555 010101"));
        command.Parameters.AddWithValue("bedsNeeded", IntValue(workspaceEvent, "requestedBedCount", "需要床位数", 1));
        command.Parameters.AddWithValue("stayDuration", Value(workspaceEvent, "stayDurationText", "住宿时长", "1个月"));
        command.Parameters.AddWithValue("sourceChannel", Value(workspaceEvent, "leadSource", "来源渠道", "whatsapp"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertReservation(WorkspaceEvent workspaceEvent, string status)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into hostel_bookings(booking_id, workspace_id, lead_id, reserved_room_bed, beds_reserved, check_in_date, status, created_event_id, updated_at_utc, hold_until_utc)
            values (@bookingId, @workspaceId, @leadId, @reservedRoomBed, @bedsReserved, @checkInDate, @status, @createdEventId, @updatedAtUtc, @holdUntilUtc)
            on conflict(booking_id) do update set
                reserved_room_bed = excluded.reserved_room_bed,
                beds_reserved = excluded.beds_reserved,
                check_in_date = excluded.check_in_date,
                status = excluded.status,
                hold_until_utc = excluded.hold_until_utc,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("bookingId", ReservationId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("leadId", LeadId(workspaceEvent));
        command.Parameters.AddWithValue("reservedRoomBed", Value(workspaceEvent, "reservedBedIds", "预留床位", Value(workspaceEvent, "reservedRoomId", "预留房间", "A301 / A301-02")));
        command.Parameters.AddWithValue("bedsReserved", IntValue(workspaceEvent, "reservedBedCount", "预订床位数", 1));
        command.Parameters.AddWithValue("checkInDate", DateValue(workspaceEvent, "plannedCheckInDate", "计划入住日期", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("holdUntilUtc", NpgsqlDbType.TimestampTz, DateValue(workspaceEvent, "reservationHoldUntil", "保留截止时间", workspaceEvent.OccurredAtUtc.AddDays(1)));
        command.ExecuteNonQuery();
    }

    private static string LeadId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "leadId", "线索", StableId("lead", workspaceEvent));

    private static string ReservationId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "reservationId", "预订单", StableId("reservation", workspaceEvent));

    private static string Value(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, string defaultValue)
    {
        if (workspaceEvent.Payload.TryGetValue(canonicalKey, out var canonical) && !string.IsNullOrWhiteSpace(canonical))
        {
            return canonical;
        }

        return workspaceEvent.Payload.TryGetValue(zhKey, out var zh) && !string.IsNullOrWhiteSpace(zh)
            ? zh
            : defaultValue;
    }

    private static int IntValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, int defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, zhKey, string.Empty);
        return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;
    }

    private static DateTimeOffset DateValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, DateTimeOffset defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, zhKey, string.Empty);
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : defaultValue.ToUniversalTime();
    }

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
