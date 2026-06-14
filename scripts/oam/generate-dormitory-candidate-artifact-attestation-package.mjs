import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  formalApprovalStateForPackage,
  validateFormalGeneratedCompileAuthorization
} from "./lib/formal-generated-compile-authorization.mjs";

const root = process.cwd();
const outputPath = "docs/oam/evidence-attestation-packages/dormitory-golden-chain-2b7bc377.attestation.json";
const candidateApprovalPath = "docs/oam/generated-compile-candidate-approval.current.json";
const formalApprovalPath = "docs/oam/generated-compile-approval.current.json";
const generatedCompileExecutionSnapshotPath = "artifacts/oam/checks/generated-compile-execution-input-snapshot.json";
const generatedCompileExecutionResultPath = "artifacts/oam/checks/generated-compile-execution-result.json";
const generatedCompileExecutionProofPath = "artifacts/oam/evidence/generated-compile-execution-proof.json";
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
  ["generatedCompileExecutionSnapshot", generatedCompileExecutionSnapshotPath],
  ["generatedCompileExecutionResult", generatedCompileExecutionResultPath],
  ["generatedCompileExecutionProof", generatedCompileExecutionProofPath],
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
const currentHead = runGit(["rev-parse", "HEAD"]);
const formalAuthorization = validateFormalGeneratedCompileAuthorization({
  approval: formalApproval,
  candidateApproval,
  currentHead,
  approvalPath: formalApprovalPath,
  candidateApprovalPath
});
const formalGeneratedCompileAuthorized = formalAuthorization.authorized;
const generatedCompileExecutionResult = readJsonIfExists(generatedCompileExecutionResultPath) ?? {};
const generatedCompileExecutionProof = readJsonIfExists(generatedCompileExecutionProofPath) ?? {};
const generatedCompileExecutionCompleted = formalGeneratedCompileAuthorized &&
  generatedCompileExecutionResult.status === "PASS" &&
  generatedCompileExecutionProof.status === "PASS" &&
  generatedCompileExecutionResult.generatedCompileCompleted === true &&
  generatedCompileExecutionResult.generatedCompilationCompleted === true &&
  generatedCompileExecutionProof.generatedCompileCompleted === true &&
  generatedCompileExecutionProof.generatedCompilationCompleted === true &&
  generatedCompileExecutionResult.generatedCandidateAcceptedBy00 === false &&
  generatedCompileExecutionResult.runtimeConsumptionReady === false &&
  generatedCompileExecutionResult.businessFeatureDevelopmentAllowed === false &&
  generatedCompileExecutionResult.releaseAuthority === false &&
  generatedCompileExecutionResult.finalGoNoGo === "NO_GO" &&
  generatedCompileExecutionProof.generatedCandidateAcceptedBy00 === false &&
  generatedCompileExecutionProof.runtimeConsumptionReady === false &&
  generatedCompileExecutionProof.businessFeatureDevelopmentAllowed === false &&
  generatedCompileExecutionProof.releaseAuthority === false &&
  generatedCompileExecutionProof.finalGoNoGo === "NO_GO";
const finalReport = readJsonIfExists("artifacts/oam/final-report.json") ?? {};
const releaseObject = readJsonIfExists("artifacts/oam/evidence/current-oam-release-evidence-object.json") ?? {};
const graph = readJsonIfExists("artifacts/oam/evidence/evidence-graph.json") ?? {};
const previousPackage = readJsonIfExists(outputPath) ?? {};
const previousRequiredFiles = new Map((previousPackage.requiredFiles ?? []).map((file) => [file.logicalPath, file]));

const artifactRoot = normalizeOptionalPath(process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_ROOT ?? "");
const artifactRunId = process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_RUN_ID || oldArtifactRunId;
const artifactName = process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_NAME || oldArtifactName;
const observedGitHubArtifactDigest = process.env.WORKOS_DORMITORY_ATTESTATION_ARTIFACT_DIGEST || oldArtifactDigest;
const artifactMode = artifactRoot ? "provided_artifact_root" : "local_evidence_root_with_historical_old_artifact_reference";
const fileEntries = requiredFiles.map(([id, logicalPath]) => buildFileEntry(id, logicalPath));
const missingRequiredFiles = fileEntries.filter((file) => file.present !== true).map((file) => file.logicalPath);
const artifactCompletenessStatus = missingRequiredFiles.length === 0 ? "PASS" : "BLOCKED_REQUIRED_FILES_MISSING";
const reviewPackageStatus = artifactCompletenessStatus === "PASS"
  ? "VALID_CURRENT_CANDIDATE_HEAD_NO_GO"
  : "VALID_WITH_P0_RESIDUALS_NO_GO";
const candidateCompileEvidenceStatus = generatedCompileExecutionCompleted
  ? "FORMAL_GENERATED_COMPILE_EXECUTED_PENDING_00_GENERATED_CANDIDATE_ACCEPTANCE"
  : formalGeneratedCompileAuthorized
  ? "FORMAL_GENERATED_COMPILE_AUTHORIZATION_APPROVED_PENDING_GENERATED_COMPILE_GATES"
  : artifactCompletenessStatus === "PASS"
    ? "CURRENT_CANDIDATE_HEAD_ARTIFACT_COMPLETE_PENDING_00_FORMAL_GENERATED_COMPILE_REVIEW"
    : "CURRENT_CANDIDATE_HEAD_PENDING_NEW_ARTIFACT";
const recommendation = generatedCompileExecutionCompleted
  ? "SUBMIT_TO_00_FOR_GENERATED_CANDIDATE_ACCEPTANCE_REVIEW_NO_RUNTIME_NO_GO"
  : formalGeneratedCompileAuthorized
  ? "RUN_FORMAL_GENERATED_COMPILE_GATES_NO_RUNTIME_NO_GO"
  : artifactCompletenessStatus === "PASS"
    ? "SUBMIT_TO_00_FOR_FORMAL_GENERATED_COMPILE_AUTHORIZATION_REVIEW"
    : "RUN_NEW_CI_ARTIFACT_WITH_REQUIRED_FILES_BEFORE_FORMAL_GENERATED_COMPILE";
const nextDecisionFor00 = generatedCompileExecutionCompleted
  ? "GENERATED_CANDIDATE_ACCEPTANCE_REVIEW"
  : formalGeneratedCompileAuthorized
  ? "GENERATED_CANDIDATE_ACCEPTANCE_REVIEW_AFTER_FORMAL_GENERATED_COMPILE_GATES"
  : artifactCompletenessStatus === "PASS"
    ? "FORMAL_GENERATED_COMPILE_AUTHORIZATION_REVIEW"
    : "STOP_AND_FIX_ARTIFACT_UPLOAD_OR_RESULT_WRITERS";

const attestation = {
  packageVersion: "oam.dormitory-candidate-artifact-attestation.v1",
  packageStatus: generatedCompileExecutionCompleted
    ? "READY_FOR_00_GENERATED_CANDIDATE_ACCEPTANCE_REVIEW_NO_GO"
    : formalGeneratedCompileAuthorized
    ? "FORMAL_GENERATED_COMPILE_AUTHORIZED_NO_GO"
    : artifactCompletenessStatus === "PASS"
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
    formalGeneratedCompileExecutionHead: currentHead,
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
    unpackedForLocalReview: Boolean(artifactRoot),
    localUnpackPathIsAuthority: false,
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
  generatedCompileExecution: {
    status: generatedCompileExecutionCompleted ? "PASS" : "NO_GO",
    resultPath: generatedCompileExecutionResultPath,
    proofPath: generatedCompileExecutionProofPath,
    snapshotPath: generatedCompileExecutionSnapshotPath,
    resultDigest: fileExists(generatedCompileExecutionResultPath) ? hashFile(path.join(root, generatedCompileExecutionResultPath)) : null,
    proofDigest: fileExists(generatedCompileExecutionProofPath) ? hashFile(path.join(root, generatedCompileExecutionProofPath)) : null,
    snapshotDigest: fileExists(generatedCompileExecutionSnapshotPath) ? hashFile(path.join(root, generatedCompileExecutionSnapshotPath)) : null,
    generatedOutputDigest: generatedCompileExecutionResult.generatedOutputDigest ?? null,
    manifestDigest: generatedCompileExecutionResult.manifestDigest ?? null,
    generatedKernelGraphDigest: generatedCompileExecutionResult.generatedKernelGraphDigest ?? null,
    reproducibility: generatedCompileExecutionResult.reproducibility ?? null,
    noManualEditProof: generatedCompileExecutionResult.noManualEditProof ?? null,
    consistencyProof: generatedCompileExecutionResult.consistencyProof ?? null,
    driftProof: generatedCompileExecutionResult.driftProof ?? null,
    generatedCompileAuthorized: formalGeneratedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorized,
    generatedCompileCompleted: generatedCompileExecutionCompleted,
    generatedCompilationCompleted: generatedCompileExecutionCompleted,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    nextDecisionFor00: generatedCompileExecutionCompleted
      ? "GENERATED_CANDIDATE_ACCEPTANCE_REVIEW"
      : "FORMAL_GENERATED_COMPILE_EXECUTION"
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
    formalGeneratedCompileAuthorization: formalGeneratedCompileAuthorized ? "PASS" : "BLOCKED",
    generatedCompileExecution: generatedCompileExecutionCompleted ? "PASS" : "BLOCKED",
    runtimeConsumption: "BLOCKED",
    businessProduction: "NO_GO",
    dormitoryL2: "NO_GO"
  },
  goNoGo: {
    generatedCompileCandidateAuthorized: true,
    generatedCompileAuthorized: formalGeneratedCompileAuthorized,
    formalGeneratedCompileAuthorized: formalGeneratedCompileAuthorized,
    generatedCompileCompleted: generatedCompileExecutionCompleted,
    generatedCompilationCompleted: generatedCompileExecutionCompleted,
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
      formalGeneratedCompileAuthorized
        ? generatedCompileExecutionCompleted
          ? "Formal generated compile execution is complete and reproducible; generated candidate acceptance, runtime consumption, release authority, Business GO, Dormitory L2, and production_confirm remain blocked pending 00 generated candidate acceptance review."
          : "00 approved formal generated compile authorization; generated candidate acceptance, runtime consumption, release authority, Business GO, Dormitory L2, and production_confirm remain blocked."
        : "Formal generated compile authorization, runtime consumption, release authority, Business GO, Dormitory L2, and production_confirm remain blocked."
    ]
  },
  formalApprovalState: {
    ...formalApprovalStateForPackage(
      formalApproval,
      formalAuthorization,
      fileExists(formalApprovalPath) ? hashFile(path.join(root, formalApprovalPath)) : null
    ),
    currentRepositoryHead: currentHead
  },
  residuals: buildResiduals(missingRequiredFiles),
  forbiddenInterpretations: [
    "CI success is not GO",
    "artifact exists is not GO",
    "formal generated compile authorization is not generated candidate acceptance",
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
  const localPath = path.join(root, logicalPath);
  const present = fs.existsSync(localPath);
  return {
    id,
    logicalPath,
    artifactPath: previous.artifactPath ?? defaultArtifactPath(logicalPath),
    present,
    hash: present ? hashFile(localPath) : null,
    historicalOldArtifactMissing: oldArtifactMissingRequiredFiles.includes(logicalPath)
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

function fileExists(file) {
  return fs.existsSync(path.join(root, file));
}

function runGit(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
