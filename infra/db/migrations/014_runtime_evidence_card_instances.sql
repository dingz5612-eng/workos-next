create table if not exists card_instances (
    card_instance_id text primary key,
    workspace_id text not null,
    card_id text not null,
    aggregate_ref text null,
    submission_id text null,
    idempotency_key text null,
    status text not null,
    created_at_utc timestamptz not null,
    prepared_at_utc timestamptz null,
    submitted_at_utc timestamptz null,
    confirmed_at_utc timestamptz null,
    rejected_at_utc timestamptz null,
    superseded_at_utc timestamptz null,
    expired_at_utc timestamptz null,
    updated_at_utc timestamptz not null
);

create index if not exists ix_card_instances_workspace_card_aggregate
    on card_instances(workspace_id, card_id, aggregate_ref, status);

create table if not exists evidence_objects (
    evidence_id text primary key,
    workspace_id text not null,
    card_id text not null,
    card_instance_id text not null,
    submission_id text not null,
    requirement_id text not null,
    status text not null,
    created_by text not null,
    created_at_utc timestamptz not null,
    attached_at_utc timestamptz null,
    verified_by text null,
    verified_at_utc timestamptz null,
    rejected_by text null,
    rejected_at_utc timestamptz null,
    used_event_id text null,
    used_submission_id text null,
    used_at_utc timestamptz null,
    audit_trail jsonb not null default '[]'::jsonb
);

create index if not exists ix_evidence_objects_scope
    on evidence_objects(workspace_id, card_id, card_instance_id, submission_id, requirement_id);

create table if not exists evidence_attachments (
    attachment_id text primary key,
    evidence_id text not null references evidence_objects(evidence_id),
    file_name text not null,
    content_type text not null,
    content_sha256 text not null,
    size_bytes bigint not null,
    attached_by text not null,
    attached_at_utc timestamptz not null
);

create table if not exists evidence_requirements (
    evidence_id text not null references evidence_objects(evidence_id),
    workspace_id text not null,
    card_id text not null,
    requirement_id text not null,
    required boolean not null default true,
    created_at_utc timestamptz not null,
    primary key(evidence_id, requirement_id)
);

create index if not exists ix_evidence_requirements_scope
    on evidence_requirements(workspace_id, card_id, requirement_id);
