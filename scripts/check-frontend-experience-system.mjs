import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/contracts/frontend-experience/frontend-experience-system-contract.json";
const contract = readJson(contractPath);
const violations = [
  ...validateContract(),
  ...validateSourceBindings(),
  ...validateSystemRefs()
];

writeReport(violations);

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Frontend Experience System check failed.");
}

console.log("Frontend Experience System check: PASS");

function validateContract() {
  const errors = [];
  if (contract.version !== "frontend-experience-system.v1") {
    errors.push(v("fes.version", "Frontend Experience System contract version must be frontend-experience-system.v1."));
  }
  if (!String(contract.architecture || "").includes("OAM-ACF v8") ||
      !String(contract.architecture || "").includes("Operations Runtime")) {
    errors.push(v("fes.architecture", "Frontend Experience System must bind to OAM-ACF v8 / Operations Runtime."));
  }
  const layers = new Map((contract.layers || []).map((layer) => [layer.id, layer]));
  for (const layerId of [
    "shared-components",
    "surface-contract",
    "multilingual-dictionary",
    "state-action-contract",
    "real-browser-screenshot-evidence"
  ]) {
    if (!layers.has(layerId)) errors.push(v("fes.layer_missing", `Missing Frontend Experience System layer: ${layerId}.`, { layerId }));
  }
  for (const layer of contract.layers || []) {
    for (const ref of layer.contractRefs || []) {
      if (!exists(ref)) errors.push(v("fes.contract_ref_missing", `${layer.id} references missing file ${ref}.`, { layer: layer.id, ref }));
    }
    for (const script of layer.machineChecks || []) {
      if (!exists(script)) errors.push(v("fes.machine_check_missing", `${layer.id} references missing machine check ${script}.`, { layer: layer.id, script }));
    }
  }
  for (const forbidden of [
    "page-specific architecture",
    "old compatibility fallback",
    "component copy-paste instead of reuse",
    "visible copy outside the multilingual dictionary",
    "duplicate local feedback action when the shared shell feedback entry exists",
    "user-facing fix without real browser screenshot evidence"
  ]) {
    if (!Array.isArray(contract.globalForbidden) || !contract.globalForbidden.includes(forbidden)) {
      errors.push(v("fes.global_forbidden_missing", `globalForbidden missing ${forbidden}.`, { forbidden }));
    }
  }
  if (!String(contract.repairRule || "").includes("rewrite") ||
      !String(contract.repairRule || "").includes("delete the obsolete implementation")) {
    errors.push(v("fes.repair_rule", "Repair rule must require rewrite onto FES and obsolete implementation deletion."));
  }
  const parity = contract.stepPageExperienceParity || {};
  for (const mode of ["new-active-step", "readonly-completed-step", "append-only-correction-step"]) {
    if (!Array.isArray(parity.modes) || !parity.modes.includes(mode)) {
      errors.push(v("fes.step_page_parity_mode", `stepPageExperienceParity.modes missing ${mode}.`, { mode }));
    }
  }
  for (const required of ["OperationStepRail", "card-operation shell", "no page-private outer intent-card wrapper", "no workspace-control visual wrapper on readonly completed records", "no redundant object summary block on readonly completed records", "state or validation summary panel", "operation-actions", "single shared shell feedback entry", "machine-readable admission and runtime decisions"]) {
    if (!Array.isArray(parity.requiredSharedStructure) || !parity.requiredSharedStructure.includes(required)) {
      errors.push(v("fes.step_page_parity_structure", `stepPageExperienceParity.requiredSharedStructure missing ${required}.`, { required }));
    }
  }
  if (!String(parity.rule || "").includes("Users must not have to enumerate every page one by one")) {
    errors.push(v("fes.step_page_parity_rule", "Step-page parity rule must say users should not enumerate pages one by one."));
  }
  const visualLanguage = contract.stepStateVisualLanguage || {};
  if (visualLanguage.sourceComponent !== "OperationStepRail") {
    errors.push(v("fes.step_state_source", "Step state visual language must be owned by OperationStepRail."));
  }
  for (const [state, color] of Object.entries({
    completed: "green",
    ready: "blue",
    correction: "muted-indigo",
    "in-progress": "amber",
    "not-started": "neutral-gray",
    blocked: "red"
  })) {
    if (visualLanguage.requiredStates?.[state] !== color) {
      errors.push(v("fes.step_state_color", `Step state ${state} must be ${color}.`, { state, color }));
    }
  }
  for (const marker of ["data-step-state", "data-current-step", "aria-current"]) {
    if (!Array.isArray(visualLanguage.requiredMarkers) || !visualLanguage.requiredMarkers.includes(marker)) {
      errors.push(v("fes.step_state_marker", `stepStateVisualLanguage.requiredMarkers missing ${marker}.`, { marker }));
    }
  }
  if (!String(visualLanguage.visualTreatment || "").includes("subtle background tint") ||
      !String(visualLanguage.visualTreatment || "").includes("thin semantic top bar") ||
      !String(visualLanguage.visualTreatment || "").includes("numbered badge")) {
    errors.push(v("fes.step_state_visual_treatment", "Step state visual treatment must avoid harsh color blocks."));
  }
  if (!String(visualLanguage.rule || "").includes("Terminal completed records remain completed as the primary state") ||
      !String(visualLanguage.rule || "").includes("only the active append-only correction WorkItem displays correction as the primary state")) {
    errors.push(v("fes.step_state_terminal_correction_rule", "Step state rule must prevent completed readonly records from being relabeled as correction."));
  }
  const postSubmit = contract.postSubmitNavigation || {};
  if (!String(postSubmit.rule || "").includes("auto-advance to the next actionable persisted WorkItem") ||
      !String(postSubmit.rule || "").includes("users must not have to click return current work after every submit")) {
    errors.push(v("fes.post_submit_navigation_rule", "Post-submit navigation must auto-advance instead of forcing a readonly detour."));
  }
  for (const marker of ["autoAdvanced", "autoAdvancedToWorkItemId", "autoAdvancedToCardId"]) {
    if (!Array.isArray(postSubmit.requiredMarkers) || !postSubmit.requiredMarkers.includes(marker)) {
      errors.push(v("fes.post_submit_navigation_marker", `postSubmitNavigation.requiredMarkers missing ${marker}.`, { marker }));
    }
  }
  return errors;
}

function validateSourceBindings() {
  const errors = [];
  const components = read("apps/mobile/src/views/experienceComponents.js");
  const workspace = read("apps/mobile/src/views/workspaceView.js");
  const operationPanel = read("apps/mobile/src/views/operationPanelView.js");
  const operationController = read("apps/mobile/src/operationController.js");
  const eventBinder = read("apps/mobile/src/eventBinder.js");
  const workspaceStyles = read("apps/mobile/src/styles/workspace.css");
  const operationStyles = read("apps/mobile/src/styles/operation.css");
  const experienceComponents = components;
  const operationCopy = read("apps/mobile/src/i18n/operationCopy.js");
  const shellCopy = read("apps/mobile/src/i18n/shellCopy.js");
  const domainCopy = read("apps/mobile/src/i18n/domainCopy.js");
  const experience = readJson("docs/business/experience-contract.yml");
  const surface = readJson("docs/surface/surface-contract.yml");

  const sharedLayer = (contract.layers || []).find((layer) => layer.id === "shared-components") || {};
  for (const component of sharedLayer.requiredComponents || []) {
    const source = ["completedWorkspaceRecord", "OperationCardShell"].includes(component) ? workspace : components;
    if (!source.includes(`function ${component}`) && !source.includes(`export function ${component}`) && !source.includes(`const ${component}`)) {
      errors.push(v("fes.component_missing", `Required shared component missing: ${component}.`, { component }));
    }
  }

  for (const [file, source] of Object.entries({
    "apps/mobile/src/views/workspaceView.js": workspace,
    "apps/mobile/src/views/operationPanelView.js": operationPanel,
    "apps/mobile/src/eventBinder.js": eventBinder,
    "apps/mobile/src/styles/workspace.css": workspaceStyles,
    "apps/mobile/src/styles/operation.css": operationStyles
  })) {
    for (const token of [
      "completed-operation-record",
      "data-view-completed-record",
      "intent-card",
      "completed-record-detail",
      "completed-step-list",
      "completed-record-grid",
      "completed-record-hero",
      "completed-record-section",
      "ctx.tr(\"objectSummary\")"
    ]) {
      if (source.includes(token)) {
        errors.push(v("fes.retired_token", `${file} contains retired frontend architecture token ${token}.`, { file, token }));
      }
    }
  }

  if (!workspace.includes("export function completedWorkspaceRecord") ||
      !workspace.includes("export function OperationCardShell") ||
      !workspace.includes("OperationStepRail") ||
      !workspace.includes('data-surface="completed-workspace-record"') ||
      !workspace.includes('data-admission-decision="visible_readonly_completed"')) {
    errors.push(v("fes.readonly_record_shell", "Completed records must use exported completedWorkspaceRecord and OperationCardShell with OperationStepRail and readonly admission state."));
  }
  if (!workspace.includes('data-component="operation-card-shell"')) {
    errors.push(v("fes.operation_card_shell_missing", "Step pages must render the shared OperationCardShell directly."));
  }
  if (workspace.includes("completed-record-intent") ||
      workspace.includes('data-component="CompletedRecordDetail"') ||
      workspace.includes('<article class="intent-card expanded completed-record-intent">')) {
    errors.push(v("fes.readonly_double_container", "Readonly completed records must not keep a page-private intent-card wrapper outside card-operation."));
  }
  if (workspace.includes('<article class="intent-card') || operationStyles.includes(".intent-card")) {
    errors.push(v("fes.intent_card_wrapper_retired", "New, readonly, and correction step pages must not keep the retired intent-card operation wrapper."));
  }
  if (workspace.includes('class="workspace-control completed-record-control"')) {
    errors.push(v("fes.completed_record_workspace_control_wrapper", "Readonly completed records must not keep the workspace-control visual wrapper."));
  }
  if (!experienceComponents.includes("stepVisualState") ||
      !experienceComponents.includes("isCorrectionStep") ||
      !experienceComponents.includes("isTerminalCorrectionStep") ||
      !experienceComponents.includes("completedWithCorrectionStatus") ||
      !experienceComponents.includes("data-step-state") ||
      !experienceComponents.includes("data-current-step") ||
      !experienceComponents.includes("data-step-marker")) {
    errors.push(v("fes.step_state_markers", "OperationStepRail timeline steps must expose step state, current step, and correction markers."));
  }
  for (const stateSelector of ["[data-step-state=\"completed\"]", "[data-step-state=\"ready\"]", "[data-step-state=\"correction\"]", "[data-step-state=\"in-progress\"]", "[data-step-state=\"not-started\"]", "[data-step-state=\"blocked\"]"]) {
    if (!workspaceStyles.includes(stateSelector)) {
      errors.push(v("fes.step_state_css_missing", `Step state CSS missing ${stateSelector}.`, { stateSelector }));
    }
  }
  for (const color of ["#2e7d5b", "#2f73b8", "#6b6f9f", "#b7791f", "#8a97a6", "#c24135"]) {
    if (!workspaceStyles.includes(color)) {
      errors.push(v("fes.step_state_color_missing", `Step state semantic color missing ${color}.`, { color }));
    }
  }
  for (const token of ["--step-accent", "--step-bg", "--step-ring", "::before"]) {
    if (!workspaceStyles.includes(token)) {
      errors.push(v("fes.step_state_treatment_missing", `Step state visual treatment missing ${token}.`, { token }));
    }
  }
  if (!operationPanel.includes("completedWorkspaceRecord") ||
      !operationPanel.includes("isTerminalCardStatus(activeCard.status)")) {
    errors.push(v("fes.operation_panel_completed_delegate", "OperationPanel must delegate terminal WorkItems directly to completedWorkspaceRecord."));
  }
  if (workspace.includes('data-view="feedback"')) {
    errors.push(v("fes.duplicate_local_feedback", "Workspace completed records must use the shared shell feedback entry instead of a record-local duplicate feedback button."));
  }
  if (!workspace.includes("readonlyStateSummaryPanel") ||
      !workspace.includes('data-surface="readonly-state-summary"') ||
      !workspace.includes('class="primary-action ready" data-work-item-id')) {
    errors.push(v("fes.readonly_step_parity", "Readonly completed steps must share the new-step status panel and primary action hierarchy."));
  }
  if (workspace.includes('ctx.tr("objectSummary")') ||
      workspace.includes('ctx.tr("decisionBusinessObject")') ||
      workspace.includes('ctx.tr("submissionRecord"), item.caseId')) {
    errors.push(v("fes.readonly_object_summary_retired", "Readonly completed records must not render a redundant object summary block before submitted business fields."));
  }
  if (!operationController.includes("postSubmitAutoAdvanceTarget") ||
      !operationController.includes("refreshPostSubmitWorkItems") ||
      !operationController.includes("applyPostSubmitAutoAdvance") ||
      !operationController.includes("autoAdvancedToWorkItemId") ||
      !operationController.includes("syncUrlFromState(ctx)")) {
    errors.push(v("fes.post_submit_auto_advance_missing", "Successful active submits must auto-advance to the next actionable persisted WorkItem and sync the URL."));
  }
  if (workspace.includes("returnCurrentWorkItem")) {
    errors.push(v("fes.return_current_work_retired", "Readonly completed records must not use returnCurrentWorkItem as a normal continuation fallback."));
  }

  for (const lang of ["zh-CN", "ru-RU", "ky-KG"]) {
    const present = operationCopy.includes(`"${lang}"`) || shellCopy.includes(`"${lang}"`) || domainCopy.includes(`"${lang}"`);
    if (!present) errors.push(v("fes.language_missing", `Missing language dictionary section ${lang}.`, { lang }));
  }
  for (const stale of ["completedRecordPanelBody", "页面反馈", "static feedback placeholder"]) {
    if (`${operationCopy}\n${shellCopy}\n${domainCopy}`.includes(stale)) {
      errors.push(v("fes.stale_copy", `Retired or placeholder copy is still present: ${stale}.`, { stale }));
    }
  }

  for (const field of [
    "BusinessOperationActionPaths",
    "ActionResultStateMatrix",
    "EvidenceTileStateMatrix",
    "EvidenceSheetStateMatrix",
    "PermissionDiagnosticCopyMatrix",
    "OfflineEmptyErrorProjectionPendingStates",
    "FrontendExperienceSystem"
  ]) {
    if (!(field in experience)) errors.push(v("fes.experience_field_missing", `Experience contract missing ${field}.`, { field }));
  }
  if (!String(experience.FrontendExperienceSystem?.stepPageExperienceParity || "").includes("users must not have to enumerate every sibling page one by one")) {
    errors.push(v("fes.experience_step_page_parity", "Experience contract must require step-page parity across new, readonly, and correction modes."));
  }
  if (!String(experience.FrontendExperienceSystem?.postSubmitNavigation || "").includes("auto-advance to the next actionable persisted WorkItem") ||
      !String(experience.BusinessOperationActionPaths?.postSubmit || "").includes("readonly completed record is not a mandatory detour")) {
    errors.push(v("fes.experience_post_submit_navigation", "Experience contract must forbid mandatory readonly detours after successful active submit."));
  }
  if (!String(experience.FrontendExperienceSystem?.stepStateVisualLanguage || "").includes("completed is green") ||
      !String(experience.FrontendExperienceSystem?.stepStateVisualLanguage || "").includes("ready is blue") ||
      !String(experience.FrontendExperienceSystem?.stepStateVisualLanguage || "").includes("muted indigo") ||
      !String(experience.FrontendExperienceSystem?.stepStateVisualLanguage || "").includes("terminal completed records remain completed as the primary state") ||
      !String(experience.FrontendExperienceSystem?.stepStateVisualLanguage || "").includes("must not display as ordinary ready blue") ||
      !String(experience.FrontendExperienceSystem?.stepStateVisualLanguage || "").includes("blocked is red") ||
      !String(experience.FrontendExperienceSystem?.stepStateVisualLanguage || "").includes("instead of harsh saturated blocks")) {
    errors.push(v("fes.experience_step_state_visual_language", "Experience contract must define semantic step-state colors."));
  }
  if (!String(experience.BusinessOperationActionPaths?.view || "").includes("intermediate completed-operation page is forbidden")) {
    errors.push(v("fes.completed_view_direct", "Experience contract must forbid intermediate completed-operation page."));
  }
  if (!surface.activeSurfaceArchitecture ||
      !String(surface.completedBusinessRecord?.viewPath || "").includes("without an intermediate completed-operation page")) {
    errors.push(v("fes.surface_completed_direct", "Surface contract must declare direct completed readonly records."));
  }
  if (surface.frontendExperienceSystem?.contractRef !== contractPath) {
    errors.push(v("fes.surface_contract_ref", "Surface contract must bind to the FES contract."));
  }
  if (!String(surface.frontendExperienceSystem?.stepPageExperienceParity || "").includes("new active") ||
      !String(surface.frontendExperienceSystem?.stepPageExperienceParity || "").includes("readonly completed") ||
      !String(surface.frontendExperienceSystem?.stepPageExperienceParity || "").includes("append-only correction")) {
    errors.push(v("fes.surface_step_page_parity", "Surface contract must require step-page parity across new, readonly, and correction modes."));
  }
  if (!String(surface.frontendExperienceSystem?.postSubmitNavigation || "").includes("auto-advance to the next actionable persisted WorkItem") ||
      !String(surface.frontendExperienceSystem?.postSubmitNavigation || "").includes("not the normal submit continuation path")) {
    errors.push(v("fes.surface_post_submit_navigation", "Surface contract must forbid readonly as the normal submit continuation path."));
  }
  if (!String(surface.frontendExperienceSystem?.stepStateVisualLanguage || "").includes("completed green") ||
      !String(surface.frontendExperienceSystem?.stepStateVisualLanguage || "").includes("ready blue") ||
      !String(surface.frontendExperienceSystem?.stepStateVisualLanguage || "").includes("muted indigo") ||
      !String(surface.frontendExperienceSystem?.stepStateVisualLanguage || "").includes("terminal completed records remain completed as the primary state") ||
      !String(surface.frontendExperienceSystem?.stepStateVisualLanguage || "").includes("not ordinary ready blue") ||
      !String(surface.frontendExperienceSystem?.stepStateVisualLanguage || "").includes("blocked red") ||
      !String(surface.frontendExperienceSystem?.stepStateVisualLanguage || "").includes("instead of harsh saturated blocks")) {
    errors.push(v("fes.surface_step_state_visual_language", "Surface contract must define semantic step-state colors."));
  }
  for (const layerId of [
    "shared-components",
    "surface-contract",
    "multilingual-dictionary",
    "state-action-contract",
    "real-browser-screenshot-evidence"
  ]) {
    if (!Array.isArray(surface.frontendExperienceSystem?.layers) || !surface.frontendExperienceSystem.layers.includes(layerId)) {
      errors.push(v("fes.surface_contract_layer", `Surface contract frontendExperienceSystem.layers missing ${layerId}.`, { layerId }));
    }
  }

  for (const file of [
    "apps/mobile/src/operationActionState.js",
    "apps/mobile/src/operationRouteResolver.js",
    "apps/mobile/src/operationRuntime.js",
    "apps/mobile/src/operationController.js"
  ]) {
    if (!exists(file)) errors.push(v("fes.state_action_file_missing", `Missing state/action contract source ${file}.`, { file }));
  }

  return errors;
}

function validateSystemRefs() {
  const errors = [];
  const surfaceExperience = readJson("docs/surface/surface-experience-contract.yml");
  const ruleAuthority = read("docs/rules/v5.5/rule-authority.yml");
  const guard = read("scripts/guard-architecture.ps1");
  const ci = read(".github/workflows/ci.yml");
  const engineering = read("docs/engineering/00-rule-authority.md");
  const evidenceLayer = (contract.layers || []).find((layer) => layer.id === "real-browser-screenshot-evidence") || {};

  if (!surfaceExperience.requiredContracts?.includes(contractPath)) {
    errors.push(v("fes.surface_experience_contract_ref", "surface-experience-contract must require the FES contract."));
  }
  if (!surfaceExperience.machineChecks?.includes("scripts/check-frontend-experience-system.mjs")) {
    errors.push(v("fes.surface_experience_machine_check", "surface-experience-contract must run the FES check."));
  }
  for (const source of [
    ["rule authority", ruleAuthority],
    ["architecture guard", guard],
    ["CI", ci],
    ["engineering authority", engineering]
  ]) {
    if (!source[1].includes("Frontend Experience System") && !source[1].includes("check-frontend-experience-system.mjs")) {
      errors.push(v("fes.system_ref_missing", `${source[0]} must reference Frontend Experience System or its machine check.`, { source: source[0] }));
    }
  }
  if (!exists("scripts/surface/run-dormitory-l1-browser-e2e-audit.mjs") ||
      !exists("scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs") ||
      !exists("scripts/surface/run-dormitory-ten-scenario-real-browser-audit.mjs") ||
      !exists("scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs")) {
    errors.push(v("fes.browser_evidence_tools_missing", "Real browser evidence runner/checker must exist."));
  }
  const evidenceRef = evidenceLayer.localEvidenceRef || "";
  if (evidenceRef && exists(evidenceRef)) {
    const proof = readJson(evidenceRef);
    if (proof.browserMode !== "real-browser") errors.push(v("fes.local_browser_proof_mode", "Local FES proof must be real-browser mode."));
    if (!Array.isArray(proof.screenshots) || proof.screenshots.length === 0) {
      errors.push(v("fes.local_browser_proof_screenshots", "Local FES proof must list screenshots."));
    }
    for (const shot of proof.screenshots || []) {
      if (!shot.path || !exists(shot.path)) errors.push(v("fes.local_browser_screenshot_missing", `Screenshot missing: ${shot.path || "(empty)"}.`, { shot }));
      if (!shot.surface || !shot.url || !shot.assertions) errors.push(v("fes.local_browser_screenshot_binding", `Screenshot binding missing surface/url/assertions: ${shot.path}.`, { shot }));
      if (shot.assertions?.hasRetiredMiddlePage !== false) errors.push(v("fes.local_browser_retired_middle_page", `Screenshot must assert no retired middle page: ${shot.path}.`, { shot }));
    }
  }
  return errors;
}

function writeReport(violations) {
  const reportPath = path.join(root, "artifacts", "surface", "frontend-experience-system-result.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/check-frontend-experience-system.mjs",
    status: violations.length ? "failed" : "passed",
    contract: contractPath,
    layers: (contract.layers || []).map((layer) => layer.id),
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
