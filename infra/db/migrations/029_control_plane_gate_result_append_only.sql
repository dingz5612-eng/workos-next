-- OMA current Control Plane gate result append-only contract.
-- Rollback guidance: drop trigger/function first, then constraints and
-- control_plane.business_signoffs only if release governance records have been archived.
-- Formal GateResult rows are insert-only. A corrected run must create a new
-- gate_result_id or an append-only revision record, never update governance records in
-- place.
-- Protected fields include status, severity, ci_run_id,
-- automated_test_refs, invariant_check_refs, shadow_compare_report_refs,
-- business_signoff_refs, no_go_items, go_items, known_risks, generated_by,
-- generated_at_utc, input_hash, and result_hash.

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

alter table control_plane.gate_results
    validate constraint ck_gate_results_generated_by_gate_runner;

alter table control_plane.gate_results
    validate constraint ck_gate_results_passed_requires_ci_run;

create or replace function control_plane.prevent_gate_results_immutable_update()
returns trigger
language plpgsql
as $$
begin
    if TG_OP = 'UPDATE' then
        raise exception 'control_plane.gate_results are append-only; create a new gate_result_id or gate_result_revisions row';
    elsif TG_OP = 'DELETE' then
        raise exception 'control_plane.gate_results are append-only and cannot be deleted';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_gate_results_immutable_columns on control_plane.gate_results;
create trigger trg_gate_results_immutable_columns
before update or delete on control_plane.gate_results
for each row
execute function control_plane.prevent_gate_results_immutable_update();
