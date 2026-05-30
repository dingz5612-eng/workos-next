using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Persistence;

internal static class OperationSnapshotGenerator
{
    public static OperationSnapshot Generate(RuntimeDbSession db)
    {
        var totalRooms = Count(db, "accommodation_rooms");
        var totalBeds = Count(db, "accommodation_beds");
        var availableBeds = Integer(db, """
            select count(*)
            from accommodation_beds
            where lower(status) in ('available', 'ready', 'active')
            """);
        var occupiedBeds = Math.Max(
            Integer(db, """
                select count(*)
                from accommodation_beds
                where lower(status) in ('occupied', 'active_occupied')
                """),
            Integer(db, """
                select count(*)
                from hostel_stays
                where lower(status) in ('active', 'checked_in', 'occupied')
                """));
        var blockedBeds = Integer(db, """
            select count(*)
            from (
                select bed_id
                from accommodation_beds
                where status ilike '%block%'
                   or status ilike '%maintenance%'
                   or lower(status) in ('blocked', 'maintenance_blocked')
                union
                select bed_id
                from service_tasks
                where blocks_availability
                  and lower(status) not in ('verified', 'cancelled', 'closed')
                  and nullif(trim(bed_id), '') is not null
            ) blocked
            """);
        var pendingCheckouts = CountWhere(db, "checkout_settlements", "lower(status) not in ('closed', 'cancelled')");
        var pendingInspections = TableExists(db, "process_work_item_intents")
            ? Integer(db, """
                select count(*)
                from process_work_item_intents
                where work_item_type = 'roomInspection'
                  and lower(status) not in ('done', 'completed', 'closed', 'cancelled')
                """)
            : 0;
        var pendingCleaning = CountWhere(db, "service_tasks", "lower(task_type) = 'cleaning' and lower(status) not in ('verified', 'cancelled', 'closed')");
        var serviceTaskBacklog = CountWhere(db, "service_tasks", "lower(status) not in ('verified', 'cancelled', 'closed')");
        var overdueWorkItems = TableExists(db, "process_work_item_intents")
            ? Integer(db, """
                select count(*)
                from process_work_item_intents
                where lower(status) not in ('done', 'completed', 'closed', 'cancelled')
                  and nullif(body->>'dueAtUtc', '') is not null
                  and (body->>'dueAtUtc')::timestamptz < now()
                """)
            : 0;
        var openBlockers = TableExists(db, "process_request_event_intents")
            ? Integer(db, """
                select count(*)
                from process_request_event_intents
                where request_event_type = 'Accommodation.CaseBlockerCreated'
                  and lower(status) not in ('resolved', 'waived', 'closed', 'cancelled')
                """)
            : 0;
        var debtGuests = CountWhere(db, "stay_balances", "balance > 0");
        var highRiskCases =
            CountWhere(db, "reconciliation_cases", "blocker_severity = 'P0' and lower(status) not in ('resolved', 'closed', 'cancelled')") +
            CountWhere(db, "ledger_correction_requests", "risk_level in ('high', 'critical') and lower(status) not in ('applied', 'rejected', 'cancelled', 'superseded')") +
            (TableExists(db, "process_request_event_intents")
                ? Integer(db, """
                    select count(*)
                    from process_request_event_intents
                    where request_event_type = 'Accommodation.CaseBlockerCreated'
                      and body->>'blockerSeverity' = 'P0'
                      and lower(status) not in ('resolved', 'waived', 'closed', 'cancelled')
                    """)
                : 0);

        return Generate(new OperationSnapshotSourceState(
            totalRooms,
            totalBeds,
            availableBeds,
            occupiedBeds,
            blockedBeds,
            pendingCheckouts,
            pendingInspections,
            pendingCleaning,
            serviceTaskBacklog,
            overdueWorkItems,
            openBlockers,
            debtGuests,
            highRiskCases,
            SourceLensVersions(db),
            SourceEventHighWatermark(db)));
    }

    public static OperationSnapshot Generate(OperationSnapshotSourceState state)
    {
        var body = new Dictionary<string, object?>
        {
            ["totalRooms"] = state.TotalRooms,
            ["totalBeds"] = state.TotalBeds,
            ["availableBeds"] = state.AvailableBeds,
            ["occupiedBeds"] = state.OccupiedBeds,
            ["blockedBeds"] = state.BlockedBeds,
            ["pendingCheckouts"] = state.PendingCheckouts,
            ["pendingInspections"] = state.PendingInspections,
            ["pendingCleaning"] = state.PendingCleaning,
            ["serviceTaskBacklog"] = state.ServiceTaskBacklog,
            ["overdueWorkItems"] = state.OverdueWorkItems,
            ["openBlockers"] = state.OpenBlockers,
            ["debtGuests"] = state.DebtGuests,
            ["highRiskCases"] = state.HighRiskCases,
            ["rules"] = new[]
            {
                "blocked_beds_from_resource_inventory",
                "service_backlog_from_service_task_lens",
                "pending_checkouts_from_checkout_queue",
                "debt_guests_from_stay_balance",
                "overdue_work_items_from_work_queue_lens",
                "open_blockers_from_blocker_engine"
            }
        };

        return new OperationSnapshot(
            state.TotalRooms,
            state.TotalBeds,
            state.AvailableBeds,
            state.OccupiedBeds,
            state.BlockedBeds,
            state.PendingCheckouts,
            state.PendingInspections,
            state.PendingCleaning,
            state.ServiceTaskBacklog,
            state.OverdueWorkItems,
            state.OpenBlockers,
            state.DebtGuests,
            state.HighRiskCases,
            body,
            state.SourceLensVersions,
            state.SourceEventHighWatermark);
    }

    private static IReadOnlyDictionary<string, object> SourceLensVersions(RuntimeDbSession db)
    {
        return new Dictionary<string, object>
        {
            ["BedInventoryLens"] = $"accommodation_beds:{Count(db, "accommodation_beds")};max:{MaxText(db, "accommodation_beds", "created_event_id")}",
            ["RoomReadinessLens"] = $"accommodation_rooms:{Count(db, "accommodation_rooms")};max:{MaxText(db, "accommodation_rooms", "created_event_id")}",
            ["StayLifecycle"] = $"hostel_stays:{Count(db, "hostel_stays")};max:{MaxText(db, "hostel_stays", "created_event_id")}",
            ["StayBalanceLens"] = $"stay_balances:{Count(db, "stay_balances")};max:{MaxText(db, "stay_balances", "created_event_id")}",
            ["ServiceTaskQueueLens"] = $"service_tasks:{Count(db, "service_tasks")};max:{MaxText(db, "service_tasks", "created_event_id")}",
            ["CheckoutQueueLens"] = $"checkout_settlements:{Count(db, "checkout_settlements")};room_inspections:{Count(db, "room_inspections")}",
            ["BlockerEngine"] = TableExists(db, "process_request_event_intents") ? $"process_request_event_intents:{Count(db, "process_request_event_intents")}" : "not_integrated",
            ["WorkQueueLens"] = TableExists(db, "process_work_item_intents") ? $"process_work_item_intents:{Count(db, "process_work_item_intents")}" : "not_integrated"
        };
    }

    private static string SourceEventHighWatermark(RuntimeDbSession db) =>
        string.Join("|", new[]
        {
            $"rooms:{MaxText(db, "accommodation_rooms", "created_event_id")}",
            $"beds:{MaxText(db, "accommodation_beds", "created_event_id")}",
            $"stays:{MaxText(db, "hostel_stays", "created_event_id")}",
            $"balances:{MaxText(db, "stay_balances", "created_event_id")}",
            $"checkout:{MaxText(db, "checkout_settlements", "created_event_id")}",
            $"inspection:{MaxText(db, "room_inspections", "created_event_id")}",
            $"service:{MaxText(db, "service_tasks", "created_event_id")}",
            $"workQueue:{MaxText(db, "process_work_item_intents", "source_event_id")}",
            $"blockers:{MaxText(db, "process_request_event_intents", "source_event_id")}"
        });

    private static int Count(RuntimeDbSession db, string tableName) =>
        CountWhere(db, tableName, "true");

    private static int CountWhere(RuntimeDbSession db, string tableName, string predicate)
    {
        if (!TableExists(db, tableName))
        {
            return 0;
        }

        return Integer(db, $"select count(*) from {tableName} where {predicate}");
    }

    private static bool TableExists(RuntimeDbSession db, string tableName)
    {
        using var command = db.CreateCommand("select to_regclass(@tableName) is not null");
        command.Parameters.AddWithValue("tableName", tableName);
        return Convert.ToBoolean(command.ExecuteScalar());
    }

    private static int Integer(RuntimeDbSession db, string sql)
    {
        using var command = db.CreateCommand(sql);
        return Convert.ToInt32(command.ExecuteScalar() ?? 0);
    }

    private static string MaxText(RuntimeDbSession db, string tableName, string columnName)
    {
        if (!TableExists(db, tableName))
        {
            return "not_integrated";
        }

        using var command = db.CreateCommand($"select coalesce(max({columnName}), '') from {tableName}");
        return Convert.ToString(command.ExecuteScalar()) ?? string.Empty;
    }
}

internal sealed record OperationSnapshotSourceState(
    int TotalRooms,
    int TotalBeds,
    int AvailableBeds,
    int OccupiedBeds,
    int BlockedBeds,
    int PendingCheckouts,
    int PendingInspections,
    int PendingCleaning,
    int ServiceTaskBacklog,
    int OverdueWorkItems,
    int OpenBlockers,
    int DebtGuests,
    int HighRiskCases,
    IReadOnlyDictionary<string, object> SourceLensVersions,
    string SourceEventHighWatermark);

internal sealed record OperationSnapshot(
    int TotalRooms,
    int TotalBeds,
    int AvailableBeds,
    int OccupiedBeds,
    int BlockedBeds,
    int PendingCheckouts,
    int PendingInspections,
    int PendingCleaning,
    int ServiceTaskBacklog,
    int OverdueWorkItems,
    int OpenBlockers,
    int DebtGuests,
    int HighRiskCases,
    IReadOnlyDictionary<string, object?> Body,
    IReadOnlyDictionary<string, object> SourceLensVersions,
    string SourceEventHighWatermark);
