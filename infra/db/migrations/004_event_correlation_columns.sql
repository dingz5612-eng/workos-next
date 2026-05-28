alter table audit_events add column if not exists correlation_id text null;
alter table audit_events add column if not exists causation_id text null;
alter table audit_events add column if not exists request_id text null;

update audit_events
set correlation_id = coalesce(correlation_id, idempotency_key, event_id),
    request_id = coalesce(request_id, idempotency_key, event_id)
where correlation_id is null or request_id is null;

alter table audit_events alter column correlation_id set not null;
alter table audit_events alter column request_id set not null;

create index if not exists ix_audit_events_correlation on audit_events(correlation_id, occurred_at_utc);
create index if not exists ix_audit_events_request on audit_events(request_id, occurred_at_utc);

alter table outbox_messages add column if not exists correlation_id text null;
alter table outbox_messages add column if not exists causation_id text null;
alter table outbox_messages add column if not exists request_id text null;

update outbox_messages
set correlation_id = coalesce(correlation_id, idempotency_key, event_id),
    causation_id = coalesce(causation_id, event_id),
    request_id = coalesce(request_id, idempotency_key, event_id)
where correlation_id is null or request_id is null;

alter table outbox_messages alter column correlation_id set not null;
alter table outbox_messages alter column request_id set not null;

create index if not exists ix_outbox_correlation on outbox_messages(correlation_id, created_at_utc);
create index if not exists ix_outbox_request on outbox_messages(request_id, created_at_utc);
