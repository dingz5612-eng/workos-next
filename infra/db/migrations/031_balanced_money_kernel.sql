-- Rollback note: WorkOSNext migrations are up-only. To reverse this before
-- production use, add a compensating migration that archives balanced ledger
-- rows, posts reversing transactions for committed money facts, and only then
-- drops child tables in dependency order.

create table if not exists ledger_accounts (
    account_id text primary key,
    tenant_id text not null,
    account_type text not null,
    account_name text not null,
    currency text not null,
    status text not null,
    created_at_utc timestamptz not null,
    constraint ck_ledger_accounts_type
        check (account_type in ('asset', 'liability', 'receivable', 'revenue', 'expense', 'equity', 'correction', 'unspecified')),
    constraint ck_ledger_accounts_status
        check (status in ('active', 'closed')),
    constraint ck_ledger_accounts_currency
        check (length(trim(currency)) > 0)
);

create table if not exists ledger_transactions (
    ledger_transaction_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    submission_id text not null references operations_command_submissions(submission_id) on delete restrict,
    transaction_type text not null,
    currency text not null,
    balance_status text not null,
    posted_at_utc timestamptz not null,
    payload jsonb not null default '{}'::jsonb,
    constraint ck_ledger_transactions_currency
        check (length(trim(currency)) > 0),
    constraint ck_ledger_transactions_balance_status
        check (balance_status = 'balanced'),
    constraint ck_ledger_transactions_payload_shape
        check (jsonb_typeof(payload) = 'object')
);

create index if not exists ix_ledger_transactions_submission
    on ledger_transactions(tenant_id, submission_id);

create index if not exists ix_ledger_transactions_work_item
    on ledger_transactions(tenant_id, work_item_id, posted_at_utc);

create table if not exists ledger_entries (
    entry_id text primary key,
    ledger_transaction_id text not null references ledger_transactions(ledger_transaction_id) on delete restrict,
    tenant_id text not null,
    account_id text not null,
    account_type text not null,
    debit_credit text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    entry_role text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at_utc timestamptz not null,
    constraint ck_ledger_entries_side
        check (debit_credit in ('debit', 'credit')),
    constraint ck_ledger_entries_amount_positive
        check (amount > 0),
    constraint ck_ledger_entries_account_type
        check (account_type in ('asset', 'liability', 'receivable', 'revenue', 'expense', 'equity', 'correction', 'unspecified')),
    constraint ck_ledger_entries_payload_shape
        check (jsonb_typeof(payload) = 'object')
);

create index if not exists ix_ledger_entries_transaction
    on ledger_entries(tenant_id, ledger_transaction_id);

create table if not exists deposit_accounts (
    deposit_account_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    liability_account_id text not null,
    currency text not null,
    status text not null,
    opened_at_utc timestamptz not null,
    constraint ck_deposit_accounts_status
        check (status in ('open', 'held', 'settling', 'closed'))
);

create table if not exists deposit_balance_projection (
    deposit_account_id text primary key references deposit_accounts(deposit_account_id) on delete restrict,
    tenant_id text not null,
    held_amount numeric(18, 2) not null,
    deducted_amount numeric(18, 2) not null,
    refunded_amount numeric(18, 2) not null,
    liability_balance numeric(18, 2) not null,
    currency text not null,
    source_ledger_transaction_id text null references ledger_transactions(ledger_transaction_id) on delete restrict,
    updated_at_utc timestamptz not null,
    constraint ck_deposit_balance_projection_non_negative
        check (held_amount >= 0 and deducted_amount >= 0 and refunded_amount >= 0 and liability_balance >= 0)
);

create table if not exists charges (
    charge_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    ledger_transaction_id text null references ledger_transactions(ledger_transaction_id) on delete restrict,
    charge_type text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    status text not null,
    created_at_utc timestamptz not null,
    constraint ck_charges_amount_positive
        check (amount > 0),
    constraint ck_charges_status
        check (status in ('assessed', 'reversed', 'closed'))
);

create table if not exists payments (
    payment_id text primary key,
    tenant_id text not null,
    case_id text not null,
    work_item_id text not null,
    ledger_transaction_id text null references ledger_transactions(ledger_transaction_id) on delete restrict,
    payment_kind text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    status text not null,
    created_at_utc timestamptz not null,
    constraint ck_payments_kind
        check (payment_kind in ('ordinary', 'deposit', 'refund')),
    constraint ck_payments_amount_positive
        check (amount > 0),
    constraint ck_payments_status
        check (status in ('received', 'confirmed', 'allocated', 'refunded', 'reversed')),
    constraint ck_payments_deposit_not_revenue
        check (payment_kind <> 'deposit' or status <> 'allocated')
);

alter table payment_allocations
    add column if not exists ledger_transaction_id text null;

alter table payment_allocations
    add column if not exists source_submission_id text null;

alter table payment_allocations
    add column if not exists currency text null;

alter table payment_allocations
    add column if not exists allocation_type text null;

create table if not exists stay_balance_projection (
    stay_id text primary key,
    tenant_id text not null,
    total_charges numeric(18, 2) not null,
    confirmed_payments numeric(18, 2) not null,
    allocated_payments numeric(18, 2) not null,
    balance numeric(18, 2) not null,
    currency text not null,
    source_ledger_transaction_id text null references ledger_transactions(ledger_transaction_id) on delete restrict,
    updated_at_utc timestamptz not null,
    constraint ck_stay_balance_projection_non_negative
        check (total_charges >= 0 and confirmed_payments >= 0 and allocated_payments >= 0 and balance >= 0)
);

create or replace function forbid_balanced_ledger_entry_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'ledger_entry_update_delete_forbidden: append a reversal or compensating transaction instead of mutating ledger_entries';
end;
$$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_ledger_entries_forbid_update') then
        create trigger trg_ledger_entries_forbid_update
        before update on ledger_entries
        for each row execute function forbid_balanced_ledger_entry_mutation();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_ledger_entries_forbid_delete') then
        create trigger trg_ledger_entries_forbid_delete
        before delete on ledger_entries
        for each row execute function forbid_balanced_ledger_entry_mutation();
    end if;
end $$;

comment on table ledger_transactions is
    'S5 Balanced Money Kernel transaction header. Each transaction must be balanced before OperationsUnitOfWork commits it.';

comment on table ledger_entries is
    'S5 immutable debit/credit ledger entries. Corrections use reversal or compensating transactions, never update/delete.';

comment on table deposit_balance_projection is
    'Derived projection for deposit liability. Deposits are liability, not revenue.';

comment on table stay_balance_projection is
    'Derived projection from ledger facts, not UI-provided balance fields.';

comment on function forbid_balanced_ledger_entry_mutation() is
    'S5 append-only guard for canonical ledger_entries.';
