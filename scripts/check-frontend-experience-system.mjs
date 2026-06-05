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
    "field-context-kernel",
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
  const homeView = read("apps/mobile/src/views/homeView.js");
  const searchView = read("apps/mobile/src/views/searchView.js");
  const operationController = read("apps/mobile/src/operationController.js");
  const operationFieldKernel = read("apps/mobile/src/operationFieldKernel.js");
  const fieldSourceRenderer = read("apps/mobile/src/fieldSourceRenderer.js");
  const eventBinder = read("apps/mobile/src/eventBinder.js");
  const workspaceStyles = read("apps/mobile/src/styles/workspace.css");
  const operationStyles = read("apps/mobile/src/styles/operation.css");
  const shellStyles = read("apps/mobile/src/styles/shell.css");
  const baseStyles = read("apps/mobile/src/styles/base.css");
  const styleBundle = fs.readdirSync(path.join(root, "apps/mobile/src/styles"))
    .filter((name) => name.endsWith(".css"))
    .map((name) => read(path.join("apps/mobile/src/styles", name)))
    .join("\n");
  const experienceComponents = components;
  const systemContextContract = read("apps/mobile/src/systemContextContract.js");
  const businessAnchorKernel = read("apps/mobile/src/businessAnchorKernel.js");
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

  const fieldKernelLayer = (contract.layers || []).find((layer) => layer.id === "field-context-kernel") || {};
  if (!fieldKernelLayer.contractRefs?.includes("apps/mobile/src/operationFieldKernel.js")) {
    errors.push(v("fes.field_kernel_contract_ref", "Field context kernel layer must bind apps/mobile/src/operationFieldKernel.js."));
  }
  if (!fieldKernelLayer.contractRefs?.includes("apps/mobile/src/fieldSourceRenderer.js")) {
    errors.push(v("fes.field_source_contract_ref", "Field context kernel layer must bind apps/mobile/src/fieldSourceRenderer.js."));
  }
  const fieldSourceExports = new Set([
    "fieldSourceState",
    "operationFieldState",
    "operationFieldRequired",
    "operationFieldVisible",
    "currentMissingRequiredLabels",
    "currentMissingContextLabels"
  ]);
  for (const exported of fieldKernelLayer.requiredExports || []) {
    const source = fieldSourceExports.has(exported) ? fieldSourceRenderer : operationFieldKernel;
    const owner = fieldSourceExports.has(exported) ? "FieldSourceRenderer" : "Operation field kernel";
    if (!source.includes(`export function ${exported}`)) {
      errors.push(v("fes.field_kernel_export_missing", `${owner} missing export ${exported}.`, { exported }));
    }
  }
  for (const token of ["operationFieldAliases", "taskValueAliases", "preferredFieldsByCard"]) {
    if (!operationFieldKernel.includes(token)) {
      errors.push(v("fes.field_kernel_source_missing", `Operation field kernel missing shared source ${token}.`, { token }));
    }
  }
  if (!Array.isArray(fieldKernelLayer.contextSources) ||
      !fieldKernelLayer.contextSources.includes("operations-start-context")) {
    errors.push(v("fes.field_kernel_start_context_source", "Field context kernel must declare operations-start-context as a valid context source."));
  }
  if (!systemContextContract.includes('"operations-start-context"')) {
    errors.push(v("fes.system_context_start_context", "System context contract must include operations-start-context in inherited-field priority."));
  }
  if (!fieldSourceRenderer.includes("carriedFieldFromCurrentWorkItemPayload") ||
      !fieldSourceRenderer.includes("workItem.payload || workItem.Payload")) {
    errors.push(v("fes.current_work_item_payload_context", "Operation forms must read inherited fields from the current Operations WorkItem payload through FieldSourceRenderer before falling back to drafts."));
  }
  if (!workspace.includes('from "../fieldSourceRenderer.js"') ||
      !fieldSourceRenderer.includes("export function fieldSourceState") ||
      !fieldSourceRenderer.includes("export function operationFieldState") ||
      !fieldSourceRenderer.includes("export function operationFieldRequired") ||
      !fieldSourceRenderer.includes("export function operationFieldVisible") ||
      !fieldSourceRenderer.includes("export function currentMissingRequiredLabels")) {
    errors.push(v("fes.field_source_renderer_missing", "Workspace operation forms must consume the shared FieldSourceRenderer for field source, visibility, required, and missing-input decisions."));
  }
  for (const forbidden of [
    "function operationFieldState",
    "function carriedForwardValue",
    "function derivedChargeAmount",
    "function operationFieldRequired",
    "function operationFieldVisible",
    "function currentMissingRequiredLabels",
    "function currentMissingContextLabels",
    "function hasRequiredFieldValue"
  ]) {
    if (workspace.includes(forbidden)) {
      errors.push(v("fes.page_private_field_source", `Workspace view must not own page-private field source logic ${forbidden}; use FieldSourceRenderer.`, { forbidden }));
    }
  }
  if (!businessAnchorKernel.includes("source.payload,") ||
      !experienceComponents.includes("task.source?.payload")) {
    errors.push(v("fes.business_anchor_payload_context", "Business anchors and task overviews must read flat Operations WorkItem payload context."));
  }
  if (!workspace.includes('from "../operationFieldKernel.js"') ||
      workspace.includes("export function operationFieldId(field)")) {
    errors.push(v("fes.workspace_field_kernel", "Workspace view must re-use operationFieldKernel for field identity and must not keep a page-local operationFieldId implementation."));
  }
  if (!operationController.includes('from "./operationFieldKernel.js"') ||
      operationController.includes('from "./views/workspaceView.js"')) {
    errors.push(v("fes.controller_field_kernel", "Operation controller must import field identity from operationFieldKernel, not from a page view."));
  }
  if (!experienceComponents.includes('from "../operationFieldKernel.js"') ||
      experienceComponents.includes("const taskValueAliases") ||
      experienceComponents.includes("function canonicalTaskFieldId") ||
      experienceComponents.includes("function taskDisplayValue") ||
      experienceComponents.includes("function preferredTaskFieldIds") ||
      experienceComponents.includes("function bedLayoutPreviewValue")) {
    errors.push(v("fes.page_private_field_rules", "Experience components must consume operationFieldKernel and must not keep page-private task alias or display-value rules."));
  }
  if (!experienceComponents.includes("export function BusinessSummaryHeader") ||
      !experienceComponents.includes("export function BusinessTaskBody") ||
      !experienceComponents.includes("export function BusinessTaskOverview") ||
      !experienceComponents.includes('data-surface="business-summary-header"') ||
      !experienceComponents.includes('data-surface="business-task-body"') ||
      !experienceComponents.includes('data-surface="business-task-overview"') ||
      !homeView.includes("BusinessSummaryHeader") ||
      !homeView.includes("BusinessTaskBody") ||
      !searchView.includes("BusinessSummaryHeader")) {
    errors.push(v("fes.business_summary_header_missing", "Business item titles, status, anchors, work content, and action context must render through shared BusinessSummaryHeader/BusinessTaskBody."));
  }
  for (const selector of [".business-summary-header", ".business-summary-heading", ".business-summary-anchor-panel", ".business-summary-title", ".business-summary-actions", ".business-summary-detail", ".business-task-body", ".business-task-row", ".business-task-alert", ".business-task-overview", ".business-task-field-group", ".business-task-field-grid", ".business-task-field"]) {
    if (!workspaceStyles.includes(selector)) {
      errors.push(v("fes.business_summary_style_missing", `Business summary hierarchy CSS missing ${selector}.`, { selector }));
    }
  }
  if (!workspaceStyles.includes(".business-summary-title") ||
      !workspaceStyles.includes(".business-summary-actions")) {
    errors.push(v("fes.business_summary_title_container", "Business summary scenario titles and actions must be contained blocks, not naked text."));
  }
  if (!baseStyles.includes("--brand: #12a6a0") ||
      !baseStyles.includes("--brand-soft: #e7fbf7") ||
      !baseStyles.includes("--brand-line: #7bd6cb") ||
      !baseStyles.includes("--action: #0f9b96") ||
      !baseStyles.includes("--action-gradient: linear-gradient") ||
      !baseStyles.includes("--action-shadow:") ||
      !baseStyles.includes("--attention: #f97316") ||
      !baseStyles.includes("--attention-soft: #fff7ed") ||
      !baseStyles.includes("--danger: #ef4444") ||
      !baseStyles.includes("--danger-soft: #fef2f2") ||
      !baseStyles.includes("background: var(--action-gradient)")) {
    errors.push(v("fes.premium_action_token", "Primary actions must use the shared lightweight teal-blue gradient token instead of page-local heavy action colors."));
  }
  if (!baseStyles.includes('--font-sans: "Microsoft YaHei UI", "Microsoft YaHei"') ||
      !baseStyles.includes("--font-title: 500") ||
      !baseStyles.includes("--font-strong: 500") ||
      !baseStyles.includes("--font-ui: 400") ||
      !baseStyles.includes("--font-button: 500") ||
      !baseStyles.includes("text-rendering: optimizeLegibility") ||
      !baseStyles.includes("-webkit-font-smoothing: antialiased")) {
    errors.push(v("fes.premium_typography_token", "Business surfaces must use the shared clear Chinese-first typography tokens and antialiased rendering."));
  }
  if (/font-weight:\s*(7\d\d|800|850|900);/.test(styleBundle)) {
    errors.push(v("fes.heavy_chinese_font_weight", "User-facing style sheets must use shared typography tokens instead of page-local bold/heavy 700+ weights."));
  }
  if (/font-size:\s*(10|11)px;/.test(styleBundle)) {
    errors.push(v("fes.tiny_chinese_font_size", "Ordinary user-facing style sheets must not use 10px/11px helper text; use readable small copy sizes instead."));
  }
  for (const token of ["#0b6f63", "#087568", "#eff6ff", "#bfdbfe", "#1d4ed8"]) {
    if (`${baseStyles}\n${shellStyles}\n${workspaceStyles}\n${operationStyles}`.includes(token)) {
      errors.push(v("fes.premium_surface_forbidden_color", `Business surface styles must not use low-end saturated ready/action token ${token}.`, { token }));
    }
  }
  for (const [selector, source] of [
    [".business-summary-title", workspaceStyles],
    [".business-anchor-field", workspaceStyles],
    [".definition-row", workspaceStyles],
    [".business-task-row", workspaceStyles],
    [".search-section h2", shellStyles],
    [".mission-stack h2", workspaceStyles]
  ]) {
    const block = cssBlock(source, selector);
    if (!block) {
      errors.push(v("fes.static_text_hierarchy_style_missing", `Missing static hierarchy style ${selector}.`, { selector }));
      continue;
    }
    if (/border:\s*1px/i.test(block) || /border-radius:\s*(8px|999px|12px|14px)/i.test(block)) {
      errors.push(v("fes.static_text_looks_clickable", `${selector} must not use button-like border/radius styling for static text.`, { selector }));
    }
  }
  if (!workspaceStyles.includes(".business-summary-state::before") ||
      !workspaceStyles.includes("background: transparent") ||
      !styleBundle.includes("background: transparent")) {
    errors.push(v("fes.static_text_not_button_like", "Static status, field, and fact text must use dots/dividers and transparent backgrounds instead of filled button-like blocks."));
  }
  if (searchView.includes('<section class="page-title" data-surface="workos-search"')) {
    errors.push(v("fes.search_duplicate_content_title", "Search must use the shared mobile shell title and must not repeat a generic page title in content."));
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
  if (!String(experience.FrontendExperienceSystem?.contentContainerRule || "").includes("BusinessSummaryHeader") ||
      !String(experience.FrontendExperienceSystem?.businessSummaryCardHierarchy || "").includes("business item cards")) {
    errors.push(v("fes.experience_business_summary_rule", "Experience contract must make BusinessSummaryHeader a general business-card hierarchy rule."));
  }
  if (!String(experience.FrontendExperienceSystem?.fieldContextKernel || "").includes("operationFieldKernel") ||
      !String(surface.frontendExperienceSystem?.fieldContextKernel || "").includes("operationFieldKernel")) {
    errors.push(v("fes.field_context_kernel_contract", "Experience and Surface contracts must bind field identity and task overview rules to operationFieldKernel."));
  }
  if (!String(experience.FrontendExperienceSystem?.premiumSurfaceVisualLanguage || "").includes("static text") ||
      !String(experience.FrontendExperienceSystem?.premiumSurfaceVisualLanguage || "").includes("must not mimic buttons")) {
    errors.push(v("fes.experience_premium_visual_language", "Experience contract must forbid static text that visually mimics buttons."));
  }
  if (!String(experience.FrontendExperienceSystem?.premiumTypographySystem || "").includes("Chinese-first") ||
      !String(surface.frontendExperienceSystem?.premiumTypographySystem || "").includes("Chinese-first")) {
    errors.push(v("fes.typography_contract_missing", "Experience and Surface contracts must bind the Chinese-first premium typography system."));
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
    "field-context-kernel",
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

function cssBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`, "m"))?.[0] || "";
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
