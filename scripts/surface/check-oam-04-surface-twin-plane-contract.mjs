import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outPath = "artifacts/surface/oam-04-surface-twin-plane-result.json";

const checks = [
  ["surface-experience-contract", "scripts/surface/check-surface-experience-contract.mjs", "artifacts/surface/surface-experience-contract-result.json"],
  ["mobile-pc-surface-boundary", "scripts/surface/check-mobile-pc-surface-boundary.mjs", "artifacts/surface/mobile-pc-boundary-result.json"],
  ["operational-copy-matrix", "scripts/surface/check-operational-copy-matrix.mjs", "artifacts/surface/mobile-visible-copy-result.json"],
  ["mobile-visible-copy", "scripts/surface/check-mobile-visible-copy.mjs", "artifacts/surface/mobile-visible-copy-result.json"],
  ["no-raw-surface-labels", "scripts/surface/check-no-raw-surface-labels.mjs", "artifacts/surface/mobile-visible-copy-result.json"],
  ["mobile-search-contract", "scripts/surface/check-mobile-search-contract.mjs", "artifacts/surface/search-learning-contract-result.json"],
  ["learning-center-contract", "scripts/surface/check-learning-center-contract.mjs", "artifacts/surface/search-learning-contract-result.json"],
  ["queue-state-contract", "scripts/surface/check-queue-state-contract.mjs", "artifacts/surface/queue-state-contract-result.json"],
  ["device-trust-contract", "scripts/surface/check-device-trust-contract.mjs", "artifacts/surface/device-trust-contract-result.json"],
  ["evidence-trust-contract", "scripts/surface/check-evidence-trust-contract.mjs", "artifacts/surface/evidence-trust-contract-result.json"],
  ["permission-explainability-contract", "scripts/surface/check-permission-explainability-contract.mjs", "artifacts/surface/permission-explainability-contract-result.json"],
  ["operation-panel-runtime-contract", "scripts/surface/check-operation-panel-runtime-contract.mjs", "artifacts/surface/operation-panel-runtime-contract-result.json"],
  ["surface-api-boundary", "scripts/surface/check-surface-api-boundary.mjs", "artifacts/surface/surface-api-boundary-result.json"],
  ["surface-runtime-guard-contract", "scripts/surface/check-surface-runtime-guard-contract.mjs", "artifacts/surface/backend-runtime-guard-result.json"]
];

const contracts = [
  "docs/surface/surface-experience-contract.yml",
  "docs/surface/mobile-work-plane-contract.yml",
  "docs/surface/pc-governance-plane-contract.yml",
  "docs/surface/operational-copy-matrix.yml",
  "docs/surface/mobile-search-contract.yml",
  "docs/surface/learning-center-contract.yml",
  "docs/surface/queue-state-contract.yml",
  "docs/surface/device-trust-experience-contract.yml",
  "docs/surface/evidence-trust-experience-contract.yml",
  "docs/surface/permission-explainability-contract.yml",
  "docs/surface/operation-panel-runtime-contract.yml",
  "docs/surface/surface-api-boundary.yml",
  "docs/surface/surface-runtime-guard-contract.yml"
];

const schemas = [
  ...contracts.map((file) => `schemas/surface/${path.basename(file).replace(/\.yml$/, ".schema.json")}`),
  "schemas/surface/oam-04-surface-twin-plane-result.schema.json"
];

const tests = [
  "apps/mobile/src/__tests__/MobileSurfaceCopyContract.test.js",
  "apps/mobile/src/__tests__/MobilePcSurfaceBoundary.test.js",
  "apps/mobile/src/__tests__/SearchLearningSync.test.js",
  "apps/mobile/src/__tests__/QueueStateContract.test.js",
  "apps/mobile/src/__tests__/DeviceTrustExperience.test.js",
  "apps/mobile/src/__tests__/EvidenceTrustExperience.test.js",
  "apps/mobile/src/__tests__/PermissionExplainability.test.js",
  "apps/mobile/src/__tests__/OperationPanelRuntimeContract.test.js",
  "apps/mobile/src/__tests__/TodayMissionControlContract.test.js",
  "apps/mobile/src/__tests__/PersonalOpsCenterContract.test.js",
  "apps/mobile/src/__tests__/UploadQueueRecovery.test.js",
  "apps/mobile/src/__tests__/SubmitQueueRecovery.test.js",
  "apps/mobile/src/__tests__/ProjectionPendingRecovery.test.js",
  "apps/mobile/src/__tests__/DormitoryWeakNetworkSubmit.test.js",
  "apps/pc/src/__tests__/PcGovernancePlaneContract.test.js",
  "apps/pc/src/__tests__/PcFinanceCaseConsoleContract.test.js",
  "apps/pc/src/__tests__/PcReleaseFlightDeckContract.test.js",
  "apps/pc/src/__tests__/PcSearchScopeContract.test.js",
  "tests/WorkOS.RuntimeIntegrationTests/MobileSurfaceRuntimeGuardTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/PcGovernanceSurfaceRuntimeGuardTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/SearchScopeRuntimeTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/LearningScopeRuntimeTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/OperationsConfirmPilotScopeTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/EvidenceAttachPilotScopeTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/FinanceMoneyCommandPilotScopeTests.cs"
];

const violations = [];
const checkResults = [];

for (const [name, script, artifact] of checks) {
  assertFile(script, "checker");
  const result = spawnSync("node", [script], { cwd: root, encoding: "utf8", shell: false });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    violations.push(violation("oam04.check_failed", `OAM-04 checker failed: ${name}`, { name, script }));
  }
  const artifactPayload = readJsonIfExists(artifact);
  if (!artifactPayload) {
    violations.push(violation("oam04.artifact_missing", `OAM-04 checker artifact missing: ${artifact}`, { name, artifact }));
    checkResults.push({ name, script, artifact, status: "missing" });
  } else {
    const status = artifactPayload.status;
    if (status !== "passed") {
      violations.push(violation("oam04.artifact_not_passed", `OAM-04 checker artifact not passed: ${artifact}`, { name, artifact, status }));
    }
    checkResults.push({ name, script, artifact, status });
  }
}

for (const contract of contracts) assertFile(contract, "contract");
for (const schema of schemas) assertFile(schema, "schema");
for (const test of tests) assertFile(test, "test");

const surfaceContract = readJsonIfExists("docs/surface/surface-experience-contract.yml") ?? {};
const boundary = surfaceContract.statusBoundary ?? {};
if (boundary.dormitoryL2ProductionAllowed !== false) {
  violations.push(violation("oam04.dormitory_l2_not_blocked", "OAM-04 必须保持宿舍 L2 不允许。"));
}
if (boundary.businessProductionGo !== false) {
  violations.push(violation("oam04.business_production_not_blocked", "OAM-04 必须保持业务生产 blocked。"));
}
if (boundary.repairPartsHrProductionAllowed !== false) {
  violations.push(violation("oam04.downstream_lines_not_l0", "OAM-04 必须保持 Repair / Parts / HR 未放开 production。"));
}

const result = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "scripts/surface/check-oam-04-surface-twin-plane-contract.mjs",
  taskId: "OAM-04",
  status: violations.length ? "blocked" : "passed",
  branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
  contracts,
  schemas,
  checkers: checks.map(([, script]) => script),
  artifacts: [...new Set([...checks.map(([, , artifact]) => artifact), outPath])],
  tests,
  checks: checkResults,
  statusBoundary: boundary,
  mobilePlane: "Work Execution Plane",
  pcPlane: "Governance Control Plane",
  operationPanelRuntimeModel: "persisted WorkItem runtime model only",
  violations
};

writeJson(outPath, result);

if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("OAM-04 Surface Twin-Plane Contract: BLOCKED");
}

console.log("OAM-04 Surface Twin-Plane Contract: PASS");

function assertFile(relativePath, type) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    violations.push(violation(`oam04.${type}_missing`, `OAM-04 missing ${type}: ${relativePath}`, { relativePath }));
  }
}

function readJsonIfExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
