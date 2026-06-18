import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-13-scenario-control-authority-result.json";
const oldSourcePaths = [
  "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml",
  "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml"
];
const expectedScenarios = [
  [1, "lodging.resource-basic-readiness", "房源建档与基础就绪", "main_operating_chain"],
  [2, "lodging.resource-operation-status", "房源运营就绪与状态维护", "main_operating_chain"],
  [3, "lodging.product-and-rate", "住宿商品与价格", "main_operating_chain"],
  [4, "lodging.inquiry-and-quote", "询价与报价", "main_operating_chain"],
  [5, "lodging.reservation-and-inventory-hold", "预订与库存锁定", "main_operating_chain"],
  [6, "lodging.payment-deposit-and-guarantee", "收款、押金与担保", "main_operating_chain"],
  [7, "lodging.check-in-processing", "入住办理", "main_operating_chain"],
  [8, "lodging.in-stay-management", "在住管理", "main_operating_chain"],
  [9, "lodging.checkout-and-settlement", "退房结算", "main_operating_chain"],
  [10, "lodging.cancel-noshow-refund-intake", "取消、未到店与退款处理", "main_operating_chain"],
  [11, "lodging.housekeeping-maintenance-outofservice", "房务、维修与停售协同", "horizontal_support_chain"],
  [12, "lodging.channel-corporate-customer", "渠道与企业客户", "horizontal_support_chain"],
  [13, "lodging.reporting-audit-review", "经营报表、审计与复盘", "readonly_governance_chain"]
];
const expectedStates = new Map([
  ["基础就绪", [1]],
  ["可运营", [2]],
  ["可定价", [3]],
  ["可报价", [4]],
  ["可锁定", [5]],
  ["已预订", [5]],
  ["财务满足/担保满足", [6]],
  ["可入住", [7]],
  ["在住", [7]],
  ["退房结算", [9]],
  ["取消/未到店关闭", [10]],
  ["房务维修作业完成", [11]],
  ["渠道/企业资格", [12]],
  ["报表审计复盘", [13]]
]);
const expectedObjectOwners = new Map([
  ["Room", [1]],
  ["BedSet", [1]],
  ["Bed", [1]],
  ["BasicReadiness", [1]],
  ["OperationStatus", [2]],
  ["OperationBlocker", [2]],
  ["Product", [3]],
  ["SellableUnit", [3]],
  ["RatePlan", [3]],
  ["PriceVersion", [3]],
  ["Inquiry", [4]],
  ["Quote", [4]],
  ["QuoteVersion", [4]],
  ["QuoteSnapshot", [4]],
  ["InventoryHold", [5]],
  ["Reservation", [5]],
  ["ReservationNo", [5]],
  ["PaymentIntent", [6]],
  ["DepositIntent", [6]],
  ["GuaranteeRecord", [6]],
  ["FinanceConfirmationSnapshot", [6]],
  ["Stay", [7, 8]],
  ["Resident", [7, 8]],
  ["Occupancy", [7, 8]],
  ["AccessCredential", [7, 8]],
  ["CheckoutCase", [9]],
  ["FeeSettlementDraft", [9]],
  ["ResourceRecoveryRequest", [9]],
  ["CancellationCase", [10]],
  ["NoShowCase", [10]],
  ["RefundRequestIntent", [10]],
  ["InventoryReleaseRequest", [10]],
  ["HousekeepingTask", [11]],
  ["MaintenanceTask", [11]],
  ["WorkVerification", [11]],
  ["RecoveryRecommendation", [11]],
  ["ChannelPartner", [12]],
  ["CorporateAccount", [12]],
  ["AgreementEligibility", [12]],
  ["PublicationRule", [12]],
  ["ReportSnapshot", [13]],
  ["MetricSnapshot", [13]],
  ["AuditFinding", [13]],
  ["ActionPlan", [13]]
]);
const requiredFieldClasses = [
  "userFilled",
  "userSelected",
  "upstreamReadonly",
  "systemGenerated",
  "systemCalculated",
  "evidenceBound",
  "financeConfirmed",
  "internalAudit"
];
const forbiddenUserInputFields = [
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
const expectedOldPackageMap = new Map([
  ["resource-saleability", [1, 2]],
  ["lead-reservation", [4, 5]],
  ["RatePlanConfirm", [3]],
  ["ordinary-payment", [6]],
  ["deposit-liability", [6]],
  ["check-in", [7]],
  ["service-task", [8, 11]],
  ["checkout-settlement", [9]],
  ["period-review", [13]]
]);
const failures = [];

const authority = readJson(authorityPath);
const index = readJson(authorityIndexPath);

if (authority.version !== "oam.dormitory.13-scenario-control-source-authority.v1") fail("authority version invalid.");
if (authority.status !== "authoritative") fail("authority status must be authoritative.");
if (authority.authorityId !== "Dormitory.Operating13ScenarioControl") fail("authorityId must be Dormitory.Operating13ScenarioControl.");
if ("generated" in authority || "doNotEdit" in authority || authority.manualEditAllowed !== true) fail("authority must be manual source and must not declare generated/doNotEdit markers.");
if (authority.finalSafety?.releaseAuthority !== false || authority.finalSafety?.finalGoNoGo !== "NO_GO") fail("authority final safety must keep NO_GO.");

checkIndexRegistration();
checkScenarios();
checkStateLadder();
checkObjectOwnership();
checkFieldSources();
checkCrudPolicy();
checkEvidencePolicy();
checkFinanceBoundary();
checkPageEntryPolicy();
checkEntryAdmissionContract();
checkOldPackageIsolation();
checkTestStandard();
checkRuntimeConsumptionBoundary();

const result = {
  version: "oam.dormitory-13-scenario-control-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  authorityDigest: digestFile(authorityPath),
  scenarioCount: authority.scenarios?.length ?? 0,
  stateCount: authority.stateLadder?.length ?? 0,
  objectOwnershipCount: expectedObjectOwners.size,
  oldPackageMappingCount: authority.oldPackageMigrationMap?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory 13 scenario control authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory 13 scenario control authority check: PASS (${result.authorityDigest})`);

function checkIndexRegistration() {
  const entry = (index.entries ?? []).find((item) => item.path === authorityPath);
  if (!entry) {
    fail("authority index missing 13 scenario control Source entry.");
    return;
  }
  if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail("13 scenario control must be source/sourceKernel.");
  if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) {
    fail("13 scenario control must be current business and contract Source.");
  }
  if (entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) {
    fail("13 scenario control index entry must be manual source.");
  }
  if (entry.checker !== "scripts/business/check-dormitory-13-scenario-control-authority.mjs") {
    fail("13 scenario control checker must be check-dormitory-13-scenario-control-authority.mjs.");
  }
  const sourceModel = new Set(index.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((index.sourceLayerWhitelist ?? []).map((item) => item.path));
  if (!sourceModel.has(authorityPath)) fail("classificationModel.sourceLayerWhitelist missing 13 scenario control.");
  if (!sourceMirror.has(authorityPath)) fail("sourceLayerWhitelist mirror missing 13 scenario control.");
  for (const oldPath of oldSourcePaths) {
    if (sourceModel.has(oldPath) || sourceMirror.has(oldPath)) fail(`${oldPath} must not remain in Source Layer whitelist.`);
    const oldEntry = (index.entries ?? []).find((item) => item.path === oldPath);
    if (oldEntry?.layer === "source" || oldEntry?.currentTruthAllowed === true || oldEntry?.businessFactAuthorityAllowed === true) {
      fail(`${oldPath} must be migration reference only, not current business Source.`);
    }
  }
}

function checkScenarios() {
  const scenarios = authority.scenarios ?? [];
  if (scenarios.length !== 13) fail("authority must define exactly 13 scenarios.");
  const byNo = new Map(scenarios.map((item) => [item.scenarioNo, item]));
  for (const [no, id, name, layer] of expectedScenarios) {
    const scenario = byNo.get(no);
    if (!scenario) {
      fail(`missing scenario ${no}.`);
      continue;
    }
    if (scenario.scenarioId !== id) fail(`scenario ${no} id mismatch.`);
    if (scenario.nameZh !== name) fail(`scenario ${no} name mismatch.`);
    if (scenario.chainLayer !== layer) fail(`scenario ${no} layer mismatch.`);
    if (!Array.isArray(scenario.summaryOutputs) || scenario.summaryOutputs.length === 0) fail(`scenario ${no} must define summaryOutputs.`);
    if (!Array.isArray(scenario.pageEntries) || scenario.pageEntries.length === 0) fail(`scenario ${no} must define pageEntries.`);
    if (JSON.stringify(scenario).includes("BUSINESS_LANDING_ADMITTED")) fail(`scenario ${no} must not claim business landing admitted.`);
  }
  assertArray(authority.layerModel?.mainOperatingChain, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "main operating chain");
  assertArray(authority.layerModel?.horizontalSupportChain, [11, 12], "horizontal support chain");
  assertArray(authority.layerModel?.readonlyGovernanceChain, [13], "readonly governance chain");
}

function checkStateLadder() {
  const states = new Map((authority.stateLadder ?? []).map((item) => [item.state, item]));
  for (const [state, producers] of expectedStates) {
    const item = states.get(state);
    if (!item) {
      fail(`missing state ladder item ${state}.`);
      continue;
    }
    assertArray(item.producerScenarios, producers, `state ${state} producers`);
    if (!Array.isArray(item.notEquivalentTo) || item.notEquivalentTo.length === 0) fail(`state ${state} must declare non-equivalence.`);
  }
}

function checkObjectOwnership() {
  const actual = new Map();
  for (const group of authority.objectOwnership ?? []) {
    const owners = group.writeOwnerScenarios ?? [group.writeOwnerScenario];
    for (const objectName of group.objects ?? []) {
      if (actual.has(objectName)) fail(`${objectName} has duplicate ownership groups.`);
      actual.set(objectName, owners);
    }
  }
  for (const [objectName, owners] of expectedObjectOwners) {
    if (!actual.has(objectName)) {
      fail(`missing object ownership for ${objectName}.`);
      continue;
    }
    assertArray(actual.get(objectName), owners, `${objectName} owners`);
  }
}

function checkFieldSources() {
  const matrix = authority.fieldSourceMatrix ?? {};
  for (const field of requiredFieldClasses) {
    if (!Array.isArray(matrix[field]) || matrix[field].length === 0) fail(`field source matrix missing ${field}.`);
  }
  assertArray(authority.forbiddenUserInputFields, forbiddenUserInputFields, "forbidden user input fields");
  for (const forbidden of forbiddenUserInputFields) {
    for (const className of ["userFilled", "userSelected"]) {
      if ((matrix[className] ?? []).includes(forbidden)) fail(`${forbidden} must not be in ${className}.`);
    }
  }
}

function checkCrudPolicy() {
  const policy = authority.crudPolicy ?? {};
  for (const field of ["create", "draftEdit", "confirmedFactEdit", "delete", "read"]) {
    if (!policy[field]) fail(`crud policy missing ${field}.`);
  }
  for (const required of ["currentState", "stateHistory", "evidenceHistory", "legalNextActions"]) {
    if (!(policy.requiredLifecycle ?? []).includes(required)) fail(`crud lifecycle missing ${required}.`);
  }
  if (!String(policy.read ?? "").includes("只读")) fail("read/search/list/dashboard/report must be readonly.");
}

function checkEvidencePolicy() {
  const classes = authority.evidencePolicy?.classes ?? {};
  for (const field of ["requiredEvidence", "supplementableEvidence", "systemAutoBoundEvidence", "internalAuditEvidence"]) {
    if (!classes[field]) fail(`evidence policy missing ${field}.`);
  }
  if (authority.evidencePolicy?.noSideEffectsRequired !== true) fail("evidence failures must require no side effects.");
}

function checkFinanceBoundary() {
  const boundary = authority.financeBoundary ?? {};
  assertArray(boundary.exclusiveTruthWriters, ["finance-gate", "finance-kernel"], "finance truth writers");
  for (const objectName of ["Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "FinanceReceipt"]) {
    if (!(boundary.financeTruthObjects ?? []).includes(objectName)) fail(`finance truth object missing ${objectName}.`);
  }
  for (const forbidden of ["押金不是收入", "担保不是收款", "退款申请不是退款到账", "应退应补不是账务真值", "维修费用意向不是成本入账"]) {
    if (!(boundary.forbiddenEquivalences ?? []).includes(forbidden)) fail(`finance forbidden equivalence missing ${forbidden}.`);
  }
}

function checkPageEntryPolicy() {
  const policy = authority.pageEntryPolicy ?? {};
  for (const entry of ["today", "workItems", "search", "mine"]) {
    if (!policy[entry]) fail(`page entry policy missing ${entry}.`);
  }
  if (!String(policy.search ?? "").includes("只读")) fail("search entry must be readonly.");
  for (const required of ["当前状态", "缺失项", "下一步动作", "不可提交原因", "完成摘要"]) {
    if (!(policy.displayRequirements ?? []).includes(required)) fail(`page display requirement missing ${required}.`);
  }
}

function checkEntryAdmissionContract() {
  const contract = authority.entryAdmissionContract ?? {};
  if (contract.version !== "oam.dormitory.entry-admission-contract.v1") fail("entry admission contract version mismatch.");
  for (const object of ["EntryResult", "SearchResult", "WorkItem"]) {
    if (!(contract.objects ?? []).includes(object)) fail(`entry admission contract missing object ${object}.`);
  }
  for (const field of ["businessTitle", "businessSummary", "legalActions", "admissionDecision", "nextAction", "cannotSubmitReason", "readonlyReason", "sourceScenario"]) {
    if (!(contract.requiredFields ?? []).includes(field)) fail(`entry admission contract missing required field ${field}.`);
  }
  for (const step of ["LegalAction Resolver", "Admission Attach", "Runtime Prepare", "WorkItem"]) {
    if (!(contract.resolverChain ?? []).includes(step)) fail(`entry admission resolver chain missing ${step}.`);
  }
  const rules = contract.rules ?? {};
  for (const rule of ["frontendButtonJudgementForbidden", "searchReadonlyOnly", "searchLearningOnlyForbidden", "correctionRequiresAdmission", "oldWStayCurrentEntryForbidden", "writeFactsOnlyThroughOperationsRuntime"]) {
    if (rules[rule] !== true) fail(`entry admission rule ${rule} must be true.`);
  }
  for (const field of ["action", "label", "view", "allowed", "writeBusinessFact", "admissionDecision"]) {
    if (!(contract.legalActionFields ?? []).includes(field)) fail(`entry admission legalAction field missing ${field}.`);
  }
  if (!String(contract.sourceScenarioRuleZh ?? "").includes("不得把旧 W-STAY 包当当前主链")) {
    fail("entry admission contract must forbid old W-STAY current entry.");
  }
}

function checkOldPackageIsolation() {
  const mapping = new Map((authority.oldPackageMigrationMap ?? []).map((item) => [item.oldPackage, item]));
  for (const [oldPackage, scenarios] of expectedOldPackageMap) {
    const item = mapping.get(oldPackage);
    if (!item) {
      fail(`missing oldPackage migration mapping ${oldPackage}.`);
      continue;
    }
    assertArray(item.mapsToScenarios, scenarios, `${oldPackage} migration target`);
    if (!String(item.allowedUse ?? "").includes("参考")) fail(`${oldPackage} must be reference only.`);
    if (!String(item.forbiddenUse ?? "").includes("不得")) fail(`${oldPackage} must declare forbidden use.`);
  }
  const isolation = authority.oldPackageIsolationPolicy ?? {};
  if (isolation.mustBeLabeledAs !== "migration_reference_only") fail("oldPackage packages must be labeled migration_reference_only.");
  for (const forbidden of ["业务用户可见页面", "总控主索引", "当前 Source Authority 名称"]) {
    if (!(isolation.forbiddenIn ?? []).includes(forbidden)) fail(`oldPackage isolation missing forbidden zone ${forbidden}.`);
  }
}

function checkTestStandard() {
  const standard = authority.testStandard ?? {};
  for (const required of ["positiveBrowserScreenshot", "negativeBrowserScreenshot", "screenshotAnalysis", "noSideEffectsProof"]) {
    if (!(standard.perScenarioRequiredEvidence ?? []).includes(required)) fail(`test standard missing ${required}.`);
  }
  for (const negativeCase of ["缺字段", "缺证据", "重复提交", "并发冲突", "伪造内部 ID", "越权操作", "跨场景提前操作", "搜索写事实", "报表写事实", "已确认事实原地编辑", "直接写账", "旧包越权"]) {
    if (!(standard.globalNegativeCases ?? []).includes(negativeCase)) fail(`test standard missing negative case ${negativeCase}.`);
  }
}

function checkRuntimeConsumptionBoundary() {
  const boundary = authority.runtimeConsumptionBoundary ?? {};
  for (const field of ["runtime", "surface", "readModelSearchDashboardReport", "financeGate", "forbidden"]) {
    if (!boundary[field]) fail(`runtime consumption boundary missing ${field}.`);
  }
  if (!String(boundary.readModelSearchDashboardReport).includes("只读")) fail("read model/search/dashboard/report must be readonly.");
  if (!String(boundary.financeGate).includes("账务真值")) fail("finance gate must own finance truth.");
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
