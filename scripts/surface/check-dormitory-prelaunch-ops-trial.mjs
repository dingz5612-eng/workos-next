import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileDigest, writeJson } from "../oam/lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const reportPath = "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json";
const resultPath = "artifacts/oam/checks/dormitory-prelaunch-ops-trial-result.json";
const currentHead = command("git rev-parse HEAD");
const failures = [];
const report = readJsonIfExists(reportPath);

if (!report) {
  fail("prelaunch ops trial report missing.");
} else {
  if (report.version !== "oam.dormitory-prelaunch-ops-trial.v1") fail("report version mismatch.");
  if (report.status !== "passed") fail(`report must be passed, actual ${report.status ?? "missing"}.`);
  if (report.git?.headSha !== currentHead) fail(`report is stale: expected ${currentHead}, actual ${report.git?.headSha ?? "missing"}.`);
  if ((report.roleTrials ?? []).length !== 4) fail("role trial must cover operator, manager, finance, and admin.");
  for (const role of ["operator", "manager", "finance", "admin"]) {
    const item = (report.roleTrials ?? []).find((candidate) => candidate.roleId === role);
    if (!item) {
      fail(`role trial missing: ${role}.`);
      continue;
    }
    if (item.status !== "passed") fail(`role trial must pass: ${role}.`);
    if (!(item.surfaces ?? []).length) fail(`role trial must include screenshots: ${role}.`);
    for (const surface of item.surfaces ?? []) {
      if (surface.status !== "passed") fail(`role surface must pass: ${role}/${surface.id}.`);
      if (!surface.screenshot?.path || !fs.existsSync(path.join(root, surface.screenshot.path))) fail(`role screenshot missing: ${role}/${surface.id}.`);
      if ((surface.forbiddenVisibleTerms ?? []).length) fail(`role surface exposes forbidden terms: ${role}/${surface.id}.`);
    }
  }
  if ((report.scenarioTrials ?? []).length !== 13) fail("scenario trial must cover 13 scenarios.");
  for (let scenarioNo = 1; scenarioNo <= 13; scenarioNo++) {
    const item = (report.scenarioTrials ?? []).find((candidate) => candidate.scenarioNo === scenarioNo);
    if (!item) {
      fail(`scenario trial missing: ${scenarioNo}.`);
      continue;
    }
    if (item.status !== "passed") fail(`scenario trial must pass: ${scenarioNo}.`);
    if (!item.positiveReport || !fs.existsSync(path.join(root, item.positiveReport))) fail(`positive report missing for scenario ${scenarioNo}.`);
    if (!item.negativeReport || !fs.existsSync(path.join(root, item.negativeReport))) fail(`negative report missing for scenario ${scenarioNo}.`);
    if (item.positiveScreenshotCount <= 0) fail(`positive screenshots missing for scenario ${scenarioNo}.`);
    if (item.negativeScreenshotCount <= 0) fail(`negative screenshots missing for scenario ${scenarioNo}.`);
    for (const check of item.checks ?? []) {
      if (check.passed !== true) fail(`scenario ${scenarioNo} check failed: ${check.id}.`);
    }
  }
  for (const item of report.operationsDelivery ?? []) {
    if (item.status !== "passed") fail(`operations delivery check failed: ${item.id}.`);
  }
  if ((report.p0p1Findings ?? []).length !== 0) fail("P0/P1 findings must be empty.");
  if ((report.blockers ?? []).length !== 0) fail("blockers must be empty.");
  if (!report.screenshotIndex || !fs.existsSync(path.join(root, report.screenshotIndex))) fail("screenshot index missing.");
  if (report.productionConfirmAllowed !== false || report.businessGoLiveAllowed !== false || report.releaseAuthority !== false || report.finalGoNoGo !== "NO_GO") {
    fail("NO_GO boundaries must remain closed.");
  }
}

const result = {
  version: "oam.dormitory-prelaunch-ops-trial-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  reportPath,
  reportDigest: report ? fileDigest(reportPath, root) : "missing",
  currentHead,
  roleTrialCount: report?.roleTrials?.length ?? 0,
  scenarioTrialCount: report?.scenarioTrials?.length ?? 0,
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory prelaunch ops trial check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory prelaunch ops trial check: PASS (${result.reportDigest})`);

function readJsonIfExists(file) {
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
