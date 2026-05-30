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

function Assert-RipgrepAvailable {
  if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
    Fail "ripgrep (rg) is required for architecture guard checks."
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

function Warn-OverLines($path, $max, $message) {
  $lines = (Get-Content $path).Count
  if ($lines -gt $max) {
    Write-Warning "$message Current: $lines, warning threshold: $max, file: $path"
  }
}

function Assert-LineBudget($path, $warn, $fail, $message) {
  Warn-OverLines $path $warn "$message"
  Assert-MaxLines $path $fail "$message"
}

function Invoke-Checked($command, $arguments) {
  & $command @arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "$command failed: $($arguments -join ' ')"
  }
}

Assert-RipgrepAvailable

Assert-Exists "docs/contracts/projection-contract.schema.json"
Assert-Exists "docs/contracts/workos-runtime.openapi.json"
Assert-Exists "docs/contracts/slice-manifest.json"
Assert-Exists "docs/contracts/policy-contract.json"
Assert-Exists "docs/contracts/runtime-surface-policy.json"
Assert-Exists "docs/contracts/accommodation-lens-contract.json"
Assert-Exists "docs/contracts/legacy-ledger-migration-registry.json"
Assert-Exists "apps/mobile/src/generated/workosContracts.d.ts"
Assert-Exists "apps/mobile/src/generated/runtimeApiPaths.js"
Assert-Exists "apps/mobile/src/authController.js"
Assert-Exists "apps/mobile/src/navigationController.js"
Assert-Exists "apps/mobile/src/operationController.js"
Assert-Exists "apps/mobile/src/queueController.js"
Assert-Exists "apps/mobile/src/coachController.js"
Assert-Exists "docs/architecture/WORKOS_ENGINEERING_RULES.md"
Assert-Exists "docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md"
Assert-Exists "docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md"
Assert-Exists "docs/architecture/WORKOS_CONTRACT_RULES.md"
Assert-Exists "docs/architecture/WORKOS_SURFACE_RULES.md"
Assert-Exists "docs/architecture/WORKOS_ACCOMMODATION_RUNTIME_RULES.md"
Assert-Exists "docs/architecture/WORKOS_TESTING_RULES.md"
Assert-Exists "docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md"
Assert-Exists "docs/architecture/rules/index.json"
Assert-Exists "docs/architecture/architecture-exceptions.json"
Assert-Exists "docs/engineering/03-api-boundary-rules.md"
Assert-Exists "docs/engineering/13-release-control-plane-rules.md"
Assert-Exists "docs/engineering/15-no-go-rules.md"
Assert-Exists "docs/acceptance/12-release-go-no-go.md"
Assert-Exists "docs/v5.4/operations-api-allowlist.json"
Assert-Exists "docs/v5.4/release-manifest.schema.json"
Assert-Exists "docs/v5.4/release-manifest.fixture.json"
Assert-Exists "docs/v5.4/releases/mr-00-control-plane-bootstrap.json"
Assert-Exists "docs/v5.4/rollback/mr-00-rollback-instruction.json"
Assert-Exists "docs/v5.4/ci-control-plane.md"
Assert-Exists "docs/v5.4/control-plane-runners.md"
Assert-Exists "docs/v5.4/release-control-center.md"
Assert-Exists "docs/v5.4/invariant-definitions.json"
Assert-Exists "docs/v5.4/shadow-compare.config.json"
Assert-Exists "scripts/check-api-boundaries.mjs"
Assert-Exists "scripts/check-no-production-fake-fallback.mjs"
Assert-Exists "scripts/v5_4/run-control-plane-checks.ps1"
Assert-Exists "scripts/v5_4/control-plane-migration.mjs"
Assert-Exists "scripts/v5_4/shadow-namespace-isolation.mjs"
Assert-Exists "scripts/v5_4/invariant-runner.mjs"
Assert-Exists "scripts/v5_4/shadow-compare-runner.mjs"
Assert-Exists "scripts/v5_4/gate-runner.mjs"
Assert-Exists "scripts/v5_4/generate-release-manifest.mjs"
Assert-Exists "scripts/v5_4/release-manifest-validate.mjs"
Assert-Exists "tools/control-plane/WorkOS.ControlPlaneRunners/WorkOS.ControlPlaneRunners.csproj"
Assert-Exists "scripts/clean-baseline.ps1"
Assert-Exists "scripts/validate-slice-admission.mjs"
Assert-Exists "scripts/architecture-drift-report.mjs"
Assert-Exists "scripts/backfill-legacy-ledger-to-runtime.mjs"
Assert-Exists "tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj"
Assert-Exists "tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj"
Assert-Exists "apps/mobile/src/__tests__/operationRuntime.test.js"
Assert-Exists "apps/mobile/src/__tests__/htmlEscaping.test.js"
Assert-Exists "apps/mobile/src/__tests__/confirmErrorHandling.test.js"
Assert-Exists "apps/mobile/src/__tests__/surfaceSelectors.test.js"
Assert-Exists "apps/mobile/src/__tests__/evidenceInteraction.test.js"
Assert-Exists "apps/mobile/src/runtime/runtimeStore.js"
Assert-Exists "apps/mobile/src/selectors/surfaceSelectors.js"
Assert-Exists "apps/mobile/src/devFixtures/demoQueue.js"
Assert-Exists "apps/mobile/src/devFixtures/projectionMetadata.js"
Assert-Exists "apps/mobile/src/devFixtures/workspaceProjections.js"
Assert-Exists "apps/mobile/src/devFixtures/i18n/demoCopy.js"

$rulesIndex = Get-Content "docs/architecture/rules/index.json" -Raw | ConvertFrom-Json
$architectureExceptions = Get-Content "docs/architecture/architecture-exceptions.json" -Raw | ConvertFrom-Json
$ruleItems = @($rulesIndex.rules)
$exceptionItems = @($architectureExceptions.exceptions)

function Find-Rule($ruleId) {
  $rule = $ruleItems | Where-Object { $_.id -eq $ruleId } | Select-Object -First 1
  if (-not $rule) {
    Fail "Architecture exception references unknown ruleId: $ruleId"
  }
  return $rule
}

function Validate-ArchitectureExceptions {
  foreach ($exception in $exceptionItems) {
    foreach ($field in @("ruleId", "owner", "reason", "createdAt", "expiresAt", "removalCondition", "linkedTest")) {
      if (-not $exception.PSObject.Properties.Name.Contains($field) -or [string]::IsNullOrWhiteSpace([string]$exception.$field)) {
        Fail "Architecture exception is missing required field '$field'."
      }
    }

    $rule = Find-Rule $exception.ruleId
    if (-not [bool]$rule.exceptionAllowed) {
      Fail "Rule $($exception.ruleId) does not allow exceptions."
    }

    $expiresAt = [DateTimeOffset]::Parse([string]$exception.expiresAt)
    if ($expiresAt -lt [DateTimeOffset]::UtcNow) {
      Fail "Architecture exception expired for rule $($exception.ruleId): $($exception.reason)"
    }
  }
}

function Test-RuleExcepted($ruleId) {
  $match = $exceptionItems | Where-Object { $_.ruleId -eq $ruleId } | Select-Object -First 1
  if (-not $match) {
    return $false
  }
  $null = Find-Rule $ruleId
  Write-Warning "Architecture exception active for ${ruleId}: $($match.reason)"
  return $true
}

function Assert-NoMatchesRule($ruleId, $paths, $pattern, $message, $excludePattern = $null) {
  if (Test-RuleExcepted $ruleId) {
    return
  }
  Assert-NoMatches $paths $pattern $message $excludePattern
}

Validate-ArchitectureExceptions

$migrationFiles = Get-ChildItem "infra/db/migrations" -Filter "*.sql" -ErrorAction SilentlyContinue
if (-not $migrationFiles -or $migrationFiles.Count -lt 3) {
  Fail "Expected migration SQL files in infra/db/migrations/*.sql"
}

Assert-NoMatches @("apps", "services", "tests", "docs/product", "docs/ux") "scenarioFlows|data-task|data-scenario|taskView|objectView" "Old model terms must not reappear."
Assert-NoMatches @("apps", "services", "tests") "/api/hotel|/api/finance/confirm|/api/room/activate|ConfirmDeposit|HotelCheckin" "Page-specific write APIs are forbidden."
Assert-NoMatches @("services/core-api/WorkOS.Api") 'MapPost\("/api/(mobile/[^"]*/(confirm|refund|close)|payment/confirm|deposit/refund|checkout/close|bed/release|period/close)"' "Page-specific or Mobile BFF business write APIs are P0 No-Go; use Operations Confirm."
Assert-NoMatches @("apps", "services", "tests", "docs/product", "docs/ux") "direct write|page model|task model|object model" "Duplicate page/task/object model language is forbidden outside architecture rules."
Assert-NoMatches @("services/core-api/WorkOS.Api") "AllowAnyOrigin" "CORS must be restricted by configuration."

Assert-NoMatches @("apps/mobile/src/main.js") "fetch\s*\(" "main.js must not contain direct fetch calls; use apiClient.js."
Assert-NoMatches @("apps/mobile/src/main.js") "/api/" "main.js must not contain API paths; use apiClient.js."
Assert-NoMatches @("apps/mobile/src/main.js") "confirmCard" "main.js must not call confirmCard directly; use operationRuntime.js."
Assert-NoMatches @("apps/mobile/src/eventBinder.js") "loginActor|submitCardOperation|collectOperationValues|updateDerivedFields" "eventBinder.js must only bind top-level events; use focused controllers for auth, operations, and derived fields."
Assert-NoMatches @("apps/mobile/src/controls/fieldControls.js") "房型|上/下铺|押金|币种|付款方式|客户|车辆|技师|工位" "fieldControls.js must consume field.ui contract metadata, not infer business rules from labels."
Assert-NoMatches @("apps/mobile/src/views") "fetch|/api/" "View modules must not own API transport; use apiClient.js and operationRuntime.js."
Assert-NoMatches @("apps/mobile/src/i18n.js") "RoomCreated|BedCreated|DepositEvidenceSubmitted|FinanceDepositConfirmed|CheckInConfirmed" "i18n.js must not own event contracts or business runtime definitions."
Assert-NoMatches @("apps/mobile/src/i18n.js") "depositTask|repairTask|stayObject|repairObject|Flow|流程|闭环|押金|住宿单|维修" "i18n.js must not own demo business objects or process copy; use focused i18n modules or projection/i18n contracts."
Assert-NoMatchesRule "WON16-FRONTEND-001" @("apps/mobile/src/operationRuntime.js") "workspaceId.*cardId.*actor\.actorId|actor\.actorId.*workspaceId" "operationRuntime must use a submit-level UUID idempotencyKey, not a workspace/card/actor composite."
Assert-NoMatches @("apps/mobile/src/views") 'from "../demoQueue\.js"|from "./demoQueue\.js"' "Runtime surface views must not import demoQueue."
Assert-NoMatches @("apps/mobile/src/views/homeView.js") 'W-STAY-[A-Z-]+|W-REPAIR-[A-Z-]+' "Home must not hardcode business workspace focus IDs."
Assert-NoMatches @("apps/mobile/src/views/workbenchView.js", "apps/mobile/src/selectors/queueSelectors.js") "demoQueue|taskWorkspaceMap|workspaceIdForTask" "Workbench online queue must not use demoQueue or task-to-workspace inference."
Assert-NoMatches @("apps/mobile/src/selectors/searchSelectors.js") "W-STAY-CHECKIN|W-STAY-DEPOSIT-EXCEPTION|W-STAY-CHECKOUT|W-REPAIR-REQUEST|W-REPAIR-DISPATCH|W-REPAIR-MASTER-DATA" "Search fallback must not route intents to deprecated workspace IDs."
Assert-NoMatches @("apps/mobile/src") "taskWorkspaceMap|workspaceIdForTask" "Frontend must not infer workspaceId from taskId."
Assert-NoMatches @("apps/mobile/src/selectors/workspaceSelectors.js") "W-STAY-CHECKIN|W-STAY-DEPOSIT-LEDGER|W-STAY-PAYMENT-LEDGER|W-STAY-CHECKOUT-SETTLEMENT|W-REPAIR-" "Workspace selector must open runtimeStore workspaces without business workspace fallback IDs."
Assert-NoMatches @("apps/mobile/src/selectors/surfaceSelectors.js") "intentBoost|W-STAY-DEPOSIT-LEDGER|W-STAY-PAYMENT-LEDGER|priority.*workspace\.domain" "Surface selectors must not contain local Accommodation business priority exceptions."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/LensQueryService.cs") "W-STAY-DEPOSIT-LEDGER|W-STAY-PAYMENT-LEDGER|W-STAY-CHECKIN" "Runtime surface lenses must derive visibility and ranking from runtime-surface-policy.json."
$workspaceProjectionFixture = Get-Content "apps/mobile/src/devFixtures/workspaceProjections.js" -Raw
if ($workspaceProjectionFixture -notmatch "Dev/test fixture only") {
  Fail "workspaceProjections.js must declare its dev/test fixture boundary."
}
$mainRuntime = Get-Content "apps/mobile/src/main.js" -Raw
if ($mainRuntime -notmatch "escapeHtml\(tr\(state, key\)\)" -or
    $mainRuntime -notmatch "escapeHtml\(tx\(state, value\)\)" -or
    $mainRuntime -notmatch "escapeHtml\(localTerm\(state, value, lang\)\)") {
  Fail "Frontend projection and localized text helpers must escape HTML before view interpolation."
}
Assert-NoMatches @("apps/mobile/src/views") "\$\{[^}]*state\.query|\$\{[^}]*learningQuery|\$\{[^}]*loginMessage|\$\{[^}]*operationMessage|\$\{[^}]*currentActor\?\.displayName|\$\{[^}]*currentActor\?\.role" "View modules must escape user/session text before HTML interpolation." "escapeHtml|escapeAttr|ctx\.state\.query \?"

Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime") "ai_confirmation_forbidden|role_confirmation_forbidden" "Role and AI confirmation policy denials must live outside Runtime in Slices/Policies/CardConfirmationPolicy." "ConfirmHttpStatusMapper\.cs"
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs") "CardConfirmationPolicy|ProjectionTargets|ApplyEventToReadModel|PriorityFor|SearchText|SearchResult|RequiredRole" "Store classes must not own policy, projector, lens, or business contract rules."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs") "card\.Events\.First\s*\(" "ActionRuntimeService must use EventSelectionPolicy and must never take only the first declared event."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs") 'field\.Label|Label\["zh-CN"\]' "ActionRuntimeService must reject localized label payload keys instead of deriving facts from labels."
Assert-NoMatches @("services", "tests") "Events\.First\s*\(" "Confirm event dispatch must use EventSelectionPolicy and must never take only the first declared event."
Assert-NoMatches @("services/core-api/WorkOS.Api/Slices", "services/core-api/WorkOS.Api/Runtime") 'Payload\.TryGetValue\("' "Runtime policy and storage must read canonical field ids through RuntimeFieldAliases, not label literals."
Assert-NoMatchesRule "WON16-CONTRACT-001" @("services/core-api/WorkOS.Api/Slices", "services/core-api/WorkOS.Api/Runtime") 'RuntimeFieldAliases\.CanonicalKey\("[^"]*\p{Han}|Value\(workspaceEvent,\s*"[^"]*\p{Han}|DecimalValue\(workspaceEvent,\s*"[^"]*\p{Han}|IntValue\(workspaceEvent,\s*"[^"]*\p{Han}|DateValue\(workspaceEvent,\s*"[^"]*\p{Han}' "Runtime policy and persistence must not use localized labels as business fact keys."
Assert-NoMatches @("services/core-api/WorkOS.Api/Slices", "services/core-api/WorkOS.Api/Runtime") '"张三"|"A301"|"PAY-2026-009"|"DEP-2026-009"|"\+996 555 010101"' "Production runtime and persistence must not use fake demo defaults." "OptionSetRegistry\.cs"
Assert-NoMatches @("services/core-api/WorkOS.Api/Slices") '"unknown-|3000m|9300m|stay-order-current' "Production persistence must not use fake unknown ids or demo amount defaults."
Assert-NoMatches @("services/core-api/WorkOS.Api") "RuntimeAuthOptions\.Development" "Development auth defaults must not be referenced outside Program.cs and RuntimeAuthOptions.cs." "Program\.cs|RuntimeAuthOptions\.cs"
Assert-NoMatches @("services/core-api/WorkOS.Api/Slices/Accommodation/CheckOutSettlement") "DepositRefundPaid|DepositDeducted|DepositAppliedToBalance|deposit_transactions" "CheckOutSettlement must not own deposit transaction facts."
Assert-NoMatches @("services/core-api/WorkOS.Api/Slices/Accommodation/ServiceTask") "accommodation_beds|UpdateBedStatus|actual_cost_amount = excluded|DecimalValue\(workspaceEvent, `"实际成本`"" "ServiceTask must not directly mutate BedStatus or persist cost facts."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs") "actual_cost_amount" "Service task lenses must not expose service task cost as a fact source; use ExpenseLedger."
Assert-NoMatches @("services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn", "services/core-api/WorkOS.Api/Slices/Persistence/SliceAggregateStorage.cs") "deposit_transactions|payment_allocations|stay_balances" "Legacy CheckIn must not write new DepositLedger/PaymentLedger fact tables."
Assert-NoMatches @("services/core-api/WorkOS.Api") "GetPendingOutboxMessages" "Outbox workers must claim messages before processing; direct pending reads are forbidden."

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
  "services/core-api/WorkOS.Api/Runtime/OutboxProjector.cs",
  "services/core-api/WorkOS.Api/Runtime/EventSelectionPolicy.cs",
  "services/core-api/WorkOS.Api/Runtime/ConfirmHttpStatusMapper.cs",
  "services/core-api/WorkOS.Api/Runtime/ConfirmUnitOfWork.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeDbSession.cs",
  "services/core-api/WorkOS.Api/Runtime/ProjectionStateMigrator.cs"
)

foreach ($runtimeService in $requiredRuntimeServices) {
  Assert-Exists $runtimeService
}

Assert-Exists "services/core-api/WorkOS.Api/Slices/Policies/CardConfirmationPolicy.cs"
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime") "class CardConfirmationPolicy" "CardConfirmationPolicy must not live under Runtime."
Assert-Exists "infra/db/migrations/012_outbox_claim_dead_letter.sql"

$requiredStorageServices = @(
  "services/core-api/WorkOS.Api/Runtime/PostgresConnectionFactory.cs",
  "services/core-api/WorkOS.Api/Runtime/PostgresMigrationRunner.cs",
  "services/core-api/WorkOS.Api/Runtime/ControlPlaneReadStore.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeDocumentStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeSessionStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeEventStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeAccommodationLedgerStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeOutboxStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeBehaviorEventStorage.cs"
)

foreach ($storageService in $requiredStorageServices) {
  Assert-Exists $storageService
}

Assert-Exists "apps/mobile/src/views/releaseControlView.js"

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
  "apps/mobile/src/i18n/domainCopy.js",
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

$requiredMigratedSliceModules = @(
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/ResourceSetupSlice.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/Aggregates/ResourceSetupAggregates.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/Commands/ResourceSetupCommands.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/Events/ResourceSetupEvents.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/Policies/ResourceSetupPolicy.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/ProjectorRules/ResourceSetupProjectorRules.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/Tests/ResourceSetupSliceTests.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn/CheckInSlice.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn/Aggregates/CheckInAggregates.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn/Commands/CheckInCommands.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn/Events/CheckInEvents.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn/Policies/CheckInPolicy.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn/ProjectorRules/CheckInProjectorRules.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/CheckIn/Tests/CheckInSliceTests.cs"
)

foreach ($sliceModule in $requiredMigratedSliceModules) {
  Assert-Exists $sliceModule
}

Assert-Exists "services/core-api/WorkOS.Api/Slices/Repair/Dispatch/Aggregates/RepairDispatchAggregates.cs"
Assert-Exists "services/core-api/WorkOS.Api/Slices/Persistence/SliceAggregateStorage.cs"
Assert-Exists "infra/db/migrations/005_slice_aggregate_roots.sql"

Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs") "ApplyEventToReadModel|SearchText|SearchResult|PriorityFor|select |insert into|update |delete from|schema_migrations|Migration|FieldUi|OptionSet|UiMetadata" "ProjectionRuntime must stay a facade; keep projector, search, SQL, migrations, and UI metadata in focused services."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs") "insert into runtime_sessions|insert into audit_events|outbox_messages|schema_migrations|NpgsqlConnection" "PostgresProjectionStore must stay a storage facade; keep session, event, outbox, and migration details in focused storage helpers."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs") "RequiredRole|ForbiddenForAi|BlockerRule|EventDefinition|FieldUi|OptionSet|ConfirmationPolicy|ProjectionTargets|ApplyEventToReadModel|PriorityFor|SearchText|SearchResult" "PostgresProjectionStore must not own business rules, projection rules, policy rules, lens ranking, or UI metadata."
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs") "EvidenceRequirement|SystemCheck|EventDefinition|FieldUi|OptionSet|TermRu|FieldId" "ProjectionSeed must stay a seed assembler; keep evidence, checks, events, field UI, option sets, and terms in focused catalogs."

Assert-LineBudget "apps/mobile/src/main.js" 800 800 "main.js must stay under the transition budget while moving toward a tiny composition shell."
Assert-LineBudget "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs" 350 450 "ProjectionRuntime.cs exceeded the facade budget."
Assert-LineBudget "services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs" 300 400 "PostgresProjectionStore.cs exceeded the composed-store budget."
Assert-LineBudget "services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs" 400 500 "ProjectionSeed.cs exceeded the seed-assembler budget."

Assert-MaxLines "apps/mobile/src/main.js" 250 "main.js must stay as a composition shell."
Assert-MaxLines "apps/mobile/src/eventBinder.js" 120 "eventBinder.js must stay as a top-level event binding shell."
Assert-MaxLines "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs" 180 "ProjectionRuntime must stay as a backend facade."
Assert-MaxLines "services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs" 140 "PostgresProjectionStore must stay as a storage facade."
Assert-MaxLines "services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs" 80 "ProjectionSeed must stay as a seed assembler."
Assert-MaxLines "apps/mobile/src/controls/fieldControls.js" 80 "fieldControls.js must stay a small contract-metadata renderer."
Assert-MaxLines "apps/mobile/src/i18n.js" 80 "i18n.js must stay as an i18n composition manifest."
Assert-MaxLines "apps/mobile/src/styles.css" 40 "styles.css must stay as a style import manifest."

$program = Get-Content "services/core-api/WorkOS.Api/Program.cs" -Raw
$endpointExtensionFiles = @(Get-ChildItem "services/core-api/WorkOS.Api" -Recurse -File -Filter "*Endpoints.cs")
$minimalApiSource = (@($program) + @($endpointExtensionFiles | ForEach-Object { Get-Content $_.FullName -Raw })) -join "`n"
$openApi = Get-Content "docs/contracts/workos-runtime.openapi.json" -Raw | ConvertFrom-Json
$requiredPaths = @(
  "/health",
  "/api/auth/login",
  "/api/workspaces",
  "/api/workspaces/{workspaceId}",
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
  'MapGet\("/health"',
  'MapPost\("/api/auth/login"',
  'MapGet\("/api/workspaces"',
  'MapGet\("/api/workspaces/\{workspaceId\}"',
  'MapPost\("/api/workspaces/\{workspaceId\}/cards/\{cardId\}/prepare"',
  'MapPost\("/api/workspaces/\{workspaceId\}/cards/\{cardId\}/confirm"',
  'MapGet\("/api/observability/runtime"'
)

foreach ($pattern in $requiredEndpointPatterns) {
  if ($minimalApiSource -notmatch $pattern) {
    Fail "Minimal API endpoint missing or renamed without contract update: $pattern"
  }
}

$allowedMapPostPaths = @(
  "/api/auth/login",
  "/api/auth/sessions/{token}/revoke",
  "/api/device-sessions",
  "/api/device-sessions/{deviceId}/revoke",
  "/api/operations/cases",
  "/api/operations/work-items",
  "/api/operations/work-items/{workItemId}/prepare",
  "/api/operations/work-items/{workItemId}/confirm",
  "/api/workspaces/{workspaceId}/cards/{cardId}/prepare",
  "/api/workspaces/{workspaceId}/cards/{cardId}/confirm",
  "/api/evidence/drafts",
  "/api/evidence/{evidenceId}/attachments",
  "/api/evidence/{evidenceId}/verify",
  "/api/evidence/{evidenceId}/reject",
  "/api/reconciliation/bank-statement-imports/preview",
  "/api/reconciliation/bank-statement-imports",
  "/api/reconciliation/match-candidates/generate",
  "/api/reconciliation/mismatches/detect",
  "/api/reconciliation/match-candidates/{candidateId}/accept",
  "/api/reconciliation/match-candidates/{candidateId}/reject",
  "/api/reconciliation/bank-transactions/{bankTransactionId}/mismatch",
  "/api/reconciliation/bank-transactions/{bankTransactionId}/ignore",
  "/api/correction-center/ledger-correction-requests",
  "/api/correction-center/ledger-correction-requests/{correctionRequestId}/approve",
  "/api/correction-center/ledger-correction-requests/{correctionRequestId}/reject",
  "/api/correction-center/ledger-correction-requests/{correctionRequestId}/apply",
  "/api/pc-governance/exports/{exportType}",
  "/api/projections/process-outbox",
  "/api/behavior-events"
)

$allowedMapGetPaths = @(
  "/",
  "/health",
  "/api/bootstrap",
  "/api/operations/cases/{caseId}",
  "/api/operations/work-items",
  "/api/operations/work-items/{workItemId}",
  "/api/workspaces",
  "/api/workspaces/{workspaceId}",
  "/api/work-queue",
  "/api/search",
  "/api/lenses/home-surface",
  "/api/lenses/work-queue",
  "/api/lenses/search",
  "/api/lenses/learning-catalog",
  "/api/lenses/accommodation/{lensId}",
  "/api/control-plane/releases",
  "/api/control-plane/releases/{releaseId}",
  "/api/control-plane/gate-results/{gateResultId}",
  "/api/control-plane/shadow-compare-reports/{id}",
  "/api/control-plane/invariant-checks",
  "/api/control-plane/rollback-instructions/{id}",
  "/api/evidence",
  "/api/evidence/{evidenceId}/signed-url",
  "/api/reconciliation/match-candidates",
  "/api/workspaces/{workspaceId}/events",
  "/api/audit-events",
  "/api/outbox",
  "/api/behavior-events",
  "/api/observability/runtime"
)

$openApiPaths = @($openApi.paths.PSObject.Properties.Name)
$mapGetMatches = [regex]::Matches($minimalApiSource, 'MapGet\("([^"]+)"')
foreach ($match in $mapGetMatches) {
  $path = $match.Groups[1].Value
  if (-not $allowedMapGetPaths.Contains($path)) {
    Fail "MapGet endpoint is not in the architecture allowlist: $path"
  }
  if ($path.StartsWith("/api/") -and -not $openApiPaths.Contains($path)) {
    Fail "OpenAPI contract missing MapGet path: $path"
  }
}

$mapPostMatches = [regex]::Matches($minimalApiSource, 'MapPost\("([^"]+)"')
foreach ($match in $mapPostMatches) {
  $path = $match.Groups[1].Value
  if (-not $allowedMapPostPaths.Contains($path)) {
    Fail "MapPost endpoint is not in the architecture allowlist: $path"
  }
  if ($path.StartsWith("/api/") -and -not $openApiPaths.Contains($path)) {
    Fail "OpenAPI contract missing MapPost path: $path"
  }
}

$minimalApiPaths = @($mapGetMatches | ForEach-Object { $_.Groups[1].Value }) + @($mapPostMatches | ForEach-Object { $_.Groups[1].Value })
foreach ($path in $openApiPaths) {
  if (($path.StartsWith("/api/") -or $path -eq "/health") -and -not $minimalApiPaths.Contains($path)) {
    Fail "OpenAPI path has no matching Minimal API endpoint: $path"
  }
}

Invoke-Checked "node" @("scripts/generate-contract-dtos.mjs", "--check")
Invoke-Checked "node" @("scripts/validate-slice-admission.mjs")
Invoke-Checked "node" @("scripts/architecture-drift-report.mjs")
Invoke-Checked "node" @("scripts/validate-runtime-api.mjs")
Invoke-Checked "node" @("scripts/check-api-boundaries.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-api-boundaries.mjs")
Invoke-Checked "node" @("scripts/check-no-production-fake-fallback.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-no-production-fake-fallback.mjs")

$ci = Get-Content ".github/workflows/ci.yml" -Raw
$v54Ci = Get-Content ".github/workflows/v5_4_control_plane.yml" -Raw
if ($ci -notmatch "validate-runtime-api\.mjs") {
  Fail "CI must run validate-runtime-api.mjs explicitly."
}
if ($ci -notmatch "check-api-boundaries\.mjs") {
  Fail "CI must run check-api-boundaries.mjs explicitly."
}
if ($ci -notmatch "check-no-production-fake-fallback\.mjs") {
  Fail "CI must run check-no-production-fake-fallback.mjs explicitly."
}
foreach ($requiredV54Guard in @(
  "architecture-guard",
  "api-boundary-check",
  "control-plane-migration",
  "shadow-namespace-isolation",
  "invariant-runner",
  "shadow-compare-runner",
  "gate-runner",
  "generate-release-manifest",
  "release-manifest-validate"
)) {
  if ($v54Ci -notmatch [regex]::Escape($requiredV54Guard)) {
    Fail "V5.4 control plane CI must run guard: $requiredV54Guard"
  }
}
foreach ($requiredCiCommand in @("validate-slice-admission.mjs", "architecture-drift-report.mjs")) {
  if ($ci -notmatch [regex]::Escape($requiredCiCommand)) {
    Fail "CI must run governance command: $requiredCiCommand"
  }
}
foreach ($requiredCiCommand in @("npm --prefix apps/mobile run test", "WorkOS.UnitTests", "WorkOS.RuntimeIntegrationTests")) {
  if ($ci -notmatch [regex]::Escape($requiredCiCommand)) {
    Fail "CI must run testing-pyramid command: $requiredCiCommand"
  }
}
if ($ci -notmatch "workosnext_test" -and $ci -notmatch "TEST_DATABASE") {
  Fail "CI runtime tests must use a _test database or TEST_DATABASE=true."
}

$runtimeContractTests = Get-Content "tests/WorkOS.RuntimeContractTests/Program.cs" -Raw
if ($runtimeContractTests -notmatch "AssertTestDatabaseAllowed" -or $runtimeContractTests -notmatch "TEST_DATABASE" -or $runtimeContractTests -notmatch "_test") {
  Fail "Runtime contract tests must refuse destructive reset unless database name contains _test or TEST_DATABASE=true."
}
if ($runtimeContractTests -notmatch "AssertCanonicalFieldKeys") {
  Fail "Runtime contract tests must reject localized label payload keys and use canonical field ids."
}

$currentRuntimeArchitecture = Get-Content "docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md" -Raw
if ($currentRuntimeArchitecture -match "ProjectionStateMigrator` is not implemented") {
  Fail "CURRENT_RUNTIME_ARCHITECTURE.md must not claim ProjectionStateMigrator is unimplemented after WON-16 hardening."
}

$operationRuntime = Get-Content "apps/mobile/src/operationRuntime.js" -Raw
if ($operationRuntime -notmatch "randomUUID") {
  Fail "Frontend submit idempotency keys must include a submit-level UUID."
}
if ($operationRuntime -notmatch "evidenceIds") {
  Fail "Frontend confirm submissions must pass evidenceIds."
}
if ($operationRuntime -match '\$\{workspace\.id\}:\$\{card\.id\}:\$\{card\.status') {
  Fail "cardInstanceId must not be derived from workspaceId/cardId/status."
}

$runtimeApiPaths = Get-Content "apps/mobile/src/generated/runtimeApiPaths.js" -Raw
$requiredRuntimeApiPathKeys = @(
  "health",
  "login",
  "workspaces",
  "workspace",
  "bootstrap",
  "prepareCard",
  "confirmCard",
  "workQueue",
  "search",
  "lensWorkQueue",
  "lensSearch",
  "homeSurface",
  "learningCatalog",
  "accommodationLens",
  "controlPlaneReleases",
  "controlPlaneRelease",
  "controlPlaneGateResult",
  "controlPlaneShadowCompareReport",
  "controlPlaneInvariantChecks",
  "controlPlaneRollbackInstruction",
  "evidence",
  "evidenceDrafts",
  "evidenceAttachments",
  "evidenceVerify",
  "evidenceReject",
  "workspaceEvents",
  "auditEvents",
  "outbox",
  "processOutbox",
  "behaviorEvents",
  "observability"
)
foreach ($runtimeApiPathKey in $requiredRuntimeApiPathKeys) {
  if ($runtimeApiPaths -notmatch "${runtimeApiPathKey}\s*:") {
    Fail "generated runtimeApiPaths.js missing OpenAPI runtime path key: $runtimeApiPathKey"
  }
}

$depositPolicy = Get-Content "services/core-api/WorkOS.Api/Slices/Accommodation/DepositLedger/Policies/DepositLedgerPolicy.cs" -Raw
if ($depositPolicy -notmatch "GetDepositLedgerState") {
  Fail "DepositLedger policy must read backend deposit ledger state."
}

$paymentPolicy = Get-Content "services/core-api/WorkOS.Api/Slices/Accommodation/PaymentLedger/Policies/PaymentLedgerPolicy.cs" -Raw
if ($paymentPolicy -notmatch "GetPaymentLedgerState") {
  Fail "PaymentLedger policy must read backend payment ledger state."
}

$ownershipCatalog = Get-Content "services/core-api/WorkOS.Api/Runtime/AccommodationFactOwnershipCatalog.cs" -Raw
foreach ($ownership in @(
  '"Deposit"] = "Accommodation.DepositLedger"',
  '"Payment"] = "Accommodation.PaymentLedger"',
  '"StayBalance"] = "Accommodation.PaymentLedger"',
  '"BedStatus"] = "Accommodation.ResourceSetup"',
  '"Expense"] = "Accommodation.ExpenseLedger"',
  '"PeriodSnapshot"] = "Accommodation.PeriodAnalytics"'
)) {
  if ($ownershipCatalog -notmatch [regex]::Escape($ownership)) {
    Fail "Accommodation fact ownership catalog missing: $ownership"
  }
}

$aggregateLenses = Get-Content "services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs" -Raw
foreach ($requiredLens in @("BedInventoryLens", "DepositLiabilityLens", "StayBalanceLens", "PaymentRiskLens", "CheckoutQueueLens", "ServiceTaskQueueLens", "RiskCommandLens")) {
  if ($aggregateLenses -notmatch $requiredLens) {
    Fail "Accommodation Lens implementation missing: $requiredLens"
  }
}

$periodAnalyticsStorage = Get-Content "services/core-api/WorkOS.Api/Slices/Accommodation/PeriodAnalytics/Persistence/PeriodAnalyticsStorage.cs" -Raw
if ($periodAnalyticsStorage -notmatch "snapshot_frozen" -or $periodAnalyticsStorage -notmatch "on conflict\(period_id\) do nothing" -or $periodAnalyticsStorage -notmatch "period_late_adjustments") {
  Fail "PeriodAnalytics must freeze snapshots and append late adjustments."
}
if ($periodAnalyticsStorage -match 'DecimalValue\(workspaceEvent,\s*"(rentRevenue|otherRevenue|confirmedPaymentAmount|pendingPaymentAmount|depositReceivedAmount|depositRefundedAmount|depositDeductedAmount|depositAppliedToBalanceAmount|approvedExpenseAmount|pendingExpenseAmount|endingDebtAmount|financeExceptionCount)"') {
  Fail "PeriodAnalytics finance snapshot must query backend ledger state, not final finance totals from confirm payload."
}

$optionSetRegistry = Get-Content "services/core-api/WorkOS.Api/Runtime/OptionSetRegistry.cs" -Raw
if ($optionSetRegistry -notmatch "DefaultValue\(string label\) => string\.Empty") {
  Fail "Production-slice field contracts must not ship fake user input default values."
}
if ($optionSetRegistry -match 'DEP-2026|PAY-2026|APP-2026|LEAD-2026|RES-2026|STAY-2026|DREC-2026|CHG-2026|TASK-2026|EXP-2026|PER-2026|张三|A301') {
  Fail "Production OptionSetRegistry must not ship fake candidate ids or demo names."
}

foreach ($policyPath in @(
  "services/core-api/WorkOS.Api/Slices/Accommodation/DepositLedger/Policies/DepositLedgerPolicy.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/PaymentLedger/Policies/PaymentLedgerPolicy.cs",
  "services/core-api/WorkOS.Api/Slices/Accommodation/ExpenseLedger/Policies/ExpenseLedgerPolicy.cs"
)) {
  $policySource = Get-Content $policyPath -Raw
  if ($policySource -match 'EvidenceIds.*Count\s*(==|>|>=)') {
    Fail "Production ledger policy must validate evidence objects, not only EvidenceIds.Count: $policyPath"
  }
}

$runtimeEvidenceStorage = Get-Content "services/core-api/WorkOS.Api/Runtime/RuntimeEvidenceStorage.cs" -Raw
foreach ($requiredEvidenceTerm in @("evidence_objects", "evidence_attachments", "evidence_requirements", "ValidateForConfirm", "MarkUsed")) {
  if ($runtimeEvidenceStorage -notmatch [regex]::Escape($requiredEvidenceTerm)) {
    Fail "Evidence object runtime missing required term: $requiredEvidenceTerm"
  }
}

$runtimeCardInstanceStorage = Get-Content "services/core-api/WorkOS.Api/Runtime/RuntimeCardInstanceStorage.cs" -Raw
foreach ($requiredCardInstanceTerm in @("card_instances", "prepared", "submitted", "confirmed", "aggregate_ref")) {
  if ($runtimeCardInstanceStorage -notmatch [regex]::Escape($requiredCardInstanceTerm)) {
    Fail "CardInstance runtime missing required term: $requiredCardInstanceTerm"
  }
}

$sliceAggregateStorage = Get-Content "services/core-api/WorkOS.Api/Slices/Persistence/SliceAggregateStorage.cs" -Raw
foreach ($forbiddenLegacyWrite in @("UpsertDepositLiability(DepositLiabilityFrom", "UpsertHostelPayment(HostelPaymentFrom", "UpsertFinanceReconciliation(FinanceReconciliationFrom", "UpsertFinanceConfirmation(FinanceConfirmationFrom", "UpsertDeposit(DepositFrom")) {
  if ($sliceAggregateStorage -match [regex]::Escape($forbiddenLegacyWrite)) {
    Fail "Legacy CheckIn must not write new ledger authoritative facts: $forbiddenLegacyWrite"
  }
}

$outboxStorage = Get-Content "services/core-api/WorkOS.Api/Runtime/RuntimeOutboxStorage.cs" -Raw
foreach ($requiredOutboxTerm in @("for update skip locked", "dead_lettered_at_utc", "attempt_count", "ClaimPending", "MarkFailed")) {
  if ($outboxStorage -notmatch [regex]::Escape($requiredOutboxTerm)) {
    Fail "Outbox storage must implement claim/dead-letter behavior: $requiredOutboxTerm"
  }
}
foreach ($requiredOutboxTerm in @("attempt_count", "claimed_by", "last_error")) {
  if ($outboxStorage -notmatch [regex]::Escape($requiredOutboxTerm)) {
    Fail "Outbox storage must expose the WON-16 outbox contract field: $requiredOutboxTerm"
  }
}
Assert-NoMatches @("services/core-api/WorkOS.Api/Runtime", "infra/db/migrations/012_outbox_claim_dead_letter.sql") "retry_count" "Outbox runtime and claim migration must use attempt_count, not retry_count."

$openApiRaw = Get-Content "docs/contracts/workos-runtime.openapi.json" -Raw
if ($openApiRaw -match '"workspaceId".*BehaviorEventRequest' -or $openApiRaw -match '"cardId".*BehaviorEventRequest') {
  Fail "BehaviorEventRequest OpenAPI schema must match Program.cs and must not contain stale workspace/card fields."
}

Write-Host "Architecture guard: PASS"
exit 0
