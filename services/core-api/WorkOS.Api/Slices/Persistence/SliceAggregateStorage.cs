using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;
using WorkOS.Api.Slices.Accommodation.CheckIn.Aggregates;
using WorkOS.Api.Slices.Accommodation.CheckIn.Events;
using WorkOS.Api.Slices.Accommodation.ResourceSetup.Aggregates;
using WorkOS.Api.Slices.Accommodation.ResourceSetup.Events;

namespace WorkOS.Api.Slices.Persistence;

internal sealed class SliceAggregateStorage
{
    private readonly PostgresConnectionFactory connections;

    public SliceAggregateStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public void Apply(WorkspaceEvent workspaceEvent)
    {
        switch (workspaceEvent.EventType)
        {
            case ResourceSetupEvents.RoomCreated:
                UpsertRoom(RoomFrom(workspaceEvent));
                break;
            case ResourceSetupEvents.BedCreated:
                UpsertBed(BedFrom(workspaceEvent));
                break;
            case CheckInEvents.DepositEvidenceSubmitted:
                UpsertDeposit(DepositFrom(workspaceEvent));
                break;
            case CheckInEvents.FinanceDepositConfirmed:
                UpsertFinanceConfirmation(FinanceConfirmationFrom(workspaceEvent));
                break;
        }
    }

    private void UpsertRoom(RoomAggregate room)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into accommodation_rooms(room_id, workspace_id, room_no, room_type, capacity, status, created_event_id, updated_at_utc)
            values (@roomId, @workspaceId, @roomNo, @roomType, @capacity, @status, @createdEventId, @updatedAtUtc)
            on conflict(room_id) do update set
                room_no = excluded.room_no,
                room_type = excluded.room_type,
                capacity = excluded.capacity,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("roomId", room.RoomId);
        command.Parameters.AddWithValue("workspaceId", room.WorkspaceId);
        command.Parameters.AddWithValue("roomNo", room.RoomNo);
        command.Parameters.AddWithValue("roomType", room.RoomType);
        command.Parameters.AddWithValue("capacity", room.Capacity);
        command.Parameters.AddWithValue("status", room.Status);
        command.Parameters.AddWithValue("createdEventId", room.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", room.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertBed(BedAggregate bed)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into accommodation_beds(bed_id, workspace_id, room_id, bed_no, bunk_type, status, created_event_id, updated_at_utc)
            values (@bedId, @workspaceId, @roomId, @bedNo, @bunkType, @status, @createdEventId, @updatedAtUtc)
            on conflict(bed_id) do update set
                room_id = excluded.room_id,
                bed_no = excluded.bed_no,
                bunk_type = excluded.bunk_type,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("bedId", bed.BedId);
        command.Parameters.AddWithValue("workspaceId", bed.WorkspaceId);
        command.Parameters.AddWithValue("roomId", bed.RoomId);
        command.Parameters.AddWithValue("bedNo", bed.BedNo);
        command.Parameters.AddWithValue("bunkType", bed.BunkType);
        command.Parameters.AddWithValue("status", bed.Status);
        command.Parameters.AddWithValue("createdEventId", bed.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", bed.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertDeposit(DepositAggregate deposit)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into accommodation_deposits(deposit_id, workspace_id, stay_order_id, amount, currency, payment_method, evidence_id, status, created_event_id, updated_at_utc)
            values (@depositId, @workspaceId, @stayOrderId, @amount, @currency, @paymentMethod, @evidenceId, @status, @createdEventId, @updatedAtUtc)
            on conflict(deposit_id) do update set
                amount = excluded.amount,
                currency = excluded.currency,
                payment_method = excluded.payment_method,
                evidence_id = excluded.evidence_id,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("depositId", deposit.DepositId);
        command.Parameters.AddWithValue("workspaceId", deposit.WorkspaceId);
        command.Parameters.AddWithValue("stayOrderId", deposit.StayOrderId);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, deposit.Amount);
        command.Parameters.AddWithValue("currency", deposit.Currency);
        command.Parameters.AddWithValue("paymentMethod", deposit.PaymentMethod);
        command.Parameters.AddWithValue("evidenceId", deposit.EvidenceId);
        command.Parameters.AddWithValue("status", deposit.Status);
        command.Parameters.AddWithValue("createdEventId", deposit.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", deposit.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertFinanceConfirmation(FinanceConfirmationAggregate confirmation)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into finance_confirmations(finance_confirmation_id, workspace_id, deposit_id, confirmed_amount, currency, status, confirmed_by, created_event_id, updated_at_utc)
            values (@financeConfirmationId, @workspaceId, @depositId, @confirmedAmount, @currency, @status, @confirmedBy, @createdEventId, @updatedAtUtc)
            on conflict(finance_confirmation_id) do update set
                confirmed_amount = excluded.confirmed_amount,
                currency = excluded.currency,
                status = excluded.status,
                confirmed_by = excluded.confirmed_by,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("financeConfirmationId", confirmation.FinanceConfirmationId);
        command.Parameters.AddWithValue("workspaceId", confirmation.WorkspaceId);
        command.Parameters.AddWithValue("depositId", confirmation.DepositId);
        command.Parameters.AddWithValue("confirmedAmount", NpgsqlDbType.Numeric, confirmation.ConfirmedAmount);
        command.Parameters.AddWithValue("currency", confirmation.Currency);
        command.Parameters.AddWithValue("status", confirmation.Status);
        command.Parameters.AddWithValue("confirmedBy", confirmation.ConfirmedBy);
        command.Parameters.AddWithValue("createdEventId", confirmation.CreatedEventId);
        command.Parameters.AddWithValue("updatedAtUtc", confirmation.UpdatedAtUtc);
        command.ExecuteNonQuery();
    }

    private static RoomAggregate RoomFrom(WorkspaceEvent workspaceEvent)
    {
        var roomNo = Value(workspaceEvent, "房间号", "A302");
        var roomType = Value(workspaceEvent, "房型", "四人间");
        return new RoomAggregate(
            $"room-{roomNo}".ToLowerInvariant(),
            workspaceEvent.WorkspaceId,
            roomNo,
            roomType,
            CapacityFor(roomType),
            "created",
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static BedAggregate BedFrom(WorkspaceEvent workspaceEvent)
    {
        var roomNo = Value(workspaceEvent, "房间号", "A302");
        var bedNo = Value(workspaceEvent, "床位号", $"{roomNo}-01");
        return new BedAggregate(
            $"bed-{bedNo}".ToLowerInvariant(),
            workspaceEvent.WorkspaceId,
            $"room-{roomNo}".ToLowerInvariant(),
            bedNo,
            Value(workspaceEvent, "上/下铺", "下铺"),
            "created",
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static DepositAggregate DepositFrom(WorkspaceEvent workspaceEvent)
    {
        var amount = DecimalValue(workspaceEvent, "押金金额", 3000m);
        var evidenceId = Value(workspaceEvent, "凭证编号", $"evidence-{workspaceEvent.EventId}");
        return new DepositAggregate(
            $"deposit-{workspaceEvent.WorkspaceId}".ToLowerInvariant(),
            workspaceEvent.WorkspaceId,
            Value(workspaceEvent, "住宿单号", "stay-order-current"),
            amount,
            Value(workspaceEvent, "币种", "KGS"),
            Value(workspaceEvent, "付款方式", "现金"),
            evidenceId,
            "submitted",
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static FinanceConfirmationAggregate FinanceConfirmationFrom(WorkspaceEvent workspaceEvent)
    {
        return new FinanceConfirmationAggregate(
            $"finance-{workspaceEvent.WorkspaceId}".ToLowerInvariant(),
            workspaceEvent.WorkspaceId,
            $"deposit-{workspaceEvent.WorkspaceId}".ToLowerInvariant(),
            DecimalValue(workspaceEvent, "确认金额", DecimalValue(workspaceEvent, "押金金额", 3000m)),
            Value(workspaceEvent, "币种", "KGS"),
            "confirmed",
            workspaceEvent.ActorId,
            workspaceEvent.EventId,
            workspaceEvent.OccurredAtUtc);
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        workspaceEvent.Payload.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : defaultValue;

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        workspaceEvent.Payload.TryGetValue(key, out var value) && decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;

    private static int CapacityFor(string roomType) => roomType switch
    {
        "单人间" => 1,
        "双人间" => 2,
        "六人间" => 6,
        _ => 4
    };
}
