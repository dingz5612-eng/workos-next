import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-authority-result.json";
const failures = [];

const expectedObjects = [
  "ChannelPartner",
  "ChannelAccount",
  "CorporateAccount",
  "CorporateCustomer",
  "CorporateAgreement",
  "AgreementEligibility",
  "ChannelEligibility",
  "CorporateEligibility",
  "ChannelProductMapping",
  "ChannelPublicationRule",
  "ChannelPublicationStatus",
  "CommissionRuleIntent",
  "SettlementRuleIntent",
  "ChannelContact",
  "CorporateContact",
  "ContactPerson",
  "ContractEvidence",
  "StatusHistory",
  "ChannelStatusHistory"
];
const expectedStatuses = [
  "渠道草稿",
  "待审核",
  "已启用",
  "已暂停",
  "已停用",
  "企业客户草稿",
  "协议待审核",
  "协议已生效",
  "协议已过期",
  "协议已停用",
  "发布待检查",
  "发布已启用",
  "发布已暂停",
  "财务规则待确认"
];
const expectedSteps = [
  ["create-channel-or-corporate-profile", "建立渠道或企业客户档案"],
  ["maintain-cooperation-agreement", "维护合作协议"],
  ["bind-product-and-eligibility", "绑定商品与适用资格"],
  ["configure-channel-publication-rule", "配置渠道发布规则"],
  ["configure-commission-settlement-intent", "配置佣金与结算规则意向"],
  ["audit-enable", "审核启用"],
  ["daily-maintenance", "日常维护"]
];
const expectedCommands = [
  "Dorm.ChannelCorporateProfileDraftStart",
  "Dorm.ChannelPartnerProfileCreate",
  "Dorm.CorporateCustomerProfileCreate",
  "Dorm.CorporateAgreementDraftSubmit",
  "Dorm.CorporateAgreementApproveActivate",
  "Dorm.ChannelProductEligibilityBind",
  "Dorm.ChannelPublicationRuleConfigure",
  "Dorm.ChannelPublicationEnable",
  "Dorm.CommissionSettlementIntentSubmit",
  "Dorm.ChannelCorporateAuditDecision",
  "Dorm.ChannelPause",
  "Dorm.ChannelDisable",
  "Dorm.CorporateAgreementRenew",
  "Dorm.ChannelCorporateDailyMaintenance",
  "Dorm.ChannelCorporateEvidenceSupplement",
  "Dorm.ChannelCorporateCorrectionRequest"
];
const expectedInputs = [
  "房间/床位运营状态摘要",
  "运营阻断摘要",
  "商品摘要",
  "价格方案摘要",
  "价格版本摘要",
  "适用日期",
  "证据摘要",
  "只读对象引用"
];
const expectedOutputs = [
  "渠道摘要",
  "企业客户摘要",
  "协议摘要",
  "适用商品/价格资格摘要",
  "渠道发布规则摘要",
  "佣金/结算规则意向",
  "证据摘要",
  "只读对象引用"
];
const forbiddenUserInput = [
  "channelId",
  "corporateAccountId",
  "agreementId",
  "productId",
  "priceVersionId",
  "ratePlanId",
  "quoteId",
  "reservationId",
  "inventoryHoldId",
  "paymentId",
  "refundId",
  "ledgerEntryId",
  "ledgerTransactionId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenWrites = [
  "RatePlan 金额真值",
  "Quote",
  "Reservation",
  "InventoryHold",
  "Payment",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction"
];
const expectedFailureCodes = [
  "missing_required_business_profile",
  "missing_key_evidence",
  "invalid_agreement_date_range",
  "agreement_approval_required",
  "expired_agreement_forbidden",
  "inactive_product_price_forbidden",
  "missing_effective_price",
  "operation_blocked_publication_forbidden",
  "direct_rateplan_truth_write_forbidden",
  "direct_quote_reservation_forbidden",
  "direct_inventory_hold_forbidden",
  "direct_finance_ledger_forbidden",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "duplicate_channel_submission",
  "concurrent_channel_conflict",
  "unauthorized_channel_action",
  "confirmed_agreement_inline_edit_forbidden",
  "commission_settlement_evidence_required",
  "channel_publish_requires_valid_eligibility"
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
  version: "oam.dormitory-scenario12-channel-corporate-customer-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.channelCorporateStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 12 channel corporate customer authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 12 channel corporate customer authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const names = (packageIndex.scenarioPackageOrder ?? []).slice(0, 12).map((item) => item.nameZh);
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
    "取消、未到店与退款处理",
    "房务、维修与停售协同",
    "渠道与企业客户"
  ], "first twelve package names");
  const twelfth = byNo.get(12);
  if (!twelfth) return fail("package index missing package 12.");
  if (twelfth.nameZh !== "渠道与企业客户") fail("package 12 name must be 渠道与企业客户.");
  assertArray(twelfth.upstreamPackages, [2, 3], "package 12 upstream packages");
  assertArray(twelfth.handoffInputs, expectedInputs, "package 12 handoff inputs");
  assertArray(twelfth.handoffOutputs, expectedOutputs, "package 12 handoff outputs");
  for (const forbidden of forbiddenWrites.concat(["已报价", "已预订", "已收款", "已入账"])) {
    if (!(twelfth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 12 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 12 Source.");
  for (const oldExpression of ["lead-reservation", "RatePlan", "PaymentConfirm", "channel/OTA 临时字段"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 12 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 12 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 12 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 12 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario12-channel-corporate-customer-authority.mjs") fail("scenario 12 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 12 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 12 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 12 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario12-channel-corporate-customer-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario12.ChannelCorporateCustomer") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 12 || scenario.scenarioId !== "lodging.channel-corporate-customer" || scenario.nameZh !== "渠道与企业客户") fail("scenario package 12 identity invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 12 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 12 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [2, 3], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 12 must not write back upstream.");
  assertArray(scenario.downstream?.handoffOutputs, expectedOutputs, "scenario downstream handoff outputs");
  const downstreamText = JSON.stringify(scenario.downstream ?? {});
  for (const required of ["场景包 3", "场景包 4", "场景包 5", "finance-gate"]) {
    if (!downstreamText.includes(required)) fail(`scenario 12 downstream must include ${required}.`);
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.channelCorporateStatusOptions, expectedStatuses, "scenario status options");
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["商品和价格金额真值来自场景包 3", "报价来自场景包 4", "预订和库存锁定来自场景包 5", "财务真值来自 finance-gate", "渠道发布不等于库存已锁定"]) {
    if (!stateText.includes(required)) fail(`state layering missing ${required}.`);
  }
}

function checkStepsAndFields() {
  assertArray((scenario.steps ?? []).map((step) => [step.stepId, step.nameZh]), expectedSteps, "scenario steps");
  assertArray(scenario.fields?.upstreamReadonly, expectedInputs, "fields upstream readonly");
  for (const field of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(field)) fail(`forbidden user input missing ${field}.`);
  }
  for (const key of ["userFilled", "userSelected", "systemGenerated", "systemCalculated", "evidenceBound", "financeGate", "internalAudit"]) {
    if (!Array.isArray(scenario.fields?.[key]) || scenario.fields[key].length === 0) fail(`fields.${key} must be non-empty.`);
  }
}

function checkCrud() {
  if (scenario.crudRules?.draftCanEdit !== true ||
    scenario.crudRules?.confirmedInlineEditAllowed !== false ||
    scenario.crudRules?.physicalDeleteConfirmedFactAllowed !== false ||
    scenario.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) {
    fail("crud rules must keep draft editable, confirmed facts append-only, delete forbidden and readonly surfaces readonly.");
  }
  for (const action of ["新建渠道档案", "新建企业客户", "新建合作协议", "新建发布规则"]) {
    if (!(scenario.crudRules?.createActionNamesZh ?? []).includes(action)) fail(`crud create action missing ${action}.`);
  }
}

function checkCommandsAndFailures() {
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "scenario commands");
  const failureCodes = (scenario.failureSemantics ?? []).map((item) => item.failureCode);
  assertArray(failureCodes, expectedFailureCodes, "scenario failure codes");
  if (!(scenario.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    fail("all scenario 12 failures must forbid side effects.");
  }
}

function checkInvariantsAndEvidence() {
  const invariant = JSON.stringify(scenario.invariants ?? []);
  for (const required of ["主体名称", "联系人", "场景包 3", "场景包 2", "finance-gate", "渠道发布不等于库存已锁定", "不得刷新错误 Projection"]) {
    if (!invariant.includes(required)) fail(`invariants missing ${required}.`);
  }
  const rule = scenario.channelCorporateInvariantRule ?? {};
  for (const key of ["businessProfileRequired", "keyEvidenceRequiredBeforeEnable", "agreementDateRangeValid", "agreementApprovalRequiredBeforeEffective", "productPriceReferenceFromScenario3Only", "effectivePriceRequiredForPublication", "operationBlockPreventsPublication", "channelPublicationDoesNotLockInventory", "quoteOwnedByScenario4", "reservationInventoryOwnedByScenario5", "financeGateHandlesCommissionSettlementTruth", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (rule[key] !== true) fail(`channelCorporateInvariantRule.${key} must be true.`);
  }
  if (scenario.evidence?.screenshotAnalysisRequired !== true ||
    scenario.evidence?.noSideEffectsProofRequired !== true ||
    scenario.evidence?.evidenceRootRequiredAtIntegration !== true) {
    fail("evidence policy must require screenshots, no side effects and Evidence Root integration.");
  }
}

function checkRuntimeSurfaceFinanceBoundary() {
  const boundary = scenario.runtimeConsumptionBoundary ?? {};
  if (boundary.runtimeMayReadGeneratedOnly !== true ||
    boundary.runtimeMayHardcodeBusinessRules !== false ||
    boundary.businessRuntimeMayWriteRatePlanTruth !== false ||
    boundary.businessRuntimeMayWriteQuote !== false ||
    boundary.businessRuntimeMayWriteReservation !== false ||
    boundary.businessRuntimeMayWriteInventoryHold !== false ||
    boundary.businessRuntimeMayWritePaymentRefund !== false ||
    boundary.businessRuntimeMayWriteLedger !== false ||
    boundary.financeGateMayConsumeCommissionSettlementIntentOnly !== true ||
    boundary.scenario4MayConsumeEligibilityOnly !== true ||
    boundary.scenario5MayConsumeEligibilityOnly !== true ||
    boundary.successMayWriteChannelCorporateFactsAndIntentsOnly !== true) {
    fail("runtime consumption boundary mismatch.");
  }
  const surfaceText = JSON.stringify(scenario.surfaceNavigation ?? {});
  for (const required of ["搜索结果只读", "我的只放草稿", "协议即将到期", "财务规则待确认"]) {
    if (!surfaceText.includes(required)) fail(`surface navigation missing ${required}.`);
  }
  for (const forbidden of ["已报价", "已预订", "已收款", "已入账", "final GO", "生产发布", "lead-reservation", "RatePlan", "PaymentConfirm", "channel/OTA 临时字段"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(forbidden)) fail(`surface forbidden term missing ${forbidden}.`);
  }
  assertArray(scenario.readSideOutputs, expectedOutputs, "read side outputs");
  for (const forbidden of forbiddenWrites) {
    if ((scenario.readSideOutputs ?? []).includes(forbidden)) fail(`read side output must not include ${forbidden}.`);
  }
}

function checkNoGo() {
  if (scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 12 NO_GO must keep production/business/release/final approval disabled.");
  }
}

function assertArray(actual, expected, label) {
  if (!arraysEqual(actual, expected)) {
    fail(`${label} mismatch. expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  }
}

function arraysEqual(actual = [], expected = []) {
  const left = actual ?? [];
  const right = expected ?? [];
  return left.length === right.length &&
    left.every((item, index) => JSON.stringify(item) === JSON.stringify(right[index]));
}

function fail(message) {
  failures.push(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}
