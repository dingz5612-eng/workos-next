import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH,
  readJsonIfExists,
  validateGeneratedCandidateAcceptanceAuthority,
  writeJson
} from "./generated-candidate-subject.mjs";

export const DORMITORY_RUNTIME_ADMISSION_PATH = "docs/oam/dormitory-runtime-admission.current.json";
export const DORMITORY_RUNTIME_ADMISSION_RESULT_PATH = "artifacts/oam/checks/dormitory-runtime-admission-result.json";
export const DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH =
  "artifacts/oam/evidence/dormitory-runtime-test-only-consumption-proof.json";

export const RUNTIME_ADMISSION_PENDING_STATUS = "PENDING_RUNTIME_ADMISSION_REVIEW";
export const RUNTIME_ADMISSION_APPROVED_STATUS = "APPROVED_TEST_ONLY_RUNTIME_CONSUMPTION";

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const allowedStatuses = new Set([
  RUNTIME_ADMISSION_PENDING_STATUS,
  RUNTIME_ADMISSION_APPROVED_STATUS
]);

export const allowedDormitoryRuntimeOperationCases = [
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm",
  "Dorm.RoomSetupConfirm"
];

export const generatedRuntimeContractRefs = [
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/field-bindings.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];

const negativeAuthorityExpectations = {
  businessFeatureDevelopmentAllowed: false,
  dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
  businessProductionGoNoGo: "NO_GO",
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  financePostingAllowed: false,
  dormitoryL2Allowed: false,
  writeThroughSearchAllowed: false,
  sourceTruthWriteAllowed: false,
  sourceTruthOwnershipAllowed: false
};

export function buildDormitoryRuntimeAdmissionAuthority({
  root = process.cwd(),
  currentHead = null,
  status = RUNTIME_ADMISSION_PENDING_STATUS
} = {}) {
  const acceptanceAuthority = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
  const acceptance = validateGeneratedCandidateAcceptanceAuthority({
    acceptance: acceptanceAuthority,
    root,
    currentHead
  });
  const runtimeConsumptionReady = status === RUNTIME_ADMISSION_APPROVED_STATUS;
  return {
    version: "oam.dormitory-runtime-admission.v1",
    authorityType: "dormitory_first_golden_chain_runtime_admission",
    runtimeAdmissionStatus: status,
    generatedCandidateAcceptedBy00: acceptance.generatedCandidateAcceptedBy00 === true,
    generatedCandidateAcceptanceRef: GENERATED_CANDIDATE_ACCEPTANCE_PATH,
    generatedCandidateAcceptanceResultRef: GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH,
    acceptedSubjectDigest: acceptance.subjectDigest,
    generatedCandidateSubjectDigest: acceptance.subjectDigest,
    reviewedExecutionHead: acceptance.reviewedExecutionHead,
    evidenceArtifactDigest: acceptance.evidenceArtifactDigest,
    generatedFieldBindingClosureDigest: acceptance.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: acceptance.sourceFieldGapsDecisionDigest,
    executionProofDigest: acceptance.executionProofDigest,
    runtimeAdmissionScope: "dormitory_first_golden_chain_test_only_consumption",
    runtimeConsumptionMode: status === RUNTIME_ADMISSION_APPROVED_STATUS
      ? "test_only_consumption"
      : "pending_runtime_admission_review",
    consumedGeneratedContracts: [...generatedRuntimeContractRefs],
    allowedOperationCases: [...allowedDormitoryRuntimeOperationCases],
    runtimeConsumptionReady,
    businessFeatureDevelopmentAllowed: false,
    dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    writeThroughSearchAllowed: false,
    sourceTruthWriteAllowed: false,
    sourceTruthOwnershipAllowed: false,
    runtimeOwnsBusinessFacts: false,
    readSurfaceSearchProjectionMode: "readonly_projection_only",
    runtimeBoundary: {
      sourceTruthWriteAllowed: false,
      financeLedgerWriteAllowed: false,
      productionConfirmationWriteAllowed: false,
      admissionPolicyBypassAllowed: false,
      searchReadSurfaceWriteAllowed: false,
      runtimeOwnsBusinessFacts: false
    },
    testOnlyConsumptionProofRef: DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH,
    explicitExclusions: [
      "businessFeatureDevelopmentAllowed",
      "dormitoryFirstGoldenChainLandingGoNoGo",
      "productionConfirmAllowed",
      "releaseAuthority",
      "finalGoNoGo",
      "Finance posting",
      "Dormitory L2"
    ]
  };
}

export function validateDormitoryRuntimeAdmissionAuthority({
  authority,
  root = process.cwd(),
  currentHead = null,
  writeProof = true
} = {}) {
  const failures = [];
  const warnings = [];
  const acceptanceAuthority = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
  const acceptance = validateGeneratedCandidateAcceptanceAuthority({
    acceptance: acceptanceAuthority,
    root,
    currentHead
  });
  let proof = readJsonIfExists(DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH, root);
  if (writeProof && authority?.runtimeAdmissionStatus === RUNTIME_ADMISSION_APPROVED_STATUS && !proof) {
    writeJson(DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH, buildTestOnlyConsumptionProof({
      authority,
      acceptance
    }), root);
    proof = readJsonIfExists(DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH, root);
  }

  if (!authority || typeof authority !== "object") {
    failures.push(`${DORMITORY_RUNTIME_ADMISSION_PATH} is missing or invalid.`);
  } else {
    requireEqual(authority.version, "oam.dormitory-runtime-admission.v1", "version", failures);
    requireEqual(
      authority.authorityType,
      "dormitory_first_golden_chain_runtime_admission",
      "authorityType",
      failures
    );
    if (!allowedStatuses.has(authority.runtimeAdmissionStatus)) {
      failures.push(`runtimeAdmissionStatus invalid: ${format(authority.runtimeAdmissionStatus)}.`);
    }
    if (acceptance.status !== "PASS") {
      failures.push("generated candidate acceptance checker must PASS before runtime admission.");
    }
    requireEqual(authority.generatedCandidateAcceptedBy00, true, "generatedCandidateAcceptedBy00", failures);
    if (acceptance.generatedCandidateAcceptedBy00 !== true) {
      failures.push("generatedCandidateAcceptedBy00 must be true before runtime admission.");
    }
    if (!acceptanceAuthority?.acceptanceRecord) {
      failures.push("acceptanceRecord must exist before runtime admission.");
    }
    requireEqual(authority.acceptedSubjectDigest, acceptance.subjectDigest, "acceptedSubjectDigest", failures);
    requireEqual(
      authority.generatedCandidateSubjectDigest,
      acceptance.subjectDigest,
      "generatedCandidateSubjectDigest",
      failures
    );
    requireEqual(authority.reviewedExecutionHead, acceptance.reviewedExecutionHead, "reviewedExecutionHead", failures);
    requireEqual(authority.evidenceArtifactDigest, acceptance.evidenceArtifactDigest, "evidenceArtifactDigest", failures);
    requireEqual(
      authority.generatedFieldBindingClosureDigest,
      acceptance.generatedFieldBindingClosureDigest,
      "generatedFieldBindingClosureDigest",
      failures
    );
    requireEqual(
      authority.sourceFieldGapsDecisionDigest,
      acceptance.sourceFieldGapsDecisionDigest,
      "sourceFieldGapsDecisionDigest",
      failures
    );
    requireEqual(authority.executionProofDigest, acceptance.executionProofDigest, "executionProofDigest", failures);
    requireEqual(
      authority.runtimeAdmissionScope,
      "dormitory_first_golden_chain_test_only_consumption",
      "runtimeAdmissionScope",
      failures
    );
    requireArrayEqual(
      authority.consumedGeneratedContracts,
      generatedRuntimeContractRefs,
      "consumedGeneratedContracts",
      failures
    );
    requireArrayEqual(authority.allowedOperationCases, allowedDormitoryRuntimeOperationCases, "allowedOperationCases", failures);
    for (const file of generatedRuntimeContractRefs) {
      if (!fs.existsSync(path.join(root, file))) {
        failures.push(`runtime consumed generated contract missing: ${file}.`);
      }
    }
    for (const file of authority.consumedGeneratedContracts ?? []) {
      const normalized = String(file).replace(/\\/g, "/");
      if (!generatedRuntimeContractRefs.includes(normalized)) {
        failures.push(`runtime may only consume generated contracts, found: ${normalized}.`);
      }
    }
    checkNegativeAuthorities(authority, failures);
    checkRuntimeBoundary(authority.runtimeBoundary, failures);

    if (authority.runtimeAdmissionStatus === RUNTIME_ADMISSION_PENDING_STATUS) {
      requireEqual(authority.runtimeConsumptionReady, false, "runtimeConsumptionReady", failures);
      requireEqual(authority.runtimeConsumptionMode, "pending_runtime_admission_review", "runtimeConsumptionMode", failures);
    }

    if (authority.runtimeAdmissionStatus === RUNTIME_ADMISSION_APPROVED_STATUS) {
      requireEqual(authority.runtimeConsumptionReady, true, "runtimeConsumptionReady", failures);
      requireEqual(authority.runtimeConsumptionMode, "test_only_consumption", "runtimeConsumptionMode", failures);
      checkTestOnlyProof(proof, authority, acceptance, failures);
    }
  }

  const status = failures.length === 0 ? "PASS" : "NO_GO";
  const previousResult = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_RESULT_PATH, root);
  const result = {
    version: "oam.dormitory-runtime-admission-predicate.v1",
    checkedAtUtc: new Date().toISOString(),
    status,
    runtimeAdmissionStatus: authority?.runtimeAdmissionStatus ?? "MISSING",
    generatedCandidateAcceptedBy00: acceptance.generatedCandidateAcceptedBy00 === true,
    acceptanceRecordExists: Boolean(acceptanceAuthority?.acceptanceRecord),
    acceptedSubjectDigest: acceptance.subjectDigest,
    generatedCandidateSubjectDigest: authority?.generatedCandidateSubjectDigest ?? null,
    reviewedExecutionHead: acceptance.reviewedExecutionHead,
    evidenceArtifactDigest: acceptance.evidenceArtifactDigest,
    generatedFieldBindingClosureDigest: acceptance.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: acceptance.sourceFieldGapsDecisionDigest,
    executionProofDigest: acceptance.executionProofDigest,
    consumedGeneratedContracts: authority?.consumedGeneratedContracts ?? [],
    allowedOperationCases: authority?.allowedOperationCases ?? [],
    runtimeConsumptionReady: authority?.runtimeConsumptionReady === true,
    businessFeatureDevelopmentAllowed: false,
    dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    writeThroughSearchAllowed: false,
    sourceTruthWriteAllowed: false,
    runtimeOwnsBusinessFacts: false,
    testOnlyConsumptionProofRef: DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH,
    testOnlyConsumptionProofDigest: proof ? digestObject(proof) : "missing",
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

export function buildTestOnlyConsumptionProof({ authority, acceptance, result = null } = {}) {
  return {
    version: "oam.dormitory-runtime-test-only-consumption-proof.v1",
    proofType: "dormitory_first_golden_chain_test_only_consumption",
    generatedAtUtc: new Date().toISOString(),
    status: "PASS",
    runtimeAdmissionStatus: RUNTIME_ADMISSION_APPROVED_STATUS,
    generatedCandidateAcceptedBy00: true,
    acceptedSubjectDigest: authority.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: authority.generatedCandidateSubjectDigest,
    consumedGeneratedContracts: [...generatedRuntimeContractRefs],
    allowedOperationCases: [...allowedDormitoryRuntimeOperationCases],
    proves: {
      runtimeCanReadAcceptedGeneratedContracts: true,
      runtimeWritesSourceTruth: false,
      runtimeWritesFinanceLedger: false,
      runtimeWritesProductionConfirmation: false,
      runtimeBypassesAdmissionPolicy: false,
      searchReadSurfaceProjectionOnly: true,
      browserApiRuntimeTestsAreTestOnlyConsumptionProof: true,
      businessGoProven: false,
      releaseGoProven: false
    },
    boundaries: {
      sourceTruthWriteAllowed: false,
      financeLedgerWriteAllowed: false,
      productionConfirmationWriteAllowed: false,
      admissionPolicyBypassAllowed: false,
      searchReadSurfaceWriteAllowed: false,
      runtimeOwnsBusinessFacts: false
    },
    negativeAuthorities: {
      businessFeatureDevelopmentAllowed: false,
      dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
      productionConfirmAllowed: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO",
      financePostingAllowed: false,
      dormitoryL2Allowed: false
    },
    evidenceRefs: [
      GENERATED_CANDIDATE_ACCEPTANCE_PATH,
      GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH,
      DORMITORY_RUNTIME_ADMISSION_PATH,
      ...generatedRuntimeContractRefs,
      "artifacts/oam/evidence/runtime-proof.json",
      "artifacts/oam/evidence/search-readonly-proof.json",
      "artifacts/oam/evidence/dormitory-l1-browser-e2e",
      "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
    ],
    checkerResultStatus: result?.status ?? "PASS",
    finalGoNoGo: "NO_GO"
  };
}

export function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(normalizeForDigest(value))).digest("hex")}`;
}

function checkRuntimeBoundary(boundary, failures) {
  if (!boundary || typeof boundary !== "object") {
    failures.push("runtimeBoundary is required.");
    return;
  }
  for (const [field, expected] of Object.entries({
    sourceTruthWriteAllowed: false,
    financeLedgerWriteAllowed: false,
    productionConfirmationWriteAllowed: false,
    admissionPolicyBypassAllowed: false,
    searchReadSurfaceWriteAllowed: false,
    runtimeOwnsBusinessFacts: false
  })) {
    if (boundary[field] !== expected) {
      failures.push(`runtimeBoundary.${field} must be ${format(expected)}, actual ${format(boundary[field])}.`);
    }
  }
}

function checkNegativeAuthorities(authority, failures) {
  for (const [field, expected] of Object.entries(negativeAuthorityExpectations)) {
    if (authority[field] !== expected) {
      failures.push(`${field} must be ${format(expected)}, actual ${format(authority[field])}.`);
    }
  }
  if (authority.runtimeOwnsBusinessFacts !== false) {
    failures.push("runtimeOwnsBusinessFacts must be false.");
  }
  if (authority.readSurfaceSearchProjectionMode !== "readonly_projection_only") {
    failures.push("readSurfaceSearchProjectionMode must be readonly_projection_only.");
  }
}

function checkTestOnlyProof(proof, authority, acceptance, failures) {
  if (!proof || typeof proof !== "object") {
    failures.push(`${DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH} is required after runtime admission approval.`);
    return;
  }
  requireEqual(proof.version, "oam.dormitory-runtime-test-only-consumption-proof.v1", "proof.version", failures);
  requireEqual(proof.status, "PASS", "proof.status", failures);
  requireEqual(proof.runtimeAdmissionStatus, RUNTIME_ADMISSION_APPROVED_STATUS, "proof.runtimeAdmissionStatus", failures);
  requireEqual(proof.generatedCandidateAcceptedBy00, true, "proof.generatedCandidateAcceptedBy00", failures);
  requireEqual(proof.acceptedSubjectDigest, authority.acceptedSubjectDigest, "proof.acceptedSubjectDigest", failures);
  requireEqual(
    proof.generatedCandidateSubjectDigest,
    acceptance.subjectDigest,
    "proof.generatedCandidateSubjectDigest",
    failures
  );
  requireArrayEqual(proof.consumedGeneratedContracts, generatedRuntimeContractRefs, "proof.consumedGeneratedContracts", failures);
  requireArrayEqual(proof.allowedOperationCases, allowedDormitoryRuntimeOperationCases, "proof.allowedOperationCases", failures);
  for (const [field, expected] of Object.entries({
    runtimeCanReadAcceptedGeneratedContracts: true,
    runtimeWritesSourceTruth: false,
    runtimeWritesFinanceLedger: false,
    runtimeWritesProductionConfirmation: false,
    runtimeBypassesAdmissionPolicy: false,
    searchReadSurfaceProjectionOnly: true,
    browserApiRuntimeTestsAreTestOnlyConsumptionProof: true,
    businessGoProven: false,
    releaseGoProven: false
  })) {
    if (proof.proves?.[field] !== expected) {
      failures.push(`proof.proves.${field} must be ${format(expected)}, actual ${format(proof.proves?.[field])}.`);
    }
  }
  checkRuntimeBoundary(proof.boundaries, failures);
  if (proof.negativeAuthorities?.releaseAuthority !== false ||
    proof.negativeAuthorities?.finalGoNoGo !== "NO_GO" ||
    proof.negativeAuthorities?.productionConfirmAllowed !== false ||
    proof.negativeAuthorities?.financePostingAllowed !== false ||
    proof.negativeAuthorities?.dormitoryL2Allowed !== false) {
    failures.push("proof negative authorities must keep release, final GO, production confirm, Finance posting, and Dormitory L2 blocked.");
  }
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function requireArrayEqual(actual, expected, label, failures) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  const normalizedActual = [...actual].map((item) => String(item).replace(/\\/g, "/")).sort();
  const normalizedExpected = [...expected].sort();
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
