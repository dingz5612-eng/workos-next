import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-authority-result.json";
const failures = [];

const expectedObjects = [
  "CheckoutCase",
  "CurrentStaySnapshot",
  "CheckoutInspection",
  "RoomBedHandover",
  "DamageAssessment",
  "FeeSettlementDraft",
  "DepositSettlementDraft",
  "RefundRequestIntent",
  "TopUpRequestIntent",
  "CredentialReturnRecord",
  "CheckoutConfirmation",
  "ResourceRecoveryRequest",
  "CheckoutEvidence",
  "CheckoutStatusHistory"
];
const expectedStatuses = [
  "待退房",
  "待验房",
  "待结算",
  "待客户确认",
  "待财务处理",
  "已退房",
  "结算有争议",
  "需补证",
  "资源待保洁",
  "资源待检查",
  "资源待维修",
  "异常待处理"
];
const expectedSteps = [
  ["enter-checkout-processing", "进入退房办理"],
  ["confirm-actual-checkout-handover", "确认实际离店与交接"],
  ["room-bed-inspection", "房间/床位检查"],
  ["fee-settlement-calculation", "费用核算"],
  ["customer-settlement-confirmation", "客户确认结算"],
  ["checkout-confirmation", "确认退房"],
  ["finance-resource-handoff", "财务处理请求与资源恢复交接"]
];
const expectedCommands = [
  "Dorm.CheckoutCaseDraftStart",
  "Dorm.CheckoutHandoverConfirm",
  "Dorm.CheckoutInspectionConfirm",
  "Dorm.CheckoutFeeCalculationGenerate",
  "Dorm.CustomerSettlementConfirm",
  "Dorm.CheckoutConfirm",
  "Dorm.CheckoutFinanceRequestCreate",
  "Dorm.ResourceRecoveryRequestCreate",
  "Dorm.CheckoutCorrectionRequest"
];
const expectedUpstreamInputs = [
  "入住记录摘要",
  "住客摘要",
  "房间/床位占用摘要",
  "入住凭证摘要",
  "收款确认摘要",
  "押金确认摘要",
  "财务确认摘要",
  "在住状态摘要",
  "当前占用摘要",
  "服务请求摘要",
  "异常摘要",
  "续住/换房换床结果",
  "凭证状态",
  "退房准备摘要",
  "证据摘要",
  "只读对象引用"
];
const expectedHandoffOutputs = [
  "退房确认摘要",
  "费用核算摘要",
  "押金抵扣摘要",
  "应退/应补意向",
  "客户确认摘要",
  "财务处理请求",
  "资源待恢复请求",
  "证据摘要",
  "只读对象引用"
];
const forbiddenUserInput = [
  "stayId",
  "checkoutCaseId",
  "settlementId",
  "refundId",
  "ledgerEntryId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId",
  "paymentId",
  "ledgerTransactionId"
];
const forbiddenWrites = [
  "Payment",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction",
  "RoomOperationStatus=可运营"
];
const expectedFailureCodes = [
  "no_effective_stay",
  "stay_already_checked_out",
  "current_occupancy_required",
  "high_risk_incident_blocks_normal_checkout",
  "actual_checkout_time_required",
  "proxy_or_abnormal_handover_evidence_required",
  "credential_return_required",
  "inspection_evidence_required",
  "damage_description_evidence_required",
  "fee_source_invalid",
  "final_ledger_truth_manual_input_forbidden",
  "customer_confirmation_required",
  "disputed_settlement_requires_review",
  "finance_gate_required_for_refund_or_topup",
  "resource_operational_direct_restore_forbidden",
  "direct_payment_refund_ledger_forbidden",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "duplicate_checkout_submission",
  "concurrent_checkout_conflict",
  "confirmed_checkout_inline_edit_forbidden",
  "unauthorized_checkout_action"
];

const scenario = readJson(scenarioPath);
const packageIndex = readJson(packageIndexPath);
const authorityIndex = readJson(authorityIndexPath);

checkPackageIndex();
checkAuthorityIndexRegistration();
checkScenarioHeader();
checkObjectsAndStates();
checkStepsAndFields();
checkCrud();
checkCommandsAndFailures();
checkInvariantsAndEvidence();
checkRuntimeSurfaceFinanceBoundary();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario9-checkout-settlement-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.checkoutStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 9 checkout settlement authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 9 checkout settlement authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const names = (packageIndex.scenarioPackageOrder ?? []).slice(0, 10).map((item) => item.nameZh);
  assertArray(names, [
    "房源建档与基础就绪",
    "房源运营就绪与状态维护",
    "住宿商品与价格",
    "询价与报价",
    "预订与库存锁定",
    "收款、押金与担保",
    "入住办理",
    "在住管理",
    "退房结算",
    "取消、未到店与退款处理"
  ], "first ten package names");
  const ninth = byNo.get(9);
  if (!ninth) {
    fail("package index missing package 9.");
    return;
  }
  if (ninth.nameZh !== "退房结算") fail("package 9 name must be 退房结算.");
  assertArray(ninth.upstreamPackages, [7, 8, 6], "package 9 upstream packages");
  assertArray(ninth.downstreamPackages, [10, 2], "package 9 downstream packages");
  assertArray(ninth.handoffInputs, [
    "入住记录摘要",
    "住客摘要",
    "房间/床位占用摘要",
    "收款确认摘要",
    "押金确认摘要",
    "财务确认摘要",
    "在住状态摘要",
    "当前占用摘要",
    "服务请求摘要",
    "异常摘要",
    "续住/换房换床结果",
    "凭证状态",
    "退房准备摘要",
    "证据摘要",
    "只读对象引用"
  ], "package 9 handoff inputs");
  assertArray(ninth.handoffOutputs, expectedHandoffOutputs, "package 9 handoff outputs");
  for (const forbidden of forbiddenWrites.concat(["已退款", "已入账", "房源已可运营"])) {
    if (!(ninth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 9 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 9 Source.");
  for (const oldExpression of ["CheckoutSettlementApprove", "RefundApprove", "RoomInspectionConfirm"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 9 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 9 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 9 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 9 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario9-checkout-settlement-authority.mjs") fail("scenario 9 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 9 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 9 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 9 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario9-checkout-settlement-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario9.CheckoutSettlement") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 9 || scenario.scenarioId !== "lodging.checkout-and-settlement" || scenario.nameZh !== "退房结算") fail("scenario package 9 identity invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 9 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 9 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [7, 8, 6], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedUpstreamInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 9 must not write back upstream.");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
  if (!String(scenario.downstream?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
    !String(scenario.downstream?.downstreamRecheckRuleZh ?? "").includes("场景包 2")) {
    fail("scenario 9 downstream must hand off to finance-gate and scenario 2 only as summaries/requests.");
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.checkoutStatusOptions, expectedStatuses, "scenario checkout status options");
  for (const object of scenario.objects ?? []) {
    for (const required of ["evidenceHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["已退房不等于已退款", "已退房不等于房源可运营", "结算意向不等于账务真值", "资源待保洁", "finance-gate"]) {
    if (!stateText.includes(required)) fail(`state layering missing ${required}.`);
  }
}

function checkStepsAndFields() {
  if ((scenario.steps ?? []).length !== 7) fail("scenario must define exactly 7 business steps.");
  for (const [index, [stepId, nameZh]] of expectedSteps.entries()) {
    const step = scenario.steps?.[index];
    if (!step) continue;
    if (step.stepId !== stepId || step.nameZh !== nameZh) fail(`step ${index + 1} identity mismatch.`);
  }
  for (const expected of ["checkoutCaseRef", "stayRef", "occupancyRef", "financeSnapshotRef", "handoverRef", "inspectionRef", "feeSettlementDraftRef", "checkoutConfirmationRef", "checkoutNo", "refundRequestIntentRef", "topUpRequestIntentRef", "resourceRecoveryRequestRef"]) {
    if (!(scenario.fields?.systemGenerated ?? []).includes(expected)) fail(`system generated field missing ${expected}.`);
  }
  assertArray(scenario.fields?.forbiddenUserInputFields, forbiddenUserInput, "forbidden user input fields");
  const fieldText = JSON.stringify(scenario.fields ?? {});
  for (const required of ["upstreamReadonly", "systemCalculated", "finance-gate", "张三，301-02 床位", "应退 200 元，待财务处理"]) {
    if (!fieldText.includes(required)) fail(`fields missing ${required}.`);
  }
}

function checkCrud() {
  if (scenario.crudRules?.draftEditable !== true) fail("draft must be editable.");
  if (scenario.crudRules?.confirmedCheckoutInlineEditAllowed !== false) fail("confirmed checkout fact inline edit must be forbidden.");
  if (scenario.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("readonly surfaces must not write business facts.");
  for (const surface of ["查询", "搜索", "列表", "看板", "报表"]) {
    if (!(scenario.crudRules?.readOnlySurfacesZh ?? []).includes(surface)) fail(`CRUD readonly surfaces missing ${surface}.`);
  }
}

function checkCommandsAndFailures() {
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "command list");
  for (const command of scenario.commands ?? []) {
    if ((command.writesObjects ?? []).some((item) => forbiddenWrites.includes(item))) {
      fail(`${command.commandId} must not write payment/refund/ledger/operational status.`);
    }
  }
  assertArray((scenario.failureSemantics ?? []).map((item) => item.failureCode), expectedFailureCodes, "failure codes");
  for (const failure of scenario.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  const rule = scenario.checkoutInvariantRule ?? {};
  for (const key of [
    "validStayRequired",
    "currentOccupancyRequired",
    "actualCheckoutAtRequired",
    "handoverRequired",
    "credentialReturnRequired",
    "inspectionEvidenceRequired",
    "damageRequiresDescriptionAndEvidence",
    "feeSourcesAuthoritative",
    "customerConfirmationRequired",
    "disputedSettlementRequiresReview",
    "checkoutDoesNotMeanRefunded",
    "checkoutDoesNotMakeResourceOperational",
    "financeGateHandlesRefundTopUpLedger",
    "resourceRecoveryViaScenario2Only",
    "failureNoSideEffects"
  ]) {
    if (rule[key] !== true) fail(`checkoutInvariantRule.${key} must be true.`);
  }
  const invariantText = JSON.stringify(scenario.invariants ?? []);
  for (const required of ["有效 Stay", "当前 Occupancy", "实际离店时间", "凭证回收", "验房", "客户确认", "finance-gate", "不得直接恢复可运营", "不得生成退款或账务", "不得刷新错误 Projection"]) {
    if (!invariantText.includes(required)) fail(`invariants missing guard ${required}.`);
  }
  if (scenario.evidence?.noSideEffectsProofRequired !== true ||
    scenario.evidence?.screenshotAnalysisRequired !== true ||
    scenario.evidence?.evidenceRootRequiredAtIntegration !== true) {
    fail("evidence policy must require screenshots, no-side-effects proof, and Evidence Root at integration.");
  }
  for (const [stepId] of expectedSteps) {
    if (!Array.isArray(scenario.evidence?.requiredEvidenceByStep?.[stepId])) fail(`evidence missing step ${stepId}.`);
  }
}

function checkRuntimeSurfaceFinanceBoundary() {
  for (const forbidden of forbiddenWrites) {
    if (!(scenario.businessBoundaries?.forbiddenWritesZh ?? []).includes(forbidden)) fail(`business boundary must forbid ${forbidden}.`);
  }
  const boundary = scenario.runtimeConsumptionBoundary ?? {};
  if (boundary.runtimeMayReadGeneratedOnly !== true ||
    boundary.runtimeMayHardcodeBusinessRules !== false ||
    boundary.businessRuntimeMayWriteLedger !== false ||
    boundary.businessRuntimeMayWritePaymentRefund !== false ||
    boundary.businessRuntimeMayRestoreOperationalStatus !== false ||
    boundary.financeGateMayConsumeSettlementIntentOnly !== true ||
    boundary.failurePathBusinessSideEffectsAllowed !== false ||
    boundary.successMayWriteCheckoutFactsAndRequestsOnly !== true) {
    fail("runtime/finance consumption boundary mismatch.");
  }
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must be readonly.");
  for (const term of ["已退款", "已入账", "房源已可运营", "final GO", "生产发布", "CheckoutSettlementApprove", "RefundApprove", "RoomInspectionConfirm"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(term)) fail(`surface forbidden visible terms missing ${term}.`);
  }
  assertArray(scenario.readSideOutputs, expectedHandoffOutputs, "read side outputs");
  if ((scenario.positiveBrowserTestPlan ?? []).length !== 12) fail("positive browser test plan must contain 12 steps.");
  if ((scenario.negativeBrowserTestPlan ?? []).length !== 13) fail("negative browser test plan must contain 13 cases.");
}

function checkNoGo() {
  if (scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 9 must keep production/business/final GO closed.");
  }
}

function assertArray(actual = [], expected = [], label) {
  const left = actual ?? [];
  if (left.length !== expected.length || expected.some((item, index) => left[index] !== item)) {
    fail(`${label} mismatch. expected ${JSON.stringify(expected)} got ${JSON.stringify(left)}`);
  }
}

function fail(message) {
  failures.push(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}
