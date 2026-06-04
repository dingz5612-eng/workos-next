create table if not exists account_users (
    user_id text primary key,
    tenant_id text not null,
    username text not null,
    display_name text not null,
    department text not null,
    business_line text not null,
    primary_role text not null,
    roles jsonb not null default '[]'::jsonb,
    capabilities jsonb not null default '[]'::jsonb,
    status text not null default 'active',
    password_hash text not null,
    development_only boolean not null default false,
    created_by text not null,
    created_at_utc timestamptz not null,
    updated_at_utc timestamptz not null,
    disabled_at_utc timestamptz null,
    disabled_by text null,
    constraint account_users_status_check check (status in ('active', 'invited', 'disabled', 'locked')),
    constraint account_users_roles_array check (jsonb_typeof(roles) = 'array'),
    constraint account_users_capabilities_array check (jsonb_typeof(capabilities) = 'array')
);

create unique index if not exists ux_account_users_tenant_username
    on account_users(tenant_id, lower(username));

create index if not exists ix_account_users_tenant_status
    on account_users(tenant_id, status);

create table if not exists account_audit_events (
    audit_event_id text primary key,
    tenant_id text not null,
    actor_id text not null,
    event_type text not null,
    target_user_id text not null,
    payload jsonb not null default '{}'::jsonb,
    occurred_at_utc timestamptz not null
);

create index if not exists ix_account_audit_events_tenant_time
    on account_audit_events(tenant_id, occurred_at_utc desc);
