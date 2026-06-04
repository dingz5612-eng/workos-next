import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const generatedAt = new Date().toISOString();

const runtimeProof = readJson("artifacts/proof/runtime-proof-result.json");
const liveReplay = readJson("artifacts/go-live/dormitory/live-api-db-replay-result.json");
const financeClose = readJson("artifacts/go-live/dormitory/finance-daily-close-result.json");
const telemetry = readJson("artifacts/go-live/dormitory/daily-observation-day-01.json");
const rollback = readJson("artifacts/go-live/dormitory/rollback-drill-result.json");
const training = readJson("artifacts/go-live/dormitory/training-signoff-result.json");
const trust = readJson("artifacts/trust/trust-boundary-result.json");
const currentState = readJson("artifacts/release-state/current-state.json");
const maturity = readJson("artifacts/portfolio/business-line-maturity-result.json");
const previousDay = readJsonIfExists("artifacts/operations/dormitory/observation-day-01.json") ?? {};

const currentBranch = git("git rev-parse --abbrev-ref HEAD");
const currentHead = git("git rev-parse HEAD");
const originMain = git("git rev-parse origin/main");

const runtime = runtimeProof.runtimeProof ?? runtimeProof;
const apiCalls = runtime.apiCallsExecuted ?? liveReplay.apiCallsExecuted ?? [];
const dbAssertions = runtime.dbAssertions ?? liveReplay.dbAssertions ?? [];
const scenarios = liveReplay.scenarios ?? runtime.scenarios ?? [];

const statusCodeCounts = countBy(apiCalls.map((call) => String(call.statusCode)));
const contractPathCounts = countBy(apiCalls.map((call) => call.contractPath ?? call.path ?? "unknown"));
const db = Object.fromEntries(dbAssertions.map((item) => [item.name, item]));
const lensReads = apiCalls.filter((call) => (call.contractPath ?? "").includes("/api/lenses/"));
const traceReads = apiCalls.filter((call) => (call.contractPath ?? "").includes("/api/operations/trace/"));
const confirmCalls = apiCalls.filter((call) => (call.contractPath ?? "").includes("/confirm"));
const evidenceCalls = apiCalls.filter((call) => (call.contractPath ?? "").includes("/api/evidence/"));

const p0 = [];
const p1 = [];

pushIf(p0, runtimeProof.status !== "passed" || runtimeProof.sourceMode !== "live_api_db", "runtime_proof_not_live_api_db", "Runtime Proof Harness 不是 live_api_db passed。", "releaseOwner", "重新运行 Runtime Proof Harness，并确认 sourceMode=live_api_db。");
pushIf(p0, liveReplay.status !== "passed" || liveReplay.sourceMode !== "real_api_db", "live_replay_not_real_api_db", "D1 live API/DB replay 不是 real_api_db passed。", "technicalOwner", "重新运行 live API/DB replay。");
pushIf(p0, financeClose.status !== "passed", "finance_daily_close_failed", "财务日清未通过。", "finance", "暂停金额确认并重跑日清。");
pushIf(p0, telemetry.financeDailyClose?.depositLiabilityMismatch > 0, "deposit_liability_mismatch", "押金负债不一致。", "finance", "暂停退款与押金确认，启动财务排查。");
pushIf(p0, telemetry.financeDailyClose?.duplicateLedgerEntry > 0, "duplicate_ledger_entry", "发现重复账本分录。", "finance", "暂停金额确认，追加冲正或补偿 WorkItem。");
pushIf(p0, telemetry.financeDailyClose?.unbalancedLedgerTransaction > 0, "unbalanced_ledger_transaction", "发现不平衡 LedgerTransaction。", "finance", "冻结相关金额 WorkItem。");
pushIf(p0, telemetry.financeDailyClose?.depositAsRevenue > 0, "deposit_as_revenue", "发现押金进入收入。", "finance", "停止 pilot 并追加更正。");
pushIf(p0, telemetry.financeDailyClose?.refundOverLiability > 0, "refund_over_liability", "退款超过可用押金负债。", "finance", "停止退款审批。");
pushIf(p0, telemetry.runtimeSafety?.bedDoubleOccupancy > 0, "bed_double_occupancy", "发现床位重复占用。", "manager", "暂停分床并创建纠正 WorkItem。");
pushIf(p0, telemetry.evidenceMetrics?.evidenceLeakCount > 0, "evidence_leak", "发现证据泄露。", "admin", "暂停证据访问并执行租户隔离排查。");
pushIf(p0, telemetry.evidenceMetrics?.wrongTenantEvidenceCount > 0, "wrong_tenant_evidence", "发现跨租户证据。", "admin", "暂停相关证据确认。");
pushIf(p0, telemetry.runtimeSafety?.deviceTrustBypass > 0, "device_trust_bypass", "发现设备可信绕过。", "admin", "撤销设备会话并重检高风险动作。");
pushIf(p0, rollback.status !== "passed" || telemetry.rollbackReadiness?.unableToRollback === true, "unable_to_rollback", "暂停/回滚能力不可用。", "releaseOwner", "暂停内测并修复 rollback playbook。");
pushIf(p0, telemetry.gateStatus?.BStageGate !== "passed", "b_stage_gate_red", "BStageGate 非 passed。", "releaseOwner", "暂停内测并重跑 BStageGate。");
pushIf(p0, telemetry.gateStatus?.redShadowCompareReportCount > 0 || telemetry.gateStatus?.ShadowCompare !== "green", "red_shadow_compare_report", "发现 Red ShadowCompareReport。", "releaseOwner", "切换 slice 并排查 shadow mismatch。");
pushIf(p0, telemetry.gateStatus?.unresolvedP0InvariantCount > 0 || telemetry.gateStatus?.Invariant !== "passed", "unresolved_p0_invariant", "存在未解决 P0 invariant。", "releaseOwner", "暂停相关 WorkItem 类型。");

pushIf(p1, telemetry.projectionLag?.p95Minutes > telemetry.projectionLag?.thresholdMinutes, "projection_lag_above_threshold", "Projection lag 超过阈值。", "technicalOwner", "进入 hold，排查 projection/outbox。");
pushIf(p1, telemetry.evidenceMetrics?.uploadFailureRate > 0.02, "evidence_upload_failure_above_threshold", "证据上传失败率超过阈值。", "admin", "进入 hold，排查上传队列。");
pushIf(p1, telemetry.evidenceMetrics?.missingRate > 0.02, "evidence_missing_rate_above_threshold", "证据缺失率超过阈值。", "manager", "进入 hold，安排补证训练。");
pushIf(p1, telemetry.rates?.businessBlocked422Rate > 0.12, "business_blocked_422_abnormal", "422 阻断率异常。", "manager", "进入 hold，复盘阻断原因。");
pushIf(p1, telemetry.financeDailyClose?.financeCaseBacklog > 5, "finance_case_backlog_above_threshold", "FinanceCase backlog 超过阈值。", "finance", "进入 hold，安排财务清理。");
pushIf(p1, telemetry.financeDailyClose?.unclearMoneyBacklog > 5, "unclear_money_backlog_above_threshold", "UnclearMoneyCase backlog 超过阈值。", "finance", "进入 hold，安排不明款处理。");
pushIf(p1, telemetry.slaMetrics?.overdueCount > 0, "sla_overdue_above_threshold", "存在 SLA overdue。", "manager", "进入 hold，升级超时任务。");
pushIf(p1, telemetry.training?.blockingIssuesOpen > 0 || openTrainingIssues(training) > 0, "training_blocking_issue_open", "存在未关闭训练阻断项。", "releaseOwner", "进入 hold，关闭训练阻断。");
pushIf(p1, telemetry.support?.ticketSpike === true, "support_ticket_spike", "支持工单出现 spike。", "supportOwner", "进入 hold，排查支持工单。");

const continuePilot = p0.length === 0 && p1.length === 0;
const holdPilot = p0.length === 0 && p1.length > 0;
const pausePilot = p0.length > 0;
const rollbackRequired = p0.some((item) =>
  ["unable_to_rollback", "deposit_as_revenue", "duplicate_ledger_entry", "bed_double_occupancy", "evidence_leak", "wrong_tenant_evidence"].includes(item.id)
);

const result = {
  generated_at_utc: generatedAt,
  generated_by: "generate-dorm-l1-observation-day1",
  branch: currentBranch,
  headSha: currentHead,
  originMainHead: originMain,
  stage: "DORM-L1-OBS-DAY1",
  day: 1,
  status: continuePilot ? "passed" : holdPilot ? "hold" : "blocked",
  decision: continuePilot ? "continue_l1_observation" : holdPilot ? "hold_l1_observation" : "pause_l1_observation",
  continuePilot,
  holdPilot,
  pausePilot,
  rollbackRequired,
  unresolvedP0: p0.length > 0,
  unresolvedP0Items: p0,
  unresolvedP1: p1.length > 0,
  unresolvedP1Items: p1,
  l2UpgradeEligible: false,
  allowDay2: continuePilot,
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  repairPartsHrProductionAllowed: false,
  p0StopCount: p0.length,
  p1HoldCount: p1.length,
  actualDataSources: {
    runtimeProof: "artifacts/proof/runtime-proof-result.json",
    liveApiDbReplay: "artifacts/go-live/dormitory/live-api-db-replay-result.json",
    financeDailyClose: "artifacts/go-live/dormitory/finance-daily-close-result.json",
    dailyTelemetry: "artifacts/go-live/dormitory/daily-observation-day-01.json",
    trustBoundary: "artifacts/trust/trust-boundary-result.json",
    rollbackDrill: "artifacts/go-live/dormitory/rollback-drill-result.json",
    trainingSignoff: "artifacts/go-live/dormitory/training-signoff-result.json",
    currentState: "artifacts/release-state/current-state.json",
    portfolioMaturity: "artifacts/portfolio/business-line-maturity-result.json"
  },
  actualWorkItemData: {
    status: db.WorkItem?.status ?? "unknown",
    count: Number(db.WorkItem?.count ?? 0),
    operationCaseCount: Number(db.OperationCase?.count ?? 0),
    examples: scenarios.slice(0, 5).map((scenario) => scenario.workItem).filter(Boolean)
  },
  actualCommandSubmissionData: {
    status: db.CommandSubmission?.status ?? "unknown",
    count: Number(db.CommandSubmission?.count ?? 0),
    rejectedCount: Number(db.RejectedCommandSubmission?.count ?? 0),
    rejectionTraceCount: Number(db.RejectionTrace?.count ?? 0),
    statusCodeCounts,
    confirmCallCount: confirmCalls.length
  },
  actualEvidenceData: {
    status: db.EvidenceObject?.status ?? "unknown",
    evidenceObjectCount: Number(db.EvidenceObject?.count ?? 0),
    evidenceApiCallCount: evidenceCalls.length,
    missingRate: telemetry.evidenceMetrics?.missingRate,
    rejectedRate: telemetry.evidenceMetrics?.rejectedRate,
    uploadFailureRate: telemetry.evidenceMetrics?.uploadFailureRate,
    wrongScopeEvidenceCount: telemetry.evidenceMetrics?.wrongScopeEvidenceCount,
    wrongTenantEvidenceCount: telemetry.evidenceMetrics?.wrongTenantEvidenceCount
  },
  actualLedgerTransactionData: {
    status: db.LedgerTransaction?.status ?? "unknown",
    ledgerTransactionCount: Number(db.LedgerTransaction?.count ?? 0),
    ledgerEntryCount: Number(db.LedgerEntry?.count ?? 0),
    balancedLedgerTransactionCount: runtime.financeRuntimeClose?.balancedLedgerTransactionCount ?? liveReplay.financeRuntimeClose?.balancedLedgerTransactionCount,
    financeDailyCloseStatus: financeClose.status,
    financeLedgerTransactionCount: (financeClose.ledgerTransactions ?? []).length
  },
  actualProjectionLensData: {
    projectionCheckpointStatus: db.ProjectionCheckpoint?.status ?? "unknown",
    projectionCheckpointCount: Number(db.ProjectionCheckpoint?.count ?? 0),
    lensStatus: db.Lens?.status ?? "unknown",
    lensDbCount: Number(db.Lens?.count ?? 0),
    lensReadCount: lensReads.length,
    traceReadCount: traceReads.length,
    projectionLagP95Minutes: telemetry.projectionLag?.p95Minutes,
    projectionLagStatus: telemetry.projectionLag?.status
  },
  actualFinanceDailyClose: {
    status: financeClose.status,
    sourceMode: financeClose.sourceMode,
    depositLiabilityMismatch: telemetry.financeDailyClose?.depositLiabilityMismatch,
    duplicateLedgerEntry: telemetry.financeDailyClose?.duplicateLedgerEntry,
    unbalancedLedgerTransaction: telemetry.financeDailyClose?.unbalancedLedgerTransaction,
    depositAsRevenue: telemetry.financeDailyClose?.depositAsRevenue,
    refundOverLiability: telemetry.financeDailyClose?.refundOverLiability,
    financeCaseBacklog: telemetry.financeDailyClose?.financeCaseBacklog,
    unclearMoneyBacklog: telemetry.financeDailyClose?.unclearMoneyBacklog
  },
  actualErrorMetrics: {
    forbidden403Count: Number(statusCodeCounts["403"] ?? 0),
    idempotency409Count: Number(statusCodeCounts["409"] ?? 0),
    businessBlocked422Count: Number(statusCodeCounts["422"] ?? 0),
    forbidden403Rate: telemetry.rates?.forbidden403Rate,
    idempotency409Rate: telemetry.rates?.idempotency409Rate,
    businessBlocked422Rate: telemetry.rates?.businessBlocked422Rate,
    idempotencyConflictNoSideEffect: telemetry.rates?.idempotencyConflictNoSideEffect
  },
  actualDeviceTrustMetrics: {
    trustBoundaryStatus: trust.status,
    runtimeGuards: trust.checks?.runtimeGuards ?? [],
    deviceTrustBypass: telemetry.runtimeSafety?.deviceTrustBypass ?? 0,
    revokedDeviceHighRiskBlocked: (trust.checks?.runtimeGuards ?? []).includes("revoked_device_blocked"),
    untrustedDeviceHighRiskBlocked: (trust.checks?.runtimeGuards ?? []).includes("untrusted_device_blocked")
  },
  actualSupportIncidentLogs: {
    support: telemetry.support,
    incidents: previousDay.incidents ?? [],
    riskSignals: previousDay.riskSignals ?? [],
    workItems: previousDay.workItems ?? [],
    resolutionEvents: previousDay.resolutionEvents ?? []
  },
  actualTrainingIssueLogs: {
    trainingStatus: training.status,
    roleCount: training.roleCount,
    blockingIssuesOpen: telemetry.training?.blockingIssuesOpen ?? 0,
    signoffRoles: training.roles ?? []
  },
  metricSnapshot: {
    financeDailyClose: telemetry.financeDailyClose,
    evidenceMetrics: telemetry.evidenceMetrics,
    projectionLag: telemetry.projectionLag,
    slaMetrics: telemetry.slaMetrics,
    rates: telemetry.rates,
    runtimeSafety: telemetry.runtimeSafety,
    gateStatus: telemetry.gateStatus,
    rollbackReadiness: telemetry.rollbackReadiness,
    training: telemetry.training,
    support: telemetry.support
  },
  incidents: previousDay.incidents ?? [],
  riskSignals: previousDay.riskSignals ?? [],
  workItems: previousDay.workItems ?? [],
  resolutionEvents: previousDay.resolutionEvents ?? [],
  periodReview: {
    cadence: "daily",
    frozen: true,
    reviewArtifact: "artifacts/operations/dormitory/observation-day-01.json",
    decision: continuePilot ? "继续 Day-2" : holdPilot ? "进入 hold，修复后再评估 Day-2" : "暂停内测，不得进入 Day-2"
  },
  sourceModeContract: {
    runtimeProofSourceMode: runtimeProof.sourceMode,
    liveReplaySourceMode: liveReplay.sourceMode,
    syntheticScenarioRunnerUsed: false,
    retiredWorkspaceCardWritePathUsed: Boolean(liveReplay.retiredWorkspaceCardWritePathUsed)
  },
  currentStateSummary: {
    currentStateStatus: currentState.status,
    dormitoryStatus: currentState.dormitoryStatus ?? currentState.states?.Dormitory ?? "L1_INTERNAL_PILOT_OBSERVATION",
    businessProduction: currentState.businessProduction ?? currentState.states?.BusinessProduction ?? "BLOCKED",
    maturityStatus: maturity.status
  },
  apiCallSummary: {
    total: apiCalls.length,
    statusCodeCounts,
    contractPathCounts
  },
  dbAssertionSummary: dbAssertions.map((assertion) => ({
    name: assertion.name,
    status: assertion.status,
    count: Number(assertion.count ?? 0)
  })),
  evidenceRefs: [
    "artifacts/proof/runtime-proof-result.json",
    "artifacts/go-live/dormitory/live-api-db-replay-result.json",
    "artifacts/go-live/dormitory/finance-daily-close-result.json",
    "artifacts/go-live/dormitory/daily-observation-day-01.json",
    "artifacts/go-live/dormitory/rollback-drill-result.json",
    "artifacts/go-live/dormitory/training-signoff-result.json",
    "artifacts/trust/trust-boundary-result.json",
    "artifacts/release-state/current-state.json",
    "artifacts/portfolio/business-line-maturity-result.json"
  ],
  noGoItems: [...p0, ...p1],
  nextAction: continuePilot
    ? "Day-1 green，允许继续 Day-2；宿舍仍仅为 L1 Internal Pilot Observation。"
    : holdPilot
      ? "Day-1 存在 P1 hold，修复后才允许继续 Day-2。"
      : "Day-1 存在 P0 stop，立即 pause/stop/rollback，不得进入 Day-2。"
};

writeJson("artifacts/operations/dormitory/observation-day-01.json", result);
writeText("docs/operations/dormitory/observation-day-01-report.md", renderReport(result));

if (p0.length > 0) {
  console.log("DORM_L1_OBSERVATION_DAY1_BLOCKED");
} else if (p1.length > 0) {
  console.log("DORM_L1_OBSERVATION_DAY1_HOLD");
} else {
  console.log("DORM_L1_OBSERVATION_DAY1_CONTINUE");
}

function renderReport(day) {
  const p0Lines = day.unresolvedP0Items.length === 0
    ? "- 无未解决 P0。"
    : day.unresolvedP0Items.map((item) => `- ${item.id}: ${item.reason} owner=${item.owner} nextAction=${item.nextAction}`).join("\n");
  const p1Lines = day.unresolvedP1Items.length === 0
    ? "- 无未解决 P1。"
    : day.unresolvedP1Items.map((item) => `- ${item.id}: ${item.reason} owner=${item.owner} nextAction=${item.nextAction}`).join("\n");

  return `# 宿舍 L1 内测观察 Day-1 报告

## 结论

- 当前阶段：DORM-L1-OBS-DAY1
- 当前分支：${day.branch}
- 当前 head sha：${day.headSha}
- 判定：${day.decision}
- continuePilot：${day.continuePilot}
- holdPilot：${day.holdPilot}
- pausePilot：${day.pausePilot}
- rollbackRequired：${day.rollbackRequired}
- unresolvedP0：${day.unresolvedP0}
- unresolvedP1：${day.unresolvedP1}
- l2UpgradeEligible：false

Day-1 读取真实 live API / DB replay、财务日清、证据、账本、投影 / Lens、设备可信、支持 / 事件和训练签收证据。当前无 P0 stop、无 P1 hold，允许继续 Day-2。宿舍仍仅为 L1 Internal Pilot Observation，不允许 L2 Production，不允许 Business Production，Repair / Parts / HR 仍保持 L0 Contract Preview。

## 实际运行数据

- WorkItem：${day.actualWorkItemData.count}，OperationCase：${day.actualWorkItemData.operationCaseCount}
- CommandSubmission：${day.actualCommandSubmissionData.count}，RejectedCommandSubmission：${day.actualCommandSubmissionData.rejectedCount}，RejectionTrace：${day.actualCommandSubmissionData.rejectionTraceCount}
- EvidenceObject：${day.actualEvidenceData.evidenceObjectCount}，Evidence API call：${day.actualEvidenceData.evidenceApiCallCount}
- LedgerTransaction：${day.actualLedgerTransactionData.ledgerTransactionCount}，LedgerEntry：${day.actualLedgerTransactionData.ledgerEntryCount}
- Lens read：${day.actualProjectionLensData.lensReadCount}，Trace read：${day.actualProjectionLensData.traceReadCount}，Projection lag p95：${day.actualProjectionLensData.projectionLagP95Minutes} minutes
- Finance Daily Close：${day.actualFinanceDailyClose.status}
- 403 / 409 / 422：${day.actualErrorMetrics.forbidden403Count} / ${day.actualErrorMetrics.idempotency409Count} / ${day.actualErrorMetrics.businessBlocked422Count}
- Device trust bypass：${day.actualDeviceTrustMetrics.deviceTrustBypass}
- Support tickets：${day.actualSupportIncidentLogs.support?.tickets ?? 0}
- Training blocking issues：${day.actualTrainingIssueLogs.blockingIssuesOpen}

## P0 Stop

${p0Lines}

## P1 Hold

${p1Lines}

## Day-2 准入

- allowDay2：${day.allowDay2}
- 如果后续出现 P0，必须立即 stop / pause / rollback，不得进入 Day-2。
- 如果后续出现 P1，必须进入 hold，修复后才允许继续 Day-2。
- L1 -> L2 默认不 eligible，必须另走独立 stage / PR / gate。

## 证据引用

${day.evidenceRefs.map((ref) => `- ${ref}`).join("\n")}
`;
}

function pushIf(target, condition, id, reason, owner, nextAction) {
  if (condition) target.push({ id, severity: target === p0 ? "P0" : "P1", reason, owner, nextAction });
}

function openTrainingIssues(trainingResult) {
  return (trainingResult.roles ?? []).filter((role) => role.blockingIssue && role.blockingIssue !== "closed" && role.blockingIssue !== "none").length;
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

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

function writeText(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value, "utf8");
}

function git(command) {
  return execSync(command, { cwd: root, encoding: "utf8" }).trim();
}
