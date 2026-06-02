import fs from "node:fs";
import path from "node:path";
import {
  assertNoProduction,
  assertNoTmp,
  failIfNeeded,
  readJson,
  repositoryHead
} from "../oam/clean-baseline-lib.mjs";

const repoHead = repositoryHead();
const gate = readJson("artifacts/operations/dormitory/day2-entry-gate-result.json");
const attestation = readJson("artifacts/release-state/post-merge-attestation.json");
const binding = readJson("artifacts/release-state/artifact-git-binding-result.json");
const index = readJson("artifacts/operations/dormitory/observation-index.json");
const failures = [];

if (fs.existsSync(path.join(process.cwd(), "artifacts/operations/dormitory/observation-day-02.json"))) {
  failures.push("Day-2 observation artifact 已存在；本阶段不得进入 Day-2。");
}
if (gate.status !== "passed") failures.push("Day-2 entry gate status 必须 passed。");
if (gate.day !== 2) failures.push("Day-2 entry gate day 必须是 2。");
if (gate.decision !== "allow_day_2_after_post_clean_baseline_remote_attestation") failures.push("Day-2 entry gate decision 不正确。");
if (gate.repositoryHead !== repoHead || gate.verifiedMainHead !== repoHead) failures.push("Day-2 entry gate 必须绑定当前 repositoryHead。");
if (gate.postMergeAttestationStatus !== "passed") failures.push("Day-2 entry gate 需要 post-merge attestation passed。");
if (gate.artifactGitBindingStatus !== "passed") failures.push("Day-2 entry gate 需要 artifact git binding passed。");
if (attestation.repositoryHead !== repoHead || attestation.verifiedMainHead !== repoHead || attestation.status !== "passed") {
  failures.push("post-merge attestation 必须绑定当前 main 且 passed。");
}
if (binding.repositoryHead !== repoHead || binding.verifiedMainHead !== repoHead || binding.status !== "passed") {
  failures.push("artifact git binding 必须绑定当前 main 且 passed。");
}
if (index.repositoryHead !== repoHead || index.verifiedMainHead !== repoHead || index.day2Allowed !== true) {
  failures.push("observation-index 必须允许 Day-2 entry 且绑定当前 main。");
}
if (gate.productionAllowed !== false || gate.dormitoryL2ProductionAllowed !== false || gate.businessProduction !== "blocked") {
  failures.push("Day-2 entry gate 不得允许 production / L2。");
}
if (gate.repairPartsHrStatus !== "L0 Contract Preview") failures.push("Repair / Parts / HR 必须保持 L0 Contract Preview。");
assertNoTmp(gate, failures, "day2 entry gate");
assertNoProduction(gate, failures, "day2 entry gate");

failIfNeeded(failures, "day2 entry gate check");
console.log("day2 entry gate check: PASS");
