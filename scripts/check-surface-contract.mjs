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
  for (const field of ["version", "operationRuntimePure", "completedBusinessRecord", "activeSurfaceArchitecture", "frontendExperienceSystem", "collaborationFeedback", "mobile", "pc", "retiredWorkspaceCardWriteAdapter"]) {
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
  if (!contract.completedBusinessRecord?.viewPath || !contract.completedBusinessRecord?.correctionPath) {
    violations.push(violation("surface_contract.completed_record_paths", "Completed business records must declare readonly view and append-only correction paths."));
  }
  if (!String(contract.completedBusinessRecord?.viewPath || "").includes("without an intermediate completed-operation page")) {
    violations.push(violation("surface_contract.completed_record_direct_view", "Completed business records must declare direct readonly view without an intermediate completed-operation page."));
  }
  if (!String(contract.completedBusinessRecord?.surfaceShell || "").includes("OperationStepRail") ||
      !String(contract.completedBusinessRecord?.surfaceShell || "").includes("OperationCardShell") ||
      !String(contract.completedBusinessRecord?.surfaceShell || "").includes("card-operation")) {
    violations.push(violation("surface_contract.completed_record_surface_shell", "Completed business records must declare the shared Operations shell, OperationStepRail, and card-operation readonly state."));
  }
  if (!String(contract.completedBusinessRecord?.forbiddenShell || "").includes("page-private legacy detail shell") ||
      !String(contract.completedBusinessRecord?.forbiddenShell || "").includes("page-private outer intent-card wrapper") ||
      !String(contract.completedBusinessRecord?.forbiddenShell || "").includes("workspace-control completed-record-control visual wrapper") ||
      !String(contract.completedBusinessRecord?.forbiddenShell || "").includes("intermediate completed-operation page") ||
      !String(contract.completedBusinessRecord?.forbiddenShell || "").includes("completed-record-detail")) {
    violations.push(violation("surface_contract.completed_record_forbidden_shell", "Completed business records must forbid page-private legacy detail shells and old completed-record-detail grids."));
  }
  const requiredActionOrder = ["create_active_work_item", "view_readonly_completed_record", "correct_append_only_from_record"];
  if (!Array.isArray(contract.completedBusinessRecord?.actionOrder) ||
      requiredActionOrder.some((item, index) => contract.completedBusinessRecord.actionOrder[index] !== item)) {
    violations.push(violation("surface_contract.completed_record_action_order", "Completed business records must enforce create -> readonly view -> append-only correction."));
  }
  if (!String(contract.completedBusinessRecord?.correctionEntry || "").includes("readonly completed record")) {
    violations.push(violation("surface_contract.completed_record_correction_entry", "Correction entry must be declared as readonly completed record only."));
  }
  if (!Array.isArray(contract.completedBusinessRecord?.dataSources) || !contract.completedBusinessRecord.dataSources.some((item) => String(item).includes("OperationsWorkItemConfirmed"))) {
    violations.push(violation("surface_contract.completed_record_data_sources", "Completed business records must declare OperationsWorkItemConfirmed as a display data source."));
  }
  if (!String(contract.completedBusinessRecord?.correctionPath || "").includes("correctionMode=append_only")) {
    violations.push(violation("surface_contract.completed_record_correction_append_only", "Completed business record correction path must use correctionMode=append_only."));
  }
  const activeSurface = contract.activeSurfaceArchitecture || {};
  if (!String(activeSurface.architecture || "").includes("OAM-ACF v8") || !String(activeSurface.architecture || "").includes("Operations Runtime")) {
    violations.push(violation("surface_contract.active_surface_architecture_axis", "Active surface architecture must be OAM-ACF v8 / Operations Runtime."));
  }
  for (const required of ["shared shell", "shared route guard", "shared named experience components", "surface contract", "direct OperationCardShell on step pages"]) {
    if (!Array.isArray(activeSurface.required) || !activeSurface.required.includes(required)) {
      violations.push(violation("surface_contract.active_surface_required", `activeSurfaceArchitecture.required missing ${required}.`, { required }));
    }
  }
  for (const forbidden of ["page-private legacy shell", "intent-card operation wrapper", "copied layout logic", "old completed-record-detail grid", "retired Workspace/Card write UI flow"]) {
    if (!Array.isArray(activeSurface.forbidden) || !activeSurface.forbidden.includes(forbidden)) {
      violations.push(violation("surface_contract.active_surface_forbidden", `activeSurfaceArchitecture.forbidden missing ${forbidden}.`, { forbidden }));
    }
  }
  if (!String(activeSurface.repair || "").includes("rewrite non-current architecture") || !String(activeSurface.repair || "").includes("delete obsolete implementation")) {
    violations.push(violation("surface_contract.active_surface_repair", "activeSurfaceArchitecture.repair must require rewrite of non-current architecture and obsolete implementation deletion."));
  }
  const frontendExperience = contract.frontendExperienceSystem || {};
  if (frontendExperience.contractRef !== "docs/contracts/frontend-experience/frontend-experience-system-contract.json") {
    violations.push(violation("surface_contract.frontend_experience_contract_ref", "frontendExperienceSystem must reference the FES contract."));
  }
  for (const layer of ["shared-components", "surface-contract", "multilingual-dictionary", "state-action-contract", "real-browser-screenshot-evidence"]) {
    if (!Array.isArray(frontendExperience.layers) || !frontendExperience.layers.includes(layer)) {
      violations.push(violation("surface_contract.frontend_experience_layer", `frontendExperienceSystem.layers missing ${layer}.`, { layer }));
    }
  }
  if (!String(frontendExperience.rule || "").includes("but not architecture") ||
      !String(frontendExperience.rule || "").includes("rewritten and deleted")) {
    violations.push(violation("surface_contract.frontend_experience_rule", "frontendExperienceSystem must forbid architecture variance and require rewrite/delete of old surfaces."));
  }
  const stepPageParity = String(frontendExperience.stepPageExperienceParity || "");
  for (const term of ["new active", "readonly completed", "append-only correction", "OperationCardShell", "page-private outer intent-card wrapper", "workspace-control visual wrapper", "state/check panel", "decision markers"]) {
    if (!stepPageParity.includes(term)) {
      violations.push(violation("surface_contract.step_page_experience_parity", `frontendExperienceSystem.stepPageExperienceParity missing ${term}.`, { term }));
    }
  }
  const postSubmitNavigation = String(frontendExperience.postSubmitNavigation || "");
  for (const term of ["auto-advance to the next actionable persisted WorkItem", "not the normal submit continuation path"]) {
    if (!postSubmitNavigation.includes(term)) {
      violations.push(violation("surface_contract.post_submit_navigation", `frontendExperienceSystem.postSubmitNavigation missing ${term}.`, { term }));
    }
  }
  const stepStateVisualLanguage = String(frontendExperience.stepStateVisualLanguage || "");
  for (const term of ["completed green", "ready blue", "terminal completed records remain completed as the primary state", "muted indigo", "not ordinary ready blue", "in-progress amber", "not-started neutral gray", "blocked red", "current-step ring", "instead of harsh saturated blocks"]) {
    if (!stepStateVisualLanguage.includes(term)) {
      violations.push(violation("surface_contract.step_state_visual_language", `frontendExperienceSystem.stepStateVisualLanguage missing ${term}.`, { term }));
    }
  }
  if (contract.collaborationFeedback?.surface !== "feedback-message-channel") {
    violations.push(violation("surface_contract.feedback_surface", "Collaboration feedback must declare feedback-message-channel surface."));
  }
  if (!String(contract.collaborationFeedback?.entry || "").includes("right-bottom safe floating")) {
    violations.push(violation("surface_contract.feedback_entry", "Collaboration feedback entry must be right-bottom safe floating."));
  }
  if (!String(contract.collaborationFeedback?.eventPath || "").includes("/api/mobile/client-events")) {
    violations.push(violation("surface_contract.feedback_event_path", "Collaboration feedback must record runtime event through /api/mobile/client-events until dedicated inbox storage exists."));
  }
  if (!String(contract.collaborationFeedback?.forbiddenPath || "").includes("Operations Confirm")) {
    violations.push(violation("surface_contract.feedback_forbidden_confirm", "Collaboration feedback must not use Operations Confirm."));
  }
  if (!String(contract.collaborationFeedback?.forbiddenPath || "").includes("save/submit business action row")) {
    violations.push(violation("surface_contract.feedback_forbidden_action_row", "Collaboration feedback must not be placed inside save/submit business action rows."));
  }
  if (!String(contract.collaborationFeedback?.forbiddenPath || "").includes("duplicate local feedback buttons")) {
    violations.push(violation("surface_contract.feedback_duplicate_local_entry_rule", "Collaboration feedback must forbid duplicate local feedback buttons when the shell entry exists."));
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
  const workspace = readSource("apps/mobile/src/views/workspaceView.js");
  const workspaceStyles = readSource("apps/mobile/src/styles/workspace.css");
  const operationStyles = readSource("apps/mobile/src/styles/operation.css");
  const shell = readSource("apps/mobile/src/appShell.js");
  const feedbackView = readSource("apps/mobile/src/views/feedbackView.js");
  const feedbackController = readSource("apps/mobile/src/feedbackController.js");

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
  if (!operationRuntime.includes("persisted_work_item_required")) {
    violations.push(violation("surface_contract.persisted_work_item_block_missing", "submitWorkItemOperation must block missing persisted ids."));
  }
  for (const token of ["allowCompatibilityFallback", "submitCardOperationCompatibilityFallback", "prepareCard", "confirmCard"]) {
    if (operationRuntime.includes(token)) {
      violations.push(violation("surface_contract.mobile_runtime_compatibility_fallback", `operationRuntime.js must not carry ${token}.`, { token }));
    }
  }
  if (!operationController.includes("persistedWorkItemIdFor(ctx.state, item, card)")) {
    violations.push(violation("surface_contract.confirm_selected_persisted_id", "submitCurrentCard must pass selected persisted WorkItem id into submitWorkItemOperation."));
  }
  if (!operationController.includes("postSubmitAutoAdvanceTarget") ||
      !operationController.includes("refreshPostSubmitWorkItems") ||
      !operationController.includes("applyPostSubmitAutoAdvance") ||
      !operationController.includes("autoAdvancedToWorkItemId") ||
      !operationController.includes("syncUrlFromState(ctx)")) {
    violations.push(violation("surface_contract.post_submit_auto_advance_missing", "Successful active submits must auto-advance to the next actionable persisted WorkItem and sync the URL."));
  }
  if (workspace.includes("returnCurrentWorkItem")) {
    violations.push(violation("surface_contract.return_current_work_retired", "Readonly completed records must not use returnCurrentWorkItem as a normal continuation fallback."));
  }
  if (!operationPanel.includes("completedWorkspaceRecord") ||
      !operationPanel.includes("isTerminalCardStatus(activeCard.status)") ||
      !workspace.includes("data-correction-work-item")) {
    violations.push(violation("surface_contract.completed_record_actions_missing", "Completed operation routes must render the readonly workspace record directly and keep append-only correction on the readonly record."));
  }
  const completedWorkspaceRoute = workspace.includes('data-surface="completed-workspace-route"') || workspace.includes('surface: "completed-workspace-route"');
  if (!completedWorkspaceRoute ||
      !workspace.includes("completed-record-control") ||
      !workspace.includes("completed-record-operation") ||
      !workspace.includes("OperationCardShell") ||
      !workspace.includes('data-component="operation-card-shell"')) {
    violations.push(violation("surface_contract.completed_record_shared_shell_missing", "Completed workspace records must reuse the shared operation step rail and card-operation readonly shell."));
  }
  if (workspace.includes("completed-record-intent") ||
      workspace.includes('data-component="CompletedRecordDetail"') ||
      workspace.includes('<article class="intent-card expanded completed-record-intent">')) {
    violations.push(violation("surface_contract.completed_record_double_container", "Readonly completed surfaces must not keep a page-private intent-card wrapper outside card-operation."));
  }
  if (workspace.includes('<article class="intent-card') || operationStyles.includes(".intent-card")) {
    violations.push(violation("surface_contract.intent_card_wrapper_retired", "Step pages must not keep the retired intent-card operation wrapper."));
  }
  if (workspace.includes('class="workspace-control completed-record-control"')) {
    violations.push(violation("surface_contract.completed_record_workspace_control_wrapper", "Readonly completed records must not keep the workspace-control visual wrapper."));
  }
  for (const [file, source] of Object.entries({
    "apps/mobile/src/views/workspaceView.js": workspace,
    "apps/mobile/src/views/operationPanelView.js": operationPanel,
    "apps/mobile/src/eventBinder.js": eventBinder,
    "apps/mobile/src/styles/workspace.css": workspaceStyles,
    "apps/mobile/src/styles/operation.css": operationStyles
  })) {
    for (const token of ["completed-record-detail", "completed-step-list", "completed-step-button", "completed-record-grid", "completed-record-hero", "completed-record-section", "completed-operation-record", "data-view-completed-record", "intent-card"]) {
      if (source.includes(token)) {
        violations.push(violation("surface_contract.retired_surface_shell_token", `${file} must not contain retired surface shell token ${token}.`, { file, token }));
      }
    }
  }
  if (!eventBinder.includes("startCompletedStepCorrection")) {
    violations.push(violation("surface_contract.completed_record_correction_handler_missing", "Completed record correction must be handled through Operations Runtime WorkItem creation."));
  }
  if (!operationController.includes("enrichCorrectionFieldValues") || !operationController.includes("correctionMode")) {
    violations.push(violation("surface_contract.completed_record_correction_marker_missing", "Correction submissions must carry correctionMode through Operations Confirm."));
  }
  if (!components.includes("runtimeItem?.workItemId") || !components.includes("persistedCandidate")) {
    violations.push(violation("surface_contract.trusted_sheet_persisted_model", "TrustedConfirmSheet/WorkItemCard model must prefer persisted runtime WorkItem ids over card workItemId."));
  }
  if (!shell.includes("feedback-fab") || !feedbackView.includes('data-surface="feedback-message-channel"')) {
    violations.push(violation("surface_contract.feedback_channel_missing", "Feedback must be a message channel, not a placeholder-only support page."));
  }
  if (workspace.includes('data-view="feedback"')) {
    violations.push(violation("surface_contract.feedback_duplicate_local_entry", "Workspace surfaces must not render duplicate local feedback buttons when shell feedback exists."));
  }
  if (!workspace.includes('data-surface="readonly-state-summary"') ||
      !workspace.includes('class="primary-action ready" data-work-item-id')) {
    violations.push(violation("surface_contract.readonly_step_parity", "Readonly completed surfaces must share status/check panel and primary action hierarchy with active step pages."));
  }
  if (!components.includes("data-step-state") || !components.includes("data-current-step") || !components.includes("data-step-marker") || !components.includes("stepVisualState") || !components.includes("isCorrectionStep") || !components.includes("isTerminalCorrectionStep") || !components.includes("completedWithCorrectionStatus")) {
    violations.push(violation("surface_contract.step_state_markers", "OperationStepRail must expose step state and correction markers for browser evidence and shared styling."));
  }
  for (const token of ["[data-step-state=\"completed\"]", "[data-step-state=\"ready\"]", "[data-step-state=\"correction\"]", "[data-step-state=\"in-progress\"]", "[data-step-state=\"not-started\"]", "[data-step-state=\"blocked\"]", "#2e7d5b", "#2f73b8", "#6b6f9f", "#b7791f", "#8a97a6", "#c24135", "--step-accent", "--step-bg", "--step-ring", "::before", "data-step-marker"]) {
    if (!workspaceStyles.includes(token)) {
      violations.push(violation("surface_contract.step_state_style_token", `workspace.css missing semantic step-state token ${token}.`, { token }));
    }
  }
  if (!feedbackController.includes("recordMobileClientEvent") || feedbackController.includes("confirmOperationWorkItem")) {
    violations.push(violation("surface_contract.feedback_wrong_write_path", "Feedback must record collaboration events without using Operations Confirm."));
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
