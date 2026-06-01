import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = readArg("--out=", ".tmp/rt4/operating-feedback-loop-report.json");
const metricPolicyPath = "docs/operations/metric-deviation-policy.yml";
const riskPolicyPath = "docs/operations/risk-signal-policy.yml";
const loopDocPath = "docs/operations/operating-feedback-loop.md";
const registryPath = "docs/business/business-line-registry.json";
const requiredMetricIds = [
  "salableBedNightConversionEfficiency",
  "checkinProcessingDuration",
  "checkoutTurnoverDuration",
  "serviceTaskCompletionDuration",
  "unconfirmedPaymentAmount",
  "depositLiabilityAccuracy",
  "outstandingBalance",
  "reconciliationExceptionRate",
  "evidenceMissingRate",
  "duplicateConfirmRate",
  "blockedBedDays",
  "overdueTaskCount",
  "exceptionClosureRate",
  "slaAchievementRate",
  "periodActionCompletionRate"
];

if (process.argv.includes("--self-test")) {
  const invalid = validatePolicies(
    {
      metrics: [{ metricId: "salableBedNightConversionEfficiency", source: "Lens" }],
      deviationRules: [{ ruleId: "bad", metricIds: ["salableBedNightConversionEfficiency"], createsRiskSignal: false, riskSignalType: "missing" }]
    },
    { riskSignals: [], closedLoopAssertions: { riskSignalCreatesWorkItem: false } },
    registryFixture()
  );
  assert(invalid.some((item) => item.id === "rtf.metric_missing"), "self-test must catch missing metrics");
  assert(invalid.some((item) => item.id === "rtf.metric_contract_incomplete"), "self-test must catch incomplete metric contract");
  assert(invalid.some((item) => item.id === "rtf.deviation_does_not_create_risk_signal"), "self-test must catch deviation without risk signal");
  assert(invalid.some((item) => item.id === "rtf.risk_signal_missing"), "self-test must catch missing risk signal policy");
  assert(invalid.some((item) => item.id === "rtf.closed_loop_assertion_missing"), "self-test must catch missing closed-loop assertion");
  console.log("Operating Feedback Loop self-test: PASS");
  process.exit(0);
}

const metricPolicy = readJson(metricPolicyPath);
const riskPolicy = readJson(riskPolicyPath);
const registry = readJson(registryPath);
const violations = [
  ...validatePolicies(metricPolicy, riskPolicy, registry),
  ...validateLoopDocument()
];

writeReport(violations, [metricPolicyPath, riskPolicyPath, loopDocPath, registryPath]);
if (violations.length > 0) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Operating Feedback Loop check failed.");
}

console.log("Operating Feedback Loop check: PASS");

function validatePolicies(metricPolicy, riskPolicy, registry) {
  const violations = [];
  validateMetrics(metricPolicy, violations);
  validateDeviationRules(metricPolicy, riskPolicy, violations);
  validateRiskSignals(riskPolicy, violations);
  validateClosedLoopAssertions(riskPolicy, violations);
  validateBusinessLineBoundary(registry, riskPolicy, violations);
  return violations;
}

function validateMetrics(metricPolicy, violations) {
  const metrics = metricPolicy.metrics ?? [];
  const byId = new Map(metrics.map((metric) => [metric.metricId, metric]));
  for (const metricId of requiredMetricIds) {
    const metric = byId.get(metricId);
    if (!metric) {
      violations.push(violation("rtf.metric_missing", `Metric ${metricId} missing from deviation policy.`, { metricId }));
      continue;
    }
    for (const field of ["source", "freshness", "owner", "stalePolicy", "correctionWorkItem", "freezePolicy", "deviationRiskSignal"]) {
      if (!metric[field]) {
        violations.push(violation("rtf.metric_contract_incomplete", `Metric ${metricId} missing ${field}.`, { metricId, field }));
      }
    }
  }
}

function validateDeviationRules(metricPolicy, riskPolicy, violations) {
  const riskSignalTypes = new Set((riskPolicy.riskSignals ?? []).map((risk) => risk.riskSignalType));
  const coveredMetrics = new Set();
  for (const rule of metricPolicy.deviationRules ?? []) {
    if (rule.createsRiskSignal !== true) {
      violations.push(violation("rtf.deviation_does_not_create_risk_signal", `Deviation rule ${rule.ruleId} must create RiskSignal.`, { ruleId: rule.ruleId }));
    }
    if (!rule.riskSignalType || !riskSignalTypes.has(rule.riskSignalType)) {
      violations.push(violation("rtf.risk_signal_missing", `Deviation rule ${rule.ruleId} references missing RiskSignal policy.`, { ruleId: rule.ruleId, riskSignalType: rule.riskSignalType }));
    }
    for (const metricId of rule.metricIds ?? []) {
      coveredMetrics.add(metricId);
    }
  }
  for (const metricId of requiredMetricIds) {
    if (!coveredMetrics.has(metricId)) {
      violations.push(violation("rtf.metric_not_covered_by_deviation_rule", `Metric ${metricId} is not covered by deviation rules.`, { metricId }));
    }
  }
}

function validateRiskSignals(riskPolicy, violations) {
  for (const risk of riskPolicy.riskSignals ?? []) {
    for (const field of ["owner", "sla", "escalation", "generatedWorkItemType", "resolutionEvent", "lensUpdate", "periodReview", "trainingUpdate", "policyUpdate"]) {
      if (!risk[field]) {
        violations.push(violation("rtf.risk_signal_contract_incomplete", `RiskSignal ${risk.riskSignalType ?? "unknown"} missing ${field}.`, { riskSignalType: risk.riskSignalType, field }));
      }
    }
    if (risk.correctionWorkItemRequired !== true) {
      violations.push(violation("rtf.correction_workitem_not_required", `RiskSignal ${risk.riskSignalType} must require correction WorkItem.`, { riskSignalType: risk.riskSignalType }));
    }
  }
}

function validateClosedLoopAssertions(riskPolicy, violations) {
  const assertions = riskPolicy.closedLoopAssertions ?? {};
  for (const assertion of [
    "metricDeviationCreatesRiskSignal",
    "riskSignalCreatesWorkItem",
    "workItemHasOwnerSlaEscalation",
    "resolutionEventUpdatesLens",
    "periodReviewFreezesResult",
    "repeatedRiskLinksTrainingOrPolicy",
    "wrongMetricCreatesCorrectionWorkItem"
  ]) {
    if (assertions[assertion] !== true) {
      violations.push(violation("rtf.closed_loop_assertion_missing", `Closed-loop assertion ${assertion} must be true.`, { assertion }));
    }
  }
  if (assertions.managementCockpitWritesBusinessFacts !== false) {
    violations.push(violation("rtf.management_cockpit_can_write_fact", "ManagementCockpit must not write business facts."));
  }
  if (assertions.repairPartsHrProductionAllowed !== false) {
    violations.push(violation("rtf.downstream_production_enabled", "Repair / Parts / HR must remain non-production."));
  }
}

function validateBusinessLineBoundary(registry, riskPolicy, violations) {
  for (const lineId of ["repair", "parts", "hr"]) {
    const line = (registry.businessLines ?? []).find((item) => item.businessLineId === lineId);
    if (!line || line.level !== "L0 Contract Preview" || line.productionAllowed !== false || line.productionConfirmAllowed !== false) {
      violations.push(violation("rtf.downstream_line_not_l0", `${lineId} must remain L0 Contract Preview with production disabled.`, { businessLineId: lineId }));
    }
  }
  if (riskPolicy.closedLoopAssertions?.repairPartsHrProductionAllowed !== false) {
    violations.push(violation("rtf.feedback_loop_enables_downstream_production", "Operating feedback loop must not enable Repair / Parts / HR production."));
  }
}

function validateLoopDocument() {
  const text = fs.readFileSync(path.join(root, loopDocPath), "utf8");
  const violations = [];
  for (const phrase of ["MetricDeviation", "RiskSignal", "WorkItem", "ResolutionEvent", "Lens update", "PeriodReview", "Training / Policy update"]) {
    if (!text.includes(phrase)) {
      violations.push(violation("rtf.loop_doc_axis_missing", `Feedback loop doc missing ${phrase}.`, { phrase }));
    }
  }
  if (!text.includes("Management Cockpit") || !text.includes("不能直接写业务事实")) {
    violations.push(violation("rtf.loop_doc_boundary_missing", "Feedback loop doc must state Management Cockpit cannot directly write business facts."));
  }
  return violations;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeReport(violations, scannedFiles) {
  const reportPath = path.join(root, out);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({
    generated_at_utc: new Date().toISOString(),
    generated_by: "check-operating-feedback-loop",
    status: violations.length === 0 ? "passed" : "failed",
    scanned_files: scannedFiles,
    violation_count: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function registryFixture() {
  return {
    businessLines: [
      { businessLineId: "repair", level: "L0 Contract Preview", productionAllowed: false, productionConfirmAllowed: false },
      { businessLineId: "parts", level: "L0 Contract Preview", productionAllowed: false, productionConfirmAllowed: false },
      { businessLineId: "hr", level: "L0 Contract Preview", productionAllowed: false, productionConfirmAllowed: false }
    ]
  };
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
