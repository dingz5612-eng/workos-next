import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = readArg("--out=", ".tmp/rt4/operating-control-tower-report.json");
const specPath = "docs/business/operating-control-tower.yml";
const registryPath = "docs/business/business-line-registry.json";
const pcGovernanceViewPath = "apps/mobile/src/views/pcGovernanceView.js";
const appRouterPath = "apps/mobile/src/appRouter.js";
const pcRouteTreePath = "apps/mobile/src/pcRouteTree.js";
const requiredSections = [
  "businessLineAdmissionGate",
  "operatingGoalTree",
  "workItemOperatingModel",
  "riskCommandCenter",
  "financeControlTower",
  "managerControlTower",
  "opxGoldenDomainControlBoard",
  "releaseFlightDeckAcceptancePanels",
  "operatingRhythmCalendar",
  "launchDrillAndGoNoGo",
  "trainingAndBehaviorFeedback",
  "repairL0IncubationRoadmap"
];
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
const metricRequiredFields = [
  "ownerRole",
  "source",
  "workItemType",
  "sla",
  "escalation",
  "affectedFact",
  "requiredEvidence",
  "producedEvent",
  "ledgerImpact",
  "lens",
  "audit",
  "certificationScenario"
];
const managerQueues = ["risk", "overdue", "evidence", "finance", "sync"];

if (process.argv.includes("--self-test")) {
  const invalidMetric = validateSpec({
    statusBoundary: { businessProductionAllowed: false },
    businessLineAdmissionGate: { levels: ["L0 Contract Preview"] },
    operatingGoalTree: { metrics: [] },
    workItemOperatingModel: { p0OperatingTasks: [] },
    riskCommandCenter: { canGenerateWorkItem: false, risks: [] },
    financeControlTower: { amountFields: [] },
    managerControlTower: { visibleQueues: [] },
    opxGoldenDomainControlBoard: { machineSourceOnly: false, sourceRefs: [] },
    releaseFlightDeckAcceptancePanels: [],
    operatingRhythmCalendar: [],
    launchDrillAndGoNoGo: {},
    trainingAndBehaviorFeedback: {},
    repairL0IncubationRoadmap: { productionAllowed: true }
  }, registryFixture());
  assert(invalidMetric.some((item) => item.id === "rt6.metric_missing"), "self-test must catch missing required metrics");
  assert(invalidMetric.some((item) => item.id === "rt6.risk_workitem_generation_missing"), "self-test must catch risk without WorkItem generation");
  assert(invalidMetric.some((item) => item.id === "rt6.control_board_not_machine_sourced"), "self-test must catch PR-body style control board");
  assert(invalidMetric.some((item) => item.id === "rt6.repair_l0_production_enabled"), "self-test must catch Repair L0 production drift");

  const invalidFinance = validateSpec({
    ...validSpecFixture(),
    financeControlTower: { amountFields: [{ field: "depositLiabilityBalance", workItemRef: "Dorm.DepositConfirm" }] }
  }, registryFixture());
  assert(invalidFinance.some((item) => item.id === "rt6.finance_amount_trace_incomplete"), "self-test must catch incomplete finance trace");
  console.log("Operating Control Tower self-test: PASS");
  process.exit(0);
}

const spec = readJson(specPath);
const registry = readJson(registryPath);
const violations = [
  ...validateSpec(spec, registry),
  ...validateSurfaceFiles()
];

writeReport(violations, [specPath, registryPath, pcGovernanceViewPath, appRouterPath, pcRouteTreePath]);
if (violations.length > 0) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Operating Control Tower check failed.");
}

console.log("Operating Control Tower check: PASS");

function validateSpec(spec, registry) {
  const violations = [];

  for (const section of requiredSections) {
    if (spec[section] === undefined) {
      violations.push(violation("rt6.section_missing", `Operating Control Tower missing section ${section}.`, { section }));
    }
  }

  if (spec.statusBoundary?.businessProductionAllowed !== false || spec.statusBoundary?.dormitoryL2ProductionAllowed !== false) {
    violations.push(violation("rt6.production_boundary_missing", "RT-6 must keep Business Production and Dormitory L2 Production blocked."));
  }

  validateAdmission(spec, registry, violations);
  validateMetrics(spec.operatingGoalTree?.metrics ?? [], violations);
  validateWorkItems(spec, violations);
  validateRiskCommand(spec, violations);
  validateFinanceTower(spec, violations);
  validateManagerTower(spec, violations);
  validateMachineSourcedControl(spec, violations);
  validateReleasePanels(spec, violations);
  validateLaunchAndTraining(spec, violations);

  if (spec.repairL0IncubationRoadmap?.level !== "L0 Contract Preview" || spec.repairL0IncubationRoadmap?.productionAllowed !== false) {
    violations.push(violation("rt6.repair_l0_production_enabled", "Repair incubation roadmap must remain L0 Contract Preview with productionAllowed=false."));
  }

  return violations;
}

function validateAdmission(spec, registry, violations) {
  const levels = spec.businessLineAdmissionGate?.levels ?? [];
  for (const level of ["L0 Contract Preview", "L1 Pilot", "L2 Production", "L3 Scaled Operation"]) {
    if (!levels.includes(level)) {
      violations.push(violation("rt6.business_line_level_missing", `Business line level missing: ${level}.`, { level }));
    }
  }

  const registryLines = registry.businessLines ?? [];
  for (const lineId of ["repair", "parts", "hr"]) {
    const line = registryLines.find((item) => item.businessLineId === lineId);
    if (!line || line.level !== "L0 Contract Preview" || line.productionAllowed !== false || line.productionConfirmAllowed !== false) {
      violations.push(violation("rt6.downstream_line_not_l0", `${lineId} must stay L0 Contract Preview and production-disabled.`, { businessLineId: lineId }));
    }
  }

  const l0Rules = spec.businessLineAdmissionGate?.l0Rules ?? {};
  for (const flag of ["productionConfirmAllowed", "productionLikeSurfaceAllowed", "readyOrBlockedCardsAllowed"]) {
    if (l0Rules[flag] !== false) {
      violations.push(violation("rt6.l0_runtime_surface_not_blocked", `L0 rule ${flag} must be false.`, { flag }));
    }
  }
}

function validateMetrics(metrics, violations) {
  const byId = new Map(metrics.map((item) => [item.metricId, item]));
  for (const metricId of requiredMetricIds) {
    if (!byId.has(metricId)) {
      violations.push(violation("rt6.metric_missing", `Operating metric ${metricId} is missing.`, { metricId }));
      continue;
    }
    const metric = byId.get(metricId);
    for (const field of metricRequiredFields) {
      const value = metric[field];
      if (Array.isArray(value) ? value.length === 0 : !value) {
        violations.push(violation("rt6.metric_binding_incomplete", `Metric ${metricId} missing ${field}.`, { metricId, field }));
      }
    }
    if (metric.factTraceRequired !== true) {
      violations.push(violation("rt6.metric_fact_trace_missing", `Metric ${metricId} must require FactTrace.`, { metricId }));
    }
  }
}

function validateWorkItems(spec, violations) {
  const metrics = spec.operatingGoalTree?.metrics ?? [];
  const tasks = spec.workItemOperatingModel?.p0OperatingTasks ?? [];
  const requiredFields = spec.workItemOperatingModel?.requiredFields ?? [];
  for (const field of ["ownerRole", "sla", "escalation", "affectedFact", "requiredEvidence", "producedEvent", "ledgerImpact", "factTraceRequired", "certificationScenario"]) {
    if (!requiredFields.includes(field)) {
      violations.push(violation("rt6.workitem_required_field_missing", `WorkItem operating model must require ${field}.`, { field }));
    }
  }
  for (const task of tasks) {
    const metric = metrics.find((item) => item.workItemType === task);
    if (!metric) {
      violations.push(violation("rt6.p0_task_not_bound_to_metric", `P0 operating task ${task} is not bound to an operating metric.`, { workItemType: task }));
    }
  }
}

function validateRiskCommand(spec, violations) {
  if (spec.riskCommandCenter?.canGenerateWorkItem !== true) {
    violations.push(violation("rt6.risk_workitem_generation_missing", "Risk Command Center must be able to generate WorkItems."));
  }
  for (const risk of spec.riskCommandCenter?.risks ?? []) {
    for (const field of ["ownerRole", "dueAtPolicy", "recommendedAction", "generatedWorkItemType", "relatedFactOrGate"]) {
      if (!risk[field]) {
        violations.push(violation("rt6.risk_action_incomplete", `Risk ${risk.riskId ?? "unknown"} missing ${field}.`, { riskId: risk.riskId, field }));
      }
    }
  }
}

function validateFinanceTower(spec, violations) {
  for (const field of spec.financeControlTower?.amountFields ?? []) {
    for (const key of ["workItemRef", "evidenceRef", "approverRef", "ledgerRef", "snapshotRef"]) {
      if (!field[key]) {
        violations.push(violation("rt6.finance_amount_trace_incomplete", `Finance amount field ${field.field ?? "unknown"} missing ${key}.`, { field: field.field, key }));
      }
    }
  }
}

function validateManagerTower(spec, violations) {
  const queues = spec.managerControlTower?.visibleQueues ?? [];
  for (const queue of managerQueues) {
    if (!queues.includes(queue)) {
      violations.push(violation("rt6.manager_queue_missing", `Manager Control Tower must show ${queue}.`, { queue }));
    }
  }
  for (const action of ["assignOwner", "setDueAt", "recommendAction", "trackSla", "verifyResult", "enterPeriodReview"]) {
    if (!(spec.managerControlTower?.actions ?? []).includes(action)) {
      violations.push(violation("rt6.manager_action_missing", `Manager Control Tower missing action ${action}.`, { action }));
    }
  }
}

function validateMachineSourcedControl(spec, violations) {
  const board = spec.opxGoldenDomainControlBoard ?? {};
  const sourceText = JSON.stringify(board.sourceRefs ?? []);
  if (board.machineSourceOnly !== true || !sourceText.includes("GateResult") || !sourceText.includes("checkerOutput") || !sourceText.includes("evidence-graph")) {
    violations.push(violation("rt6.control_board_not_machine_sourced", "OPX control board must read GateResult, checker output, and evidence graph, not PR text."));
  }
  const forbidden = JSON.stringify(board.forbiddenSourceRefs ?? []);
  if (!forbidden.includes("PR body") || !forbidden.includes("manual PASS")) {
    violations.push(violation("rt6.control_board_forbidden_sources_missing", "OPX control board must forbid PR body and manual PASS evidence."));
  }
}

function validateReleasePanels(spec, violations) {
  const panels = spec.releaseFlightDeckAcceptancePanels ?? [];
  for (const source of ["GateResult", "checkerOutput", "evidenceGraph"]) {
    if (!panels.some((panel) => panel.source === source)) {
      violations.push(violation("rt6.release_panel_source_missing", `Release Flight Deck missing ${source} panel.`, { source }));
    }
  }
  for (const panel of panels) {
    for (const field of ["evidenceFile", "owner", "nextAction"]) {
      if (!panel[field]) {
        violations.push(violation("rt6.release_panel_incomplete", `Release panel ${panel.panelId ?? "unknown"} missing ${field}.`, { panelId: panel.panelId, field }));
      }
    }
  }
}

function validateLaunchAndTraining(spec, violations) {
  const launchText = JSON.stringify(spec.launchDrillAndGoNoGo ?? {});
  for (const required of ["BStageGateResult", "RuntimeInvariantCheck", "ShadowCompareReport", "RollbackInstruction", "BusinessSignoff"]) {
    if (!launchText.includes(required)) {
      violations.push(violation("rt6.launch_gate_input_missing", `Launch drill missing ${required}.`, { required }));
    }
  }
  if (spec.launchDrillAndGoNoGo?.missingRollbackBlocks !== true || spec.launchDrillAndGoNoGo?.redShadowBlocks !== true) {
    violations.push(violation("rt6.launch_gate_blockers_missing", "Launch drill must block missing rollback and red shadow."));
  }
  for (const role of ["frontdesk", "finance", "housekeeping", "manager", "admin", "releaseOwner"]) {
    if (!(spec.trainingAndBehaviorFeedback?.roles ?? []).includes(role)) {
      violations.push(violation("rt6.training_role_missing", `Training feedback missing role ${role}.`, { role }));
    }
  }
}

function validateSurfaceFiles() {
  const violations = [];
  const router = fs.readFileSync(path.join(root, appRouterPath), "utf8");
  const pcRouteTree = fs.readFileSync(path.join(root, pcRouteTreePath), "utf8");
  const routeSources = `${router}\n${pcRouteTree}`;
  for (const route of ["managerControlTower", "financeControl", "releaseFlightDeck", "governanceCenter"]) {
    if (!routeSources.includes(route)) {
      violations.push(violation("rt6.role_home_route_missing", `Mobile/PC route tree missing role default route ${route}.`, { route }));
    }
  }
  if (!router.includes("routePcSurface") || !router.includes("isPcSurfaceView")) {
    violations.push(violation("rt6.pc_surface_route_boundary_missing", "App router must delegate PC surfaces to the PC route tree instead of mixing them into ordinary mobile routes."));
  }

  const view = fs.readFileSync(path.join(root, pcGovernanceViewPath), "utf8");
  for (const marker of ["data-production-observability", "Work Management", "RiskCommand", "Release Control Center", "GateResult"]) {
    if (!view.includes(marker)) {
      violations.push(violation("rt6.control_tower_surface_missing", `PC governance surface missing ${marker}.`, { marker }));
    }
  }
  if (!view.includes("does not write business facts")) {
    violations.push(violation("rt6.management_cockpit_boundary_missing", "Management surface must state it reads and routes without writing business facts."));
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
    generated_by: "check-operating-control-tower",
    status: violations.length === 0 ? "passed" : "failed",
    scanned_files: scannedFiles,
    violation_count: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function validSpecFixture() {
  const metric = (metricId, workItemType = "Dorm.ExceptionResolve") => ({
    metricId,
    ownerRole: "Owner",
    source: "Lens",
    workItemType,
    sla: "1h",
    escalation: "Escalation",
    affectedFact: "Fact",
    requiredEvidence: ["evidence"],
    producedEvent: "Event",
    ledgerImpact: "none",
    lens: "Lens",
    audit: "Audit",
    factTraceRequired: true,
    certificationScenario: "dorm-cert-001"
  });
  return {
    statusBoundary: { businessProductionAllowed: false, dormitoryL2ProductionAllowed: false },
    businessLineAdmissionGate: {
      levels: ["L0 Contract Preview", "L1 Pilot", "L2 Production", "L3 Scaled Operation"],
      l0Rules: { productionConfirmAllowed: false, productionLikeSurfaceAllowed: false, readyOrBlockedCardsAllowed: false }
    },
    operatingGoalTree: { metrics: requiredMetricIds.map((id, index) => metric(id, index === 0 ? "Dorm.ReservationConfirm" : "Dorm.ExceptionResolve")) },
    workItemOperatingModel: {
      requiredFields: ["ownerRole", "sla", "escalation", "affectedFact", "requiredEvidence", "producedEvent", "ledgerImpact", "factTraceRequired", "certificationScenario"],
      p0OperatingTasks: ["Dorm.ReservationConfirm"]
    },
    riskCommandCenter: { canGenerateWorkItem: true, risks: [{ riskId: "risk", ownerRole: "Owner", dueAtPolicy: "1h", recommendedAction: "act", generatedWorkItemType: "Dorm.ExceptionResolve", relatedFactOrGate: "Fact" }] },
    financeControlTower: { amountFields: [{ field: "amount", workItemRef: "wi", evidenceRef: "ev", approverRef: "approver", ledgerRef: "ledger", snapshotRef: "snapshot" }] },
    managerControlTower: { visibleQueues: managerQueues, actions: ["assignOwner", "setDueAt", "recommendAction", "trackSla", "verifyResult", "enterPeriodReview"] },
    opxGoldenDomainControlBoard: { machineSourceOnly: true, sourceRefs: ["GateResult", "checkerOutput", "evidence-graph"], forbiddenSourceRefs: ["PR body", "manual PASS"] },
    releaseFlightDeckAcceptancePanels: [
      { panelId: "gate", source: "GateResult", evidenceFile: "gate.json", owner: "owner", nextAction: "act" },
      { panelId: "checker", source: "checkerOutput", evidenceFile: "checker.json", owner: "owner", nextAction: "act" },
      { panelId: "graph", source: "evidenceGraph", evidenceFile: "graph.json", owner: "owner", nextAction: "act" }
    ],
    launchDrillAndGoNoGo: { reads: ["BStageGateResult", "RuntimeInvariantCheck", "ShadowCompareReport", "RollbackInstruction", "BusinessSignoff"], missingRollbackBlocks: true, redShadowBlocks: true },
    trainingAndBehaviorFeedback: { roles: ["frontdesk", "finance", "housekeeping", "manager", "admin", "releaseOwner"] },
    repairL0IncubationRoadmap: { level: "L0 Contract Preview", productionAllowed: false }
  };
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
