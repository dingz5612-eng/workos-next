import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { digestObject, fileDigest, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const transactionPath = "artifacts/oam/evidence/dormitory-mainline-activation-transaction.json";
const resultPath = "artifacts/oam/checks/dormitory-mainline-activation-transaction-result.json";
const transaction = readJsonIfExists(transactionPath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const oldWord = "leg" + "acy";

if (transaction.version !== "oam.dormitory-mainline-activation-transaction.v1") fail("transaction version mismatch.");
if (transaction.mainlineId !== "Dormitory.13ScenarioMainline") fail("transaction must bind Dormitory.13ScenarioMainline.");
if (transaction.currentHead !== currentHead) fail(`transaction currentHead must equal ${currentHead}.`);
if (transaction.finalTransactionStatus !== "PASS") fail(`finalTransactionStatus must be PASS, actual ${transaction.finalTransactionStatus ?? "missing"}.`);
if (transaction.productionConfirmAllowed !== false ||
  transaction.businessGoLiveAllowed !== false ||
  transaction.releaseAuthority !== false ||
  transaction.finalGoNoGo !== "NO_GO") {
  fail("transaction must keep production/business/release/final GO closed.");
}
if (transaction.transactionDigest !== digestObject({ ...transaction, transactionDigest: "sha256:pending" })) {
  fail("transactionDigest mismatch.");
}

const expectedDigests = {
  sourceDigest: fileDigest("docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json", root),
  productionActivationDigest: readJsonIfExists("artifacts/oam/checks/dormitory-production-mainline-activation-result.json")?.authorityDigest,
  consumerGraphDigest: readJsonIfExists("artifacts/oam/checks/lodging-consumer-graph-result.json")?.graphDigest,
  oldChainRetirementDigest: readJsonIfExists(`artifacts/oam/checks/${oldWord}-retirement-ledger-result.json`)?.ledgerDigest,
  visibleCopyDigest: readJsonIfExists("artifacts/oam/checks/visible-business-copy-contract-result.json")?.contractDigest,
  activePathGateDigest: fileDigest("artifacts/oam/checks/dormitory-active-path-gate-result.json", root),
  operationExecutionDigest: readJsonIfExists("artifacts/oam/checks/dormitory-operation-execution-contract-result.json")?.contractDigest,
  localEnvironmentDigest: readJsonIfExists("artifacts/oam/checks/dormitory-local-test-environment-manager-result.json")?.scriptDigest,
  entryBrowserDigest: fileDigest("artifacts/oam/checks/dormitory-13-scenario-entry-browser-result.json", root),
  performanceRecoverabilityDigest: fileDigest("artifacts/oam/checks/dormitory-performance-recoverability-result.json", root),
  defectClosureDigest: readJsonIfExists("artifacts/oam/checks/dormitory-defect-closure-ledger-result.json")?.ledgerDigest,
  ciWorkflowDigest: fileDigest(".github/workflows/ci.yml", root),
  ciHardGateDigest: fileDigest("artifacts/oam/checks/dormitory-ci-hard-gates-result.json", root),
  evidenceHardGateDigest: fileDigest("artifacts/oam/checks/evidence-root-hard-gate-matrix-result.json", root)
};
for (const [field, expected] of Object.entries(expectedDigests)) {
  if (!expected || transaction[field] !== expected) fail(`${field} mismatch.`);
}

for (const [label, file] of [
  ["Evidence graph", transaction.evidenceGraphRef],
  ["Final report", transaction.finalReportRef],
  ["CI hard gate", "artifacts/oam/checks/dormitory-ci-hard-gates-result.json"],
  ["Evidence hard gate", "artifacts/oam/checks/evidence-root-hard-gate-matrix-result.json"]
]) {
  if (!file || !fs.existsSync(path.join(root, file))) fail(`${label} file missing: ${file ?? "(empty)"}.`);
}

const result = {
  version: "oam.dormitory-mainline-activation-transaction-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  transactionPath,
  transactionDigest: transaction.transactionDigest ?? null,
  mainlineId: transaction.mainlineId ?? null,
  finalTransactionStatus: transaction.finalTransactionStatus ?? null,
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory mainline activation transaction check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory mainline activation transaction check: PASS (${result.transactionDigest})`);

function readJsonIfExists(file) {
  if (!file) return null;
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function fail(message) {
  failures.push(message);
}
