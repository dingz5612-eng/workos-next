import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const observationPath = "docs/go-live/dormitory/observation-window.yml";
const metricPath = "docs/go-live/dormitory/observation-metric-contract.yml";

const requiredDailyChecks = [
  "P0 stop count",
  "P1 hold count",
  "finance daily close",
  "deposit liability mismatch",
  "duplicate ledger entry",
  "evidence missing rate",
  "evidence rejected rate",
  "evidence upload failure rate",
  "wrong-scope evidence count",
  "projection lag p95",
  "SLA overdue",
  "403 / 409 / 422 rate",
  "idempotency conflict no side effect",
  "BStageGate status",
  "ShadowCompare status",
  "Invariant status",
  "rollback readiness",
  "training blocking issues",
  "support tickets"
];

const requiredP0Stops = [
  "money mismatch red",
  "duplicate ledger entry",
  "unbalanced ledger transaction",
  "deposit as revenue",
  "refund over liability",
  "bed double occupancy",
  "evidence leak",
  "wrong tenant evidence",
  "device trust bypass",
  "unable to rollback",
  "finance daily close failed",
  "BStageGate red",
  "Red ShadowCompareReport",
  "unresolved P0 invariant"
];

const requiredP1Holds = [
  "projection lag above threshold",
  "evidence upload failure above threshold",
  "evidence missing rate above threshold",
  "rejected 422 abnormal",
  "finance case backlog above threshold",
  "unclear money backlog above threshold",
  "SLA overdue above threshold",
  "training blocking issue open",
  "support ticket spike"
];

const observation = readJson(observationPath);
const metricContract = readJson(metricPath);

const failures = [];

assertEqual(metricContract.businessLine, "Dormitory", "metric contract businessLine 必须是 Dormitory。");
assertFalse(metricContract.productionAllowed, "metric contract 不得允许 production。");
assertFalse(observation.productionAllowed, "observation window 不得允许 production。");
assertFalse(observation.l2ProductionAllowed, "observation window 不得允许 L2 Production。");
assertEqual(observation.durationDays, 7, "observation window 必须是 7 天。");
assertEqual(observation.minimumCleanDaysForUpgrade, 7, "L1 -> L2 至少需要 7 天无 P0。");
assertTrue(observation.dailyDecisionRules?.neverAutoUpgradeToL2 === true, "observation window 必须禁止自动升级 L2。");

for (const item of requiredDailyChecks) {
  assertIncludes(metricContract.requiredDailyChecks, item, `缺少每日检查项：${item}`);
}

const p0Labels = (metricContract.p0StopMetrics ?? []).map((item) => item.label);
for (const item of requiredP0Stops) {
  assertIncludes(observation.stopConditions, item, `observation window 缺少 P0 stop：${item}`);
  assertIncludes(p0Labels, item, `metric contract 缺少 P0 stop metric：${item}`);
}

const p1Labels = (metricContract.p1HoldMetrics ?? []).map((item) => item.label);
for (const item of requiredP1Holds) {
  assertIncludes(observation.holdConditions, item, `observation window 缺少 P1 hold：${item}`);
  assertIncludes(p1Labels, item, `metric contract 缺少 P1 hold metric：${item}`);
}

const thresholds = metricContract.thresholds ?? {};
for (const key of [
  "evidenceMissingRateMax",
  "evidenceRejectedRateMax",
  "evidenceUploadFailureRateMax",
  "projectionLagP95MaxMinutes",
  "slaOverdueMax",
  "businessBlocked422RateMax",
  "financeCaseBacklogMax",
  "unclearMoneyBacklogMax",
  "supportTicketSpikeMax"
]) {
  assertTrue(typeof thresholds[key] === "number", `thresholds.${key} 必须是数字。`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Dormitory observation metric contract failed.");
}

console.log("Dormitory observation metric contract: PASS");

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function assertTrue(condition, message) {
  if (!condition) failures.push(message);
}

function assertFalse(value, message) {
  if (value !== false) failures.push(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) failures.push(`${message} actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

function assertIncludes(items, value, message) {
  if (!Array.isArray(items) || !items.includes(value)) failures.push(message);
}
