create table if not exists hostel_residents (
    resident_id text primary key,
    workspace_id text not null,
    resident_name text not null,
    phone text not null,
    identity_type text not null,
    identity_no text not null,
    gender text not null,
    nationality text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists hostel_charges (
    charge_id text primary key,
    workspace_id text not null,
    stay_id text not null,
    charge_type text not null,
    period_start_utc timestamptz not null,
    period_end_utc timestamptz not null,
    amount numeric(18, 2) not null,
    currency text not null,
    reason text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

alter table if exists hostel_bookings
    add column if not exists hold_until_utc timestamptz;
