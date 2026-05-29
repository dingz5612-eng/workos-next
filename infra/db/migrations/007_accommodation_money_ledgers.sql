create table if not exists deposit_transactions (
    transaction_id text primary key,
    deposit_id text not null,
    workspace_id text not null,
    transaction_type text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    status text not null,
    actor_id text not null,
    created_event_id text not null,
    occurred_at_utc timestamptz not null
);

create index if not exists ix_deposit_transactions_deposit_id on deposit_transactions(deposit_id);

create table if not exists payment_allocations (
    allocation_id text primary key,
    payment_id text not null,
    workspace_id text not null,
    allocation_mode text not null,
    allocated_amount numeric(18, 2) not null,
    status text not null,
    created_event_id text not null,
    occurred_at_utc timestamptz not null
);

create index if not exists ix_payment_allocations_payment_id on payment_allocations(payment_id);

create table if not exists stay_balances (
    stay_id text primary key,
    workspace_id text not null,
    total_charges numeric(18, 2) not null,
    confirmed_payments numeric(18, 2) not null,
    allocated_payments numeric(18, 2) not null,
    balance numeric(18, 2) not null,
    currency text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);
