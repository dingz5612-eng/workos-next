-- Rollback note: WorkOSNext migrations are up-only. To reverse before
-- production, add a compensating migration that drops the added case columns
-- after dependent process and reconciliation records are archived.

alter table payment_mismatches
    alter column bank_transaction_id drop not null;

alter table payment_mismatches
    drop constraint if exists ck_payment_mismatches_type;

alter table payment_mismatches
    add constraint ck_payment_mismatches_type
        check (mismatch_type in (
            'unmatched_bank_transaction',
            'unmatched_payment',
            'confirmed_payment_without_bank_match',
            'refund_paid_without_bank_debit',
            'amount_mismatch',
            'currency_mismatch',
            'duplicate_bank_transaction',
            'evidence_mismatch',
            'cross_tenant_match',
            'manual_review'
        ));

alter table reconciliation_cases
    add column if not exists mismatch_type text not null default 'manual_review',
    add column if not exists bank_transaction_id text null,
    add column if not exists related_object_type text null,
    add column if not exists related_object_id text null,
    add column if not exists owner_role text not null default 'finance',
    add column if not exists due_at_utc timestamptz not null default now(),
    add column if not exists blocker_severity text not null default 'P1',
    add column if not exists resolve_actions jsonb not null default '[]'::jsonb,
    add column if not exists body jsonb not null default '{}'::jsonb;

do $$
begin
    alter table reconciliation_cases
        add constraint fk_reconciliation_cases_bank_transaction
        foreign key (bank_transaction_id)
        references bank_transactions(bank_transaction_id)
        on delete restrict;
exception when duplicate_object then
    null;
end $$;

alter table reconciliation_cases
    drop constraint if exists ck_reconciliation_cases_blocker_severity;

alter table reconciliation_cases
    add constraint ck_reconciliation_cases_blocker_severity
        check (blocker_severity in ('P0', 'P1', 'P2'));

update reconciliation_cases reconciliation_case
set
    mismatch_type = mismatch.mismatch_type,
    bank_transaction_id = mismatch.bank_transaction_id,
    related_object_type = mismatch.related_object_type,
    related_object_id = mismatch.related_object_id,
    owner_role = coalesce(nullif(reconciliation_case.assigned_role, ''), 'finance'),
    body = case
        when reconciliation_case.body = '{}'::jsonb then jsonb_build_object(
            'reconciliationCaseId', reconciliation_case.reconciliation_case_id,
            'caseId', reconciliation_case.case_id,
            'mismatchId', reconciliation_case.mismatch_id,
            'mismatchType', mismatch.mismatch_type,
            'bankTransactionId', mismatch.bank_transaction_id,
            'relatedObjectType', mismatch.related_object_type,
            'relatedObjectId', mismatch.related_object_id,
            'ownerRole', coalesce(nullif(reconciliation_case.assigned_role, ''), 'finance')
        )
        else reconciliation_case.body
    end
from payment_mismatches mismatch
where mismatch.tenant_id = reconciliation_case.tenant_id
  and mismatch.mismatch_id = reconciliation_case.mismatch_id;

create index if not exists ix_reconciliation_cases_owner_due
    on reconciliation_cases(tenant_id, owner_role, status, due_at_utc);

create index if not exists ix_reconciliation_cases_bank_transaction
    on reconciliation_cases(tenant_id, bank_transaction_id)
    where bank_transaction_id is not null;
