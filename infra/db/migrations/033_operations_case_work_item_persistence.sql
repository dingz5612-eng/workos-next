-- RF7: OperationCase and WorkItem persistence closure.
-- Rollback guidance: this migration is additive. To reverse before production,
-- archive operations_work_item_state_history, operations_work_items, and
-- operations_cases, then drop the tables in child-to-parent order.

create table if not exists operations_cases (
    case_id text primary key,
    tenant_id text not null,
    case_type text not null,
    definition_version_id text not null,
    status text not null,
    opened_at_utc timestamptz not null,
    closed_at_utc timestamptz null,
    owner_role text not null,
    owner_actor_id text null,
    source_refs jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    constraint ck_operations_cases_status
        check (status in ('open', 'active', 'blocked', 'closed', 'cancelled', 'projected')),
    constraint ck_operations_cases_source_refs_shape
        check (jsonb_typeof(source_refs) = 'object'),
    constraint ck_operations_cases_metadata_shape
        check (jsonb_typeof(metadata) = 'object')
);

create table if not exists operations_work_items (
    work_item_id text primary key,
    tenant_id text not null,
    case_id text not null references operations_cases(case_id) on delete restrict,
    work_item_type text not null,
    definition_version_id text not null,
    lifecycle_state text not null,
    owner_role text not null,
    owner_actor_id text null,
    backup_owner_id text null,
    escalation_owner_role text null,
    due_at_utc timestamptz null,
    priority text null,
    risk_level text null,
    idempotency_scope text not null,
    required_evidence_refs text[] not null default array[]::text[],
    affected_fact_refs text[] not null default array[]::text[],
    workspace_id text null,
    source_event_id text null,
    source_refs jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at_utc timestamptz not null,
    updated_at_utc timestamptz not null,
    closed_at_utc timestamptz null,
    constraint ck_operations_work_items_lifecycle
        check (lifecycle_state in ('available', 'prepared', 'confirmed', 'blocked', 'closed', 'cancelled', 'open', 'done', 'failed')),
    constraint ck_operations_work_items_source_refs_shape
        check (jsonb_typeof(source_refs) = 'object'),
    constraint ck_operations_work_items_metadata_shape
        check (jsonb_typeof(metadata) = 'object')
);

create table if not exists operations_work_item_state_history (
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
    constraint ck_operations_work_item_state_history_metadata_shape
        check (jsonb_typeof(metadata) = 'object')
);

create table if not exists operations_work_item_assignments (
    assignment_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null references operations_work_items(work_item_id) on delete restrict,
    owner_role text not null,
    owner_actor_id text null,
    backup_owner_id text null,
    assigned_at_utc timestamptz not null,
    metadata jsonb not null default '{}'::jsonb,
    constraint ck_operations_work_item_assignments_metadata_shape
        check (jsonb_typeof(metadata) = 'object')
);

create table if not exists operations_work_item_escalations (
    escalation_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null references operations_work_items(work_item_id) on delete restrict,
    escalation_owner_role text not null,
    reason text not null,
    escalated_at_utc timestamptz not null,
    resolved_at_utc timestamptz null,
    metadata jsonb not null default '{}'::jsonb,
    constraint ck_operations_work_item_escalations_metadata_shape
        check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ix_operations_cases_tenant_status
    on operations_cases(tenant_id, status, opened_at_utc);

create index if not exists ix_operations_work_items_case_state
    on operations_work_items(tenant_id, case_id, lifecycle_state, updated_at_utc);

create index if not exists ix_operations_work_item_state_history_work_item
    on operations_work_item_state_history(tenant_id, work_item_id, occurred_at_utc);
