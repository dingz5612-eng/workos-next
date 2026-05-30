-- Rollback note: the current WorkOSNext migration runner is up-only.
-- If this schema must be reversed before production use, add a compensating
-- migration that drops dependent reconciliation tables in reverse order.

create table if not exists bank_statement_imports (
    import_id text primary key,
    tenant_id text not null,
    source_type text not null,
    original_file_id text null references evidence_objects(evidence_id) on delete set null,
    imported_by text not null,
    status text not null,
    row_count integer not null default 0,
    parsed_count integer not null default 0,
    rejected_count integer not null default 0,
    imported_at_utc timestamptz not null,
    metadata jsonb not null default '{}'::jsonb,
    constraint ck_bank_statement_imports_source_type
        check (source_type in ('manual_csv', 'mbank_export', 'bank_statement', 'admin_upload', 'other')),
    constraint ck_bank_statement_imports_status
        check (status in ('uploaded', 'parsed', 'imported', 'partially_rejected', 'failed', 'superseded')),
    constraint ck_bank_statement_imports_counts_non_negative
        check (row_count >= 0 and parsed_count >= 0 and rejected_count >= 0),
    constraint ck_bank_statement_imports_counts_consistent
        check (parsed_count + rejected_count <= row_count)
);

create index if not exists ix_bank_statement_imports_tenant_status
    on bank_statement_imports(tenant_id, status, imported_at_utc);

create table if not exists bank_transactions (
    bank_transaction_id text primary key,
    tenant_id text not null,
    import_id text not null references bank_statement_imports(import_id) on delete restrict,
    external_ref text not null,
    occurred_at_utc timestamptz not null,
    amount numeric(18, 2) not null,
    currency text not null,
    direction text not null,
    counterparty text not null default '',
    description text not null default '',
    raw_payload jsonb not null default '{}'::jsonb,
    status text not null,
    created_at_utc timestamptz not null,
    constraint ck_bank_transactions_amount_non_negative
        check (amount >= 0),
    constraint ck_bank_transactions_direction
        check (direction in ('credit', 'debit')),
    constraint ck_bank_transactions_status
        check (status in ('imported', 'candidate_created', 'matched', 'mismatched', 'ignored', 'superseded')),
    constraint uq_bank_transactions_tenant_import_external_ref
        unique(tenant_id, import_id, external_ref)
);

create index if not exists ix_bank_transactions_tenant_status
    on bank_transactions(tenant_id, status, occurred_at_utc);

create index if not exists ix_bank_transactions_import
    on bank_transactions(import_id, occurred_at_utc);

create table if not exists payment_match_candidates (
    candidate_id text primary key,
    tenant_id text not null,
    bank_transaction_id text not null references bank_transactions(bank_transaction_id) on delete cascade,
    payment_id text null references hostel_payments(payment_id) on delete restrict,
    deposit_id text null references deposit_liabilities(deposit_id) on delete restrict,
    refund_payment_id text null references deposit_transactions(transaction_id) on delete restrict,
    score numeric(8, 4) not null,
    candidate_type text not null,
    reason text not null,
    status text not null,
    created_at_utc timestamptz not null,
    constraint ck_payment_match_candidates_score_range
        check (score >= 0 and score <= 1),
    constraint ck_payment_match_candidates_candidate_type
        check (candidate_type in ('payment', 'deposit', 'refund', 'unknown')),
    constraint ck_payment_match_candidates_status
        check (status in ('proposed', 'reviewing', 'accepted', 'rejected', 'expired', 'superseded'))
);

alter table payment_match_candidates
    add column if not exists refund_payment_id text null;

do $$
begin
    alter table payment_match_candidates
        add constraint fk_payment_match_candidates_refund_payment
        foreign key (refund_payment_id)
        references deposit_transactions(transaction_id)
        on delete restrict;
exception when duplicate_object then
    null;
end $$;

create index if not exists ix_payment_match_candidates_bank_transaction
    on payment_match_candidates(tenant_id, bank_transaction_id, status);

create unique index if not exists ux_payment_match_candidates_payment_target
    on payment_match_candidates(tenant_id, bank_transaction_id, payment_id)
    where payment_id is not null;

create unique index if not exists ux_payment_match_candidates_deposit_target
    on payment_match_candidates(tenant_id, bank_transaction_id, deposit_id)
    where deposit_id is not null;

create unique index if not exists ux_payment_match_candidates_refund_target
    on payment_match_candidates(tenant_id, bank_transaction_id, refund_payment_id)
    where refund_payment_id is not null;

create table if not exists payment_matches (
    match_id text primary key,
    tenant_id text not null,
    bank_transaction_id text not null references bank_transactions(bank_transaction_id) on delete restrict,
    payment_id text null references hostel_payments(payment_id) on delete restrict,
    deposit_id text null references deposit_liabilities(deposit_id) on delete restrict,
    refund_payment_id text null references deposit_transactions(transaction_id) on delete restrict,
    matched_by text not null,
    matched_event_id text null references audit_events(event_id) on delete set null,
    status text not null,
    matched_at_utc timestamptz not null,
    constraint ck_payment_matches_single_target
        check (num_nonnulls(payment_id, deposit_id, refund_payment_id) = 1),
    constraint ck_payment_matches_status
        check (status in ('matched', 'rejected', 'superseded', 'reversed'))
);

create unique index if not exists ux_payment_matches_active_bank_transaction
    on payment_matches(tenant_id, bank_transaction_id)
    where status = 'matched';

create unique index if not exists ux_payment_matches_active_payment
    on payment_matches(tenant_id, payment_id)
    where status = 'matched' and payment_id is not null;

create unique index if not exists ux_payment_matches_active_deposit
    on payment_matches(tenant_id, deposit_id)
    where status = 'matched' and deposit_id is not null;

create unique index if not exists ux_payment_matches_active_refund_payment
    on payment_matches(tenant_id, refund_payment_id)
    where status = 'matched' and refund_payment_id is not null;

create table if not exists payment_mismatches (
    mismatch_id text primary key,
    tenant_id text not null,
    bank_transaction_id text not null references bank_transactions(bank_transaction_id) on delete restrict,
    related_object_type text null,
    related_object_id text null,
    mismatch_type text not null,
    reason text not null,
    status text not null,
    created_at_utc timestamptz not null,
    resolved_at_utc timestamptz null,
    constraint ck_payment_mismatches_type
        check (mismatch_type in (
            'unmatched_bank_transaction',
            'unmatched_payment',
            'amount_mismatch',
            'currency_mismatch',
            'duplicate_bank_transaction',
            'evidence_mismatch',
            'cross_tenant_match',
            'manual_review'
        )),
    constraint ck_payment_mismatches_status
        check (status in ('open', 'resolving', 'resolved', 'ignored', 'superseded'))
);

create index if not exists ix_payment_mismatches_tenant_status
    on payment_mismatches(tenant_id, status, created_at_utc);

create table if not exists reconciliation_cases (
    reconciliation_case_id text primary key,
    tenant_id text not null,
    case_id text not null,
    mismatch_id text not null references payment_mismatches(mismatch_id) on delete restrict,
    status text not null,
    assigned_role text not null,
    assigned_actor_id text null,
    opened_event_id text null references audit_events(event_id) on delete set null,
    closed_event_id text null references audit_events(event_id) on delete set null,
    created_at_utc timestamptz not null,
    updated_at_utc timestamptz not null,
    constraint ck_reconciliation_cases_status
        check (status in ('open', 'assigned', 'blocked', 'resolved', 'closed', 'cancelled')),
    constraint uq_reconciliation_cases_tenant_mismatch
        unique(tenant_id, mismatch_id)
);

create index if not exists ix_reconciliation_cases_tenant_status
    on reconciliation_cases(tenant_id, status, updated_at_utc);
