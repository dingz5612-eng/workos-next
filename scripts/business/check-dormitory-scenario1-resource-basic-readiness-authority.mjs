import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario1-resource-basic-readiness-authority-result.json";
const failures = [];
const expectedObjects = ["BuildingContext", "Room", "BedSet", "Bed", "BasicReadiness", "EvidenceBinding", "StatusHistory"];
const expectedSteps = [
  ["room-filing", "房间建档", "Dorm.RoomSetupConfirm", "房间建档确认"],
  ["bedset-confirmation", "床位组确认", "Dorm.BedSetupConfirm", "床位组确认"],
  ["basic-readiness-confirmation", "基础就绪确认", "Dorm.ResourceReadinessConfirm", "基础就绪确认"]
];
const expectedFirstFive = [
  [1, "房源建档与基础就绪"],
  [2, "房源运营就绪与状态维护"],
  [3, "住宿商品与价格"],
  [4, "询价与报价"],
  [5, "预订与库存锁定"]
];
const forbiddenUserInput = ["roomId", "bedId", "workItemId", "stableRef", "projectionVersion", "digest", "domainEventId"];
const forbiddenRuntimeWrites = ["运营状态", "价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务"];

const scenario = readJson(scenarioPath);
const packageIndex = readJson(packageIndexPath);
const authorityIndex = readJson(authorityIndexPath);

checkPackageIndex();
checkAuthorityIndexRegistration();
checkScenarioHeader();
checkObjects();
checkStepsAndFields();
checkCrud();
checkCommandsAndFailures();
checkInvariantsAndEvidence();
checkSurfaceBoundary();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario1-resource-basic-readiness-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  objectCount: scenario.objects?.length ?? 0,
  stepCount: scenario.steps?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 1 resource basic readiness authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 1 resource basic readiness authority check: PASS (${result.scenarioDigest})`);

function checkPackageIndex() {
  if (packageIndex.version !== "oam.dormitory.lodging-scenario-package-index-source-authority.v1") fail("package index version invalid.");
  if (packageIndex.status !== "authoritative" || packageIndex.authorityId !== "Dormitory.LodgingScenarioPackageIndex") fail("package index identity invalid.");
  if (packageIndex.manualEditAllowed !== true || "generated" in packageIndex || "doNotEdit" in packageIndex) fail("package index must be manual Source.");
  const byNo = new Map((packageIndex.scenarioPackageOrder ?? []).map((item) => [item.packageNo, item]));
  for (const [no, nameZh] of expectedFirstFive) {
    const item = byNo.get(no);
    if (!item) {
      fail(`package index missing package ${no}.`);
      continue;
    }
    if (item.nameZh !== nameZh) fail(`package ${no} name must be ${nameZh}.`);
  }
  const first = byNo.get(1);
  if (JSON.stringify(first?.downstreamPackages ?? []) !== JSON.stringify([2])) fail("package 1 must hand off only to package 2.");
  for (const forbidden of ["可运营", "可报价", "可预订", "可售"]) {
    if (!(first?.mustNotOutputZh ?? []).includes(forbidden)) fail(`package 1 must forbid output ${forbidden}.`);
  }
  const isolation = packageIndex.oldProjectExpressionIsolation ?? {};
  for (const oldExpression of ["resource-saleability", "golden-chain", "lead-reservation"]) {
    if (!(isolation.forbiddenAsNewBusinessSource ?? []).includes(oldExpression)) fail(`${oldExpression} must be forbidden as new business Source.`);
  }
}

function checkAuthorityIndexRegistration() {
  for (const [file, checker, evidence] of [
    [packageIndexPath, "scripts/business/check-dormitory-scenario1-resource-basic-readiness-authority.mjs", resultPath],
    [scenarioPath, "scripts/business/check-dormitory-scenario1-resource-basic-readiness-authority.mjs", resultPath]
  ]) {
    const entry = (authorityIndex.entries ?? []).find((item) => item.path === file);
    if (!entry) {
      fail(`authority index missing Source entry ${file}.`);
      continue;
    }
    if (entry.layer !== "source" || entry.authorityRole !== "sourceKernel") fail(`${file} must be source/sourceKernel.`);
    if (entry.currentTruthAllowed !== true || entry.businessFactAuthorityAllowed !== true || entry.contractAuthorityAllowed !== true) {
      fail(`${file} must be current business and contract Source.`);
    }
    if (entry.runtimeWriteAllowed !== false || entry.generated !== false || entry.doNotEdit !== false || entry.manualEditAllowed !== true) {
      fail(`${file} index entry must be manual non-runtime Source.`);
    }
    if (entry.checker !== checker || entry.evidence !== evidence) fail(`${file} checker/evidence registration mismatch.`);
  }
  const sourceModel = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
  const sourceMirror = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
  for (const file of [packageIndexPath, scenarioPath]) {
    if (!sourceModel.has(file)) fail(`classificationModel.sourceLayerWhitelist missing ${file}.`);
    if (!sourceMirror.has(file)) fail(`sourceLayerWhitelist mirror missing ${file}.`);
  }
}

function checkScenarioHeader() {
  if (scenario.version !== "oam.dormitory.scenario1-resource-basic-readiness-source-authority.v1") fail("scenario authority version invalid.");
  if (scenario.status !== "authoritative" || scenario.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness") fail("scenario authority identity invalid.");
  if (scenario.manualEditAllowed !== true || "generated" in scenario || "doNotEdit" in scenario) fail("scenario authority must be manual Source.");
  if (scenario.scenarioPackageNo !== 1 || scenario.nameZh !== "房源建档与基础就绪") fail("scenario package 1 name invalid.");
  if (scenario.downstream?.allowedConsumerPackageNo !== 2) fail("scenario 1 downstream must be package 2 only.");
  for (const forbidden of ["可运营", "可报价", "可预订", "可售"]) {
    if (!(scenario.downstream?.forbiddenOutputsZh ?? []).includes(forbidden)) fail(`scenario downstream must forbid ${forbidden}.`);
  }
}

function checkObjects() {
  const objectNames = (scenario.objects ?? []).map((item) => item.objectName);
  assertArray(objectNames, expectedObjects, "scenario objects");
  const basicReadiness = (scenario.objects ?? []).find((item) => item.objectName === "BasicReadiness");
  if (!basicReadiness) return;
  if (!String(basicReadiness.descriptionZh ?? "").includes("不等于可运营、可报价、可预订或可售")) {
    fail("BasicReadiness must explicitly be non-equivalent to operation/quote/reservation/saleability.");
  }
  for (const required of ["currentState", "statusHistory", "evidenceHistory", "legalNextActions"]) {
    for (const object of scenario.objects ?? []) {
      if (!(object.requiredLifecycle ?? []).includes(required)) fail(`${object.objectName} missing lifecycle ${required}.`);
    }
  }
}

function checkStepsAndFields() {
  if ((scenario.steps ?? []).length !== 3) fail("scenario must define exactly 3 business steps.");
  for (const [index, [stepId, nameZh, commandId, businessNameZh]] of expectedSteps.entries()) {
    const step = scenario.steps?.[index];
    if (!step) continue;
    if (step.stepId !== stepId || step.nameZh !== nameZh || step.commandId !== commandId || step.commandBusinessNameZh !== businessNameZh) {
      fail(`step ${index + 1} identity mismatch.`);
    }
  }
  const roomStep = scenario.steps?.[0] ?? {};
  for (const field of ["floor", "roomNo", "bedCount", "roomRemark"]) {
    if (!(roomStep.userFilledFields ?? []).includes(field)) fail(`room filing missing user-filled field ${field}.`);
  }
  const bedStep = scenario.steps?.[1] ?? {};
  if (!(bedStep.systemGeneratedFields ?? []).includes("bedNo[01..N]")) fail("bedset confirmation must generate bedNo[01..N].");
  const readinessStep = scenario.steps?.[2] ?? {};
  const options = readinessStep.conclusionOptions ?? [];
  if (JSON.stringify(options.map((item) => item.labelZh)) !== JSON.stringify(["通过", "不通过", "需补充"])) {
    fail("basic readiness conclusion labels must be 通过/不通过/需补充.");
  }
  for (const internal of forbiddenUserInput) {
    if (!(scenario.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`forbidden user input missing ${internal}.`);
    for (const fieldClass of ["userFilled", "userSelected"]) {
      if ((scenario.fields?.[fieldClass] ?? []).includes(internal)) fail(`${internal} must not be ${fieldClass}.`);
    }
  }
  if (scenario.bedGenerationRule?.onlySourceOfBedQuantity !== "room.bedCount") fail("bed quantity only source must be room.bedCount.");
  if (scenario.bedGenerationRule?.bedNoFormat !== "two_digit_01_to_N") fail("bed no format must be 01..N.");
}

function checkCrud() {
  if (scenario.crudRules?.create?.buttonZh !== "发起房源建档与基础就绪") fail("create button must be 发起房源建档与基础就绪.");
  if (scenario.crudRules?.draftEdit?.allowed !== true) fail("draft edit must be allowed.");
  if (scenario.crudRules?.confirmedFactEdit?.allowed !== false) fail("confirmed inline edit must be forbidden.");
  if (scenario.crudRules?.delete?.physicalDeleteConfirmedFactAllowed !== false) fail("confirmed fact physical delete must be forbidden.");
  if (scenario.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("query/search/list/board/report must be readonly.");
}

function checkCommandsAndFailures() {
  const commandIds = (scenario.commands ?? []).map((item) => item.commandId);
  assertArray(commandIds, expectedSteps.map((step) => step[2]), "scenario commands");
  for (const command of scenario.commands ?? []) {
    if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true) fail(`${command.commandId} must require idempotency and concurrency checks.`);
    for (const forbidden of forbiddenRuntimeWrites) {
      if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} must forbid runtime write ${forbidden}.`);
    }
  }
  const failureByCode = new Map((scenario.failureSemantics ?? []).map((item) => [item.failureCode, item]));
  for (const code of [
    "duplicate_room_no",
    "bed_count_must_be_positive",
    "bed_count_mismatch",
    "bedset_incomplete",
    "missing_required_evidence",
    "forged_internal_reference",
    "stale_version",
    "idempotent_replay",
    "readonly_result_write_attempt",
    "post_confirm_inline_edit_forbidden",
    "cross_scenario_early_operation"
  ]) {
    const item = failureByCode.get(code);
    if (!item) fail(`failure semantics missing ${code}.`);
    if (item?.sideEffectsAllowed !== false) fail(`${code} must have no side effects.`);
  }
}

function checkInvariantsAndEvidence() {
  for (const required of [
    "床位数量唯一来源是 room.bedCount。",
    "room.bedCount = N 时必须生成 Bed 01..N。",
    "查询、搜索、列表、看板、报表永远只读。",
    "运行层不得写运营状态、价格、报价、预订、入住、收款、押金、退款、账务。"
  ]) {
    if (!(scenario.invariants ?? []).includes(required)) fail(`invariant missing ${required}`);
  }
  for (const stepId of ["room-filing", "bedset-confirmation", "basic-readiness-confirmation"]) {
    if (!Array.isArray(scenario.evidence?.requiredEvidenceByStep?.[stepId]) || scenario.evidence.requiredEvidenceByStep[stepId].length === 0) {
      fail(`required evidence missing for ${stepId}.`);
    }
  }
  if (scenario.evidence?.noSideEffectsProofRequired !== true) fail("evidence must require no-side-effects proof.");
  assertArray(scenario.readSideOutputs, ["房间摘要", "床位组摘要", "基础就绪摘要", "证据摘要", "状态历史", "只读对象引用"], "read side outputs");
}

function checkSurfaceBoundary() {
  const nav = scenario.surfaceNavigation ?? {};
  for (const page of ["房源建档入口", "房间建档页", "床位组确认页", "基础就绪确认页", "完成摘要页", "状态历史页", "纠错/作废入口"]) {
    if (!(nav.pages ?? []).includes(page)) fail(`surface navigation missing page ${page}.`);
  }
  if (!String(nav.searchZh ?? "").includes("只读")) fail("search entry must be readonly.");
  const buttonRows = new Map((nav.buttonByState ?? []).map((item) => [item.state, item.buttonsZh]));
  if (!buttonRows.get("draft")?.includes("保存草稿")) fail("draft state must show 保存草稿.");
  if (!buttonRows.get("room_filed")?.includes("确认床位组")) fail("room_filed must show 确认床位组.");
  if (!buttonRows.get("basic_readiness_completed")?.includes("进入运营状态维护")) fail("completed state must show handoff to operation status maintenance.");
  for (const forbidden of ["可售", "可预订", "金链", "生产发布", "final GO"]) {
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
