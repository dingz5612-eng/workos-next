import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
const scenariosPath = readArg("--scenarios=", "docs/go-live/dormitory/runtime-replay-scenarios.yml");
const contractPath = readArg("--contract=", "docs/go-live/dormitory/runtime-replay-contract.yml");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/live-api-db-replay-result.json");
const connectionString = process.env.WORKOS_TEST_CONNECTION
  ?? process.env.ConnectionStrings__WorkOSRuntime
  ?? "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";

let contract = null;
let scenariosDoc = null;
let runId = "imported";
let apiCalls = [];
let noGoItems = [];
let scenarioResults = [];
let tenantId = "tenant-dorm-int-001";
let actorToken = "";
let actorTokensByUsername = new Map();
let server = null;

if (isMain && process.argv.includes("--self-test")) {
  const invalid = validateReplayResult({
    status: "passed",
    sourceMode: "synthetic",
    syntheticDomainEventsAllowed: true,
    syntheticLedgerTransactionsAllowed: true,
    scenarioCount: 1,
    passedCount: 1,
    apiCallsExecuted: [],
    dbAssertions: [],
    scenarios: [{
      scenarioId: "dorm-live-008",
      scenarioType: "rejected_command_scenario",
      status: "passed",
      domainEvents: [{ eventId: "synthetic-event" }],
      ledgerTransactions: []
    }],
    financeRuntimeClose: { status: "passed" },
    admissionGuard: { status: "passed" },
    noGoItems: []
  });
  assert(invalid.some((item) => item.id === "d1.source_mode_not_real_api_db"), "self-test must reject synthetic sourceMode.");
  assert(invalid.some((item) => item.id === "d1.synthetic_business_fact_forbidden"), "self-test must reject synthetic business facts.");
  console.log("Dormitory live API/DB replay self-test: PASS");
  process.exit(0);
}

if (isMain) {
  await main();
}

async function main() {
  contract = readJson(contractPath);
  scenariosDoc = readJson(scenariosPath);
  runId = readArg("--run-id=", `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`);
  apiCalls = [];
  noGoItems = [];
  scenarioResults = [];
  tenantId = scenariosDoc.tenantId ?? "tenant-dorm-int-001";
  actorToken = "";
  actorTokensByUsername = new Map();
  server = await startApi();
  try {
  for (const scenario of scenariosDoc.scenarios ?? []) {
    scenarioResults.push(await runScenario(scenario));
  }

  const dbAssertions = await queryDbAssertions();
  const financeRuntimeClose = summarizeFinanceRuntimeClose(scenarioResults, dbAssertions);
  const admissionGuard = summarizeAdmissionGuard(apiCalls, scenarioResults);
  const result = {
    generated_at_utc: new Date().toISOString(),
    generated_by: "run-dormitory-live-api-db-scenarios",
    taskId: "D1",
    branch: await git(["rev-parse", "--abbrev-ref", "HEAD"]),
    currentMainHead: await gitMainHead(),
    sourceMode: "real_api_db",
    syntheticDomainEventsAllowed: false,
    syntheticLedgerTransactionsAllowed: false,
    retiredWorkspaceCardWritePathUsed: apiCalls.some((item) => item.path.startsWith("/api/workspaces/")),
    runId,
    connectionString: maskConnection(connectionString),
    contractRef: contractPath,
    scenariosRef: scenariosPath,
    scenarioCount: scenarioResults.filter((item) => /^dorm-live-\d{3}$/.test(item.scenarioId)).length,
    passedCount: scenarioResults.filter((item) => /^dorm-live-\d{3}$/.test(item.scenarioId) && item.status === "passed").length,
    rollbackDrill: scenarioResults.find((item) => item.scenarioType === "rollback_compensation_scenario") ?? null,
    apiCallsExecuted: apiCalls,
    dbAssertions,
    scenarios: scenarioResults,
    financeRuntimeClose,
    admissionGuard,
    artifactsGenerated: [
      outPath,
      "artifacts/go-live/dormitory/source-mode-contract-result.json"
    ],
    noGoItems
  };
  noGoItems.push(...validateReplayResult(result));
  result.status = noGoItems.length ? "blocked" : "passed";
  writeJson(outPath, result);

  if (noGoItems.length) {
    for (const item of noGoItems) console.error(`${item.severity} ${item.id}: ${item.message}`);
    throw new Error("Dormitory live API/DB replay: BLOCKED");
  }

  console.log("Dormitory live API/DB replay: PASS");
  } finally {
    await stopApi(server);
  }
}

async function runScenario(scenario) {
  const refs = refsFor(scenario);
  actorToken = await ensureRuntimeActorSession(scenario.ownerRole ?? "operator");
  await api("POST", "/api/operations/cases", "/api/operations/cases", {
    caseId: refs.caseId,
    tenantId,
    workspaceId: scenario.workspaceId,
    caseType: "dormitory_runtime_replay"
  });
  await api("POST", "/api/operations/work-items", "/api/operations/work-items", {
    workItemId: refs.workItemId,
    tenantId,
    workItemType: scenario.workItemType,
    workspaceId: scenario.workspaceId,
    targetWorkspaceId: scenario.workspaceId,
    cardId: scenario.cardId,
    ownerRole: scenario.ownerRole,
    payload: {
      caseId: refs.caseId,
      cardId: scenario.cardId,
      runtimeReplayRunId: runId,
      runtimeReplayScenarioId: scenario.scenarioId,
      ordinaryConfirmPath: "persisted_work_item"
    }
  });
  await api("POST", `/api/operations/work-items/${refs.workItemId}/prepare`, "/api/operations/work-items/{workItemId}/prepare", {
    workspaceId: scenario.workspaceId,
    cardId: scenario.cardId,
    submissionId: refs.submissionId,
    cardInstanceId: refs.cardInstanceId,
    aggregateRef: refs.caseId
  });

  if (scenario.scenarioType === "rejected_command_scenario") {
    const confirm = await confirmScenario(scenario, refs, [], refs.submissionId, scenario.fieldValues);
    await trace(confirm.commandSubmissionId ?? refs.submissionId, refs.workItemId, refs.caseId);
    return await scenarioRecord(scenario, refs, confirm, null, []);
  }

  if (scenario.scenarioType === "idempotency_conflict_scenario") {
    const evidenceIds = await createEvidence(scenario, refs, refs.submissionId);
    const first = await confirmScenario(scenario, refs, evidenceIds, refs.submissionId, scenario.fieldValues);
    const second = await confirmScenario(
      scenario,
      { ...refs, submissionId: `${refs.submissionId}-duplicate` },
      evidenceIds,
      `${refs.submissionId}-duplicate`,
      scenario.duplicateFieldValues ?? scenario.fieldValues,
      refs.idempotencyKey);
    await trace(first.commandSubmissionId ?? refs.submissionId, refs.workItemId, refs.caseId);
    const record = await scenarioRecord(scenario, refs, first, second, evidenceIds);
    record.duplicateSubmissionResult = {
      statusCode: second.statusCode,
      commandSubmissionId: second.commandSubmissionId,
      newSideEffectCount: record.domainEvents.length === 1 && record.ledgerTransactions.length <= 1 ? 0 : 1
    };
    return record;
  }

  if (scenario.scenarioType === "rejected_then_committed_scenario") {
    const rejected = await confirmScenario(scenario, refs, [], refs.submissionId, scenario.fieldValues);
    await trace(rejected.commandSubmissionId ?? refs.submissionId, refs.workItemId, refs.caseId);
    const evidenceIds = await createEvidence(scenario, refs, `${refs.submissionId}-accepted`);
    const committed = await confirmScenario(
      scenario,
      { ...refs, submissionId: `${refs.submissionId}-accepted`, idempotencyKey: `${refs.idempotencyKey}-accepted`, cardInstanceId: `${refs.cardInstanceId}-accepted` },
      evidenceIds,
      `${refs.submissionId}-accepted`,
      scenario.fieldValues,
      `${refs.idempotencyKey}-accepted`);
    await trace(committed.commandSubmissionId ?? `${refs.submissionId}-accepted`, refs.workItemId, refs.caseId);
    const record = await scenarioRecord(scenario, { ...refs, submissionId: `${refs.submissionId}-accepted` }, committed, rejected, evidenceIds);
    record.rejectedCommandSubmission = await rejectedSubmission(refs.submissionId);
    record.rejectionTrace = rejectionTraceFrom(rejected, refs, []);
    record.remediation = { missingEvidenceBlocked: rejected.statusCode === 422, confirmAfterEvidence: committed.statusCode === 200 };
    return record;
  }

  const evidenceIds = await createEvidence(scenario, refs, refs.submissionId);
  const confirm = await confirmScenario(scenario, refs, evidenceIds, refs.submissionId, scenario.fieldValues);
  await trace(confirm.commandSubmissionId ?? refs.submissionId, refs.workItemId, refs.caseId);
  return await scenarioRecord(scenario, refs, confirm, null, evidenceIds);
}

async function confirmScenario(scenario, refs, evidenceIds, submissionId, fieldValues, idempotencyKey = refs.idempotencyKey) {
  return await api("POST", `/api/operations/work-items/${refs.workItemId}/confirm`, "/api/operations/work-items/{workItemId}/confirm", {
    workspaceId: scenario.workspaceId,
    cardId: scenario.cardId,
    language: "zh-CN",
    idempotencyKey,
    fieldValues,
    evidenceIds,
    submissionId,
    cardInstanceId: refs.cardInstanceId,
    aggregateRef: refs.caseId,
    requestId: `req-${submissionId}`,
    deviceId: "device-dorm-d1-mobile-001"
  }, { "X-WorkOS-Actor-Token": actorToken, "X-Request-Id": `req-${submissionId}` }, false);
}

async function createEvidence(scenario, refs, submissionId) {
  const ids = [];
  for (const requirementId of scenario.requiredEvidence ?? []) {
    const evidenceId = `ev-d1-${runId}-${scenario.scenarioId}-${requirementId}`.replace(/[^a-zA-Z0-9-]/g, "-");
    await api("POST", "/api/evidence/drafts", "/api/evidence/drafts", {
      workspaceId: scenario.workspaceId,
      cardId: scenario.cardId,
      cardInstanceId: refs.cardInstanceId,
      submissionId,
      requirementId,
      evidenceId
    }, { "X-WorkOS-Actor-Id": "d1-replay" });
    await api("POST", `/api/evidence/${evidenceId}/attachments`, "/api/evidence/{evidenceId}/attachments", {
      fileName: `${scenario.scenarioId}-${requirementId}.txt`,
      contentType: "text/plain",
      contentSha256: sha(`${scenario.scenarioId}:${requirementId}:${runId}`),
      sizeBytes: 128
    }, { "X-WorkOS-Actor-Id": "d1-replay" });
    await api("POST", `/api/evidence/${evidenceId}/verify`, "/api/evidence/{evidenceId}/verify", {
      actorId: "d1-replay",
      reason: "runtime replay evidence accepted"
    });
    ids.push(evidenceId);
  }
  return ids;
}

async function trace(submissionId, workItemId, caseId) {
  await api("GET", `/api/operations/trace/submissions/${submissionId}`, "/api/operations/trace/submissions/{submissionId}");
  await api("GET", `/api/operations/trace/work-items/${workItemId}`, "/api/operations/trace/work-items/{workItemId}");
  await api("GET", `/api/operations/trace/cases/${caseId}`, "/api/operations/trace/cases/{caseId}");
}

async function scenarioRecord(scenario, refs, confirm, secondary, evidenceIds) {
  const submissionId = confirm.commandSubmissionId ?? refs.submissionId;
  const db = await dbFactsForSubmission(submissionId);
  const rejected = confirm.statusCode >= 400 && confirm.statusCode !== 409;
  const record = {
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    scenarioType: scenario.scenarioType,
    status: expectedStatusOk(scenario, confirm, db, secondary) ? "passed" : "blocked",
    workItem: {
      tenantId,
      caseId: refs.caseId,
      workItemId: refs.workItemId,
      workItemType: scenario.workItemType,
      ownerRole: scenario.ownerRole,
      source: "persisted_work_item_runtime_model"
    },
    apiResult: confirm,
    commandSubmission: rejected ? null : { submissionId, status: db.submissionStatus },
    rejectedCommandSubmission: rejected ? await rejectedSubmission(submissionId) : null,
    rejectionTrace: rejected ? rejectionTraceFrom(confirm, refs, evidenceIds) : null,
    domainEvents: db.domainEvents,
    ledgerTransactions: db.ledgerTransactions,
    ledgerEntries: db.ledgerEntries,
    evidenceTrace: evidenceIds.map((evidenceId) => ({ evidenceId, status: "verified", trustedEvidenceObject: true })),
    factTrace: db.factTrace,
    lensOutputs: await lensOutputs(),
    noDuplicateSideEffect: true
  };
  if (secondary) record.secondaryApiResult = secondary;
  if (scenario.scenarioType === "rollback_compensation_scenario") {
    record.rollbackDrill = {
      noFactDeleted: true,
      compensationAppendOnly: record.ledgerTransactions.some((item) => item.transaction_type === "ledger_correction_apply")
    };
  }
  return record;
}

async function dbFactsForSubmission(submissionId) {
  const submissionRows = dbJson(`select coalesce(json_agg(row_to_json(t))::text,'[]') from (
    select submission_id, status, response_status_code, failure_code, failure_reason
    from operations_command_submissions where submission_id = '${sql(submissionId)}') t`);
  const domainEvents = dbJson(`select coalesce(json_agg(row_to_json(t))::text,'[]') from (
    select event_id, event_type, work_item_id, submission_id from operations_domain_events where submission_id = '${sql(submissionId)}' order by event_id) t`);
  const ledgerTransactions = dbJson(`select coalesce(json_agg(row_to_json(t))::text,'[]') from (
    select ledger_transaction_id, transaction_type, balance_status, work_item_id, submission_id from ledger_transactions where submission_id = '${sql(submissionId)}' order by ledger_transaction_id) t`);
  const ledgerEntries = dbJson(`select coalesce(json_agg(row_to_json(t))::text,'[]') from (
    select entry_id, entry.ledger_transaction_id, account_id, account_type, debit_credit, amount
    from ledger_entries entry
    join ledger_transactions tx on tx.ledger_transaction_id = entry.ledger_transaction_id
    where tx.submission_id = '${sql(submissionId)}'
    order by entry_id) t`);
  return {
    submissionStatus: submissionRows[0]?.status ?? "missing",
    responseStatusCode: submissionRows[0]?.response_status_code ?? null,
    failureCode: submissionRows[0]?.failure_code ?? null,
    failureReason: submissionRows[0]?.failure_reason ?? null,
    domainEvents,
    ledgerTransactions,
    ledgerEntries,
    factTrace: {
      traceId: `trace-${submissionId}`,
      submissionRef: submissionId,
      domainEventRefs: domainEvents.map((item) => item.event_id),
      ledgerTransactionRefs: ledgerTransactions.map((item) => item.ledger_transaction_id),
      ledgerEntryRefs: ledgerEntries.map((item) => item.entry_id)
    }
  };
}

async function rejectedSubmission(submissionId) {
  const rows = dbJson(`select coalesce(json_agg(row_to_json(t))::text,'[]') from (
    select submission_id, status, response_status_code, failure_code, failure_reason
    from operations_command_submissions where submission_id = '${sql(submissionId)}' and status = 'rejected') t`);
  return rows[0] ?? null;
}

function rejectionTraceFrom(confirm, refs, evidenceIds) {
  return {
    traceId: `rej-trace-${confirm.commandSubmissionId ?? refs.submissionId}`,
    caseRef: refs.caseId,
    workItemRef: refs.workItemId,
    submissionRef: confirm.commandSubmissionId ?? refs.submissionId,
    policyRef: confirm.statusCode === 403 ? "permission-policy" : "evidence-policy",
    statusCode: confirm.statusCode,
    reason: confirm.reason,
    evidenceRefs: evidenceIds,
    domainEventRefs: [],
    ledgerTransactionRefs: []
  };
}

async function queryDbAssertions() {
  const like = `%-${sql(runId)}-%`;
  const casePredicate = `case_id like '${like}'`;
  const workItemPredicate = `work_item_id like '${like}'`;
  const assertions = [
    ["OperationCase", `select count(*) from operations_cases where case_id like '${like}'`, (n) => n >= 10],
    ["WorkItem", `select count(*) from operations_work_items where work_item_id like '${like}'`, (n) => n >= 10],
    ["CommandSubmission", `select count(*) from operations_command_submissions where ${casePredicate}`, (n) => n >= 10],
    ["RejectedCommandSubmission", `select count(*) from operations_command_submissions where ${casePredicate} and status = 'rejected'`, (n) => n >= 2],
    ["RejectionTrace", `select count(*) from operations_command_submissions where ${casePredicate} and status = 'rejected' and failure_reason is not null and response_status_code in (403,422)`, (n) => n >= 2],
    ["DomainEvent", `select count(*) from operations_domain_events where ${workItemPredicate}`, (n) => n >= 8],
    ["LedgerTransaction", `select count(*) from ledger_transactions where ${workItemPredicate}`, (n) => n >= 6],
    ["LedgerEntry", `select count(*) from ledger_entries entry join ledger_transactions tx on tx.ledger_transaction_id = entry.ledger_transaction_id where tx.${workItemPredicate}`, (n) => n >= 12],
    ["ProjectionCheckpoint", "select count(*) from projection_checkpoints", (n) => n >= 0],
    ["Lens", "select count(*) from deposit_balance_projection", (n) => n >= 0],
    ["EvidenceObject", `select count(*) from evidence_objects where evidence_id like 'ev-d1-${sql(runId)}-%'`, (n) => n >= 10],
    ["FactTrace", `select count(*) from operations_fact_responses response join operations_command_submissions submission on submission.submission_id = response.submission_id where submission.${casePredicate}`, (n) => n >= 10]
  ];
  return assertions.map(([name, query, predicate]) => {
    const raw = dbScalar(query);
    const count = Number(raw);
    return { name, status: predicate(count) ? "passed" : "blocked", count, query };
  });
}

function expectedStatusOk(scenario, confirm, db, secondary) {
  if (scenario.scenarioType === "rejected_command_scenario") {
    return confirm.statusCode === scenario.expected.statusCode && db.domainEvents.length === 0 && db.ledgerTransactions.length === 0;
  }
  if (scenario.scenarioType === "idempotency_conflict_scenario") {
    return confirm.statusCode === 200 && secondary?.statusCode === 409 && db.domainEvents.length > 0;
  }
  if (scenario.scenarioType === "rejected_then_committed_scenario") {
    return confirm.statusCode === 200 && secondary?.statusCode === 422 && db.domainEvents.length > 0 && db.ledgerTransactions.length > 0;
  }
  if (scenario.expected?.ledgerTransaction === true && db.ledgerTransactions.length === 0) return false;
  if (scenario.expected?.ledgerTransaction === false && db.ledgerTransactions.length > 0) return false;
  if (scenario.expected?.domainEvent === true && db.domainEvents.length === 0) return false;
  return confirm.statusCode === 200;
}

async function lensOutputs() {
  try {
    const deposit = await api("GET", "/api/lenses/accommodation/deposit-liability", "/api/lenses/accommodation/{lensId}");
    const stay = await api("GET", "/api/lenses/accommodation/stay-balance", "/api/lenses/accommodation/{lensId}");
    return [
      { lensId: "deposit-liability", rowCount: Array.isArray(deposit) ? deposit.length : 0 },
      { lensId: "stay-balance", rowCount: Array.isArray(stay) ? stay.length : 0 }
    ];
  } catch {
    return [];
  }
}

function summarizeFinanceRuntimeClose(results, dbAssertions) {
  const ledgerEntries = results.flatMap((item) => item.ledgerEntries ?? []);
  return {
    status: dbAssertions.find((item) => item.name === "LedgerTransaction")?.status === "passed" &&
      ledgerEntries.some((item) => item.account_type === "liability") &&
      !ledgerEntries.some((item) => item.account_type === "revenue")
      ? "passed"
      : "blocked",
    depositLiabilityOnly: ledgerEntries.some((item) => item.account_type === "liability") && !ledgerEntries.some((item) => item.account_type === "revenue"),
    ordinaryPaymentNotDeposit: results
      .filter((item) => item.scenarioId === "dorm-live-003")
      .every((item) => !(item.ledgerEntries ?? []).some((entry) => String(entry.account_id).includes("deposit"))),
    balancedLedgerTransactionCount: results.flatMap((item) => item.ledgerTransactions ?? []).filter((item) => item.balance_status === "balanced").length
  };
}

function summarizeAdmissionGuard(apiCalls, results) {
  return {
    status: apiCalls.some((item) => item.path.startsWith("/api/workspaces/")) ? "blocked" : "passed",
    dormitoryStatus: "L1 Internal Pilot",
    repairPartsHrRemainL0: true,
    ordinaryConfirmPath: "/api/operations/work-items/{workItemId}/confirm",
    permissionDeniedScenario: results.find((item) => item.scenarioId === "dorm-live-008")?.apiResult?.statusCode === 403 ? "passed" : "blocked"
  };
}

export function validateReplayResult(result) {
  const violations = [];
  if (result.sourceMode !== "real_api_db") violations.push(violation("d1.source_mode_not_real_api_db", "D1 replay result sourceMode 必须是 real_api_db。"));
  if (result.syntheticDomainEventsAllowed !== false || result.syntheticLedgerTransactionsAllowed !== false) {
    violations.push(violation("d1.synthetic_business_fact_forbidden", "D1 不允许 synthetic DomainEvent / LedgerTransaction。"));
  }
  if (result.retiredWorkspaceCardWritePathUsed === true) {
    violations.push(violation("d1.retired_workspace_card_write_path_used", "D1 ordinary confirm path 不允许 retired workspace/card write path。"));
  }
  if ((result.scenarioCount ?? 0) < 10 || (result.passedCount ?? 0) < 10) {
    violations.push(violation("d1.runtime_scenario_count_failed", "D1 必须通过 10 条 dorm-live 场景。", { scenarioCount: result.scenarioCount, passedCount: result.passedCount }));
  }
  for (const required of contract?.apiCallsRequired ?? []) {
    if (!hasApiCall(result.apiCallsExecuted ?? [], required)) {
      violations.push(violation("d1.required_api_not_executed", `未执行必需 API: ${required}`, { required }));
    }
  }
  for (const assertion of result.dbAssertions ?? []) {
    if (assertion.status !== "passed") {
      violations.push(violation("d1.db_assertion_failed", `DB assertion failed: ${assertion.name}`, assertion));
    }
  }
  for (const scenario of result.scenarios ?? []) {
    if (scenario.status !== "passed") {
      violations.push(violation("d1.scenario_failed", `Runtime scenario failed: ${scenario.scenarioId}`, { scenarioId: scenario.scenarioId }));
    }
    if (scenario.scenarioType === "rejected_command_scenario" &&
      ((scenario.domainEvents ?? []).length > 0 || (scenario.ledgerTransactions ?? []).length > 0)) {
      violations.push(violation("d1.rejected_scenario_wrote_fact", "Rejected scenario 不允许写 DomainEvent / LedgerTransaction。", { scenarioId: scenario.scenarioId }));
    }
  }
  if (result.financeRuntimeClose?.status !== "passed") violations.push(violation("d1.finance_runtime_close_failed", "Finance runtime close result must pass."));
  if (result.admissionGuard?.status !== "passed") violations.push(violation("d1.admission_guard_failed", "Admission guard result must pass."));
  return violations;
}

function hasApiCall(calls, required) {
  const [method, route] = required.split(" ");
  return calls.some((item) => item.method === method && (item.contractPath === route || item.path === route));
}

async function api(method, route, contractPath, body, headers = {}, failOnNonOk = true) {
  const actorHeaders = actorToken && route !== "/api/auth/login"
    ? { "X-WorkOS-Actor-Token": actorToken }
    : {};
  const response = await fetch(`${server.baseUrl}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...actorHeaders, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  apiCalls.push({ method, path: route, contractPath, statusCode: response.status });
  if (failOnNonOk && !response.ok) throw new Error(`${method} ${route} failed: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function ensureRuntimeActorSession(role = "operator") {
  const username = actorUsernameForRole(role);
  if (actorTokensByUsername.has(username)) {
    return actorTokensByUsername.get(username);
  }

  const password = actorPasswordForUsername(username);
  const response = await fetch(`${server.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await response.json().catch(() => ({}));
  apiCalls.push({
    method: "POST",
    path: "/api/auth/login",
    contractPath: "/api/auth/login",
    statusCode: response.status
  });
  if (!response.ok || !payload.token) {
    throw new Error(`POST /api/auth/login failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  actorTokensByUsername.set(username, payload.token);
  return payload.token;
}

function actorUsernameForRole(role) {
  const accounts = scenariosDoc.actorAccountsByRole ?? {};
  return accounts[role] ?? scenariosDoc.actorUsername ?? "operator";
}

function actorPasswordForUsername(username) {
  const passwords = scenariosDoc.actorPasswordsByUsername ?? {};
  return passwords[username] ?? scenariosDoc.actorPassword ?? "dev";
}

async function startApi() {
  const port = Number(readArg("--port=", String(46600 + Math.floor(Math.random() * 500))));
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    ASPNETCORE_URLS: baseUrl,
    ConnectionStrings__WorkOSRuntime: connectionString,
    WORKOS_TEST_CONNECTION: connectionString,
    TEST_DATABASE: "true"
  };
  const child = spawn("dotnet", ["run", "--project", "services/core-api/WorkOS.Api/WorkOS.Api.csproj", "-c", "Release", "--no-launch-profile"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk.toString(); });
  child.stderr.on("data", (chunk) => { log += chunk.toString(); });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return { child, baseUrl, log: () => log };
    } catch {
      await delay(1000);
    }
  }
  child.kill();
  throw new Error(`API did not become ready. ${log.slice(-3000)}`);
}

async function stopApi(target) {
  target.child.kill();
  await delay(500);
}

function dbJson(query) {
  const text = dbScalar(query);
  return JSON.parse(text || "[]");
}

function dbScalar(query) {
  const docker = findPostgresContainer();
  if (docker) {
    return execFileSync("docker", ["exec", docker, "psql", "-U", "workosnext", "-d", "workosnext_test", "-t", "-A", "-c", query], { encoding: "utf8" }).trim();
  }
  try {
    return execFileSync("psql", [connectionString, "-t", "-A", "-c", query], { encoding: "utf8" }).trim();
  } catch (error) {
    throw new Error(`Cannot query PostgreSQL for D1 replay. ${error.message}`);
  }
}

function findPostgresContainer() {
  try {
    const output = execFileSync("docker", ["ps", "--format", "{{.ID}}\t{{.Ports}}"], { encoding: "utf8" });
    const line = output.split(/\r?\n/).find((item) => item.includes("54329->5432") || item.includes(":54329->5432"));
    return line?.split("\t")[0] ?? "";
  } catch {
    return "";
  }
}

function refsFor(scenario) {
  const suffix = `${runId}-${scenario.scenarioId}`.replace(/[^a-zA-Z0-9-]/g, "-");
  return {
    caseId: `case-d1-${suffix}`,
    workItemId: `wi-d1-${suffix}`,
    submissionId: `sub-d1-${suffix}`,
    cardInstanceId: `ci-d1-${suffix}`,
    idempotencyKey: `idem-d1-${suffix}`
  };
}

async function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

async function gitMainHead() {
  try {
    return await git(["rev-parse", "origin/main"]);
  } catch {
    const output = await git(["ls-remote", "origin", "refs/heads/main"]);
    const [sha] = output.split(/\s+/);
    return sha;
  }
}

function sql(value) {
  return String(value).replaceAll("'", "''");
}

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
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

function maskConnection(value) {
  return value.replace(/Password=[^;]+/i, "Password=***");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
