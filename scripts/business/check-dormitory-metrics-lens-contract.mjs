import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const formulaPath = "docs/business/dormitory/metric-formula-contract.yml";
const lensPath = "docs/business/dormitory/lens-map.yml";
const requiredCategories = ["资源", "转化", "收入", "押金", "支出", "周转", "治理"];
const requiredDrilldown = ["WorkItem", "DomainEvent", "LedgerEntry", "Evidence", "LensSnapshot"];
const violations = [];

const kernel = readJson(kernelPath);
const formula = readJson(formulaPath);
const lens = readJson(lensPath);
const metrics = formula.metrics ?? [];
const metricById = new Map(metrics.map((item) => [item.metricId, item]));
const workItemTypes = new Set((kernel.workItems ?? []).map((item) => item.workItemType));

for (const category of requiredCategories) {
  requireValue(metrics.some((item) => item.categoryZh === category), "metric.category_missing", `缺少${category}类指标。`, { category });
}

for (const metric of metrics) {
  for (const field of ["metricId", "nameZh", "categoryZh", "owner", "formula", "sourceFacts", "exclusionsZh", "dimensions", "window", "threshold", "drilldown", "drilldownWorkItemType", "refreshPolicy", "correctionStrategyZh"]) {
    requireValue(hasValue(metric[field]), "metric.field_missing", `${metric.metricId ?? "<missing>"} 缺少 ${field}。`, { metricId: metric.metricId, field });
  }
  for (const target of requiredDrilldown) {
    requireValue((metric.drilldown ?? []).includes(target), "metric.drilldown_missing", `${metric.metricId} 不能钻取到 ${target}。`, { metricId: metric.metricId, target });
  }
  requireValue(workItemTypes.has(metric.drilldownWorkItemType), "metric.workitem_missing", `${metric.metricId} drilldownWorkItemType 不在当前宿舍内核。`, { metricId: metric.metricId });
}

for (const lensItem of lens.lenses ?? []) {
  requireValue(lensItem.readonly === true, "lens.not_readonly", `${lensItem.lensId} 必须只读。`, { lensId: lensItem.lensId });
  for (const target of requiredDrilldown) {
    requireValue((lensItem.drilldown ?? []).includes(target), "lens.drilldown_missing", `${lensItem.lensId} 不能钻取到 ${target}。`, { lensId: lensItem.lensId, target });
  }
  for (const workItemType of lensItem.derivedFromFacts ?? []) {
    requireValue(workItemTypes.has(workItemType), "lens.workitem_missing", `${lensItem.lensId} 引用了非当前 WorkItem ${workItemType}。`, { lensId: lensItem.lensId, workItemType });
  }
}

for (const metric of kernel.lensAndMetrics?.metrics ?? []) {
  requireValue(metricById.has(metric.metricId), "kernel.metric_not_derived", `内核指标未进入 metric-formula：${metric.metricId}`, { metricId: metric.metricId });
}

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log(`Dormitory metrics and lens check: PASS (${metrics.length} metrics)`);

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}
