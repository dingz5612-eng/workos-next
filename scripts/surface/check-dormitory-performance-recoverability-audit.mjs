import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileDigest, writeJson } from "../oam/lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const reportPath = "artifacts/oam/evidence/dormitory-performance-recoverability/performance-recoverability-report.json";
const resultPath = "artifacts/oam/checks/dormitory-performance-recoverability-result.json";
const currentHead = command("git rev-parse HEAD");
const failures = [];
const report = readJsonIfExists(reportPath);

if (!report) {
  fail("performance and recoverability report missing.");
} else {
  if (report.version !== "oam.dormitory-performance-recoverability-browser.v1") fail("performance and recoverability report version mismatch.");
  if (report.status !== "passed") fail(`performance and recoverability report must be passed, actual ${report.status ?? "missing"}.`);
  if (report.git?.headSha !== currentHead) fail(`performance and recoverability report is stale: expected ${currentHead}, actual ${report.git?.headSha ?? "missing"}.`);
  if ((report.findings ?? []).length !== 0) fail("performance and recoverability findings must be empty.");
  if ((report.measurements ?? []).length < 7) fail("performance audit must include all expected measurements.");
  for (const item of report.measurements ?? []) {
    if (typeof item.durationMs !== "number" || typeof item.thresholdMs !== "number") {
      fail(`measurement ${item.metric ?? "(unknown)"} must include numeric duration and threshold.`);
      continue;
    }
    if (item.durationMs > item.thresholdMs) fail(`measurement ${item.metric} exceeded threshold: ${item.durationMs} > ${item.thresholdMs}.`);
  }
  for (const expected of ["duplicate-submit", "business-validation"]) {
    const item = (report.recoverability ?? []).find((candidate) => candidate.id === expected);
    if (!item) fail(`recoverability item missing: ${expected}.`);
    else if (item.status !== "passed") fail(`recoverability item must pass: ${expected}.`);
  }
  for (const assertion of report.assertions ?? []) {
    if (assertion.status !== "passed") fail(`assertion must pass: ${assertion.id ?? "(unknown)"}.`);
  }
  for (const screenshot of report.screenshots ?? []) {
    if (!screenshot.path || !fs.existsSync(path.join(root, screenshot.path))) fail(`screenshot missing: ${screenshot.id ?? "(unknown)"}.`);
  }
  if (!report.screenshotIndex || !fs.existsSync(path.join(root, report.screenshotIndex))) fail("performance screenshot index missing.");
  if (report.productionConfirmAllowed !== false || report.releaseAuthority !== false || report.finalGoNoGo !== "NO_GO") {
    fail("performance report must keep production/release/final GO closed.");
  }
}

const result = {
  version: "oam.dormitory-performance-recoverability-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  reportPath,
  reportDigest: report ? fileDigest(reportPath, root) : "missing",
  measurementCount: report?.measurements?.length ?? 0,
  recoverabilityCount: report?.recoverability?.length ?? 0,
  currentHead,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory performance and recoverability audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory performance and recoverability audit check: PASS (${result.reportDigest})`);

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
