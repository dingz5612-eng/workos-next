using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ExpenseLedger.Persistence;

internal sealed class ExpenseLedgerStorage
{
    private readonly PostgresConnectionFactory connections;

    public ExpenseLedgerStorage(PostgresConnectionFactory connections)
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
            case "Accommodation.ExpenseRecorded":
            case "Accommodation.ExpenseEvidenceSubmitted":
                UpsertExpense(workspaceEvent, db, "recorded");
                return true;
            case "Accommodation.ExpenseApproved":
                UpsertExpense(workspaceEvent, db, "approved");
                return true;
            case "Accommodation.ExpenseRejected":
                UpsertExpense(workspaceEvent, db, "rejected");
                return true;
            case "Accommodation.ExpenseLinkedToRoom":
            case "Accommodation.ExpenseLinkedToServiceTask":
                UpsertExpenseLink(workspaceEvent, db);
                return true;
            default:
                return false;
        }
    }

    private void UpsertExpense(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into expenses(expense_id, workspace_id, expense_category, amount, currency, payment_method, status, approved_amount, created_event_id, updated_at_utc)
            values (@expenseId, @workspaceId, @expenseCategory, @amount, @currency, @paymentMethod, @status, @approvedAmount, @createdEventId, @updatedAtUtc)
            on conflict(expense_id) do update set
                amount = case when excluded.amount > 0 then excluded.amount else expenses.amount end,
                status = excluded.status,
                approved_amount = excluded.approved_amount,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("expenseId", Value(workspaceEvent, "expenseId", StableId("expense", workspaceEvent)));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("expenseCategory", Value(workspaceEvent, "expenseCategory", "maintenance"));
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "expenseAmount", 0m));
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "KGS"));
        command.Parameters.AddWithValue("paymentMethod", Value(workspaceEvent, "paymentMethod", "cash"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("approvedAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "confirmedAmount", DecimalValue(workspaceEvent, "expenseAmount", 0m)));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertExpenseLink(WorkspaceEvent workspaceEvent, RuntimeDbSession db)
    {
        using var command = db.CreateCommand("""
            insert into expense_links(link_id, expense_id, workspace_id, room_id, bed_id, service_task_id, created_event_id, updated_at_utc)
            values (@linkId, @expenseId, @workspaceId, @roomId, @bedId, @serviceTaskId, @createdEventId, @updatedAtUtc)
            on conflict(link_id) do update set
                room_id = excluded.room_id,
                bed_id = excluded.bed_id,
                service_task_id = excluded.service_task_id,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("linkId", StableId("expense-link", workspaceEvent));
        command.Parameters.AddWithValue("expenseId", Value(workspaceEvent, "expenseId", StableId("expense", workspaceEvent)));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("roomId", Value(workspaceEvent, "roomId", "unknown-room"));
        command.Parameters.AddWithValue("bedId", Value(workspaceEvent, "bedId", "unknown-bed"));
        command.Parameters.AddWithValue("serviceTaskId", Value(workspaceEvent, "taskId", StableId("task", workspaceEvent)));
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
