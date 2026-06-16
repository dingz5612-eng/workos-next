import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileDigest, writeJson } from "../oam/lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const reportPath = "artifacts/oam/evidence/dormitory-13-scenario-entry-browser/entry-browser-report.json";
const resultPath = "artifacts/oam/checks/dormitory-13-scenario-entry-browser-result.json";
const currentHead = command("git rev-parse HEAD");
const failures = [];
const report = readJsonIfExists(reportPath);

if (!report) {
  fail("entry browser report missing.");
} else {
  if (report.version !== "oam.dormitory-13-scenario-entry-browser.v1") fail("entry browser report version mismatch.");
  if (report.status !== "passed") fail(`entry browser report must be passed, actual ${report.status ?? "missing"}.`);
  if (report.git?.headSha !== currentHead) fail(`entry browser report is stale: expected ${currentHead}, actual ${report.git?.headSha ?? "missing"}.`);
  if ((report.scenarioCount ?? 0) !== 13) fail("entry browser report scenarioCount must be 13.");
  if ((report.scenarios ?? []).length !== 13) fail("entry browser report must contain 13 scenario entries.");
  if ((report.entrySurfaces ?? []).length < 5) fail("entry browser report must cover home/today/workItems/operation/mine surfaces.");
  if ((report.findings ?? []).length !== 0) fail("entry browser report findings must be empty.");
  for (const scenario of report.scenarios ?? []) {
    if (scenario.status !== "passed") fail(`scenario ${scenario.scenarioNo} entry status must be passed.`);
    if (scenario.scenarioNo === 1 && scenario.expectedButton !== "开始办理") fail("scenario 1 expected button must be 开始办理.");
    if (scenario.scenarioNo !== 1 && scenario.expectedButton !== "查看详情") fail(`scenario ${scenario.scenarioNo} expected button must be 查看详情.`);
    if (!scenario.screenshot?.path || !fs.existsSync(path.join(root, scenario.screenshot.path))) {
      fail(`scenario ${scenario.scenarioNo} screenshot missing.`);
    }
  }
  for (const surface of report.entrySurfaces ?? []) {
    if (surface.status !== "passed") fail(`surface ${surface.id} status must be passed.`);
    if (!surface.screenshot?.path || !fs.existsSync(path.join(root, surface.screenshot.path))) {
      fail(`surface ${surface.id} screenshot missing.`);
    }
  }
  if (!report.screenshotIndex || !fs.existsSync(path.join(root, report.screenshotIndex))) fail("entry browser screenshot index missing.");
  if (report.productionConfirmAllowed !== false || report.releaseAuthority !== false || report.finalGoNoGo !== "NO_GO") {
    fail("entry browser report must keep production/release/final GO closed.");
  }
}

const result = {
  version: "oam.dormitory-13-scenario-entry-browser-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  reportPath,
  reportDigest: report ? fileDigest(reportPath, root) : "missing",
  scenarioCount: report?.scenarios?.length ?? 0,
  entrySurfaceCount: report?.entrySurfaces?.length ?? 0,
  currentHead,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory 13 scenario entry browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory 13 scenario entry browser audit check: PASS (${result.reportDigest})`);

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
