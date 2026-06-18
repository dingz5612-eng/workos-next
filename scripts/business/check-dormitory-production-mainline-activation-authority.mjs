import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-production-mainline-activation.authority.json";
const controlPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-production-mainline-activation-result.json";

const expectedScenarioOrder = [
  [1, "新增房间和床位", "房源建档与基础就绪"],
  [2, "设置房源状态", "房源运营就绪与状态维护"],
  [3, "设置住宿商品和价格", "住宿商品与价格"],
  [4, "给客户报价", "询价与报价"],
  [5, "创建预订并锁房", "预订与库存锁定"],
  [6, "收款、押金和担保", "收款、押金与担保"],
  [7, "办理入住", "入住办理"],
  [8, "管理在住", "在住管理"],
  [9, "办理退房结算", "退房结算"],
  [10, "取消、未到店和退款", "取消、未到店与退款处理"],
  [11, "保洁维修和停售恢复", "房务、维修与停售协同"],
  [12, "渠道和企业客户", "渠道与企业客户"],
  [13, "经营报表和审计", "经营报表、审计与复盘"]
];

const expectedDomains = [
  "product_business",
  "scenario_handoff",
  "business_naming",
  "ui_ux",
  "i18n_copy",
  "source_authority",
  "compiler_generated",
  "operations_runtime",
  "database_master_data",
  "search_information_architecture",
  "bi_kpi_reporting",
  "finance_money_boundary",
  "permission_security",
  "controlplane_release",
  "qa_regression",
  "evidence_root",
  "performance_stability",
  "operations_delivery"
];

const requiredCardKeys = [
  "scenarioNo",
  "frontName",
  "architectureName",
  "businessGoal",
  "upstreamReadonlyInputs",
  "userFilledFields",
  "userSelectedFields",
  "userEvidence",
  "systemGeneratedFields",
  "readSideOutputs",
  "downstreamReadableSummaries",
  "noGoBoundaries",
  "crudRules",
  "stateMachine",
  "buttonMatrix",
  "failureSemantics",
  "permissionAdmission",
  "evidenceRequirements",
  "performanceThresholds",
  "browserPositiveAcceptance",
  "browserNegativeAcceptance",
  "exceptionHandling",
  "legacyIsolationRules",
  "sop"
];

const requiredCrud = [
  "新建草稿",
  "保存草稿",
  "继续办理",
  "修改草稿",
  "确认",
  "作废/取消/停用/关闭",
  "纠错",
  "查询",
  "导出",
  "复制为新草稿"
];

const requiredThresholds = ["newDraftMs", "saveDraftMs", "confirmMs", "searchMs", "uploadEvidenceMs", "summaryOpenMs"];

const forbiddenActiveLegacy = [
  "Dormitory.FirstGoldenChain",
  "FIRST_GOLDEN_CHAIN_*",
  "W-STAY-RESOURCE",
  "roomSetup",
  "bedSetup",
  "roomReadiness",
  "roomRelease",
  "RoomSetupConfirm",
  "BedSetupConfirm",
  "ResourceReadinessConfirm",
  "resource-saleability",
  "lead-reservation"
];

const failures = [];
const authority = readJson(authorityPath);
const control = readJson(controlPath);
const index = readJson(authorityIndexPath);

checkAuthorityHeader();
checkIndexRegistration();
checkScenarioOrder();
checkResponsibilityDomains();
checkProductionCards();
checkGlobalMatrices();
checkOperatingDelivery();
checkFinalSafety();

const result = {
  version: "oam.dormitory-production-mainline-activation-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  authorityDigest: digestFile(authorityPath),
  highestAuthorityRef: authority.highestAuthorityRef,
  scenarioCount: authority.productionCards?.length ?? 0,
  responsibilityDomainCount: authority.responsibilityDomains?.length ?? 0,
  activeMainlineId: authority.productionMainline?.activeMainlineId,
  legacyActiveAllowed: authority.globalMatrices?.legacyIsolation?.activeMainlineAllowed === true,
  productionConfirmAllowed: authority.finalSafety?.productionConfirmAllowed === true,
  releaseAuthority: authority.finalSafety?.releaseAuthority === true,
  finalGoNoGo: authority.finalSafety?.finalGoNoGo ?? "missing",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory production mainline activation authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory production mainline activation authority check: PASS (${result.authorityDigest})`);

function checkAuthorityHeader() {
  if (authority.authorityId !== "Dormitory.ProductionMainlineActivation") fail("authorityId must be Dormitory.ProductionMainlineActivation.");
  if (authority.highestAuthorityRef !== controlPath) fail("highestAuthorityRef must point to the 13 scenario control authority.");
  if (!authority.scope?.includes("local/test/browser evidence")) fail("scope must remain local/test/browser evidence.");
  if (authority.productionMainline?.activeMainlineId !== "Dormitory.13ScenarioMainline") fail("active mainline must be Dormitory.13ScenarioMainline.");
  if (authority.productionMainline?.onlyActiveMainlineAllowed !== true) fail("productionMainline.onlyActiveMainlineAllowed must be true.");
  if (control.authorityId !== "Dormitory.Operating13ScenarioControl") fail("control authority ref is not the expected highest dormitory control source.");
}

function checkIndexRegistration() {
  const entry = (index.entries ?? []).find((item) => item.path === authorityPath);
  if (!entry) {
    fail("current-authority-index missing production activation authority entry.");
    return;
  }
  if (entry.layer !== "source") fail("production activation authority must be registered as source layer.");
  if (entry.businessFactAuthorityAllowed !== false) fail("production activation authority must not become business truth source.");
  if (entry.contractAuthorityAllowed !== true) fail("production activation authority must be allowed as governance contract source.");
  if (entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) {
    fail("production activation authority must be manual source, not generated.");
  }
  if (entry.checker !== "scripts/business/check-dormitory-production-mainline-activation-authority.mjs") {
    fail("production activation authority checker mismatch.");
  }
  const sourceModel = new Set(index.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((index.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(authorityPath)) fail("classificationModel.sourceLayerWhitelist missing production activation authority.");
  if (!sourceMirror.has(authorityPath)) fail("sourceLayerWhitelist mirror missing production activation authority.");
}

function checkScenarioOrder() {
  const order = authority.productionMainline?.scenarioOrder ?? [];
  if (order.length !== expectedScenarioOrder.length) fail("productionMainline.scenarioOrder must define exactly 13 scenarios.");
  for (const [scenarioNo, frontName, architectureName] of expectedScenarioOrder) {
    const item = order.find((candidate) => candidate.scenarioNo === scenarioNo);
    const controlScenario = (control.scenarios ?? []).find((candidate) => candidate.scenarioNo === scenarioNo);
    if (!item) {
      fail(`scenario order missing scenario ${scenarioNo}.`);
      continue;
    }
    if (item.frontName !== frontName) fail(`scenario ${scenarioNo} frontName mismatch.`);
    if (item.architectureName !== architectureName) fail(`scenario ${scenarioNo} architectureName mismatch.`);
    if (controlScenario?.nameZh !== architectureName) fail(`scenario ${scenarioNo} architectureName must match control authority nameZh.`);
  }
}

function checkResponsibilityDomains() {
  const domains = authority.responsibilityDomains ?? [];
  if (domains.length !== expectedDomains.length) fail("responsibilityDomains must define exactly 18 domains.");
  const domainIds = new Set(domains.map((item) => item.domainId));
  for (const expected of expectedDomains) {
    if (!domainIds.has(expected)) fail(`missing responsibility domain: ${expected}.`);
  }
  domains.forEach((domain, indexNo) => {
    if (domain.domainNo !== indexNo + 1) fail(`responsibility domain ${domain.domainId} domainNo must be ${indexNo + 1}.`);
    for (const key of ["nameZh", "authoritySourceRefs", "generatedContractRefs", "implementationConsumptionPoints", "checkScripts", "browserEvidenceRefs", "completionStandardZh"]) {
      if (isEmpty(domain[key])) fail(`responsibility domain ${domain.domainId} missing ${key}.`);
    }
  });
}

function checkProductionCards() {
  const cards = authority.productionCards ?? [];
  if (cards.length !== expectedScenarioOrder.length) fail("productionCards must define exactly 13 cards.");
  for (const [scenarioNo, frontName, architectureName] of expectedScenarioOrder) {
    const card = cards.find((candidate) => candidate.scenarioNo === scenarioNo);
    if (!card) {
      fail(`productionCards missing scenario ${scenarioNo}.`);
      continue;
    }
    if (card.frontName !== frontName) fail(`scenario ${scenarioNo} production card frontName mismatch.`);
    if (card.architectureName !== architectureName) fail(`scenario ${scenarioNo} production card architectureName mismatch.`);
    for (const key of requiredCardKeys) {
      if (isEmpty(card[key])) fail(`scenario ${scenarioNo} production card missing ${key}.`);
    }
    for (const crud of requiredCrud) {
      if (!card.crudRules?.includes(crud)) fail(`scenario ${scenarioNo} crudRules missing ${crud}.`);
    }
    if (card.noGoBoundaries?.some((item) => /final GO|生产发布|业务上线/.test(item))) {
      fail(`scenario ${scenarioNo} noGoBoundaries must not imply production/final GO.`);
    }
  }
}

function checkGlobalMatrices() {
  const matrices = authority.globalMatrices ?? {};
  for (const crud of requiredCrud) {
    if (!matrices.crudOperations?.includes(crud)) fail(`global crudOperations missing ${crud}.`);
  }
  for (const source of ["用户填写", "用户选择", "上游只读带入", "系统生成", "系统计算", "证据绑定", "财务确认", "内部审计"]) {
    if (!matrices.fieldSources?.includes(source)) fail(`global fieldSources missing ${source}.`);
  }
  for (const key of ["today", "workItems", "search", "mine"]) {
    if (!matrices.entryResponsibilities?.[key]) fail(`entryResponsibilities missing ${key}.`);
  }
  for (const threshold of requiredThresholds) {
    if (typeof matrices.performanceThresholds?.[threshold] !== "number") fail(`performanceThresholds missing numeric ${threshold}.`);
  }
  if (matrices.legacyIsolation?.activeMainlineAllowed !== false) fail("legacy active mainline must be forbidden.");
  if (matrices.legacyIsolation?.writeFactsAllowed !== false) fail("legacy write facts must be forbidden.");
  if (matrices.legacyIsolation?.currentBrowserAuditAllowed !== false) fail("legacy current browser audit must be forbidden.");
  if (matrices.legacyIsolation?.currentEvidenceRootAllowed !== false) fail("legacy current Evidence Root must be forbidden.");
  const serialized = JSON.stringify(authority);
  for (const identity of forbiddenActiveLegacy) {
    if (!serialized.includes(identity)) fail(`legacy identity must be listed for retirement/isolation: ${identity}.`);
  }
}

function checkOperatingDelivery() {
  const delivery = authority.operatingDelivery ?? {};
  for (const key of ["sop", "exceptionHandlingManual", "humanReview", "permissionStatement", "financeBoundaryStatement", "dataRepair", "rollback", "training", "launchChecklist"]) {
    if (isEmpty(delivery[key])) fail(`operatingDelivery missing ${key}.`);
  }
}

function checkFinalSafety() {
  const finalSafety = authority.finalSafety ?? {};
  if (finalSafety.productionConfirmAllowed !== false) fail("productionConfirmAllowed must be false.");
  if (finalSafety.businessGoLiveAllowed !== false) fail("businessGoLiveAllowed must be false.");
  if (finalSafety.releaseAuthority !== false) fail("releaseAuthority must be false.");
  if (finalSafety.finalGoNoGo !== "NO_GO") fail("finalGoNoGo must remain NO_GO.");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
}

function digestFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
}

function isEmpty(value) {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function fail(message) {
  failures.push(message);
}
