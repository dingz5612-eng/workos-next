import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_SCENARIO13_OUTPUT_ROOT || root;
const scenarioSourcePath = "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const generatedBy = "scripts/business/generate-dormitory-scenario13-reporting-audit-review-contracts.mjs";
const generatorVersion = "oam.dormitory-scenario13-reporting-audit-review-generator.v1";
const outputPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario13-reporting-audit-review.generated.json",
  objectStateModel: "docs/contracts/generated/dormitory/scenario13-object-state-model.generated.json",
  metricModel: "docs/contracts/generated/dormitory/scenario13-metric-model.generated.json",
  stepsFields: "docs/contracts/generated/dormitory/scenario13-steps-fields.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/scenario13-crud-policy.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario13-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario13-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario13-handoff.generated.json",
  testPlan: "docs/contracts/generated/dormitory/scenario13-test-plan.generated.json",
  readModel: "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario13-reporting-audit-review.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario13ReportingAuditReview.generated.json"
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
  version: "oam.dormitory-scenario13-input.v1",
  inputDigests
});
const packageIndexRow = (packageIndex.scenarioPackageOrder ?? []).find((item) => item.packageNo === 13);

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
    packageIndexRow,
    highestAuthorityRef: scenario.highestAuthorityRef,
    methodBenchmarkRef: scenario.methodBenchmarkRef,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    businessBoundaries: scenario.businessBoundaries,
    objects: scenario.objects.map((object) => object.objectName),
    reportingStatusOptions: scenario.reportingStatusOptions,
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
    reportingStatusOptions: scenario.reportingStatusOptions,
    invariants: scenario.invariants,
    reportingInvariantRule: scenario.reportingInvariantRule
  },
  metricModel: {
    ...commonBoundary,
    metricCatalog: scenario.metricCatalog,
    metricDefinitionRule: scenario.metricDefinitionRule,
    financeGateTruthReadonlyRuleZh: scenario.upstream.financeGateTruthReadonlyRuleZh,
    formalReportAdmissionRuleZh: scenario.upstream.formalReportAdmissionRuleZh
  },
  stepsFields: {
    ...commonBoundary,
    steps: scenario.steps,
    fields: scenario.fields,
    reportingStatusOptions: scenario.reportingStatusOptions
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
    reportingStatusOptions: scenario.reportingStatusOptions,
    reportingInvariantRule: scenario.reportingInvariantRule,
    metricDefinitionRule: scenario.metricDefinitionRule,
    evidence: scenario.evidence,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary
  },
  surfaceNavigation: {
    ...commonBoundary,
    surfaceNavigation: scenario.surfaceNavigation,
    userReadableNamesOnlyZh: scenario.fields.userReadableNamesOnlyZh,
    forbiddenUserInputFields: scenario.fields.forbiddenUserInputFields,
    buttonByState: scenario.surfaceNavigation.buttonByState,
    reportingStatusOptions: scenario.reportingStatusOptions
  },
  handoff: {
    ...commonBoundary,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    readSideOutputs: scenario.readSideOutputs,
    downstreamRecheckRuleZh: scenario.downstream.downstreamRecheckRuleZh
  },
  testPlan: {
    ...commonBoundary,
    positiveBrowserTestPlan: scenario.positiveBrowserTestPlan,
    negativeBrowserTestPlan: scenario.negativeBrowserTestPlan,
    evidence: scenario.evidence,
    screenshotAnalysisRequired: true,
    noSideEffectsProofRequired: true,
    localEvidencePassAllowed: true
  },
  readModel: {
    ...commonBoundary,
    consumer: "read-model/reporting",
    readModelMayReadConfirmedFactsOnly: scenario.runtimeConsumptionBoundary.readModelMayReadConfirmedFactsOnly,
    readModelMayWriteSourceFacts: scenario.runtimeConsumptionBoundary.readModelMayWriteSourceFacts,
    requiredEnvelopes: ["permission envelope", "lineage envelope", "freshness envelope"],
    metricCatalog: scenario.metricCatalog,
    readSideOutputs: scenario.readSideOutputs,
    formalReportAdmissionRuleZh: scenario.upstream.formalReportAdmissionRuleZh
  },
  financeGate: {
    ...commonBoundary,
    consumer: "finance-gate",
    financeGateTruthReadonlyOnly: scenario.runtimeConsumptionBoundary.financeGateTruthReadonlyOnly,
    exclusiveTruthWriters: ["finance-gate", "finance-kernel"],
    allowedReadonlyInputs: ["finance-gate 已确认账务事实", "财务确认快照", "授权投影", "证据摘要", "只读对象引用"],
    businessRuntimeMayWriteLedger: false,
    businessRuntimeMayWritePaymentDepositRefund: false,
    financialMetricsReadFinanceGateOnly: scenario.metricDefinitionRule.financialMetricsReadFinanceGateOnly
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
      secondaryCommandIds: step.secondaryCommandIds,
      entryFromZh: step.entryFromZh,
      userSees: step.userSees,
      userFilledFields: step.userFilledFields,
      userSelectedFields: step.userSelectedFields,
      systemReadonlyInputs: step.systemReadonlyInputs,
      systemGeneratedFields: step.systemGeneratedFields,
      systemCalculatedFields: step.systemCalculatedFields,
      validations: step.validations,
      outputs: step.outputs
    })),
    fields: scenario.fields,
    reportingStatusOptions: scenario.reportingStatusOptions,
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
    reportingStatusOptions: scenario.reportingStatusOptions,
    reportingInvariantRule: scenario.reportingInvariantRule,
    metricDefinitionRule: scenario.metricDefinitionRule,
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

console.log("Dormitory scenario 13 reporting audit review contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-scenario13-${key}.generated`,
    version: `oam.dormitory-scenario13-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    sourceContentDigest: scenarioDigest,
    packageIndexContentDigest: packageIndexDigest,
    authorityId: scenario.authorityId,
    scenarioPackageNo: 13,
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
