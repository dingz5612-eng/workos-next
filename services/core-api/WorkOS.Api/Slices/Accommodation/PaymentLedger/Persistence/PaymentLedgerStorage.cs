using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.PaymentLedger.Persistence;

internal sealed class PaymentLedgerStorage
{
    private readonly PostgresConnectionFactory connections;

    public PaymentLedgerStorage(PostgresConnectionFactory connections)
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
            case "Accommodation.PaymentReceived":
            case "Accommodation.PaymentEvidenceSubmitted":
                UpsertPayment(workspaceEvent, db, "pending_finance");
                UpsertStayBalance(workspaceEvent, db, confirmedPayments: 0m, allocatedPayments: 0m, status: "payment_pending");
                return true;
            case "Accommodation.PaymentConfirmed":
                UpsertFinanceReconciliation(workspaceEvent, db, "confirmed");
                UpsertPayment(workspaceEvent, db, "confirmed");
                UpsertStayBalance(workspaceEvent, db, confirmedPayments: DecimalValue(workspaceEvent, "confirmedAmount", 0m), allocatedPayments: 0m, status: "payment_confirmed");
                return true;
            case "Accommodation.PaymentRejected":
                UpsertFinanceReconciliation(workspaceEvent, db, "rejected");
                UpsertPayment(workspaceEvent, db, "rejected");
                return true;
            case "Accommodation.PaymentAllocated":
                AppendAllocation(workspaceEvent, db, "allocated");
                UpsertStayBalance(workspaceEvent, db, confirmedPayments: DecimalValue(workspaceEvent, "confirmedAmount", DecimalValue(workspaceEvent, "allocatedAmount", 0m)), allocatedPayments: DecimalValue(workspaceEvent, "allocatedAmount", 0m), status: "allocated");
                return true;
            case "Accommodation.PaymentAdjusted":
                AppendAllocation(workspaceEvent, db, "adjusted");
                return true;
            case "Accommodation.DebtFollowUpRecorded":
                UpsertStayBalance(workspaceEvent, db, confirmedPayments: 0m, allocatedPayments: 0m, status: "debt_follow_up");
                return true;
            case "Accommodation.BalanceRecalculated":
                UpsertStayBalance(workspaceEvent, db, confirmedPayments: DecimalValue(workspaceEvent, "confirmedAmount", 0m), allocatedPayments: DecimalValue(workspaceEvent, "allocatedAmount", 0m), status: "recalculated");
                return true;
            default:
                return false;
        }
    }

    private void UpsertPayment(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into hostel_payments(payment_id, workspace_id, folio_id, deposit_id, payer, amount, currency, method, purpose, receipt_no, status, created_event_id, updated_at_utc)
            values (@paymentId, @workspaceId, @folioId, @depositId, @payer, @amount, @currency, @method, @purpose, @receiptNo, @status, @createdEventId, @updatedAtUtc)
            on conflict(payment_id) do update set
                amount = excluded.amount,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("paymentId", Value(workspaceEvent, "paymentId", StableId("payment", workspaceEvent)));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("folioId", Value(workspaceEvent, "stayId", StableId("stay", workspaceEvent)));
        command.Parameters.AddWithValue("depositId", string.Empty);
        command.Parameters.AddWithValue("payer", Value(workspaceEvent, "payerName", "张三"));
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "paymentAmount", DecimalValue(workspaceEvent, "confirmedAmount", 3000m)));
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "KGS"));
        command.Parameters.AddWithValue("method", Value(workspaceEvent, "paymentMethod", "现金"));
        command.Parameters.AddWithValue("purpose", Value(workspaceEvent, "paymentPurpose", "房租"));
        command.Parameters.AddWithValue("receiptNo", Value(workspaceEvent, "paymentEvidenceId", workspaceEvent.EventId));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertFinanceReconciliation(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        var confirmedAmount = DecimalValue(workspaceEvent, "confirmedAmount", 3000m);
        using var command = db.CreateCommand("""
            insert into finance_reconciliations(reconciliation_id, workspace_id, payment_id, channel, confirmed_amount, currency, match_result, variance_amount, status, confirmed_by, created_event_id, updated_at_utc)
            values (@reconciliationId, @workspaceId, @paymentId, @channel, @confirmedAmount, @currency, @matchResult, @varianceAmount, @status, @confirmedBy, @createdEventId, @updatedAtUtc)
            on conflict(reconciliation_id) do update set
                confirmed_amount = excluded.confirmed_amount,
                match_result = excluded.match_result,
                variance_amount = excluded.variance_amount,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("reconciliationId", StableId("payment-reconciliation", workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("paymentId", Value(workspaceEvent, "paymentId", StableId("payment", workspaceEvent)));
        command.Parameters.AddWithValue("channel", Value(workspaceEvent, "paymentChannel", "现金"));
        command.Parameters.AddWithValue("confirmedAmount", NpgsqlDbType.Numeric, confirmedAmount);
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "KGS"));
        command.Parameters.AddWithValue("matchResult", Value(workspaceEvent, "confirmationResult", "确认"));
        command.Parameters.AddWithValue("varianceAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "differenceAmount", 0m));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("confirmedBy", workspaceEvent.ActorId);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void AppendAllocation(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string status)
    {
        using var command = db.CreateCommand("""
            insert into payment_allocations(allocation_id, payment_id, workspace_id, allocation_mode, allocated_amount, status, created_event_id, occurred_at_utc)
            values (@allocationId, @paymentId, @workspaceId, @allocationMode, @allocatedAmount, @status, @createdEventId, @occurredAtUtc)
            on conflict(allocation_id) do nothing
            """);
        command.Parameters.AddWithValue("allocationId", $"payment-allocation-{workspaceEvent.EventId}".ToLowerInvariant());
        command.Parameters.AddWithValue("paymentId", Value(workspaceEvent, "paymentId", StableId("payment", workspaceEvent)));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("allocationMode", Value(workspaceEvent, "allocationMode", "自动抵最早欠款"));
        command.Parameters.AddWithValue("allocatedAmount", NpgsqlDbType.Numeric, DecimalValue(workspaceEvent, "allocatedAmount", 0m));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("occurredAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void UpsertStayBalance(WorkspaceEvent workspaceEvent, RuntimeDbSession db, decimal confirmedPayments, decimal allocatedPayments, string status)
    {
        var stayId = Value(workspaceEvent, "stayId", StableId("stay", workspaceEvent));
        var totalCharges = TotalChargesForStay(db, stayId);
        var balance = Math.Max(totalCharges - allocatedPayments, 0m);
        using var command = db.CreateCommand("""
            insert into stay_balances(stay_id, workspace_id, total_charges, confirmed_payments, allocated_payments, balance, currency, status, created_event_id, updated_at_utc)
            values (@stayId, @workspaceId, @totalCharges, @confirmedPayments, @allocatedPayments, @balance, @currency, @status, @createdEventId, @updatedAtUtc)
            on conflict(stay_id) do update set
                total_charges = greatest(stay_balances.total_charges, excluded.total_charges),
                confirmed_payments = greatest(stay_balances.confirmed_payments, excluded.confirmed_payments),
                allocated_payments = greatest(stay_balances.allocated_payments, excluded.allocated_payments),
                balance = excluded.balance,
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("stayId", stayId);
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("totalCharges", NpgsqlDbType.Numeric, totalCharges);
        command.Parameters.AddWithValue("confirmedPayments", NpgsqlDbType.Numeric, confirmedPayments);
        command.Parameters.AddWithValue("allocatedPayments", NpgsqlDbType.Numeric, allocatedPayments);
        command.Parameters.AddWithValue("balance", NpgsqlDbType.Numeric, balance);
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "KGS"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static decimal TotalChargesForStay(RuntimeDbSession db, string stayId)
    {
        using var command = db.CreateCommand("""
            select greatest(
                coalesce((select sum(amount) from hostel_charges where stay_id = @stayId), 0),
                coalesce((select sum(charge_amount) from guest_folios where stay_id = @stayId), 0),
                coalesce((select max(total_charges) from stay_balances where stay_id = @stayId), 0)
            )
            """);
        command.Parameters.AddWithValue("stayId", stayId);
        return Convert.ToDecimal(command.ExecuteScalar() ?? 0m);
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
