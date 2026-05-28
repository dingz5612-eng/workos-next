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

## 7A. Responsibility Boundary Rule

No file may become a multi-responsibility hub.

The following hub boundaries are mandatory and enforced by
`scripts/guard-architecture.ps1`:

1. `main.js` only does composition. It must not contain view details, API
   transport, business judgment, confirmation actions, field controls, or
   learning-center rules.
2. `ProjectionRuntime.cs` only acts as the runtime facade. It must not directly
   own Lens, Auth, Projector, search text construction, SQL, migrations, or UI
   metadata.
3. `PostgresProjectionStore.cs` only acts as the composed `IProjectionStore`.
   It must not directly accumulate every table operation or any business rule.
4. `ProjectionSeed.cs` only assembles seed contracts. It must not permanently
   carry all event, evidence, field UI, option-set, or terminology catalogs.
5. `fieldControls.js` only consumes `field.ui` contract metadata. It must not
   infer business behavior from Chinese labels.
6. `i18n.js` is only the composition manifest. It must not carry demo business
   objects, task names, or process/flow copy.
7. `styles.css` is only the import manifest. If styles grow beyond the guarded
   threshold, they must be split by page or surface under `apps/mobile/src/styles`.

Frontend boundaries:

- `main.js` only composes state, routing, render, and event binding.
- `eventBinder.js` only binds top-level DOM events to controllers. It must not
  own login, logout, submit, draft collection, queue filtering, learning filter,
  derived-field, or navigation logic.
- Frontend controller responsibilities are split as:
  `navigationController.js` for setView/onboarding/language/search navigation,
  `authController.js` for login/logout, `operationController.js` for draft,
  submit, and derived fields, `queueController.js` for queue filter/sort, and
  `coachController.js` for learning-center filters and stage selection.
- View rendering must live in focused modules under `apps/mobile/src/views`.
- API transport must live only in `apiClient.js`.
- Action submit/confirm orchestration must live only in `operationRuntime.js`.
- Field control rendering must consume contract metadata from `field.ui`; it
  must not infer business rules from Chinese or Russian labels.
- `i18n.js` is a temporary root dictionary. New large demo, coach, or operation
  copy should move toward focused i18n/copy modules or projection/i18n
  contracts.
- `styles.css` is allowed as the current stylesheet only while guarded. New
  major UI surfaces should move toward `styles/*` modules or clearly bounded
  sections.

Backend boundaries:

- `ProjectionRuntime` is a facade, not the owner of lens queries, action
  runtime, auth, projector, or policy.
- `CardConfirmationPolicy` lives outside `Runtime` under slice policy
  boundaries. Runtime may call it, but must not own policy decisions.
- Store classes persist and load data only; they must not own business rules,
  projection rules, policy rules, or lens/search ranking.
- `PostgresProjectionStore` is a facade over focused PostgreSQL storage helpers.
- `ProjectionSeed` only assembles seed contracts. Evidence, events, checks,
  option sets, field UI, and bilingual terms live in focused catalogs.
- New slice rules must live under slice modules, not shared runtime files.

Guarded line budgets:

```text
ProjectionRuntime.cs: warn > 350 lines, fail > 450 lines.
PostgresProjectionStore.cs: warn > 300 lines, fail > 400 lines.
ProjectionSeed.cs: warn > 400 lines, fail > 500 lines.
main.js: transition budget <= 800 lines, with current stricter facade budget <= 250 lines.
eventBinder.js: <= 120 lines.
```

Current local budgets may be stricter than the transition budgets above. Do not
relax a stricter budget unless the architecture rules are updated in the same
commit with a concrete migration reason.

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

## 10A. Clean Baseline Gate

The repository must not carry obsolete code, unused files, dead exports, stale
demos, or legacy architecture paths into the current baseline.

When a new model replaces an old model, the old implementation must be removed
in the same change.

Allowed temporary legacy code must have:

- Explicit migration reason.
- Owner.
- Removal condition.
- Target removal milestone.

Clean baseline checks are owned by:

```text
scripts/clean-baseline.ps1
```

The clean baseline gate checks:

- Unreferenced JavaScript files under `apps/mobile/src`.
- Unreferenced JavaScript files are checked by reachability from `main.js`, not
  by loose import-name matching.
- Unused i18n keys.
- Old architecture keywords and stale docs.
- `.csproj` files under `services` or `tests` that are not referenced by
  `WorkOSNext.sln`.
- Potentially unused C# types outside documented slice skeletons.
- Forbidden legacy, obsolete, fallback, or mock-only file names.
- Mock-only references from production runtime and mobile code.
- Long-term unused CSS classes, with explicit allowlist only when a class is a
  documented transitional style.

Do not hide obsolete code by renaming it. Delete it, or document the temporary
legacy exception with owner and removal milestone in the same change.

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
pwsh ./scripts/clean-baseline.ps1
node scripts/validate-contracts.mjs
node scripts/validate-runtime-api.mjs
node scripts/generate-contract-dtos.mjs --check
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
  residual old-model scan, clean baseline gate, real API response contract
  validation, and `git diff --check`.
- Confirm commands must use idempotency keys and must not write duplicate audit
  events for repeated submissions.
- PostgreSQL schema changes must be versioned through migrations recorded in
  `schema_migrations`; migration SQL must live in `infra/db/migrations/*.sql`.
- Backend actor identity must come from a server-issued session token, not from
  request body claims.
- Confirmed audit events must produce outbox messages; projections must be
  updated by the outbox worker.
- Audit events and outbox messages must carry `correlationId`, `causationId`,
  and `requestId` for traceability.
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

## 14A. Slice Aggregate Rule

Writable business concepts must become slice-owned aggregate roots and business
tables before their slice is treated as production-grade.

Required current aggregate roots:

```text
Accommodation.ResourceSetup -> Room, Bed
Accommodation.CheckIn -> Lead, Booking, Resident, Stay, GuestFolio, DepositLiability, Payment, FinanceReconciliation, OperatingMetrics
Repair.Dispatch -> RepairStation, Technician, Vehicle
```

Aggregate rules:

- Aggregate records live under the owning slice's `Aggregates` directory.
- Aggregate persistence lives under slice persistence modules, not inside
  `ProjectionRuntime`, `PostgresProjectionStore`, render functions, or
  projection seed catalogs.
- Aggregate tables live in versioned SQL migrations under
  `infra/db/migrations/*.sql`.
- Confirmed commands produce audit events; slice aggregate persistence consumes
  those events and upserts business tables.
- Projection read models may reflect aggregate state, but projection JSON is not
  the source of truth for writable objects.
- Runtime contract tests must assert that slice aggregate tables are created and
  populated for the current production slice sample.

## 14B. Hostel Ledger Runtime Rule

The hostel check-in slice is a ledger runtime, not a simple form flow.

The production loop is:

```text
LeadCaptured
-> BookingConfirmed
-> ResidentRegistered
-> BedAssigned
-> TariffAssigned
-> DepositRequired
-> PaymentRecordedByFrontDesk
-> PaymentConfirmedByFinance
-> StayCheckedIn
-> OperatingMetricsReviewed
```

Required ledgers:

- Lead and booking ledger.
- Stay lifecycle ledger.
- Guest folio ledger.
- Deposit liability ledger.
- Payment ledger.
- Finance reconciliation ledger.
- Operating metrics ledger.

Deposits must stay separate from revenue. Front-desk payment capture is not a
trusted finance confirmation until a finance actor confirms it. Every production
loop must update operating metrics and expose the result through the projection
bench.

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
appState.js
appShell.js
appRouter.js
eventBinder.js
navigationController.js
authController.js
operationController.js
queueController.js
coachController.js
apiClient.js
operationRuntime.js
operationDrafts.js
views/*.js
selectors/*.js
controls/*.js
workspaceView.js
coachView.js
```

Do not add new fetch calls, action confirm logic, or learning-center business
rules directly to `main.js`.

`main.js` is a composition shell. It should not own page rendering, queue/search
selectors, workspace card rendering, learning center explanations, field widget
selection, draft collection, login flow, or submit flow.

`eventBinder.js` is an event binding shell. It should only attach listeners and
delegate to controllers. It must not import `apiClient.js`, call `loginActor`,
call `submitCardOperation`, collect operation values, or update derived fields.

Allowed `main.js` responsibilities are only:

- Initialize state.
- Read URL parameters through `appState.js`.
- Initialize API hydration.
- Assemble routes.
- Call `render`.
- Call `bindEvents`.

No business judgment, field controls, API calls, confirmation actions, or
learning-center rules may be added to `main.js`.

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

## 18. Product Maturity Boundary

Do not describe the current system as a complete business system until business
entities and aggregate roots are persisted outside the projection snapshot.

The current WON-13 baseline is:

```text
production slice skeleton + action runtime + audit event + outbox projection
```

It is not yet the final mobile product, and it is not yet the full domain
model. Future work must close these gaps in this order:

- Entity and aggregate persistence for writable objects.
- Slice-owned commands, policies, events, projector rules, and tests.
- Contract-driven field rendering and bilingual terminology.
- Frontend module shrinkage until `main.js` is only composition.
- Final mobile product UX after the projection contract stabilizes.

Room, bed, deposit, finance confirmation, repair station, technician, vehicle,
and other writable business concepts must not remain only projection fields once
their slice becomes production-grade.

## 19. Contract-Driven UX Rule

The PWA may keep temporary hand-written controls while validating a slice, but
new large workflows must move toward contract-driven UI:

- Field widgets are selected from field contract metadata.
- Option labels come from projection/i18n contracts.
- Business explanations come from card, policy, evidence, and blocker contract
  metadata.
- Local hard-coded bilingual maps are temporary bridges and must shrink over
  time.

Do not keep adding one-off render branches for every new business card.
