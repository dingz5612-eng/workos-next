using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.CheckOutSettlement.Persistence;

internal sealed class CheckOutSettlementStorage
{
    private readonly PostgresConnectionFactory connections;

    public CheckOutSettlementStorage(PostgresConnectionFactory connections)
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
            case "Accommodation.ResidentCheckedOut":
                UpsertCheckout(workspaceEvent, db, "started");
                return true;
            case "Accommodation.RoomInspected":
            case "Accommodation.CheckoutIssueRaised":
                UpsertInspection(workspaceEvent, db);
                return true;
            case "Accommodation.DepositSettlementRequested":
                UpsertCheckout(workspaceEvent, db, "deposit_settlement_requested");
                return true;
            case "Accommodation.FinalBalanceClosed":
                UpsertCheckout(workspaceEvent, db, "balance_closed");
                return true;
            case "Accommodation.BedReleased":
                UpsertCheckout(workspaceEvent, db, "bed_released");
                return true;
            case "Accommodation.PostCheckoutCleaningRequested":
                UpsertCheckout(workspaceEvent, db, "cleaning_requested");
                return true;
            default:
                return false;
        }
    }

    private void UpsertCheckout(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into checkout_settlements(checkout_id, workspace_id, stay_id, current_balance, deposit_held_amount, close_result, status, created_event_id, updated_at_utc)
            values (@checkoutId, @workspaceId, @stayId, @currentBalance, @depositHeldAmount, @closeResult, @status, @createdEventId, @updatedAtUtc)
            on conflict(checkout_id) do update set
                current_balance = excluded.current_balance,
                deposit_held_amount = excluded.deposit_held_amount,
                close_result = excluded.close_result,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("checkoutId", StableId("checkout", workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("stayId", Value(workspaceEvent, "stayId", StableId("stay", workspaceEvent)));
        command.Parameters.AddWithValue("currentBalance", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "currentBalance", DecimalValue(workspaceEvent, "endingDebtAmount", 0m)));
        command.Parameters.AddWithValue("depositHeldAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "heldAmount", DecimalValue(workspaceEvent, "applyToBalanceAmount", 0m)));
        command.Parameters.AddWithValue("closeResult", Value(workspaceEvent, "settlementResult", Value(workspaceEvent, "closeResult", "pending")));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertInspection(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into room_inspections(inspection_id, workspace_id, checkout_id, room_condition, bed_condition, damage_charge_amount, cleaning_required, created_event_id, updated_at_utc)
            values (@inspectionId, @workspaceId, @checkoutId, @roomCondition, @bedCondition, @damageChargeAmount, @cleaningRequired, @createdEventId, @updatedAtUtc)
            on conflict(inspection_id) do update set
                room_condition = excluded.room_condition,
                bed_condition = excluded.bed_condition,
                damage_charge_amount = excluded.damage_charge_amount,
                cleaning_required = excluded.cleaning_required,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("inspectionId", StableId("inspection", workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("checkoutId", StableId("checkout", workspaceEvent));
        command.Parameters.AddWithValue("roomCondition", Value(workspaceEvent, "roomCondition", "normal"));
        command.Parameters.AddWithValue("bedCondition", Value(workspaceEvent, "bedStatus", "normal"));
        command.Parameters.AddWithValue("damageChargeAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "damageChargeAmount", 0m));
        command.Parameters.AddWithValue("cleaningRequired", BoolValue(workspaceEvent, "cleaningRequired", true));
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
