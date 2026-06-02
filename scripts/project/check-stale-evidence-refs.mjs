import {
  exists,
  finalArtifactRefs,
  hasForbiddenFinalRef,
  inspectArtifact,
  normalizePath,
  readJson,
  trackedFiles,
  updateProjectHygiene,
  writeJson,
  failIfNeeded
} from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const finalRefSet = new Set(finalArtifactRefs);
const currentState = readJson("artifacts/release-state/current-state.json");
const currentStateRefs = new Set((currentState.evidenceRefs ?? []).map(normalizePath));
const finalArtifacts = finalArtifactRefs.map((artifactPath) => inspectArtifact(artifactPath, new Set([...finalRefSet, ...currentStateRefs])));
const referenced = new Set(finalArtifacts.flatMap((item) => item.evidenceRefs).map(normalizePath));
for (const ref of currentStateRefs) referenced.add(ref);
for (const ref of finalArtifactRefs) referenced.add(ref);

const trackedArtifacts = trackedFiles("artifacts").filter((file) => /\.(json|jsonl|md|yml|yaml)$/i.test(file));
const staleArtifacts = trackedArtifacts
  .filter((file) => !referenced.has(file) && !finalRefSet.has(file))
  .map((artifactPath) => ({
    artifactPath,
    retainedAs: classifyRetainedArtifact(artifactPath),
    referencedByCurrentState: currentStateRefs.has(artifactPath),
    action: "保留为历史或诊断材料，不作为 final go-live evidence。"
  }));

const noGoItems = [];
for (const item of finalArtifacts) {
  for (const ref of item.evidenceRefs) {
    if (hasForbiddenFinalRef(ref)) noGoItems.push(`${item.artifactPath} 引用禁止 final evidence：${ref}`);
    if (/^(artifacts|docs|scripts|apps|tests|services|infra)\//.test(ref) && !exists(ref)) {
      noGoItems.push(`${item.artifactPath} 引用不存在的 evidence：${ref}`);
    }
  }
}
for (const stale of staleArtifacts) {
  if (stale.referencedByCurrentState) noGoItems.push(`stale artifact 不得被 current-state 引用：${stale.artifactPath}`);
}

const result = {
  generatedAtUtc,
  generatedBy: "check-stale-evidence-refs",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  finalEvidenceRefCount: referenced.size,
  staleArtifactCount: staleArtifacts.length,
  staleArtifacts,
  noGoItems,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/project/stale-artifacts.json", result);
updateProjectHygiene("stale_evidence_refs", result);
failIfNeeded(noGoItems, "stale evidence refs check");
console.log("stale evidence refs check: PASS");

function classifyRetainedArtifact(artifactPath) {
  if (artifactPath.includes("screenshots/")) return "diagnostic_screenshot";
  if (artifactPath.includes("won-")) return "historical_design_reference";
  if (artifactPath.includes("test-out/")) return "local_test_output";
  if (artifactPath.includes("v5_5/")) return "historical_rule_output";
  return "historical_artifact";
}
