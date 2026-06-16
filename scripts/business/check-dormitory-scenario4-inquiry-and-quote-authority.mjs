import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-authority-result.json";
const failures = [];
const expectedObjects = [
  "Inquiry",
  "CustomerContact",
  "StayDemand",
  "QuoteOption",
  "Quote",
  "QuoteVersion",
  "QuotePriceSnapshot",
  "QuoteValidity",
  "QuoteDeliveryRecord",
  "QuoteEvidence",
  "FollowUpTask",
  "QuoteStatusHistory"
];
const expectedStatuses = [
  "询价草稿",
  "待补充需求",
  "可报价",
  "报价草稿",
  "已报价",
  "报价已发送",
  "客户待确认",
  "报价过期",
  "报价关闭",
  "转预订准备"
];
const expectedSteps = [
  ["register-customer-inquiry", "客户询价登记"],
  ["confirm-stay-demand", "填写入住需求"],
  ["select-quotable-product", "查看可报价商品"],
  ["generate-quote-draft", "生成报价草稿"],
  ["issue-and-send-quote", "确认并发送报价"],
  ["quote-follow-up-and-reservation-prep", "报价跟进与转预订准备"]
];
const expectedCommands = [
  "Dorm.InquiryRegister",
  "Dorm.StayDemandConfirm",
  "Dorm.QuoteDraftGenerate",
  "Dorm.QuoteVersionConfirm",
  "Dorm.QuoteSend",
  "Dorm.QuoteClose",
  "Dorm.RequoteCreate",
  "Dorm.ReservationPreparationStart"
];
const forbiddenUserInput = [
  "inquiryId",
  "customerId",
  "quoteId",
  "quoteVersionId",
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
  "InventoryHold",
  "Reservation",
  "Stay",
  "Payment",
  "Deposit",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction"
];
const expectedHandoffOutputs = [
  "询价摘要",
  "客户需求摘要",
  "报价单摘要",
  "报价版本",
  "价格快照",
  "报价有效期",
  "客户反馈",
  "转预订准备摘要",
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
  version: "oam.dormitory-scenario4-inquiry-and-quote-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  statusCount: scenario.quoteStatusOptions?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 4 inquiry and quote authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 4 inquiry and quote authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  const fourth = byNo.get(4);
  if (!fourth) {
    fail("package index missing package 4.");
    return;
  }
  if (fourth.nameZh !== "询价与报价") fail("package 4 name must be 询价与报价.");
  assertArray(fourth.upstreamPackages, [1, 2, 3], "package 4 upstream packages");
  assertArray(fourth.downstreamPackages, [5], "package 4 downstream packages");
  assertArray(fourth.handoffInputs, [
    "房间摘要",
    "床位组摘要",
    "房间/床位运营状态摘要",
    "阻断原因",
    "商品摘要",
    "价格方案摘要",
    "价格日历摘要",
    "价格版本历史",
    "可否进入询价报价",
    "证据摘要",
    "状态历史",
    "只读对象引用"
  ], "package 4 handoff inputs");
  assertArray(fourth.handoffOutputs, expectedHandoffOutputs, "package 4 handoff outputs");
  for (const forbidden of ["库存锁定", "预订", "入住", "收款", "押金", "退款", "账务", "已锁定", "已预订"]) {
    if (!(fourth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 4 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 4 Source.");
  for (const oldExpression of ["lead-reservation", "reservationCreate", "RatePlanConfirm"]) {
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
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 4 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 4 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 4 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario4-inquiry-and-quote-authority.mjs") fail("scenario 4 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 4 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 4 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 4 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario4-inquiry-and-quote-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario4.InquiryAndQuote") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 4 || scenario.nameZh !== "询价与报价") fail("scenario package 4 name invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 4 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 4 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [1, 2, 3], "scenario upstream packages");
  if (scenario.downstream?.allowedConsumerPackageNo !== 5) fail("scenario 4 downstream must be package 5 only.");
  assertArray(scenario.downstream?.handoffOutputs, expectedHandoffOutputs, "scenario downstream handoff outputs");
  if (scenario.downstream?.downstreamRecheckRuleZh?.includes("必须重新校验库存和报价有效期") !== true) {
    fail("scenario 4 downstream must require package 5 to recheck inventory and quote validity.");
  }
}

function checkObjectsAndStates() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray(scenario.quoteStatusOptions, expectedStatuses, "scenario quote status options");
  for (const object of scenario.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 4) fail(`${object.objectName} must be owned by scenario package 4.`);
    for (const required of ["currentState", "versionHistory", "evidenceHistory", "legalNextActions"]) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
  const stateText = JSON.stringify(scenario.stateLayering ?? {});
  for (const required of ["可运营来自场景包 2", "价格已生效来自场景包 3", "可报价来自场景包 4", "可锁定和已预订来自场景包 5"]) {
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
  const inquiryStep = scenario.steps?.[0] ?? {};
  for (const field of ["customerName", "contactPhone", "customerSource", "inquiryNotes"]) {
    if (!(inquiryStep.userFilledFields ?? []).includes(field)) fail(`inquiry step missing user-filled field ${field}.`);
  }
  const demandStep = scenario.steps?.[1] ?? {};
  for (const field of ["checkInDate", "checkOutDate", "guestCount"]) {
    if (!(demandStep.userFilledFields ?? []).includes(field)) fail(`demand step missing user-filled field ${field}.`);
  }
  const productStep = scenario.steps?.[2] ?? {};
  for (const field of ["quoteOptionRef", "productRef", "priceVersionRef", "operationStatusSnapshotRef"]) {
    if (!(productStep.systemGeneratedFields ?? []).includes(field)) fail(`quotable product step missing system field ${field}.`);
  }
  const draftStep = scenario.steps?.[3] ?? {};
  for (const field of ["quoteTotalAmount", "quoteLineItems", "validUntil", "priceSnapshot"]) {
    if (!(draftStep.systemCalculatedFields ?? []).includes(field)) fail(`quote draft step missing calculated field ${field}.`);
  }
  for (const internal of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`forbidden user input missing ${internal}.`);
    for (const fieldClass of ["userFilled", "userSelected"]) {
      if ((scenario.fields?.[fieldClass] ?? []).includes(internal)) fail(`${internal} must not be ${fieldClass}.`);
    }
  }
}

function checkCrud() {
  assertArray(scenario.crudRules?.create?.buttonsZh, ["新建询价", "新建报价草稿", "新建报价版本"], "create buttons");
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
    "contact_required",
    "date_range_invalid",
    "guest_count_invalid",
    "valid_product_required",
    "effective_price_required",
    "operation_blocked_for_quote",
    "quote_validity_required",
    "discount_approval_required",
    "price_snapshot_mismatch",
    "quote_expired_for_reservation_preparation",
    "post_issue_inline_edit_forbidden",
    "forged_internal_reference",
    "duplicate_submission",
    "concurrent_quote_version_conflict",
    "readonly_result_write_attempt",
    "cross_scenario_inventory_reservation_forbidden",
    "finance_fact_forbidden",
    "quote_evidence_missing"
  ]) {
    const item = failureByCode.get(code);
    if (!item) fail(`failure semantics missing ${code}.`);
    if (item?.sideEffectsAllowed !== false) fail(`${code} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  for (const required of [
    "报价必须来自场景包 3 的已生效商品与价格版本，不能由前台手填最终价格真值。",
    "报价生成时可以读取当时可报价资源，但不得锁定资源。",
    "报价发送后不得原地覆盖；调整报价必须创建新 QuoteVersion。",
    "报价有效期过期后不能直接转预订，只能重新报价或重新确认。",
    "确认失败不得刷新下游预订读模型。",
    "查询、搜索、列表、看板、报表永远只读，不得写业务事实。"
  ]) {
    if (!(scenario.invariants ?? []).includes(required)) fail(`invariant missing: ${required}`);
  }
  if (scenario.priceSnapshotRule?.mustUseScenario3EffectivePriceVersion !== true ||
    scenario.priceSnapshotRule?.userMayOverrideFinalPriceTruth !== false ||
    scenario.priceSnapshotRule?.failureCode !== "price_snapshot_mismatch") {
    fail("price snapshot rule must bind scenario 3 effective price version and forbid user final price override.");
  }
  for (const field of ["priceSource", "priceVersionRef", "productRef", "applicableDateRange", "nightOrPeriodCount", "resourceScope", "guestCount", "lineItems", "totalAmount", "validUntil"]) {
    if (!(scenario.priceSnapshotRule?.snapshotFields ?? []).includes(field)) fail(`price snapshot rule missing ${field}.`);
  }
  for (const [stepId] of expectedSteps) {
    if (!scenario.evidence?.requiredEvidenceByStep?.[stepId]?.length) fail(`evidence missing for ${stepId}.`);
  }
  if (scenario.evidence?.noSideEffectsProofRequired !== true || scenario.evidence?.screenshotAnalysisRequired !== true) {
    fail("evidence policy must require screenshots and no-side-effects proof.");
  }
}

function checkSurfaceBoundary() {
  for (const page of ["询价列表", "询价详情", "客户需求页", "可报价商品页", "报价草稿页", "报价单预览页", "报价发送页", "报价版本历史页", "客户反馈页", "转预订准备入口"]) {
    if (!(scenario.surfaceNavigation?.pagesZh ?? []).includes(page)) fail(`surface missing page ${page}.`);
  }
  if (!String(scenario.surfaceNavigation?.todayZh ?? "").includes("今日待跟进") ||
    !String(scenario.surfaceNavigation?.searchZh ?? "").includes("只读") ||
    !String(scenario.surfaceNavigation?.mineZh ?? "").includes("草稿")) {
    fail("surface navigation must define today/search/mine responsibilities.");
  }
  for (const forbidden of ["已锁定", "已预订", "已入住", "已收款", "final GO", "lead-reservation", "reservationCreate", "RatePlanConfirm"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(forbidden)) fail(`surface forbidden visible term missing ${forbidden}.`);
  }
}

function checkNoGo() {
  if (scenario.NO_GO?.businessFeatureDevelopmentAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("NO_GO safety flags must remain closed.");
  }
}

function assertArray(actual = [], expected = [], label = "array") {
  if (JSON.stringify(actual ?? []) !== JSON.stringify(expected)) {
    fail(`${label} mismatch. expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual ?? [])}`);
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
