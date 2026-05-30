# V5.4 Release Control Center

Release Control Center is the first read-only UI and API surface for V5.4
release governance.

## Backend Read APIs

- `GET /api/control-plane/releases`
- `GET /api/control-plane/releases/{releaseId}`
- `GET /api/control-plane/gate-results/{gateResultId}`
- `GET /api/control-plane/shadow-compare-reports/{id}`
- `GET /api/control-plane/invariant-checks?releaseId=...`
- `GET /api/control-plane/rollback-instructions/{id}`

The first batch is read-only. There are no `POST`, `PUT`, `PATCH`, or `DELETE`
routes under `/api/control-plane`.

## UI Sections

The minimal page is available in the existing Vite shell as
`view=releaseControl`.

It renders:

- MR Overview
- GateResult Detail
- Shadow Report
- Invariant Monitor
- Rollback / Compensation
- FeatureFlag
- SliceCutoverState
- ReleaseManifest
- CI run id
- Business Signoff
- Active / Locked admission blockers

Minimum fields:

- MR ID
- release status
- owner
- GateResult status
- Shadow grade
- P0/P1/P2 invariant count
- feature flag status
- slice `runtime_mode`
- rollbackInstruction link
- acceptance progress
- `ci_run_id`
- business signoff refs
- ReleaseManifest audit timestamps
- active and locked transition blockers

## Rules

- GateResult status is displayed as read-only machine output.
- UI cannot manually update GateResult status.
- UI cannot directly switch a slice to `active`.
- Future runtime switches must go through an approved action path.
- Active transition is blocked unless the latest GateResult is `passed`.
- Any red ShadowCompareReport blocks active transition.
- Any failed/blocked P0 blocking invariant blocks active transition.
- Missing RollbackInstruction blocks active transition.
- Missing business signoff blocks locked transition.
- ReleaseManifest fields are rendered as audit evidence, including commit,
  migration, definition, API schema hash, CI run id, and timestamps.
