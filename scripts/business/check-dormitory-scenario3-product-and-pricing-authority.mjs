import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-authority-result.json";
const failures = [];
const expectedObjects = [
  "AccommodationProduct",
  "SellableUnit",
  "ProductResourceBinding",
  "RatePlan",
  "RateRule",
  "PriceCalendar",
  "PriceVersion",
  "PriceEvidence",
  "PriceStatusHistory"
];
const expectedStatuses = [
  "价格草稿",
  "待审核",
  "已生效",
  "已停用",
  "已过期",
  "已作废",
  "需补充证据"
];
const expectedSteps = [
  ["select-operable-resource", "选择可运营房源"],
  ["define-accommodation-product", "定义住宿商品"],
  ["configure-rate-plan", "配置价格方案"],
  ["configure-price-calendar", "配置适用日期和规则"],
  ["review-and-activate-price", "审核与生效确认"],
  ["price-maintenance", "价格维护"]
];
const expectedCommands = [
  "Dorm.AccommodationProductConfirm",
  "Dorm.RatePlanDefinitionConfirm",
  "Dorm.PriceVersionActivate",
  "Dorm.PriceDisable",
  "Dorm.PriceDraftVoid"
];
const forbiddenUserInput = [
  "productId",
  "ratePlanId",
  "priceVersionId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenActionUserInput = [
  "saveDraft",
  "submitReview",
  "activatePrice",
  "backToEdit"
];
const forbiddenRuntimeWrites = [
  "Quote",
  "Reservation",
  "InventoryHold",
  "Stay",
  "Payment",
  "Deposit",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction"
];
const expectedHandoffOutputs = [
  "商品摘要",
  "价格方案摘要",
  "价格日历摘要",
  "价格版本历史",
  "可否进入询价报价",
  "证据摘要",
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
  version: "oam.dormitory-scenario3-product-and-pricing-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.priceStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 3 product and pricing authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 3 product and pricing authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const third = byNo.get(3);
  if (!third) {
    fail("package index missing package 3.");
    return;
  }
  if (third.nameZh !== "住宿商品与价格") fail("package 3 name must be 住宿商品与价格.");
  assertArray(third.upstreamPackages, [1, 2], "package 3 upstream packages");
  assertArray(third.downstreamPackages, [4], "package 3 downstream packages");
  assertArray(third.handoffInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "阻断原因", "可否进入价格维护", "证据摘要", "状态历史", "只读对象引用"], "package 3 handoff inputs");
  assertArray(third.handoffOutputs, expectedHandoffOutputs, "package 3 handoff outputs");
  for (const forbidden of ["报价", "库存锁定", "预订", "入住", "收款", "押金", "退款", "账务", "已预订", "已锁定"]) {
    if (!(third.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 3 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 3 Source.");
  if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes("RatePlanConfirm")) {
    fail("RatePlanConfirm must be forbidden as new business source.");
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 3 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 3 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 3 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario3-product-and-pricing-authority.mjs") fail("scenario 3 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 3 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 3 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 3 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario3-product-and-pricing-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario3.ProductAndPricing") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 3 || scenario.nameZh !== "住宿商品与价格") fail("scenario package 3 name invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 3 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 3 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [1, 2], "scenario upstream packages");
  if (scenario.downstream?.allowedConsumerPackageNo !== 4) fail("scenario 3 downstream must be package 4 only.");
  assertArray(scenario.upstream?.requiredReadonlyInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "阻断原因", "可否进入价格维护", "证据摘要", "状态历史", "只读对象引用"], "scenario upstream inputs");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.priceStatusOptions, expectedStatuses, "scenario price status options");
  for (const object of scenario.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 3) fail(`${object.objectName} must be owned by scenario package 3.`);
    for (const required of ["currentState", "versionHistory", "evidenceHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  if (!JSON.stringify(scenario.stateLayering ?? {}).includes("可运营来自场景包 2")) fail("state layering must place 可运营 in scenario 2.");
  if (!JSON.stringify(scenario.stateLayering ?? {}).includes("可报价来自场景包 4")) fail("state layering must place 可报价 in scenario 4.");
  if (!JSON.stringify(scenario.stateLayering ?? {}).includes("可锁定和已预订来自场景包 5")) fail("state layering must place lock/reservation in scenario 5.");
}

function checkStepsAndFields() {
  if ((scenario.steps ?? []).length !== 6) fail("scenario must define exactly 6 business steps.");
  for (const [index, [stepId, nameZh]] of expectedSteps.entries()) {
    const step = scenario.steps?.[index];
    if (!step) continue;
    if (step.stepId !== stepId || step.nameZh !== nameZh) fail(`step ${index + 1} identity mismatch.`);
  }
  const selectStep = scenario.steps?.[0] ?? {};
  for (const field of ["resourceRef", "operationStatusSnapshotRef", "sourceScenarioRef", "resourceScope"]) {
    if (!(selectStep.systemGeneratedFields ?? []).includes(field)) fail(`selection step missing system field ${field}.`);
  }
  const productStep = scenario.steps?.[1] ?? {};
  for (const field of ["productName", "productDescription", "targetGuestType", "stayRuleSummary"]) {
    if (!(productStep.userFilledFields ?? []).includes(field)) fail(`product step missing user-filled field ${field}.`);
  }
  const rateStep = scenario.steps?.[2] ?? {};
  for (const field of ["ratePlanName", "basePrice", "currency", "pricingPeriod"]) {
    if (!(rateStep.userFilledFields ?? []).includes(field)) fail(`rate step missing user-filled field ${field}.`);
  }
  const calendarStep = scenario.steps?.[3] ?? {};
  for (const field of ["dateRangeConflict", "priceCalendar", "overridesExistingPrice"]) {
    if (!(calendarStep.systemCalculatedFields ?? []).includes(field)) fail(`calendar step missing calculated field ${field}.`);
  }
  for (const internal of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`forbidden user input missing ${internal}.`);
    for (const fieldClass of ["userFilled", "userSelected"]) {
      if ((scenario.fields?.[fieldClass] ?? []).includes(internal)) fail(`${internal} must not be ${fieldClass}.`);
    }
  }
  for (const action of forbiddenActionUserInput) {
    for (const [stepIndex, step] of (scenario.steps ?? []).entries()) {
      if ((step.userFilledFields ?? []).includes(action)) fail(`step ${stepIndex + 1} must not expose action ${action} as user-filled input.`);
      if ((step.userSelectedFields ?? []).includes(action)) fail(`step ${stepIndex + 1} must not expose action ${action} as user-selected input.`);
    }
    if ((scenario.fields?.userFilled ?? []).includes(action)) fail(`action ${action} must not be a global user-filled field.`);
    if ((scenario.fields?.userSelected ?? []).includes(action)) fail(`action ${action} must not be a global user-selected field.`);
  }
}

function checkCrud() {
  assertArray(scenario.crudRules?.create?.buttonsZh, ["新建住宿商品", "新建价格方案", "新建价格版本"], "create buttons");
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
    "upstream_operable_required",
    "operation_blocked_for_pricing",
    "product_resource_binding_required",
    "product_name_not_binding",
    "price_value_invalid",
    "currency_required",
    "pricing_period_required",
    "date_range_invalid",
    "price_date_conflict",
    "deposit_payment_forbidden",
    "price_evidence_missing",
    "forged_internal_reference",
    "duplicate_submission",
    "concurrent_price_version_conflict",
    "readonly_result_write_attempt",
    "post_effective_inline_edit_forbidden",
    "cross_scenario_quote_reservation_forbidden"
  ]) {
    const item = failureByCode.get(code);
    if (!item) fail(`failure semantics missing ${code}.`);
    if (item?.sideEffectsAllowed !== false) fail(`${code} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  for (const required of [
    "只有场景包 2 输出为可运营且未被维修、停售、暂停开放或异常阻断的房间/床位，才能绑定商品。",
    "一个商品必须明确售卖单位：整房、单床位、床位组、包月、包周或按晚。",
    "价格必须有币种、计价周期、适用日期、适用资源、版本号、生效时间和停用时间。",
    "已生效价格不得原地覆盖；价格调整必须创建新版本。",
    "相同商品、相同日期范围、相同渠道、相同客户类型下不得存在互相冲突的生效价格。",
    "确认失败不得刷新报价可用读模型。",
    "查询、搜索、列表、看板、报表永远只读，不得写业务事实。"
  ]) {
    if (!(scenario.invariants ?? []).includes(required)) fail(`invariant missing: ${required}`);
  }
  if (scenario.priceConflictRule?.effectiveOverlapAllowed !== false || scenario.priceConflictRule?.failureCode !== "price_date_conflict") {
    fail("price conflict rule must block overlapping effective prices.");
  }
  for (const stepId of expectedSteps.map(([id]) => id)) {
    if (!scenario.evidence?.requiredEvidenceByStep?.[stepId]?.length) fail(`evidence missing for ${stepId}.`);
  }
  if (scenario.evidence?.noSideEffectsProofRequired !== true || scenario.evidence?.screenshotAnalysisRequired !== true) {
    fail("evidence policy must require screenshots and no-side-effects proof.");
  }
  assertArray(scenario.readSideOutputs, expectedHandoffOutputs, "read side outputs");
}

function checkSurfaceBoundary() {
  if (!String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must be readonly.");
  if (!String(scenario.surfaceNavigation?.todayZh ?? "").includes("被动任务")) fail("today must show passive tasks.");
  if (!String(scenario.surfaceNavigation?.mineZh ?? "").includes("草稿")) fail("mine must keep drafts/follow-ups.");
  for (const term of ["已预订", "已锁定", "已入住", "已收款", "final GO", "RatePlanConfirm"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(term)) fail(`surface forbidden terms missing ${term}.`);
  }
  if ((scenario.positiveBrowserTestPlan ?? []).length < 10) fail("positive browser plan must cover at least 10 steps.");
  if ((scenario.negativeBrowserTestPlan ?? []).length < 13) fail("negative browser plan must cover at least 13 failures.");
}

function checkNoGo() {
  if (scenario.NO_GO?.businessFeatureDevelopmentAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 3 NO_GO flags must remain closed.");
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

function assertArray(actual, expected, label) {
  const left = JSON.stringify([...(actual ?? [])].sort());
  const right = JSON.stringify([...expected].sort());
  if (left !== right) fail(`${label} mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual ?? [])}.`);
}

function fail(message) {
  failures.push(message);
}
