# WorkOSNext First Batch Repo Map

Date: 2026-05-29

Scope: repository scan and execution planning only. No business code, directory rename, dependency, workflow, or test weakening change was made.

## Project Type

| Area | Current finding |
| --- | --- |
| Backend language/framework | C# on .NET 10 / ASP.NET Core Minimal API. Main app uses `Microsoft.NET.Sdk.Web` and `Npgsql` for PostgreSQL access. |
| Frontend language/framework | JavaScript ES modules, Vite mobile-first PWA prototype. No React/Vue/Svelte framework detected in `apps/mobile/package.json`. |
| Database migration tool | Custom SQL migration runner: `PostgresMigrationRunner` + `MigrationScriptLoader`; not EF Core migrations. |
| Backend tests | MSTest projects plus runtime contract console runner. |
| Frontend tests | Vitest under `apps/mobile/src/__tests__`. |
| CI tool | GitHub Actions workflow at `.github/workflows/ci.yml`. |
| API route/controller directory | No controller directory detected. Routes are mapped in `services/core-api/WorkOS.Api/Program.cs`. |
| Migration directory | `infra/db/migrations`. |
| Docs / engineering rules | `docs/architecture`, `docs/contracts`, `docs/product`, `docs/decisions`, `docs/review`, `docs/ux`, `docs/i18n`. |
| Scripts / tools | `scripts`. |

## Required Paths

- backend project path: `services/core-api/WorkOS.Api/WorkOS.Api.csproj`
- backend source path: `services/core-api/WorkOS.Api`
- frontend project path: `apps/mobile`
- migration path: `infra/db/migrations`
- test path: `tests`, plus frontend tests in `apps/mobile/src/__tests__`
- CI workflow path: `.github/workflows/ci.yml`
- API route location: `services/core-api/WorkOS.Api/Program.cs`
- contract docs path: `docs/contracts`
- engineering rules path: `docs/architecture`
- tools path: `scripts`

## Current API Routes

All current runtime routes are Minimal API mappings in `services/core-api/WorkOS.Api/Program.cs`.

| Method | Route | Current handler target |
| --- | --- | --- |
| GET | `/` | Redirects to `/health` |
| GET | `/health` | Inline health payload |
| GET | `/api/bootstrap` | `DemoBootstrap.Create()` |
| POST | `/api/auth/login` | `ProjectionRuntime.Login` |
| GET | `/api/workspaces` | `ProjectionRuntime.GetAll` |
| GET | `/api/workspaces/{workspaceId}` | `ProjectionRuntime.FindWorkspace` |
| GET | `/api/work-queue` | `ProjectionRuntime.GetWorkQueue` |
| GET | `/api/search?q=...` | `ProjectionRuntime.Search` |
| GET | `/api/lenses/home-surface` | `ProjectionRuntime.GetHomeSurface` |
| GET | `/api/lenses/work-queue` | `ProjectionRuntime.GetWorkQueue` |
| GET | `/api/lenses/search?q=...` | `ProjectionRuntime.Search` |
| GET | `/api/lenses/learning-catalog` | `ProjectionRuntime.GetLearningCatalog` |
| GET | `/api/lenses/accommodation/{lensId}` | `ProjectionRuntime.GetAccommodationLens` |
| GET | `/api/evidence` | `ProjectionRuntime.GetEvidenceObjects` |
| POST | `/api/evidence/drafts` | `ProjectionRuntime.CreateEvidenceDraft` |
| POST | `/api/evidence/{evidenceId}/attachments` | `ProjectionRuntime.AttachEvidence` |
| POST | `/api/evidence/{evidenceId}/verify` | `ProjectionRuntime.VerifyEvidence` |
| POST | `/api/evidence/{evidenceId}/reject` | `ProjectionRuntime.RejectEvidence` |
| POST | `/api/workspaces/{workspaceId}/cards/{cardId}/prepare` | `ProjectionRuntime.Prepare` |
| POST | `/api/workspaces/{workspaceId}/cards/{cardId}/confirm` | `ProjectionRuntime.Confirm` |
| GET | `/api/workspaces/{workspaceId}/events` | `ProjectionRuntime.GetAuditEvents(workspaceId)` |
| GET | `/api/audit-events` | `ProjectionRuntime.GetAuditEvents()` |
| GET | `/api/outbox` | `ProjectionRuntime.GetOutboxMessages` |
| POST | `/api/projections/process-outbox` | `ProjectionRuntime.ProcessPendingOutbox` |
| GET | `/api/behavior-events` | `ProjectionRuntime.GetBehaviorEvents` |
| GET | `/api/observability/runtime` | `ProjectionRuntime.Observe` |
| POST | `/api/behavior-events` | Inline behavior event append |

Generated frontend path constants are in `apps/mobile/src/generated/runtimeApiPaths.js`.

## Current Workspace/Card API Locations

Backend:

- `services/core-api/WorkOS.Api/Program.cs`: HTTP route mappings for workspace, card prepare, and card confirm.
- `services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs`: public runtime facade for workspace projection, lenses, prepare, confirm, evidence, audit, outbox, and observability.
- `services/core-api/WorkOS.Api/Runtime/RuntimeQueryService.cs`: projection envelope and workspace lookup.
- `services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs`: card prepare/confirm application flow.
- `services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs`: seed assembly for `IntentWorkspaceProjection + WorkspaceCardProjection`.
- `services/core-api/WorkOS.Api/Runtime/WorkspaceSeedCatalog.cs`: current workspace/card seed catalog.
- `services/core-api/WorkOS.Api/Runtime/CardContractFactory.cs`: card contract projection factory.
- `services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs`: PostgreSQL-backed projection store entry point.
- `services/core-api/WorkOS.Api/Slices`: slice-owned runtime/persistence/projector policy locations.

Frontend:

- `apps/mobile/src/apiClient.js`: fetches workspaces/lenses/evidence and calls `prepareCard` / `confirmCard`.
- `apps/mobile/src/generated/runtimeApiPaths.js`: generated runtime path constants.
- `apps/mobile/src/runtime/runtimeStore.js`: stores runtime projection, lens payloads, source flags, and offline fallback state.
- `apps/mobile/src/selectors/surfaceSelectors.js`: resolves workspace/card surfaces from runtime payloads or fallback projections.
- `apps/mobile/src/selectors/workspaceSelectors.js`: active workspace/card selection.
- `apps/mobile/src/views/workspaceView.js`: workspace/card operation UI and submit button.
- `apps/mobile/src/operationRuntime.js`: materializes evidence, calls prepare/confirm, waits for projection/lens refresh.
- `apps/mobile/src/operationController.js`: collects draft values and submits current card.

## Current Confirm Handler Locations

Backend confirm chain:

- `services/core-api/WorkOS.Api/Program.cs`: `POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm`; extracts `X-WorkOS-Actor-Token` and `X-Request-Id`, maps `ConfirmStatus` to HTTP status.
- `services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs`: `Confirm(...)` lock/facade and failed-confirm reason counters.
- `services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs`: validates workspace/card, slice capability, idempotency, actor session, confirmation policy, field keys, ledger aggregate ref, field contracts, evidence, slice policies, event dispatch, idempotent commit, and projection catch-up.
- `services/core-api/WorkOS.Api/Slices/Policies/CardConfirmationPolicy.cs`: role/AI confirmation authorization.
- `services/core-api/WorkOS.Api/Runtime/ConfirmationPolicyCatalog.cs`: card-to-confirmation policy metadata.
- `services/core-api/WorkOS.Api/Runtime/ConfirmHttpStatusMapper.cs`: confirm reason to HTTP status category helper.
- `services/core-api/WorkOS.Api/Runtime/ConfirmUnitOfWork.cs`: confirm commit unit for events/card instances.
- `services/core-api/WorkOS.Api/Runtime/EventSelectionPolicy.cs` and slice policy files under `services/core-api/WorkOS.Api/Slices/Accommodation/*/Policies`: confirm event and business rule selection.

Frontend confirm chain:

- `apps/mobile/src/eventBinder.js`: binds `[data-submit-card]` to `submitCurrentCard`.
- `apps/mobile/src/operationController.js`: `submitCurrentCard`, confirm error handling, draft protocol creation.
- `apps/mobile/src/operationRuntime.js`: `submitCardOperation` calls prepare, confirm, and projection/lens refresh.
- `apps/mobile/src/apiClient.js`: `confirmCard` HTTP client.
- `apps/mobile/src/views/workspaceView.js`: submit button and operation surface rendering.

## Current Fake Fallback / Demo Data Suspected Locations

These are suspected or explicitly declared fallback/demo locations, not changed in this scan:

- `services/core-api/WorkOS.Api/Program.cs`: `DemoBootstrap` backs `/api/bootstrap`.
- `services/core-api/WorkOS.Api/Runtime/WorkspaceSeedCatalog.cs`: static workspace/card seed catalog for runtime projection.
- `services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs`: seed assembler.
- `apps/mobile/src/workspaceProjections.js`: explicitly marked "Offline/dev/test fallback fixture only".
- `apps/mobile/src/demoQueue.js`: offline demo task queue data.
- `apps/mobile/src/i18n/demoCopy.js`: demo copy loaded by `apps/mobile/src/i18n.js`.
- `apps/mobile/src/runtime/runtimeStore.js`: `local-fallback`, `projection-fallback`, and `offline-demo-fallback` state flags.
- `apps/mobile/src/selectors/surfaceSelectors.js`: projection fallback and `offlineDemoQueue()` behavior.
- `apps/mobile/src/views/workbenchView.js`: displays offline API fallback help when queue source is `offline-demo-fallback`.
- `tests/WorkOS.RuntimeContractTests/Program.cs`: fake evidence ids are intentionally used as negative contract tests.
- `tests/WorkOS.UnitTests/RuntimeHardeningTests.cs`: `FakeStore` test double.
- `scripts/guard-architecture.ps1` and `scripts/clean-baseline.ps1`: existing guards already police fake/default/demo leakage.

## Current Migration Naming Convention

- Directory: `infra/db/migrations`.
- Pattern: three-digit ordinal prefix plus snake_case description: `NNN_description.sql`.
- Current range: `001_runtime_core.sql` through `014_runtime_evidence_card_instances.sql`.
- Application order: `MigrationScriptLoader` orders `*.sql` by file name.
- Migration id: file stem, recorded in PostgreSQL table `schema_migrations(migration_id, applied_at_utc)`.
- Runtime runner: `PostgresMigrationRunner`.

## Current Commands

Build commands from CI:

```powershell
npm --prefix apps/mobile run build
dotnet build WorkOSNext.sln -c Release
```

Test / validation commands from CI:

```powershell
npm --prefix apps/mobile run test
dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release --no-build
dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release --no-build
$env:WORKOS_TEST_CONNECTION="Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev"
$env:TEST_DATABASE="true"
dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release
node scripts/validate-contracts.mjs
node scripts/validate-slice-admission.mjs
node scripts/architecture-drift-report.mjs
node scripts/generate-contract-dtos.mjs --check
$env:ConnectionStrings__WorkOSRuntime="Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev"
node scripts/validate-runtime-api.mjs
./scripts/guard-architecture.ps1
./scripts/clean-baseline.ps1
git diff --check
```

Local run commands from README:

```powershell
dotnet run --project services/core-api/WorkOS.Api/WorkOS.Api.csproj --urls http://127.0.0.1:5191
cd apps/mobile
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

## Validation Run During This Scan

- `npm --prefix apps/mobile run build`: passed.
- `npm --prefix apps/mobile run test`: passed, 5 files / 20 tests.
- `dotnet build WorkOSNext.sln -c Release`: failed because an existing running process locks `services/core-api/WorkOS.Api/bin/Release/net10.0/WorkOS.Api.exe` and `WorkOS.Api.dll`.
- Locked process observed: `WorkOS.Api` PID `148780`, path `services/core-api/WorkOS.Api/bin/Release/net10.0/WorkOS.Api.exe`.
- `dotnet build services/core-api/WorkOS.Api/WorkOS.Api.csproj -c Release -p:OutputPath=$env:TEMP\WorkOSNextApiBuild\`: passed, 0 warnings / 0 errors. This avoids overwriting the locked running API output.
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release --no-build --no-restore`: passed, 15 tests.
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release --no-build --no-restore`: passed, 4 tests.
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release -p:OutputPath=$env:TEMP\WorkOSNextUnitBuild\`: failed because tests locate the repository root by walking from the assembly output path; temporary output path is outside the repo. This was a validation-command artifact, not a business-source failure.

## First Execution Batches

Batch A: backend runtime/API/source-of-truth hardening.

- Directories: `services/core-api/WorkOS.Api/Runtime`, `services/core-api/WorkOS.Api/Slices`, `infra/db/migrations`, `docs/contracts`, `tests/WorkOS.RuntimeContractTests`, `tests/WorkOS.RuntimeIntegrationTests`.
- Focus: workspace/card API behavior, confirm admission boundaries, ledger/evidence/source-of-truth persistence, migration-backed runtime facts, runtime contract coverage.

Batch B: frontend runtime surface and fallback cleanup.

- Directories: `apps/mobile/src/runtime`, `apps/mobile/src/selectors`, `apps/mobile/src/views`, `apps/mobile/src/controls`, `apps/mobile/src/generated`, `apps/mobile/src/__tests__`.
- Key files also in scope: `apps/mobile/src/apiClient.js`, `apps/mobile/src/operationRuntime.js`, `apps/mobile/src/operationController.js`, `apps/mobile/src/workspaceProjections.js`, `apps/mobile/src/demoQueue.js`.
- Focus: make online surfaces consume runtime API/lens/card contracts first, keep offline/demo fixtures explicit, remove or fence suspected fake fallback paths.

Batch C: governance, contracts, and CI proof.

- Directories: `scripts`, `docs/architecture`, `docs/contracts`, `tests/WorkOS.UnitTests`, `.github/workflows`, `docs/v5.4`.
- Focus: contract generation/checks, architecture guard coverage, no fake CI pass, no test weakening, document batch outcomes and update CI only for legitimate validation additions.
