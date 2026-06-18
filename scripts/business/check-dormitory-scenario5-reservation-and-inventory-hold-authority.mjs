import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-authority-result.json";
const failures = [];
const expectedObjects = [
  "BookingRequest",
  "AvailabilityCheck",
  "AvailabilitySnapshot",
  "InventoryHold",
  "Reservation",
  "ReservationGuest",
  "ReservationResourceBinding",
  "ReservationPriceSnapshot",
  "ReservationPolicySnapshot",
  "ReservationConfirmation",
  "ReservationEvidence",
  "ReservationStatusHistory"
];
const expectedStatuses = [
  "待锁定",
  "锁定中",
  "已锁定",
  "锁定过期",
  "待确认预订",
  "已预订",
  "预订确认失败",
  "转入住准备"
];
const expectedSteps = [
  ["enter-reservation-preparation", "进入预订确认"],
  ["review-available-resource", "复核可订资源"],
  ["create-inventory-hold", "锁定库存"],
  ["confirm-reservation-information", "确认预订信息"],
  ["confirm-reservation", "生成预订"],
  ["reservation-result-and-checkin-preparation", "预订结果与下游准备"]
];
const expectedCommands = [
  "Dorm.BookingPreparationStart",
  "Dorm.AvailabilityRecheck",
  "Dorm.InventoryHoldCreate",
  "Dorm.InventoryHoldRelease",
  "Dorm.InventoryHoldExpire",
  "Dorm.ReservationDraftConfirm",
  "Dorm.ReservationConfirm",
  "Dorm.ReservationSummaryOutput"
];
const expectedUpstreamInputs = [
  "房间摘要",
  "床位组摘要",
  "房间/床位运营状态摘要",
  "商品摘要",
  "价格方案摘要",
  "价格版本历史",
  "询价摘要",
  "客户需求摘要",
  "报价单摘要",
  "报价版本",
  "价格快照",
  "报价有效期",
  "客户选择意向",
  "证据摘要",
  "状态历史",
  "只读对象引用"
];
const expectedHandoffOutputs = [
  "预订确认摘要",
  "预订号",
  "客户信息",
  "日期范围",
  "人数",
  "房间/床位",
  "价格快照",
  "库存锁定历史",
  "预订状态",
  "证据摘要",
  "只读对象引用"
];
const forbiddenUserInput = [
  "bookingRequestId",
  "inventoryHoldId",
  "holdId",
  "reservationId",
  "reservationNo",
  "quoteId",
  "productId",
  "ratePlanId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenRuntimeWrites = [
  "Stay",
  "CheckIn",
  "Payment",
  "Deposit",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction"
];
const expectedFailureCodes = [
  "quote_expired_for_booking",
  "quote_price_snapshot_required",
  "contact_required",
  "date_range_invalid",
  "guest_count_invalid",
  "operation_blocked_for_booking",
  "effective_price_required",
  "resource_unavailable_or_occupied",
  "resource_already_locked",
  "resource_already_reserved",
  "resource_already_stayed",
  "hold_until_required",
  "concurrent_inventory_hold_conflict",
  "inventory_hold_required",
  "hold_expired_for_reservation",
  "price_snapshot_mismatch",
  "reservation_no_user_input_forbidden",
  "forged_internal_reference",
  "duplicate_submission",
  "concurrent_reservation_version_conflict",
  "readonly_result_write_attempt",
  "cross_scenario_checkin_payment_forbidden",
  "finance_fact_forbidden",
  "reservation_evidence_missing"
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
  version: "oam.dormitory-scenario5-reservation-and-inventory-hold-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.reservationStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 5 reservation and inventory hold authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 5 reservation and inventory hold authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const fifth = byNo.get(5);
  if (!fifth) {
    fail("package index missing package 5.");
    return;
  }
  if (fifth.nameZh !== "预订与库存锁定") fail("package 5 name must be 预订与库存锁定.");
  assertArray(fifth.upstreamPackages, [1, 2, 3, 4], "package 5 upstream packages");
  assertArray(fifth.downstreamPackages, [6], "package 5 downstream packages");
  assertArray(fifth.handoffInputs, expectedUpstreamInputs, "package 5 handoff inputs");
  assertArray(fifth.handoffOutputs, expectedHandoffOutputs, "package 5 handoff outputs");
  for (const forbidden of ["入住", "已入住", "收款", "已收款", "押金", "押金已收", "退款", "账务", "LedgerEntry", "LedgerTransaction"]) {
    if (!(fifth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 5 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 5 Source.");
  for (const oldExpression of ["lead-reservation", "reservationCreate", "reservationConvert", "check-in"]) {
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 5 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 5 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 5 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-authority.mjs") fail("scenario 5 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 5 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 5 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 5 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario5-reservation-and-inventory-hold-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario5.ReservationAndInventoryHold") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 5 || scenario.nameZh !== "预订与库存锁定") fail("scenario package 5 name invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 5 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 5 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [1, 2, 3, 4], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedUpstreamInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 5 must not write back upstream.");
  if (scenario.downstream?.allowedConsumerPackageNo !== 6) fail("scenario 5 downstream must be package 6 only.");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
  if (scenario.downstream?.downstreamRecheckRuleZh?.includes("重新核验入住所需证件、协议、押金/收款规则") !== true) {
    fail("scenario 5 downstream must require check-in package to recheck documents, agreement and payment/deposit rules.");
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.reservationStatusOptions, expectedStatuses, "scenario reservation status options");
  for (const object of scenario.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 5) fail(`${object.objectName} must be owned by scenario package 5.`);
    for (const required of ["currentState", "versionHistory", "evidenceHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["报价已发送", "可入住", "场景包 5 不得产生已入住", "场景包 5 不得产生已收款", "场景包 5 不得产生押金已收"]) {
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
  const entryStep = scenario.steps?.[0] ?? {};
  for (const field of ["bookingRequestRef", "quoteRef", "quoteVersionRef", "quoteSnapshotRef", "sourceScenarioRef"]) {
    if (!(entryStep.systemGeneratedFields ?? []).includes(field)) fail(`entry step missing system field ${field}.`);
  }
  const availabilityStep = scenario.steps?.[1] ?? {};
  for (const field of ["availabilitySnapshotRef", "resourceRef", "dateRangeRef", "availabilityVersion"]) {
    if (!(availabilityStep.systemGeneratedFields ?? []).includes(field)) fail(`availability step missing system field ${field}.`);
  }
  const holdStep = scenario.steps?.[2] ?? {};
  for (const field of ["inventoryHoldRef", "holdNo", "holdUntil", "holdVersion", "lockedResourceRefs"]) {
    if (!(holdStep.systemGeneratedFields ?? []).includes(field)) fail(`inventory hold step missing system field ${field}.`);
  }
  const reservationStep = scenario.steps?.[4] ?? {};
  for (const field of ["reservationRef", "reservationNo", "confirmedAt", "confirmedBy", "reservationStatus"]) {
    if (!(reservationStep.systemGeneratedFields ?? []).includes(field)) fail(`reservation confirm step missing generated field ${field}.`);
  }
  for (const internal of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`forbidden user input missing ${internal}.`);
    for (const fieldClass of ["userFilled", "userSelected"]) {
      if ((scenario.fields?.[fieldClass] ?? []).includes(internal)) fail(`${internal} must not be ${fieldClass}.`);
    }
  }
}

function checkCrud() {
  if (!String(scenario.crudRules?.createZh ?? "").includes("发起预订准备")) fail("create rule must use business actions.");
  if (scenario.crudRules?.draftEditable !== true) fail("draft edit must be allowed.");
  if (scenario.crudRules?.confirmedReservationInlineEditAllowed !== false) fail("confirmed reservation inline edit must be forbidden.");
  if (!String(scenario.crudRules?.deletePolicyZh ?? "").includes("不得物理删除已确认预订")) fail("delete rule must forbid physical deletion of confirmed reservations.");
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
    "库存锁定必须按资源和日期范围原子校验",
    "锁定必须有 holdUntil",
    "预订号由系统生成",
    "已预订不等于已入住",
    "已预订不等于已收款",
    "已预订不等于押金已收",
    "确认失败不得写 CommandSubmission",
    "查询、搜索、列表、看板、报表永远只读"
  ]) {
    if (!invariantText.includes(required)) fail(`invariant missing: ${required}`);
  }
  if (scenario.inventoryInvariantRule?.atomicResourceDateCheckRequired !== true ||
    scenario.inventoryInvariantRule?.holdUntilRequired !== true ||
    scenario.inventoryInvariantRule?.expiredHoldCannotConfirmReservation !== true ||
    scenario.inventoryInvariantRule?.reservationNoSystemGenerated !== true ||
    scenario.inventoryInvariantRule?.failureCodeForConcurrency !== "concurrent_inventory_hold_conflict") {
    fail("inventory invariant rule must enforce atomic check, holdUntil, expired hold block, generated reservationNo and concurrency failure code.");
  }
  for (const [stepId] of expectedSteps) {
    if (!scenario.evidence?.requiredEvidenceByStep?.[stepId]?.length) fail(`evidence missing for ${stepId}.`);
  }
  if (scenario.evidence?.noSideEffectsProofRequired !== true || scenario.evidence?.screenshotAnalysisRequired !== true) {
    fail("evidence policy must require screenshots and no-side-effects proof.");
  }
}

function checkSurfaceBoundary() {
  const surfaceText = JSON.stringify(scenario.surfaceNavigation ?? {});
  for (const page of ["预订准备列表", "可订资源复核页", "库存锁定页", "预订确认页", "预订结果页", "预订详情页", "锁定历史页", "预订状态历史页"]) {
    if (!surfaceText.includes(page)) fail(`surface navigation missing page ${page}.`);
  }
  for (const entry of ["今日", "工作项", "搜索", "我的"]) {
    if (!surfaceText.includes(entry)) fail(`surface navigation missing ${entry}.`);
  }
  for (const forbidden of ["已入住", "已收款", "押金已收", "退款", "final GO", "lead-reservation", "reservationCreate", "reservationConvert", "check-in"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(forbidden)) fail(`surface forbidden visible terms missing ${forbidden}.`);
  }
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("search surface must be readonly.");
  if (!String(scenario.surfaceNavigation?.mineZh ?? "").includes("草稿")) fail("mine entry must keep drafts/personal duties only.");
  const readOutputs = scenario.readSideOutputs ?? [];
  assertArray(readOutputs, expectedHandoffOutputs, "read side outputs");
  for (const forbidden of ["入住", "已入住", "收款", "已收款", "押金", "押金已收", "退款", "账务"]) {
    if (readOutputs.includes(forbidden)) fail(`read side outputs must not include ${forbidden}.`);
  }
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
