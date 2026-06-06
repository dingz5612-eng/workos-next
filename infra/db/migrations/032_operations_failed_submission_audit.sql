-- Current OAM: CommandSubmission audit closure for failed and rejected submissions.
-- Rollback guidance: this migration is additive. To reverse before production,
-- review operations_command_submissions, drop dependent response rows, then
-- drop these audit columns and restore the prior status constraint.

alter table operations_command_submissions
    add column if not exists failure_code text null,
    add column if not exists failure_reason text null,
    add column if not exists rejected_at_utc timestamptz null,
    add column if not exists failed_at_utc timestamptz null,
    add column if not exists response_status_code integer null;

alter table operations_command_submissions
    drop constraint if exists ck_operations_command_submissions_status;

alter table operations_command_submissions
    add constraint ck_operations_command_submissions_status
    check (status in ('pending', 'committed', 'rejected', 'failed'));

alter table operations_command_submissions
    drop constraint if exists ck_operations_command_submissions_failure_audit;

alter table operations_command_submissions
    add constraint ck_operations_command_submissions_failure_audit
    check (
        (status <> 'failed' or (
            failure_code is not null and
            failure_reason is not null and
            failed_at_utc is not null and
            response_status_code is not null
        )) and
        (status <> 'rejected' or (
            rejected_at_utc is not null and
            response_status_code is not null
        )) and
        (response_status_code is null or response_status_code between 100 and 599)
    );

create index if not exists ix_operations_command_submissions_status_audit
    on operations_command_submissions(tenant_id, status, submitted_at_utc);
