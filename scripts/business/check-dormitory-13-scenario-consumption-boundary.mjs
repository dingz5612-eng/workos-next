import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-13-scenario-consumption-boundary-result.json";
const sourcePath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/13-scenario-control.generated.json",
  scenarioIndex: "docs/contracts/generated/dormitory/13-scenario-index.generated.json",
  fieldMatrix: "docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json",
  pageEntryPolicy: "docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json",
  handoffSummaries: "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json",
  financeBoundary: "docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json",
  runtimeExecution: "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioRuntimeExecution.generated.json"
};
const failures = [];
const sourceDigest = fileDigest(sourcePath);
const docs = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJson(file)]));
const visibleBusinessCopyContractPath = "docs/oam/visible-business-copy-contract.json";
const globalForbiddenActionUserInput = [
  "saveDraft",
  "backToEdit",
  "保存草稿",
  "返回修改"
];
const scenario3ForbiddenActionUserInput = [
  "saveDraft",
  "submitReview",
  "activatePrice",
  "backToEdit"
];
const scenario4ForbiddenActionUserInput = [
  "saveDraft",
  "backToEdit"
];

for (const [key, file] of Object.entries(generatedPaths)) {
  const document = docs[key];
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated/doNotEdit.`);
  if (document.sourceContentDigest !== sourceDigest) fail(`${file} must bind the current 13 scenario Source digest.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
}

if (docs.mobileMirror.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (docs.runtimeMirror.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
if ((docs.mobileMirror.scenarios ?? []).length !== 13) fail("surface generated mirror must expose 13 scenarios.");
if ((docs.runtimeMirror.scenarios ?? []).length !== 13) fail("runtime generated mirror must expose 13 scenarios.");
if ((docs.runtimeExecution.scenarios ?? []).length !== 11) fail("runtime execution must expose executable scenarios 3-13.");
if (docs.runtimeExecution.runtimeExecutionPolicy?.writesThroughOperationsRuntimeOnly !== true) {
  fail("runtime execution must keep writes through Operations Runtime only.");
}
if (!(docs.runtimeExecution.generatedFrom ?? []).includes(visibleBusinessCopyContractPath)) {
  fail("runtime execution must consume visible business copy contract for user-facing search aliases.");
}
for (const scenario of docs.runtimeExecution.scenarios ?? []) {
  if (scenario.status !== "runtime-test-admitted") fail(`scenario ${scenario.scenarioPackageNo} runtime status must remain runtime-test-admitted.`);
  if (!scenario.workspaceId || !String(scenario.workspaceId).startsWith(`W-DORM-SCENARIO${scenario.scenarioPackageNo}-`)) {
    fail(`scenario ${scenario.scenarioPackageNo} runtime workspace id must be current 13-scenario identity.`);
  }
  if (!scenario.searchCommands?.length) fail(`scenario ${scenario.scenarioPackageNo} runtime search command missing.`);
  if (!scenario.startAdapterDefinitionIds || Object.keys(scenario.startAdapterDefinitionIds).length !== (scenario.steps ?? []).length) {
    fail(`scenario ${scenario.scenarioPackageNo} start adapter definitions must match steps.`);
  }
  if (scenario.scenarioPackageNo === 3) {
    if (!JSON.stringify(scenario.searchCommands ?? []).includes("设置房型和价格")) {
      fail("scenario 3 search command must include visible business alias 设置房型和价格.");
    }
    const forbiddenPreloadTokens = ["payment", "deposit", "refund", "ledger", "receipt"];
    for (const key of Object.keys(scenario.startContext ?? {})) {
      if (forbiddenPreloadTokens.some((token) => key.toLowerCase().includes(token))) {
        fail(`scenario 3 start context must not preload finance truth or future payment fields: ${key}.`);
      }
    }
  }
  if (scenario.scenarioPackageNo === 5) {
    for (const key of ["quoteRef", "quoteVersionRef", "quoteSnapshotRef", "quoteValidUntil", "checkInDate", "checkOutDate", "guestCount"]) {
      if (!String(scenario.startContext?.[key] ?? "").trim()) {
        fail(`scenario 5 start context missing upstream quote/demand field ${key}.`);
      }
    }
    for (const forbidden of ["reservationNo", "reservationStatus", "reservationConfirmed", "inventoryHoldConfirmed"]) {
      if (Object.prototype.hasOwnProperty.call(scenario.startContext ?? {}, forbidden)) {
        fail(`scenario 5 start context must not preload downstream reservation result ${forbidden}.`);
      }
    }
  }
  if ([6, 7, 8, 9, 10, 12, 13].includes(scenario.scenarioPackageNo)) {
    for (const key of ["quoteSnapshotRef", "reservationNo", "reservationStatus"]) {
      if (!String(scenario.startContext?.[key] ?? "").trim()) {
        fail(`scenario ${scenario.scenarioPackageNo} start context missing upstream reservation summary field ${key}.`);
      }
    }
  }
  if (scenario.scenarioPackageNo === 8) {
    for (const [key, expected] of Object.entries({
      targetResourceAvailable: "true",
      targetBedAvailable: "true",
      targetResourceAvailability: "可换入",
      targetBedAvailability: "可换入",
      targetResourceStatus: "可运营",
      targetOccupancyStatus: "空置"
    })) {
      if (String(scenario.startContext?.[key] ?? "") !== expected) {
        fail(`scenario 8 start context must carry bed-transfer target availability ${key}=${expected}.`);
      }
    }
  }
  if (scenario.scenarioPackageNo === 9) {
    for (const [key, expected] of Object.entries({
      credentialReturned: "true",
      credentialReturnStatus: "已回收",
      feeSourceValid: "true",
      priceSnapshotBound: "true",
      financeSnapshotBound: "true",
      finalLedgerTruthInput: "false",
      directRefund: "false",
      resourceRecoveryTargetStatus: "待保洁"
    })) {
      if (String(scenario.startContext?.[key] ?? "") !== expected) {
        fail(`scenario 9 start context must carry checkout settlement runtime boundary ${key}=${expected}.`);
      }
    }
  }
  const stepsFields = readJson(scenario.sourceRefs?.stepsFields ?? "");
  for (const step of scenario.steps ?? []) {
    const sourceStep = (stepsFields.steps ?? []).find((item) => item.stepId === step.stepId);
    for (const action of globalForbiddenActionUserInput) {
      if ((sourceStep?.userFilledFields ?? []).includes(action)) {
        fail(`scenario ${scenario.scenarioPackageNo} Source step ${step.stepId} must not expose action ${action} as user-filled input.`);
      }
      if ((sourceStep?.userSelectedFields ?? []).includes(action)) {
        fail(`scenario ${scenario.scenarioPackageNo} Source step ${step.stepId} must not expose action ${action} as user-selected input.`);
      }
      if ((step.fields ?? []).some((field) => (field.fieldId ?? field.id) === action)) {
        fail(`scenario ${scenario.scenarioPackageNo} runtime step ${step.stepId} must not render action ${action} as a field.`);
      }
    }
    if (scenario.scenarioPackageNo === 3) {
      for (const action of scenario3ForbiddenActionUserInput) {
        if ((sourceStep?.userFilledFields ?? []).includes(action)) {
          fail(`scenario 3 Source step ${step.stepId} must not expose action ${action} as user-filled input.`);
        }
        if ((sourceStep?.userSelectedFields ?? []).includes(action)) {
          fail(`scenario 3 Source step ${step.stepId} must not expose action ${action} as user-selected input.`);
        }
        if ((step.fields ?? []).some((field) => (field.fieldId ?? field.id) === action)) {
          fail(`scenario 3 runtime step ${step.stepId} must not render action ${action} as a field.`);
        }
      }
    }
    if (scenario.scenarioPackageNo === 4) {
      for (const action of scenario4ForbiddenActionUserInput) {
        if ((sourceStep?.userFilledFields ?? []).includes(action)) {
          fail(`scenario 4 Source step ${step.stepId} must not expose action ${action} as user-filled input.`);
        }
        if ((sourceStep?.userSelectedFields ?? []).includes(action)) {
          fail(`scenario 4 Source step ${step.stepId} must not expose action ${action} as user-selected input.`);
        }
        if ((step.fields ?? []).some((field) => (field.fieldId ?? field.id) === action)) {
          fail(`scenario 4 runtime step ${step.stepId} must not render action ${action} as a field.`);
        }
      }
    }
    for (const field of step.fields ?? []) {
      const fieldId = String(field.fieldId ?? field.id ?? "");
      if (hasCjk(fieldId)) {
        fail(`scenario ${scenario.scenarioPackageNo} runtime step ${step.stepId} field id must be canonical and non-localized: ${fieldId}.`);
      }
      const optionLabels = (field.ui?.options ?? []).flatMap((option) => Object.values(option.label ?? {}));
      if (optionLabels.some((label) => /^v-[0-9a-f]{10}$/i.test(String(label || "")))) {
        fail(`scenario ${scenario.scenarioPackageNo} runtime step ${step.stepId} field ${fieldId} must not expose generated internal option labels.`);
      }
    }
    const requiredEvidenceLabels = sourceStep?.userUploadedOrBoundEvidence ?? [];
    const generatedEvidence = step.evidence ?? [];
    const sourceAuthorityEvidence = generatedEvidence.filter((item) => item.source === "source-authority");
    if (sourceAuthorityEvidence.length !== requiredEvidenceLabels.length) {
      fail(`scenario ${scenario.scenarioPackageNo} step ${step.stepId} runtime evidence must preserve Source Authority evidence count.`);
    }
    for (const label of requiredEvidenceLabels) {
      const match = sourceAuthorityEvidence.find((item) => item.required === true && item.label?.["zh-CN"] === label);
      if (!match) fail(`scenario ${scenario.scenarioPackageNo} step ${step.stepId} missing required business evidence label ${label}.`);
    }
    for (const evidence of generatedEvidence) {
      const label = String(evidence.label?.["zh-CN"] ?? "");
      if (/^v-[0-9a-f]{8,}$/i.test(label)) {
        fail(`scenario ${scenario.scenarioPackageNo} step ${step.stepId} must not expose hashed evidence label ${label}.`);
      }
    }
  }
}
if (JSON.stringify(docs.mobileMirror.forbiddenUserInputFields ?? []) !== JSON.stringify(docs.runtimeMirror.forbiddenUserInputFields ?? [])) {
  fail("surface and runtime must consume the same forbidden internal field list.");
}
for (const internal of docs.fieldMatrix.forbiddenUserInputFields ?? []) {
  if ((docs.fieldMatrix.fieldSourceMatrix?.userFilled ?? []).includes(internal) ||
    (docs.fieldMatrix.fieldSourceMatrix?.userSelected ?? []).includes(internal)) {
    fail(`${internal} must not be user-filled or user-selected.`);
  }
}

if (!String(docs.pageEntryPolicy.pageEntryPolicy?.search ?? "").includes("只读")) fail("search page entry must remain readonly.");
for (const summary of docs.handoffSummaries.summaries ?? []) {
  if (!String(summary.downstreamRuleZh ?? "").includes("不得要求用户重新填写")) {
    fail(`scenario ${summary.scenarioNo} handoff must forbid downstream refilling confirmed upstream fields.`);
  }
}

const finance = docs.financeBoundary.financeBoundary ?? {};
if (JSON.stringify(finance.exclusiveTruthWriters ?? []) !== JSON.stringify(["finance-gate", "finance-kernel"])) {
  fail("finance truth must be exclusive to finance-gate and finance-kernel.");
}
for (const forbidden of ["Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "FinanceReceipt"]) {
  if (!(finance.financeTruthObjects ?? []).includes(forbidden)) fail(`finance truth object missing ${forbidden}.`);
}
if (JSON.stringify(docs.runtimeMirror.financeBoundary?.exclusiveTruthWriters ?? []) !== JSON.stringify(["finance-gate", "finance-kernel"])) {
  fail("runtime mirror must consume finance truth boundary from generated contract.");
}

const runtimeProjectionText = readText("services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioRuntimeProjection.cs");
const projectionSeedText = readText("services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs");
const searchKernelText = readText("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
const definitionRegistryText = readText("services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs");
const sliceGateText = readText("services/core-api/WorkOS.Api/Runtime/SliceRuntimeCapabilityGate.cs");
const canonicalOperationsText = readText("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
const operationsRuntimeText = readText("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs");
const programText = readText("services/core-api/WorkOS.Api/Program.cs");
if (!runtimeProjectionText.includes("Dormitory13ScenarioRuntimeExecution.generated.json") ||
  !runtimeProjectionText.includes("SearchCommands") ||
  !runtimeProjectionText.includes("StartAdapterDefinitionIds") ||
  !runtimeProjectionText.includes("TransitionRules") ||
  !runtimeProjectionText.includes("CarryForwardPayload")) {
  fail("Dormitory13ScenarioRuntimeProjection must consume generated runtime execution for workspace/search/definition/transition.");
}
if (!runtimeProjectionText.includes("IsRuntimeIdentityPayloadKey")) {
  fail("13-scenario carry-forward must filter runtime identity payload keys before dispatching next steps.");
}
if (!runtimeProjectionText.includes("!IsRuntimeIdentityPayloadKey(key) && !string.IsNullOrWhiteSpace(value)")) {
  fail("13-scenario carry-forward must filter runtime identity keys from submitted fieldValues before dispatching next steps.");
}
if (!runtimeProjectionText.includes("ApplyGeneratedOutcomePayload") ||
  !runtimeProjectionText.includes("\"inventoryHoldActive\"") ||
  !runtimeProjectionText.includes("\"reservationDraftConfirmed\"") ||
  !runtimeProjectionText.includes("\"reservationNo\"")) {
  fail("13-scenario carry-forward must derive system outcome facts between generated steps without user re-entry.");
}
if (!runtimeProjectionText.includes("ResolveOperableResource") ||
  !runtimeProjectionText.includes("ApplyRuntimeResourceOptions") ||
  !runtimeProjectionText.includes("sellableResourceSelection")) {
  fail("13-scenario runtime projection must bind start context and first-card options to confirmed operable resources.");
}
if (!runtimeProjectionText.includes("ApplyBedTransferTargetContext") ||
  !runtimeProjectionText.includes("\"targetResourceAvailable\"") ||
  !runtimeProjectionText.includes("\"targetBedAvailability\"")) {
  fail("scenario 8 runtime projection must bind bed-transfer target availability into dynamic StartContext.");
}
if (!runtimeProjectionText.includes("CanonicalizeSubmittedFieldValues") ||
  !runtimeProjectionText.includes("ApplyScenario9Selection") ||
  !runtimeProjectionText.includes("\"actualCheckoutAt\"") ||
  !runtimeProjectionText.includes("\"handoverType\"") ||
  !runtimeProjectionText.includes("\"customerConfirmedSettlement\"")) {
  fail("13-scenario runtime projection must canonicalize generated scenario 9 field ids before generated runtime rules.");
}
for (const key of ["caseId", "cardId", "definitionId", "definitionMigrationRefs", "operationAxis", "sourceWorkItemId", "ownerRole", "dispatchedBy", "generatedTransitionPolicyId", "generatedTransitionSource"]) {
  if (!runtimeProjectionText.includes(`"${key}"`)) {
    fail(`13-scenario carry-forward identity filter missing ${key}.`);
  }
}
if (!projectionSeedText.includes("Dormitory13ScenarioRuntimeProjection.Workspaces()")) fail("ProjectionSeed must seed generated 13-scenario runtime workspaces.");
if (!searchKernelText.includes("Dormitory13ScenarioRuntimeProjection.SearchCommands()")) fail("SearchKernelService must consume generated 13-scenario search commands.");
if (!definitionRegistryText.includes("Dormitory13ScenarioRuntimeProjection.StartAdapterDefinitionIds()")) fail("Definition registry must consume generated 13-scenario start adapters.");
if (!sliceGateText.includes("Dormitory13ScenarioRuntimeProjection.RuntimeCapabilities()")) fail("Slice runtime gate must admit generated 13-scenario runtime capabilities.");
if (!canonicalOperationsText.includes("Dormitory13ScenarioRuntimeProjection.StartContext") ||
  !canonicalOperationsText.includes("Dormitory13ScenarioRuntimeProjection.TransitionRules()") ||
  !canonicalOperationsText.includes("Dormitory13ScenarioRuntimeProjection.CarryForwardPayload") ||
  !canonicalOperationsText.includes("Dormitory13ScenarioRuntimeProjection.CanonicalizeSubmittedFieldValues")) {
  fail("Canonical Operations must consume 13-scenario start context, transitions, carry-forward, and generated field canonicalization.");
}
if (!canonicalOperationsText.includes("Dormitory13ScenarioRuntimeProjection.StartContext(workspace.Id, templateWorkspaceId, cardId, actor, workItems")) {
  fail("Canonical Operations must pass current WorkItems into 13-scenario StartContext for dynamic upstream resource binding.");
}
if (!canonicalOperationsText.includes("GetWorkItemSurface(workItem.WorkItemId, actor)") ||
  !canonicalOperationsText.includes("ListWorkItemSurfaces(actor, operationCase.CaseId, workspace.Id)") ||
  !canonicalOperationsText.includes("OperationsWorkItemSurface WorkItem")) {
  fail("Operations workspace start must return payload-aware work item surfaces so generated 13-scenario first render consumes runtime payloads.");
}
if (!operationsRuntimeText.includes("Dormitory13ScenarioRuntimeProjection.CardFor")) fail("Operations Runtime must apply generated 13-scenario card contracts.");
if (!operationsRuntimeText.includes("workItem.Payload")) fail("Operations Runtime must pass WorkItem payload into 13-scenario CardFor for dynamic field options.");
if (!operationsRuntimeText.includes("if (!IsTerminalStatus(workItem.Status))") ||
  operationsRuntimeText.includes("if (IsCorrectionWorkItem(workItem) && !IsTerminalStatus(workItem.Status))")) {
  fail("Operations Runtime must present any current non-terminal WorkItem card as ready, not only correction WorkItems.");
}
if (!programText.includes("Dormitory13ScenarioRuntimeProjection.Workspaces()")) fail("API start whitelist must include generated 13-scenario workspaces.");
if (!programText.includes("runtime.CreateEvidenceDraft(request with { TenantId = actor.TenantId }, actor.ActorId)")) {
  fail("Evidence draft creation must bind tenant from the authenticated Operations actor, not frontend input or non-current defaults.");
}

const result = {
  version: "oam.dormitory-13-scenario-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  sourcePath,
  sourceDigest,
  generatedPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: true,
    surfaceConsumesGenerated: true,
    readModelSearchDashboardReportReadonly: true,
    financeGateExclusiveTruth: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory 13 scenario consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory 13 scenario consumption boundary check: PASS (${sourceDigest})`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}

function hasCjk(value = "") {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}
