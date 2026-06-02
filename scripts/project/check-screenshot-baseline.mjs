import fs from "node:fs";
import path from "node:path";
import { mobileOrdinarySurfaces, pcSurfaceViews } from "../../apps/mobile/src/surfaceRegistry.js";
import { root, updateProjectHygiene, writeJson, failIfNeeded } from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const requiredMobileRoutes = ["home", "workbench", "workspace", "operationPanel", "search", "me", "learning", "permissionDiagnostic"];
const requiredPcRoutes = ["managerControlTower", "financeControl", "governanceCenter", "releaseFlightDeck"];
const noGoItems = [];

for (const route of requiredMobileRoutes) {
  if (!mobileOrdinarySurfaces.has(route)) noGoItems.push(`截图基线路由缺少 mobile surface：${route}`);
}
for (const route of requiredPcRoutes) {
  if (!pcSurfaceViews.has(route)) noGoItems.push(`截图基线路由缺少 PC surface：${route}`);
}

const scenarioScreenshotRoot = path.join(root, "artifacts", "screenshots", "dormitory-business-scenarios");
const scenarioScreenshots = fs.existsSync(scenarioScreenshotRoot)
  ? fs.readdirSync(scenarioScreenshotRoot, { recursive: true }).filter((file) => /\.png$/i.test(String(file))).map((file) => String(file).replace(/\\/g, "/"))
  : [];
const scenarioIds = new Set(scenarioScreenshots.map((file) => file.match(/dorm-live-\d{3}/)?.[0]).filter(Boolean));
const missingScenarioCoverage = Array.from({ length: 10 }, (_, index) => `dorm-live-${String(index + 1).padStart(3, "0")}`)
  .filter((scenarioId) => !scenarioIds.has(scenarioId));

const index = {
  generatedAtUtc,
  generatedBy: "check-screenshot-baseline",
  stage: "PROJECT-HYGIENE-CLEANUP",
  sourceMode: "baseline_index",
  currentBaselinePolicy: "索引约束覆盖所有可测试 Surface；真实截图可作为诊断材料补充，不作为 production evidence。",
  requiredMobileRoutes,
  requiredPcRoutes,
  routeCoverage: [...requiredMobileRoutes.map((route) => ({ route, surface: "mobile_work_plane", covered: mobileOrdinarySurfaces.has(route) })),
    ...requiredPcRoutes.map((route) => ({ route, surface: "pc_governance_plane", covered: pcSurfaceViews.has(route) }))],
  dormitoryScenarioScreenshotCoverage: {
    screenshotRoot: "artifacts/screenshots/dormitory-business-scenarios",
    screenshotCount: scenarioScreenshots.length,
    scenarioIds: Array.from(scenarioIds).sort(),
    missingScenarioCoverage
  },
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview",
  noGoItems
};

const result = {
  generatedAtUtc,
  generatedBy: "check-screenshot-baseline",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  baselineIndexRef: "artifacts/screenshots/oam-ux-baseline/index.json",
  routeCoverageCount: index.routeCoverage.length,
  diagnosticScenarioScreenshotCount: scenarioScreenshots.length,
  missingScenarioCoverage,
  noGoItems,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/screenshots/oam-ux-baseline/index.json", index);
updateProjectHygiene("screenshot_baseline", result);
failIfNeeded(noGoItems, "screenshot baseline check");
console.log("screenshot baseline check: PASS");
