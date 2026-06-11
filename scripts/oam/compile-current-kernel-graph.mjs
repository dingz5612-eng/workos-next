import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_KERNEL_COMPILE_OUTPUT_ROOT || root;
const generatorVersion = "current-oam-kernel-compiler.v1";
const generatedFrom = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const kernelGraphPath = "docs/oam/oam-kernel-graph.json";
const generatedGraphPath = "docs/oam/kernel/oam-kernel-graph.generated.json";
const outputDir = "docs/contracts/generated/dormitory";
const mobileSurfacePath = "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json";
const p0WorkItemTypes = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];

const kernel = readJson(generatedFrom);
const kernelGraphHash = hashFile(kernelGraphPath);
const sourceHash = hashFile(generatedFrom);
const workItems = kernel.workItems ?? [];
const p0WorkItems = p0WorkItemTypes.map((type) => {
  const item = workItems.find((candidate) => candidate.workItemType === type);
  if (!item) throw new Error(`Missing P0 generated candidate source: ${type}`);
  return item;
});
const sourceNodeRefs = p0WorkItems.map((item) => `dormitory.workItem.${item.workItemType}`);
const transitions = [
  {
    policyId: "generated-transition.dormitory.room-setup-to-bed-setup.v1",
    fromDefinitionId: "definition.dormitory.roomSetupConfirm.v1",
    toDefinitionId: "definition.dormitory.bedSetupConfirm.v1"
  },
  {
    policyId: "generated-transition.dormitory.bed-setup-to-resource-readiness.v1",
    fromDefinitionId: "definition.dormitory.bedSetupConfirm.v1",
    toDefinitionId: "definition.dormitory.resourceReadinessConfirm.v1"
  }
];

const generated = {
  manifest: {
    ...meta("dormitory-kernel.generated.manifest", sourceNodeRefs),
    domainId: kernel.domainId,
    activeP0GeneratedCandidateCount: p0WorkItems.length,
    activeP0GeneratedCandidates: p0WorkItems.map(toCandidate),
    blockedGeneratedCandidates: kernel.blockedGeneratedCandidates ?? [],
    transitionPolicy: transitions
  },
  fields: {
    ...meta("fields.generated", sourceNodeRefs),
    fieldClassificationEnum: kernel.fieldClassificationEnum,
    ledgerEffectModel: kernel.ledgerEffectModel,
    workItemFields: p0WorkItems.map((item) => ({
      workItemType: item.workItemType,
      definitionId: item.definitionId,
      fieldClassification: item.fieldClassification,
      ledgerEffect: item.ledgerEffect
    }))
  },
  workitems: {
    ...meta("workitems.generated", sourceNodeRefs),
    workItems: p0WorkItems.map((item) => ({
      generatedCandidateId: item.generatedCandidateId,
      workItemType: item.workItemType,
      definitionId: item.definitionId,
      commandType: item.commandType,
      sourceCardId: item.sourceCardId,
      ownerSlice: item.ownerSlice,
      ownerRole: item.ownerRole,
      generatedStage: item.generatedStage,
      ledgerEffect: item.ledgerEffect,
      allowedFacts: item.allowedFacts,
      forbiddenFacts: item.forbiddenFacts,
      requiredEvidence: item.requiredEvidence
    })),
    transitionPolicy: transitions
  },
  surfaceInputModel: buildSurfaceInputModel(),
  readModel: buildReadModel()
};

const graph = {
  ...meta("oam-kernel-graph.generated", sourceNodeRefs),
  graphType: "current-oam-generated-contract-dag",
  nodeCount: p0WorkItems.length + transitions.length,
  edgeCount: transitions.length,
  nodes: [
    ...p0WorkItems.map((item) => ({
      nodeId: `generated.workItem.${item.workItemType}`,
      nodeType: "generatedWorkItem",
      workItemType: item.workItemType,
      definitionId: item.definitionId,
      sourceNodeRef: `dormitory.workItem.${item.workItemType}`,
      goNoGo: "NO_GO"
    })),
    ...transitions.map((transition) => ({
      nodeId: transition.policyId,
      nodeType: "generatedTransitionPolicy",
      sourceNodeRef: "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
      ...transition
    }))
  ],
  edges: transitions.map((transition) => ({
    from: transition.fromDefinitionId,
    to: transition.toDefinitionId,
    edgeType: "generated_transition_policy"
  }))
};

writeJson(`${outputDir}/dormitory-kernel.generated.manifest.json`, generated.manifest);
writeJson(`${outputDir}/fields.generated.json`, generated.fields);
writeJson(`${outputDir}/workitems.generated.json`, generated.workitems);
writeJson(`${outputDir}/surface-input-model.generated.json`, generated.surfaceInputModel);
writeJson(`${outputDir}/read-model.generated.json`, generated.readModel);
writeJson(generatedGraphPath, graph);
writeJson(mobileSurfacePath, generated.surfaceInputModel);

console.log("Current OAM kernel graph compiled.");

function buildSurfaceInputModel() {
  return {
    ...meta("surface-input-model.generated", sourceNodeRefs),
    consumer: "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
    surfaceOnlyConsumesGeneratedSurfaceModel: true,
    visibleAllowed: true,
    confirmAllowed: false,
    searchVisibleAllowed: true,
    labelInferenceAllowed: false,
    controls: p0WorkItems.flatMap((item) =>
      Object.entries(item.fieldClassification ?? {}).flatMap(([classification, fields]) =>
        (fields ?? []).map((fieldId) => ({
          workItemType: item.workItemType,
          definitionId: item.definitionId,
          fieldId,
          classification,
          controlType: controlTypeFor(fieldId),
          fallbackAllowed: false,
          forbiddenFallbackControls: fieldId === "roomNo" ? ["dropdown", "select", "combobox"] : []
        }))
      )
    )
  };
}

function buildReadModel() {
  return {
    ...meta("read-model.generated", sourceNodeRefs),
    generatedReadModelsOnly: true,
    searchLensProjectionReadonly: true,
    searchResultTargetContract: {
      requiredFields: ["view", "kind", "targetId", "runtimeOwner", "compatibility", "writeThroughSearchAllowed"],
      permissionFilterOrder: "before_ranking",
      hiddenResultRanked: false,
      confirmAllowedRankingBoost: false
    },
    targets: p0WorkItems.map((item) => ({
      view: "operationPanel",
      kind: "operationsWorkItem",
      targetId: item.definitionId,
      runtimeOwner: item.ownerSlice,
      compatibility: "current-oam-read-model-v1",
      writeThroughSearchAllowed: false,
      sourceFacts: item.allowedFacts,
      lineage: [`dormitory.workItem.${item.workItemType}`]
    })),
    metrics: [
      { metricId: "dormitory.resourceReadiness", sourceFacts: ["Room", "Bed"], lineage: sourceNodeRefs },
      { metricId: "dormitory.generatedContractCoverage", sourceFacts: ["CommandSubmission"], lineage: sourceNodeRefs }
    ],
    dashboards: [
      { dashboardId: "dormitory.currentReadiness", sourceFacts: ["Room", "Bed"], lineage: sourceNodeRefs }
    ],
    reportDatasets: [
      { reportDatasetId: "dormitory.generatedP0Contracts", sourceFacts: ["DomainEvent", "CommandSubmission"], lineage: sourceNodeRefs }
    ],
    languageGlossary: {
      supports: ["objectKind", "resultType", "metric", "dashboard", "lineage", "readiness"]
    }
  };
}

function controlTypeFor(fieldId) {
  return fieldId === "roomNo" ? "text" : /Id$/.test(fieldId) ? "stableRef" : "text";
}

function toCandidate(item) {
  return {
    generatedCandidateId: item.generatedCandidateId,
    workItemType: item.workItemType,
    definitionId: item.definitionId,
    sourceNodeRef: `dormitory.workItem.${item.workItemType}`,
    generatedStage: item.generatedStage,
    ledgerEffect: item.ledgerEffect
  };
}

function meta(kind, refs) {
  const compilerInputDigest = digest({
    generatorVersion,
    kind,
    generatedFrom,
    sourceHash,
    kernelGraphHash,
    sourceNodeRefs: refs
  });
  return {
    generated: true,
    doNotEdit: true,
    kind,
    kernelGraphHash,
    sourceNodeRefs: refs,
    sourceRefs: refs,
    sourceHash,
    sourceContentDigest: sourceHash,
    compilerInputDigest,
    outputContentDigest: "sha256:pending",
    deterministicSort: true,
    generatorVersion,
    generatedFrom
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const target = path.join(outputRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const document = finalizeGenerated(value);
  fs.writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function hashFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file), "utf8")).digest("hex")}`;
}

function finalizeGenerated(value) {
  if (value?.generated !== true) return value;
  const document = { ...value, outputContentDigest: "sha256:pending" };
  document.outputContentDigest = digest(document);
  return document;
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
