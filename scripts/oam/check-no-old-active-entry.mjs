import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/no-old-active-entry-result.json";
const failures = [];
const proofs = [];

const files = {
  appState: "apps/mobile/src/appState.js",
  projectionSeed: "services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs",
  apiProgram: "services/core-api/WorkOS.Api/Program.cs",
  activeWorkspacePolicy: "services/core-api/WorkOS.Api/Runtime/RuntimeActiveWorkspacePolicy.cs",
  projectionStateMigrator: "services/core-api/WorkOS.Api/Runtime/ProjectionStateMigrator.cs",
  runtimeQueryService: "services/core-api/WorkOS.Api/Runtime/RuntimeQueryService.cs",
  lensQueryService: "services/core-api/WorkOS.Api/Runtime/LensQueryService.cs",
  projectionRuntime: "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs",
  searchKernel: "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
  runtimeLensCatalog: "apps/mobile/src/runtimeLensCatalog.js",
  searchIntentHub: "apps/mobile/src/searchIntentHub.js",
  searchView: "apps/mobile/src/views/searchView.js",
  surfaceSelectors: "apps/mobile/src/selectors/surfaceSelectors.js",
  operationPanelView: "apps/mobile/src/views/operationPanelView.js",
  pcRouteTree: "apps/mobile/src/pcRouteTree.js",
  workspaceView: "apps/mobile/src/views/workspaceView.js",
  retirementLedger: "docs/oam/legacy-retirement-ledger.json",
  mainlineManifest: "docs/oam/dormitory-mainline-manifest.json",
  productionAuthority: "docs/business/domains/dormitory/dormitory-production-mainline-activation.authority.json"
};

for (const [label, file] of Object.entries(files)) {
  if (!fs.existsSync(abs(file))) fail(`${label} file missing: ${file}.`);
}

const appState = read(files.appState);
requireIncludes(appState, 'selectedTask: "T-DORM-MAINLINE"', "app default task is current dormitory mainline");
requireIncludes(appState, 'selectedWorkspace: "W-DORM-MAINLINE"', "app default workspace is current dormitory mainline");
forbid(appState, /selected(?:Task|Workspace):\s*["'](?:T|W)-STAY-[^"']+["']/, "appState must not default to old W-STAY/T-STAY entry.");

const projectionSeed = read(files.projectionSeed);
requireIncludes(projectionSeed, "AcceptedCapabilityRuntimeProjection.Workspace()", "runtime seed includes scenario 1 mainline workspace");
requireIncludes(projectionSeed, "DormitoryScenario2RuntimeProjection.Workspace()", "runtime seed includes scenario 2 mainline workspace");
forbid(projectionSeed, /WorkspaceSeedCatalog\.All\s*\(/, "ProjectionSeed must not publish legacy WorkspaceSeedCatalog.All() to current user surfaces.");

const apiProgram = read(files.apiProgram);
const templateBlock = blockAfter(apiProgram, "static string[] DormitoryTemplateWorkspaceIds()", 20);
requireIncludes(templateBlock, "AcceptedCapabilityRuntimeProjection.WorkspaceId", "API start allows scenario 1 mainline template only through current projection");
requireIncludes(templateBlock, "DormitoryScenario2RuntimeProjection.WorkspaceId", "API start allows scenario 2 mainline template through current projection");
forbid(templateBlock, /W-STAY-/i, "DormitoryTemplateWorkspaceIds must not allow old W-STAY templates.");

const activeWorkspacePolicy = read(files.activeWorkspacePolicy);
requireIncludes(activeWorkspacePolicy, "IsRetiredUserEntryWorkspaceId", "runtime has a single retired user-entry policy");
requireIncludes(activeWorkspacePolicy, 'StartsWith("W-STAY-"', "retired user-entry policy blocks W-STAY workspaces");
requireIncludes(activeWorkspacePolicy, 'Equals("Dormitory.FirstGoldenChain"', "retired user-entry policy blocks FirstGoldenChain workspace");

const projectionStateMigrator = read(files.projectionStateMigrator);
requireIncludes(projectionStateMigrator, "RuntimeActiveWorkspacePolicy.IsRetiredUserEntryWorkspaceId", "state migrator does not republish retired persisted workspaces");

const runtimeQueryService = read(files.runtimeQueryService);
requireIncludes(runtimeQueryService, "RuntimeActiveWorkspacePolicy.CurrentUserReachable(state.Workspaces)", "runtime envelope publishes only current user-reachable workspaces");
requireIncludes(runtimeQueryService, "FindUserReachableWorkspace", "runtime exposes a user-reachable workspace lookup for API reads");

const projectionRuntime = read(files.projectionRuntime);
requireIncludes(projectionRuntime, "FindUserReachableWorkspace", "ProjectionRuntime user-facing workspace lookup consumes active workspace policy");

const lensQueryService = read(files.lensQueryService);
requireIncludes(lensQueryService, "RuntimeActiveWorkspacePolicy.CurrentUserReachable(state.Workspaces)", "home/search/learning lenses consume active workspace policy");
requireIncludes(lensQueryService, "RuntimeActiveWorkspacePolicy.IsRetiredUserEntryWorkspaceId(item.TargetWorkspaceId)", "work queue filters retired target workspace ids");

const searchKernel = read(files.searchKernel);
requireIncludes(searchKernel, "AcceptedCapabilityRuntimeProjection.SearchCommands()", "search kernel consumes current scenario 1 projection commands");
requireIncludes(searchKernel, "DormitoryScenario2RuntimeProjection.SearchCommands()", "search kernel consumes current scenario 2 projection commands");
requireIncludes(searchKernel, "RuntimeActiveWorkspacePolicy.IsRetiredUserEntryWorkspaceId(ReadString(item, \"workspaceId\"))", "search kernel filters retired projection sources before admission wrapping");
forbid(searchKernel, /new\s+SearchCommand[^\n]*W-STAY-/i, "SearchKernelService must not hardcode start commands for old W-STAY workspaces.");

const runtimeLensCatalog = read(files.runtimeLensCatalog);
requireIncludes(runtimeLensCatalog, '"W-DORM-MAINLINE"', "lens catalog binds scenario 1 mainline workspace");
requireIncludes(runtimeLensCatalog, '"W-DORM-RESOURCE-OPERATION-STATUS"', "lens catalog binds scenario 2 mainline workspace");
forbid(runtimeLensCatalog, /workspaceLensIds\s*=\s*{[\s\S]*"W-STAY-/i, "runtimeLensCatalog workspaceLensIds must not bind old W-STAY workspaces.");

const searchIntentHub = read(files.searchIntentHub);
requireIncludes(searchIntentHub, "MAINLINE_ENTRY_ADMISSION_CONTRACT", "search intent consumes generated entry admission contract");
forbid(searchIntentHub, /templateWorkspaceId:\s*["']W-STAY-/i, "searchIntentHub must not create old W-STAY start actions.");

const searchView = read(files.searchView);
forbid(searchView, /data-start-operations-workspace="W-STAY-/i, "searchView must not render hardcoded old W-STAY start buttons.");
forbid(searchView, /templateWorkspaceId:\s*["']W-STAY-/i, "searchView must not inject old W-STAY templateWorkspaceId values.");

const operationPanelView = read(files.operationPanelView);
requireIncludes(operationPanelView, "DORMITORY_MAINLINE_WORKSPACE_ID", "operation panel fallback start uses generated mainline workspace id");
forbid(operationPanelView, /data-start-operations-workspace="W-STAY-/i, "operationPanelView must not offer old W-STAY fallback starts.");

const surfaceSelectors = read(files.surfaceSelectors);
requireIncludes(surfaceSelectors, "isOldWStaySearchEntry", "surface selectors quarantine explicit old W-STAY search entries");

const pcRouteTree = read(files.pcRouteTree);
requireIncludes(pcRouteTree, "managerControlTowerView", "pcManager compatibility alias routes to current manager control tower");
requireIncludes(pcRouteTree, "pcViews.pcManager = managerControlTowerView", "pcManager route alias is normalized to current control tower");
forbid(pcRouteTree, /checkoutServiceView|pcManagerLiteView/, "pcRouteTree must not route pcManager to retired checkout/service surface.");

const workspaceView = read(files.workspaceView);
requireIncludes(workspaceView, "isRetiredLegacyWorkspace", "workspace route detects retired W-STAY workspace ids");
requireIncludes(workspaceView, "retiredLegacyWorkspaceView", "workspace route renders retired W-STAY links as readonly archive");
requireIncludes(workspaceView, "data-legacy-archive-readonly", "legacy direct workspace links have readonly archive evidence marker");
forbid(workspaceView, /isRetiredLegacyWorkspace[\s\S]{0,800}data-submit-card/, "retired legacy workspace path must not render submit controls.");

const retirementLedger = read(files.retirementLedger);
requireIncludes(retirementLedger, '"legacy_readonly"', "retirement ledger classifies legacy readonly zones");
requireIncludes(retirementLedger, '"active_forbidden"', "retirement ledger classifies active forbidden zones");

const productionAuthority = read(files.productionAuthority);
requireIncludes(productionAuthority, '"legacySubmitMode"', "production mainline authority defines blocked legacy submit mode");
requireIncludes(productionAuthority, '"legacyOpenMode"', "production mainline authority defines legacy open mode");

const activeStartPatterns = [
  {
    file: files.appState,
    pattern: /selectedWorkspace:\s*["']W-STAY-/,
    message: "default selected workspace must not be legacy."
  },
  {
    file: files.searchKernel,
    pattern: /W-STAY-[A-Z0-9-]+[\s\S]{0,160}startOperationsWorkspace/i,
    message: "backend search must not expose legacy startOperationsWorkspace commands."
  },
  {
    file: files.pcRouteTree,
    pattern: /pcManagerLiteView|checkoutServiceView/,
    message: "PC route tree must not expose retired checkout manager."
  },
  {
    file: files.workspaceView,
    pattern: /isRetiredLegacyWorkspace\(item\)[\s\S]{0,240}OperationCardShell/,
    message: "retired legacy workspace must return before operation card shell."
  }
];

for (const item of activeStartPatterns) {
  const text = read(item.file);
  if (item.pattern.test(text)) fail(`${item.file}: ${item.message}`);
  else proofs.push({ file: item.file, check: item.message, status: "PASS" });
}

const result = {
  version: "oam.no-old-active-entry-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityRefs: [
    files.retirementLedger,
    files.mainlineManifest,
    files.productionAuthority
  ],
  oldUserEntryActiveAllowed: false,
  oldWorkspaceDirectOpenMode: "readonly_archive",
  oldTemplateStartAllowed: false,
  legacyCompatibilityCodeAllowedOnlyAs: [
    "legacy_readonly",
    "test_fixture",
    "historical_evidence",
    "generated_legacy_reference",
    "documentation_archive"
  ],
  proofCount: proofs.length,
  proofs,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("No old active entry check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`No old active entry check: PASS (${proofs.length} proofs, finalGoNoGo=NO_GO)`);

function read(file) {
  return fs.existsSync(abs(file)) ? fs.readFileSync(abs(file), "utf8") : "";
}

function abs(file) {
  return path.join(root, file);
}

function requireIncludes(text, needle, message) {
  if (text.includes(needle)) {
    proofs.push({ check: message, status: "PASS" });
  } else {
    fail(`${message}: expected ${JSON.stringify(needle)}.`);
  }
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) fail(message);
  else proofs.push({ check: message, status: "PASS" });
}

function blockAfter(text, marker, lineCount) {
  const index = text.indexOf(marker);
  if (index < 0) return "";
  return text.slice(index).split(/\r?\n/).slice(0, lineCount).join("\n");
}

function fail(message) {
  failures.push(message);
}
