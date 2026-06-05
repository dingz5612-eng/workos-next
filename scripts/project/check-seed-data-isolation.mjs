import { exists, readText, updateProjectHygiene, writeJson, failIfNeeded } from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const selectorsSource = readText("apps/mobile/src/selectors/surfaceSelectors.js");
const runtimeStoreSource = readText("apps/mobile/src/runtime/runtimeStore.js");
const noGoItems = [];

const retiredFixturePaths = [
  "apps/mobile/src/devFixtures/demoQueue.js",
  "apps/mobile/src/devFixtures/projectionMetadata.js",
  "apps/mobile/src/devFixtures/workspaceProjections.js",
  "apps/mobile/src/devFixtures/i18n/demoCopy.js"
];

for (const fixturePath of retiredFixturePaths) {
  if (exists(fixturePath)) noGoItems.push(`旧离线 demo fixture 必须删除：${fixturePath}`);
}

if (!selectorsSource.includes("isOrdinaryPilotQueueItem")) {
  noGoItems.push("selectWorkbenchQueue 必须调用 isOrdinaryPilotQueueItem 隔离普通移动队列。");
}
for (const marker of ["runtimeAudit", "engineering", "diagnostic", "fixture_replay", "retired_projection_shadow"]) {
  if (!selectorsSource.includes(marker)) noGoItems.push(`普通移动队列隔离缺少 marker：${marker}`);
}
for (const retiredToken of ["demoQueue", "workspaceProjections", "projectionMetadata", "demoCopy"]) {
  if (selectorsSource.includes(retiredToken) || runtimeStoreSource.includes(retiredToken)) {
    noGoItems.push(`普通移动端运行时不得再引用旧 demo fixture：${retiredToken}`);
  }
}
if (!runtimeStoreSource.includes('source: "operations-work-items"')) {
  noGoItems.push("runtimeStore 必须将 operationWorkItems 映射为 operations-work-items queue source。");
}

const result = {
  generatedAtUtc,
  generatedBy: "check-seed-data-isolation",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  taskSeedCount: 0,
  workspaceSeedCount: 0,
  retiredFixtureCount: retiredFixturePaths.length,
  noGoItems,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/project/seed-data-inventory.json", {
  generatedAtUtc,
  generatedBy: "check-seed-data-isolation",
  stage: "PROJECT-HYGIENE-CLEANUP",
  taskSeeds: [],
  workspaceSeeds: [],
  retiredFixturePaths,
  isolationPolicy: {
    ordinaryMobileQueue: "DORM-L1/stay scoped runtime work items only; diagnostic, engineering, fixture, runtimeAudit and retired projection shadow seeds are excluded unless debugSurface=true.",
    diagnosticSurface: "engineering diagnostic, runtime audit, rf and retired projection shadow seeds may only appear in diagnostic or migration tests.",
    frontendSeedFixtures: "retired; mobile surfaces must use runtime work items, projection, lens, admission, and experience contracts instead of local demo fixtures.",
    productionAllowed: false
  }
});
updateProjectHygiene("seed_data_isolation", result);
failIfNeeded(noGoItems, "seed data isolation check");
console.log("seed data isolation check: PASS");
