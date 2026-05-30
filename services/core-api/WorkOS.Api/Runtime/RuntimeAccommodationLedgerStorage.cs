namespace WorkOS.Api.Runtime;

internal sealed class RuntimeAccommodationLedgerStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeAccommodationLedgerStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public DepositLedgerState GetDepositLedgerState(string depositId)
    {
        using var connection = connections.Open();
        var confirmed = SumDepositTransactions(connection, depositId, "confirmed");
        var deducted = SumDepositTransactions(connection, depositId, "deducted");
        var applied = SumDepositTransactions(connection, depositId, "applied_to_balance");
        var approved = SumDepositTransactions(connection, depositId, "refund_approved");
        var paid = SumDepositTransactions(connection, depositId, "refund_paid");
        var heldAmount = Math.Max(confirmed - deducted - applied - paid, 0m);
        return new DepositLedgerState(depositId, heldAmount, deducted, applied, approved, paid);
    }

    public PaymentLedgerState GetPaymentLedgerState(string paymentId)
    {
        using var connection = connections.Open();
        decimal confirmedAmount;
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "select coalesce(sum(confirmed_amount), 0) from finance_reconciliations where payment_id = @paymentId and status = 'confirmed'";
            command.Parameters.AddWithValue("paymentId", paymentId);
            confirmedAmount = Convert.ToDecimal(command.ExecuteScalar() ?? 0m);
        }

        decimal allocatedAmount;
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "select coalesce(sum(allocated_amount), 0) from payment_allocations where payment_id = @paymentId";
            command.Parameters.AddWithValue("paymentId", paymentId);
            allocatedAmount = Convert.ToDecimal(command.ExecuteScalar() ?? 0m);
        }

        return new PaymentLedgerState(paymentId, confirmedAmount, allocatedAmount);
    }

    private static decimal SumDepositTransactions(Npgsql.NpgsqlConnection connection, string depositId, string transactionType)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "select coalesce(sum(amount), 0) from deposit_transactions where deposit_id = @depositId and transaction_type = @transactionType";
        command.Parameters.AddWithValue("depositId", depositId);
        command.Parameters.AddWithValue("transactionType", transactionType);
        return Convert.ToDecimal(command.ExecuteScalar() ?? 0m);
    }
}
