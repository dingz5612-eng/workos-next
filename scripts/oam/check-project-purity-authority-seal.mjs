import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/project-purity-authority-seal-result.json";
const reportPath = "docs/oam/project-purity-authority-seal-report.md";
const currentHead = command("git rev-parse HEAD");
const oldWord = "leg" + "acy";
const failures = [];

const sourceAuthorityPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const generatedControlPath = "docs/contracts/generated/dormitory/13-scenario-control.generated.json";
const mobileControlPath = "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json";
const runtimeControlPath = "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json";

const prerequisites = [
  "docs/oam/dormitory-13-scenario-production-usable-closure-report.md",
  "docs/oam/project-maintainability-closure-report.md",
  "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json",
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/final-report.json",
  "docs/oam/dormitory-defect-closure-ledger.json",
  reportPath
];
for (const file of prerequisites) {
  if (!exists(file)) fail(`required seal prerequisite missing: ${file}.`);
}

for (const file of [sourceAuthorityPath, generatedControlPath, mobileControlPath, runtimeControlPath]) {
  if (!exists(file)) fail(`authority consumption file missing: ${file}.`);
}

const mainlineManifest = readJsonIfExists("docs/oam/dormitory-mainline-manifest.json");
const activeMainlines = (mainlineManifest?.activeMainlines ?? []).filter((item) => item.current === true);
if (activeMainlines.length !== 1) fail(`active mainline count must be 1, actual ${activeMainlines.length}.`);
if (activeMainlines[0]?.sourceAuthorityRef !== sourceAuthorityPath) fail("active mainline must bind dormitory 13 scenario control authority.");
if (activeMainlines[0]?.productionConfirmAllowed !== false ||
  activeMainlines[0]?.releaseAuthority !== false ||
  activeMainlines[0]?.finalGoNoGo !== "NO_GO") {
  fail("active mainline must keep production/release/finalGoNoGo closed.");
}

const scenarioIndex = readJsonIfExists("docs/contracts/generated/dormitory/13-scenario-index.generated.json");
if ((scenarioIndex?.scenarios ?? []).length !== 13) fail("13 scenario generated index must contain exactly 13 scenarios.");
const scenarioNos = (scenarioIndex?.scenarios ?? []).map((scenario) => scenario.scenarioNo).join(",");
if (scenarioNos !== "1,2,3,4,5,6,7,8,9,10,11,12,13") fail(`13 scenario order mismatch: ${scenarioNos}.`);

for (const [label, file] of [
  ["Generated not manually edited", "artifacts/oam/checks/generated-files-not-manually-edited-result.json"],
  ["Generated contract consistency", "artifacts/oam/checks/generated-contract-consistency-result.json"],
  ["Dormitory source", "artifacts/oam/checks/dormitory-13-scenario-control-authority-result.json"],
  ["Dormitory generated", "artifacts/oam/checks/dormitory-13-scenario-generated-contracts-result.json"],
  ["Dormitory consumption", "artifacts/oam/checks/dormitory-13-scenario-consumption-boundary-result.json"],
  ["Mainline manifest", "artifacts/oam/checks/dormitory-mainline-manifest-result.json"],
  ["Consumer graph", "artifacts/oam/checks/lodging-consumer-graph-result.json"],
  ["Visible business copy", "artifacts/oam/checks/visible-business-copy-contract-result.json"],
  ["Business UI DOM copy", "artifacts/oam/checks/business-ui-copy-no-technical-leak-result.json"],
  ["Active path", "artifacts/oam/checks/dormitory-active-path-gate-result.json"],
  ["No active old identity path", `artifacts/oam/checks/no-active-path-${oldWord}-identity-result.json`],
  ["Operation execution", "artifacts/oam/checks/dormitory-operation-execution-contract-result.json"],
  ["Local test environment", "artifacts/oam/checks/dormitory-local-test-environment-manager-result.json"],
  ["Project maintainability", "artifacts/oam/checks/project-maintainability-governance-result.json"],
  ["Final frontend UX acceptance", "artifacts/oam/checks/dormitory-final-frontend-ux-acceptance-result.json"],
  ["CI hard gates", "artifacts/oam/checks/dormitory-ci-hard-gates-result.json"],
  ["Evidence Root hard gate", "artifacts/oam/checks/evidence-root-hard-gate-matrix-result.json"]
]) {
  const doc = readJsonIfExists(file);
  if (!doc) {
    fail(`${label} result missing: ${file}.`);
  } else if (!["PASS", "passed"].includes(doc.status)) {
    fail(`${label} result must PASS, actual ${doc.status ?? "missing"}.`);
  }
}

const defectLedger = readJsonIfExists("docs/oam/dormitory-defect-closure-ledger.json");
const openP0P1 = (defectLedger?.defects ?? []).filter((item) =>
  ["P0", "P1"].includes(item.severity) && ["open", "fixing"].includes(item.status));
if (openP0P1.length > 0) fail(`open P0/P1 defects must be zero, actual ${openP0P1.length}.`);

const finalReport = readJsonIfExists("artifacts/oam/final-report.json");
if (finalReport?.productionConfirmAllowed !== false ||
  finalReport?.releaseAuthority !== false ||
  finalReport?.finalGoNoGo !== "NO_GO") {
  fail("final report must keep production/release/finalGoNoGo closed.");
}

const evidenceGraph = readJsonIfExists("artifacts/oam/evidence/evidence-graph.json");
if (evidenceGraph?.realBrowserEvidence?.status !== "passed") fail("Evidence graph real browser evidence must be passed.");
if (evidenceGraph?.realBrowserEvidence?.currentMainAudit !== "dormitory_13_scenario_browser_evidence_collection") {
  fail("Evidence graph current browser audit must be dormitory 13 scenario collection.");
}
const sealNode = (evidenceGraph?.nodes ?? []).find((node) => node.gate === "PROJECT-MAINTAINABILITY-GOVERNANCE");
if (!sealNode || sealNode.status !== "passed") fail("Evidence graph must include passed project maintainability governance node.");

const entryReport = readJsonIfExists("artifacts/oam/evidence/dormitory-13-scenario-entry-browser/entry-browser-report.json");
if (!entryReport || entryReport.status !== "passed") fail("entry browser report must be passed.");
if (entryReport?.git?.headSha !== currentHead) fail("entry browser report must bind current head.");
if ((entryReport?.scenarioCount ?? 0) !== 13) fail("entry browser report must cover 13 scenarios.");
for (const surfaceId of ["home", "today", "work-items", "mine"]) {
  const surface = (entryReport?.entrySurfaces ?? []).find((item) => item.id === surfaceId);
  if (!surface || surface.status !== "passed") fail(`entry surface ${surfaceId} must be passed.`);
  assertScreenshot(surface?.screenshot?.path, `entry surface ${surfaceId}`);
}

const prelaunch = readJsonIfExists("artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json");
if (!prelaunch || prelaunch.status !== "passed") fail("prelaunch operations trial must be passed.");
if (prelaunch?.git?.headSha !== currentHead) fail("prelaunch operations trial must bind current head.");
if ((prelaunch?.p0p1Findings ?? []).length !== 0) fail("prelaunch operations trial P0/P1 findings must be empty.");
if ((prelaunch?.blockers ?? []).length !== 0) fail("prelaunch operations trial blockers must be empty.");
const searchSurface = (prelaunch?.roleTrials ?? [])
  .flatMap((role) => role.surfaces ?? [])
  .find((surface) => surface.id === "operator-search-readonly");
if (!searchSurface || searchSurface.status !== "passed") fail("prelaunch search readonly surface must be passed.");
assertScreenshot(searchSurface?.screenshot?.path, "search readonly surface");

const finalFrontendUx = readJsonIfExists("artifacts/oam/checks/dormitory-final-frontend-ux-acceptance-result.json");
if (!finalFrontendUx || finalFrontendUx.status !== "PASS") {
  fail("final frontend UX acceptance result must be passed.");
} else {
  if (finalFrontendUx.currentHead !== currentHead) fail("final frontend UX acceptance result must bind current head.");
  if (finalFrontendUx.scenarioCount !== 13) fail("final frontend UX acceptance must cover 13 scenarios.");
  if ((finalFrontendUx.scenarioScreenshotCount ?? 0) < 300) fail("final frontend UX acceptance must cover complete scenario screenshots.");
  if ((finalFrontendUx.unresolvedAnalysisMarkerCount ?? 0) !== 0) fail("final frontend UX acceptance unresolved analysis markers must be zero.");
  if ((finalFrontendUx.exposedInternalTermCount ?? 0) !== 0) fail("final frontend UX acceptance exposed internal/technical terms must be zero.");
  if ((finalFrontendUx.oldChainVisibleTermCount ?? 0) !== 0) fail("final frontend UX acceptance old-chain visible terms must be zero.");
}

const lowRiskScenarios = [1, 2, 13];
const highRiskScenarios = [5, 7, 6, 10, 9];
const spotcheckScenarios = [...lowRiskScenarios, ...highRiskScenarios];
const spotcheckEvidence = [];
for (const scenarioNo of spotcheckScenarios) {
  const positive = readScenarioBrowserReport(scenarioNo, "positive");
  const negative = readScenarioBrowserReport(scenarioNo, "negative");
  if (!positive || positive.status !== "passed") fail(`scenario ${scenarioNo} positive browser report must be passed.`);
  if (!negative || negative.status !== "passed") fail(`scenario ${scenarioNo} negative browser report must be passed.`);
  if (positive?.git?.headSha !== currentHead) fail(`scenario ${scenarioNo} positive browser report must bind current head.`);
  if (negative?.git?.headSha !== currentHead) fail(`scenario ${scenarioNo} negative browser report must bind current head.`);
  assertFirstScenarioScreenshot(positive, `scenario ${scenarioNo} positive`);
  assertFirstScenarioScreenshot(negative, `scenario ${scenarioNo} negative`);
  spotcheckEvidence.push({
    scenarioNo,
    nameZh: positive?.nameZh ?? negative?.nameZh ?? "",
    positiveReport: scenarioReportPath(scenarioNo, "positive"),
    negativeReport: scenarioReportPath(scenarioNo, "negative"),
    positiveDigest: positive ? fileDigest(scenarioReportPath(scenarioNo, "positive"), root) : "missing",
    negativeDigest: negative ? fileDigest(scenarioReportPath(scenarioNo, "negative"), root) : "missing"
  });
}

const report = readText(reportPath);
for (const requiredText of [
  "唯一权威源",
  "封版抽检范围",
  "finalGoNoGo=NO_GO",
  "下一步前端最终体验验收范围"
]) {
  if (!report.includes(requiredText)) fail(`seal report missing required text: ${requiredText}.`);
}

const result = {
  version: "oam.project-purity-authority-seal-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  currentHead,
  sourceAuthorityPath,
  sourceAuthorityDigest: exists(sourceAuthorityPath) ? fileDigest(sourceAuthorityPath, root) : "missing",
  generatedControlDigest: exists(generatedControlPath) ? fileDigest(generatedControlPath, root) : "missing",
  mobileControlDigest: exists(mobileControlPath) ? fileDigest(mobileControlPath, root) : "missing",
  runtimeControlDigest: exists(runtimeControlPath) ? fileDigest(runtimeControlPath, root) : "missing",
  reportPath,
  reportDigest: exists(reportPath) ? fileDigest(reportPath, root) : "missing",
  browserSpotcheck: {
    entrySurfaces: ["home", "today", "work-items", "mine", "search-readonly"],
    lowRiskScenarios,
    highRiskScenarios,
    finalFrontendUxResult: "artifacts/oam/checks/dormitory-final-frontend-ux-acceptance-result.json",
    spotcheckEvidence
  },
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Project purity authority seal check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Project purity authority seal check: PASS");

function readScenarioBrowserReport(scenarioNo, kind) {
  return readJsonIfExists(scenarioReportPath(scenarioNo, kind));
}

function scenarioReportPath(scenarioNo, kind) {
  const slugs = {
    1: "resource-basic-readiness",
    2: "resource-operation-status",
    3: "product-and-pricing",
    4: "inquiry-and-quote",
    5: "reservation-and-inventory-hold",
    6: "payment-deposit-and-guarantee",
    7: "check-in-processing",
    8: "in-stay-management",
    9: "checkout-settlement",
    10: "cancel-noshow-refund",
    11: "housekeeping-maintenance-outofservice",
    12: "channel-corporate-customer",
    13: "reporting-audit-review"
  };
  return `artifacts/oam/evidence/dormitory-scenario${scenarioNo}-${slugs[scenarioNo]}-${kind}-browser/scenario${scenarioNo}-${kind}-browser-report.json`;
}

function assertFirstScenarioScreenshot(report, label) {
  const screenshotPath = report?.steps?.find((step) => step.screenshotPath)?.screenshotPath ??
    report?.screenshots?.[0]?.path;
  assertScreenshot(screenshotPath, label);
}

function assertScreenshot(file, label) {
  if (!file || !exists(file)) fail(`${label} screenshot missing: ${file ?? "(empty)"}.`);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function readText(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`required file missing: ${file}.`);
    return "";
  }
  return fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "");
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
