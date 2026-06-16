import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario8-in-stay-management-authority-result.json";
const failures = [];

const expectedObjects = [
  "StayManagementCase",
  "StayStatus",
  "ResidentCurrentProfile",
  "OccupancyStatus",
  "AccessCredentialStatus",
  "StayExtensionRequest",
  "BedTransferRequest",
  "ResidentServiceRequest",
  "ResidentIncident",
  "StayEvidence",
  "StayStatusHistory"
];
const expectedStatuses = [
  "正常在住",
  "待跟进",
  "服务处理中",
  "异常待处理",
  "续住待确认",
  "换房/换床待确认",
  "凭证待处理",
  "退房待准备"
];
const expectedSteps = [
  ["enter-in-stay-management", "进入在住管理"],
  ["maintain-stay-status", "维护在住状态"],
  ["resident-service-request", "服务请求与跟进"],
  ["resident-incident-record", "在住异常记录"],
  ["stay-extension-request", "续住申请"],
  ["bed-transfer-request", "换房/换床申请"],
  ["access-credential-management", "门禁/入住凭证管理"],
  ["checkout-preparation", "退房准备"]
];
const expectedCommands = [
  "Dorm.StayManagementContextView",
  "Dorm.StayStatusChange",
  "Dorm.ResidentServiceRequestRegister",
  "Dorm.ResidentServiceProgressUpdate",
  "Dorm.ResidentIncidentRegister",
  "Dorm.ResidentIncidentClose",
  "Dorm.StayExtensionRequestSubmit",
  "Dorm.BedTransferRequestSubmit",
  "Dorm.AccessCredentialStatusChange",
  "Dorm.CheckoutPreparationSnapshotCreate",
  "Dorm.StayManagementCorrectionRequest"
];
const expectedUpstreamInputs = [
  "入住记录摘要",
  "住客摘要",
  "房间/床位占用摘要",
  "入住凭证摘要",
  "协议摘要",
  "身份核验摘要",
  "财务确认摘要",
  "当前房源状态摘要",
  "当前价格摘要",
  "证据摘要",
  "只读对象引用"
];
const expectedHandoffOutputs = [
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
const forbiddenUserInput = [
  "stayId",
  "occupancyId",
  "credentialId",
  "serviceRequestId",
  "incidentId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenWrites = [
  "Payment",
  "Deposit",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction",
  "CheckoutSettlement",
  "CheckoutCase",
  "RoomRelease"
];
const expectedFailureCodes = [
  "no_effective_stay",
  "stay_already_checked_out",
  "current_occupancy_required",
  "target_bed_occupied",
  "target_resource_unavailable",
  "target_resource_blocked_for_transfer",
  "extension_date_invalid",
  "extension_finance_requires_finance_gate",
  "service_finance_write_forbidden",
  "incident_refund_forbidden",
  "high_risk_incident_review_required",
  "credential_without_effective_stay_forbidden",
  "credential_after_checkout_forbidden",
  "checkout_preparation_release_forbidden",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "duplicate_in_stay_submission",
  "concurrent_occupancy_conflict",
  "confirmed_fact_inline_edit_forbidden",
  "unauthorized_in_stay_action",
  "cross_scenario_checkout_refund_ledger_forbidden"
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
  version: "oam.dormitory-scenario8-in-stay-management-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.stayStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 8 in-stay management authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 8 in-stay management authority check: PASS (${result.scenarioDigest})`);

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
  const eighth = byNo.get(8);
  if (!eighth) {
    fail("package index missing package 8.");
    return;
  }
  if (eighth.nameZh !== "在住管理") fail("package 8 name must be 在住管理.");
  assertArray(eighth.upstreamPackages, [7, 6, 2, 3], "package 8 upstream packages");
  assertArray(eighth.downstreamPackages, [9], "package 8 downstream packages");
  assertArray(eighth.handoffInputs, expectedUpstreamInputs, "package 8 handoff inputs");
  assertArray(eighth.handoffOutputs, expectedHandoffOutputs, "package 8 handoff outputs");
  for (const forbidden of ["退房结算", "退款", "已释放房源", "Payment", "Deposit", "Refund", "CheckoutSettlement", "CheckoutCase", "RoomRelease", "LedgerEntry", "LedgerTransaction"]) {
    if (!(eighth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 8 must forbid output ${forbidden}.`);
  }
  const ninth = byNo.get(9);
  for (const output of expectedHandoffOutputs) {
    if (!(ninth?.handoffInputs ?? []).includes(output)) fail(`package 9 handoff inputs must include package 8 output ${output}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 8 Source.");
  for (const oldExpression of ["StayLifecycle", "bed-transfer-extend", "service-task", "AccessCredentialIssue", "AccessCredentialRevoke"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 8 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 8 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 8 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 8 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario8-in-stay-management-authority.mjs") fail("scenario 8 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 8 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 8 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 8 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario8-in-stay-management-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario8.InStayManagement") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 8 || scenario.scenarioId !== "lodging.in-stay-management" || scenario.nameZh !== "在住管理") fail("scenario package 8 identity invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 8 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 8 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [7, 6, 2, 3], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedUpstreamInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 8 must not write back upstream.");
  if (scenario.downstream?.allowedConsumerPackageNo !== 9) fail("scenario 8 downstream must be package 9 only.");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
  if (scenario.downstream?.downstreamRecheckRuleZh?.includes("不得要求用户重新填写已确认入住字段") !== true) {
    fail("scenario 8 downstream must forbid refilling confirmed check-in fields.");
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.stayStatusOptions, expectedStatuses, "scenario stay status options");
  for (const object of scenario.objects ?? []) {
    for (const required of ["evidenceHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["已入住", "正常在住", "退房待准备", "可退房", "正常在住不等于已结清", "退房待准备不等于已退房", "换房/换床不等于重新入住"]) {
    if (!stateText.includes(required)) fail(`state layering missing ${required}.`);
  }
}

function checkStepsAndFields() {
  if ((scenario.steps ?? []).length !== 8) fail("scenario must define exactly 8 business steps.");
  for (const [index, [stepId, nameZh]] of expectedSteps.entries()) {
    const step = scenario.steps?.[index];
    if (!step) continue;
    if (step.stepId !== stepId || step.nameZh !== nameZh) fail(`step ${index + 1} identity mismatch.`);
  }
  for (const expected of ["stayManagementCaseRef", "stayRef", "occupancyRef", "stayStatusRef", "residentServiceRequestRef", "residentIncidentRef", "stayExtensionRequestRef", "bedTransferRequestRef", "credentialStatusRef", "checkoutPreparationSnapshotRef"]) {
    if (!(scenario.fields?.systemGenerated ?? []).includes(expected)) fail(`system generated field missing ${expected}.`);
  }
  assertArray(scenario.fields?.forbiddenUserInputFields, forbiddenUserInput, "forbidden user input fields");
  if (!String(scenario.fields?.userReadableNamesOnlyZh ?? "").includes("张三") ||
    !String(scenario.fields?.userReadableNamesOnlyZh ?? "").includes("正常在住")) {
    fail("user readable field rule must use business visible names.");
  }
}

function checkCrud() {
  if (scenario.crudRules?.draftEditable !== true) fail("draft must be editable.");
  if (scenario.crudRules?.confirmedInStayFactInlineEditAllowed !== false) fail("confirmed in-stay fact inline edit must be forbidden.");
  if (scenario.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("readonly surfaces must not write business facts.");
  for (const surface of ["查询", "搜索", "列表", "看板", "报表"]) {
    if (!(scenario.crudRules?.readOnlySurfacesZh ?? []).includes(surface)) fail(`CRUD readonly surfaces missing ${surface}.`);
  }
}

function checkCommandsAndFailures() {
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "command list");
  for (const command of scenario.commands ?? []) {
    if ((command.writesObjects ?? []).some((item) => forbiddenWrites.includes(item))) {
      fail(`${command.commandId} must not write payment/deposit/refund/ledger/checkout/release objects.`);
    }
  }
  assertArray((scenario.failureSemantics ?? []).map((item) => item.failureCode), expectedFailureCodes, "failure codes");
  for (const failure of scenario.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  const rule = scenario.inStayInvariantRule ?? {};
  for (const key of [
    "effectiveStayRequired",
    "currentOccupancyRequired",
    "singleActiveOccupancyPerBedAtSameTime",
    "transferAppendOnlyOccupancyChanged",
    "transferReleasesOldAndBindsNewOnSuccess",
    "extensionDateMustBeLaterThanCurrentCheckout",
    "extensionFinanceHandledByFinanceGateOnly",
    "credentialRequiresEffectiveStayAndOccupancy",
    "checkoutAfterCredentialMustNotRemainActive",
    "checkoutPreparationNotCheckoutSettlement",
    "failureNoSideEffects"
  ]) {
    if (rule[key] !== true) fail(`inStayInvariantRule.${key} must be true.`);
  }
  const invariantText = JSON.stringify(scenario.invariants ?? []);
  for (const required of ["有效 Stay", "同一床位同一时间只能有一个有效在住占用", "追加 OccupancyChanged", "不得直接收款或写账", "退房后不得保持有效凭证", "不得生成退房", "不得刷新错误 Projection"]) {
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

function checkRuntimeAndSurfaceBoundary() {
  for (const forbidden of forbiddenWrites) {
    if (!(scenario.businessBoundaries?.forbiddenWritesZh ?? []).includes(forbidden)) fail(`business boundary must forbid ${forbidden}.`);
  }
  const boundary = scenario.runtimeConsumptionBoundary ?? {};
  if (boundary.runtimeMayReadGeneratedOnly !== true ||
    boundary.runtimeMayHardcodeBusinessRules !== false ||
    boundary.businessRuntimeMayWriteLedger !== false ||
    boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
    boundary.businessRuntimeMayWriteCheckoutSettlement !== false ||
    boundary.businessRuntimeMayReleaseRoom !== false ||
    boundary.failurePathBusinessSideEffectsAllowed !== false ||
    boundary.successMayWriteInStayFactsOnly !== true) {
    fail("runtime consumption boundary mismatch.");
  }
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must be readonly.");
  for (const term of ["已退房", "已退款", "已释放房源", "final GO", "生产发布", "StayLifecycle", "bed-transfer-extend", "service-task", "AccessCredentialIssue", "AccessCredentialRevoke"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(term)) fail(`surface forbidden visible terms missing ${term}.`);
  }
  assertArray(scenario.readSideOutputs, expectedHandoffOutputs, "read side outputs");
  if ((scenario.positiveBrowserTestPlan ?? []).length !== 10) fail("positive browser test plan must contain 10 steps.");
  if ((scenario.negativeBrowserTestPlan ?? []).length !== 13) fail("negative browser test plan must contain 13 cases.");
}

function checkNoGo() {
  if (scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 8 must keep production/business/final GO closed.");
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
