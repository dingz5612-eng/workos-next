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
        AcquireMigrationLock(connection);
        try
        {
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
        finally
        {
            ReleaseMigrationLock(connection);
        }
    }

    private static void AcquireMigrationLock(NpgsqlConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "select pg_advisory_lock(hashtext('workosnext_runtime_migrations'))";
        command.ExecuteNonQuery();
    }

    private static void ReleaseMigrationLock(NpgsqlConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "select pg_advisory_unlock(hashtext('workosnext_runtime_migrations'))";
        command.ExecuteNonQuery();
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
                @releaseId, @mrId, 'OAM current control plane runner', 'planned',
                '["platform"]'::jsonb, @commitSha, '015_control_plane_shadow_runtime',
                'oam.current', 'not-set', @ciRunId, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
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

    public bool ColumnExists(string schema, string table, string column)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select 1
            from information_schema.columns
            where table_schema = @schema and table_name = @table and column_name = @column
            """;
        command.Parameters.AddWithValue("schema", schema);
        command.Parameters.AddWithValue("table", table);
        command.Parameters.AddWithValue("column", column);
        return command.ExecuteScalar() is not null;
    }

    public SqlInvariantResult ProjectionCheckpointShadowNamespaceCheck()
    {
        return ExecuteInvariantSql("""
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'projection_checkpoints_exists', true,
                    'source_namespace_column_exists', true,
                    'source_namespace_shadow_runtime_count', count(*)
                ) as observed_value,
                jsonb_build_object(
                    'forbidden_source_namespace', 'shadow_runtime',
                    'max_shadow_runtime_checkpoint_rows', 0
                ) as threshold,
                coalesce(
                    jsonb_agg(
                        jsonb_build_object(
                            'checkpoint_id', checkpoint_id,
                            'tenant_id', tenant_id,
                            'lens_name', lens_name,
                            'source_namespace', source_namespace
                        )
                        order by created_at_utc desc
                    ),
                    '[]'::jsonb
                ) as sample_violations
            from projection_checkpoints
            where source_namespace = 'shadow_runtime'
            """);
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

    public SqlInvariantResult ShadowLedgerOfficialContaminationCheck(IReadOnlyList<string> officialLedgerTables)
    {
        if (!TableExists("shadow_runtime", "ledger_entries"))
        {
            return new SqlInvariantResult(
                1,
                new Dictionary<string, object> { ["shadow_ledger_entries_exists"] = false },
                new Dictionary<string, object> { ["shadow_ledger_entries_exists"] = true },
                new[]
                {
                    (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
                    {
                        ["missing_table"] = "shadow_runtime.ledger_entries"
                    }
                });
        }

        var checkedTables = new List<string>();
        var skippedTables = new List<string>();
        var samples = new List<IReadOnlyDictionary<string, object>>();
        long contaminatedRows = 0;

        foreach (var tableRef in officialLedgerTables.Select(ParseRelation).Distinct())
        {
            if (!TableExists(tableRef.Schema, tableRef.Table))
            {
                skippedTables.Add(tableRef.ToString());
                continue;
            }

            checkedTables.Add(tableRef.ToString());
            using var connection = Open();
            using (var count = connection.CreateCommand())
            {
                count.CommandText = $"""
                    select count(*)::bigint
                    from {Quote(tableRef.Schema)}.{Quote(tableRef.Table)} official
                    join shadow_runtime.ledger_entries shadow
                      on to_jsonb(official)::text like '%' || shadow.shadow_ledger_entry_id || '%'
                    """;
                contaminatedRows += Convert.ToInt64(count.ExecuteScalar());
            }

            using var sample = connection.CreateCommand();
            sample.CommandText = $"""
                select
                    shadow.shadow_ledger_entry_id,
                    shadow.command_submission_id
                from {Quote(tableRef.Schema)}.{Quote(tableRef.Table)} official
                join shadow_runtime.ledger_entries shadow
                  on to_jsonb(official)::text like '%' || shadow.shadow_ledger_entry_id || '%'
                limit 5
                """;
            using var reader = sample.ExecuteReader();
            while (reader.Read())
            {
                samples.Add(new Dictionary<string, object>
                {
                    ["official_table"] = tableRef.ToString(),
                    ["shadow_ledger_entry_id"] = reader.GetString(0),
                    ["command_submission_id"] = reader.GetString(1)
                });
            }
        }

        return new SqlInvariantResult(
            ToViolationCount(contaminatedRows),
            new Dictionary<string, object>
            {
                ["checked_tables"] = checkedTables,
                ["skipped_missing_tables"] = skippedTables,
                ["contaminated_rows"] = contaminatedRows
            },
            new Dictionary<string, object>
            {
                ["max_shadow_ledger_entries_in_official_tables"] = 0
            },
            samples);
    }

    public SqlInvariantResult ShadowDomainEventOfficialContaminationCheck()
    {
        if (!TableExists("shadow_runtime", "domain_events"))
        {
            return new SqlInvariantResult(
                1,
                new Dictionary<string, object> { ["shadow_domain_events_exists"] = false },
                new Dictionary<string, object> { ["shadow_domain_events_exists"] = true },
                new[]
                {
                    (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
                    {
                        ["missing_table"] = "shadow_runtime.domain_events"
                    }
                });
        }

        if (!TableExists("public", "domain_events"))
        {
            return new SqlInvariantResult(
                0,
                new Dictionary<string, object>
                {
                    ["official_domain_events_exists"] = false,
                    ["contaminated_rows"] = 0
                },
                new Dictionary<string, object>
                {
                    ["max_shadow_domain_events_in_official_tables"] = 0
                },
                []);
        }

        using var connection = Open();
        using var count = connection.CreateCommand();
        count.CommandText = """
            select count(*)::bigint
            from public.domain_events official
            join shadow_runtime.domain_events shadow
              on to_jsonb(official)::text like '%' || shadow.shadow_event_id || '%'
            """;
        var contaminatedRows = Convert.ToInt64(count.ExecuteScalar());

        var samples = new List<IReadOnlyDictionary<string, object>>();
        using var sample = connection.CreateCommand();
        sample.CommandText = """
            select
                shadow.shadow_event_id,
                shadow.command_submission_id,
                shadow.event_type
            from public.domain_events official
            join shadow_runtime.domain_events shadow
              on to_jsonb(official)::text like '%' || shadow.shadow_event_id || '%'
            limit 5
            """;
        using var reader = sample.ExecuteReader();
        while (reader.Read())
        {
            samples.Add(new Dictionary<string, object>
            {
                ["official_table"] = "public.domain_events",
                ["shadow_event_id"] = reader.GetString(0),
                ["command_submission_id"] = reader.GetString(1),
                ["event_type"] = reader.GetString(2)
            });
        }

        return new SqlInvariantResult(
            ToViolationCount(contaminatedRows),
            new Dictionary<string, object>
            {
                ["official_domain_events_exists"] = true,
                ["contaminated_rows"] = contaminatedRows
            },
            new Dictionary<string, object>
            {
                ["max_shadow_domain_events_in_official_tables"] = 0
            },
            samples);
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
        ExplicitReconciliationReviewReport remediationReport,
        SourceLock sourceLock)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                insert into control_plane.migration_verification_reports(
                    report_id, release_id, tenant_id, status, dry_run, migration_dry_run,
                    readonly_source_verification, source_mapping_report, projection_consistency_compare,
                    rollback_note_validation, release_gate_refs, generated_by, generated_at_utc)
                values (
                    @reportId, @releaseId, @tenantId, @status, @dryRun, @migrationDryRun::jsonb,
                    @readonlySourceVerification::jsonb, @sourceMappingReport::jsonb, @projectionConsistencyCompare::jsonb,
                    @rollbackNoteValidation::jsonb, @releaseGateRefs::jsonb, @generatedBy, @generatedAtUtc)
                on conflict(report_id) do update set
                    status = excluded.status,
                    dry_run = excluded.dry_run,
                    migration_dry_run = excluded.migration_dry_run,
                    readonly_source_verification = excluded.readonly_source_verification,
                    source_mapping_report = excluded.source_mapping_report,
                    projection_consistency_compare = excluded.projection_consistency_compare,
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
            command.Parameters.AddWithValue("readonlySourceVerification", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.ReadonlySourceVerification, RunnerJson.Options));
            command.Parameters.AddWithValue("sourceMappingReport", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.SourceMappingReport, RunnerJson.Options));
            command.Parameters.AddWithValue("projectionConsistencyCompare", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(report.ProjectionConsistencyCompare, RunnerJson.Options));
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
                insert into control_plane.explicit_reconciliation_review_reports(
                    remediation_report_id, migration_report_id, release_id, tenant_id, status,
                    dry_run, source, phase, mappings, remediation_plan, reconciliation_notes,
                    source_lock, release_gate_refs, generated_by, generated_at_utc)
                values (
                    @remediationReportId, @migrationReportId, @releaseId, @tenantId, @status,
                    @dryRun, @source, @phase, @mappings::jsonb, @remediationPlan::jsonb,
                    @reconciliationNotes::jsonb, @sourceLock::jsonb, @releaseGateRefs::jsonb,
                    @generatedBy, @generatedAtUtc)
                on conflict(remediation_report_id) do update set
                    status = excluded.status,
                    dry_run = excluded.dry_run,
                    mappings = excluded.mappings,
                    remediation_plan = excluded.remediation_plan,
                    reconciliation_notes = excluded.reconciliation_notes,
                    source_lock = excluded.source_lock,
                    release_gate_refs = excluded.release_gate_refs,
                    generated_by = excluded.generated_by,
                    generated_at_utc = excluded.generated_at_utc
                """;
            command.Parameters.AddWithValue("remediationReportId", remediationReport.RemediationReportId);
            command.Parameters.AddWithValue("migrationReportId", remediationReport.MigrationReportId);
            command.Parameters.AddWithValue("releaseId", remediationReport.ReleaseId);
            command.Parameters.AddWithValue("tenantId", remediationReport.TenantId);
            command.Parameters.AddWithValue("status", remediationReport.Status);
            command.Parameters.AddWithValue("dryRun", remediationReport.DryRun);
            command.Parameters.AddWithValue("source", remediationReport.Source);
            command.Parameters.AddWithValue("phase", remediationReport.Phase);
            command.Parameters.AddWithValue("mappings", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(remediationReport.Mappings, RunnerJson.Options));
            command.Parameters.AddWithValue("remediationPlan", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(remediationReport.RemediationPlan, RunnerJson.Options));
            command.Parameters.AddWithValue("reconciliationNotes", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(remediationReport.ReconciliationNotes, RunnerJson.Options));
            command.Parameters.AddWithValue("sourceLock", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(remediationReport.SourceLock, RunnerJson.Options));
            command.Parameters.AddWithValue("releaseGateRefs", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(remediationReport.ReleaseGateRefs, RunnerJson.Options));
            command.Parameters.AddWithValue("generatedBy", remediationReport.GeneratedBy);
            command.Parameters.AddWithValue("generatedAtUtc", remediationReport.GeneratedAtUtc);
            command.ExecuteNonQuery();
        }

        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                insert into control_plane.source_locks(
                    source_lock_id, release_id, tenant_id, source_slice, registry_version,
                    status, locked_tables, reason, locked_by, locked_at_utc)
                values (
                    @sourceLockId, @releaseId, @tenantId, @sourceSlice, @registryVersion,
                    @status, @lockedTables::jsonb, @reason, @lockedBy, @lockedAtUtc)
                on conflict(source_lock_id) do update set
                    status = excluded.status,
                    locked_tables = excluded.locked_tables,
                    reason = excluded.reason,
                    locked_by = excluded.locked_by,
                    locked_at_utc = excluded.locked_at_utc
                """;
            command.Parameters.AddWithValue("sourceLockId", sourceLock.SourceLockId);
            command.Parameters.AddWithValue("releaseId", sourceLock.ReleaseId);
            command.Parameters.AddWithValue("tenantId", sourceLock.TenantId);
            command.Parameters.AddWithValue("sourceSlice", sourceLock.SourceSlice);
            command.Parameters.AddWithValue("registryVersion", sourceLock.RegistryVersion);
            command.Parameters.AddWithValue("status", sourceLock.Status);
            command.Parameters.AddWithValue("lockedTables", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(sourceLock.LockedTables, RunnerJson.Options));
            command.Parameters.AddWithValue("reason", sourceLock.Reason);
            command.Parameters.AddWithValue("lockedBy", sourceLock.LockedBy);
            command.Parameters.AddWithValue("lockedAtUtc", sourceLock.LockedAtUtc);
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

    private static DatabaseRelation ParseRelation(string value)
    {
        var parts = value.Split('.', 2);
        return parts.Length == 2
            ? new DatabaseRelation(parts[0], parts[1])
            : new DatabaseRelation("public", value);
    }

    private static int ToViolationCount(long value) =>
        value > int.MaxValue ? int.MaxValue : Convert.ToInt32(value);

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

internal sealed record DatabaseRelation(string Schema, string Table)
{
    public override string ToString() => $"{Schema}.{Table}";
}

public sealed record SqlInvariantResult(
    int ViolationCount,
    IReadOnlyDictionary<string, object> ObservedValue,
    IReadOnlyDictionary<string, object> Threshold,
    IReadOnlyList<IReadOnlyDictionary<string, object>> SampleViolations);
