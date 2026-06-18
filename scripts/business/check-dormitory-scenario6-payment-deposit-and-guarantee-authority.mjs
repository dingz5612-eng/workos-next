import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-authority-result.json";
const failures = [];
const expectedObjects = [
  "PaymentRequirement",
  "PaymentIntent",
  "PaymentReceiptEvidence",
  "DepositRequirement",
  "DepositIntent",
  "DepositGuarantee",
  "FinanceReviewRequest",
  "FinanceConfirmationSnapshot",
  "PaymentStatusHistory",
  "DepositStatusHistory"
];
const expectedStatuses = [
  "待提交凭证",
  "待财务确认",
  "财务已确认",
  "财务退回",
  "部分确认",
  "押金已确认",
  "担保已确认",
  "需补充证据"
];
const expectedSteps = [
  ["enter-payment-deposit-processing", "进入收款押金办理"],
  ["confirm-payment-and-deposit-requirements", "确认应收与押金要求"],
  ["submit-payment-receipt-evidence", "提交收款凭证"],
  ["submit-deposit-or-guarantee", "提交押金或担保信息"],
  ["finance-gate-confirmation", "财务确认"],
  ["output-finance-ready-summary", "输出入住前财务摘要"]
];
const expectedCommands = [
  "Dorm.PaymentDepositCaseStart",
  "Dorm.PaymentDepositRequirementConfirm",
  "Dorm.PaymentReceiptSubmit",
  "Dorm.DepositGuaranteeSubmit",
  "Dorm.FinanceReviewRequest",
  "Dorm.FinanceGateConfirm",
  "Dorm.FinanceGateReturn",
  "Dorm.FinanceEvidenceSupplement",
  "Dorm.FinanceReadySummaryOutput"
];
const expectedUpstreamInputs = [
  "预订确认摘要",
  "预订号",
  "客户信息",
  "日期范围",
  "人数",
  "房间/床位",
  "价格快照",
  "预订状态",
  "证据摘要",
  "只读对象引用",
  "价格方案摘要",
  "报价单摘要",
  "报价版本"
];
const expectedHandoffOutputs = [
  "收款确认摘要",
  "押金确认摘要",
  "担保确认摘要",
  "剩余待收",
  "财务确认状态",
  "证据摘要",
  "只读对象引用"
];
const forbiddenUserInput = [
  "paymentId",
  "depositId",
  "guaranteeId",
  "ledgerEntryId",
  "ledgerTransactionId",
  "reservationId",
  "paymentCaseId",
  "financeReviewRequestId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenRuntimeWrites = [
  "Stay",
  "CheckIn",
  "Checkout",
  "Refund",
  "InventoryRelease",
  "ResourceStatusChange",
  "LedgerEntry",
  "LedgerTransaction"
];
const expectedFailureCodes = [
  "reservation_not_confirmed",
  "reservation_cancelled",
  "price_snapshot_required",
  "payment_requirement_source_invalid",
  "amount_must_be_positive",
  "currency_mismatch",
  "receipt_evidence_required",
  "deposit_marked_as_income_forbidden",
  "guarantee_marked_as_payment_forbidden",
  "finance_gate_required",
  "unauthorized_finance_confirmation",
  "forged_internal_reference",
  "ledger_write_forbidden",
  "readonly_result_write_attempt",
  "post_submission_inline_edit_forbidden",
  "confirmed_finance_inline_edit_forbidden",
  "duplicate_submission",
  "concurrent_finance_version_conflict",
  "cross_scenario_checkin_forbidden",
  "finance_evidence_missing",
  "guarantee_validity_required"
];

const scenario = readJson(scenarioPath);
const packageIndex = readJson(packageIndexPath);
const authorityIndex = readJson(authorityIndexPath);

checkPackageIndex();
checkAuthorityIndexRegistration();
checkScenarioHeader();
checkObjectsAndStates();
checkStepsAndFields();
checkFinanceBoundary();
checkCrud();
checkCommandsAndFailures();
checkInvariantsAndEvidence();
checkSurfaceBoundary();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario6-payment-deposit-and-guarantee-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.paymentDepositStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 6 payment deposit and guarantee authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 6 payment deposit and guarantee authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const names = (packageIndex.scenarioPackageOrder ?? []).slice(0, 7).map((item) => item.nameZh);
  assertArray(names, ["房源建档与基础就绪", "房源运营就绪与状态维护", "住宿商品与价格", "询价与报价", "预订与库存锁定", "收款、押金与担保", "入住办理"], "first seven package names");
  const sixth = byNo.get(6);
  if (!sixth) {
    fail("package index missing package 6.");
    return;
  }
  if (sixth.nameZh !== "收款、押金与担保") fail("package 6 name must be 收款、押金与担保.");
  assertArray(sixth.upstreamPackages, [5, 3, 4], "package 6 upstream packages");
  assertArray(sixth.downstreamPackages, [7], "package 6 downstream packages");
  assertArray(sixth.handoffInputs, expectedUpstreamInputs, "package 6 handoff inputs");
  assertArray(sixth.handoffOutputs, expectedHandoffOutputs, "package 6 handoff outputs");
  for (const forbidden of ["入住", "已入住", "退房", "已退房", "退款", "已退款", "库存变更", "房源状态变更", "LedgerEntry", "LedgerTransaction"]) {
    if (!(sixth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 6 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 6 Source.");
  for (const oldExpression of ["ordinary-payment", "deposit-liability", "PaymentConfirm", "DepositConfirm"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 6 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 6 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 6 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 6 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-authority.mjs") fail("scenario 6 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 6 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 6 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 6 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario6-payment-deposit-and-guarantee-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario6.PaymentDepositAndGuarantee") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 6 || scenario.nameZh !== "收款、押金与担保") fail("scenario package 6 name invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 6 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 6 must reference scenario 1 benchmark as method contract.");
  if (scenario.financeGateAuthorityRef !== "docs/business/domains/finance/finance-operating-kernel.json") fail("scenario 6 must reference finance-gate authority.");
  if (scenario.financeLedgerAuthorityRef !== "docs/finance/finance-ledger-kernel.json") fail("scenario 6 must reference finance ledger authority.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [5, 3, 4], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedUpstreamInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 6 must not write back upstream.");
  if (scenario.downstream?.allowedConsumerPackageNo !== 7) fail("scenario 6 downstream must be package 7 only.");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
  if (scenario.downstream?.downstreamRecheckRuleZh?.includes("不得把收款确认当成已入住") !== true) {
    fail("scenario 6 downstream must forbid treating finance confirmation as check-in.");
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.paymentDepositStatusOptions, expectedStatuses, "scenario payment/deposit status options");
  for (const object of scenario.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 6) fail(`${object.objectName} must be owned by scenario package 6.`);
    for (const required of ["currentState", "evidenceHistory", "financeConfirmationHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["已预订", "待收款", "待押金", "待担保", "可入住", "不得产生已入住", "不得释放库存"]) {
    if (!stateText.includes(required)) fail(`state layering missing ${required}.`);
  }
}

function checkStepsAndFields() {
  if ((scenario.steps ?? []).length !== 6) fail("scenario must define exactly 6 business steps.");
  for (const [index, [stepId, nameZh]] of expectedSteps.entries()) {
    const step = scenario.steps?.[index];
    if (!step) continue;
    if (step.stepId !== stepId || step.nameZh !== nameZh) fail(`step ${index + 1} identity mismatch.`);
  }
  for (const [stepIndex, fields] of [
    [0, ["paymentCaseRef", "reservationRef", "priceSnapshotRef", "policySnapshotRef", "sourceScenarioRef"]],
    [1, ["paymentRequirementRef", "depositRequirementRef", "requirementVersion"]],
    [2, ["paymentIntentRef", "receiptEvidenceRef", "submittedAt", "submittedBy"]],
    [3, ["depositIntentRef", "guaranteeRef", "guaranteeValidUntil", "evidenceEnvelopeRef"]],
    [4, ["financeReviewRequestRef", "financeConfirmationSnapshotRef", "financeGateEventRef", "confirmedAt", "confirmedBy"]],
    [5, ["financeReadySnapshotRef", "financeStatusHistoryRef", "downstreamReadonlyRef"]]
  ]) {
    const step = scenario.steps?.[stepIndex] ?? {};
    for (const field of fields) {
      if (!(step.systemGeneratedFields ?? []).includes(field)) fail(`step ${stepIndex + 1} missing system field ${field}.`);
    }
  }
  for (const internal of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`forbidden user input missing ${internal}.`);
    for (const fieldClass of ["userFilled", "userSelected"]) {
      if ((scenario.fields?.[fieldClass] ?? []).includes(internal)) fail(`${internal} must not be ${fieldClass}.`);
    }
  }
  for (const requiredClass of ["upstreamReadonly", "userFilled", "userSelected", "systemGenerated", "systemCalculated", "evidenceBound", "financeConfirmed", "internalAuditOnlyFields"]) {
    if (!Array.isArray(scenario.fields?.[requiredClass]) || scenario.fields[requiredClass].length === 0) fail(`fields missing class ${requiredClass}.`);
  }
}

function checkFinanceBoundary() {
  if (scenario.financeBoundaryRule?.financeGateRequired !== true ||
    scenario.financeBoundaryRule?.businessRuntimeMayWriteLedger !== false ||
    scenario.financeBoundaryRule?.ledgerEntryWrittenOnlyByFinanceKernel !== true ||
    scenario.financeBoundaryRule?.paymentIntentIsNotFinanceTruth !== true ||
    scenario.financeBoundaryRule?.depositIsNotIncome !== true ||
    scenario.financeBoundaryRule?.guaranteeIsNotPayment !== true ||
    scenario.financeBoundaryRule?.financeConfirmationRequiresAuthorizedRole !== true) {
    fail("finance boundary rule must enforce finance-gate, no business ledger write, deposit non-income, guarantee non-payment and authorized confirmation.");
  }
}

function checkCrud() {
  if (!String(scenario.crudRules?.createZh ?? "").includes("提交收款凭证")) fail("create rule must use business actions.");
  if (scenario.crudRules?.draftEditable !== true) fail("draft edit must be allowed.");
  if (scenario.crudRules?.submittedFinanceInlineEditAllowed !== false) fail("submitted finance inline edit must be forbidden.");
  if (scenario.crudRules?.confirmedFinanceInlineEditAllowed !== false) fail("confirmed finance inline edit must be forbidden.");
  if (!String(scenario.crudRules?.deletePolicyZh ?? "").includes("不得物理删除已确认事实")) fail("delete rule must forbid physical deletion of confirmed finance facts.");
  if (scenario.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("query/search/list/board/report must be readonly.");
}

function checkCommandsAndFailures() {
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "scenario commands");
  for (const command of scenario.commands ?? []) {
    if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true || command.requiresGeneratedContract !== true) {
      fail(`${command.commandId} must require idempotency, concurrency and generated contract.`);
    }
    for (const forbidden of forbiddenRuntimeWrites) {
      if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} must forbid runtime write ${forbidden}.`);
    }
  }
  const failureByCode = new Map((scenario.failureSemantics ?? []).map((item) => [item.failureCode, item]));
  for (const code of expectedFailureCodes) {
    const item = failureByCode.get(code);
    if (!item) fail(`failure semantics missing ${code}.`);
    if (item?.sideEffectsAllowed !== false) fail(`${code} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  const invariantText = JSON.stringify(scenario.invariants ?? []);
  for (const required of [
    "未确认预订不得进入",
    "押金不是收入",
    "担保不是收款",
    "业务侧上传凭证不代表财务已确认",
    "finance-gate",
    "不得直接写 LedgerEntry",
    "收款确认不等于已入住",
    "确认失败不得写",
    "查询、搜索、列表、看板、报表永远只读"
  ]) {
    if (!invariantText.includes(required)) fail(`invariant missing: ${required}`);
  }
  for (const [stepId] of expectedSteps) {
    if (!scenario.evidence?.requiredEvidenceByStep?.[stepId]?.length) fail(`evidence missing for ${stepId}.`);
  }
  if (scenario.evidence?.noSideEffectsProofRequired !== true ||
    scenario.evidence?.screenshotAnalysisRequired !== true ||
    scenario.evidence?.financeGateEvidenceRequired !== true) {
    fail("evidence policy must require screenshots, finance-gate evidence and no-side-effects proof.");
  }
}

function checkSurfaceBoundary() {
  const surfaceText = JSON.stringify(scenario.surfaceNavigation ?? {});
  for (const page of ["收款押金办理页", "应收摘要页", "收款凭证提交页", "押金/担保提交页", "财务确认页", "财务退回补证页", "确认摘要页", "状态历史页"]) {
    if (!surfaceText.includes(page)) fail(`surface navigation missing page ${page}.`);
  }
  for (const entry of ["今日", "工作项", "搜索", "我的"]) {
    if (!surfaceText.includes(entry)) fail(`surface navigation missing ${entry}.`);
  }
  for (const forbidden of ["已入住", "已退房", "已退款", "final GO", "ordinary-payment", "deposit-liability", "PaymentConfirm", "DepositConfirm"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(forbidden)) fail(`surface forbidden visible terms missing ${forbidden}.`);
  }
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("search surface must be readonly.");
  if (!String(scenario.surfaceNavigation?.mineZh ?? "").includes("草稿")) fail("mine entry must keep drafts/personal duties only.");
  assertArray(scenario.readSideOutputs ?? [], expectedHandoffOutputs, "read side outputs");
}

function checkNoGo() {
  if (scenario.NO_GO?.businessFeatureDevelopmentAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario NO_GO boundary must keep production/release/final approval closed.");
  }
}

function assertArray(actual = [], expected = [], label) {
  const left = actual ?? [];
  if (left.length !== expected.length || expected.some((item, index) => left[index] !== item)) {
    fail(`${label} mismatch. expected=${JSON.stringify(expected)} actual=${JSON.stringify(left)}`);
  }
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

function fail(message) {
  failures.push(message);
}
