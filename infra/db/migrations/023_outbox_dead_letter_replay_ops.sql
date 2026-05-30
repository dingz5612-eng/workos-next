-- Final Ops outbox dead-letter replay audit.
-- Rollback note: WorkOSNext migrations are up-only. If this ops schema must be
-- removed before production use, archive outbox_dead_letter_replay_audits first,
-- then drop the audit table in a reviewed compensating migration.

create table if not exists outbox_dead_letter_replay_audits (
    replay_audit_id text primary key,
    message_id text not null,
    tenant_id text not null,
    event_id text not null,
    event_type text not null,
    action text not null,
    status text not null,
    actor_id text not null,
    reason text not null,
    attempt_count integer not null,
    dead_lettered_at_utc timestamptz null,
    details jsonb not null,
    created_at_utc timestamptz not null,
    constraint ck_outbox_replay_audits_action
        check (action in ('replay', 'ignore')),
    constraint ck_outbox_replay_audits_status
        check (status in ('replay_queued', 'ignored', 'already_processed', 'already_pending', 'not_found', 'failed')),
    constraint ck_outbox_replay_audits_reason
        check (length(trim(reason)) > 0),
    constraint ck_outbox_replay_audits_attempt_count
        check (attempt_count >= 0),
    constraint ck_outbox_replay_audits_details
        check (jsonb_typeof(details) = 'object')
);

create index if not exists ix_outbox_replay_audits_message_created
    on outbox_dead_letter_replay_audits(message_id, created_at_utc desc);

create index if not exists ix_outbox_replay_audits_tenant_created
    on outbox_dead_letter_replay_audits(tenant_id, created_at_utc desc);

create index if not exists ix_outbox_replay_audits_event_type_created
    on outbox_dead_letter_replay_audits(event_type, created_at_utc desc);
