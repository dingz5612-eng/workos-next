using System.Globalization;
using NpgsqlTypes;
using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.DepositLedger.Persistence;

internal sealed class DepositLedgerStorage
{
    private readonly PostgresConnectionFactory connections;

    public DepositLedgerStorage(PostgresConnectionFactory connections)
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
            case "Accommodation.DepositAssessed":
                UpsertLiability(workspaceEvent, db, DecimalValue(workspaceEvent, "requiredDepositAmount", 0m), 0m, "assessed");
                return true;
            case "Accommodation.DepositReceived":
                AppendTransaction(workspaceEvent, db, "received", DecimalValue(workspaceEvent, "receivedAmount", 0m), "pending_finance");
                UpsertLiability(workspaceEvent, db, DecimalValue(workspaceEvent, "receivedAmount", 0m), DecimalValue(workspaceEvent, "receivedAmount", 0m), "received");
                return true;
            case "Accommodation.DepositEvidenceSubmitted":
                AppendTransaction(workspaceEvent, db, "evidence_submitted", 0m, "evidence_submitted");
                return true;
            case "Accommodation.DepositConfirmed":
                AppendTransaction(workspaceEvent, db, "confirmed", DecimalValue(workspaceEvent, "confirmedAmount", 0m), "confirmed");
                UpsertLiability(workspaceEvent, db, DecimalValue(workspaceEvent, "confirmedAmount", 0m), DecimalValue(workspaceEvent, "confirmedAmount", 0m), "confirmed");
                return true;
            case "Accommodation.DepositRejected":
                AppendTransaction(workspaceEvent, db, "rejected", 0m, "rejected");
                return true;
            case "Accommodation.DepositDeducted":
                AppendTransaction(workspaceEvent, db, "deducted", DecimalValue(workspaceEvent, "deductionAmount", 0m), "deducted");
                return true;
            case "Accommodation.DepositAppliedToBalance":
                AppendTransaction(workspaceEvent, db, "applied_to_balance", DecimalValue(workspaceEvent, "applyToBalanceAmount", 0m), "applied");
                return true;
            case "Accommodation.DepositRefundApproved":
                AppendTransaction(workspaceEvent, db, "refund_approved", DecimalValue(workspaceEvent, "refundAmount", 0m), "approved");
                return true;
            case "Accommodation.DepositRefundPaid":
                AppendTransaction(workspaceEvent, db, "refund_paid", DecimalValue(workspaceEvent, "refundAmount", DecimalValue(workspaceEvent, "refundAmount", 0m)), "paid");
                return true;
            case "Accommodation.DepositClosed":
                AppendTransaction(workspaceEvent, db, "closed", 0m, "closed");
                return true;
            case "Accommodation.DepositSettlementRequested":
                AppendTransaction(workspaceEvent, db, "settlement_requested", 0m, "requested");
                return true;
            default:
                return false;
        }
    }

    private void UpsertLiability(WorkspaceEvent workspaceEvent, RuntimeDbSession db, decimal requiredAmount, decimal receivedAmount, string status)
    {
        var depositId = DepositId(workspaceEvent);
        using var command = db.CreateCommand("""
            insert into deposit_liabilities(deposit_id, workspace_id, folio_id, required_amount, received_amount, liability_balance, currency, rule_name, status, created_event_id, updated_at_utc)
            values (@depositId, @workspaceId, @folioId, @requiredAmount, @receivedAmount, @liabilityBalance, @currency, @ruleName, @status, @createdEventId, @updatedAtUtc)
            on conflict(deposit_id) do update set
                required_amount = greatest(deposit_liabilities.required_amount, excluded.required_amount),
                received_amount = greatest(deposit_liabilities.received_amount, excluded.received_amount),
                liability_balance = greatest(excluded.liability_balance, 0),
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """);
        command.Parameters.AddWithValue("depositId", depositId);
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("folioId", Value(workspaceEvent, "stayId", StableId("stay", workspaceEvent)));
        command.Parameters.AddWithValue("requiredAmount", NpgsqlDbType.Numeric, requiredAmount);
        command.Parameters.AddWithValue("receivedAmount", NpgsqlDbType.Numeric, receivedAmount);
        command.Parameters.AddWithValue("liabilityBalance", NpgsqlDbType.Numeric, Math.Max(requiredAmount - receivedAmount, 0m));
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "KGS"));
        command.Parameters.AddWithValue("ruleName", Value(workspaceEvent, "depositType", Value(workspaceEvent, "depositPolicyNote", "security")));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void AppendTransaction(WorkspaceEvent workspaceEvent, RuntimeDbSession db, string type, decimal amount, string status)
    {
        using var command = db.CreateCommand("""
            insert into deposit_transactions(transaction_id, deposit_id, workspace_id, transaction_type, amount, currency, status, actor_id, created_event_id, occurred_at_utc)
            values (@transactionId, @depositId, @workspaceId, @transactionType, @amount, @currency, @status, @actorId, @createdEventId, @occurredAtUtc)
            on conflict(transaction_id) do nothing
            """);
        command.Parameters.AddWithValue("transactionId", $"deposit-tx-{workspaceEvent.EventId}".ToLowerInvariant());
        command.Parameters.AddWithValue("depositId", DepositId(workspaceEvent));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("transactionType", type);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, amount);
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "currency", "KGS"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("actorId", workspaceEvent.ActorId);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("occurredAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static string DepositId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "depositId", Value(workspaceEvent, "depositReceiptId", StableId("deposit", workspaceEvent)));

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
