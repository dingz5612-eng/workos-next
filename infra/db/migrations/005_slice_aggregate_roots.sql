create table if not exists accommodation_rooms (
    room_id text primary key,
    workspace_id text not null,
    room_no text not null,
    room_type text not null,
    capacity integer not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create unique index if not exists ux_accommodation_rooms_room_no on accommodation_rooms(room_no);

create table if not exists accommodation_beds (
    bed_id text primary key,
    workspace_id text not null,
    room_id text not null,
    bed_no text not null,
    bunk_type text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create unique index if not exists ux_accommodation_beds_bed_no on accommodation_beds(bed_no);

create table if not exists accommodation_deposits (
    deposit_id text primary key,
    workspace_id text not null,
    stay_order_id text not null,
    amount numeric(18, 2) not null,
    currency text not null,
    payment_method text not null,
    evidence_id text not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists finance_confirmations (
    finance_confirmation_id text primary key,
    workspace_id text not null,
    deposit_id text not null,
    confirmed_amount numeric(18, 2) not null,
    currency text not null,
    status text not null,
    confirmed_by text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create table if not exists repair_stations (
    station_id text primary key,
    station_name text not null,
    status text not null,
    updated_at_utc timestamptz not null
);

create table if not exists repair_technicians (
    technician_id text primary key,
    display_name text not null,
    skill_group text not null,
    status text not null,
    updated_at_utc timestamptz not null
);

create table if not exists repair_vehicles (
    vehicle_id text primary key,
    plate_no text not null,
    model text not null,
    vin text not null,
    status text not null,
    updated_at_utc timestamptz not null
);

insert into repair_stations(station_id, station_name, status, updated_at_utc)
values
    ('station-01', '1 号位', 'available', now()),
    ('station-02', '2 号位', 'available', now())
on conflict(station_id) do nothing;

insert into repair_technicians(technician_id, display_name, skill_group, status, updated_at_utc)
values
    ('tech-alexey', 'Алексей Смирнов', 'diagnosis', 'available', now()),
    ('tech-ivan', 'Иван Орлов', 'repair', 'available', now())
on conflict(technician_id) do nothing;

insert into repair_vehicles(vehicle_id, plate_no, model, vin, status, updated_at_utc)
values
    ('veh-camry-01', '01KG123ABC', 'Toyota Camry', 'VIN-CAMRY-001', 'active', now()),
    ('veh-sprinter-01', '01KG777', 'Mercedes Sprinter', 'VIN-SPRINTER-001', 'active', now())
on conflict(vehicle_id) do nothing;
