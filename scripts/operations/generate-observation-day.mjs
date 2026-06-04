import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const sourceDay = readJson("artifacts/go-live/dormitory/daily-observation-day-01.json");
const controlLoop = readJson("docs/operations/observation-control-loop.yml");
const taxonomy = readJson("docs/operations/incident-root-cause-taxonomy.yml");
const slo = readJson("docs/operations/dormitory-slo.yml");
const previousDay = readJsonIfExists("artifacts/operations/dormitory/observation-day-01.json") ?? {};
const day1OriginMainHead = "1a2fb45a89f3d1ef18eaf4ca216ecdc57660df30";

const failures = [];
assertFalse(sourceDay.productionAllowed, "source observation day 不得允许 production。");
assertFalse(sourceDay.l2ProductionAllowed, "source observation day 不得允许 L2。");
assertFalse(sourceDay.businessProductionAllowed, "source observation day 不得允许 Business Production。");
assertTrue(controlLoop.riskSignalToWorkItem?.required === true, "control loop 必须要求 RiskSignal 生成 WorkItem。");
assertTrue(controlLoop.resolutionToLens?.required === true, "control loop 必须要求 ResolutionEvent 更新 Lens。");

const incidentSamples = taxonomy.incidentSamples ?? [];
for (const incident of incidentSamples) {
  assertPresent(incident.rootCause, `incident ${incident.id} 缺少 rootCause。`);
  assertPresent(incident.workItemId, `incident ${incident.id} 缺少 WorkItem。`);
  assertPresent(incident.resolutionEventId, `incident ${incident.id} 缺少 ResolutionEvent。`);
  assertPresent(incident.lensUpdateRef, `incident ${incident.id} 缺少 Lens update。`);
}

const riskSignals = incidentSamples.map((incident) => ({
  riskSignalId: incident.riskSignalId,
  sourceIncidentId: incident.id,
  owner: incident.owner,
  severity: incident.severity,
  generatedWorkItemId: incident.workItemId,
  sla: "next_daily_review"
}));

const workItems = riskSignals.map((signal) => ({
  workItemId: signal.generatedWorkItemId,
  workItemType: controlLoop.riskSignalToWorkItem.workItemType,
  ownerRole: signal.owner,
  sla: signal.sla,
  escalationRequired: true
}));

const resolutionEvents = incidentSamples.map((incident) => ({
  resolutionEventId: incident.resolutionEventId,
  workItemId: incident.workItemId,
  lensUpdateRef: incident.lensUpdateRef,
  trainingUpdateRef: incident.trainingUpdateRef,
  policyUpdateRef: incident.policyUpdateRef,
  status: "closed"
}));

const result = {
  ...previousDay,
  generated_at_utc: generatedAt,
  generated_by: "generate-observation-day",
  branch: previousDay.branch ?? "main",
  headSha: previousDay.headSha ?? null,
  originMainHead: day1OriginMainHead,
  stage: "OAM-07",
  day: sourceDay.day,
  status: failures.length === 0 ? "passed" : "failed",
  decision: sourceDay.decision,
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  p0StopCount: sourceDay.p0StopCount,
  p1HoldCount: sourceDay.p1HoldCount,
  sloSummary: {
    sloCount: (slo.slos ?? []).length,
    green: sourceDay.p0StopCount === 0 && sourceDay.p1HoldCount === 0,
    financeDailyClose: sourceDay.financeDailyClose?.status,
    projectionLagP95Minutes: sourceDay.projectionLag?.p95Minutes,
    slaOverdue: sourceDay.slaMetrics?.overdueCount,
    rollbackReadiness: sourceDay.rollbackReadiness?.status
  },
  metricSnapshot: {
    financeDailyClose: sourceDay.financeDailyClose,
    evidenceMetrics: sourceDay.evidenceMetrics,
    projectionLag: sourceDay.projectionLag,
    slaMetrics: sourceDay.slaMetrics,
    rates: sourceDay.rates,
    gateStatus: sourceDay.gateStatus,
    rollbackReadiness: sourceDay.rollbackReadiness,
    training: sourceDay.training,
    support: sourceDay.support
  },
  incidents: incidentSamples,
  riskSignals,
  workItems,
  resolutionEvents,
  periodReview: {
    cadence: controlLoop.periodReview?.cadence,
    frozen: true,
    reviewArtifact: "artifacts/operations/dormitory/observation-day-01.json"
  },
  noGoItems: failures,
  evidenceRefs: [
    "artifacts/go-live/dormitory/daily-observation-day-01.json",
    "docs/operations/observation-control-loop.yml",
    "docs/operations/incident-root-cause-taxonomy.yml",
    "docs/operations/dormitory-slo.yml"
  ],
  nextAction: "继续 L1 Internal Pilot Observation Window；不得自动升级 L2。"
};

writeJson("artifacts/operations/dormitory/observation-day-01.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-07 observation day generation failed.");
}

console.log("OAM-07 observation day: PASS");

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function readJsonIfExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return null;
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
