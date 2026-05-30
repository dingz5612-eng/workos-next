-- MR-10 PeriodAnalytics V5.4 schema hardening.
-- Rollback note: WorkOSNext migrations are up-only. If this schema must be
-- reversed before production use, add a compensating migration that archives
-- period review evidence, drops triggers/functions, then drops V5.4-only
-- tables and columns in dependency order.

alter table period_reviews
    add column if not exists period_review_id text,
    add column if not exists tenant_id text,
    add column if not exists period_key text,
    add column if not exists scope_id text,
    add column if not exists opened_by text,
    add column if not exists opened_at_utc timestamptz,
    add column if not exists closed_event_id text null,
    add column if not exists closed_at_utc timestamptz null,
    add column if not exists source_high_watermark text null,
    add column if not exists created_at_utc timestamptz;

update period_reviews
set period_review_id = coalesce(period_review_id, period_id),
    tenant_id = coalesce(tenant_id, workspace_id),
    period_key = coalesce(period_key, period_year::text || '-' || lpad(period_no::text, 2, '0')),
    scope_id = coalesce(scope_id, 'scope-' || period_id),
    opened_by = coalesce(opened_by, 'system'),
    opened_at_utc = coalesce(opened_at_utc, period_start_utc, updated_at_utc),
    created_at_utc = coalesce(created_at_utc, updated_at_utc),
    source_high_watermark = coalesce(source_high_watermark, created_event_id),
    status = case when status = 'scoped' then 'scope_confirmed' else status end,
    closed_event_id = case when status = 'closed' then coalesce(closed_event_id, created_event_id) else closed_event_id end,
    closed_at_utc = case when status = 'closed' then coalesce(closed_at_utc, updated_at_utc) else closed_at_utc end;

alter table period_reviews
    alter column period_review_id set not null,
    alter column tenant_id set not null,
    alter column period_key set not null,
    alter column scope_id set not null,
    alter column opened_by set not null,
    alter column opened_at_utc set not null,
    alter column created_at_utc set not null;

do $$
begin
    alter table period_reviews
        add constraint uq_period_reviews_period_review_id unique(period_review_id);
exception when duplicate_object then
    null;
end $$;

do $$
begin
    alter table period_reviews
        add constraint ck_period_reviews_v54_status
        check (status in (
            'open',
            'scope_confirmed',
            'metrics_reviewed',
            'finance_reviewed',
            'operations_diagnosed',
            'action_plan_committed',
            'closed',
            'reopened_for_late_adjustment'
        ));
exception when duplicate_object then
    null;
end $$;

create table if not exists period_scopes (
    scope_id text primary key,
    tenant_id text not null,
    period_review_id text not null references period_reviews(period_review_id) on delete restrict,
    period_start timestamptz not null,
    period_end timestamptz not null,
    timezone text not null,
    business_day_cutoff text not null,
    status text not null,
    frozen_at_utc timestamptz null,
    event_id text not null,
    constraint ck_period_scopes_status
        check (status in ('draft', 'frozen', 'superseded')),
    constraint ck_period_scopes_time_order
        check (period_end > period_start),
    constraint ck_period_scopes_timezone_required
        check (length(trim(timezone)) > 0),
    constraint ck_period_scopes_business_day_cutoff_required
        check (length(trim(business_day_cutoff)) > 0)
);

insert into period_scopes(
    scope_id,
    tenant_id,
    period_review_id,
    period_start,
    period_end,
    timezone,
    business_day_cutoff,
    status,
    frozen_at_utc,
    event_id)
select
    scope_id,
    tenant_id,
    period_review_id,
    period_start_utc,
    period_end_utc,
    'UTC',
    '00:00',
    case when status = 'open' then 'draft' else 'frozen' end,
    case when status = 'open' then null else opened_at_utc end,
    created_event_id
from period_reviews
on conflict(scope_id) do nothing;

create index if not exists ix_period_reviews_tenant_period_key
    on period_reviews(tenant_id, period_key);

create index if not exists ix_period_scopes_tenant_status
    on period_scopes(tenant_id, status, period_start, period_end);

create table if not exists expense_ledger_status (
    tenant_id text primary key,
    status text not null,
    source text not null,
    updated_at_utc timestamptz not null,
    note text not null,
    constraint ck_expense_ledger_status_status
        check (status in ('not_integrated', 'manual_imported', 'ledger_verified')),
    constraint ck_expense_ledger_status_source_required
        check (length(trim(source)) > 0),
    constraint ck_expense_ledger_status_note_required
        check (length(trim(note)) > 0)
);

insert into expense_ledger_status(tenant_id, status, source, updated_at_utc, note)
select
    workspace_id,
    case
        when count(*) filter (where status not in ('approved', 'rejected')) > 0 then 'manual_imported'
        else 'ledger_verified'
    end,
    'expenses',
    max(updated_at_utc),
    'ExpenseLedger facts are persisted; FinanceSnapshot may read approved expenses when status is ledger_verified.'
from expenses
group by workspace_id
on conflict(tenant_id) do update set
    status = excluded.status,
    source = excluded.source,
    updated_at_utc = excluded.updated_at_utc,
    note = excluded.note;

create index if not exists ix_expense_ledger_status_status
    on expense_ledger_status(status, updated_at_utc);

alter table period_metric_snapshots
    add column if not exists snapshot_id text,
    add column if not exists tenant_id text,
    add column if not exists period_review_id text,
    add column if not exists body jsonb,
    add column if not exists source_projection_versions jsonb,
    add column if not exists source_event_high_watermark text,
    add column if not exists generated_at_utc timestamptz,
    add column if not exists generated_by text;

update period_metric_snapshots
set snapshot_id = coalesce(snapshot_id, period_id),
    tenant_id = coalesce(tenant_id, workspace_id),
    period_review_id = coalesce(period_review_id, period_id),
    body = coalesce(body, jsonb_build_object(
        'availableBedNight', available_bed_night,
        'bedNightSold', bed_night_sold,
        'averageOccupancyRate', average_occupancy_rate,
        'newLeadCount', new_lead_count,
        'reservationCount', reservation_count,
        'checkInCount', check_in_count
    )),
    source_projection_versions = coalesce(source_projection_versions, '{}'::jsonb),
    source_event_high_watermark = coalesce(source_event_high_watermark, created_event_id),
    generated_at_utc = coalesce(generated_at_utc, frozen_at_utc),
    generated_by = coalesce(generated_by, 'period-metric-projector');

alter table period_metric_snapshots
    alter column snapshot_id set not null,
    alter column tenant_id set not null,
    alter column period_review_id set not null,
    alter column body set not null,
    alter column source_projection_versions set not null,
    alter column source_event_high_watermark set not null,
    alter column generated_at_utc set not null,
    alter column generated_by set not null;

do $$
begin
    alter table period_metric_snapshots
        add constraint uq_period_metric_snapshots_snapshot_id unique(snapshot_id);
exception when duplicate_object then
    null;
end $$;

do $$
begin
    alter table period_metric_snapshots
        add constraint ck_period_metric_snapshots_v54_json_shape
        check (
            jsonb_typeof(body) = 'object'
            and jsonb_typeof(source_projection_versions) = 'object'
            and length(trim(generated_by)) > 0
        );
exception when duplicate_object then
    null;
end $$;

alter table period_finance_snapshots
    add column if not exists snapshot_id text,
    add column if not exists tenant_id text,
    add column if not exists period_review_id text,
    add column if not exists body jsonb,
    add column if not exists source_ledger_versions jsonb,
    add column if not exists expense_status text,
    add column if not exists source_event_high_watermark text,
    add column if not exists generated_at_utc timestamptz,
    add column if not exists generated_by text;

update period_finance_snapshots
set snapshot_id = coalesce(snapshot_id, period_id),
    tenant_id = coalesce(tenant_id, workspace_id),
    period_review_id = coalesce(period_review_id, period_id),
    body = coalesce(body, jsonb_build_object(
        'rentRevenue', rent_revenue,
        'otherRevenue', other_revenue,
        'confirmedPaymentAmount', confirmed_payment_amount,
        'pendingPaymentAmount', pending_payment_amount,
        'depositReceivedAmount', deposit_received_amount,
        'depositRefundedAmount', deposit_refunded_amount,
        'depositDeductedAmount', deposit_deducted_amount,
        'depositAppliedToBalanceAmount', deposit_applied_to_balance_amount,
        'depositLiabilityEnd', deposit_liability_end,
        'approvedExpenseAmount', approved_expense_amount,
        'pendingExpenseAmount', pending_expense_amount,
        'periodNetCashFlow', period_net_cash_flow,
        'endingDebtAmount', ending_debt_amount,
        'financeExceptionCount', finance_exception_count,
        'expenseStatus', 'not_integrated',
        'expenseSource', 'not_integrated',
        'expenseStatusWarning', '支出账本未接入，利润类指标不可用或待确认',
        'periodProfitMetricStatus', 'disabled',
        'periodNetProfit', null,
        'profitMetricUnavailableReason', '支出账本未接入，利润类指标不可用或待确认'
    )),
    source_ledger_versions = coalesce(source_ledger_versions, '{}'::jsonb),
    expense_status = coalesce(expense_status, 'not_integrated'),
    source_event_high_watermark = coalesce(source_event_high_watermark, created_event_id),
    generated_at_utc = coalesce(generated_at_utc, updated_at_utc),
    generated_by = coalesce(generated_by, 'period-finance-projector');

alter table period_finance_snapshots
    alter column snapshot_id set not null,
    alter column tenant_id set not null,
    alter column period_review_id set not null,
    alter column body set not null,
    alter column source_ledger_versions set not null,
    alter column expense_status set not null,
    alter column source_event_high_watermark set not null,
    alter column generated_at_utc set not null,
    alter column generated_by set not null;

do $$
begin
    alter table period_finance_snapshots
        add constraint uq_period_finance_snapshots_snapshot_id unique(snapshot_id);
exception when duplicate_object then
    null;
end $$;

do $$
begin
    alter table period_finance_snapshots
        add constraint ck_period_finance_snapshots_expense_status
        check (
            expense_status in ('not_integrated', 'manual_imported', 'ledger_verified')
            and expense_status <> 'zero_by_default'
            and (
                expense_status <> 'ledger_verified'
                or (
                    body ? 'expenseSource'
                    and coalesce(body->>'expenseSource', '') not in ('', 'not_integrated', 'zero_by_default')
                )
            )
        );
exception when duplicate_object then
    null;
end $$;

do $$
begin
    alter table period_finance_snapshots
        add constraint ck_period_finance_snapshots_v54_json_shape
        check (
            jsonb_typeof(body) = 'object'
            and jsonb_typeof(source_ledger_versions) = 'object'
            and length(trim(generated_by)) > 0
            and lower(generated_by) not in ('user', 'manual', 'frontend')
        );
exception when duplicate_object then
    null;
end $$;

create table if not exists period_operation_snapshots (
    snapshot_id text primary key,
    tenant_id text not null,
    period_review_id text not null,
    body jsonb not null,
    source_lens_versions jsonb not null,
    source_event_high_watermark text not null,
    generated_at_utc timestamptz not null,
    generated_by text not null,
    constraint ck_period_operation_snapshots_v54_json_shape
        check (
            jsonb_typeof(body) = 'object'
            and jsonb_typeof(source_lens_versions) = 'object'
            and length(trim(generated_by)) > 0
        )
);

create index if not exists ix_period_operation_snapshots_review
    on period_operation_snapshots(tenant_id, period_review_id, generated_at_utc);

alter table period_action_plans
    add column if not exists tenant_id text,
    add column if not exists period_review_id text,
    add column if not exists title text,
    add column if not exists description text,
    add column if not exists owner_role text,
    add column if not exists owner_actor_id text null,
    add column if not exists due_at_utc timestamptz,
    add column if not exists created_work_item_id text null,
    add column if not exists committed_event_id text null,
    add column if not exists completed_event_id text null;

update period_action_plans
set tenant_id = coalesce(tenant_id, workspace_id),
    period_review_id = coalesce(period_review_id, period_id),
    title = coalesce(title, action_title),
    description = coalesce(description, action_type || ':' || target_metric),
    owner_role = coalesce(owner_role, owner_name, 'manager'),
    due_at_utc = coalesce(due_at_utc, updated_at_utc + interval '7 days'),
    committed_event_id = coalesce(committed_event_id, created_event_id);

alter table period_action_plans
    alter column tenant_id set not null,
    alter column period_review_id set not null,
    alter column title set not null,
    alter column description set not null,
    alter column owner_role set not null,
    alter column due_at_utc set not null;

do $$
begin
    alter table period_action_plans
        add constraint ck_period_action_plans_v54_status
        check (status in ('open', 'committed', 'in_progress', 'completed', 'cancelled', 'superseded'));
exception when duplicate_object then
    null;
end $$;

do $$
begin
    alter table period_action_plans
        add constraint ck_period_action_plans_owner_due_priority
        check (
            length(trim(owner_role)) > 0
            and due_at_utc is not null
            and length(trim(priority)) > 0
        );
exception when duplicate_object then
    null;
end $$;

alter table period_late_adjustments
    add column if not exists late_adjustment_id text,
    add column if not exists tenant_id text,
    add column if not exists period_review_id text,
    add column if not exists adjustment_type text,
    add column if not exists reason text,
    add column if not exists linked_correction_id text null,
    add column if not exists body jsonb,
    add column if not exists event_id text,
    add column if not exists created_by text,
    add column if not exists created_at_utc timestamptz;

update period_late_adjustments
set late_adjustment_id = coalesce(late_adjustment_id, adjustment_id),
    tenant_id = coalesce(tenant_id, workspace_id),
    period_review_id = coalesce(period_review_id, period_id),
    adjustment_type = coalesce(adjustment_type, adjustment_event_type),
    reason = coalesce(reason, adjustment_event_type),
    body = coalesce(body, adjustment_payload),
    event_id = coalesce(event_id, created_event_id),
    created_by = coalesce(created_by, 'period-projector'),
    created_at_utc = coalesce(created_at_utc, occurred_at_utc);

alter table period_late_adjustments
    alter column late_adjustment_id set not null,
    alter column tenant_id set not null,
    alter column period_review_id set not null,
    alter column adjustment_type set not null,
    alter column reason set not null,
    alter column body set not null,
    alter column event_id set not null,
    alter column created_by set not null,
    alter column created_at_utc set not null;

do $$
begin
    alter table period_late_adjustments
        add constraint uq_period_late_adjustments_late_adjustment_id unique(late_adjustment_id);
exception when duplicate_object then
    null;
end $$;

do $$
begin
    alter table period_late_adjustments
        add constraint ck_period_late_adjustments_body_object
        check (jsonb_typeof(body) = 'object' and length(trim(reason)) > 0);
exception when duplicate_object then
    null;
end $$;

create table if not exists risk_command_snapshots (
    risk_snapshot_id text primary key,
    tenant_id text not null,
    scope_key text not null,
    body jsonb not null,
    source_lens_versions jsonb not null,
    source_event_high_watermark text not null,
    generated_at_utc timestamptz not null,
    constraint ck_risk_command_snapshots_json_shape
        check (
            jsonb_typeof(body) = 'object'
            and jsonb_typeof(source_lens_versions) = 'object'
        )
);

create index if not exists ix_risk_command_snapshots_tenant_scope
    on risk_command_snapshots(tenant_id, scope_key, generated_at_utc);

create or replace function normalize_period_review_v54()
returns trigger
language plpgsql
as $$
begin
    new.period_id := coalesce(new.period_id, new.period_review_id);
    new.period_review_id := coalesce(new.period_review_id, new.period_id);
    new.tenant_id := coalesce(new.tenant_id, new.workspace_id);
    new.workspace_id := coalesce(new.workspace_id, new.tenant_id);
    new.period_year := coalesce(new.period_year, extract(year from coalesce(new.period_start_utc, now()))::integer);
    new.period_no := coalesce(new.period_no, 1);
    new.period_key := coalesce(new.period_key, new.period_year::text || '-' || lpad(new.period_no::text, 2, '0'));
    new.period_start_utc := coalesce(new.period_start_utc, date_trunc('month', now()));
    new.period_end_utc := coalesce(new.period_end_utc, new.period_start_utc + interval '1 month');
    new.scope_id := coalesce(new.scope_id, 'scope-' || new.period_review_id);
    new.opened_by := coalesce(new.opened_by, 'system');
    new.opened_at_utc := coalesce(new.opened_at_utc, new.period_start_utc, now());
    new.created_at_utc := coalesce(new.created_at_utc, new.opened_at_utc, now());
    new.updated_at_utc := coalesce(new.updated_at_utc, now());
    new.created_event_id := coalesce(new.created_event_id, new.source_high_watermark, new.period_review_id);
    new.closed_result := coalesce(new.closed_result, '');
    new.source_high_watermark := coalesce(new.source_high_watermark, new.closed_event_id, new.created_event_id);

    if new.status = 'scoped' then
        new.status := 'scope_confirmed';
    end if;

    if new.status = 'closed' then
        new.closed_event_id := coalesce(new.closed_event_id, new.created_event_id);
        new.closed_at_utc := coalesce(new.closed_at_utc, new.updated_at_utc, now());
    end if;

    return new;
end;
$$;

create or replace function sync_period_scope_from_review_v54()
returns trigger
language plpgsql
as $$
begin
    insert into period_scopes(
        scope_id,
        tenant_id,
        period_review_id,
        period_start,
        period_end,
        timezone,
        business_day_cutoff,
        status,
        frozen_at_utc,
        event_id)
    values (
        new.scope_id,
        new.tenant_id,
        new.period_review_id,
        new.period_start_utc,
        new.period_end_utc,
        'UTC',
        '00:00',
        case when new.status = 'open' then 'draft' else 'frozen' end,
        case when new.status = 'open' then null else coalesce(new.opened_at_utc, now()) end,
        new.created_event_id)
    on conflict(scope_id) do update set
        status = case when period_scopes.status = 'draft' and excluded.status = 'frozen' then 'frozen' else period_scopes.status end,
        frozen_at_utc = case
            when period_scopes.frozen_at_utc is null and excluded.frozen_at_utc is not null then excluded.frozen_at_utc
            else period_scopes.frozen_at_utc
        end;

    return new;
end;
$$;

create or replace function period_scope_freeze_fields()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'frozen' and new.frozen_at_utc is null then
        new.frozen_at_utc := now();
    end if;

    if tg_op = 'UPDATE' and old.frozen_at_utc is not null then
        if new.period_start is distinct from old.period_start
            or new.period_end is distinct from old.period_end
            or new.timezone is distinct from old.timezone
            or new.business_day_cutoff is distinct from old.business_day_cutoff
            or new.period_review_id is distinct from old.period_review_id then
            raise exception 'period_scope_freeze_fields: PeriodScopeConfirmed freezes scope boundaries';
        end if;
    end if;

    return new;
end;
$$;

create or replace function period_review_is_closed(review_id text, tenant text)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from period_reviews review
        where (review.period_review_id = review_id or review.period_id = review_id)
          and (tenant is null or review.tenant_id = tenant or review.workspace_id = tenant)
          and (review.status = 'closed' or review.closed_at_utc is not null)
    );
$$;

create or replace function guard_period_snapshot_append_only_after_close()
returns trigger
language plpgsql
as $$
declare
    new_body jsonb := coalesce(to_jsonb(new), '{}'::jsonb);
    old_body jsonb := coalesce(to_jsonb(old), '{}'::jsonb);
    review_id text := coalesce(new_body->>'period_review_id', new_body->>'period_id', old_body->>'period_review_id', old_body->>'period_id');
    tenant text := coalesce(new_body->>'tenant_id', new_body->>'workspace_id', old_body->>'tenant_id', old_body->>'workspace_id');
begin
    if review_id is not null and period_review_is_closed(review_id, tenant) then
        raise exception 'period_snapshot_append_only_after_close: append period_late_adjustments instead of writing snapshots after PeriodReviewClosed';
    end if;

    return new;
end;
$$;

create or replace function normalize_period_metric_snapshot_v54()
returns trigger
language plpgsql
as $$
begin
    new.period_id := coalesce(new.period_id, new.period_review_id, new.snapshot_id);
    new.snapshot_id := coalesce(new.snapshot_id, new.period_id);
    new.tenant_id := coalesce(new.tenant_id, new.workspace_id);
    new.workspace_id := coalesce(new.workspace_id, new.tenant_id);
    new.period_review_id := coalesce(new.period_review_id, new.period_id);
    new.body := coalesce(new.body, jsonb_build_object(
        'availableBedNight', coalesce(new.available_bed_night, 0),
        'bedNightSold', coalesce(new.bed_night_sold, 0),
        'averageOccupancyRate', coalesce(new.average_occupancy_rate, 0),
        'newLeadCount', coalesce(new.new_lead_count, 0),
        'reservationCount', coalesce(new.reservation_count, 0),
        'checkInCount', coalesce(new.check_in_count, 0)
    ));
    new.source_projection_versions := coalesce(new.source_projection_versions, '{}'::jsonb);
    new.source_event_high_watermark := coalesce(new.source_event_high_watermark, new.created_event_id, new.snapshot_id);
    new.generated_at_utc := coalesce(new.generated_at_utc, new.frozen_at_utc, now());
    new.generated_by := coalesce(new.generated_by, 'period-metric-projector');
    return new;
end;
$$;

create or replace function normalize_period_finance_snapshot_v54()
returns trigger
language plpgsql
as $$
begin
    new.period_id := coalesce(new.period_id, new.period_review_id, new.snapshot_id);
    new.snapshot_id := coalesce(new.snapshot_id, new.period_id);
    new.tenant_id := coalesce(new.tenant_id, new.workspace_id);
    new.workspace_id := coalesce(new.workspace_id, new.tenant_id);
    new.period_review_id := coalesce(new.period_review_id, new.period_id);
    new.body := coalesce(new.body, jsonb_build_object(
        'rentRevenue', coalesce(new.rent_revenue, 0),
        'otherRevenue', coalesce(new.other_revenue, 0),
        'confirmedPaymentAmount', coalesce(new.confirmed_payment_amount, 0),
        'pendingPaymentAmount', coalesce(new.pending_payment_amount, 0),
        'depositReceivedAmount', coalesce(new.deposit_received_amount, 0),
        'depositRefundedAmount', coalesce(new.deposit_refunded_amount, 0),
        'depositDeductedAmount', coalesce(new.deposit_deducted_amount, 0),
        'depositAppliedToBalanceAmount', coalesce(new.deposit_applied_to_balance_amount, 0),
        'depositLiabilityEnd', coalesce(new.deposit_liability_end, 0),
        'approvedExpenseAmount', coalesce(new.approved_expense_amount, 0),
        'pendingExpenseAmount', coalesce(new.pending_expense_amount, 0),
        'periodNetCashFlow', coalesce(new.period_net_cash_flow, 0),
        'endingDebtAmount', coalesce(new.ending_debt_amount, 0),
        'financeExceptionCount', coalesce(new.finance_exception_count, 0),
        'expenseStatus', 'not_integrated',
        'expenseSource', 'not_integrated',
        'expenseStatusWarning', '支出账本未接入，利润类指标不可用或待确认',
        'periodProfitMetricStatus', 'disabled',
        'periodNetProfit', null,
        'profitMetricUnavailableReason', '支出账本未接入，利润类指标不可用或待确认'
    ));
    new.source_ledger_versions := coalesce(new.source_ledger_versions, '{}'::jsonb);
    new.expense_status := coalesce(new.expense_status, 'not_integrated');
    new.source_event_high_watermark := coalesce(new.source_event_high_watermark, new.created_event_id, new.snapshot_id);
    new.generated_at_utc := coalesce(new.generated_at_utc, new.updated_at_utc, now());
    new.generated_by := coalesce(new.generated_by, 'period-finance-projector');

    if lower(new.generated_by) in ('user', 'manual', 'frontend') then
        raise exception 'period.finance_snapshot_from_ledgers_only: FinanceSnapshot cannot accept user hand-filled final numbers';
    end if;

    if new.expense_status = 'ledger_verified'
        and (
            not (new.body ? 'expenseSource')
            or coalesce(new.body->>'expenseSource', '') in ('', 'not_integrated', 'zero_by_default')
        ) then
        raise exception 'expense_status_required: verified requires integrated expense source';
    end if;

    if new.expense_status = 'zero_by_default' then
        raise exception 'expense_status_required: expense_status cannot be zero_by_default';
    end if;

    return new;
end;
$$;

create or replace function normalize_period_action_plan_v54()
returns trigger
language plpgsql
as $$
begin
    new.tenant_id := coalesce(new.tenant_id, new.workspace_id);
    new.workspace_id := coalesce(new.workspace_id, new.tenant_id);
    new.period_review_id := coalesce(new.period_review_id, new.period_id);
    new.title := coalesce(new.title, new.action_title);
    new.description := coalesce(new.description, new.action_type || ':' || new.target_metric);
    new.owner_role := coalesce(new.owner_role, new.owner_name, 'manager');
    new.due_at_utc := coalesce(new.due_at_utc, new.updated_at_utc + interval '7 days');
    new.committed_event_id := coalesce(new.committed_event_id, new.created_event_id);
    return new;
end;
$$;

create or replace function normalize_period_late_adjustment_v54()
returns trigger
language plpgsql
as $$
begin
    new.late_adjustment_id := coalesce(new.late_adjustment_id, new.adjustment_id);
    new.tenant_id := coalesce(new.tenant_id, new.workspace_id);
    new.workspace_id := coalesce(new.workspace_id, new.tenant_id);
    new.period_review_id := coalesce(new.period_review_id, new.period_id);
    new.adjustment_type := coalesce(new.adjustment_type, new.adjustment_event_type);
    new.reason := coalesce(new.reason, new.adjustment_event_type);
    new.body := coalesce(new.body, new.adjustment_payload, '{}'::jsonb);
    new.linked_correction_id := coalesce(new.linked_correction_id, new.body->>'CorrectionRequestId', new.body->>'correctionRequestId', new.body #>> '{after,payload,linkedCorrectionId}');
    new.event_id := coalesce(new.event_id, new.created_event_id);
    new.created_by := coalesce(new.created_by, 'period-projector');
    new.created_at_utc := coalesce(new.created_at_utc, new.occurred_at_utc, now());

    if not period_review_is_closed(new.period_review_id, new.tenant_id) then
        raise exception 'period_late_adjustment_requires_closed_period: LateAdjustment can only append after PeriodReviewClosed';
    end if;

    if not (new.body ? 'before') or not (new.body ? 'after') then
        raise exception 'period_late_adjustment_requires_before_after: LateAdjustment must carry before/after view';
    end if;

    return new;
end;
$$;

create or replace function forbid_period_late_adjustment_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'period_late_adjustments_append_only: LateAdjustment can only append';
end;
$$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_reviews_normalize_v54') then
        create trigger trg_period_reviews_normalize_v54
        before insert or update on period_reviews
        for each row execute function normalize_period_review_v54();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_reviews_sync_scope_v54') then
        create trigger trg_period_reviews_sync_scope_v54
        after insert or update on period_reviews
        for each row execute function sync_period_scope_from_review_v54();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_scopes_freeze_fields') then
        create trigger trg_period_scopes_freeze_fields
        before insert or update on period_scopes
        for each row execute function period_scope_freeze_fields();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_metric_snapshots_normalize_v54') then
        create trigger trg_period_metric_snapshots_normalize_v54
        before insert or update on period_metric_snapshots
        for each row execute function normalize_period_metric_snapshot_v54();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_finance_snapshots_normalize_v54') then
        create trigger trg_period_finance_snapshots_normalize_v54
        before insert or update on period_finance_snapshots
        for each row execute function normalize_period_finance_snapshot_v54();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_metric_snapshots_append_only_after_close') then
        create trigger trg_period_metric_snapshots_append_only_after_close
        before insert or update on period_metric_snapshots
        for each row execute function guard_period_snapshot_append_only_after_close();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_finance_snapshots_append_only_after_close') then
        create trigger trg_period_finance_snapshots_append_only_after_close
        before insert or update on period_finance_snapshots
        for each row execute function guard_period_snapshot_append_only_after_close();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_operation_snapshots_append_only_after_close') then
        create trigger trg_period_operation_snapshots_append_only_after_close
        before insert or update on period_operation_snapshots
        for each row execute function guard_period_snapshot_append_only_after_close();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_action_plans_normalize_v54') then
        create trigger trg_period_action_plans_normalize_v54
        before insert or update on period_action_plans
        for each row execute function normalize_period_action_plan_v54();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_late_adjustments_normalize_v54') then
        create trigger trg_period_late_adjustments_normalize_v54
        before insert on period_late_adjustments
        for each row execute function normalize_period_late_adjustment_v54();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_late_adjustments_forbid_update') then
        create trigger trg_period_late_adjustments_forbid_update
        before update on period_late_adjustments
        for each row execute function forbid_period_late_adjustment_mutation();
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'trg_period_late_adjustments_forbid_delete') then
        create trigger trg_period_late_adjustments_forbid_delete
        before delete on period_late_adjustments
        for each row execute function forbid_period_late_adjustment_mutation();
    end if;
end $$;

comment on table period_reviews is
    'MR-10 PeriodAnalytics review header. Legacy period_id/workspace_id columns are retained for compatibility; V5.4 callers use period_review_id and tenant_id.';

comment on table period_scopes is
    'MR-10 PeriodAnalytics scope table. PeriodScopeConfirmed freezes period_start, period_end, timezone, and business_day_cutoff.';

comment on table period_finance_snapshots is
    'MR-10 finance snapshots are machine-generated from ledgers. User-filled final finance numbers and zero-by-default expense status are forbidden.';

comment on table period_late_adjustments is
    'MR-10 late adjustments are append-only after period close; frozen snapshots are not edited.';
