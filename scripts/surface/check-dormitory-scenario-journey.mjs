import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = path.join(root, "artifacts/oma/checks/dormitory-scenario-journey-result.json");
const indexPath = path.join(root, "artifacts/screenshots/dormitory-journeys/index.json");
const violations = [];

const result = readJson(resultPath);
const index = readJson(indexPath);

if (result.status !== "passed") violations.push(v("journey.status", "场景旅程结果必须 passed。"));
if (result.day2Started !== false) violations.push(v("journey.day2_started", "当前 OMA 场景旅程不得启动 Day-2。"));
if (result.productionAllowed !== false || result.dormitoryL2ProductionAllowed !== false || result.repairPartsHrProductionAllowed !== false) {
  violations.push(v("journey.production_boundary", "场景旅程不得声明 L2 / Production / Repair / Parts / HR production。"));
}
if ((result.scenarios || []).length !== 10) violations.push(v("journey.count", "必须覆盖 10 条 dorm-live 场景。"));

for (const item of result.scenarios || []) {
  for (const key of ["workItem", "commandSubmission", "factTrace", "lensUpdate", "operatingControlVisibility", "htmlSnapshot", "svgSnapshot"]) {
    if (!item[key]) violations.push(v("journey.missing_ref", `${item.scenarioId} 缺少 ${key}。`, { scenarioId: item.scenarioId, key }));
  }
  for (const refKey of ["htmlSnapshot", "svgSnapshot"]) {
    const fullPath = path.join(root, item[refKey]);
    if (!fs.existsSync(fullPath)) violations.push(v("journey.snapshot_missing", `${item.scenarioId} 缺少 ${refKey} 文件。`, { scenarioId: item.scenarioId, refKey }));
  }
  if (String(item.htmlSnapshot || "").includes(".tmp") || String(item.svgSnapshot || "").includes(".tmp")) {
    violations.push(v("journey.tmp_ref", `${item.scenarioId} screenshot refs 不得使用 .tmp。`, { scenarioId: item.scenarioId }));
  }
}

if ((index.entries || []).length !== 10) violations.push(v("journey.index_count", "截图索引必须包含 10 条记录。"));

if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("dormitory scenario journey check failed.");
}
console.log("dormitory scenario journey check: PASS");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    violations.push(v("journey.file_missing", `无法读取 ${path.relative(root, filePath)}。`, { error: error.message }));
    return {};
  }
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

