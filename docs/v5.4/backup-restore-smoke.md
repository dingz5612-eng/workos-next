# V5.4 Backup / Restore Smoke

The backup / restore smoke guard verifies that production runtime data can be
copied into an isolated restore environment and still support core read paths.

## Command

```powershell
node scripts/v5_4/backup-restore-smoke.mjs --dry-run=false --cleanup=true --report-out=.tmp/v5_4/backup-restore-smoke-report.json
```

## Coverage

The runner performs:

- schema backup for the smoke table set
- data backup for the smoke table set
- restore into an isolated `backup_restore_smoke_*` PostgreSQL schema
- key count queries after restore
- projection rebuild dry-run after restore
- invariant runner execution after restore

## Minimum Key Queries

The report includes count checks for:

- `operation_cases`
- `work_items`
- `domain_events`
- `ledger_entries`
- `evidence_metadata`
- `control_plane.release_manifests`

Current WorkOSNext compatibility mappings use existing runtime tables for the
logical keys: `process_runs`, `process_work_item_intents`, `audit_events`,
ledger tables, `evidence_objects`, and `control_plane.release_manifests`.

## Evidence

Migration `026_backup_restore_smoke_reports.sql` adds:

- `control_plane.backup_restore_smoke_reports`

The runner also emits release gate invariant refs:

- `backup.smoke_success`
- `restore.smoke_success`
- `restore.invariants_after_restore_pass`

The restore schema may be cleaned up after the smoke run with `--cleanup=true`.
The durable evidence remains in the Control Plane report row and JSON artifact.
