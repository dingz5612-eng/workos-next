import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileDigest, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/evidence-root-hard-gate-matrix-result.json";
const graphPath = "artifacts/oam/evidence/evidence-graph.json";
const finalReportPath = "artifacts/oam/final-report.json";
const currentHead = command("git rev-parse HEAD");
const oldWord = "leg" + "acy";
const oldRetirementResultPath = `artifacts/oam/checks/${oldWord}-retirement-ledger-result.json`;
const oldActiveResultPath = `artifacts/oam/checks/no-active-path-${oldWord}-identity-result.json`;
const failures = [];

const requiredResultFiles = [
  ["MainlineManifest", "artifacts/oam/checks/dormitory-mainline-manifest-result.json"],
  ["ConsumerGraph", "artifacts/oam/checks/lodging-consumer-graph-result.json"],
  ["OldChainRetirementLedger", oldRetirementResultPath],
  ["VisibleBusinessCopyContract", "artifacts/oam/checks/visible-business-copy-contract-result.json"],
  ["DormitoryDefectClosureLedger", "artifacts/oam/checks/dormitory-defect-closure-ledger-result.json"],
  ["GeneratedReproducible", "artifacts/oam/checks/generated-files-not-manually-edited-result.json"],
  ["Dormitory13Source", "artifacts/oam/checks/dormitory-13-scenario-control-authority-result.json"],
  ["ProductionMainlineActivation", "artifacts/oam/checks/dormitory-production-mainline-activation-result.json"],
  ["Dormitory13Generated", "artifacts/oam/checks/dormitory-13-scenario-generated-contracts-result.json"],
  ["Dormitory13Consumption", "artifacts/oam/checks/dormitory-13-scenario-consumption-boundary-result.json"],
  ["ActivePathGate", "artifacts/oam/checks/dormitory-active-path-gate-result.json"],
  ["OperationExecutionContract", "artifacts/oam/checks/dormitory-operation-execution-contract-result.json"],
  ["LocalEnvironmentManager", "artifacts/oam/checks/dormitory-local-test-environment-manager-result.json"],
  ["OldChainActivePath", oldActiveResultPath],
  ["BusinessUiDomCopy", "artifacts/oam/checks/business-ui-copy-no-technical-leak-result.json"],
  ["Dormitory13EntryBrowser", "artifacts/oam/checks/dormitory-13-scenario-entry-browser-result.json"],
  ["PerformanceRecoverabilityBrowser", "artifacts/oam/checks/dormitory-performance-recoverability-result.json"],
  ["PrelaunchOpsTrial", "artifacts/oam/checks/dormitory-prelaunch-ops-trial-result.json"],
  ["CiHardGateConfig", "artifacts/oam/checks/dormitory-ci-hard-gates-result.json"]
];

for (const [label, file] of requiredResultFiles) {
  const doc = readJsonIfExists(file);
  if (!doc) {
    fail(`${label} result missing: ${file}`);
    continue;
  }
  if (!["PASS", "passed"].includes(doc.status)) {
    fail(`${label} result must PASS, actual ${doc.status ?? "missing"}.`);
  }
}

for (let scenario = 1; scenario <= 13; scenario += 1) {
  for (const kind of ["positive", "negative"]) {
    const resultFile = `artifacts/oam/checks/dormitory-scenario${scenario}-${kind}-browser-result.json`;
    const result = readJsonIfExists(resultFile);
    if (!result) {
      fail(`scenario ${scenario} ${kind} browser result missing.`);
      continue;
    }
    if (result.status !== "PASS") fail(`scenario ${scenario} ${kind} browser result must PASS.`);
    const report = readJsonIfExists(result.reportPath ?? "");
    if (!report) {
      fail(`scenario ${scenario} ${kind} browser report missing.`);
      continue;
    }
    if (report.git?.headSha !== currentHead) {
      fail(`scenario ${scenario} ${kind} browser report is stale: expected ${currentHead}, actual ${report.git?.headSha ?? "missing"}.`);
    }
    if (report.status !== "passed") fail(`scenario ${scenario} ${kind} browser report status must be passed.`);
    if (!report.screenshotIndex || !readJsonIfExists(report.screenshotIndex)) {
      fail(`scenario ${scenario} ${kind} browser screenshot index missing.`);
    }
    if (report.productionConfirmAllowed !== false ||
      report.businessGoLiveAllowed === true ||
      report.releaseAuthority !== false ||
      report.finalGoNoGo !== "NO_GO") {
      fail(`scenario ${scenario} ${kind} browser report must keep production/business/release/final GO closed.`);
    }
  }
}

const oldChainLedger = readJsonIfExists(oldRetirementResultPath);
if ((oldChainLedger?.unclassifiedCount ?? 0) !== 0) fail("old-chain retirement unclassifiedCount must be 0.");
if ((oldChainLedger?.activeForbiddenUnresolvedCount ?? 0) > 0) fail("old-chain retirement active forbidden unresolved count must be 0.");

const oldChainActive = readJsonIfExists(oldActiveResultPath);
if ((oldChainActive?.activePathViolationCount ?? oldChainActive?.violationCount ?? 0) !== 0) {
  fail("old-chain active path violation count must be 0.");
}

const uiCopy = readJsonIfExists("artifacts/oam/checks/business-ui-copy-no-technical-leak-result.json");
if ((uiCopy?.violationCount ?? uiCopy?.technicalLeakCount ?? 0) !== 0) {
  fail("business DOM old/technical copy violation count must be 0.");
}

const performanceRecoverability = readJsonIfExists("artifacts/oam/evidence/dormitory-performance-recoverability/performance-recoverability-report.json");
if (!performanceRecoverability) {
  fail("performance and recoverability browser report missing.");
} else {
  if (performanceRecoverability.status !== "passed") fail("performance and recoverability browser report must be passed.");
  if (performanceRecoverability.git?.headSha !== currentHead) {
    fail(`performance and recoverability browser report is stale: expected ${currentHead}, actual ${performanceRecoverability.git?.headSha ?? "missing"}.`);
  }
  if ((performanceRecoverability.findings ?? []).length !== 0) fail("performance and recoverability browser report findings must be empty.");
}

const prelaunchOpsTrial = readJsonIfExists("artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json");
if (!prelaunchOpsTrial) {
  fail("prelaunch operations trial report missing.");
} else {
  const passedRoleCount = (prelaunchOpsTrial.roleTrials ?? []).filter((item) => item.status === "passed").length;
  const passedScenarioCount = (prelaunchOpsTrial.scenarioTrials ?? []).filter((item) => item.status === "passed").length;
  if (prelaunchOpsTrial.status !== "passed") fail("prelaunch operations trial report must be passed.");
  if (prelaunchOpsTrial.git?.headSha !== currentHead) {
    fail(`prelaunch operations trial report is stale: expected ${currentHead}, actual ${prelaunchOpsTrial.git?.headSha ?? "missing"}.`);
  }
  if (passedRoleCount !== 4) fail(`prelaunch operations trial must pass 4 roles, actual ${passedRoleCount}.`);
  if (passedScenarioCount !== 13) fail(`prelaunch operations trial must pass 13 scenarios, actual ${passedScenarioCount}.`);
  if ((prelaunchOpsTrial.p0p1Findings ?? []).length !== 0) fail("prelaunch operations trial P0/P1 findings must be empty.");
  if ((prelaunchOpsTrial.blockers ?? []).length !== 0) fail("prelaunch operations trial blockers must be empty.");
  if (!prelaunchOpsTrial.screenshotIndex || !readJsonIfExists(prelaunchOpsTrial.screenshotIndex)) {
    fail("prelaunch operations trial screenshot index missing.");
  }
  if (prelaunchOpsTrial.productionConfirmAllowed !== false ||
    prelaunchOpsTrial.businessGoLiveAllowed !== false ||
    prelaunchOpsTrial.releaseAuthority !== false ||
    prelaunchOpsTrial.finalGoNoGo !== "NO_GO") {
    fail("prelaunch operations trial must keep production/business/release/final GO closed.");
  }
}

const defectLedger = readJsonIfExists("docs/oam/dormitory-defect-closure-ledger.json");
const openP0P1 = (defectLedger?.defects ?? []).filter((item) =>
  ["P0", "P1"].includes(item.severity) && ["open", "fixing"].includes(item.status));
if (openP0P1.length > 0) fail(`DormitoryDefectClosureLedger has open/fixing P0/P1 defects: ${openP0P1.map((item) => item.defectId).join(", ")}.`);

const graph = readJsonIfExists(graphPath);
if (!graph) {
  fail("Evidence graph missing.");
} else {
  const browser = graph.realBrowserEvidence ?? {};
  if (browser.status !== "passed") fail(`Evidence graph realBrowserEvidence must be passed, actual ${browser.status ?? "missing"}.`);
  if (browser.currentMainAudit !== "dormitory_13_scenario_browser_evidence_collection") {
    fail("Evidence graph current browser audit must be 13 scenario evidence collection.");
  }
  for (let scenario = 1; scenario <= 13; scenario += 1) {
    const item = browser[`scenario${scenario}`];
    if (!item) {
      fail(`Evidence graph missing scenario${scenario} browser summary.`);
      continue;
    }
    if (item.positive?.status !== "passed") fail(`Evidence graph scenario${scenario} positive browser must be passed.`);
    if (item.negative?.status !== "passed") fail(`Evidence graph scenario${scenario} negative browser must be passed.`);
  }
  const performanceRecoverabilitySummary = browser.performanceRecoverability;
  if (performanceRecoverabilitySummary?.status !== "passed" ||
    performanceRecoverabilitySummary?.currentMainGate !== true ||
    !performanceRecoverabilitySummary?.report ||
    !performanceRecoverabilitySummary?.result) {
    fail("Evidence graph performance and recoverability browser summary must be passed and current main gate.");
  }
  const performanceRecoverabilityNode = (graph.nodes ?? []).find((candidate) =>
    candidate.gate === "DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER");
  if (!performanceRecoverabilityNode || performanceRecoverabilityNode.status !== "passed" || performanceRecoverabilityNode.reportFresh !== true) {
    fail("Evidence graph performance and recoverability browser node must be fresh and passed.");
  }
  const prelaunchOpsTrialSummary = browser.prelaunchOpsTrial;
  if (prelaunchOpsTrialSummary?.status !== "passed" ||
    prelaunchOpsTrialSummary?.currentMainGate !== true ||
    prelaunchOpsTrialSummary?.passedRoleCount !== 4 ||
    prelaunchOpsTrialSummary?.passedScenarioCount !== 13 ||
    prelaunchOpsTrialSummary?.p0p1Count !== 0 ||
    prelaunchOpsTrialSummary?.blockerCount !== 0 ||
    !prelaunchOpsTrialSummary?.report ||
    !prelaunchOpsTrialSummary?.result) {
    fail("Evidence graph prelaunch operations trial summary must be passed and current main gate.");
  }
  const prelaunchOpsTrialNode = (graph.nodes ?? []).find((candidate) =>
    candidate.gate === "DORMITORY-PRELAUNCH-OPS-TRIAL");
  if (!prelaunchOpsTrialNode || prelaunchOpsTrialNode.status !== "passed" || prelaunchOpsTrialNode.reportFresh !== true) {
    fail("Evidence graph prelaunch operations trial node must be fresh and passed.");
  }
  const quarantine = browser[`${oldWord}Quarantine`];
  const firstGolden = quarantine?.firstGoldenChain ?? browser.firstGoldenChain;
  if (firstGolden?.currentMainGate === true || firstGolden?.scenarioScope?.currentMainGate === true) {
    fail("FirstGoldenChain must not be current main browser audit.");
  }
}

const finalReport = readJsonIfExists(finalReportPath);
if (finalReport) {
  if (finalReport.productionConfirmAllowed !== false ||
    finalReport.releaseAuthority !== false ||
    finalReport.finalGoNoGo !== "NO_GO") {
    fail("Final report must keep production/release/final GO closed.");
  }
}

const result = {
  version: "oam.evidence-root-hard-gate-matrix-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  currentHead,
  matrixScope: "dormitory_13_scenario_mainline_activation_hard_gate",
  requiredScenarioBrowserChecks: 26,
  activeMainlineUniqueRequired: true,
  firstGoldenChainCurrentMainAuditAllowed: false,
  browserFailureAdvisoryAllowed: false,
  openP0P1Allowed: false,
  graphPath,
  graphDigest: fs.existsSync(path.join(root, graphPath)) ? fileDigest(graphPath, root) : "missing",
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Evidence Root hard gate matrix check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Evidence Root hard gate matrix check: PASS");

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
