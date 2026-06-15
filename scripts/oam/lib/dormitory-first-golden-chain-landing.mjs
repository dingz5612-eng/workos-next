import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  DORMITORY_RUNTIME_ADMISSION_PATH,
  DORMITORY_RUNTIME_ADMISSION_RESULT_PATH,
  DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH,
  RUNTIME_ADMISSION_APPROVED_STATUS,
  generatedRuntimeContractRefs,
  validateDormitoryRuntimeAdmissionAuthority
} from "./dormitory-runtime-admission.mjs";
import { readJsonIfExists, writeJson } from "./generated-candidate-subject.mjs";

export const DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH =
  "docs/oam/dormitory-first-golden-chain-landing.current.json";
export const DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_RESULT_PATH =
  "artifacts/oam/checks/dormitory-first-golden-chain-landing-result.json";
export const DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH =
  "artifacts/oam/evidence/dormitory-first-golden-chain-landing-proof.json";

export const DORMITORY_L1_LANDING_PENDING_STATUS = "PENDING_BUSINESS_LANDING_REVIEW";
export const DORMITORY_L1_LANDING_APPROVED_STATUS = "APPROVED_DORMITORY_L1_FIRST_GOLDEN_CHAIN";
export const DORMITORY_L1_LANDING_NOT_APPROVED_STATUS = "NOT_APPROVED_DORMITORY_L1_FIRST_GOLDEN_CHAIN";

export const allowedDormitoryBusinessLandingWorkItemTypes = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const allowedStatuses = new Set([
  DORMITORY_L1_LANDING_PENDING_STATUS,
  DORMITORY_L1_LANDING_APPROVED_STATUS,
  DORMITORY_L1_LANDING_NOT_APPROVED_STATUS
]);
const fieldBindingsPath = "docs/contracts/generated/dormitory/field-bindings.generated.json";
const workItemsPath = "docs/contracts/generated/dormitory/workitems.generated.json";
const readModelPath = "docs/contracts/generated/dormitory/read-model.generated.json";
const scenarioPath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const forbiddenLandingDomains = [
  "Lead",
  "Checkin",
  "Payment",
  "Deposit",
  "Refund",
  "Finance posting",
  "Dormitory L2",
  "production_confirm",
  "release"
];
const financeFacts = [
  "Payment",
  "Deposit",
  "DepositAccount",
  "LedgerEntry",
  "LedgerTransaction",
  "PaymentAllocation",
  "Refund",
  "FinancialFact",
  "FinanceReceipt",
  "DepositEntry"
];

export function buildDormitoryFirstGoldenChainLandingAuthority({
  root = process.cwd(),
  currentHead = null,
  status = DORMITORY_L1_LANDING_PENDING_STATUS
} = {}) {
  const runtimeAuthority = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
  const runtimeAdmission = validateDormitoryRuntimeAdmissionAuthority({
    authority: runtimeAuthority,
    root,
    currentHead,
    writeProof: false
  });
  const approved = status === DORMITORY_L1_LANDING_APPROVED_STATUS;
  return {
    version: "oam.dormitory-first-golden-chain-landing.v1",
    authorityType: "dormitory_first_golden_chain_business_landing",
    landingStatus: status,
    landingScope: "dormitory_l1_first_golden_chain_only",
    generatedCandidateAcceptedBy00: runtimeAdmission.generatedCandidateAcceptedBy00 === true,
    runtimeAdmissionRef: DORMITORY_RUNTIME_ADMISSION_PATH,
    runtimeAdmissionResultRef: DORMITORY_RUNTIME_ADMISSION_RESULT_PATH,
    runtimeTestOnlyConsumptionProofRef: DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH,
    runtimeAdmissionStatus: runtimeAdmission.runtimeAdmissionStatus,
    runtimeConsumptionReady: runtimeAdmission.runtimeConsumptionReady === true,
    acceptedSubjectDigest: runtimeAdmission.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: runtimeAdmission.generatedCandidateSubjectDigest,
    reviewedExecutionHead: runtimeAdmission.reviewedExecutionHead,
    evidenceArtifactDigest: runtimeAdmission.evidenceArtifactDigest,
    generatedFieldBindingClosureDigest: runtimeAdmission.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: runtimeAdmission.sourceFieldGapsDecisionDigest,
    executionProofDigest: runtimeAdmission.executionProofDigest,
    generatedContractsOnly: true,
    consumedGeneratedContracts: [...generatedRuntimeContractRefs],
    sourceScenarioRef: scenarioPath,
    allowedLandingWorkItemTypes: [...allowedDormitoryBusinessLandingWorkItemTypes],
    orderedBusinessChain: [...allowedDormitoryBusinessLandingWorkItemTypes],
    fieldBindingContractRef: fieldBindingsPath,
    workItemsContractRef: workItemsPath,
    readModelContractRef: readModelPath,
    landingProofRef: DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH,
    businessFeatureDevelopmentAllowed: approved,
    dormitoryFirstGoldenChainLandingGoNoGo: approved ? "GO" : "NO_GO",
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    productionConfirmGoNoGo: "NO_GO",
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    leadLandingAllowed: false,
    checkinLandingAllowed: false,
    paymentLandingAllowed: false,
    depositLandingAllowed: false,
    refundLandingAllowed: false,
    writeThroughSearchAllowed: false,
    sourceTruthWriteAllowed: false,
    releaseGoAuthority: false,
    explicitExclusions: [
      "Dormitory L2",
      "Finance posting",
      "Payment",
      "Deposit",
      "Refund",
      "Checkin",
      "Lead",
      "productionConfirmAllowed",
      "releaseAuthority",
      "finalGoNoGo"
    ]
  };
}

export function validateDormitoryFirstGoldenChainLandingAuthority({
  authority,
  root = process.cwd(),
  currentHead = null,
  writeProof = false
} = {}) {
  const failures = [];
  const warnings = [];
  const runtimeAuthority = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
  const runtimeAdmission = validateDormitoryRuntimeAdmissionAuthority({
    authority: runtimeAuthority,
    root,
    currentHead,
    writeProof: false
  });
  let proof = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH, root);
  const approved = authority?.landingStatus === DORMITORY_L1_LANDING_APPROVED_STATUS;

  if (writeProof && approved && !proof) {
    writeJson(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH, buildBusinessLandingProof({
      authority,
      runtimeAdmission
    }), root);
    proof = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH, root);
  }

  if (!authority || typeof authority !== "object") {
    failures.push(`${DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH} is missing or invalid.`);
  } else {
    requireEqual(authority.version, "oam.dormitory-first-golden-chain-landing.v1", "version", failures);
    requireEqual(
      authority.authorityType,
      "dormitory_first_golden_chain_business_landing",
      "authorityType",
      failures
    );
    if (!allowedStatuses.has(authority.landingStatus)) {
      failures.push(`landingStatus invalid: ${format(authority.landingStatus)}.`);
    }
    requireEqual(authority.landingScope, "dormitory_l1_first_golden_chain_only", "landingScope", failures);
    if (runtimeAdmission.status !== "PASS") {
      failures.push("dormitory runtime admission checker must PASS before business landing.");
    }
    requireEqual(authority.generatedCandidateAcceptedBy00, true, "generatedCandidateAcceptedBy00", failures);
    requireEqual(authority.runtimeAdmissionRef, DORMITORY_RUNTIME_ADMISSION_PATH, "runtimeAdmissionRef", failures);
    requireEqual(
      authority.runtimeAdmissionResultRef,
      DORMITORY_RUNTIME_ADMISSION_RESULT_PATH,
      "runtimeAdmissionResultRef",
      failures
    );
    requireEqual(
      authority.runtimeTestOnlyConsumptionProofRef,
      DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH,
      "runtimeTestOnlyConsumptionProofRef",
      failures
    );
    requireEqual(authority.runtimeAdmissionStatus, RUNTIME_ADMISSION_APPROVED_STATUS, "runtimeAdmissionStatus", failures);
    requireEqual(authority.runtimeAdmissionStatus, runtimeAdmission.runtimeAdmissionStatus, "runtimeAdmissionStatus", failures);
    requireEqual(authority.runtimeConsumptionReady, true, "runtimeConsumptionReady", failures);
    requireEqual(runtimeAdmission.runtimeConsumptionReady, true, "runtimeAdmission.runtimeConsumptionReady", failures);
    requireEqual(authority.acceptedSubjectDigest, runtimeAdmission.acceptedSubjectDigest, "acceptedSubjectDigest", failures);
    requireEqual(
      authority.generatedCandidateSubjectDigest,
      runtimeAdmission.generatedCandidateSubjectDigest,
      "generatedCandidateSubjectDigest",
      failures
    );
    requireEqual(authority.reviewedExecutionHead, runtimeAdmission.reviewedExecutionHead, "reviewedExecutionHead", failures);
    requireEqual(authority.evidenceArtifactDigest, runtimeAdmission.evidenceArtifactDigest, "evidenceArtifactDigest", failures);
    requireEqual(
      authority.generatedFieldBindingClosureDigest,
      runtimeAdmission.generatedFieldBindingClosureDigest,
      "generatedFieldBindingClosureDigest",
      failures
    );
    requireEqual(
      authority.sourceFieldGapsDecisionDigest,
      runtimeAdmission.sourceFieldGapsDecisionDigest,
      "sourceFieldGapsDecisionDigest",
      failures
    );
    requireEqual(authority.executionProofDigest, runtimeAdmission.executionProofDigest, "executionProofDigest", failures);
    requireEqual(authority.generatedContractsOnly, true, "generatedContractsOnly", failures);
    requireArrayExact(
      authority.allowedLandingWorkItemTypes,
      allowedDormitoryBusinessLandingWorkItemTypes,
      "allowedLandingWorkItemTypes",
      failures
    );
    requireArrayExact(
      authority.orderedBusinessChain,
      allowedDormitoryBusinessLandingWorkItemTypes,
      "orderedBusinessChain",
      failures
    );
    requireArraySet(authority.consumedGeneratedContracts, generatedRuntimeContractRefs, "consumedGeneratedContracts", failures);
    requireEqual(authority.sourceScenarioRef, scenarioPath, "sourceScenarioRef", failures);
    requireEqual(authority.fieldBindingContractRef, fieldBindingsPath, "fieldBindingContractRef", failures);
    requireEqual(authority.workItemsContractRef, workItemsPath, "workItemsContractRef", failures);
    requireEqual(authority.readModelContractRef, readModelPath, "readModelContractRef", failures);
    requireEqual(
      authority.landingProofRef,
      DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH,
      "landingProofRef",
      failures
    );
    checkLandingDecision(authority, approved, failures);
    checkGeneratedContracts(root, failures);
    if (approved) checkBusinessLandingProof(proof, authority, runtimeAdmission, failures);
  }

  const status = failures.length === 0 ? "PASS" : "NO_GO";
  const previousResult = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_RESULT_PATH, root);
  const result = {
    version: "oam.dormitory-first-golden-chain-landing-predicate.v1",
    checkedAtUtc: new Date().toISOString(),
    status,
    landingStatus: authority?.landingStatus ?? "MISSING",
    landingScope: authority?.landingScope ?? "MISSING",
    generatedCandidateAcceptedBy00: runtimeAdmission.generatedCandidateAcceptedBy00 === true,
    runtimeAdmissionStatus: runtimeAdmission.runtimeAdmissionStatus,
    runtimeConsumptionReady: runtimeAdmission.runtimeConsumptionReady === true,
    acceptedSubjectDigest: runtimeAdmission.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: runtimeAdmission.generatedCandidateSubjectDigest,
    reviewedExecutionHead: runtimeAdmission.reviewedExecutionHead,
    evidenceArtifactDigest: runtimeAdmission.evidenceArtifactDigest,
    generatedFieldBindingClosureDigest: runtimeAdmission.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: runtimeAdmission.sourceFieldGapsDecisionDigest,
    executionProofDigest: runtimeAdmission.executionProofDigest,
    generatedContractsOnly: authority?.generatedContractsOnly === true,
    allowedLandingWorkItemTypes: authority?.allowedLandingWorkItemTypes ?? [],
    orderedBusinessChain: authority?.orderedBusinessChain ?? [],
    businessFeatureDevelopmentAllowed: authority?.businessFeatureDevelopmentAllowed === true,
    dormitoryFirstGoldenChainLandingGoNoGo: authority?.dormitoryFirstGoldenChainLandingGoNoGo ?? "NO_GO",
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    productionConfirmGoNoGo: "NO_GO",
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    forbiddenLandingDomains,
    landingProofRef: DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH,
    landingProofDigest: proof ? digestObject(proof) : "missing",
    proofGenerated: Boolean(proof),
    warnings,
    failures
  };
  if (previousResult?.checkedAtUtc &&
    stableStringify(normalizeResultForTimestamp(previousResult)) ===
      stableStringify(normalizeResultForTimestamp(result))) {
    result.checkedAtUtc = previousResult.checkedAtUtc;
  }
  return result;
}

export function buildBusinessLandingProof({ authority, runtimeAdmission, result = null } = {}) {
  return {
    version: "oam.dormitory-first-golden-chain-business-landing-proof.v1",
    proofType: "dormitory_first_golden_chain_l1_business_landing",
    generatedAtUtc: new Date().toISOString(),
    status: "PASS",
    landingStatus: DORMITORY_L1_LANDING_APPROVED_STATUS,
    landingScope: "dormitory_l1_first_golden_chain_only",
    generatedCandidateAcceptedBy00: true,
    runtimeAdmissionStatus: RUNTIME_ADMISSION_APPROVED_STATUS,
    runtimeConsumptionReady: true,
    acceptedSubjectDigest: authority.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: authority.generatedCandidateSubjectDigest,
    generatedFieldBindingClosureDigest: authority.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: authority.sourceFieldGapsDecisionDigest,
    allowedLandingWorkItemTypes: [...allowedDormitoryBusinessLandingWorkItemTypes],
    orderedBusinessChain: [...allowedDormitoryBusinessLandingWorkItemTypes],
    consumedGeneratedContracts: [...generatedRuntimeContractRefs],
    semanticProof: {
      roomSetupConfirmProducesRoomSetupConfirmedFact: true,
      bedSetupRoomIdRequiresConfirmedRoomSetup: true,
      resourceReadinessRoomIdBedIdRequiresConfirmedResources: true,
      buildingContextRefReadOnlyContext: true,
      readinessEvidenceRefsFromEvidenceEnvelope: true,
      serviceVerificationRefFromEvidenceObjectStableRef: true,
      blockedReasonBranchOutputOnly: true,
      notSaleableReasonResourceNotSaleableBranchOutputOnly: true,
      userCannotForgeEvidenceRefs: true,
      routeCardWorkspaceParamsCannotInjectBusinessFacts: true,
      searchLabelCannotInferSourceTruth: true,
      readModelCannotWriteSourceTruth: true,
      ledgerEffectModeNone: true,
      financeKernelEffectTypeNull: true
    },
    businessFeatureDevelopmentAllowed: true,
    dormitoryFirstGoldenChainLandingGoNoGo: "GO",
    negativeAuthorities: {
      businessProductionGoNoGo: "NO_GO",
      dormitoryL2GoNoGo: "NO_GO",
      productionConfirmAllowed: false,
      productionConfirmGoNoGo: "NO_GO",
      releaseAuthority: false,
      finalGoNoGo: "NO_GO",
      financePostingAllowed: false,
      dormitoryL2Allowed: false,
      leadLandingAllowed: false,
      checkinLandingAllowed: false,
      paymentLandingAllowed: false,
      depositLandingAllowed: false,
      refundLandingAllowed: false
    },
    evidenceRefs: [
      DORMITORY_RUNTIME_ADMISSION_PATH,
      DORMITORY_RUNTIME_ADMISSION_RESULT_PATH,
      DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH,
      DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH,
      fieldBindingsPath,
      workItemsPath,
      readModelPath,
      scenarioPath
    ],
    checkerResultStatus: result?.status ?? "PASS",
    runtimeAdmissionDigest: runtimeAdmission ? digestObject(runtimeAdmission) : "missing",
    finalGoNoGo: "NO_GO"
  };
}

export function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(normalizeForDigest(value))).digest("hex")}`;
}

function checkLandingDecision(authority, approved, failures) {
  if (approved) {
    requireEqual(authority.businessFeatureDevelopmentAllowed, true, "businessFeatureDevelopmentAllowed", failures);
    requireEqual(authority.dormitoryFirstGoldenChainLandingGoNoGo, "GO", "dormitoryFirstGoldenChainLandingGoNoGo", failures);
  } else {
    requireEqual(authority.businessFeatureDevelopmentAllowed, false, "businessFeatureDevelopmentAllowed", failures);
    requireEqual(authority.dormitoryFirstGoldenChainLandingGoNoGo, "NO_GO", "dormitoryFirstGoldenChainLandingGoNoGo", failures);
  }
  for (const [field, expected] of Object.entries({
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    productionConfirmGoNoGo: "NO_GO",
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    leadLandingAllowed: false,
    checkinLandingAllowed: false,
    paymentLandingAllowed: false,
    depositLandingAllowed: false,
    refundLandingAllowed: false,
    writeThroughSearchAllowed: false,
    sourceTruthWriteAllowed: false,
    releaseGoAuthority: false
  })) {
    requireEqual(authority[field], expected, field, failures);
  }
}

function checkGeneratedContracts(root, failures) {
  const workItems = readJsonIfExists(workItemsPath, root);
  const fieldBindings = readJsonIfExists(fieldBindingsPath, root);
  const readModel = readJsonIfExists(readModelPath, root);
  for (const file of [...generatedRuntimeContractRefs, scenarioPath]) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`business landing input missing: ${file}.`);
  }
  const workItemTypes = (workItems?.workItems ?? []).map((item) => item.workItemType);
  requireArrayExact(workItemTypes, allowedDormitoryBusinessLandingWorkItemTypes, "workItems.workItemType sequence", failures);
  for (const item of workItems?.workItems ?? []) {
    if (item.generatedStage !== "P0_ACTIVE") {
      failures.push(`${item.workItemType} generatedStage must be P0_ACTIVE.`);
    }
    if (item.ledgerEffect?.mode !== "none" || item.ledgerEffect?.financeKernelEffectType !== null) {
      failures.push(`${item.workItemType} must have no ledger or finance kernel effect.`);
    }
    for (const fact of financeFacts) {
      if (!(item.forbiddenFacts ?? []).includes(fact)) {
        failures.push(`${item.workItemType} forbiddenFacts missing ${fact}.`);
      }
    }
  }
  const transitionPairs = (workItems?.transitionPolicy ?? []).map((item) =>
    `${item.fromDefinitionId}->${item.toDefinitionId}`);
  requireArrayExact(transitionPairs, [
    "definition.dormitory.roomSetupConfirm.v1->definition.dormitory.bedSetupConfirm.v1",
    "definition.dormitory.bedSetupConfirm.v1->definition.dormitory.resourceReadinessConfirm.v1"
  ], "transitionPolicy", failures);

  const bindingsByField = new Map((fieldBindings?.fieldBindings ?? []).map((item) => [item.fieldId, item]));
  const buildingContext = bindingsByField.get("buildingContextRef");
  if (buildingContext?.classification !== "contextReadonly" ||
    buildingContext?.bindingType !== "contextReadonly" ||
    buildingContext?.source !== "Source Layer context" ||
    buildingContext?.userEditable !== false ||
    buildingContext?.rawManualInputAllowed !== false ||
    buildingContext?.userSubmitted !== false) {
    failures.push("buildingContextRef must be readonly Source Layer context, not user input.");
  }
  const readinessEvidence = bindingsByField.get("readinessEvidenceRefs");
  if (readinessEvidence?.bindingType !== "EvidenceEnvelope" ||
    readinessEvidence?.source !== "Evidence Kernel" ||
    readinessEvidence?.userEditable !== false ||
    readinessEvidence?.rawManualInputAllowed !== false ||
    readinessEvidence?.userSubmitted !== false) {
    failures.push("readinessEvidenceRefs must bind to EvidenceEnvelope from Evidence Kernel.");
  }
  const serviceVerification = bindingsByField.get("serviceVerificationRef");
  if (serviceVerification?.bindingType !== "EvidenceObject stableRef" ||
    serviceVerification?.source !== "Evidence Kernel" ||
    serviceVerification?.evidenceObjectKind !== "verification-check" ||
    serviceVerification?.userEditable !== false ||
    serviceVerification?.rawManualInputAllowed !== false ||
    serviceVerification?.userSubmitted !== false) {
    failures.push("serviceVerificationRef must bind to stable verification-check evidence object.");
  }
  const blockedReason = bindingsByField.get("blockedReason");
  if (blockedReason?.bindingType !== "branch-output" ||
    blockedReason?.branchOutputOnly !== true ||
    blockedReason?.branchOutputScope !== "all_no_go_branches") {
    failures.push("blockedReason must be branch-output only for all no-go branches.");
  }
  const notSaleableReason = bindingsByField.get("notSaleableReason");
  if (notSaleableReason?.bindingType !== "branch-output" ||
    notSaleableReason?.branchOutputOnly !== true ||
    notSaleableReason?.branchOutputScope !== "resource-not-saleable") {
    failures.push("notSaleableReason must be branch-output only for resource-not-saleable.");
  }
  const forbiddenSourceText = JSON.stringify(fieldBindings?.forbiddenSources ?? {});
  for (const forbidden of ["route param", "cardId", "sourceCardId", "workspaceCardId", "search label"]) {
    if (!forbiddenSourceText.includes(forbidden)) {
      failures.push(`field binding forbiddenSources missing ${forbidden}.`);
    }
  }
  requireEqual(readModel?.generatedReadModelsOnly, true, "readModel.generatedReadModelsOnly", failures);
  requireEqual(readModel?.searchLensProjectionReadonly, true, "readModel.searchLensProjectionReadonly", failures);
  for (const target of readModel?.targets ?? []) {
    requireEqual(target.writeThroughSearchAllowed, false, `readModel.${target.targetId}.writeThroughSearchAllowed`, failures);
  }
}

function checkBusinessLandingProof(proof, authority, runtimeAdmission, failures) {
  if (!proof || typeof proof !== "object") {
    failures.push(`${DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH} is required after S8 business landing approval.`);
    return;
  }
  requireEqual(proof.version, "oam.dormitory-first-golden-chain-business-landing-proof.v1", "proof.version", failures);
  requireEqual(proof.status, "PASS", "proof.status", failures);
  requireEqual(proof.landingStatus, DORMITORY_L1_LANDING_APPROVED_STATUS, "proof.landingStatus", failures);
  requireEqual(proof.runtimeAdmissionStatus, RUNTIME_ADMISSION_APPROVED_STATUS, "proof.runtimeAdmissionStatus", failures);
  requireEqual(proof.runtimeConsumptionReady, true, "proof.runtimeConsumptionReady", failures);
  requireEqual(proof.acceptedSubjectDigest, authority.acceptedSubjectDigest, "proof.acceptedSubjectDigest", failures);
  requireEqual(
    proof.generatedCandidateSubjectDigest,
    runtimeAdmission.generatedCandidateSubjectDigest,
    "proof.generatedCandidateSubjectDigest",
    failures
  );
  requireArrayExact(
    proof.allowedLandingWorkItemTypes,
    allowedDormitoryBusinessLandingWorkItemTypes,
    "proof.allowedLandingWorkItemTypes",
    failures
  );
  for (const [field, expected] of Object.entries({
    roomSetupConfirmProducesRoomSetupConfirmedFact: true,
    bedSetupRoomIdRequiresConfirmedRoomSetup: true,
    resourceReadinessRoomIdBedIdRequiresConfirmedResources: true,
    buildingContextRefReadOnlyContext: true,
    readinessEvidenceRefsFromEvidenceEnvelope: true,
    serviceVerificationRefFromEvidenceObjectStableRef: true,
    blockedReasonBranchOutputOnly: true,
    notSaleableReasonResourceNotSaleableBranchOutputOnly: true,
    userCannotForgeEvidenceRefs: true,
    routeCardWorkspaceParamsCannotInjectBusinessFacts: true,
    searchLabelCannotInferSourceTruth: true,
    readModelCannotWriteSourceTruth: true,
    ledgerEffectModeNone: true,
    financeKernelEffectTypeNull: true
  })) {
    if (proof.semanticProof?.[field] !== expected) {
      failures.push(`proof.semanticProof.${field} must be ${format(expected)}, actual ${format(proof.semanticProof?.[field])}.`);
    }
  }
  for (const [field, expected] of Object.entries({
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    productionConfirmGoNoGo: "NO_GO",
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    leadLandingAllowed: false,
    checkinLandingAllowed: false,
    paymentLandingAllowed: false,
    depositLandingAllowed: false,
    refundLandingAllowed: false
  })) {
    if (proof.negativeAuthorities?.[field] !== expected) {
      failures.push(`proof.negativeAuthorities.${field} must be ${format(expected)}, actual ${format(proof.negativeAuthorities?.[field])}.`);
    }
  }
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function requireArrayExact(actual, expected, label, failures) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  const normalizedActual = actual.map((item) => String(item).replace(/\\/g, "/"));
  const normalizedExpected = expected.map((item) => String(item).replace(/\\/g, "/"));
  if (stableStringify(normalizedActual) !== stableStringify(normalizedExpected)) {
    failures.push(`${label} must equal ${format(normalizedExpected)}, actual ${format(normalizedActual)}.`);
  }
}

function requireArraySet(actual, expected, label, failures) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  const normalizedActual = actual.map((item) => String(item).replace(/\\/g, "/")).sort();
  const normalizedExpected = expected.map((item) => String(item).replace(/\\/g, "/")).sort();
  if (stableStringify(normalizedActual) !== stableStringify(normalizedExpected)) {
    failures.push(`${label} must equal ${format(normalizedExpected)}, actual ${format(normalizedActual)}.`);
  }
}

function normalizeForDigest(value) {
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "checkedAtUtc" || key === "generatedAtUtc") continue;
      normalized[key] = normalizeForDigest(child);
    }
    return normalized;
  }
  if (typeof value === "string" && digestPattern.test(value)) return value;
  return value;
}

function normalizeResultForTimestamp(value) {
  if (Array.isArray(value)) return value.map(normalizeResultForTimestamp);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "checkedAtUtc") continue;
      normalized[key] = normalizeResultForTimestamp(child);
    }
    return normalized;
  }
  if (typeof value === "string" && digestPattern.test(value)) return "sha256:__stable_digest__";
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function format(value) {
  return JSON.stringify(value);
}
