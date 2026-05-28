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
