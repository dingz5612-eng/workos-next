using Npgsql;

namespace WorkOS.Api.Runtime;

internal sealed class PostgresMigrationRunner
{
    private readonly PostgresConnectionFactory connections;
    private readonly string? migrationsPath;

    public PostgresMigrationRunner(PostgresConnectionFactory connections, string? migrationsPath)
    {
        this.connections = connections;
        this.migrationsPath = migrationsPath;
    }

    public void Run()
    {
        using var connection = connections.Open();
        AcquireAdvisoryLock(connection);
        try
        {
            using var bootstrap = connection.CreateCommand();
            bootstrap.CommandText = """
                create table if not exists public.schema_migrations (
                    migration_id text primary key,
                    applied_at_utc timestamptz not null
                );
                """;
            bootstrap.ExecuteNonQuery();

            foreach (var migration in MigrationScriptLoader.Load(migrationsPath))
            {
                ApplyMigration(connection, migration.MigrationId, migration.Sql);
            }
        }
        finally
        {
            ReleaseAdvisoryLock(connection);
        }
    }

    private static void AcquireAdvisoryLock(NpgsqlConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "select pg_advisory_lock(hashtext('workosnext_runtime_migrations'))";
        command.ExecuteNonQuery();
    }

    private static void ReleaseAdvisoryLock(NpgsqlConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "select pg_advisory_unlock(hashtext('workosnext_runtime_migrations'))";
        command.ExecuteNonQuery();
    }

    private static void ApplyMigration(NpgsqlConnection connection, string migrationId, string sql)
    {
        using var exists = connection.CreateCommand();
        exists.CommandText = "select 1 from public.schema_migrations where migration_id = @migrationId";
        exists.Parameters.AddWithValue("migrationId", migrationId);
        if (exists.ExecuteScalar() is not null)
        {
            return;
        }

        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        command.ExecuteNonQuery();

        using var insert = connection.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = "insert into public.schema_migrations(migration_id, applied_at_utc) values (@migrationId, @appliedAtUtc)";
        insert.Parameters.AddWithValue("migrationId", migrationId);
        insert.Parameters.AddWithValue("appliedAtUtc", DateTimeOffset.UtcNow);
        insert.ExecuteNonQuery();
        transaction.Commit();
    }
}
