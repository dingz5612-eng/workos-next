# WorkOSNext

WorkOSNext is a mobile-first Business Work OS platform. The current architecture identity is `oam.current`.

## Current Authority

Current work must follow these files first:

```text
docs/oam/current-architecture.md
docs/oam/current-architecture.manifest.json
docs/contracts/oam.current.json
docs/oam/current-authority-index.json
docs/contracts/oam-responsibility-boundary-matrix.json
docs/business/dormitory/current-business-journey.md
docs/scenarios/dormitory/golden-pilot.yml
docs/business/experience-contract.yml
docs/surface/surface-contract.yml
```

Only the current OAM chain may own business execution:

```text
Product Capability
-> Domain Module
-> WorkItem Definition
-> OperationCase
-> WorkItem
-> Confirm Runtime
-> Unit of Work
-> Domain Event / Ledger Entry
-> Outbox
-> Projection / Lens
-> Mobile Surface / PC Governance Surface
```

The primary business write path is:

```text
POST /api/operations/work-items/{workItemId}/confirm
```

Projection and Lens are read-side facades. Mobile BFF helpers, search, language, projection, PC governance, and control-plane surfaces must not become direct business fact writers.

## Current OAM Operating Map

Use these current contracts when changing the system:

```text
Business objects and fields: docs/contracts/business/oam-business-object-field-registry.json
WorkItem states and actions: docs/contracts/business/oam-workflow-state-registry.json
Database ownership: docs/contracts/database/oam-db-ownership-map.json
Evidence references: docs/contracts/evidence/evidence-graph-refs-contract.json
Search read-side proof: docs/contracts/search/search-contract.json
Language and visible copy: docs/contracts/language/language-contract.json
Surface responsibility: docs/surface/surface-contract.yml
Dormitory business journey: docs/business/dormitory/current-business-journey.md
Dormitory golden scenarios: docs/scenarios/dormitory/golden-pilot.yml
```

Every current contract must have an owner, checker, runtime binding, test binding, and OAM evidence binding in `docs/contracts/oam-responsibility-boundary-matrix.json`.

## Directory Responsibilities

`services` is limited to current OAM services. Today only `services/core-api` is present. It owns the HTTP API, Confirm Runtime, Unit of Work, policy, evidence, trace, audit, projection, and migration runner.

`modules` is limited to:

```text
modules/accommodation
modules/finance-gate
modules/identity
modules/maintenance
```

Each module must bind Product Capability, Domain Invariant, API, DB, tests, and rules in `oam-module.manifest.json`.

`packages` is limited to current shared packages. Today only `packages/surface-view-models` is present, and it may contain read-only view model code only.

`infra` owns local runtime infrastructure only: Postgres through `infra/docker-compose.yml` and current DB migrations under `infra/db/migrations`.

## Product Boundaries

Accommodation owns resource, lead reservation, check-in, lifecycle, checkout, and the accommodation side of service-task flow.

Maintenance owns service-task assignment, completion, verification, rework, availability blocking, availability release, and evidence continuity.

Finance Gate owns ordinary payment, deposit liability, expense approval, reconciliation, corrections, and finance permission gates.

Identity owns account, user, actor, role, capability, session, device trust, and account audit. The login page only accepts username and password; departments, roles, and capabilities are assigned in PC governance and enforced from backend session capabilities.

## Local Run

API:

```powershell
dotnet run --project services/core-api/WorkOS.Api/WorkOS.Api.csproj --urls http://127.0.0.1:5191
```

Mobile UI:

```powershell
cd apps/mobile
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Local Postgres:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

## Verification

Core local checks:

```powershell
node scripts/oam/check-current-oam.mjs
node scripts/check-rule-authority.mjs
node scripts/check-api-boundaries.mjs
node scripts/check-runtime-write-paths.mjs
node scripts/check-experience-contract.mjs
node scripts/check-surface-contract.mjs
node scripts/oam/check-surface-language-v2.mjs
node scripts/oam/check-current-authority-index.mjs
node scripts/oam/check-oam-responsibility-boundary-matrix.mjs
pwsh scripts/guard-architecture.ps1
npm --prefix apps/mobile run test
npm --prefix apps/mobile run build
dotnet build WorkOSNext.sln -c Release
```

User-visible experience changes also require real browser operation and screenshot evidence under current OAM evidence paths.
