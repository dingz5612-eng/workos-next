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
policy details, session validation, or outbox projection rules.

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
- Actor identity comes from server-issued session token.
- Dev login still verifies configured password hashes.
- Confirmed events append to audit journal and outbox.
- Outbox worker updates projections.
- PostgreSQL schema changes live in `infra/db/migrations/*.sql`.
- CORS is restricted by `Cors:AllowedOrigins`; `AllowAnyOrigin` is forbidden.

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

## Observability Boundary

Runtime observability is part of the backend contract.

The API must expose:

```text
GET /api/observability/runtime
```

It must report at least workspace count, card count, audit event count, outbox
count, pending outbox count, behavior event count, persistence type, and runtime
version. Observability must not become a write path.
