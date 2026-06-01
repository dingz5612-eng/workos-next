import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredTasks = [
  "RF4",
  "RF5",
  "RF6",
  "RF7",
  "RF8",
  "RT-X",
  "RT-0",
  "RT-1",
  "RT-DB",
  "RT-2",
  "RT-2A",
  "RT-P",
  "RT-3",
  "RT-S",
  "RT-B",
  "RT-4",
  "RT-5",
  "RT-6",
  "RT-F",
  "RT-FINAL"
];
const paths = {
  result: "artifacts/rt4/final-completion-assurance-result.json",
  report: "docs/program/rt4/final-completion-assurance-report.md",
  dashboardJson: "artifacts/rt4/completion-dashboard.json",
  dashboardMd: "docs/program/rt4/completion-dashboard.md",
  graph: "artifacts/rt4/evidence-graph.json",
  matrix: "docs/program/rt4/six-file-requirement-matrix.yml",
  branchMatrix: "docs/program/rt4/stacked-branch-matrix.yml",
  centralPlan: "docs/program/rt4/central-merge-plan.md"
};

const violations = [];
for (const [name, relativePath] of Object.entries(paths)) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    violations.push(violation("rtfinal.file_missing", `Required ${name} file is missing: ${relativePath}.`, { file: relativePath }));
  }
}

if (violations.length === 0) {
  const result = readJson(paths.result);
  const dashboard = readJson(paths.dashboardJson);
  const graph = readJson(paths.graph);
  const matrix = readJson(paths.matrix);
  const branchMatrix = readJson(paths.branchMatrix);
  const reportText = fs.readFileSync(path.join(root, paths.report), "utf8");
  const planText = fs.readFileSync(path.join(root, paths.centralPlan), "utf8");

  validateResult(result);
  validateCoverage(matrix, result);
  validateBranchMatrix(branchMatrix, result);
  validateGraph(graph, branchMatrix);
  validateDashboard(dashboard);
  validateReport(reportText);
  validateCentralPlan(planText);
}

if (violations.length > 0) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Final completion assurance check failed.");
}

console.log("Final completion assurance check: PASS");

function validateResult(result) {
  if (result.stage !== "RT-FINAL") {
    violations.push(violation("rtfinal.stage_mismatch", "Final result stage must be RT-FINAL."));
  }
  if (result.localStatus !== "LOCAL_PASSED" || result.stackedStatus !== "STACKED_READY" || result.officialStatus !== "LOCKED_UNTIL_CENTRAL_MERGE") {
    violations.push(violation("rtfinal.status_boundary_wrong", "RT-FINAL result must stay LOCAL_PASSED / STACKED_READY / LOCKED_UNTIL_CENTRAL_MERGE."));
  }
  for (const flag of ["businessProductionAllowed", "dormitoryL2ProductionAllowed", "dormIntAllowed", "l1InternalPilotAllowed"]) {
    if (result[flag] !== false) {
      violations.push(violation("rtfinal.production_or_dormint_enabled", `${flag} must be false before Central Merge Train and DORM-INT.`, { flag }));
    }
  }
  if (result.repairPartsHrStatus !== "L0 Contract Preview") {
    violations.push(violation("rtfinal.downstream_line_not_l0", "Repair / Parts / HR must remain L0 Contract Preview."));
  }
  if (!Array.isArray(result.localCiEquivalent?.commands) || result.localCiEquivalent.commands.length === 0) {
    violations.push(violation("rtfinal.local_ci_missing", "Final result must list local CI-equivalent command evidence."));
  }
  if (!Array.isArray(result.evidenceGraphRefs) || !result.evidenceGraphRefs.includes(paths.graph)) {
    violations.push(violation("rtfinal.evidence_graph_ref_missing", "Final result must reference the evidence graph."));
  }
}

function validateCoverage(matrix, result) {
  const reqs = matrix.requirements ?? [];
  const p0 = reqs.filter((req) => req.priority === "P0");
  const p1 = reqs.filter((req) => req.priority === "P1");
  if (p0.length === 0 || p0.some((req) => req.status === "not_started" || (req.evidenceRefs ?? []).length === 0 || (req.implementationRefs ?? []).length === 0 || (req.testRefs ?? []).length === 0)) {
    violations.push(violation("rtfinal.p0_not_fully_evidenced", "Every P0 requirement must have implementationRefs, testRefs, evidenceRefs, and non-not_started status."));
  }
  const p1Covered = p1.filter((req) => req.status !== "not_started" || (req.blockers ?? []).length > 0).length;
  const p1Coverage = p1.length === 0 ? 100 : Math.round((p1Covered / p1.length) * 100);
  if (p1Coverage < 90) {
    violations.push(violation("rtfinal.p1_coverage_low", `P1 coverage must be >= 90%, got ${p1Coverage}%.`, { p1Coverage }));
  }
  if (result.coverage?.p0 !== 100 || result.coverage?.p1 < 90) {
    violations.push(violation("rtfinal.result_coverage_wrong", "Final result coverage must report P0=100 and P1>=90."));
  }
}

function validateBranchMatrix(branchMatrix, result) {
  const byTask = new Map((branchMatrix.branches ?? []).map((item) => [item.taskId, item]));
  for (const taskId of requiredTasks) {
    const item = byTask.get(taskId);
    if (!item) {
      violations.push(violation("rtfinal.branch_missing", `Stacked branch matrix missing ${taskId}.`, { taskId }));
      continue;
    }
    if (!["LOCAL_PASSED", "MAIN_GREEN"].includes(item.localCiStatus) || item.stackedReady !== true || item.mergeStatus === "merged") {
      violations.push(violation("rtfinal.branch_status_wrong", `${taskId} must be LOCAL_PASSED or MAIN_GREEN, stackedReady=true, and not mergeStatus=merged.`, { taskId }));
    }
    if (!item.headSha || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      violations.push(violation("rtfinal.branch_evidence_missing", `${taskId} must have headSha and evidenceRefs.`, { taskId }));
    }
  }

  if (!Array.isArray(result.stackedReadyTasks) || !requiredTasks.every((taskId) => result.stackedReadyTasks.includes(taskId))) {
    violations.push(violation("rtfinal.result_tasks_missing", "Final result must list every stacked-ready task."));
  }
}

function validateGraph(graph, branchMatrix) {
  const branchNodeIds = new Set((graph.nodes ?? []).filter((node) => node.type === "branch").map((node) => node.id));
  for (const item of branchMatrix.branches ?? []) {
    if (!branchNodeIds.has(item.taskId)) {
      violations.push(violation("rtfinal.graph_branch_missing", `Evidence graph missing branch node ${item.taskId}.`, { taskId: item.taskId }));
    }
  }
  if ((graph.nodes ?? []).length < requiredTasks.length) {
    violations.push(violation("rtfinal.graph_too_small", "Evidence graph has fewer nodes than the release train task count."));
  }
}

function validateDashboard(dashboard) {
  if (dashboard.currentGate !== "RT-FINAL" || dashboard.currentGateStatus !== "LOCAL_PASSED") {
    violations.push(violation("rtfinal.dashboard_not_current", "Completion Dashboard must show RT-FINAL LOCAL_PASSED."));
  }
  if (dashboard.businessProduction !== "BLOCKED" || dashboard.dormitoryL2Production !== "BLOCKED" || dashboard.repairPartsHrStatus !== "L0_OR_BLOCKED") {
    violations.push(violation("rtfinal.dashboard_boundary_wrong", "Completion Dashboard must keep production and downstream lines blocked."));
  }
}

function validateReport(reportText) {
  for (const phrase of [
    "Business Production: `BLOCKED`",
    "Dormitory L2 Production: `BLOCKED`",
    "Repair / Parts / HR: `L0 Contract Preview`",
    "LOCAL_PASSED / STACKED_READY / LOCKED_UNTIL_CENTRAL_MERGE",
    "未 FULLY_PASSED",
    "DORM-INT: `LOCKED_UNTIL_CENTRAL_MERGE_MAIN_GREEN`"
  ]) {
    if (!reportText.includes(phrase)) {
      violations.push(violation("rtfinal.report_phrase_missing", `Final report missing phrase: ${phrase}.`, { phrase }));
    }
  }
}

function validateCentralPlan(planText) {
  const planLines = planText.split(/\r?\n/);
  let lastIndex = -1;
  for (const taskId of requiredTasks) {
    const index = planLines.findIndex((line) => new RegExp(`^\\d+\\.\\s+${escapeRegExp(taskId)}$`).test(line.trim()));
    if (index <= lastIndex) {
      violations.push(violation("rtfinal.central_merge_order_wrong", `Central merge plan missing or misorders ${taskId}.`, { taskId }));
    }
    lastIndex = index;
  }
  for (const phrase of ["不一次性 merge 多个 stacked PR", "main green 后再处理下一个 PR", "Evidence Graph", "Completion Dashboard"]) {
    if (!planText.includes(phrase)) {
      violations.push(violation("rtfinal.central_plan_guard_missing", `Central merge plan missing guard: ${phrase}.`, { phrase }));
    }
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
