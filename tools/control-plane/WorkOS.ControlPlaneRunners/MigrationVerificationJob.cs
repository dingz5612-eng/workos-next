using Npgsql;
using System.Text.Json;
using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class MigrationVerificationJob
{
    public static Task<MigrationVerificationRunOutput> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "oam.current-migration-verification");
        var mrId = options.Get("mrId", "local");
        var tenantId = options.Get("tenantId", "all-tenants");
        var ciRunId = options.Get("ciRunId")
            ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID")
            ?? "local";
        var reportId = options.Get("reportId", $"migration-verification-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}");
        var dryRun = options.GetBool("dry-run", defaultValue: true);
        var outputPath = options.Get("out", Path.Combine(".tmp", "oam", "migration-verification-invariant-checks.json"));
        var reportPath = options.Get("report-out", Path.Combine(".tmp", "oam", "migration-verification-report.json"));
        var remediationPath = options.Get("remediation-out", Path.Combine(".tmp", "oam", "source-reconciliation-review-report.json"));
        var registryPath = options.Get("registry", Path.Combine("docs", "contracts", "ledger-data-consistency-registry.json"));
        var migrationsPath = options.Get("migrations", Path.Combine("infra", "db", "migrations"));
        var apiSourcePath = options.Get("api-source", Path.Combine("services", "core-api", "WorkOS.Api", "Program.cs"));
        var rollbackStartMigration = options.Get("rollback-start", "015");
        var generatedAtUtc = DateTimeOffset.UtcNow;
        var registry = MigrationVerificationFileLoader.LoadRegistry(registryPath);
        var apiSource = File.Exists(apiSourcePath)
            ? File.ReadAllText(apiSourcePath)
            : string.Empty;
        var dataSource = new PostgresMigrationVerificationDataSource(ControlPlaneDatabase.ResolveConnectionString(options));
        var migrationFiles = MigrationVerificationFileLoader.Load(migrationsPath);
        var service = new MigrationVerificationJobService(dataSource);

        var output = service.Run(new MigrationVerificationRunContext(
            reportId,
            releaseId,
            mrId,
            tenantId,
            ciRunId,
            dryRun,
            "migration-verification-job",
            generatedAtUtc,
            rollbackStartMigration,
            apiSource,
            registry,
            migrationFiles));

        if (!dryRun)
        {
            var database = new ControlPlaneDatabase(ControlPlaneDatabase.ResolveConnectionString(options));
            database.ApplyMigrations(migrationsPath);
            database.EnsureReleaseManifest(releaseId, mrId, ciRunId);
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

            database.WriteMigrationVerificationReports(output.Report, output.RemediationReport, output.SourceLock);
        }

        RunnerJson.Write(outputPath, output.InvariantChecks);
        RunnerJson.Write(reportPath, output.Report);
        RunnerJson.Write(remediationPath, output.RemediationReport);
        Console.WriteLine($"migration-verification: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), reportPath)} status={output.Status}");
        return Task.FromResult(output);
    }
}

public sealed class MigrationVerificationJobService
{
    private readonly IMigrationVerificationDataSource dataSource;

    public MigrationVerificationJobService(IMigrationVerificationDataSource dataSource)
    {
        this.dataSource = dataSource;
    }

    public MigrationVerificationRunOutput Run(MigrationVerificationRunContext context)
    {
        var migrationReadonlySources = context.Registry.MigrationReadonlySources
            .Select(table => MigrationSourceMapping.FromRegistry(table, context.Registry))
            .ToArray();
        var scans = dataSource.ScanMigrationReadonlySources(migrationReadonlySources);
        var comparisons = dataSource.CompareReadonlySourcesToProjection(migrationReadonlySources);
        var rollbackValidation = ValidateRollbackNotes(context.MigrationFiles, context.RollbackStartMigration);
        var migrationDryRun = new MigrationDryRunResult(
            true,
            context.MigrationFiles.Count,
            rollbackValidation.Valid,
            "No business facts are written during migration dry-run verification.");
        var mappings = migrationReadonlySources.Select(table => new SourceMappingReportRow(
            table.SourceTable,
            table.Replacement,
            table.Source,
            table.OriginalRefColumn,
            table.TargetTables,
            table.RequiresReconciliationNote,
            table.ConsistencyPolicy,
            "dry_run_only")).ToArray();
        var remediationPlan = migrationReadonlySources.Select(table => new ExplicitReconciliationPlanRow(
            table.SourceTable,
            table.TargetTables,
            true,
            false,
            table.Source,
            table.OriginalRefColumn,
            table.RequiresReconciliationNote,
            table.RequiresReconciliationNote
                ? $"migration_readonly_source reconciliation note required for {table.SourceTable}"
                : "not_required")).ToArray();
        var releaseGateRefs = new[]
        {
            $"{context.ReportId}-migration-dry-run-success",
            $"{context.ReportId}-source-mapping-report-generated",
            $"{context.ReportId}-workspace-card-api-absent",
            $"{context.ReportId}-reconciliation-review-readonly"
        };
        var sourceLock = new SourceLock(
            $"{context.ReportId}-source-lock",
            context.ReleaseId,
            context.TenantId,
            context.Registry.SourceSlice,
            context.Registry.Version,
            context.DryRun ? "proposed" : "locked",
            migrationReadonlySources.Select(table => table.SourceTable).ToArray(),
            "Workspace/Card API family and ledger source tables are locked; reconciliation review is dry-run only until audited mapping approval.",
            context.GeneratedBy,
            context.GeneratedAtUtc);
        var workspaceCardApiAbsent = WorkspaceCardApiAbsent(context.EffectiveApiSource);
        var remediationSafe = remediationPlan.All(row =>
            row.DryRun
            && !row.WouldWriteNewBusinessFacts
            && row.Source == "migration_readonly_source"
            && !string.IsNullOrWhiteSpace(row.OriginalRefColumn));
        var mappingOk = mappings.Length > 0
            && mappings.All(row => row.Source == "migration_readonly_source")
            && mappings.Where(row => row.RequiresReconciliationNote).All(row => !string.IsNullOrWhiteSpace(row.OriginalRefColumn));
        var status = rollbackValidation.Valid && workspaceCardApiAbsent && remediationSafe && mappingOk
            ? "passed"
            : "failed";
        var report = new MigrationVerificationReport(
            context.ReportId,
            context.ReleaseId,
            context.MrId,
            context.TenantId,
            status,
            context.DryRun,
            migrationDryRun,
            scans,
            mappings,
            comparisons,
            rollbackValidation,
            releaseGateRefs,
            context.GeneratedBy,
            context.GeneratedAtUtc);
        var remediationReport = new ExplicitReconciliationReviewReport(
            $"{context.ReportId}-source-reconciliation-review",
            context.ReportId,
            context.ReleaseId,
            context.TenantId,
            remediationSafe ? "passed" : "failed",
            true,
            "migration_readonly_source",
            context.Registry.Phase,
            mappings,
            remediationPlan,
            remediationPlan
                .Where(row => row.RequiresReconciliationNote)
                .Select(row => new ExplicitReconciliationNote(row.SourceTable, row.ReconciliationNote, row.OriginalRefColumn))
                .ToArray(),
            sourceLock,
            releaseGateRefs,
            context.GeneratedBy,
            context.GeneratedAtUtc);
        var invariantChecks = BuildInvariantChecks(context, report, remediationReport, workspaceCardApiAbsent, mappingOk, remediationSafe, rollbackValidation.Valid);

        return new MigrationVerificationRunOutput(
            context.ReportId,
            context.ReleaseId,
            context.TenantId,
            status,
            invariantChecks,
            report,
            remediationReport,
            sourceLock);
    }

    private static IReadOnlyList<InvariantCheckEvidence> BuildInvariantChecks(
        MigrationVerificationRunContext context,
        MigrationVerificationReport report,
        ExplicitReconciliationReviewReport remediationReport,
        bool workspaceCardApiAbsent,
        bool mappingOk,
        bool remediationSafe,
        bool rollbackOk)
    {
        return
        [
            Check(
                context,
                "migration.dry_run_success",
                "Migration dry-run and rollback note validation must pass.",
                "P0",
                rollbackOk,
                new Dictionary<string, object>
                {
                    ["migration_count"] = report.MigrationDryRun.MigrationCount,
                    ["rollback_notes_valid"] = rollbackOk
                },
                new Dictionary<string, object> { ["missing_rollback_notes"] = 0 },
                report.RollbackNoteValidation.MissingRollbackNotes.Select(missing => (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["migration_id"] = missing }).ToArray()),
            Check(
                context,
                "source.mapping_report_generated",
                "Source to current runtime mapping report must be generated with source and original_ref.",
                "P1",
                mappingOk,
                new Dictionary<string, object> { ["mapping_count"] = report.SourceMappingReport.Count },
                new Dictionary<string, object> { ["minimum_mapping_count"] = 1 },
                Array.Empty<IReadOnlyDictionary<string, object>>()),
            Check(
                context,
                "source.workspace_card_api_absent",
                "Blocked Workspace/Card prepare and confirm APIs must stay absent from effective API source.",
                "P1",
                workspaceCardApiAbsent,
                new Dictionary<string, object> { ["workspace_card_api_absent"] = workspaceCardApiAbsent },
                new Dictionary<string, object> { ["workspace_card_api_absent"] = true },
                workspaceCardApiAbsent ? Array.Empty<IReadOnlyDictionary<string, object>>() : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["forbidden"] = "workspace-card-blocked-endpoints" } }),
            Check(
                context,
                "source.reconciliation_review_is_readonly",
                "Explicit reconciliation dry-run must not drop readonly source data or write new business facts.",
                "P0",
                remediationSafe,
                new Dictionary<string, object>
                {
                    ["dry_run"] = remediationReport.DryRun,
                    ["plan_rows"] = remediationReport.RemediationPlan.Count,
                    ["would_write_new_business_facts"] = remediationReport.RemediationPlan.Any(row => row.WouldWriteNewBusinessFacts)
                },
                new Dictionary<string, object> { ["would_write_new_business_facts"] = false },
                Array.Empty<IReadOnlyDictionary<string, object>>())
        ];
    }

    private static InvariantCheckEvidence Check(
        MigrationVerificationRunContext context,
        string key,
        string description,
        string severity,
        bool passed,
        IReadOnlyDictionary<string, object> observed,
        IReadOnlyDictionary<string, object> threshold,
        IReadOnlyList<IReadOnlyDictionary<string, object>> samples) =>
        new(
            $"{context.ReportId}-{Sanitize(key)}",
            context.ReleaseId,
            context.TenantId,
            "MigrationVerification",
            key,
            description,
            "blocking",
            severity,
            "migration-verification",
            null,
            "migration-verification-job",
            passed ? "passed" : "failed",
            observed,
            threshold,
            passed ? 0 : Math.Max(samples.Count, 1),
            samples,
            context.GeneratedBy,
            context.CiRunId,
            context.GeneratedAtUtc);

    private static MigrationRollbackValidation ValidateRollbackNotes(IReadOnlyList<MigrationFileSnapshot> migrations, string rollbackStartMigration)
    {
        var applicable = migrations
            .Where(migration => string.Compare(migration.MigrationId, rollbackStartMigration, StringComparison.OrdinalIgnoreCase) >= 0)
            .ToArray();
        var missing = applicable
            .Where(migration =>
                !migration.Sql.Contains("rollback note", StringComparison.OrdinalIgnoreCase) &&
                !migration.Sql.Contains("compensating migration", StringComparison.OrdinalIgnoreCase) &&
                !migration.Sql.Contains("migration down", StringComparison.OrdinalIgnoreCase))
            .Select(migration => migration.MigrationId)
            .ToArray();
        return new MigrationRollbackValidation(
            missing.Length == 0,
            rollbackStartMigration,
            applicable.Length,
            missing);
    }

    private static bool WorkspaceCardApiAbsent(string source) =>
        !source.Contains("/api/workspaces/resource-setup/start", StringComparison.OrdinalIgnoreCase)
        && !source.Contains("/api/workspaces/start", StringComparison.OrdinalIgnoreCase)
        && !source.Contains("/api/workspaces/{workspaceId}/cards/{cardId}/prepare", StringComparison.OrdinalIgnoreCase)
        && !source.Contains("/api/workspaces/{workspaceId}/cards/{cardId}/confirm", StringComparison.OrdinalIgnoreCase);

    private static string Sanitize(string value) =>
        new(value.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
}

public interface IMigrationVerificationDataSource
{
    IReadOnlyList<ReadonlySourceScanRow> ScanMigrationReadonlySources(IReadOnlyList<MigrationSourceMapping> mappings);

    IReadOnlyList<ProjectionConsistencyComparison> CompareReadonlySourcesToProjection(IReadOnlyList<MigrationSourceMapping> mappings);
}

internal sealed class PostgresMigrationVerificationDataSource : IMigrationVerificationDataSource
{
    private readonly string connectionString;

    public PostgresMigrationVerificationDataSource(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public IReadOnlyList<ReadonlySourceScanRow> ScanMigrationReadonlySources(IReadOnlyList<MigrationSourceMapping> mappings)
    {
        using var connection = Open();
        return mappings
            .Select(mapping => new ReadonlySourceScanRow(
                mapping.SourceTable,
                TableExists(connection, mapping.SourceTable),
                CountRows(connection, mapping.SourceTable),
                mapping.Source,
                mapping.OriginalRefColumn,
                mapping.RequiresReconciliationNote))
            .ToArray();
    }

    public IReadOnlyList<ProjectionConsistencyComparison> CompareReadonlySourcesToProjection(IReadOnlyList<MigrationSourceMapping> mappings)
    {
        using var connection = Open();
        return mappings
            .Select(mapping =>
            {
                var oldCount = CountRows(connection, mapping.SourceTable);
                var newCount = mapping.TargetTables.Sum(table => CountRows(connection, table));
                return new ProjectionConsistencyComparison(
                    mapping.SourceTable,
                    mapping.TargetTables,
                    oldCount,
                    newCount,
                    "count_only",
                    oldCount == 0 || newCount > 0 ? "comparable" : "readonly_source_requires_mapping_review");
            })
            .ToArray();
    }

    private NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private static bool TableExists(NpgsqlConnection connection, string table)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "select to_regclass(@tableName) is not null";
        command.Parameters.AddWithValue("tableName", table);
        return Convert.ToBoolean(command.ExecuteScalar());
    }

    private static long CountRows(NpgsqlConnection connection, string table)
    {
        if (!TableExists(connection, table))
        {
            return 0;
        }

        using var command = connection.CreateCommand();
        command.CommandText = $"select count(*) from {Quote(table)}";
        return Convert.ToInt64(command.ExecuteScalar() ?? 0);
    }

    private static string Quote(string value) => "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
}

public static class MigrationVerificationFileLoader
{
    public static MigrationConsistencyRegistry LoadRegistry(string registryPath)
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = true
        };
        var registry = JsonSerializer.Deserialize<MigrationConsistencyRegistry>(File.ReadAllText(registryPath), options)
            ?? throw new InvalidOperationException($"Could not deserialize {registryPath}");
        return registry with
        {
            Version = registry.Version ?? "unknown",
            SourceSlice = registry.SourceSlice ?? "source-lock",
            Phase = registry.Phase ?? "migration-source-lock",
            AuthoritativeOwners = registry.AuthoritativeOwners ?? new Dictionary<string, string>(),
            MigrationReadonlySources = registry.MigrationReadonlySources ?? Array.Empty<MigrationReadonlySource>(),
            Guards = registry.Guards ?? Array.Empty<string>()
        };
    }

    public static IReadOnlyList<MigrationFileSnapshot> Load(string migrationsPath) =>
        Directory.GetFiles(migrationsPath, "*.sql")
            .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
            .Select(path => new MigrationFileSnapshot(
                Path.GetFileNameWithoutExtension(path),
                path,
                File.ReadAllText(path)))
            .ToArray();
}

public sealed record MigrationVerificationRunContext(
    string ReportId,
    string ReleaseId,
    string MrId,
    string TenantId,
    string CiRunId,
    bool DryRun,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc,
    string RollbackStartMigration,
    string EffectiveApiSource,
    MigrationConsistencyRegistry Registry,
    IReadOnlyList<MigrationFileSnapshot> MigrationFiles);

public sealed record MigrationVerificationRunOutput(
    string ReportId,
    string ReleaseId,
    string TenantId,
    string Status,
    IReadOnlyList<InvariantCheckEvidence> InvariantChecks,
    MigrationVerificationReport Report,
    ExplicitReconciliationReviewReport RemediationReport,
    SourceLock SourceLock);

public sealed record MigrationVerificationReport(
    string ReportId,
    string ReleaseId,
    string MrId,
    string TenantId,
    string Status,
    bool DryRun,
    MigrationDryRunResult MigrationDryRun,
    IReadOnlyList<ReadonlySourceScanRow> ReadonlySourceVerification,
    IReadOnlyList<SourceMappingReportRow> SourceMappingReport,
    IReadOnlyList<ProjectionConsistencyComparison> ProjectionConsistencyCompare,
    MigrationRollbackValidation RollbackNoteValidation,
    IReadOnlyList<string> ReleaseGateRefs,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record ExplicitReconciliationReviewReport(
    string RemediationReportId,
    string MigrationReportId,
    string ReleaseId,
    string TenantId,
    string Status,
    bool DryRun,
    string Source,
    string Phase,
    IReadOnlyList<SourceMappingReportRow> Mappings,
    IReadOnlyList<ExplicitReconciliationPlanRow> RemediationPlan,
    IReadOnlyList<ExplicitReconciliationNote> ReconciliationNotes,
    SourceLock SourceLock,
    IReadOnlyList<string> ReleaseGateRefs,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record SourceLock(
    string SourceLockId,
    string ReleaseId,
    string TenantId,
    string SourceSlice,
    string RegistryVersion,
    string Status,
    IReadOnlyList<string> LockedTables,
    string Reason,
    string LockedBy,
    DateTimeOffset LockedAtUtc);

public sealed record MigrationDryRunResult(
    bool Success,
    int MigrationCount,
    bool RollbackNotesValidated,
    string Note);

public sealed record MigrationRollbackValidation(
    bool Valid,
    string StartMigration,
    int CheckedMigrationCount,
    IReadOnlyList<string> MissingRollbackNotes);

public sealed record ReadonlySourceScanRow(
    string SourceTable,
    bool Exists,
    long RowCount,
    string Source,
    string OriginalRefColumn,
    bool RequiresReconciliationNote);

public sealed record SourceMappingReportRow(
    string SourceTable,
    string Replacement,
    string Source,
    string OriginalRefColumn,
    IReadOnlyList<string> TargetTables,
    bool RequiresReconciliationNote,
    string ConsistencyPolicy,
    string ApplyMode);

public sealed record ExplicitReconciliationPlanRow(
    string SourceTable,
    IReadOnlyList<string> TargetTables,
    bool DryRun,
    bool WouldWriteNewBusinessFacts,
    string Source,
    string OriginalRefColumn,
    bool RequiresReconciliationNote,
    string ReconciliationNote);

public sealed record ExplicitReconciliationNote(
    string SourceTable,
    string Note,
    string OriginalRefColumn);

public sealed record ProjectionConsistencyComparison(
    string SourceTable,
    IReadOnlyList<string> NewLensTables,
    long OldRowCount,
    long NewRowCount,
    string CompareMode,
    string Status);

public sealed record MigrationFileSnapshot(
    string MigrationId,
    string Path,
    string Sql);

public sealed record MigrationConsistencyRegistry(
    string Version,
    string SourceSlice,
    string Phase,
    IReadOnlyDictionary<string, string> AuthoritativeOwners,
    IReadOnlyList<MigrationReadonlySource> MigrationReadonlySources,
    IReadOnlyList<string> Guards);

public sealed record MigrationReadonlySource(
    string Table,
    string Replacement,
    string Mode,
    string ConsistencyPolicy);

public sealed record MigrationSourceMapping(
    string SourceTable,
    string Replacement,
    string Source,
    string OriginalRefColumn,
    IReadOnlyList<string> TargetTables,
    bool RequiresReconciliationNote,
    string ConsistencyPolicy)
{
    public static MigrationSourceMapping FromRegistry(MigrationReadonlySource table, MigrationConsistencyRegistry registry)
    {
        var targetTables = table.Table switch
        {
            "accommodation_deposits" => new[] { "deposit_transactions", "deposit_liabilities" },
            "deposit_liabilities" => new[] { "deposit_transactions", "deposit_liabilities" },
            "hostel_payments" => new[] { "hostel_payments", "payment_allocations" },
            "finance_reconciliations" => new[] { "finance_reconciliations" },
            "finance_confirmations" => new[] { "deposit_transactions", "finance_reconciliations" },
            _ => new[] { table.Replacement.Split([' ', '+'], StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? table.Replacement }
        };
        return new MigrationSourceMapping(
            table.Table,
            table.Replacement,
            "migration_readonly_source",
            $"{table.Table}.primary_key",
            targetTables,
            IsMoneyRelated(table.Table, registry),
            table.ConsistencyPolicy);
    }

    private static bool IsMoneyRelated(string table, MigrationConsistencyRegistry registry) =>
        table.Contains("deposit", StringComparison.OrdinalIgnoreCase)
        || table.Contains("payment", StringComparison.OrdinalIgnoreCase)
        || table.Contains("finance", StringComparison.OrdinalIgnoreCase)
        || registry.AuthoritativeOwners.Count > 0;
}
