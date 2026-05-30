# V5.4 Migration Verification And Legacy Backfill Freeze

This guard records machine-generated evidence before any legacy data is
backfilled into the V5.4 runtime. It is intentionally dry-run first: legacy rows
are scanned and mapped, but they are not converted into new business facts.

## Entry Points

Local smoke:

```powershell
node scripts/v5_4/migration-verification.mjs --dry-run=true --report-out=.tmp/v5_4/migration-verification-report.json --backfill-out=.tmp/v5_4/legacy-backfill-report.json
```

Release gate:

```powershell
node scripts/v5_4/migration-verification.mjs --dry-run=false --releaseId=v5.4-migration-verification --mrId=local --out=.tmp/v5_4/migration-verification-invariant-checks.json --report-out=.tmp/v5_4/migration-verification-report.json --backfill-out=.tmp/v5_4/legacy-backfill-report.json
```

The non-dry-run mode applies the current SQL migrations, writes invariant
checks, writes verification reports, and marks the legacy compatibility surface
as frozen for release evidence. It does not apply legacy business backfill.

## Report Tables

Migration `infra/db/migrations/025_migration_verification_legacy_freeze.sql`
adds:

- `control_plane.migration_verification_reports`
- `control_plane.legacy_backfill_reports`
- `control_plane.legacy_compatibility_freezes`

`migration_verification_reports` stores:

- migration dry-run result
- old runtime data scan
- legacy to new runtime mapping report
- old view vs new Lens count comparison
- rollback note validation
- release gate references

`legacy_backfill_reports` stores the dry-run backfill plan. Every row must use
`source = legacy_migration`, preserve an `original_ref`, and avoid writing new
business facts. Money-related legacy rows must include reconciliation notes.

`legacy_compatibility_freezes` records when the Workspace/Card compatibility
surface and legacy ledger tables are frozen for a release.

## Legacy Data Rules

- Legacy rows are evidence inputs, not new runtime business facts.
- Backfill plans are dry-run until a later audited apply mode is approved.
- Any future applied backfill must tag generated rows with
  `source = legacy_migration`.
- Any future applied backfill must preserve `original_ref`.
- Money-related legacy rows require a reconciliation note before they can be
  mapped to PaymentLedger, DepositLedger, or Reconciliation objects.
- Legacy Workspace/Card APIs stay compatible, but the freeze prevents new
  business expansion on the old route family.

## Release Gate References

The runner emits these invariant refs for GateResult binding:

- `migration.dry_run_success`
- `legacy.mapping_report_generated`
- `legacy.old_api_still_compatible`
- `legacy.backfill_does_not_drop_legacy_data`

The generated `release_gate_refs` in both report tables use the report id as a
prefix so CI artifacts and database rows can be tied back to the exact run.

## Rollback Note Validation

The guard validates rollback notes from migration `015` onward by default. A
V5.4 migration passes if it contains an explicit rollback note, migration-down
note, or compensating-migration note. Missing notes fail the
`migration.dry_run_success` invariant.
