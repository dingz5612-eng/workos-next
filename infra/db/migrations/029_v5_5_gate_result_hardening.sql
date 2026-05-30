-- V5.5 GateResult hardening and BusinessSignoff evidence.
-- Rollback guidance: drop trigger/function first, then constraints and
-- control_plane.business_signoffs only if release evidence has been archived.

create table if not exists control_plane.business_signoffs (
    business_signoff_id text primary key,
    release_id text not null references control_plane.release_manifests(release_id) on delete restrict,
    mr_id text not null,
    signer_actor_id text not null,
    signer_role text not null,
    signoff_type text not null,
    decision text not null,
    note text null,
    signed_at_utc timestamptz not null default now(),
    constraint ck_business_signoffs_decision
        check (decision in ('approved', 'rejected', 'waived')),
    constraint ck_business_signoffs_type
        check (signoff_type in ('business', 'finance', 'release', 'risk', 'waiver'))
);

create index if not exists ix_business_signoffs_release_mr
    on control_plane.business_signoffs(release_id, mr_id, signed_at_utc desc);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ck_gate_results_generated_by_gate_runner'
          and conrelid = 'control_plane.gate_results'::regclass
    ) then
        alter table control_plane.gate_results
            add constraint ck_gate_results_generated_by_gate_runner
            check (status <> 'passed' or generated_by = 'gate-runner') not valid;
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'ck_gate_results_passed_requires_ci_run'
          and conrelid = 'control_plane.gate_results'::regclass
    ) then
        alter table control_plane.gate_results
            add constraint ck_gate_results_passed_requires_ci_run
            check (status <> 'passed' or nullif(ci_run_id, '') is not null) not valid;
    end if;
end
$$;

create or replace function control_plane.prevent_gate_results_immutable_update()
returns trigger
language plpgsql
as $$
begin
    if (old.status = 'passed' or new.status = 'passed') and (
       old.status is distinct from new.status
       or old.severity is distinct from new.severity
       or old.generated_by is distinct from new.generated_by
       or old.generated_at_utc is distinct from new.generated_at_utc
       or old.input_hash is distinct from new.input_hash
       or old.result_hash is distinct from new.result_hash) then
        raise exception 'control_plane.gate_results immutable evidence columns cannot be updated';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_gate_results_immutable_columns on control_plane.gate_results;
create trigger trg_gate_results_immutable_columns
before update on control_plane.gate_results
for each row
execute function control_plane.prevent_gate_results_immutable_update();
