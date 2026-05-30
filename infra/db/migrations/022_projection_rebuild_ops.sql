-- Final Ops projection rebuild checkpoints and audit.
-- Rollback note: WorkOSNext migrations are up-only. If this ops schema must be
-- removed before production use, archive projection_rebuild_audits and
-- projection_checkpoints first, then drop these two tables in a reviewed
-- compensating migration.

create table if not exists projection_rebuild_audits (
    rebuild_id text primary key,
    tenant_id text not null,
    lens_name text null,
    from_event_id text null,
    to_event_id text null,
    dry_run boolean not null,
    status text not null,
    requested_by text not null,
    before_hash text not null,
    after_hash text not null,
    mismatch_count integer not null,
    checkpoint_ids jsonb not null,
    details jsonb not null,
    created_at_utc timestamptz not null,
    constraint ck_projection_rebuild_audits_status
        check (status in ('matched', 'mismatched', 'failed')),
    constraint ck_projection_rebuild_audits_mismatch_count
        check (mismatch_count >= 0),
    constraint ck_projection_rebuild_audits_json_shape
        check (
            jsonb_typeof(checkpoint_ids) = 'array'
            and jsonb_typeof(details) = 'object'
        )
);

create index if not exists ix_projection_rebuild_audits_tenant_created
    on projection_rebuild_audits(tenant_id, created_at_utc desc);

create index if not exists ix_projection_rebuild_audits_lens_created
    on projection_rebuild_audits(lens_name, created_at_utc desc);

create table if not exists projection_checkpoints (
    checkpoint_id text primary key,
    rebuild_id text not null references projection_rebuild_audits(rebuild_id) on delete restrict,
    tenant_id text not null,
    lens_name text not null,
    from_event_id text null,
    to_event_id text null,
    source_event_high_watermark text null,
    payload_hash text not null,
    row_count integer not null,
    body jsonb not null,
    created_at_utc timestamptz not null,
    constraint ck_projection_checkpoints_row_count
        check (row_count >= 0),
    constraint ck_projection_checkpoints_body_array
        check (jsonb_typeof(body) = 'array')
);

create index if not exists ix_projection_checkpoints_tenant_lens_created
    on projection_checkpoints(tenant_id, lens_name, created_at_utc desc);
