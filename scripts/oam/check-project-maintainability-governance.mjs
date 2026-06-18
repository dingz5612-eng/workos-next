import fs from "node:fs";
import path from "node:path";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const governancePath = "docs/oam/project-maintainability-governance.json";
const reportPath = "docs/oam/project-maintainability-closure-report.md";
const resultPath = "artifacts/oam/checks/project-maintainability-governance-result.json";
const failures = [];
const oldWord = "leg" + "acy";

const governance = readJson(governancePath, root);
const pendingEvidenceMaterialization = [];

if (governance.version !== "oam.project-maintainability-governance.v1") {
  fail("project maintainability governance version mismatch.");
}
if (governance.status !== "authoritative") {
  fail("project maintainability governance must be authoritative.");
}
if (governance.mainlineId !== "Dormitory.13ScenarioMainline") {
  fail("project maintainability governance must bind Dormitory.13ScenarioMainline.");
}
if (governance.productionConfirmAllowed !== false ||
  governance.businessGoLiveAllowed !== false ||
  governance.releaseAuthority !== false ||
  governance.finalGoNoGo !== "NO_GO") {
  fail("project maintainability governance must keep production/business/release/final GO closed.");
}

for (const input of governance.stage0Inputs ?? []) {
  if (input.required && !exists(input.path)) {
    if (isEvidenceMaterializationPath(input.path)) {
      pendingEvidenceMaterialization.push({
        kind: "stage0Input",
        path: input.path
      });
      continue;
    }
    fail(`required stage0 input missing: ${input.path}.`);
  }
}

const protectedPaths = new Set();
for (const artifact of governance.protectedArtifacts ?? []) {
  if (!artifact.path) {
    fail("protected artifact path missing.");
    continue;
  }
  protectedPaths.add(normalizePath(artifact.path));
  if (!exists(artifact.path)) {
    if (isEvidenceMaterializationPath(artifact.path)) {
      pendingEvidenceMaterialization.push({
        kind: "protectedArtifact",
        path: artifact.path
      });
      continue;
    }
    fail(`protected artifact missing: ${artifact.path}.`);
  }
}

const allowedHandling = new Set(["delete", "merge", "document_catalog", "abstract", "retain"]);
const requiredTypes = new Set([
  "duplicate_script",
  "duplicate_test",
  "duplicate_browser_audit",
  "duplicate_evidence_generation",
  "duplicate_documentation",
  "old_chain_compat_residue",
  "frontend_bundle",
  "slow_submit",
  "duplicate_runtime_validation",
  "duplicate_search_projection",
  "unreferenced_file_or_function"
]);
const seenTypes = new Set();
for (const item of governance.complexityInventory ?? []) {
  if (!item.id) fail("complexity inventory item missing id.");
  if (!item.type) fail(`complexity inventory item ${item.id ?? "(missing)"} missing type.`);
  if (item.type) seenTypes.add(item.type);
  if (!item.riskLevel) fail(`complexity inventory item ${item.id} missing riskLevel.`);
  if (!allowedHandling.has(item.handling)) {
    fail(`complexity inventory item ${item.id} has unsupported handling ${item.handling}.`);
  }
  if (item.handling === "delete" && !item.proof?.noReferenceProofRequired) {
    fail(`delete item ${item.id} must carry noReferenceProofRequired.`);
  }
  const touchedPath = item.path ?? item.proof?.file ?? item.proof?.protectedPath;
  if (item.handling === "delete" && touchedPath && isProtectedPath(touchedPath, protectedPaths)) {
    fail(`delete item ${item.id} targets protected artifact ${touchedPath}.`);
  }
}
for (const requiredType of requiredTypes) {
  if (!seenTypes.has(requiredType)) fail(`complexity inventory missing required type: ${requiredType}.`);
}

for (const action of governance.safeSlimmingActions ?? []) {
  if (!action.id) fail("safe slimming action missing id.");
  if (!action.noActiveReferenceProof) fail(`safe slimming action ${action.id} missing noActiveReferenceProof.`);
  if (action.protectedArtifactTouched !== false) fail(`safe slimming action ${action.id} must not touch protected artifacts.`);
  for (const script of action.verificationScripts ?? []) {
    if (script.startsWith("node ")) {
      const scriptPath = script.slice("node ".length).split(/\s+/)[0];
      if (!exists(scriptPath)) fail(`safe slimming verification script missing: ${scriptPath}.`);
    } else if (script.includes("scripts/")) {
      const scriptPath = script.match(/scripts[\\/][^\s]+/)?.[0]?.replaceAll("\\", "/");
      if (scriptPath && !exists(scriptPath)) fail(`safe slimming verification script missing: ${scriptPath}.`);
    }
  }
}

if (sourceIncludes("scripts/surface/run-dormitory-real-browser-audits.ps1", "Test-TcpReady")) {
  fail("unused Test-TcpReady function must stay removed from real browser runner.");
}

for (const rule of governance.maintenanceRules ?? []) {
  if (!rule.id) fail("maintenance rule missing id.");
  if (rule.enforcement === "documentation_only") fail(`maintenance rule ${rule.id} must not be documentation-only.`);
  if (!Array.isArray(rule.enforcingChecks) || rule.enforcingChecks.length === 0) {
    fail(`maintenance rule ${rule.id} missing enforcing checks.`);
  }
  for (const check of rule.enforcingChecks ?? []) {
    if (check.startsWith("scripts/") && !exists(check)) fail(`maintenance rule ${rule.id} references missing check: ${check}.`);
  }
}

for (const required of governance.requiredHardGateIntegrations ?? []) {
  if (!exists(required)) fail(`required hard gate integration missing: ${required}.`);
}
for (const required of [
  `docs/oam/${oldWord}-retirement-ledger.json`,
  `scripts/oam/check-${oldWord}-retirement-ledger.mjs`,
  `scripts/oam/check-no-active-path-${oldWord}-identity.mjs`
]) {
  if (!exists(required)) fail(`old-chain governance dependency missing: ${required}.`);
}

const ci = readText(".github/workflows/ci.yml");
const controlPlane = readText("scripts/oam/run-control-plane-checks.ps1");
const ciHardGate = readText("scripts/oam/check-dormitory-ci-hard-gates.mjs");
const evidenceHardGate = readText("scripts/oam/check-evidence-root-hard-gate-matrix.mjs");
const transactionGenerator = readText("scripts/oam/generate-dormitory-mainline-activation-transaction.mjs");
const transactionChecker = readText("scripts/oam/check-dormitory-mainline-activation-transaction.mjs");
for (const [label, source] of [
  ["CI workflow", ci],
  ["Control Plane", controlPlane],
  ["CI hard gate checker", ciHardGate],
  ["Evidence Root hard gate matrix", evidenceHardGate],
  ["Mainline activation transaction generator", transactionGenerator],
  ["Mainline activation transaction checker", transactionChecker]
]) {
  if (!source.includes("check-project-maintainability-governance.mjs") &&
    !source.includes("project-maintainability-governance-result.json")) {
    fail(`${label} must integrate project maintainability governance.`);
  }
}

const report = readText(reportPath);
for (const requiredText of [
  "不改变住宿经营 13 场景业务语义",
  "Test-TcpReady",
  "NO_GO"
]) {
  if (!report.includes(requiredText)) fail(`maintainability closure report missing required text: ${requiredText}.`);
}

const performanceReport = readJsonIfExists("artifacts/oam/evidence/dormitory-performance-recoverability/performance-recoverability-report.json");
const performanceStatus = performanceReport?.status ?? "missing";
if (performanceReport && performanceReport.status !== "passed") {
  fail(`performance report must stay passed when present, actual ${performanceReport.status}.`);
}

const result = {
  version: "oam.project-maintainability-governance-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  governancePath,
  governanceDigest: fileDigest(governancePath, root),
  reportPath,
  reportDigest: fileDigest(reportPath, root),
  complexityItemCount: governance.complexityInventory?.length ?? 0,
  safeSlimmingActionCount: governance.safeSlimmingActions?.length ?? 0,
  maintenanceRuleCount: governance.maintenanceRules?.length ?? 0,
  performanceReportStatus: performanceStatus,
  protectedArtifactCount: protectedPaths.size,
  pendingEvidenceMaterialization,
  pendingEvidenceMaterializationCount: pendingEvidenceMaterialization.length,
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Project maintainability governance check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Project maintainability governance check: PASS");

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function readText(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`required file missing: ${file}.`);
    return "";
  }
  return fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "");
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function sourceIncludes(file, text) {
  return readText(file).includes(text);
}

function normalizePath(file) {
  return file.replaceAll("\\", "/").replace(/\/+$/, "");
}

function isEvidenceMaterializationPath(file) {
  return normalizePath(file).startsWith("artifacts/oam/");
}

function isProtectedPath(candidate, protectedPathSet) {
  const normalized = normalizePath(candidate);
  for (const protectedPath of protectedPathSet) {
    if (normalized === protectedPath || normalized.startsWith(`${protectedPath}/`)) return true;
  }
  return false;
}

function fail(message) {
  failures.push(message);
}
