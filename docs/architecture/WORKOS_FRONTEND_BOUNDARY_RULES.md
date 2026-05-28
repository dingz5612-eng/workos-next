# WorkOS Frontend Boundary Rules

The PWA is a Projection Contract Lab and business acceptance bench. It must consume runtime contracts, not invent independent business models.

## Module Boundaries

`apps/mobile/src/main.js` is the composition shell.

New work goes into focused modules:

```text
apiClient.js
operationRuntime.js
workspaceView.js
coachView.js
fieldControls.js
operationDrafts.js
```

Forbidden in `main.js`:

```text
fetch(
/api/
confirmCard
```

`main.js` should continue shrinking toward an 800-line target.

## Field Runtime

Writable fields must not be plain text by default.

- Select bounded business options.
- Use date-time controls for business dates.
- Use derived read-only fields when another field determines the value.
- Save draft must persist and restore per workspace card.
- Temporary front-end field catalogs are allowed only as a bridge toward projection/i18n field contracts.

## Learning And Search

Search, workbench, operation, and scenario coach must resolve to the same workspace card.

Do not create duplicate page, search, learning, AI, task, or object models.
