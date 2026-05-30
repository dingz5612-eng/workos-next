# V5.4 Control Plane CI Guards

V5.4 adds a first-batch CI skeleton for the release control plane. The goal is
to make the pipeline runnable before the full business invariant suite exists.

## GitHub Actions

The dedicated workflow is `.github/workflows/v5_4_control_plane.yml`.

It runs these guard steps:

1. `architecture-guard`
2. `api-boundary-check`
3. `control-plane-migration`
4. `migration-verification-legacy-freeze`
5. `shadow-namespace-isolation`
6. `invariant-runner`
7. `ledger-inspection-job`
8. `backup-restore-smoke`
9. `shadow-compare-runner`
10. `gate-runner`
11. `release-manifest-validate`

## Local Command

Run all local skeleton checks:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/v5_4/run-control-plane-checks.ps1
```

The command writes transient evidence files to `.tmp/v5_4/` and writes runner
results into `control_plane.runtime_invariant_checks`,
`control_plane.shadow_compare_reports`, `control_plane.gate_results`, and
`control_plane.ledger_inspection_job_reports`. The migration verification step
also writes `control_plane.migration_verification_reports`,
`control_plane.legacy_backfill_reports`, and
`control_plane.legacy_compatibility_freezes`. The backup / restore smoke step
writes `control_plane.backup_restore_smoke_reports`.

## Guard Behavior

- `control-plane-migration` validates the V5.4 migration dry-run contract and
  runs the static migration mapping tests.
- `migration-verification-legacy-freeze` runs the migration dry-run evidence
  check, scans old runtime tables, emits the legacy-to-new mapping report,
  validates rollback notes, performs a backfill dry-run, compares old rows with
  new Lens targets, and records release gate refs. It freezes the legacy
  compatibility surface without converting legacy rows into new business facts.
- `api-boundary-check` executes the forbidden-route self-test and scans current
  Minimal API route declarations.
- `shadow-namespace-isolation` verifies that `shadow_runtime.*` exists and that
  official projector paths do not read from it.
- `invariant-runner` reads invariant definitions, executes SQL or skeleton
  checks, and writes `control_plane.runtime_invariant_checks`.
- `ledger-inspection-job` runs daily/manual/release-gate ledger reconciliation
  invariants, writes `control_plane.runtime_invariant_checks`, and stores the
  reconciliation report plus PC dashboard summary in
  `control_plane.ledger_inspection_job_reports`.
- `backup-restore-smoke` performs schema backup, data backup, isolated schema
  restore, key query counts, projection rebuild dry-run, and invariant runner
  verification after restore. It records release gate refs for backup,
  restore, and invariants-after-restore.
- `shadow-compare-runner` reads configured active and shadow tables, then writes
  `control_plane.shadow_compare_reports`.
- `gate-runner` computes status from invariant, shadow, and signoff inputs,
  then writes a machine-generated `control_plane.gate_results` row.
- `release-manifest-validate` validates the release manifest fixture against
  `docs/v5.4/release-manifest.schema.json` and checks it references the
  generated GateResult.
