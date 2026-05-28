alter table audit_events add column if not exists idempotency_key text null;

create unique index if not exists ux_audit_events_idempotency_key
    on audit_events(idempotency_key)
    where idempotency_key is not null;

alter table outbox_messages add column if not exists idempotency_key text null;
