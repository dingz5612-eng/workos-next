import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = readArg("--out=", ".tmp/rt5/experience-contract-report.json");
const requiredTopLevel = [
  "roleDefaultHome",
  "roleNavigation",
  "deviceSurfaceMatrix",
  "WorkItemCard",
  "TodayMissionControlIA",
  "WorkPageIA",
  "ObjectWorkspaceIA",
  "UnifiedSurfaceArchitecture",
  "FrontendExperienceSystem",
  "BusinessOperationActionPaths",
  "IssueRepairProtocol",
  "FeedbackMessageChannel",
  "TrustedConfirmSheet",
  "ActionResultStateMatrix",
  "EvidenceTileStateMatrix",
  "EvidenceSheetStateMatrix",
  "PermissionDiagnosticCopyMatrix",
  "OfflineEmptyErrorProjectionPendingStates",
  "bilingualOperationalCopyMatrix"
];

if (process.argv.includes("--self-test")) {
  const violations = validateContract({ roleDefaultHome: { operator: "Work" } }, "self-test");
  assert(violations.some((item) => item.id === "experience_contract.missing_field"), "self-test must catch missing fields");
  assert(violations.some((item) => item.id === "experience_contract.role_home"), "self-test must catch wrong operator home");
  console.log("Experience Contract self-test: PASS");
  process.exit(0);
}

const contractPath = "docs/business/experience-contract.yml";
const contract = readJson(contractPath);
const violations = [
  ...validateContract(contract, contractPath),
  ...validateMobileSources()
];

writeReport(violations, [
  contractPath,
  "apps/mobile/src/appShell.js",
  "apps/mobile/src/main.js",
  "apps/mobile/src/operationRuntime.js",
  "apps/mobile/src/operationController.js",
  "apps/mobile/src/authController.js",
  "apps/mobile/src/navigationController.js",
  "apps/mobile/src/eventBinder.js",
  "apps/mobile/src/surfaceResolver.js",
  "apps/mobile/src/feedbackMessages.js",
  "apps/mobile/src/feedbackController.js",
  "apps/mobile/src/views/feedbackView.js",
  "apps/mobile/src/views/operationPanelView.js",
  "apps/mobile/src/views/experienceComponents.js",
  "apps/mobile/src/styles/workspace.css",
  "apps/mobile/src/styles/operation.css"
]);
if (violations.length > 0) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Experience Contract check failed.");
}

console.log("Experience Contract check: PASS");

function validateContract(contract, file) {
  const violations = [];
  for (const field of requiredTopLevel) {
    if (!(field in contract)) {
      violations.push(violation("experience_contract.missing_field", `${file} missing ${field}.`, { field }));
    }
  }

  const expectedHomes = {
    frontdesk: "Today",
    operator: "Today",
    finance: "Finance Control",
    housekeeping: "Work",
    manager: "Manager Control Tower",
    admin: "Governance Center",
    releaseOwner: "Release Flight Deck"
  };
  for (const [role, home] of Object.entries(expectedHomes)) {
    if (contract.roleDefaultHome?.[role] !== home) {
      violations.push(violation("experience_contract.role_home", `${role} default home must be ${home}.`, { role, home }));
    }
  }

  const mobileNav = contract.deviceSurfaceMatrix?.mobile ?? [];
  for (const item of ["Today", "Work", "Search", "Me"]) {
    if (!mobileNav.includes(item)) {
      violations.push(violation("experience_contract.mobile_nav", `Mobile nav missing ${item}.`, { item }));
    }
  }
  for (const forbidden of ["Release Control", "PC Governance", "Finance Reconciliation", "PC Manager"]) {
    if (mobileNav.includes(forbidden)) {
      violations.push(violation("experience_contract.mobile_nav_forbidden", `Ordinary mobile nav must not include ${forbidden}.`, { forbidden }));
    }
  }

  for (const status of ["permission_blocked_403", "idempotency_conflict_409", "business_blocked_422", "committed_projection_pending"]) {
    if (!contract.ActionResultStateMatrix?.[status]) {
      violations.push(violation("experience_contract.action_result_state", `ActionResult matrix missing ${status}.`, { status }));
    }
  }
  for (const state of ["missing", "rejected", "wrong_scope"]) {
    if (contract.EvidenceTileStateMatrix?.[state] !== "blocks confirm") {
      violations.push(violation("experience_contract.evidence_blocks_confirm", `${state} evidence must block confirm.`, { state }));
    }
  }
  const actionPaths = contract.BusinessOperationActionPaths || {};
  for (const pathName of ["create", "postSubmit", "view", "correct"]) {
    if (!actionPaths[pathName]) {
      violations.push(violation("experience_contract.business_operation_path", `BusinessOperationActionPaths missing ${pathName}.`, { pathName }));
    }
  }
  if (!String(actionPaths.create || "").includes("/api/operations/work-items/{workItemId}/confirm")) {
    violations.push(violation("experience_contract.business_operation_create_path", "Create/active business operation path must use Operations Confirm."));
  }
  if (!String(actionPaths.view || "").includes("readonly")) {
    violations.push(violation("experience_contract.business_operation_view_path", "View path must be readonly."));
  }
  if (!String(actionPaths.view || "").includes("before any correction action")) {
    violations.push(violation("experience_contract.business_operation_view_before_correct", "View path must happen before correction action is offered."));
  }
  if (!String(actionPaths.view || "").includes("intermediate completed-operation page is forbidden")) {
    violations.push(violation("experience_contract.business_operation_view_no_intermediate", "Completed record view path must forbid an intermediate completed-operation page."));
  }
  if (!String(actionPaths.postSubmit || "").includes("auto-advances to the next actionable persisted WorkItem") ||
      !String(actionPaths.postSubmit || "").includes("readonly completed record is not a mandatory detour")) {
    violations.push(violation("experience_contract.business_operation_post_submit", "Successful active submit must auto-advance instead of forcing a readonly detour."));
  }
  if (!String(actionPaths.correct || "").includes("append-only correction")) {
    violations.push(violation("experience_contract.business_operation_correct_path", "Correct path must be append-only correction, not in-place edit."));
  }
  const requiredActionOrder = ["create_active_work_item", "view_readonly_completed_record", "correct_append_only_from_record"];
  if (!Array.isArray(actionPaths.order) || requiredActionOrder.some((item, index) => actionPaths.order[index] !== item)) {
    violations.push(violation("experience_contract.business_operation_action_order", "Business operation paths must enforce create -> readonly view -> append-only correction."));
  }
  for (const forbidden of ["in-place edit of completed fact", "repeat confirm as modification", "page-specific update API", "intermediate completed-operation page"]) {
    if (!Array.isArray(actionPaths.forbidden) || !actionPaths.forbidden.includes(forbidden)) {
      violations.push(violation("experience_contract.business_operation_forbidden_path", `BusinessOperationActionPaths.forbidden missing ${forbidden}.`, { forbidden }));
    }
  }
  const unified = contract.UnifiedSurfaceArchitecture || {};
  if (!String(unified.currentArchitecture || "").includes("OAM-ACF v8") || !String(unified.currentArchitecture || "").includes("Operations Runtime")) {
    violations.push(violation("experience_contract.unified_surface_architecture_axis", "UnifiedSurfaceArchitecture must declare OAM-ACF v8 / Operations Runtime as the current surface architecture."));
  }
  const unifiedRequired = Array.isArray(unified.required) ? unified.required.join(" | ") : "";
  for (const required of ["shared shell", "route guard", "named experience components", "OperationCardShell", "without a page-private outer intent-card wrapper", "workspace-control visual wrapper", "readonly completed records", "without an intermediate completed-operation page"]) {
    if (!unifiedRequired.includes(required)) {
      violations.push(violation("experience_contract.unified_surface_required", `UnifiedSurfaceArchitecture.required missing ${required}.`, { required }));
    }
  }
  for (const retired of ["page-private legacy shell", "intent-card operation wrapper", "copied layout logic", "old completed-record-detail grid", "Workspace/Card write UI flow"]) {
    if (!Array.isArray(unified.retired) || !unified.retired.includes(retired)) {
      violations.push(violation("experience_contract.unified_surface_retired", `UnifiedSurfaceArchitecture.retired missing ${retired}.`, { retired }));
    }
  }
  if (!String(unified.repair || "").includes("root-cause rewritten") || !String(unified.repair || "").includes("obsolete code deleted")) {
    violations.push(violation("experience_contract.unified_surface_repair", "UnifiedSurfaceArchitecture.repair must require root-cause rewrite and obsolete code deletion."));
  }
  const frontendExperience = contract.FrontendExperienceSystem || {};
  if (frontendExperience.contractRef !== "docs/contracts/frontend-experience/frontend-experience-system-contract.json") {
    violations.push(violation("experience_contract.frontend_experience_contract_ref", "FrontendExperienceSystem must reference the machine-readable FES contract."));
  }
  for (const layer of ["shared-components", "surface-contract", "multilingual-dictionary", "state-action-contract", "real-browser-screenshot-evidence"]) {
    if (!Array.isArray(frontendExperience.layers) || !frontendExperience.layers.includes(layer)) {
      violations.push(violation("experience_contract.frontend_experience_layer", `FrontendExperienceSystem.layers missing ${layer}.`, { layer }));
    }
  }
  const frontendRule = String(frontendExperience.rule || "");
  if (!frontendRule.includes("but not architecture") ||
      !frontendRule.includes("rewritten") ||
      !frontendRule.includes("obsolete implementation deleted")) {
    violations.push(violation("experience_contract.frontend_experience_rule", "FrontendExperienceSystem rule must require no architecture variance and old implementation deletion."));
  }
  if (!String(frontendExperience.requiredEvidence || "").includes("real browser") ||
      !String(frontendExperience.requiredEvidence || "").includes("screenshot")) {
    violations.push(violation("experience_contract.frontend_experience_evidence", "FrontendExperienceSystem must require real browser screenshot evidence for user-visible fixes."));
  }
  const stepPageParity = String(frontendExperience.stepPageExperienceParity || "");
  for (const term of ["new active step", "readonly completed step", "append-only correction step", "OperationCardShell", "page-private outer intent-card wrapper", "workspace-control visual wrapper", "state/check panel", "users must not have to enumerate every sibling page one by one"]) {
    if (!stepPageParity.includes(term)) {
      violations.push(violation("experience_contract.step_page_experience_parity", `FrontendExperienceSystem.stepPageExperienceParity missing ${term}.`, { term }));
    }
  }
  const postSubmitNavigation = String(frontendExperience.postSubmitNavigation || "");
  for (const term of ["auto-advance to the next actionable persisted WorkItem", "completed readonly records are opened by explicit completed-step review", "return-current-work is not the normal submit continuation path"]) {
    if (!postSubmitNavigation.includes(term)) {
      violations.push(violation("experience_contract.post_submit_navigation", `FrontendExperienceSystem.postSubmitNavigation missing ${term}.`, { term }));
    }
  }
  const stepStateVisualLanguage = String(frontendExperience.stepStateVisualLanguage || "");
  for (const term of ["data-step-state", "data-current-step", "completed is green", "ready is blue", "terminal completed records remain completed as the primary state", "muted indigo", "must not display as ordinary ready blue", "in-progress is amber", "not-started is neutral gray", "blocked is red", "instead of harsh saturated blocks"]) {
    if (!stepStateVisualLanguage.includes(term)) {
      violations.push(violation("experience_contract.step_state_visual_language", `FrontendExperienceSystem.stepStateVisualLanguage missing ${term}.`, { term }));
    }
  }
  const repair = contract.IssueRepairProtocol || {};
  const requiredRepairOrder = ["observe_real_behavior", "classify_impact_scope", "locate_broken_layer", "align_target_flow_to_contract", "update_rule_or_model", "implement_root_cause_fix", "verify_with_tests_and_real_browser"];
  if (!Array.isArray(repair.order) || requiredRepairOrder.some((item, index) => repair.order[index] !== item)) {
    violations.push(violation("experience_contract.issue_repair_order", "IssueRepairProtocol must enforce observe -> classify -> locate -> align -> update rule/model -> implement -> verify."));
  }
  for (const forbidden of ["page-level hard-add", "old compatibility fallback", "copy-only patch without model change", "direct edit of completed business fact"]) {
    if (!Array.isArray(repair.forbidden) || !repair.forbidden.includes(forbidden)) {
      violations.push(violation("experience_contract.issue_repair_forbidden", `IssueRepairProtocol.forbidden missing ${forbidden}.`, { forbidden }));
    }
  }
  const feedback = contract.FeedbackMessageChannel || {};
  if (feedback.mode !== "role_or_account_addressed_collaboration_message") {
    violations.push(violation("experience_contract.feedback_message_mode", "Feedback must be a role/account addressed collaboration message channel."));
  }
  if (!String(feedback.entry || "").includes("right-bottom safe floating entry")) {
    violations.push(violation("experience_contract.feedback_entry", "Feedback entry must be a right-bottom safe floating entry."));
  }
  for (const required of ["view", "actorRole", "workspace", "card", "workItem", "language", "deviceSurface"]) {
    if (!Array.isArray(feedback.requiredContext) || !feedback.requiredContext.includes(required)) {
      violations.push(violation("experience_contract.feedback_context", `Feedback context missing ${required}.`, { required }));
    }
  }
  for (const forbidden of ["static feedback placeholder only", "feedback writes business facts", "feedback uses Operations confirm", "floating entry covers submit or required fields", "feedback placed in save or submit business action row"]) {
    if (!Array.isArray(feedback.forbidden) || !feedback.forbidden.includes(forbidden)) {
      violations.push(violation("experience_contract.feedback_forbidden", `FeedbackMessageChannel.forbidden missing ${forbidden}.`, { forbidden }));
    }
  }
  if (!Array.isArray(feedback.forbidden) || !feedback.forbidden.includes("duplicate record-local feedback entry when shell feedback entry exists")) {
    violations.push(violation("experience_contract.feedback_duplicate_forbidden", "FeedbackMessageChannel must forbid duplicate record-local feedback entries when shell feedback exists."));
  }
  return violations;
}

function validateMobileSources() {
  const violations = [];
  const shell = readSource("apps/mobile/src/appShell.js");
  const main = readSource("apps/mobile/src/main.js");
  const runtime = readSource("apps/mobile/src/operationRuntime.js");
  const controller = readSource("apps/mobile/src/operationController.js");
  const auth = readSource("apps/mobile/src/authController.js");
  const navigation = readSource("apps/mobile/src/navigationController.js");
  const resolver = readSource("apps/mobile/src/surfaceResolver.js");
  const components = readSource("apps/mobile/src/views/experienceComponents.js");
  const workbench = readSource("apps/mobile/src/views/workbenchView.js");
  const workspace = readSource("apps/mobile/src/views/workspaceView.js");
  const workspaceStyles = readSource("apps/mobile/src/styles/workspace.css");
  const operationStyles = readSource("apps/mobile/src/styles/operation.css");
  const operationPanel = readSource("apps/mobile/src/views/operationPanelView.js");
  const searchView = readSource("apps/mobile/src/views/searchView.js");
  const searchIntentHub = readSource("apps/mobile/src/searchIntentHub.js");
  const searchIntentRegistry = readSource("apps/mobile/src/searchIntentRegistry.js");
  const home = readSource("apps/mobile/src/views/homeView.js");
  const me = readSource("apps/mobile/src/views/meView.js");
  const eventBinder = readSource("apps/mobile/src/eventBinder.js");
  const feedbackView = readSource("apps/mobile/src/views/feedbackView.js");
  const feedbackMessages = readSource("apps/mobile/src/feedbackMessages.js");
  const feedbackController = readSource("apps/mobile/src/feedbackController.js");
  const simpleView = readSource("apps/mobile/src/views/simpleView.js");
  const copy = readSource("apps/mobile/src/i18n/domainCopy.js") + readSource("apps/mobile/src/i18n/shellCopy.js");

  if (shell.includes('nav("releaseControl"') || shell.includes('"releaseControl", "releaseControl"')) {
    violations.push(violation("experience_contract.mobile_release_nav", "Ordinary mobile bottom nav must not expose Release Control."));
  }
  if (!main.includes("fetchOperationWorkItems") || main.includes("fetchWorkQueue")) {
    violations.push(violation("experience_contract.work_page_source", "Work page hydration must consume /api/operations/work-items."));
  }
  if (!runtime.includes("prepareOperationWorkItem") || !runtime.includes("confirmOperationWorkItem")) {
    violations.push(violation("experience_contract.operation_panel_main_path", "Operation Panel main path must call operationsPrepare and operationsConfirm."));
  }
  for (const token of ["submitCardOperationCompatibilityFallback", "prepareCard", "confirmCard", "allowCompatibilityFallback"]) {
    if (runtime.includes(token)) {
      violations.push(violation("experience_contract.mobile_runtime_compatibility_fallback", `Mobile Operation Runtime must not carry ${token}.`, { token }));
    }
  }
  const activeStartSources = [eventBinder, searchView, searchIntentHub, searchIntentRegistry, operationPanel].join("\n");
  for (const token of ["data-start-operations-resource-setup", "startOperationsResourceSetupCommand", "startOperationsResourceSetup"]) {
    if (activeStartSources.includes(token)) {
      violations.push(violation("experience_contract.unified_workspace_start", `Dormitory scenario starts must use the unified data-start-operations-workspace control, not ${token}.`, { token }));
    }
  }
  if (!controller.includes("submitWorkItemOperation") || controller.includes("submitCardOperation({")) {
    violations.push(violation("experience_contract.operation_controller_legacy_submit", "Operation controller must use submitWorkItemOperation as the main path."));
  }
  if (!auth.includes("defaultHomeForSession(session, ctx.state)")) {
    violations.push(violation("experience_contract.role_login_home", "Login must route through defaultHomeForSession(session, state) after onboarding."));
  }
  if (!resolver.includes("resolveActiveDevice") || !resolver.includes("resolveCurrentSurface") || !resolver.includes("defaultHomeForCurrentSurface") || !resolver.includes("canAccessSurface")) {
    violations.push(violation("experience_contract.surface_resolver_missing", "Surface resolver must expose active device, current surface, default home, and access helpers."));
  }
  if (!resolver.includes("isTrustedPcDevice") || !resolver.includes("isPcSurfaceView(requestedView)")) {
    violations.push(violation("experience_contract.pc_device_gate_missing", "PC surface default routing must require a trusted PC or release device."));
  }
  if (!navigation.includes("evaluateSurfaceAccess")) {
    violations.push(violation("experience_contract.surface_guard_missing", "setView must evaluate SurfaceGuard before navigation."));
  }
  if (!workbench.includes("WorkItemCard")) {
    violations.push(violation("experience_contract.workitem_card_not_rendered", "Work page must render WorkItemCard."));
  }
  if (!operationPanel.includes("operationPanelView") || !operationPanel.includes("payloadHash") || !operationPanel.includes("commandSubmissionId")) {
    violations.push(violation("experience_contract.operation_panel_route_missing", "Operation Panel route must retain debug/audit proof for prepare/confirm/trace/evidence/projection/commandSubmissionId/payloadHash."));
  }
  if (!operationPanel.includes("completedWorkspaceRecord") || !workspace.includes("data-correction-work-item")) {
    violations.push(violation("experience_contract.completed_operation_paths_missing", "Completed operation records must render the readonly workspace record directly and correction from the readonly record."));
  }
  if (!operationPanel.includes("completedWorkspaceRecord") || !workspace.includes("completedRecordActionPolicy")) {
    violations.push(violation("experience_contract.completed_operation_policy_missing", "Completed operation pages must delegate to completedWorkspaceRecord, where completedRecordActionPolicy owns readonly record actions."));
  }
  if (!home.includes('tr("todayMissionControl")') || !home.includes('data-surface="today-mission-control"')) {
    violations.push(violation("experience_contract.today_mission_control_missing", "Today must render localized WorkItem Mission Control."));
  }
  if (!me.includes('tr("personalOpsCenter")') || !me.includes('data-surface="personal-ops-center"')) {
    violations.push(violation("experience_contract.personal_ops_center_missing", "Me must render localized Personal Ops Center."));
  }
  if (!shell.includes("feedback-fab") || !shell.includes('state.view') || !feedbackView.includes('data-surface="feedback-message-channel"')) {
    violations.push(violation("experience_contract.feedback_message_channel_missing", "Feedback must open a dedicated collaboration message channel from the shell entry."));
  }
  if (workspace.includes('data-view="feedback"')) {
    violations.push(violation("experience_contract.feedback_duplicate_local_entry", "Workspace records must not render duplicate local feedback buttons when the shared shell feedback entry exists."));
  }
  if (!workspace.includes("readonlyStateSummaryPanel") ||
      !workspace.includes('data-surface="readonly-state-summary"') ||
      !workspace.includes('class="primary-action ready" data-work-item-id')) {
    violations.push(violation("experience_contract.readonly_step_parity", "Readonly completed records must share the active step status panel pattern and primary action hierarchy."));
  }
  if (!controller.includes("postSubmitAutoAdvanceTarget") ||
      !controller.includes("refreshPostSubmitWorkItems") ||
      !controller.includes("applyPostSubmitAutoAdvance") ||
      !controller.includes("autoAdvancedToWorkItemId") ||
      !controller.includes("syncUrlFromState(ctx)")) {
    violations.push(violation("experience_contract.post_submit_auto_advance_missing", "Successful active submits must auto-advance to the next actionable persisted WorkItem and sync the URL."));
  }
  if (workspace.includes("returnCurrentWorkItem")) {
    violations.push(violation("experience_contract.return_current_work_retired", "Readonly completed records must not use returnCurrentWorkItem as a normal continuation fallback."));
  }
  if (!workspace.includes("export function OperationCardShell") ||
      !workspace.includes('data-component="operation-card-shell"')) {
    violations.push(violation("experience_contract.operation_card_shell_missing", "New, readonly, and correction step pages must render OperationCardShell directly."));
  }
  if (workspace.includes('<article class="intent-card') || operationStyles.includes(".intent-card")) {
    violations.push(violation("experience_contract.intent_card_wrapper_retired", "Step pages must not keep the retired intent-card operation wrapper."));
  }
  if (workspace.includes('class="workspace-control completed-record-control"')) {
    violations.push(violation("experience_contract.completed_record_workspace_control_wrapper", "Readonly completed records must not keep the workspace-control visual wrapper."));
  }
  if (!components.includes("stepVisualState") ||
      !components.includes("isCorrectionStep") ||
      !components.includes("isTerminalCorrectionStep") ||
      !components.includes("completedWithCorrectionStatus") ||
      !components.includes("data-step-state") ||
      !components.includes("data-current-step") ||
      !components.includes("data-step-marker")) {
    violations.push(violation("experience_contract.step_state_markers", "OperationStepRail must publish machine-readable step state and correction markers."));
  }
  for (const token of ["step-state-completed", "step-state-ready", "step-state-correction", "step-state-in-progress", "step-state-not-started", "step-state-blocked", "#2e7d5b", "#2f73b8", "#6b6f9f", "#b7791f", "#8a97a6", "#c24135", "--step-accent", "--step-bg", "--step-ring", "::before", "data-step-marker"]) {
    if (!workspaceStyles.includes(token)) {
      violations.push(violation("experience_contract.step_state_style_token", `workspace.css missing semantic step-state token ${token}.`, { token }));
    }
  }
  if (!feedbackMessages.includes("feedbackRecipients") || !feedbackMessages.includes("feedbackContextFromState") || !feedbackController.includes('eventType: "feedback.message.sent"')) {
    violations.push(violation("experience_contract.feedback_message_model_missing", "Feedback must carry recipients, context, and message sent event."));
  }
  for (const stale of ["feedbackRuntimeBody", "页面反馈", "static feedback placeholder"]) {
    if (simpleView.includes(stale) || copy.includes(stale)) {
      violations.push(violation("experience_contract.feedback_static_placeholder_retired", `Feedback must not keep retired placeholder wording or static support branches: ${stale}.`, { stale }));
    }
  }
  if (!workspace.includes("OperationStepRail") || !workspace.includes("OperationCardShell") || workspace.includes("OperationPanelView")) {
    violations.push(violation("experience_contract.workspace_compatibility_not_compact", "Workspace compatibility surface must render OperationStepRail and keep OperationPanelView on the Operations WorkItem route."));
  }
  const completedWorkspaceRoute = workspace.includes('data-surface="completed-workspace-route"') || workspace.includes('surface: "completed-workspace-route"');
  if (!completedWorkspaceRoute ||
      !workspace.includes("completed-record-control") ||
      !workspace.includes("completed-record-operation")) {
    violations.push(violation("experience_contract.completed_record_shared_shell", "Completed workspace records must reuse the shared operation step rail and card-operation readonly shell."));
  }
  if (workspace.includes("completed-record-intent") ||
      workspace.includes('data-component="CompletedRecordDetail"') ||
      workspace.includes('<article class="intent-card expanded completed-record-intent">')) {
    violations.push(violation("experience_contract.completed_record_double_container", "Readonly completed records must not keep a page-private intent-card wrapper outside card-operation."));
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
        violations.push(violation("experience_contract.retired_surface_shell_token", `${file} must not contain retired surface shell token ${token}.`, { file, token }));
      }
    }
  }
  for (const component of [
    "WorkItemCard",
    "OperationPanelView",
    "LifecycleWorkspace",
    "TrustedConfirmSheet",
    "ActionResult",
    "EvidenceTile",
    "EvidenceSheet",
    "PermissionDiagnostic",
    "ProjectionPendingState",
    "FailedSyncState",
    "UploadQueue",
    "SubmitQueue",
    "DeviceTrustPanel"
  ]) {
    if (!components.includes(`function ${component}`) && !components.includes(`const ${component}`)) {
      violations.push(violation("experience_contract.component_missing", `Experience component ${component} must be rendered as a named UI component.`, { component }));
    }
  }

  return violations;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeReport(violations, scannedFiles) {
  const reportPath = path.join(root, out);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({
    generated_at_utc: new Date().toISOString(),
    generated_by: "check-experience-contract",
    status: violations.length === 0 ? "passed" : "failed",
    scanned_files: scannedFiles,
    violation_count: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
