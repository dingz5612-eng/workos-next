import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = readArg("--out=", ".tmp/oma/experience-contract-report.json");
const contractPath = "docs/business/experience-contract.yml";

if (process.argv.includes("--self-test")) {
  const failures = validateContract({ version: "bad" }, "self-test");
  assert(failures.some((item) => item.id === "experience.missing"), "self-test must catch missing fields");
  assert(failures.some((item) => item.id === "experience.version"), "self-test must catch wrong version");
  console.log("Experience Contract self-test: PASS");
  process.exit(0);
}

const contract = readJson(contractPath);
const failures = [
  ...validateContract(contract, contractPath),
  ...validateMobileSources()
];

writeReport(failures, [
  contractPath,
  "docs/oma/current-architecture.md",
  "docs/contracts/oma.current.json",
  "apps/mobile/src/appShell.js",
  "apps/mobile/src/operationRuntime.js",
  "apps/mobile/src/operationController.js",
  "apps/mobile/src/views/operationPanelView.js",
  "apps/mobile/src/views/experienceComponents.js"
]);

if (failures.length) {
  for (const item of failures) console.error(`${item.id}: ${item.message}`);
  throw new Error("Experience Contract check failed.");
}

console.log("Experience Contract check: PASS");

function validateContract(contract, file) {
  const failures = [];
  requireEqual(contract.version, "oma.experience-contract.v1", "experience.version", `${file} must use the current OMA experience version.`, failures);
  for (const field of [
    "currentSurfaceArchitecture",
    "roleDefaultHome",
    "roleNavigation",
    "deviceSurfaceMatrix",
    "frontendExperienceSystem",
    "workItemCard",
    "stepDependencyExperience",
    "admissionExplainabilityExperience",
    "businessOperationActionPaths",
    "issueRepairProtocol",
    "feedbackMessageChannel",
    "actionResultStateMatrix",
    "evidenceTileStateMatrix",
    "permissionDiagnosticCopyMatrix",
    "offlineEmptyErrorProjectionPendingStates",
    "bilingualOperationalCopyMatrix"
  ]) {
    if (!(field in contract)) failures.push(v("experience.missing", `${file} missing ${field}.`));
  }

  const expectedHomes = {
    frontdesk: "Today",
    operator: "Today",
    finance: "Finance Control",
    housekeeping: "Work",
    manager: "Manager Control Tower",
    admin: "Governance Center",
    releaseOwner: "Governance Center"
  };
  for (const [role, expected] of Object.entries(expectedHomes)) {
    if (contract.roleDefaultHome?.[role] !== expected) {
      failures.push(v("experience.role_home", `${role} default home must be ${expected}.`));
    }
  }

  for (const item of ["Today", "Work", "Search", "Me"]) {
    if (!contract.deviceSurfaceMatrix?.mobile?.includes(item)) {
      failures.push(v("experience.mobile_nav", `Mobile navigation missing ${item}.`));
    }
  }
  for (const forbidden of ["Finance Control", "Manager Control Tower", "Governance Center"]) {
    if (contract.deviceSurfaceMatrix?.mobile?.includes(forbidden)) {
      failures.push(v("experience.mobile_nav_forbidden", `Ordinary mobile navigation must not include ${forbidden}.`));
    }
  }

  const architecture = contract.currentSurfaceArchitecture || {};
  for (const required of ["shared shell", "shared route guard", "shared named experience components", "surface contract", "direct OperationCardShell on operation step pages"]) {
    if (!architecture.required?.includes(required)) failures.push(v("experience.surface_required", `currentSurfaceArchitecture.required missing ${required}.`));
  }
  for (const forbidden of ["page-private shell", "copied layout logic", "page-private field source mapping", "retired Workspace/Card write UI flow"]) {
    if (!architecture.forbidden?.includes(forbidden)) failures.push(v("experience.surface_forbidden", `currentSurfaceArchitecture.forbidden missing ${forbidden}.`));
  }

  for (const layer of ["shared-components", "field-context-kernel", "surface-contract", "multilingual-dictionary", "state-action-contract", "real-browser-verification"]) {
    if (!contract.frontendExperienceSystem?.layers?.includes(layer)) failures.push(v("experience.fes_layer", `frontendExperienceSystem.layers missing ${layer}.`));
  }

  for (const status of ["permission_blocked_403", "idempotency_conflict_409", "business_blocked_422", "committed_projection_pending"]) {
    if (!contract.actionResultStateMatrix?.[status]) failures.push(v("experience.action_state", `ActionResultStateMatrix missing ${status}.`));
  }
  for (const state of ["missing", "rejected", "wrong_scope"]) {
    if (contract.evidenceTileStateMatrix?.[state] !== "blocks confirm") failures.push(v("experience.evidence_blocks", `${state} evidence must block confirm.`));
  }

  const paths = contract.businessOperationActionPaths || {};
  if (!String(paths.create || "").includes("/api/operations/work-items/{workItemId}/confirm")) {
    failures.push(v("experience.primary_write_path", "create path must bind to the current OMA confirm endpoint."));
  }
  if (!paths.order?.includes("correct_append_only_from_record")) {
    failures.push(v("experience.append_only_order", "action order must include append-only correction."));
  }

  return failures;
}

function validateMobileSources() {
  const failures = [];
  const runtime = readText("apps/mobile/src/operationRuntime.js");
  const controller = readText("apps/mobile/src/operationController.js");
  const shell = readText("apps/mobile/src/appShell.js");
  const operationView = readText("apps/mobile/src/views/operationPanelView.js");
  const workspaceView = readText("apps/mobile/src/views/workspaceView.js");

  requireText(runtime, "prepareOperationWorkItem", "experience.runtime_prepare", "Mobile runtime must prepare persisted operation work items.", failures);
  requireText(runtime, "confirmOperationWorkItem", "experience.runtime_confirm", "Mobile runtime must confirm through the operation work item endpoint.", failures);
  forbidText(runtime, "submitCardOperationCompatibilityFallback", "experience.no_card_fallback", "Mobile runtime must not keep card compatibility fallback.", failures);
  forbidText(runtime, "prepareCard", "experience.no_prepare_card", "Mobile runtime must not prepare retired cards.", failures);
  forbidText(runtime, "confirmCard", "experience.no_confirm_card", "Mobile runtime must not confirm retired cards.", failures);
  requireText(controller, "submitWorkItemOperation", "experience.controller_submit", "Operation controller must submit persisted WorkItems.", failures);
  requireText(shell, "bottom-nav", "experience.shell_nav", "App shell must own shared navigation.", failures);
  requireText(operationView, "workspaceCardPanel", "experience.operation_panel_uses_shell", "Operation panel must route active work through the shared card shell.", failures);
  requireText(workspaceView, "data-component=\"operation-card-shell\"", "experience.operation_shell", "Workspace view must expose the shared operation card shell.", failures);

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

function requireText(source, needle, id, message, failures) {
  if (!source.includes(needle)) failures.push(v(id, message));
}

function forbidText(source, needle, id, message, failures) {
  if (source.includes(needle)) failures.push(v(id, message));
}

function requireEqual(actual, expected, id, message, failures) {
  if (actual !== expected) failures.push(v(id, message));
}

function writeReport(failures, inputs) {
  const full = path.join(root, out);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({ generatedBy: "scripts/check-experience-contract.mjs", ok: failures.length === 0, failures, inputs }, null, 2)}\n`);
}

function readArg(prefix, fallback) {
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function v(id, message) {
  return { id, message };
}
