using Npgsql;

namespace WorkOS.ControlPlaneRunners;

public static class ControlPlaneSchemaVerifyJob
{
    private static readonly RequiredTable[] RequiredTables =
    [
        new("control_plane", "release_manifests"),
        new("control_plane", "feature_flags"),
        new("control_plane", "slice_cutover_states"),
        new("control_plane", "shadow_compare_reports"),
        new("control_plane", "runtime_invariant_checks"),
        new("control_plane", "gate_results"),
        new("control_plane", "rollback_instructions"),
        new("shadow_runtime", "command_submissions"),
        new("shadow_runtime", "domain_events"),
        new("shadow_runtime", "ledger_entries"),
        new("shadow_runtime", "lens_snapshots"),
        new("shadow_runtime", "compare_inputs")
    ];

    public static Task Run(RunnerOptions options)
    {
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "control-plane-schema-verify.json"));
        var migrationsPath = options.Get("migrations", Path.Combine("infra", "db", "migrations"));
        var connection = ResolveConnectionString();
        var requiredTables = RequiredTables.Concat(ParseAdditionalRequiredTables(options.Get("require-table"))).ToArray();
        var applyMigrations = !options.GetBool("skip-migrations");
        var generatedAt = DateTimeOffset.UtcNow;
        var errors = new List<string>();
        IReadOnlyList<SchemaTableCheck> tableChecks = [];
        IReadOnlyList<SchemaConstraintProbe> constraintProbes = [];
        var migrationCount = 0L;

        try
        {
            var database = new ControlPlaneDatabase(connection.ConnectionString);
            if (applyMigrations)
            {
                database.ApplyMigrations(migrationsPath);
            }

            migrationCount = CountAppliedMigrations(connection.ConnectionString);
            tableChecks = ReadRequiredTables(connection.ConnectionString, requiredTables);
            errors.AddRange(tableChecks.Where(check => !check.Exists).Select(check => $"Missing table: {check.FullName}"));

            if (errors.Count == 0)
            {
                constraintProbes = RunConstraintProbes(connection.ConnectionString);
                errors.AddRange(
                    constraintProbes
                        .Where(probe => probe.Status != "passed")
                        .Select(probe => $"{probe.Name} did not reject invalid value: {probe.Message}"));
            }

            var status = errors.Count == 0 ? "passed" : "failed";
            WriteReport(outputPath, new ControlPlaneSchemaVerifyReport(
                $"control-plane-schema-verify-{generatedAt:yyyyMMddHHmmss}",
                status,
                connection.Source,
                migrationsPath,
                applyMigrations,
                migrationCount,
                tableChecks,
                constraintProbes,
                errors,
                "control-plane-schema-verify",
                generatedAt));

            if (errors.Count > 0)
            {
                throw new InvalidOperationException("control-plane-schema-verify: failed");
            }

            Console.WriteLine("control-plane-schema-verify: PASS");
            return Task.CompletedTask;
        }
        catch (Exception error)
        {
            if (errors.Count == 0)
            {
                errors.Add(error.Message);
            }

            WriteReport(outputPath, new ControlPlaneSchemaVerifyReport(
                $"control-plane-schema-verify-{generatedAt:yyyyMMddHHmmss}",
                "failed",
                connection.Source,
                migrationsPath,
                applyMigrations,
                migrationCount,
                tableChecks,
                constraintProbes,
                errors,
                "control-plane-schema-verify",
                generatedAt));
            throw;
        }
    }

    private static ConnectionStringResolution ResolveConnectionString()
    {
        var workosTestConnection = Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION");
        if (!string.IsNullOrWhiteSpace(workosTestConnection))
        {
            return new ConnectionStringResolution("WORKOS_TEST_CONNECTION", workosTestConnection);
        }

        var runtimeConnection = Environment.GetEnvironmentVariable("ConnectionStrings__WorkOSRuntime");
        if (!string.IsNullOrWhiteSpace(runtimeConnection))
        {
            return new ConnectionStringResolution("ConnectionStrings__WorkOSRuntime", runtimeConnection);
        }

        return new ConnectionStringResolution(
            "default-local",
            "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev");
    }

    private static IReadOnlyList<SchemaTableCheck> ReadRequiredTables(
        string connectionString,
        IReadOnlyList<RequiredTable> requiredTables)
    {
        var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select table_schema, table_name
            from information_schema.tables
            where table_schema in ('control_plane', 'shadow_runtime')
            """;
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            existing.Add($"{reader.GetString(0)}.{reader.GetString(1)}");
        }

        return requiredTables
            .Select(table => new SchemaTableCheck(table.Schema, table.Table, existing.Contains(table.FullName)))
            .ToArray();
    }

    private static IReadOnlyList<RequiredTable> ParseAdditionalRequiredTables(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return value
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(item => item.Split('.', 2, StringSplitOptions.TrimEntries))
            .Select(parts => parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0]) && !string.IsNullOrWhiteSpace(parts[1])
                ? new RequiredTable(parts[0], parts[1])
                : throw new InvalidOperationException($"Invalid --require-table value: {value}"))
            .ToArray();
    }

    private static IReadOnlyList<SchemaConstraintProbe> RunConstraintProbes(string connectionString)
    {
        return
        [
            ExpectCheckViolation(
                connectionString,
                "shadow_compare_reports.grade",
                "control_plane.shadow_compare_reports.grade must reject non green/yellow/red values",
                (connection, transaction, releaseId, suffix) =>
                {
                    using var command = connection.CreateCommand();
                    command.Transaction = transaction;
                    command.CommandText = """
                        insert into control_plane.shadow_compare_reports(
                            shadow_compare_report_id, release_id, tenant_id, slice_id, grade, generated_by)
                        values(@id, @releaseId, 'tenant-a', 'Accommodation.DepositLedger', 'blue', 'schema-verify')
                        """;
                    command.Parameters.AddWithValue("id", $"bad-grade-{suffix}");
                    command.Parameters.AddWithValue("releaseId", releaseId);
                    command.ExecuteNonQuery();
                }),
            ExpectCheckViolation(
                connectionString,
                "runtime_invariant_checks.mode",
                "control_plane.runtime_invariant_checks.mode must reject non blocking/observing values",
                (connection, transaction, releaseId, suffix) =>
                {
                    using var command = connection.CreateCommand();
                    command.Transaction = transaction;
                    command.CommandText = """
                        insert into control_plane.runtime_invariant_checks(
                            invariant_check_id, release_id, tenant_id, slice_id, invariant_key,
                            description, mode, severity, source_type, status, generated_by)
                        values(
                            @id, @releaseId, 'tenant-a', 'Accommodation.DepositLedger',
                            'bad_mode', 'bad mode must fail', 'passive', 'P1', 'sql',
                            'not_run', 'schema-verify')
                        """;
                    command.Parameters.AddWithValue("id", $"bad-mode-{suffix}");
                    command.Parameters.AddWithValue("releaseId", releaseId);
                    command.ExecuteNonQuery();
                }),
            ExpectCheckViolation(
                connectionString,
                "runtime_invariant_checks.severity",
                "control_plane.runtime_invariant_checks.severity must reject non P0/P1/P2 values",
                (connection, transaction, releaseId, suffix) =>
                {
                    using var command = connection.CreateCommand();
                    command.Transaction = transaction;
                    command.CommandText = """
                        insert into control_plane.runtime_invariant_checks(
                            invariant_check_id, release_id, tenant_id, slice_id, invariant_key,
                            description, mode, severity, source_type, status, generated_by)
                        values(
                            @id, @releaseId, 'tenant-a', 'Accommodation.DepositLedger',
                            'bad_severity', 'bad severity must fail', 'blocking', 'P3',
                            'sql', 'not_run', 'schema-verify')
                        """;
                    command.Parameters.AddWithValue("id", $"bad-severity-{suffix}");
                    command.Parameters.AddWithValue("releaseId", releaseId);
                    command.ExecuteNonQuery();
                }),
            ExpectCheckViolation(
                connectionString,
                "rollback_instructions.instruction_type",
                "control_plane.rollback_instructions.instruction_type must reject non rollback/compensating values",
                (connection, transaction, releaseId, suffix) =>
                {
                    using var command = connection.CreateCommand();
                    command.Transaction = transaction;
                    command.CommandText = """
                        insert into control_plane.rollback_instructions(
                            rollback_instruction_id, release_id, instruction_type, rollback_kind,
                            title, owner, risk_level)
                        values(
                            @id, @releaseId, 'undo', 'feature_flag',
                            'bad instruction', 'platform', 'medium')
                        """;
                    command.Parameters.AddWithValue("id", $"bad-instruction-{suffix}");
                    command.Parameters.AddWithValue("releaseId", releaseId);
                    command.ExecuteNonQuery();
                })
        ];
    }

    private static SchemaConstraintProbe ExpectCheckViolation(
        string connectionString,
        string name,
        string description,
        Action<NpgsqlConnection, NpgsqlTransaction, string, string> insertInvalidValue)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var releaseId = $"schema-verify-{suffix}";
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        using var transaction = connection.BeginTransaction();

        try
        {
            InsertReleaseManifest(connection, transaction, releaseId);
            insertInvalidValue(connection, transaction, releaseId, suffix);
            transaction.Rollback();
            return new SchemaConstraintProbe(name, description, "failed", null, null, "Invalid value was accepted.");
        }
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.CheckViolation)
        {
            transaction.Rollback();
            return new SchemaConstraintProbe(name, description, "passed", error.SqlState, error.ConstraintName, error.MessageText);
        }
        catch (PostgresException error)
        {
            transaction.Rollback();
            return new SchemaConstraintProbe(name, description, "failed", error.SqlState, error.ConstraintName, error.MessageText);
        }
    }

    private static void InsertReleaseManifest(NpgsqlConnection connection, NpgsqlTransaction transaction, string releaseId)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into control_plane.release_manifests(
                release_id, mr_id, release_name, status, owners,
                migration_version, definition_version, feature_flag_ids,
                slice_cutover_state_ids, shadow_compare_report_ids,
                invariant_check_ids, acceptance_scenarios, go_criteria,
                no_go_criteria, known_risks)
            values(
                @releaseId, 'schema-verify', 'Schema verify probe', 'planned',
                '[]'::jsonb, '015_control_plane_shadow_runtime', 'v5.4',
                '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
            """;
        command.Parameters.AddWithValue("releaseId", releaseId);
        command.ExecuteNonQuery();
    }

    private static long CountAppliedMigrations(string connectionString)
    {
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select count(*)
            from information_schema.tables
            where table_schema = 'public' and table_name = 'schema_migrations'
            """;
        if (Convert.ToInt64(command.ExecuteScalar()) == 0)
        {
            return 0;
        }

        command.CommandText = "select count(*) from schema_migrations";
        return Convert.ToInt64(command.ExecuteScalar());
    }

    private static void WriteReport(string outputPath, ControlPlaneSchemaVerifyReport report) =>
        RunnerJson.Write(outputPath, report);
}

public sealed record ControlPlaneSchemaVerifyReport(
    string ReportId,
    string Status,
    string ConnectionSource,
    string MigrationsPath,
    bool MigrationsApplied,
    long AppliedMigrationCount,
    IReadOnlyList<SchemaTableCheck> Tables,
    IReadOnlyList<SchemaConstraintProbe> ConstraintProbes,
    IReadOnlyList<string> Errors,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record SchemaTableCheck(
    string Schema,
    string Table,
    bool Exists)
{
    public string FullName => $"{Schema}.{Table}";
}

public sealed record SchemaConstraintProbe(
    string Name,
    string Description,
    string Status,
    string? SqlState,
    string? ConstraintName,
    string? Message);

internal sealed record RequiredTable(string Schema, string Table)
{
    public string FullName => $"{Schema}.{Table}";
}

internal sealed record ConnectionStringResolution(string Source, string ConnectionString);
