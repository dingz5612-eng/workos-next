import { tasks } from "../../apps/mobile/src/devFixtures/demoQueue.js";
import { readText, updateProjectHygiene, writeJson, failIfNeeded } from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const selectorsSource = readText("apps/mobile/src/selectors/surfaceSelectors.js");
const runtimeStoreSource = readText("apps/mobile/src/runtime/runtimeStore.js");
const workspaceProjectionSource = readText("apps/mobile/src/devFixtures/workspaceProjections.js");
const noGoItems = [];

const taskInventory = tasks.map((task) => ({
  seedId: task.id,
  domain: task.domain,
  classification: classifyTask(task),
  ordinaryMobileAllowed: task.domain === "stay",
  diagnosticOnly: task.domain !== "stay",
  productionAllowed: false
}));

const workspaceInventory = parseWorkspaceSeeds(workspaceProjectionSource).map((workspace) => ({
  workspaceId: workspace.workspaceId,
  taskId: workspace.taskId,
  domain: workspace.domain,
  classification: classifyWorkspace(workspace),
  cardCount: workspace.cardCount,
  ordinaryMobileAllowed: workspace.domain === "stay",
  diagnosticOnly: workspace.domain !== "stay",
  productionAllowed: false
}));

if (!selectorsSource.includes("isOrdinaryPilotQueueItem")) {
  noGoItems.push("selectWorkbenchQueue 必须调用 isOrdinaryPilotQueueItem 隔离普通移动队列。");
}
for (const marker of ["runtimeAudit", "engineering", "diagnostic", "fixture_replay", "retired_projection_shadow"]) {
  if (!selectorsSource.includes(marker)) noGoItems.push(`普通移动队列隔离缺少 marker：${marker}`);
}
if (!runtimeStoreSource.includes('source: "operations-work-items"')) {
  noGoItems.push("runtimeStore 必须将 operationWorkItems 映射为 operations-work-items queue source。");
}
if (taskInventory.filter((item) => item.ordinaryMobileAllowed).length === 0) {
  noGoItems.push("至少需要一个 DORM-L1/stay seed 作为移动端学习或诊断基线。");
}
for (const item of [...taskInventory, ...workspaceInventory]) {
  if (item.productionAllowed) noGoItems.push(`${item.seedId ?? item.workspaceId} seed 不得标记 productionAllowed。`);
}

const result = {
  generatedAtUtc,
  generatedBy: "check-seed-data-isolation",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  taskSeedCount: taskInventory.length,
  workspaceSeedCount: workspaceInventory.length,
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
  taskSeeds: taskInventory,
  workspaceSeeds: workspaceInventory,
  isolationPolicy: {
    ordinaryMobileQueue: "DORM-L1/stay scoped runtime work items only; diagnostic, engineering, fixture, runtimeAudit and retired projection shadow seeds are excluded unless debugSurface=true.",
    diagnosticSurface: "engineering diagnostic, runtime audit, rf and retired projection shadow seeds may only appear in diagnostic or migration tests.",
    productionAllowed: false
  }
});
updateProjectHygiene("seed_data_isolation", result);
failIfNeeded(noGoItems, "seed data isolation check");
console.log("seed data isolation check: PASS");

function classifyTask(task) {
  if (task.domain === "stay") return "DORM-L1 candidate seed";
  if (task.domain === "finance") return "finance diagnostic seed";
  if (task.domain === "repair") return "L0 learning/diagnostic seed";
  return "diagnostic seed";
}

function classifyWorkspace(workspace) {
  if (workspace.domain === "stay") return "DORM-L1 lifecycle workspace seed";
  if (workspace.domain === "finance") return "finance diagnostic workspace seed";
  if (workspace.domain === "repair") return "L0 learning/diagnostic workspace seed";
  return "diagnostic workspace seed";
}

function parseWorkspaceSeeds(source) {
  const pattern = /workspaceModel\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
  const seeds = [];
  let match;
  while ((match = pattern.exec(source))) {
    const [workspaceId, domain, taskId] = match.slice(1);
    const nextStart = source.indexOf("workspaceModel(", pattern.lastIndex);
    const block = source.slice(match.index, nextStart === -1 ? source.length : nextStart);
    seeds.push({
      workspaceId,
      domain,
      taskId,
      cardCount: (block.match(/cardModel\(/g) ?? []).length
    });
  }
  return seeds;
}
