create table if not exists accommodation_rate_plans (
    rate_plan_id text primary key,
    workspace_id text not null,
    room_id text not null,
    daily_rate_per_bed numeric(18, 2) not null,
    weekly_rate_per_bed numeric(18, 2) not null,
    monthly_rate_per_bed numeric(18, 2) not null,
    currency text not null,
    effective_from_utc timestamptz not null,
    status text not null,
    created_event_id text not null,
    updated_at_utc timestamptz not null
);

create index if not exists ix_accommodation_rate_plans_room_id on accommodation_rate_plans(room_id);
create index if not exists ix_accommodation_rate_plans_effective_from on accommodation_rate_plans(effective_from_utc);
