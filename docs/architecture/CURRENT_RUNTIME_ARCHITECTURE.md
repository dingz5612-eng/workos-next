# Current Runtime Architecture

Last preflight source: local `main` after `git fetch origin main`,
`git checkout main`, and `git pull --ff-only`.

Current local commit at WON-16 second-batch preflight:

```text
4508e94 WON-16: Harden runtime ledger and surface contracts
```

This document records repository facts during WON-16 validation work; it is not
a claim that remote GitHub Actions is green.

## Runtime Architecture

WorkOSNext currently uses:

```text
Slice + Card + Field Contract + Event
+ Unified Action Runtime
+ AuditEvent Journal
+ Outbox-driven Projection
+ Projection / Lens read model
+ PostgreSQL persistence
+ Contract tests / Architecture guard / Clean baseline guard
```

The only business write endpoints are:

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

No page-specific write API is part of the current architecture.

## Runtime Surface Architecture

Home, Workbench, Search, Learning, Workspace, and Me are runtime surfaces. They
must consume one runtime surface source built from:

- `GET /api/workspaces`
- `GET /api/work-queue`
- `GET /api/search?q=...`
- `GET /api/lenses/home-surface`
- `GET /api/lenses/work-queue`
- `GET /api/lenses/search?q=...`
- `GET /api/lenses/learning-catalog`
- `GET /api/lenses/accommodation/{lensId}`

`demoQueue` and static `workspaceProjections` are fallback/dev fixtures only;
they must not be the online default source for Home or Workbench.

Current surface status:

| Surface | Runtime source |
| --- | --- |
| Home | `home-surface` Lens or projection fallback |
| Workbench | `work-queue` Lens or projection fallback |
| Search | `search` Lens or projection fallback |
| Learning | `learning-catalog` Lens or runtime workspaces |
| Workspace | runtime workspace projection, selected by runtime `workspaceId` / `cardId` |
| Me | runtime queue/search state |

## Slice Manifest Status

Manifest version: `0.14.0-accommodation-workos`.

Production slices:

- `Accommodation.ResourceSetup`
- `Accommodation.CheckIn`
- `Accommodation.LeadReservation`
- `Accommodation.StayLifecycle`
- `Accommodation.DepositLedger`
- `Accommodation.PaymentLedger`
- `Accommodation.CheckOutSettlement`
- `Accommodation.ServiceTask`
- `Accommodation.ExpenseLedger`
- `Accommodation.PeriodAnalytics`

Runtime skeleton slices:

- None currently declared.

Contract-only slices:

- `Accommodation.CheckOut`
- `Finance.DepositException`
- `Repair.Dispatch`
- `Repair.Close`

## Lens Status

Accommodation Lens endpoints are exposed through:

```text
GET /api/lenses/accommodation/{lensId}
```

Current Lens status must be kept explicit:

| Lens | Status |
| --- | --- |
| BedInventoryLens | implemented |
| DepositLiabilityLens | implemented |
| StayBalanceLens | implemented |
| PaymentRiskLens | implemented |
| CheckoutQueueLens | implemented |
| ServiceTaskQueueLens | implemented |
| RiskCommandLens | implemented |
| RoomReadinessLens | implemented |
| RatePlanLens | implemented |
| RoomRevenuePotentialLens | implemented |
| TodayOperationsLens | implemented |
| LeadFunnelLens | implemented |
| ActiveStayLens | implemented |
| ExpenseAnalyticsLens | implemented |
| PeriodPerformanceLens | implemented |

## Current Known P0 Gaps

- Confirm HTTP status semantics are split into `401`, `403`, `409`, and `422`
  and validated by `validate-runtime-api.mjs`.
- `runtimeApiPaths.js` is generated from OpenAPI and checked in CI.
- Frontend confirm uses submit-level UUID `idempotencyKey` and `submissionId`,
  submits `cardInstanceId`, `aggregateRef`, and `evidenceIds`, and distinguishes
  `401` from `403`/`409`/`422`.
- `EventSelectionPolicy` owns conditional and multi-event dispatch.
- `ConfirmUnitOfWork` owns the audit/outbox/aggregate transaction boundary.
- Runtime tests require `_test` database naming or `TEST_DATABASE=true` before
  destructive reset.
- Outbox claim/dead-letter exposes `attempt_count`, `claimed_by`, `last_error`,
  and `dead_lettered_at_utc`.
- `ProjectionStateMigrator` is implemented as a seed-contract merge migrator for
  persisted `runtime_documents`; it preserves events, users, and card status
  while absorbing newly declared workspaces/cards/contracts.
- Confirm HTTP status semantics are centralized in `ConfirmHttpStatusMapper` and
  unit-tested.
- Confirm payloads with localized label keys are rejected as malformed input;
  runtime tests submit canonical field ids.
- Evidence is now represented by durable `evidence_objects` plus attachments
  and requirement scope; fake evidence ids do not confirm non-cash ledger cards.
- Card instances are persisted in `card_instances`; ledger confirms require
  aggregate scope and do not derive instance identity from workspace/card/status.
- Runtime state has a schema version and a named migrator entry for the
  card-instance/evidence envelope.

## Accommodation Boundary Status

The current automated coverage verifies:

- `ResourceSetup` owns BedStatus updates.
- `DepositLedger` owns deposit transactions and backend held amount.
- `PaymentLedger` owns payment allocations and stay balances.
- `CheckOutSettlement` emits requests that `DepositLedger` consumes into a
  request transaction entry; it does not write money-moving deposit facts.
- `ServiceTask` emits block/release requests that `ResourceSetup` consumes for
  BedStatus; it does not own BedStatus.
- `ExpenseLedger` is the persisted cost fact source.
- `PeriodAnalytics` freezes metric and finance snapshots, appends late
  adjustments, and generates finance snapshots from backend ledger state.
- Legacy `CheckIn` remains a production intake chain but no longer writes new or
  legacy authoritative ledger fact tables.

## Current CI Gates

`.github/workflows/ci.yml` currently runs:

- `npm --prefix apps/mobile ci`
- `npm --prefix apps/mobile audit --audit-level=low`
- `npm --prefix apps/mobile run build`
- `npm --prefix apps/mobile run test`
- `dotnet build WorkOSNext.sln -c Release`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release --no-build`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release --no-build`
- `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release`
- `node scripts/validate-contracts.mjs`
- `node scripts/generate-contract-dtos.mjs --check`
- `node scripts/validate-runtime-api.mjs`
- `pwsh ./scripts/guard-architecture.ps1`
- `pwsh ./scripts/clean-baseline.ps1`
- `git diff --check`

Next milestone: WON-16 Runtime Hardening & Contract-Driven Frontend.
