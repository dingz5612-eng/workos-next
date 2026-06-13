import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = "docs/oam/evidence-attestation-packages/dormitory-golden-chain-2b7bc377.attestation.json";
const resultPath = "artifacts/oam/checks/dormitory-candidate-artifact-attestation-package-result.json";
const acceptedAuthorizedCandidateExecutionHead = "2b7bc3772c7351b34c5ca91258fe388371ab9f6c";
const previousAuthorizedCandidateExecutionHead = "9db58da1ebc2a02349436833747307ac78c4c2fd";
const candidateSourceRef = "fd60390e678f9d6934137f0480a183701b01de8f";
const oldArtifactRunId = "27466582674";
const oldArtifactName = "workosnext-current-oam-evidence-27466582674";
const oldArtifactDigest = "sha256:37f42a6376e2d9d4a6dd0a5c9425c9fb33a3038ebdbb48423d4c1e77a4e7413d";
const expectedOldMissingRequiredFiles = [
  "artifacts/oam/checks/generated-compile-authorization-result.json",
  "artifacts/oam/authority-cleanup/mutation-tests-result.json",
  "docs/oam/db-no-side-effects-proof.json",
  "artifacts/oam/checks/generated-files-not-manually-edited-result.json",
  "artifacts/oam/checks/generated-contract-consistency-result.json"
];
const expectedRequiredFiles = [
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/evidence/current-oam-release-evidence-object.json",
  "artifacts/oam/evidence/current-oam-release-attestation.json",
  "artifacts/oam/final-report.json",
  "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json",
  "artifacts/oam/checks/generated-compile-authorization-result.json",
  "artifacts/oam/authority-cleanup/mutation-tests-result.json",
  "docs/oam/db-no-side-effects-proof.json",
  "artifacts/oam/checks/generated-files-not-manually-edited-result.json",
  "artifacts/oam/checks/generated-contract-consistency-result.json",
  "artifacts/oam/checks/derived-contract-consistency-result.json",
  "artifacts/oam/checks/oam-kernel-graph-result.json",
  "artifacts/oam/checks/dashboard-readonly-report.json",
  "artifacts/oam/checks/finance-truth-report.json",
  "artifacts/oam/checks/operation-identity-boundary-result.json",
  "artifacts/oam/checks/current-oam-release-attestation-result.json"
];

const failures = [];
let attestation = null;

try {
  attestation = readJson(packagePath);
  validateAttestation(attestation);
} catch (error) {
  failures.push(`Unable to read or validate ${packagePath}: ${error.message}`);
}

writeResult();

if (failures.length > 0) {
  console.error("Dormitory candidate artifact attestation package check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory candidate artifact attestation package check: PASS");

function validateAttestation(document) {
  expectEqual(document.packageVersion, "oam.dormitory-candidate-artifact-attestation.v1", "packageVersion");
  expectIncludes(document.packageStatus, [
    "CANDIDATE_HEAD_ACCEPTED_BY_00_PENDING_NEW_ARTIFACT_NO_GO",
    "CANDIDATE_HEAD_ACCEPTED_BY_00_ARTIFACT_COMPLETE_NO_GO"
  ], "packageStatus");
  expectIncludes(document.reviewPackageStatus, [
    "VALID_WITH_P0_RESIDUALS_NO_GO",
    "VALID_CURRENT_CANDIDATE_HEAD_NO_GO"
  ], "reviewPackageStatus");
  expectEqual(document.acceptedAuthorizedCandidateExecutionHead, acceptedAuthorizedCandidateExecutionHead, "acceptedAuthorizedCandidateExecutionHead");
  expectEqual(document.candidateSourceRef, candidateSourceRef, "candidateSourceRef");
  expectEqual(document.previousAuthorizedCandidateExecutionHead, previousAuthorizedCandidateExecutionHead, "previousAuthorizedCandidateExecutionHead");

  expectEqual(document.reviewTarget?.branch, "codex/dormitory-source-p0-s2-closure", "reviewTarget.branch");
  expectEqual(document.reviewTarget?.reviewHead, acceptedAuthorizedCandidateExecutionHead, "reviewTarget.reviewHead");
  expectEqual(document.reviewTarget?.workflowName, "CI", "reviewTarget.workflowName");
  expectEqual(document.reviewTarget?.businessGo, "NO_GO", "reviewTarget.businessGo");

  expectEqual(document.candidateRefs?.candidateHeadDecision, "ACCEPTED_BY_00_FOR_CANDIDATE_EXECUTION_HEAD_ONLY", "candidateRefs.candidateHeadDecision");
  expectEqual(document.candidateRefs?.authorizedCandidateExecutionHead, acceptedAuthorizedCandidateExecutionHead, "candidateRefs.authorizedCandidateExecutionHead");
  expectEqual(document.candidateRefs?.executionHead, acceptedAuthorizedCandidateExecutionHead, "candidateRefs.executionHead");
  expectEqual(document.candidateRefs?.executionHeadCompatibilityAliasOf, "authorizedCandidateExecutionHead", "candidateRefs.executionHeadCompatibilityAliasOf");
  expectEqual(document.candidateRefs?.candidateSourceRef, candidateSourceRef, "candidateRefs.candidateSourceRef");
  expectEqual(document.candidateRefs?.previousAuthorizedCandidateExecutionHead, previousAuthorizedCandidateExecutionHead, "candidateRefs.previousAuthorizedCandidateExecutionHead");
  expectEqual(document.candidateRefs?.reviewHeadRelationToAuthorizedHead, "EQUALS_AUTHORIZED_CANDIDATE_EXECUTION_HEAD", "candidateRefs.reviewHeadRelationToAuthorizedHead");

  const requiredFiles = Array.isArray(document.requiredFiles) ? document.requiredFiles : [];
  const requiredLogicalPaths = requiredFiles.map((file) => file.logicalPath).sort();
  expectArrayEqual(requiredLogicalPaths, [...expectedRequiredFiles].sort(), "requiredFiles.logicalPath");
  const missingRequiredFiles = requiredFiles
    .filter((file) => file.present !== true)
    .map((file) => file.logicalPath)
    .sort();
  const declaredMissing = [...(document.artifactVerification?.missingRequiredFiles ?? [])].sort();
  expectArrayEqual(declaredMissing, missingRequiredFiles, "artifactVerification.missingRequiredFiles");
  expectEqual(document.artifactVerification?.requiredFileMissingCount, missingRequiredFiles.length, "artifactVerification.requiredFileMissingCount");
  expectEqual(
    document.artifactVerification?.artifactCompletenessStatus,
    missingRequiredFiles.length === 0 ? "PASS" : "BLOCKED_REQUIRED_FILES_MISSING",
    "artifactVerification.artifactCompletenessStatus"
  );
  expectEqual(
    document.artifactVerification?.requiredFileCompletenessStatus,
    document.artifactVerification?.artifactCompletenessStatus,
    "artifactVerification.requiredFileCompletenessStatus"
  );
  if (missingRequiredFiles.length > 0) {
    expectEqual(document.candidateRefs?.candidateCompileEvidenceStatus, "CURRENT_CANDIDATE_HEAD_PENDING_NEW_ARTIFACT", "candidateRefs.candidateCompileEvidenceStatus");
    expectEqual(document.candidateRefs?.candidateCompileClosureForCurrentHead, false, "candidateRefs.candidateCompileClosureForCurrentHead");
    expectEqual(document.recommendation, "RUN_NEW_CI_ARTIFACT_WITH_REQUIRED_FILES_BEFORE_FORMAL_GENERATED_COMPILE", "recommendation");
    expectEqual(document.nextDecisionFor00?.nextDecisionFor00, "STOP_AND_FIX_ARTIFACT_UPLOAD_OR_RESULT_WRITERS", "nextDecisionFor00.nextDecisionFor00");
    expectEqual(document.reviewPackageStatus, "VALID_WITH_P0_RESIDUALS_NO_GO", "reviewPackageStatus when files are missing");
  } else {
    expectEqual(document.artifactVerification?.artifactCompletenessStatus, "PASS", "artifactVerification.artifactCompletenessStatus");
    expectEqual(document.nextDecisionFor00?.nextDecisionFor00, "FORMAL_GENERATED_COMPILE_AUTHORIZATION_REVIEW", "nextDecisionFor00.nextDecisionFor00");
  }

  expectEqual(document.oldArtifactRunId, oldArtifactRunId, "oldArtifactRunId");
  expectEqual(document.oldArtifactName, oldArtifactName, "oldArtifactName");
  expectEqual(document.oldArtifactDigest, oldArtifactDigest, "oldArtifactDigest");
  expectEqual(document.oldArtifactCompletenessStatus, "BLOCKED_REQUIRED_FILES_MISSING", "oldArtifactCompletenessStatus");
  expectArrayEqual([...(document.oldArtifactMissingRequiredFiles ?? [])].sort(), [...expectedOldMissingRequiredFiles].sort(), "oldArtifactMissingRequiredFiles");
  expectEqual(document.artifactVerification?.oldArtifactRunId, oldArtifactRunId, "artifactVerification.oldArtifactRunId");
  expectEqual(document.artifactVerification?.oldArtifactCompletenessStatus, "BLOCKED_REQUIRED_FILES_MISSING", "artifactVerification.oldArtifactCompletenessStatus");
  expectArrayEqual([...(document.artifactVerification?.oldArtifactMissingRequiredFiles ?? [])].sort(), [...expectedOldMissingRequiredFiles].sort(), "artifactVerification.oldArtifactMissingRequiredFiles");

  expectEqual(document.goNoGo?.generatedCompileCandidateAuthorized, true, "goNoGo.generatedCompileCandidateAuthorized");
  expectEqual(document.goNoGo?.generatedCompileAuthorized, false, "goNoGo.generatedCompileAuthorized");
  expectEqual(document.goNoGo?.formalGeneratedCompileAuthorized, false, "goNoGo.formalGeneratedCompileAuthorized");
  expectEqual(document.goNoGo?.generatedCompileCompleted, false, "goNoGo.generatedCompileCompleted");
  expectEqual(document.goNoGo?.generatedCandidateAcceptedBy00, false, "goNoGo.generatedCandidateAcceptedBy00");
  expectEqual(document.goNoGo?.generatedReleaseAllowed, false, "goNoGo.generatedReleaseAllowed");
  expectEqual(document.goNoGo?.runtimeConsumptionReady, false, "goNoGo.runtimeConsumptionReady");
  expectEqual(document.goNoGo?.businessFeatureDevelopmentAllowed, false, "goNoGo.businessFeatureDevelopmentAllowed");
  expectEqual(document.goNoGo?.businessProductionGoNoGo, "NO_GO", "goNoGo.businessProductionGoNoGo");
  expectEqual(document.goNoGo?.dormitoryL2GoNoGo, "NO_GO", "goNoGo.dormitoryL2GoNoGo");
  expectEqual(document.goNoGo?.productionConfirmAllowed, false, "goNoGo.productionConfirmAllowed");
  expectEqual(document.goNoGo?.releaseAuthority, false, "goNoGo.releaseAuthority");
  expectEqual(document.goNoGo?.finalGoNoGo, "NO_GO", "goNoGo.finalGoNoGo");
  expectEqual(document.nextDecisionFor00?.candidateHeadDecision, "ACCEPTED_BY_00_FOR_CANDIDATE_EXECUTION_HEAD_ONLY", "nextDecisionFor00.candidateHeadDecision");

  if (document.artifactVerification?.artifactCompletenessStatus === "PASS" && missingRequiredFiles.length > 0) {
    failures.push("artifact completeness cannot be PASS when missingRequiredFiles is non-empty.");
  }
  failOnForbiddenEscapes(document);
}

function failOnForbiddenEscapes(document) {
  const serialized = JSON.stringify(document);
  if (/PENDING_00_DECISION/.test(serialized)) failures.push("candidateHeadDecision must not remain PENDING_00_DECISION.");
  if (/KEEP_STALE_REFERENCE/.test(serialized)) failures.push("package must not recommend KEEP_STALE_REFERENCE after 00 accepted the candidate head.");
  if (new RegExp(`"authorizedCandidateExecutionHead"\\s*:\\s*"${previousAuthorizedCandidateExecutionHead}"`).test(serialized)) {
    failures.push("package must not use the old 9db58da authorizedCandidateExecutionHead as current authority.");
  }
  if (/"formalGeneratedCompileAuthorized"\s*:\s*true|"generatedCompileAuthorized"\s*:\s*true/.test(serialized)) {
    failures.push("package must not claim formal generated compile authorization.");
  }
  if (/"runtimeConsumptionReady"\s*:\s*true/.test(serialized)) {
    failures.push("package must not claim runtime consumption readiness.");
  }
  if (/"releaseAuthority"\s*:\s*true/.test(serialized)) {
    failures.push("package must not claim releaseAuthority=true.");
  }
  if (/"finalGoNoGo"\s*:\s*"GO"/.test(serialized)) {
    failures.push("package must not claim finalGoNoGo=GO.");
  }
}

function writeResult() {
  const missingRequiredFiles = attestation?.artifactVerification?.missingRequiredFiles ?? [];
  const artifactCompletenessStatus = attestation?.artifactVerification?.artifactCompletenessStatus ??
    (missingRequiredFiles.length === 0 ? "PASS" : "BLOCKED_REQUIRED_FILES_MISSING");
  const result = {
    version: "oam.dormitory-candidate-artifact-attestation-package-result.v2",
    checkedAtUtc: new Date().toISOString(),
    checkerExecutionStatus: failures.length === 0 ? "PASS" : "FAIL",
    packageIntegrityStatus: failures.length === 0 ? "PASS" : "FAIL",
    artifactCompletenessStatus,
    goNoGoStatus: "NO_GO",
    reviewPackageStatus: attestation?.reviewPackageStatus ?? null,
    status: failures.length === 0 ? "PASS" : "FAIL",
    packagePath,
    candidateHeadDecision: attestation?.candidateRefs?.candidateHeadDecision ?? null,
    authorizedCandidateExecutionHead: attestation?.candidateRefs?.authorizedCandidateExecutionHead ?? null,
    acceptedAuthorizedCandidateExecutionHead,
    previousAuthorizedCandidateExecutionHead,
    candidateSourceRef,
    requiredFileMissingCount: missingRequiredFiles.length,
    missingRequiredFiles,
    oldArtifactRunId,
    oldArtifactName,
    oldArtifactDigest,
    oldArtifactCompletenessStatus: "BLOCKED_REQUIRED_FILES_MISSING",
    oldArtifactMissingRequiredFiles: expectedOldMissingRequiredFiles,
    recommendation: attestation?.recommendation ?? null,
    nextDecisionFor00: attestation?.nextDecisionFor00?.nextDecisionFor00 ?? null,
    generatedCompileCandidateAuthorized: attestation?.goNoGo?.generatedCompileCandidateAuthorized ?? null,
    generatedCompileAuthorized: attestation?.goNoGo?.generatedCompileAuthorized ?? null,
    generatedCompileCompleted: attestation?.goNoGo?.generatedCompileCompleted ?? null,
    generatedCandidateAcceptedBy00: attestation?.goNoGo?.generatedCandidateAcceptedBy00 ?? null,
    generatedReleaseAllowed: attestation?.goNoGo?.generatedReleaseAllowed ?? null,
    runtimeConsumptionReady: attestation?.goNoGo?.runtimeConsumptionReady ?? null,
    businessFeatureDevelopmentAllowed: attestation?.goNoGo?.businessFeatureDevelopmentAllowed ?? null,
    businessProductionGoNoGo: attestation?.goNoGo?.businessProductionGoNoGo ?? null,
    dormitoryL2GoNoGo: attestation?.goNoGo?.dormitoryL2GoNoGo ?? null,
    productionConfirmAllowed: attestation?.goNoGo?.productionConfirmAllowed ?? null,
    releaseAuthority: attestation?.goNoGo?.releaseAuthority ?? null,
    finalGoNoGo: attestation?.goNoGo?.finalGoNoGo ?? null,
    residuals: attestation?.residuals ?? [],
    failures
  };
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} expected ${format(expected)} but got ${format(actual)}`);
}

function expectIncludes(actual, allowed, label) {
  if (!Array.isArray(allowed) || !allowed.includes(actual)) {
    failures.push(`${label} must be one of ${format(allowed)} but got ${format(actual)}`);
  }
}

function expectArrayEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label} expected ${format(expected)} but got ${format(actual)}`);
  }
}

function format(value) {
  return JSON.stringify(value);
}
