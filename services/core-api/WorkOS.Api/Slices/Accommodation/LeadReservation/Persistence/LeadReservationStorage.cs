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
            case "Accommodation.LeadCaptured":
                UpsertLead(workspaceEvent, db, Value(workspaceEvent, "leadStatus", "new"));
                return true;
            case "Accommodation.LeadStatusChanged":
                UpsertLead(workspaceEvent, db, Value(workspaceEvent, "leadStatus", "callback"));
                return true;
            case "Accommodation.ReservationCreated":
                UpsertReservation(workspaceEvent, db, "created");
                return true;
            case "Accommodation.ReservationCancelled":
                UpsertReservation(workspaceEvent, db, "cancelled");
                return true;
            case "Accommodation.ReservationExpired":
                UpsertReservation(workspaceEvent, db, "expired");
                return true;
            case "Accommodation.ReservationConvertedToStay":
                UpsertReservation(workspaceEvent, db, "converted_to_stay");
                return true;
            default:
                return false;
        }
    }

    private void UpsertLead(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
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
            """);
        command.Parameters.AddWithValue("leadId", LeadId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("guestName", Value(workspaceEvent, "leadName", "unknown-guest"));
        command.Parameters.AddWithValue("phone", Value(workspaceEvent, "phone", "unknown-phone"));
        command.Parameters.AddWithValue("bedsNeeded", IntValue(workspaceEvent, "requestedBedCount", 1));
        command.Parameters.AddWithValue("stayDuration", Value(workspaceEvent, "stayDurationText", "unspecified"));
        command.Parameters.AddWithValue("sourceChannel", Value(workspaceEvent, "leadSource", "unknown-source"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertReservation(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into hostel_bookings(booking_id, workspace_id, lead_id, reserved_room_bed, beds_reserved, check_in_date, status, created_event_id, updated_at_utc, hold_until_utc)
            values (@bookingId, @workspaceId, @leadId, @reservedRoomBed, @bedsReserved, @checkInDate, @status, @createdEventId, @updatedAtUtc, @holdUntilUtc)
            on conflict(booking_id) do update set
                reserved_room_bed = excluded.reserved_room_bed,
                beds_reserved = excluded.beds_reserved,
                check_in_date = excluded.check_in_date,
                status = excluded.status,
                hold_until_utc = excluded.hold_until_utc,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("bookingId", ReservationId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("leadId", LeadId(workspaceEvent));
        command.Parameters.AddWithValue("reservedRoomBed", Value(workspaceEvent, "reservedBedIds", Value(workspaceEvent, "reservedRoomId", "unknown-room-bed")));
        command.Parameters.AddWithValue("bedsReserved", IntValue(workspaceEvent, "reservedBedCount", 1));
        command.Parameters.AddWithValue("checkInDate", DateValue(workspaceEvent, "plannedCheckInDate", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.Parameters.AddWithValue("holdUntilUtc", NpgsqlDbType.TimestampTz, DateValue(workspaceEvent, "reservationHoldUntil", workspaceEvent.OccurredAtUtc.AddDays(1)));
        command.ExecuteNonQuery();
    }

    private static string LeadId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "leadId", StableId("lead", workspaceEvent));

    private static string ReservationId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "reservationId", StableId("reservation", workspaceEvent));

    private static string Value(WorkspaceEvent workspaceEvent, string canonicalKey, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static int IntValue(WorkspaceEvent workspaceEvent, string canonicalKey, int defaultValue) =>
        RuntimeFieldAliases.IntValue(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static DateTimeOffset DateValue(WorkspaceEvent workspaceEvent, string canonicalKey, DateTimeOffset defaultValue)
    {
        var value = Value(workspaceEvent, canonicalKey, string.Empty);
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : defaultValue.ToUniversalTime();
    }

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
