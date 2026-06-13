import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = "docs/oam/evidence-attestation-packages/dormitory-golden-chain-2b7bc377.attestation.json";
const candidateApprovalPath = "docs/oam/generated-compile-candidate-approval.current.json";
const formalApprovalPath = "docs/oam/generated-compile-approval.current.json";
const branch = "codex/dormitory-source-p0-s2-closure";
const acceptedAuthorizedCandidateExecutionHead = "2b7bc3772c7351b34c5ca91258fe388371ab9f6c";
const candidateSourceRef = "fd60390e678f9d6934137f0480a183701b01de8f";
const previousAuthorizedCandidateExecutionHead = "9db58da1ebc2a02349436833747307ac78c4c2fd";
const oldArtifactRunId = "27466582674";
const oldArtifactName = "workosnext-current-oam-evidence-27466582674";
const oldArtifactDigest = "sha256:37f42a6376e2d9d4a6dd0a5c9425c9fb33a3038ebdbb48423d4c1e77a4e7413d";
const oldArtifactMissingRequiredFiles = [
  "artifacts/oam/checks/generated-compile-authorization-result.json",
  "artifacts/oam/authority-cleanup/mutation-tests-result.json",
  "docs/oam/db-no-side-effects-proof.json",
  "artifacts/oam/checks/generated-files-not-manually-edited-result.json",
  "artifacts/oam/checks/generated-contract-consistency-result.json"
];
const requiredFiles = [
  ["evidenceGraph", "artifacts/oam/evidence/evidence-graph.json"],
  ["releaseEvidenceObject", "artifacts/oam/evidence/current-oam-release-evidence-object.json"],
  ["releaseAttestation", "artifacts/oam/evidence/current-oam-release-attestation.json"],
  ["finalReport", "artifacts/oam/final-report.json"],
  ["sourcePackageResult", "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json"],
  ["generatedCompileAuthorizationResult", "artifacts/oam/checks/generated-compile-authorization-result.json"],
  ["mutationTestsResult", "artifacts/oam/authority-cleanup/mutation-tests-result.json"],
  ["noSideEffectsProof", "docs/oam/db-no-side-effects-proof.json"],
  ["generatedFilesNotManuallyEditedResult", "artifacts/oam/checks/generated-files-not-manually-edited-result.json"],
  ["generatedContractConsistencyResult", "artifacts/oam/checks/generated-contract-consistency-result.json"],
  ["derivedContractConsistencyResult", "artifacts/oam/checks/derived-contract-consistency-result.json"],
  ["oamKernelGraphResult", "artifacts/oam/checks/oam-kernel-graph-result.json"],
  ["dashboardReadonlyReport", "artifacts/oam/checks/dashboard-readonly-report.json"],
  ["financeTruthReport", "artifacts/oam/checks/finance-truth-report.json"],
  ["operationIdentityBoundaryResult", "artifacts/oam/checks/operation-identity-boundary-result.json"],
  ["releaseAttestationResult", "artifacts/oam/checks/current-oam-release-attestation-result.json"]
];

const candidateApproval = readJson(candidateApprovalPath);
const formalApproval = readJsonIfExists(formalApprovalPath) ?? {};
const finalReport = readJsonIfExists("artifacts/oam/final-report.json") ?? {};
const releaseObject = readJsonIfExists("artifacts/oam/evidence/current-oam-release-evidence-object.json") ?? {};
const graph = readJsonIfExists("artifacts/oam/evidence/evidence-graph.json") ?? {};
const previousPackage = readJsonIfExists(outputPath) ?? {};
const previousRequiredFiles = new Map((previousPackage.requiredFiles ?? []).map((file) => [file.logicalPath, file]));

const artifactRoot = normalizeOptionalPath(process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_ROOT ?? "");
const artifactRunId = process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_RUN_ID || oldArtifactRunId;
const artifactName = process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_NAME || oldArtifactName;
const observedGitHubArtifactDigest = process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_DIGEST || oldArtifactDigest;
const artifactMode = artifactRoot ? "provided_artifact_root" : "historical_old_artifact_reference";
const fileEntries = requiredFiles.map(([id, logicalPath]) => buildFileEntry(id, logicalPath));
const missingRequiredFiles = fileEntries.filter((file) => file.present !== true).map((file) => file.logicalPath);
const artifactCompletenessStatus = missingRequiredFiles.length === 0 ? "PASS" : "BLOCKED_REQUIRED_FILES_MISSING";
const reviewPackageStatus = artifactCompletenessStatus === "PASS"
  ? "VALID_CURRENT_CANDIDATE_HEAD_NO_GO"
  : "VALID_WITH_P0_RESIDUALS_NO_GO";
const candidateCompileEvidenceStatus = artifactCompletenessStatus === "PASS"
  ? "CURRENT_CANDIDATE_HEAD_ARTIFACT_COMPLETE_PENDING_00_FORMAL_GENERATED_COMPILE_REVIEW"
  : "CURRENT_CANDIDATE_HEAD_PENDING_NEW_ARTIFACT";
const recommendation = artifactCompletenessStatus === "PASS"
  ? "SUBMIT_TO_00_FOR_FORMAL_GENERATED_COMPILE_AUTHORIZATION_REVIEW"
  : "RUN_NEW_CI_ARTIFACT_WITH_REQUIRED_FILES_BEFORE_FORMAL_GENERATED_COMPILE";
const nextDecisionFor00 = artifactCompletenessStatus === "PASS"
  ? "FORMAL_GENERATED_COMPILE_AUTHORIZATION_REVIEW"
  : "STOP_AND_FIX_ARTIFACT_UPLOAD_OR_RESULT_WRITERS";

const attestation = {
  packageVersion: "oam.dormitory-candidate-artifact-attestation.v1",
  packageStatus: artifactCompletenessStatus === "PASS"
    ? "CANDIDATE_HEAD_ACCEPTED_BY_00_ARTIFACT_COMPLETE_NO_GO"
    : "CANDIDATE_HEAD_ACCEPTED_BY_00_PENDING_NEW_ARTIFACT_NO_GO",
  reviewPackageStatus,
  generatedAtUtc: new Date().toISOString(),
  acceptedAuthorizedCandidateExecutionHead,
  candidateSourceRef,
  previousAuthorizedCandidateExecutionHead,
  oldArtifactRunId,
  oldArtifactName,
  oldArtifactDigest,
  oldArtifactCompletenessStatus: "BLOCKED_REQUIRED_FILES_MISSING",
  oldArtifactMissingRequiredFiles,
  recommendation,
  reviewTarget: {
    branch,
    reviewHead: acceptedAuthorizedCandidateExecutionHead,
    ciRunId: artifactRunId,
    workflowName: "CI",
    artifactName,
    observedGitHubArtifactDigest,
    businessGo: "NO_GO"
  },
  sourceRefs: {
    sourceScenarioRef: candidateApproval.sourceScenarioRef,
    authorizedSourceRef: candidateApproval.authorizedSourceRef,
    candidateSourceRef: candidateApproval.candidateSourceRef,
    sourceHash: candidateApproval.sourceHash,
    candidateSourceHash: candidateApproval.candidateSourceHash,
    hashNormalization: "CRLF_TO_LF",
    sourceFinalizationRequired: "SOURCE_FINALIZED_BY_00",
    sourceFieldGapsDecisionRequired: "DECIDED_AND_BOUND"
  },
  candidateRefs: {
    candidateHeadDecision: "ACCEPTED_BY_00_FOR_CANDIDATE_EXECUTION_HEAD_ONLY",
    authorizedCandidateExecutionHead: acceptedAuthorizedCandidateExecutionHead,
    executionHead: acceptedAuthorizedCandidateExecutionHead,
    executionHeadCompatibilityAliasOf: "authorizedCandidateExecutionHead",
    previousAuthorizedCandidateExecutionHead,
    candidateSourceRef,
    reviewHeadRelationToAuthorizedHead: "EQUALS_AUTHORIZED_CANDIDATE_EXECUTION_HEAD",
    candidateCompileEvidenceStatus,
    candidateCompileClosureForCurrentHead: false,
    recommendation
  },
  artifactVerification: {
    artifactMode,
    artifactRoot: artifactRoot ? path.relative(root, artifactRoot).replace(/\\/g, "/") : null,
    ciRunId: artifactRunId,
    artifactName,
    observedGitHubArtifactDigest,
    githubArtifactDigest: observedGitHubArtifactDigest,
    githubArtifactMetadataDigest: observedGitHubArtifactDigest,
    oldArtifactRunId,
    oldArtifactName,
    oldArtifactDigest,
    oldArtifactCompletenessStatus: "BLOCKED_REQUIRED_FILES_MISSING",
    oldArtifactMissingRequiredFiles,
    artifactCompletenessStatus,
    requiredFileCompletenessStatus: artifactCompletenessStatus,
    requiredFileMissingCount: missingRequiredFiles.length,
    missingRequiredFiles,
    oldArtifactHistoricalFactRetained: true,
    oldArtifactCannotProveNewRequiredFiles: true,
    newArtifactRequiredForFormalGeneratedCompileDecision: artifactCompletenessStatus !== "PASS",
    internalArtifactDigest: graph.binding?.artifactDigest ?? finalReport.artifactDigest ?? null,
    evidenceRootDigest: releaseObject.evidenceRootDigest ?? graph.binding?.evidenceRootDigest ?? null,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  },
  requiredFiles: fileEntries,
  evidenceBindingReview: {
    reviewHeadBoundTo00AcceptedCandidateHead: true,
    authorizedCandidateExecutionHead: acceptedAuthorizedCandidateExecutionHead,
    candidateSourceRef,
    finalReportAuthorizedCandidateExecutionHead: finalReport.authorizedCandidateExecutionHead ?? null,
    releaseObjectAuthorizedCandidateExecutionHead: releaseObject.authorizedCandidateExecutionHead ?? null,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  },
  gateResults: {
    candidateHeadAcceptanceSyncGate: "PASS",
    candidateEvidenceRebindGate: artifactCompletenessStatus === "PASS" ? "PASS" : "PENDING_NEW_CI_ARTIFACT",
    oldArtifactCompleteness: "BLOCKED_REQUIRED_FILES_MISSING",
    formalGeneratedCompileAuthorization: "BLOCKED",
    runtimeConsumption: "BLOCKED",
    businessProduction: "NO_GO",
    dormitoryL2: "NO_GO"
  },
  goNoGo: {
    generatedCompileCandidateAuthorized: true,
    generatedCompileAuthorized: false,
    formalGeneratedCompileAuthorized: false,
    generatedCompileCompleted: false,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    productionConfirmGoNoGo: "NO_GO",
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  },
  nextDecisionFor00: {
    candidateHeadDecision: "ACCEPTED_BY_00_FOR_CANDIDATE_EXECUTION_HEAD_ONLY",
    nextDecisionFor00,
    recommendation,
    rationale: [
      "00 accepted 2b7bc3772c7351b34c5ca91258fe388371ab9f6c as the candidate execution head only.",
      "CI #424 remains a historical immutable artifact and cannot prove the newly required artifact files.",
      "Formal generated compile authorization, runtime consumption, release authority, Business GO, Dormitory L2, and production_confirm remain blocked."
    ]
  },
  formalApprovalState: {
    generatedCompileAuthorized: formalApproval.generatedCompileAuthorized ?? false,
    generatedCompileCompleted: formalApproval.generatedCompileCompleted ?? false,
    runtimeConsumptionReady: formalApproval.runtimeConsumptionReady ?? false,
    releaseAuthority: formalApproval.releaseAuthority ?? false,
    finalGoNoGo: formalApproval.finalGoNoGo ?? "NO_GO"
  },
  residuals: buildResiduals(missingRequiredFiles),
  forbiddenInterpretations: [
    "CI success is not GO",
    "artifact exists is not GO",
    "candidate head acceptance is not formal generated compile authorization",
    "candidate evidence is not runtime consumption",
    "Evidence Root PASS is not releaseAuthority",
    "old CI #424 artifact completeness gaps remain historical facts"
  ]
};

fs.mkdirSync(path.dirname(path.join(root, outputPath)), { recursive: true });
fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
console.log(`Dormitory candidate artifact attestation package generated: ${outputPath}`);
console.log(`candidateHeadDecision=${attestation.candidateRefs.candidateHeadDecision}`);
console.log(`artifactCompletenessStatus=${artifactCompletenessStatus} missingRequiredFiles=${missingRequiredFiles.length}`);

function buildFileEntry(id, logicalPath) {
  if (artifactRoot) {
    const artifactPath = resolveArtifactPath(logicalPath);
    const full = path.join(artifactRoot, artifactPath);
    const present = fs.existsSync(full);
    return {
      id,
      logicalPath,
      artifactPath: artifactPath.replace(/\\/g, "/"),
      present,
      hash: present ? hashFile(full) : null
    };
  }
  const previous = previousRequiredFiles.get(logicalPath) ?? {};
  const present = !oldArtifactMissingRequiredFiles.includes(logicalPath);
  return {
    id,
    logicalPath,
    artifactPath: previous.artifactPath ?? defaultArtifactPath(logicalPath),
    present,
    hash: present ? previous.hash ?? null : null
  };
}

function resolveArtifactPath(logicalPath) {
  const candidates = logicalPath.startsWith("artifacts/oam/")
    ? [logicalPath.slice("artifacts/oam/".length), logicalPath]
    : [logicalPath];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(artifactRoot, candidate))) return candidate;
  }
  return candidates[0];
}

function defaultArtifactPath(logicalPath) {
  return logicalPath.startsWith("artifacts/oam/")
    ? logicalPath.slice("artifacts/oam/".length)
    : logicalPath;
}

function buildResiduals(missingFiles) {
  const residuals = [];
  if (missingFiles.length > 0) {
    residuals.push({
      severity: "P0",
      id: "CI_ARTIFACT_REQUIRED_FILES_MISSING",
      description: "The referenced artifact does not include every file required by the current candidate artifact attestation gate.",
      oldArtifactRunId,
      oldArtifactName,
      missingFiles
    });
  }
  if (oldArtifactMissingRequiredFiles.length > 0) {
    residuals.push({
      severity: "P0",
      id: "CI_424_ARTIFACT_REQUIRED_FILES_MISSING_HISTORICAL_FACT",
      description: "CI #424 is immutable and predates the newly required result/proof uploads.",
      oldArtifactRunId,
      oldArtifactName,
      missingFiles: oldArtifactMissingRequiredFiles
    });
  }
  return residuals;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function normalizeOptionalPath(value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function hashFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}
