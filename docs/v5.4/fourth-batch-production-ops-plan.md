# Final Ops Production Readiness Plan

Date: 2026-05-30

Scope: repository scan and production operations planning only. This document does
not change business code, schema, API routes, migrations, CI behavior, or runtime
feature flags.

## Scan Summary

| Area | Current locations | Current capability |
| --- | --- | --- |
| Projector / lens | `services/core-api/WorkOS.Api/Runtime/OutboxProjector.cs`, `services/core-api/WorkOS.Api/Runtime/ProjectionOutboxWorker.cs`, `services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs`, `services/core-api/WorkOS.Api/Runtime/LensQueryService.cs`, `services/core-api/WorkOS.Api/Runtime/RiskCommandLensBuilder.cs`, `services/core-api/WorkOS.Api/Slices/Accommodation/*/ProjectorRules/*.cs`, `docs/contracts/accommodation-lens-contract.json` | Outbox-driven projection rules update read models and aggregate lenses. Lens contracts include source tables and projection lag freshness metadata. |
| Outbox / dead-letter | `services/core-api/WorkOS.Api/Runtime/RuntimeOutboxStorage.cs`, `services/core-api/WorkOS.Api/Runtime/OutboxProjector.cs`, `services/core-api/WorkOS.Api/Runtime/ProjectionOutboxWorker.cs`, `infra/db/migrations/012_outbox_claim_dead_letter.sql`, `infra/db/migrations/013_outbox_attempt_count.sql`, `tests/WorkOS.RuntimeIntegrationTests/RuntimePersistenceContractTests.cs`, `tests/WorkOS.UnitTests/RuntimeHardeningTests.cs` | Claim uses `for update skip locked`, lease expiry, `attempt_count`, `last_error`, and `dead_lettered_at_utc`. Worker polls and processes pending messages. |
| Migration tool | `infra/db/migrations/*.sql`, `services/core-api/WorkOS.Api/Runtime/PostgresMigrationRunner.cs`, `services/core-api/WorkOS.Api/Runtime/MigrationScriptLoader.cs`, `services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs`, `scripts/v5_4/control-plane-migration.mjs` | Custom SQL migration runner applies ordered migration files and records `schema_migrations`. Control Plane migration has a static contract check. |
| Backup / restore | No `pg_dump`, `pg_restore`, backup, or restore script was found under `.github`, `scripts`, `infra`, `docs`, `services`, or `tests`. | No repository-owned production backup / restore automation is present. |
| Observability / logging / metrics | `services/core-api/WorkOS.Api/Program.cs`, `services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs`, `services/core-api/WorkOS.Api/Runtime/ProjectionModels.cs`, `services/core-api/WorkOS.Api/Runtime/ProjectionOutboxWorker.cs`, `docs/contracts/workos-runtime.openapi.json`, `scripts/validate-runtime-api.mjs` | `/health` and `/api/observability/runtime` expose counts, pending/dead-letter outbox count, projection lag, failed confirm reason distribution, schema version, and active architecture exceptions. Outbox worker logs processing and failures. |
| Auth / session / device revoke | `services/core-api/WorkOS.Api/Runtime/AuthSessionService.cs`, `services/core-api/WorkOS.Api/Runtime/RuntimeAuthOptions.cs`, `services/core-api/WorkOS.Api/Runtime/RuntimeSessionStorage.cs`, `services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs`, `apps/mobile/src/pcGovernancePolicies.js`, `apps/mobile/src/pcGovernanceController.js`, `apps/mobile/src/views/pcGovernanceView.js` | Backend issues actor sessions and blocks production startup when dev password hashes are used. PC governance has frontend device revoke / trusted PC logic and tests, but no backend device session revoke store was found. |
| Release Control Center | `services/core-api/WorkOS.Api/Runtime/ControlPlaneReadStore.cs`, `services/core-api/WorkOS.Api/Runtime/ControlPlaneWriteStore.cs`, `services/core-api/WorkOS.Api/Program.cs`, `apps/mobile/src/views/releaseControlView.js`, `docs/v5.4/release-control-center.md` | Read-only release APIs expose releases, GateResults, shadow reports, invariant checks, and rollback instructions. Runner write paths persist Control Plane evidence. |
| CI / gate runner | `.github/workflows/ci.yml`, `.github/workflows/v5_4_control_plane.yml`, `scripts/guard-architecture.ps1`, `scripts/check-api-boundaries.mjs`, `scripts/v5_4/run-control-plane-checks.ps1`, `tools/control-plane/WorkOS.ControlPlaneRunners/*` | CI has architecture/API boundary checks and V5.4 Control Plane skeleton. Gate runner calculates GateResult from invariant and shadow refs, then writes machine-generated Control Plane rows. |
| Ledger reconciliation / correction | `infra/db/migrations/017_reconciliation_runtime.sql`, `018_reconciliation_matching_manual_decisions.sql`, `019_reconciliation_mismatch_cases.sql`, `020_correction_center_schema.sql`, `services/core-api/WorkOS.Api/Runtime/BankStatementImportService.cs`, `RuntimeBankStatementImportStorage.cs`, `ReconciliationMatchingService.cs`, `RuntimeReconciliationMatchingStorage.cs`, `ReconciliationMismatchCaseService.cs`, `RuntimeReconciliationMismatchCaseStorage.cs`, `CorrectionCenterService.cs`, `RuntimeCorrectionCenterStorage.cs`, `apps/mobile/src/views/financeReconciliationView.js`, `apps/mobile/src/views/pcGovernanceView.js` | Manual bank import, candidate generation, manual matching, mismatch case creation, and append-only correction center are present. |

## Projection Rebuild Gap

Current capability:

- Outbox projection is active through `ProjectionOutboxWorker` and
  `OutboxProjector`.
- Slice projector rules exist for lead reservation, stay lifecycle, deposit
  ledger, payment ledger, checkout, service task, period analytics, and card
  progress.
- Aggregate lens reads exist in `RuntimeAggregateLensStorage`.
- Some domain-specific rebuild behavior exists, especially correction-driven
  balance rebuilds in `RuntimeCorrectionCenterStorage`.

Gap:

- No operator-owned rebuild command was found for replaying all projections from
  the persisted event log into a clean read model.
- No dry-run projection rebuild diff exists to compare current lenses against a
  rebuilt copy before promotion.
- No documented high-watermark reset procedure exists per lens.
- No checksum or row-count acceptance contract exists for rebuilt lenses.
- No runbook defines which projections can be rebuilt online and which require a
  maintenance window.

Plan:

- Add `scripts/ops/rebuild-projections.*` with modes `dry-run`, `single-lens`,
  `single-tenant`, and `apply`.
- Rebuild from `audit_events` / domain event tables only; do not use current
  read model rows as source facts.
- Write rebuild output to a temporary schema or staging tables first.
- Compare source event high-watermarks, lens row counts, and deterministic body
  hashes before swapping or applying.
- Emit a Control Plane invariant check:
  `ops.projection_rebuild_matches_source_events`.
- Add a Release Control Center link to the last rebuild report before active
  production rollout.

## Dead-Letter Replay Gap

Current capability:

- `RuntimeOutboxStorage` can claim pending messages, clear expired claims, store
  `last_error`, increment `attempt_count`, and set `dead_lettered_at_utc`.
- `OutboxProjector` marks failed messages and leaves processed facts committed.
- `/api/outbox` exposes current outbox messages for inspection.

Gap:

- No dead-letter replay command or endpoint was found.
- No quarantine workflow exists for classifying a dead-letter as safe to replay,
  needs code fix, needs data correction, or must remain archived.
- No replay idempotency test exists for a message that was dead-lettered after
  partial downstream projection attempts.
- No dead-letter ownership, SLA, alert, or Release Control evidence mapping is
  defined.

Plan:

- Add `scripts/ops/replay-dead-letter.*` with `--message-id`, `--tenant-id`,
  `--dry-run`, `--reason`, and `--approved-by`.
- Replay must clear `dead_lettered_at_utc` only through an audited operation and
  preserve `attempt_count`, previous `last_error`, and original body.
- Add a `dead_letter_replay_audits` table or equivalent append-only audit if no
  existing audit event type fits.
- Add tests for safe replay, replay refusal after incompatible schema change,
  and no duplicate projection side effects.
- Add observability alert: `deadLetterOutboxCount > 0` for more than the
  configured SLA.

## Ledger Reconciliation Gap

Current capability:

- Manual bank statement import and preview exist.
- Bank transactions are separate from business facts and do not become
  `PaymentConfirmed`.
- Match candidates, manual accept/reject/mismatch/ignore, reconciliation cases,
  and append-only correction center are present.
- Finance and correction UI surfaces exist in the current app shell.

Gap:

- No scheduled reconciliation job was found.
- No production bank connector, secure import bucket, or import approval queue is
  defined.
- Split / merge matching is intentionally not implemented.
- No aging SLA appears to promote unmatched confirmed payments or unmatched bank
  rows into alerts automatically outside manual detection.
- MR-06 / MR-07 release reports were not present in the current repo scan, so
  PaymentLedger and DepositLedger release evidence should be recovered or
  re-generated before final production acceptance.

Plan:

- Add a scheduled reconciliation runner that invokes candidate generation and
  mismatch detection for each active tenant.
- Keep auto-match disabled until a later release; first production mode remains
  candidate-only plus finance manual acceptance.
- Add daily aging thresholds for:
  - confirmed payment without bank match,
  - refund paid without bank debit,
  - imported bank transaction without candidate,
  - evidence amount mismatch.
- Add final acceptance evidence proving reconciliation import does not mutate
  PaymentLedger, DepositLedger, StayBalance, or frozen Period snapshots.
- Recover or regenerate MR-06 and MR-07 Control Plane evidence before enabling
  production finance operations.

## Migration Verification Gap

Current capability:

- `PostgresMigrationRunner` creates `schema_migrations`, applies ordered SQL
  files from `infra/db/migrations`, and records applied migration ids.
- Runtime integration tests inspect critical migrations.
- `scripts/v5_4/control-plane-migration.mjs` statically verifies the Control
  Plane / Shadow Runtime migration contract.

Gap:

- Runner is up-only; rollback is handled by notes and compensating migrations.
- No production clone preflight command was found.
- No schema drift checksum is generated from a live target before or after
  migration.
- No migration lock or one-writer operational policy is documented for
  production deploys.
- No required backup gate is wired before migration execution.

Plan:

- Add `scripts/ops/verify-migrations.*` that can run against a disposable clone
  and compare:
  - expected migration files,
  - `schema_migrations`,
  - critical table/constraint inventory,
  - Control Plane and runtime invariant checks.
- Add a migration preflight report artifact to CI and Release Control Center.
- Require a successful backup / restore drill before production migration.
- Document compensating migration policy for every migration that changes money,
  period, correction, or control-plane tables.
- Add an invariant: `ops.schema_migrations_match_repo`.

## Backup / Restore Gap

Current capability:

- No repository-owned backup or restore script was found.
- No RTO / RPO document was found.
- No restore drill evidence format was found.

Gap:

- Production readiness cannot be accepted without verified backups and tested
  restore.
- There is no script for `pg_dump`, `pg_restore`, point-in-time restore, or a
  sanitized restore clone.
- There is no documented owner, schedule, retention, encryption, or access
  policy for backups.
- There is no final acceptance gate proving a restored clone can run migrations,
  projection rebuild, reconciliation checks, and invariant runner.

Plan:

- Add `docs/ops/backup-restore-runbook.md`.
- Add `scripts/ops/backup-postgres.*` and `scripts/ops/restore-postgres-drill.*`
  or document the managed database provider commands if backup is external.
- Declare RPO and RTO targets.
- Require restore drill output:
  - backup id,
  - restore target,
  - restore duration,
  - schema migration count,
  - projection rebuild result,
  - sample ledger balance check,
  - invariant runner result.
- Store restore drill evidence as a Control Plane GateResult input before final
  active cutover.

## Observability Gap

Current capability:

- `/health` exposes basic service health.
- `/api/observability/runtime` exposes runtime and projection counters.
- `ProjectionOutboxWorker` logs successful batches and worker failures.
- OpenAPI and validation scripts require observability response fields.

Gap:

- No Prometheus, OpenTelemetry, or metrics exporter was found.
- No alert rules were found for projection lag, dead letters, failed confirms,
  reconciliation mismatches, correction backlog, or auth failures.
- No dashboard definitions were found.
- Runtime observation is pull-based and does not appear to include per-tenant or
  per-slice dimensions.
- Logs are not tied to correlation ids across confirm, outbox, projector,
  process manager, and correction flows.

Plan:

- Add metrics exporter or managed telemetry integration with counters and gauges
  for:
  - projection lag by slice,
  - pending / dead-letter outbox,
  - failed confirm reason distribution,
  - reconciliation mismatch backlog,
  - correction pending approval count,
  - export audit failures,
  - auth/session failures.
- Add trace correlation from HTTP request id through CommandSubmission,
  DomainEvent, OutboxMessage, ProcessRun, GateResult, and CorrectionAudit.
- Add alert runbook for each P0 metric.
- Add dashboard JSON or provider-managed dashboard documentation.
- Add invariant: `ops.observability_alerts_configured`.

## Security Hardening Gap

Current capability:

- Production startup rejects missing or development auth hashes.
- Confirm derives actor identity from backend-issued session token.
- Frontend error handling preserves session for 403 / 409 / 422.
- PC Governance UI has capability checks, export reason checks, trusted PC
  checks, and frontend device revoke tests.
- CORS uses configured allowed origins.

Gap:

- No backend-persisted `device_sessions` / device revoke enforcement was found.
- PC device revoke is currently frontend state, not a production security
  control.
- Evidence signed URL and export download hardening need backend policy evidence
  for trusted device, expiration, reason, and audit.
- No rate limiting or brute-force protection was found around login or confirm.
- No production secrets rotation / password hash rotation runbook was found.
- No immutable audit retention policy was found for evidence access,
  corrections, exports, or release control operations.

Plan:

- Add backend device session storage and enforcement before high-risk exports,
  evidence access, correction apply, and finance actions.
- Add device revoke API through Operations Confirm or an admin governance action;
  do not rely on local frontend state.
- Add rate limits for login, confirm, evidence signed URL, export, and correction
  apply.
- Add signed URL audit invariants for evidence and export downloads.
- Add secrets rotation runbook and production auth configuration validation.
- Add invariant: `ops.revoked_device_blocks_high_risk_actions`.

## Final Acceptance Plan

Final production acceptance should be a Control Plane release package, not a
manual checklist only.

Required evidence:

1. Migration preflight:
   - production clone migration succeeds,
   - `schema_migrations` matches repository migrations,
   - migration verification report is attached to GateResult.
2. Backup / restore:
   - latest backup restored to a clean clone,
   - RTO and RPO are recorded,
   - restored clone passes migration verification, projection rebuild dry-run,
     invariant runner, and selected ledger balance checks.
3. Projection rebuild:
   - dry-run rebuild completes for all production lenses,
   - source event high-watermarks match,
   - rebuilt lens hashes match or documented waivers exist,
   - no production path depends on fake fallback data.
4. Dead-letter replay:
   - replay dry-run can classify dead letters,
   - replay of a safe fixture is idempotent,
   - replay audit is persisted,
   - alert fires when dead letters breach SLA.
5. Ledger reconciliation:
   - bank import creates only bank rows,
   - candidate generation and manual match do not change business facts,
   - mismatch detection creates ReconciliationCase and WorkItem,
   - correction apply is append-only and rebuilds balances.
6. Observability:
   - health and runtime observation endpoints are live,
   - production metrics dashboard exists,
   - alerts cover projection lag, dead letters, failed confirms,
     reconciliation mismatches, correction backlog, and auth failures.
7. Security:
   - production auth hashes configured,
   - device revoke enforced by backend,
   - high-risk export and evidence signed URL require capability, reason,
     trusted device, expiration, and audit,
   - rate limits and audit retention are documented.
8. Release Control:
   - final ReleaseManifest references all evidence,
   - InvariantCheck, ShadowCompareReport, GateResult, RollbackInstruction, and
     CompensationInstruction are machine-generated or machine-validated,
   - any P0 failed invariant or red shadow report blocks active cutover.

Exit criteria:

- `GateResult.status` is `passed` or explicitly `warning` with no P0 / P1 open
  no-go item.
- Projection rebuild, dead-letter replay, migration verification, restore drill,
  reconciliation, observability, and security hardening evidence are linked from
  the final ReleaseManifest.
- Rollback plan uses feature flags or runtime mode; money, ledger, evidence,
  period, correction, and audit facts are never deleted.
- Compensation plan exists for active money / deposit / correction / period
  mistakes and is append-only.
