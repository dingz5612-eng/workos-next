import { failIfNeeded, readJson, requirePassed, sha256, stableJson, writeJson } from "./baseline-lib.mjs";

export function buildSurfaceUxBaseline() {
  const failures = [];
  const refs = [
    "artifacts/surface/mobile-visible-copy-result.json",
    "artifacts/surface/mobile-pc-boundary-result.json",
    "artifacts/surface/surface-api-boundary-result.json",
    "artifacts/surface/backend-runtime-guard-api-replay-result.json",
    "artifacts/project/route-surface-inventory.json",
    "artifacts/screenshots/oam-ux-baseline/index.json"
  ];
  const values = refs.map((ref) => readJson(ref));
  for (let index = 0; index < 4; index += 1) {
    requirePassed(values[index], refs[index], failures, ["passed", "PROJECT_HYGIENE_CLEANUP_LOCAL_PASSED"]);
  }
  const routeInventory = values[4];
  if (!Array.isArray(routeInventory.routes) || routeInventory.routes.length === 0) {
    failures.push("route-surface-inventory 必须包含 routes 清单。");
  }
  const pcLeaks = (routeInventory.routes ?? []).filter((route) => route.surface === "pc_governance_plane" && route.ordinaryUserVisible);
  if (pcLeaks.length) failures.push(`PC route 不得标记为 ordinaryUserVisible：${pcLeaks.map((route) => route.route).join(", ")}`);
  const screenshotIndex = values.at(-1);
  if (!Array.isArray(screenshotIndex.routeCoverage) || screenshotIndex.routeCoverage.length === 0) {
    failures.push("截图基线必须包含 routeCoverage。");
  }
  const missingCoverage = screenshotIndex.dormitoryScenarioScreenshotCoverage?.missingScenarioCoverage ?? [];
  if (missingCoverage.length) failures.push(`截图基线缺少场景覆盖：${missingCoverage.join(", ")}`);
  const backendReplay = values[3];
  if (backendReplay.passed_count !== backendReplay.case_count) failures.push("backend runtime guard replay 必须全部通过。");
  const result = {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "check-surface-ux-baseline",
    stage: "OAM-CLEAN-BASELINE-D4",
    status: failures.length ? "failed" : "passed",
    surfaceRefs: refs,
    backendGuardCases: backendReplay.case_count,
    screenshotBaselineRef: "artifacts/screenshots/oam-ux-baseline/index.json",
    inputHash: sha256(stableJson(values)),
    resultHash: "",
    noGoItems: failures,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  result.resultHash = sha256(stableJson({ ...result, resultHash: "" }));
  writeJson("artifacts/baseline/surface-ux-baseline.json", result);
  return result;
}

const result = buildSurfaceUxBaseline();
failIfNeeded(result.noGoItems, "surface ux baseline check");
console.log("surface ux baseline check: PASS");
