namespace WorkOS.Api.Runtime;

public static class ControlPlaneDbMapping
{
    public const string ControlPlaneSchema = "control_plane";
    public const string ShadowRuntimeSchema = "shadow_runtime";

    public static readonly DbTableContract ReleaseManifests = new(
        ControlPlaneSchema,
        "release_manifests",
        new[]
        {
            "release_id", "mr_id", "release_name", "status", "owners", "commit_sha",
            "migration_version", "definition_version", "api_schema_hash", "ci_run_id",
            "gate_result_id", "rollback_instruction_id", "feature_flag_ids",
            "slice_cutover_state_ids", "shadow_compare_report_ids", "invariant_check_ids",
            "acceptance_scenarios", "go_criteria", "no_go_criteria", "known_risks",
            "created_at_utc", "updated_at_utc", "released_at_utc", "locked_at_utc"
        });

    public static readonly DbTableContract FeatureFlags = new(
        ControlPlaneSchema,
        "feature_flags",
        new[]
        {
            "feature_flag_id", "release_id", "flag_key", "description", "status",
            "scope_rules", "default_behavior", "created_by", "created_at_utc",
            "updated_at_utc", "expires_at_utc"
        });

    public static readonly DbTableContract SliceCutoverStates = new(
        ControlPlaneSchema,
        "slice_cutover_states",
        new[]
        {
            "cutover_state_id", "release_id", "tenant_id", "slice_id", "runtime_mode",
            "previous_runtime_mode", "enabled_roles", "enabled_actor_ids",
            "enabled_device_ids", "amount_threshold", "enabled_percentage",
            "dependency_status", "last_shadow_compare_report_id", "last_gate_result_id",
            "rollback_instruction_id", "started_at_utc", "updated_at_utc", "ended_at_utc"
        });

    public static readonly DbTableContract ShadowCompareReports = new(
        ControlPlaneSchema,
        "shadow_compare_reports",
        new[]
        {
            "shadow_compare_report_id", "release_id", "tenant_id", "slice_id",
            "compare_scope", "source_legacy_ref", "source_active_ref", "source_shadow_ref",
            "compared_at_utc", "grade", "total_compared", "matched_count",
            "mismatch_count", "missing_in_shadow_count", "extra_in_shadow_count",
            "mismatch_examples", "summary", "generated_by", "ci_run_id"
        });

    public static readonly DbTableContract RuntimeInvariantChecks = new(
        ControlPlaneSchema,
        "runtime_invariant_checks",
        new[]
        {
            "invariant_check_id", "release_id", "tenant_id", "slice_id", "invariant_key",
            "description", "mode", "severity", "source_type", "check_sql", "check_ref",
            "status", "observed_value", "threshold", "violation_count",
            "sample_violations", "generated_by", "ci_run_id", "checked_at_utc"
        });

    public static readonly DbTableContract GateResults = new(
        ControlPlaneSchema,
        "gate_results",
        new[]
        {
            "gate_result_id", "release_id", "mr_id", "tenant_id", "slice_id",
            "gate_name", "gate_type", "status", "severity", "ci_run_id",
            "automated_test_refs", "invariant_check_refs", "shadow_compare_report_refs",
            "business_signoff_refs", "no_go_items", "go_items", "known_risks",
            "generated_by", "generated_at_utc", "input_hash", "result_hash"
        });

    public static readonly DbTableContract RollbackInstructions = new(
        ControlPlaneSchema,
        "rollback_instructions",
        new[]
        {
            "rollback_instruction_id", "release_id", "instruction_type", "rollback_kind",
            "title", "scope", "allowed_before_status", "allowed_after_status", "steps",
            "validation_steps", "owner", "risk_level", "requires_business_approval",
            "requires_architecture_approval", "requires_finance_approval",
            "created_at_utc", "updated_at_utc"
        });

    public static readonly DbTableContract ShadowCommandSubmissions = new(
        ShadowRuntimeSchema,
        "command_submissions",
        new[]
        {
            "command_submission_id", "release_id", "tenant_id", "slice_id",
            "workspace_id", "card_id", "idempotency_key", "submitted_at_utc",
            "actor_ref", "command_payload", "source_active_ref", "source_shadow_ref",
            "processing_status"
        });

    public static readonly DbTableContract ShadowDomainEvents = new(
        ShadowRuntimeSchema,
        "domain_events",
        new[]
        {
            "shadow_event_id", "command_submission_id", "event_type", "aggregate_ref",
            "occurred_at_utc", "event_payload", "event_hash"
        });

    public static readonly DbTableContract ShadowLedgerEntries = new(
        ShadowRuntimeSchema,
        "ledger_entries",
        new[]
        {
            "shadow_ledger_entry_id", "command_submission_id", "ledger_type",
            "account_ref", "amount", "currency", "direction", "entry_payload",
            "created_at_utc"
        });

    public static readonly DbTableContract ShadowLensSnapshots = new(
        ShadowRuntimeSchema,
        "lens_snapshots",
        new[]
        {
            "lens_snapshot_id", "release_id", "tenant_id", "slice_id", "lens_id",
            "snapshot_at_utc", "lens_payload", "payload_hash"
        });

    public static readonly DbTableContract ShadowCompareInputs = new(
        ShadowRuntimeSchema,
        "compare_inputs",
        new[]
        {
            "compare_input_id", "release_id", "tenant_id", "slice_id",
            "command_submission_id", "source_legacy_ref", "source_active_ref",
            "source_shadow_ref", "input_payload", "captured_at_utc"
        });

    public static readonly IReadOnlyList<DbTableContract> ControlPlaneTables = new[]
    {
        ReleaseManifests,
        FeatureFlags,
        SliceCutoverStates,
        ShadowCompareReports,
        RuntimeInvariantChecks,
        GateResults,
        RollbackInstructions
    };

    public static readonly IReadOnlyList<DbTableContract> ShadowRuntimeTables = new[]
    {
        ShadowCommandSubmissions,
        ShadowDomainEvents,
        ShadowLedgerEntries,
        ShadowLensSnapshots,
        ShadowCompareInputs
    };

    public static readonly IReadOnlyList<string> ReleaseStatuses = new[]
    {
        "planned", "built", "shadow", "pilot", "active", "locked", "paused",
        "rollback", "compensating", "rejected"
    };

    public static readonly IReadOnlyList<string> FeatureFlagStatuses = new[]
    {
        "disabled", "shadow", "pilot", "active", "paused", "retired"
    };

    public static readonly IReadOnlyList<string> RuntimeModes = new[]
    {
        "legacy", "shadow", "pilot", "active", "rollback", "locked", "paused"
    };

    public static readonly IReadOnlyList<string> GateStatuses = new[]
    {
        "passed", "failed", "blocked", "warning", "not_run"
    };

    public static readonly IReadOnlyList<string> ShadowGrades = new[]
    {
        "green", "yellow", "red"
    };

    public static readonly IReadOnlyList<string> InvariantModes = new[]
    {
        "blocking", "observing"
    };

    public static readonly IReadOnlyList<string> InvariantSeverities = new[]
    {
        "P0", "P1", "P2"
    };

    public static readonly IReadOnlyList<string> RollbackInstructionTypes = new[]
    {
        "rollback", "compensating"
    };

    public static readonly IReadOnlyList<string> RollbackKinds = new[]
    {
        "feature_flag", "runtime_mode", "shadow_cleanup", "migration_down",
        "business_reversal", "business_correction", "manual_compensation"
    };
}

public sealed record DbTableContract(
    string Schema,
    string Table,
    IReadOnlyList<string> Columns);
