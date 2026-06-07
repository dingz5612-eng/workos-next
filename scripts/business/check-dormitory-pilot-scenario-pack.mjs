import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pack = readJson("docs/business/dormitory/dormitory-pilot-scenario-pack.yml");
const violations = [];
const requiredCounts = new Map([
  ["入住", 10],
  ["普通收款", 5],
  ["押金", 5],
  ["服务任务", 3],
  ["支出", 3],
  ["退住", 3],
  ["周期复盘", 1]
]);

requireValue((pack.derivedFrom ?? []).includes("docs/business/dormitory/dormitory-operating-kernel.json"), "pilot.derived_missing", "试运行场景包必须由宿舍内核派生。");
requireValue(pack.manualEditAllowed === false, "pilot.manual_edit", "试运行场景包不得手改。");
for (const [categoryZh, count] of requiredCounts) {
  const actual = (pack.scenarios ?? []).filter((item) => item.categoryZh === categoryZh).length;
  requireValue(actual >= count, "pilot.category_count", `${categoryZh} 场景不足：${actual}/${count}`, { categoryZh, actual, count });
}
for (const scenario of pack.scenarios ?? []) {
  for (const field of ["scenarioId", "categoryZh", "workItemType", "definitionId", "traceRequired", "goNoGo"]) {
    requireValue(Boolean(scenario[field]) && (!Array.isArray(scenario[field]) || scenario[field].length > 0), "pilot.field_missing", `${scenario.scenarioId ?? "<missing>"} 缺少 ${field}。`, { scenarioId: scenario.scenarioId, field });
  }
  for (const target of ["WorkItem", "CommandSubmission", "DomainEvent", "LedgerEntry", "Evidence", "Projection", "Lens", "NextWorkItemOrDecision"]) {
    requireValue((scenario.traceRequired ?? []).includes(target), "pilot.trace_missing", `${scenario.scenarioId} 缺少追溯 ${target}。`, { scenarioId: scenario.scenarioId, target });
  }
}

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log(`Dormitory pilot scenario pack check: PASS (${pack.scenarios.length} scenarios)`);

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}
