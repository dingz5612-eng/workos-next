import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_13_CONTROL_OUTPUT_ROOT || root;
const sourcePath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const generatedBy = "scripts/business/generate-dormitory-13-scenario-control-contracts.mjs";
const generatorVersion = "oam.dormitory-13-scenario-control-generator.v1";
const outputPaths = {
  control: "docs/contracts/generated/dormitory/13-scenario-control.generated.json",
  mobileControl: "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json",
  runtimeControl: "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json",
  scenarioIndex: "docs/contracts/generated/dormitory/13-scenario-index.generated.json",
  stateLadder: "docs/contracts/generated/dormitory/13-scenario-state-ladder.generated.json",
  objectOwnership: "docs/contracts/generated/dormitory/13-scenario-object-ownership.generated.json",
  fieldMatrix: "docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/13-scenario-crud-policy.generated.json",
  evidencePolicy: "docs/contracts/generated/dormitory/13-scenario-evidence-policy.generated.json",
  financeBoundary: "docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json",
  pageEntryPolicy: "docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json",
  handoffSummaries: "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json",
  oldPackageMigration: "docs/contracts/generated/dormitory/13-scenario-old-package-migration.generated.json",
  testPlan: "docs/contracts/generated/dormitory/13-scenario-test-plan.generated.json"
};

const source = readJson(sourcePath);
const sourceDigest = fileDigest(sourcePath);
const inputDigest = digestObject({
  version: "oam.dormitory-13-scenario-control-input.v1",
  sourcePath,
  sourceDigest
});

const generated = {
  control: {
    authorityId: source.authorityId,
    scopeZh: source.scopeZh,
    layerModel: source.layerModel,
    entryAdmissionContract: source.entryAdmissionContract,
    runtimeConsumptionBoundary: source.runtimeConsumptionBoundary,
    finalSafety: source.finalSafety
  },
  mobileControl: {
    consumer: "surface",
    authorityId: source.authorityId,
    scenarios: source.scenarios.map((scenario) => ({
      scenarioNo: scenario.scenarioNo,
      scenarioId: scenario.scenarioId,
      nameZh: scenario.nameZh,
      chainLayer: scenario.chainLayer,
      pageEntries: scenario.pageEntries,
      summaryOutputs: scenario.summaryOutputs
    })),
    pageEntryPolicy: source.pageEntryPolicy,
    entryAdmissionContract: source.entryAdmissionContract,
    forbiddenUserInputFields: source.forbiddenUserInputFields,
    runtimeConsumptionBoundary: source.runtimeConsumptionBoundary,
    finalSafety: source.finalSafety
  },
  runtimeControl: {
    consumer: "runtime",
    authorityId: source.authorityId,
    scenarios: source.scenarios.map((scenario) => ({
      scenarioNo: scenario.scenarioNo,
      scenarioId: scenario.scenarioId,
      writesObjects: scenario.writesObjects,
      producesStates: scenario.producesStates,
      upstreamSummaryInputs: scenario.upstreamSummaryInputs
    })),
    stateLadder: source.stateLadder,
    objectOwnership: source.objectOwnership,
    fieldSourceMatrix: source.fieldSourceMatrix,
    fieldAuthorityModel: source.fieldAuthorityModel,
    entryAdmissionContract: source.entryAdmissionContract,
    forbiddenUserInputFields: source.forbiddenUserInputFields,
    crudPolicy: source.crudPolicy,
    financeBoundary: source.financeBoundary,
    finalSafety: source.finalSafety
  },
  scenarioIndex: {
    scenarios: source.scenarios.map((scenario) => ({
      scenarioNo: scenario.scenarioNo,
      scenarioId: scenario.scenarioId,
      nameZh: scenario.nameZh,
      chainLayer: scenario.chainLayer,
      upstreamSummaryInputs: scenario.upstreamSummaryInputs,
      summaryOutputs: scenario.summaryOutputs,
      pageEntries: scenario.pageEntries,
      historicalPackageReferences: scenario.historicalPackageReferences
    }))
  },
  stateLadder: {
    stateLadder: source.stateLadder,
    nonEquivalenceRuleZh: "上游状态不等于下游状态；任何越级写入都必须被拒绝或迁回 Source Authority。"
  },
  objectOwnership: {
    objectOwnership: source.objectOwnership,
    singleWriterRuleZh: "一个对象只能有一个写事实归属；其他场景只能读取摘要或生成 Intent、Request、Draft、Snapshot。"
  },
  fieldMatrix: {
    fieldSourceMatrix: source.fieldSourceMatrix,
    fieldAuthorityModel: source.fieldAuthorityModel,
    forbiddenUserInputFields: source.forbiddenUserInputFields,
    displayIdRuleZh: "业务展示号可以展示和搜索，内部绑定必须由系统完成。"
  },
  crudPolicy: {
    crudPolicy: source.crudPolicy
  },
  evidencePolicy: {
    evidencePolicy: source.evidencePolicy
  },
  financeBoundary: {
    financeBoundary: source.financeBoundary
  },
  pageEntryPolicy: {
    pageEntryPolicy: source.pageEntryPolicy,
    entryAdmissionContract: source.entryAdmissionContract
  },
  handoffSummaries: {
    summaries: source.scenarios.map((scenario) => ({
      scenarioNo: scenario.scenarioNo,
      scenarioId: scenario.scenarioId,
      nameZh: scenario.nameZh,
      upstreamSummaryInputs: scenario.upstreamSummaryInputs,
      summaryOutputs: scenario.summaryOutputs,
      downstreamRuleZh: "下游只能读取上游完成摘要，不得要求用户重新填写已确认上游字段。"
    }))
  },
  oldPackageMigration: {
    oldPackageMigrationMap: source.oldPackageMigrationMap,
    oldPackageIsolationPolicy: source.oldPackageIsolationPolicy
  },
  testPlan: {
    testStandard: source.testStandard,
    scenarioTestMatrix: source.scenarios.map((scenario) => ({
      scenarioNo: scenario.scenarioNo,
      scenarioId: scenario.scenarioId,
      positiveBrowserScreenshotRequired: true,
      negativeBrowserScreenshotRequired: true,
      screenshotAnalysisRequired: true,
      noSideEffectsProofRequired: true,
      globalNegativeCases: source.testStandard.globalNegativeCases
    }))
  }
};

for (const [key, content] of Object.entries(generated)) {
  writeGenerated(outputPaths[key], key, content);
}

console.log("Dormitory 13 scenario control contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-13-scenario-${key}.generated`,
    version: `oam.dormitory-13-scenario-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom: [sourcePath],
    inputDigest,
    inputDigests: [{ path: sourcePath, digest: sourceDigest }],
    sourceContentDigest: sourceDigest,
    authorityId: source.authorityId,
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
