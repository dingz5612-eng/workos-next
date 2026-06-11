import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-period-correction-closure-result.json";
const files = {
  matrix: "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml",
  periodAnalytics: "docs/contracts/period-analytics-contract.json",
  biKpi: "docs/contracts/bi-kpi/bi-kpi-contract.json",
  readKernel: "docs/read-intelligence/read-intelligence-kernel.json",
  dashboardCheck: "scripts/oam/check-dashboard-readonly.mjs",
  financeTruthCheck: "scripts/check-finance-truth.mjs",
  correctionStorage: "services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs"
};
const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const period = JSON.parse(source.periodAnalytics);
const biKpi = JSON.parse(source.biKpi);
const readKernel = JSON.parse(source.readKernel);
const violations = [];

checkMatrixPeriodReview();
checkMatrixCorrection();
checkReadOnlyMetrics();
checkAppendOnlyRuntime();
checkFinanceBoundary();
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory period/correction closure check: PASS");

function checkMatrixPeriodReview() {
  const block = packageBlock("period-review");
  requireValue(Boolean(block), "period.matrix_missing", "场景矩阵缺少周期复盘包。");
  for (const token of [
    "source: generatedReadModel",
    "PermissionEnvelope",
    "LineageEnvelope",
    "FreshnessEnvelope",
    "PeriodSnapshot",
    "ActionPlan",
    "ExceptionWorkItem",
    "直接改 Room",
    "直接改 Bed",
    "直接改 Payment",
    "直接写 LedgerEntry",
    "ledgerEntryAllowed: false"
  ]) {
    requireText(block, token, "period.matrix_boundary_missing", `周期复盘缺少边界：${token}`);
  }
}

function checkMatrixCorrection() {
  const block = packageBlock("exception-correction");
  requireValue(Boolean(block), "correction.matrix_missing", "场景矩阵缺少异常纠错包。");
  for (const token of [
    "append-only",
    "不覆盖已确认事实",
    "CorrectionWorkItem",
    "CorrectionEvent",
    "correction.originalFactRef",
    "editable: false",
    "correction.newFactProposal",
    "correction.approvalReason",
    "handoffToFinanceKernel: true",
    "原事实覆盖"
  ]) {
    requireText(block, token, "correction.matrix_boundary_missing", `异常纠错缺少边界：${token}`);
  }
}

function checkReadOnlyMetrics() {
  requireValue(period.snapshotPolicy?.readOnlyInputs?.includes("businessFacts"), "period.readonly_business_missing", "周期复盘必须只读消费 businessFacts。");
  requireValue(period.snapshotPolicy?.readOnlyInputs?.includes("financeFacts"), "period.readonly_finance_missing", "周期复盘必须只读消费 financeFacts。");
  requireValue(period.snapshotPolicy?.readOnlyInputs?.includes("lensSnapshots"), "period.readonly_lens_missing", "周期复盘必须只读消费 lensSnapshots。");
  for (const item of ["businessFacts", "financeFacts", "ledgerEntries"]) {
    requireValue(period.snapshotPolicy?.forbiddenDirectWrites?.includes(item), "period.direct_write_forbidden_missing", `周期复盘必须禁止直接写 ${item}。`, { item });
  }
  for (const item of ["PeriodSnapshot", "ActionPlan", "ExceptionCase"]) {
    requireValue(period.dormitoryOamClosure?.allowedOutputs?.includes(item), "period.allowed_output_missing", `周期复盘输出缺少 ${item}。`, { item });
  }
  requireValue(period.actionPlanWorkItems?.currentOamWorkItemType === "Dorm.PeriodActionPlanExecute", "period.action_plan_workitem_missing", "行动计划必须生成 Dorm.PeriodActionPlanExecute。");
  requireValue(biKpi.readOnly === true && biKpi.businessFactWriteAllowed === false, "period.bi_kpi_not_readonly", "BI/KPI 必须只读且不得写业务事实。");
  for (const ref of ["lineage-contract.json", "permission-contract.json", "freshness-contract.json"]) {
    requireValue((biKpi.contractRefs ?? []).some((item) => item.endsWith(ref)), "period.bi_kpi_envelope_ref_missing", `BI/KPI 缺少 ${ref}。`, { ref });
  }
  requireValue(readKernel.writeFactsAllowed === false, "period.read_kernel_write_allowed", "Read Intelligence kernel 不得写事实。");
  requireValue(readKernel.readProof?.metricDashboardReportDatasetRequireSourceFactsLineage === true, "period.metric_lineage_missing", "指标数据集必须要求 source facts lineage。");
  for (const ref of ["permission-envelope.schema.json", "lineage-envelope.schema.json", "freshness-envelope.schema.json"]) {
    requireValue((readKernel.proofRefs ?? []).some((item) => item.endsWith(ref)), "period.read_kernel_envelope_ref_missing", `Read kernel 缺少 ${ref}。`, { ref });
  }
  requireText(source.dashboardCheck, "Dashboard readonly self-test: PASS", "period.dashboard_readonly_selftest_missing", "Dashboard 只读 self-test 必须存在。");
}

function checkAppendOnlyRuntime() {
  for (const token of [
    "AppendLedgerEffect",
    "InsertEventsForApply",
    "InsertReversalEntry",
    "InsertCorrectionEntry",
    "InsertPeriodLateAdjustmentIfClosed",
    "LedgerEntryReversed",
    "LedgerCorrectionApplied"
  ]) {
    requireText(source.correctionStorage, token, "correction.runtime_append_token_missing", `纠错运行时缺少 append-only 标记：${token}`);
  }
  for (const forbidden of ["UPDATE ledger_entries", "update ledger_entries", "UPDATE domain_events", "update domain_events"]) {
    if (source.correctionStorage.includes(forbidden)) {
      violations.push(v("correction.runtime_overwrite_forbidden", `纠错运行时不得覆盖既有事实或账务：${forbidden}`));
    }
  }
}

function checkFinanceBoundary() {
  requireText(source.financeTruthCheck, "finance_truth.direct_fact_commit", "correction.finance_direct_commit_guard_missing", "财务事实直写 negative gate 必须存在。");
  requireText(source.financeTruthCheck, "business-domain direct LedgerEntry fixture must fail.", "correction.finance_ledger_negative_missing", "非 finance kernel 写 LedgerEntry negative gate 必须存在。");
  requireValue(period.dormitoryOamClosure?.financeTruthBoundary === "finance-gate / Money Kernel", "correction.finance_boundary_missing", "周期复盘/纠错必须绑定 finance-gate / Money Kernel。");
}

function packageBlock(packageId) {
  const marker = `  - packageId: ${packageId}`;
  const start = source.matrix.indexOf(marker);
  if (start < 0) return "";
  const rest = source.matrix.slice(start + marker.length);
  const next = /\n\s{2}- packageId:\s*/.exec(rest);
  return marker + (next ? rest.slice(0, next.index) : rest);
}

function requireText(text, token, id, message) {
  if (!text.includes(token)) violations.push(v(id, message, { token }));
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push(v(id, message, extra));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function v(id, message, extra = {}) {
  return { id, severity: "P0", message, ...extra };
}

function writeResult() {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-period-correction-closure-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    checkedFiles: Object.values(files),
    violations
  }, null, 2)}\n`, "utf8");
}
