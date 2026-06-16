import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_SCENARIO6_OUTPUT_ROOT || root;
const scenarioSourcePath = "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const generatedBy = "scripts/business/generate-dormitory-scenario6-payment-deposit-and-guarantee-contracts.mjs";
const generatorVersion = "oam.dormitory-scenario6-payment-deposit-and-guarantee-generator.v1";
const outputPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json",
  objectStateModel: "docs/contracts/generated/dormitory/scenario6-object-state-model.generated.json",
  stepsFields: "docs/contracts/generated/dormitory/scenario6-steps-fields.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/scenario6-crud-policy.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario6-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario6-handoff.generated.json",
  testPlan: "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario6-finance-gate.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario6-payment-deposit-and-guarantee.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario6PaymentDepositAndGuarantee.generated.json"
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
  version: "oam.dormitory-scenario6-input.v1",
  inputDigests
});
const scenario6IndexRow = (packageIndex.scenarioPackageOrder ?? []).find((item) => item.packageNo === 6);

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
    packageIndexRow: scenario6IndexRow,
    highestAuthorityRef: scenario.highestAuthorityRef,
    methodBenchmarkRef: scenario.methodBenchmarkRef,
    financeGateAuthorityRef: scenario.financeGateAuthorityRef,
    financeLedgerAuthorityRef: scenario.financeLedgerAuthorityRef,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    businessBoundaries: scenario.businessBoundaries,
    objects: scenario.objects.map((object) => object.objectName),
    paymentDepositStatusOptions: scenario.paymentDepositStatusOptions,
    financeBoundaryRule: scenario.financeBoundaryRule,
    commands: scenario.commands.map((command) => ({
      commandId: command.commandId,
      businessNameZh: command.businessNameZh,
      writesObjects: command.writesObjects,
      requiresFinanceGate: command.requiresFinanceGate === true
    })),
    readSideOutputs: scenario.readSideOutputs,
    noGo: scenario.NO_GO,
    oldProjectExpressionIsolation: scenario.oldProjectExpressionIsolation
  },
  objectStateModel: {
    ...commonBoundary,
    objects: scenario.objects,
    paymentDepositStatusOptions: scenario.paymentDepositStatusOptions,
    stateLayering: scenario.stateLayering,
    invariants: scenario.invariants,
    financeBoundaryRule: scenario.financeBoundaryRule
  },
  stepsFields: {
    ...commonBoundary,
    steps: scenario.steps,
    fields: scenario.fields,
    paymentDepositStatusOptions: scenario.paymentDepositStatusOptions
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
    paymentDepositStatusOptions: scenario.paymentDepositStatusOptions,
    financeBoundaryRule: scenario.financeBoundaryRule,
    evidence: scenario.evidence,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary
  },
  surfaceNavigation: {
    ...commonBoundary,
    surfaceNavigation: scenario.surfaceNavigation,
    userReadableNamesOnlyZh: scenario.fields.userReadableNamesOnlyZh,
    forbiddenUserInputFields: scenario.fields.forbiddenUserInputFields,
    buttonByState: scenario.surfaceNavigation.buttonByState,
    paymentDepositStatusOptions: scenario.paymentDepositStatusOptions
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
    financeGateEvidenceRequired: true
  },
  financeGate: {
    ...commonBoundary,
    consumer: "finance-gate",
    financeGateAuthorityRef: scenario.financeGateAuthorityRef,
    financeLedgerAuthorityRef: scenario.financeLedgerAuthorityRef,
    financeBoundaryRule: scenario.financeBoundaryRule,
    financeCommands: scenario.commands
      .filter((command) => command.requiresFinanceGate === true)
      .map((command) => command.commandId),
    forbiddenLedgerWritesByBusinessRuntime: true,
    depositIsNotIncome: true,
    guaranteeIsNotPayment: true,
    failureSemantics: scenario.failureSemantics.filter((failure) =>
      ["finance_gate_required", "unauthorized_finance_confirmation", "ledger_write_forbidden", "deposit_marked_as_income_forbidden", "guarantee_marked_as_payment_forbidden"].includes(failure.failureCode)),
    evidence: scenario.evidence
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
      outputs: step.outputs
    })),
    fields: scenario.fields,
    paymentDepositStatusOptions: scenario.paymentDepositStatusOptions,
    readSideOutputs: scenario.readSideOutputs,
    forbiddenUserVisibleTermsZh: scenario.surfaceNavigation.forbiddenUserVisibleTermsZh,
    financeBoundaryRule: scenario.financeBoundaryRule,
    noGo: scenario.NO_GO
  },
  runtimeMirror: {
    ...commonBoundary,
    consumer: "runtime",
    objects: scenario.objects,
    commands: scenario.commands,
    failureSemantics: scenario.failureSemantics,
    invariants: scenario.invariants,
    paymentDepositStatusOptions: scenario.paymentDepositStatusOptions,
    financeBoundaryRule: scenario.financeBoundaryRule,
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

console.log("Dormitory scenario 6 payment deposit and guarantee contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-scenario6-${key}.generated`,
    version: `oam.dormitory-scenario6-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    sourceContentDigest: scenarioDigest,
    packageIndexContentDigest: packageIndexDigest,
    authorityId: scenario.authorityId,
    scenarioPackageNo: 6,
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
