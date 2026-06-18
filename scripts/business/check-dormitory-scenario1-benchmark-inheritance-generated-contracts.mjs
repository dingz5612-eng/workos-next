import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json";
const controlPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const scenario1Path = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario1-benchmark-inheritance-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario1-benchmark-inheritance-contracts.mjs";
const generatedFiles = [
  "docs/contracts/generated/dormitory/scenario1-benchmark-inheritance-contract.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-start-gate.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-difference-checklist-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-field-review-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-button-state-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-screenshot-report-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-failure-attribution-routing.generated.json",
  "docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-benchmark-inheritance.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1BenchmarkInheritance.generated.json"
];
const forbiddenScenario1Objects = ["Room", "BedSet", "Bed", "BasicReadiness"];
const forbiddenInternalIds = ["roomId", "bedId", "ratePlanId", "quoteId", "reservationId", "stayId", "paymentId", "depositId", "refundId", "ledgerEntryId", "stableRef", "digest", "projectionVersion", "domainEventId"];
const failures = [];
const inputDigests = [
  { path: contractPath, digest: fileDigest(contractPath) },
  { path: controlPath, digest: fileDigest(controlPath) },
  { path: scenario1Path, digest: fileDigest(scenario1Path) },
  { path: packageIndexPath, digest: fileDigest(packageIndexPath) }
];
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
  if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify([contractPath, controlPath, scenario1Path, packageIndexPath])) {
    fail(`${file} generatedFrom mismatch.`);
  }
  if (document.sourceContentDigest !== inputDigests[0].digest) fail(`${file} sourceContentDigest mismatch.`);
  if (document.authorityId !== "Dormitory.Scenario1BenchmarkInheritanceContract") fail(`${file} authorityId mismatch.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
  const expectedDigest = digestObject({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
}

const contractGenerated = documents.get("docs/contracts/generated/dormitory/scenario1-benchmark-inheritance-contract.generated.json");
const startGate = documents.get("docs/contracts/generated/dormitory/subsequent-scenario-start-gate.generated.json");
const difference = documents.get("docs/contracts/generated/dormitory/subsequent-scenario-difference-checklist-template.generated.json");
const fieldReview = documents.get("docs/contracts/generated/dormitory/subsequent-scenario-field-review-template.generated.json");
const buttonState = documents.get("docs/contracts/generated/dormitory/subsequent-scenario-button-state-template.generated.json");
const screenshot = documents.get("docs/contracts/generated/dormitory/subsequent-scenario-screenshot-report-template.generated.json");
const failureRouting = documents.get("docs/contracts/generated/dormitory/subsequent-scenario-failure-attribution-routing.generated.json");
const scenario2Trial = documents.get("docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json");
const mobileMirror = documents.get("apps/mobile/src/generated/oam/dormitory-scenario1-benchmark-inheritance.generated.json");
const runtimeMirror = documents.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario1BenchmarkInheritance.generated.json");

if (contractGenerated?.highestBusinessAuthorityId !== "Dormitory.Operating13ScenarioControl") fail("generated contract must keep total control as highest authority.");
if (!JSON.stringify(contractGenerated?.authorityHierarchy ?? {}).includes("场景 1 是实现方法标杆，不是后续场景的业务规则总源。")) {
  fail("generated contract must declare scenario 1 as benchmark only.");
}
if ((startGate?.gate?.appliesToScenarioNos ?? []).length !== 12) fail("start gate must apply to scenarios 2-13.");
if ((startGate?.appliesToScenarios ?? []).some((item) => item.scenarioNo === 1)) fail("start gate must not apply to scenario 1.");
if (!String(startGate?.gate?.blockingRuleZh ?? "").includes("不得开始本场景开发")) fail("start gate must block missing checklist.");
for (const section of ["对象差异", "状态差异", "字段差异", "证据差异", "财务差异", "页面差异", "测试差异"]) {
  if (!(difference?.template?.requiredSections ?? []).includes(section)) fail(`difference generated template missing ${section}.`);
}
for (const object of forbiddenScenario1Objects) {
  if (!(difference?.forbiddenScenario1BusinessObjects ?? []).includes(object)) fail(`difference template must forbid copied object ${object}.`);
}
for (const internalId of forbiddenInternalIds) {
  if (!(fieldReview?.gate?.forbiddenUserInputFields ?? []).includes(internalId)) fail(`field review must forbid ${internalId}.`);
}
if (!String(buttonState?.uxAndButtonGate?.buttonRuleZh ?? "").includes("不得所有状态都显示一个固定提交按钮")) fail("button state generated template missing stateful button rule.");
if (!String(buttonState?.uxAndButtonGate?.entryRules?.search ?? "").includes("只读")) fail("search entry generated rule must be readonly.");
if (!String(screenshot?.template?.rootEvidenceRuleZh ?? "").includes("不得要求每个小改动")) fail("screenshot template must preserve evidence layering.");
if ((failureRouting?.failureAttributionRouting ?? []).length < 8) fail("failure routing generated contract must include all route classes.");
if ((failureRouting?.forbiddenFailureBypassZh ?? []).some((item) => !String(item).includes("不得"))) fail("failure bypass rules must be prohibitions.");
if (scenario2Trial?.trialResult?.status !== "PASS") fail("scenario 2 trial generated result must PASS.");
if (scenario2Trial?.trial?.scenarioNo !== 2 || scenario2Trial?.scenario2ControlRow?.scenarioNo !== 2) fail("scenario 2 trial must bind scenario 2.");
const scenario2Writes = scenario2Trial?.trial?.differenceChecklist?.objectDifference?.writes ?? [];
for (const forbidden of forbiddenScenario1Objects) {
  if (scenario2Writes.includes(forbidden)) fail(`scenario 2 trial must not write ${forbidden}.`);
}
if (scenario2Trial?.trial?.highRiskBoundaries?.operationStatus !== true) fail("scenario 2 trial must flag operationStatus.");
if (scenario2Trial?.trial?.highRiskBoundaries?.mustNotEnterPriceOrReservation !== true) fail("scenario 2 trial must forbid direct price/reservation.");
if (mobileMirror?.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (runtimeMirror?.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
if (runtimeMirror?.globalReadonlyAndFinanceBoundaries?.businessScenarioDirectLedgerWriteAllowed !== false) {
  fail("runtime mirror must forbid direct ledger writes.");
}

const result = {
  version: "oam.dormitory-scenario1-benchmark-inheritance-generated-contracts-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  contractPath,
  controlPath,
  scenario1Path,
  packageIndexPath,
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

if (failures.length) {
  console.error("Dormitory scenario 1 benchmark inheritance generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 1 benchmark inheritance generated contracts check: PASS (${generatedFiles.length} files)`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
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
