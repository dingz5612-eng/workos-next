# WorkOSNext Engineering Rules

These rules are mandatory for all future WorkOSNext tasks.

Detailed rule files:

- `docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md`
- `docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md`
- `docs/architecture/WORKOS_CONTRACT_RULES.md`
- `docs/architecture/AI_TASK_TEMPLATE.md`

## 1. One Center Model

The system has one source of truth:

```text
IntentWorkspaceProjection + WorkspaceCardProjection
```

Home, search, workbench, operation pages, scenario coach, backend APIs, AI answers, and future voice entry must consume this center model.

Do not create separate page models, search models, learning models, AI prompt models, or duplicated scenario dictionaries.

## 2. Projection Ownership

Workspace projection definitions live in:

```text
apps/mobile/src/workspaceProjections.js
```

Demo work queue data lives in:

```text
apps/mobile/src/demoQueue.js
```

The UI runtime lives in:

```text
apps/mobile/src/main.js
```

`main.js` must not define business cards, evidence rules, event names, system checks, or blocker rules.

## 3. Card Contract

Every workspace card must define:

- Business fields.
- System fields.
- Analytics fields.
- Evidence requirements.
- System checks.
- Blocker rules.
- Events.
- Transitions.
- Confirmation policy.

Do not infer evidence or checks from field order. They must be explicit.

## 4. Field Contract

Every user-facing field must have:

- Stable field id.
- Label.
- Layer: business, system, or analytics.
- Type: text, select, searchSelect, money, evidenceUpload, confirmation, readonly.
- Required flag.
- Source: userInput, optionSet, searchableProjection, system, or projection.
- Visibility policy.

Normal users should not see raw technical ids, backend enum names, analytics keys, or database state names.

## 5. Entry Point Rules

Search is the active entry.

Workbench is the passive entry.

Both must resolve to an intent workspace and a card. They must not jump to old task pages or object pages.

Scenario coach explains the same card that the operation page handles. It must not maintain a separate stage list.

AI may explain, recommend, summarize, and draft. AI must not confirm, charge, refund, cancel, close, or change terminal states.

## 6. Module Boundary Rules

Split files when a file starts to own more than one responsibility:

- Projection/model definition.
- Demo data.
- UI rendering.
- Search/ranking.
- Learning/coach explanation.
- API contract.
- Styling.

Do not put business rules into render functions.

Do not put UI wording into backend projections except stable bilingual labels needed by the contract.

Do not put API transport details into mobile UI components.

## 7. Method Size Rules

Prefer small functions with one reason to change.

A function should usually do one of these:

- Select data.
- Transform projection.
- Render one UI section.
- Bind one group of events.
- Validate one business rule.

If a function needs comments to explain several internal phases, split it.

If a function mixes data selection, business rules, and HTML generation, split it.

## 8. Business Completion Rules

Every accommodation and repair scenario must be able to answer:

- What object is being handled?
- Which card is current?
- Which fields are required?
- Which evidence is required?
- What will the system check?
- What can block progress?
- Who can unblock it?
- Which event is emitted?
- Which projection updates?
- What is the next card?
- Does the action require human confirmation?

If the answer is unclear, the card is not ready for backend implementation.

## 9. Bilingual Rule

All product-facing text must support Chinese and Russian.

Do not add new user-facing text in only one language.

## 10. Clean Baseline Rule

Delete old code when a new model replaces it.

Do not keep compatibility task pages, object pages, old scenario dictionaries, or duplicate help/search systems unless there is an explicit migration reason documented in the same commit.

Before committing, run a residual scan for:

```text
scenarioFlows
data-task
data-scenario
taskView
objectView
knowledge result duplicates
```

## 11. Required Validation

Before commit:

```powershell
npm.cmd run build
npm.cmd audit --audit-level=low
dotnet build WorkOSNext.sln -c Release
dotnet run --project tests\WorkOS.RuntimeContractTests\WorkOS.RuntimeContractTests.csproj -c Release
pwsh ./scripts/guard-architecture.ps1
node scripts/validate-contracts.mjs
git diff --check
git status --short
```

For UI changes, capture screenshots for the affected entry points.

## 12. Architecture Direction

Backend V1 should expose:

```text
GET /api/workspaces
GET /api/workspaces/{workspaceId}
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

These APIs should return or accept the same center projection contract. Search, workbench, learning, AI, and voice must not bypass prepare and confirm.

## 13. Production Runtime Guarantees

For backend runtime work, CI, idempotency, migrations, trusted actor identity,
outbox worker processing, and configuration separation are mandatory.

- CI must run backend build, frontend build, runtime contract tests, npm audit,
  residual old-model scan, and `git diff --check`.
- Confirm commands must use idempotency keys and must not write duplicate audit
  events for repeated submissions.
- PostgreSQL schema changes must be versioned through migrations recorded in
  `schema_migrations`; migration SQL must live in `infra/db/migrations/*.sql`.
- Backend actor identity must come from a server-issued session token, not from
  request body claims.
- Confirmed audit events must produce outbox messages; projections must be
  updated by the outbox worker.
- API URLs, connection strings, and poll intervals must be configuration-driven,
  not hard-coded for one local machine.
- CORS must be restricted by `Cors:AllowedOrigins`; do not use `AllowAnyOrigin`.
- Dev login must still verify a configured password hash; do not reintroduce
  username-only authentication.

## 14. Slice Ownership Rule

Business work must be organized by production slice, not by page.

Required slices:

```text
Accommodation.ResourceSetup
Accommodation.CheckIn
Accommodation.CheckOut
Finance.DepositException
Repair.Dispatch
Repair.Close
```

Each slice owns Commands, Policies, Events, Projector Rules, Tests, and aggregate
persistence tables when it mutates real objects. Do not put new slice policy in
`ProjectionRuntime`; use focused policy classes such as `CardConfirmationPolicy`.

## 15. Contract Drift Rule

Projection and API shape must be treated as contracts.

- Projection responses must converge on
  `docs/contracts/projection-contract.schema.json`.
- Runtime APIs must converge on `docs/contracts/workos-runtime.openapi.json`.
- Frontend DTOs should be generated from contracts before more large workflows
  are added.
- Bilingual terminology should come from projection/i18n contracts; do not add
  new hard-coded local term dictionaries unless it is a documented temporary
  bridge.

## 16. Frontend Boundary Rule

`apps/mobile/src/main.js` is only the composition shell.

New work must go into focused modules:

```text
apiClient.js
operationRuntime.js
workspaceView.js
coachView.js
```

Do not add new fetch calls, action confirm logic, or learning-center business
rules directly to `main.js`.

## 17. Field Runtime Rule

Writable fields must not be plain text by default.

- Use selects for bounded business options such as room type, bunk type, payment
  method, and activation scope.
- Use date-time controls for stay dates, check-in/check-out dates, arrival time,
  and planned start time.
- Use derived read-only fields when the value follows from another field, such
  as room capacity from room type.
- Save draft must persist values and restore them when the same workspace card
  is reopened.
- Temporary front-end field catalogs are allowed only as a bridge toward a
  projection/i18n field contract.
