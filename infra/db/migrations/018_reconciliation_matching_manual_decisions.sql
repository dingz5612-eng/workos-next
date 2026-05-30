-- Rollback note: the current WorkOSNext migration runner is up-only.
-- To reverse this patch before production use, add a compensating migration
-- that drops the matching indexes/foreign keys added here before dropping the
-- refund candidate columns.

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

alter table payment_matches
    add column if not exists refund_payment_id text null;

do $$
begin
    alter table payment_matches
        add constraint fk_payment_matches_refund_payment
        foreign key (refund_payment_id)
        references deposit_transactions(transaction_id)
        on delete restrict;
exception when duplicate_object then
    null;
end $$;

create unique index if not exists ux_payment_match_candidates_payment_target
    on payment_match_candidates(tenant_id, bank_transaction_id, payment_id)
    where payment_id is not null;

create unique index if not exists ux_payment_match_candidates_deposit_target
    on payment_match_candidates(tenant_id, bank_transaction_id, deposit_id)
    where deposit_id is not null;

create unique index if not exists ux_payment_match_candidates_refund_target
    on payment_match_candidates(tenant_id, bank_transaction_id, refund_payment_id)
    where refund_payment_id is not null;

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
