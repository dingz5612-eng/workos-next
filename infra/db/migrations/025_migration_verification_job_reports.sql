-- OAM current migration verification job reports.
-- Rollback note: WorkOSNext migrations are up-only. To reverse before
-- production use, add a compensating migration that event-log verification
-- reports, then drops these Control Plane tables.

create table if not exists control_plane.migration_verification_reports (
    report_id text primary key,
    release_id text not null,
    tenant_id text not null,
    status text not null,
    dry_run boolean not null,
    migration_dry_run jsonb not null,
    readonly_source_verification jsonb not null,
    source_mapping_report jsonb not null,
    projection_consistency_compare jsonb not null,
    rollback_note_validation jsonb not null,
    release_gate_refs jsonb not null,
    generated_by text not null,
    generated_at_utc timestamptz not null,
    constraint ck_migration_verification_reports_status
        check (status in ('passed', 'warning', 'failed')),
    constraint ck_migration_verification_reports_json_shape
        check (
            jsonb_typeof(migration_dry_run) = 'object'
            and jsonb_typeof(readonly_source_verification) = 'array'
            and jsonb_typeof(source_mapping_report) = 'array'
            and jsonb_typeof(projection_consistency_compare) = 'array'
            and jsonb_typeof(rollback_note_validation) = 'object'
            and jsonb_typeof(release_gate_refs) = 'array'
        ),
    constraint ck_migration_verification_reports_generated_by
        check (length(trim(generated_by)) > 0)
);

create index if not exists ix_migration_verification_reports_release_time
    on control_plane.migration_verification_reports(release_id, generated_at_utc desc);

create index if not exists ix_migration_verification_reports_tenant_time
    on control_plane.migration_verification_reports(tenant_id, generated_at_utc desc);

create table if not exists control_plane.explicit_reconciliation_review_reports (
    remediation_report_id text primary key,
    migration_report_id text not null references control_plane.migration_verification_reports(report_id) on delete restrict,
    release_id text not null,
    tenant_id text not null,
    status text not null,
    dry_run boolean not null,
    source text not null,
    phase text not null,
    mappings jsonb not null,
    remediation_plan jsonb not null,
    reconciliation_notes jsonb not null,
    source_lock jsonb not null,
    release_gate_refs jsonb not null,
    generated_by text not null,
    generated_at_utc timestamptz not null,
    constraint ck_explicit_reconciliation_review_reports_status
        check (status in ('passed', 'warning', 'failed')),
    constraint ck_explicit_reconciliation_review_reports_source
        check (source = 'migration_readonly_source'),
    constraint ck_explicit_reconciliation_review_reports_json_shape
        check (
            jsonb_typeof(mappings) = 'array'
            and jsonb_typeof(remediation_plan) = 'array'
            and jsonb_typeof(reconciliation_notes) = 'array'
            and jsonb_typeof(source_lock) = 'object'
            and jsonb_typeof(release_gate_refs) = 'array'
        ),
    constraint ck_explicit_reconciliation_review_reports_generated_by
        check (length(trim(generated_by)) > 0)
);

create index if not exists ix_explicit_reconciliation_review_reports_release_time
    on control_plane.explicit_reconciliation_review_reports(release_id, generated_at_utc desc);

create index if not exists ix_explicit_reconciliation_review_reports_tenant_time
    on control_plane.explicit_reconciliation_review_reports(tenant_id, generated_at_utc desc);

create table if not exists control_plane.source_locks (
    source_lock_id text primary key,
    release_id text not null,
    tenant_id text not null,
    source_slice text not null,
    registry_version text not null,
    status text not null,
    locked_tables jsonb not null,
    reason text not null,
    locked_by text not null,
    locked_at_utc timestamptz not null,
    constraint ck_source_locks_status
        check (status in ('locked', 'proposed', 'superseded')),
    constraint ck_source_locks_tables
        check (jsonb_typeof(locked_tables) = 'array'),
    constraint ck_source_locks_reason
        check (length(trim(reason)) > 0)
);

create index if not exists ix_source_locks_release_time
    on control_plane.source_locks(release_id, locked_at_utc desc);

comment on table control_plane.migration_verification_reports is
    'Machine-generated migration verification evidence: dry-run, readonly source verification, source mapping, projection consistency compare, rollback note validation, and gate refs.';

comment on table control_plane.explicit_reconciliation_review_reports is
    'Machine-generated dry-run explicit reconciliation review plan. It never converts readonly source rows into new business facts without explicit audited apply mode.';

comment on table control_plane.source_locks is
    'Marks Workspace/Card source paths and ledger source tables as locked for release control evidence.';
