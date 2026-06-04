alter table operations_outbox_messages add column if not exists claimed_by text null;
alter table operations_outbox_messages add column if not exists claimed_at_utc timestamptz null;
alter table operations_outbox_messages add column if not exists claim_expires_at_utc timestamptz null;
alter table operations_outbox_messages add column if not exists attempt_count integer not null default 0;
alter table operations_outbox_messages add column if not exists dead_lettered_at_utc timestamptz null;
alter table operations_outbox_messages add column if not exists last_error text null;

create index if not exists ix_operations_outbox_claimable
    on operations_outbox_messages(processed_at_utc, dead_lettered_at_utc, claim_expires_at_utc, created_at_utc);

create index if not exists ix_operations_outbox_dead_letter
    on operations_outbox_messages(dead_lettered_at_utc, created_at_utc)
    where dead_lettered_at_utc is not null;
