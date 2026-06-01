import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const day = Number(readArg("--day=", "1"));
const dayToken = String(day).padStart(2, "0");

const observation = readJson("docs/go-live/dormitory/observation-window.yml");
const metricContract = readJson("docs/go-live/dormitory/observation-metric-contract.yml");
const resultPath = `artifacts/go-live/dormitory/daily-observation-day-${dayToken}.json`;
const result = readJson(resultPath);

const failures = [];

assertEqual(result.day, day, `daily observation day 必须等于 ${day}。`);
assertFalse(result.productionAllowed, "D2 daily result 不得允许 production。");
assertFalse(result.l2ProductionAllowed, "D2 daily result 不得允许 L2 Production。");
assertFalse(result.businessProductionAllowed, "D2 daily result 不得允许 Business Production。");

const computedP0 = computeP0Stops(result);
const computedP1 = computeP1Holds(result, metricContract.thresholds ?? {});

assertEqual(result.p0StopCount, computedP0.length, "P0 stop count 必须与机器计算一致。");
assertEqual(result.p1HoldCount, computedP1.length, "P1 hold count 必须与机器计算一致。");
assertSameSet(result.triggeredP0Stops ?? [], computedP0, "triggeredP0Stops 必须与机器计算一致。");
assertSameSet(result.triggeredP1Holds ?? [], computedP1, "triggeredP1Holds 必须与机器计算一致。");

const expectedDecision = computedP0.length > 0
  ? "pause_or_rollback"
  : computedP1.length > 0
    ? "hold_and_fix"
    : "continue_l1_observation";

assertEqual(result.decision, expectedDecision, "daily decision 必须由 P0/P1 机器判定。");
if (expectedDecision === "continue_l1_observation") {
  assertEqual(result.status, "passed", "无 P0/P1 时 daily status 必须 passed。");
}

for (const item of observation.stopConditions ?? []) {
  assertTrue((metricContract.p0StopMetrics ?? []).some((metric) => metric.label === item), `P0 stop 未绑定 metric：${item}`);
}
for (const item of observation.holdConditions ?? []) {
  assertTrue((metricContract.p1HoldMetrics ?? []).some((metric) => metric.label === item), `P1 hold 未绑定 metric：${item}`);
}

assertTrue(result.rates?.idempotencyConflictNoSideEffect === true, "409 idempotency conflict 必须无重复副作用。");
assertEqual(result.gateStatus?.BStageGate, "passed", "BStageGate status 必须 passed 才能 continue。");
assertEqual(result.gateStatus?.ShadowCompare, "green", "ShadowCompare 必须 green 才能 continue。");
assertEqual(result.gateStatus?.Invariant, "passed", "Invariant 必须 passed 才能 continue。");
assertEqual(result.rollbackReadiness?.status, "green", "rollback readiness 必须 green。");

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error(`Dormitory observation day ${day}: FAILED`);
}

console.log(`Dormitory observation day ${day}: ${result.decision}`);

function computeP0Stops(dayResult) {
  const stops = [];
  const finance = dayResult.financeDailyClose ?? {};
  const evidence = dayResult.evidenceMetrics ?? {};
  const runtime = dayResult.runtimeSafety ?? {};
  const gate = dayResult.gateStatus ?? {};
  const rollback = dayResult.rollbackReadiness ?? {};

  pushIf(stops, "money mismatch red", Number(finance.depositLiabilityMismatch ?? 0) > 0);
  pushIf(stops, "duplicate ledger entry", Number(finance.duplicateLedgerEntry ?? 0) > 0);
  pushIf(stops, "unbalanced ledger transaction", Number(finance.unbalancedLedgerTransaction ?? 0) > 0);
  pushIf(stops, "deposit as revenue", Number(finance.depositAsRevenue ?? 0) > 0);
  pushIf(stops, "refund over liability", Number(finance.refundOverLiability ?? 0) > 0);
  pushIf(stops, "bed double occupancy", Number(runtime.bedDoubleOccupancy ?? 0) > 0);
  pushIf(stops, "evidence leak", Number(evidence.evidenceLeakCount ?? 0) > 0);
  pushIf(stops, "wrong tenant evidence", Number(evidence.wrongTenantEvidenceCount ?? 0) > 0);
  pushIf(stops, "device trust bypass", Number(runtime.deviceTrustBypass ?? 0) > 0);
  pushIf(stops, "unable to rollback", rollback.unableToRollback === true || rollback.status !== "green");
  pushIf(stops, "finance daily close failed", finance.status !== "passed");
  pushIf(stops, "BStageGate red", gate.BStageGate !== "passed");
  pushIf(stops, "Red ShadowCompareReport", gate.ShadowCompare === "red" || Number(gate.redShadowCompareReportCount ?? 0) > 0);
  pushIf(stops, "unresolved P0 invariant", gate.Invariant !== "passed" || Number(gate.unresolvedP0InvariantCount ?? 0) > 0);
  return stops;
}

function computeP1Holds(dayResult, thresholds) {
  const holds = [];
  const finance = dayResult.financeDailyClose ?? {};
  const evidence = dayResult.evidenceMetrics ?? {};
  const lag = dayResult.projectionLag ?? {};
  const sla = dayResult.slaMetrics ?? {};
  const rates = dayResult.rates ?? {};
  const training = dayResult.training ?? {};
  const support = dayResult.support ?? {};

  pushIf(holds, "projection lag above threshold", Number(lag.p95Minutes ?? 0) > Number(thresholds.projectionLagP95MaxMinutes ?? 0));
  pushIf(holds, "evidence upload failure above threshold", Number(evidence.uploadFailureRate ?? 0) > Number(thresholds.evidenceUploadFailureRateMax ?? 0));
  pushIf(holds, "evidence missing rate above threshold", Number(evidence.missingRate ?? 0) > Number(thresholds.evidenceMissingRateMax ?? 0));
  pushIf(holds, "rejected 422 abnormal", Number(rates.businessBlocked422Rate ?? 0) > Number(thresholds.businessBlocked422RateMax ?? 0));
  pushIf(holds, "finance case backlog above threshold", Number(finance.financeCaseBacklog ?? 0) > Number(thresholds.financeCaseBacklogMax ?? 0));
  pushIf(holds, "unclear money backlog above threshold", Number(finance.unclearMoneyBacklog ?? 0) > Number(thresholds.unclearMoneyBacklogMax ?? 0));
  pushIf(holds, "SLA overdue above threshold", Number(sla.overdueCount ?? 0) > Number(thresholds.slaOverdueMax ?? 0));
  pushIf(holds, "training blocking issue open", Number(training.blockingIssuesOpen ?? 0) > 0);
  pushIf(holds, "support ticket spike", support.ticketSpike === true || Number(support.tickets ?? 0) > Number(thresholds.supportTicketSpikeMax ?? 0));
  return holds;
}

function pushIf(list, label, condition) {
  if (condition) list.push(label);
}

function readArg(prefix, fallback) {
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

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

function assertSameSet(actual, expected, message) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e)) {
    failures.push(`${message} actual=${JSON.stringify(a)} expected=${JSON.stringify(e)}`);
  }
}
