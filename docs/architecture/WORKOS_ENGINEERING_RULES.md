# WorkOS Engineering Rules

This is the top-level governance file for WorkOSNext. It is intentionally an
index and policy spine, not a dumping ground for Accommodation details, testing
rules, database details, or frontend protocol rules.

## One Center Model

WorkOSNext has one operating center:

```text
Slice + Card + Field Contract + Event
+ Action Runtime
+ AuditEvent Journal
+ Outbox Projection
+ Lens Read Model
+ PostgreSQL
+ Contract Test
```

Business work moves through Cards inside Slices. Cards define field contracts,
evidence requirements, system checks, confirmation policy, and emitted events.
Events become the durable journal and projection source.

## Projection Ownership

- Projection state is read model output, not the business write model.
- Slice-owned aggregates and ledger facts are persisted by the owning slice.
- Lens output reads persisted facts and projection state; it must not invent a
  second source of truth.
- Legacy compatibility code must be isolated, documented, and removed when the
  owning slice has a production runtime.

## AI Cannot Confirm

AI may prepare, explain, recommend, and draft. AI must never confirm a Card.
Confirm requires a trusted backend actor session and a human role allowed by the
Card confirmation contract.

## Clean Baseline

The repository must not reintroduce old page, task, object, or scenario models.
The only business write API shape is:

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

The following page-specific write APIs are forbidden:

```text
/api/hostel/checkin
/api/payment/confirm
/api/deposit/refund
/api/finance/confirm-deposit
/api/room/activate
```

## Required Validation

Before claiming a change is complete, run the applicable gate:

```bash
npm --prefix apps/mobile ci
npm --prefix apps/mobile run build
npm --prefix apps/mobile audit --audit-level=low
dotnet build WorkOSNext.sln -c Release
dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release
node scripts/validate-contracts.mjs
node scripts/validate-runtime-api.mjs
node scripts/generate-contract-dtos.mjs --check
pwsh ./scripts/guard-architecture.ps1
pwsh ./scripts/clean-baseline.ps1
git diff --check
```

Run newly added unit, runtime integration, or frontend tests when those projects
exist. Do not claim GitHub Actions success without Actions evidence for the
exact commit.

## Rule Index

Detailed rules live here:

- Backend runtime: `docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md`
- Frontend boundaries: `docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md`
- Contract rules: `docs/architecture/WORKOS_CONTRACT_RULES.md`
- Runtime surfaces: `docs/architecture/WORKOS_SURFACE_RULES.md`
- Accommodation runtime: `docs/architecture/WORKOS_ACCOMMODATION_RUNTIME_RULES.md`
- Testing rules: `docs/architecture/WORKOS_TESTING_RULES.md`
- Current runtime facts: `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`
- Machine-readable registry: `docs/architecture/rules/index.json`
- Exception registry: `docs/architecture/architecture-exceptions.json`

## Exception Policy

Rules default to no exceptions. If a temporary exception is unavoidable, it must
be registered in `docs/architecture/architecture-exceptions.json` with:

- `ruleId`
- `owner`
- `reason`
- `createdAt`
- `expiresAt`
- `removalCondition`
- `linkedTest`

Expired exceptions must fail the architecture guard. Exceptions cannot be used
to permit page-specific write APIs, AI confirmation, untrusted actor identity,
ledger fact ownership violations, or fake CI success.
