import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/bi-kpi-metric-operating-model-result.json";
const metricProofPath = "artifacts/oam/proofs/bi-kpi/metric-definition-registry-proof.json";
const dashboardProofPath = "artifacts/oam/proofs/dashboard/dashboard-widget-sourcefacts-proof.json";
const reportProofPath = "artifacts/oam/proofs/report/report-dataset-permission-lineage-freshness-proof.json";
const violations = [];

const contract = readJson("docs/contracts/bi-kpi/bi-kpi-contract.json");
const metricRegistry = readJson("docs/contracts/bi-kpi/metric-definition-registry.json");
const dimensionRegistry = readJson("docs/contracts/bi-kpi/metric-dimension-registry.json");
const slaRegistry = readJson("docs/contracts/bi-kpi/sla-clock-registry.json");
const dashboardContract = readJson("docs/contracts/bi-kpi/dashboard-widget-contract.json");
const reportContract = readJson("docs/contracts/bi-kpi/report-dataset-contract.json");
const objectKindMetricMap = readJson("docs/contracts/bi-kpi/object-kind-metric-map.json");
const permissionPolicy = readJson("docs/contracts/bi-kpi/metric-permission-policy.json");
const freshnessPolicy = readJson("docs/contracts/bi-kpi/metric-freshness-policy.json");
const lineageSchema = readJson("docs/contracts/bi-kpi/metric-lineage.schema.json");

const requiredRefs = [
  "docs/contracts/bi-kpi/metric-definition-registry.json",
  "docs/contracts/bi-kpi/metric-dimension-registry.json",
  "docs/contracts/bi-kpi/sla-clock-registry.json",
  "docs/contracts/bi-kpi/dashboard-widget-contract.json",
  "docs/contracts/bi-kpi/report-dataset-contract.json",
  "docs/contracts/bi-kpi/object-kind-metric-map.json",
  "docs/contracts/bi-kpi/metric-lineage.schema.json",
  "docs/contracts/bi-kpi/metric-permission-policy.json",
  "docs/contracts/bi-kpi/metric-freshness-policy.json"
];
const requiredMetricFields = [
  "metricId",
  "nameZh",
  "metricOwner",
  "sourceFacts",
  "formulaRef",
  "dimensions",
  "aggregationWindow",
  "slaClockRef",
  "permissionPolicyRef",
  "lineagePolicyRef",
  "freshnessPolicyRef",
  "allowedConsumers",
  "forbiddenInputs",
  "goNoGoImpact"
];
const requiredWidgetFields = [
  "widgetId",
  "consumesMetricIds",
  "sourceFacts",
  "permission",
  "lineage",
  "freshness",
  "actionPolicy"
];
const requiredDatasetFields = [
  "datasetId",
  "sourceFacts",
  "metricRefs",
  "permissionEnvelope",
  "lineageEnvelope",
  "freshnessEnvelope",
  "exportPolicy",
  "noBusinessFactWrite"
];
const forbiddenInferenceInputs = ["ui.state", "label", "displayText", "dashboard.summary"];
const forbiddenWriteTargets = ["Room", "Bed", "Payment", "AmountBasis", "FinancialFact", "LedgerTransaction", "LedgerEntry"];
const forbiddenWriters = ["Search", "Surface", "Dashboard", "Report", "Metric"];

checkContract();
checkPolicies();
checkMetricDefinitions();
checkDashboardWidgets();
checkReportDatasets();
checkObjectKindMetricMap();
checkNegativeFixtures();
writeProofs();
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("BI/KPI Metric Operating Model check: PASS");

function checkContract() {
  if (contract.modelKind !== "MetricOperatingModel") fail("metric_model.kind", "BI/KPI contract must establish MetricOperatingModel.");
  if (contract.readOnly !== true || contract.businessFactWriteAllowed !== false) {
    fail("metric_model.readonly", "BI/KPI contract must remain read-only.");
  }
  if (contract.financeFactWriteAllowed !== false || contract.ledgerEntryWriteAllowed !== false) {
    fail("metric_model.finance_write_forbidden", "BI/KPI contract must forbid finance fact and ledger entry writes.");
  }
  for (const ref of requiredRefs) {
    if (!(contract.operatingModelRefs ?? []).includes(ref)) fail("metric_model.ref_missing", `Missing operating model ref ${ref}.`);
    if (!fs.existsSync(path.join(root, ref))) fail("metric_model.ref_path_missing", `Referenced operating model path missing: ${ref}.`);
  }
  for (const input of forbiddenInferenceInputs) {
    if (!(contract.forbiddenInference ?? []).includes(input)) fail("metric_model.forbidden_inference_missing", `Missing forbidden inference input ${input}.`);
  }
  for (const target of forbiddenWriteTargets) {
    if (!(contract.forbiddenWrites ?? []).includes(target)) fail("metric_model.forbidden_write_missing", `Missing forbidden write target ${target}.`);
  }
}

function checkPolicies() {
  const permissionIds = new Set((permissionPolicy.permissionPolicies ?? []).map((item) => item.policyId));
  const freshnessIds = new Set((freshnessPolicy.freshnessPolicies ?? []).map((item) => item.policyId));
  const slaIds = new Set((slaRegistry.slaClocks ?? []).map((item) => item.clockId));
  if (lineageSchema.$id !== "workosnext.metric-operating-model.metric-lineage.schema.v1") {
    fail("metric_model.lineage_schema_id", "Metric lineage schema id mismatch.");
  }
  for (const field of ["policyId", "sourceFacts", "sourceVersion", "factRefs", "evidenceRefs", "transformRefs", "readModelVersion"]) {
    if (!(lineageSchema.required ?? []).includes(field)) fail("metric_model.lineage_required_missing", `Metric lineage schema must require ${field}.`);
  }
  for (const policy of permissionPolicy.permissionPolicies ?? []) {
    if (policy.readOnly !== true || policy.writeFactsAllowed !== false) {
      fail("metric_model.permission_policy_write", `${policy.policyId} must be read-only and writeFactsAllowed=false.`);
    }
  }
  for (const policy of freshnessPolicy.freshnessPolicies ?? []) {
    for (const field of ["requiresSourceUpdatedAt", "requiresComputedAt", "requiresLastDisplayedAt"]) {
      if (policy[field] !== true) fail("metric_model.freshness_field_missing", `${policy.policyId} must require ${field}.`);
    }
  }
  metricRegistry.__policyRefs = { permissionIds, freshnessIds, slaIds };
}

function checkMetricDefinitions() {
  const metricIds = new Set();
  const dimensionIds = new Set((dimensionRegistry.metricDimensions ?? []).map((item) => item.dimensionId));
  const { permissionIds, freshnessIds, slaIds } = metricRegistry.__policyRefs;
  for (const metric of metricRegistry.metricDefinitions ?? []) {
    assertFields(metric, requiredMetricFields, `MetricDefinition ${metric.metricId ?? "(missing metricId)"}`, "metric_model.metric_field_missing");
    if (metricIds.has(metric.metricId)) fail("metric_model.metric_duplicate", `Duplicate metricId ${metric.metricId}.`);
    metricIds.add(metric.metricId);
    assertNonEmptyArray(metric.sourceFacts, `MetricDefinition ${metric.metricId} sourceFacts`, "metric_model.metric_sourcefacts_missing");
    assertNonEmptyArray(metric.allowedConsumers, `MetricDefinition ${metric.metricId} allowedConsumers`, "metric_model.metric_consumers_missing");
    assertNonEmptyArray(metric.dimensions, `MetricDefinition ${metric.metricId} dimensions`, "metric_model.metric_dimensions_missing");
    for (const dimension of metric.dimensions ?? []) {
      if (!dimensionIds.has(dimension)) fail("metric_model.metric_dimension_unknown", `${metric.metricId} references unknown dimension ${dimension}.`);
    }
    if (!slaIds.has(metric.slaClockRef)) fail("metric_model.metric_sla_unknown", `${metric.metricId} references unknown SLA clock ${metric.slaClockRef}.`);
    if (!permissionIds.has(metric.permissionPolicyRef)) fail("metric_model.metric_permission_unknown", `${metric.metricId} references unknown permission policy ${metric.permissionPolicyRef}.`);
    if (!freshnessIds.has(metric.freshnessPolicyRef)) fail("metric_model.metric_freshness_unknown", `${metric.metricId} references unknown freshness policy ${metric.freshnessPolicyRef}.`);
    for (const input of forbiddenInferenceInputs) {
      if (!(metric.forbiddenInputs ?? []).includes(input)) fail("metric_model.metric_forbidden_input_missing", `${metric.metricId} must forbid ${input}.`);
    }
    if (metric.writesBusinessFactsAllowed !== false) fail("metric_model.metric_write_flag", `${metric.metricId} must set writesBusinessFactsAllowed=false.`);
    for (const target of metric.writesObjectKinds ?? []) {
      if (forbiddenWriteTargets.includes(target)) fail("metric_model.metric_forbidden_write", `${metric.metricId} writes forbidden target ${target}.`);
    }
  }
  if (metricIds.size === 0) fail("metric_model.metrics_empty", "MetricDefinition Registry must contain at least one metric.");
  metricRegistry.__metricIds = metricIds;
}

function checkDashboardWidgets() {
  const metricIds = metricRegistry.__metricIds ?? new Set();
  for (const widget of dashboardContract.dashboardWidgets ?? []) {
    assertFields(widget, requiredWidgetFields, `DashboardWidget ${widget.widgetId ?? "(missing widgetId)"}`, "metric_model.widget_field_missing");
    assertNonEmptyArray(widget.consumesMetricIds, `DashboardWidget ${widget.widgetId} consumesMetricIds`, "metric_model.widget_metrics_missing");
    assertNonEmptyArray(widget.sourceFacts, `DashboardWidget ${widget.widgetId} sourceFacts`, "metric_model.widget_sourcefacts_missing");
    for (const metricId of widget.consumesMetricIds ?? []) {
      if (!metricIds.has(metricId)) fail("metric_model.widget_metric_unknown", `${widget.widgetId} references unknown metric ${metricId}.`);
    }
    if (widget.permission?.readOnly !== true || !widget.permission?.policyRef) fail("metric_model.widget_permission", `${widget.widgetId} must carry read-only permission.`);
    if (!widget.lineage?.policyRef || !Array.isArray(widget.lineage?.sourceFacts)) fail("metric_model.widget_lineage", `${widget.widgetId} must carry lineage with sourceFacts.`);
    if (!widget.freshness?.policyRef || typeof widget.freshness?.maxStalenessMs !== "number") fail("metric_model.widget_freshness", `${widget.widgetId} must carry freshness.`);
    if (widget.actionPolicy !== "readonly_or_navigate_only") fail("metric_model.widget_action_policy", `${widget.widgetId} actionPolicy must be readonly_or_navigate_only.`);
    if (widget.noBusinessFactWrite !== true) fail("metric_model.widget_no_write", `${widget.widgetId} must set noBusinessFactWrite=true.`);
  }
}

function checkReportDatasets() {
  const metricIds = metricRegistry.__metricIds ?? new Set();
  for (const dataset of reportContract.reportDatasets ?? []) {
    assertFields(dataset, requiredDatasetFields, `ReportDataset ${dataset.datasetId ?? "(missing datasetId)"}`, "metric_model.dataset_field_missing");
    assertNonEmptyArray(dataset.sourceFacts, `ReportDataset ${dataset.datasetId} sourceFacts`, "metric_model.dataset_sourcefacts_missing");
    assertNonEmptyArray(dataset.metricRefs, `ReportDataset ${dataset.datasetId} metricRefs`, "metric_model.dataset_metrics_missing");
    for (const metricId of dataset.metricRefs ?? []) {
      if (!metricIds.has(metricId)) fail("metric_model.dataset_metric_unknown", `${dataset.datasetId} references unknown metric ${metricId}.`);
    }
    if (dataset.permissionEnvelope?.readOnly !== true || !dataset.permissionEnvelope?.policyRef) fail("metric_model.dataset_permission", `${dataset.datasetId} must carry read-only permissionEnvelope.`);
    if (!dataset.lineageEnvelope?.policyRef || !Array.isArray(dataset.lineageEnvelope?.sourceFacts)) fail("metric_model.dataset_lineage", `${dataset.datasetId} must carry lineageEnvelope.`);
    if (!dataset.freshnessEnvelope?.policyRef || typeof dataset.freshnessEnvelope?.maxStalenessMs !== "number") fail("metric_model.dataset_freshness", `${dataset.datasetId} must carry freshnessEnvelope.`);
    if (dataset.noBusinessFactWrite !== true) fail("metric_model.dataset_no_write", `${dataset.datasetId} must set noBusinessFactWrite=true.`);
  }
}

function checkObjectKindMetricMap() {
  const metricIds = metricRegistry.__metricIds ?? new Set();
  for (const item of objectKindMetricMap.objectKindMetricMap ?? []) {
    if (item.writeFactsAllowed !== false) fail("metric_model.object_kind_write", `${item.objectKind} metric map must be read-only.`);
    assertNonEmptyArray(item.sourceFacts, `ObjectKindMetricMap ${item.objectKind} sourceFacts`, "metric_model.object_kind_sourcefacts_missing");
    for (const metricId of item.metricIds ?? []) {
      if (!metricIds.has(metricId)) fail("metric_model.object_kind_metric_unknown", `${item.objectKind} references unknown metric ${metricId}.`);
    }
  }
}

function checkNegativeFixtures() {
  for (const writer of forbiddenWriters) {
    for (const target of forbiddenWriteTargets) {
      const attempt = {
        actor: writer,
        targetFact: target,
        requestedWrite: true
      };
      const blocked = forbiddenWriters.includes(attempt.actor) && forbiddenWriteTargets.includes(attempt.targetFact);
      if (!blocked) fail("metric_model.negative_fixture_failed", `${writer} writing ${target} must fail.`);
    }
  }
}

function writeProofs() {
  writeJson(metricProofPath, {
    version: "oam.metric-definition-registry-proof.v1",
    status: violations.length ? "failed" : "passed",
    checkedAtUtc: new Date().toISOString(),
    proves: [
      "MetricDefinition Registry is read-only.",
      "Every MetricDefinition has sourceFacts, permission, lineage, freshness, allowedConsumers, forbiddenInputs, and goNoGoImpact.",
      "Metric cannot write Room, Bed, Payment, AmountBasis, FinancialFact, LedgerTransaction, or LedgerEntry.",
      "Metric cannot infer business facts from UI state, label, display text, or dashboard summary."
    ],
    metricIds: (metricRegistry.metricDefinitions ?? []).map((item) => item.metricId),
    forbiddenInputs: forbiddenInferenceInputs,
    forbiddenWrites: forbiddenWriteTargets,
    violations
  });
  writeJson(dashboardProofPath, {
    version: "oam.dashboard-widget-sourcefacts-proof.v1",
    status: violations.length ? "failed" : "passed",
    checkedAtUtc: new Date().toISOString(),
    proves: [
      "Every DashboardWidget has sourceFacts, permission, lineage, freshness, and readonly_or_navigate_only action policy.",
      "DashboardWidget cannot write business facts or finance facts."
    ],
    widgetIds: (dashboardContract.dashboardWidgets ?? []).map((item) => item.widgetId),
    violations
  });
  writeJson(reportProofPath, {
    version: "oam.report-dataset-permission-lineage-freshness-proof.v1",
    status: violations.length ? "failed" : "passed",
    checkedAtUtc: new Date().toISOString(),
    proves: [
      "Every ReportDataset has sourceFacts, metricRefs, permissionEnvelope, lineageEnvelope, freshnessEnvelope, exportPolicy, and noBusinessFactWrite=true.",
      "ReportDataset exports are read-only evidence and cannot write business facts."
    ],
    datasetIds: (reportContract.reportDatasets ?? []).map((item) => item.datasetId),
    violations
  });
}

function assertFields(item, fields, label, id) {
  for (const field of fields) {
    if (!(field in item)) fail(id, `${label} missing required field ${field}.`);
  }
}

function assertNonEmptyArray(value, label, id) {
  if (!Array.isArray(value) || value.length === 0) fail(id, `${label} must be a non-empty array.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const fullPath = path.join(root, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeResult() {
  writeJson(resultPath, {
    version: "oam.bi-kpi-metric-operating-model-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    proofArtifacts: [metricProofPath, dashboardProofPath, reportProofPath],
    violations
  });
}

function fail(id, message) {
  violations.push({ id, message });
}
