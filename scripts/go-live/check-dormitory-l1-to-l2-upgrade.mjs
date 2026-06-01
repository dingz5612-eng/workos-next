import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const observation = readJson("docs/go-live/dormitory/observation-window.yml");
const gate = readJson("docs/go-live/dormitory/l1-to-l2-upgrade-gate.yml");
const dayResults = readDayResults(observation.durationDays);
const internalPilotGoNoGo = readOptionalJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");

const failures = [];
const generatedAt = new Date().toISOString();
const mainHead = readMainHead();

const daysObserved = dayResults.length;
const totalP0 = dayResults.reduce((sum, item) => sum + Number(item.p0StopCount ?? 0), 0);
const totalP1 = dayResults.reduce((sum, item) => sum + Number(item.p1HoldCount ?? 0), 0);
const financeGreenDays = dayResults.filter((item) => item.financeDailyClose?.status === "passed").length;
const redShadowCount = dayResults.reduce((sum, item) => sum + Number(item.gateStatus?.redShadowCompareReportCount ?? 0), 0);
const unresolvedP0InvariantCount = dayResults.reduce((sum, item) => sum + Number(item.gateStatus?.unresolvedP0InvariantCount ?? 0), 0);
const rollbackGreen = dayResults.every((item) => item.rollbackReadiness?.status === "green");
const evidenceMissingBelowThreshold = dayResults.every((item) => Number(item.evidenceMetrics?.missingRate ?? 1) <= 0.02);
const projectionLagBelowThreshold = dayResults.every((item) => Number(item.projectionLag?.p95Minutes ?? 999) <= 5);

const criteria = [
  criterion("seven_days_no_p0", daysObserved >= 7 && totalP0 === 0, `已观察 ${daysObserved} 天，需要 7 天无 P0。`),
  criterion("no_unresolved_p1_hold", totalP1 === 0, "存在未解决 P1 hold。"),
  criterion("finance_daily_close_100", daysObserved > 0 && financeGreenDays === daysObserved, "finance daily close 未达到 100%。"),
  criterion("no_red_shadow", redShadowCount === 0, "存在 Red ShadowCompareReport。"),
  criterion("no_unresolved_p0_invariant", unresolvedP0InvariantCount === 0, "存在 unresolved P0 invariant。"),
  criterion("evidence_missing_rate_below_threshold", evidenceMissingBelowThreshold, "证据缺失率超过阈值。"),
  criterion("projection_lag_below_threshold", projectionLagBelowThreshold, "projection lag 超过阈值。"),
  criterion("rollback_readiness_green", rollbackGreen, "rollback readiness 非 green。"),
  criterion("latest_main_ci_green", false, "D2 不在本阶段授予 L2；latest main CI 需在单独 L1->L2 stage 重新验证。", "not_evaluated_until_upgrade_stage"),
  criterion("latest_main_v54_guards_green", false, "D2 不在本阶段授予 L2；latest main V5.4 Guards 需在单独 L1->L2 stage 重新验证。", "not_evaluated_until_upgrade_stage"),
  criterion("final_system_gate_not_blocked_for_production", false, "Final System Gate blocked 时不得 production GO。")
];

const result = {
  generated_at_utc: generatedAt,
  generated_by: "check-dormitory-l1-to-l2-upgrade",
  stage: "D2",
  status: "NOT_ELIGIBLE",
  eligible: false,
  decision: "continue_l1_observation",
  internalPilotAllowed: internalPilotGoNoGo?.internalPilotAllowed === true,
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  mainHead,
  daysObserved,
  requiredCleanDays: observation.minimumCleanDaysForUpgrade,
  p0StopCount: totalP0,
  p1HoldCount: totalP1,
  financeDailyCloseContinuity: `${financeGreenDays}/${daysObserved}`,
  finalSystemGateStatus: "blocked",
  requiresSeparateStage: gate.requiresSeparateStage === true,
  requiresSeparatePr: gate.requiresSeparatePr === true,
  criteria,
  blockers: [
    ...(daysObserved < 7 ? ["L1 observation window 未满 7 天。"] : []),
    "L1 -> L2 必须单独 stage / PR / gate。",
    "Final System Gate blocked 时不得 production GO。"
  ],
  nextAction: "继续 L1 Internal Pilot Observation Window；不得自动升级 L2 Production。"
};

assertFalse(gate.productionAllowed, "L1 -> L2 gate 不得默认允许 production。");
assertFalse(gate.l2ProductionAllowed, "L1 -> L2 gate 不得默认允许 L2 Production。");
assertTrue(gate.defaultEligible === false, "L1 -> L2 gate 必须 defaultEligible=false。");
assertTrue(gate.requiresSeparateStage === true, "L1 -> L2 必须要求单独 stage。");
assertTrue(gate.requiresSeparatePr === true, "L1 -> L2 必须要求单独 PR。");
assertFalse(result.productionAllowed, "D2 upgrade result 不得允许 production。");
assertFalse(result.l2ProductionAllowed, "D2 upgrade result 不得允许 L2 Production。");
assertFalse(result.businessProductionAllowed, "D2 upgrade result 不得允许 Business Production。");
assertTrue(result.eligible === false, "D2 upgrade result 必须 eligible=false。");
assertTrue(result.status === "NOT_ELIGIBLE", "D2 upgrade result 必须 NOT_ELIGIBLE。");
assertTrue(result.requiresSeparateStage === true, "D2 upgrade result 必须保留单独 stage 要求。");
assertTrue(dayResults.length > 0, "至少需要 day 1 observation result。");

writeJson("artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Dormitory L1-to-L2 upgrade checker failed.");
}

console.log("Dormitory L1-to-L2 upgrade: NOT_ELIGIBLE");

function criterion(id, met, message, overrideStatus = null) {
  return {
    id,
    status: overrideStatus ?? (met ? "met" : "not_met"),
    ...(met ? {} : { message })
  };
}

function readDayResults(durationDays) {
  const results = [];
  for (let day = 1; day <= durationDays; day += 1) {
    const dayToken = String(day).padStart(2, "0");
    const relativePath = `artifacts/go-live/dormitory/daily-observation-day-${dayToken}.json`;
    const absolutePath = path.join(root, relativePath);
    if (fs.existsSync(absolutePath)) {
      results.push(JSON.parse(fs.readFileSync(absolutePath, "utf8")));
    }
  }
  return results;
}

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function readOptionalJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function readMainHead() {
  const result = spawnSync("git", ["rev-parse", "origin/main"], { cwd: root, encoding: "utf8", shell: isWindows() });
  return result.status === 0 ? result.stdout.trim() : null;
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertTrue(condition, message) {
  if (!condition) failures.push(message);
}

function assertFalse(value, message) {
  if (value !== false) failures.push(message);
}

function isWindows() {
  return process.platform === "win32";
}
