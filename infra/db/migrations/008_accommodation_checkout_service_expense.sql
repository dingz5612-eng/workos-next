create table if not exists checkout_settlements (
    checkout_id text primary key,
    workspace_id text not null,
    stay_id text not null,
    current_balance numeric(18, 2) not null,
    deposit_held_amount numeric(18, 2) not null,
    close_result text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists room_inspections (
    inspection_id text primary key,
    workspace_id text not null,
    checkout_id text not null,
    room_condition text not null,
    bed_condition text not null,
    damage_charge_amount numeric(18, 2) not null,
    cleaning_required boolean not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists service_tasks (
    task_id text primary key,
    workspace_id text not null,
    task_type text not null,
    room_id text not null,
    bed_id text not null,
    urgency text not null,
    blocks_availability boolean not null,
    status text not null,
    actual_cost_amount numeric(18, 2) not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists expenses (
    expense_id text primary key,
    workspace_id text not null,
    expense_category text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    payment_method text not null,
    status text not null,
    approved_amount numeric(18, 2) not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists expense_links (
    link_id text primary key,
    expense_id text not null,
    workspace_id text not null,
    room_id text not null,
    bed_id text not null,
    service_task_id text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);
