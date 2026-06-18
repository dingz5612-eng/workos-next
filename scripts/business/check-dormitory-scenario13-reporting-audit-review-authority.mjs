import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-authority-result.json";
const failures = [];

const expectedObjects = [
  "ReportPeriod",
  "ReportScope",
  "MetricDefinition",
  "MetricSnapshot",
  "ReportSnapshot",
  "AuditFinding",
  "EvidenceReviewRecord",
  "ReviewMeetingRecord",
  "ReviewConclusion",
  "ActionPlan",
  "IssueTrackingItem",
  "ReportExportRecord",
  "ReportStatusTimeline",
  "StatusTimeline"
];
const expectedSteps = [
  ["select-report-scope", "选择报表范围"],
  ["data-completeness-check", "数据完整性检查"],
  ["generate-business-report-snapshot", "生成经营报表快照"],
  ["generate-finance-review-view", "生成财务核对视图"],
  ["audit-finding-and-location", "审计发现与问题定位"],
  ["review-conclusion-action-plan", "复盘结论与行动计划"],
  ["publish-export-timeline", "发布、导出与历史"]
];
const expectedCommands = [
  "Dorm.ReportScopeSelect",
  "Dorm.ReportDataQualityCheck",
  "Dorm.BusinessReportSnapshotGenerate",
  "Dorm.FinanceReviewSnapshotGenerate",
  "Dorm.AuditFindingCreate",
  "Dorm.ReviewConclusionActionPlanCreate",
  "Dorm.ActionPlanCreate",
  "Dorm.IssueTrackingItemCreate",
  "Dorm.ReportPublish",
  "Dorm.ReportExportRecordCreate",
  "Dorm.ReportArchive"
];
const expectedInputs = [
  "场景包 1-12 已确认事实摘要",
  "状态历史",
  "证据摘要",
  "只读对象引用",
  "授权投影",
  "finance-gate 已确认账务事实",
  "permission envelope",
  "lineage envelope",
  "freshness envelope"
];
const expectedOutputs = [
  "报表快照",
  "指标快照",
  "财务核对视图",
  "审计发现",
  "复盘结论",
  "行动计划",
  "问题追踪",
  "导出记录",
  "证据摘要",
  "只读对象引用"
];
const expectedMetrics = [
  "房源数量",
  "可运营房源",
  "可报价商品",
  "报价转化",
  "预订数",
  "入住数",
  "在住数",
  "退房数",
  "取消/未到店数",
  "收入确认",
  "押金余额",
  "退款申请",
  "维修房务任务",
  "渠道/企业客户贡献",
  "异常闭环率"
];
const forbiddenWrites = [
  "Room",
  "Bed",
  "OperationStatus",
  "RatePlan",
  "Quote",
  "Reservation",
  "Stay",
  "Payment",
  "Deposit",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction"
];
const forbiddenUserInput = [
  "reportId",
  "metricId",
  "ledgerEntryId",
  "reservationId",
  "stayId",
  "roomId",
  "bedId",
  "paymentId",
  "depositId",
  "refundId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];

const scenario = readJson(scenarioPath);
const packageIndex = readJson(packageIndexPath);
const authorityIndex = readJson(authorityIndexPath);

checkPackageIndex();
checkAuthorityIndexRegistration();
checkScenarioHeader();
checkObjectsMetricsAndSteps();
checkFieldsCrudCommandsFailures();
checkInvariantsEvidenceAndBoundaries();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario13-reporting-audit-review-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  metricCount: scenario.metricCatalog?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 13 reporting audit review authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 13 reporting audit review authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  const names = (packageIndex.scenarioPackageOrder ?? []).map((item) => item.nameZh);
  assertArray(names.slice(0, 13), [
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
    "渠道与企业客户",
    "经营报表、审计与复盘"
  ], "first thirteen package names");
  const thirteenth = (packageIndex.scenarioPackageOrder ?? []).find((item) => item.packageNo === 13);
  if (!thirteenth) return fail("package index missing package 13.");
  if (thirteenth.scenarioId !== "lodging.reporting-audit-review" || thirteenth.nameZh !== "经营报表、审计与复盘") fail("package 13 identity mismatch.");
  assertArray(thirteenth.upstreamPackages, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "package 13 upstream packages");
  assertArray(thirteenth.handoffInputs, expectedInputs, "package 13 handoff inputs");
  assertArray(thirteenth.handoffOutputs, expectedOutputs, "package 13 handoff outputs");
  for (const forbidden of forbiddenWrites.concat(["已修复原事实", "已入账", "已上线", "final GO"])) {
    if (!(thirteenth.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 13 must forbid output ${forbidden}.`);
  }
  if (!(packageIndex.sourceAuthorityRefs ?? []).includes(scenarioPath)) fail("package index sourceAuthorityRefs missing scenario 13 Source.");
  for (const oldExpression of ["period-review", "dashboard", "analytics"]) {
    if (!(packageIndex.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in package index.`);
    }
    if (!(scenario.oldProjectExpressionIsolation?.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) {
      fail(`${oldExpression} must be forbidden as new business source in scenario 13 Source.`);
    }
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === scenarioPath);
  if (!entry) {
    fail(`authority index missing Source entry ${scenarioPath}.`);
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("scenario 13 authority entry must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) fail("scenario 13 authority must be business and contract Source.");
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) fail("scenario 13 index entry must be manual non-runtime Source.");
    if (entry.checker !== "scripts/business/check-dormitory-scenario13-reporting-audit-review-authority.mjs") fail("scenario 13 checker registration mismatch.");
    if (entry.evidence !== resultPath) fail("scenario 13 evidence registration mismatch.");
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(scenarioPath)) fail("classificationModel.sourceLayerWhitelist missing scenario 13 Source.");
  if (!sourceMirror.has(scenarioPath)) fail("sourceLayerWhitelist mirror missing scenario 13 Source.");
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario13-reporting-audit-review-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario13.ReportingAuditReview") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 13 || scenario.scenarioId !== "lodging.reporting-audit-review" || scenario.nameZh !== "经营报表、审计与复盘") fail("scenario package 13 identity invalid.");
  if (scenario.highestAuthorityRef !== "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json") fail("scenario 13 must keep 13 scenario control as highest authority.");
  if (scenario.methodBenchmarkRef !== "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json") fail("scenario 13 must reference scenario 1 benchmark as method contract.");
  assertArray(scenario.upstream?.allowedSourcePackageNos, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "scenario upstream packages");
  assertArray(scenario.upstream?.requiredReadonlyInputs, expectedInputs, "scenario upstream readonly inputs");
  if (scenario.upstream?.upstreamWriteBackAllowed !== false) fail("scenario 13 must not write back upstream.");
  assertArray(scenario.downstream?.handoffOutputs, expectedOutputs, "scenario downstream handoff outputs");
}

function checkObjectsMetricsAndSteps() {
  assertArray((scenario.objects ?? []).map((item) => item.objectName), expectedObjects, "scenario objects");
  assertArray((scenario.steps ?? []).map((step) => [step.stepId, step.nameZh]), expectedSteps, "scenario steps");
  assertArray((scenario.metricCatalog ?? []).map((item) => item.nameZh), expectedMetrics, "metric catalog");
  for (const key of ["mustHaveFormula", "mustHaveSourcePackages", "mustHaveTimeRange", "mustHavePermissionEnvelope", "mustHaveLineageEnvelope", "mustHaveFreshnessEnvelope", "financialMetricsReadFinanceGateOnly"]) {
    if (scenario.metricDefinitionRule?.[key] !== true) fail(`metricDefinitionRule.${key} must be true.`);
  }
  for (const financial of ["收入确认", "押金余额", "退款申请"]) {
    const item = (scenario.metricCatalog ?? []).find((metric) => metric.nameZh === financial);
    if (item?.financeGateOnly !== true) fail(`${financial} must be finance-gate only.`);
  }
}

function checkFieldsCrudCommandsFailures() {
  assertArray(scenario.fields?.upstreamReadonly, expectedInputs, "fields upstream readonly");
  for (const field of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(field)) fail(`forbidden user input missing ${field}.`);
  }
  for (const key of ["userFilled", "userSelected", "systemGenerated", "systemCalculated", "evidenceBound", "internalAudit"]) {
    if (!Array.isArray(scenario.fields?.[key]) || scenario.fields[key].length === 0) fail(`fields.${key} must be non-empty.`);
  }
  if (scenario.crudRules?.draftCanEdit !== true ||
    scenario.crudRules?.publishedInlineEditAllowed !== false ||
    scenario.crudRules?.confirmedFindingInlineEditAllowed !== false ||
    scenario.crudRules?.physicalDeletePublishedAllowed !== false ||
    scenario.crudRules?.readOnlySurfacesWriteSourceFactAllowed !== false) {
    fail("crud rules must keep draft editable, published/confirmed append-only, delete forbidden and readonly surfaces readonly.");
  }
  assertArray((scenario.commands ?? []).map((item) => item.commandId), expectedCommands, "scenario commands");
  if (!(scenario.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) fail("all scenario 13 failures must forbid side effects.");
  for (const code of ["missing_permission_envelope", "missing_lineage_envelope", "stale_freshness_envelope", "ui_state_metric_forbidden", "non_finance_gate_truth_forbidden", "audit_direct_source_fix_forbidden", "readonly_search_write_attempt", "direct_business_fact_write_forbidden", "direct_ledger_fact_write_forbidden"]) {
    if (!(scenario.failureSemantics ?? []).some((item) => item.failureCode === code)) fail(`failure code missing ${code}.`);
  }
}

function checkInvariantsEvidenceAndBoundaries() {
  const invariant = JSON.stringify(scenario.invariants ?? []);
  for (const required of ["permission", "lineage", "freshness", "finance-gate", "不得从 UI 页面状态计算", "行动计划", "不得写业务事实", "不得写业务事实、账务事实"]) {
    if (!invariant.includes(required)) fail(`invariants missing ${required}.`);
  }
  const rule = scenario.reportingInvariantRule ?? {};
  for (const key of ["reportDashboardSearchExportReadonly", "permissionRequiredForFormalReport", "lineageRequiredForFormalMetric", "freshnessRequiredForPublish", "metricCalculationFromConfirmedFactsOnly", "uiStateMetricCalculationForbidden", "financialMetricsReadFinanceGateOnly", "auditFindingCannotModifySourceFact", "actionPlanRoutesBackOnly", "publishedReportAppendOnlyVersion", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (rule[key] !== true) fail(`reportingInvariantRule.${key} must be true.`);
  }
  if (scenario.evidence?.screenshotAnalysisRequired !== true ||
    scenario.evidence?.noSideEffectsProofRequired !== true ||
    scenario.evidence?.evidenceRootRequiredAtIntegration !== true) {
    fail("evidence policy must require screenshots, no side effects and Evidence Root integration.");
  }
  const boundary = scenario.runtimeConsumptionBoundary ?? {};
  if (boundary.runtimeMayReadGeneratedOnly !== true ||
    boundary.runtimeMayHardcodeBusinessRules !== false ||
    boundary.readModelMayReadConfirmedFactsOnly !== true ||
    boundary.readModelMayWriteSourceFacts !== false ||
    boundary.businessRuntimeMayWriteRoomBedOperation !== false ||
    boundary.businessRuntimeMayWritePriceQuoteReservationStay !== false ||
    boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
    boundary.businessRuntimeMayWriteLedger !== false ||
    boundary.financeGateTruthReadonlyOnly !== true ||
    boundary.failurePathBusinessSideEffectsAllowed !== false ||
    boundary.successMayWriteReportingAuditReviewFactsOnly !== true) {
    fail("runtime consumption boundary mismatch.");
  }
  const surfaceText = JSON.stringify(scenario.surfaceNavigation ?? {});
  for (const required of ["搜索结果只读", "我的只放草稿", "复盘待提交", "数据缺失待补", "不可发布原因"]) {
    if (!surfaceText.includes(required)) fail(`surface navigation missing ${required}.`);
  }
  for (const forbidden of ["已修复原事实", "已入账", "已上线", "final GO", "生产发布", "业务上线", "period-review", "dashboard", "analytics"]) {
    if (!(scenario.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(forbidden)) fail(`surface forbidden term missing ${forbidden}.`);
  }
  assertArray(scenario.readSideOutputs, expectedOutputs, "read side outputs");
}

function checkNoGo() {
  if (scenario.NO_GO?.productionConfirmAllowed !== false ||
    scenario.NO_GO?.businessGoLiveAllowed !== false ||
    scenario.NO_GO?.releaseAuthority !== false ||
    scenario.NO_GO?.finalGoNoGo !== "NO_GO") {
    fail("scenario 13 NO_GO must keep production/business/release/final approval disabled.");
  }
}

function assertArray(actual, expected, label) {
  if (!arraysEqual(actual, expected)) {
    fail(`${label} mismatch. expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  }
}

function arraysEqual(actual = [], expected = []) {
  const left = actual ?? [];
  return left.length === expected.length &&
    left.every((item, index) => JSON.stringify(item) === JSON.stringify(expected[index]));
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
