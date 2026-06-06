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
    public void retired_mapping_report_generated()
    {
        var output = Run();
        var mapping = output.Report.RetiredMappingReport.Single(row => row.RetiredTable == "hostel_payments");

        Assert.AreEqual("retired_data_migration", mapping.Source);
        Assert.AreEqual("hostel_payments.primary_key", mapping.OriginalRefColumn);
        Assert.IsTrue(mapping.RequiresReconciliationNote);
        Assert.AreEqual("passed", Check(output, "retired.mapping_report_generated").Status);
    }

    [TestMethod]
    public void old_api_retired()
    {
        var output = Run();

        Assert.AreEqual("passed", Check(output, "retired.old_api_retired").Status);
        Assert.IsTrue(output.Report.ReleaseGateRefs.Any(item => item.Contains("old-api-retired", StringComparison.Ordinal)));
    }

    [TestMethod]
    public void remediation_does_not_drop_retired_data()
    {
        var output = Run();
        var plan = output.RemediationReport.RemediationPlan;

        Assert.IsTrue(output.RemediationReport.DryRun);
        Assert.IsTrue(plan.All(row => !row.WouldWriteNewBusinessFacts));
        Assert.IsTrue(plan.All(row => row.Source == "retired_data_migration"));
        Assert.IsTrue(plan.Where(row => row.RequiresReconciliationNote).All(row => row.ReconciliationNote.Contains("reconciliation note", StringComparison.OrdinalIgnoreCase)));
        Assert.AreEqual("passed", Check(output, "retired.remediation_does_not_drop_retired_data").Status);
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
    public void retired_registry_loader_reads_camel_case_contract()
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
                  "phase": "retired-intake-ledger-read-only",
                  "authoritativeOwners": {
                    "ordinaryPayment": "Accommodation.PaymentLedger"
                  },
                  "retiredTables": [
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
            Assert.AreEqual("retired-intake-ledger-read-only", registry.Phase);
            Assert.AreEqual("Accommodation.PaymentLedger", registry.AuthoritativeOwners["ordinaryPayment"]);
            Assert.AreEqual("hostel_payments", registry.RetiredTables[0].Table);
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
                new MigrationFileSnapshot("025_migration_verification_retired_sourceLock", "025.sql", "-- Rollback note: ok")
            }));
    }

    private static InvariantCheckEvidence Check(MigrationVerificationRunOutput output, string key) =>
        output.InvariantChecks.Single(check => check.InvariantKey == key);

    private static RetiredMigrationRegistry Registry() =>
        new(
            "0.16.2",
            "Accommodation.CheckIn",
            "retired-intake-ledger-read-only",
            new Dictionary<string, string> { ["ordinaryPayment"] = "Accommodation.PaymentLedger" },
            new[]
            {
                new RetiredRegistryTable(
                    "hostel_payments",
                    "PaymentLedger payment receipt + allocation facts",
                    "locked-read-only",
                    "convert only non-deposit ordinary payment rows; deposit purpose rows migrate to DepositLedger")
            },
            new[] { "Remediation must be dry-run first and must be idempotent" });

    private sealed class FakeMigrationVerificationDataSource : IMigrationVerificationDataSource
    {
        public IReadOnlyList<RetiredTableScanRow> ScanRetiredTables(IReadOnlyList<RetiredTableMapping> mappings) =>
            mappings
                .Select(mapping => new RetiredTableScanRow(
                    mapping.RetiredTable,
                    true,
                    2,
                    mapping.Source,
                    mapping.OriginalRefColumn,
                    mapping.RequiresReconciliationNote))
                .ToArray();

        public IReadOnlyList<OldViewNewLensComparison> CompareRetiredToNewLens(IReadOnlyList<RetiredTableMapping> mappings) =>
            mappings
                .Select(mapping => new OldViewNewLensComparison(
                    mapping.RetiredTable,
                    mapping.TargetTables,
                    2,
                    2,
                    "count_only",
                    "comparable"))
                .ToArray();
    }
}
