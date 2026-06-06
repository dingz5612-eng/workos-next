using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class MigrationVerificationJobTests
{
    [TestMethod]
    public void migration_dry_run_success()
    {
        var output = Run();

        Assert.AreEqual("passed", output.Status);
        Assert.IsTrue(output.Report.MigrationDryRun.Success);
        Assert.IsTrue(output.Report.RollbackNoteValidation.Valid);
        Assert.AreEqual("passed", Check(output, "migration.dry_run_success").Status);
    }

    [TestMethod]
    public void source_mapping_report_generated()
    {
        var output = Run();
        var mapping = output.Report.SourceMappingReport.Single(row => row.SourceTable == "hostel_payments");

        Assert.AreEqual("migration_readonly_source", mapping.Source);
        Assert.AreEqual("hostel_payments.primary_key", mapping.OriginalRefColumn);
        Assert.IsTrue(mapping.RequiresReconciliationNote);
        Assert.AreEqual("passed", Check(output, "source.mapping_report_generated").Status);
    }

    [TestMethod]
    public void workspace_card_api_absent()
    {
        var output = Run();

        Assert.AreEqual("passed", Check(output, "source.workspace_card_api_absent").Status);
        Assert.IsTrue(output.Report.ReleaseGateRefs.Any(item => item.Contains("workspace-card-api-absent", StringComparison.Ordinal)));
    }

    [TestMethod]
    public void reconciliation_review_is_readonly()
    {
        var output = Run();
        var plan = output.RemediationReport.RemediationPlan;

        Assert.IsTrue(output.RemediationReport.DryRun);
        Assert.IsTrue(plan.All(row => !row.WouldWriteNewBusinessFacts));
        Assert.IsTrue(plan.All(row => row.Source == "migration_readonly_source"));
        Assert.IsTrue(plan.Where(row => row.RequiresReconciliationNote).All(row => row.ReconciliationNote.Contains("reconciliation note", StringComparison.OrdinalIgnoreCase)));
        Assert.AreEqual("passed", Check(output, "source.reconciliation_review_is_readonly").Status);
    }

    [TestMethod]
    public void rollback_note_validation_flags_missing_notes()
    {
        var output = Run(migrations:
        [
            new MigrationFileSnapshot("015_good", "015_good.sql", "-- Rollback note: ok\nselect 1;"),
            new MigrationFileSnapshot("016_bad", "016_bad.sql", "select 1;")
        ]);

        Assert.AreEqual("failed", output.Status);
        Assert.AreEqual("failed", Check(output, "migration.dry_run_success").Status);
        CollectionAssert.Contains(output.Report.RollbackNoteValidation.MissingRollbackNotes.ToArray(), "016_bad");
    }

    [TestMethod]
    public void source_registry_loader_reads_camel_case_contract()
    {
        var directory = Path.Combine(Path.GetTempPath(), "workos-migration-verification", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var registryPath = Path.Combine(directory, "registry.json");
        try
        {
            File.WriteAllText(registryPath,
                """
                {
                  "version": "0.16.2",
                  "sourceSlice": "Accommodation.CheckIn",
                  "phase": "stay-intake-ledger-source-lock",
                  "authoritativeOwners": {
                    "ordinaryPayment": "Accommodation.PaymentLedger"
                  },
                  "migrationReadonlySources": [
                    {
                      "table": "hostel_payments",
                      "replacement": "PaymentLedger payment receipt + allocation facts",
                      "mode": "locked-read-only",
                      "consistencyPolicy": "convert only non-deposit ordinary payment rows"
                    }
                  ],
                  "guards": [
                    "Remediation must be dry-run first"
                  ]
                }
                """);

            var registry = MigrationVerificationFileLoader.LoadRegistry(registryPath);

            Assert.AreEqual("Accommodation.CheckIn", registry.SourceSlice);
            Assert.AreEqual("stay-intake-ledger-source-lock", registry.Phase);
            Assert.AreEqual("Accommodation.PaymentLedger", registry.AuthoritativeOwners["ordinaryPayment"]);
            Assert.AreEqual("hostel_payments", registry.MigrationReadonlySources[0].Table);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    private static MigrationVerificationRunOutput Run(IReadOnlyList<MigrationFileSnapshot>? migrations = null)
    {
        var service = new MigrationVerificationJobService(new FakeMigrationVerificationDataSource());
        return service.Run(new MigrationVerificationRunContext(
            "migration-verification-test",
            "release-test",
            "release-request-test",
            "tenant-test",
            "ci-test",
            true,
            "migration-verification-job",
            DateTimeOffset.Parse("2026-05-30T00:00:00Z"),
            "015",
            """
            app.MapPost("/api/operations/workspaces/start", () => {});
            app.MapPost("/api/operations/work-items/{workItemId}/confirm", () => {});
            """,
            Registry(),
            migrations ?? new[]
            {
                new MigrationFileSnapshot("015_control_plane_shadow_runtime", "015.sql", "-- Rollback note: ok"),
                new MigrationFileSnapshot("016_checkout_service_process_manager", "016.sql", "-- compensating migration"),
                new MigrationFileSnapshot("025_migration_verification_sourceLock", "025.sql", "-- Rollback note: ok")
            }));
    }

    private static InvariantCheckEvidence Check(MigrationVerificationRunOutput output, string key) =>
        output.InvariantChecks.Single(check => check.InvariantKey == key);

    private static MigrationConsistencyRegistry Registry() =>
        new(
            "0.16.2",
            "Accommodation.CheckIn",
            "stay-intake-ledger-source-lock",
            new Dictionary<string, string> { ["ordinaryPayment"] = "Accommodation.PaymentLedger" },
            new[]
            {
                new MigrationReadonlySource(
                    "hostel_payments",
                    "PaymentLedger payment receipt + allocation facts",
                    "locked-read-only",
                    "convert only non-deposit ordinary payment rows; deposit purpose rows migrate to DepositLedger")
            },
            new[] { "Remediation must be dry-run first and must be idempotent" });

    private sealed class FakeMigrationVerificationDataSource : IMigrationVerificationDataSource
    {
        public IReadOnlyList<ReadonlySourceScanRow> ScanMigrationReadonlySources(IReadOnlyList<MigrationSourceMapping> mappings) =>
            mappings
                .Select(mapping => new ReadonlySourceScanRow(
                    mapping.SourceTable,
                    true,
                    2,
                    mapping.Source,
                    mapping.OriginalRefColumn,
                    mapping.RequiresReconciliationNote))
                .ToArray();

        public IReadOnlyList<ProjectionConsistencyComparison> CompareReadonlySourcesToProjection(IReadOnlyList<MigrationSourceMapping> mappings) =>
            mappings
                .Select(mapping => new ProjectionConsistencyComparison(
                    mapping.SourceTable,
                    mapping.TargetTables,
                    2,
                    2,
                    "count_only",
                    "comparable"))
                .ToArray();
    }
}
