-- V5.4 migration verification and legacy backfill freeze reports.
-- Rollback note: WorkOSNext migrations are up-only. To reverse before
-- production use, add a compensating migration that archives verification
-- reports and freeze rows, then drops these Control Plane tables.

create table if not exists control_plane.migration_verification_reports (
    report_id text primary key,
    release_id text not null,
    tenant_id text not null,
    status text not null,
    dry_run boolean not null,
    migration_dry_run jsonb not null,
    old_runtime_data_scan jsonb not null,
    legacy_mapping_report jsonb not null,
    old_view_new_lens_compare jsonb not null,
    rollback_note_validation jsonb not null,
    release_gate_refs jsonb not null,
    generated_by text not null,
    generated_at_utc timestamptz not null,
    constraint ck_migration_verification_reports_status
        check (status in ('passed', 'warning', 'failed')),
    constraint ck_migration_verification_reports_json_shape
        check (
            jsonb_typeof(migration_dry_run) = 'object'
            and jsonb_typeof(old_runtime_data_scan) = 'array'
            and jsonb_typeof(legacy_mapping_report) = 'array'
            and jsonb_typeof(old_view_new_lens_compare) = 'array'
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

create table if not exists control_plane.legacy_backfill_reports (
    backfill_report_id text primary key,
    migration_report_id text not null references control_plane.migration_verification_reports(report_id) on delete restrict,
    release_id text not null,
    tenant_id text not null,
    status text not null,
    dry_run boolean not null,
    source text not null,
    phase text not null,
    mappings jsonb not null,
    backfill_plan jsonb not null,
    reconciliation_notes jsonb not null,
    compatibility_freeze jsonb not null,
    release_gate_refs jsonb not null,
    generated_by text not null,
    generated_at_utc timestamptz not null,
    constraint ck_legacy_backfill_reports_status
        check (status in ('passed', 'warning', 'failed')),
    constraint ck_legacy_backfill_reports_source
        check (source = 'legacy_migration'),
    constraint ck_legacy_backfill_reports_json_shape
        check (
            jsonb_typeof(mappings) = 'array'
            and jsonb_typeof(backfill_plan) = 'array'
            and jsonb_typeof(reconciliation_notes) = 'array'
            and jsonb_typeof(compatibility_freeze) = 'object'
            and jsonb_typeof(release_gate_refs) = 'array'
        ),
    constraint ck_legacy_backfill_reports_generated_by
        check (length(trim(generated_by)) > 0)
);

create index if not exists ix_legacy_backfill_reports_release_time
    on control_plane.legacy_backfill_reports(release_id, generated_at_utc desc);

create index if not exists ix_legacy_backfill_reports_tenant_time
    on control_plane.legacy_backfill_reports(tenant_id, generated_at_utc desc);

create table if not exists control_plane.legacy_compatibility_freezes (
    freeze_id text primary key,
    release_id text not null,
    tenant_id text not null,
    source_slice text not null,
    registry_version text not null,
    status text not null,
    frozen_tables jsonb not null,
    reason text not null,
    frozen_by text not null,
    frozen_at_utc timestamptz not null,
    constraint ck_legacy_compatibility_freezes_status
        check (status in ('frozen', 'proposed', 'superseded')),
    constraint ck_legacy_compatibility_freezes_tables
        check (jsonb_typeof(frozen_tables) = 'array'),
    constraint ck_legacy_compatibility_freezes_reason
        check (length(trim(reason)) > 0)
);

create index if not exists ix_legacy_compatibility_freezes_release_time
    on control_plane.legacy_compatibility_freezes(release_id, frozen_at_utc desc);

comment on table control_plane.migration_verification_reports is
    'Machine-generated migration verification evidence: dry-run, old runtime scan, legacy mapping, old-vs-new compare, rollback note validation, and gate refs.';

comment on table control_plane.legacy_backfill_reports is
    'Machine-generated dry-run legacy backfill plan. It never converts legacy rows into new business facts without explicit audited apply mode.';

comment on table control_plane.legacy_compatibility_freezes is
    'Marks legacy Workspace/Card compatibility and legacy ledger tables as frozen for release control evidence.';
