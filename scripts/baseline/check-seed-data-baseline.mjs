import { failIfNeeded, isDirectRun, readJson, requirePassed, sha256, stableJson, writeJson } from "./baseline-lib.mjs";

export function buildSeedDataBaseline() {
  const failures = [];
  const seed = readJson("artifacts/project/seed-data-inventory.json");
  const project = readJson("artifacts/project/project-hygiene-result.json");
  requirePassed(project, "project hygiene", failures, ["PROJECT_HYGIENE_CLEANUP_LOCAL_PASSED"]);
  if ((seed.taskSeeds ?? []).some((item) => item.productionAllowed)) failures.push("seed data 不得 productionAllowed。");
  if ((seed.workspaceSeeds ?? []).some((item) => item.productionAllowed)) failures.push("workspace seed 不得 productionAllowed。");
  if (!(seed.isolationPolicy?.ordinaryMobileQueue ?? "").includes("DORM-L1")) failures.push("seed isolation policy 必须声明 ordinary mobile queue 仅限 DORM-L1。");
  const result = {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "check-seed-data-baseline",
    stage: "OAM-CLEAN-BASELINE-D5",
    status: failures.length ? "failed" : "passed",
    seedInventoryRef: "artifacts/project/seed-data-inventory.json",
    taskSeedCount: seed.taskSeeds?.length ?? 0,
    workspaceSeedCount: seed.workspaceSeeds?.length ?? 0,
    inputHash: sha256(stableJson([seed, project])),
    resultHash: "",
    noGoItems: failures,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  result.resultHash = sha256(stableJson({ ...result, resultHash: "" }));
  writeJson("artifacts/baseline/seed-data-baseline.json", result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = buildSeedDataBaseline();
  failIfNeeded(result.noGoItems, "seed data baseline check");
  console.log("seed data baseline check: PASS");
}
