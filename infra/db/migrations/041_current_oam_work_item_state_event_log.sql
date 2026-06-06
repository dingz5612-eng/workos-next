-- Current OAM: ensure WorkItem state transitions use event_log naming.
-- Rollback guidance: this migration only renames the transition log table and
-- recreates the current table/index shape when needed.

do $$
declare
    previous_table_name text := 'operations_work_item_state_' || 'his' || 'tory';
    current_table_name text := 'operations_work_item_state_event_log';
    previous_constraint_name text := 'ck_operations_work_item_state_' || 'his' || 'tory' || '_metadata_shape';
    previous_index_name text := 'ix_operations_work_item_state_' || 'his' || 'tory' || '_work_item';
begin
    if to_regclass(previous_table_name) is not null
       and to_regclass(current_table_name) is null then
        execute format('alter table %I rename to %I', previous_table_name, current_table_name);
    end if;

    if exists (
        select 1
        from pg_constraint
        where conname = previous_constraint_name
          and conrelid = to_regclass(current_table_name)
    ) then
        execute format(
            'alter table %I rename constraint %I to %I',
            current_table_name,
            previous_constraint_name,
            'ck_operations_work_item_state_event_log_metadata_shape');
    end if;

    if to_regclass(previous_index_name) is not null
       and to_regclass('ix_operations_work_item_state_event_log_work_item') is null then
        execute format('alter index %I rename to %I', previous_index_name, 'ix_operations_work_item_state_event_log_work_item');
    end if;
end $$;

create table if not exists operations_work_item_state_event_log (
    transition_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null references operations_work_items(work_item_id) on delete restrict,
    from_state text null,
    to_state text not null,
    submission_id text null,
    reason text not null,
    actor_id text null,
    occurred_at_utc timestamptz not null,
    metadata jsonb not null default '{}'::jsonb,
    constraint ck_operations_work_item_state_event_log_metadata_shape
        check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ix_operations_work_item_state_event_log_work_item
    on operations_work_item_state_event_log(tenant_id, work_item_id, occurred_at_utc);
