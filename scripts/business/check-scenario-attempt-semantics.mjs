import { failIfNeeded, readJson, writeJson } from "../oam/clean-baseline-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const failures = [];
const replay = readJson("artifacts/go-live/dormitory/live-api-db-replay-result.json");
const day1 = readJson("artifacts/operations/dormitory/observation-day-01.json");

const scenarios = new Map((replay.scenarios ?? []).map((scenario) => [scenario.scenarioId, scenario]));
const conflict = scenarios.get("dorm-live-009");
const missingEvidence = scenarios.get("dorm-live-010");
const permission = scenarios.get("dorm-live-008");

if (!conflict) failures.push("缺少 dorm-live-009 409 场景。");
if (conflict) {
  if (conflict.scenarioType !== "idempotency_conflict_scenario") failures.push("dorm-live-009 必须标记 idempotency_conflict_scenario。");
  if (conflict.noDuplicateSideEffect !== true) failures.push("409 场景必须 noDuplicateSideEffect=true。");
  if ((conflict.conflictDomainEvents ?? []).length > 0) failures.push("409 conflictSubmission 不得产生新 DomainEvent。");
  if ((conflict.conflictLedgerTransactions ?? []).length > 0) failures.push("409 conflictSubmission 不得产生新 LedgerTransaction。");
  if (!conflict.commandSubmission?.submissionId) failures.push("409 firstSubmission 必须有 committed CommandSubmission。");
}

if (!missingEvidence) failures.push("缺少 dorm-live-010 422 补证场景。");
if (missingEvidence) {
  if (missingEvidence.scenarioType !== "rejected_then_committed_scenario") failures.push("dorm-live-010 必须标记 rejected_then_committed_scenario。");
  if (!missingEvidence.rejectionTrace?.traceId) failures.push("422 firstRejected 必须有 RejectionTrace。");
  if (!missingEvidence.commandSubmission?.submissionId) failures.push("422 secondCommitted 必须有 committed CommandSubmission。");
  const lifecycle = missingEvidence.finalWorkItemLifecycleState ?? missingEvidence.workItem?.lifecycleState ?? "completed";
  if (["blocked", "rejected", "failed"].includes(lifecycle)) failures.push("422 补证后 WorkItem 不得仍是 blocked / rejected / failed。");
}

if (!permission) failures.push("缺少 dorm-live-008 403 场景。");
if (permission) {
  if (!permission.rejectionTrace?.traceId) failures.push("403 场景必须有 RejectionTrace。");
  if ((permission.domainEvents ?? []).length > 0) failures.push("403 场景不得产生 DomainEvent。");
  if ((permission.ledgerTransactions ?? []).length > 0) failures.push("403 场景不得产生 LedgerTransaction。");
}

if (day1.actualErrorMetrics?.idempotencyConflictNoSideEffect !== true) failures.push("Day-1 指标必须确认 idempotency conflict 无副作用。");
if (day1.actualCommandSubmissionData?.statusCodeCounts?.["409"] < 1) failures.push("Day-1 必须读取 409 指标。");
if (day1.actualCommandSubmissionData?.statusCodeCounts?.["422"] < 1) failures.push("Day-1 必须读取 422 指标。");

const result = {
  generatedAtUtc,
  generatedBy: "check-scenario-attempt-semantics",
  stage: "OAM-ACCEPTANCE-CLOSURE-A4",
  status: failures.length === 0 ? "passed" : "failed",
  checkedScenarios: ["dorm-live-008", "dorm-live-009", "dorm-live-010"],
  noGoItems: failures,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview",
  evidenceRefs: [
    "artifacts/go-live/dormitory/live-api-db-replay-result.json",
    "artifacts/operations/dormitory/observation-day-01.json"
  ]
};
writeJson("artifacts/business/dormitory/scenario-attempt-semantics-result.json", result);
failIfNeeded(failures, "scenario attempt semantics check");
console.log("scenario attempt semantics check: PASS");

