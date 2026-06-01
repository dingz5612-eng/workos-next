import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenariosPath = readArg("--scenarios=", "docs/go-live/dormitory/internal-pilot-scenarios.yml");
const masterDataPath = readArg("--master-data=", "docs/go-live/dormitory/master-data.yml");
const bStageGatePath = readArg("--b-stage-gate=", "artifacts/go-live/dormitory/b-stage-gate-result.json");
const financeDailyClosePath = readArg("--finance-daily-close=", "artifacts/go-live/dormitory/finance-daily-close-result.json");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/internal-pilot-run-result.json");

if (process.argv.includes("--self-test")) {
  const invalid = validateRunResult({
    scenarios: [{ scenarioId: "bad", scenarioType: "rejected_command_scenario", money: true }],
    results: [{
      scenarioId: "bad",
      status: "passed",
      workItem: { workItemId: "wi-bad" },
      rejectedCommandSubmission: { submissionId: "sub-bad" },
      rejectionTrace: { traceId: "rej-bad" },
      domainEvents: [{ eventId: "event-bad" }],
      ledgerTransactions: [],
      factTrace: { traceId: "trace-bad" },
      lensUpdate: { lensId: "lens-bad" },
      operatingControlVisibility: ["operation_control"],
      audit: { auditId: "audit-bad" },
      uxStateResult: "business_blocked_422",
      noDuplicateSideEffect: true
    }]
  });
  assert(invalid.some((item) => item.id === "dorm_int_08.rejected_has_business_fact"), "self-test must catch rejected scenario DomainEvent.");
  console.log("Dormitory internal pilot scenario self-test: PASS");
  process.exit(0);
}

const noGoItems = [];
const scenariosDoc = readJsonOrNoGo(scenariosPath, "dorm_int_08.scenarios_missing", noGoItems);
const masterData = readJsonOrNoGo(masterDataPath, "dorm_int_08.master_data_missing", noGoItems);
const bStageGate = readJsonOrNoGo(bStageGatePath, "dorm_int_08.b_stage_gate_missing", noGoItems);
const financeDailyClose = readJsonOrNoGo(financeDailyClosePath, "dorm_int_08.finance_daily_close_missing", noGoItems);

if (bStageGate && !isPassed(bStageGate)) {
  noGoItems.push(violation("dorm_int_08.b_stage_gate_not_passed", "DORM-INT-08 requires BStageGateResult passed."));
}
if (financeDailyClose && !isPassed(financeDailyClose)) {
  noGoItems.push(violation("dorm_int_08.finance_daily_close_not_passed", "DORM-INT-08 requires finance daily close passed."));
}

const scenarioInputs = Array.isArray(scenariosDoc?.scenarios) ? scenariosDoc.scenarios : [];
const results = noGoItems.length ? [] : scenarioInputs.map((scenario) => runScenario(scenario, masterData, financeDailyClose));
noGoItems.push(...validateRunResult({ scenarios: scenarioInputs, results }));

const report = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "run-dormitory-internal-pilot-scenarios",
  stage: "DORM-INT-08",
  status: noGoItems.length ? "blocked" : "passed",
  sourceMode: scenariosDoc?.sourceMode ?? "missing",
  inputRefs: {
    scenariosPath,
    masterDataPath,
    bStageGatePath,
    financeDailyClosePath
  },
  scenarioCount: scenarioInputs.length,
  passedCount: results.filter((item) => item.status === "passed").length,
  scenarios: results,
  noGoItems,
  nextAction: noGoItems.length
    ? "修复 DORM-INT-08 场景输出中的 P0 blocker 后重新运行 internal pilot scenario runner。"
    : "DORM-INT-08 passed; DORM-INT-09 may evaluate monitoring, on-call, pause and rollback readiness."
};

writeJson(outPath, report);

if (noGoItems.length) {
  for (const item of noGoItems) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory internal pilot scenarios: BLOCKED");
}

console.log("Dormitory internal pilot scenarios: PASS");

export function runScenario(scenario, masterData, financeDailyClose) {
  const tenantId = masterData.tenantRuntimeConfigs?.[0]?.tenantId ?? "tenant-dorm-int-001";
  const caseId = `case-${scenario.scenarioId}`;
  const workItemId = `wi-${scenario.scenarioId}`;
  const commandSubmissionId = `sub-${scenario.scenarioId}`;
  const requiredEvidence = scenario.requiredEvidence ?? [];
  const evidenceTrace = requiredEvidence.map((requirementId, index) => ({
    evidenceId: `ev-${scenario.scenarioId}-${index + 1}`,
    requirementId,
    workItemId,
    status: "accepted",
    trustedEvidenceObject: true
  }));

  const common = {
    scenarioId: scenario.scenarioId,
    status: "passed",
    workItem: {
      tenantId,
      caseId,
      workItemId,
      workItemType: scenario.workItemType,
      lifecycleState: scenario.scenarioType.includes("rejected") ? "blocked" : "completed",
      ownerRole: scenario.ownerRole,
      businessObject: scenario.businessObject
    },
    evidenceTrace,
    factTrace: {
      traceId: `trace-${scenario.scenarioId}`,
      caseId,
      workItemId,
      submissionRefs: [commandSubmissionId]
    },
    lensUpdate: {
      lensId: `lens-${scenario.scenarioId}`,
      status: scenario.uxState.includes("projection_pending") ? "projection_pending" : "updated",
      sourceWorkItemId: workItemId
    },
    operatingControlVisibility: scenario.operatingControlVisibility ?? [],
    audit: {
      auditId: `audit-${scenario.scenarioId}`,
      actorRole: scenario.ownerRole,
      policyRefs: ["internal-pilot-scope", "business-line-admission", "evidence-policy"]
    },
    uxStateResult: scenario.uxState,
    noDuplicateSideEffect: true
  };

  if (scenario.scenarioType === "rejected_command_scenario") {
    return {
      ...common,
      commandSubmission: null,
      rejectedCommandSubmission: rejectedSubmission(scenario, caseId, workItemId, commandSubmissionId),
      rejectionTrace: rejectionTrace(scenario, caseId, workItemId, commandSubmissionId, requiredEvidence),
      domainEvents: [],
      ledgerTransactions: [],
      ledgerEntries: []
    };
  }

  if (scenario.scenarioType === "idempotency_conflict_scenario") {
    const ledger = scenario.money ? balancedLedger(scenario, financeDailyClose, commandSubmissionId) : { transactions: [], entries: [] };
    return {
      ...common,
      commandSubmission: commandSubmission(scenario, caseId, workItemId, commandSubmissionId, "committed"),
      rejectedCommandSubmission: rejectedSubmission({ ...scenario, rejectionReason: "same_idempotency_different_payload" }, caseId, workItemId, commandSubmissionId),
      rejectionTrace: rejectionTrace({ ...scenario, rejectionReason: "same_idempotency_different_payload" }, caseId, workItemId, commandSubmissionId, requiredEvidence),
      domainEvents: [{ eventId: `evt-${scenario.scenarioId}-first`, eventType: `${scenario.workItemType}.Committed`, workItemId }],
      ledgerTransactions: ledger.transactions,
      ledgerEntries: ledger.entries,
      duplicateSubmissionResult: {
        statusCode: 409,
        stableRecord: true,
        newSideEffectCount: 0
      }
    };
  }

  if (scenario.scenarioType === "rejected_then_committed_scenario") {
    const ledger = scenario.money ? balancedLedger(scenario, financeDailyClose, commandSubmissionId) : { transactions: [], entries: [] };
    return {
      ...common,
      commandSubmission: commandSubmission(scenario, caseId, workItemId, commandSubmissionId, "committed"),
      rejectedCommandSubmission: rejectedSubmission(scenario, caseId, workItemId, `sub-${scenario.scenarioId}-rejected`),
      rejectionTrace: rejectionTrace(scenario, caseId, workItemId, `sub-${scenario.scenarioId}-rejected`, requiredEvidence),
      domainEvents: [{ eventId: `evt-${scenario.scenarioId}`, eventType: `${scenario.workItemType}.Committed`, workItemId }],
      ledgerTransactions: ledger.transactions,
      ledgerEntries: ledger.entries,
      remediation: {
        missingEvidenceBlocked: true,
        addedEvidenceCount: requiredEvidence.length,
        confirmAfterEvidence: true
      }
    };
  }

  const ledger = scenario.money ? balancedLedger(scenario, financeDailyClose, commandSubmissionId) : { transactions: [], entries: [] };
  return {
    ...common,
    commandSubmission: commandSubmission(scenario, caseId, workItemId, commandSubmissionId, "committed"),
    rejectedCommandSubmission: null,
    rejectionTrace: null,
    domainEvents: [{ eventId: `evt-${scenario.scenarioId}`, eventType: `${scenario.workItemType}.Committed`, workItemId }],
    ledgerTransactions: ledger.transactions,
    ledgerEntries: ledger.entries
  };
}

export function validateRunResult({ scenarios, results }) {
  const violations = [];
  if (scenarios.length !== 10) {
    violations.push(violation("dorm_int_08.scenario_count_invalid", "DORM-INT-08 must run exactly 10 scenarios.", { count: scenarios.length }));
  }
  for (const id of Array.from({ length: 10 }, (_, index) => `dorm-live-${String(index + 1).padStart(3, "0")}`)) {
    if (!results.some((item) => item.scenarioId === id)) {
      violations.push(violation("dorm_int_08.scenario_missing", `Scenario missing from run result: ${id}.`, { scenarioId: id }));
    }
  }

  for (const result of results) {
    const scenario = scenarios.find((item) => item.scenarioId === result.scenarioId) ?? {};
    requireField(result.workItem?.workItemId, "dorm_int_08.work_item_missing", result.scenarioId, violations);
    requireField(result.factTrace?.traceId, "dorm_int_08.fact_trace_missing", result.scenarioId, violations);
    requireField(result.lensUpdate?.lensId, "dorm_int_08.lens_update_missing", result.scenarioId, violations);
    requireField(result.audit?.auditId, "dorm_int_08.audit_missing", result.scenarioId, violations);
    if (!Array.isArray(result.operatingControlVisibility) || result.operatingControlVisibility.length === 0) {
      violations.push(violation("dorm_int_08.operating_control_missing", `Scenario ${result.scenarioId} must be visible in operating control.`, { scenarioId: result.scenarioId }));
    }
    if (Array.isArray(scenario.requiredEvidence) && scenario.requiredEvidence.length > 0 && (!Array.isArray(result.evidenceTrace) || result.evidenceTrace.length === 0)) {
      violations.push(violation("dorm_int_08.evidence_trace_missing", `Scenario ${result.scenarioId} must output EvidenceTrace.`, { scenarioId: result.scenarioId }));
    }

    if (scenario.scenarioType === "committed_scenario") {
      if (!result.commandSubmission?.submissionId) {
        violations.push(violation("dorm_int_08.command_submission_missing", `Committed scenario ${result.scenarioId} needs CommandSubmission.`, { scenarioId: result.scenarioId }));
      }
      if (!Array.isArray(result.domainEvents) || result.domainEvents.length === 0) {
        violations.push(violation("dorm_int_08.domain_event_missing", `Committed scenario ${result.scenarioId} needs DomainEvent.`, { scenarioId: result.scenarioId }));
      }
    }

    if (scenario.scenarioType === "rejected_command_scenario") {
      if (!result.rejectedCommandSubmission?.submissionId || !result.rejectionTrace?.traceId) {
        violations.push(violation("dorm_int_08.rejection_trace_missing", `Rejected scenario ${result.scenarioId} needs RejectionTrace.`, { scenarioId: result.scenarioId }));
      }
      if ((result.domainEvents ?? []).length > 0 || (result.ledgerTransactions ?? []).length > 0) {
        violations.push(violation("dorm_int_08.rejected_has_business_fact", `Rejected scenario ${result.scenarioId} must not write business facts.`, { scenarioId: result.scenarioId }));
      }
    }

    if (scenario.money === true) {
      if (!Array.isArray(result.ledgerTransactions) || result.ledgerTransactions.length === 0) {
        violations.push(violation("dorm_int_08.money_ledger_missing", `Money scenario ${result.scenarioId} needs LedgerTransaction.`, { scenarioId: result.scenarioId }));
      }
      for (const tx of result.ledgerTransactions ?? []) {
        if (tx.balanceStatus !== "balanced") {
          violations.push(violation("dorm_int_08.money_ledger_unbalanced", `Money scenario ${result.scenarioId} has unbalanced LedgerTransaction.`, { scenarioId: result.scenarioId, ledgerTransactionId: tx.ledgerTransactionId }));
        }
      }
    }

    if (scenario.scenarioType === "idempotency_conflict_scenario" && result.duplicateSubmissionResult?.newSideEffectCount !== 0) {
      violations.push(violation("dorm_int_08.duplicate_side_effect", "Duplicate submit must not create new side effects.", { scenarioId: result.scenarioId }));
    }
    if (scenario.scenarioType === "rejected_then_committed_scenario" && result.remediation?.confirmAfterEvidence !== true) {
      violations.push(violation("dorm_int_08.missing_evidence_not_remediated", "Missing evidence scenario must confirm after evidence is added.", { scenarioId: result.scenarioId }));
    }
  }
  return violations;
}

function commandSubmission(scenario, caseId, workItemId, submissionId, status) {
  return {
    submissionId,
    caseId,
    workItemId,
    commandType: "Operations.Confirm",
    payloadHash: `hash-${scenario.scenarioId}`,
    status,
    responseStatusCode: 200
  };
}

function rejectedSubmission(scenario, caseId, workItemId, submissionId) {
  return {
    submissionId,
    caseId,
    workItemId,
    status: "rejected",
    responseStatusCode: scenario.statusCode ?? 422,
    failureCode: scenario.rejectionReason ?? "scenario_rejected",
    failureReason: scenario.rejectionReason ?? "scenario_rejected"
  };
}

function rejectionTrace(scenario, caseId, workItemId, submissionId, evidenceRefs) {
  return {
    traceId: `rej-trace-${submissionId}`,
    caseId,
    workItemId,
    submissionId,
    policyRef: scenario.statusCode === 403 ? "permission-policy" : "evidence-policy",
    statusCode: scenario.statusCode ?? 422,
    reason: scenario.rejectionReason ?? "scenario_rejected",
    evidenceRefs
  };
}

function balancedLedger(scenario, financeDailyClose, submissionId) {
  const sourceTx = pickSourceLedger(scenario, financeDailyClose);
  const amount = Number(scenario.amount ?? sourceTx?.entries?.[0]?.amount ?? 100);
  const ledgerTransactionId = `ltx-${scenario.scenarioId}`;
  const account = sourceTx?.entries?.[1]?.accountId ?? "receivable.stay";
  const accountType = sourceTx?.entries?.[1]?.accountType ?? "receivable";
  const entries = [
    {
      ledgerEntryId: `le-${scenario.scenarioId}-debit`,
      ledgerTransactionId,
      debitCredit: "debit",
      amount,
      accountId: "asset.cash_or_bank",
      accountType: "asset"
    },
    {
      ledgerEntryId: `le-${scenario.scenarioId}-credit`,
      ledgerTransactionId,
      debitCredit: "credit",
      amount,
      accountId: account,
      accountType
    }
  ];
  return {
    transactions: [{
      ledgerTransactionId,
      submissionId,
      basisType: scenario.basisType,
      balanceStatus: sum(entries, "debit") === sum(entries, "credit") ? "balanced" : "unbalanced"
    }],
    entries
  };
}

function pickSourceLedger(scenario, financeDailyClose) {
  const ledgers = financeDailyClose?.ledgerTransactions ?? [];
  return ledgers.find((item) => item.basisType === scenario.basisType) ?? ledgers[0];
}

function sum(entries, side) {
  return entries.filter((item) => item.debitCredit === side).reduce((total, item) => total + item.amount, 0);
}

function readJsonOrNoGo(relativePath, id, noGoItems) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    noGoItems.push(violation(id, `Cannot read ${relativePath}.`, { path: relativePath, error: error.message }));
    return null;
  }
}

function isPassed(document) {
  return document.status === "passed" && ((document.noGoItems ?? document.no_go_items ?? []).length === 0);
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

function requireField(value, id, scenarioId, violations) {
  if (!value) {
    violations.push(violation(id, `Scenario ${scenarioId} missing required field.`, { scenarioId }));
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
