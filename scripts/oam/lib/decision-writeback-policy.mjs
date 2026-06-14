import { execFileSync } from "node:child_process";

const shaPattern = /^[a-f0-9]{40}$/;

export const GENERATED_CANDIDATE_DECISION_WRITEBACK_POLICY =
  "generated_candidate_acceptance_decision_writeback_v1";

const allowedDecisionWritebackFiles = new Set([
  "docs/oam/generated-candidate-acceptance.current.json",
  "docs/oam/current-architecture.manifest.json",
  "docs/oam/oam-kernel-graph.json",
  "artifacts/oam/checks/generated-candidate-acceptance-result.json",
  "artifacts/oam/checks/current-architecture-manifest-result.json",
  "artifacts/oam/checks/current-oam-release-attestation-result.json",
  "artifacts/oam/checks/oam-kernel-graph-result.json",
  "artifacts/oam/checks/control-plane-gate-results.json",
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/evidence/current-oam-final-report.json",
  "artifacts/oam/evidence/current-oam-release-evidence-object.json",
  "artifacts/oam/evidence/current-oam-release-attestation.json",
  "artifacts/oam/evidence/current-oam-candidate-evidence-object.json",
  "artifacts/oam/evidence/current-oam-commit-attestation.json",
  "artifacts/oam/evidence/evidence-lifecycle-proof.json",
  "artifacts/oam/final-report.json"
]);

export function evaluateDecisionWritebackPolicy({
  reviewedExecutionHead,
  decisionRecordHead,
  currentRepositoryHead,
  decisionStatus,
  root = process.cwd()
} = {}) {
  const failures = [];
  const warnings = [];
  const normalizedDecisionStatus = decisionStatus ?? "PENDING_00_DECISION";

  if (normalizedDecisionStatus === "PENDING_00_DECISION" || normalizedDecisionStatus === "NOT_ACCEPTED_BY_00") {
    return {
      version: "oam.generated-candidate-decision-writeback-policy-result.v1",
      policy: GENERATED_CANDIDATE_DECISION_WRITEBACK_POLICY,
      status: normalizedDecisionStatus === "NOT_ACCEPTED_BY_00" ? "NOT_ACCEPTED_NO_ACCEPTANCE_RECORD" : "PENDING_NO_DECISION_RECORD",
      allowed: true,
      decisionWritebackRequired: false,
      reviewedExecutionHead: reviewedExecutionHead ?? null,
      decisionRecordHead: decisionRecordHead ?? null,
      currentRepositoryHead: currentRepositoryHead ?? null,
      allowedDecisionWritebackFiles: [...allowedDecisionWritebackFiles].sort(),
      changedFiles: [],
      forbiddenFiles: [],
      warnings,
      failures
    };
  }

  if (normalizedDecisionStatus !== "ACCEPTED_BY_00") {
    failures.push(`decisionStatus must be PENDING_00_DECISION, NOT_ACCEPTED_BY_00, or ACCEPTED_BY_00, actual ${format(normalizedDecisionStatus)}.`);
  }
  if (!isGitSha(reviewedExecutionHead)) {
    failures.push("reviewedExecutionHead must be a concrete git SHA.");
  }
  if (!isGitSha(decisionRecordHead)) {
    failures.push("decisionRecordHead must be a concrete git SHA when decisionStatus=ACCEPTED_BY_00.");
  }
  if (isGitSha(reviewedExecutionHead) && isGitSha(decisionRecordHead) &&
    !isAncestor(reviewedExecutionHead, decisionRecordHead, root)) {
    failures.push("decisionRecordHead must equal or descend from reviewedExecutionHead.");
  }
  if (isGitSha(decisionRecordHead) && isGitSha(currentRepositoryHead) &&
    !isAncestor(decisionRecordHead, currentRepositoryHead, root)) {
    warnings.push("currentRepositoryHead is not a descendant of decisionRecordHead; treating current checkout as reference-only.");
  }

  const changedFiles = isGitSha(reviewedExecutionHead) && isGitSha(decisionRecordHead)
    ? diffNames(reviewedExecutionHead, decisionRecordHead, root)
    : [];
  const forbiddenFiles = changedFiles.filter((file) => !isAllowedDecisionWritebackFile(file));
  if (forbiddenFiles.length > 0) {
    failures.push(`decision writeback changed forbidden files: ${forbiddenFiles.join(", ")}.`);
  }

  return {
    version: "oam.generated-candidate-decision-writeback-policy-result.v1",
    policy: GENERATED_CANDIDATE_DECISION_WRITEBACK_POLICY,
    status: failures.length === 0 ? "PASS" : "NO_GO",
    allowed: failures.length === 0,
    decisionWritebackRequired: true,
    reviewedExecutionHead: reviewedExecutionHead ?? null,
    decisionRecordHead: decisionRecordHead ?? null,
    currentRepositoryHead: currentRepositoryHead ?? null,
    allowedDecisionWritebackFiles: [...allowedDecisionWritebackFiles].sort(),
    changedFiles,
    forbiddenFiles,
    warnings,
    failures
  };
}

export function isAllowedDecisionWritebackFile(file) {
  const normalized = String(file ?? "").replace(/\\/g, "/");
  return allowedDecisionWritebackFiles.has(normalized);
}

export function isGitSha(value) {
  return shaPattern.test(String(value ?? ""));
}

export function isAncestor(ancestor, descendant, root = process.cwd()) {
  if (!isGitSha(ancestor) || !isGitSha(descendant)) return false;
  if (ancestor === descendant) return true;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function diffNames(from, to, root) {
  try {
    return execFileSync("git", ["diff", "--name-only", `${from}..${to}`], {
      cwd: root,
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/\\/g, "/"))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function format(value) {
  return JSON.stringify(value);
}
