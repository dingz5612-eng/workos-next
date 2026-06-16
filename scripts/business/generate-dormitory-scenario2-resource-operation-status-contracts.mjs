import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_SCENARIO2_OUTPUT_ROOT || root;
const scenarioSourcePath = "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const generatedBy = "scripts/business/generate-dormitory-scenario2-resource-operation-status-contracts.mjs";
const generatorVersion = "oam.dormitory-scenario2-resource-operation-status-generator.v1";
const outputPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json",
  objectStateModel: "docs/contracts/generated/dormitory/scenario2-object-state-model.generated.json",
  stepsFields: "docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/scenario2-crud-policy.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario2-handoff.generated.json",
  testPlan: "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json"
};

const scenario = readJson(scenarioSourcePath);
const packageIndex = readJson(packageIndexPath);
const scenarioDigest = fileDigest(scenarioSourcePath);
const packageIndexDigest = fileDigest(packageIndexPath);
const generatedFrom = [scenarioSourcePath, packageIndexPath];
const inputDigests = [
  { path: scenarioSourcePath, digest: scenarioDigest },
  { path: packageIndexPath, digest: packageIndexDigest }
];
const inputDigest = digestObject({
  version: "oam.dormitory-scenario2-input.v1",
  inputDigests
});

const packageOrder = packageIndex.scenarioPackageOrder ?? [];
const scenario2IndexRow = packageOrder.find((item) => item.packageNo === 2);

const commonBoundary = {
  authorityId: scenario.authorityId,
  scenarioPackageNo: scenario.scenarioPackageNo,
  scenarioId: scenario.scenarioId,
  nameZh: scenario.nameZh,
  businessGoalZh: scenario.businessGoalZh,
  sourceScenarioDigest: scenarioDigest,
  packageIndexDigest
};

const generated = {
  canonical: {
    ...commonBoundary,
    packageIndexRow: scenario2IndexRow,
    highestAuthorityRef: scenario.highestAuthorityRef,
    methodBenchmarkRef: scenario.methodBenchmarkRef,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    businessBoundaries: scenario.businessBoundaries,
    objects: scenario.objects.map((object) => object.objectName),
    operationStatusOptions: scenario.operationStatusOptions,
    commands: scenario.commands.map((command) => ({
      commandId: command.commandId,
      businessNameZh: command.businessNameZh,
      writesObjects: command.writesObjects
    })),
    readSideOutputs: scenario.readSideOutputs,
    noGo: scenario.NO_GO,
    oldProjectExpressionIsolation: packageIndex.oldProjectExpressionIsolation
  },
  objectStateModel: {
    ...commonBoundary,
    objects: scenario.objects,
    operationStatusOptions: scenario.operationStatusOptions,
    statusOwnership: scenario.statusOwnership,
    invariants: scenario.invariants,
    scopeImpactRules: scenario.scopeImpactRules
  },
  stepsFields: {
    ...commonBoundary,
    steps: scenario.steps,
    fields: scenario.fields,
    operationStatusOptions: scenario.operationStatusOptions
  },
  crudPolicy: {
    ...commonBoundary,
    crudRules: scenario.crudRules,
    requiredLifecyclePerObject: scenario.crudRules.requiredLifecyclePerObject
  },
  runtimeRules: {
    ...commonBoundary,
    commands: scenario.commands,
    failureSemantics: scenario.failureSemantics,
    invariants: scenario.invariants,
    operationStatusOptions: scenario.operationStatusOptions,
    scopeImpactRules: scenario.scopeImpactRules,
    evidence: scenario.evidence,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary
  },
  surfaceNavigation: {
    ...commonBoundary,
    surfaceNavigation: scenario.surfaceNavigation,
    userReadableNamesOnlyZh: scenario.fields.userReadableNamesOnlyZh,
    forbiddenUserInputFields: scenario.fields.forbiddenUserInputFields,
    buttonByState: scenario.surfaceNavigation.buttonByState,
    operationStatusOptions: scenario.operationStatusOptions
  },
  handoff: {
    ...commonBoundary,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    readSideOutputs: scenario.readSideOutputs,
    downstreamNoRefillRuleZh: scenario.downstream.downstreamNoRefillRuleZh
  },
  testPlan: {
    ...commonBoundary,
    positiveBrowserTestPlan: scenario.positiveBrowserTestPlan,
    negativeBrowserTestPlan: scenario.negativeBrowserTestPlan,
    evidence: scenario.evidence,
    screenshotAnalysisRequired: true,
    noSideEffectsProofRequired: true
  },
  mobileMirror: {
    ...commonBoundary,
    consumer: "surface",
    surfaceNavigation: scenario.surfaceNavigation,
    steps: scenario.steps.map((step) => ({
      stepNo: step.stepNo,
      stepId: step.stepId,
      nameZh: step.nameZh,
      commandId: step.commandId,
      commandBusinessNameZh: step.commandBusinessNameZh,
      userSees: step.userSees,
      userFilledFields: step.userFilledFields,
      userSelectedFields: step.userSelectedFields,
      userUploadedOrBoundEvidence: step.userUploadedOrBoundEvidence,
      systemGeneratedFields: step.systemGeneratedFields,
      validations: step.validations,
      outputs: step.outputs,
      conclusionOptions: step.conclusionOptions
    })),
    fields: scenario.fields,
    operationStatusOptions: scenario.operationStatusOptions,
    readSideOutputs: scenario.readSideOutputs,
    forbiddenUserVisibleTermsZh: scenario.surfaceNavigation.forbiddenUserVisibleTermsZh,
    noGo: scenario.NO_GO
  },
  runtimeMirror: {
    ...commonBoundary,
    consumer: "runtime",
    objects: scenario.objects,
    commands: scenario.commands,
    failureSemantics: scenario.failureSemantics,
    invariants: scenario.invariants,
    operationStatusOptions: scenario.operationStatusOptions,
    scopeImpactRules: scenario.scopeImpactRules,
    fields: scenario.fields,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    noGo: scenario.NO_GO
  }
};

for (const [key, content] of Object.entries(generated)) {
  writeGenerated(outputPaths[key], key, content);
}

console.log("Dormitory scenario 2 resource operation status contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-scenario2-${key}.generated`,
    version: `oam.dormitory-scenario2-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    sourceContentDigest: scenarioDigest,
    packageIndexContentDigest: packageIndexDigest,
    authorityId: scenario.authorityId,
    scenarioPackageNo: 2,
    scenarioId: scenario.scenarioId,
    outputContentDigest: "sha256:pending",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    ...content
  };
  const finalized = {
    ...base,
    outputContentDigest: digestObject(base)
  };
  const full = path.join(outputRoot, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(finalized, null, 2)}\n`, "utf8");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestObject(value) {
  const normalized = stableStringify(value, (key, child) => key === "outputContentDigest" ? "sha256:pending" : child);
  return `sha256:${crypto.createHash("sha256").update(normalized).digest("hex")}`;
}

function stableStringify(value, replacer = (_key, child) => child) {
  return JSON.stringify(sortValue(replacer("", value)));
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
