# V5.4 Control Plane CI Guards

V5.4 adds executable CI guards for the release control plane. The goal is to
keep the gate backed by runnable SQL, service, file, API-boundary, and database
evidence instead of relying only on skeleton fixtures.

## GitHub Actions

The dedicated workflow is `.github/workflows/v5_4_control_plane.yml`.

It runs these guard steps:

1. `architecture-guard`
2. `api-boundary-check`
3. `control-plane-migration`
4. `control-plane-schema-verify`
5. `migration-verification-legacy-freeze`
6. `shadow-namespace-isolation`
7. `invariant-runner`
8. `ledger-inspection-job`
9. `backup-restore-smoke`
10. `shadow-compare-runner`
11. `gate-runner`
12. `generate-release-manifest`
13. `release-manifest-validate`

## Local Command

Run the local executable guard chain:

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
- `control-plane-schema-verify` applies migrations to PostgreSQL, verifies the
  required `control_plane` and `shadow_runtime` tables through
  `information_schema.tables`, and probes the required check constraints by
  confirming invalid values are rejected.
- `migration-verification-legacy-freeze` runs the migration dry-run evidence
  check, scans old runtime tables, emits the legacy-to-new mapping report,
  validates rollback notes, performs a backfill dry-run, compares old rows with
  new Lens targets, and records release gate refs. It freezes the legacy
  compatibility surface without converting legacy rows into new business facts.
- `api-boundary-check` executes the forbidden-route self-test and scans current
  Minimal API route declarations.
- `shadow-namespace-isolation` verifies that `shadow_runtime.*` exists and that
  official projector paths do not read from it.
- `invariant-runner` reads invariant definitions, executes SQL, API-boundary,
  service/file, dist-scan, and remaining transition checks, and writes
  `control_plane.runtime_invariant_checks`.
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
  then writes a machine-generated `control_plane.gate_results` row. In CI it
  writes the current `GITHUB_RUN_ID` into `ci_run_id`.
- `generate-release-manifest` builds the MR-00 CI release manifest from the
  generated GateResult, rollback instruction, commit SHA, and CI run id.
- `release-manifest-validate` validates the generated release manifest against
  `docs/v5.4/release-manifest.schema.json` and checks it references the
  generated GateResult with matching `ci_run_id`, invariant refs, and shadow
  compare refs. The fixture manifest remains a unit fixture only.
