import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario1-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario1-resource-basic-readiness-contracts.mjs";
const generatedFiles = [
  "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json",
  "docs/contracts/generated/dormitory/scenario1-object-model.generated.json",
  "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario1-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario1-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json"
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
  if (document.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness" || document.scenarioPackageNo !== 1) fail(`${file} must bind scenario 1 authority.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
  const expectedDigest = digestObject({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
}

const canonical = documents.get("docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json");
const objectModel = documents.get("docs/contracts/generated/dormitory/scenario1-object-model.generated.json");
const stepsFields = documents.get("docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json");
const crudPolicy = documents.get("docs/contracts/generated/dormitory/scenario1-crud-policy.generated.json");
const runtimeRules = documents.get("docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json");
const surfaceNavigation = documents.get("docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json");
const handoff = documents.get("docs/contracts/generated/dormitory/scenario1-handoff.generated.json");
const testPlan = documents.get("docs/contracts/generated/dormitory/scenario1-test-plan.generated.json");
const mobileMirror = documents.get("apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json");
const runtimeMirror = documents.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json");

if (canonical?.nameZh !== "房源建档与基础就绪") fail("canonical generated contract must expose 房源建档与基础就绪.");
if (JSON.stringify(objectModel?.objects?.map((item) => item.objectName) ?? []) !== JSON.stringify(["BuildingContext", "Room", "BedSet", "Bed", "BasicReadiness", "EvidenceBinding", "StatusHistory"])) {
  fail("object model generated contract must contain the scenario 1 object set.");
}
if (objectModel?.bedGenerationRule?.onlySourceOfBedQuantity !== "room.bedCount") fail("object model must bind bed quantity to room.bedCount.");
if ((stepsFields?.steps ?? []).length !== 3) fail("steps-fields generated contract must contain exactly 3 steps.");
const labels = stepsFields?.steps?.find((step) => step.stepId === "basic-readiness-confirmation")?.conclusionOptions?.map((item) => item.labelZh) ?? [];
if (JSON.stringify(labels) !== JSON.stringify(["通过", "不通过", "需补充"])) fail("basic readiness generated options must be 通过/不通过/需补充.");
if (crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("generated CRUD read policy must be readonly.");
for (const failure of runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) fail(`${failure.failureCode} must have no side effects.`);
}
for (const command of runtimeRules?.commands ?? []) {
  for (const forbidden of ["运营状态", "价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务"]) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden write ${forbidden}.`);
  }
}
if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search generated policy must be readonly.");
if (!String(handoff?.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("handoff generated contract must forbid downstream refill.");
if ((testPlan?.positiveBrowserTestPlan ?? []).length < 10 || (testPlan?.negativeBrowserTestPlan ?? []).length < 12) fail("test plan must include required positive and negative cases.");
if (mobileMirror?.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (runtimeMirror?.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");

const result = {
  version: "oam.dormitory-scenario1-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 1 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 1 generated contracts check: PASS (${generatedFiles.length} files)`);

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
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function fail(message) {
  failures.push(message);
}
