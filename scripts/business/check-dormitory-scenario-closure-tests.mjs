import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml";
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario-closure-tests-result.json";
const violations = [];

const matrix = read(matrixPath);
const kernel = readJson(kernelPath);
const workItems = new Map((kernel.workItems ?? []).map((item) => [item.workItemType, item]));
const runtimeCorrectionStorage = read("services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs");
const operationsUnitOfWork = read("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs");
const finalAcceptanceTests = read("tests/WorkOS.UnitTests/FinalEndToEndAcceptanceSuiteTests.cs");
const correctionReversalTests = read("tests/WorkOS.UnitTests/CorrectionCenterReversalTests.cs");
const operationsRuntimeTests = read("tests/WorkOS.UnitTests/OperationsRuntimeServiceTests.cs");
const runtimeContractTests = read("tests/WorkOS.RuntimeContractTests/Program.cs");

checkPackageChain();
checkLeadCheckinPaymentKernelHandoff();
checkPeriodAndCorrectionClosure();
checkExecutableTests();
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory scenario closure tests check: PASS");

function checkPackageChain() {
  for (const [packageId, expectedNext] of [
    ["lead-reservation", "check-in"],
    ["check-in", "ordinary-payment"],
    ["ordinary-payment", "period-review"],
    ["period-review", "exception-correction"],
    ["exception-correction", "resource-saleability"]
  ]) {
    const block = packageBlock(packageId);
    requireValue(Boolean(block), "closure.package_missing", `${packageId} 场景包缺失。`, { packageId });
    if (!block) continue;
    requireValue(blockEnablesNext(block, expectedNext, packageId), "closure.package_handoff_invalid", `${packageId} 必须衔接到 ${expectedNext}。`, { packageId, expectedNext });
    requireValue(block.includes("readonlyCarryForward: true") && block.includes("confirmPathOnly: true") && block.includes("noInlineConfirm: true"), "closure.ui_boundary_missing", `${packageId} 必须只读带入且只允许 confirm path。`, { packageId });
    requireValue(block.includes("productionConfirmAllowed: false") && block.includes("untilAllSatisfied: NO_GO"), "closure.no_go_missing", `${packageId} 必须保持业务实现前 NO_GO。`, { packageId });
  }

  const checkinBlock = packageBlock("check-in");
  requireValue(checkinBlock.includes("Dorm.CheckinConfirm"), "closure.checkin_name_invalid", "入住办理必须使用当前内核 WorkItem: Dorm.CheckinConfirm。");
  requireValue(!checkinBlock.includes("Dorm.CheckInConfirm"), "closure.checkin_name_shadow", "场景矩阵不得保留 Dorm.CheckInConfirm 影子命名。");

  const paymentBlock = packageBlock("ordinary-payment");
  requireValue(paymentBlock.includes("handoffToFinanceKernel: true"), "closure.payment_finance_handoff_missing", "普通收款必须显式移交 finance kernel。");
  requireValue(paymentBlock.includes("ledgerEntryAllowed: false"), "closure.payment_ledger_block_missing", "普通收款场景包不得直接写 LedgerEntry。");
  requireValue(paymentBlock.includes("- LedgerEntry"), "closure.payment_forbidden_ledger_missing", "普通收款 forbiddenFacts 必须包含 LedgerEntry。");
}

function checkLeadCheckinPaymentKernelHandoff() {
  const lead = requireWorkItem("Dorm.LeadCapture");
  const reservation = requireWorkItem("Dorm.ReservationConfirm");
  const checkin = requireWorkItem("Dorm.CheckinConfirm");
  const payment = requireWorkItem("Dorm.PaymentConfirm");
  if (!lead || !reservation || !checkin || !payment) return;

  requireDownstream(lead, "Dorm.ReservationConfirm");
  requireDownstream(reservation, "Dorm.CheckinConfirm");
  requireDownstream(checkin, "Dorm.PaymentConfirm");

  for (const item of [lead, reservation, checkin]) {
    requireDormitoryBasisOnly(item);
  }

  requireValue(payment.canonicalOwner === "finance-gate", "closure.payment_owner_invalid", "Dorm.PaymentConfirm 必须归 finance-gate 所有。");
  requireValue(payment.systemOwner === "finance-gate" && payment.ownerSlice === "finance-gate", "closure.payment_system_owner_invalid", "Dorm.PaymentConfirm 系统归属必须是 finance-gate。");
  requireValue(payment.ledgerEffect?.mode === "finance_kernel" && payment.ledgerEffect?.financeKernelEffectType === "payment", "closure.payment_ledger_effect_invalid", "Dorm.PaymentConfirm 必须通过 finance kernel 表达 payment effect。");
  requireValue(payment.ledgerPolicyRef === "ledger.payment.balanced_allocation.v1", "closure.payment_ledger_policy_invalid", "普通收款账务策略必须是 balanced allocation。");
  for (const fact of ["Payment", "LedgerEntry", "MoneyBasis"]) {
    requireValue((payment.allowedFacts ?? []).includes(fact), "closure.payment_fact_missing", `Dorm.PaymentConfirm 必须由 finance-gate 写入 ${fact}。`, { fact });
  }
  for (const fact of ["Room", "Bed", "Stay", "ServiceTask"]) {
    requireValue((payment.forbiddenFacts ?? []).includes(fact), "closure.payment_forbidden_fact_missing", `Dorm.PaymentConfirm 不得写住宿业务事实 ${fact}。`, { fact });
  }
  requireDownstream(payment, "Finance.DebtFollowUp");
}

function checkPeriodAndCorrectionClosure() {
  const period = requireWorkItem("Dorm.PeriodReview");
  const actionPlan = requireWorkItem("Dorm.PeriodActionPlanExecute");
  const exception = requireWorkItem("Dorm.ExceptionResolve");
  const correction = requireWorkItem("Finance.CorrectionApply");
  if (!period || !actionPlan || !exception || !correction) return;

  requireValue(period.ledgerPolicyRef === "ledger.readonly.v1", "closure.period_ledger_policy_invalid", "周期复盘只能只读账务。");
  requireValue((period.allowedFacts ?? []).includes("PeriodSnapshot"), "closure.period_snapshot_missing", "周期复盘必须只生成 PeriodSnapshot。");
  for (const fact of ["Room", "Bed", "Payment", "LedgerEntry"]) {
    requireValue((period.forbiddenFacts ?? []).includes(fact), "closure.period_forbidden_fact_missing", `周期复盘不得直接写 ${fact}。`, { fact });
  }
  requireDownstream(period, "Dorm.PeriodActionPlanExecute");
  requireDownstream(period, "Dorm.ExceptionResolve");
  requireValue((actionPlan.allowedFacts ?? []).includes("ActionPlan"), "closure.action_plan_fact_missing", "周期行动计划必须生成 ActionPlan。");
  requireDownstream(actionPlan, "Dorm.PeriodReview");

  requireValue(exception.canonicalOwner === "dormitory", "closure.exception_owner_invalid", "异常处理必须属于 dormitory 事实层。");
  requireValue((exception.allowedFacts ?? []).includes("ExceptionCase"), "closure.exception_case_missing", "异常处理必须生成 ExceptionCase。");
  requireValue((exception.forbiddenFacts ?? []).includes("LedgerEntry"), "closure.exception_ledger_forbidden_missing", "异常处理不得直接写 LedgerEntry。");
  requireDownstream(exception, "Finance.CorrectionApply");

  requireValue(correction.canonicalOwner === "finance-gate", "closure.correction_owner_invalid", "Finance.CorrectionApply 必须归 finance-gate 所有。");
  requireValue(correction.ledgerEffect?.mode === "finance_kernel" && correction.ledgerEffect?.financeKernelEffectType === "correction", "closure.correction_ledger_effect_invalid", "Finance.CorrectionApply 必须通过 finance kernel 表达 correction effect。");
  requireValue(correction.ledgerPolicyRef === "ledger.finance.correction.v1", "closure.correction_ledger_policy_invalid", "纠错账务策略必须是 ledger.finance.correction.v1。");
  requireDownstream(correction, "Dorm.PeriodReview");

  for (const token of [
    "AppendLedgerEffect",
    "InsertEventsForApply",
    "InsertReversalEntry",
    "InsertCorrectionEntry",
    "LedgerEntryReversed",
    "LedgerCorrectionApplied",
    "InsertPeriodLateAdjustmentIfClosed"
  ]) {
    requireValue(runtimeCorrectionStorage.includes(token), "closure.correction_append_token_missing", `运行时纠错中心缺少追加式标记 ${token}。`, { token });
  }
  for (const forbidden of [/update\s+domain_events/i, /delete\s+from\s+domain_events/i, /delete\s+from\s+ledger_entries/i]) {
    requireValue(!forbidden.test(runtimeCorrectionStorage), "closure.correction_mutation_forbidden", "纠错中心不得覆盖或删除已确认事件/账务。", { pattern: String(forbidden) });
  }
}

function checkExecutableTests() {
  requireValue(operationsUnitOfWork.includes("operations_handler_ledger_truth_owner_not_allowed"), "closure.unit_of_work_ledger_owner_gate_missing", "UOW 必须拒绝非 MoneyKernelPack 写 LedgerEntry。");
  requireValue(finalAcceptanceTests.includes("LedgerEntryReversed") && finalAcceptanceTests.includes("LedgerCorrectionApplied"), "closure.acceptance_correction_events_missing", "端到端验收必须覆盖 LedgerEntryReversed/LedgerCorrectionApplied。");
  requireValue(finalAcceptanceTests.includes("append_only") && finalAcceptanceTests.includes("AppendLateAdjustment"), "closure.acceptance_late_adjustment_missing", "端到端验收必须覆盖周期关闭后的追加式调整。");
  requireValue(correctionReversalTests.includes("correction_does_not_delete_original_event") && correctionReversalTests.includes("InsertReversalEntry") && correctionReversalTests.includes("InsertCorrectionEntry"), "closure.correction_reversal_test_missing", "纠错反转测试必须证明不删除原事件且追加反转/纠错记录。");
  requireValue(operationsRuntimeTests.includes("correction_confirm_does_not_dispatch_next_resource_lifecycle_work_item") && operationsRuntimeTests.includes("correctionMode") && operationsRuntimeTests.includes("append_only"), "closure.operations_correction_test_missing", "运行时测试必须覆盖 append_only 纠错工单不会误派发下一业务工单。");
  requireValue(runtimeContractTests.includes("correction_apply_appends_reversal") && runtimeContractTests.includes("period_snapshot_append_only_after_close"), "closure.runtime_contract_append_only_missing", "运行时合同测试必须覆盖纠错反转和周期关闭后追加策略。");
}

function requireDormitoryBasisOnly(item) {
  requireValue(item.canonicalOwner === "dormitory", "closure.dormitory_owner_invalid", `${item.workItemType} 必须属于 dormitory。`, { workItemType: item.workItemType });
  requireValue(item.ledgerPolicyRef === "ledger.none.v1", "closure.dormitory_ledger_policy_invalid", `${item.workItemType} 不得有账务写策略。`, { workItemType: item.workItemType });
  requireValue(!(item.allowedFacts ?? []).includes("LedgerEntry"), "closure.dormitory_ledger_fact_allowed", `${item.workItemType} allowedFacts 不得包含 LedgerEntry。`, { workItemType: item.workItemType });
  requireValue((item.forbiddenFacts ?? []).includes("LedgerEntry"), "closure.dormitory_ledger_fact_not_forbidden", `${item.workItemType} forbiddenFacts 必须包含 LedgerEntry。`, { workItemType: item.workItemType });
  requireValue(item.ledgerEffect?.financeKernelEffectType === null, "closure.dormitory_finance_effect_invalid", `${item.workItemType} 不得声明 finance effect。`, { workItemType: item.workItemType });
}

function requireDownstream(item, downstreamWorkItemType) {
  requireValue((item.downstreamWorkItems ?? []).includes(downstreamWorkItemType), "closure.downstream_missing", `${item.workItemType} 必须衔接到 ${downstreamWorkItemType}。`, {
    workItemType: item.workItemType,
    downstreamWorkItemType
  });
}

function requireWorkItem(workItemType) {
  const item = workItems.get(workItemType);
  requireValue(Boolean(item), "closure.workitem_missing", `宿舍内核缺少 ${workItemType}。`, { workItemType });
  return item;
}

function packageBlock(packageId) {
  const scenarioStart = matrix.indexOf("\nscenarioPackages:");
  const searchText = scenarioStart >= 0 ? matrix.slice(scenarioStart) : matrix;
  const marker = `  - packageId: ${packageId}`;
  const start = searchText.indexOf(marker);
  if (start < 0) return "";
  const rest = searchText.slice(start + marker.length);
  const next = /\n\s{2}- packageId:\s*/.exec(rest);
  return marker + (next ? rest.slice(0, next.index) : rest);
}

function blockEnablesNext(block, expectedNext, packageId) {
  if (block.includes(`enablesNext: ${expectedNext}`)) return true;
  const listPattern = new RegExp(`enablesNext:\\s*\\n(?:\\s+-\\s+[\\w-]+\\s*\\n)*\\s+-\\s+${escapeRegExp(expectedNext)}\\b`);
  if (listPattern.test(block)) return true;
  return packageId === "exception-correction" &&
    block.includes("enablesNext: []") &&
    block.includes(`nextAdmission: admission.dormitory.${expectedNext}.prepare.v1`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function writeResult() {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-scenario-closure-tests.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    scope: [
      "lead-reservation -> check-in -> ordinary-payment",
      "ordinary-payment finance-gate handoff",
      "period-review -> exception-correction",
      "append-only correction and late adjustment"
    ],
    businessImplementationAllowed: false,
    requiredFinalDecision: "artifacts/oam/final-report.json must be GO before business implementation",
    violations
  }, null, 2)}\n`, "utf8");
}
