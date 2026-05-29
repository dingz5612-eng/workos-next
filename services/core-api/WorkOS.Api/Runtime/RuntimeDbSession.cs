using Npgsql;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeDbSession : IDisposable
{
    private bool completed;

    public RuntimeDbSession(NpgsqlConnection connection)
    {
        Connection = connection;
        Transaction = connection.BeginTransaction();
    }

    public NpgsqlConnection Connection { get; }

    public NpgsqlTransaction Transaction { get; }

    public NpgsqlCommand CreateCommand(string commandText)
    {
        var command = Connection.CreateCommand();
        command.Transaction = Transaction;
        command.CommandText = commandText;
        return command;
    }

    public void Commit()
    {
        Transaction.Commit();
        completed = true;
    }

    public void Dispose()
    {
        if (!completed)
        {
            Transaction.Rollback();
        }

        Transaction.Dispose();
    }
}

public sealed record IdempotentWorkspaceEvent(WorkspaceEvent Event, string IdempotencyKey);

