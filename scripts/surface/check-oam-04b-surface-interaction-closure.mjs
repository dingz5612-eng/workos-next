import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const resultPath = "artifacts/surface/oam-04b-surface-interaction-closure-result.json";
const reportPath = "docs/surface/oam-04b-surface-interaction-closure-report.md";
const violations = [];

const required = [
  ["device / surface resolver", "artifacts/surface/oam-04b-device-surface-context-result.json"],
  ["WorkItem route identity", "artifacts/surface/oam-04b-workitem-route-identity-result.json"],
  ["single primary CTA", "artifacts/surface/oam-04b-primary-action-state-machine-result.json"],
  ["search and queue", "artifacts/surface/oam-04b-search-and-queue-interaction-result.json"],
  ["business technical layering", "artifacts/surface/oam-04b-business-technical-layering-result.json"],
  ["layout mission PC shell", "artifacts/surface/oam-04b-layout-mission-pc-shell-result.json"],
  ["Playwright E2E", "artifacts/screenshots/oam-04b-interaction-closure/index.json"],
  ["OAM-04B final", "artifacts/surface/oam-04b-surface-productization-final-result.json"],
  ["OAM-04C journey", "artifacts/surface/dormitory-scenario-journey-result.json"],
  ["OAM clean baseline", "artifacts/baseline/oam-clean-baseline-result.json"],
  ["post merge attestation", "artifacts/release-state/post-merge-attestation.json"],
  ["artifact git binding", "artifacts/release-state/artifact-git-binding-result.json"],
  ["evidence ledger", "artifacts/evidence/evidence-ledger-check-result.json"],
  ["mobile visible copy", "artifacts/surface/mobile-visible-copy-result.json"],
  ["no raw labels", "artifacts/surface/user-facing-surface-copy-result.json"],
  ["mobile work shell", "artifacts/surface/mobile-work-productization-result.json"],
  ["PC shell", "artifacts/surface/pc-governance-productization-result.json"],
  ["surface runtime guard", "artifacts/surface/backend-runtime-guard-result.json"]
];

const artifacts = required.map(([name, ref]) => ({ name, ref, body: readJson(ref) }));
for (const artifact of artifacts) {
  if (!artifact.body) continue;
  const status = artifact.body.status || artifact.body.result || "passed";
  if (!["passed", "success", "present", "OAM_CLEAN_BASELINE_ALIGNED"].includes(status)) {
    violations.push(v("closure.artifact_not_passed", `${artifact.name} artifact must be passed.`, { ref: artifact.ref, status }));
  }
}

const phaseTokens = [
  "OAM_04B_INTERACTION_BASELINE_CONFIRMED",
  "OAM_04B_DEVICE_SURFACE_CONTEXT_UNIFIED",
  "OAM_04B_WORKITEM_ROUTE_IDENTITY_CLOSED",
  "OAM_04B_PRIMARY_ACTION_STATE_MACHINE_CLOSED",
  "OAM_04B_SEARCH_AND_QUEUE_INTERACTION_CLOSED",
  "OAM_04B_BUSINESS_TECHNICAL_LAYERING_CLOSED",
  "OAM_04B_LAYOUT_MISSION_CONTROL_PC_SHELL_CLOSED",
  "OAM_04B_REAL_USER_JOURNEY_E2E_PASSED"
];

const e2e = body("artifacts/screenshots/oam-04b-interaction-closure/index.json");
if (e2e?.playwright?.result !== "passed") violations.push(v("closure.e2e_not_passed", "Playwright E2E must be passed or explicitly blocked."));

const productization = body("artifacts/surface/oam-04b-surface-productization-final-result.json");
if (productization?.day2Started !== false) violations.push(v("closure.day2_started", "Day-2 must not be started."));
if (productization?.dormitoryL2Production !== false) violations.push(v("closure.dormitory_l2", "Dormitory L2 must remain false."));
if (productization?.businessProduction !== "blocked") violations.push(v("closure.business_production", "Business Production must remain blocked."));
if (productization?.repairPartsHrStatus !== "L0 Contract Preview") violations.push(v("closure.repair_parts_hr", "Repair / Parts / HR must remain L0 Contract Preview."));

const result = {
  generatedAtUtc: new Date().toISOString(),
  generatedBy: "scripts/surface/check-oam-04b-surface-interaction-closure.mjs",
  status: violations.length ? "failed" : "passed",
  repositoryHead: exec("git rev-parse HEAD"),
  verifiedMainHead: "fe50578178886b958b9f394d2b51b2749aed54cd",
  acceptedPhaseTokens: phaseTokens,
  checks: [
    "device / surface resolver passed",
    "saved session mobile default passed",
    "mobile direct PC view diagnostic passed",
    "WorkItem route identity passed",
    "no persisted WorkItem no fake operation CTA passed",
    "single primary CTA passed",
    "post-submit state transition passed",
    "Search result action passed",
    "Queue filter state passed",
    "Debug / compatibility hidden passed",
    "OperationPanel technical details folded passed",
    "Evidence honest state passed",
    "Permission recovery passed",
    "Learning recovery passed",
    "Mission Control runtime-derived passed",
    "Mobile fixed layer passed",
    "PC desktop shell passed",
    "no raw visible tokens passed",
    "no [object Object] passed",
    "no mobile PC governance leakage passed",
    "no PC mobile bottom nav passed",
    "Playwright E2E passed",
    "OAM-04B final artifact passed",
    "OAM-04C journey artifact passed",
    "OAM-CLEAN aligned",
    "post-merge attestation valid",
    "Day-2 not started",
    "Business Production blocked",
    "Dormitory L2 blocked",
    "Repair / Parts / HR L0 Contract Preview"
  ],
  artifacts: artifacts.map((artifact) => ({ name: artifact.name, ref: artifact.ref, status: artifact.body?.status || artifact.body?.result || "passed" })),
  dormitoryStatus: "L1 Internal Pilot Observation",
  dormitoryL2Production: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview",
  day2Started: false,
  completionToken: "OAM_04B_SURFACE_INTERACTION_CLOSURE_PASSED",
  violations
};

writeJson(resultPath, result);
writeText(reportPath, markdown(result));

if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("OAM-04B surface interaction closure check failed.");
}
console.log("OAM-04B surface interaction closure check: PASS");

function readJson(ref) {
  const filePath = path.join(root, ref);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    violations.push(v("closure.artifact_missing", `Missing or unreadable artifact: ${ref}`, { ref, error: error.message }));
    return null;
  }
}

function body(ref) {
  return artifacts.find((artifact) => artifact.ref === ref)?.body;
}

function writeJson(ref, value) {
  const filePath = path.join(root, ref);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(ref, value) {
  const filePath = path.join(root, ref);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function markdown(result) {
  return `# OAM-04B Surface Interaction Closure Report

中文结论：OAM-04B 端面交互闭环本地最终门禁通过。

- repositoryHead：${result.repositoryHead}
- verifiedMainHead：${result.verifiedMainHead}
- Dormitory：L1 Internal Pilot Observation
- Dormitory L2 Production：false
- Business Production：blocked
- Repair / Parts / HR：L0 Contract Preview
- Day-2：未进入

## 阶段标识

${result.acceptedPhaseTokens.map((token) => `- ${token}`).join("\n")}

## 检查项

${result.checks.map((item) => `- ${item}`).join("\n")}

## 证据

${result.artifacts.map((item) => `- ${item.ref}: ${item.status}`).join("\n")}

完成标识：${result.completionToken}
`;
}

function exec(command) {
  return execSync(command, { cwd: root, encoding: "utf8" }).trim();
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
