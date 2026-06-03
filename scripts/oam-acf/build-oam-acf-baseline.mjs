import {
  currentBranch,
  fileHash,
  git,
  readJson,
  repository,
  repositoryHead,
  writeJson
} from "../oam/clean-baseline-lib.mjs";

const outputPath = "artifacts/oam-acf/phase-0/oam-acf-baseline.json";
const currentState = readJson("artifacts/release-state/current-state.json");
const attestation = readJson("artifacts/release-state/post-merge-attestation.json");
const artifactBinding = readJson("artifacts/release-state/artifact-git-binding-result.json");
const actualHeadSha = repositoryHead();
const generatedAtUtc = new Date().toISOString();

const noGoItems = uniqueStrings([
  ...(currentState.noGoItems || []),
  ...(attestation.noGoItems || []),
  ...(artifactBinding.noGoItems || [])
]);

const baseline = {
  version: "oam-acf.attestation-bundle.v1",
  generatedAtUtc,
  generatedBy: "build-oam-acf-baseline",
  repository,
  branch: currentBranch() || currentState.currentMain?.branch || "main",
  actualHeadSha,
  currentStateHeadSha: currentState.currentMain?.headSha || null,
  pr78MergeSha: mergeShaForPr(78),
  pr79MergeSha: mergeShaForPr(79),
  subjectCommit: actualHeadSha,
  evidenceCommit: currentState.currentMain?.ci?.headSha || null,
  attestationCommit: attestation.verifiedMainHead || attestation.repositoryHead || null,
  artifactGitBindingCommit: artifactBinding.verifiedMainHead || artifactBinding.repositoryHead || null,
  ci: currentState.currentMain?.ci || null,
  v54ControlPlaneGuards: currentState.currentMain?.v54ControlPlaneGuards || null,
  releaseStates: {
    dormitory: currentState.authoritativeState?.dormitory || null,
    dormitoryL2: currentState.authoritativeState?.dormitoryL2 || null,
    businessProduction: currentState.authoritativeState?.businessProduction || null,
    repair: currentState.authoritativeState?.repair || null,
    parts: currentState.authoritativeState?.parts || null,
    hr: currentState.authoritativeState?.hr || null
  },
  controls: {
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProductionAllowed: false,
    repairPartsHrProductionAllowed: false
  },
  noGoItems,
  evidenceRefs: [
    "docs/engineering/00-rule-authority.md",
    "docs/rules/v5.5/rule-authority.yml",
    "docs/acceptance/13-v5.5-rules-os-go-no-go.md",
    "docs/rules/v5.5/api-boundary.yml",
    "docs/rules/v5.5/fact-ownership.yml",
    "docs/rules/v5.5/fact-write-map.yml",
    "artifacts/release-state/current-state.json",
    "artifacts/release-state/post-merge-attestation.json",
    "artifacts/release-state/artifact-git-binding-result.json"
  ],
  evidenceHashes: {
    currentState: fileHash("artifacts/release-state/current-state.json"),
    postMergeAttestation: fileHash("artifacts/release-state/post-merge-attestation.json"),
    artifactGitBinding: fileHash("artifacts/release-state/artifact-git-binding-result.json")
  }
};

validateBaseline(baseline);
writeJson(outputPath, baseline);
console.log(`OAM-ACF baseline built for ${actualHeadSha}: ${outputPath}`);

function mergeShaForPr(prNumber) {
  const sha = git(["log", "--all", "--grep", `(#${prNumber})`, "--format=%H", "-n", "1"]).trim();
  if (!isSha(sha)) throw new Error(`Cannot resolve merge SHA for PR #${prNumber}.`);
  return sha;
}

function validateBaseline(value) {
  const failures = [];
  for (const key of [
    "actualHeadSha",
    "currentStateHeadSha",
    "pr78MergeSha",
    "pr79MergeSha",
    "subjectCommit",
    "evidenceCommit",
    "attestationCommit",
    "artifactGitBindingCommit"
  ]) {
    if (!isSha(value[key])) failures.push(`${key} must be a 40-char sha.`);
  }
  if (value.repository !== "dingz5612-eng/workos-next") failures.push("repository mismatch.");
  if (value.branch !== "main") failures.push("branch must be main for Phase 0 baseline.");
  if (value.actualHeadSha !== value.currentStateHeadSha) failures.push("currentStateHeadSha must match actualHeadSha.");
  if (value.actualHeadSha !== value.evidenceCommit) failures.push("evidenceCommit must match actualHeadSha.");
  if (value.actualHeadSha !== value.attestationCommit) failures.push("attestationCommit must match actualHeadSha.");
  if (value.actualHeadSha !== value.artifactGitBindingCommit) failures.push("artifactGitBindingCommit must match actualHeadSha.");
  if (value.releaseStates.dormitoryL2 !== "BLOCKED") failures.push("Dormitory L2 must remain BLOCKED.");
  if (value.releaseStates.businessProduction !== "BLOCKED") failures.push("Business Production must remain BLOCKED.");
  for (const key of ["repair", "parts", "hr"]) {
    if (value.releaseStates[key] !== "L0 Contract Preview") failures.push(`${key} must remain L0 Contract Preview.`);
  }
  if (value.controls.productionAllowed !== false || value.controls.dormitoryL2ProductionAllowed !== false) {
    failures.push("Production controls must remain false.");
  }
  if (!Array.isArray(value.noGoItems)) failures.push("noGoItems must be an array.");
  if (failures.length) {
    for (const failure of failures) console.error(`P0 ${failure}`);
    throw new Error("OAM-ACF baseline validation failed.");
  }
}

function isSha(value) {
  return /^[0-9a-f]{40}$/.test(String(value || ""));
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())));
}
