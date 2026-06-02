import { readJson, repositoryHead, failIfNeeded, assertNoProduction, assertNoTmp } from "../oam/clean-baseline-lib.mjs";

const attestation = readJson("artifacts/release-state/post-merge-attestation.json");
const failures = [];
const repoHead = repositoryHead();

if (attestation.repositoryHead !== repoHead) failures.push(`repositoryHead 必须等于 origin/main。 actual=${attestation.repositoryHead} expected=${repoHead}`);
if (attestation.status !== "passed" && attestation.status !== "WAITING_FOR_POST_MERGE_ATTESTATION") {
  failures.push("post-merge attestation status 只能是 passed 或 WAITING_FOR_POST_MERGE_ATTESTATION。");
}

if (attestation.status === "passed") {
  if (attestation.verifiedMainHead !== repoHead) failures.push("verifiedMainHead 必须等于 repositoryHead。");
  if (attestation.ci?.status !== "completed" || attestation.ci?.conclusion !== "success" || attestation.ci?.headSha !== repoHead) {
    failures.push("CI evidence 必须是当前 repositoryHead 的 completed/success。");
  }
  if (attestation.v54ControlPlaneGuards?.status !== "completed" || attestation.v54ControlPlaneGuards?.conclusion !== "success" || attestation.v54ControlPlaneGuards?.headSha !== repoHead) {
    failures.push("V5.4 Guards evidence 必须是当前 repositoryHead 的 completed/success。");
  }
} else if (attestation.controls?.day2AllowedByAttestation !== false) {
  failures.push("等待 post-merge attestation 时 Day-2 必须被阻断。");
}

if (attestation.prNumber !== 71) failures.push("Day-1 post-merge attestation 必须绑定 PR #71。");
if (attestation.mergeCommit !== repoHead) failures.push("mergeCommit 必须等于当前 repositoryHead。");
assertNoTmp(attestation, failures, "post-merge attestation");
assertNoProduction(attestation, failures, "post-merge attestation");

failIfNeeded(failures, "post-merge attestation check");
console.log("post-merge attestation check: PASS");

