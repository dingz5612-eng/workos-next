const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

export const FORMAL_GENERATED_COMPILE_APPROVAL_PATH = "docs/oam/generated-compile-approval.current.json";
export const GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH = "docs/oam/generated-compile-candidate-approval.current.json";

export function validateFormalGeneratedCompileAuthorization({
  approval,
  candidateApproval,
  currentHead,
  approvalPath = FORMAL_GENERATED_COMPILE_APPROVAL_PATH,
  candidateApprovalPath = GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH
} = {}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const candidateSourceRef = candidateApproval?.candidateSourceRef ?? candidateApproval?.authorizedSourceRef ?? null;
  const authorizedCandidateExecutionHead = candidateApproval?.authorizedCandidateExecutionHead ?? candidateApproval?.executionHead ?? null;

  if (!approval || typeof approval !== "object") {
    fail(`${approvalPath} is missing or invalid.`);
  } else {
    requireEqual(approval.version, "oam.generated-compile-approval.v1", `${approvalPath}.version`, fail);
    requireEqual(approval.approvalStatus, "approved_00_formal_generated_compile_authorization", `${approvalPath}.approvalStatus`, fail);
    requireEqual(approval.approvalDecision, "FORMAL_GENERATED_COMPILE_AUTHORIZATION_REVIEW_APPROVED", `${approvalPath}.approvalDecision`, fail);
    requireEqual(approval.approvalScope, "formal_generated_compile_authorization_only", `${approvalPath}.approvalScope`, fail);

    if (!isGitSha(approval.currentHEAD)) fail(`${approvalPath}.currentHEAD must be a concrete 40-char git SHA.`);
    if (!isGitSha(approval.reviewedRef)) fail(`${approvalPath}.reviewedRef must be a concrete 40-char git SHA.`);
    if (approval.currentHEAD !== approval.reviewedRef) {
      fail(`${approvalPath}.currentHEAD must exactly equal reviewedRef.`);
    }
    if (!isGitSha(currentHead)) {
      fail(`current HEAD must be a concrete 40-char git SHA for formal generated compile authorization.`);
    } else if (approval.currentHEAD !== currentHead || approval.reviewedRef !== currentHead) {
      fail(`${approvalPath} is stale for current HEAD: approval currentHEAD/reviewedRef=${approval.currentHEAD ?? "missing"}/${approval.reviewedRef ?? "missing"}, currentHead=${currentHead}.`);
    }

    requireEqual(approval.generatedCompileAuthorized, true, `${approvalPath}.generatedCompileAuthorized`, fail);
    requireEqual(approval.generatedCompilationAllowed, true, `${approvalPath}.generatedCompilationAllowed`, fail);
    requireEqual(approval.generatedCompileCompleted, false, `${approvalPath}.generatedCompileCompleted`, fail);
    requireEqual(approval.generatedCompilationCompleted, false, `${approvalPath}.generatedCompilationCompleted`, fail);
    requireEqual(approval.candidateArtifactEvidenceCompleted, true, `${approvalPath}.candidateArtifactEvidenceCompleted`, fail);
    requireEqual(approval.candidateArtifactEvidenceCompletionStatus, "true_as_candidate_artifact_evidence_only", `${approvalPath}.candidateArtifactEvidenceCompletionStatus`, fail);
    requireEqual(approval.generatedCandidateAcceptedBy00, false, `${approvalPath}.generatedCandidateAcceptedBy00`, fail);
    requireEqual(approval.runtimeConsumptionReady, false, `${approvalPath}.runtimeConsumptionReady`, fail);
    requireEqual(approval.businessFeatureDevelopmentAllowed, false, `${approvalPath}.businessFeatureDevelopmentAllowed`, fail);
    requireEqual(approval.productionConfirmAllowed, false, `${approvalPath}.productionConfirmAllowed`, fail);
    requireEqual(approval.releaseAuthority, false, `${approvalPath}.releaseAuthority`, fail);
    requireEqual(approval.finalGoNoGo, "NO_GO", `${approvalPath}.finalGoNoGo`, fail);

    if (candidateSourceRef && approval.candidateSourceRef !== candidateSourceRef) {
      fail(`${approvalPath}.candidateSourceRef must exactly match ${candidateApprovalPath}.candidateSourceRef.`);
    } else if (!candidateSourceRef && !isGitSha(approval.candidateSourceRef)) {
      fail(`${approvalPath}.candidateSourceRef must be present when no candidate approval is supplied.`);
    }

    if (authorizedCandidateExecutionHead && approval.authorizedCandidateExecutionHead !== authorizedCandidateExecutionHead) {
      fail(`${approvalPath}.authorizedCandidateExecutionHead must exactly match ${candidateApprovalPath}.authorizedCandidateExecutionHead.`);
    } else if (!authorizedCandidateExecutionHead && !isGitSha(approval.authorizedCandidateExecutionHead)) {
      fail(`${approvalPath}.authorizedCandidateExecutionHead must be present when no candidate approval is supplied.`);
    }

    if (!digestPattern.test(String(approval.candidateArtifactGithubDigest ?? ""))) {
      fail(`${approvalPath}.candidateArtifactGithubDigest must be a sha256 digest.`);
    }
    if (!digestPattern.test(String(approval.candidateArtifactInternalReleaseEvidenceDigest ?? ""))) {
      fail(`${approvalPath}.candidateArtifactInternalReleaseEvidenceDigest must be a sha256 digest.`);
    }
    if (approval.candidateArtifactGithubDigest === approval.candidateArtifactInternalReleaseEvidenceDigest) {
      fail(`${approvalPath} must distinguish GitHub artifact digest from internal release evidence artifactDigest.`);
    }
    if (!String(approval.artifactDigestDistinction ?? "").includes("GitHub artifact digest differs from internal release evidence artifactDigest")) {
      fail(`${approvalPath}.artifactDigestDistinction must document GitHub artifact digest != internal release evidence artifactDigest.`);
    }
  }

  const authorized = failures.length === 0;
  return {
    version: "oam.formal-generated-compile-authorization-predicate.v1",
    authorized,
    status: authorized ? "PASS" : "NO_GO",
    headBindingStatus: authorized ? "EXACT_CURRENT_HEAD" : "STALE_OR_INVALID_FORMAL_AUTHORIZATION",
    currentHead: currentHead ?? null,
    approvalCurrentHEAD: approval?.currentHEAD ?? null,
    approvalReviewedRef: approval?.reviewedRef ?? null,
    candidateSourceRef: approval?.candidateSourceRef ?? candidateSourceRef ?? null,
    authorizedCandidateExecutionHead: approval?.authorizedCandidateExecutionHead ?? authorizedCandidateExecutionHead ?? null,
    generatedCompileAuthorized: authorized,
    generatedCompilationAllowed: authorized,
    generatedCompilationReadiness: authorized
      ? "AUTHORIZED_PENDING_GENERATED_COMPILE_EXECUTION"
      : "NOT_STARTED_OR_NOT_AUTHORIZED",
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    failures
  };
}

export function formalApprovalStateForPackage(approval, predicate, approvalObjectHash = null) {
  return {
    version: approval?.version ?? "missing",
    approvalStatus: approval?.approvalStatus ?? "missing",
    approvalDecision: approval?.approvalDecision ?? "missing",
    approvalScope: approval?.approvalScope ?? "missing",
    currentHEAD: approval?.currentHEAD ?? "missing",
    reviewedRef: approval?.reviewedRef ?? "missing",
    candidateSourceRef: approval?.candidateSourceRef ?? "missing",
    authorizedCandidateExecutionHead: approval?.authorizedCandidateExecutionHead ?? "missing",
    candidateArtifactRunId: approval?.candidateArtifactRunId ?? "missing",
    candidateArtifactName: approval?.candidateArtifactName ?? "missing",
    candidateArtifactGithubDigest: approval?.candidateArtifactGithubDigest ?? "missing",
    candidateArtifactInternalReleaseEvidenceDigest: approval?.candidateArtifactInternalReleaseEvidenceDigest ?? "missing",
    artifactDigestDistinction: approval?.artifactDigestDistinction ?? "",
    generatedCompileAuthorized: approval?.generatedCompileAuthorized ?? false,
    generatedCompilationAllowed: approval?.generatedCompilationAllowed ?? false,
    generatedCompileCompleted: approval?.generatedCompileCompleted ?? false,
    generatedCompilationCompleted: approval?.generatedCompilationCompleted ?? false,
    candidateArtifactEvidenceCompleted: approval?.candidateArtifactEvidenceCompleted ?? false,
    candidateArtifactEvidenceCompletionStatus: approval?.candidateArtifactEvidenceCompletionStatus ?? "missing",
    generatedCandidateAcceptedBy00: approval?.generatedCandidateAcceptedBy00 ?? false,
    generatedReleaseAllowed: approval?.generatedReleaseAllowed ?? false,
    runtimeConsumptionReady: approval?.runtimeConsumptionReady ?? false,
    businessFeatureDevelopmentAllowed: approval?.businessFeatureDevelopmentAllowed ?? false,
    productionConfirmAllowed: approval?.productionConfirmAllowed ?? false,
    releaseAuthority: approval?.releaseAuthority ?? false,
    finalGoNoGo: approval?.finalGoNoGo ?? "NO_GO",
    predicateVersion: predicate?.version ?? "missing",
    predicateStatus: predicate?.status ?? "NO_GO",
    predicateHeadBindingStatus: predicate?.headBindingStatus ?? "STALE_OR_INVALID_FORMAL_AUTHORIZATION",
    predicateAuthorized: predicate?.authorized === true,
    predicateFailures: predicate?.failures ?? [],
    approvalObjectHash
  };
}

export function isGitSha(value) {
  return shaPattern.test(String(value ?? ""));
}

function requireEqual(actual, expected, label, fail) {
  if (actual !== expected) fail(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function format(value) {
  return JSON.stringify(value);
}
