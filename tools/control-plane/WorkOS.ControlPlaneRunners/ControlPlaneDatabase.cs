using Npgsql;
using NpgsqlTypes;
using System.Text.Json;

namespace WorkOS.ControlPlaneRunners;

public sealed class ControlPlaneDatabase : ILedgerInspectionInvariantEvaluator
{
    private readonly string connectionString;

    public ControlPlaneDatabase(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public string ConnectionString => connectionString;

    public static string ResolveConnectionString(RunnerOptions options)
    {
        return options.Get("connection")
            ?? Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__WorkOSRuntime")
            ?? "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";
    }

    public void ApplyMigrations(string migrationsPath)
    {
        using var connection = Open();
        using var bootstrap = connection.CreateCommand();
        bootstrap.CommandText = """
            create table if not exists schema_migrations (
                migration_id text primary key,
                applied_at_utc timestamptz not null
            );
            """;
        bootstrap.ExecuteNonQuery();

        foreach (var file in Directory.GetFiles(migrationsPath, "*.sql").OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase))
        {
            var migrationId = Path.GetFileNameWithoutExtension(file);
            using var exists = connection.CreateCommand();
            exists.CommandText = "select 1 from schema_migrations where migration_id = @migrationId";
            exists.Parameters.AddWithValue("migrationId", migrationId);
            if (exists.ExecuteScalar() is not null)
            {
                continue;
            }

            using var transaction = connection.BeginTransaction();
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = File.ReadAllText(file);
            command.ExecuteNonQuery();

            using var insert = connection.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = "insert into schema_migrations(migration_id, applied_at_utc) values (@migrationId, @appliedAtUtc)";
            insert.Parameters.AddWithValue("migrationId", migrationId);
            insert.Parameters.AddWithValue("appliedAtUtc", DateTimeOffset.UtcNow);
            insert.ExecuteNonQuery();
            transaction.Commit();
        }
    }

    public void EnsureReleaseManifest(string releaseId, string mrId, string ciRunId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into control_plane.release_manifests(
                release_id, mr_id, release_name, status, owners, commit_sha,
                migration_version, definition_version, api_schema_hash, ci_run_id,
                feature_flag_ids, slice_cutover_state_ids, shadow_compare_report_ids,
                invariant_check_ids, acceptance_scenarios, go_criteria, no_go_criteria,
                known_risks)
            values(
                @releaseId, @mrId, 'V5.4 control plane runner', 'planned',
                '["platform"]'::jsonb, @commitSha, '015_control_plane_shadow_runtime',
                'v5.4', 'not-set', @ciRunId, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                '[]'::jsonb, '["runner executed"]'::jsonb, '["automated guard evidence exists"]'::jsonb,
                '["P0 blocked"]'::jsonb, '["minimal runner"]'::jsonb)
            on conflict(release_id) do nothing
            """;
        command.Parameters.AddWithValue("releaseId", releaseId);
        command.Parameters.AddWithValue("mrId", mrId);
        command.Parameters.AddWithValue("commitSha", Environment.GetEnvironmentVariable("GITHUB_SHA") ?? "local");
        command.Parameters.AddWithValue("ciRunId", ciRunId);
        command.ExecuteNonQuery();
    }

    public bool TableExists(string schema, string table)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select 1
            from information_schema.tables
            where table_schema = @schema and table_name = @table
            """;
        command.Parameters.AddWithValue("schema", schema);
        command.Parameters.AddWithValue("table", table);
        return command.ExecuteScalar() is not null;
    }

    public long CountRows(string schema, string table)
    {
        if (!TableExists(schema, table))
        {
            throw new InvalidOperationException($"{schema}.{table} does not exist");
        }

        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"select count(*) from {Quote(schema)}.{Quote(table)}";
        return Convert.ToInt64(command.ExecuteScalar());
    }

    public SqlInvariantResult ExecuteInvariantSql(string sql)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return new SqlInvariantResult(1, new Dictionary<string, object> { ["rows"] = 0 }, new Dictionary<string, object>(), []);
        }

        var violationCount = GetInt(reader, "violation_count") ?? Convert.ToInt32(reader.GetValue(0));
        var observed = GetJsonOrScalar(reader, "observed_value", "value");
        var threshold = GetJsonOrScalar(reader, "threshold");
        var samples = GetJsonArray(reader, "sample_violations");
        return new SqlInvariantResult(violationCount, observed, threshold, samples);
    }

    public void WriteLedgerInspectionJobReport(
        LedgerInspectionJobReport report,
        LedgerInspectionDashboardSummary dashboardSummary)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into control_plane.ledger_inspection_job_reports(
                job_run_id, release_id, tenant_id, job_mode, status, ci_run_id,
                invariant_check_ids, report, dashboard_summary, generated_by,
                generated_at_utc)
            values (
                @jobRunId, @releaseId, @tenantId, @jobMode, @status, @ciRunId,
                @invariantCheckIds::jsonb, @report::jsonb, @dashboardSummary::jsonb,
                @generatedBy, @generatedAtUtc)
            on conflict(job_run_id) do update set
                status = excluded.status,
                ci_run_id = excluded.ci_run_id,
                invariant_check_ids = excluded.invariant_check_ids,
                report = excluded.report,
                dashboard_summary = excluded.dashboard_summary,
                generated_by = excluded.generated_by,
                generated_at_utc = excluded.generated_at_utc
            """;
        command.Parameters.AddWithValue("jobRunId", report.JobRunId);
        command.Parameters.AddWithValue("releaseId", report.ReleaseId);
        command.Parameters.AddWithValue("tenantId", report.TenantId);
        command.Parameters.AddWithValue("jobMode", report.JobMode);
        command.Parameters.AddWithValue("status", report.Status);
        command.Parameters.AddWithValue("ciRunId", (object?)report.CiRunId ?? DBNull.Value);
        command.Parameters.AddWithValue("invariantCheckIds", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.InvariantCheckIds, RunnerJson.Options));
        command.Parameters.AddWithValue("report", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report, RunnerJson.Options));
        command.Parameters.AddWithValue("dashboardSummary", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(dashboardSummary, RunnerJson.Options));
        command.Parameters.AddWithValue("generatedBy", report.GeneratedBy);
        command.Parameters.AddWithValue("generatedAtUtc", report.GeneratedAtUtc);
        command.ExecuteNonQuery();
    }

    public void WriteMigrationVerificationReports(
        MigrationVerificationReport report,
        LegacyBackfillReport backfillReport,
        LegacyCompatibilityFreeze freeze)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                insert into control_plane.migration_verification_reports(
                    report_id, release_id, tenant_id, status, dry_run, migration_dry_run,
                    old_runtime_data_scan, legacy_mapping_report, old_view_new_lens_compare,
                    rollback_note_validation, release_gate_refs, generated_by, generated_at_utc)
                values (
                    @reportId, @releaseId, @tenantId, @status, @dryRun, @migrationDryRun::jsonb,
                    @oldRuntimeDataScan::jsonb, @legacyMappingReport::jsonb, @oldViewNewLensCompare::jsonb,
                    @rollbackNoteValidation::jsonb, @releaseGateRefs::jsonb, @generatedBy, @generatedAtUtc)
                on conflict(report_id) do update set
                    status = excluded.status,
                    dry_run = excluded.dry_run,
                    migration_dry_run = excluded.migration_dry_run,
                    old_runtime_data_scan = excluded.old_runtime_data_scan,
                    legacy_mapping_report = excluded.legacy_mapping_report,
                    old_view_new_lens_compare = excluded.old_view_new_lens_compare,
                    rollback_note_validation = excluded.rollback_note_validation,
                    release_gate_refs = excluded.release_gate_refs,
                    generated_by = excluded.generated_by,
                    generated_at_utc = excluded.generated_at_utc
                """;
            command.Parameters.AddWithValue("reportId", report.ReportId);
            command.Parameters.AddWithValue("releaseId", report.ReleaseId);
            command.Parameters.AddWithValue("tenantId", report.TenantId);
            command.Parameters.AddWithValue("status", report.Status);
            command.Parameters.AddWithValue("dryRun", report.DryRun);
            command.Parameters.AddWithValue("migrationDryRun", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.MigrationDryRun, RunnerJson.Options));
            command.Parameters.AddWithValue("oldRuntimeDataScan", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.OldRuntimeDataScan, RunnerJson.Options));
            command.Parameters.AddWithValue("legacyMappingReport", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.LegacyMappingReport, RunnerJson.Options));
            command.Parameters.AddWithValue("oldViewNewLensCompare", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.OldViewNewLensCompare, RunnerJson.Options));
            command.Parameters.AddWithValue("rollbackNoteValidation", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.RollbackNoteValidation, RunnerJson.Options));
            command.Parameters.AddWithValue("releaseGateRefs", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.ReleaseGateRefs, RunnerJson.Options));
            command.Parameters.AddWithValue("generatedBy", report.GeneratedBy);
            command.Parameters.AddWithValue("generatedAtUtc", report.GeneratedAtUtc);
            command.ExecuteNonQuery();
        }

        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                insert into control_plane.legacy_backfill_reports(
                    backfill_report_id, migration_report_id, release_id, tenant_id, status,
                    dry_run, source, phase, mappings, backfill_plan, reconciliation_notes,
                    compatibility_freeze, release_gate_refs, generated_by, generated_at_utc)
                values (
                    @backfillReportId, @migrationReportId, @releaseId, @tenantId, @status,
                    @dryRun, @source, @phase, @mappings::jsonb, @backfillPlan::jsonb,
                    @reconciliationNotes::jsonb, @compatibilityFreeze::jsonb, @releaseGateRefs::jsonb,
                    @generatedBy, @generatedAtUtc)
                on conflict(backfill_report_id) do update set
                    status = excluded.status,
                    dry_run = excluded.dry_run,
                    mappings = excluded.mappings,
                    backfill_plan = excluded.backfill_plan,
                    reconciliation_notes = excluded.reconciliation_notes,
                    compatibility_freeze = excluded.compatibility_freeze,
                    release_gate_refs = excluded.release_gate_refs,
                    generated_by = excluded.generated_by,
                    generated_at_utc = excluded.generated_at_utc
                """;
            command.Parameters.AddWithValue("backfillReportId", backfillReport.BackfillReportId);
            command.Parameters.AddWithValue("migrationReportId", backfillReport.MigrationReportId);
            command.Parameters.AddWithValue("releaseId", backfillReport.ReleaseId);
            command.Parameters.AddWithValue("tenantId", backfillReport.TenantId);
            command.Parameters.AddWithValue("status", backfillReport.Status);
            command.Parameters.AddWithValue("dryRun", backfillReport.DryRun);
            command.Parameters.AddWithValue("source", backfillReport.Source);
            command.Parameters.AddWithValue("phase", backfillReport.Phase);
            command.Parameters.AddWithValue("mappings", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(backfillReport.Mappings, RunnerJson.Options));
            command.Parameters.AddWithValue("backfillPlan", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(backfillReport.BackfillPlan, RunnerJson.Options));
            command.Parameters.AddWithValue("reconciliationNotes", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(backfillReport.ReconciliationNotes, RunnerJson.Options));
            command.Parameters.AddWithValue("compatibilityFreeze", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(backfillReport.CompatibilityFreeze, RunnerJson.Options));
            command.Parameters.AddWithValue("releaseGateRefs", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(backfillReport.ReleaseGateRefs, RunnerJson.Options));
            command.Parameters.AddWithValue("generatedBy", backfillReport.GeneratedBy);
            command.Parameters.AddWithValue("generatedAtUtc", backfillReport.GeneratedAtUtc);
            command.ExecuteNonQuery();
        }

        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                insert into control_plane.legacy_compatibility_freezes(
                    freeze_id, release_id, tenant_id, source_slice, registry_version,
                    status, frozen_tables, reason, frozen_by, frozen_at_utc)
                values (
                    @freezeId, @releaseId, @tenantId, @sourceSlice, @registryVersion,
                    @status, @frozenTables::jsonb, @reason, @frozenBy, @frozenAtUtc)
                on conflict(freeze_id) do update set
                    status = excluded.status,
                    frozen_tables = excluded.frozen_tables,
                    reason = excluded.reason,
                    frozen_by = excluded.frozen_by,
                    frozen_at_utc = excluded.frozen_at_utc
                """;
            command.Parameters.AddWithValue("freezeId", freeze.FreezeId);
            command.Parameters.AddWithValue("releaseId", freeze.ReleaseId);
            command.Parameters.AddWithValue("tenantId", freeze.TenantId);
            command.Parameters.AddWithValue("sourceSlice", freeze.SourceSlice);
            command.Parameters.AddWithValue("registryVersion", freeze.RegistryVersion);
            command.Parameters.AddWithValue("status", freeze.Status);
            command.Parameters.AddWithValue("frozenTables", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(freeze.FrozenTables, RunnerJson.Options));
            command.Parameters.AddWithValue("reason", freeze.Reason);
            command.Parameters.AddWithValue("frozenBy", freeze.FrozenBy);
            command.Parameters.AddWithValue("frozenAtUtc", freeze.FrozenAtUtc);
            command.ExecuteNonQuery();
        }

        transaction.Commit();
    }

    public void WriteBackupRestoreSmokeReport(BackupRestoreSmokeReport report)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into control_plane.backup_restore_smoke_reports(
                report_id, release_id, tenant_id, status, isolated_schema,
                schema_backup, data_backup, restore_summary, key_query_results,
                projection_rebuild, invariant_results, release_gate_refs,
                generated_by, generated_at_utc)
            values (
                @reportId, @releaseId, @tenantId, @status, @isolatedSchema,
                @schemaBackup::jsonb, @dataBackup::jsonb, @restoreSummary::jsonb,
                @keyQueryResults::jsonb, @projectionRebuild::jsonb,
                @invariantResults::jsonb, @releaseGateRefs::jsonb,
                @generatedBy, @generatedAtUtc)
            on conflict(report_id) do update set
                status = excluded.status,
                isolated_schema = excluded.isolated_schema,
                schema_backup = excluded.schema_backup,
                data_backup = excluded.data_backup,
                restore_summary = excluded.restore_summary,
                key_query_results = excluded.key_query_results,
                projection_rebuild = excluded.projection_rebuild,
                invariant_results = excluded.invariant_results,
                release_gate_refs = excluded.release_gate_refs,
                generated_by = excluded.generated_by,
                generated_at_utc = excluded.generated_at_utc
            """;
        command.Parameters.AddWithValue("reportId", report.ReportId);
        command.Parameters.AddWithValue("releaseId", report.ReleaseId);
        command.Parameters.AddWithValue("tenantId", report.TenantId);
        command.Parameters.AddWithValue("status", report.Status);
        command.Parameters.AddWithValue("isolatedSchema", report.IsolatedSchema);
        command.Parameters.AddWithValue("schemaBackup", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.SchemaBackup, RunnerJson.Options));
        command.Parameters.AddWithValue("dataBackup", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.DataBackup, RunnerJson.Options));
        command.Parameters.AddWithValue("restoreSummary", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.RestoreSummary, RunnerJson.Options));
        command.Parameters.AddWithValue("keyQueryResults", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.KeyQueryResults, RunnerJson.Options));
        command.Parameters.AddWithValue("projectionRebuild", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.ProjectionRebuild, RunnerJson.Options));
        command.Parameters.AddWithValue("invariantResults", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.InvariantResults, RunnerJson.Options));
        command.Parameters.AddWithValue("releaseGateRefs", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.ReleaseGateRefs, RunnerJson.Options));
        command.Parameters.AddWithValue("generatedBy", report.GeneratedBy);
        command.Parameters.AddWithValue("generatedAtUtc", report.GeneratedAtUtc);
        command.ExecuteNonQuery();
    }

    private NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private static string Quote(string value) => "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";

    private static int? GetInt(NpgsqlDataReader reader, string name)
    {
        var ordinal = TryOrdinal(reader, name);
        if (ordinal is null || reader.IsDBNull(ordinal.Value))
        {
            return null;
        }

        return Convert.ToInt32(reader.GetValue(ordinal.Value));
    }

    private static IReadOnlyDictionary<string, object> GetJsonOrScalar(NpgsqlDataReader reader, string jsonColumn, string scalarName = "value")
    {
        var ordinal = TryOrdinal(reader, jsonColumn);
        if (ordinal is null || reader.IsDBNull(ordinal.Value))
        {
            return new Dictionary<string, object>();
        }

        var value = reader.GetValue(ordinal.Value);
        if (value is string text && text.TrimStart().StartsWith('{'))
        {
            return JsonSerializer.Deserialize<Dictionary<string, object>>(text, RunnerJson.Options)
                ?? new Dictionary<string, object>();
        }

        if (value is JsonElement element && element.ValueKind == JsonValueKind.Object)
        {
            return JsonSerializer.Deserialize<Dictionary<string, object>>(element.GetRawText(), RunnerJson.Options)
                ?? new Dictionary<string, object>();
        }

        return new Dictionary<string, object> { [scalarName] = value };
    }

    private static IReadOnlyList<IReadOnlyDictionary<string, object>> GetJsonArray(NpgsqlDataReader reader, string name)
    {
        var ordinal = TryOrdinal(reader, name);
        if (ordinal is null || reader.IsDBNull(ordinal.Value))
        {
            return [];
        }

        var value = Convert.ToString(reader.GetValue(ordinal.Value)) ?? "[]";
        return System.Text.Json.JsonSerializer.Deserialize<List<Dictionary<string, object>>>(value, RunnerJson.Options)
            ?.Cast<IReadOnlyDictionary<string, object>>()
            .ToArray()
            ?? [];
    }

    private static int? TryOrdinal(NpgsqlDataReader reader, string name)
    {
        for (var i = 0; i < reader.FieldCount; i++)
        {
            if (reader.GetName(i).Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                return i;
            }
        }

        return null;
    }

}

public sealed record SqlInvariantResult(
    int ViolationCount,
    IReadOnlyDictionary<string, object> ObservedValue,
    IReadOnlyDictionary<string, object> Threshold,
    IReadOnlyList<IReadOnlyDictionary<string, object>> SampleViolations);
