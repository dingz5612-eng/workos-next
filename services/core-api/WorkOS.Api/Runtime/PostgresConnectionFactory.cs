using Npgsql;

namespace WorkOS.Api.Runtime;

internal sealed class PostgresConnectionFactory
{
    private readonly string connectionString;

    public PostgresConnectionFactory(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }
}
