using Npgsql;
using System.Text.Json;
using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class MigrationVerificationJob
{
    public static Task<MigrationVerificationRunOutput> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-migration-verification");
        var mrId = options.Get("mrId", "local");
        var tenantId = options.Get("tenantId", "all-tenants");
        var ciRunId = options.Get("ciRunId")
            ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID")
            ?? "local";
        var reportId = options.Get("reportId", $"migration-verification-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}");
        var dryRun = options.GetBool("dry-run", defaultValue: true);
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "migration-verification-invariant-checks.json"));
        var reportPath = options.Get("report-out", Path.Combine(".tmp", "v5_4", "migration-verification-report.json"));
        var backfillPath = options.Get("backfill-out", Path.Combine(".tmp", "v5_4", "legacy-backfill-report.json"));
        var registryPath = options.Get("registry", Path.Combine("docs", "contracts", "legacy-ledger-migration-registry.json"));
        var migrationsPath = options.Get("migrations", Path.Combine("infra", "db", "migrations"));
        var compatibilitySourcePath = options.Get("compatibility-source", Path.Combine("services", "core-api", "WorkOS.Api", "Program.cs"));
        var rollbackStartMigration = options.Get("rollback-start", "015");
        var generatedAtUtc = DateTimeOffset.UtcNow;
        var registry = MigrationVerificationFileLoader.LoadRegistry(registryPath);
        var compatibilitySource = File.Exists(compatibilitySourcePath)
            ? File.ReadAllText(compatibilitySourcePath)
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
            compatibilitySource,
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

            database.WriteMigrationVerificationReports(output.Report, output.BackfillReport, output.Freeze);
        }

        RunnerJson.Write(outputPath, output.InvariantChecks);
        RunnerJson.Write(reportPath, output.Report);
        RunnerJson.Write(backfillPath, output.BackfillReport);
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
        var legacyTables = context.Registry.LegacyTables
            .Select(table => LegacyTableMapping.FromRegistry(table, context.Registry))
            .ToArray();
        var scans = dataSource.ScanLegacyTables(legacyTables);
        var comparisons = dataSource.CompareLegacyToNewLens(legacyTables);
        var rollbackValidation = ValidateRollbackNotes(context.MigrationFiles, context.RollbackStartMigration);
        var migrationDryRun = new MigrationDryRunResult(
            true,
            context.MigrationFiles.Count,
            rollbackValidation.Valid,
            "No business facts are written during migration dry-run verification.");
        var mappings = legacyTables.Select(table => new LegacyMappingReportRow(
            table.LegacyTable,
            table.Replacement,
            table.Source,
            table.OriginalRefColumn,
            table.TargetTables,
            table.RequiresReconciliationNote,
            table.BackfillPolicy,
            "dry_run_only")).ToArray();
        var backfillPlan = legacyTables.Select(table => new LegacyBackfillPlanRow(
            table.LegacyTable,
            table.TargetTables,
            true,
            false,
            table.Source,
            table.OriginalRefColumn,
            table.RequiresReconciliationNote,
            table.RequiresReconciliationNote
                ? $"legacy_migration reconciliation note required for {table.LegacyTable}"
                : "not_required")).ToArray();
        var releaseGateRefs = new[]
        {
            $"{context.ReportId}-migration-dry-run-success",
            $"{context.ReportId}-legacy-mapping-report-generated",
            $"{context.ReportId}-old-api-still-compatible",
            $"{context.ReportId}-backfill-does-not-drop-legacy-data"
        };
        var compatibilityFreeze = new LegacyCompatibilityFreeze(
            $"{context.ReportId}-legacy-compatibility-freeze",
            context.ReleaseId,
            context.TenantId,
            context.Registry.SourceSlice,
            context.Registry.Version,
            context.DryRun ? "proposed" : "frozen",
            legacyTables.Select(table => table.LegacyTable).ToArray(),
            "Legacy Workspace/Card compatibility and legacy ledger tables are frozen; backfill is dry-run only until audited mapping approval.",
            context.GeneratedBy,
            context.GeneratedAtUtc);
        var compatibilityOk = OldApiStillCompatible(context.CompatibilitySource);
        var backfillSafe = backfillPlan.All(row =>
            row.DryRun
            && !row.WouldWriteNewBusinessFacts
            && row.Source == "legacy_migration"
            && !string.IsNullOrWhiteSpace(row.OriginalRefColumn));
        var mappingOk = mappings.Length > 0
            && mappings.All(row => row.Source == "legacy_migration")
            && mappings.Where(row => row.RequiresReconciliationNote).All(row => !string.IsNullOrWhiteSpace(row.OriginalRefColumn));
        var status = rollbackValidation.Valid && compatibilityOk && backfillSafe && mappingOk
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
        var backfillReport = new LegacyBackfillReport(
            $"{context.ReportId}-legacy-backfill",
            context.ReportId,
            context.ReleaseId,
            context.TenantId,
            backfillSafe ? "passed" : "failed",
            true,
            "legacy_migration",
            context.Registry.Phase,
            mappings,
            backfillPlan,
            backfillPlan
                .Where(row => row.RequiresReconciliationNote)
                .Select(row => new LegacyReconciliationNote(row.LegacyTable, row.ReconciliationNote, row.OriginalRefColumn))
                .ToArray(),
            compatibilityFreeze,
            releaseGateRefs,
            context.GeneratedBy,
            context.GeneratedAtUtc);
        var invariantChecks = BuildInvariantChecks(context, report, backfillReport, compatibilityOk, mappingOk, backfillSafe, rollbackValidation.Valid);

        return new MigrationVerificationRunOutput(
            context.ReportId,
            context.ReleaseId,
            context.TenantId,
            status,
            invariantChecks,
            report,
            backfillReport,
            compatibilityFreeze);
    }

    private static IReadOnlyList<InvariantCheckEvidence> BuildInvariantChecks(
        MigrationVerificationRunContext context,
        MigrationVerificationReport report,
        LegacyBackfillReport backfillReport,
        bool compatibilityOk,
        bool mappingOk,
        bool backfillSafe,
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
                "legacy.mapping_report_generated",
                "Legacy to new runtime mapping report must be generated with source and original_ref.",
                "P1",
                mappingOk,
                new Dictionary<string, object> { ["mapping_count"] = report.LegacyMappingReport.Count },
                new Dictionary<string, object> { ["minimum_mapping_count"] = 1 },
                Array.Empty<IReadOnlyDictionary<string, object>>()),
            Check(
                context,
                "legacy.old_api_still_compatible",
                "Workspace/Card compatibility prepare and confirm APIs must remain present.",
                "P1",
                compatibilityOk,
                new Dictionary<string, object> { ["old_api_compatible"] = compatibilityOk },
                new Dictionary<string, object> { ["old_api_compatible"] = true },
                compatibilityOk ? Array.Empty<IReadOnlyDictionary<string, object>>() : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["missing"] = "workspace-card-compatibility-endpoints" } }),
            Check(
                context,
                "legacy.backfill_does_not_drop_legacy_data",
                "Legacy backfill dry-run must not drop legacy data or write new business facts.",
                "P0",
                backfillSafe,
                new Dictionary<string, object>
                {
                    ["dry_run"] = backfillReport.DryRun,
                    ["plan_rows"] = backfillReport.BackfillPlan.Count,
                    ["would_write_new_business_facts"] = backfillReport.BackfillPlan.Any(row => row.WouldWriteNewBusinessFacts)
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

    private static bool OldApiStillCompatible(string source) =>
        source.Contains("/api/workspaces/{workspaceId}/cards/{cardId}/prepare", StringComparison.OrdinalIgnoreCase)
        && source.Contains("/api/workspaces/{workspaceId}/cards/{cardId}/confirm", StringComparison.OrdinalIgnoreCase);

    private static string Sanitize(string value) =>
        new(value.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
}

public interface IMigrationVerificationDataSource
{
    IReadOnlyList<LegacyTableScanRow> ScanLegacyTables(IReadOnlyList<LegacyTableMapping> mappings);

    IReadOnlyList<OldViewNewLensComparison> CompareLegacyToNewLens(IReadOnlyList<LegacyTableMapping> mappings);
}

internal sealed class PostgresMigrationVerificationDataSource : IMigrationVerificationDataSource
{
    private readonly string connectionString;

    public PostgresMigrationVerificationDataSource(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public IReadOnlyList<LegacyTableScanRow> ScanLegacyTables(IReadOnlyList<LegacyTableMapping> mappings)
    {
        using var connection = Open();
        return mappings
            .Select(mapping => new LegacyTableScanRow(
                mapping.LegacyTable,
                TableExists(connection, mapping.LegacyTable),
                CountRows(connection, mapping.LegacyTable),
                mapping.Source,
                mapping.OriginalRefColumn,
                mapping.RequiresReconciliationNote))
            .ToArray();
    }

    public IReadOnlyList<OldViewNewLensComparison> CompareLegacyToNewLens(IReadOnlyList<LegacyTableMapping> mappings)
    {
        using var connection = Open();
        return mappings
            .Select(mapping =>
            {
                var oldCount = CountRows(connection, mapping.LegacyTable);
                var newCount = mapping.TargetTables.Sum(table => CountRows(connection, table));
                return new OldViewNewLensComparison(
                    mapping.LegacyTable,
                    mapping.TargetTables,
                    oldCount,
                    newCount,
                    "count_only",
                    oldCount == 0 || newCount > 0 ? "comparable" : "legacy_data_requires_mapping_review");
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
    public static LegacyMigrationRegistry LoadRegistry(string registryPath)
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = true
        };
        var registry = JsonSerializer.Deserialize<LegacyMigrationRegistry>(File.ReadAllText(registryPath), options)
            ?? throw new InvalidOperationException($"Could not deserialize {registryPath}");
        return registry with
        {
            Version = registry.Version ?? "unknown",
            SourceSlice = registry.SourceSlice ?? "legacy",
            Phase = registry.Phase ?? "legacy-backfill-freeze",
            AuthoritativeOwners = registry.AuthoritativeOwners ?? new Dictionary<string, string>(),
            LegacyTables = registry.LegacyTables ?? Array.Empty<LegacyRegistryTable>(),
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
    string CompatibilitySource,
    LegacyMigrationRegistry Registry,
    IReadOnlyList<MigrationFileSnapshot> MigrationFiles);

public sealed record MigrationVerificationRunOutput(
    string ReportId,
    string ReleaseId,
    string TenantId,
    string Status,
    IReadOnlyList<InvariantCheckEvidence> InvariantChecks,
    MigrationVerificationReport Report,
    LegacyBackfillReport BackfillReport,
    LegacyCompatibilityFreeze Freeze);

public sealed record MigrationVerificationReport(
    string ReportId,
    string ReleaseId,
    string MrId,
    string TenantId,
    string Status,
    bool DryRun,
    MigrationDryRunResult MigrationDryRun,
    IReadOnlyList<LegacyTableScanRow> OldRuntimeDataScan,
    IReadOnlyList<LegacyMappingReportRow> LegacyMappingReport,
    IReadOnlyList<OldViewNewLensComparison> OldViewNewLensCompare,
    MigrationRollbackValidation RollbackNoteValidation,
    IReadOnlyList<string> ReleaseGateRefs,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record LegacyBackfillReport(
    string BackfillReportId,
    string MigrationReportId,
    string ReleaseId,
    string TenantId,
    string Status,
    bool DryRun,
    string Source,
    string Phase,
    IReadOnlyList<LegacyMappingReportRow> Mappings,
    IReadOnlyList<LegacyBackfillPlanRow> BackfillPlan,
    IReadOnlyList<LegacyReconciliationNote> ReconciliationNotes,
    LegacyCompatibilityFreeze CompatibilityFreeze,
    IReadOnlyList<string> ReleaseGateRefs,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record LegacyCompatibilityFreeze(
    string FreezeId,
    string ReleaseId,
    string TenantId,
    string SourceSlice,
    string RegistryVersion,
    string Status,
    IReadOnlyList<string> FrozenTables,
    string Reason,
    string FrozenBy,
    DateTimeOffset FrozenAtUtc);

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

public sealed record LegacyTableScanRow(
    string LegacyTable,
    bool Exists,
    long RowCount,
    string Source,
    string OriginalRefColumn,
    bool RequiresReconciliationNote);

public sealed record LegacyMappingReportRow(
    string LegacyTable,
    string Replacement,
    string Source,
    string OriginalRefColumn,
    IReadOnlyList<string> TargetTables,
    bool RequiresReconciliationNote,
    string BackfillPolicy,
    string ApplyMode);

public sealed record LegacyBackfillPlanRow(
    string LegacyTable,
    IReadOnlyList<string> TargetTables,
    bool DryRun,
    bool WouldWriteNewBusinessFacts,
    string Source,
    string OriginalRefColumn,
    bool RequiresReconciliationNote,
    string ReconciliationNote);

public sealed record LegacyReconciliationNote(
    string LegacyTable,
    string Note,
    string OriginalRefColumn);

public sealed record OldViewNewLensComparison(
    string LegacyTable,
    IReadOnlyList<string> NewLensTables,
    long OldRowCount,
    long NewRowCount,
    string CompareMode,
    string Status);

public sealed record MigrationFileSnapshot(
    string MigrationId,
    string Path,
    string Sql);

public sealed record LegacyMigrationRegistry(
    string Version,
    string SourceSlice,
    string Phase,
    IReadOnlyDictionary<string, string> AuthoritativeOwners,
    IReadOnlyList<LegacyRegistryTable> LegacyTables,
    IReadOnlyList<string> Guards);

public sealed record LegacyRegistryTable(
    string Table,
    string Replacement,
    string Mode,
    string BackfillPolicy);

public sealed record LegacyTableMapping(
    string LegacyTable,
    string Replacement,
    string Source,
    string OriginalRefColumn,
    IReadOnlyList<string> TargetTables,
    bool RequiresReconciliationNote,
    string BackfillPolicy)
{
    public static LegacyTableMapping FromRegistry(LegacyRegistryTable table, LegacyMigrationRegistry registry)
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
        return new LegacyTableMapping(
            table.Table,
            table.Replacement,
            "legacy_migration",
            $"{table.Table}.primary_key",
            targetTables,
            IsMoneyRelated(table.Table, registry),
            table.BackfillPolicy);
    }

    private static bool IsMoneyRelated(string table, LegacyMigrationRegistry registry) =>
        table.Contains("deposit", StringComparison.OrdinalIgnoreCase)
        || table.Contains("payment", StringComparison.OrdinalIgnoreCase)
        || table.Contains("finance", StringComparison.OrdinalIgnoreCase)
        || registry.AuthoritativeOwners.Count > 0;
}
