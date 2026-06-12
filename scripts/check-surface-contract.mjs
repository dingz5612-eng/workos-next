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
    "userSemanticBoundaries",
    "collaborationFeedback",
    "mobile",
    "pc",
    "currentForbiddenWriteAdapter"
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
  for (const forbidden of ["page-private shell", "copied layout logic", "blocked Workspace/Card write path"]) {
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
  if (contract.currentForbiddenWriteAdapter?.adapterClass !== "deleted") {
    failures.push(v("surface.blocked_adapter", "Blocked Workspace/Card write adapter must stay deleted."));
  }
  const semantics = contract.userSemanticBoundaries || {};
  for (const field of [
    "visibleDoesNotImplyConfirm",
    "summaryDoesNotImplyConfirm",
    "receiptDoesNotImplyProduction",
    "blockerDoesNotGrantBypass",
    "dashboardSummaryCannotUnlockProduction",
    "sharedReceiptCannotReplaceFinanceTruth",
    "businessBasisDoesNotImplyFinancialTruth",
    "surfaceReadyDoesNotImplyProductionConfirm",
    "trustedConfirmDoesNotImplyProductionConfirm",
    "confirmAllowedDoesNotImplyProductionAllowed",
    "ordinaryUserNoInternalRuntimeTerms",
    "permissionExplainabilityUsesLanguageKernel"
  ]) {
    if (!(field in semantics)) failures.push(v("surface.user_semantic_boundary", `userSemanticBoundaries missing ${field}.`));
  }
  for (const token of ["oam.current", "Confirm Runtime", "Unit of Work", "DomainEvent", "LedgerEntry", "ProcessManager", "Projection", "Lens", "slice", "truthOwnerDomain", "admissionDecisionRef", "definitionId", "payloadHash", "commandSubmissionId", "rawReason", "rawCode"]) {
    if (!semantics.ordinaryUserNoInternalRuntimeTerms?.includes(token)) {
      failures.push(v("surface.internal_term_boundary", `ordinaryUserNoInternalRuntimeTerms missing ${token}.`));
    }
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
    if (forbidden === "prepareCard in normal confirm path") forbidText(operationRuntime, "prepareCard", "surface.no_prepare_card", "Operation runtime must not prepare blocked card paths.", failures);
    if (forbidden === "confirmCard in normal confirm path") forbidText(operationRuntime, "confirmCard", "surface.no_confirm_card", "Operation runtime must not confirm blocked card paths.", failures);
  }
  requireText(apiClient, "confirmOperationWorkItem", "surface.api_confirm", "API client must expose current confirm endpoint.", failures);
  requireText(operationRuntime, "confirmOperationWorkItem", "surface.runtime_confirm", "Operation runtime must use current confirm endpoint.", failures);
  requireText(operationView, "workspaceCardPanel", "surface.operation_panel_uses_shell", "Operation panel must route active work through the shared card shell.", failures);
  requireText(workspaceView, "data-component=\"operation-card-shell\"", "surface.operation_card_shell", "Workspace view must render the shared operation shell.", failures);
  forbidText(main, "fetch(", "surface.no_main_fetch", "main.js must not own direct fetch calls.", failures);
  requireText(readText("apps/mobile/src/views/experienceComponents.js"), "permissionDiagnosticCopy(decision, ctx.tr)", "surface.permission_language_kernel", "Permission diagnostics must use Language Kernel translation.", failures);
  for (const forbidden of ["写入 DomainEvent", "LedgerEntry 后", "ProcessManager 会", "运行时 Lens", "slice 状态不允许"]) {
    forbidText(readText("apps/mobile/src/i18n/operationCopy.js"), forbidden, "surface.ordinary_internal_copy", `Ordinary operation copy must not expose ${forbidden}.`, failures);
  }
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
