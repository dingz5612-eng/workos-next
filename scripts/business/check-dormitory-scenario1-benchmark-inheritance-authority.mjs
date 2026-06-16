import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json";
const controlPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const scenario1Path = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario1-benchmark-inheritance-authority-result.json";

const requiredInheritableItems = [
  "开发顺序",
  "Source Authority 优先",
  "generated 不手改",
  "runtime 只消费 generated",
  "surface 只展示和提交合法动作",
  "字段来源分类",
  "CRUD 规则",
  "页面动作组织",
  "今日/工作项/搜索/我的入口规则",
  "正向浏览器截图",
  "反向浏览器截图",
  "截图分析",
  "无副作用证明",
  "局部证据闭环"
];
const forbiddenScenario1BusinessObjects = ["Room", "BedSet", "Bed", "BasicReadiness"];
const forbiddenScenario1BusinessTerms = ["房间号", "床位数", "床位 01..N", "基础就绪字段", "room.bedCount", "bedNo[01..N]"];
const requiredStartGateItems = [
  "已读取总控 Source Authority。",
  "已读取场景 1 标杆继承合同。",
  "已确认本场景在 13 场景总索引中的位置。",
  "已确认上游只读摘要。",
  "已确认本场景唯一对象归属。",
  "已确认禁止写入事项。",
  "已提交与场景 1 的差异清单。",
  "已确认是否涉及 finance-gate、库存、价格、运营状态、报表只读等高风险边界。"
];
const requiredDifferenceSections = ["对象差异", "状态差异", "字段差异", "证据差异", "财务差异", "页面差异", "测试差异"];
const requiredFieldClasses = ["用户填写", "用户选择", "上游只读带入", "系统生成", "系统计算", "证据绑定", "财务确认", "内部审计"];
const forbiddenInternalIds = [
  "roomId",
  "bedId",
  "ratePlanId",
  "quoteId",
  "reservationId",
  "stayId",
  "paymentId",
  "depositId",
  "refundId",
  "ledgerEntryId",
  "stableRef",
  "digest",
  "projectionVersion",
  "domainEventId"
];
const requiredUxQuestions = [
  "用户是谁？",
  "用户此刻要完成什么业务动作？",
  "系统已经从上游带入了什么？",
  "用户还缺什么？",
  "下一步是什么，为什么现在能或不能提交？"
];
const requiredScreenshotColumns = ["场景编号", "步骤编号", "页面名称", "用户动作", "预期结果", "实际结果", "截图路径", "问题", "建议", "是否闭环"];
const requiredNegativeCoverage = ["缺字段", "缺证据", "重复提交", "并发冲突", "伪造内部 ID", "越权操作", "跨场景提前操作", "搜索写事实", "已确认事实原地编辑"];
const requiredFailureRoutes = new Map([
  ["business_rule_missing", "总控或本场景 Source Authority"],
  ["field_source_wrong", "字段矩阵"],
  ["state_overreach", "状态阶梯和对象归属"],
  ["surface_action_confusing", "surface 合同和 UX 五问"],
  ["runtime_hardcoded", "Source Authority 或 generated 合同"],
  ["finance_overreach", "finance-gate 边界"],
  ["evidence_missing", "证据策略"],
  ["test_bypass", "测试计划"]
]);
const failures = [];

const contract = readJson(contractPath);
const control = readJson(controlPath);
const scenario1 = readJson(scenario1Path);
const packageIndex = readJson(packageIndexPath);
const authorityIndex = readJson(authorityIndexPath);

checkHeader();
checkHierarchy();
checkAuthorityIndexRegistration();
checkInheritanceLists();
checkStartGateAndDifferenceTemplate();
checkFieldReviewGate();
checkUxAndFailureRouting();
checkScreenshotEvidenceTemplate();
checkGlobalBoundaries();
checkScenario2Trial();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario1-benchmark-inheritance-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  contractPath,
  controlPath,
  scenario1Path,
  packageIndexPath,
  contractDigest: digestFile(contractPath),
  controlDigest: digestFile(controlPath),
  scenario1Digest: digestFile(scenario1Path),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (failures.length) {
  console.error("Dormitory scenario 1 benchmark inheritance authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 1 benchmark inheritance authority check: PASS (${result.contractDigest})`);

function checkHeader() {
  if (contract.version !== "oam.dormitory.scenario1-benchmark-inheritance-source-authority.v1") fail("contract version invalid.");
  if (contract.status !== "authoritative") fail("contract status must be authoritative.");
  if (contract.authorityId !== "Dormitory.Scenario1BenchmarkInheritanceContract") fail("contract authorityId invalid.");
  if (contract.manualEditAllowed !== true || "generated" in contract || "doNotEdit" in contract) fail("contract must be manual Source, not generated.");
  if (contract.nameZh !== "场景 1 标杆继承合同") fail("contract name must be 场景 1 标杆继承合同.");
}

function checkHierarchy() {
  const hierarchy = contract.authorityHierarchy ?? {};
  if (control.authorityId !== "Dormitory.Operating13ScenarioControl") fail("13 scenario control authority identity invalid.");
  if (scenario1.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness") fail("scenario 1 authority identity invalid.");
  if (packageIndex.authorityId !== "Dormitory.LodgingScenarioPackageIndex") fail("package index authority identity invalid.");
  if (hierarchy.highestBusinessAuthorityRef !== controlPath || hierarchy.highestBusinessAuthorityId !== "Dormitory.Operating13ScenarioControl") {
    fail("contract must declare 13 scenario control as highest business authority.");
  }
  if (hierarchy.benchmarkImplementationRef !== scenario1Path) fail("contract must reference scenario 1 as benchmark implementation.");
  if (!includesText(hierarchy.rules, "场景 1 是实现方法标杆，不是后续场景的业务规则总源。")) {
    fail("contract must declare scenario 1 as benchmark, not business rule source.");
  }
  if (!includesText(hierarchy.forbiddenHierarchyInterpretations, "不得把场景 1 写成最高权威。")) {
    fail("contract must forbid scenario 1 as highest authority.");
  }
}

function checkAuthorityIndexRegistration() {
  const entry = (authorityIndex.entries ?? []).find((item) => item.path === contractPath);
  if (!entry) {
    fail("authority index missing benchmark inheritance contract Source entry.");
  } else {
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("benchmark contract must be source/sourceKernel.");
    if (entry.currentTruthAllowed !== true || entry.contractAuthorityAllowed !== true || entry.businessFactAuthorityAllowed !== true) {
      fail("benchmark contract must be registered as current business/contract Source.");
    }
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) {
      fail("benchmark contract authority index entry must be manual non-runtime Source.");
    }
    if (entry.checker !== "scripts/business/check-dormitory-scenario1-benchmark-inheritance-authority.mjs" ||
      entry.evidence !== resultPath) {
      fail("benchmark contract checker/evidence registration mismatch.");
    }
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(contractPath)) fail("classificationModel.sourceLayerWhitelist missing benchmark contract.");
  if (!sourceMirror.has(contractPath)) fail("sourceLayerWhitelist mirror missing benchmark contract.");
}

function checkInheritanceLists() {
  for (const item of requiredInheritableItems) {
    if (!(contract.inheritableMethodItems ?? []).includes(item)) fail(`inheritable method item missing: ${item}`);
  }
  const forbidden = contract.forbiddenInheritanceItems ?? {};
  assertArrayContainsAll(forbidden.businessObjects, forbiddenScenario1BusinessObjects, "forbidden scenario 1 business objects");
  assertArrayContainsAll(forbidden.businessFieldsOrConceptsZh, forbiddenScenario1BusinessTerms, "forbidden scenario 1 business terms");
  if (!String(forbidden.blockingRuleZh ?? "").includes("必须阻断")) fail("forbidden inheritance must define blocking rule.");
  const principles = new Map((contract.inheritancePrinciples ?? []).map((item) => [item.principleId, item.ruleZh]));
  for (const id of [
    "method_only_not_business_source",
    "read_control_and_benchmark_before_start",
    "difference_goes_to_scene_source_first",
    "legacy_reference_only"
  ]) {
    if (!principles.has(id)) fail(`inheritance principle missing ${id}.`);
  }
}

function checkStartGateAndDifferenceTemplate() {
  const gate = contract.subsequentScenarioStartGate ?? {};
  assertArrayExact(gate.appliesToScenarioNos, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], "start gate scenario numbers");
  assertArrayContainsAll(gate.requiredChecklist, requiredStartGateItems, "start gate checklist");
  assertArrayContainsAll(gate.requiredSourceReads, [controlPath, contractPath], "start gate required source reads");
  if (!String(gate.blockingRuleZh ?? "").includes("不得开始本场景开发")) fail("start gate must block development when checklist missing.");
  const template = contract.differenceChecklistTemplate ?? {};
  assertArrayContainsAll(template.requiredSections, requiredDifferenceSections, "difference template sections");
  assertArrayContainsAll(template.fieldDifferenceRequiredClasses, requiredFieldClasses, "difference field classes");
  for (const rule of ["差异清单为空必须阻断。", "差异清单只复制场景 1 必须阻断。"]) {
    if (!(template.blockingRulesZh ?? []).includes(rule)) fail(`difference template blocking rule missing: ${rule}`);
  }
}

function checkFieldReviewGate() {
  const gate = contract.fieldReviewGate ?? {};
  assertArrayContainsAll(gate.requiredColumns, ["fieldKey", "businessNameZh", "source", "editableByUser", "displayMode", "searchable", "exportable", "auditField"], "field review columns");
  assertArrayContainsAll(gate.forbiddenUserInputFields, forbiddenInternalIds, "forbidden internal IDs");
  assertArrayContainsAll(gate.internalIdExposureScanScope, ["label", "placeholder", "表单字段", "错误提示", "提交 payload", "截图报告"], "internal ID scan scope");
}

function checkUxAndFailureRouting() {
  const ux = contract.uxAndButtonGate ?? {};
  assertArrayContainsAll(ux.uxFiveQuestions, requiredUxQuestions, "UX five questions");
  assertArrayContainsAll(ux.pageDisplayRequirements, ["当前状态", "已完成步骤", "缺失项", "下一步动作", "不可提交原因"], "page display requirements");
  if (!String(ux.entryRules?.search ?? "").includes("只读")) fail("search entry rule must be readonly.");
  if (!String(ux.buttonRuleZh ?? "").includes("不得所有状态都显示一个固定提交按钮")) fail("button state rule missing.");
  const routeByClass = new Map((contract.failureAttributionRouting ?? []).map((item) => [item.failureClass, item.routeBackTo]));
  for (const [failureClass, routeBackTo] of requiredFailureRoutes) {
    if (routeByClass.get(failureClass) !== routeBackTo) fail(`failure route mismatch for ${failureClass}.`);
  }
  for (const bypass of ["不得手改 generated。", "不得手改报告。", "不得放宽测试脚本绕过失败。"]) {
    if (!(contract.forbiddenFailureBypassZh ?? []).includes(bypass)) fail(`forbidden failure bypass missing: ${bypass}`);
  }
}

function checkScreenshotEvidenceTemplate() {
  const template = contract.screenshotEvidenceTemplate ?? {};
  assertArrayContainsAll(template.requiredColumns, requiredScreenshotColumns, "screenshot template columns");
  assertArrayContainsAll(template.negativeCoverage, requiredNegativeCoverage, "negative screenshot coverage");
  if (!String(template.evidenceLayering?.singleScenario ?? "").includes("局部证据 PASS")) fail("single scenario evidence layer missing.");
  if (!String(template.evidenceLayering?.fullChainStage ?? "").includes("Evidence Root PASS")) fail("full chain evidence layer missing.");
  if (!String(template.rootEvidenceRuleZh ?? "").includes("不得要求每个小改动")) fail("Evidence Root layering rule missing.");
}

function checkGlobalBoundaries() {
  const boundary = contract.globalReadonlyAndFinanceBoundaries ?? {};
  if (boundary.searchDashboardReportReadonly !== true) fail("search/dashboard/report boundary must be readonly.");
  if (boundary.businessScenarioDirectLedgerWriteAllowed !== false) fail("business scenario direct ledger write must be forbidden.");
  if (boundary.financeTruthOwner !== "finance-gate") fail("finance truth owner must be finance-gate.");
}

function checkScenario2Trial() {
  const trial = contract.scenario2StartGateTrial ?? {};
  const scenario2 = (control.scenarios ?? []).find((item) => item.scenarioNo === 2);
  if (!scenario2) {
    fail("13 scenario control missing scenario 2.");
    return;
  }
  if (trial.scenarioNo !== 2 || trial.scenarioId !== scenario2.scenarioId || trial.nameZh !== scenario2.nameZh) {
    fail("scenario 2 start gate trial identity must match 13 scenario control.");
  }
  if (trial.status !== "trial_gate_only_no_business_feature_development") fail("scenario 2 trial must not develop business feature.");
  assertArrayContainsAll(trial.reads, [controlPath, contractPath], "scenario 2 trial source reads");
  assertArrayContainsAll(trial.ownedObjects, ["OperationStatus", "OperationBlocker"], "scenario 2 owned objects");
  assertArrayContainsAll(trial.upstreamReadonlySummaries, ["房间摘要", "床位组摘要", "基础就绪摘要"], "scenario 2 upstream readonly summaries");
  assertArrayContainsAll(trial.businessFieldsNotInheritedFromScenario1, [...forbiddenScenario1BusinessObjects, "房间号", "床位数", "床位 01..N", "基础就绪字段"], "scenario 2 explicitly non-inherited fields");
  const diff = trial.differenceChecklist ?? {};
  assertArrayContainsAll(diff.objectDifference?.writes, ["OperationStatus", "OperationBlocker"], "scenario 2 write objects");
  assertArrayContainsAll(diff.objectDifference?.doesNotWrite, forbiddenScenario1BusinessObjects, "scenario 2 does-not-write scenario 1 objects");
  assertArrayContainsAll(diff.stateDifference?.produces, ["可运营"], "scenario 2 produced state");
  assertArrayContainsAll(diff.stateDifference?.mustNotProduce, ["基础就绪", "可报价", "可预订"], "scenario 2 forbidden states");
  for (const fieldClass of ["userFilled", "userSelected", "systemGenerated", "systemCalculated", "evidenceBound", "financeConfirmed", "internalAudit"]) {
    if (!Array.isArray(diff.fieldDifference?.[fieldClass])) fail(`scenario 2 field difference missing ${fieldClass}.`);
  }
  const userFacingFields = [
    ...(diff.fieldDifference?.userFilled ?? []),
    ...(diff.fieldDifference?.userSelected ?? []),
    ...(diff.pageDifference?.buttons ?? []),
    ...(diff.pageDifference?.pages ?? [])
  ].join("|");
  for (const forbidden of forbiddenScenario1BusinessTerms) {
    if (userFacingFields.includes(forbidden)) fail(`scenario 2 user-facing difference copies scenario 1 term: ${forbidden}.`);
  }
  if (diff.financeDifference?.involvesAmount !== false) fail("scenario 2 trial must not involve finance amount.");
  if (trial.highRiskBoundaries?.operationStatus !== true) fail("scenario 2 must flag operationStatus high-risk boundary.");
  if (trial.highRiskBoundaries?.mustNotEnterPriceOrReservation !== true) fail("scenario 2 must forbid direct price/reservation.");
  if (trial.highRiskBoundaries?.scenario11WorkSuggestionOnly !== true) fail("scenario 2 must treat scenario 11 as suggestion only.");
}

function checkNoGo() {
  const noGo = contract.NO_GO ?? {};
  if (noGo.businessFeatureDevelopmentAllowed !== false ||
    noGo.productionConfirmAllowed !== false ||
    noGo.businessGoLiveAllowed !== false ||
    noGo.releaseAuthority !== false ||
    noGo.finalGoNoGo !== "NO_GO") {
    fail("benchmark contract must keep feature development, production, go-live, release and final GO closed.");
  }
}

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`${file} is missing.`);
    return {};
  }
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function includesText(list, text) {
  return (list ?? []).some((item) => String(item).includes(text));
}

function assertArrayContainsAll(actual, expected, label) {
  if (!Array.isArray(actual)) {
    fail(`${label} must be an array.`);
    return;
  }
  for (const item of expected) {
    if (!actual.includes(item)) fail(`${label} missing ${item}.`);
  }
}

function assertArrayExact(actual, expected, label) {
  if (!Array.isArray(actual)) {
    fail(`${label} must be an array.`);
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function fail(message) {
  failures.push(message);
}
