# Current Runtime Architecture

Last preflight source: local `main` after `git fetch origin main`,
`git checkout main`, and `git pull --ff-only`.

Current commit:

```text
462535c1ee827ee4fca6bfb04056a9dca305f789
```

The working tree may contain uncommitted hardening changes. This document
records current repository facts observed during WON-16 preflight; it is not a
claim that remote CI is green.

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

Implemented or partially implemented accommodation Lens endpoints are exposed
through:

```text
GET /api/lenses/accommodation/{lensId}
```

Current Lens status must be kept explicit:

| Lens | Status |
| --- | --- |
| BedInventoryLens | partial |
| DepositLiabilityLens | partial |
| StayBalanceLens | partial |
| PaymentRiskLens | partial |
| CheckoutQueueLens | partial |
| ServiceTaskQueueLens | partial |
| RiskCommandLens | partial |

## Current Known P0 Gaps

- Confirm HTTP status semantics are not yet split into `403`, `409`, and `422`.
- `runtimeApiPaths.js` does not expose every OpenAPI runtime path.
- Submit idempotency still includes workspace/card/actor context instead of a
  pure submit-level UUID.
- `submissionId`, `cardInstanceId`, and `aggregateRef` are not fully wired.
- Frontend views still use unescaped template output in several places.
- `EventSelectionPolicy` exists but does not yet encode dispatch modes or
  conditional event selection.
- `ConfirmUnitOfWork` behavior exists inside the store transaction, but the
  named runtime boundary is not explicit.
- Runtime policies and storage still include localized-label compatibility
  reads and demo fallback values.
- Test database reset is destructive without requiring `_test` database naming
  or `TEST_DATABASE=true`.
- Outbox claim/dead-letter exists with `retry_count`; WON-16 requires the
  `attempt_count` contract name.
- `ProjectionStateMigrator` is not implemented.

## Current CI Gates

`.github/workflows/ci.yml` currently runs:

- `npm ci`
- `npm audit --audit-level=low`
- `npm run build`
- `dotnet build WorkOSNext.sln -c Release`
- `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release`
- `node scripts/validate-contracts.mjs`
- `node scripts/generate-contract-dtos.mjs --check`
- `node scripts/validate-runtime-api.mjs`
- `pwsh ./scripts/guard-architecture.ps1`
- `pwsh ./scripts/clean-baseline.ps1`
- `git diff --check`

Next milestone: WON-16 Runtime Hardening & Contract-Driven Frontend.
