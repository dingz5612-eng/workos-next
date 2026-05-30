using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class BackupRestoreSmokeJobTests
{
    [TestMethod]
    public void backup_smoke_success()
    {
        var output = Run();

        Assert.AreEqual("passed", output.Status);
        Assert.IsTrue(output.Report.SchemaBackup.Success);
        Assert.IsTrue(output.Report.DataBackup.Success);
        Assert.AreEqual("passed", Check(output, "backup.smoke_success").Status);
        CollectionAssert.Contains(output.Report.ReleaseGateRefs.ToArray(), "backup-restore-smoke-test-backup-smoke-success");
    }

    [TestMethod]
    public void restore_smoke_success()
    {
        var output = Run();

        Assert.IsTrue(output.Report.RestoreSummary.Success);
        Assert.IsTrue(output.Report.IsolatedSchema.StartsWith("backup_restore_smoke_", StringComparison.Ordinal));
        Assert.IsTrue(output.Report.KeyQueryResults.All(result => result.MatchesSource));
        Assert.IsTrue(output.Report.KeyQueryResults.Any(result => result.Key == "control_plane.release_manifests"));
        Assert.IsTrue(output.Report.ProjectionRebuild.Rebuildable);
        Assert.AreEqual("passed", Check(output, "restore.smoke_success").Status);
    }

    [TestMethod]
    public void invariants_after_restore_pass()
    {
        var output = Run();

        Assert.AreEqual("passed", output.Report.InvariantResults.Single().Status);
        Assert.AreEqual("restore.key_queries_available_after_restore", output.Report.InvariantResults.Single().InvariantKey);
        Assert.AreEqual("passed", Check(output, "restore.invariants_after_restore_pass").Status);
    }

    [TestMethod]
    public void backup_restore_migration_declares_report_table()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "026_backup_restore_smoke_reports.sql"));

        foreach (var term in new[]
        {
            "control_plane.backup_restore_smoke_reports",
            "schema_backup jsonb not null",
            "data_backup jsonb not null",
            "restore_summary jsonb not null",
            "projection_rebuild jsonb not null",
            "invariant_results jsonb not null",
            "Rollback note"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"backup restore migration missing {term}");
        }
    }

    private static BackupRestoreSmokeRunOutput Run()
    {
        var service = new BackupRestoreSmokeJobService(
            new FakeBackupRestoreStore(),
            new FakeProjectionRunner(),
            new FakeInvariantRunner());

        return service.Run(new BackupRestoreSmokeRunContext(
            "backup-restore-smoke-test",
            "release-test",
            "tenant-test",
            "ci-test",
            "backup_restore_smoke_test",
            false,
            "backup-restore-smoke",
            DateTimeOffset.Parse("2026-05-30T00:00:00Z")));
    }

    private static InvariantCheckEvidence Check(BackupRestoreSmokeRunOutput output, string key) =>
        output.InvariantChecks.Single(check => check.InvariantKey == key);

    private static string RepoPath(params string[] parts)
    {
        var cursor = new DirectoryInfo(AppContext.BaseDirectory);
        while (cursor is not null && !File.Exists(Path.Combine(cursor.FullName, "WorkOSNext.sln")))
        {
            cursor = cursor.Parent;
        }

        if (cursor is null)
        {
            throw new DirectoryNotFoundException("Could not locate WorkOSNext repo root.");
        }

        return Path.Combine(new[] { cursor.FullName }.Concat(parts).ToArray());
    }

    private sealed class FakeBackupRestoreStore : IBackupRestoreSmokeStore
    {
        public BackupRestoreSnapshot BackupAndRestore(BackupRestoreSmokeRunContext context)
        {
            var tables = new[]
            {
                Table("public", "process_runs", "process_runs", 2),
                Table("public", "audit_events", "audit_events", 3),
                Table("control_plane", "release_manifests", "_control_plane_release_manifests", 1)
            };
            var keys = new[]
            {
                Key("operation_cases", "public.process_runs", $"{context.IsolatedSchema}.operation_cases", 2),
                Key("work_items", "public.process_work_item_intents", $"{context.IsolatedSchema}.work_items", 2),
                Key("domain_events", "public.audit_events", $"{context.IsolatedSchema}.domain_events", 3),
                Key("ledger_entries", "public.ledger_aliases", $"{context.IsolatedSchema}.ledger_entries", 4),
                Key("evidence_metadata", "public.evidence_objects", $"{context.IsolatedSchema}.evidence_metadata", 1),
                Key("control_plane.release_manifests", "control_plane.release_manifests", $"{context.IsolatedSchema}.release_manifests", 1)
            };

            return new BackupRestoreSnapshot(
                new BackupRestoreSchemaBackup(true, tables.Length, tables),
                new BackupRestoreDataBackup(true, tables.Length, tables.Sum(table => table.SourceRowCount), tables),
                new BackupRestoreSummary(true, context.IsolatedSchema, tables.Length, tables.Sum(table => table.RestoredRowCount), tables),
                keys);
        }

        public void Cleanup(string isolatedSchema)
        {
        }

        private static BackupRestoreTableResult Table(string schema, string table, string restoreTable, long count) =>
            new(
                schema,
                table,
                restoreTable,
                true,
                true,
                count,
                count,
                [new BackupRestoreColumnSnapshot("id", "text", false)]);

        private static BackupRestoreKeyQueryResult Key(string key, string source, string restored, long count) =>
            new(key, source, restored, count, count, true);
    }

    private sealed class FakeProjectionRunner : IBackupRestoreProjectionRunner
    {
        public BackupRestoreProjectionRebuildResult Run(BackupRestoreSmokeRunContext context) =>
            new(true, "matched", "projection-rebuild-test", 12, 0, true);
    }

    private sealed class FakeInvariantRunner : IBackupRestoreInvariantRunner
    {
        public IReadOnlyList<BackupRestoreInvariantResult> Run(BackupRestoreSmokeRunContext context) =>
        [
            new(
                "restore-invariant-test",
                "restore.key_queries_available_after_restore",
                "passed",
                0)
        ];
    }
}
