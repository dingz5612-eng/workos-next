import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/current-head-authoritative-artifact-reconciliation-result.json";
const requiredArtifactFiles = [
  "docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json",
  "docs/oam/generated-candidate-acceptance.current.json",
  "docs/oam/dormitory-runtime-admission.current.json",
  "docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json",
  "artifacts/oam/checks/generated-bundle-content-addressed-result.json",
  "artifacts/oam/checks/runtime-consumes-accepted-bundle-result.json",
  "artifacts/oam/checks/environment-profile-authority-result.json",
  "artifacts/oam/checks/capability-state-machine-transition-result.json",
  "artifacts/oam/checks/control-plane-lane-boundary-result.json",
  "artifacts/oam/checks/gate-taxonomy-result.json",
  "artifacts/oam/checks/runtime-stability-lane-result.json",
  "artifacts/oam/checks/runtime-implementation-drift-policy-result.json",
  "artifacts/oam/checks/evidence-is-projection-only-result.json",
  "artifacts/oam/checks/release-authority-is-only-final-go-source-result.json",
  "artifacts/oam/evidence/dormitory-runtime-test-only-consumption-proof.json"
];

const currentHead = git(["rev-parse", "HEAD"]) || "unknown";
const branch = git(["branch", "--show-current"]) || "unknown";
const workspaceDirty = git(["status", "--porcelain"]).trim().length > 0;
const githubActions = process.env.GITHUB_ACTIONS === "true";
const envHead = process.env.GITHUB_SHA || null;
const artifactDigest = process.env.WORKOS_GITHUB_ARTIFACT_METADATA_DIGEST ||
  process.env.GITHUB_ARTIFACT_METADATA_DIGEST ||
  null;
const artifactHeadMatchesCurrentHead = githubActions && envHead === currentHead;
const authoritativeArtifactBacked = Boolean(githubActions && artifactHeadMatchesCurrentHead && artifactDigest);
const requiredFilesExistLocally = requiredArtifactFiles.filter((file) => fs.existsSync(path.join(root, file)));
const missingLocalRequiredFiles = requiredArtifactFiles.filter((file) => !fs.existsSync(path.join(root, file)));
const reconciliationStatus = authoritativeArtifactBacked
  ? "AUTHORITATIVE_ARTIFACT_BACKED_FOR_CURRENT_HEAD"
  : "NO_AUTHORITATIVE_ARTIFACT_FOR_CURRENT_HEAD";

const failures = [];
if (authoritativeArtifactBacked && missingLocalRequiredFiles.length > 0) {
  failures.push(`authoritative artifact mode requires required files to exist locally before upload: ${missingLocalRequiredFiles.join(", ")}.`);
}
if (authoritativeArtifactBacked && workspaceDirty) {
  failures.push("authoritative artifact-backed PASS requires clean workspace at generation.");
}

const result = {
  version: "oam.current-head-authoritative-artifact-reconciliation-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  reconciliationStatus,
  currentHead,
  branch,
  githubActions,
  ciRunId: process.env.GITHUB_RUN_ID ?? null,
  artifactHeadSha: envHead,
  artifactHeadMatchesCurrentHead,
  artifactDigest,
  authoritativeArtifactBacked,
  requiredArtifactFiles,
  requiredFilesExistLocally,
  missingLocalRequiredFiles,
  localEvidencePassIsNotCiEvidencePass: !authoritativeArtifactBacked,
  localDigestAndArtifactDigestSemanticsSeparated: true,
  releaseReady: false,
  productionReady: false,
  finalGoNoGo: "NO_GO",
  releaseAuthority: false,
  blockers: authoritativeArtifactBacked
    ? []
    : [
        "current_head_authoritative_ci_artifact_not_confirmed",
        "local_evidence_pass_is_not_authoritative_artifact_backed_pass"
      ],
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Current-head authoritative artifact reconciliation check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Current-head authoritative artifact reconciliation check: PASS (${reconciliationStatus}, authoritativeArtifactBacked=${authoritativeArtifactBacked})`
);

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}
