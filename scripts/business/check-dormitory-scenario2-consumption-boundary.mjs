import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario2-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario2-handoff.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json"
};
const runtimeRulesPath = "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs";
const runtimeProjectionPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2RuntimeProjection.cs";
const operationsRuntimeServicePath = "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs";
const projectionSeedPath = "services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs";
const searchKernelPath = "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs";
const definitionRegistryPath = "services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs";
const sliceCapabilityGatePath = "services/core-api/WorkOS.Api/Runtime/SliceRuntimeCapabilityGate.cs";
const canonicalOperationsPath = "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs";
const programPath = "services/core-api/WorkOS.Api/Program.cs";
const runtimeTestsPath = "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs";
const failures = [];
const scenarioDigest = fileDigest(scenarioPath);
const packageIndexDigest = fileDigest(packageIndexPath);
const docs = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJson(file)]));

for (const [key, file] of Object.entries(generatedPaths)) {
  const document = docs[key];
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated/doNotEdit.`);
  if (document.sourceContentDigest !== scenarioDigest) fail(`${file} must bind scenario Source digest.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) fail(`${file} must bind package index Source digest.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
}

if (docs.mobileMirror.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (docs.runtimeMirror.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
if (JSON.stringify(docs.mobileMirror.fields?.forbiddenUserInputFields ?? []) !== JSON.stringify(docs.runtimeMirror.fields?.forbiddenUserInputFields ?? [])) {
  fail("surface and runtime mirrors must consume same forbidden internal fields.");
}
for (const internal of ["operationStatusId", "inspectionId", "roomId", "bedId", "workItemId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
  if (!(docs.mobileMirror.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`mobile mirror missing forbidden field ${internal}.`);
  if ((docs.mobileMirror.fields?.userFilled ?? []).includes(internal) || (docs.mobileMirror.fields?.userSelected ?? []).includes(internal)) {
    fail(`mobile mirror exposes ${internal} as user input.`);
  }
}

const commandIds = (docs.runtimeMirror.commands ?? []).map((item) => item.commandId);
if (JSON.stringify(commandIds) !== JSON.stringify(["Dorm.OperationInspectionConfirm", "Dorm.OperationStatusChangeConfirm", "Dorm.OperationBlockerUpdate", "Dorm.OperationRestoreConfirm"])) {
  fail("runtime mirror must expose exactly the four scenario 2 write commands.");
}
for (const command of docs.runtimeMirror.commands ?? []) {
  if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true || command.requiresGeneratedContract !== true) {
    fail(`${command.commandId} must consume generated idempotency/concurrency rules.`);
  }
  for (const forbidden of ["价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务"]) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden runtime write ${forbidden}.`);
  }
}

for (const failure of docs.runtimeMirror.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
}
for (const target of ["CommandSubmission", "DomainEvent", "Outbox", "Projection", "Lens", "Search", "Dashboard", "Ledger"]) {
  if (!(docs.runtimeMirror.runtimeConsumptionBoundary?.failureNoSideEffectTargets ?? []).includes(target)) fail(`runtime mirror no-side-effect targets missing ${target}.`);
}
if (docs.runtimeMirror.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true) fail("runtime must read generated only.");
if (docs.runtimeMirror.runtimeConsumptionBoundary?.runtimeMayHardcodeBusinessRules !== false) fail("runtime hardcoded business rules must be forbidden.");
const restoreTransition = (docs.runtimeMirror.runtimeExecution?.transitions ?? []).find((item) =>
  item.fromDefinitionId === "definition.dormitory.operationBlockerUpdate.v1" &&
  item.toDefinitionId === "definition.dormitory.operationRestoreConfirm.v1");
if (!restoreTransition?.condition ||
  restoreTransition.condition.conditionId !== "generated-transition-condition.dormitory.scenario2.blocker-closed-before-restore.v1") {
  fail("runtime mirror must carry Source Authority guard for blocker-update to restore-operation transition.");
}
const runtimeRulesText = readText(runtimeRulesPath);
const runtimeProjectionText = readText(runtimeProjectionPath);
const operationsRuntimeText = readText(operationsRuntimeServicePath);
const projectionSeedText = readText(projectionSeedPath);
const searchKernelText = readText(searchKernelPath);
const definitionRegistryText = readText(definitionRegistryPath);
const sliceCapabilityGateText = readText(sliceCapabilityGatePath);
const canonicalOperationsText = readText(canonicalOperationsPath);
const programText = readText(programPath);
const runtimeTestsText = readText(runtimeTestsPath);
if (JSON.stringify(docs.runtimeMirror).includes("sample-room-a-3-301") ||
  JSON.stringify(docs.runtimeMirror).includes("A 栋 3 层 301 房间")) {
  fail("runtime mirror must not contain hard-coded sample base-ready resource options; scenario 2 must consume runtime facts from scenario 1.");
}
if (!runtimeRulesText.includes("DormitoryScenario2ResourceOperationStatus.generated.json")) {
  fail("runtime rules must consume DormitoryScenario2ResourceOperationStatus.generated.json.");
}
if (!runtimeRulesText.includes("Scenario2ResourceOperationRuntimeAdapter")) {
  fail("runtime rules must include scenario 2 generated adapter.");
}
if (!runtimeProjectionText.includes("DormitoryScenario2ResourceOperationStatus.generated.json") ||
  !runtimeProjectionText.includes("runtimeExecution") ||
  !runtimeProjectionText.includes("SearchCommands") ||
  !runtimeProjectionText.includes("StartAdapterDefinitionIds") ||
  !runtimeProjectionText.includes("TransitionRules")) {
  fail("DormitoryScenario2RuntimeProjection must consume runtimeExecution for workspace/search/definition/transition.");
}
if (!projectionSeedText.includes("DormitoryScenario2RuntimeProjection.Workspace()")) {
  fail("ProjectionSeed must seed scenario 2 generated workspace.");
}
if (!searchKernelText.includes("DormitoryScenario2RuntimeProjection.SearchCommands()")) {
  fail("SearchKernelService must consume scenario 2 generated search commands.");
}
if (!searchKernelText.includes("[\"nextAction\"]") || !runtimeProjectionText.includes("GetProperty(\"nextAction\")")) {
  fail("SearchKernelService must expose generated command nextAction from scenario 2 runtime projection.");
}
if (!definitionRegistryText.includes("DormitoryScenario2RuntimeProjection.StartAdapterDefinitionIds()")) {
  fail("WorkItemDefinitionRegistryService must consume scenario 2 generated start adapter definitions.");
}
if (!sliceCapabilityGateText.includes("DormitoryScenario2RuntimeProjection.RuntimeCapability()") ||
  !sliceCapabilityGateText.includes("DormitoryScenario2RuntimeProjection.SliceId")) {
  fail("SliceRuntimeCapabilityGate must consume scenario 2 runtime capability.");
}
if (!canonicalOperationsText.includes("DormitoryScenario2RuntimeProjection.TransitionRules()") ||
  !canonicalOperationsText.includes("GeneratedTransitionPolicy.CarryForwardPayload") ||
  !canonicalOperationsText.includes("ConditionSatisfied(rule.Condition, current, fieldValues)") ||
  !canonicalOperationsText.includes("DormitoryScenario2RuntimeProjection.StartContext") ||
  !canonicalOperationsText.includes("catalog.ListWorkItems(actor.TenantId)")) {
  fail("CanonicalOperationsApiService must consume scenario 2 generated transitions, transition conditions, and context carry-forward.");
}
if (!canonicalOperationsText.includes("GetWorkItemSurface(workItem.WorkItemId, actor)") ||
  !canonicalOperationsText.includes("ListWorkItemSurfaces(actor, operationCase.CaseId, workspace.Id)") ||
  !canonicalOperationsText.includes("OperationsWorkItemSurface WorkItem")) {
  fail("Operations workspace start must return payload-aware work item surfaces so first render consumes scenario 2 runtime options.");
}
if (!programText.includes("DormitoryScenario2RuntimeProjection.WorkspaceId")) {
  fail("Operations workspace start endpoint must allow scenario 2 generated workspace id.");
}
if (!operationsRuntimeText.includes("DormitoryScenario2RuntimeProjection.CardFor") ||
  !operationsRuntimeText.includes("workItem.Payload")) {
  fail("OperationsRuntimeService must apply scenario 2 generated card contract with runtime payload to work item surfaces.");
}
for (const commandId of commandIds) {
  if (!runtimeTestsText.includes(commandId)) fail(`runtime tests must cover ${commandId}.`);
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  fail("generated rule rejection must not refresh projection on failure.");
}
if (!String(docs.surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must remain readonly.");
if (!String(docs.surfaceNavigation.surfaceNavigation?.mineZh ?? "").includes("草稿")) fail("mine entry must keep personal drafts/follow-ups only.");
if (!String(docs.handoff.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("handoff must forbid downstream refill.");
if ((docs.handoff.downstream?.handoffOutputs ?? []).includes("可报价") || (docs.handoff.downstream?.handoffOutputs ?? []).includes("可预订")) {
  fail("scenario 2 handoff must not output 可报价/可预订.");
}
for (const forbiddenTerm of ["可报价", "可预订", "已上线", "生产发布", "final GO", "resource-saleability", "lead-reservation", "golden-chain"]) {
  if (!(docs.mobileMirror.forbiddenUserVisibleTermsZh ?? []).includes(forbiddenTerm)) fail(`mobile mirror missing forbidden user visible term ${forbiddenTerm}.`);
}

const result = {
  version: "oam.dormitory-scenario2-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedPaths,
  runtimeImplementationPaths: {
    generatedRules: runtimeRulesPath,
    runtimeProjection: runtimeProjectionPath,
    operationsRuntimeService: operationsRuntimeServicePath,
    projectionSeed: projectionSeedPath,
    searchKernel: searchKernelPath,
    definitionRegistry: definitionRegistryPath,
    sliceCapabilityGate: sliceCapabilityGatePath,
    canonicalOperations: canonicalOperationsPath,
    program: programPath,
    runtimeTests: runtimeTestsPath
  },
  consumerBoundaries: {
    runtimeConsumesGenerated: true,
    surfaceConsumesGenerated: true,
    searchDashboardReportReadonly: true,
    downstreamScenario3ReadonlySummaryOnly: true,
    failureNoSideEffects: true,
    priceQuoteReservationWritesForbidden: true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 2 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 2 consumption boundary check: PASS (${scenarioDigest})`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function fail(message) {
  failures.push(message);
}
