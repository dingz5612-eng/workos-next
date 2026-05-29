alter table outbox_messages add column if not exists claimed_by text null;
alter table outbox_messages add column if not exists claimed_at_utc timestamptz null;
alter table outbox_messages add column if not exists claim_expires_at_utc timestamptz null;
alter table outbox_messages add column if not exists retry_count integer not null default 0;
alter table outbox_messages add column if not exists dead_lettered_at_utc timestamptz null;
alter table outbox_messages add column if not exists last_error text null;

create index if not exists ix_outbox_claimable
    on outbox_messages(processed_at_utc, dead_lettered_at_utc, claim_expires_at_utc, created_at_utc);

create index if not exists ix_outbox_dead_letter
    on outbox_messages(dead_lettered_at_utc, created_at_utc)
    where dead_lettered_at_utc is not null;
