import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  decisionWritebackBaseHead,
  decisionRecordHead,
  currentRepositoryHead,
  decisionStatus,
  root = process.cwd()
} = {}) {
  const failures = [];
  const warnings = [];
  const normalizedDecisionStatus = decisionStatus ?? "PENDING_00_DECISION";
  const effectiveDecisionRecordHead = isGitSha(decisionRecordHead)
    ? decisionRecordHead
    : currentRepositoryHead;

  if (normalizedDecisionStatus === "PENDING_00_DECISION" || normalizedDecisionStatus === "NOT_ACCEPTED_BY_00") {
    return {
      version: "oam.generated-candidate-decision-writeback-policy-result.v1",
      policy: GENERATED_CANDIDATE_DECISION_WRITEBACK_POLICY,
      status: normalizedDecisionStatus === "NOT_ACCEPTED_BY_00" ? "NOT_ACCEPTED_NO_ACCEPTANCE_RECORD" : "PENDING_NO_DECISION_RECORD",
      allowed: true,
      decisionWritebackRequired: false,
      reviewedExecutionHead: reviewedExecutionHead ?? null,
      decisionWritebackBaseHead: decisionWritebackBaseHead ?? null,
      decisionRecordHead: decisionRecordHead ?? null,
      effectiveDecisionRecordHead: null,
      currentRepositoryHead: currentRepositoryHead ?? null,
      diffBasis: null,
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
  if (!isGitSha(decisionWritebackBaseHead)) {
    failures.push("decisionWritebackBaseHead must be a concrete git SHA when decisionStatus=ACCEPTED_BY_00.");
  }
  if (!isGitSha(effectiveDecisionRecordHead)) {
    failures.push("effectiveDecisionRecordHead must be a concrete git SHA when decisionStatus=ACCEPTED_BY_00.");
  }
  const reviewedAncestry = ancestryState(reviewedExecutionHead, effectiveDecisionRecordHead, root);
  if (reviewedAncestry === "missing") {
    warnings.push("reviewedExecutionHead..effectiveDecisionRecordHead ancestry is reference-only because at least one historical git object is unavailable in the current checkout.");
  } else if (reviewedAncestry === "fail") {
    failures.push("effectiveDecisionRecordHead must equal or descend from reviewedExecutionHead.");
  }
  const writebackAncestry = ancestryState(decisionWritebackBaseHead, effectiveDecisionRecordHead, root);
  if (writebackAncestry === "missing") {
    warnings.push("decisionWritebackBaseHead..effectiveDecisionRecordHead ancestry is reference-only because at least one historical git object is unavailable in the current checkout.");
  } else if (writebackAncestry === "fail") {
    failures.push("effectiveDecisionRecordHead must equal or descend from decisionWritebackBaseHead.");
  }
  if (isGitSha(decisionRecordHead) && isGitSha(currentRepositoryHead) &&
    !isAncestor(decisionRecordHead, currentRepositoryHead, root)) {
    warnings.push("currentRepositoryHead is not a descendant of decisionRecordHead; treating current checkout as reference-only.");
  }

  const changedFiles = isGitSha(decisionWritebackBaseHead) && isGitSha(effectiveDecisionRecordHead) &&
    writebackAncestry !== "missing"
    ? diffNames(decisionWritebackBaseHead, effectiveDecisionRecordHead, root)
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
    decisionWritebackBaseHead: decisionWritebackBaseHead ?? null,
    decisionRecordHead: decisionRecordHead ?? null,
    effectiveDecisionRecordHead: effectiveDecisionRecordHead ?? null,
    currentRepositoryHead: currentRepositoryHead ?? null,
    diffBasis: "decisionWritebackBaseHead_to_effectiveDecisionRecordHead",
    allowedDecisionWritebackFiles: [...allowedDecisionWritebackFiles].sort(),
    changedFiles,
    forbiddenFiles,
    warnings,
    failures
  };
}

export function runDecisionWritebackPolicySelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workosnext-decision-writeback-policy-"));
  try {
    git(["init"], tempRoot);
    git(["config", "user.email", "oam-policy-self-test@example.invalid"], tempRoot);
    git(["config", "user.name", "OAM Policy Self-Test"], tempRoot);

    writeFixture(tempRoot, "docs/oam/generated-candidate-acceptance.current.json", { decisionStatus: "PENDING_00_DECISION" });
    writeFixture(tempRoot, "docs/contracts/generated/dormitory/field-bindings.generated.json", { version: 1 });
    git(["add", "."], tempRoot);
    git(["commit", "-m", "reviewed execution"], tempRoot);
    const reviewedExecutionHead = git(["rev-parse", "HEAD"], tempRoot);

    writeFixture(tempRoot, "docs/contracts/generated/dormitory/field-bindings.generated.json", { version: 2 });
    writeFixture(tempRoot, "src/dormitory-business.js", "export const businessChange = true;\n");
    git(["add", "."], tempRoot);
    git(["commit", "-m", "historical generated changes"], tempRoot);
    const decisionWritebackBaseHead = git(["rev-parse", "HEAD"], tempRoot);

    writeFixture(tempRoot, "docs/oam/generated-candidate-acceptance.current.json", { decisionStatus: "ACCEPTED_BY_00" });
    writeFixture(tempRoot, "artifacts/oam/final-report.json", { decisionStatus: "ACCEPTED_BY_00" });
    git(["add", "."], tempRoot);
    git(["commit", "-m", "allowed decision writeback"], tempRoot);
    const allowedDecisionRecordHead = git(["rev-parse", "HEAD"], tempRoot);

    const historicalChangesAllowed = evaluateDecisionWritebackPolicy({
      reviewedExecutionHead,
      decisionWritebackBaseHead,
      decisionRecordHead: allowedDecisionRecordHead,
      currentRepositoryHead: allowedDecisionRecordHead,
      decisionStatus: "ACCEPTED_BY_00",
      root: tempRoot
    });

    git(["checkout", "-B", "bad-writeback", decisionWritebackBaseHead], tempRoot);
    writeFixture(tempRoot, "docs/contracts/generated/dormitory/field-bindings.generated.json", { forbiddenDecisionWriteback: true });
    git(["add", "."], tempRoot);
    git(["commit", "-m", "forbidden decision writeback"], tempRoot);
    const forbiddenDecisionRecordHead = git(["rev-parse", "HEAD"], tempRoot);

    const forbiddenWritebackRejected = evaluateDecisionWritebackPolicy({
      reviewedExecutionHead,
      decisionWritebackBaseHead,
      decisionRecordHead: forbiddenDecisionRecordHead,
      currentRepositoryHead: forbiddenDecisionRecordHead,
      decisionStatus: "ACCEPTED_BY_00",
      root: tempRoot
    });

    const missingBaseRejected = evaluateDecisionWritebackPolicy({
      reviewedExecutionHead,
      decisionRecordHead: allowedDecisionRecordHead,
      currentRepositoryHead: allowedDecisionRecordHead,
      decisionStatus: "ACCEPTED_BY_00",
      root: tempRoot
    });
    const missingHistoricalRecordIsReferenceOnly = evaluateDecisionWritebackPolicy({
      reviewedExecutionHead,
      decisionWritebackBaseHead,
      decisionRecordHead: "9".repeat(40),
      currentRepositoryHead: allowedDecisionRecordHead,
      decisionStatus: "ACCEPTED_BY_00",
      root: tempRoot
    });

    const failures = [];
    if (historicalChangesAllowed.allowed !== true) {
      failures.push("historical reviewed..record changes must not fail when base..record contains only allowed files.");
    }
    if (historicalChangesAllowed.diffBasis !== "decisionWritebackBaseHead_to_effectiveDecisionRecordHead") {
      failures.push("policy must report decisionWritebackBaseHead_to_effectiveDecisionRecordHead diff basis.");
    }
    if (historicalChangesAllowed.changedFiles.some((file) => file === "src/dormitory-business.js")) {
      failures.push("policy must not diff reviewedExecutionHead..decisionRecordHead for accepted writeback.");
    }
    if (forbiddenWritebackRejected.allowed !== false ||
      !forbiddenWritebackRejected.forbiddenFiles.includes("docs/contracts/generated/dormitory/field-bindings.generated.json")) {
      failures.push("policy must reject forbidden files in decisionWritebackBaseHead..effectiveDecisionRecordHead.");
    }
    if (missingBaseRejected.allowed !== false ||
      !missingBaseRejected.failures.some((failure) => failure.includes("decisionWritebackBaseHead"))) {
      failures.push("policy must reject ACCEPTED_BY_00 without decisionWritebackBaseHead.");
    }
    if (missingHistoricalRecordIsReferenceOnly.allowed !== true ||
      !missingHistoricalRecordIsReferenceOnly.warnings.some((warning) => warning.includes("reference-only"))) {
      failures.push("policy must keep accepted historical decision records reference-only when the historical git object is unavailable.");
    }

    return {
      version: "oam.generated-candidate-decision-writeback-policy-self-test.v1",
      status: failures.length === 0 ? "PASS" : "FAIL",
      cases: {
        historicalChangesAllowed,
        forbiddenWritebackRejected,
        missingBaseRejected,
        missingHistoricalRecordIsReferenceOnly
      },
      failures
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
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

function ancestryState(ancestor, descendant, root = process.cwd()) {
  if (!isGitSha(ancestor) || !isGitSha(descendant)) return "unchecked";
  if (ancestor === descendant) return "pass";
  if (!gitObjectAvailable(ancestor, root) || !gitObjectAvailable(descendant, root)) return "missing";
  return isAncestor(ancestor, descendant, root) ? "pass" : "fail";
}

function gitObjectAvailable(sha, root = process.cwd()) {
  if (!isGitSha(sha)) return false;
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
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
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    })
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/\\/g, "/"))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function writeFixture(root, file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(args, root) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function format(value) {
  return JSON.stringify(value);
}
