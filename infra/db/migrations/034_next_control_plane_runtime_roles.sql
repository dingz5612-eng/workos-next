-- RT-DB control plane/runtime database role isolation.
-- Rollback note: role grants are cluster-level security configuration. If this
-- contract must be reversed before production use, first revoke the grants
-- below from each workos_* role, then drop the no-login roles after confirming
-- no active runtime connection is using them.

do $$
declare
    role_name text;
begin
    foreach role_name in array array[
        'workos_official_projector',
        'workos_shadow_runner',
        'workos_gate_runner',
        'workos_invariant_runner',
        'workos_shadow_compare_runner',
        'workos_release_operator'
    ]
    loop
        if not exists (select 1 from pg_roles where rolname = role_name) then
            execute format('create role %I nologin', role_name);
        end if;

        execute format('grant %I to %I', role_name, current_user);
    end loop;
end $$;

revoke all on schema control_plane from public;
revoke all on all tables in schema control_plane from public;
revoke all on schema shadow_runtime from public;
revoke all on all tables in schema shadow_runtime from public;

revoke all on schema shadow_runtime from
    workos_official_projector,
    workos_gate_runner,
    workos_invariant_runner,
    workos_release_operator;

revoke all on all tables in schema shadow_runtime from
    workos_official_projector,
    workos_gate_runner,
    workos_invariant_runner,
    workos_release_operator;

grant usage on schema control_plane to
    workos_gate_runner,
    workos_invariant_runner,
    workos_shadow_compare_runner,
    workos_release_operator;

grant usage on schema shadow_runtime to
    workos_shadow_runner,
    workos_shadow_compare_runner;

grant usage on schema public to
    workos_official_projector,
    workos_shadow_runner,
    workos_invariant_runner;

grant select on all tables in schema public to
    workos_shadow_runner,
    workos_invariant_runner;

grant select, insert, update on table
    shadow_runtime.command_submissions,
    shadow_runtime.domain_events,
    shadow_runtime.ledger_entries,
    shadow_runtime.lens_snapshots,
    shadow_runtime.compare_inputs
to workos_shadow_runner;

grant select on table
    shadow_runtime.compare_inputs,
    shadow_runtime.domain_events,
    shadow_runtime.ledger_entries,
    shadow_runtime.lens_snapshots
to workos_shadow_compare_runner;

grant select on table
    control_plane.release_manifests,
    control_plane.feature_flags,
    control_plane.slice_cutover_states,
    control_plane.shadow_compare_reports,
    control_plane.runtime_invariant_checks,
    control_plane.rollback_instructions
to workos_gate_runner;

grant insert, select on table control_plane.gate_results to workos_gate_runner;

grant insert, select on table control_plane.runtime_invariant_checks to workos_invariant_runner;

grant insert, select on table control_plane.shadow_compare_reports to workos_shadow_compare_runner;

grant select, insert, update on table
    control_plane.release_manifests,
    control_plane.feature_flags,
    control_plane.slice_cutover_states,
    control_plane.rollback_instructions
to workos_release_operator;

grant select on table
    control_plane.gate_results,
    control_plane.runtime_invariant_checks,
    control_plane.shadow_compare_reports
to workos_release_operator;

do $$
begin
    if to_regclass('public.projection_rebuild_audits') is not null then
        grant select, insert, update on public.projection_rebuild_audits to workos_official_projector;
    end if;

    if to_regclass('public.projection_checkpoints') is not null then
        grant select, insert, update on public.projection_checkpoints to workos_official_projector;
    end if;
end $$;

alter default privileges in schema control_plane revoke all on tables from public;
alter default privileges in schema shadow_runtime revoke all on tables from public;
