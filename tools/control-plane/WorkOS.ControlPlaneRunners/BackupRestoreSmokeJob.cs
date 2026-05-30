using Npgsql;
using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class BackupRestoreSmokeJob
{
    public static Task<BackupRestoreSmokeRunOutput> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-backup-restore-smoke");
        var mrId = options.Get("mrId", "local");
        var tenantId = options.Get("tenantId", "all-tenants");
        var ciRunId = options.Get("ciRunId")
            ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID")
            ?? "local";
        var reportId = options.Get("reportId", $"backup-restore-smoke-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}");
        var generatedAtUtc = DateTimeOffset.UtcNow;
        var dryRun = options.GetBool("dry-run", defaultValue: true);
        var cleanup = options.GetBool("cleanup", defaultValue: true);
        var migrationsPath = options.Get("migrations", Path.Combine("infra", "db", "migrations"));
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "backup-restore-smoke-invariant-checks.json"));
        var reportPath = options.Get("report-out", Path.Combine(".tmp", "v5_4", "backup-restore-smoke-report.json"));
        var invariantOutputPath = options.Get("restore-invariant-out", Path.Combine(".tmp", "v5_4", "backup-restore-after-restore-invariants.json"));
        var connectionString = ControlPlaneDatabase.ResolveConnectionString(options);
        var isolatedSchema = BackupRestoreSmokePostgresStore.SmokeSchemaName(reportId);

        var database = new ControlPlaneDatabase(connectionString);
        database.ApplyMigrations(migrationsPath);
        if (!dryRun)
        {
            database.EnsureReleaseManifest(releaseId, mrId, ciRunId);
        }

        var service = new BackupRestoreSmokeJobService(
            new BackupRestoreSmokePostgresStore(connectionString),
            new PostgresBackupRestoreProjectionRunner(connectionString, migrationsPath),
            new PostgresBackupRestoreInvariantRunner(connectionString, invariantOutputPath));

        var output = service.Run(new BackupRestoreSmokeRunContext(
            reportId,
            releaseId,
            tenantId,
            ciRunId,
            isolatedSchema,
            cleanup,
            "backup-restore-smoke",
            generatedAtUtc));

        if (!dryRun)
        {
            var store = new ControlPlaneWriteStore(database.ConnectionString);
            foreach (var check in output.InvariantChecks)
            {
                store.WriteRuntimeInvariantCheck(new RuntimeInvariantCheckWrite(
                    check.InvariantCheckId,
                    check.ReleaseId,
                    check.TenantId,
                    check.SliceId,
                    check.InvariantKey,
                    check.Description,
                    check.Mode,
                    check.Severity,
                    check.SourceType,
                    check.CheckSql,
                    check.CheckRef,
                    check.Status,
                    check.ObservedValue,
                    check.Threshold,
                    check.ViolationCount,
                    check.SampleViolations,
                    check.GeneratedBy,
                    check.CiRunId,
                    check.CheckedAtUtc));
            }

            database.WriteBackupRestoreSmokeReport(output.Report);
        }

        RunnerJson.Write(outputPath, output.InvariantChecks);
        RunnerJson.Write(reportPath, output.Report);
        Console.WriteLine($"backup-restore-smoke: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), reportPath)} status={output.Status}");
        return Task.FromResult(output);
    }
}

public sealed class BackupRestoreSmokeJobService
{
    private readonly IBackupRestoreSmokeStore store;
    private readonly IBackupRestoreProjectionRunner projectionRunner;
    private readonly IBackupRestoreInvariantRunner invariantRunner;

    public BackupRestoreSmokeJobService(
        IBackupRestoreSmokeStore store,
        IBackupRestoreProjectionRunner projectionRunner,
        IBackupRestoreInvariantRunner invariantRunner)
    {
        this.store = store;
        this.projectionRunner = projectionRunner;
        this.invariantRunner = invariantRunner;
    }

    public BackupRestoreSmokeRunOutput Run(BackupRestoreSmokeRunContext context)
    {
        var snapshot = store.BackupAndRestore(context);
        var projection = projectionRunner.Run(context);
        var invariants = invariantRunner.Run(context);
        var backupOk = snapshot.SchemaBackup.Success && snapshot.DataBackup.Success;
        var restoreOk = snapshot.RestoreSummary.Success
            && snapshot.KeyQueryResults.All(result => result.MatchesSource);
        var invariantsOk = invariants.All(result => result.Status is "passed" or "warning");
        var status = backupOk && restoreOk && projection.Rebuildable && invariantsOk
            ? "passed"
            : "failed";
        var releaseGateRefs = new[]
        {
            $"{context.ReportId}-backup-smoke-success",
            $"{context.ReportId}-restore-smoke-success",
            $"{context.ReportId}-invariants-after-restore-pass"
        };
        var report = new BackupRestoreSmokeReport(
            context.ReportId,
            context.ReleaseId,
            context.TenantId,
            status,
            context.IsolatedSchema,
            snapshot.SchemaBackup,
            snapshot.DataBackup,
            snapshot.RestoreSummary,
            snapshot.KeyQueryResults,
            projection,
            invariants,
            releaseGateRefs,
            context.GeneratedBy,
            context.GeneratedAtUtc);
        var checks = BuildInvariantChecks(context, report, backupOk, restoreOk, invariantsOk);

        if (context.Cleanup)
        {
            store.Cleanup(context.IsolatedSchema);
        }

        return new BackupRestoreSmokeRunOutput(context.ReportId, context.ReleaseId, context.TenantId, status, checks, report);
    }

    private static IReadOnlyList<InvariantCheckEvidence> BuildInvariantChecks(
        BackupRestoreSmokeRunContext context,
        BackupRestoreSmokeReport report,
        bool backupOk,
        bool restoreOk,
        bool invariantsOk) =>
    [
        Check(
            context,
            "backup.smoke_success",
            "Schema backup and data backup must complete for the smoke set.",
            backupOk,
            new Dictionary<string, object>
            {
                ["schema_table_count"] = report.SchemaBackup.TableCount,
                ["data_table_count"] = report.DataBackup.TableCount,
                ["data_row_count"] = report.DataBackup.TotalRows
            },
            new Dictionary<string, object> { ["backup_success"] = true },
            backupOk ? [] : FailureSamples("backup_smoke_failed")),
        Check(
            context,
            "restore.smoke_success",
            "Restore to an isolated schema must preserve key query counts and projection rebuildability.",
            restoreOk && report.ProjectionRebuild.Rebuildable,
            new Dictionary<string, object>
            {
                ["isolated_schema"] = report.IsolatedSchema,
                ["restored_table_count"] = report.RestoreSummary.RestoredTableCount,
                ["key_query_count"] = report.KeyQueryResults.Count,
                ["projection_rebuildable"] = report.ProjectionRebuild.Rebuildable,
                ["projection_mismatch_count"] = report.ProjectionRebuild.MismatchCount
            },
            new Dictionary<string, object> { ["restore_success"] = true, ["projection_rebuildable"] = true },
            restoreOk && report.ProjectionRebuild.Rebuildable ? [] : report.KeyQueryResults
                .Where(result => !result.MatchesSource)
                .Select(result => (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
                {
                    ["key"] = result.Key,
                    ["source_count"] = result.SourceCount,
                    ["restored_count"] = result.RestoredCount
                })
                .DefaultIfEmpty(new Dictionary<string, object> { ["failure"] = "projection_rebuild_failed" })
                .ToArray()),
        Check(
            context,
            "restore.invariants_after_restore_pass",
            "Invariant runner must pass after restore.",
            invariantsOk,
            new Dictionary<string, object>
            {
                ["invariant_count"] = report.InvariantResults.Count,
                ["failed_invariant_count"] = report.InvariantResults.Count(result => result.Status == "failed")
            },
            new Dictionary<string, object> { ["failed_invariant_count"] = 0 },
            invariantsOk ? [] : report.InvariantResults
                .Where(result => result.Status == "failed")
                .Select(result => (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
                {
                    ["invariant_key"] = result.InvariantKey,
                    ["status"] = result.Status
                })
                .ToArray())
    ];

    private static InvariantCheckEvidence Check(
        BackupRestoreSmokeRunContext context,
        string key,
        string description,
        bool passed,
        IReadOnlyDictionary<string, object> observed,
        IReadOnlyDictionary<string, object> threshold,
        IReadOnlyList<IReadOnlyDictionary<string, object>> samples) =>
        new(
            $"{context.ReportId}-{Sanitize(key)}",
            context.ReleaseId,
            context.TenantId,
            "BackupRestore",
            key,
            description,
            "blocking",
            "P0",
            "backup-restore-smoke",
            null,
            "backup-restore-smoke",
            passed ? "passed" : "failed",
            observed,
            threshold,
            passed ? 0 : Math.Max(samples.Count, 1),
            samples,
            context.GeneratedBy,
            context.CiRunId,
            context.GeneratedAtUtc);

    private static IReadOnlyList<IReadOnlyDictionary<string, object>> FailureSamples(string failure) =>
    [
        new Dictionary<string, object> { ["failure"] = failure }
    ];

    private static string Sanitize(string value) =>
        new(value.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
}

public interface IBackupRestoreSmokeStore
{
    BackupRestoreSnapshot BackupAndRestore(BackupRestoreSmokeRunContext context);

    void Cleanup(string isolatedSchema);
}

public interface IBackupRestoreProjectionRunner
{
    BackupRestoreProjectionRebuildResult Run(BackupRestoreSmokeRunContext context);
}

public interface IBackupRestoreInvariantRunner
{
    IReadOnlyList<BackupRestoreInvariantResult> Run(BackupRestoreSmokeRunContext context);
}

public sealed class BackupRestoreSmokePostgresStore : IBackupRestoreSmokeStore
{
    private static readonly IReadOnlyList<RestoreTableSource> RestoreTables =
    [
        new("public", "schema_migrations", "schema_migrations"),
        new("public", "process_runs", "process_runs"),
        new("public", "process_work_item_intents", "process_work_item_intents"),
        new("public", "audit_events", "audit_events"),
        new("public", "accommodation_beds", "accommodation_beds"),
        new("public", "accommodation_rooms", "accommodation_rooms"),
        new("public", "stay_balances", "stay_balances"),
        new("public", "hostel_payments", "hostel_payments"),
        new("public", "deposit_transactions", "deposit_transactions"),
        new("public", "payment_allocations", "payment_allocations"),
        new("public", "deposit_liabilities", "deposit_liabilities"),
        new("public", "checkout_settlements", "checkout_settlements"),
        new("public", "service_tasks", "service_tasks"),
        new("public", "risk_command_snapshots", "risk_command_snapshots"),
        new("public", "period_reviews", "period_reviews"),
        new("public", "period_metric_snapshots", "period_metric_snapshots"),
        new("public", "period_finance_snapshots", "period_finance_snapshots"),
        new("public", "period_operation_snapshots", "period_operation_snapshots"),
        new("public", "projection_rebuild_audits", "projection_rebuild_audits"),
        new("public", "projection_checkpoints", "projection_checkpoints"),
        new("public", "evidence_objects", "evidence_objects"),
        new("control_plane", "release_manifests", "_control_plane_release_manifests")
    ];

    private readonly string connectionString;

    public BackupRestoreSmokePostgresStore(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public static string SmokeSchemaName(string reportId)
    {
        var suffix = new string(reportId.Select(ch => char.IsLetterOrDigit(ch) ? char.ToLowerInvariant(ch) : '_').ToArray()).Trim('_');
        if (string.IsNullOrWhiteSpace(suffix))
        {
            suffix = Guid.NewGuid().ToString("N");
        }

        return $"backup_restore_smoke_{suffix}";
    }

    public BackupRestoreSnapshot BackupAndRestore(BackupRestoreSmokeRunContext context)
    {
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        ValidateSmokeSchema(context.IsolatedSchema);
        DropSmokeSchema(connection, context.IsolatedSchema);
        Execute(connection, $"create schema {Quote(context.IsolatedSchema)}");

        var tableBackups = RestoreTables
            .Select(table => BackupAndRestoreTable(connection, context.IsolatedSchema, table))
            .ToArray();
        CreateSmokeViews(connection, context.IsolatedSchema);
        var keyQueries = ReadKeyQueries(connection, context.IsolatedSchema);

        return new BackupRestoreSnapshot(
            new BackupRestoreSchemaBackup(
                tableBackups.All(table => table.SourceExists),
                tableBackups.Count(table => table.SourceExists),
                tableBackups),
            new BackupRestoreDataBackup(
                tableBackups.All(table => table.SourceExists),
                tableBackups.Count(table => table.SourceExists),
                tableBackups.Sum(table => table.SourceRowCount),
                tableBackups),
            new BackupRestoreSummary(
                tableBackups.All(table => table.SourceExists && table.Restored)
                    && keyQueries.All(query => query.MatchesSource),
                context.IsolatedSchema,
                tableBackups.Count(table => table.Restored),
                tableBackups.Sum(table => table.RestoredRowCount),
                tableBackups),
            keyQueries);
    }

    public void Cleanup(string isolatedSchema)
    {
        ValidateSmokeSchema(isolatedSchema);
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        DropSmokeSchema(connection, isolatedSchema);
    }

    private static BackupRestoreTableResult BackupAndRestoreTable(
        NpgsqlConnection connection,
        string isolatedSchema,
        RestoreTableSource table)
    {
        var sourceExists = RelationExists(connection, table.SourceSchema, table.SourceTable);
        if (!sourceExists)
        {
            return new BackupRestoreTableResult(
                table.SourceSchema,
                table.SourceTable,
                table.RestoreTable,
                false,
                false,
                0,
                0,
                []);
        }

        var columns = ReadColumns(connection, table.SourceSchema, table.SourceTable);
        var sourceCount = CountRows(connection, table.SourceSchema, table.SourceTable);
        Execute(
            connection,
            $"""
            create table {Quote(isolatedSchema)}.{Quote(table.RestoreTable)}
            (like {Quote(table.SourceSchema)}.{Quote(table.SourceTable)}
             including defaults
             including identity
             including generated
             including constraints)
            """);
        Execute(
            connection,
            $"""
            insert into {Quote(isolatedSchema)}.{Quote(table.RestoreTable)}
            select * from {Quote(table.SourceSchema)}.{Quote(table.SourceTable)}
            """);
        var restoredCount = CountRows(connection, isolatedSchema, table.RestoreTable);
        return new BackupRestoreTableResult(
            table.SourceSchema,
            table.SourceTable,
            table.RestoreTable,
            true,
            restoredCount == sourceCount,
            sourceCount,
            restoredCount,
            columns);
    }

    private static void CreateSmokeViews(NpgsqlConnection connection, string isolatedSchema)
    {
        Execute(connection,
            $"""
            create view {Quote(isolatedSchema)}.operation_cases as
            select process_run_id as operation_case_id, tenant_id, trigger_event_id, status, created_at_utc
            from {Quote(isolatedSchema)}.process_runs
            """);
        Execute(connection,
            $"""
            create view {Quote(isolatedSchema)}.work_items as
            select intent_id, tenant_id, work_item_id, work_item_type, target_workspace_id, owner_role, source_event_id, status, created_at_utc
            from {Quote(isolatedSchema)}.process_work_item_intents
            """);
        Execute(connection,
            $"""
            create view {Quote(isolatedSchema)}.domain_events as
            select event_id as domain_event_id, workspace_id as tenant_id, event_type, card_id, actor_id, occurred_at_utc
            from {Quote(isolatedSchema)}.audit_events
            """);
        Execute(connection,
            $"""
            create view {Quote(isolatedSchema)}.ledger_entries as
            select payment_id as ledger_entry_id, workspace_id as tenant_id, 'hostel_payments' as ledger_source,
                   amount, currency, created_event_id, updated_at_utc as occurred_at_utc
            from {Quote(isolatedSchema)}.hostel_payments
            union all
            select transaction_id as ledger_entry_id, workspace_id as tenant_id, 'deposit_transactions' as ledger_source,
                   amount, currency, created_event_id, occurred_at_utc
            from {Quote(isolatedSchema)}.deposit_transactions
            union all
            select allocation_id as ledger_entry_id, workspace_id as tenant_id, 'payment_allocations' as ledger_source,
                   allocated_amount as amount, null::text as currency, created_event_id, occurred_at_utc
            from {Quote(isolatedSchema)}.payment_allocations
            """);
        Execute(connection,
            $"""
            create view {Quote(isolatedSchema)}.evidence_metadata as
            select evidence_id, workspace_id as tenant_id, card_id, card_instance_id, submission_id, requirement_id, status, created_at_utc
            from {Quote(isolatedSchema)}.evidence_objects
            """);
        Execute(connection,
            $"""
            create view {Quote(isolatedSchema)}.release_manifests as
            select release_id, mr_id, status, created_at_utc, updated_at_utc
            from {Quote(isolatedSchema)}._control_plane_release_manifests
            """);
    }

    private static IReadOnlyList<BackupRestoreKeyQueryResult> ReadKeyQueries(NpgsqlConnection connection, string isolatedSchema)
    {
        var queries = new[]
        {
            Query("operation_cases", "public.process_runs", "operation_cases", CountRows(connection, "public", "process_runs")),
            Query("work_items", "public.process_work_item_intents", "work_items", CountRows(connection, "public", "process_work_item_intents")),
            Query("domain_events", "public.audit_events", "domain_events", CountRows(connection, "public", "audit_events")),
            Query("ledger_entries", "public.ledger_aliases", "ledger_entries", CountSourceLedgerRows(connection)),
            Query("evidence_metadata", "public.evidence_objects", "evidence_metadata", CountRows(connection, "public", "evidence_objects")),
            Query("control_plane.release_manifests", "control_plane.release_manifests", "release_manifests", CountRows(connection, "control_plane", "release_manifests"))
        };

        return queries
            .Select(query =>
            {
                var restoredCount = CountRows(connection, isolatedSchema, query.RestoreRelation);
                return new BackupRestoreKeyQueryResult(
                    query.Key,
                    query.SourceObject,
                    $"{isolatedSchema}.{query.RestoreRelation}",
                    query.SourceCount,
                    restoredCount,
                    restoredCount == query.SourceCount);
            })
            .ToArray();
    }

    private static KeyQueryPlan Query(string key, string sourceObject, string restoreRelation, long sourceCount) =>
        new(key, sourceObject, restoreRelation, sourceCount);

    private static long CountSourceLedgerRows(NpgsqlConnection connection) =>
        CountRows(connection, "public", "hostel_payments")
        + CountRows(connection, "public", "deposit_transactions")
        + CountRows(connection, "public", "payment_allocations");

    private static long CountRows(NpgsqlConnection connection, string schema, string relation)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"select count(*) from {Quote(schema)}.{Quote(relation)}";
        return Convert.ToInt64(command.ExecuteScalar() ?? 0);
    }

    private static bool RelationExists(NpgsqlConnection connection, string schema, string relation)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            select 1
            from information_schema.tables
            where table_schema = @schema and table_name = @relation
            union all
            select 1
            from information_schema.views
            where table_schema = @schema and table_name = @relation
            limit 1
            """;
        command.Parameters.AddWithValue("schema", schema);
        command.Parameters.AddWithValue("relation", relation);
        return command.ExecuteScalar() is not null;
    }

    private static IReadOnlyList<BackupRestoreColumnSnapshot> ReadColumns(NpgsqlConnection connection, string schema, string table)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            select column_name, data_type, is_nullable
            from information_schema.columns
            where table_schema = @schema and table_name = @table
            order by ordinal_position
            """;
        command.Parameters.AddWithValue("schema", schema);
        command.Parameters.AddWithValue("table", table);
        using var reader = command.ExecuteReader();
        var columns = new List<BackupRestoreColumnSnapshot>();
        while (reader.Read())
        {
            columns.Add(new BackupRestoreColumnSnapshot(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2).Equals("YES", StringComparison.OrdinalIgnoreCase)));
        }

        return columns;
    }

    private static void DropSmokeSchema(NpgsqlConnection connection, string isolatedSchema)
    {
        ValidateSmokeSchema(isolatedSchema);
        Execute(connection, $"drop schema if exists {Quote(isolatedSchema)} cascade");
    }

    private static void ValidateSmokeSchema(string isolatedSchema)
    {
        if (!isolatedSchema.StartsWith("backup_restore_smoke_", StringComparison.Ordinal)
            || isolatedSchema.Any(ch => !(char.IsLower(ch) || char.IsDigit(ch) || ch == '_')))
        {
            throw new InvalidOperationException($"unsafe_backup_restore_smoke_schema:{isolatedSchema}");
        }
    }

    private static void Execute(NpgsqlConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    private static string Quote(string value) => "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";

    private sealed record RestoreTableSource(string SourceSchema, string SourceTable, string RestoreTable);

    private sealed record KeyQueryPlan(string Key, string SourceObject, string RestoreRelation, long SourceCount);
}

public sealed class PostgresBackupRestoreProjectionRunner : IBackupRestoreProjectionRunner
{
    private readonly string sourceConnectionString;
    private readonly string migrationsPath;

    public PostgresBackupRestoreProjectionRunner(string sourceConnectionString, string migrationsPath)
    {
        this.sourceConnectionString = sourceConnectionString;
        this.migrationsPath = migrationsPath;
    }

    public BackupRestoreProjectionRebuildResult Run(BackupRestoreSmokeRunContext context)
    {
        var restoreConnection = BackupRestoreConnectionStrings.WithSearchPath(sourceConnectionString, context.IsolatedSchema);
        var result = ProjectionRebuildCli.RunPostgres(
            restoreConnection,
            new ProjectionRebuildRequest(
                context.TenantId,
                DryRun: true,
                RequestedBy: "backup-restore-smoke",
                Reason: "backup restore smoke projection verification",
                ActorRole: "release",
                ActorCapabilities: ["projection.rebuild"],
                DeviceId: "ci-control-plane",
                DeviceTrustStatus: "trusted",
                Surface: "pc"),
            migrationsPath);
        return new BackupRestoreProjectionRebuildResult(
            result.Status != "failed",
            result.Status,
            result.RebuildId,
            result.LensNames.Count,
            result.MismatchCount,
            result.DryRun);
    }
}

public sealed class PostgresBackupRestoreInvariantRunner : IBackupRestoreInvariantRunner
{
    private readonly string sourceConnectionString;
    private readonly string outputPath;

    public PostgresBackupRestoreInvariantRunner(string sourceConnectionString, string outputPath)
    {
        this.sourceConnectionString = sourceConnectionString;
        this.outputPath = outputPath;
    }

    public IReadOnlyList<BackupRestoreInvariantResult> Run(BackupRestoreSmokeRunContext context)
    {
        var definitionsPath = Path.Combine(".tmp", "v5_4", $"{context.ReportId}-after-restore-invariants.json");
        RunnerJson.Write(definitionsPath, new InvariantDefinitionFile([
            new InvariantDefinition(
                "restore.key_queries_available_after_restore",
                "Restored isolated schema exposes required key query relations.",
                "blocking",
                "P0",
                "sql",
                """
                select 0::int as violation_count,
                       jsonb_build_object(
                         'current_schema', current_schema(),
                         'operation_cases_count', (select count(*) from operation_cases),
                         'work_items_count', (select count(*) from work_items),
                         'domain_events_count', (select count(*) from domain_events),
                         'ledger_entries_count', (select count(*) from ledger_entries),
                         'evidence_metadata_count', (select count(*) from evidence_metadata),
                         'release_manifests_count', (select count(*) from release_manifests)
                       ) as observed_value,
                       jsonb_build_object('required_relations', 6) as threshold,
                       '[]'::jsonb as sample_violations
                """,
                "backup-restore-smoke")
        ]));

        var restoreConnection = BackupRestoreConnectionStrings.WithSearchPath(sourceConnectionString, context.IsolatedSchema);
        var checks = InvariantRunner.Run(RunnerOptions.Parse([
            $"--connection={restoreConnection}",
            $"--releaseId={context.ReleaseId}",
            $"--tenantId={context.TenantId}",
            "--sliceId=BackupRestore",
            $"--ciRunId={context.CiRunId}",
            $"--definitions={definitionsPath}",
            $"--out={outputPath}",
            "--dry-run=true"
        ])).GetAwaiter().GetResult();

        return checks
            .Select(check => new BackupRestoreInvariantResult(
                check.InvariantCheckId,
                check.InvariantKey,
                check.Status,
                check.ViolationCount))
            .ToArray();
    }
}

public static class BackupRestoreConnectionStrings
{
    public static string WithSearchPath(string connectionString, string isolatedSchema)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = $"{isolatedSchema},public"
        };
        return builder.ConnectionString;
    }
}

public sealed record BackupRestoreSmokeRunContext(
    string ReportId,
    string ReleaseId,
    string TenantId,
    string CiRunId,
    string IsolatedSchema,
    bool Cleanup,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record BackupRestoreSmokeRunOutput(
    string ReportId,
    string ReleaseId,
    string TenantId,
    string Status,
    IReadOnlyList<InvariantCheckEvidence> InvariantChecks,
    BackupRestoreSmokeReport Report);

public sealed record BackupRestoreSnapshot(
    BackupRestoreSchemaBackup SchemaBackup,
    BackupRestoreDataBackup DataBackup,
    BackupRestoreSummary RestoreSummary,
    IReadOnlyList<BackupRestoreKeyQueryResult> KeyQueryResults);

public sealed record BackupRestoreSmokeReport(
    string ReportId,
    string ReleaseId,
    string TenantId,
    string Status,
    string IsolatedSchema,
    BackupRestoreSchemaBackup SchemaBackup,
    BackupRestoreDataBackup DataBackup,
    BackupRestoreSummary RestoreSummary,
    IReadOnlyList<BackupRestoreKeyQueryResult> KeyQueryResults,
    BackupRestoreProjectionRebuildResult ProjectionRebuild,
    IReadOnlyList<BackupRestoreInvariantResult> InvariantResults,
    IReadOnlyList<string> ReleaseGateRefs,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record BackupRestoreSchemaBackup(
    bool Success,
    int TableCount,
    IReadOnlyList<BackupRestoreTableResult> Tables);

public sealed record BackupRestoreDataBackup(
    bool Success,
    int TableCount,
    long TotalRows,
    IReadOnlyList<BackupRestoreTableResult> Tables);

public sealed record BackupRestoreSummary(
    bool Success,
    string IsolatedSchema,
    int RestoredTableCount,
    long RestoredRowCount,
    IReadOnlyList<BackupRestoreTableResult> Tables);

public sealed record BackupRestoreTableResult(
    string SourceSchema,
    string SourceTable,
    string RestoreTable,
    bool SourceExists,
    bool Restored,
    long SourceRowCount,
    long RestoredRowCount,
    IReadOnlyList<BackupRestoreColumnSnapshot> Columns);

public sealed record BackupRestoreColumnSnapshot(
    string ColumnName,
    string DataType,
    bool Nullable);

public sealed record BackupRestoreKeyQueryResult(
    string Key,
    string SourceObject,
    string RestoredObject,
    long SourceCount,
    long RestoredCount,
    bool MatchesSource);

public sealed record BackupRestoreProjectionRebuildResult(
    bool Rebuildable,
    string Status,
    string RebuildId,
    int LensCount,
    int MismatchCount,
    bool DryRun);

public sealed record BackupRestoreInvariantResult(
    string InvariantCheckId,
    string InvariantKey,
    string Status,
    int ViolationCount);
