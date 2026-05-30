# V5.4 Control Plane Runners

The first runnable Control Plane runners live behind the stable script entry
points in `scripts/v5_4/`. The scripts call the .NET runner project in
`tools/control-plane/WorkOS.ControlPlaneRunners` so they can use the existing
PostgreSQL stack and write Control Plane rows directly.

## Commands

```powershell
node scripts/v5_4/invariant-runner.mjs --out=.tmp/v5_4/invariant-checks.json
node scripts/v5_4/ledger-inspection.mjs --job-mode=manual --report-out=.tmp/v5_4/ledger-inspection-report.json
node scripts/v5_4/migration-verification.mjs --dry-run=true --report-out=.tmp/v5_4/migration-verification-report.json --backfill-out=.tmp/v5_4/legacy-backfill-report.json
node scripts/v5_4/backup-restore-smoke.mjs --dry-run=true --report-out=.tmp/v5_4/backup-restore-smoke-report.json
node scripts/v5_4/shadow-compare-runner.mjs --out=.tmp/v5_4/shadow-compare-report.json
node scripts/v5_4/gate-runner.mjs --invariant=.tmp/v5_4/invariant-checks.json --shadow=.tmp/v5_4/shadow-compare-report.json --out=.tmp/v5_4/gate-result.json
```

Connection resolution order:

1. `--connection=...`
2. `WORKOS_TEST_CONNECTION`
3. `ConnectionStrings__WorkOSRuntime`
4. local default `Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev`

## Invariant Runner

The invariant runner reads `docs/v5.4/invariant-definitions.json`. Each
definition uses `mode = blocking | observing` and `severity = P0 | P1 | P2`.

First-batch built-ins:

- `shadow.no_shadow_event_consumed_by_official_projector`
- `api.no_page_specific_business_write`
- `runtime.control_plane_tables_exist`
- `case.closed_has_no_open_blocker`
- `case.close_requires_closure_policy`
- `blocker.no_duplicate_open_resolution`
- `service.cannot_directly_change_bed_status`
- `checkout.cannot_directly_write_deposit_entry`
- `checkout.cleaning_required_before_release`

The runner executes skeleton checks or SQL checks and writes
`control_plane.runtime_invariant_checks`.

## Shadow Compare Runner

The shadow compare runner reads `docs/v5.4/shadow-compare.config.json`.
Checkout / Service / BlockerEngine can pass
`--config=docs/v5.4/checkout-service-shadow-compare.config.json`.

First-batch behavior:

- no shadow and no active data: `green`
- missing configured schema/table: `red`
- count mismatch: `yellow` or `red`, based on `count_mismatch_grade`
- optional `green_rules`, `yellow_rules`, and `red_rules` are copied into the
  report `compare_scope` so GateResult evidence can explain the grade contract.

The runner writes `control_plane.shadow_compare_reports`.

## Ledger Inspection Job

The ledger inspection job runs daily, manually, or inside release gates. It
executes Money / Deposit / StayBalance / PeriodFinanceSnapshot / Correction
Center consistency SQL, writes one `control_plane.runtime_invariant_checks` row
per check, and stores the reconciliation job report plus PC dashboard summary in
`control_plane.ledger_inspection_job_reports`.

## Migration Verification And Legacy Freeze

The migration verification job runs migration dry-run evidence, old runtime data
scan, legacy-to-new runtime mapping, old view vs new Lens comparison, legacy
backfill dry-run, rollback note validation, and legacy compatibility freeze
evidence.

It writes four release gate invariants:

- `migration.dry_run_success`
- `legacy.mapping_report_generated`
- `legacy.old_api_still_compatible`
- `legacy.backfill_does_not_drop_legacy_data`

In non-dry-run mode it writes `control_plane.migration_verification_reports`,
`control_plane.legacy_backfill_reports`, and
`control_plane.legacy_compatibility_freezes`. Backfill remains dry-run only:
legacy rows use `source = legacy_migration`, preserve `original_ref`, and
money-related mappings require reconciliation notes.

## Backup / Restore Smoke

The backup / restore smoke runner performs the minimum production restore
exercise without requiring external `pg_dump` binaries. It creates an isolated
PostgreSQL schema named `backup_restore_smoke_*`, copies the schema and data for
the runtime smoke set, exposes compatibility views for the required key queries,
then runs projection rebuild dry-run and the invariant runner against the
restored schema search path.

Key queries recorded in the report:

- `operation_cases`
- `work_items`
- `domain_events`
- `ledger_entries`
- `evidence_metadata`
- `control_plane.release_manifests`

Release gate invariants:

- `backup.smoke_success`
- `restore.smoke_success`
- `restore.invariants_after_restore_pass`

In non-dry-run mode it writes `control_plane.backup_restore_smoke_reports` and
the three `runtime_invariant_checks` rows. The CI command passes
`--cleanup=true` after the restore, projection rebuild, and invariant checks
finish.

## Gate Runner

The gate runner reads invariant and shadow compare evidence files, optional
business signoff refs, and the CI run id. It computes status; manual
`--status=passed` is ignored.

Status calculation:

- any P0 blocking failed invariant: `blocked`
- any red shadow report: `blocked`
- any P1 failed invariant without waiver: `failed`
- only P2 observing warning with required signoff refs present: `warning`
- all passed with required signoff refs present: `passed`
- all passed or warning without required signoff refs: `not_run`

The runner writes `control_plane.gate_results` with `input_hash` and
`result_hash`.
