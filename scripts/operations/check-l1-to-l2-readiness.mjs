import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const gate = readJson("docs/operations/l1-to-l2-upgrade-gate.yml");
const day = readJson("artifacts/operations/dormitory/observation-day-01.json");
const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const d2Upgrade = readJson("artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json");

const failures = [];
assertFalse(gate.productionAllowed, "OAM-07 L1->L2 gate 不得允许 production。");
assertFalse(gate.l2ProductionAllowed, "OAM-07 L1->L2 gate 不得允许 L2。");
assertFalse(gate.businessProductionAllowed, "OAM-07 L1->L2 gate 不得允许 Business Production。");
assertTrue(gate.defaultEligible === false, "OAM-07 L1->L2 gate 必须 defaultEligible=false。");
assertTrue(gate.requiresSeparateStage === true, "L1->L2 必须单独 stage。");
assertTrue(gate.requiresSeparatePr === true, "L1->L2 必须单独 PR。");

const latestMainCiGreen = goNoGo.latestMain?.ci?.status === "completed" && goNoGo.latestMain?.ci?.conclusion === "success";
const latestMainV54Green = goNoGo.latestMain?.v54ControlPlaneGuards?.status === "completed" && goNoGo.latestMain?.v54ControlPlaneGuards?.conclusion === "success";
const cleanDays = day.p0StopCount === 0 ? 1 : 0;
const financeDailyClose100 = day.metricSnapshot?.financeDailyClose?.status === "passed";
const noRedShadow = Number(day.metricSnapshot?.gateStatus?.redShadowCompareReportCount ?? 0) === 0;
const noUnresolvedP0Invariant = Number(day.metricSnapshot?.gateStatus?.unresolvedP0InvariantCount ?? 0) === 0;
const evidenceMissingBelowThreshold = Number(day.metricSnapshot?.evidenceMetrics?.missingRate ?? 1) <= gate.candidateOnlyAfter.evidenceMissingRateMax;
const projectionLagBelowThreshold = Number(day.metricSnapshot?.projectionLag?.p95Minutes ?? 999) <= gate.candidateOnlyAfter.projectionLagP95MaxMinutes;
const rollbackGreen = day.metricSnapshot?.rollbackReadiness?.status === "green";

const criteria = [
  criterion("default_not_eligible", gate.defaultEligible === false, "默认必须 not eligible。"),
  criterion("seven_days_no_p0", cleanDays >= gate.candidateOnlyAfter.cleanObservationDays, `已观察 ${cleanDays} 个 clean day，需要 ${gate.candidateOnlyAfter.cleanObservationDays} 天。`),
  criterion("no_unresolved_p1_hold", Number(day.p1HoldCount ?? 0) === 0, "存在未解决 P1 hold。"),
  criterion("finance_daily_close_100", financeDailyClose100, "finance daily close 未达到 100%。"),
  criterion("no_red_shadow", noRedShadow, "存在 Red ShadowCompareReport。"),
  criterion("no_unresolved_p0_invariant", noUnresolvedP0Invariant, "存在 unresolved P0 invariant。"),
  criterion("evidence_missing_rate_below_threshold", evidenceMissingBelowThreshold, "证据缺失率超过阈值。"),
  criterion("projection_lag_below_threshold", projectionLagBelowThreshold, "projection lag 超过阈值。"),
  criterion("rollback_readiness_green", rollbackGreen, "rollback readiness 非 green。"),
  criterion("latest_main_ci_green", latestMainCiGreen, "latest main CI 未 green。"),
  criterion("latest_main_v54_guards_green", latestMainV54Green, "latest main V5.4 Guards 未 green。"),
  criterion("final_system_gate_blocks_production", true, "Final System Gate blocked 时不得 production GO。")
];

const result = {
  generated_at_utc: generatedAt,
  generated_by: "check-l1-to-l2-readiness",
  stage: "OAM-07",
  status: "NOT_ELIGIBLE",
  eligible: false,
  decision: "continue_l1_observation",
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  latestMain: goNoGo.latestMain,
  latestMainCiGreen,
  latestMainV54Green,
  cleanDaysObserved: cleanDays,
  requiredCleanDays: gate.candidateOnlyAfter.cleanObservationDays,
  finalSystemGateStatus: "blocked",
  d2UpgradeDecision: d2Upgrade.decision,
  criteria,
  blockers: [
    "L1 observation window 未满 7 天。",
    "L1 -> L2 必须单独 stage / PR / gate。",
    "Final System Gate blocked 时不得 production GO。"
  ],
  evidenceRefs: [
    "docs/operations/l1-to-l2-upgrade-gate.yml",
    "artifacts/operations/dormitory/observation-day-01.json",
    "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
    "artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json"
  ],
  noGoItems: failures,
  nextAction: "继续 L1 Internal Pilot Observation Window；不得进入 L2。"
};

assertTrue(result.eligible === false, "OAM-07 readiness 必须保持 not eligible。");
assertFalse(result.productionAllowed, "OAM-07 readiness 不得允许 production。");
assertFalse(result.l2ProductionAllowed, "OAM-07 readiness 不得允许 L2。");

writeJson("artifacts/operations/dormitory/l1-to-l2-readiness.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-07 L1-to-L2 readiness failed.");
}

console.log("OAM-07 L1-to-L2 readiness: NOT_ELIGIBLE");

function criterion(id, met, message) {
  return { id, status: met ? "met" : "not_met", ...(met ? {} : { message }) };
}

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
