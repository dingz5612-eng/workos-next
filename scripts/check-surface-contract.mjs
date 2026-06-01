import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

if (process.argv.includes("--self-test")) {
  const violations = validateContract({ version: "bad" });
  assert(violations.some((item) => item.id === "surface_contract.missing_field"), "self-test must catch missing fields");
  console.log("Surface Contract self-test: PASS");
  process.exit(0);
}

const contractPath = "docs/surface/surface-contract.yml";
const schemaPath = "schemas/surface-contract.schema.json";
const contract = readJson(contractPath);
const violations = [
  ...validateContract(contract),
  ...validateSourceBoundary(contract)
];

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Surface Contract check failed.");
}

console.log("Surface Contract check: PASS");

function validateContract(contract) {
  const violations = [];
  if (!fs.existsSync(path.join(root, schemaPath))) {
    violations.push(violation("surface_contract.schema_missing", `${schemaPath} is required.`));
  }
  for (const field of ["version", "operationRuntimePure", "mobile", "pc", "compatibilityAdapter"]) {
    if (!(field in contract)) {
      violations.push(violation("surface_contract.missing_field", `${contractPath} missing ${field}.`, { field }));
    }
  }
  for (const [field, minimum] of [
    ["operationRuntimePure.persistedWorkItemResolutionOrder", 4],
    ["operationRuntimePure.forbiddenFallbackPaths", 4],
    ["mobile.allowedSurfaces", 4],
    ["mobile.forbiddenPcSurfaces", 4],
    ["pc.allowedSurfaces", 4]
  ]) {
    const value = get(contract, field);
    if (!Array.isArray(value) || value.length < minimum) {
      violations.push(violation("surface_contract.array_contract", `${field} must contain at least ${minimum} entries.`, { field }));
    }
  }
  for (const file of [contract.pc?.routeTree, contract.pc?.eventBinder, contract.pc?.apiModule, contract.pc?.dataHydrator].filter(Boolean)) {
    if (!fs.existsSync(path.join(root, file))) {
      violations.push(violation("surface_contract.pc_file_missing", `${file} is required by surface contract.`, { file }));
    }
  }
  return violations;
}

function validateSourceBoundary(contract) {
  const violations = [];
  const apiClient = readSource("apps/mobile/src/apiClient.js");
  const pcApiClient = readSource("apps/mobile/src/pcApiClient.js");
  const main = readSource("apps/mobile/src/main.js");
  const appRouter = readSource("apps/mobile/src/appRouter.js");
  const eventBinder = readSource("apps/mobile/src/eventBinder.js");
  const operationPanel = readSource("apps/mobile/src/views/operationPanelView.js");
  const operationRuntime = readSource("apps/mobile/src/operationRuntime.js");
  const operationController = readSource("apps/mobile/src/operationController.js");
  const components = readSource("apps/mobile/src/views/experienceComponents.js");

  for (const token of contract.mobile?.forbiddenPcApiTokens || []) {
    if (apiClient.includes(token)) {
      violations.push(violation("surface_contract.mobile_api_pc_token", `apiClient.js must not contain PC/control-plane token ${token}.`, { token }));
    }
  }
  for (const token of ["fetchReleaseControlCenter", "fetchProductionObservability", "previewBankStatementImport", "confirmBankStatementImport"]) {
    if (apiClient.includes(token)) {
      violations.push(violation("surface_contract.mobile_api_pc_function", `apiClient.js must not export ${token}.`, { token }));
    }
  }
  for (const token of ["fetchReleaseControlCenter", "fetchProductionObservability"]) {
    if (main.includes(token)) {
      violations.push(violation("surface_contract.mobile_startup_pc_fetch", `main.js ordinary hydration must not call ${token}.`, { token }));
    }
  }
  if (!main.includes("isPcSurfaceView(state.view)") || !main.includes('import("./pcSurfaceData.js")')) {
    violations.push(violation("surface_contract.pc_lazy_hydration", "PC data hydration must be lazy and gated by isPcSurfaceView(state.view)."));
  }
  for (const token of ["financeReconciliationView", "pcGovernanceView", "releaseControlView"]) {
    if (appRouter.includes(token)) {
      violations.push(violation("surface_contract.mobile_router_pc_view_import", `appRouter.js must route PC surfaces through pcRouteTree, not import ${token}.`, { token }));
    }
  }
  for (const token of ["financeReconciliationController", "pcGovernanceController"]) {
    if (eventBinder.includes(token)) {
      violations.push(violation("surface_contract.mobile_event_pc_import", `eventBinder.js must lazy-load pcEventBinder instead of importing ${token}.`, { token }));
    }
  }
  if (operationPanel.includes("ctx.workspace()")) {
    violations.push(violation("surface_contract.operation_panel_workspace_fallback", "OperationPanelView must not rebuild runtime identity from ctx.workspace()."));
  }
  if (!operationPanel.includes("operation_work_item_required") || !operationPanel.includes("state.selectedWorkItemId = persistedWorkItemId")) {
    violations.push(violation("surface_contract.operation_panel_runtime_resolution", "OperationPanelView must normalize legacy selected ids to persisted WorkItem ids or block."));
  }
  if (!operationRuntime.includes("allowCompatibilityFallback = false") || !operationRuntime.includes("persisted_work_item_required")) {
    violations.push(violation("surface_contract.compatibility_not_blocked", "submitWorkItemOperation must block missing persisted ids unless compatibility fallback is explicitly enabled."));
  }
  if (!operationController.includes("persistedWorkItemIdFor(ctx.state, item, card)")) {
    violations.push(violation("surface_contract.confirm_selected_persisted_id", "submitCurrentCard must pass selected persisted WorkItem id into submitWorkItemOperation."));
  }
  if (!components.includes("runtimeItem?.workItemId") || !components.includes("persistedCandidate")) {
    violations.push(violation("surface_contract.trusted_sheet_persisted_model", "TrustedConfirmSheet/WorkItemCard model must prefer persisted runtime WorkItem ids over card workItemId."));
  }
  if (!pcApiClient.includes("postPcOperationsConfirm") || !pcApiClient.includes("X-WorkOS-Operation-Confirm")) {
    violations.push(violation("surface_contract.pc_confirm_header_missing", "pcApiClient.js must keep PC correction/reconciliation behind Operations Confirm headers."));
  }
  return violations;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function get(object, pathExpression) {
  return pathExpression.split(".").reduce((current, key) => current?.[key], object);
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
