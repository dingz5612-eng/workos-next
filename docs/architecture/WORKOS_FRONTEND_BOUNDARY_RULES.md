# WorkOS Frontend Boundary Rules

The PWA is a Projection Contract Lab and business acceptance bench. It must consume runtime contracts, not invent independent business models.

## Module Boundaries

`apps/mobile/src/main.js` is the composition shell.

New work goes into focused modules:

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

Forbidden in `main.js`:

```text
fetch(
/api/
confirmCard
```

`main.js` must stay under the 800-line transition budget and under the current
stricter composition-shell guard. Do not raise the stricter guard without a
documented migration reason.

`main.js` must stay between 150 and 250 lines when the application grows; tiny
composition-only versions may be shorter. It should only initialize state, read
URL params through `appState.js`, hydrate the API, assemble routes, render, and
bind events.

`main.js` may only:

- Initialize state.
- Read URL parameters through `appState.js`.
- Initialize API hydration.
- Assemble routes.
- Call `render`.
- Call `bindEvents`.

It must never own business judgment, field controls, API calls, confirmation
actions, or learning-center rules.

`eventBinder.js` is only the top-level DOM binding shell. It may attach event
listeners and delegate to controllers, but it must not own auth flow, operation
submit/draft collection, queue filtering, learning filters, navigation state
rules, or derived-field updates.

Ownership:

- `navigationController.js` owns `setView`, onboarding, language changes,
  workspace/card selection, and search navigation.
- `authController.js` owns login and logout.
- `operationController.js` owns operation drafts, operation value collection,
  derived fields, and submit orchestration delegation.
- `queueController.js` owns queue filter and sort state updates.
- `coachController.js` owns learning-center filters and coach stage selection.
- `views/workspaceView.js` owns workspace cards, operation panels, confirmation
  text, operation controls, operation values, and next-card display.
- `views/coachView.js` owns learning center rendering and scenario coach
  explanations.
- `selectors/searchSelectors.js` owns search ranking/search text.
- `selectors/queueSelectors.js` owns queue counts and queue filtering.
- `controls/fieldControls.js` owns field widget selection from projection
  metadata.

Other guarded frontend hubs:

- `controls/fieldControls.js` must render from `field.ui` metadata and must not
  infer business behavior from Chinese or Russian labels.
- `i18n.js` is only the i18n composition manifest. Copy lives in focused modules
  under `apps/mobile/src/i18n`; demo business objects and process/flow copy do
  not belong in the manifest.
- `styles.css` is only the style import manifest. CSS lives in focused modules
  under `apps/mobile/src/styles`; when a stylesheet grows beyond the guard
  threshold, split it by page or surface.
- Frontend API paths must come from generated contract artifacts under
  `apps/mobile/src/generated`, not hand-written endpoint strings in views or
  operation modules.

Required copy modules:

```text
i18n/shellCopy.js
i18n/demoCopy.js
i18n/coachCopy.js
i18n/operationCopy.js
```

Required style modules:

```text
styles/base.css
styles/shell.css
styles/workspace.css
styles/coach.css
styles/operation.css
styles/responsive.css
```

## Field Runtime

Writable fields must not be plain text by default.

- Select bounded business options.
- Use date-time controls for business dates.
- Use derived read-only fields when another field determines the value.
- Save draft must persist and restore per workspace card.
- Temporary front-end field catalogs are allowed only as a bridge toward projection/i18n field contracts.

## Product UX Boundary

The PWA is not the final mobile client. It is the projection acceptance bench.

Use it to prove:

- Whether fields are understandable.
- Whether evidence and blockers explain the business process.
- Whether role confirmation is clear.
- Whether events and projection updates match the real workflow.
- Whether Chinese and Russian wording is acceptable.

Do not polish temporary hand-written card branches as if they were the final
mobile product. First move field metadata, options, explanations, and bilingual
terms into contracts so the later mobile client can reuse them.

## Contract-Driven Rendering Direction

New large workflows should not add bespoke render logic to `main.js`.

Move toward:

```text
projection/i18n contract -> fieldControls -> operationRuntime -> workspaceView
```

Field widgets, option labels, required evidence, confirmation notes, and blocker
copy should be derived from projection contract metadata wherever possible.

## Learning And Search

Search, workbench, operation, and scenario coach must resolve to the same workspace card.

Do not create duplicate page, search, learning, AI, task, or object models.
