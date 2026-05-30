-- Rollback note: WorkOSNext migrations are up-only. To reverse before
-- production use, add a compensating migration that archives process run
-- evidence and drops process intent/request tables in dependency order.

create table if not exists process_runs (
    process_run_id text primary key,
    tenant_id text not null,
    trigger_event_id text not null,
    trigger_event_type text not null,
    process_rule_id text not null,
    status text not null,
    created_at_utc timestamptz not null,
    body jsonb not null,
    constraint uq_process_runs_trigger_rule unique(tenant_id, trigger_event_id, process_rule_id)
);

create index if not exists ix_process_runs_tenant_rule on process_runs(tenant_id, process_rule_id, created_at_utc);

create table if not exists process_work_item_intents (
    intent_id text primary key,
    process_run_id text not null references process_runs(process_run_id),
    tenant_id text not null,
    work_item_id text not null,
    work_item_type text not null,
    target_workspace_id text not null,
    owner_role text not null,
    source_event_id text not null,
    status text not null,
    created_at_utc timestamptz not null,
    body jsonb not null
);

create index if not exists ix_process_work_item_intents_tenant on process_work_item_intents(tenant_id, work_item_type, created_at_utc);

create table if not exists process_request_event_intents (
    intent_id text primary key,
    process_run_id text not null references process_runs(process_run_id),
    tenant_id text not null,
    request_event_type text not null,
    target_slice_id text not null,
    source_event_id text not null,
    status text not null,
    created_at_utc timestamptz not null,
    body jsonb not null
);

create index if not exists ix_process_request_event_intents_tenant on process_request_event_intents(tenant_id, request_event_type, created_at_utc);
