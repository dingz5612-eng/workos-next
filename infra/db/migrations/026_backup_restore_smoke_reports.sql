-- V5.4 backup / restore smoke evidence.
-- Rollback note: WorkOSNext migrations are up-only. To reverse before
-- production use, add a compensating migration that archives
-- backup_restore_smoke_reports, then drops this Control Plane table.

create table if not exists control_plane.backup_restore_smoke_reports (
    report_id text primary key,
    release_id text not null,
    tenant_id text not null,
    status text not null,
    isolated_schema text not null,
    schema_backup jsonb not null,
    data_backup jsonb not null,
    restore_summary jsonb not null,
    key_query_results jsonb not null,
    projection_rebuild jsonb not null,
    invariant_results jsonb not null,
    release_gate_refs jsonb not null,
    generated_by text not null,
    generated_at_utc timestamptz not null,
    constraint ck_backup_restore_smoke_reports_status
        check (status in ('passed', 'failed')),
    constraint ck_backup_restore_smoke_reports_schema
        check (isolated_schema like 'backup_restore_smoke_%'),
    constraint ck_backup_restore_smoke_reports_json_shape
        check (
            jsonb_typeof(schema_backup) = 'object'
            and jsonb_typeof(data_backup) = 'object'
            and jsonb_typeof(restore_summary) = 'object'
            and jsonb_typeof(key_query_results) = 'array'
            and jsonb_typeof(projection_rebuild) = 'object'
            and jsonb_typeof(invariant_results) = 'array'
            and jsonb_typeof(release_gate_refs) = 'array'
        ),
    constraint ck_backup_restore_smoke_reports_generated_by
        check (length(trim(generated_by)) > 0)
);

create index if not exists ix_backup_restore_smoke_reports_release_time
    on control_plane.backup_restore_smoke_reports(release_id, generated_at_utc desc);

create index if not exists ix_backup_restore_smoke_reports_tenant_time
    on control_plane.backup_restore_smoke_reports(tenant_id, generated_at_utc desc);

comment on table control_plane.backup_restore_smoke_reports is
    'Machine-generated backup / restore smoke evidence: schema backup, data backup, isolated restore, key query counts, projection rebuild, and invariant runner results.';
