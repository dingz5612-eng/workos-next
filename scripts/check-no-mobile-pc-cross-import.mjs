import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "apps", "mobile", "src");
const allowedPcFiles = new Set([
  "pcApiClient.js",
  "pcEventBinder.js",
  "pcGovernanceController.js",
  "pcGovernancePolicies.js",
  "pcRouteTree.js",
  "pcSurfaceData.js",
  "views/financeReconciliationView.js",
  "views/pcGovernanceView.js",
  "views/releaseControlView.js",
  "views/checkoutServiceView.js"
]);
const allowedBridgeImports = new Map([
  ["appRouter.js", new Set(["./pcRouteTree.js"])],
  ["eventBinder.js", new Set(["./pcEventBinder.js"])],
  ["pcSurfaceData.js", new Set(["./pcApiClient.js"])],
  ["pcGovernanceController.js", new Set(["./pcApiClient.js"])],
  ["financeReconciliationController.js", new Set(["./pcApiClient.js"])]
]);

if (process.argv.includes("--self-test")) {
  const violations = validateImports([
    { relative: "main.js", source: 'import { releaseControlView } from "./views/releaseControlView.js";' }
  ]);
  assert(violations.some((item) => item.id === "mobile_pc_cross_import.static_pc_import"), "self-test must catch static PC imports");
  console.log("No Mobile/PC Cross Import self-test: PASS");
  process.exit(0);
}

const files = listFiles(sourceRoot)
  .filter((file) => file.endsWith(".js"))
  .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
  .map((file) => ({
    relative: path.relative(sourceRoot, file),
    source: fs.readFileSync(file, "utf8")
  }));
const violations = [
  ...validateImports(files),
  ...validateMobileApiBoundary(files)
];

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("No Mobile/PC Cross Import check failed.");
}

console.log("No Mobile/PC Cross Import check: PASS");

function validateImports(files) {
  const violations = [];
  for (const file of files) {
    const normalized = normalize(file.relative);
    if (allowedPcFiles.has(normalized)) continue;
    const imports = [...file.source.matchAll(/import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g)].map((match) => match[1]);
    for (const specifier of imports) {
      if (allowedBridgeImports.get(normalized)?.has(specifier)) continue;
      if (isPcSpecifier(specifier)) {
        violations.push(violation(
          "mobile_pc_cross_import.static_pc_import",
          `${normalized} must not statically import PC surface module ${specifier}.`,
          { file: normalized, specifier }));
      }
    }
  }
  return violations;
}

function validateMobileApiBoundary(files) {
  const violations = [];
  const api = files.find((file) => normalize(file.relative) === "apiClient.js")?.source || "";
  for (const token of [
    "fetchReleaseControlCenter",
    "fetchProductionObservability",
    "previewBankStatementImport",
    "confirmBankStatementImport",
    "generateReconciliationCandidates",
    "detectReconciliationMismatches",
    "requestLedgerCorrection",
    "recordGovernanceAuditEvent",
    "postPcOperationsConfirm"
  ]) {
    if (api.includes(token)) {
      violations.push(violation("mobile_pc_cross_import.pc_api_in_mobile_client", `apiClient.js must not expose ${token}.`, { token }));
    }
  }
  return violations;
}

function isPcSpecifier(specifier) {
  return /pcGovernance|financeReconciliation|releaseControl|pcApiClient/i.test(specifier);
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function normalize(file) {
  return file.split(path.sep).join("/");
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
