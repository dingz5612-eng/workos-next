-- Rollback note: WorkOSNext migrations are up-only. To reverse before
-- production use, add a reviewed compensating migration that archives
-- operations_* rows, drops child tables first, and then drops
-- operations_command_submissions.

create table if not exists operations_command_submissions (
    submission_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    idempotency_scope text not null,
    idempotency_key text not null,
    payload_hash text not null,
    command_type text not null,
    schema_version text not null,
    definition_version_id text not null,
    status text not null,
    submitted_at_utc timestamptz not null,
    completed_at_utc timestamptz null,
    envelope jsonb not null,
    stable_response jsonb null,
    constraint uq_operations_command_submission_idempotency
        unique(tenant_id, idempotency_scope, idempotency_key),
    constraint ck_operations_command_submissions_status
        check (status in ('pending', 'committed', 'rejected')),
    constraint ck_operations_command_submissions_envelope_shape
        check (jsonb_typeof(envelope) = 'object'),
    constraint ck_operations_command_submissions_response_shape
        check (stable_response is null or jsonb_typeof(stable_response) = 'object')
);

create table if not exists operations_domain_events (
    event_id text primary key,
    submission_id text not null references operations_command_submissions(submission_id) on delete restrict,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    causation_id text not null,
    correlation_id text not null,
    event_type text not null,
    occurred_at_utc timestamptz not null,
    payload jsonb not null,
    constraint ck_operations_domain_events_payload_shape
        check (jsonb_typeof(payload) = 'object')
);

create table if not exists operations_work_item_events (
    work_item_event_id text primary key,
    submission_id text not null references operations_command_submissions(submission_id) on delete restrict,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    event_type text not null,
    from_state text null,
    to_state text null,
    occurred_at_utc timestamptz not null,
    payload jsonb not null,
    constraint ck_operations_work_item_events_payload_shape
        check (jsonb_typeof(payload) = 'object')
);

create table if not exists operations_outbox_messages (
    message_id text primary key,
    event_id text not null,
    submission_id text not null references operations_command_submissions(submission_id) on delete restrict,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    message_type text not null,
    created_at_utc timestamptz not null,
    processed_at_utc timestamptz null,
    payload jsonb not null,
    constraint ck_operations_outbox_messages_payload_shape
        check (jsonb_typeof(payload) = 'object')
);

create table if not exists operations_fact_responses (
    response_id text primary key,
    submission_id text not null references operations_command_submissions(submission_id) on delete restrict,
    tenant_id text not null,
    status_code integer not null,
    commit_status text not null,
    projection_status text not null,
    stable_response jsonb not null,
    constraint uq_operations_fact_responses_submission unique(submission_id),
    constraint ck_operations_fact_responses_commit_status
        check (commit_status in ('committed', 'not_committed')),
    constraint ck_operations_fact_responses_projection_status
        check (projection_status in ('projected', 'pending', 'failed', 'not_projected')),
    constraint ck_operations_fact_responses_shape
        check (jsonb_typeof(stable_response) = 'object')
);

create index if not exists ix_operations_command_submissions_scope
    on operations_command_submissions(tenant_id, idempotency_scope, submitted_at_utc);

create index if not exists ix_operations_domain_events_submission
    on operations_domain_events(tenant_id, submission_id, event_type);

create index if not exists ix_operations_work_item_events_work_item
    on operations_work_item_events(tenant_id, work_item_id, occurred_at_utc);

create index if not exists ix_operations_outbox_pending
    on operations_outbox_messages(processed_at_utc, created_at_utc);
