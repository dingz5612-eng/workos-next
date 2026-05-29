alter table outbox_messages add column if not exists attempt_count integer not null default 0;

update outbox_messages
set attempt_count = retry_count
where attempt_count = 0
  and retry_count > 0;

