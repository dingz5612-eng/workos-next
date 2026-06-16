import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario2-resource-operation-status-authority-result.json";
const failures = [];
const expectedObjects = [
  "OperationResource",
  "RoomOperationStatus",
  "BedOperationStatus",
  "OperationInspection",
  "OperationBlocker",
  "OperationStatusChange",
  "OperationRestore",
  "OperationEvidence",
  "StatusHistory"
];
const expectedStatuses = [
  "可运营",
  "暂不可运营",
  "部分不可运营",
  "暂停开放",
  "维修中",
  "保洁中",
  "停售",
  "异常待处理",
  "待复查",
  "已恢复"
];
const expectedSteps = [
  ["select-base-ready-resource", "选择已基础就绪房源"],
  ["operation-inspection", "运营检查"],
  ["set-operation-status", "设置运营状态"],
  ["impact-confirmation", "影响确认"],
  ["daily-status-maintenance", "日常状态维护"],
  ["restore-operation", "恢复运营"]
];
const expectedCommands = [
  "Dorm.OperationInspectionConfirm",
  "Dorm.OperationStatusChangeConfirm",
  "Dorm.OperationBlockerUpdate",
  "Dorm.OperationRestoreConfirm"
];
const forbiddenUserInput = [
  "operationStatusId",
  "inspectionId",
  "roomId",
  "bedId",
  "workItemId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenRuntimeWrites = ["价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务"];
const expectedHandoffOutputs = [
  "房间/床位运营状态摘要",
  "阻断原因",
  "预计恢复时间",
  "可否进入价格维护",
  "证据摘要",
  "状态历史",
  "只读对象引用"
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
checkSurfaceBoundary();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario2-resource-operation-status-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.operationStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 2 resource operation status authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 2 resource operation status authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const second = byNo.get(2);
  if (!second) {
    fail("package index missing package 2.");
    return;
  }
  if (second.nameZh !== "房源运营就绪与状态维护") fail("package 2 name must be 房源运营就绪与状态维护.");
  if (JSON.stringify(second.upstreamPackages ?? []) !== JSON.stringify([1])) fail("package 2 upstream must be package 1 only.");
  if (JSON.stringify(second.downstreamPackages ?? []) !== JSON.stringify([3])) fail("package 2 downstream must be package 3 only.");
  assertArray(second.handoffInputs, ["房间摘要", "床位组摘要", "基础就绪摘要", "证据摘要", "状态历史", "只读对象引用"], "package 2 handoff inputs");
  assertArray(second.handoffOutputs, expectedHandoffOutputs, "package 2 handoff outputs");
  for (const forbidden of forbiddenRuntimeWrites.concat(["可报价", "可预订"])) {
    if (!(second.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 2 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 2 Source.");
  const third = byNo.get(3);
  if (!(third?.upstreamPackages ?? []).includes(2)) fail("package 3 must read package 2 upstream.");
  if ((third?.upstreamPackages ?? []).some((packageNo) => ![1, 2].includes(packageNo))) fail("package 3 upstream may only include package 1 readonly basics and package 2 operation summaries.");
  const isolation = packageIndex.oldProjectExpressionIsolation ?? {};
  for (const oldExpression of ["resource-saleability", "golden-chain", "lead-reservation"]) {
    if (!(isolation.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) fail(`${oldExpression} must remain migration reference only.`);
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 2 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 2 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 2 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario2-resource-operation-status-authority.mjs") fail("scenario 2 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 2 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 2 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 2 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario2-resource-operation-status-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario2.ResourceOperationStatus") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 2 || scenario.nameZh !== "房源运营就绪与状态维护") fail("scenario package 2 name invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 2 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 2 must reference scenario 1 benchmark as method contract.");
  if (scenario.upstream?.allowedSourcePackageNo !== 1) fail("scenario 2 upstream must be package 1 only.");
  if (scenario.downstream?.allowedConsumerPackageNo !== 3) fail("scenario 2 downstream must be package 3 only.");
  assertArray(scenario.upstream?.requiredReadonlyInputs, ["房间摘要", "床位组摘要", "基础就绪摘要", "证据摘要", "状态历史", "只读对象引用"], "scenario upstream inputs");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.operationStatusOptions, expectedStatuses, "scenario operation status options");
  for (const object of scenario.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 2) fail(`${object.objectName} must be owned by scenario package 2.`);
    for (const required of ["currentState", "statusHistory", "evidenceHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const operationResource = (scenario.objects ?? []).find((item) => item.objectName === "OperationResource");
  if (!String(operationResource?.descriptionZh ?? "").includes("不拥有房间建档或床位建档事实")) fail("OperationResource must not own room/bed filing facts.");
  if (!JSON.stringify(scenario.statusOwnership ?? {}).includes("基础就绪不等于运营状态")) fail("status ownership must separate basic readiness and operation.");
  if (!JSON.stringify(scenario.statusOwnership ?? {}).includes("运营状态不等于价格状态")) fail("status ownership must separate operation and price.");
}

function checkStepsAndFields() {
  if ((scenario.steps ?? []).length !== 6) fail("scenario must define exactly 6 business steps.");
  for (const [index, [stepId, nameZh]] of expectedSteps.entries()) {
    const step = scenario.steps?.[index];
    if (!step) continue;
    if (step.stepId !== stepId || step.nameZh !== nameZh) fail(`step ${index + 1} identity mismatch.`);
  }
  const selectStep = scenario.steps?.[0] ?? {};
  for (const field of ["operationResourceRef", "resourceScope", "baseReadySnapshotRef", "roomStableRef", "bedSetVersion", "sourceScenarioRef"]) {
    if (!(selectStep.systemGeneratedFields ?? []).includes(field)) fail(`selection step missing system field ${field}.`);
  }
  const inspectionStep = scenario.steps?.[1] ?? {};
  for (const field of ["cleaningInspectionResult", "maintenanceInspectionResult", "safetyInspectionResult", "facilityInspectionResult"]) {
    if (!(inspectionStep.userFilledFields ?? []).includes(field)) fail(`inspection step missing user-filled field ${field}.`);
  }
  const statusStep = scenario.steps?.[2] ?? {};
  if (!(statusStep.userSelectedFields ?? []).includes("newOperationStatus")) fail("status step must select newOperationStatus.");
  if (!(statusStep.systemGeneratedFields ?? []).includes("blocksPriceFlag")) fail("status step must calculate blocksPriceFlag.");
  const restoreStep = scenario.steps?.[5] ?? {};
  const labels = restoreStep.conclusionOptions?.map((item) => item.labelZh) ?? [];
  if (JSON.stringify(labels) !== JSON.stringify(["恢复为可运营", "恢复为部分可运营", "仍需复查"])) fail("restore conclusion labels invalid.");
  for (const internal of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`forbidden user input missing ${internal}.`);
    for (const fieldClass of ["userFilled", "userSelected"]) {
      if ((scenario.fields?.[fieldClass] ?? []).includes(internal)) fail(`${internal} must not be ${fieldClass}.`);
    }
  }
}

function checkCrud() {
  if (scenario.crudRules?.create?.buttonZh !== "发起运营检查") fail("create button must be 发起运营检查.");
  for (const button of ["发起状态变更", "发起恢复运营"]) {
    if (!(scenario.crudRules?.create?.alternateButtonsZh ?? []).includes(button)) fail(`create alternate button missing ${button}.`);
  }
  if (scenario.crudRules?.draftEdit?.allowed !== true) fail("draft edit must be allowed.");
  if (scenario.crudRules?.confirmedFactEdit?.allowed !== false) fail("confirmed inline edit must be forbidden.");
  if (scenario.crudRules?.delete?.physicalDeleteConfirmedFactAllowed !== false) fail("confirmed fact physical delete must be forbidden.");
  if (scenario.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("query/search/list/board/report must be readonly.");
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
  for (const code of [
    "upstream_basic_readiness_missing",
    "inspection_required",
    "operation_evidence_missing",
    "unclosed_blocker_for_operable",
    "invalid_status_transition",
    "concurrent_status_conflict",
    "forged_internal_reference",
    "duplicate_submission",
    "readonly_result_write_attempt",
    "post_confirm_inline_edit_forbidden",
    "cross_scenario_price_reservation_forbidden",
    "restore_without_recheck_pass"
  ]) {
    const item = failureByCode.get(code);
    if (!item) fail(`failure semantics missing ${code}.`);
    if (item?.sideEffectsAllowed !== false) fail(`${code} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  for (const required of [
    "同一时间每个房间只能有一个当前运营状态。",
    "同一时间每个床位只能有一个当前运营状态。",
    "房间级运营状态影响整个房间及其全部床位。",
    "床位级运营状态只影响该床位。",
    "房间为维修中、停售、暂停开放或异常待处理时，必须阻断该房间全部床位进入价格、报价和预订。",
    "单个床位为维修中时，只阻断该床位进入价格、报价和预订。",
    "恢复运营必须关闭全部相关阻断原因，且必须有复查通过证据。",
    "确认失败不得写 CommandSubmission、DomainEvent、Outbox、Projection、Lens、Search、Dashboard、Ledger。",
    "查询、搜索、列表、看板、报表永远只读，不得写业务事实。"
  ]) {
    if (!(scenario.invariants ?? []).includes(required)) fail(`invariant missing ${required}`);
  }
  for (const stepId of expectedSteps.map(([stepId]) => stepId)) {
    if (!Array.isArray(scenario.evidence?.requiredEvidenceByStep?.[stepId]) || scenario.evidence.requiredEvidenceByStep[stepId].length === 0) {
      fail(`required evidence missing for ${stepId}.`);
    }
  }
  if (scenario.evidence?.noSideEffectsProofRequired !== true || scenario.evidence?.screenshotAnalysisRequired !== true) {
    fail("evidence must require no-side-effects proof and screenshot analysis.");
  }
  assertArray(scenario.readSideOutputs, expectedHandoffOutputs, "read side outputs");
  const runtimeBoundary = scenario.runtimeConsumptionBoundary ?? {};
  if (runtimeBoundary.runtimeMayReadGeneratedOnly !== true || runtimeBoundary.runtimeMayHardcodeBusinessRules !== false) {
    fail("runtime boundary must consume generated only and forbid hardcoded business rules.");
  }
  for (const target of ["CommandSubmission", "DomainEvent", "Outbox", "Projection", "Lens", "Search", "Dashboard", "Ledger"]) {
    if (!(runtimeBoundary.failureNoSideEffectTargets ?? []).includes(target)) fail(`runtime no-side-effect targets missing ${target}.`);
  }
}

function checkSurfaceBoundary() {
  const nav = scenario.surfaceNavigation ?? {};
  for (const page of ["房源运营状态列表", "房源运营状态详情", "运营检查页", "状态变更确认页", "阻断原因详情页", "恢复运营页", "状态历史页", "纠错/作废入口"]) {
    if (!(nav.pages ?? []).includes(page)) fail(`surface navigation missing page ${page}.`);
  }
  if (!String(nav.searchZh ?? "").includes("只读")) fail("search entry must be readonly.");
  if (!String(nav.todayZh ?? "").includes("今天需要处理的被动任务")) fail("today entry must only show today's passive tasks.");
  const buttonRows = new Map((nav.buttonByState ?? []).map((item) => [item.state, item.buttonsZh]));
  if (!buttonRows.get("unchecked")?.includes("开始运营检查")) fail("unchecked state must show 开始运营检查.");
  if (!buttonRows.get("operable")?.includes("登记维修")) fail("operable state must show 登记维修.");
  if (!buttonRows.get("maintenance")?.includes("申请恢复运营")) fail("maintenance state must show 申请恢复运营.");
  if (!buttonRows.get("stopped")?.includes("申请恢复")) fail("stopped state must show 申请恢复.");
  if (!buttonRows.get("draft")?.includes("保存草稿")) fail("draft state must show 保存草稿.");
  for (const forbidden of ["可报价", "可预订", "已上线", "生产发布", "final GO", "resource-saleability", "lead-reservation", "golden-chain"]) {
    if (!(nav.forbiddenUserVisibleTermsZh ?? []).includes(forbidden)) fail(`surface forbidden term missing ${forbidden}.`);
  }
}

function checkNoGo() {
  const noGo = scenario.NO_GO ?? {};
  if (noGo.productionConfirmAllowed !== false || noGo.businessGoLiveAllowed !== false || noGo.releaseAuthority !== false || noGo.finalGoNoGo !== "NO_GO") {
    fail("scenario NO_GO must keep production, go-live, release and final GO closed.");
  }
  const finalSafety = packageIndex.finalSafety ?? {};
  if (finalSafety.productionConfirmAllowed !== false || finalSafety.releaseAuthority !== false || finalSafety.finalGoNoGo !== "NO_GO") {
    fail("package index final safety must keep NO_GO.");
  }
}

function assertArray(actual, expected, label) {
  const left = JSON.stringify([...(actual ?? [])].sort());
  const right = JSON.stringify([...expected].sort());
  if (left !== right) fail(`${label} mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual ?? [])}.`);
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
