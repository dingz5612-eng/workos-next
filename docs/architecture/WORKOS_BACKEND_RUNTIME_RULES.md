# WorkOS Backend Runtime Rules

Backend runtime work must preserve the Work OS architecture, not create page-specific services.

## Runtime API Shape

Allowed business write path:

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

Do not add direct page APIs such as:

```text
/api/hotel/checkin
/api/finance/confirm-deposit
/api/room/activate
```

## Slice Ownership

Business work must be organized by production slice:

```text
Accommodation.ResourceSetup
Accommodation.CheckIn
Accommodation.CheckOut
Finance.DepositException
Repair.Dispatch
Repair.Close
```

Each slice owns Commands, Policies, Events, Projector Rules, Tests, and aggregate persistence tables when it mutates real objects.

Target structure:

```text
services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup
services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn
services/core-api/WorkOS.Api/Slices/Accommodation/CheckOut
services/core-api/WorkOS.Api/Slices/Finance/DepositException
services/core-api/WorkOS.Api/Slices/Repair/Dispatch
services/core-api/WorkOS.Api/Slices/Repair/Close
```

Do not put new slice policy directly in `ProjectionRuntime`.

`ProjectionRuntime` is a facade only. It may coordinate services under a lock,
but it must not own lens ranking, search text construction, prepare/confirm
policy details, session validation, outbox projection rules, SQL, migrations,
or UI metadata.

`CardConfirmationPolicy` must live outside `Runtime`, currently under:

```text
services/core-api/WorkOS.Api/Slices/Policies/CardConfirmationPolicy.cs
```

Required runtime service boundaries:

```text
RuntimeQueryService.cs
LensQueryService.cs
SearchProjectionService.cs
ActionRuntimeService.cs
AuthSessionService.cs
OutboxProjector.cs
```

Other guarded backend hubs:

- `PostgresProjectionStore.cs` is a facade implementing `IProjectionStore`.
  It delegates connection, migration, runtime document, session, audit event,
  outbox, and behavior event persistence to focused storage classes.
- `ProjectionSeed.cs` is a contract seed assembler only. Workspace seeds, card
  construction, evidence, checks, blockers, events, confirmation policy, field
  UI, option sets, and bilingual terms live in focused contract catalogs.
- Store classes must not contain slice policies, projector rules, lens ranking,
  search text construction, or action confirmation policy.
- `PostgresProjectionStore.cs` must remain a composed store facade. It must not
  grow back into a single class containing session, audit, outbox, behavior,
  migration, and document SQL.

Guarded backend line budgets:

```text
ProjectionRuntime.cs: warn > 350 lines, fail > 450 lines.
PostgresProjectionStore.cs: warn > 300 lines, fail > 400 lines.
ProjectionSeed.cs: warn > 400 lines, fail > 500 lines.
```

The repository may enforce stricter budgets after a split has already landed.

Required storage boundaries:

```text
PostgresConnectionFactory.cs
PostgresMigrationRunner.cs
RuntimeDocumentStorage.cs
RuntimeSessionStorage.cs
RuntimeEventStorage.cs
RuntimeOutboxStorage.cs
RuntimeBehaviorEventStorage.cs
```

Required contract seed boundaries:

```text
WorkspaceSeedCatalog.cs
CardContractFactory.cs
EvidenceContractCatalog.cs
SystemCheckCatalog.cs
EventContractCatalog.cs
BlockerContractCatalog.cs
ConfirmationPolicyCatalog.cs
FieldContractCatalog.cs
FieldUiContractCatalog.cs
OptionSetRegistry.cs
ContractText.cs
```

`docs/contracts/slice-manifest.json` is the executable slice registry. When a
slice, card chain, event chain, or aggregate ownership changes, update the
manifest in the same commit and keep the matching `services/core-api/WorkOS.Api/Slices/*`
directory present.

Only `Accommodation.ResourceSetup` and `Accommodation.CheckIn` have migrated
slice modules at this stage. Their slice directories must contain Commands,
Policies, Events, ProjectorRules, and Tests. Other slices may remain
contract-only until deliberately migrated.

## Policy Boundary

Confirmation policy belongs in focused policy classes, starting with
`CardConfirmationPolicy`.

Policy contracts live in:

```text
docs/contracts/policy-contract.json
```

Forbidden confirmation outcomes must use stable decision codes such as
`ai_confirmation_forbidden` and `role_confirmation_forbidden`. Do not scatter
role/AI confirmation rules across endpoints, render functions, or projector
rules.

## Runtime Guarantees

- Confirm commands require idempotency keys.
- Confirm missing/expired actor session returns `401`; malformed input and
  business policy blockers return `400` with stable reasons.
- Confirm event selection goes through `EventSelectionPolicy`; `Events.First()`
  is forbidden for dispatch.
- Confirm idempotency keys are submit-level UUIDs and are enforced by the
  database unique key.
- Confirm persists `evidenceIds` on audit events.
- Runtime policies and storage use canonical field ids, never localized labels,
  as fact keys.
- Option values are stable enum keys; localized labels are display-only.
- Confirm commits audit, outbox, and aggregate writes in one database
  transaction.
- Outbox projection workers must claim messages with a lease, record retry
  counts, and dead-letter repeatedly failing messages.
- Accommodation DepositLedger and PaymentLedger policies must read backend
  ledger state for refund, deduction, payment, and allocation decisions.
- CheckOutSettlement must not own deposit transactions.
- ServiceTask must not directly mutate BedStatus facts.
- ExpenseLedger is the only accommodation cost fact source.
- PeriodAnalytics frozen snapshots must use append-only late adjustment policy.
- Actor identity comes from server-issued session token.
- Dev login still verifies configured password hashes; production must not start
  with development auth defaults.
- Confirmed events append to audit journal and outbox.
- Outbox worker updates projections.
- Audit events and outbox messages include correlationId, causationId, and
  requestId.
- PostgreSQL schema changes live in `infra/db/migrations/*.sql`.
- CORS is restricted by `Cors:AllowedOrigins`; `AllowAnyOrigin` is forbidden.

## Endpoint Allowlist

Every `MapPost` endpoint must be in the architecture allowlist enforced by
`scripts/guard-architecture.ps1`.

Allowed POST endpoints:

```text
/api/auth/login
/api/workspaces/{workspaceId}/cards/{cardId}/prepare
/api/workspaces/{workspaceId}/cards/{cardId}/confirm
/api/projections/process-outbox
/api/behavior-events
```

Do not add a new POST endpoint without updating OpenAPI, rules, and the guard
in the same commit.

## Persistence Direction

Projection fields are not a substitute for writable business objects.

Room, bed, deposit, finance confirmation, repair station, technician, and vehicle must move to aggregate roots and tables when they become writable.

## Aggregate Root Gate

A slice is not production-grade when it only changes `runtime_documents`.

Before expanding a slice beyond contract validation, add explicit aggregate
state and tests for the objects it owns. Examples:

```text
Accommodation.ResourceSetup -> rooms, beds, resource activation state
Accommodation.CheckIn -> applications, stay orders, deposits, check-in records
Finance.DepositException -> deposit exceptions, finance confirmations
Repair.Dispatch -> repair stations, technicians, vehicles, dispatch assignments
Repair.Close -> close records, fee/material confirmations, customer confirmation
```

Aggregate commands produce audit events; audit events produce outbox messages;
outbox projector rules update read models. Direct projection mutation is only
allowed inside projector rules.

Current aggregate-root baseline:

```text
Accommodation.ResourceSetup -> Room, Bed
Accommodation.CheckIn -> Deposit, FinanceConfirmation
Repair.Dispatch -> RepairStation, Technician, Vehicle
```

Aggregate persistence must stay slice-owned:

- Aggregate model files live in `Slices/*/*/Aggregates`.
- Aggregate SQL lives in `infra/db/migrations/*.sql`.
- Aggregate event application lives in slice persistence modules.
- `ProjectionRuntime` coordinates only; it must not contain aggregate SQL or
  table-specific business rules.
- `PostgresProjectionStore` composes storage only; it must not become the owner
  of every aggregate table operation.

## Observability Boundary

Runtime observability is part of the backend contract.

The API must expose:

```text
GET /api/observability/runtime
```

It must report at least workspace count, card count, audit event count, outbox
count, pending outbox count, behavior event count, persistence type, and runtime
version. Observability must not become a write path.
