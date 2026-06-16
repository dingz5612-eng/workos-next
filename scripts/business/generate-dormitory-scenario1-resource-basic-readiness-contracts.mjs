import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_SCENARIO1_OUTPUT_ROOT || root;
const scenarioSourcePath = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const generatedBy = "scripts/business/generate-dormitory-scenario1-resource-basic-readiness-contracts.mjs";
const generatorVersion = "oam.dormitory-scenario1-resource-basic-readiness-generator.v1";
const outputPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json",
  objectModel: "docs/contracts/generated/dormitory/scenario1-object-model.generated.json",
  stepsFields: "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/scenario1-crud-policy.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario1-handoff.generated.json",
  testPlan: "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json"
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
  version: "oam.dormitory-scenario1-input.v1",
  inputDigests
});

const packageOrder = packageIndex.scenarioPackageOrder ?? [];
const scenario1IndexRow = packageOrder.find((item) => item.packageNo === 1);

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
    packageIndexRow: scenario1IndexRow,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    objects: scenario.objects.map((object) => object.objectName),
    commands: scenario.commands.map((command) => ({
      commandId: command.commandId,
      businessNameZh: command.businessNameZh,
      writesObjects: command.writesObjects
    })),
    readSideOutputs: scenario.readSideOutputs,
    noGo: scenario.NO_GO,
    oldProjectExpressionIsolation: packageIndex.oldProjectExpressionIsolation
  },
  objectModel: {
    ...commonBoundary,
    objects: scenario.objects,
    bedGenerationRule: scenario.bedGenerationRule,
    objectModelInvariantZh: "BasicReadiness 只表示基础资料和基础检查完成，不得解释为可运营、可报价、可预订或可售。"
  },
  stepsFields: {
    ...commonBoundary,
    steps: scenario.steps,
    fields: scenario.fields,
    systemFields: scenario.systemFields
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
    bedGenerationRule: scenario.bedGenerationRule,
    readinessConclusionOptions: scenario.steps.find((step) => step.stepId === "basic-readiness-confirmation")?.conclusionOptions ?? [],
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary
  },
  surfaceNavigation: {
    ...commonBoundary,
    surfaceNavigation: scenario.surfaceNavigation,
    userReadableNamesOnlyZh: scenario.fields.userReadableNamesOnlyZh,
    forbiddenUserInputFields: scenario.fields.forbiddenUserInputFields,
    buttonByState: scenario.surfaceNavigation.buttonByState
  },
  handoff: {
    ...commonBoundary,
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
      systemGeneratedFields: step.systemGeneratedFields,
      validations: step.validations,
      outputs: step.outputs,
      conclusionOptions: step.conclusionOptions
    })),
    fields: scenario.fields,
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
    bedGenerationRule: scenario.bedGenerationRule,
    readinessConclusionOptions: scenario.steps.find((step) => step.stepId === "basic-readiness-confirmation")?.conclusionOptions ?? [],
    fields: scenario.fields,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary,
    noGo: scenario.NO_GO
  }
};

for (const [key, content] of Object.entries(generated)) {
  writeGenerated(outputPaths[key], key, content);
}

console.log("Dormitory scenario 1 resource basic readiness contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-scenario1-${key}.generated`,
    version: `oam.dormitory-scenario1-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    sourceContentDigest: scenarioDigest,
    packageIndexContentDigest: packageIndexDigest,
    authorityId: scenario.authorityId,
    scenarioPackageNo: 1,
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
