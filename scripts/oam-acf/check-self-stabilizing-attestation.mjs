import { failIfNeeded, readJson, repositoryHead } from "../oam/clean-baseline-lib.mjs";

const actualHeadSha = repositoryHead();
const currentState = readJson("artifacts/release-state/current-state.json");
const attestation = readJson("artifacts/release-state/post-merge-attestation.json");
const artifactBinding = readJson("artifacts/release-state/artifact-git-binding-result.json");
const baseline = readJson("artifacts/oam-acf/phase-0/oam-acf-baseline.json");
const failures = [];

expectSha("current-state currentMain.headSha", currentState.currentMain?.headSha, actualHeadSha);
expectSha("current-state CI headSha", currentState.currentMain?.ci?.headSha, actualHeadSha);
expectSha("current-state V5.4 headSha", currentState.currentMain?.v54ControlPlaneGuards?.headSha, actualHeadSha);
expectStatus("current-state CI", currentState.currentMain?.ci);
expectStatus("current-state V5.4 Guards", currentState.currentMain?.v54ControlPlaneGuards);

expectSha("post-merge repositoryHead", attestation.repositoryHead, actualHeadSha);
expectSha("post-merge verifiedMainHead", attestation.verifiedMainHead, actualHeadSha);
expectSha("post-merge CI headSha", attestation.ci?.headSha, actualHeadSha);
expectSha("post-merge V5.4 headSha", attestation.v54ControlPlaneGuards?.headSha, actualHeadSha);
expectStatus("post-merge CI", attestation.ci);
expectStatus("post-merge V5.4 Guards", attestation.v54ControlPlaneGuards);
if (attestation.status !== "passed") failures.push("post-merge attestation status must be passed.");

expectSha("artifact binding repositoryHead", artifactBinding.repositoryHead, actualHeadSha);
expectSha("artifact binding verifiedMainHead", artifactBinding.verifiedMainHead, actualHeadSha);
if (artifactBinding.status !== "passed") failures.push("artifact git binding status must be passed.");
if ((artifactBinding.noGoItems || []).length !== 0) failures.push("artifact git binding noGoItems must be empty.");

expectSha("baseline actualHeadSha", baseline.actualHeadSha, actualHeadSha);
expectSha("baseline currentStateHeadSha", baseline.currentStateHeadSha, actualHeadSha);
expectSha("baseline subjectCommit", baseline.subjectCommit, actualHeadSha);
expectSha("baseline evidenceCommit", baseline.evidenceCommit, actualHeadSha);
expectSha("baseline attestationCommit", baseline.attestationCommit, actualHeadSha);
expectSha("baseline artifactGitBindingCommit", baseline.artifactGitBindingCommit, actualHeadSha);
for (const key of ["pr78MergeSha", "pr79MergeSha"]) {
  if (!/^[0-9a-f]{40}$/.test(String(baseline[key] || ""))) failures.push(`baseline ${key} must be recorded.`);
}

if (baseline.releaseStates?.dormitory !== "L1_INTERNAL_PILOT_OBSERVATION") failures.push("baseline Dormitory must remain L1 internal pilot observation.");
if (baseline.releaseStates?.dormitoryL2 !== "BLOCKED") failures.push("baseline Dormitory L2 must remain BLOCKED.");
if (baseline.releaseStates?.businessProduction !== "BLOCKED") failures.push("baseline Business Production must remain BLOCKED.");
for (const key of ["repair", "parts", "hr"]) {
  if (baseline.releaseStates?.[key] !== "L0 Contract Preview") failures.push(`baseline ${key} must remain L0 Contract Preview.`);
}
if ((baseline.noGoItems || []).length !== 0) failures.push("baseline noGoItems must be empty after self-stabilizing attestation repair.");

failIfNeeded(failures, "OAM-ACF self-stabilizing attestation check");
console.log("OAM-ACF self-stabilizing attestation check: PASS");

function expectSha(label, actual, expected) {
  if (actual !== expected) failures.push(`${label} must equal current origin/main. actual=${actual ?? "missing"} expected=${expected}`);
}

function expectStatus(label, run) {
  if (run?.status !== "completed" || run?.conclusion !== "success") {
    failures.push(`${label} must be completed/success.`);
  }
}
