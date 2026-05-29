# WorkOS Backend Runtime Rules

Backend runtime code must preserve the Slice/Card/Event architecture while
making confirm behavior reliable, auditable, and contract-driven.

## Write Path

The only business write endpoints are:

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

Prepare may load projection, card contract, blockers, defaults, and allowed
actions. Confirm is the only mutation path for business facts.

## SliceRuntimeCapabilityGate

Runtime capability is loaded from `docs/contracts/slice-manifest.json`.

- `contract-only`: prepare allowed, confirm forbidden, no side effects.
- `runtime-skeleton`: confirm allowed only when an explicit skeleton policy
  exists for the slice.
- `production-slice`: confirm requires policy, audit event, outbox message,
  aggregate write, projector rule, and tests.

Every new slice status behavior must have no-side-effect tests for forbidden
confirm attempts.

## EventSelectionPolicy

Confirm dispatch must go through `EventSelectionPolicy`.

- Single-event cards emit exactly one event.
- Conditional cards select the confirmed or rejected event from stable contract
  data and confirmation result.
- Multi-event cards must explicitly declare that all selected events are emitted.

Runtime code must not use `card.Events.First()` or equivalent first-event
selection as the dispatch decision.

## Confirm HTTP Status Semantics

`ConfirmHttpStatusMapper` owns the stable mapping from runtime status to HTTP.
`Program.cs` may format the response body, but it must not invent another
mapping table.

| Runtime condition | HTTP |
| --- | --- |
| Workspace or card not found | `404` |
| Malformed input | `400` |
| Missing or invalid actor token | `401` |
| AI, role, or slice capability forbidden | `403` |
| Duplicate or idempotency conflict | `409` |
| Business policy violation | `422` |
| Confirmed | `200` |

Do not collapse all forbidden or invalid results into `400`.

## ConfirmUnitOfWork

Confirm must have one transaction boundary:

```text
Begin transaction
  insert audit_events
  insert outbox_messages
  apply slice aggregate writes
Commit
```

Any failure rolls back the entire confirm. `ActionRuntimeService` may delegate to
storage helpers, but audit, outbox, and aggregate effects must share the same
transaction or an explicit `ConfirmUnitOfWork`.

## Idempotency

Confirm idempotency is a database concern, not a frontend convention.

- `audit_events.idempotency_key` must be unique.
- Insertion must be atomic.
- Duplicate submit returns the existing durable result without new audit,
  outbox, or aggregate effects.
- Conflicting reuse of a key must return a stable idempotency conflict response.

## Outbox Reliability

Outbox workers must claim before processing. The contract fields are:

```text
claimed_by
claimed_at_utc
attempt_count
last_error
dead_lettered_at_utc
```

Existing schemas may migrate from `retry_count`, but the runtime contract should
settle on `attempt_count`. Claiming must use `FOR UPDATE SKIP LOCKED` or an
equivalent safe mechanism. Failures increment attempts, record `last_error`, and
dead-letter after the configured threshold.

## ProjectionStateMigrator

When contracts evolve, old `runtime_documents` must be upgraded by a named
projection state migrator. The baseline migrator merges current seed contracts
into persisted state, preserving durable events, users, and card statuses while
absorbing newly declared workspaces/cards. Do not silently overwrite projection
state to hide contract drift.

## OpenAPI and Program Alignment

OpenAPI is the HTTP source of truth. `Program.cs`, generated frontend
`runtimeApiPaths`, runtime DTOs, and validation scripts must align with
`docs/contracts/workos-runtime.openapi.json`.

CI must run:

```bash
node scripts/validate-runtime-api.mjs
node scripts/generate-contract-dtos.mjs --check
```

## Production Auth

Development auth fallback belongs only in development configuration and must not
be reachable in production. Production must reject dev passwords and untrusted
actor identity from the request body.

## Backend Facade Boundaries

- `ProjectionRuntime.cs` stays a facade.
- `PostgresProjectionStore.cs` stays a composed store.
- `ProjectionSeed.cs` stays seed assembly.
- Runtime policies do not depend on localized labels.
- Slice-owned persistence owns slice facts.
