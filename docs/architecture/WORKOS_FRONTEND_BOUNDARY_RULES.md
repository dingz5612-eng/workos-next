# WorkOS Frontend Boundary Rules

The mobile PWA is a contract-driven runtime client. It does not own business
truth, page-specific write APIs, or localized-label business inference.

## Composition Shells

- `main.js` wires application composition only.
- `eventBinder.js` binds top-level UI events only.
- Views render state and call controller callbacks.
- Controllers coordinate UI state.
- `operationRuntime.js` owns prepare/confirm submit protocol.
- `apiClient.js` owns API transport and HTTP parsing.

No view module may call `fetch` or contain `/api/` paths.

## Submit Protocol

Every confirm submit must include:

```text
idempotencyKey = crypto.randomUUID()
submissionId = crypto.randomUUID()
cardInstanceId = current card instance key
aggregateRef = selected aggregate reference when applicable
evidenceIds = evidence UI state
fieldValues = canonical field id/value map
```

Do not build idempotency keys from `workspaceId`, `cardId`, or `actorId`.
The backend derives trusted actor identity from the actor token only.

## Evidence

Evidence UI must produce durable or locally traceable evidence records before
confirm. Until a real upload service exists, the minimum contract is:

```text
EvidenceRequirement -> EvidenceDraft -> evidenceIds[]
```

`evidenceIds` must be submitted to confirm and persisted in audit payloads.

## HTTP Handling

Frontend handling must preserve session correctly:

| HTTP | Frontend behavior |
| --- | --- |
| `401` | Clear session and return to login. |
| `403` | Show permission or slice status blocker; do not clear session. |
| `409` | Show duplicate or idempotency result; do not clear session. |
| `422` | Show business blocker/reason; do not clear session. |
| `400` | Show request format error; do not clear session. |

## Escaping

Projection text, user input, evidence names, Lens values, operation messages,
and localized labels must be escaped before entering HTML strings. Prefer DOM
builders where practical; otherwise use shared `escapeHtml` and `escapeAttr`
helpers. Do not interpolate raw projection or user text into `innerHTML`.

## Lens Consumption

The frontend consumes Lens read models through contract paths generated from
OpenAPI. Lens output is read-only and must not create a hidden write model.

## Runtime Surfaces

Home, Workbench, Search, Learning, Workspace, and Me are runtime surfaces. They
must consume the same runtime projection, queue, search, Lens, and learning
catalog source. A slice visible in Search or Learning must not disappear from
Home or Workbench because those views use stale local models.

Runtime surface source boundaries:

- Home must not hardcode business workspace IDs.
- Workbench must not use `demoQueue` as a production source.
- `demoQueue` is permitted only as an explicit dev/test fixture. Production
  offline behavior must show real cached data or a true empty/error state, not
  fake business objects.
- Queue items must carry `workspaceId` and `cardId` directly.
- Frontend code must not infer `workspaceId` from `taskId`.
- Search fallback must not route current intents to deprecated workspace IDs.
- Learning may generate coaching copy locally, but the catalog source must be
  runtime workspaces or a learning Lens.
- Workspace open from queue/search/home must use runtime `workspaceId` and may
  preselect `cardId`.
- Me stats must come from runtime queue, blockers, behavior events, or be shown
  as unavailable rather than demo numbers.

## Carried-Forward Scope

Carried-forward values must be scoped by aggregate and card instance. A field
value from one aggregate instance must not bleed into a different aggregate
because the field id is the same.

## Field Controls

`fieldControls.js` consumes `field.ui` contract metadata only. It must not infer
business behavior from Chinese or Russian labels.
