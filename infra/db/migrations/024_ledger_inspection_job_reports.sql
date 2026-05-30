-- V5.4 ledger inspection job reports.
-- Rollback note: WorkOSNext migrations are up-only. To reverse before
-- production use, add a compensating migration that archives
-- control_plane.ledger_inspection_job_reports, then drops this table.

create table if not exists control_plane.ledger_inspection_job_reports (
    job_run_id text primary key,
    release_id text not null,
    tenant_id text not null,
    job_mode text not null,
    status text not null,
    ci_run_id text null,
    invariant_check_ids jsonb not null,
    report jsonb not null,
    dashboard_summary jsonb not null,
    generated_by text not null,
    generated_at_utc timestamptz not null,
    constraint ck_ledger_inspection_job_reports_mode
        check (job_mode in ('daily', 'manual', 'release_gate')),
    constraint ck_ledger_inspection_job_reports_status
        check (status in ('passed', 'warning', 'failed')),
    constraint ck_ledger_inspection_job_reports_json_shape
        check (
            jsonb_typeof(invariant_check_ids) = 'array'
            and jsonb_typeof(report) = 'object'
            and jsonb_typeof(dashboard_summary) = 'object'
        ),
    constraint ck_ledger_inspection_job_reports_generated_by
        check (length(trim(generated_by)) > 0)
);

create index if not exists ix_ledger_inspection_job_reports_tenant_time
    on control_plane.ledger_inspection_job_reports(tenant_id, generated_at_utc desc);

create index if not exists ix_ledger_inspection_job_reports_release_time
    on control_plane.ledger_inspection_job_reports(release_id, generated_at_utc desc);

create index if not exists ix_ledger_inspection_job_reports_status
    on control_plane.ledger_inspection_job_reports(status, generated_at_utc desc);

comment on table control_plane.ledger_inspection_job_reports is
    'Machine-generated daily/manual/release-gate ledger inspection report. Report rows bind runtime_invariant_checks to PC dashboard summaries.';
