import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = readArg("--contract=", "docs/go-live/dormitory/runtime-replay-contract.yml");
const scenariosPath = readArg("--scenarios=", "docs/go-live/dormitory/runtime-replay-scenarios.yml");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/source-mode-contract-result.json");

const noGoItems = [];
const contract = readJson(contractPath, noGoItems, "d1.source_contract_missing");
const scenarios = readJson(scenariosPath, noGoItems, "d1.scenario_contract_missing");

if (contract) {
  assertEqual(contract.sourceMode, "real_api_db", "d1.source_mode_not_real_api_db", "D1 sourceMode 必须是 real_api_db。");
  for (const key of [
    "allowSyntheticDomainEvent",
    "allowSyntheticLedgerTransaction",
    "allowWorkspaceCardOrdinaryConfirmFallback",
    "allowTmpFinalEvidenceRefs",
    "allowOldCiRunEvidence"
  ]) {
    if (contract.sourceModePolicy?.[key] !== false) {
      noGoItems.push(violation(`d1.source_policy_${key}`, `sourceModePolicy.${key} 必须为 false。`));
    }
  }

  for (const ref of contract.finalEvidenceRefs ?? []) {
    if (ref.startsWith(".tmp/") || ref.includes("/.tmp/")) {
      noGoItems.push(violation("d1.tmp_final_evidence_ref", "D1 final evidence 不允许使用 .tmp refs。", { ref }));
    }
    if (!ref.startsWith("artifacts/go-live/dormitory/")) {
      noGoItems.push(violation("d1.final_evidence_not_artifact", "D1 final evidence 必须进入 artifacts/go-live/dormitory。", { ref }));
    }
  }

  for (const required of [
    "POST /api/operations/cases",
    "POST /api/operations/work-items",
    "POST /api/evidence/drafts",
    "POST /api/operations/work-items/{workItemId}/prepare",
    "POST /api/operations/work-items/{workItemId}/confirm",
    "GET /api/operations/trace/submissions/{submissionId}",
    "GET /api/operations/trace/work-items/{workItemId}",
    "GET /api/operations/trace/cases/{caseId}"
  ]) {
    if (!(contract.apiCallsRequired ?? []).includes(required)) {
      noGoItems.push(violation("d1.required_api_missing", `缺少 D1 必需 API 调用合同: ${required}`, { required }));
    }
  }

  for (const required of [
    "OperationCase",
    "WorkItem",
    "CommandSubmission",
    "RejectedCommandSubmission",
    "RejectionTrace",
    "DomainEvent",
    "LedgerTransaction",
    "LedgerEntry",
    "ProjectionCheckpoint",
    "Lens",
    "EvidenceObject",
    "FactTrace"
  ]) {
    if (!(contract.dbAssertionsRequired ?? []).includes(required)) {
      noGoItems.push(violation("d1.required_db_assertion_missing", `缺少 D1 必需 DB assertion: ${required}`, { required }));
    }
  }

  if (contract.runtimeBoundary?.dormitoryProductionAllowed !== false ||
      contract.runtimeBoundary?.businessProductionGo !== false ||
      contract.runtimeBoundary?.repairStatus !== "L0 Contract Preview" ||
      contract.runtimeBoundary?.partsStatus !== "L0 Contract Preview" ||
      contract.runtimeBoundary?.hrStatus !== "L0 Contract Preview") {
    noGoItems.push(violation("d1.runtime_boundary_invalid", "D1 不允许声明 Dormitory L2 Production，也不允许放开 Repair / Parts / HR。"));
  }
}

if (scenarios) {
  assertEqual(scenarios.sourceMode, "real_api_db", "d1.scenario_source_mode_not_real_api_db", "runtime replay scenarios sourceMode 必须是 real_api_db。");
  const dormLive = (scenarios.scenarios ?? []).filter((item) => /^dorm-live-\d{3}$/.test(item.scenarioId ?? ""));
  if (dormLive.length !== 10) {
    noGoItems.push(violation("d1.dorm_live_count_invalid", "D1 必须保留 10 条 dorm-live 场景。", { count: dormLive.length }));
  }
  if (!(scenarios.scenarios ?? []).some((item) => item.scenarioType === "rollback_compensation_scenario")) {
    noGoItems.push(violation("d1.rollback_compensation_missing", "D1 必须覆盖 rollback drill append-only compensation。"));
  }
  for (const scenario of scenarios.scenarios ?? []) {
    if (scenario.sourceMode === "synthetic" || scenario.synthetic === true) {
      noGoItems.push(violation("d1.synthetic_scenario_forbidden", "D1 场景不允许 synthetic source。", { scenarioId: scenario.scenarioId }));
    }
  }
}

const result = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "check-source-mode-contract",
  taskId: "D1",
  status: noGoItems.length ? "blocked" : "passed",
  sourceMode: contract?.sourceMode ?? "missing",
  contractRef: contractPath,
  scenariosRef: scenariosPath,
  noGoItems
};
writeJson(outPath, result);

if (noGoItems.length) {
  for (const item of noGoItems) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("D1 sourceMode contract: BLOCKED");
}

console.log("D1 sourceMode contract: PASS");

function readJson(relativePath, noGoItems, id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    noGoItems.push(violation(id, `无法读取 ${relativePath}。`, { path: relativePath, error: error.message }));
    return null;
  }
}

function assertEqual(actual, expected, id, message) {
  if (actual !== expected) noGoItems.push(violation(id, message, { actual, expected }));
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
