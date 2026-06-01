# V5.4 DB Permission Contract

WorkOSNext manages the PostgreSQL role boundary in `infra/db/migrations/034_next_control_plane_runtime_roles.sql`. This document is the readable contract for that migration and for the RT-DB role permission tests.

## Required Users

- `workos_official_projector`
  - Reads and writes official projection tables only.
  - Must not read `shadow_runtime.*`.
  - Must not write `shadow_runtime.*`.
  - Must not write Control Plane gate/report/check result tables.

- `workos_shadow_runner`
  - Writes `shadow_runtime.command_submissions`, `shadow_runtime.domain_events`, `shadow_runtime.ledger_entries`, `shadow_runtime.lens_snapshots`, and `shadow_runtime.compare_inputs`.
  - May read the minimum active runtime source tables needed to build shadow comparisons.
  - Must not write official runtime tables.

- `workos_gate_runner`
  - Writes `control_plane.gate_results`.
  - Reads `control_plane.release_manifests`, `control_plane.feature_flags`, `control_plane.slice_cutover_states`, `control_plane.shadow_compare_reports`, and `control_plane.runtime_invariant_checks`.
  - Must not write official runtime facts.

- `workos_invariant_runner`
  - Writes `control_plane.runtime_invariant_checks`.
  - Reads active runtime source tables needed by approved invariant checks.
  - Must not write `control_plane.gate_results`.

- `workos_shadow_compare_runner`
  - Reads `shadow_runtime.compare_inputs`, `shadow_runtime.domain_events`, `shadow_runtime.ledger_entries`, and `shadow_runtime.lens_snapshots`.
  - Writes `control_plane.shadow_compare_reports`.
  - Must not write `control_plane.gate_results`.

- `workos_release_operator`
  - Writes `control_plane.release_manifests`, `control_plane.feature_flags`, `control_plane.slice_cutover_states`, and `control_plane.rollback_instructions`.
  - Reads Control Plane result tables.
  - Must not update `control_plane.gate_results.status`.

## Hard Boundary

The official projector must not read from `shadow_runtime.*`. Shadow data is comparison evidence only and must not become an implicit production source of truth. Any shadow mismatch must enter `control_plane.shadow_compare_reports`; it must not mutate `projection_checkpoints` or any official Lens table.

## Applied Role Migration

`034_next_control_plane_runtime_roles.sql` applies explicit grants equivalent to:

```sql
revoke all on schema shadow_runtime from workos_official_projector;
revoke all on all tables in schema shadow_runtime from workos_official_projector;

grant usage on schema shadow_runtime to workos_shadow_runner, workos_shadow_compare_runner;
grant insert, update, select on shadow_runtime.command_submissions,
  shadow_runtime.domain_events, shadow_runtime.ledger_entries,
  shadow_runtime.lens_snapshots, shadow_runtime.compare_inputs
  to workos_shadow_runner;
grant select on all tables in schema shadow_runtime to workos_shadow_compare_runner;

grant usage on schema control_plane to workos_gate_runner, workos_invariant_runner, workos_shadow_compare_runner, workos_release_operator;
grant insert, select on control_plane.gate_results to workos_gate_runner;
grant insert, select on control_plane.runtime_invariant_checks to workos_invariant_runner;
grant insert, select on control_plane.shadow_compare_reports to workos_shadow_compare_runner;
grant insert, update, select on control_plane.release_manifests to workos_release_operator;
grant insert, update, select on control_plane.feature_flags to workos_release_operator;
grant insert, update, select on control_plane.slice_cutover_states to workos_release_operator;
grant insert, update, select on control_plane.rollback_instructions to workos_release_operator;
```

## Machine Validation

- `tests/WorkOS.DatabaseSecurityTests/RealDbRolePermissionTests.cs` verifies the real PostgreSQL role permissions.
- `tests/WorkOS.DatabaseSecurityTests/ShadowPollutionIntegrationTests.cs` verifies shadow data cannot become an official projection source and that Red `ShadowCompareReport` blocks the gate decision.
- `scripts/v5_4/shadow-namespace-isolation.mjs` verifies that the role migration, permission contract, and shadow isolation tests are present.
