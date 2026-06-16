import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario7-check-in-processing-authority-result.json";
const failures = [];

const expectedObjects = [
  "CheckInCase",
  "ArrivingGuest",
  "ResidentProfile",
  "IdentityVerification",
  "Stay",
  "RoomBedOccupancy",
  "CheckInAgreement",
  "AccessCredential",
  "CheckInSnapshot",
  "CheckInEvidence",
  "CheckInStatusHistory"
];
const expectedStatuses = [
  "待到店",
  "待身份核验",
  "待协议确认",
  "待财务补齐",
  "待房源复核",
  "可办理入住",
  "已入住",
  "入住失败",
  "需人工复核",
  "凭证待发放",
  "凭证已发放"
];
const expectedSteps = [
  ["enter-check-in-processing", "进入入住办理"],
  ["arrival-and-identity-verification", "到店与身份核验"],
  ["finance-and-agreement-review", "财务与协议复核"],
  ["room-bed-handover-recheck", "房间/床位交付复核"],
  ["confirm-check-in", "确认入住"],
  ["issue-access-credential", "发放入住凭证"]
];
const expectedCommands = [
  "Dorm.CheckInDraftStart",
  "Dorm.GuestIdentityVerify",
  "Dorm.CheckInAgreementFinanceReview",
  "Dorm.RoomBedHandoverRecheck",
  "Dorm.StayConfirm",
  "Dorm.StayCredentialIssue",
  "Dorm.CheckInManualReviewRequest",
  "Dorm.CheckInCorrectionRequest"
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
  "收款确认摘要",
  "押金确认摘要",
  "担保确认摘要",
  "剩余待收",
  "财务确认状态",
  "财务确认摘要",
  "房源运营状态摘要",
  "阻断原因",
  "证据摘要",
  "只读对象引用"
];
const expectedHandoffOutputs = [
  "入住记录摘要",
  "住客摘要",
  "房间/床位占用摘要",
  "入住凭证摘要",
  "协议摘要",
  "身份核验摘要",
  "证据摘要",
  "只读对象引用"
];
const forbiddenUserInput = [
  "stayId",
  "residentId",
  "reservationId",
  "credentialId",
  "roomId",
  "bedId",
  "occupancyId",
  "checkInCaseId",
  "identityVerificationId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenRuntimeWrites = [
  "Payment",
  "Deposit",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction",
  "CheckoutCase"
];
const expectedFailureCodes = [
  "reservation_not_valid",
  "reservation_cancelled",
  "reservation_expired",
  "reservation_already_converted",
  "finance_rule_unmet_without_exception",
  "manager_exception_approval_required",
  "identity_evidence_required",
  "identity_verification_failed",
  "guest_mismatch_without_approval",
  "agreement_not_confirmed",
  "resource_not_available_for_checkin",
  "resource_already_occupied",
  "resource_blocked_for_checkin",
  "stay_no_user_input_forbidden",
  "credential_before_checkin_forbidden",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "duplicate_checkin",
  "concurrent_occupancy_conflict",
  "confirmed_checkin_inline_edit_forbidden",
  "cross_scenario_checkout_refund_forbidden"
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
checkRuntimeAndSurfaceBoundary();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario7-check-in-processing-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.checkInStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 7 check-in processing authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 7 check-in processing authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const names = (packageIndex.scenarioPackageOrder ?? []).slice(0, 9).map((item) => item.nameZh);
  assertArray(names, [
    "房源建档与基础就绪",
    "房源运营就绪与状态维护",
    "住宿商品与价格",
    "询价与报价",
    "预订与库存锁定",
    "收款、押金与担保",
    "入住办理",
    "在住管理",
    "退房结算"
  ], "first nine package names");
  const seventh = byNo.get(7);
  if (!seventh) {
    fail("package index missing package 7.");
    return;
  }
  if (seventh.nameZh !== "入住办理") fail("package 7 name must be 入住办理.");
  assertArray(seventh.upstreamPackages, [5, 6, 2, 3], "package 7 upstream packages");
  assertArray(seventh.downstreamPackages, [8], "package 7 downstream packages");
  assertArray(seventh.handoffInputs, expectedUpstreamInputs, "package 7 handoff inputs");
  assertArray(seventh.handoffOutputs, expectedHandoffOutputs, "package 7 handoff outputs");
  for (const forbidden of ["价格变更", "报价", "预订变更", "收款", "押金变更", "退房结算", "退款", "已退款", "押金已退", "账务入账", "LedgerEntry", "LedgerTransaction"]) {
    if (!(seventh.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 7 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 7 Source.");
  for (const oldExpression of ["CheckinConfirm", "reservationConvert", "AccessCredentialIssue"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 7 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 7 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 7 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 7 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario7-check-in-processing-authority.mjs") fail("scenario 7 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 7 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 7 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 7 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario7-check-in-processing-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario7.CheckInProcessing") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 7 || scenario.scenarioId !== "lodging.check-in-processing" || scenario.nameZh !== "入住办理") fail("scenario package 7 identity invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 7 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 7 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [5, 6, 2, 3], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedUpstreamInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 7 must not write back upstream.");
  if (scenario.downstream?.allowedConsumerPackageNo !== 8) fail("scenario 7 downstream must be package 8 only.");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
  if (scenario.downstream?.downstreamRecheckRuleZh?.includes("不得要求用户重新填写已确认入住字段") !== true) {
    fail("scenario 7 downstream must forbid refilling confirmed check-in fields.");
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.checkInStatusOptions, expectedStatuses, "scenario check-in status options");
  for (const object of scenario.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 7) fail(`${object.objectName} must be owned by scenario package 7.`);
    for (const required of ["currentState", "versionHistory", "evidenceHistory", "credentialHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["已预订", "财务已确认", "可办理入住", "已入住", "在住服务", "退房", "已结清", "押金可退", "房源恢复"]) {
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
  assertArray((scenario.steps ?? []).map((item) => item.commandId), expectedCommands.slice(0, 6), "step command list");
  for (const expected of ["checkInCaseRef", "residentRef", "identityVerificationRef", "agreementRef", "occupancyCandidateRef", "stayRef", "stayNo", "occupancyRef", "accessCredentialRef"]) {
    if (!(scenario.fields?.systemGenerated ?? []).includes(expected)) fail(`system generated field missing ${expected}.`);
  }
  assertArray(scenario.fields?.forbiddenUserInputFields, forbiddenUserInput, "forbidden user input fields");
  if (!String(scenario.fields?.userReadableNamesOnlyZh ?? "").includes("入住记录")) fail("user readable field rule must use business visible names.");
}

function checkCrud() {
  if (scenario.crudRules?.draftEditable !== true) fail("draft must be editable.");
  if (scenario.crudRules?.confirmedCheckInInlineEditAllowed !== false) fail("confirmed check-in inline edit must be forbidden.");
  if (scenario.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("readonly surfaces must not write business facts.");
  for (const surface of ["查询", "搜索", "列表", "看板", "报表"]) {
    if (!(scenario.crudRules?.readOnlySurfacesZh ?? []).includes(surface)) fail(`CRUD readonly surfaces missing ${surface}.`);
  }
}

function checkCommandsAndFailures() {
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "command list");
  for (const command of scenario.commands ?? []) {
    if ((command.writesObjects ?? []).some((item) => forbiddenRuntimeWrites.includes(item))) {
      fail(`${command.commandId} must not write payment/deposit/refund/ledger/checkout objects.`);
    }
  }
  assertArray((scenario.failureSemantics ?? []).map((item) => item.failureCode), expectedFailureCodes, "failure codes");
  for (const failure of scenario.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  const rule = scenario.checkInInvariantRule ?? {};
  for (const key of [
    "validReservationRequired",
    "reservationCancelledBlocked",
    "reservationExpiredBlocked",
    "reservationAlreadyConvertedBlocked",
    "resourceAvailableForCheckInRequired",
    "resourceOccupiedBlocked",
    "resourceMaintenanceSalePausedAbnormalBlocked",
    "identityVerificationRequired",
    "agreementConfirmationRequired",
    "financeReadinessOrManagerExceptionRequired",
    "managerExceptionRequiresEvidence",
    "stayNoSystemGenerated",
    "confirmedStayStartsOccupancy",
    "reservationConvertedToStayOnSuccess",
    "credentialRequiresSuccessfulStay",
    "failureNoSideEffects"
  ]) {
    if (rule[key] !== true) fail(`checkInInvariantRule.${key} must be true.`);
  }
  const invariantText = JSON.stringify(scenario.invariants ?? []);
  for (const required of ["不得生成 Stay", "不得占用床位", "不得发放入住凭证", "不得写账", "CommandSubmission", "DomainEvent", "Outbox", "Projection", "Ledger"]) {
    if (!invariantText.includes(required)) fail(`invariants missing no-side-effect guard ${required}.`);
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

function checkRuntimeAndSurfaceBoundary() {
  for (const forbidden of forbiddenRuntimeWrites) {
    if (!(scenario.businessBoundaries?.forbiddenWritesZh ?? []).includes(forbidden)) fail(`business boundary must forbid ${forbidden}.`);
  }
  const boundary = scenario.runtimeConsumptionBoundary ?? {};
  if (boundary.runtimeMayReadGeneratedOnly !== true ||
    boundary.runtimeMayHardcodeBusinessRules !== false ||
    boundary.businessRuntimeMayWriteLedger !== false ||
    boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
    boundary.businessRuntimeMayWriteCheckout !== false ||
    boundary.failurePathBusinessSideEffectsAllowed !== false ||
    boundary.successMayWriteStayOccupancyCredentialOnly !== true) {
    fail("runtime consumption boundary mismatch.");
  }
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must be readonly.");
  for (const term of ["已退房", "已退款", "押金已退", "final GO", "生产发布", "CheckinConfirm", "reservationConvert", "AccessCredentialIssue"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(term)) fail(`surface forbidden visible terms missing ${term}.`);
  }
  assertArray(scenario.readSideOutputs, expectedHandoffOutputs, "read side outputs");
  if ((scenario.positiveBrowserTestPlan ?? []).length !== 10) fail("positive browser test plan must contain 10 steps.");
  if ((scenario.negativeBrowserTestPlan ?? []).length !== 14) fail("negative browser test plan must contain 14 cases.");
}

function checkNoGo() {
  if (scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 7 must keep production/business/final GO closed.");
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
