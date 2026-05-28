$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Error $message
  exit 1
}

function Assert-Exists($path) {
  if (-not (Test-Path $path)) {
    Fail "Required architecture artifact is missing: $path"
  }
}

function Assert-NoMatches($paths, $pattern, $message, $excludePattern = $null) {
  $matches = rg -n $pattern $paths 2>$null
  if ($LASTEXITCODE -eq 1) {
    return
  }
  if ($LASTEXITCODE -ne 0) {
    Fail "rg failed while checking: $message"
  }

  if ($excludePattern) {
    $matches = $matches | Where-Object { $_ -notmatch $excludePattern }
  }

  if ($matches) {
    $matches
    Fail $message
  }
}

function Assert-MaxLines($path, $max, $message) {
  $lines = (Get-Content $path).Count
  if ($lines -gt $max) {
    Fail "$message Current: $lines, max: $max, file: $path"
  }
}

Assert-Exists "docs/contracts/projection-contract.schema.json"
Assert-Exists "docs/contracts/workos-runtime.openapi.json"
Assert-Exists "docs/contracts/slice-manifest.json"
Assert-Exists "docs/contracts/policy-contract.json"
Assert-Exists "apps/mobile/src/generated/workosContracts.d.ts"
Assert-Exists "docs/architecture/WORKOS_ENGINEERING_RULES.md"
Assert-Exists "docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md"
Assert-Exists "docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md"
Assert-Exists "docs/architecture/WORKOS_CONTRACT_RULES.md"

$migrationFiles = Get-ChildItem "infra/db/migrations" -Filter "*.sql" -ErrorAction SilentlyContinue
if (-not $migrationFiles -or $migrationFiles.Count -lt 3) {
  Fail "Expected migration SQL files in infra/db/migrations/*.sql"
}

Assert-NoMatches @("apps", "services", "tests", "docs/product", "docs/ux") "scenarioFlows|data-task|data-scenario|taskView|objectView" "Old model terms must not reappear."
Assert-NoMatches @("apps", "services", "tests") "/api/hotel|/api/finance/confirm|/api/room/activate|ConfirmDeposit|HotelCheckin" "Page-specific write APIs are forbidden."
Assert-NoMatches @("apps", "services", "tests", "docs/product", "docs/ux") "direct write|page model|task model|object model" "Duplicate page/task/object model language is forbidden outside architecture rules."
Assert-NoMatches @("services/core-api/WorkOS.Api") "AllowAnyOrigin" "CORS must be restricted by configuration."

Assert-NoMatches @("apps/mobile/src/main.js") "fetch\s*\(" "main.js must not contain direct fetch calls; use apiClient.js."
Assert-NoMatches @("apps/mobile/src/main.js") "/api/" "main.js must not contain API paths; use apiClient.js."
Assert-NoMatches @("apps/mobile/src/main.js") "confirmCard" "main.js must not call confirmCard directly; use operationRuntime.js."
Assert-NoMatches @("apps/mobile/src/controls/fieldControls.js") "房型|上/下铺|押金|币种|付款方式|客户|车辆|技师|工位" "fieldControls.js must consume field.ui contract metadata, not infer business rules from labels."
Assert-NoMatches @("apps/mobile/src/views") "fetch|/api/" "View modules must not own API transport; use apiClient.js and operationRuntime.js."
Assert-NoMatches @("apps/mobile/src/i18n.js") "RoomCreated|BedCreated|DepositEvidenceSubmitted|FinanceDepositConfirmed|CheckInConfirmed" "i18n.js must not own event contracts or business runtime definitions."

Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs") "ai_confirmation_forbidden|role_confirmation_forbidden" "Role and AI confirmation policy denials must live in CardConfirmationPolicy."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs") "CardConfirmationPolicy|ProjectionTargets|ApplyEventToReadModel|PriorityFor|SearchText|SearchResult|RequiredRole" "Store classes must not own policy, projector, lens, or business contract rules."

$requiredSliceDirs = @(
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckOut",
  "services/core-api/WorkOS.Api/Slices/Finance/DepositException",
  "services/core-api/WorkOS.Api/Slices/Repair/Dispatch",
  "services/core-api/WorkOS.Api/Slices/Repair/Close"
)

foreach ($sliceDir in $requiredSliceDirs) {
  Assert-Exists "$sliceDir/README.md"
}

$requiredRuntimeServices = @(
  "services/core-api/WorkOS.Api/Runtime/RuntimeQueryService.cs",
  "services/core-api/WorkOS.Api/Runtime/LensQueryService.cs",
  "services/core-api/WorkOS.Api/Runtime/SearchProjectionService.cs",
  "services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs",
  "services/core-api/WorkOS.Api/Runtime/AuthSessionService.cs",
  "services/core-api/WorkOS.Api/Runtime/OutboxProjector.cs"
)

foreach ($runtimeService in $requiredRuntimeServices) {
  Assert-Exists $runtimeService
}

$requiredStorageServices = @(
  "services/core-api/WorkOS.Api/Runtime/PostgresConnectionFactory.cs",
  "services/core-api/WorkOS.Api/Runtime/PostgresMigrationRunner.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeDocumentStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeSessionStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeEventStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeOutboxStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeBehaviorEventStorage.cs"
)

foreach ($storageService in $requiredStorageServices) {
  Assert-Exists $storageService
}

$requiredContractCatalogs = @(
  "services/core-api/WorkOS.Api/Runtime/WorkspaceSeedCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/CardContractFactory.cs",
  "services/core-api/WorkOS.Api/Runtime/EvidenceContractCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/SystemCheckCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/EventContractCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/BlockerContractCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/ConfirmationPolicyCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/FieldContractCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/FieldUiContractCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/OptionSetRegistry.cs",
  "services/core-api/WorkOS.Api/Runtime/ContractText.cs"
)

foreach ($catalog in $requiredContractCatalogs) {
  Assert-Exists $catalog
}

$requiredFrontendCopyModules = @(
  "apps/mobile/src/i18n/shellCopy.js",
  "apps/mobile/src/i18n/demoCopy.js",
  "apps/mobile/src/i18n/coachCopy.js",
  "apps/mobile/src/i18n/operationCopy.js"
)

foreach ($copyModule in $requiredFrontendCopyModules) {
  Assert-Exists $copyModule
}

$requiredStyleModules = @(
  "apps/mobile/src/styles/base.css",
  "apps/mobile/src/styles/shell.css",
  "apps/mobile/src/styles/workspace.css",
  "apps/mobile/src/styles/coach.css",
  "apps/mobile/src/styles/operation.css",
  "apps/mobile/src/styles/responsive.css"
)

foreach ($styleModule in $requiredStyleModules) {
  Assert-Exists $styleModule
}

Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs") "ApplyEventToReadModel|SearchText|SearchResult|PriorityFor" "ProjectionRuntime must stay a facade; keep projector, search, and lens logic in focused services."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs") "insert into runtime_sessions|insert into audit_events|outbox_messages|schema_migrations|NpgsqlConnection" "PostgresProjectionStore must stay a storage facade; keep session, event, outbox, and migration details in focused storage helpers."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs") "EvidenceRequirement|SystemCheck|EventDefinition|FieldUi|OptionSet|TermRu|FieldId" "ProjectionSeed must stay a seed assembler; keep evidence, checks, events, field UI, option sets, and terms in focused catalogs."

Assert-MaxLines "apps/mobile/src/main.js" 250 "main.js must stay as a composition shell."
Assert-MaxLines "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs" 180 "ProjectionRuntime must stay as a backend facade."
Assert-MaxLines "services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs" 140 "PostgresProjectionStore must stay as a storage facade."
Assert-MaxLines "services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs" 80 "ProjectionSeed must stay as a seed assembler."
Assert-MaxLines "apps/mobile/src/controls/fieldControls.js" 80 "fieldControls.js must stay a small contract-metadata renderer."
Assert-MaxLines "apps/mobile/src/i18n.js" 80 "i18n.js must stay as an i18n composition manifest."
Assert-MaxLines "apps/mobile/src/styles.css" 40 "styles.css must stay as a style import manifest."

$program = Get-Content "services/core-api/WorkOS.Api/Program.cs" -Raw
$openApi = Get-Content "docs/contracts/workos-runtime.openapi.json" -Raw | ConvertFrom-Json
$requiredPaths = @(
  "/api/workspaces",
  "/api/workspaces/{workspaceId}/cards/{cardId}/prepare",
  "/api/workspaces/{workspaceId}/cards/{cardId}/confirm",
  "/api/observability/runtime"
)

foreach ($path in $requiredPaths) {
  if (-not $openApi.paths.PSObject.Properties.Name.Contains($path)) {
    Fail "OpenAPI contract missing path: $path"
  }
}

$requiredEndpointPatterns = @(
  'MapGet\("/api/workspaces"',
  'MapPost\("/api/workspaces/\{workspaceId\}/cards/\{cardId\}/prepare"',
  'MapPost\("/api/workspaces/\{workspaceId\}/cards/\{cardId\}/confirm"',
  'MapGet\("/api/observability/runtime"'
)

foreach ($pattern in $requiredEndpointPatterns) {
  if ($program -notmatch $pattern) {
    Fail "Minimal API endpoint missing or renamed without contract update: $pattern"
  }
}

node scripts/generate-contract-dtos.mjs --check

Write-Host "Architecture guard: PASS"
