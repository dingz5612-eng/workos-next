create table if not exists runtime_documents (
    id text primary key,
    body jsonb not null,
    updated_at_utc timestamptz not null
);

create table if not exists audit_events (
    event_id text primary key,
    idempotency_key text null unique,
    workspace_id text not null,
    card_id text not null,
    event_type text not null,
    actor_type text not null,
    actor_id text not null,
    occurred_at_utc timestamptz not null,
    body jsonb not null
);

create index if not exists ix_audit_events_workspace on audit_events(workspace_id, occurred_at_utc);

create table if not exists outbox_messages (
    message_id text primary key,
    event_id text not null,
    idempotency_key text null,
    workspace_id text not null,
    card_id text not null,
    event_type text not null,
    created_at_utc timestamptz not null,
    processed_at_utc timestamptz null,
    body jsonb not null
);

create index if not exists ix_outbox_pending on outbox_messages(processed_at_utc, created_at_utc);

create table if not exists behavior_events (
    event_id text primary key,
    event_type text not null,
    object_type text null,
    object_id text null,
    language text not null,
    source text null,
    occurred_at_utc timestamptz not null,
    body jsonb not null
);

create index if not exists ix_behavior_events_object on behavior_events(object_type, object_id, occurred_at_utc);
