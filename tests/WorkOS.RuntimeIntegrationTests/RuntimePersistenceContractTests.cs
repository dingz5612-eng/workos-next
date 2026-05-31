using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class RuntimePersistenceContractTests
{
    private static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }

    [TestMethod]
    public void ConfirmUnitOfWorkOwnsAuditOutboxAndAggregateBoundary()
    {
        var unitOfWork = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ConfirmUnitOfWork.cs"));
        Assert.Contains("InsertAuditEventAndOutbox", unitOfWork);
        Assert.Contains("sliceAggregates.Apply", unitOfWork);
        Assert.Contains("db.Commit()", unitOfWork);
    }

    [TestMethod]
    public void OutboxMigrationDeclaresClaimAndAttemptFields()
    {
        var claimMigration = File.ReadAllText(RepoPath("infra", "db", "migrations", "012_outbox_claim_dead_letter.sql"));
        var attemptMigration = File.ReadAllText(RepoPath("infra", "db", "migrations", "013_outbox_attempt_count.sql"));
        Assert.Contains("claimed_by", claimMigration);
        Assert.Contains("dead_lettered_at_utc", claimMigration);
        Assert.Contains("attempt_count", claimMigration);
        Assert.DoesNotContain("retry_count", claimMigration, "claim/dead-letter migration must declare attempt_count directly");
        Assert.Contains("attempt_count", attemptMigration);

        var outboxStorage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeOutboxStorage.cs"));
        Assert.Contains("attempt_count", outboxStorage);
        Assert.DoesNotContain("retry_count", outboxStorage, "runtime outbox code must not update retry_count");
    }

    [TestMethod]
    public void RuntimeContractTestsProtectDestructiveReset()
    {
        var testProgram = File.ReadAllText(RepoPath("tests", "WorkOS.RuntimeContractTests", "Program.cs"));
        Assert.Contains("AssertTestDatabaseAllowed", testProgram);
        Assert.Contains("TEST_DATABASE", testProgram);
        Assert.Contains("_test", testProgram);
    }

    [TestMethod]
    public void EvidenceAndCardInstanceMigrationDeclaresRuntimeOwnershipTables()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "014_runtime_evidence_card_instances.sql"));
        foreach (var term in new[]
        {
            "card_instances",
            "evidence_objects",
            "evidence_attachments",
            "evidence_requirements",
            "card_instance_id",
            "submission_id",
            "requirement_id"
        })
        {
            Assert.Contains(term, migration, $"migration must declare {term}");
        }

        var unitOfWork = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ConfirmUnitOfWork.cs"));
        Assert.Contains("MarkSubmitted", unitOfWork);
        Assert.Contains("MarkConfirmed", unitOfWork);
        Assert.Contains("MarkUsed", unitOfWork);
    }

    [TestMethod]
    public void ControlPlaneShadowMigrationDeclaresRequiredSchemasTablesAndConstraints()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "015_control_plane_shadow_runtime.sql"));

        foreach (var term in new[]
        {
            "create schema if not exists control_plane",
            "create schema if not exists shadow_runtime",
            "control_plane.release_manifests",
            "control_plane.feature_flags",
            "control_plane.slice_cutover_states",
            "control_plane.shadow_compare_reports",
            "control_plane.runtime_invariant_checks",
            "control_plane.gate_results",
            "control_plane.rollback_instructions",
            "shadow_runtime.command_submissions",
            "shadow_runtime.domain_events",
            "shadow_runtime.ledger_entries",
            "shadow_runtime.lens_snapshots",
            "shadow_runtime.compare_inputs",
            "uq_feature_flags_release_flag_key unique(release_id, flag_key)",
            "uq_slice_cutover_states_release_tenant_slice unique(release_id, tenant_id, slice_id)",
            "drop schema if exists shadow_runtime cascade",
            "drop schema if exists control_plane cascade"
        })
        {
            Assert.Contains(term, migration, $"migration must declare {term}");
        }

        foreach (var value in ControlPlaneDbMapping.ReleaseStatuses
            .Concat(ControlPlaneDbMapping.FeatureFlagStatuses)
            .Concat(ControlPlaneDbMapping.RuntimeModes)
            .Concat(ControlPlaneDbMapping.GateStatuses)
            .Concat(ControlPlaneDbMapping.ShadowGrades)
            .Concat(ControlPlaneDbMapping.InvariantModes)
            .Concat(ControlPlaneDbMapping.InvariantSeverities)
            .Concat(ControlPlaneDbMapping.RollbackInstructionTypes)
            .Concat(ControlPlaneDbMapping.RollbackKinds))
        {
            Assert.Contains($"'{value}'", migration, $"migration must constrain value {value}");
        }

        foreach (var scopeField in new[]
        {
            "tenantIds",
            "sliceIds",
            "roles",
            "actorIds",
            "deviceIds",
            "deviceTrust",
            "percentage",
            "amount",
            "currency",
            "lte",
            "gte"
        })
        {
            Assert.Contains(scopeField, migration, $"feature flag scope_rules must support {scopeField}");
        }
    }

    [TestMethod]
    public void ControlPlaneDbMappingTracksMigrationTablesAndColumns()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "015_control_plane_shadow_runtime.sql"));
        var writeStore = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ControlPlaneWriteStore.cs"));
        var allTables = ControlPlaneDbMapping.ControlPlaneTables.Concat(ControlPlaneDbMapping.ShadowRuntimeTables).ToArray();
        Assert.HasCount(7, ControlPlaneDbMapping.ControlPlaneTables);
        Assert.HasCount(5, ControlPlaneDbMapping.ShadowRuntimeTables);

        foreach (var table in allTables)
        {
            Assert.Contains($"{table.Schema}.{table.Table}", migration, $"migration missing table {table.Schema}.{table.Table}");
            foreach (var column in table.Columns)
            {
                Assert.Contains(column, migration, $"migration missing mapped column {table.Table}.{column}");
            }
        }

        foreach (var method in new[] { "WriteGateResult", "WriteRuntimeInvariantCheck", "WriteShadowCompareReport" })
        {
            Assert.Contains(method, writeStore, $"Control Plane write store must expose {method}");
        }
    }

    [TestMethod]
    public void CheckoutServiceProcessManagerMigrationDeclaresRunsDedupeAndIntentTables()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "016_checkout_service_process_manager.sql"));
        foreach (var term in new[]
        {
            "process_runs",
            "process_work_item_intents",
            "process_request_event_intents",
            "tenant_id",
            "trigger_event_id",
            "process_rule_id",
            "uq_process_runs_trigger_rule unique(tenant_id, trigger_event_id, process_rule_id)",
            "work_item_type",
            "target_workspace_id",
            "request_event_type",
            "target_slice_id"
        })
        {
            Assert.Contains(term, migration, $"process manager migration must declare {term}");
        }
    }

    [TestMethod]
    public void OperationsUnitOfWorkMigrationDeclaresSubmissionFactResponseAndTraceTables()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "030_operations_unit_of_work.sql"));
        var failedAuditMigration = File.ReadAllText(RepoPath("infra", "db", "migrations", "032_operations_failed_submission_audit.sql"));
        foreach (var term in new[]
        {
            "operations_command_submissions",
            "operations_domain_events",
            "operations_work_item_events",
            "operations_outbox_messages",
            "operations_fact_responses",
            "uq_operations_command_submission_idempotency",
            "unique(tenant_id, idempotency_scope, idempotency_key)",
            "references operations_command_submissions(submission_id) on delete restrict",
            "payload_hash",
            "stable_response",
            "correlation_id",
            "causation_id"
        })
        {
            Assert.Contains(term, migration, $"operations unit of work migration must declare {term}");
        }

        foreach (var term in new[]
        {
            "failure_code",
            "failure_reason",
            "rejected_at_utc",
            "failed_at_utc",
            "response_status_code",
            "'failed'",
            "ck_operations_command_submissions_failure_audit"
        })
        {
            Assert.Contains(term, failedAuditMigration, $"failed submission audit migration must declare {term}");
        }

        var unitOfWork = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "OperationsUnitOfWork.cs"));
        foreach (var term in new[]
        {
            "OperationsUnitOfWork",
            "CommandSubmissionService",
            "IdempotencyService",
            "PayloadHashService",
            "CommandEnvelopeBuilder",
            "SliceCommandHandlerRouter",
            "FactResponseStore",
            "OperationsWriteStore",
            "OperationsReadStore",
            "FailCommandSubmission",
            "OperationsStableResponse.Failed"
        })
        {
            Assert.Contains(term, unitOfWork, $"S2 runtime must expose {term}");
        }

        Assert.DoesNotContain("MapPost(\"/api/", unitOfWork, StringComparison.OrdinalIgnoreCase, "S2 must not add Operations API endpoints.");

        var operationsRuntimeService = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeService.cs"));
        Assert.Contains("processing_status = 'failed'", operationsRuntimeService);
        Assert.DoesNotContain(
            "delete from shadow_runtime.command_submissions",
            operationsRuntimeService,
            StringComparison.OrdinalIgnoreCase,
            "compatibility command submissions must be marked failed instead of deleted");
    }

    [TestMethod]
    public void bank_schema_migration()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "017_reconciliation_runtime.sql"));
        foreach (var term in new[]
        {
            "create table if not exists bank_statement_imports",
            "create table if not exists bank_transactions",
            "create table if not exists payment_match_candidates",
            "create table if not exists payment_matches",
            "create table if not exists payment_mismatches",
            "create table if not exists reconciliation_cases",
            "import_id",
            "tenant_id",
            "source_type",
            "original_file_id",
            "bank_transaction_id",
            "external_ref",
            "direction",
            "counterparty",
            "raw_payload",
            "candidate_type",
            "refund_payment_id",
            "matched_event_id",
            "mismatch_type",
            "assigned_role",
            "metadata"
        })
        {
            Assert.Contains(term, migration, $"bank reconciliation migration must declare {term}");
        }

        foreach (var value in new[]
        {
            "manual_csv",
            "mbank_export",
            "bank_statement",
            "admin_upload",
            "other",
            "credit",
            "debit",
            "imported",
            "candidate_created",
            "matched",
            "mismatched",
            "ignored",
            "superseded",
            "payment",
            "deposit",
            "refund",
            "unknown"
        })
        {
            Assert.Contains($"'{value}'", migration, $"bank reconciliation migration must constrain value {value}");
        }
    }

    [TestMethod]
    public void bank_transaction_does_not_reference_domain_event_as_fact()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "017_reconciliation_runtime.sql"));
        var bankTransactionTable = CreateTableSection(migration, "bank_transactions");

        Assert.DoesNotContain("event_id", bankTransactionTable, "bank_transactions must not carry domain event ids as business facts.");
        Assert.DoesNotContain("domain_event", bankTransactionTable, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("PaymentConfirmed", bankTransactionTable, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("raw_payload", bankTransactionTable, "bank_transactions should preserve imported bank payload separately from domain facts.");
        Assert.Contains("status", bankTransactionTable, "bank_transactions should track import/match state without becoming PaymentConfirmed.");
    }

    [TestMethod]
    public void duplicate_bank_transaction_external_ref_handled_by_policy()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "017_reconciliation_runtime.sql"));

        Assert.Contains("uq_bank_transactions_tenant_import_external_ref", migration, "duplicate bank transaction external_ref must be constrained per tenant/import by default policy.");
        Assert.Contains("unique(tenant_id, import_id, external_ref)", migration, "duplicate bank transaction external_ref must be constrained per tenant/import by default policy.");
        Assert.Contains("duplicate_bank_transaction", migration, "mismatch policy must be able to represent duplicate imported bank transactions.");
    }

    [TestMethod]
    public void payment_match_unique_default()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "017_reconciliation_runtime.sql"));
        var paymentMatches = CreateTableSection(migration, "payment_matches");

        Assert.Contains("num_nonnulls(payment_id, deposit_id, refund_payment_id) = 1", paymentMatches,
            "payment_matches must connect one existing payment/deposit/refund target by default.");
        foreach (var term in new[]
        {
            "ux_payment_matches_active_bank_transaction",
            "ux_payment_matches_active_payment",
            "ux_payment_matches_active_deposit",
            "ux_payment_matches_active_refund_payment",
            "ux_payment_match_candidates_payment_target",
            "ux_payment_match_candidates_deposit_target",
            "ux_payment_match_candidates_refund_target",
            "where status = 'matched'",
            "references bank_transactions(bank_transaction_id)",
            "references hostel_payments(payment_id)",
            "references deposit_liabilities(deposit_id)",
            "references deposit_transactions(transaction_id)"
        })
        {
            Assert.Contains(term, migration, $"payment match unique default must declare {term}");
        }
    }

    [TestMethod]
    public void reconciliation_case_migration_declares_owner_due_severity_and_resolve_actions()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "019_reconciliation_mismatch_cases.sql"));
        foreach (var term in new[]
        {
            "alter column bank_transaction_id drop not null",
            "confirmed_payment_without_bank_match",
            "refund_paid_without_bank_debit",
            "owner_role",
            "due_at_utc",
            "blocker_severity",
            "resolve_actions",
            "body jsonb",
            "ck_reconciliation_cases_blocker_severity",
            "ix_reconciliation_cases_owner_due"
        })
        {
            Assert.Contains(term, migration, $"reconciliation case migration must declare {term}");
        }
    }

    [TestMethod]
    public void correction_schema_migration()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "020_correction_center_schema.sql"));

        foreach (var term in new[]
        {
            "create table if not exists ledger_correction_requests",
            "create table if not exists correction_approvals",
            "create table if not exists ledger_reversal_entries",
            "create table if not exists ledger_correction_entries",
            "create table if not exists correction_audit",
            "create table if not exists correction_cases",
            "correction_request_id",
            "target_ledger_type",
            "target_entry_id",
            "target_object_type",
            "target_object_id",
            "correction_type",
            "risk_level",
            "before_snapshot jsonb",
            "after_snapshot jsonb",
            "reversal_event_id",
            "payload jsonb",
            "correction_request_has_required_approval",
            "guard_high_risk_reversal_approval",
            "guard_high_risk_correction_approval",
            "forbid_correction_ledger_entry_update",
            "guard_hostel_payments_fact_update",
            "guard_finance_reconciliations_fact_update",
            "guard_hostel_charges_fact_update",
            "forbid_legacy_ledger_entry_update",
            "trg_hostel_payments_fact_update_guard",
            "trg_deposit_transactions_forbid_update",
            "trg_payment_allocations_forbid_update"
        })
        {
            Assert.Contains(term, migration, $"Correction Center migration must declare {term}");
        }

        foreach (var value in new[]
        {
            "payment",
            "deposit",
            "charge",
            "cash",
            "refund",
            "reversal",
            "amount_adjustment",
            "classification_adjustment",
            "evidence_correction",
            "allocation_reversal",
            "refund_correction",
            "charge_adjustment"
        })
        {
            Assert.Contains($"'{value}'", migration, $"Correction Center migration must constrain value {value}");
        }

        var requestTable = CreateTableSection(migration, "ledger_correction_requests");
        Assert.Contains("length(trim(reason)) > 0", requestTable, "correction requests must require a reason.");
        Assert.Contains("risk_level in ('low', 'medium', 'high', 'critical')", requestTable, "correction requests must classify risk.");

        var correctionEntries = CreateTableSection(migration, "ledger_correction_entries");
        Assert.Contains("jsonb_typeof(before_snapshot) = 'object'", correctionEntries);
        Assert.Contains("jsonb_typeof(after_snapshot) = 'object'", correctionEntries);
    }

    private static string CreateTableSection(string migration, string tableName)
    {
        var start = migration.IndexOf($"create table if not exists {tableName}", StringComparison.OrdinalIgnoreCase);
        Assert.IsGreaterThanOrEqualTo(0, start, $"Could not find create table section for {tableName}.");

        var next = migration.IndexOf("create table if not exists", start + 1, StringComparison.OrdinalIgnoreCase);
        return next < 0
            ? migration[start..]
            : migration[start..next];
    }
}
