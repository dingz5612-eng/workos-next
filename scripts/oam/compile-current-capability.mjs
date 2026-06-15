import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH,
  loadCapabilityDocuments,
  stableStringify,
  validateCurrentProjection
} from "./lib/capability-delivery-control-plane.mjs";
import { GENERATED_CANDIDATE_ACCEPTANCE_PATH } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const outputRoot = process.env.WORKOS_CAPABILITY_COMPILE_OUTPUT_ROOT || root;
const compilerVersion = "oam.capability-compiler.v1";
const generatedBy = "scripts/oam/compile-current-capability.mjs";
const mobileProjectionPath = "apps/mobile/src/generated/oam/capability-projection.generated.json";
const runtimeProjectionPath = "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json";
const dbProjectionPolicyPath = "docs/contracts/generated/dormitory/db-projection-policy.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/test-plan.generated.json";
const digestChainPath = "artifacts/oam/evidence/capability-digest-chain.json";
const workitemsPath = "docs/contracts/generated/dormitory/workitems.generated.json";
const surfaceModelPath = "docs/contracts/generated/dormitory/surface-input-model.generated.json";
const mobileSurfaceModelPath = "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json";
const fieldBindingsPath = "docs/contracts/generated/dormitory/field-bindings.generated.json";
const runtimeAdmissionPath = "docs/oam/dormitory-runtime-admission.current.json";
const landingPath = "docs/oam/dormitory-first-golden-chain-landing.current.json";
const environmentProfilePath = "docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json";
const dbProjectionProofResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-db-projection-proof-result.json";
const browserAuditReportPath = "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/first-golden-chain-real-browser-report.json";
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";

const { registry, ledger, projection } = loadCapabilityDocuments(root);
const projectionState = validateCurrentProjection({ registry, ledger, projection });
if (projectionState.status !== "PASS") {
  throw new Error(`current capability projection is not valid: ${projectionState.failures.join("; ")}`);
}

const acceptance = readJson(GENERATED_CANDIDATE_ACCEPTANCE_PATH);
const runtimeAdmission = readJson(runtimeAdmissionPath);
const landing = readJson(landingPath);
const environmentProfile = readJson(environmentProfilePath);
const workitems = readJson(workitemsPath);
const surfaceModel = readJson(surfaceModelPath);
const fieldBindings = readJson(fieldBindingsPath);

const acceptedGeneratedBundleDigest = projection.activeAuthority?.acceptedGeneratedBundleDigest;
if (!isDigest(acceptedGeneratedBundleDigest)) {
  throw new Error("acceptedGeneratedBundleDigest must be available from capability activeAuthority.");
}
if (acceptance.acceptedGeneratedBundleDigest !== acceptedGeneratedBundleDigest) {
  throw new Error("acceptedGeneratedBundleDigest mismatch between capability projection and acceptance authority.");
}
if (runtimeAdmission.runtimeConsumedBundleDigest !== acceptedGeneratedBundleDigest) {
  throw new Error("runtimeConsumedBundleDigest must equal acceptedGeneratedBundleDigest.");
}

const generatedFrom = [
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  workitemsPath,
  surfaceModelPath,
  fieldBindingsPath,
  runtimeAdmissionPath,
  landingPath,
  environmentProfilePath,
  dbProjectionProofResultPath,
  browserAuditReportPath,
  evidenceGraphPath
];
const inputDigests = generatedFrom.map((file) => ({ path: file, digest: fileDigest(file) }));
const inputDigest = digestObject({
  version: "oam.capability-compiler-input.v1",
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest,
  inputDigests
});

const optionSetDefaults = {
  bunkType: {
    oneBed: "whole",
    multiBed: "bunk_pair"
  },
  readinessState: {
    default: "available"
  }
};
const optionSets = {
  bunkType: [
    { value: "bunk_pair", label: { "zh-CN": "上下铺：两上两下", "ru-RU": "Двухъярусные: две верхние и две нижние", "ky-KG": "Эки кабат: эки үстүңкү жана эки астыңкы" } },
    { value: "upper", label: { "zh-CN": "全部上铺", "ru-RU": "Все верхние", "ky-KG": "Баары үстүңкү" } },
    { value: "lower", label: { "zh-CN": "全部下铺", "ru-RU": "Все нижние", "ky-KG": "Баары астыңкы" } },
    { value: "whole", label: { "zh-CN": "全部平铺", "ru-RU": "Обычные койки", "ky-KG": "Жалпак койкалар" } }
  ],
  readinessState: [
    { value: "available", label: { "zh-CN": "可分配", "ru-RU": "Можно распределить", "ky-KG": "Бөлүштүрүүгө болот" }, branchOutput: "complete", requiredFields: [] },
    { value: "cleaningRequired", label: { "zh-CN": "待清洁", "ru-RU": "Нужна уборка", "ky-KG": "Тазалоо керек" }, branchOutput: "cleaningRequired", requiredFields: [] },
    { value: "maintenanceRequired", label: { "zh-CN": "待维修", "ru-RU": "Нужен ремонт", "ky-KG": "Оңдоо керек" }, branchOutput: "serviceVerificationRef", requiredFields: ["serviceVerificationRef"] },
    { value: "materialsRequired", label: { "zh-CN": "待补材料", "ru-RU": "Нужны материалы", "ky-KG": "Материал керек" }, branchOutput: "materialsRequired", requiredFields: [] },
    { value: "notSaleable", label: { "zh-CN": "暂不可用", "ru-RU": "Временно недоступно", "ky-KG": "Азырынча жеткиликсиз" }, branchOutput: "notSaleableReason", requiredFields: ["notSaleableReason"] }
  ]
};
const steps = buildSteps();
const fieldCategories = buildFieldCategories(steps);
const mobileSurfaceModel = finalizeGenerated({
  ...surfaceModel,
  ...generatedBase("dormitory-surface-input-model.generated"),
  sourceGeneratedFrom: surfaceModel.generatedFrom,
  sourceContentDigest: surfaceModel.outputContentDigest ?? surfaceModel.sourceContentDigest ?? null,
  sourceControlCount: surfaceModel.controls?.length ?? 0,
  controls: buildMobileSurfaceControls(),
  fieldCategories,
  optionSets,
  optionSetDefaults,
  surfaceOnlyConsumesGeneratedSurfaceModel: true,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
});
const commandCatalog = buildCommandCatalog(steps);
const fieldLabels = buildFieldLabels(steps);
const runtimeProjectionCore = {
  ...generatedBase("generated-capability-runtime-projection"),
  workspaceId: CAPABILITY_ID,
  legacyResourceWorkspaceId: "W-STAY-RESOURCE",
  sliceRuntimeStatus: "runtime-test-admitted",
  runtimeAdmissionStatus: runtimeAdmission.runtimeAdmissionStatus,
  runtimeConsumptionReady: runtimeAdmission.runtimeConsumptionReady === true,
  steps,
  commandCatalog,
  fieldLabels,
  fieldCategories,
  optionSets,
  optionSetDefaults,
  readinessBranchBindings: readinessBranchBindings(),
  draftPolicy: capabilityDraftPolicy(),
  businessUi: capabilityBusinessUi(),
  legacyRegressionAliases: legacyRegressionAliases(),
  derivedFieldKeys: [
    { cardId: steps[0]?.cardId, derivedFieldKeys: ["roomId"] },
    { cardId: steps[1]?.cardId, derivedFieldKeys: ["bedId"] }
  ].filter((item) => item.cardId),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};
const runtimeProjection = finalizeGenerated({
  ...runtimeProjectionCore,
  runtimeProjectionDigest: digestObject(runtimeProjectionCore)
});

const surfaceCore = {
  ...generatedBase("capability-projection.generated"),
  workspaceId: CAPABILITY_ID,
  steps,
  commandCatalog,
  fieldLabels,
  fieldCategories,
  optionSets,
  optionSetDefaults,
  readinessBranchBindings: readinessBranchBindings(),
  draftPolicy: capabilityDraftPolicy(),
  businessUi: capabilityBusinessUi(),
  legacyRegressionAliases: legacyRegressionAliases(),
  generatedSurfaceModelRef: mobileSurfaceModelPath,
  surfaceOnlyConsumesGeneratedSurfaceModel: true,
  searchProjection: {
    commandSource: "generated capability projection",
    ordinaryRoomQueryStartsCommand: false,
    currentCommandQueries: commandCatalog[0]?.keywords ?? [],
    commandQueryExamples: ["新增房间", "创建房间"],
    objectQueryExamples: ["D01", "101房间", "床位"],
    objectQueriesStartCommand: false,
    resultGrouping: ["case", "workItem"],
    forbiddenCommandSources: ["legacy resource workspace", "pricing setup", "blocking flow", "release flow"]
  },
  runtimeProjectionDigest: runtimeProjection.runtimeProjectionDigest,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};
const surfaceProjectionDigest = digestObject({
  version: "oam.capability-surface-projection-digest.v1",
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest,
  steps: steps.map((step) => ({
    index: step.index,
    cardId: step.cardId,
    workItemType: step.workItemType,
    fieldIds: step.fields.map((field) => field.fieldId)
  })),
  generatedSurfaceModelDigest: mobileSurfaceModel.outputContentDigest
});
const searchProjectionDigest = digestObject({
  version: "oam.capability-search-projection-digest.v1",
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest,
  commandCatalog
});
const mobileProjection = finalizeGenerated({
  ...surfaceCore,
  surfaceProjectionDigest,
  searchProjectionDigest
});

const dbProjectionPolicy = finalizeGenerated({
  ...generatedBase("db-projection-policy.generated"),
  policyMode: landing.landingStatus === "DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_APPROVED"
    ? "business_landing_projection_required"
    : "null_if_runtime_test_only",
  runtimeStorageMode: environmentProfile.runtimeStorageMode,
  activeDbProjectionMappings: [],
  inactiveBusinessLandingMappings: [
    {
      workItemType: "Dorm.RoomSetupConfirm",
      domainEvent: "Accommodation.RoomConfigured",
      target: "accommodation_rooms"
    },
    {
      workItemType: "Dorm.BedSetupConfirm",
      domainEvent: "Accommodation.BedConfigured",
      target: "accommodation_beds"
    },
    {
      workItemType: "Dorm.ResourceReadinessConfirm",
      domainEvent: "Accommodation.RoomReadinessChanged",
      target: "readiness/read model"
    }
  ],
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
});

const testPlanDraft = buildTestPlan({
  runtimeProjectionDigest: runtimeProjection.runtimeProjectionDigest,
  surfaceProjectionDigest: mobileProjection.surfaceProjectionDigest,
  searchProjectionDigest: mobileProjection.searchProjectionDigest,
  dbProjectionPolicyDigest: dbProjectionPolicy.outputContentDigest,
  capabilityDigestChainDigest: "sha256:pending"
});
const testPlanDigest = digestObject(withoutGeneratedDigests(testPlanDraft));
const digestChainCore = {
  ...generatedBase("capability-digest-chain"),
  authorityLedgerDigest: fileDigest(CAPABILITY_LEDGER_PATH),
  runtimeProjectionDigest: runtimeProjection.runtimeProjectionDigest,
  surfaceProjectionDigest: mobileProjection.surfaceProjectionDigest,
  searchProjectionDigest: mobileProjection.searchProjectionDigest,
  dbProjectionPolicyDigest: dbProjectionPolicy.outputContentDigest,
  dbProjectionProofDigest: currentDbProjectionProofDigest(),
  testPlanDigest,
  browserAuditDigest: currentBrowserAuditDigest(),
  evidenceRootDigest: currentEvidenceRootDigest(),
  browserFixtureScope: {
    browserScopeSource: "capability compiler projection",
    includedWorkItems: steps.map((step) => step.workItemType),
    forbiddenBusinessLandingInterpretation: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};
const digestChain = finalizeGenerated(digestChainCore);

const testPlan = buildTestPlan({
  runtimeProjectionDigest: runtimeProjection.runtimeProjectionDigest,
  surfaceProjectionDigest: mobileProjection.surfaceProjectionDigest,
  searchProjectionDigest: mobileProjection.searchProjectionDigest,
  dbProjectionPolicyDigest: dbProjectionPolicy.outputContentDigest,
  capabilityDigestChainDigest: digestChain.outputContentDigest
});
const finalizedTestPlan = finalizeGenerated({
  ...testPlan,
  testPlanDigest
});

writeJson(runtimeProjectionPath, runtimeProjection);
writeJson(mobileSurfaceModelPath, mobileSurfaceModel);
writeJson(mobileProjectionPath, mobileProjection);
writeJson(dbProjectionPolicyPath, dbProjectionPolicy);
writeJson(digestChainPath, digestChain);
writeJson(testPlanPath, finalizedTestPlan);

console.log("Current capability compiled.");
console.log(`acceptedGeneratedBundleDigest=${acceptedGeneratedBundleDigest}`);

function buildSteps() {
  const controls = buildMobileSurfaceControls();
  return (workitems.workItems ?? []).map((item, index, all) => {
    const stepControls = controls.filter((control) => control.workItemType === item.workItemType);
    const fields = stepControls
      .filter((control) => ["clientSubmitted", "selectedStableRef", "systemDerived"].includes(control.classification))
      .map((control) => fieldProjectionForControl(control, item.workItemType));
    return {
      index: index + 1,
      total: all.length,
      step: `${index + 1}/${all.length}`,
      cardId: item.workItemType,
      workItemType: item.workItemType,
      definitionId: item.definitionId,
      commandType: item.commandType,
      ownerSlice: item.ownerSlice,
      title: titleFor(item.workItemType, index + 1, all.length),
      fields,
      evidenceIds: item.requiredEvidence ?? [],
      eventType: `${item.workItemType}.confirmed`,
      projectionTargets: ["accepted-capability-runtime-projection"]
    };
  });
}

function buildMobileSurfaceControls() {
  const sourceControls = surfaceModel.controls ?? [];
  const byWorkItemField = new Set(sourceControls.map((control) => `${control.workItemType}:${control.fieldId}`));
  const controls = sourceControls.map(enrichSurfaceControl);
  for (const item of workitems.workItems ?? []) {
    for (const spec of systemDerivedSpecsForWorkItem(item.workItemType)) {
      const key = `${item.workItemType}:${spec.fieldId}`;
      if (byWorkItemField.has(key)) continue;
      controls.push(enrichSurfaceControl({
        workItemType: item.workItemType,
        definitionId: item.definitionId,
        fieldId: spec.fieldId,
        classification: "systemDerived",
        controlType: spec.surface === "hidden-submit-only" ? "hidden" : "readonly",
        fallbackAllowed: false,
        forbiddenFallbackControls: ["text", "textarea", "select", "combobox"]
      }));
    }
  }
  return controls;
}

function enrichSurfaceControl(control) {
  const role = fieldRole(control.workItemType, control.fieldId, control.classification);
  const optionSet = optionSetForField(control.fieldId);
  return {
    ...control,
    fieldCategory: role.fieldCategory,
    userSubmitted: role.userSubmitted,
    readonly: role.readonly,
    hiddenSubmitOnly: role.surface === "hidden-submit-only",
    surface: role.surface,
    displayValueSource: role.displayValueSource,
    submitValueSource: role.submitValueSource,
    optionSet,
    controlType: optionSet ? "select" : role.controlType || control.controlType,
    defaultValue: defaultValueForField(control.fieldId),
    branchOutput: branchOutputForField(control.fieldId),
    branchRequiredFields: branchRequiredFieldsForField(control.fieldId),
    source: role.source
  };
}

function fieldProjectionForControl(control, workItemType) {
  const role = fieldRole(workItemType, control.fieldId, control.classification);
  const optionSet = optionSetForField(control.fieldId);
  return {
    fieldId: control.fieldId,
    classification: control.classification,
    fieldCategory: role.fieldCategory,
    controlType: optionSet ? "select" : role.controlType || control.controlType,
    optionSet,
    defaultValue: defaultValueForField(control.fieldId),
    source: role.source,
    readonly: role.readonly,
    hiddenSubmitOnly: role.surface === "hidden-submit-only",
    userSubmitted: role.userSubmitted,
    required: role.userSubmitted,
    displayValueSource: role.displayValueSource,
    submitValueSource: role.submitValueSource,
    branchOutput: branchOutputForField(control.fieldId),
    branchRequiredFields: branchRequiredFieldsForField(control.fieldId),
    ui: {
      control: optionSet ? "select" : role.controlType || control.controlType,
      optionSet,
      defaultValue: defaultValueForField(control.fieldId),
      readonly: role.readonly,
      hiddenSubmitOnly: role.surface === "hidden-submit-only"
    }
  };
}

function fieldRole(workItemType, fieldId, classification) {
  const spec = systemDerivedSpecsForWorkItem(workItemType).find((item) => item.fieldId === fieldId);
  if (spec) {
    return {
      fieldCategory: "systemDerivedFields",
      userSubmitted: false,
      readonly: true,
      surface: spec.surface,
      controlType: spec.surface === "hidden-submit-only" ? "hidden" : "readonly",
      displayValueSource: spec.displayValueSource,
      submitValueSource: spec.submitValueSource,
      source: spec.source
    };
  }
  if (branchOutputFieldIds().includes(fieldId)) {
    return {
      fieldCategory: "branchOutputFields",
      userSubmitted: false,
      readonly: true,
      surface: "branch-output",
      controlType: "hidden",
      displayValueSource: "branch binding",
      submitValueSource: "branch binding",
      source: "field-bindings.generated.json"
    };
  }
  if (classification === "selectedStableRef") {
    return {
      fieldCategory: "systemDerivedFields",
      userSubmitted: false,
      readonly: true,
      surface: "readonly-hidden-submit",
      controlType: "readonly",
      displayValueSource: "accepted runtime context display value",
      submitValueSource: "accepted runtime context stable ref",
      source: "runtime context"
    };
  }
  return {
    fieldCategory: "requiredCoreFields",
    userSubmitted: true,
    readonly: false,
    surface: "editable",
    controlType: "",
    displayValueSource: "user input display value",
    submitValueSource: "user input submit value",
    source: "clientSubmitted"
  };
}

function systemDerivedSpecsForWorkItem(workItemType) {
  const specs = {
    "Dorm.RoomSetupConfirm": [
      { fieldId: "roomId", surface: "hidden-submit-only", displayValueSource: "roomNo", submitValueSource: "derived room stable ref", source: "system-derived-from-roomNo" }
    ],
    "Dorm.BedSetupConfirm": [
      { fieldId: "roomId", surface: "readonly-hidden-submit", displayValueSource: "room display value", submitValueSource: "accepted runtime context roomId", source: "runtime context" },
      { fieldId: "bedId", surface: "hidden-submit-only", displayValueSource: "bedNo", submitValueSource: "derived bed stable ref", source: "system-derived-from-roomId-bedNo" }
    ],
    "Dorm.ResourceReadinessConfirm": [
      { fieldId: "roomId", surface: "readonly-hidden-submit", displayValueSource: "room display value", submitValueSource: "accepted runtime context roomId", source: "runtime context" },
      { fieldId: "bedId", surface: "readonly-hidden-submit", displayValueSource: "bed display value", submitValueSource: "accepted runtime context bedId", source: "runtime context" }
    ]
  };
  return specs[workItemType] ?? [];
}

function optionSetForField(fieldId) {
  if (fieldId === "bedType") return "bunkType";
  if (fieldId === "readinessState") return "readinessState";
  return "";
}

function defaultValueForField(fieldId) {
  if (fieldId === "bedType") return optionSetDefaults.bunkType.multiBed;
  if (fieldId === "readinessState") return "";
  return "";
}

function branchOutputForField(fieldId) {
  if (fieldId !== "readinessState") return "";
  return "readinessState.branchBindings";
}

function branchRequiredFieldsForField(fieldId) {
  if (fieldId !== "readinessState") return [];
  return ["serviceVerificationRef", "notSaleableReason"];
}

function branchOutputFieldIds() {
  return ["serviceVerificationRef", "blockedReason", "notSaleableReason", "readinessEvidenceRefs"];
}

function readinessBranchBindings() {
  return Object.fromEntries(optionSets.readinessState.map((item) => [item.value, {
    label: item.label,
    branchOutput: item.branchOutput,
    requiredFields: item.requiredFields
  }]));
}

function buildFieldCategories(currentSteps) {
  const entries = currentSteps.flatMap((step) => step.fields.map((field) => ({
    cardId: step.cardId,
    workItemType: step.workItemType,
    fieldId: field.fieldId,
    source: field.source,
    surface: field.hiddenSubmitOnly ? "hidden-submit-only" : field.readonly ? "readonly-hidden-submit" : "editable",
    userSubmitted: field.userSubmitted === true,
    readonly: field.readonly === true,
    optionSet: field.optionSet || "",
    displayValueSource: field.displayValueSource,
    submitValueSource: field.submitValueSource
  })));
  return {
    requiredCoreFields: entries.filter((entry) => entry.userSubmitted),
    optionalBusinessFields: [],
    systemDerivedFields: entries.filter((entry) => ["roomId", "bedId"].includes(entry.fieldId)),
    branchOutputFields: fieldBindings.fieldBindings
      .filter((binding) => binding.branchOutputOnly === true || ["serviceVerificationRef", "readinessEvidenceRefs"].includes(binding.fieldId))
      .map((binding) => ({
        fieldId: binding.fieldId,
        semanticRole: binding.semanticRole,
        branchOutputOnly: binding.branchOutputOnly === true,
        userSubmitted: false,
        readonly: true,
        sourceBindingRef: binding.sourceBindingRef,
        requiredWhen: binding.fieldId === "serviceVerificationRef"
          ? { readinessState: "maintenanceRequired" }
          : binding.fieldId === "notSaleableReason"
            ? { readinessState: "notSaleable" }
            : null
      })),
    evidenceFields: currentSteps.flatMap((step) => step.evidenceIds.map((fieldId) => ({
      cardId: step.cardId,
      workItemType: step.workItemType,
      fieldId,
      source: "evidence envelope",
      userSubmitted: false
    }))),
    plannedFields: [
      { fieldId: "serviceVerificationRef", status: "branch-required-evidence-ref", requiredWhen: { readinessState: "maintenanceRequired" } },
      { fieldId: "notSaleableReason", status: "branch-required-reason", requiredWhen: { readinessState: "notSaleable" } }
    ]
  };
}

function capabilityDraftPolicy() {
  return {
    scope: "current_step_user_input_only",
    excludesSystemDerivedFields: true,
    excludesEvidenceDraftsFromFieldDraft: true,
    clearOnSubmitSuccess: true,
    noCrossWorkItem: true,
    noCrossStep: true,
    notEvidence: true
  };
}

function capabilityBusinessUi() {
  return {
    technicalDetailsDefaultExpanded: false,
    runtimeTestOnlySubmitLabel: { "zh-CN": "提交内测记录", "ru-RU": "Отправить тестовую запись", "ky-KG": "Ички тест жазуусун тапшыруу" },
    businessLandingSubmitLabels: {
      "Dorm.RoomSetupConfirm": { "zh-CN": "确认房间配置", "ru-RU": "Подтвердить комнату", "ky-KG": "Бөлмөнү ырастоо" },
      "Dorm.BedSetupConfirm": { "zh-CN": "确认床位配置", "ru-RU": "Подтвердить койку", "ky-KG": "Койканы ырастоо" },
      "Dorm.ResourceReadinessConfirm": { "zh-CN": "确认资源就绪", "ru-RU": "Подтвердить готовность", "ky-KG": "Даярдыгын ырастоо" }
    },
    completionBusinessValueFields: ["roomNo", "bedNo", "readinessState"],
    forbiddenMainFormTerms: ["accepted capability bundle projection", "generated capability projection", "acceptedGeneratedBundleDigest"]
  };
}

function buildCommandCatalog(currentSteps) {
  const first = currentSteps[0];
  return [{
    templateWorkspaceId: CAPABILITY_ID,
    firstCardId: first.cardId,
    title: {
      "zh-CN": "新增房间",
      "ru-RU": "Добавить комнату",
      "ky-KG": "Бөлмө кошуу"
    },
    subtitle: {
      "zh-CN": "按房间配置、床位配置、资源就绪三步办理。",
      "ru-RU": "Три шага: комната, койка, готовность.",
      "ky-KG": "Үч кадам: бөлмө, койка, даярдык."
    },
    nextAction: {
      "zh-CN": "先确认房间号",
      "ru-RU": "Начать с номера комнаты",
      "ky-KG": "Бөлмө номеринен баштоо"
    },
    keywords: [
      "新增房间",
      "创建房间",
      "宿舍建档",
      "房间建档",
      "新建房间",
      "配置房间",
      "宿舍第一金链",
      "room setup",
      "create room",
      "add room",
      "new room",
      "добавить комнату",
      "создать комнату",
      "бөлмө кошуу"
    ]
  }];
}

function legacyRegressionAliases() {
  return {
    runtimeIdentityAllowed: false,
    roomSetupCardIds: ["roomSetup"],
    bedSetupCardIds: ["bedSetup"],
    resourceReadinessCardIds: ["roomReadiness"]
  };
}

function buildFieldLabels(currentSteps) {
  const labels = {};
  for (const fieldId of new Set(currentSteps.flatMap((step) => step.fields.map((field) => field.fieldId)))) {
    labels[fieldId] = labelFor(fieldId);
  }
  for (const evidenceId of new Set(currentSteps.flatMap((step) => step.evidenceIds))) {
    labels[evidenceId] = labelFor(evidenceId);
  }
  return labels;
}

function buildTestPlan(digests) {
  return {
    ...generatedBase("dormitory-first-golden-chain-test-plan.generated"),
    version: "oam.dormitory-first-golden-chain-test-plan.generated.v1",
    generatedBy,
    runtimeProjectionDigest: digests.runtimeProjectionDigest,
    surfaceProjectionDigest: digests.surfaceProjectionDigest,
    searchProjectionDigest: digests.searchProjectionDigest,
    dbProjectionPolicyDigest: digests.dbProjectionPolicyDigest,
    capabilityDigestChainDigest: digests.capabilityDigestChainDigest,
    mainGatePolicy: {
      currentMainGate: "dormitory_first_golden_chain_capability_only",
      legacyScenarioMainGate: false,
      legacyFullPathAuditMainGate: false,
      legacyBrowserAuditLane: "reference_only_regression"
    },
    scope: {
      includedWorkItems: steps.map((step) => ({
        step: step.step,
        workItemType: step.workItemType,
        cardId: step.cardId,
        title: step.workItemType.replace(/^Dorm\./, "")
      })),
      excludedLegacyWorkItemCategories: ["pricing_setup", "blocking_flow", "release_flow"],
      businessLandingAllowed: false,
      productionConfirmAllowed: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    browserAudit: {
      runner: "scripts/surface/run-dormitory-first-golden-chain-real-browser-audit.mjs",
      checker: "scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs",
      evidenceRoot: "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser",
      query: "新增房间",
      account: "dormOperator",
      environment: environmentProfile.environmentProfileId
    },
    testCases: steps.map((step) => ({
      id: `dormitory.first_golden_chain.${step.index}.${step.workItemType.replace(/^Dorm\./, "")}`,
      step: step.step,
      workItemType: step.workItemType,
      expectedVisibleStepLabel: step.step,
      requiresBrowserProof: true,
      forbiddenVisibleTerms: [
        "价格配置",
        "房间床位阻断",
        "房间床位释放",
        "生产确认",
        "发布确认",
        "Final GO"
      ]
    })),
    forbiddenInterpretations: [
      "browser audit PASS is not business landing",
      "browser audit PASS is not production confirmation",
      "browser audit PASS is not release authority",
      "browser audit PASS is not final GO",
      "legacy browser audits are reference-only regression evidence"
    ]
  };
}

function generatedBase(kind) {
  return {
    generated: true,
    doNotEdit: true,
    kind,
    generatorVersion: compilerVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    outputContentDigest: "sha256:pending",
    capabilityId: CAPABILITY_ID,
    acceptedGeneratedBundleDigest,
    currentFilesMode: projection.currentFilesMode,
    lifecycleState: projection.lifecycleAchieved?.at(-1) ?? "UNKNOWN",
    runtimeAdmissionStatus: runtimeAdmission.runtimeAdmissionStatus,
    landingStatus: landing.landingStatus
  };
}

function finalizeGenerated(value) {
  const outputContentDigest = digestObject({ ...value, outputContentDigest: "sha256:pending" });
  return { ...value, outputContentDigest };
}

function withoutGeneratedDigests(value) {
  if (Array.isArray(value)) return value.map(withoutGeneratedDigests);
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      if (["outputContentDigest", "testPlanDigest", "capabilityDigestChainDigest"].includes(key)) continue;
      next[key] = withoutGeneratedDigests(child);
    }
    return next;
  }
  return value;
}

function currentDbProjectionProofDigest() {
  const result = readJsonIfExists(dbProjectionProofResultPath);
  if (result?.status === "PASS" && result.dbProjectionProofDigest === "null_if_runtime_test_only") {
    return "null_if_runtime_test_only";
  }
  return isDigest(result?.dbProjectionProofDigest) ? result.dbProjectionProofDigest : "missing";
}

function currentBrowserAuditDigest() {
  const report = readJsonIfExists(browserAuditReportPath);
  return isDigest(report?.browserAuditDigest) ? report.browserAuditDigest : "missing";
}

function currentEvidenceRootDigest() {
  const graph = readJsonIfExists(evidenceGraphPath);
  return isDigest(graph?.evidenceRootDigest)
    ? graph.evidenceRootDigest
    : digestObject({
      version: "oam.pending-evidence-root-digest.v1",
      capabilityId: CAPABILITY_ID,
      acceptedGeneratedBundleDigest
    });
}

function titleFor(workItemType, index, total) {
  const titles = {
    "Dorm.RoomSetupConfirm": {
      "zh-CN": `${index}/${total} 房间配置确认`,
      "ru-RU": `${index}/${total} Подтверждение комнаты`,
      "ky-KG": `${index}/${total} Бөлмө тастыктоо`
    },
    "Dorm.BedSetupConfirm": {
      "zh-CN": `${index}/${total} 床位配置确认`,
      "ru-RU": `${index}/${total} Подтверждение койки`,
      "ky-KG": `${index}/${total} Койка тастыктоо`
    },
    "Dorm.ResourceReadinessConfirm": {
      "zh-CN": `${index}/${total} 资源就绪确认`,
      "ru-RU": `${index}/${total} Подтверждение готовности`,
      "ky-KG": `${index}/${total} Даярдык тастыктоо`
    }
  };
  return titles[workItemType] ?? {
    "zh-CN": `${index}/${total} ${workItemType}`,
    "ru-RU": `${index}/${total} ${workItemType}`,
    "ky-KG": `${index}/${total} ${workItemType}`
  };
}

function labelFor(fieldId) {
  const labels = {
    roomNo: ["房间号", "Номер комнаты", "Бөлмө номери"],
    floor: ["楼层", "Этаж", "Кабат"],
    capacity: ["床位数", "Количество коек", "Койка саны"],
    roomId: ["所属房间", "Комната", "Бөлмө"],
    bedNo: ["床位号", "Номер койки", "Койка номери"],
    bedType: ["床位类型", "Тип койки", "Койка түрү"],
    bedId: ["床位", "Койка", "Койка"],
    readinessState: ["就绪状态", "Статус готовности", "Даярдык абалы"],
    "room-photo": ["房间照片", "Фото комнаты", "Бөлмө сүрөтү"],
    "room-basic-info": ["房间基础信息", "Основная информация комнаты", "Бөлмө негизги маалыматы"],
    "bed-photo": ["床位照片", "Фото койки", "Койка сүрөтү"],
    "room-link-proof": ["房间关联证明", "Подтверждение связи с комнатой", "Бөлмө байланышынын далили"],
    "completion-photo": ["完成照片", "Фото завершения", "Аяктоо сүрөтү"],
    "verification-check": ["核验记录", "Запись проверки", "Текшерүү жазуусу"]
  };
  const [zh, ru, ky] = labels[fieldId] ?? [fieldId, fieldId, fieldId];
  return { "zh-CN": zh, "ru-RU": ru, "ky-KG": ky };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function writeJson(file, value) {
  const target = path.join(outputRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileDigest(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    return digestObject({ missing: true, path: file });
  }
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex")}`;
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function isDigest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value ?? ""));
}
