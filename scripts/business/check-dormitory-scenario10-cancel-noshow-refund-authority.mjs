import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-authority-result.json";
const failures = [];

const expectedObjects = [
  "CancellationCase",
  "NoShowCase",
  "ReservationClosureSnapshot",
  "CancellationPolicySnapshot",
  "PaymentDepositSnapshot",
  "RefundCalculationDraft",
  "RefundRequestIntent",
  "CancellationFeeIntent",
  "ForfeitOrFeeIntent",
  "InventoryReleaseRequest",
  "CustomerConfirmationRecord",
  "CustomerNotificationRecord",
  "FinanceProcessingRequest",
  "CancellationEvidence",
  "CancellationStatusHistory"
];
const expectedStatuses = [
  "取消草稿",
  "未到店草稿",
  "待客户确认",
  "待政策计算",
  "待负责人复核",
  "待财务处理",
  "已取消",
  "未到店已关闭",
  "退款申请已提交",
  "扣费申请已提交",
  "库存释放已请求",
  "争议处理中",
  "财务退回待补证"
];
const expectedSteps = [
  ["enter-cancel-noshow-processing", "进入取消/未到店处理"],
  ["reason-and-customer-confirmation", "填写处理原因与客户确认"],
  ["policy-and-amount-calculation", "政策与金额计算"],
  ["inventory-release-confirmation", "库存释放确认"],
  ["finance-processing-request", "生成退款/扣费处理请求"],
  ["confirm-cancellation-or-noshow-closure", "确认取消或未到店关闭"],
  ["result-and-follow-up", "处理结果与后续跟进"]
];
const expectedCommands = [
  "Dorm.CancelNoShowCaseDraftStart",
  "Dorm.CancellationCaseDraftStart",
  "Dorm.NoShowCaseDraftStart",
  "Dorm.CancelNoShowReasonCustomerConfirm",
  "Dorm.CancelNoShowPolicyCalculationGenerate",
  "Dorm.CancelNoShowInventoryReleaseRequestConfirm",
  "Dorm.CancelNoShowFinanceProcessingRequestCreate",
  "Dorm.CancelNoShowConfirmClosure",
  "Dorm.CancellationConfirm",
  "Dorm.NoShowConfirm",
  "Dorm.CancelNoShowDisputeReview",
  "Dorm.CancelNoShowFollowUpRecord",
  "Dorm.CancelNoShowFinanceEvidenceSupplement",
  "Dorm.CancelNoShowCorrectionRequest"
];
const expectedUpstreamInputs = [
  "预订确认摘要",
  "预订号",
  "客户信息",
  "日期范围",
  "房间/床位",
  "价格快照",
  "库存锁定历史",
  "预订状态",
  "收款确认摘要",
  "押金确认摘要",
  "担保确认摘要",
  "财务确认状态",
  "入住状态摘要",
  "退房确认摘要",
  "应退/应补意向",
  "财务处理请求",
  "证据摘要",
  "只读对象引用"
];
const expectedHandoffOutputs = [
  "取消/未到店关闭摘要",
  "政策计算摘要",
  "退款/扣费申请",
  "库存释放请求",
  "客户确认摘要",
  "财务处理请求",
  "证据摘要",
  "只读对象引用"
];
const forbiddenUserInput = [
  "cancellationCaseId",
  "refundId",
  "paymentId",
  "depositId",
  "ledgerEntryId",
  "reservationId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId",
  "ledgerTransactionId",
  "checkoutCaseId",
  "stayId"
];
const forbiddenWrites = [
  "Payment",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction",
  "Stay",
  "CheckoutCase",
  "RoomOperationStatus=可运营"
];
const expectedFailureCodes = [
  "no_effective_reservation",
  "payment_deposit_snapshot_required",
  "settlement_intent_required_for_checkout_refund",
  "reservation_already_checked_in",
  "reservation_already_checked_out",
  "reservation_already_cancelled",
  "noshow_hold_time_not_elapsed",
  "noshow_effective_checkin_exists",
  "customer_confirmation_required",
  "dispute_requires_review",
  "policy_amount_source_missing",
  "final_refund_manual_input_forbidden",
  "inventory_release_scope_invalid",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "direct_refund_payment_ledger_forbidden",
  "finance_gate_required",
  "duplicate_cancellation_submission",
  "concurrent_cancellation_conflict",
  "confirmed_closure_inline_edit_forbidden",
  "unauthorized_cancellation_action"
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
  version: "oam.dormitory-scenario10-cancel-noshow-refund-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.cancellationStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 10 cancel no-show refund authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 10 cancel no-show refund authority check: PASS (${result.scenarioDigest})`);

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
  const tenth = byNo.get(10);
  if (!tenth) {
    fail("package index missing package 10.");
    return;
  }
  if (tenth.nameZh !== "取消、未到店与退款处理") fail("package 10 name must be 取消、未到店与退款处理.");
  assertArray(tenth.upstreamPackages, [5, 6, 7, 9], "package 10 upstream packages");
  assertArray(tenth.handoffInputs, expectedUpstreamInputs, "package 10 handoff inputs");
  assertArray(tenth.handoffOutputs, expectedHandoffOutputs, "package 10 handoff outputs");
  for (const forbidden of forbiddenWrites.concat(["已退款到账", "已入账", "已入住", "已退房"])) {
    if (!(tenth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 10 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 10 Source.");
  for (const oldExpression of ["reservationCancel", "reservationNoShow", "RefundApprove", "CheckoutSettlementApprove"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 10 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 10 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 10 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 10 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-authority.mjs") fail("scenario 10 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 10 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 10 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 10 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario10-cancel-noshow-refund-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario10.CancelNoShowRefund") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 10 || scenario.scenarioId !== "lodging.cancel-noshow-refund-intake" || scenario.nameZh !== "取消、未到店与退款处理") fail("scenario package 10 identity invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 10 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 10 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [5, 6, 7, 9], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedUpstreamInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 10 must not write back upstream.");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
  const downstreamText = JSON.stringify(scenario.downstream ?? {});
  for (const required of ["finance-gate", "inventory-reservation-read-model", "经营看板与复盘"]) {
    if (!downstreamText.includes(required)) fail(`scenario 10 downstream must include ${required}.`);
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.cancellationStatusOptions, expectedStatuses, "scenario cancellation status options");
  for (const object of scenario.objects ?? []) {
    for (const required of ["evidenceHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["已取消不等于已退款", "未到店关闭不等于已退款", "退款申请不等于退款到账", "扣费申请不等于扣费入账", "finance-gate"]) {
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
  for (const expected of ["cancellationCaseRef", "noShowCaseRef", "reservationRef", "paymentDepositSnapshotRef", "policySnapshotRef", "refundCalculationDraftRef", "inventoryReleaseRequestRef", "refundRequestIntentRef", "cancellationFeeIntentRef", "financeProcessingRequestRef", "cancellationNo", "noShowClosureNo"]) {
    if (!(scenario.fields?.systemGenerated ?? []).includes(expected)) fail(`system generated field missing ${expected}.`);
  }
  assertArray(scenario.fields?.forbiddenUserInputFields, forbiddenUserInput, "forbidden user input fields");
  const fieldText = JSON.stringify(scenario.fields ?? {});
  for (const required of ["upstreamReadonly", "systemCalculated", "finance-gate", "预订号 R202606200001", "预计退款 200 元，待财务处理"]) {
    if (!fieldText.includes(required)) fail(`fields missing ${required}.`);
  }
}

function checkCrud() {
  if (scenario.crudRules?.draftEditable !== true) fail("draft must be editable.");
  if (scenario.crudRules?.confirmedClosureInlineEditAllowed !== false) fail("confirmed closure inline edit must be forbidden.");
  if (scenario.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("readonly surfaces must not write business facts.");
  for (const surface of ["查询", "搜索", "列表", "看板", "报表"]) {
    if (!(scenario.crudRules?.readOnlySurfacesZh ?? []).includes(surface)) fail(`CRUD readonly surfaces missing ${surface}.`);
  }
}

function checkCommandsAndFailures() {
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "command list");
  for (const command of scenario.commands ?? []) {
    if ((command.writesObjects ?? []).some((item) => forbiddenWrites.includes(item))) {
      fail(`${command.commandId} must not write payment/refund/ledger/stay/checkout/operational status.`);
    }
  }
  assertArray((scenario.failureSemantics ?? []).map((item) => item.failureCode), expectedFailureCodes, "failure codes");
  for (const failure of scenario.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  const rule = scenario.cancelNoShowInvariantRule ?? {};
  for (const key of [
    "validReservationRequired",
    "paymentDepositSnapshotRequiredForRefund",
    "settlementIntentRequiredForCheckoutRefund",
    "alreadyCheckedInBlocksOrdinaryCancellation",
    "alreadyCheckedOutBlocksOrdinaryCancellation",
    "alreadyCancelledBlocksDuplicateCancellation",
    "noShowRequiresHoldTimeElapsed",
    "noShowRequiresNoEffectiveCheckin",
    "customerConfirmationRequired",
    "disputeRequiresReview",
    "amountSourcesAuthoritative",
    "finalFinanceTruthManualInputForbidden",
    "inventoryReleaseScopeBoundToReservation",
    "financeGateHandlesRefundFeeLedger",
    "failureNoSideEffects",
    "querySearchListBoardReportReadonly"
  ]) {
    if (rule[key] !== true) fail(`cancelNoShowInvariantRule.${key} must be true.`);
  }
  const invariantText = JSON.stringify(scenario.invariants ?? []);
  for (const required of ["有效预订", "未入住", "未退房", "最晚保留时间", "有效收款押金摘要", "库存释放只能释放当前预订", "不得由用户手填最终账务真值", "finance-gate", "不得刷新错误 Projection"]) {
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
    boundary.businessRuntimeMayWriteStayCheckout !== false ||
    boundary.businessRuntimeMayRestoreOperationalStatus !== false ||
    boundary.financeGateMayConsumeRefundFeeIntentOnly !== true ||
    boundary.inventoryReadModelMayConsumeReleaseRequestOnly !== true ||
    boundary.failurePathBusinessSideEffectsAllowed !== false ||
    boundary.successMayWriteCancellationNoShowFactsAndRequestsOnly !== true) {
    fail("runtime/finance/inventory consumption boundary mismatch.");
  }
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must be readonly.");
  for (const term of ["已退款到账", "已入账", "已入住", "已退房", "final GO", "生产发布", "reservationCancel", "reservationNoShow", "RefundApprove", "CheckoutSettlementApprove"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(term)) fail(`surface forbidden visible terms missing ${term}.`);
  }
  assertArray(scenario.readSideOutputs, expectedHandoffOutputs, "read side outputs");
  if ((scenario.positiveBrowserTestPlan ?? []).length !== 12) fail("positive browser test plan must contain 12 steps.");
  if ((scenario.negativeBrowserTestPlan ?? []).length !== 15) fail("negative browser test plan must contain 15 cases.");
}

function checkNoGo() {
  if (scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 10 must keep production/business/final GO closed.");
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
