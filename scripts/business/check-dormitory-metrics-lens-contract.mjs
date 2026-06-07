import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const formulaPath = "docs/business/dormitory/metric-formula-contract.yml";
const lensPath = "docs/business/dormitory/lens-map.yml";
const globalLensPath = "docs/contracts/accommodation-lens-contract.json";
const periodAnalyticsPath = "docs/contracts/period-analytics-contract.json";
const requiredCategories = ["资源", "转化", "收入", "押金", "支出", "周转", "治理"];
const requiredDrilldown = ["WorkItem", "DomainEvent", "LedgerEntry", "Evidence", "LensSnapshot"];
const violations = [];

const kernel = readJson(kernelPath);
const formula = readJson(formulaPath);
const lens = readJson(lensPath);
const globalLens = readJson(globalLensPath);
const periodAnalytics = readJson(periodAnalyticsPath);
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

const globalClosure = globalLens.dormitoryOamClosure ?? {};
requireValue((globalClosure.derivedFrom ?? []).includes(kernelPath), "global_lens.kernel_missing", "accommodation-lens-contract 必须由宿舍内核派生。");
requireValue(globalClosure.currentTruthAllowed === false, "global_lens.truth_allowed", "accommodation-lens-contract 的宿舍闭环不得定义业务真值。");
requireValue(globalClosure.manualEditAllowed === false, "global_lens.manual_edit_allowed", "accommodation-lens-contract 的宿舍闭环必须由生成器维护。");
for (const category of requiredCategories) {
  requireValue((globalClosure.categories ?? []).includes(category), "global_lens.category_missing", `全局 Lens 合同缺少${category}类指标。`, { category });
}
for (const target of requiredDrilldown) {
  requireValue((globalClosure.metricBindings ?? []).every((item) => (item.drilldown ?? []).includes(target)), "global_lens.drilldown_missing", `全局 Lens 指标绑定不能钻取到 ${target}。`, { target });
}
requireValue(globalClosure.periodReviewWorkItemType === "Dorm.PeriodReview", "global_lens.period_review_missing", "全局 Lens 必须绑定 Dorm.PeriodReview。");
requireValue(globalClosure.actionPlanWorkItemType === "Dorm.PeriodActionPlanExecute", "global_lens.action_plan_missing", "全局 Lens 必须绑定 Dorm.PeriodActionPlanExecute。");

const periodClosure = periodAnalytics.dormitoryOamClosure ?? {};
requireValue((periodClosure.derivedFrom ?? []).includes(kernelPath), "period_analytics.kernel_missing", "period-analytics-contract 必须由宿舍内核派生。");
requireValue(periodClosure.currentTruthAllowed === false, "period_analytics.truth_allowed", "period-analytics-contract 不得定义宿舍业务或账务真值。");
requireValue(periodClosure.periodReviewWorkItemType === "Dorm.PeriodReview", "period_analytics.review_missing", "周期复盘必须绑定 Dorm.PeriodReview。");
requireValue(periodClosure.actionPlanWorkItemType === "Dorm.PeriodActionPlanExecute", "period_analytics.action_plan_missing", "周期行动计划必须绑定 Dorm.PeriodActionPlanExecute。");
for (const source of ["businessFacts", "financeFacts", "evidenceFacts", "lensSnapshots"]) {
  requireValue((periodClosure.readOnlyInputs ?? []).includes(source), "period_analytics.readonly_input_missing", `周期复盘必须只读 ${source}。`, { source });
}
for (const forbidden of ["businessFacts", "financeFacts", "ledgerEntries"]) {
  requireValue((periodClosure.forbiddenWrites ?? []).includes(forbidden), "period_analytics.forbidden_write_missing", `周期复盘必须禁止直写 ${forbidden}。`, { forbidden });
}
for (const output of ["PeriodSnapshot", "ActionPlan", "ExceptionCase"]) {
  requireValue((periodClosure.allowedOutputs ?? []).includes(output), "period_analytics.output_missing", `周期复盘允许输出缺少 ${output}。`, { output });
}
for (const category of requiredCategories) {
  requireValue((periodClosure.categories ?? []).includes(category), "period_analytics.category_missing", `周期分析缺少${category}类指标。`, { category });
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
