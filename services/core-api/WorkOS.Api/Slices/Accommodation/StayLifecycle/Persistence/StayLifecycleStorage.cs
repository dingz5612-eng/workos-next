using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.StayLifecycle.Persistence;

internal sealed class StayLifecycleStorage
{
    private readonly PostgresConnectionFactory connections;

    public StayLifecycleStorage(PostgresConnectionFactory connections)
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
            case "Accommodation.ResidentProfileCaptured":
                UpsertResident(workspaceEvent, db, "profile_captured");
                return true;
            case "Accommodation.ResidentCheckedIn":
            case "Accommodation.BedAssigned":
                UpsertStay(workspaceEvent, db, "active");
                return true;
            case "Accommodation.StayChargeAssessed":
                UpsertCharge(workspaceEvent, db);
                UpsertGuestFolio(workspaceEvent, db);
                return true;
            case "Accommodation.StayExtended":
            case "Accommodation.StayRateChanged":
                UpsertStay(workspaceEvent, db, "extended");
                return true;
            default:
                return false;
        }
    }

    private void UpsertResident(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into hostel_residents(resident_id, workspace_id, resident_name, phone, identity_type, identity_no, gender, nationality, status, created_event_id, updated_at_utc)
            values (@residentId, @workspaceId, @residentName, @phone, @identityType, @identityNo, @gender, @nationality, @status, @createdEventId, @updatedAtUtc)
            on conflict(resident_id) do update set
                resident_name = excluded.resident_name,
                phone = excluded.phone,
                identity_type = excluded.identity_type,
                identity_no = excluded.identity_no,
                gender = excluded.gender,
                nationality = excluded.nationality,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("residentId", ResidentId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("residentName", Value(workspaceEvent, "residentName", "住客姓名", "张三"));
        command.Parameters.AddWithValue("phone", Value(workspaceEvent, "phone", "电话", "+996 555 010101"));
        command.Parameters.AddWithValue("identityType", Value(workspaceEvent, "identityType", "证件类型", "passport"));
        command.Parameters.AddWithValue("identityNo", Value(workspaceEvent, "identityNo", "证件号码", string.Empty));
        command.Parameters.AddWithValue("gender", Value(workspaceEvent, "gender", "性别", "unrestricted"));
        command.Parameters.AddWithValue("nationality", Value(workspaceEvent, "nationality", "国籍", string.Empty));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertStay(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into hostel_stays(stay_id, workspace_id, resident_name, phone, room_bed, check_in_date, planned_checkout_date, status, created_event_id, updated_at_utc)
            values (@stayId, @workspaceId, @residentName, @phone, @roomBed, @checkInDate, @plannedCheckoutDate, @status, @createdEventId, @updatedAtUtc)
            on conflict(stay_id) do update set
                resident_name = excluded.resident_name,
                phone = excluded.phone,
                room_bed = excluded.room_bed,
                check_in_date = excluded.check_in_date,
                planned_checkout_date = excluded.planned_checkout_date,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("stayId", StayId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("residentName", Value(workspaceEvent, "residentName", "住客姓名", "张三"));
        command.Parameters.AddWithValue("phone", Value(workspaceEvent, "phone", "电话", "+996 555 010101"));
        command.Parameters.AddWithValue("roomBed", $"{Value(workspaceEvent, "roomId", "房间", "A301")} / {Value(workspaceEvent, "bedId", "床位", "A301-02")}");
        command.Parameters.AddWithValue("checkInDate", DateValue(workspaceEvent, "checkInDate", "入住日期", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("plannedCheckoutDate", DateValue(workspaceEvent, "plannedCheckOutDate", "计划退住日期", workspaceEvent.OccurredAtUtc.AddMonths(1)));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertCharge(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into hostel_charges(charge_id, workspace_id, stay_id, charge_type, period_start_utc, period_end_utc, amount, currency, reason, status, created_event_id, updated_at_utc)
            values (@chargeId, @workspaceId, @stayId, @chargeType, @periodStartUtc, @periodEndUtc, @amount, @currency, @reason, @status, @createdEventId, @updatedAtUtc)
            on conflict(charge_id) do update set
                amount = excluded.amount,
                reason = excluded.reason,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("chargeId", ChargeId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("stayId", StayId(workspaceEvent));
        command.Parameters.AddWithValue("chargeType", Value(workspaceEvent, "chargeType", "应收类型", "rent"));
        command.Parameters.AddWithValue("periodStartUtc", DateValue(workspaceEvent, "periodStart", "计费开始日期", workspaceEvent.OccurredAtUtc));
        command.Parameters.AddWithValue("periodEndUtc", DateValue(workspaceEvent, "periodEnd", "计费结束日期", workspaceEvent.OccurredAtUtc.AddMonths(1)));
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "amount", "应收金额", 0m));
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "币种", "KGS"));
        command.Parameters.AddWithValue("reason", Value(workspaceEvent, "chargeReason", "应收原因", string.Empty));
        command.Parameters.AddWithValue("status", "assessed");
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertGuestFolio(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        var amount = DecimalValue(workspaceEvent, "amount", "应收金额", 0m);
        using var command = db.CreateCommand("""
            insert into guest_folios(folio_id, workspace_id, stay_id, tariff_type, unit_price, quantity, charge_amount, paid_amount, balance, currency, status, created_event_id, updated_at_utc)
            values (@folioId, @workspaceId, @stayId, @tariffType, @unitPrice, @quantity, @chargeAmount, @paidAmount, @balance, @currency, @status, @createdEventId, @updatedAtUtc)
            on conflict(folio_id) do update set
                charge_amount = excluded.charge_amount,
                balance = excluded.balance,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("folioId", StableId("folio", workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("stayId", StayId(workspaceEvent));
        command.Parameters.AddWithValue("tariffType", Value(workspaceEvent, "chargeType", "应收类型", "rent"));
        command.Parameters.AddWithValue("unitPrice", NpgsqlDbType.Numeric, amount);
        command.Parameters.AddWithValue("quantity", NpgsqlDbType.Numeric, 1m);
        command.Parameters.AddWithValue("chargeAmount", NpgsqlDbType.Numeric, amount);
        command.Parameters.AddWithValue("paidAmount", NpgsqlDbType.Numeric, 0m);
        command.Parameters.AddWithValue("balance", NpgsqlDbType.Numeric, amount);
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "币种", "KGS"));
        command.Parameters.AddWithValue("status", "open");
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static string ResidentId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "residentId", "住客", StableId("resident", workspaceEvent));

    private static string StayId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "stayId", "入住单", StableId("stay", workspaceEvent));

    private static string ChargeId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "chargeId", "应收记录", StableId("charge", workspaceEvent));

    private static string Value(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, canonicalKey, defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string canonicalKey, string zhKey, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, canonicalKey, defaultValue);

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
