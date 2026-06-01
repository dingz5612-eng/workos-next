import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
const contractPath = readArg("--contract=", "docs/proof/runtime-proof-contract.yml");
const proofPackPath = readArg("--pack=", "docs/go-live/dormitory/runtime-proof-pack.yml");
const replayOutPath = readArg("--replay-out=", "artifacts/go-live/dormitory/live-api-db-replay-result.json");
const outPath = readArg("--out=", "artifacts/proof/runtime-proof-result.json");
const dormitoryOutPath = readArg("--dormitory-out=", "artifacts/go-live/dormitory/runtime-proof-result.json");
const skipReplay = process.argv.includes("--skip-replay");
const runId = readArg("--run-id=", `oam03-${Date.now().toString(36)}`);

if (isMain && process.argv.includes("--self-test")) {
  const invalid = validateRuntimeProofResult({
    status: "passed",
    sourceMode: "synthetic",
    noGoItems: [],
    dormitoryReplay: {
      status: "passed",
      sourceMode: "synthetic",
      syntheticDomainEventsAllowed: true,
      syntheticLedgerTransactionsAllowed: true,
      workspaceCardCompatibilityFallbackUsed: false,
      scenarioCount: 10,
      passedCount: 10,
      apiCallsExecuted: [],
      dbAssertions: []
    },
    assertions: []
  }, readJson(contractPath));
  assert(invalid.some((item) => item.id === "oam03.source_mode_not_live_api_db"), "self-test must reject non-live source mode.");
  assert(invalid.some((item) => item.id === "oam03.synthetic_business_fact_forbidden"), "self-test must reject synthetic business facts.");
  console.log("OAM-03 runtime proof self-test: PASS");
  process.exit(0);
}

if (isMain) {
  await main();
}

async function main() {
  const contract = readJson(contractPath);
  const proofPack = readJson(proofPackPath);

  if (!skipReplay) {
    run("node", [
      "scripts/go-live/run-dormitory-live-api-db-scenarios.mjs",
      `--run-id=${runId}`,
      `--out=${replayOutPath}`
    ]);
  }

  const replay = readJson(replayOutPath);
  const assertions = buildAssertions(contract, proofPack, replay);
  const noGoItems = validateRuntimeProofResult({ sourceMode: "live_api_db", dormitoryReplay: replay, assertions }, contract);
  const result = {
    generated_at_utc: new Date().toISOString(),
    generated_by: "run-runtime-proof",
    taskId: "OAM-03",
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    currentMainHead: git(["rev-parse", "origin/main"]),
    sourceMode: "live_api_db",
    runtimeProofContractRef: contractPath,
    proofPackRef: proofPackPath,
    dormitoryReplayRef: replayOutPath,
    scenarioCount: replay.scenarioCount ?? 0,
    passedCount: replay.passedCount ?? 0,
    apiCallsExecuted: replay.apiCallsExecuted ?? [],
    dbAssertions: replay.dbAssertions ?? [],
    assertions,
    proofChain: {
      apiToDb: assertionStatus(assertions, "persisted_work_item_runtime_model"),
      prepareToSubmission: assertionStatus(assertions, "prepare_command_submission_trace"),
      confirmToUnitOfWork: assertionStatus(assertions, "confirm_through_operations_unit_of_work"),
      eventLedgerProjectionTrace: [
        assertionStatus(assertions, "committed_domain_event"),
        assertionStatus(assertions, "money_ledger_transaction"),
        assertionStatus(assertions, "projection_lens_replay"),
        assertionStatus(assertions, "trace_api_chain")
      ].every(Boolean)
    },
    sourceModePolicy: {
      allowSyntheticDomainEvent: false,
      allowSyntheticLedgerTransaction: false,
      allowJsonOnlyScenarioPass: false,
      allowFixtureOnlyScenarioPass: false,
      allowWorkspaceCardOrdinaryConfirmFallback: false
    },
    statusBoundaries: contract.statusBoundaries,
    evidenceRefs: [
      outPath,
      dormitoryOutPath,
      replayOutPath,
      "docs/proof/runtime-proof-contract.yml",
      "docs/go-live/dormitory/runtime-proof-pack.yml"
    ],
    dormitoryReplay: summarizeReplay(replay),
    noGoItems
  };
  result.status = noGoItems.length ? "blocked" : "passed";
  writeJson(outPath, result);

  const dormitoryResult = {
    ...result,
    generated_by: "run-runtime-proof:dormitory-pack",
    artifactScope: "dormitory",
    statusBoundaries: proofPack.statusBoundaries
  };
  writeJson(dormitoryOutPath, dormitoryResult);

  if (noGoItems.length) {
    for (const item of noGoItems) console.error(`${item.severity} ${item.id}: ${item.message}`);
    throw new Error("OAM-03 runtime proof: BLOCKED");
  }

  console.log("OAM-03 runtime proof: PASS");
}

function buildAssertions(contract, proofPack, replay) {
  const scenarios = replay.scenarios ?? [];
  const apiCalls = replay.apiCallsExecuted ?? [];
  const dbAssertions = replay.dbAssertions ?? [];
  const committed = scenarios.filter((item) => item.scenarioType === "committed_scenario" || item.scenarioType === "rollback_compensation_scenario");
  const money = scenarios.filter((item) => (item.ledgerTransactions ?? []).length > 0);
  const rejected = scenarios.filter((item) => item.scenarioType === "rejected_command_scenario" || item.rejectedCommandSubmission || item.rejectionTrace);

  return [
    assertion("persisted_work_item_runtime_model", scenarios.length >= 10 && scenarios.every((item) => item.workItem?.source === "persisted_work_item_runtime_model")),
    assertion("prepare_command_submission_trace", hasApi(apiCalls, "POST /api/operations/work-items/{workItemId}/prepare") && dbPassed(dbAssertions, "CommandSubmission")),
    assertion("confirm_through_operations_unit_of_work", hasApi(apiCalls, "POST /api/operations/work-items/{workItemId}/confirm") && scenarios.every((item) => item.apiResult?.source === "operations_unit_of_work" || item.apiResult?.statusCode === 403 || item.apiResult?.statusCode === 422)),
    assertion("committed_domain_event", committed.length >= 8 && committed.every((item) => (item.domainEvents ?? []).length > 0)),
    assertion("money_ledger_transaction", money.length >= 6 && money.every((item) => (item.ledgerTransactions ?? []).some((tx) => tx.balance_status === "balanced"))),
    assertion("rejected_command_submission", rejected.length >= 2 && dbPassed(dbAssertions, "RejectedCommandSubmission")),
    assertion("rejected_has_no_domain_event_or_ledger", scenarios.filter((item) => item.scenarioType === "rejected_command_scenario").every((item) => (item.domainEvents ?? []).length === 0 && (item.ledgerTransactions ?? []).length === 0)),
    assertion("projection_lens_replay", dbPassed(dbAssertions, "ProjectionCheckpoint") && dbPassed(dbAssertions, "Lens") && Array.isArray(scenarios.flatMap((item) => item.lensOutputs ?? []))),
    assertion("ui_state_matches_api_result", scenarios.every((item) => item.status === "passed" && item.apiResult && typeof item.apiResult.statusCode === "number")),
    assertion("trace_api_chain", contract.requiredApiCalls.every((required) => !required.startsWith("GET /api/operations/trace/") || hasApi(apiCalls, required)) && dbPassed(dbAssertions, "FactTrace")),
    assertion("compatibility_fallback_not_used", replay.workspaceCardCompatibilityFallbackUsed === false && !apiCalls.some((item) => String(item.path).startsWith("/api/workspaces/"))),
    assertion("source_mode_live_api_db", replay.sourceMode === "real_api_db" && proofPack.sourceMode === "live_api_db")
  ];
}

export function validateRuntimeProofResult(result, contract = readJson(contractPath)) {
  const noGoItems = [];
  const replay = result.dormitoryReplay ?? {};

  if (result.sourceMode !== "live_api_db") {
    noGoItems.push(violation("oam03.source_mode_not_live_api_db", "OAM-03 sourceMode 必须是 live_api_db。"));
  }
  if (replay.sourceMode !== "real_api_db") {
    noGoItems.push(violation("oam03.replay_source_mode_not_real_api_db", "宿舍 replay sourceMode 必须是 real_api_db。"));
  }
  if (replay.syntheticDomainEventsAllowed !== false || replay.syntheticLedgerTransactionsAllowed !== false) {
    noGoItems.push(violation("oam03.synthetic_business_fact_forbidden", "OAM-03 不允许 synthetic DomainEvent / LedgerTransaction 作为证明。"));
  }
  if (replay.workspaceCardCompatibilityFallbackUsed === true) {
    noGoItems.push(violation("oam03.workspace_card_fallback_used", "OAM-03 普通 confirm path 不允许 workspace/card fallback。"));
  }
  if ((replay.scenarioCount ?? result.scenarioCount ?? 0) < 10 || (replay.passedCount ?? result.passedCount ?? 0) < 10) {
    noGoItems.push(violation("oam03.scenario_count_failed", "OAM-03 必须证明 10 条 dorm-live 场景全部通过。"));
  }
  for (const required of contract.requiredApiCalls ?? []) {
    if (!hasApi(replay.apiCallsExecuted ?? result.apiCallsExecuted ?? [], required)) {
      noGoItems.push(violation("oam03.required_api_not_executed", `未执行必需 API: ${required}`, { required }));
    }
  }
  for (const required of contract.requiredDbAssertions ?? []) {
    if (!dbPassed(replay.dbAssertions ?? result.dbAssertions ?? [], required)) {
      noGoItems.push(violation("oam03.required_db_assertion_not_passed", `DB assertion 未通过: ${required}`, { required }));
    }
  }
  for (const required of contract.requiredAssertions ?? []) {
    if (!assertionStatus(result.assertions ?? [], required)) {
      noGoItems.push(violation("oam03.required_assertion_not_passed", `Runtime proof assertion 未通过: ${required}`, { required }));
    }
  }
  for (const ref of result.evidenceRefs ?? []) {
    if (String(ref).startsWith(".tmp/") || String(ref).includes("/.tmp/")) {
      noGoItems.push(violation("oam03.tmp_evidence_ref_forbidden", "OAM-03 final evidence refs 不允许引用 .tmp。", { ref }));
    }
  }
  if (result.status && result.status !== "passed") {
    noGoItems.push(violation("oam03.result_not_passed", "OAM-03 result status 必须是 passed。", { status: result.status }));
  }
  return noGoItems;
}

function summarizeReplay(replay) {
  return {
    status: replay.status,
    sourceMode: replay.sourceMode,
    syntheticDomainEventsAllowed: replay.syntheticDomainEventsAllowed,
    syntheticLedgerTransactionsAllowed: replay.syntheticLedgerTransactionsAllowed,
    workspaceCardCompatibilityFallbackUsed: replay.workspaceCardCompatibilityFallbackUsed,
    scenarioCount: replay.scenarioCount,
    passedCount: replay.passedCount,
    apiCallsExecuted: replay.apiCallsExecuted ?? [],
    dbAssertions: replay.dbAssertions ?? [],
    financeRuntimeClose: replay.financeRuntimeClose,
    admissionGuard: replay.admissionGuard,
    noGoItems: replay.noGoItems ?? []
  };
}

function assertion(id, passed) {
  return { id, status: passed ? "passed" : "blocked" };
}

function assertionStatus(assertions, id) {
  return assertions.some((item) => item.id === id && item.status === "passed");
}

function hasApi(calls, required) {
  const [method, route] = required.split(" ");
  return calls.some((item) => item.method === method && (item.contractPath === route || item.path === route));
}

function dbPassed(assertions, name) {
  return assertions.some((item) => item.name === name && item.status === "passed");
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
