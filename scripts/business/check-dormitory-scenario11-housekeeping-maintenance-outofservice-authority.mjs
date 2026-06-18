import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-authority-result.json";
const failures = [];

const expectedObjects = [
  "ServiceWorkCase",
  "HousekeepingTask",
  "MaintenanceTask",
  "InspectionTask",
  "OutOfServiceRequest",
  "WorkAssignment",
  "WorkAssignee",
  "WorkSchedule",
  "WorkCompletion",
  "WorkCompletionEvidence",
  "WorkVerification",
  "WorkVerificationResult",
  "RecoveryRecommendation",
  "ExpenseIntent",
  "TaskEvidence",
  "StatusHistory",
  "WorkStatusHistory"
];
const expectedStatuses = [
  "待派工",
  "已派工",
  "处理中",
  "待验收",
  "验收通过",
  "验收不通过",
  "返工中",
  "建议停售",
  "建议恢复",
  "已关闭",
  "需财务处理"
];
const expectedSteps = [
  ["enter-housekeeping-maintenance-processing", "进入房务/维修处理"],
  ["dispatch-work-assignment", "派工作业"],
  ["update-work-progress", "执行与进度更新"],
  ["submit-work-completion", "完成作业"],
  ["verify-work-result", "验收确认"],
  ["output-outofservice-or-recovery-recommendation", "停售或恢复建议输出"],
  ["submit-expense-intent", "费用意向与财务交接"]
];
const expectedCommands = [
  "Dorm.ServiceWorkCaseDraftStart",
  "Dorm.HousekeepingTaskCreate",
  "Dorm.MaintenanceTaskCreate",
  "Dorm.InspectionTaskCreate",
  "Dorm.OutOfServiceRequestDraftStart",
  "Dorm.WorkAssignmentDispatch",
  "Dorm.WorkProgressUpdate",
  "Dorm.WorkCompletionSubmit",
  "Dorm.WorkVerificationConfirm",
  "Dorm.WorkReworkRequest",
  "Dorm.OutOfServiceOrRecoveryRecommendationCreate",
  "Dorm.ExpenseIntentSubmit",
  "Dorm.TaskEvidenceSupplement",
  "Dorm.ServiceWorkCorrectionRequest"
];
const expectedInputs = [
  "运营阻断摘要",
  "阻断原因",
  "预计恢复时间",
  "在住服务请求",
  "服务请求摘要",
  "异常摘要",
  "退房待恢复请求",
  "资源待恢复请求",
  "取消释放资源摘要",
  "库存释放请求",
  "房间/床位",
  "影响范围",
  "证据摘要",
  "只读对象引用"
];
const expectedOutputs = [
  "房务/维修完成摘要",
  "验收摘要",
  "停售建议",
  "恢复运营建议",
  "费用意向",
  "作业证据摘要",
  "状态历史",
  "只读对象引用"
];
const forbiddenUserInput = [
  "taskId",
  "workItemId",
  "roomId",
  "bedId",
  "stayId",
  "serviceRequestId",
  "serviceWorkCaseId",
  "workAssignmentId",
  "expenseIntentId",
  "ledgerEntryId",
  "reservationId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenWrites = [
  "RoomOperationStatus=可运营",
  "Reservation",
  "Stay",
  "Payment",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction"
];
const expectedFailureCodes = [
  "no_legal_work_source",
  "missing_work_assignee",
  "missing_work_scope",
  "missing_source_summary",
  "completion_evidence_required",
  "completion_required_before_verification",
  "verification_failure_requires_rework",
  "unresolved_maintenance_recovery_forbidden",
  "direct_operational_restore_forbidden",
  "direct_expense_ledger_forbidden",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "duplicate_work_submission",
  "concurrent_work_conflict",
  "unauthorized_work_action",
  "confirmed_work_inline_edit_forbidden",
  "invalid_resource_scope",
  "out_of_service_reason_required",
  "recovery_recommendation_requires_resolution",
  "expense_evidence_required"
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
  version: "oam.dormitory-scenario11-housekeeping-maintenance-outofservice-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.workStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 11 housekeeping maintenance out-of-service authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 11 housekeeping maintenance out-of-service authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const names = (packageIndex.scenarioPackageOrder ?? []).slice(0, 11).map((item) => item.nameZh);
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
    "房务、维修与停售协同"
  ], "first eleven package names");
  const eleventh = byNo.get(11);
  if (!eleventh) return fail("package index missing package 11.");
  if (eleventh.nameZh !== "房务、维修与停售协同") fail("package 11 name must be 房务、维修与停售协同.");
  assertArray(eleventh.upstreamPackages, [2, 8, 9, 10], "package 11 upstream packages");
  assertArray(eleventh.handoffInputs, expectedInputs, "package 11 handoff inputs");
  assertArray(eleventh.handoffOutputs, expectedOutputs, "package 11 handoff outputs");
  for (const forbidden of forbiddenWrites.concat(["已可运营", "已可预订", "已入账", "已退款"])) {
    if (!(eleventh.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 11 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 11 Source.");
  for (const oldExpression of ["service-task", "maintenance", "resource-saleability", "RoomInspectionConfirm"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 11 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 11 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 11 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 11 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-authority.mjs") fail("scenario 11 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 11 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 11 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 11 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario11-housekeeping-maintenance-outofservice-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 11 || scenario.scenarioId !== "lodging.housekeeping-maintenance-outofservice" || scenario.nameZh !== "房务、维修与停售协同") fail("scenario package 11 identity invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 11 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 11 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [2, 8, 9, 10], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 11 must not write back upstream.");
  assertArray(scenario.downstream?.handoffOutputs, expectedOutputs, "scenario downstream handoff outputs");
  const downstreamText = JSON.stringify(scenario.downstream ?? {});
  for (const required of ["场景包 2", "finance-gate", "支出治理", "经营看板与复盘"]) {
    if (!downstreamText.includes(required)) fail(`scenario 11 downstream must include ${required}.`);
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.workStatusOptions, expectedStatuses, "scenario work status options");
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["运营状态由场景包 2 确认", "在住服务由场景包 8 发起", "退房待恢复由场景包 9 发起", "验收通过不等于可运营", "维修费用意向不等于账务成本"]) {
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
  for (const expected of ["serviceWorkCaseRef", "sourceScenarioRef", "resourceRef", "sourceRequestRef", "workAssignmentRef", "workCompletionRef", "workVerificationRef", "recommendationRef", "expenseIntentRef"]) {
    if (!(scenario.fields?.systemGenerated ?? []).includes(expected)) fail(`system generated field missing ${expected}.`);
  }
  assertArray(scenario.fields?.forbiddenUserInputFields, forbiddenUserInput, "forbidden user input fields");
  const fieldText = JSON.stringify(scenario.fields ?? {});
  for (const required of ["upstreamReadonly", "systemCalculated", "financeGate", "301 房间退房后保洁待验收", "301-02 床位维修中"]) {
    if (!fieldText.includes(required)) fail(`fields missing ${required}.`);
  }
}

function checkCrud() {
  if (scenario.crudRules?.draftEditable !== true) fail("draft must be editable.");
  if (scenario.crudRules?.confirmedWorkInlineEditAllowed !== false) fail("confirmed work inline edit must be forbidden.");
  if (scenario.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("readonly surfaces must not write business facts.");
  for (const surface of ["查询", "搜索", "列表", "看板", "报表"]) {
    if (!(scenario.crudRules?.readOnlySurfacesZh ?? []).includes(surface)) fail(`CRUD readonly surfaces missing ${surface}.`);
  }
}

function checkCommandsAndFailures() {
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "command list");
  for (const command of scenario.commands ?? []) {
    if ((command.writesObjects ?? []).some((item) => forbiddenWrites.includes(item))) {
      fail(`${command.commandId} must not write operation status, reservation, stay, payment, refund or ledger.`);
    }
  }
  assertArray((scenario.failureSemantics ?? []).map((item) => item.failureCode), expectedFailureCodes, "failure codes");
  for (const failure of scenario.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  const rule = scenario.housekeepingMaintenanceInvariantRule ?? {};
  for (const key of [
    "legalSourceRequired",
    "sourceSummaryRequired",
    "resourceScopeRequired",
    "roomScopeAffectsWholeRoom",
    "bedScopeAffectsOnlyBed",
    "operationStatusOwnedByScenario2",
    "completionEvidenceRequired",
    "verificationAuthorizedRequired",
    "completionRequiredBeforeVerification",
    "failedVerificationCreatesReworkOrException",
    "unresolvedMaintenanceBlocksRecoveryRecommendation",
    "outOfServiceRecommendationOnly",
    "recoveryRecommendationRequiresResolvedBlocks",
    "expenseIntentOnly",
    "financeGateHandlesExpenseTruth",
    "appendOnlyProgressHistory",
    "failureNoSideEffects",
    "querySearchListBoardReportReadonly"
  ]) {
    if (rule[key] !== true) fail(`housekeepingMaintenanceInvariantRule.${key} must be true.`);
  }
  const invariantText = JSON.stringify(scenario.invariants ?? []);
  for (const required of ["合法来源", "房间级作业影响整房", "床位级作业只影响指定床位", "缺完成证据不得提交验收", "不得直接改为可运营", "不得直接写账务成本", "不得刷新错误 Projection"]) {
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
    boundary.businessRuntimeMayWriteOperationStatus !== false ||
    boundary.businessRuntimeMayWriteReservation !== false ||
    boundary.businessRuntimeMayWriteStay !== false ||
    boundary.businessRuntimeMayWritePaymentRefund !== false ||
    boundary.businessRuntimeMayWriteLedger !== false ||
    boundary.financeGateMayConsumeExpenseIntentOnly !== true ||
    boundary.scenario2MayConsumeRecommendationOnly !== true ||
    boundary.failurePathBusinessSideEffectsAllowed !== false ||
    boundary.successMayWriteWorkFactsAndRequestsOnly !== true) {
    fail("runtime/finance/scenario2 consumption boundary mismatch.");
  }
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must be readonly.");
  for (const term of ["已可预订", "已可运营", "已入账", "已退款", "final GO", "生产发布", "service-task", "maintenance", "resource-saleability"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(term)) fail(`surface forbidden visible terms missing ${term}.`);
  }
  assertArray(scenario.readSideOutputs, expectedOutputs, "read side outputs");
  if ((scenario.positiveBrowserTestPlan ?? []).length !== 13) fail("positive browser test plan must contain 13 steps.");
  if ((scenario.negativeBrowserTestPlan ?? []).length !== 12) fail("negative browser test plan must contain 12 cases.");
}

function checkNoGo() {
  if (scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 11 must keep production/business/final GO closed.");
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
