-- V5.4 Control Plane and Shadow Runtime namespaces.
-- Rollback note: the current WorkOSNext migration runner is up-only.
-- If an approved rollback is required before data is retained, run a reviewed
-- compensating migration that drops shadow_runtime first, then control_plane:
-- drop schema if exists shadow_runtime cascade;
-- drop schema if exists control_plane cascade;

create schema if not exists control_plane;
create schema if not exists shadow_runtime;

create table if not exists control_plane.release_manifests (
    release_id text primary key,
    mr_id text not null,
    release_name text not null,
    status text not null,
    owners jsonb not null default '[]'::jsonb,
    commit_sha text null,
    migration_version text null,
    definition_version text not null,
    api_schema_hash text null,
    ci_run_id text null,
    gate_result_id text null,
    rollback_instruction_id text null,
    feature_flag_ids jsonb not null default '[]'::jsonb,
    slice_cutover_state_ids jsonb not null default '[]'::jsonb,
    shadow_compare_report_ids jsonb not null default '[]'::jsonb,
    invariant_check_ids jsonb not null default '[]'::jsonb,
    acceptance_scenarios jsonb not null default '[]'::jsonb,
    go_criteria jsonb not null default '[]'::jsonb,
    no_go_criteria jsonb not null default '[]'::jsonb,
    known_risks jsonb not null default '[]'::jsonb,
    created_at_utc timestamptz not null default now(),
    updated_at_utc timestamptz not null default now(),
    released_at_utc timestamptz null,
    locked_at_utc timestamptz null,
    constraint ck_release_manifests_status
        check (status in ('planned', 'built', 'shadow', 'pilot', 'active', 'locked', 'paused', 'rollback', 'compensating', 'rejected')),
    constraint ck_release_manifests_json_arrays
        check (
            jsonb_typeof(owners) = 'array' and
            jsonb_typeof(feature_flag_ids) = 'array' and
            jsonb_typeof(slice_cutover_state_ids) = 'array' and
            jsonb_typeof(shadow_compare_report_ids) = 'array' and
            jsonb_typeof(invariant_check_ids) = 'array' and
            jsonb_typeof(acceptance_scenarios) = 'array' and
            jsonb_typeof(go_criteria) = 'array' and
            jsonb_typeof(no_go_criteria) = 'array' and
            jsonb_typeof(known_risks) = 'array'
        )
);

create table if not exists control_plane.feature_flags (
    feature_flag_id text primary key,
    release_id text not null references control_plane.release_manifests(release_id) on delete cascade,
    flag_key text not null,
    description text not null,
    status text not null,
    scope_rules jsonb not null default '{}'::jsonb,
    default_behavior jsonb not null default '{}'::jsonb,
    created_by text not null,
    created_at_utc timestamptz not null default now(),
    updated_at_utc timestamptz not null default now(),
    expires_at_utc timestamptz null,
    constraint ck_feature_flags_status
        check (status in ('disabled', 'shadow', 'pilot', 'active', 'paused', 'retired')),
    constraint uq_feature_flags_release_flag_key unique(release_id, flag_key),
    constraint ck_feature_flags_scope_rules_shape
        check (
            jsonb_typeof(scope_rules) = 'object' and
            jsonb_typeof(default_behavior) = 'object' and
            (not scope_rules ? 'tenantIds' or jsonb_typeof(scope_rules->'tenantIds') = 'array') and
            (not scope_rules ? 'sliceIds' or jsonb_typeof(scope_rules->'sliceIds') = 'array') and
            (not scope_rules ? 'roles' or jsonb_typeof(scope_rules->'roles') = 'array') and
            (not scope_rules ? 'actorIds' or jsonb_typeof(scope_rules->'actorIds') = 'array') and
            (not scope_rules ? 'deviceIds' or jsonb_typeof(scope_rules->'deviceIds') = 'array') and
            (not scope_rules ? 'deviceTrust' or jsonb_typeof(scope_rules->'deviceTrust') = 'array') and
            (not scope_rules ? 'percentage' or jsonb_typeof(scope_rules->'percentage') = 'number') and
            (not scope_rules ? 'amount' or (
                jsonb_typeof(scope_rules->'amount') = 'object' and
                (not (scope_rules->'amount') ? 'currency' or jsonb_typeof(scope_rules #> '{amount,currency}') = 'string') and
                (not (scope_rules->'amount') ? 'lte' or jsonb_typeof(scope_rules #> '{amount,lte}') = 'number') and
                (not (scope_rules->'amount') ? 'gte' or jsonb_typeof(scope_rules #> '{amount,gte}') = 'number')
            ))
        )
);

create table if not exists control_plane.slice_cutover_states (
    cutover_state_id text primary key,
    release_id text not null references control_plane.release_manifests(release_id) on delete cascade,
    tenant_id text not null,
    slice_id text not null,
    runtime_mode text not null,
    previous_runtime_mode text null,
    enabled_roles jsonb not null default '[]'::jsonb,
    enabled_actor_ids jsonb not null default '[]'::jsonb,
    enabled_device_ids jsonb not null default '[]'::jsonb,
    amount_threshold jsonb not null default '{}'::jsonb,
    enabled_percentage numeric(5, 2) null,
    dependency_status jsonb not null default '{}'::jsonb,
    last_shadow_compare_report_id text null,
    last_gate_result_id text null,
    rollback_instruction_id text null,
    started_at_utc timestamptz not null default now(),
    updated_at_utc timestamptz not null default now(),
    ended_at_utc timestamptz null,
    constraint ck_slice_cutover_states_runtime_mode
        check (runtime_mode in ('legacy', 'shadow', 'pilot', 'active', 'rollback', 'locked', 'paused')),
    constraint ck_slice_cutover_states_previous_runtime_mode
        check (previous_runtime_mode is null or previous_runtime_mode in ('legacy', 'shadow', 'pilot', 'active', 'rollback', 'locked', 'paused')),
    constraint uq_slice_cutover_states_release_tenant_slice unique(release_id, tenant_id, slice_id),
    constraint ck_slice_cutover_states_scope_shape
        check (
            jsonb_typeof(enabled_roles) = 'array' and
            jsonb_typeof(enabled_actor_ids) = 'array' and
            jsonb_typeof(enabled_device_ids) = 'array' and
            jsonb_typeof(dependency_status) = 'object' and
            jsonb_typeof(amount_threshold) = 'object' and
            (enabled_percentage is null or (enabled_percentage >= 0 and enabled_percentage <= 100)) and
            (not amount_threshold ? 'currency' or jsonb_typeof(amount_threshold->'currency') = 'string') and
            (not amount_threshold ? 'lte' or jsonb_typeof(amount_threshold->'lte') = 'number') and
            (not amount_threshold ? 'gte' or jsonb_typeof(amount_threshold->'gte') = 'number')
        )
);

create table if not exists control_plane.shadow_compare_reports (
    shadow_compare_report_id text primary key,
    release_id text not null references control_plane.release_manifests(release_id) on delete cascade,
    tenant_id text not null,
    slice_id text not null,
    compare_scope jsonb not null default '{}'::jsonb,
    source_legacy_ref text null,
    source_active_ref text null,
    source_shadow_ref text null,
    compared_at_utc timestamptz not null default now(),
    grade text not null,
    total_compared integer not null default 0,
    matched_count integer not null default 0,
    mismatch_count integer not null default 0,
    missing_in_shadow_count integer not null default 0,
    extra_in_shadow_count integer not null default 0,
    mismatch_examples jsonb not null default '[]'::jsonb,
    summary jsonb not null default '{}'::jsonb,
    generated_by text not null,
    ci_run_id text null,
    constraint ck_shadow_compare_reports_grade
        check (grade in ('green', 'yellow', 'red')),
    constraint ck_shadow_compare_reports_counts
        check (
            total_compared >= 0 and
            matched_count >= 0 and
            mismatch_count >= 0 and
            missing_in_shadow_count >= 0 and
            extra_in_shadow_count >= 0
        ),
    constraint ck_shadow_compare_reports_json_shape
        check (
            jsonb_typeof(compare_scope) = 'object' and
            jsonb_typeof(mismatch_examples) = 'array' and
            jsonb_typeof(summary) = 'object'
        )
);

create table if not exists control_plane.runtime_invariant_checks (
    invariant_check_id text primary key,
    release_id text not null references control_plane.release_manifests(release_id) on delete cascade,
    tenant_id text not null,
    slice_id text not null,
    invariant_key text not null,
    description text not null,
    mode text not null,
    severity text not null,
    source_type text not null,
    check_sql text null,
    check_ref text null,
    status text not null,
    observed_value jsonb not null default '{}'::jsonb,
    threshold jsonb not null default '{}'::jsonb,
    violation_count integer not null default 0,
    sample_violations jsonb not null default '[]'::jsonb,
    generated_by text not null,
    ci_run_id text null,
    checked_at_utc timestamptz not null default now(),
    constraint ck_runtime_invariant_checks_mode
        check (mode in ('blocking', 'observing')),
    constraint ck_runtime_invariant_checks_severity
        check (severity in ('P0', 'P1', 'P2')),
    constraint ck_runtime_invariant_checks_shape
        check (
            violation_count >= 0 and
            jsonb_typeof(observed_value) = 'object' and
            jsonb_typeof(threshold) = 'object' and
            jsonb_typeof(sample_violations) = 'array'
        )
);

create table if not exists control_plane.gate_results (
    gate_result_id text primary key,
    release_id text not null references control_plane.release_manifests(release_id) on delete cascade,
    mr_id text not null,
    tenant_id text null,
    slice_id text null,
    gate_name text not null,
    gate_type text not null,
    status text not null,
    severity text not null,
    ci_run_id text null,
    automated_test_refs jsonb not null default '[]'::jsonb,
    invariant_check_refs jsonb not null default '[]'::jsonb,
    shadow_compare_report_refs jsonb not null default '[]'::jsonb,
    business_signoff_refs jsonb not null default '[]'::jsonb,
    no_go_items jsonb not null default '[]'::jsonb,
    go_items jsonb not null default '[]'::jsonb,
    known_risks jsonb not null default '[]'::jsonb,
    generated_by text not null,
    generated_at_utc timestamptz not null default now(),
    input_hash text not null,
    result_hash text not null,
    constraint ck_gate_results_status
        check (status in ('passed', 'failed', 'blocked', 'warning', 'not_run')),
    constraint ck_gate_results_severity
        check (severity in ('P0', 'P1', 'P2')),
    constraint ck_gate_results_json_arrays
        check (
            jsonb_typeof(automated_test_refs) = 'array' and
            jsonb_typeof(invariant_check_refs) = 'array' and
            jsonb_typeof(shadow_compare_report_refs) = 'array' and
            jsonb_typeof(business_signoff_refs) = 'array' and
            jsonb_typeof(no_go_items) = 'array' and
            jsonb_typeof(go_items) = 'array' and
            jsonb_typeof(known_risks) = 'array'
        )
);

create table if not exists control_plane.rollback_instructions (
    rollback_instruction_id text primary key,
    release_id text not null references control_plane.release_manifests(release_id) on delete cascade,
    instruction_type text not null,
    rollback_kind text not null,
    title text not null,
    scope jsonb not null default '{}'::jsonb,
    allowed_before_status jsonb not null default '[]'::jsonb,
    allowed_after_status jsonb not null default '[]'::jsonb,
    steps jsonb not null default '[]'::jsonb,
    validation_steps jsonb not null default '[]'::jsonb,
    owner text not null,
    risk_level text not null,
    requires_business_approval boolean not null default false,
    requires_architecture_approval boolean not null default false,
    requires_finance_approval boolean not null default false,
    created_at_utc timestamptz not null default now(),
    updated_at_utc timestamptz not null default now(),
    constraint ck_rollback_instructions_instruction_type
        check (instruction_type in ('rollback', 'compensating')),
    constraint ck_rollback_instructions_rollback_kind
        check (rollback_kind in ('feature_flag', 'runtime_mode', 'shadow_cleanup', 'migration_down', 'business_reversal', 'business_correction', 'manual_compensation')),
    constraint ck_rollback_instructions_json_shape
        check (
            jsonb_typeof(scope) = 'object' and
            jsonb_typeof(allowed_before_status) = 'array' and
            jsonb_typeof(allowed_after_status) = 'array' and
            jsonb_typeof(steps) = 'array' and
            jsonb_typeof(validation_steps) = 'array'
        )
);

create table if not exists shadow_runtime.command_submissions (
    command_submission_id text primary key,
    release_id text null,
    tenant_id text not null,
    slice_id text not null,
    workspace_id text null,
    card_id text null,
    idempotency_key text not null,
    submitted_at_utc timestamptz not null default now(),
    actor_ref jsonb not null default '{}'::jsonb,
    command_payload jsonb not null default '{}'::jsonb,
    source_active_ref text null,
    source_shadow_ref text null,
    processing_status text not null default 'pending',
    constraint uq_shadow_command_submission_idempotency unique(tenant_id, slice_id, idempotency_key),
    constraint ck_shadow_command_submissions_json_shape
        check (jsonb_typeof(actor_ref) = 'object' and jsonb_typeof(command_payload) = 'object')
);

create table if not exists shadow_runtime.domain_events (
    shadow_event_id text primary key,
    command_submission_id text not null references shadow_runtime.command_submissions(command_submission_id) on delete cascade,
    event_type text not null,
    aggregate_ref text not null,
    occurred_at_utc timestamptz not null default now(),
    event_payload jsonb not null default '{}'::jsonb,
    event_hash text not null,
    constraint ck_shadow_domain_events_payload_shape
        check (jsonb_typeof(event_payload) = 'object')
);

create table if not exists shadow_runtime.ledger_entries (
    shadow_ledger_entry_id text primary key,
    command_submission_id text not null references shadow_runtime.command_submissions(command_submission_id) on delete cascade,
    ledger_type text not null,
    account_ref text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    direction text not null,
    entry_payload jsonb not null default '{}'::jsonb,
    created_at_utc timestamptz not null default now(),
    constraint ck_shadow_ledger_entries_direction
        check (direction in ('debit', 'credit')),
    constraint ck_shadow_ledger_entries_payload_shape
        check (jsonb_typeof(entry_payload) = 'object')
);

create table if not exists shadow_runtime.lens_snapshots (
    lens_snapshot_id text primary key,
    release_id text null,
    tenant_id text not null,
    slice_id text not null,
    lens_id text not null,
    snapshot_at_utc timestamptz not null default now(),
    lens_payload jsonb not null default '{}'::jsonb,
    payload_hash text not null,
    constraint ck_shadow_lens_snapshots_payload_shape
        check (jsonb_typeof(lens_payload) = 'object')
);

create table if not exists shadow_runtime.compare_inputs (
    compare_input_id text primary key,
    release_id text null,
    tenant_id text not null,
    slice_id text not null,
    command_submission_id text null references shadow_runtime.command_submissions(command_submission_id) on delete set null,
    source_legacy_ref text null,
    source_active_ref text null,
    source_shadow_ref text null,
    input_payload jsonb not null default '{}'::jsonb,
    captured_at_utc timestamptz not null default now(),
    constraint ck_shadow_compare_inputs_payload_shape
        check (jsonb_typeof(input_payload) = 'object')
);

create index if not exists ix_release_manifests_status
    on control_plane.release_manifests(status, updated_at_utc);

create index if not exists ix_feature_flags_release_status
    on control_plane.feature_flags(release_id, status);

create index if not exists ix_slice_cutover_states_mode
    on control_plane.slice_cutover_states(runtime_mode, updated_at_utc);

create index if not exists ix_shadow_compare_reports_release_slice
    on control_plane.shadow_compare_reports(release_id, tenant_id, slice_id, compared_at_utc);

create index if not exists ix_runtime_invariant_checks_release_slice
    on control_plane.runtime_invariant_checks(release_id, tenant_id, slice_id, checked_at_utc);

create index if not exists ix_gate_results_release_status
    on control_plane.gate_results(release_id, status, generated_at_utc);

create index if not exists ix_shadow_command_submissions_scope
    on shadow_runtime.command_submissions(release_id, tenant_id, slice_id, submitted_at_utc);

create index if not exists ix_shadow_domain_events_submission
    on shadow_runtime.domain_events(command_submission_id, event_type);

create index if not exists ix_shadow_ledger_entries_submission
    on shadow_runtime.ledger_entries(command_submission_id, ledger_type);

create index if not exists ix_shadow_lens_snapshots_scope
    on shadow_runtime.lens_snapshots(release_id, tenant_id, slice_id, lens_id, snapshot_at_utc);

create index if not exists ix_shadow_compare_inputs_scope
    on shadow_runtime.compare_inputs(release_id, tenant_id, slice_id, captured_at_utc);
