# WON-13 Production Runtime Architecture

This document is mandatory context for future WorkOSNext backend work. It exists
to prevent future AI or human changes from drifting back into page-specific
APIs, duplicate projection models, or mock-only workflow demos.

## Current Goal

WON-13 turns the WON-12 center projection into real production slices.

The first production scope is accommodation, split into two production slices:

```text
Slice A: Accommodation Resource Setup
RoomCreated -> BedCreated -> BedActivated

Slice B: Accommodation Check-in Execution
ApplicationApproved -> StayOrderPrepared -> DepositEvidenceSubmitted
-> FinanceDepositConfirmed -> CheckInConfirmed
```

These chains are the sample implementation for future business domains. They
must remain separate slices because resource setup is reusable master data, while
check-in execution is a transactional business process.

## Architecture Rule

The system center remains:

```text
IntentWorkspaceProjection + WorkspaceCardProjection
```

Do not introduce independent page models, task models, object models, search
models, learning models, or AI prompt models for the same business behavior.

## Non-Negotiable Runtime Guarantees

Every production slice must preserve these six guarantees:

- CI guarantee: every push and pull request runs backend build, frontend build,
  runtime contract tests, dependency audit, residual old-model scan, and diff
  whitespace check.
- Idempotency guarantee: every confirm request carries an idempotency key; the
  backend must reject duplicate writes by returning the existing event result.
- Migration guarantee: database schema changes are applied through ordered
  migrations from `infra/db/migrations/*.sql` recorded in
  `schema_migrations`; do not rely on ad hoc manual DDL or C# string migrations.
- Trusted actor guarantee: the backend identifies the actor from a server-issued
  session token and verified credentials, not from self-declared request body
  fields.
- Outbox Worker guarantee: confirmed audit events create outbox messages, and a
  worker processes pending messages into read models.
- Configuration guarantee: local and deployed environments use configuration
  files or environment variables; do not hard-code deployment endpoints in UI or
  backend logic.
- CORS guarantee: the API only accepts configured origins; no production runtime
  may use wildcard browser origins.

## API Shape

### Core Projection API

```http
GET /api/workspaces
GET /api/workspaces/{workspaceId}
```

The Core Projection API returns the center projection.

### Action Runtime API

```http
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

Every business write must go through prepare and confirm.
Confirm requires `X-WorkOS-Actor-Token` and an idempotency key. The actor role is
derived from the session token.

Do not create direct write APIs such as:

```text
/api/hotel/checkin
/api/finance/confirm-deposit
/api/room/activate
```

Domain actions are card confirmations, not page-specific endpoints.

### Lens APIs

Lens APIs are read-only views derived from the center projection:

```http
GET /api/lenses/work-queue
GET /api/lenses/search?q=...
```

Legacy aliases may exist temporarily:

```http
GET /api/work-queue
GET /api/search?q=...
```

Do not let Lens APIs own separate state.

### Event API

```http
GET /api/workspaces/{workspaceId}/events
GET /api/audit-events
GET /api/outbox
POST /api/projections/process-outbox
POST /api/behavior-events
GET /api/behavior-events
```

Audit events are produced by confirmed business actions.
Behavior events are UI or usage telemetry.
Outbox messages are produced from audit events and consumed by the projection
projector.

## Persistence

WON-13 production runtime uses PostgreSQL.

Required persistence surfaces:

- `schema_migrations`: applied migration ledger.
- `runtime_documents`: current projection snapshot.
- `runtime_sessions`: server-issued actor sessions.
- `audit_events`: confirmed business events.
- `outbox_messages`: pending and processed projection messages.
- `behavior_events`: UI and behavior telemetry.

Upcoming aggregate persistence surfaces must be introduced per slice. Room, bed,
deposit, finance confirmation, repair station, technician, and vehicle cannot
remain projection-only once they become writable business objects.

SQLite is not the target runtime persistence for WON-13. It may only be used for
throwaway local experiments, not production slice work.

## Identity And Role Gate

The runtime has minimum seeded identities:

- `u-operator`: operator role.
- `u-finance`: finance role.
- `u-manager`: manager role.
- `ai-agent`: ai role.

Rules:

- AI can prepare, explain, recommend, summarize, and draft.
- AI cannot confirm any card.
- Finance cards require finance role.
- Terminal business actions remain human-confirmed.
- Manager can confirm operator actions, but not finance actions unless explicitly allowed later.
- Request bodies must not be trusted for actor identity. `actorType` and
  `actorId` are derived from the session token.

## Outbox-Driven Projection

The runtime write path is:

```text
confirm
-> validate actor session token and role
-> enforce idempotency key
-> append AuditEvent journal row
-> append OutboxMessage
-> Outbox Worker consumes pending outbox
-> update Workspace read model
-> mark outbox processed
```

The first projector rule is deliberately simple:

1. Apply the confirmed event.
2. Mark current card `done`.
3. Promote next `notStarted` card to `ready`.
4. Save the updated projection snapshot.
5. Mark the outbox message processed.

Future complexity must be added as explicit projector rules, not as UI-only
state changes and not as direct page-specific writes.

## Frontend Rule

The frontend remains:

```text
Vite + vanilla JavaScript + vanilla CSS
```

Do not upgrade to React, Vue, Flutter, or React Native until the production
slice projection contract stabilizes.

The PWA is the Projection Contract Lab:

- It consumes the Core Projection API.
- It uses Action Runtime API for card actions.
- It validates whether blockers, evidence, checks, role gates, and bilingual copy are understandable.

## Expansion Rule

Do not build the whole platform first.

First make the two accommodation chains production-grade. Then apply the same
runtime pattern to repair:

```text
Repair request -> Arrival -> Dispatch -> Diagnosis -> Execution
-> Inspection -> Fee material -> Customer confirmation -> Close
```

Only add Object Lens, Task Lens, Coach Lens, or AI Context Lens when the current
production slice needs them.

## Required Validation

Before claiming WON-13 progress:

```powershell
docker compose -f infra/docker-compose.yml up -d postgres
dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release
dotnet build WorkOSNext.sln -c Release
npm.cmd run build
npm.cmd audit --audit-level=low
git diff --check
```

The runtime contract test must verify:

- 8 workspaces and 32 cards.
- Room, bed, and resource activation event sequence.
- Application, stay order, deposit, finance, and check-in event sequence.
- PostgreSQL persistence after runtime reload.
- Schema migrations applied through `schema_migrations`.
- Confirm idempotency.
- Backend actor identification via session token.
- AuditEvent journal append.
- Outbox message append and processed marker.
- Outbox projector idempotency.
- AI confirm rejection.
- Operator rejection on finance card.
- Finance role success on finance card.
- Behavior event persistence.
