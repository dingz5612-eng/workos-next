import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario3-product-and-pricing-contracts.mjs";
const generatedFiles = [
  "docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json",
  "docs/contracts/generated/dormitory/scenario3-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario3-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario3-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario3-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario3-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario3-product-and-pricing.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario3ProductAndPricing.generated.json"
];
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath);
const packageIndexDigest = fileDigest(packageIndexPath);
const documents = new Map();

for (const file of generatedFiles) {
  const document = readJsonIfExists(file);
  if (!document) {
    fail(`${file} is missing.`);
    continue;
  }
  documents.set(file, document);
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated and doNotEdit.`);
  if (document.generatedBy !== generatedBy) fail(`${file} generatedBy mismatch.`);
  if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify([scenarioPath, packageIndexPath])) fail(`${file} generatedFrom mismatch.`);
  if (document.sourceContentDigest !== scenarioDigest) fail(`${file} sourceContentDigest mismatch.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) fail(`${file} packageIndexContentDigest mismatch.`);
  if (document.authorityId !== "Dormitory.Scenario3.ProductAndPricing" || document.scenarioPackageNo !== 3) fail(`${file} must bind scenario 3 authority.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
  const expectedDigest = digestObject({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
}

const canonical = documents.get("docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json");
const objectState = documents.get("docs/contracts/generated/dormitory/scenario3-object-state-model.generated.json");
const stepsFields = documents.get("docs/contracts/generated/dormitory/scenario3-steps-fields.generated.json");
const crudPolicy = documents.get("docs/contracts/generated/dormitory/scenario3-crud-policy.generated.json");
const runtimeRules = documents.get("docs/contracts/generated/dormitory/scenario3-runtime-rules.generated.json");
const surfaceNavigation = documents.get("docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json");
const handoff = documents.get("docs/contracts/generated/dormitory/scenario3-handoff.generated.json");
const testPlan = documents.get("docs/contracts/generated/dormitory/scenario3-test-plan.generated.json");
const mobileMirror = documents.get("apps/mobile/src/generated/oam/dormitory-scenario3-product-and-pricing.generated.json");
const runtimeMirror = documents.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario3ProductAndPricing.generated.json");

if (canonical?.nameZh !== "住宿商品与价格") fail("canonical generated contract must expose 住宿商品与价格.");
assertArray(canonical?.upstream?.allowedSourcePackageNos, [1, 2], "canonical upstream package set");
if (canonical?.downstream?.allowedConsumerPackageNo !== 4) fail("canonical must hand off to package 4 only.");
assertArray(objectState?.objects?.map((item) => item.objectName), expectedObjects, "object-state generated object set");
assertArray(objectState?.priceStatusOptions, expectedStatuses, "object-state generated price status options");
if (!JSON.stringify(objectState?.stateLayering ?? {}).includes("可运营来自场景包 2")) fail("object-state model must separate scenario 2 operation and scenario 3 pricing.");
if (objectState?.priceConflictRule?.effectiveOverlapAllowed !== false) fail("object-state model must block overlapping effective prices.");
if ((stepsFields?.steps ?? []).length !== 6) fail("steps-fields generated contract must contain exactly 6 steps.");
for (const step of ["选择可运营房源", "定义住宿商品", "配置价格方案", "配置适用日期和规则", "审核与生效确认", "价格维护"]) {
  if (!JSON.stringify(stepsFields?.steps ?? []).includes(step)) fail(`steps-fields missing ${step}.`);
}
for (const internal of ["productId", "ratePlanId", "priceVersionId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
  if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`steps-fields forbidden fields missing ${internal}.`);
}
if (crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("generated CRUD read policy must be readonly.");
if (crudPolicy?.crudRules?.confirmedFactEdit?.allowed !== false) fail("generated CRUD must forbid editing effective facts in place.");
for (const failure of runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) fail(`${failure.failureCode} must have no side effects.`);
}
for (const command of runtimeRules?.commands ?? []) {
  if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true) fail(`${command.commandId} must consume idempotency/concurrency rules.`);
  for (const forbidden of ["Quote", "Reservation", "InventoryHold", "Stay", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction"]) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden write ${forbidden}.`);
  }
}
if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search generated policy must be readonly.");
if (!String(surfaceNavigation?.surfaceNavigation?.todayZh ?? "").includes("被动任务")) fail("today generated policy must be passive tasks only.");
if (!String(handoff?.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("handoff generated contract must forbid downstream refill.");
assertArray(handoff?.readSideOutputs, ["商品摘要", "价格方案摘要", "价格日历摘要", "价格版本历史", "可否进入询价报价", "证据摘要", "只读对象引用"], "handoff read side outputs");
if ((testPlan?.positiveBrowserTestPlan ?? []).length < 10 || (testPlan?.negativeBrowserTestPlan ?? []).length < 13) fail("test plan must include required positive and negative cases.");
if (mobileMirror?.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (runtimeMirror?.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
assertArray(runtimeMirror?.priceStatusOptions, expectedStatuses, "runtime mirror price status options");

const result = {
  version: "oam.dormitory-scenario3-product-and-pricing-generated-contracts-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedFileCount: generatedFiles.length,
  generatedFiles: generatedFiles.map((file) => ({
    path: file,
    outputContentDigest: documents.get(file)?.outputContentDigest ?? null
  })),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 3 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 3 generated contracts check: PASS (${generatedFiles.length} files)`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertArray(actual, expected, label) {
  const left = JSON.stringify([...(actual ?? [])].sort());
  const right = JSON.stringify([...expected].sort());
  if (left !== right) fail(`${label} mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual ?? [])}.`);
}

function fail(message) {
  failures.push(message);
}
