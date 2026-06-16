import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_BENCHMARK_INHERITANCE_OUTPUT_ROOT || root;
const contractPath = "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json";
const controlPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const scenario1Path = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const generatedBy = "scripts/business/generate-dormitory-scenario1-benchmark-inheritance-contracts.mjs";
const generatorVersion = "oam.dormitory-scenario1-benchmark-inheritance-generator.v1";
const outputPaths = {
  contract: "docs/contracts/generated/dormitory/scenario1-benchmark-inheritance-contract.generated.json",
  startGate: "docs/contracts/generated/dormitory/subsequent-scenario-start-gate.generated.json",
  differenceChecklist: "docs/contracts/generated/dormitory/subsequent-scenario-difference-checklist-template.generated.json",
  fieldReview: "docs/contracts/generated/dormitory/subsequent-scenario-field-review-template.generated.json",
  buttonState: "docs/contracts/generated/dormitory/subsequent-scenario-button-state-template.generated.json",
  screenshotReport: "docs/contracts/generated/dormitory/subsequent-scenario-screenshot-report-template.generated.json",
  failureRouting: "docs/contracts/generated/dormitory/subsequent-scenario-failure-attribution-routing.generated.json",
  scenario2Trial: "docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario1-benchmark-inheritance.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1BenchmarkInheritance.generated.json"
};

const contract = readJson(contractPath);
const control = readJson(controlPath);
const scenario1 = readJson(scenario1Path);
const packageIndex = readJson(packageIndexPath);
const inputDigests = [
  { path: contractPath, digest: fileDigest(contractPath) },
  { path: controlPath, digest: fileDigest(controlPath) },
  { path: scenario1Path, digest: fileDigest(scenario1Path) },
  { path: packageIndexPath, digest: fileDigest(packageIndexPath) }
];
const inputDigest = digestObject({
  version: "oam.dormitory-scenario1-benchmark-inheritance-input.v1",
  inputDigests
});
const generatedFrom = [contractPath, controlPath, scenario1Path, packageIndexPath];
const scenario2ControlRow = (control.scenarios ?? []).find((item) => item.scenarioNo === 2);

const common = {
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  highestBusinessAuthorityRef: contract.authorityHierarchy.highestBusinessAuthorityRef,
  highestBusinessAuthorityId: contract.authorityHierarchy.highestBusinessAuthorityId,
  benchmarkImplementationRef: contract.authorityHierarchy.benchmarkImplementationRef,
  controlAuthorityDigest: inputDigests.find((item) => item.path === controlPath).digest,
  benchmarkContractDigest: inputDigests.find((item) => item.path === contractPath).digest,
  scenario1SourceDigest: inputDigests.find((item) => item.path === scenario1Path).digest,
  packageIndexDigest: inputDigests.find((item) => item.path === packageIndexPath).digest
};

const generated = {
  contract: {
    ...common,
    scopeZh: contract.scopeZh,
    authorityHierarchy: contract.authorityHierarchy,
    inheritancePrinciples: contract.inheritancePrinciples,
    inheritableMethodItems: contract.inheritableMethodItems,
    forbiddenInheritanceItems: contract.forbiddenInheritanceItems,
    globalReadonlyAndFinanceBoundaries: contract.globalReadonlyAndFinanceBoundaries,
    noGo: contract.NO_GO
  },
  startGate: {
    ...common,
    gate: contract.subsequentScenarioStartGate,
    appliesToScenarios: (control.scenarios ?? [])
      .filter((item) => (contract.subsequentScenarioStartGate.appliesToScenarioNos ?? []).includes(item.scenarioNo))
      .map((item) => ({
        scenarioNo: item.scenarioNo,
        scenarioId: item.scenarioId,
        nameZh: item.nameZh,
        chainLayer: item.chainLayer,
        upstreamSummaryInputs: item.upstreamSummaryInputs,
        writesObjects: item.writesObjects,
        highRiskBoundaries: highRiskBoundariesForScenario(item)
      }))
  },
  differenceChecklist: {
    ...common,
    template: contract.differenceChecklistTemplate,
    forbiddenScenario1BusinessObjects: contract.forbiddenInheritanceItems.businessObjects,
    forbiddenScenario1BusinessFieldsOrConceptsZh: contract.forbiddenInheritanceItems.businessFieldsOrConceptsZh
  },
  fieldReview: {
    ...common,
    gate: contract.fieldReviewGate,
    controlFieldSourceMatrix: control.fieldSourceMatrix,
    controlForbiddenUserInputFields: control.forbiddenUserInputFields
  },
  buttonState: {
    ...common,
    uxAndButtonGate: contract.uxAndButtonGate,
    pageEntryPolicyFromControl: control.pageEntryPolicy
  },
  screenshotReport: {
    ...common,
    template: contract.screenshotEvidenceTemplate,
    testStandardFromControl: control.testStandard
  },
  failureRouting: {
    ...common,
    failureAttributionRouting: contract.failureAttributionRouting,
    forbiddenFailureBypassZh: contract.forbiddenFailureBypassZh
  },
  scenario2Trial: {
    ...common,
    scenario2ControlRow,
    trial: contract.scenario2StartGateTrial,
    trialResult: evaluateScenario2Trial(contract.scenario2StartGateTrial, scenario2ControlRow)
  },
  mobileMirror: {
    ...common,
    consumer: "surface",
    startGate: contract.subsequentScenarioStartGate,
    differenceChecklistTemplate: contract.differenceChecklistTemplate,
    fieldReviewGate: contract.fieldReviewGate,
    uxAndButtonGate: contract.uxAndButtonGate,
    screenshotEvidenceTemplate: contract.screenshotEvidenceTemplate,
    scenario2StartGateTrial: contract.scenario2StartGateTrial,
    noGo: contract.NO_GO
  },
  runtimeMirror: {
    ...common,
    consumer: "runtime",
    startGate: contract.subsequentScenarioStartGate,
    globalReadonlyAndFinanceBoundaries: contract.globalReadonlyAndFinanceBoundaries,
    failureAttributionRouting: contract.failureAttributionRouting,
    scenario2StartGateTrial: contract.scenario2StartGateTrial,
    noGo: contract.NO_GO
  }
};

for (const [key, content] of Object.entries(generated)) {
  writeGenerated(outputPaths[key], key, content);
}

console.log("Dormitory scenario 1 benchmark inheritance contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);

function highRiskBoundariesForScenario(scenario) {
  const text = JSON.stringify(scenario);
  return {
    financeGate: /finance|财务|收款|押金|退款|账务|金额/i.test(text),
    inventory: /Inventory|库存|锁定/i.test(text),
    price: /Rate|Price|价格|报价|商品/i.test(text),
    operationStatus: /OperationStatus|运营状态|可运营/i.test(text),
    readonlyReport: scenario.chainLayer === "readonly_governance_chain" || /Report|报表|审计|复盘/i.test(text)
  };
}

function evaluateScenario2Trial(trial, scenario2) {
  const failures = [];
  if (!scenario2) failures.push("scenario 2 missing from 13 scenario control.");
  if (trial?.scenarioNo !== 2) failures.push("trial scenarioNo must be 2.");
  if (trial?.scenarioId !== scenario2?.scenarioId) failures.push("trial scenarioId must match 13 scenario control.");
  if (trial?.nameZh !== scenario2?.nameZh) failures.push("trial nameZh must match 13 scenario control.");
  for (const object of ["OperationStatus", "OperationBlocker"]) {
    if (!(trial?.ownedObjects ?? []).includes(object)) failures.push(`trial missing owned object ${object}.`);
  }
  for (const forbidden of ["Room", "BedSet", "Bed", "BasicReadiness"]) {
    if ((trial?.differenceChecklist?.objectDifference?.writes ?? []).includes(forbidden)) {
      failures.push(`trial must not write scenario 1 object ${forbidden}.`);
    }
  }
  if (trial?.highRiskBoundaries?.operationStatus !== true) failures.push("trial must flag operationStatus boundary.");
  if (trial?.highRiskBoundaries?.mustNotEnterPriceOrReservation !== true) failures.push("trial must forbid direct price/reservation.");
  return {
    status: failures.length === 0 ? "PASS" : "NO_GO",
    failures
  };
}

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-scenario1-benchmark-inheritance-${key}.generated`,
    version: `oam.dormitory-scenario1-benchmark-inheritance-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    sourceContentDigest: inputDigests.find((item) => item.path === contractPath).digest,
    authorityId: contract.authorityId,
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
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
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
