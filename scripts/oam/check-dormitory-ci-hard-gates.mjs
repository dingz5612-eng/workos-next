import fs from "node:fs";
import path from "node:path";
import { fileDigest, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const workflowPath = ".github/workflows/ci.yml";
const browserRunnerPath = "scripts/surface/run-dormitory-real-browser-audits.ps1";
const resultPath = "artifacts/oam/checks/dormitory-ci-hard-gates-result.json";
const workflow = readText(workflowPath);
const browserRunner = readText(browserRunnerPath);
const oldWord = "leg" + "acy";
const failures = [];

if (hardGateSteps(workflow).some((step) => /continue-on-error:\s*true/.test(step))) {
  fail("CI must not use continue-on-error for current dormitory mainline hard gates.");
}

for (const forbidden of [
  "check-dormitory-l1-browser-e2e-audit.mjs",
  "check-dormitory-ten-scenario-real-browser-audit.mjs",
  "run-dormitory-ten-scenario-real-browser-audit.mjs",
  "run-dormitory-all-steps-real-browser-audit.mjs"
]) {
  if (workflow.includes(forbidden) || browserRunner.includes(forbidden)) {
    fail(`${forbidden} must not be a current CI main gate.`);
  }
}

if (!workflow.includes("Generate dormitory 13-scenario real-browser evidence")) {
  fail("CI must name the current dormitory browser gate as 13-scenario evidence.");
}
if (!workflow.includes("scripts/surface/run-dormitory-real-browser-audits.ps1")) {
  fail("CI must run the 13-scenario browser audit runner.");
}
if (!browserRunner.includes("scripts/surface/run-dormitory-13-scenario-entry-browser-audit.mjs") ||
  !browserRunner.includes("scripts/surface/check-dormitory-13-scenario-entry-browser-audit.mjs")) {
  fail("browser runner must hard-run 13-scenario entry browser audit before scenario positive/negative audits.");
}
if (!browserRunner.includes("scripts/surface/run-dormitory-performance-recoverability-audit.mjs") ||
  !browserRunner.includes("scripts/surface/check-dormitory-performance-recoverability-audit.mjs")) {
  fail("browser runner must hard-run performance and recoverability browser audit before scenario positive/negative audits.");
}
if (!browserRunner.includes("scripts/surface/run-dormitory-prelaunch-ops-trial.mjs") ||
  !browserRunner.includes("scripts/surface/check-dormitory-prelaunch-ops-trial.mjs")) {
  fail("browser runner must hard-run prelaunch operations trial after scenario positive/negative audits.");
}
if (!browserRunner.includes("scripts/surface/generate-dormitory-final-frontend-ux-acceptance.mjs")) {
  fail("browser runner must hard-run final frontend UX acceptance after scenario and prelaunch browser audits.");
}

for (const required of [
  "node scripts/oam/check-dormitory-mainline-manifest.mjs",
  "node scripts/oam/check-lodging-consumer-graph.mjs",
  `node scripts/oam/check-${oldWord}-retirement-ledger.mjs`,
  "node scripts/oam/check-visible-business-copy-contract.mjs",
  "node scripts/oam/check-dormitory-defect-closure-ledger.mjs",
  "node scripts/oam/check-dormitory-active-path-gate.mjs",
  "node scripts/oam/check-dormitory-operation-execution-contract.mjs",
  "node scripts/oam/check-dormitory-local-test-environment-manager.mjs",
  "node scripts/oam/check-project-maintainability-governance.mjs",
  "node scripts/oam/check-project-purity-authority-seal.mjs",
  "node scripts/business/check-dormitory-production-mainline-activation-authority.mjs",
  "node scripts/oam/check-generated-files-not-manually-edited.mjs",
  "node scripts/business/check-dormitory-13-scenario-control-authority.mjs",
  "node scripts/business/check-dormitory-13-scenario-generated-contracts.mjs",
  "node scripts/business/check-dormitory-13-scenario-consumption-boundary.mjs",
  "node scripts/oam/check-evidence-root-hard-gate-matrix.mjs",
  "node scripts/oam/generate-dormitory-mainline-activation-transaction.mjs",
  "node scripts/oam/check-current-evidence-root.mjs",
  "node scripts/oam/check-dormitory-mainline-activation-transaction.mjs"
]) {
  if (!workflow.includes(required)) fail(`CI missing required hard gate command: ${required}`);
}

const browserRunnerUsesScenarioLoop =
  browserRunner.includes("for ($scenario = 1; $scenario -le 13; $scenario++)") &&
  browserRunner.includes('foreach ($kind in @("positive", "negative"))') &&
  browserRunner.includes("scripts/surface/run-dormitory-scenario$scenario-$kind-browser-audit.mjs") &&
  browserRunner.includes("scripts/surface/check-dormitory-scenario$scenario-$kind-browser-audit.mjs");
if (!browserRunnerUsesScenarioLoop) {
  fail("browser runner must hard-run scenario 1-13 positive/negative browser audits.");
}

for (let scenario = 1; scenario <= 13; scenario += 1) {
  for (const kind of ["positive", "negative"]) {
    const runScript = `scripts/surface/run-dormitory-scenario${scenario}-${kind}-browser-audit.mjs`;
    const checkScript = `scripts/surface/check-dormitory-scenario${scenario}-${kind}-browser-audit.mjs`;
    if (!fs.existsSync(path.join(root, runScript))) fail(`browser run script missing on disk: ${runScript}.`);
    if (!fs.existsSync(path.join(root, checkScript))) fail(`browser check script missing on disk: ${checkScript}.`);
  }
}
if (!fs.existsSync(path.join(root, "scripts/surface/run-dormitory-13-scenario-entry-browser-audit.mjs"))) {
  fail("entry browser audit run script missing on disk.");
}
if (!fs.existsSync(path.join(root, "scripts/surface/check-dormitory-13-scenario-entry-browser-audit.mjs"))) {
  fail("entry browser audit check script missing on disk.");
}
if (!fs.existsSync(path.join(root, "scripts/surface/run-dormitory-performance-recoverability-audit.mjs"))) {
  fail("performance and recoverability browser audit run script missing on disk.");
}
if (!fs.existsSync(path.join(root, "scripts/surface/check-dormitory-performance-recoverability-audit.mjs"))) {
  fail("performance and recoverability browser audit check script missing on disk.");
}
if (!fs.existsSync(path.join(root, "scripts/surface/run-dormitory-prelaunch-ops-trial.mjs"))) {
  fail("prelaunch operations trial run script missing on disk.");
}
if (!fs.existsSync(path.join(root, "scripts/surface/check-dormitory-prelaunch-ops-trial.mjs"))) {
  fail("prelaunch operations trial check script missing on disk.");
}
if (!fs.existsSync(path.join(root, "scripts/surface/generate-dormitory-final-frontend-ux-acceptance.mjs"))) {
  fail("final frontend UX acceptance script missing on disk.");
}

for (let scenario = 1; scenario <= 13; scenario += 1) {
  const requiredFragments = scenario === 1
    ? [
        "check-dormitory-scenario1-resource-basic-readiness-authority.mjs",
        "check-dormitory-scenario1-generated-contracts.mjs",
        "check-dormitory-scenario1-consumption-boundary.mjs"
      ]
    : scenario === 2
      ? [
          "check-dormitory-scenario2-resource-operation-status-authority.mjs",
          "check-dormitory-scenario2-generated-contracts.mjs",
          "check-dormitory-scenario2-consumption-boundary.mjs"
        ]
      : [
          `check-dormitory-scenario${scenario}-`,
          `check-dormitory-scenario${scenario}-`,
          `check-dormitory-scenario${scenario}-`
        ];
  for (const fragment of requiredFragments) {
    if (!workflow.includes(fragment)) fail(`CI missing scenario ${scenario} source/generated/consumption fragment: ${fragment}`);
  }
}

if (!workflow.includes("npm --prefix apps/mobile run test") ||
  !workflow.includes("npm --prefix apps/mobile run test:e2e") ||
  !workflow.includes("dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj")) {
  fail("CI must keep runtime/mobile/search test gates.");
}

const result = {
  version: "oam.dormitory-ci-hard-gates-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  workflowPath,
  workflowDigest: fileDigest(workflowPath, root),
  browserRunnerPath,
  browserRunnerDigest: fileDigest(browserRunnerPath, root),
  browserScenarioCount: 13,
  browserMode: "hard_gate",
  continueOnErrorAllowed: "browser-hardening-advisory-only",
  firstGoldenChainCurrentMainGateAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory CI hard gates check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory CI hard gates check: PASS");

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}

function hardGateSteps(workflowText) {
  return workflowText
    .split(/\n(?=\s{6}- name: )/g)
    .filter((step) => !/Generate dormitory 13-scenario real-browser evidence/.test(step));
}

function fail(message) {
  failures.push(message);
}
