import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/surface/surface-contract.yml";

if (process.argv.includes("--self-test")) {
  const failures = validateContract({ version: "bad" });
  assert(failures.some((item) => item.id === "surface.missing"), "self-test must catch missing fields");
  assert(failures.some((item) => item.id === "surface.version"), "self-test must catch wrong version");
  console.log("Surface Contract self-test: PASS");
  process.exit(0);
}

const contract = readJson(contractPath);
const failures = [
  ...validateContract(contract),
  ...validateSourceBoundary(contract)
];

if (failures.length) {
  for (const item of failures) console.error(`${item.id}: ${item.message}`);
  throw new Error("Surface Contract check failed.");
}

console.log("Surface Contract check: PASS");

function validateContract(contract) {
  const failures = [];
  if (contract.version !== "oam.surface-contract.v1") failures.push(v("surface.version", `${contractPath} must use the current OAM surface version.`));
  for (const field of [
    "operationRuntimePure",
    "completedBusinessRecord",
    "currentSurfaceArchitecture",
    "frontendExperienceSystem",
    "stepDependencySurface",
    "admissionExplainabilitySurface",
    "collaborationFeedback",
    "mobile",
    "pc",
    "retiredWorkspaceCardWriteAdapter"
  ]) {
    if (!(field in contract)) failures.push(v("surface.missing", `${contractPath} missing ${field}.`));
  }
  for (const field of [
    "operationRuntimePure.persistedWorkItemResolutionOrder",
    "operationRuntimePure.forbiddenFallbackPaths",
    "mobile.allowedSurfaces",
    "mobile.forbiddenPcSurfaces",
    "pc.allowedSurfaces"
  ]) {
    const value = get(contract, field);
    if (!Array.isArray(value) || value.length < 4) failures.push(v("surface.array", `${field} must contain at least four entries.`));
  }

  const architecture = contract.currentSurfaceArchitecture || {};
  for (const required of ["shared shell", "shared route guard", "shared named experience components", "surface contract", "direct OperationCardShell on step pages"]) {
    if (!architecture.required?.includes(required)) failures.push(v("surface.architecture_required", `currentSurfaceArchitecture.required missing ${required}.`));
  }
  for (const forbidden of ["page-private shell", "copied layout logic", "retired Workspace/Card write UI flow"]) {
    if (!architecture.forbidden?.includes(forbidden)) failures.push(v("surface.architecture_forbidden", `currentSurfaceArchitecture.forbidden missing ${forbidden}.`));
  }

  const completed = contract.completedBusinessRecord || {};
  if (!String(completed.viewPath || "").includes("without an intermediate completed-operation page")) {
    failures.push(v("surface.completed_direct", "Completed records must open directly without an intermediate completed-operation page."));
  }
  if (!String(completed.correctionPath || "").includes("correctionMode=append_only")) {
    failures.push(v("surface.completed_append_only", "Completed record correction path must be append-only."));
  }
  if (!completed.actionOrder?.includes("correct_append_only_from_record")) {
    failures.push(v("surface.completed_action_order", "Completed record action order must include append-only correction."));
  }

  for (const layer of ["shared-components", "field-context-kernel", "surface-contract", "multilingual-dictionary", "state-action-contract", "real-browser-evidence"]) {
    if (!contract.frontendExperienceSystem?.layers?.includes(layer)) failures.push(v("surface.fes_layer", `frontendExperienceSystem.layers missing ${layer}.`));
  }

  for (const file of [contract.pc?.routeTree, contract.pc?.eventBinder, contract.pc?.apiModule, contract.pc?.dataHydrator].filter(Boolean)) {
    if (!fs.existsSync(path.join(root, file))) failures.push(v("surface.pc_file", `${file} is required by surface contract.`));
  }
  if (contract.retiredWorkspaceCardWriteAdapter?.adapterClass !== "deleted") {
    failures.push(v("surface.retired_adapter", "Retired Workspace/Card write adapter must stay deleted."));
  }
  return failures;
}

function validateSourceBoundary(contract) {
  const failures = [];
  const apiClient = readText("apps/mobile/src/apiClient.js");
  const operationRuntime = readText("apps/mobile/src/operationRuntime.js");
  const operationView = readText("apps/mobile/src/views/operationPanelView.js");
  const workspaceView = readText("apps/mobile/src/views/workspaceView.js");
  const main = readText("apps/mobile/src/main.js");

  for (const forbidden of contract.operationRuntimePure?.forbiddenFallbackPaths || []) {
    if (forbidden === "prepareCard in normal confirm path") forbidText(operationRuntime, "prepareCard", "surface.no_prepare_card", "Operation runtime must not prepare retired cards.", failures);
    if (forbidden === "confirmCard in normal confirm path") forbidText(operationRuntime, "confirmCard", "surface.no_confirm_card", "Operation runtime must not confirm retired cards.", failures);
  }
  requireText(apiClient, "confirmOperationWorkItem", "surface.api_confirm", "API client must expose current confirm endpoint.", failures);
  requireText(operationRuntime, "confirmOperationWorkItem", "surface.runtime_confirm", "Operation runtime must use current confirm endpoint.", failures);
  requireText(operationView, "workspaceCardPanel", "surface.operation_panel_uses_shell", "Operation panel must route active work through the shared card shell.", failures);
  requireText(workspaceView, "data-component=\"operation-card-shell\"", "surface.operation_card_shell", "Workspace view must render the shared operation shell.", failures);
  forbidText(main, "fetch(", "surface.no_main_fetch", "main.js must not own direct fetch calls.", failures);
  return failures;
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readText(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`Required file missing: ${file}`);
  return fs.readFileSync(full, "utf8");
}

function get(target, dotted) {
  return dotted.split(".").reduce((value, key) => value?.[key], target);
}

function requireText(source, needle, id, message, failures) {
  if (!source.includes(needle)) failures.push(v(id, message));
}

function forbidText(source, needle, id, message, failures) {
  if (source.includes(needle)) failures.push(v(id, message));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function v(id, message) {
  return { id, message };
}
