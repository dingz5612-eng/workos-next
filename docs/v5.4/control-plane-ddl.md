# V5.4 Control Plane and Shadow Runtime DDL

Migration: `infra/db/migrations/015_control_plane_shadow_runtime.sql`

WorkOSNext currently uses the custom SQL migration runner (`PostgresMigrationRunner` + `MigrationScriptLoader`). This change follows the existing SQL migration style and is applied by file-name order after `014_runtime_evidence_card_instances.sql`.

## Schemas

- `control_plane`: release admission, feature flag, cutover, gate, invariant, compare, and rollback metadata.
- `shadow_runtime`: isolated write namespace for shadow runner command submissions, events, ledger entries, lens snapshots, and compare inputs.

## Control Plane Tables

- `control_plane.release_manifests`
  - Primary key: `release_id`
  - Required release fields include `mr_id`, `release_name`, `status`, `owners`, `definition_version`, gate/report/check reference arrays, acceptance/go/no-go/risk arrays, and lifecycle timestamps.
  - `status` is constrained to `planned`, `built`, `shadow`, `pilot`, `active`, `locked`, `paused`, `rollback`, `compensating`, `rejected`.

- `control_plane.feature_flags`
  - Primary key: `feature_flag_id`
  - Foreign key: `release_id -> control_plane.release_manifests`
  - Unique key: `(release_id, flag_key)`
  - `status` is constrained to `disabled`, `shadow`, `pilot`, `active`, `paused`, `retired`.
  - `scope_rules` is JSONB and supports `tenantIds`, `sliceIds`, `roles`, `actorIds`, `deviceIds`, `deviceTrust`, `amount.currency`, `amount.lte`, `amount.gte`, and `percentage`.

- `control_plane.slice_cutover_states`
  - Primary key: `cutover_state_id`
  - Foreign key: `release_id -> control_plane.release_manifests`
  - Unique key: `(release_id, tenant_id, slice_id)`
  - `runtime_mode` and `previous_runtime_mode` are constrained to `legacy`, `shadow`, `pilot`, `active`, `rollback`, `locked`, `paused`.

- `control_plane.shadow_compare_reports`
  - Primary key: `shadow_compare_report_id`
  - Foreign key: `release_id -> control_plane.release_manifests`
  - `grade` is constrained to `green`, `yellow`, `red`.

- `control_plane.runtime_invariant_checks`
  - Primary key: `invariant_check_id`
  - Foreign key: `release_id -> control_plane.release_manifests`
  - `mode` is constrained to `blocking`, `observing`.
  - `severity` is constrained to `P0`, `P1`, `P2`.

- `control_plane.gate_results`
  - Primary key: `gate_result_id`
  - Foreign key: `release_id -> control_plane.release_manifests`
  - `status` is constrained to `passed`, `failed`, `blocked`, `warning`, `not_run`.
  - `severity` is constrained to `P0`, `P1`, `P2`.

- `control_plane.rollback_instructions`
  - Primary key: `rollback_instruction_id`
  - Foreign key: `release_id -> control_plane.release_manifests`
  - `instruction_type` is constrained to `rollback`, `compensating`.
  - `rollback_kind` is constrained to `feature_flag`, `runtime_mode`, `shadow_cleanup`, `migration_down`, `business_reversal`, `business_correction`, `manual_compensation`.

## Shadow Runtime Tables

- `shadow_runtime.command_submissions`: shadow command input envelope with tenant, slice, workspace/card, actor, payload, and idempotency key.
- `shadow_runtime.domain_events`: shadow-only domain event payloads linked to `command_submissions`.
- `shadow_runtime.ledger_entries`: shadow-only ledger movements linked to `command_submissions`.
- `shadow_runtime.lens_snapshots`: shadow-only lens payload snapshots for comparison.
- `shadow_runtime.compare_inputs`: captured active/legacy/shadow compare basis.

## DB Mapping

The no-ORM DB mapping lives in `services/core-api/WorkOS.Api/Runtime/ControlPlaneDbMapping.cs`. It records:

- schema names,
- the 7 Control Plane table contracts,
- the 5 Shadow Runtime table contracts,
- allowed status/mode/grade/severity/rollback values.

The Control Plane write path lives in `services/core-api/WorkOS.Api/Runtime/ControlPlaneWriteStore.cs`. It exposes:

- `WriteGateResult(...)` for `control_plane.gate_results`,
- `WriteRuntimeInvariantCheck(...)` for `control_plane.runtime_invariant_checks`,
- `WriteShadowCompareReport(...)` for `control_plane.shadow_compare_reports`.

## Rollback Note

The current project migration runner is up-only and does not have a down migration registry. The migration includes a rollback note. If rollback is approved before data must be retained, use a reviewed compensating migration:

```sql
drop schema if exists shadow_runtime cascade;
drop schema if exists control_plane cascade;
```

After production data exists, prefer targeted compensating migrations over schema drops.

## Validation

Runtime contract coverage verifies:

- migration up creates both schemas,
- all 7 Control Plane tables exist,
- all Shadow Runtime minimum tables exist,
- `shadow_compare_reports.grade` rejects invalid values,
- `runtime_invariant_checks.mode` rejects invalid values,
- `rollback_instructions.instruction_type` rejects invalid values,
- `feature_flags.scope_rules` stores tenant, slice, role, actor, device, trust, amount, and percentage scope data.
