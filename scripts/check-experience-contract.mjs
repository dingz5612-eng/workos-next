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
  "apps/mobile/src/surfaceResolver.js",
  "apps/mobile/src/views/operationPanelView.js",
  "apps/mobile/src/views/experienceComponents.js"
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
  const operationPanel = readSource("apps/mobile/src/views/operationPanelView.js");
  const home = readSource("apps/mobile/src/views/homeView.js");
  const me = readSource("apps/mobile/src/views/meView.js");

  if (shell.includes('nav("releaseControl"') || shell.includes('"releaseControl", "releaseControl"')) {
    violations.push(violation("experience_contract.mobile_release_nav", "Ordinary mobile bottom nav must not expose Release Control."));
  }
  if (!main.includes("fetchOperationWorkItems") || main.includes("fetchWorkQueue")) {
    violations.push(violation("experience_contract.work_page_source", "Work page hydration must consume /api/operations/work-items."));
  }
  if (!runtime.includes("prepareOperationWorkItem") || !runtime.includes("confirmOperationWorkItem")) {
    violations.push(violation("experience_contract.operation_panel_main_path", "Operation Panel main path must call operationsPrepare and operationsConfirm."));
  }
  if (!runtime.includes("submitCardOperationCompatibilityFallback") || !runtime.includes("prepareCard") || !runtime.includes("confirmCard")) {
    violations.push(violation("experience_contract.compatibility_fallback_missing", "prepareCard/confirmCard must remain only as named compatibility fallback."));
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
    violations.push(violation("experience_contract.operation_panel_route_missing", "Operation Panel route must show prepare/confirm/trace/evidence/projection/commandSubmissionId/payloadHash."));
  }
  if (!home.includes('tr("todayMissionControl")') || !home.includes('data-surface="today-mission-control"')) {
    violations.push(violation("experience_contract.today_mission_control_missing", "Today must render localized WorkItem Mission Control."));
  }
  if (!me.includes('tr("personalOpsCenter")') || !me.includes('data-surface="personal-ops-center"')) {
    violations.push(violation("experience_contract.personal_ops_center_missing", "Me must render localized Personal Ops Center."));
  }
  if (!workspace.includes("LifecycleWorkspace") || !workspace.includes("OperationPanelView")) {
    violations.push(violation("experience_contract.lifecycle_workspace_not_rendered", "Workspace must render LifecycleWorkspace and OperationPanelView as the primary experience."));
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
