alter table card_instances add column if not exists tenant_id text;
update card_instances
set tenant_id = coalesce(tenant_id, workspace_id)
where tenant_id is null or tenant_id = '';
alter table card_instances alter column tenant_id set not null;

alter table evidence_objects add column if not exists tenant_id text;
update evidence_objects
set tenant_id = coalesce(tenant_id, workspace_id)
where tenant_id is null or tenant_id = '';
alter table evidence_objects alter column tenant_id set not null;

alter table evidence_attachments add column if not exists tenant_id text;
update evidence_attachments attachment
set tenant_id = evidence.tenant_id
from evidence_objects evidence
where attachment.evidence_id = evidence.evidence_id
  and (attachment.tenant_id is null or attachment.tenant_id = '');
alter table evidence_attachments alter column tenant_id set not null;

alter table evidence_requirements add column if not exists tenant_id text;
update evidence_requirements
set tenant_id = coalesce(tenant_id, workspace_id)
where tenant_id is null or tenant_id = '';
alter table evidence_requirements alter column tenant_id set not null;

create index if not exists ix_card_instances_tenant_scope
    on card_instances(tenant_id, workspace_id, card_id, aggregate_ref, status);

create unique index if not exists ux_evidence_objects_tenant_evidence
    on evidence_objects(tenant_id, evidence_id);

create index if not exists ix_evidence_objects_tenant_scope
    on evidence_objects(tenant_id, workspace_id, card_id, card_instance_id, submission_id, requirement_id);

create index if not exists ix_evidence_attachments_tenant_scope
    on evidence_attachments(tenant_id, evidence_id, attachment_id);

create index if not exists ix_evidence_requirements_tenant_scope
    on evidence_requirements(tenant_id, workspace_id, card_id, requirement_id);

alter table evidence_attachments
    drop constraint if exists fk_evidence_attachments_tenant_evidence;
alter table evidence_attachments
    add constraint fk_evidence_attachments_tenant_evidence
    foreign key (tenant_id, evidence_id)
    references evidence_objects(tenant_id, evidence_id)
    on delete restrict;

alter table evidence_requirements
    drop constraint if exists fk_evidence_requirements_tenant_evidence;
alter table evidence_requirements
    add constraint fk_evidence_requirements_tenant_evidence
    foreign key (tenant_id, evidence_id)
    references evidence_objects(tenant_id, evidence_id)
    on delete restrict;
