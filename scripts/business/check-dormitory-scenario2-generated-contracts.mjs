import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario2-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario2-resource-operation-status-contracts.mjs";
const generatedFiles = [
  "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json",
  "docs/contracts/generated/dormitory/scenario2-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario2-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario2-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json"
];
const failures = [];
const scenarioDigest = fileDigest(scenarioPath);
const packageIndexDigest = fileDigest(packageIndexPath);
const documents = new Map();
const expectedObjects = [
  "OperationResource",
  "RoomOperationStatus",
  "BedOperationStatus",
  "OperationInspection",
  "OperationBlocker",
  "OperationStatusChange",
  "OperationRestore",
  "OperationEvidence",
  "StatusHistory"
];
const expectedStatuses = [
  "可运营",
  "暂不可运营",
  "部分不可运营",
  "暂停开放",
  "维修中",
  "保洁中",
  "停售",
  "异常待处理",
  "待复查",
  "已恢复"
];
const expectedRuntimeStatusValues = [
  "operable",
  "temporarily_unavailable",
  "partially_operable",
  "paused",
  "maintenance",
  "cleaning",
  "stopped",
  "exception_pending",
  "needs_recheck",
  "restored"
];

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
  if (document.authorityId !== "Dormitory.Scenario2.ResourceOperationStatus" || document.scenarioPackageNo !== 2) fail(`${file} must bind scenario 2 authority.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
  const expectedDigest = digestObject({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
}

const canonical = documents.get("docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json");
const objectState = documents.get("docs/contracts/generated/dormitory/scenario2-object-state-model.generated.json");
const stepsFields = documents.get("docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json");
const crudPolicy = documents.get("docs/contracts/generated/dormitory/scenario2-crud-policy.generated.json");
const runtimeRules = documents.get("docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json");
const surfaceNavigation = documents.get("docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json");
const handoff = documents.get("docs/contracts/generated/dormitory/scenario2-handoff.generated.json");
const testPlan = documents.get("docs/contracts/generated/dormitory/scenario2-test-plan.generated.json");
const mobileMirror = documents.get("apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json");
const runtimeMirror = documents.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json");

if (canonical?.nameZh !== "房源运营就绪与状态维护") fail("canonical generated contract must expose 房源运营就绪与状态维护.");
if (canonical?.upstream?.allowedSourcePackageNo !== 1) fail("canonical must read package 1 only.");
if (canonical?.downstream?.allowedConsumerPackageNo !== 3) fail("canonical must hand off to package 3 only.");
assertArray(objectState?.objects?.map((item) => item.objectName), expectedObjects, "object-state generated object set");
assertArray(objectState?.operationStatusOptions, expectedStatuses, "object-state generated status options");
if (!JSON.stringify(objectState?.statusOwnership ?? {}).includes("基础就绪不等于运营状态")) fail("object-state model must separate basic readiness and operation.");
if ((stepsFields?.steps ?? []).length !== 6) fail("steps-fields generated contract must contain exactly 6 steps.");
for (const step of ["选择已基础就绪房源", "运营检查", "设置运营状态", "影响确认", "日常状态维护", "恢复运营"]) {
  if (!JSON.stringify(stepsFields?.steps ?? []).includes(step)) fail(`steps-fields missing ${step}.`);
}
for (const internal of ["operationStatusId", "inspectionId", "roomId", "bedId", "workItemId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
  if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`steps-fields forbidden fields missing ${internal}.`);
}
if (crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("generated CRUD read policy must be readonly.");
for (const failure of runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) fail(`${failure.failureCode} must have no side effects.`);
}
for (const command of runtimeRules?.commands ?? []) {
  if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true) fail(`${command.commandId} must consume idempotency/concurrency rules.`);
  for (const forbidden of ["价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务"]) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden write ${forbidden}.`);
  }
}
if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search generated policy must be readonly.");
if (!String(surfaceNavigation?.surfaceNavigation?.todayZh ?? "").includes("今天需要处理的被动任务")) fail("today generated policy must be passive tasks only.");
if (!String(handoff?.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("handoff generated contract must forbid downstream refill.");
assertArray(handoff?.readSideOutputs, ["房间/床位运营状态摘要", "阻断原因", "预计恢复时间", "可否进入价格维护", "证据摘要", "状态历史", "只读对象引用"], "handoff read side outputs");
if ((testPlan?.positiveBrowserTestPlan ?? []).length < 10 || (testPlan?.negativeBrowserTestPlan ?? []).length < 12) fail("test plan must include required positive and negative cases.");
if (mobileMirror?.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (runtimeMirror?.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
assertArray(runtimeMirror?.operationStatusOptions, expectedStatuses, "runtime mirror status options");
const runtimeExecution = runtimeMirror?.runtimeExecution;
if (!runtimeExecution) fail("runtime mirror must include runtimeExecution for executable generated projection.");
if (runtimeExecution?.workspaceId !== "W-DORM-RESOURCE-OPERATION-STATUS") fail("runtimeExecution workspaceId mismatch.");
if (runtimeExecution?.sliceId !== "Dormitory.Scenario2.ResourceOperationStatus") fail("runtimeExecution sliceId mismatch.");
if (runtimeExecution?.status !== "runtime-test-admitted") fail("runtimeExecution must remain runtime-test-admitted.");
if ((runtimeExecution?.steps ?? []).length !== 6) fail("runtimeExecution must expose 6 executable steps.");
if ((runtimeExecution?.definitions ?? []).length !== 6) fail("runtimeExecution must expose 6 work item definitions.");
if (Object.keys(runtimeExecution?.startAdapterDefinitionIds ?? {}).length !== 6) fail("runtimeExecution must expose 6 start adapter definition ids.");
if (!JSON.stringify(runtimeExecution?.searchCommands ?? []).includes("设置房间营业状态")) fail("runtimeExecution search command must use business copy.");
if (!JSON.stringify(runtimeExecution?.searchCommands ?? []).includes("房源运营")) fail("runtimeExecution search command must include scenario 2 business search term.");
assertArray((runtimeExecution?.optionSets?.operationStatus ?? []).map((item) => item.value), expectedRuntimeStatusValues, "runtimeExecution operationStatus stable values");
for (const option of runtimeExecution?.optionSets?.operationStatus ?? []) {
  for (const language of ["zh-CN", "ru-RU", "ky-KG"]) {
    if (!option.label?.[language]) fail(`runtimeExecution operationStatus ${option.value} missing ${language} label.`);
  }
}
for (const step of runtimeExecution?.steps ?? []) {
  for (const evidence of step.evidence ?? []) {
    for (const language of ["zh-CN", "ru-RU", "ky-KG"]) {
      if (!evidence.label?.[language]) fail(`runtimeExecution evidence ${evidence.evidenceId} missing ${language} label.`);
    }
    if (evidence.label?.["ru-RU"] === evidence.label?.["zh-CN"] || evidence.label?.["ky-KG"] === evidence.label?.["zh-CN"]) {
      fail(`runtimeExecution evidence ${evidence.evidenceId} must not fall back to Chinese outside zh-CN.`);
    }
  }
  for (const field of step.fields ?? []) {
    if (["saveDraft", "backToEdit"].includes(field.fieldId)) {
      fail(`runtimeExecution action ${field.fieldId} must not be rendered as a business field.`);
    }
    if (step.cardId === "cert.setOperationStatus" && field.fieldId === "expectedRestoreAt" && field.required === true) {
      fail("runtimeExecution expectedRestoreAt must not block operable status submission.");
    }
    if (field.ui?.control === "select" && (!field.ui?.optionSet || (field.ui?.options ?? []).length === 0)) {
      fail(`runtimeExecution select field ${field.fieldId} must bind optionSet and options.`);
    }
    for (const language of ["zh-CN", "ru-RU", "ky-KG"]) {
      if (!field.label?.[language]) fail(`runtimeExecution field ${field.fieldId} missing ${language} label.`);
    }
  }
}
const registry = readJsonIfExists("docs/contracts/definition/workitem-definition-registry.json");
for (const definition of runtimeExecution?.definitions ?? []) {
  if (!registry?.definitions?.some((item) => item.definitionId === definition.definitionId)) {
    fail(`definition registry missing runtimeExecution definition ${definition.definitionId}.`);
  }
}

const result = {
  version: "oam.dormitory-scenario2-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 2 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 2 generated contracts check: PASS (${generatedFiles.length} files)`);

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
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function assertArray(actual, expected, label) {
  const left = JSON.stringify([...(actual ?? [])].sort());
  const right = JSON.stringify([...expected].sort());
  if (left !== right) fail(`${label} mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual ?? [])}.`);
}

function fail(message) {
  failures.push(message);
}
