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
const subjectChainPath = "artifacts/oam/evidence/capability-evidence-subject-chain.json";
const objectIdentityPath = "docs/contracts/generated/dormitory/object-identity.generated.json";
const bedCardinalityPath = "docs/contracts/generated/dormitory/bed-cardinality.generated.json";
const businessInvariantsPath = "docs/contracts/generated/dormitory/business-invariants.generated.json";
const commandContractsPath = "docs/contracts/generated/dormitory/command-contracts.generated.json";
const failureSemanticsPath = "docs/contracts/generated/dormitory/failure-semantics.generated.json";
const ruleSourceMapPath = "docs/contracts/generated/dormitory/rule-source-map.generated.json";
const scenario1RuntimeRulesPath = "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json";
const scenario1StepsFieldsPath = "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json";
const scenario1SurfaceNavigationPath = "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json";
const workitemsPath = "docs/contracts/generated/dormitory/workitems.generated.json";
const surfaceModelPath = "docs/contracts/generated/dormitory/surface-input-model.generated.json";
const mobileSurfaceModelPath = "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json";
const fieldBindingsPath = "docs/contracts/generated/dormitory/field-bindings.generated.json";
const runtimeAdmissionPath = "docs/oam/dormitory-runtime-admission.current.json";
const landingPath = "docs/oam/dormitory-first-golden-chain-landing.current.json";
const environmentProfilePath = "docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json";
const capabilityDecisionAuthorityPath = "docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json";
const objectGraphAuthorityPath = "docs/business/domains/dormitory/dormitory-object-graph.authority.json";
const bedCardinalityAuthorityPath = "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json";
const invariantAuthorityPath = "docs/business/domains/dormitory/dormitory-invariants.authority.json";
const commandContractAuthorityPath = "docs/business/domains/dormitory/dormitory-command-contracts.authority.json";
const failureSemanticsAuthorityPath = "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json";
const dbProjectionProofResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-db-projection-proof-result.json";
const browserAuditReportPath = "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/first-golden-chain-real-browser-report.json";
const negativeBrowserAuditReportPath = "artifacts/oam/evidence/dormitory-first-golden-chain-negative-browser/negative-browser-report.json";
const noSideEffectsProofResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-no-side-effects-proof-result.json";
const environmentProfileProofResultPath = "artifacts/oam/checks/dormitory-evidence-environment-profile-result.json";

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
const capabilityDecisionAuthority = readJson(capabilityDecisionAuthorityPath);
const objectGraphAuthority = readJson(objectGraphAuthorityPath);
const bedCardinalityAuthority = readJson(bedCardinalityAuthorityPath);
const invariantAuthority = readJson(invariantAuthorityPath);
const commandContractAuthority = readJson(commandContractAuthorityPath);
const failureSemanticsAuthority = readJson(failureSemanticsAuthorityPath);
const scenario1RuntimeRules = readJson(scenario1RuntimeRulesPath);
const scenario1StepsFields = readJson(scenario1StepsFieldsPath);
const scenario1SurfaceNavigation = readJson(scenario1SurfaceNavigationPath);

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
  capabilityDecisionAuthorityPath,
  objectGraphAuthorityPath,
  bedCardinalityAuthorityPath,
  invariantAuthorityPath,
  commandContractAuthorityPath,
  failureSemanticsAuthorityPath,
  scenario1RuntimeRulesPath,
  scenario1StepsFieldsPath,
  scenario1SurfaceNavigationPath,
  workitemsPath,
  surfaceModelPath,
  fieldBindingsPath,
  runtimeAdmissionPath,
  landingPath,
  environmentProfilePath
];
const evidenceProofInputs = [
  environmentProfileProofResultPath,
  dbProjectionProofResultPath,
  browserAuditReportPath,
  negativeBrowserAuditReportPath,
  noSideEffectsProofResultPath
];
const inputDigests = generatedFrom.map((file) => ({ path: file, digest: fileDigest(file) }));
const inputDigest = digestObject({
  version: "oam.capability-compiler-input.v1",
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest,
  inputDigests
});
const subjectGeneratedFrom = [...generatedFrom, ...evidenceProofInputs];
const subjectInputDigests = subjectGeneratedFrom.map((file) => ({ path: file, digest: fileDigest(file) }));
const subjectInputDigest = digestObject({
  version: "oam.capability-evidence-subject-input.v1",
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest,
  inputDigests: subjectInputDigests
});

const optionSetDefaults = {
  bunkType: {
    oneBed: "whole",
    multiBed: "bunk_pair"
  },
  readinessState: {
    default: "passed"
  }
};
const scenario1ReadinessConclusionOptions = (scenario1RuntimeRules.readinessConclusionOptions ?? []).map((item) => ({
  value: item.value,
  label: {
    "zh-CN": item.labelZh,
    "ru-RU": item.labelRu ?? item.labelZh,
    "ky-KG": item.labelKy ?? item.labelZh
  },
  branchOutput: item.value === "passed"
    ? "basic_readiness_summary"
    : item.value === "needs_supplement"
      ? "supplement_required"
      : "basic_readiness_not_passed",
  requiredFields: item.value === "needs_supplement" ? ["basicReadinessRemark"] : []
}));
const optionSets = {
  bunkType: [
    { value: "bunk_pair", label: { "zh-CN": "上下铺：两上两下", "ru-RU": "Двухъярусные: две верхние и две нижние", "ky-KG": "Эки кабат: эки үстүңкү жана эки астыңкы" } },
    { value: "upper", label: { "zh-CN": "全部上铺", "ru-RU": "Все верхние", "ky-KG": "Баары үстүңкү" } },
    { value: "lower", label: { "zh-CN": "全部下铺", "ru-RU": "Все нижние", "ky-KG": "Баары астыңкы" } },
    { value: "whole", label: { "zh-CN": "全部平铺", "ru-RU": "Обычные койки", "ky-KG": "Жалпак койкалар" } }
  ],
  readinessState: scenario1ReadinessConclusionOptions
};
const generatedBusinessContracts = buildGeneratedBusinessContracts();
const {
  objectIdentity,
  bedCardinality,
  businessInvariants,
  commandContracts,
  failureSemantics,
  ruleSourceMap
} = generatedBusinessContracts;
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
  generatedBusinessRuleRefs: generatedBusinessRuleRefs(),
  objectIdentityRef: objectIdentityPath,
  bedCardinalityRef: bedCardinalityPath,
  businessInvariantsRef: businessInvariantsPath,
  commandContractsRef: commandContractsPath,
  failureSemanticsRef: failureSemanticsPath,
  ruleSourceMapRef: ruleSourceMapPath,
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
  generatedBusinessRuleRefs: generatedBusinessRuleRefs(),
  objectIdentityRef: objectIdentityPath,
  bedCardinalityRef: bedCardinalityPath,
  businessInvariantsRef: businessInvariantsPath,
  commandContractsRef: commandContractsPath,
  failureSemanticsRef: failureSemanticsPath,
  ruleSourceMapRef: ruleSourceMapPath,
  readinessBranchBindings: readinessBranchBindings(),
  confirmExecutionOrder: [
    "capability_admission",
    "field_normalization",
    "required_validation",
    "readonly_system_derived_validation",
    "object_identity_resolution",
    "bed_cardinality_validation",
    "business_invariant_validation",
    "uniqueness_reservation",
    "idempotency_concurrency_validation",
    "permission_device_evidence_validation",
    "transaction_commit",
    "projection_outbox"
  ],
  failureNoSideEffects: [
    "DomainEvent",
    "WorkItem advance",
    "Outbox",
    "DB row",
    "ReadModel mutation"
  ],
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
  generatedBusinessRuleRefs: generatedBusinessRuleRefs(),
  objectIdentityRef: objectIdentityPath,
  bedCardinalityRef: bedCardinalityPath,
  businessInvariantsRef: businessInvariantsPath,
  commandContractsRef: commandContractsPath,
  failureSemanticsRef: failureSemanticsPath,
  ruleSourceMapRef: ruleSourceMapPath,
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
  supportedEnvironmentProfiles: [
    "local.in_memory.browser_evidence",
    "local.postgres.browser_evidence",
    "ci.postgres.browser_evidence"
  ],
  currentEnvironmentProfileId: environmentProfile.environmentProfileId,
  businessLandingBlockedBecause: "db_projection_not_active",
  objectIdentityRef: objectIdentityPath,
  bedCardinalityRef: bedCardinalityPath,
  businessInvariantsRef: businessInvariantsPath,
  commandContractsRef: commandContractsPath,
  failureSemanticsRef: failureSemanticsPath,
  ruleSourceMapRef: ruleSourceMapPath,
  generatedBusinessRuleRefs: generatedBusinessRuleRefs(),
  generatedRuleRefs: {
    objectIdentityRuleIds: objectIdentity.objectRules.map((rule) => rule.generatedRuleId),
    bedCardinalityRuleIds: bedCardinality.rules.map((rule) => rule.generatedRuleId),
    businessInvariantRuleIds: businessInvariants.invariants.map((rule) => rule.generatedRuleId),
    failureSemanticsRuleIds: failureSemantics.failureSemantics.map((rule) => rule.generatedRuleId)
  },
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
const subjectChainCore = {
  ...generatedBase("capability-evidence-subject-chain", {
    generatedFrom: subjectGeneratedFrom,
    inputDigest: subjectInputDigest,
    inputDigests: subjectInputDigests
  }),
  version: "oam.capability-evidence-subject-chain.v1",
  authorityLedgerDigest: fileDigest(CAPABILITY_LEDGER_PATH),
  capabilityDecisionDigest: fileDigest(capabilityDecisionAuthorityPath),
  objectGraphDigest: fileDigest(objectGraphAuthorityPath),
  bedCardinalityDigest: fileDigest(bedCardinalityAuthorityPath),
  invariantAuthorityDigest: fileDigest(invariantAuthorityPath),
  commandContractDigest: fileDigest(commandContractAuthorityPath),
  failureSemanticsDigest: fileDigest(failureSemanticsAuthorityPath),
  acceptedGeneratedBundleDigest,
  businessAuthorityDigests: businessAuthorityDigests(),
  objectIdentityGeneratedDigest: objectIdentity.outputContentDigest,
  bedCardinalityGeneratedDigest: bedCardinality.outputContentDigest,
  businessInvariantsGeneratedDigest: businessInvariants.outputContentDigest,
  commandContractsGeneratedDigest: commandContracts.outputContentDigest,
  failureSemanticsGeneratedDigest: failureSemantics.outputContentDigest,
  ruleSourceMapGeneratedDigest: ruleSourceMap.outputContentDigest,
  objectIdentityDigest: objectIdentity.outputContentDigest,
  businessInvariantsDigest: businessInvariants.outputContentDigest,
  commandContractsDigest: commandContracts.outputContentDigest,
  ruleSourceMapDigest: ruleSourceMap.outputContentDigest,
  runtimeProjectionDigest: runtimeProjection.runtimeProjectionDigest,
  surfaceProjectionDigest: mobileProjection.surfaceProjectionDigest,
  searchProjectionDigest: mobileProjection.searchProjectionDigest,
  dbProjectionPolicyDigest: dbProjectionPolicy.outputContentDigest,
  environmentProfileDigest: currentEnvironmentProfileDigest(),
  positiveBrowserAuditDigest: currentPositiveBrowserAuditDigest(),
  negativeBrowserAuditDigest: currentNegativeBrowserAuditDigest(),
  noSideEffectsProofDigest: currentNoSideEffectsProofDigest(),
  dbProjectionProofDigest: currentDbProjectionProofDigest(),
  testPlanDigest,
  browserAuditDigest: currentPositiveBrowserAuditDigest(),
  businessLandingReviewStatus: currentBusinessLandingReviewStatus(),
  businessLandingAdmittedForbidden: true,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};
const subjectChain = finalizeGenerated(subjectChainCore);
const digestChainCore = {
  ...generatedBase("capability-digest-chain", {
    generatedFrom: subjectGeneratedFrom,
    inputDigest: subjectInputDigest,
    inputDigests: subjectInputDigests
  }),
  version: "oam.capability-evidence-digest-chain.v1",
  authorityLedgerDigest: fileDigest(CAPABILITY_LEDGER_PATH),
  subjectChainRef: subjectChainPath,
  subjectChainDigest: subjectChain.outputContentDigest,
  runtimeProjectionDigest: runtimeProjection.runtimeProjectionDigest,
  surfaceProjectionDigest: mobileProjection.surfaceProjectionDigest,
  searchProjectionDigest: mobileProjection.searchProjectionDigest,
  objectIdentityDigest: objectIdentity.outputContentDigest,
  bedCardinalityDigest: bedCardinality.outputContentDigest,
  businessInvariantsDigest: businessInvariants.outputContentDigest,
  commandContractsDigest: commandContracts.outputContentDigest,
  failureSemanticsDigest: failureSemantics.outputContentDigest,
  ruleSourceMapDigest: ruleSourceMap.outputContentDigest,
  dbProjectionPolicyDigest: dbProjectionPolicy.outputContentDigest,
  environmentProfileDigest: currentEnvironmentProfileDigest(),
  positiveBrowserAuditDigest: currentPositiveBrowserAuditDigest(),
  negativeBrowserAuditDigest: currentNegativeBrowserAuditDigest(),
  noSideEffectsProofDigest: currentNoSideEffectsProofDigest(),
  dbProjectionProofDigest: currentDbProjectionProofDigest(),
  testPlanDigest,
  browserAuditDigest: currentPositiveBrowserAuditDigest(),
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
  capabilityDigestChainDigest: capabilityDigestChainStableRefDigest()
});
const finalizedTestPlan = finalizeGenerated({
  ...testPlan,
  testPlanDigest
});

writeJson(objectIdentityPath, objectIdentity);
writeJson(bedCardinalityPath, bedCardinality);
writeJson(businessInvariantsPath, businessInvariants);
writeJson(commandContractsPath, commandContracts);
writeJson(failureSemanticsPath, failureSemantics);
writeJson(ruleSourceMapPath, ruleSourceMap);
writeJson(runtimeProjectionPath, runtimeProjection);
writeJson(mobileSurfaceModelPath, mobileSurfaceModel);
writeJson(mobileProjectionPath, mobileProjection);
writeJson(dbProjectionPolicyPath, dbProjectionPolicy);
writeJson(subjectChainPath, subjectChain);
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
  return ["basicReadinessRemark"];
}

function branchOutputFieldIds() {
  return ["basicReadinessRemark", "readinessEvidenceRefs", "supplementEvidenceRefs"];
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
      .filter((binding) => binding.branchOutputOnly === true || ["basicReadinessRemark", "readinessEvidenceRefs", "supplementEvidenceRefs"].includes(binding.fieldId))
      .filter((binding) => !["notSaleableReason", "serviceVerificationRef"].includes(binding.fieldId))
      .map((binding) => ({
        fieldId: binding.fieldId,
        semanticRole: binding.semanticRole,
        branchOutputOnly: binding.branchOutputOnly === true,
        userSubmitted: false,
        readonly: true,
        sourceBindingRef: binding.sourceBindingRef,
        requiredWhen: binding.fieldId === "basicReadinessRemark"
          ? { readinessState: "needs_supplement" }
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
      { fieldId: "basicReadinessRemark", status: "branch-required-reason", requiredWhen: { readinessState: "needs_supplement" } },
      { fieldId: "supplementEvidenceRefs", status: "branch-required-evidence-ref", requiredWhen: { readinessState: "needs_supplement" } }
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
      "Dorm.RoomSetupConfirm": { "zh-CN": "房间建档确认", "ru-RU": "Подтвердить комнату", "ky-KG": "Бөлмөнү ырастоо" },
      "Dorm.BedSetupConfirm": { "zh-CN": "床位组确认", "ru-RU": "Подтвердить койки", "ky-KG": "Койкаларды ырастоо" },
      "Dorm.ResourceReadinessConfirm": { "zh-CN": "基础就绪确认", "ru-RU": "Подтвердить базовую готовность", "ky-KG": "Негизги даярдыкты ырастоо" }
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
      "zh-CN": scenario1SurfaceNavigation.nameZh ?? "房源建档与基础就绪",
      "ru-RU": "Добавить комнату",
      "ky-KG": "Бөлмө кошуу"
    },
    subtitle: {
      "zh-CN": "按房间建档、床位组确认、基础就绪确认三步办理。",
      "ru-RU": "Три шага: комната, койка, готовность.",
      "ky-KG": "Үч кадам: бөлмө, койка, даярдык."
    },
    nextAction: {
      "zh-CN": "发起房源建档与基础就绪",
      "ru-RU": "Начать с номера комнаты",
      "ky-KG": "Бөлмө номеринен баштоо"
    },
    keywords: [
      "新增房间",
      "创建房间",
      "宿舍建档",
      "房间建档",
      "房源建档与基础就绪",
      "床位组确认",
      "基础就绪确认",
      "新建房间",
      "发起房源建档与基础就绪",
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
    subjectChainRef: subjectChainPath,
    objectIdentityRef: objectIdentityPath,
    bedCardinalityRef: bedCardinalityPath,
    businessInvariantsRef: businessInvariantsPath,
    commandContractsRef: commandContractsPath,
    failureSemanticsRef: failureSemanticsPath,
    ruleSourceMapRef: ruleSourceMapPath,
    generatedBusinessRuleRefs: generatedBusinessRuleRefs(),
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
      objectIdentityRules: objectIdentity.objectRules
        .filter((rule) => rule.createdBy === step.workItemType || rule.configuredBy === step.workItemType || rule.createdOrUpdatedBy === step.workItemType)
        .map((rule) => rule.generatedRuleId),
      commandContractRule: commandContracts.commands
        .find((rule) => rule.command === step.workItemType)?.generatedRuleId ?? "",
      failureSemanticsRules: failureSemantics.failureSemantics
        .filter((rule) => rule.appliesTo.includes(step.workItemType))
        .map((rule) => rule.generatedRuleId),
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

function buildGeneratedBusinessContracts() {
  const sourceAuthorityRefs = {
    capabilityDecisionAuthority: capabilityDecisionAuthorityPath,
    objectGraphAuthority: objectGraphAuthorityPath,
    bedCardinalityAuthority: bedCardinalityAuthorityPath,
    invariantAuthority: invariantAuthorityPath,
    commandContractAuthority: commandContractAuthorityPath,
    failureSemanticsAuthority: failureSemanticsAuthorityPath,
    scenario1RuntimeRules: scenario1RuntimeRulesPath
  };
  const objectRules = (objectGraphAuthority.objects ?? []).map((object) => ({
    generatedRuleId: `dormitory.object_identity.${safeRuleToken(object.objectId)}`,
    sourceAuthorityRef: objectGraphAuthorityPath,
    sourceRuleId: object.objectId,
    objectId: object.objectId,
    stableRef: object.stableRef,
    role: object.role,
    uniqueKey: object.uniqueKey ?? [],
    createdBy: object.createdBy ?? "",
    configuredBy: object.configuredBy ?? "",
    createdOrUpdatedBy: object.createdOrUpdatedBy ?? "",
    requires: object.requires ?? [],
    declares: object.declares ?? [],
    createdByCurrentChain: object.createdByCurrentChain ?? Boolean(object.createdBy || object.configuredBy || object.createdOrUpdatedBy),
    userSubmittedAsTrustedSource: object.userSubmittedAsTrustedSource === true
  }));
  const bedRules = (bedCardinalityAuthority.cardinalityRules ?? []).map((rule) => ({
    generatedRuleId: `dormitory.bed_cardinality.${safeRuleToken(rule.ruleId)}`,
    sourceAuthorityRef: bedCardinalityAuthorityPath,
    sourceRuleId: rule.ruleId,
    ...rule
  }));
  const scenario1SuppressedOldReadinessRuleIds = new Set([
    "not_saleable_requires_reason",
    "maintenance_requires_service_verification"
  ]);
  const scenario1SuppressedOldReadinessFailureCodes = new Set([
    "not_saleable_reason_required",
    "service_verification_required"
  ]);
  const invariantRules = (invariantAuthority.invariants ?? [])
    .filter((rule) => !scenario1SuppressedOldReadinessRuleIds.has(rule.invariantId))
    .map((rule) => ({
    generatedRuleId: `dormitory.business_invariant.${safeRuleToken(rule.invariantId)}`,
    sourceAuthorityRef: invariantAuthorityPath,
    sourceRuleId: rule.invariantId,
    ...rule
  }));
  const commandRules = (commandContractAuthority.commands ?? []).map((rule) => {
    const invariantRefs = (rule.invariantRefs ?? []).filter((id) => !scenario1SuppressedOldReadinessRuleIds.has(id));
    const base = {
      generatedRuleId: `dormitory.command_contract.${safeRuleToken(rule.command)}`,
      sourceAuthorityRef: commandContractAuthorityPath,
      sourceRuleId: rule.command,
      ...rule,
      invariantRefs,
      invariantRuleIds: invariantRefs.map((id) => `dormitory.business_invariant.${safeRuleToken(id)}`)
    };
    if (rule.command !== "Dorm.ResourceReadinessConfirm") return base;
    return {
      ...base,
      runtimeCommandType: "BasicReadiness.Confirm",
      derivedInputs: [
        "readinessSnapshotVersion",
        "basicReadinessRef",
        "basicReadinessStableRef",
        "createdBedCount"
      ],
      normalizedInputs: [
        "readinessState",
        "basicReadinessRemark"
      ],
      successEvents: [
        "Accommodation.BasicReadinessConfirmed"
      ],
      validationResponses: [
        "422 bed_count_not_satisfied",
        "422 readonly_stable_ref_violation",
        "422 invalid_readiness_state",
        "422 missing_required_evidence",
        "422 supplement_reason_required"
      ],
      surfaceRenderingPolicy: "render_basic_readiness_conclusion_options_only",
      dbProjectionPolicy: "Accommodation.BasicReadinessConfirmed -> basic-readiness/read model",
      testProofPolicy: "basic_readiness_positive_closed_option_and_missing_bed_negative_required_before_business_landing"
    };
  });
  const authorityFailureRules = (failureSemanticsAuthority.failureSemantics ?? []).map((rule) => ({
    generatedRuleId: `dormitory.failure_semantics.${safeRuleToken(rule.caseId)}`,
    sourceAuthorityRef: failureSemanticsAuthorityPath,
    sourceRuleId: rule.caseId,
    sideEffectsAllowedOnFailure: failureSemanticsAuthority.globalFailurePolicy?.sideEffectsAllowedOnFailure === true,
    domainEventsAllowedOnFailure: failureSemanticsAuthority.globalFailurePolicy?.domainEventsAllowedOnFailure === true,
    projectionMutationsAllowedOnFailure: failureSemanticsAuthority.globalFailurePolicy?.projectionMutationsAllowedOnFailure === true,
    workItemStateChangeAllowedOnFailure: failureSemanticsAuthority.globalFailurePolicy?.workItemStateChangeAllowedOnFailure === true,
    ledgerEffectAllowedOnFailure: failureSemanticsAuthority.globalFailurePolicy?.ledgerEffectAllowedOnFailure === true,
    ...rule
  })).filter((rule) => !scenario1SuppressedOldReadinessFailureCodes.has(rule.code));
  const scenario1FailureRules = (scenario1RuntimeRules.failureSemantics ?? [])
    .filter((rule) => rule.failureCode === "missing_required_evidence" || rule.failureCode === "bedset_incomplete")
    .map((rule) => ({
      generatedRuleId: `dormitory.failure_semantics.${safeRuleToken(rule.failureCode)}`,
      sourceAuthorityRef: scenario1RuntimeRulesPath,
      sourceRuleId: rule.failureCode,
      caseId: rule.failureCode,
      code: rule.failureCode === "bedset_incomplete" ? "bed_count_not_satisfied" : rule.failureCode,
      httpStatus: 422,
      appliesTo: ["Dorm.ResourceReadinessConfirm"],
      businessMessageZh: rule.businessMessageZh,
      sideEffectsAllowedOnFailure: false,
      domainEventsAllowedOnFailure: false,
      projectionMutationsAllowedOnFailure: false,
      workItemStateChangeAllowedOnFailure: false,
      ledgerEffectAllowedOnFailure: false
    }));
  scenario1FailureRules.push({
    generatedRuleId: "dormitory.failure_semantics.supplement_reason_required",
    sourceAuthorityRef: scenario1RuntimeRulesPath,
    sourceRuleId: "needs_supplement_requires_remark",
    caseId: "needs_supplement_requires_remark",
    code: "supplement_reason_required",
    httpStatus: 422,
    appliesTo: ["Dorm.ResourceReadinessConfirm"],
    businessMessageZh: "选择需补充时，请填写需要补充的基础资料或检查说明。",
    sideEffectsAllowedOnFailure: false,
    domainEventsAllowedOnFailure: false,
    projectionMutationsAllowedOnFailure: false,
    workItemStateChangeAllowedOnFailure: false,
    ledgerEffectAllowedOnFailure: false
  });
  const failureRules = [...authorityFailureRules, ...scenario1FailureRules];
  const objectIdentityDraft = finalizeGenerated({
    ...generatedBase("dormitory-object-identity.generated"),
    version: "oam.dormitory.object-identity.generated.v1",
    sourceAuthorityRefs,
    capabilityDecision: {
      ref: capabilityDecisionAuthorityPath,
      currentChain: capabilityDecisionAuthority.currentChain ?? [],
      currentBedModel: capabilityDecisionAuthority.currentBedModel
    },
    trustedSourcePolicy: objectGraphAuthority.trustedSourcePolicy,
    relationships: objectGraphAuthority.relationships ?? [],
    objectRules,
    forbiddenRules: objectGraphAuthority.forbiddenRules ?? [],
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  const bedCardinalityDraft = finalizeGenerated({
    ...generatedBase("dormitory-bed-cardinality.generated"),
    version: "oam.dormitory.bed-cardinality.generated.v1",
    sourceAuthorityRefs,
    canonicalBedQuantity: bedCardinalityAuthority.canonicalBedQuantity,
    acceptedInputAliases: bedCardinalityAuthority.acceptedInputAliases ?? [],
    rules: bedRules,
    authorityBoundaries: bedCardinalityAuthority.authorityBoundaries,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  const businessInvariantsDraft = finalizeGenerated({
    ...generatedBase("dormitory-business-invariants.generated"),
    version: "oam.dormitory.business-invariants.generated.v1",
    sourceAuthorityRefs,
    closedOptionSets: {
      ...(invariantAuthority.closedOptionSets ?? {}),
      readinessState: scenario1ReadinessConclusionOptions.map((item) => item.value)
    },
    invariants: invariantRules,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  const commandContractsDraft = finalizeGenerated({
    ...generatedBase("dormitory-command-contracts.generated"),
    version: "oam.dormitory.command-contracts.generated.v1",
    sourceAuthorityRefs,
    commands: commandRules,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  const failureSemanticsDraft = finalizeGenerated({
    ...generatedBase("dormitory-failure-semantics.generated"),
    version: "oam.dormitory.failure-semantics.generated.v1",
    sourceAuthorityRefs,
    globalFailurePolicy: failureSemanticsAuthority.globalFailurePolicy,
    failureSemantics: failureRules,
    noSideEffectFailureCodes: failureRules.map((rule) => rule.code),
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  const sourceMapEntries = [
    ...objectRules.map((rule) => ruleSourceMapEntry("object_identity", rule, objectIdentityPath)),
    ...bedRules.map((rule) => ruleSourceMapEntry("bed_cardinality", rule, bedCardinalityPath)),
    ...invariantRules.map((rule) => ruleSourceMapEntry("business_invariant", rule, businessInvariantsPath)),
    ...commandRules.map((rule) => ruleSourceMapEntry("command_contract", rule, commandContractsPath)),
    ...failureRules.map((rule) => ruleSourceMapEntry("failure_semantics", rule, failureSemanticsPath))
  ];
  const ruleSourceMapDraft = finalizeGenerated({
    ...generatedBase("dormitory-rule-source-map.generated"),
    version: "oam.dormitory.rule-source-map.generated.v1",
    sourceAuthorityRefs,
    generatedOutputs: {
      objectIdentityRef: objectIdentityPath,
      bedCardinalityRef: bedCardinalityPath,
      businessInvariantsRef: businessInvariantsPath,
      commandContractsRef: commandContractsPath,
      failureSemanticsRef: failureSemanticsPath
    },
    sourceMapEntries,
    ruleCounts: {
      objectIdentity: objectRules.length,
      bedCardinality: bedRules.length,
      businessInvariants: invariantRules.length,
      commandContracts: commandRules.length,
      failureSemantics: failureRules.length,
      total: sourceMapEntries.length
    },
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  return {
    objectIdentity: objectIdentityDraft,
    bedCardinality: bedCardinalityDraft,
    businessInvariants: businessInvariantsDraft,
    commandContracts: commandContractsDraft,
    failureSemantics: failureSemanticsDraft,
    ruleSourceMap: ruleSourceMapDraft
  };
}

function generatedBusinessRuleRefs() {
  return {
    objectIdentity: {
      ref: objectIdentityPath,
      digest: objectIdentity.outputContentDigest,
      ruleIds: objectIdentity.objectRules.map((rule) => rule.generatedRuleId)
    },
    bedCardinality: {
      ref: bedCardinalityPath,
      digest: bedCardinality.outputContentDigest,
      ruleIds: bedCardinality.rules.map((rule) => rule.generatedRuleId)
    },
    businessInvariants: {
      ref: businessInvariantsPath,
      digest: businessInvariants.outputContentDigest,
      ruleIds: businessInvariants.invariants.map((rule) => rule.generatedRuleId)
    },
    commandContracts: {
      ref: commandContractsPath,
      digest: commandContracts.outputContentDigest,
      ruleIds: commandContracts.commands.map((rule) => rule.generatedRuleId)
    },
    failureSemantics: {
      ref: failureSemanticsPath,
      digest: failureSemantics.outputContentDigest,
      ruleIds: failureSemantics.failureSemantics.map((rule) => rule.generatedRuleId)
    },
    ruleSourceMap: {
      ref: ruleSourceMapPath,
      digest: ruleSourceMap.outputContentDigest,
      ruleIds: ruleSourceMap.sourceMapEntries.map((rule) => rule.generatedRuleId)
    }
  };
}

function businessAuthorityDigests() {
  return [
    capabilityDecisionAuthorityPath,
    objectGraphAuthorityPath,
    bedCardinalityAuthorityPath,
    invariantAuthorityPath,
    commandContractAuthorityPath,
    failureSemanticsAuthorityPath
  ].map((file) => ({ path: file, digest: fileDigest(file) }));
}

function ruleSourceMapEntry(ruleType, rule, generatedOutputRef) {
  return {
    generatedRuleId: rule.generatedRuleId,
    ruleType,
    sourceAuthorityRef: rule.sourceAuthorityRef,
    sourceRuleId: rule.sourceRuleId,
    generatedOutputRef,
    acceptedGeneratedBundleDigest
  };
}

function safeRuleToken(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function generatedBase(kind, options = {}) {
  return {
    generated: true,
    doNotEdit: true,
    kind,
    generatorVersion: compilerVersion,
    generatedBy,
    generatedFrom: options.generatedFrom ?? generatedFrom,
    inputDigest: options.inputDigest ?? inputDigest,
    inputDigests: options.inputDigests ?? inputDigests,
    outputContentDigest: "sha256:pending",
    capabilityId: CAPABILITY_ID,
    acceptedGeneratedBundleDigest,
    currentFilesMode: projection.currentFilesMode,
    capabilityLedgerReplay: {
      status: projectionState.status,
      eventCount: ledger.events?.length ?? 0
    },
    lifecycleState: projection.lifecycleAchieved?.at(-1) ?? "UNKNOWN",
    runtimeAdmissionStatus: runtimeAdmission.runtimeAdmissionStatus,
    landingStatus: landing.landingStatus,
    environmentProfileId: environmentProfile.environmentProfileId
  };
}

function finalizeGenerated(value) {
  const outputContentDigest = digestObject({ ...value, outputContentDigest: "sha256:pending" });
  return { ...value, outputContentDigest };
}

function capabilityDigestChainStableRefDigest() {
  return digestObject({
    version: "oam.capability-digest-chain-stable-ref.v1",
    capabilityId: CAPABILITY_ID,
    ref: digestChainPath,
    evidenceScope: "local_test_runtime_evidence",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
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

function currentEnvironmentProfileDigest() {
  const result = readJsonIfExists(environmentProfileProofResultPath);
  return isDigest(result?.environmentProfileDigest) ? result.environmentProfileDigest : fileDigest(environmentProfilePath);
}

function currentPositiveBrowserAuditDigest() {
  const report = readJsonIfExists(browserAuditReportPath);
  return isDigest(report?.browserAuditDigest) ? report.browserAuditDigest : "missing";
}

function currentNegativeBrowserAuditDigest() {
  const report = readJsonIfExists(negativeBrowserAuditReportPath);
  return isDigest(report?.negativeBrowserAuditDigest) ? report.negativeBrowserAuditDigest : "missing";
}

function currentNoSideEffectsProofDigest() {
  const result = readJsonIfExists(noSideEffectsProofResultPath);
  return isDigest(result?.noSideEffectsProofDigest) ? result.noSideEffectsProofDigest : "missing";
}

function currentBusinessLandingReviewStatus() {
  const result = readJsonIfExists(dbProjectionProofResultPath);
  if (result?.reviewPackageStatus === "READY_FOR_00_BUSINESS_LANDING_REVIEW") {
    return "READY_FOR_00_BUSINESS_LANDING_REVIEW";
  }
  return "BUSINESS_LANDING_NOT_READY_REVIEW_PACKAGE";
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
      "zh-CN": `${index}/${total} 房间建档确认`,
      "ru-RU": `${index}/${total} Подтверждение комнаты`,
      "ky-KG": `${index}/${total} Бөлмө тастыктоо`
    },
    "Dorm.BedSetupConfirm": {
      "zh-CN": `${index}/${total} 床位组确认`,
      "ru-RU": `${index}/${total} Подтверждение койки`,
      "ky-KG": `${index}/${total} Койка тастыктоо`
    },
    "Dorm.ResourceReadinessConfirm": {
      "zh-CN": `${index}/${total} 基础就绪确认`,
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
    readinessState: ["基础就绪结论", "Статус готовности", "Даярдык абалы"],
    basicReadinessRemark: ["基础就绪备注", "Комментарий", "Эскертүү"],
    supplementEvidenceRefs: ["补充证据", "Дополнительные доказательства", "Кошумча далил"],
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
