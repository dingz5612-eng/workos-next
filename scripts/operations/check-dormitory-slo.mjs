import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const slo = readJson("docs/operations/dormitory-slo.yml");
const observation = readJson("docs/go-live/dormitory/observation-window.yml");
const metricContract = readJson("docs/go-live/dormitory/observation-metric-contract.yml");

const failures = [];
const requiredDailyChecks = metricContract.requiredDailyChecks ?? [];

assertEqual(slo.stage, "OAM-07", "SLO contract stage 必须是 OAM-07。");
assertEqual(slo.businessLine, "Dormitory", "SLO contract 必须绑定 Dormitory。");
assertFalse(slo.productionAllowed, "SLO contract 不得允许 production。");
assertFalse(slo.l2ProductionAllowed, "SLO contract 不得允许 L2。");
assertFalse(slo.businessProductionAllowed, "SLO contract 不得允许 Business Production。");
assertTrue(slo.neverAutoUpgradeToL2 === true, "SLO contract 必须禁止 L1 自动升级 L2。");
assertTrue(slo.finalSystemGateBlockedMeansNoProductionGo === true, "Final System Gate blocked 时不得 production GO。");
assertEqual(slo.requiredCleanDaysForL2Candidate, 7, "L2 candidate 至少需要 7 天 clean observation。");

const sloLabels = new Set((slo.slos ?? []).map((item) => item.label));
for (const label of requiredDailyChecks) {
  assertTrue(sloLabels.has(label), `SLO contract 缺少每日指标：${label}`);
}

for (const item of slo.slos ?? []) {
  for (const field of ["id", "label", "source", "unit", "window", "dimension", "target", "holdThreshold", "stopThreshold", "owner"]) {
    assertPresent(item[field], `SLO ${item.id ?? item.label ?? "unknown"} 缺少 ${field}。`);
  }
}

const p0ControlByLabel = new Map((slo.p0StopControls ?? []).map((item) => [item.label, item]));
for (const label of observation.stopConditions ?? []) {
  const control = p0ControlByLabel.get(label);
  assertTrue(Boolean(control), `P0 stop 缺少控制动作：${label}`);
  assertPresent(control?.owner, `P0 stop ${label} 缺少 owner。`);
  assertPresent(control?.action, `P0 stop ${label} 缺少 action。`);
  assertPresent(control?.recoveryCondition, `P0 stop ${label} 缺少 recoveryCondition。`);
}

const p1ControlByLabel = new Map((slo.p1HoldControls ?? []).map((item) => [item.label, item]));
for (const label of observation.holdConditions ?? []) {
  const control = p1ControlByLabel.get(label);
  assertTrue(Boolean(control), `P1 hold 缺少控制动作：${label}`);
  assertPresent(control?.owner, `P1 hold ${label} 缺少 owner。`);
  assertPresent(control?.dailyReviewAction, `P1 hold ${label} 缺少 dailyReviewAction。`);
}

const result = {
  generated_at_utc: generatedAt,
  generated_by: "check-dormitory-slo",
  stage: "OAM-07",
  status: failures.length === 0 ? "passed" : "failed",
  businessLine: "Dormitory",
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  sloCount: (slo.slos ?? []).length,
  p0StopControlCount: (slo.p0StopControls ?? []).length,
  p1HoldControlCount: (slo.p1HoldControls ?? []).length,
  requiredDailyChecks,
  noGoItems: failures,
  evidenceRefs: [
    "docs/operations/dormitory-slo.yml",
    "docs/go-live/dormitory/observation-window.yml",
    "docs/go-live/dormitory/observation-metric-contract.yml"
  ]
};
writeJson("artifacts/operations/dormitory/slo-result.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-07 dormitory SLO contract failed.");
}

console.log("OAM-07 dormitory SLO contract: PASS");

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function assertPresent(value, message) {
  if (value === undefined || value === null || value === "") failures.push(message);
}
