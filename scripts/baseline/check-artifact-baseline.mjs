import { failIfNeeded, isDirectRun, readJson, requirePassed, sha256, stableJson, writeJson } from "./baseline-lib.mjs";

export function buildArtifactBaseline() {
  const failures = [];
  const project = readJson("artifacts/project/project-hygiene-result.json");
  const inventory = readJson("artifacts/project/artifact-inventory.json");
  const stale = readJson("artifacts/project/stale-artifacts.json");
  requirePassed(project, "project hygiene", failures, ["PROJECT_HYGIENE_CLEANUP_LOCAL_PASSED"]);
  requirePassed(stale, "stale evidence refs", failures);
  if (!Array.isArray(inventory.finalArtifactRefs) || inventory.finalArtifactRefs.length < 10) {
    failures.push("artifact inventory 必须列出 finalArtifactRefs。");
  }
  const badFinal = (inventory.artifacts ?? []).filter((item) => item.finalEvidence && (!item.generatedBy || !item.generatedAtUtc || !item.stage || !item.sourceMode || !item.resultHash));
  if (badFinal.length) failures.push(`final artifact 缺少有效元数据：${badFinal.map((item) => item.artifactPath).join(", ")}`);
  const result = {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "check-artifact-baseline",
    stage: "OAM-CLEAN-BASELINE-D2",
    status: failures.length ? "failed" : "passed",
    artifactInventoryRef: "artifacts/project/artifact-inventory.json",
    staleArtifactsRef: "artifacts/project/stale-artifacts.json",
    finalArtifactCount: inventory.finalArtifactRefs?.length ?? 0,
    staleArtifactCount: stale.staleArtifactCount,
    inputHash: sha256(stableJson([project, inventory, stale])),
    resultHash: "",
    noGoItems: failures,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  result.resultHash = sha256(stableJson({ ...result, resultHash: "" }));
  writeJson("artifacts/baseline/artifact-inventory.json", result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = buildArtifactBaseline();
  failIfNeeded(result.noGoItems, "artifact baseline check");
  console.log("artifact baseline check: PASS");
}
