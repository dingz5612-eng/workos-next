alter table runtime_sessions add column if not exists revoked_at_utc timestamptz null;
alter table runtime_sessions add column if not exists revoked_by text null;

create index if not exists ix_runtime_sessions_active
    on runtime_sessions(token, expires_at_utc)
    where revoked_at_utc is null;

create table if not exists device_sessions (
    device_session_id text primary key,
    tenant_id text not null,
    actor_id text not null,
    device_id text not null,
    device_trust_status text not null
        check (device_trust_status in ('unknown', 'trusted', 'untrusted', 'revoked')),
    user_agent_hash text not null,
    created_at_utc timestamptz not null,
    last_seen_at_utc timestamptz not null,
    revoked_at_utc timestamptz null,
    revoked_by text null
);

create unique index if not exists ux_device_sessions_device
    on device_sessions(device_id);

create index if not exists ix_device_sessions_actor
    on device_sessions(tenant_id, actor_id, device_trust_status);

create table if not exists file_access_audits (
    audit_event_id text primary key,
    evidence_id text not null,
    attachment_id text null,
    actor_id text not null,
    device_id text null,
    action text not null,
    status text not null,
    reason text not null,
    expires_at_utc timestamptz null,
    occurred_at_utc timestamptz not null
);

create index if not exists ix_file_access_audits_evidence
    on file_access_audits(evidence_id, occurred_at_utc);

create table if not exists governance_export_audits (
    audit_event_id text primary key,
    export_type text not null,
    actor_id text not null,
    device_id text not null,
    status text not null,
    reason text not null,
    expires_at_utc timestamptz not null,
    occurred_at_utc timestamptz not null
);

create index if not exists ix_governance_export_audits_type
    on governance_export_audits(export_type, occurred_at_utc);
