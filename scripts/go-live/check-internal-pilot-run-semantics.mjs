import { failIfNeeded, readJson, writeJson } from "../oam/clean-baseline-lib.mjs";

const failures = [];
const generatedAtUtc = new Date().toISOString();
const replay = readJson("artifacts/go-live/dormitory/live-api-db-replay-result.json");
const runtimeProof = readJson("artifacts/proof/runtime-proof-result.json");
const currentState = readJson("artifacts/release-state/current-state.json");
const maturity = readJson("artifacts/portfolio/business-line-maturity-result.json");

if (!["live_api_db", "real_api_db"].includes(replay.sourceMode ?? replay.source_mode)) {
  failures.push("live API / DB replay sourceMode 必须是 live_api_db 或 real_api_db，不得写成泛化 real。");
}
if (!["live_api_db", "real_api_db"].includes(runtimeProof.sourceMode ?? runtimeProof.source_mode)) {
  failures.push("runtime proof sourceMode 必须证明真实 API / DB，不得仅引用 JSON。");
}
if ((replay.scenarios ?? []).length < 10) failures.push("internal pilot replay 必须覆盖 10 条 dorm-live 场景。");

for (const scenario of replay.scenarios ?? []) {
  if (scenario.status !== "passed") failures.push(`${scenario.scenarioId} 必须 passed。`);
  if (!scenario.workItem?.workItemId) failures.push(`${scenario.scenarioId} 缺少真实 WorkItem。`);
  if (scenario.scenarioType === "committed_scenario") {
    if ((scenario.domainEvents ?? []).length === 0) failures.push(`${scenario.scenarioId} committed 场景必须有 DomainEvent。`);
  }
  if (scenario.scenarioType === "rejected_command_scenario") {
    if (!scenario.rejectionTrace?.traceId) failures.push(`${scenario.scenarioId} rejected 场景必须有 RejectionTrace。`);
    if ((scenario.domainEvents ?? []).length > 0) failures.push(`${scenario.scenarioId} rejected 场景不得有 DomainEvent。`);
    if ((scenario.ledgerTransactions ?? []).length > 0) failures.push(`${scenario.scenarioId} rejected 场景不得有 LedgerTransaction。`);
  }
}

if (currentState.authoritativeState?.businessProduction !== "BLOCKED") failures.push("current-state 必须保持 Business Production blocked。");
if (currentState.authoritativeState?.dormitoryL2 !== "BLOCKED") failures.push("current-state 必须保持 Dormitory L2 blocked。");
if (maturity.dormitory?.productionAllowed !== false || maturity.dormitory?.l2ProductionAllowed !== false) failures.push("portfolio maturity 不得允许宿舍 production / L2。");

const result = {
  generatedAtUtc,
  generatedBy: "check-internal-pilot-run-semantics",
  stage: "OAM-ACCEPTANCE-CLOSURE-A4",
  status: failures.length === 0 ? "passed" : "failed",
  scenarioCount: (replay.scenarios ?? []).length,
  sourceMode: replay.sourceMode ?? replay.source_mode,
  runtimeProofSourceMode: runtimeProof.sourceMode ?? runtimeProof.source_mode,
  noGoItems: failures,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview",
  evidenceRefs: [
    "artifacts/go-live/dormitory/live-api-db-replay-result.json",
    "artifacts/proof/runtime-proof-result.json",
    "artifacts/release-state/current-state.json",
    "artifacts/portfolio/business-line-maturity-result.json"
  ]
};
writeJson("artifacts/go-live/dormitory/internal-pilot-run-semantics-result.json", result);
failIfNeeded(failures, "internal pilot run semantics check");
console.log("internal pilot run semantics check: PASS");

