-- Rollback note: WorkOSNext migrations are up-only. To reverse this before
-- production use, add a compensating migration that archives correction
-- records, drops triggers/functions, then drops tables in dependency order.

create table if not exists ledger_correction_requests (
    correction_request_id text primary key,
    tenant_id text not null,
    case_id text null,
    target_ledger_type text not null,
    target_entry_id text not null,
    target_object_type text not null,
    target_object_id text not null,
    correction_type text not null,
    reason text not null,
    requested_by text not null,
    status text not null,
    risk_level text not null,
    created_at_utc timestamptz not null,
    updated_at_utc timestamptz not null,
    constraint ck_ledger_correction_requests_target_ledger_type
        check (target_ledger_type in ('payment', 'deposit', 'charge', 'cash', 'refund')),
    constraint ck_ledger_correction_requests_correction_type
        check (correction_type in (
            'reversal',
            'amount_adjustment',
            'classification_adjustment',
            'evidence_correction',
            'allocation_reversal',
            'refund_correction',
            'charge_adjustment'
        )),
    constraint ck_ledger_correction_requests_status
        check (status in ('requested', 'pending_approval', 'approved', 'rejected', 'applied', 'cancelled', 'superseded')),
    constraint ck_ledger_correction_requests_risk_level
        check (risk_level in ('low', 'medium', 'high', 'critical')),
    constraint ck_ledger_correction_requests_reason_required
        check (length(trim(reason)) > 0),
    constraint ck_ledger_correction_requests_target_required
        check (
            length(trim(target_entry_id)) > 0
            and length(trim(target_object_type)) > 0
            and length(trim(target_object_id)) > 0
        ),
    constraint ck_ledger_correction_requests_requested_by_required
        check (length(trim(requested_by)) > 0),
    constraint ck_ledger_correction_requests_time_order
        check (updated_at_utc >= created_at_utc),
    constraint ck_ledger_correction_requests_high_risk_status
        check (
            risk_level not in ('high', 'critical')
            or status in ('pending_approval', 'approved', 'rejected', 'applied', 'cancelled', 'superseded')
        )
);

create index if not exists ix_ledger_correction_requests_tenant_status
    on ledger_correction_requests(tenant_id, status, created_at_utc);

create index if not exists ix_ledger_correction_requests_target
    on ledger_correction_requests(tenant_id, target_ledger_type, target_entry_id);

create index if not exists ix_ledger_correction_requests_case
    on ledger_correction_requests(tenant_id, case_id)
    where case_id is not null;

create table if not exists correction_approvals (
    approval_id text primary key,
    tenant_id text not null,
    correction_request_id text not null references ledger_correction_requests(correction_request_id) on delete restrict,
    approver_id text not null,
    result text not null,
    note text null,
    approved_at_utc timestamptz not null,
    constraint ck_correction_approvals_result
        check (result in ('approved', 'rejected')),
    constraint ck_correction_approvals_approver_required
        check (length(trim(approver_id)) > 0),
    constraint uq_correction_approvals_request_approver
        unique(tenant_id, correction_request_id, approver_id)
);

create index if not exists ix_correction_approvals_request
    on correction_approvals(tenant_id, correction_request_id, approved_at_utc);

create table if not exists ledger_reversal_entries (
    reversal_id text primary key,
    tenant_id text not null,
    correction_request_id text not null references ledger_correction_requests(correction_request_id) on delete restrict,
    target_ledger_type text not null,
    target_entry_id text not null,
    reversal_event_id text not null references audit_events(event_id) on delete restrict,
    reason text not null,
    created_by text not null,
    created_at_utc timestamptz not null,
    constraint ck_ledger_reversal_entries_target_ledger_type
        check (target_ledger_type in ('payment', 'deposit', 'charge', 'cash', 'refund')),
    constraint ck_ledger_reversal_entries_reason_required
        check (length(trim(reason)) > 0),
    constraint ck_ledger_reversal_entries_created_by_required
        check (length(trim(created_by)) > 0),
    constraint ck_ledger_reversal_entries_target_required
        check (length(trim(target_entry_id)) > 0),
    constraint uq_ledger_reversal_entries_event
        unique(tenant_id, reversal_event_id)
);

create index if not exists ix_ledger_reversal_entries_target
    on ledger_reversal_entries(tenant_id, target_ledger_type, target_entry_id);

create index if not exists ix_ledger_reversal_entries_request
    on ledger_reversal_entries(tenant_id, correction_request_id, created_at_utc);

create table if not exists ledger_correction_entries (
    correction_entry_id text primary key,
    tenant_id text not null,
    correction_request_id text not null references ledger_correction_requests(correction_request_id) on delete restrict,
    correction_event_id text not null references audit_events(event_id) on delete restrict,
    before_snapshot jsonb not null,
    after_snapshot jsonb not null,
    created_at_utc timestamptz not null,
    constraint ck_ledger_correction_entries_snapshots_displayable
        check (
            jsonb_typeof(before_snapshot) = 'object'
            and jsonb_typeof(after_snapshot) = 'object'
        ),
    constraint uq_ledger_correction_entries_event
        unique(tenant_id, correction_event_id)
);

create index if not exists ix_ledger_correction_entries_request
    on ledger_correction_entries(tenant_id, correction_request_id, created_at_utc);

create table if not exists correction_audit (
    audit_id text primary key,
    tenant_id text not null,
    correction_request_id text not null references ledger_correction_requests(correction_request_id) on delete restrict,
    actor_id text not null,
    action text not null,
    payload jsonb not null default '{}'::jsonb,
    occurred_at_utc timestamptz not null,
    constraint ck_correction_audit_actor_required
        check (length(trim(actor_id)) > 0),
    constraint ck_correction_audit_action_required
        check (length(trim(action)) > 0),
    constraint ck_correction_audit_payload_object
        check (jsonb_typeof(payload) = 'object')
);

create index if not exists ix_correction_audit_request
    on correction_audit(tenant_id, correction_request_id, occurred_at_utc);

create table if not exists correction_cases (
    correction_case_id text primary key,
    tenant_id text not null,
    correction_request_id text not null references ledger_correction_requests(correction_request_id) on delete restrict,
    case_id text not null,
    owner_role text not null,
    owner_actor_id text null,
    status text not null,
    due_at_utc timestamptz null,
    body jsonb not null default '{}'::jsonb,
    created_at_utc timestamptz not null,
    updated_at_utc timestamptz not null,
    constraint ck_correction_cases_status
        check (status in ('open', 'assigned', 'blocked', 'approved', 'applied', 'closed', 'cancelled')),
    constraint ck_correction_cases_owner_role_required
        check (length(trim(owner_role)) > 0),
    constraint ck_correction_cases_body_object
        check (jsonb_typeof(body) = 'object'),
    constraint ck_correction_cases_time_order
        check (updated_at_utc >= created_at_utc),
    constraint uq_correction_cases_request
        unique(tenant_id, correction_request_id)
);

create index if not exists ix_correction_cases_owner_due
    on correction_cases(tenant_id, owner_role, status, due_at_utc);

create or replace function correction_request_has_required_approval(request_id text)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from ledger_correction_requests request
        where request.correction_request_id = request_id
          and request.risk_level not in ('high', 'critical')
    )
    or exists (
        select 1
        from ledger_correction_requests request
        join correction_approvals approval
          on approval.tenant_id = request.tenant_id
         and approval.correction_request_id = request.correction_request_id
         and approval.result = 'approved'
        where request.correction_request_id = request_id
          and request.risk_level in ('high', 'critical')
    );
$$;

create or replace function guard_high_risk_reversal_approval()
returns trigger
language plpgsql
as $$
begin
    if not correction_request_has_required_approval(new.correction_request_id) then
        raise exception 'high_risk_correction_requires_approval: %', new.correction_request_id;
    end if;

    return new;
end;
$$;

create or replace function guard_high_risk_correction_approval()
returns trigger
language plpgsql
as $$
begin
    if not correction_request_has_required_approval(new.correction_request_id) then
        raise exception 'high_risk_correction_requires_approval: %', new.correction_request_id;
    end if;

    return new;
end;
$$;

create or replace function forbid_correction_ledger_entry_update()
returns trigger
language plpgsql
as $$
begin
    raise exception 'ledger_entry_update_forbidden_or_guarded: append a reversal or correction entry instead of editing ledger facts';
end;
$$;

create or replace function guard_hostel_payments_fact_update()
returns trigger
language plpgsql
as $$
begin
    if new.folio_id is distinct from old.folio_id
        or new.deposit_id is distinct from old.deposit_id
        or new.payer is distinct from old.payer
        or new.amount is distinct from old.amount
        or new.currency is distinct from old.currency
        or new.method is distinct from old.method
        or new.purpose is distinct from old.purpose
        or new.receipt_no is distinct from old.receipt_no
        or new.created_event_id is distinct from old.created_event_id then
        raise exception 'ledger_entry_update_forbidden_or_guarded: hostel_payments money facts require Correction Center append';
    end if;

    return new;
end;
$$;

create or replace function guard_finance_reconciliations_fact_update()
returns trigger
language plpgsql
as $$
begin
    if new.payment_id is distinct from old.payment_id
        or new.channel is distinct from old.channel
        or new.confirmed_amount is distinct from old.confirmed_amount
        or new.currency is distinct from old.currency
        or new.match_result is distinct from old.match_result
        or new.variance_amount is distinct from old.variance_amount
        or new.confirmed_by is distinct from old.confirmed_by
        or new.created_event_id is distinct from old.created_event_id then
        raise exception 'ledger_entry_update_forbidden_or_guarded: finance_reconciliations money facts require Correction Center append';
    end if;

    return new;
end;
$$;

create or replace function guard_hostel_charges_fact_update()
returns trigger
language plpgsql
as $$
begin
    if new.stay_id is distinct from old.stay_id
        or new.charge_type is distinct from old.charge_type
        or new.period_start_utc is distinct from old.period_start_utc
        or new.period_end_utc is distinct from old.period_end_utc
        or new.amount is distinct from old.amount
        or new.currency is distinct from old.currency
        or new.reason is distinct from old.reason
        or new.created_event_id is distinct from old.created_event_id then
        raise exception 'ledger_entry_update_forbidden_or_guarded: hostel_charges charge facts require Correction Center append';
    end if;

    return new;
end;
$$;

create or replace function forbid_legacy_ledger_entry_update()
returns trigger
language plpgsql
as $$
begin
    if new is distinct from old then
        raise exception 'ledger_entry_update_forbidden_or_guarded: legacy append-only ledger entries require Correction Center append';
    end if;

    return new;
end;
$$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_ledger_reversal_entries_require_approval') then
        create trigger trg_ledger_reversal_entries_require_approval
        before insert on ledger_reversal_entries
        for each row execute function guard_high_risk_reversal_approval();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_ledger_correction_entries_require_approval') then
        create trigger trg_ledger_correction_entries_require_approval
        before insert on ledger_correction_entries
        for each row execute function guard_high_risk_correction_approval();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_ledger_reversal_entries_forbid_update') then
        create trigger trg_ledger_reversal_entries_forbid_update
        before update on ledger_reversal_entries
        for each row execute function forbid_correction_ledger_entry_update();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_ledger_correction_entries_forbid_update') then
        create trigger trg_ledger_correction_entries_forbid_update
        before update on ledger_correction_entries
        for each row execute function forbid_correction_ledger_entry_update();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_hostel_payments_fact_update_guard') then
        create trigger trg_hostel_payments_fact_update_guard
        before update on hostel_payments
        for each row execute function guard_hostel_payments_fact_update();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_finance_reconciliations_fact_update_guard') then
        create trigger trg_finance_reconciliations_fact_update_guard
        before update on finance_reconciliations
        for each row execute function guard_finance_reconciliations_fact_update();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_hostel_charges_fact_update_guard') then
        create trigger trg_hostel_charges_fact_update_guard
        before update on hostel_charges
        for each row execute function guard_hostel_charges_fact_update();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_deposit_transactions_forbid_update') then
        create trigger trg_deposit_transactions_forbid_update
        before update on deposit_transactions
        for each row execute function forbid_legacy_ledger_entry_update();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_payment_allocations_forbid_update') then
        create trigger trg_payment_allocations_forbid_update
        before update on payment_allocations
        for each row execute function forbid_legacy_ledger_entry_update();
    end if;
end $$;

comment on table ledger_correction_requests is
    'MR-09 Correction Center request table. Corrections are manual-first; no automatic smart correction is performed.';

comment on table ledger_reversal_entries is
    'Append-only ledger reversal facts. Reversal rows must reference the original target_entry_id and a correction request.';

comment on table ledger_correction_entries is
    'Append-only correction facts with before_snapshot and after_snapshot for finance review.';

comment on function forbid_correction_ledger_entry_update() is
    'Correction Center append-only guard. Existing ledger facts must be corrected by reversal/correction entries, not edited in place.';

comment on function forbid_legacy_ledger_entry_update() is
    'Legacy append-only ledger guard for deposit_transactions and payment_allocations. Use Correction Center entries instead of direct edits.';

comment on function guard_hostel_payments_fact_update() is
    'Prevents direct edits to existing payment ledger fact fields while allowing non-fact status/projection metadata to advance.';

comment on function guard_finance_reconciliations_fact_update() is
    'Prevents direct edits to existing finance reconciliation amount and classification facts.';

comment on function guard_hostel_charges_fact_update() is
    'Prevents direct edits to existing charge ledger fact fields.';
