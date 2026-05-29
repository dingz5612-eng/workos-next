create table if not exists period_reviews (
    period_id text primary key,
    workspace_id text not null,
    period_year integer not null,
    period_no integer not null,
    period_start_utc timestamptz not null,
    period_end_utc timestamptz not null,
    status text not null,
    closed_result text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists period_metric_snapshots (
    period_id text primary key,
    workspace_id text not null,
    available_bed_night numeric(18, 2) not null,
    bed_night_sold numeric(18, 2) not null,
    average_occupancy_rate numeric(18, 6) not null,
    average_occupancy_rate_status text not null,
    new_lead_count numeric(18, 2) not null,
    reservation_count numeric(18, 2) not null,
    lead_to_reservation_rate numeric(18, 6) not null,
    lead_to_reservation_rate_status text not null,
    check_in_count numeric(18, 2) not null,
    reservation_to_check_in_rate numeric(18, 6) not null,
    reservation_to_check_in_rate_status text not null,
    snapshot_frozen boolean not null,
    created_event_id text not null,
    frozen_at_utc timestamptz not null
);

create table if not exists period_finance_snapshots (
    period_id text primary key,
    workspace_id text not null,
    rent_revenue numeric(18, 2) not null,
    other_revenue numeric(18, 2) not null,
    confirmed_payment_amount numeric(18, 2) not null,
    pending_payment_amount numeric(18, 2) not null,
    deposit_received_amount numeric(18, 2) not null,
    deposit_refunded_amount numeric(18, 2) not null,
    deposit_deducted_amount numeric(18, 2) not null,
    deposit_applied_to_balance_amount numeric(18, 2) not null,
    deposit_liability_end numeric(18, 2) not null,
    approved_expense_amount numeric(18, 2) not null,
    pending_expense_amount numeric(18, 2) not null,
    period_net_cash_flow numeric(18, 2) not null,
    ending_debt_amount numeric(18, 2) not null,
    finance_exception_count integer not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists period_operation_diagnoses (
    diagnosis_id text primary key,
    period_id text not null,
    workspace_id text not null,
    issue_category text not null,
    issue_summary text not null,
    root_cause text not null,
    blocked_bed_days numeric(18, 2) not null,
    unfinished_task_count integer not null,
    overdue_task_count integer not null,
    debtor_count integer not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists period_action_plans (
    action_plan_id text primary key,
    period_id text not null,
    workspace_id text not null,
    action_title text not null,
    action_type text not null,
    target_metric text not null,
    target_value numeric(18, 2) not null,
    owner_name text not null,
    priority text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists period_late_adjustments (
    adjustment_id text primary key,
    period_id text not null,
    workspace_id text not null,
    adjustment_event_type text not null,
    adjustment_payload jsonb not null,
    created_event_id text not null,
    occurred_at_utc timestamptz not null
);
