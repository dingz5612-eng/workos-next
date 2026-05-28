create table if not exists hostel_leads (
    lead_id text primary key,
    workspace_id text not null,
    guest_name text not null,
    phone text not null,
    beds_needed integer not null,
    stay_duration text not null,
    source_channel text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists hostel_bookings (
    booking_id text primary key,
    workspace_id text not null,
    lead_id text not null,
    reserved_room_bed text not null,
    beds_reserved integer not null,
    check_in_date timestamptz not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists hostel_stays (
    stay_id text primary key,
    workspace_id text not null,
    resident_name text not null,
    phone text not null,
    room_bed text not null,
    check_in_date timestamptz not null,
    planned_checkout_date timestamptz not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists guest_folios (
    folio_id text primary key,
    workspace_id text not null,
    stay_id text not null,
    tariff_type text not null,
    unit_price numeric(18, 2) not null,
    quantity numeric(18, 2) not null,
    charge_amount numeric(18, 2) not null,
    paid_amount numeric(18, 2) not null,
    balance numeric(18, 2) not null,
    currency text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists deposit_liabilities (
    deposit_id text primary key,
    workspace_id text not null,
    folio_id text not null,
    required_amount numeric(18, 2) not null,
    received_amount numeric(18, 2) not null,
    liability_balance numeric(18, 2) not null,
    currency text not null,
    rule_name text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists hostel_payments (
    payment_id text primary key,
    workspace_id text not null,
    folio_id text not null,
    deposit_id text not null,
    payer text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    method text not null,
    purpose text not null,
    receipt_no text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists finance_reconciliations (
    reconciliation_id text primary key,
    workspace_id text not null,
    payment_id text not null,
    channel text not null,
    confirmed_amount numeric(18, 2) not null,
    currency text not null,
    match_result text not null,
    variance_amount numeric(18, 2) not null,
    status text not null,
    confirmed_by text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists hostel_operating_metrics (
    metrics_id text primary key,
    workspace_id text not null,
    occupancy_rate numeric(8, 4) not null,
    lead_booking_conversion_rate numeric(8, 4) not null,
    booking_checkin_conversion_rate numeric(8, 4) not null,
    deposit_liability_balance numeric(18, 2) not null,
    unconfirmed_payment_amount numeric(18, 2) not null,
    finance_variance_amount numeric(18, 2) not null,
    folio_balance numeric(18, 2) not null,
    decision text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);
