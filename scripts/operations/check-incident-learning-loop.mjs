import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const day = readJson("artifacts/operations/dormitory/observation-day-01.json");
const taxonomy = readJson("docs/operations/incident-root-cause-taxonomy.yml");
const controlLoop = readJson("docs/operations/observation-control-loop.yml");
const readiness = readJson("artifacts/operations/dormitory/l1-to-l2-readiness.json");

const failures = [];
const categories = new Map((taxonomy.categories ?? []).map((item) => [item.id, item]));

assertFalse(day.productionAllowed, "observation day 不得允许 production。");
assertFalse(day.l2ProductionAllowed, "observation day 不得允许 L2。");
assertFalse(readiness.productionAllowed, "readiness 不得允许 production。");
assertFalse(readiness.l2ProductionAllowed, "readiness 不得允许 L2。");
assertTrue(controlLoop.learningLoop?.rootCauseRequired === true, "learning loop 必须要求 root cause。");

for (const incident of day.incidents ?? []) {
  const category = categories.get(incident.rootCause);
  assertTrue(Boolean(category), `incident ${incident.id} rootCause 未登记：${incident.rootCause}`);
  assertPresent(incident.owner, `incident ${incident.id} 缺少 owner。`);
  assertPresent(incident.riskSignalId, `incident ${incident.id} 缺少 RiskSignal。`);
  assertPresent(incident.workItemId, `incident ${incident.id} 缺少 WorkItem。`);
  assertPresent(incident.resolutionEventId, `incident ${incident.id} 缺少 ResolutionEvent。`);
  assertPresent(incident.lensUpdateRef, `incident ${incident.id} 缺少 Lens update。`);
  if (category?.requiresTrainingUpdate) assertPresent(incident.trainingUpdateRef, `incident ${incident.id} 缺少 training update。`);
  if (category?.requiresPolicyUpdate) assertPresent(incident.policyUpdateRef, `incident ${incident.id} 缺少 policy update。`);
}

for (const riskSignal of day.riskSignals ?? []) {
  assertPresent(riskSignal.generatedWorkItemId, `RiskSignal ${riskSignal.riskSignalId} 未生成 WorkItem。`);
  assertPresent(riskSignal.owner, `RiskSignal ${riskSignal.riskSignalId} 缺少 owner。`);
}

for (const resolution of day.resolutionEvents ?? []) {
  assertPresent(resolution.workItemId, `ResolutionEvent ${resolution.resolutionEventId} 缺少 WorkItem。`);
  assertPresent(resolution.lensUpdateRef, `ResolutionEvent ${resolution.resolutionEventId} 缺少 Lens update。`);
}

const result = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "check-incident-learning-loop",
  stage: "OAM-07",
  status: failures.length === 0 ? "passed" : "failed",
  incidentCount: (day.incidents ?? []).length,
  riskSignalCount: (day.riskSignals ?? []).length,
  workItemCount: (day.workItems ?? []).length,
  resolutionEventCount: (day.resolutionEvents ?? []).length,
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  noGoItems: failures,
  evidenceRefs: [
    "docs/operations/incident-root-cause-taxonomy.yml",
    "docs/operations/observation-control-loop.yml",
    "artifacts/operations/dormitory/observation-day-01.json",
    "artifacts/operations/dormitory/l1-to-l2-readiness.json"
  ]
};
writeJson("artifacts/operations/dormitory/incident-learning-loop-result.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-07 incident learning loop failed.");
}

console.log("OAM-07 incident learning loop: PASS");

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

function assertPresent(value, message) {
  if (value === undefined || value === null || value === "") failures.push(message);
}
