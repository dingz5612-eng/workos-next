import {
  failIfViolations,
  readJson,
  requireValue,
  validateSchemaFile
} from "./lib/oam02-semantic-lib.mjs";

const checkId = "metric-formula-contract";
const scannedFiles = [
  "docs/business/dormitory/metric-formula-contract.yml",
  "docs/go-live/dormitory/observation-metric-contract.yml",
  "schemas/business/metric-formula-contract.schema.json"
];
const contract = readJson(scannedFiles[0]);
const observationMetric = readJson(scannedFiles[1]);
const violations = [
  ...validateSchemaFile(scannedFiles[2], ["$schema", "$id", "required", "properties"])
];

requireValue(contract.productionAllowed === false, violations, "metric.production_allowed", "指标公式合同不得允许 production。");

const requiredKeys = ["formula", "unit", "window", "dimension", "target", "yellowThreshold", "redThreshold", "minSampleSize", "owner", "drillDown"];
for (const metric of contract.metrics ?? []) {
  for (const key of requiredKeys) {
    requireValue(metric[key] !== undefined && metric[key] !== null, violations, "metric.required_key_missing", `${metric.metricId} 缺少 ${key}。`, { metricId: metric.metricId, key });
  }
  requireValue(Array.isArray(metric.dimension) && metric.dimension.length > 0, violations, "metric.dimension_missing", `${metric.metricId} 必须有 dimension。`, { metricId: metric.metricId });
  requireValue(Array.isArray(metric.drillDown) && metric.drillDown.length > 0, violations, "metric.drilldown_missing", `${metric.metricId} 必须有 drillDown。`, { metricId: metric.metricId });
  requireValue(metric.drillDown.some((item) => ["workItemId", "caseId", "ledgerTransactionId", "projectionCheckpointId", "eventId", "depositAccountId"].includes(item)), violations, "metric.no_traceable_drilldown", `${metric.metricId} 必须能钻取到 WorkItem/Event/Ledger/Projection 证据。`, { metricId: metric.metricId });
  requireValue(typeof metric.owner === "string" && metric.owner.length > 0, violations, "metric.owner_missing", `${metric.metricId} 必须有 owner。`, { metricId: metric.metricId });
  requireValue(typeof metric.minSampleSize === "number" && metric.minSampleSize >= 1, violations, "metric.min_sample_invalid", `${metric.metricId} minSampleSize 必须 >= 1。`, { metricId: metric.metricId });
}

const metricIds = new Set((contract.metrics ?? []).map((item) => item.metricId));
for (const expected of ["evidence_missing_rate", "projection_lag_p95", "sla_overdue_count", "deposit_liability_accuracy", "duplicate_confirm_rate"]) {
  requireValue(metricIds.has(expected), violations, "metric.required_metric_missing", `缺少关键观察指标 ${expected}。`, { expected });
}

const thresholds = observationMetric.thresholds ?? {};
requireValue(thresholds.evidenceMissingRateMax === 0.02, violations, "metric.observation_threshold_mismatch", "evidence_missing_rate 必须绑定 observation evidenceMissingRateMax。");
requireValue(thresholds.projectionLagP95MaxMinutes === 5, violations, "metric.observation_threshold_mismatch", "projection_lag_p95 必须绑定 observation projectionLagP95MaxMinutes。");
requireValue(thresholds.slaOverdueMax === 0, violations, "metric.observation_threshold_mismatch", "sla_overdue_count 必须绑定 observation slaOverdueMax。");

const failureIds = (contract.semanticFailureCases ?? []).map((item) => item.id);
for (const expected of ["metric_without_drilldown", "metric_without_owner"]) {
  requireValue(failureIds.includes(expected), violations, "metric.failure_case_missing", `缺少指标语义失败用例 ${expected}。`, { expected });
}

failIfViolations(checkId, violations, scannedFiles);
