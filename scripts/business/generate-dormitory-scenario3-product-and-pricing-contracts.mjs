import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_SCENARIO3_OUTPUT_ROOT || root;
const scenarioSourcePath = "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const generatedBy = "scripts/business/generate-dormitory-scenario3-product-and-pricing-contracts.mjs";
const generatorVersion = "oam.dormitory-scenario3-product-and-pricing-generator.v1";
const outputPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json",
  objectStateModel: "docs/contracts/generated/dormitory/scenario3-object-state-model.generated.json",
  stepsFields: "docs/contracts/generated/dormitory/scenario3-steps-fields.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/scenario3-crud-policy.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario3-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario3-handoff.generated.json",
  testPlan: "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario3-product-and-pricing.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario3ProductAndPricing.generated.json"
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
  version: "oam.dormitory-scenario3-input.v1",
  inputDigests
});

const scenario3IndexRow = (packageIndex.scenarioPackageOrder ?? []).find((item) => item.packageNo === 3);

const commonBoundary = {
  authorityId: scenario.authorityId,
  scenarioPackageNo: scenario.scenarioPackageNo,
  scenarioId: scenario.scenarioId,
  nameZh: scenario.nameZh,
  businessGoalZh: scenario.businessGoalZh,
  sourceScenarioDigest: scenarioDigest,
  packageIndexDigest,
  experienceContract: scenario.experienceContract ?? null
};

const generated = {
  canonical: {
    ...commonBoundary,
    packageIndexRow: scenario3IndexRow,
    highestAuthorityRef: scenario.highestAuthorityRef,
    methodBenchmarkRef: scenario.methodBenchmarkRef,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    businessBoundaries: scenario.businessBoundaries,
    objects: scenario.objects.map((object) => object.objectName),
    priceStatusOptions: scenario.priceStatusOptions,
    commands: scenario.commands.map((command) => ({
      commandId: command.commandId,
      businessNameZh: command.businessNameZh,
      writesObjects: command.writesObjects
    })),
    readSideOutputs: scenario.readSideOutputs,
    noGo: scenario.NO_GO,
    oldProjectExpressionIsolation: scenario.oldProjectExpressionIsolation
  },
  objectStateModel: {
    ...commonBoundary,
    objects: scenario.objects,
    priceStatusOptions: scenario.priceStatusOptions,
    stateLayering: scenario.stateLayering,
    invariants: scenario.invariants,
    priceConflictRule: scenario.priceConflictRule
  },
  stepsFields: {
    ...commonBoundary,
    steps: scenario.steps,
    fields: scenario.fields,
    priceStatusOptions: scenario.priceStatusOptions
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
    priceStatusOptions: scenario.priceStatusOptions,
    priceConflictRule: scenario.priceConflictRule,
    evidence: scenario.evidence,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary
  },
  surfaceNavigation: {
    ...commonBoundary,
    surfaceNavigation: scenario.surfaceNavigation,
    userReadableNamesOnlyZh: scenario.fields.userReadableNamesOnlyZh,
    forbiddenUserInputFields: scenario.fields.forbiddenUserInputFields,
    buttonByState: scenario.surfaceNavigation.buttonByState,
    priceStatusOptions: scenario.priceStatusOptions
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
      systemCalculatedFields: step.systemCalculatedFields,
      validations: step.validations,
      outputs: step.outputs,
      primaryBusinessObject: step.primaryBusinessObject,
      requiredReadContext: step.requiredReadContext,
      editableInputs: step.editableInputs,
      fixedSelections: step.fixedSelections,
      financialContext: step.financialContext,
      legalActions: step.legalActions,
      handoffSummary: step.handoffSummary,
      searchReadModel: step.searchReadModel
    })),
    fields: scenario.fields,
    priceStatusOptions: scenario.priceStatusOptions,
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
    priceStatusOptions: scenario.priceStatusOptions,
    priceConflictRule: scenario.priceConflictRule,
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

console.log("Dormitory scenario 3 product and pricing contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-scenario3-${key}.generated`,
    version: `oam.dormitory-scenario3-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    sourceContentDigest: scenarioDigest,
    packageIndexContentDigest: packageIndexDigest,
    authorityId: scenario.authorityId,
    scenarioPackageNo: 3,
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
  const normalized = stableStringify(replaceOutputDigest(value));
  return `sha256:${crypto.createHash("sha256").update(normalized).digest("hex")}`;
}

function replaceOutputDigest(value) {
  if (Array.isArray(value)) return value.map(replaceOutputDigest);
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      output[key] = key === "outputContentDigest" ? "sha256:pending" : replaceOutputDigest(child);
    }
    return output;
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
