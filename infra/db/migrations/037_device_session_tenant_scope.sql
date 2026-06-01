drop index if exists ux_device_sessions_device;

create unique index if not exists ux_device_sessions_tenant_device
    on device_sessions(tenant_id, device_id);

create index if not exists ix_device_sessions_tenant_actor
    on device_sessions(tenant_id, actor_id, device_trust_status, last_seen_at_utc);

alter table file_access_audits add column if not exists tenant_id text;
update file_access_audits audit
set tenant_id = evidence.tenant_id
from evidence_objects evidence
where audit.evidence_id = evidence.evidence_id
  and (audit.tenant_id is null or audit.tenant_id = '');
update file_access_audits
set tenant_id = 'unknown-tenant'
where tenant_id is null or tenant_id = '';
alter table file_access_audits alter column tenant_id set not null;

create index if not exists ix_file_access_audits_tenant_evidence
    on file_access_audits(tenant_id, evidence_id, occurred_at_utc);

alter table governance_export_audits add column if not exists tenant_id text;
update governance_export_audits
set tenant_id = 'governance-tenant'
where tenant_id is null or tenant_id = '';
alter table governance_export_audits alter column tenant_id set not null;

create index if not exists ix_governance_export_audits_tenant_type
    on governance_export_audits(tenant_id, export_type, occurred_at_utc);
