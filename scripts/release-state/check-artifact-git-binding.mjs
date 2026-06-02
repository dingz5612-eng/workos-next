import {
  artifactStatus,
  assertNoProduction,
  assertNoTmp,
  fileHash,
  readJson,
  repositoryHead,
  writeJson,
  failIfNeeded
} from "../oam/clean-baseline-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const repoHead = repositoryHead();
const attestation = readJson("artifacts/release-state/post-merge-attestation.json");
const verifiedMainHead = attestation.verifiedMainHead ?? null;
const failures = [];
const artifactPaths = [
  "artifacts/release-state/current-state.json",
  "artifacts/oam/oam-final-acceptance-result.json",
  "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
  "artifacts/go-live/dormitory/day0-readiness-result.json",
  "artifacts/operations/dormitory/observation-day-01.json",
  "artifacts/operations/dormitory/l1-to-l2-readiness.json",
  "artifacts/rt4/evidence-graph.json",
  "artifacts/rt4/completion-dashboard.json",
  "artifacts/portfolio/business-line-maturity-result.json",
  "artifacts/portfolio/production-governance-result.json"
];

const artifacts = artifactPaths.map((artifactPath) => inspectArtifact(artifactPath));

for (const item of artifacts) {
  if (!item.exists) {
    failures.push(`缺少 artifact：${item.artifactPath}`);
    continue;
  }
  if (item.noTmpFinalRefs === false) failures.push(`${item.artifactPath} 包含 .tmp final evidence refs。`);
  if (item.productionBoundaryOk === false) failures.push(`${item.artifactPath} 出现 production / L2 / Repair Parts HR 放开状态。`);
  if (item.noGoItemsNonEmpty && item.status === "passed") failures.push(`${item.artifactPath} status=passed 但 noGoItems 非空。`);
  if (item.artifactPath.includes("observation-day-01") && item.artifactBase !== "1a2fb45a89f3d1ef18eaf4ca216ecdc57660df30") {
    failures.push("observation-day-01.originMainHead 必须绑定 Day-1 PR base。");
  }
}

const currentState = readJson("artifacts/release-state/current-state.json");
const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const graph = readJson("artifacts/rt4/evidence-graph.json");
const dashboard = readJson("artifacts/rt4/completion-dashboard.json");
if (currentState.currentMain?.headSha !== repoHead) failures.push("current-state.currentMain.headSha 必须等于 repositoryHead。");
if (currentState.currentMain?.ci?.headSha !== repoHead) failures.push("current-state CI headSha 必须等于 repositoryHead。");
if (goNoGo.latestMain?.commitSha !== repoHead) failures.push("internal-pilot-go-no-go.latestMain.commitSha 必须等于 repositoryHead。");
if (goNoGo.latestMain?.ci?.headSha !== repoHead) failures.push("internal-pilot-go-no-go CI headSha 必须等于 repositoryHead。");
if (graph.headSha !== repoHead) failures.push("evidence graph headSha 必须等于 repositoryHead。");
if (dashboard.currentMainHead !== repoHead) failures.push("completion dashboard currentMainHead 必须等于 repositoryHead。");
if (currentState.authoritativeState?.businessProduction !== "BLOCKED") failures.push("Business Production 必须 BLOCKED。");
if (currentState.authoritativeState?.dormitoryL2 !== "BLOCKED") failures.push("Dormitory L2 必须 BLOCKED。");

const result = {
  generatedAtUtc,
  generatedBy: "check-artifact-git-binding",
  stage: "OAM-ACCEPTANCE-CLOSURE-A2",
  status: failures.length === 0 ? "passed" : "failed",
  repositoryHead: repoHead,
  verifiedMainHead,
  postMergeAttestationStatus: attestation.status,
  artifacts,
  noGoItems: failures,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/release-state/artifact-git-binding-result.json", result);
failIfNeeded(failures, "artifact git binding check");
console.log("artifact git binding check: PASS");

function inspectArtifact(artifactPath) {
  let value = null;
  let exists = true;
  try {
    value = readJson(artifactPath);
  } catch {
    exists = false;
  }
  const artifactHeadSha = headFor(artifactPath, value);
  const artifactBase = value?.originMainHead ?? value?.currentMainHead ?? value?.latestMain?.commitSha ?? null;
  const tmpFailures = [];
  const prodFailures = [];
  if (exists) {
    assertNoTmp(value, tmpFailures, artifactPath);
    assertNoProduction(value, prodFailures, artifactPath);
  }
  const noGoItems = value?.noGoItems ?? value?.no_go_items ?? [];
  return {
    artifactPath,
    exists,
    generatedBy: value?.generatedBy ?? value?.generated_by ?? null,
    generatedAtUtc: value?.generatedAtUtc ?? value?.generated_at_utc ?? null,
    stage: value?.stage ?? inferStage(artifactPath),
    sourceMode: value?.sourceMode ?? value?.source_mode ?? null,
    status: value ? artifactStatus(value) : "missing",
    artifactHeadSha,
    artifactBase,
    validatedAgainstMainSha: verifiedMainHead,
    repositoryHead: repoHead,
    verifiedMainHead,
    stale: Boolean(artifactHeadSha && artifactHeadSha !== repoHead && artifactPath !== "artifacts/operations/dormitory/observation-day-01.json"),
    noTmpFinalRefs: tmpFailures.length === 0,
    productionBoundaryOk: prodFailures.length === 0,
    noGoItemsNonEmpty: Array.isArray(noGoItems) && noGoItems.length > 0,
    hash: exists ? fileHash(artifactPath) : null
  };
}

function headFor(artifactPath, value) {
  if (!value) return null;
  if (artifactPath.includes("current-state")) return value.currentMain?.headSha ?? null;
  if (artifactPath.includes("internal-pilot-go-no-go")) return value.latestMain?.commitSha ?? null;
  if (artifactPath.includes("observation-day-01")) return value.headSha ?? null;
  if (artifactPath.includes("evidence-graph")) return value.headSha ?? null;
  if (artifactPath.includes("completion-dashboard")) return value.currentMainHead ?? null;
  return value.currentMainHead ?? value.repositoryHead ?? value.headSha ?? value.latestMain?.commitSha ?? null;
}

function inferStage(artifactPath) {
  if (artifactPath.includes("release-state")) return "release-state";
  if (artifactPath.includes("go-live/dormitory")) return "DORM-INT";
  if (artifactPath.includes("operations/dormitory")) return "DORM-L1-OBS";
  if (artifactPath.includes("portfolio")) return "portfolio";
  if (artifactPath.includes("rt4")) return "RT4";
  return "unknown";
}
