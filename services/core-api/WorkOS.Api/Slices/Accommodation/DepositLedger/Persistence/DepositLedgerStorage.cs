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
        switch (workspaceEvent.EventType)
        {
            case "Accommodation.DepositAssessed":
                UpsertLiability(workspaceEvent, DecimalValue(workspaceEvent, "应收押金金额", 3000m), 0m, "assessed");
                return true;
            case "Accommodation.DepositReceived":
            case "Accommodation.DepositEvidenceSubmitted":
                AppendTransaction(workspaceEvent, "received", DecimalValue(workspaceEvent, "实收押金金额", 3000m), "pending_finance");
                UpsertLiability(workspaceEvent, DecimalValue(workspaceEvent, "实收押金金额", 3000m), DecimalValue(workspaceEvent, "实收押金金额", 3000m), "received");
                return true;
            case "Accommodation.DepositConfirmed":
                AppendTransaction(workspaceEvent, "confirmed", DecimalValue(workspaceEvent, "确认金额", 3000m), "confirmed");
                UpsertLiability(workspaceEvent, DecimalValue(workspaceEvent, "确认金额", 3000m), DecimalValue(workspaceEvent, "确认金额", 3000m), "confirmed");
                return true;
            case "Accommodation.DepositRejected":
                AppendTransaction(workspaceEvent, "rejected", 0m, "rejected");
                return true;
            case "Accommodation.DepositDeducted":
                AppendTransaction(workspaceEvent, "deducted", DecimalValue(workspaceEvent, "扣除金额", 0m), "deducted");
                return true;
            case "Accommodation.DepositAppliedToBalance":
                AppendTransaction(workspaceEvent, "applied_to_balance", DecimalValue(workspaceEvent, "抵扣欠款金额", 0m), "applied");
                return true;
            case "Accommodation.DepositRefundApproved":
                AppendTransaction(workspaceEvent, "refund_approved", DecimalValue(workspaceEvent, "应退金额", 0m), "approved");
                return true;
            case "Accommodation.DepositRefundPaid":
                AppendTransaction(workspaceEvent, "refund_paid", DecimalValue(workspaceEvent, "应退金额", DecimalValue(workspaceEvent, "退款金额", 0m)), "paid");
                return true;
            case "Accommodation.DepositClosed":
                AppendTransaction(workspaceEvent, "closed", 0m, "closed");
                return true;
            default:
                return false;
        }
    }

    private void UpsertLiability(WorkspaceEvent workspaceEvent, decimal requiredAmount, decimal receivedAmount, string status)
    {
        var depositId = Value(workspaceEvent, "押金单", StableId("deposit", workspaceEvent));
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into deposit_liabilities(deposit_id, workspace_id, folio_id, required_amount, received_amount, liability_balance, currency, rule_name, status, created_event_id, updated_at_utc)
            values (@depositId, @workspaceId, @folioId, @requiredAmount, @receivedAmount, @liabilityBalance, @currency, @ruleName, @status, @createdEventId, @updatedAtUtc)
            on conflict(deposit_id) do update set
                required_amount = greatest(deposit_liabilities.required_amount, excluded.required_amount),
                received_amount = greatest(deposit_liabilities.received_amount, excluded.received_amount),
                liability_balance = greatest(excluded.liability_balance, 0),
                status = excluded.status,
                updated_at_utc = excluded.updated_at_utc
            """;
        command.Parameters.AddWithValue("depositId", depositId);
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("folioId", Value(workspaceEvent, "入住单", StableId("stay", workspaceEvent)));
        command.Parameters.AddWithValue("requiredAmount", NpgsqlDbType.Numeric, requiredAmount);
        command.Parameters.AddWithValue("receivedAmount", NpgsqlDbType.Numeric, receivedAmount);
        command.Parameters.AddWithValue("liabilityBalance", NpgsqlDbType.Numeric, Math.Max(requiredAmount - receivedAmount, 0m));
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "币种", "KGS"));
        command.Parameters.AddWithValue("ruleName", Value(workspaceEvent, "押金类型", Value(workspaceEvent, "押金规则说明", "security")));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("updatedAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private void AppendTransaction(WorkspaceEvent workspaceEvent, string type, decimal amount, string status)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into deposit_transactions(transaction_id, deposit_id, workspace_id, transaction_type, amount, currency, status, actor_id, created_event_id, occurred_at_utc)
            values (@transactionId, @depositId, @workspaceId, @transactionType, @amount, @currency, @status, @actorId, @createdEventId, @occurredAtUtc)
            on conflict(transaction_id) do nothing
            """;
        command.Parameters.AddWithValue("transactionId", $"deposit-tx-{workspaceEvent.EventId}".ToLowerInvariant());
        command.Parameters.AddWithValue("depositId", Value(workspaceEvent, "押金单", StableId("deposit", workspaceEvent)));
        command.Parameters.AddWithValue("workspaceId", workspaceEvent.WorkspaceId);
        command.Parameters.AddWithValue("transactionType", type);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, amount);
        command.Parameters.AddWithValue("currency", Value(workspaceEvent, "币种", "KGS"));
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("actorId", workspaceEvent.ActorId);
        command.Parameters.AddWithValue("createdEventId", workspaceEvent.EventId);
        command.Parameters.AddWithValue("occurredAtUtc", workspaceEvent.OccurredAtUtc);
        command.ExecuteNonQuery();
    }

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        workspaceEvent.Payload.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : defaultValue;

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        workspaceEvent.Payload.TryGetValue(key, out var value) && decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;

    private static string StableId(string prefix, WorkspaceEvent workspaceEvent) =>
        $"{prefix}-{workspaceEvent.WorkspaceId}".ToLowerInvariant();
}
