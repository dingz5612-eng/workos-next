-- OAM current: CommandSubmission context columns.
-- Rollback guidance: additive-only before production. To reverse before
-- production readiness, event_log operations_command_submissions and drop these
-- nullable columns after dependent evidence has been rebuilt from envelopes.

alter table operations_command_submissions
    add column if not exists actor_id text null,
    add column if not exists actor_role text null,
    add column if not exists actor_tenant_id text null,
    add column if not exists auth_source text null,
    add column if not exists device_id text null,
    add column if not exists device_trust_status text null,
    add column if not exists surface text null,
    add column if not exists reason text null,
    add column if not exists admission_decision_ref text null;

create index if not exists ix_operations_command_submissions_context_actor
    on operations_command_submissions(tenant_id, actor_id, submitted_at_utc);

create index if not exists ix_operations_command_submissions_admission_ref
    on operations_command_submissions(tenant_id, admission_decision_ref, submitted_at_utc);
