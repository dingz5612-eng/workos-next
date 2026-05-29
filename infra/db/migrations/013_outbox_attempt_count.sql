alter table outbox_messages add column if not exists attempt_count integer not null default 0;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_name = 'outbox_messages'
          and column_name = 'retry_count'
    ) then
        update outbox_messages
        set attempt_count = greatest(attempt_count, retry_count);

        alter table outbox_messages drop column retry_count;
    end if;
end $$;
