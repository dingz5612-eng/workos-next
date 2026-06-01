using Microsoft.VisualStudio.TestTools.UnitTesting;
using Npgsql;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.DatabaseSecurityTests;

internal static class DatabaseSecurityTestSupport
{
    public const string PermissionDenied = "42501";
    public const string CheckViolation = "23514";

    public static string ConnectionString() =>
        Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__WorkOSRuntime")
        ?? "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";

    public static void ApplyMigrations()
    {
        var database = new ControlPlaneDatabase(ConnectionString());
        database.ApplyMigrations(RepoPath("infra", "db", "migrations"));
    }

    public static void ExecuteOwner(string sql)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    public static T ScalarOwner<T>(string sql)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        var value = command.ExecuteScalar();
        Assert.IsNotNull(value);
        return (T)Convert.ChangeType(value, typeof(T));
    }

    public static void ExecuteAsRole(string role, string sql)
    {
        using var connection = Open();
        using (var setRole = connection.CreateCommand())
        {
            setRole.CommandText = $"set role {Quote(role)}";
            setRole.ExecuteNonQuery();
        }

        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    public static void AssertSqlState(string expectedSqlState, Action action)
    {
        try
        {
            action();
        }
        catch (PostgresException ex) when (ex.SqlState == expectedSqlState)
        {
            return;
        }

        Assert.Fail($"Expected PostgreSQL SQLSTATE {expectedSqlState}.");
    }

    public static void SeedRelease(string releaseId)
    {
        ExecuteOwner($"""
            insert into control_plane.release_manifests(
                release_id, mr_id, release_name, status, owners, commit_sha,
                migration_version, definition_version, api_schema_hash, ci_run_id,
                feature_flag_ids, slice_cutover_state_ids, shadow_compare_report_ids,
                invariant_check_ids, acceptance_scenarios, go_criteria, no_go_criteria,
                known_risks)
            values(
                '{releaseId}', 'RT-DB', 'RT-DB role isolation test', 'planned',
                '["platform"]'::jsonb, 'local-rtdb', '034_next_control_plane_runtime_roles',
                'rt-db', 'not-set', 'local', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '["test"]'::jsonb, '[]'::jsonb)
            on conflict(release_id) do nothing
            """);
    }

    public static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate WorkOSNext repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }

    private static NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(ConnectionString());
        connection.Open();
        return connection;
    }

    private static string Quote(string identifier) =>
        "\"" + identifier.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
}
