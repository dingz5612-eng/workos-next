import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  evaluateDecisionWritebackPolicy,
  isAncestor,
  isGitSha
} from "./decision-writeback-policy.mjs";
import {
  FIELD_BINDING_CLOSURE_RESULT_PATH,
  FIELD_BINDINGS_GENERATED_PATH,
  buildDormitoryGeneratedFieldBindingClosure
} from "./dormitory-generated-field-binding-closure.mjs";

export const GENERATED_CANDIDATE_ACCEPTANCE_PATH = "docs/oam/generated-candidate-acceptance.current.json";
export const GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH = "artifacts/oam/checks/generated-candidate-acceptance-result.json";
export const GENERATED_COMPILE_EXECUTION_RESULT_PATH = "artifacts/oam/checks/generated-compile-execution-result.json";
export const GENERATED_COMPILE_EXECUTION_PROOF_PATH = "artifacts/oam/evidence/generated-compile-execution-proof.json";
export const GENERATED_COMPILE_EXECUTION_SNAPSHOT_PATH = "artifacts/oam/checks/generated-compile-execution-input-snapshot.json";
export const GENERATED_COMPILE_APPROVAL_PATH = "docs/oam/generated-compile-approval.current.json";
export const GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH = "docs/oam/generated-compile-candidate-approval.current.json";
export const DORMITORY_ATTESTATION_PACKAGE_PATH =
  "docs/oam/evidence-attestation-packages/dormitory-golden-chain-2b7bc377.attestation.json";

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const decisionStatuses = new Set(["PENDING_00_DECISION", "NOT_ACCEPTED_BY_00", "ACCEPTED_BY_00"]);
const negativeAuthorities = {
  runtimeConsumptionReady: false,
  businessFeatureDevelopmentAllowed: false,
  businessProductionGoNoGo: "NO_GO",
  dormitoryL2GoNoGo: "NO_GO",
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};

const requiredEvidenceDigestFiles = [
  ["generatedCompileExecutionResult", GENERATED_COMPILE_EXECUTION_RESULT_PATH],
  ["generatedCompileExecutionProof", GENERATED_COMPILE_EXECUTION_PROOF_PATH],
  ["generatedCompileExecutionSnapshot", GENERATED_COMPILE_EXECUTION_SNAPSHOT_PATH],
  ["generatedFieldBindingClosure", FIELD_BINDING_CLOSURE_RESULT_PATH],
  ["generatedFilesNotManuallyEdited", "artifacts/oam/checks/generated-files-not-manually-edited-result.json"],
  ["generatedContractConsistency", "artifacts/oam/checks/generated-contract-consistency-result.json"],
  ["derivedContractConsistency", "artifacts/oam/checks/derived-contract-consistency-result.json"],
  ["oamKernelGraph", "artifacts/oam/checks/oam-kernel-graph-result.json"],
  ["dormitoryCandidateAttestationPackage", DORMITORY_ATTESTATION_PACKAGE_PATH]
];

const requiredManifestDigestFiles = [
  ["generatedContractsManifest", "docs/oam/generated-contracts-manifest.json"],
  ["generatedKernelGraph", "docs/oam/kernel/oam-kernel-graph.generated.json"],
  ["generatedFieldBindings", FIELD_BINDINGS_GENERATED_PATH],
  ["domainDerivedContracts", "docs/oam/domain-derived-contracts.json"],
  ["systemDerivedContracts", "docs/oam/system-derived-contracts.json"]
];

export function buildGeneratedCandidateSubject({ root = process.cwd(), currentHead = null } = {}) {
  const failures = [];
  const warnings = [];
  const missingFiles = [];
  const read = (file) => readJsonIfExists(file, root, missingFiles);

  const result = read(GENERATED_COMPILE_EXECUTION_RESULT_PATH);
  const proof = read(GENERATED_COMPILE_EXECUTION_PROOF_PATH);
  const snapshot = read(GENERATED_COMPILE_EXECUTION_SNAPSHOT_PATH);
  const formalApproval = read(GENERATED_COMPILE_APPROVAL_PATH);
  const candidateApproval = read(GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH);
  const attestationPackage = read(DORMITORY_ATTESTATION_PACKAGE_PATH);
  const releaseObject = readJsonIfExists("artifacts/oam/evidence/current-oam-release-evidence-object.json", root);
  const evidenceGraph = readJsonIfExists("artifacts/oam/evidence/evidence-graph.json", root);
  const currentRepositoryHead = currentHead ?? git(["rev-parse", "HEAD"], root);
  const fieldBindingClosure = buildDormitoryGeneratedFieldBindingClosure({ root });
  const fieldBindingClosureResult = read(FIELD_BINDING_CLOSURE_RESULT_PATH);

  const reviewedExecutionHead = firstPresent(
    result?.reviewedExecutionHead,
    proof?.reviewedExecutionHead,
    result?.currentHead,
    proof?.currentHead
  );
  const generatedCompileExecutionHead = reviewedExecutionHead;
  const sourceCandidateHead = firstPresent(
    candidateApproval?.candidateSourceRef,
    candidateApproval?.authorizedSourceRef,
    formalApproval?.candidateSourceRef
  );
  const formalAuthorizationHead = firstPresent(
    formalApproval?.approvedFormalAuthorizationHead,
    formalApproval?.currentHEAD,
    formalApproval?.reviewedRef
  );
  const authorizedCandidateExecutionHead = firstPresent(
    candidateApproval?.authorizedCandidateExecutionHead,
    candidateApproval?.executionHead,
    formalApproval?.authorizedCandidateExecutionHead,
    attestationPackage?.candidateRefs?.authorizedCandidateExecutionHead
  );
  const generatedOutputDigest = firstPresent(
    result?.generatedOutputDigest,
    attestationPackage?.generatedCompileExecution?.generatedOutputDigest
  );
  const artifactMode = attestationPackage?.artifactVerification?.artifactMode ?? null;
  const evidenceArtifactDigest = firstPresent(
    attestationPackage?.artifactVerification?.githubArtifactDigest,
    attestationPackage?.artifactVerification?.observedGitHubArtifactDigest,
    formalApproval?.candidateArtifactGithubDigest
  );
  const localEvidenceArtifactDigest = firstPresent(
    attestationPackage?.artifactVerification?.internalArtifactDigest,
    releaseObject?.artifactDigest,
    evidenceGraph?.binding?.artifactDigest,
    evidenceGraph?.artifactDigest
  );
  const evidenceRootDigest = firstPresent(
    attestationPackage?.artifactVerification?.evidenceRootDigest,
    releaseObject?.evidenceRootDigest,
    evidenceGraph?.binding?.evidenceRootDigest
  );

  requireGitSha(reviewedExecutionHead, "reviewedExecutionHead", failures);
  requireGitSha(sourceCandidateHead, "sourceCandidateHead", failures);
  requireGitSha(formalAuthorizationHead, "formalAuthorizationHead", failures);
  requireGitSha(authorizedCandidateExecutionHead, "authorizedCandidateExecutionHead", failures);
  requireGitSha(generatedCompileExecutionHead, "generatedCompileExecutionHead", failures);
  requireDigest(generatedOutputDigest, "generatedOutputDigest", failures);
  requireDigest(evidenceArtifactDigest, "evidenceArtifactDigest", failures);
  requireDigest(fieldBindingClosure.closureDigest, "generatedFieldBindingClosureDigest", failures);
  requireDigest(fieldBindingClosure.sourceFieldGapsDecisionDigest, "sourceFieldGapsDecisionDigest", failures);
  requireDigest(evidenceRootDigest, "evidenceRootDigest", failures);
  if (fieldBindingClosure.status !== "PASS" || fieldBindingClosureResult?.status !== "PASS") {
    failures.push("generated field binding closure must PASS before generated candidate acceptance can be reviewed.");
  }

  if (result?.status !== "PASS" || result?.checkerExecutionStatus !== "PASS") {
    failures.push(`${GENERATED_COMPILE_EXECUTION_RESULT_PATH} must be PASS.`);
  }
  if (proof?.status !== "PASS") {
    failures.push(`${GENERATED_COMPILE_EXECUTION_PROOF_PATH} must be PASS.`);
  }
  if (snapshot?.status !== "PASS") {
    failures.push(`${GENERATED_COMPILE_EXECUTION_SNAPSHOT_PATH} must be PASS.`);
  }
  if (result?.generatedCompileCompleted !== true ||
    result?.generatedCompilationCompleted !== true ||
    proof?.generatedCompileCompleted !== true ||
    proof?.generatedCompilationCompleted !== true) {
    failures.push("generated compile execution must be completed in result and proof.");
  }
  if (result?.generatedCandidateAcceptedBy00 !== false ||
    proof?.generatedCandidateAcceptedBy00 !== false ||
    result?.runtimeConsumptionReady !== false ||
    proof?.runtimeConsumptionReady !== false ||
    result?.releaseAuthority !== false ||
    proof?.releaseAuthority !== false ||
    result?.finalGoNoGo !== "NO_GO" ||
    proof?.finalGoNoGo !== "NO_GO") {
    failures.push("S4 execution result/proof must keep candidate acceptance, runtime, release, and GO blocked.");
  }
  if (isGitSha(reviewedExecutionHead) && isGitSha(currentRepositoryHead) &&
    !isAncestor(reviewedExecutionHead, currentRepositoryHead, root)) {
    warnings.push("currentRepositoryHead is not a descendant of reviewedExecutionHead; subject remains reference-only.");
  }

  const requiredEvidenceDigestSet = buildDigestSet(requiredEvidenceDigestFiles, root, missingFiles);
  const requiredManifestDigestSet = buildDigestSet(requiredManifestDigestFiles, root, missingFiles);
  const executionProofDigest = digestObject({
    version: "oam.generated-candidate-execution-proof-digest.v1",
    reviewedExecutionHead,
    formalAuthorizationHead,
    generatedCompileExecutionHead,
    generatedOutputDigest,
    manifestDigest: result?.manifestDigest ?? null,
    generatedKernelGraphDigest: result?.generatedKernelGraphDigest ?? null,
    reproducibility: result?.reproducibility ?? proof?.reproducibility ?? null,
    noManualEditProof: result?.noManualEditProof ?? proof?.noManualEditProof ?? null,
    consistencyProof: result?.consistencyProof ?? proof?.consistencyProof ?? null,
    driftProof: result?.driftProof ?? proof?.driftProof ?? null,
    generatedCompileCompleted: true,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });

  const subjectCore = {
    version: "oam.generated-candidate-subject.v1",
    subjectType: "generated_candidate_subject",
    reviewedExecutionHead,
    decisionRecordHead: null,
    currentRepositoryHead: firstPresent(result?.currentRepositoryHead, result?.currentHead, proof?.currentRepositoryHead, proof?.currentHead, currentRepositoryHead),
    sourceCandidateHead,
    authorizedCandidateExecutionHead,
    formalAuthorizationHead,
    generatedCompileExecutionHead,
    generatedOutputDigest,
    generatedFieldBindingClosureDigest: fieldBindingClosure.closureDigest,
    sourceFieldGapsDecisionDigest: fieldBindingClosure.sourceFieldGapsDecisionDigest,
    evidenceArtifactDigest,
    evidenceArtifactMode: artifactMode,
    localEvidenceArtifactDigest,
    executionProofDigest,
    evidenceRootDigest,
    requiredEvidenceDigestSet,
    requiredGeneratedContractDigestSet: requiredManifestDigestSet
  };
  const subject = {
    ...subjectCore,
    subjectDigest: digestObject(normalizeGeneratedCandidateSubjectForIdentity(subjectCore))
  };
  const status = missingFiles.length > 0
    ? "INCOMPLETE"
    : failures.length > 0
      ? "INVALID"
      : artifactMode !== "ci_artifact_authoritative" ||
        attestationPackage?.artifactVerification?.artifactCompletenessStatus !== "PASS"
        ? "NOT_READY_FOR_00_ACCEPTANCE_REVIEW"
        : warnings.some((item) => item.includes("not a descendant"))
        ? "STALE"
        : "READY_FOR_00_ACCEPTANCE_REVIEW";

  return {
    version: "oam.generated-candidate-subject-state.v1",
    status,
    subject,
    currentRepositoryHead,
    missingFiles: [...new Set(missingFiles)].sort(),
    failures,
    warnings,
    deprecatedAliasReferences: buildDeprecatedAliasReferences(candidateApproval, attestationPackage)
  };
}

export function buildInitialGeneratedCandidateAcceptance({ root = process.cwd(), currentHead = null } = {}) {
  const subjectState = buildGeneratedCandidateSubject({ root, currentHead });
  return {
    version: "oam.generated-candidate-acceptance.v1",
    decisionType: "generated_candidate_acceptance",
    decisionStatus: "PENDING_00_DECISION",
    generatedCandidateAcceptedBy00: false,
    generatedCandidateSubject: subjectState.subject,
    subjectStatusAtWrite: subjectState.status,
    reviewedExecutionHead: subjectState.subject.reviewedExecutionHead,
    decisionRecordHead: null,
    decisionWritebackBaseHead: subjectState.currentRepositoryHead,
    evidenceArtifactDigest: subjectState.subject.evidenceArtifactDigest,
    generatedFieldBindingClosureDigest: subjectState.subject.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: subjectState.subject.sourceFieldGapsDecisionDigest,
    executionProofDigest: subjectState.subject.executionProofDigest,
    evidenceRootDigest: subjectState.subject.evidenceRootDigest,
    blockingReasons: subjectState.status === "READY_FOR_00_ACCEPTANCE_REVIEW"
      ? []
      : [
          "generated_candidate_acceptance_requires_explicit_00_decision",
          `subject_status=${subjectState.status}`
        ],
    explicitNegativeAuthorities: { ...negativeAuthorities },
    acceptanceRecord: null,
    historicalAppendix: {
      deprecatedAliasReferences: subjectState.deprecatedAliasReferences,
      note: "Deprecated aliases are retained only as appendix references and do not participate in current generated candidate acceptance authority."
    },
    nextDecisionRequired: "00_generated_candidate_acceptance_decision",
    forbiddenInterpretations: [
      "CI success is not generated candidate acceptance",
      "artifact exists is not generated candidate acceptance",
      "Evidence Root PASS is not generated candidate acceptance",
      "S4 execution PASS is not generated candidate acceptance",
      "acceptance authority does not open runtime consumption",
      "acceptance authority does not grant releaseAuthority or final GO"
    ]
  };
}

export function validateGeneratedCandidateAcceptanceAuthority({
  acceptance,
  root = process.cwd(),
  currentHead = null
} = {}) {
  const failures = [];
  const warnings = [];
  const subjectState = buildGeneratedCandidateSubject({ root, currentHead });
  const currentRepositoryHead = subjectState.currentRepositoryHead;

  if (!acceptance || typeof acceptance !== "object") {
    failures.push(`${GENERATED_CANDIDATE_ACCEPTANCE_PATH} is missing or invalid.`);
  } else {
    requireEqual(acceptance.version, "oam.generated-candidate-acceptance.v1", "version", failures);
    requireEqual(acceptance.decisionType, "generated_candidate_acceptance", "decisionType", failures);
    if (!decisionStatuses.has(acceptance.decisionStatus)) {
      failures.push(`decisionStatus must be PENDING_00_DECISION, NOT_ACCEPTED_BY_00, or ACCEPTED_BY_00, actual ${format(acceptance.decisionStatus)}.`);
    }
    if (!sameGeneratedCandidateSubject(acceptance.generatedCandidateSubject, subjectState.subject)) {
      failures.push("generatedCandidateSubject must match the shared generated candidate subject identity.");
    }
    requireEqual(acceptance.reviewedExecutionHead, subjectState.subject.reviewedExecutionHead, "reviewedExecutionHead", failures);
    requireEqual(acceptance.evidenceArtifactDigest, subjectState.subject.evidenceArtifactDigest, "evidenceArtifactDigest", failures);
    requireEqual(acceptance.generatedFieldBindingClosureDigest, subjectState.subject.generatedFieldBindingClosureDigest, "generatedFieldBindingClosureDigest", failures);
    requireEqual(acceptance.sourceFieldGapsDecisionDigest, subjectState.subject.sourceFieldGapsDecisionDigest, "sourceFieldGapsDecisionDigest", failures);
    requireEqual(acceptance.executionProofDigest, subjectState.subject.executionProofDigest, "executionProofDigest", failures);
    requireEqual(acceptance.evidenceRootDigest, subjectState.subject.evidenceRootDigest, "evidenceRootDigest", failures);
    checkNegativeAuthorities(acceptance, failures);

    if (acceptance.decisionStatus === "PENDING_00_DECISION") {
      requireEqual(acceptance.generatedCandidateAcceptedBy00, false, "generatedCandidateAcceptedBy00", failures);
      if (acceptance.acceptanceRecord !== null) {
        failures.push("acceptanceRecord must be null while decisionStatus=PENDING_00_DECISION.");
      }
    }

    if (acceptance.decisionStatus === "NOT_ACCEPTED_BY_00") {
      requireEqual(acceptance.generatedCandidateAcceptedBy00, false, "generatedCandidateAcceptedBy00", failures);
      if (!Array.isArray(acceptance.blockingReasons) || acceptance.blockingReasons.length === 0) {
        failures.push("blockingReasons must be non-empty when decisionStatus=NOT_ACCEPTED_BY_00.");
      }
      if (acceptance.acceptanceRecord !== null) {
        failures.push("acceptanceRecord must be null while decisionStatus=NOT_ACCEPTED_BY_00.");
      }
    }

    if (acceptance.decisionStatus === "ACCEPTED_BY_00") {
      requireEqual(acceptance.generatedCandidateAcceptedBy00, true, "generatedCandidateAcceptedBy00", failures);
      checkAcceptanceRecord(acceptance, subjectState.subject, failures);
      if (subjectState.status !== "READY_FOR_00_ACCEPTANCE_REVIEW") {
        failures.push(`ACCEPTED_BY_00 requires subject READY_FOR_00_ACCEPTANCE_REVIEW, actual ${subjectState.status}.`);
      }
    }
  }

  if (["INCOMPLETE", "INVALID", "SEMANTIC_CLOSURE_INCOMPLETE"].includes(subjectState.status)) {
    failures.push(`generated candidate subject must not be ${subjectState.status}.`);
  }
  if (subjectState.status === "INVALID") failures.push(...subjectState.failures);
  warnings.push(...subjectState.warnings);

  const decisionWritebackPolicy = evaluateDecisionWritebackPolicy({
    reviewedExecutionHead: subjectState.subject.reviewedExecutionHead,
    decisionRecordHead: acceptance?.decisionRecordHead ?? null,
    currentRepositoryHead,
    decisionStatus: acceptance?.decisionStatus ?? "PENDING_00_DECISION",
    root
  });
  if (acceptance?.decisionStatus === "ACCEPTED_BY_00" && decisionWritebackPolicy.allowed !== true) {
    failures.push(...decisionWritebackPolicy.failures);
  }
  warnings.push(...decisionWritebackPolicy.warnings);

  const decisionStatus = acceptance?.decisionStatus ?? "MISSING";
  return {
    version: "oam.generated-candidate-acceptance-predicate.v1",
    status: failures.length === 0 ? "PASS" : "NO_GO",
    decisionStatus,
    generatedCandidateAcceptedBy00: acceptance?.generatedCandidateAcceptedBy00 === true,
    subjectStatus: subjectState.status,
    generatedCandidateSubject: subjectState.subject,
    subjectDigest: subjectState.subject.subjectDigest,
    reviewedExecutionHead: subjectState.subject.reviewedExecutionHead,
    decisionRecordHead: acceptance?.decisionRecordHead ?? null,
    currentRepositoryHead,
    generatedOutputDigest: subjectState.subject.generatedOutputDigest,
    generatedFieldBindingClosureDigest: subjectState.subject.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: subjectState.subject.sourceFieldGapsDecisionDigest,
    evidenceArtifactDigest: subjectState.subject.evidenceArtifactDigest,
    executionProofDigest: subjectState.subject.executionProofDigest,
    evidenceRootDigest: subjectState.subject.evidenceRootDigest,
    requiredEvidenceDigestSet: subjectState.subject.requiredEvidenceDigestSet,
    requiredGeneratedContractDigestSet: subjectState.subject.requiredGeneratedContractDigestSet,
    decisionWritebackPolicy,
    deprecatedAliasReferences: subjectState.deprecatedAliasReferences,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    warnings,
    failures
  };
}

export function readJsonIfExists(file, root = process.cwd(), missingFiles = null) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    if (missingFiles) missingFiles.push(file);
    return null;
  }
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

export function writeJson(file, data, root = process.cwd()) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

export function hashFile(file, root = process.cwd()) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function buildDigestSet(items, root, missingFiles) {
  return items.map(([id, file]) => {
    if (!fs.existsSync(path.join(root, file))) {
      missingFiles.push(file);
      return { id, path: file, digest: "missing" };
    }
    return { id, path: file, digest: stableFileDigest(file, root) };
  });
}

function stableFileDigest(file, root) {
  if (!file.endsWith(".json")) return hashFile(file, root);
  const value = JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
  return digestObject(normalizeForStableDigest(value));
}

function normalizeForStableDigest(value) {
  if (Array.isArray(value)) return value.map(normalizeForStableDigest);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (isVolatileDigestKey(key)) continue;
      normalized[key] = normalizeForStableDigest(child);
    }
    return normalized;
  }
  return value;
}

function isVolatileDigestKey(key) {
  return new Set([
    "checkedAtUtc",
    "generatedAtUtc",
    "recordedAtUtc",
    "startedAtUtc",
    "endedAtUtc",
    "finishedAtUtc",
    "generatedAt",
    "currentHead",
    "currentRepositoryHead",
    "resultDigest",
    "snapshotDigest",
    "proofDigest",
    "inputSnapshotDigest",
    "approvalObjectHash"
  ]).has(key);
}

function buildDeprecatedAliasReferences(candidateApproval, attestationPackage) {
  const references = [];
  if (candidateApproval?.executionHead) {
    references.push({
      source: GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH,
      field: "executionHead",
      aliasOf: "authorizedCandidateExecutionHead",
      participation: "deprecated_alias_reference_only_not_current_acceptance_authority"
    });
  }
  if (attestationPackage?.candidateRefs?.executionHead) {
    references.push({
      source: DORMITORY_ATTESTATION_PACKAGE_PATH,
      field: "candidateRefs.executionHead",
      aliasOf: "authorizedCandidateExecutionHead",
      participation: "deprecated_alias_reference_only_not_current_acceptance_authority"
    });
  }
  if (attestationPackage?.previousAuthorizedCandidateExecutionHead) {
    references.push({
      source: DORMITORY_ATTESTATION_PACKAGE_PATH,
      field: "previousAuthorizedCandidateExecutionHead",
      aliasOf: null,
      participation: "appendix_reference_only_not_current_acceptance_authority"
    });
  }
  if (attestationPackage?.artifactVerification?.artifactMode) {
    references.push({
      source: DORMITORY_ATTESTATION_PACKAGE_PATH,
      field: "artifactVerification.artifactMode",
      aliasOf: null,
      participation: "appendix_reference_only_not_current_acceptance_authority"
    });
  }
  return references;
}

function checkNegativeAuthorities(acceptance, failures) {
  const authorities = acceptance.explicitNegativeAuthorities ?? {};
  for (const [field, expected] of Object.entries(negativeAuthorities)) {
    if (authorities[field] !== expected) {
      failures.push(`explicitNegativeAuthorities.${field} must be ${format(expected)}, actual ${format(authorities[field])}.`);
    }
    if (acceptance[field] !== undefined && acceptance[field] !== expected) {
      failures.push(`${field} must be ${format(expected)} when present on the acceptance authority.`);
    }
  }
}

function checkAcceptanceRecord(acceptance, subject, failures) {
  const record = acceptance.acceptanceRecord;
  if (!record || typeof record !== "object") {
    failures.push("acceptanceRecord is required when decisionStatus=ACCEPTED_BY_00.");
    return;
  }
  requireEqual(record.decision, "ACCEPTED_BY_00", "acceptanceRecord.decision", failures);
  requireEqual(record.acceptedSubjectDigest, subject.subjectDigest, "acceptanceRecord.acceptedSubjectDigest", failures);
  if (!["00", "00_OAM_CONTROL", "00｜OAM 总控"].includes(record.acceptedBy)) {
    failures.push("acceptanceRecord.acceptedBy must be 00.");
  }
  if (!record.acceptedAtUtc) {
    failures.push("acceptanceRecord.acceptedAtUtc is required.");
  }
}

function requireGitSha(value, label, failures) {
  if (!isGitSha(value)) failures.push(`${label} must be a concrete git SHA.`);
}

function requireDigest(value, label, failures) {
  if (!digestPattern.test(String(value ?? ""))) failures.push(`${label} must be a sha256 digest.`);
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function sameGeneratedCandidateSubject(left, right) {
  return stableStringify(normalizeGeneratedCandidateSubjectForIdentity(left)) ===
    stableStringify(normalizeGeneratedCandidateSubjectForIdentity(right));
}

function normalizeGeneratedCandidateSubjectForIdentity(subject) {
  if (Array.isArray(subject)) return subject.map(normalizeGeneratedCandidateSubjectForIdentity);
  if (subject && typeof subject === "object") {
    const normalized = {};
    for (const [key, value] of Object.entries(subject)) {
      if (key === "currentRepositoryHead") continue;
      if (key === "subjectDigest") continue;
      normalized[key] = normalizeGeneratedCandidateSubjectForIdentity(value);
    }
    return normalized;
  }
  return subject;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function git(args, root) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function format(value) {
  return JSON.stringify(value);
}
