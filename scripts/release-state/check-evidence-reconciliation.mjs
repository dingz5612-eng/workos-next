import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const mainHead = readCurrentMainHead();
const violations = [];

const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const graph = readJson("artifacts/rt4/evidence-graph.json");
const dashboard = readJson("artifacts/rt4/completion-dashboard.json");
const finalAssurance = readJson("artifacts/rt4/final-completion-assurance-result.json");

checkGoNoGo(goNoGo);
checkGraph(graph);
checkDashboard(dashboard);
checkFinalAssurance(finalAssurance);

const result = {
  generated_at_utc: generatedAt,
  generated_by: "check-evidence-reconciliation",
  status: violations.length === 0 ? "passed" : "failed",
  mainHead,
  checks: {
    goNoGoLatestMain: goNoGo.latestMain?.commitSha,
    graphMode: graph.mode,
    dashboardMode: dashboard.mode,
    finalAssuranceStatus: finalAssurance.reconciledStatus
  },
  noGoItems: violations,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  repairPartsHrStatus: "L0 Contract Preview"
};
writeJson("artifacts/release-state/evidence-reconciliation-result.json", result);
writeReport(result);

if (violations.length > 0) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("OAM-00 evidence reconciliation failed.");
}

console.log("OAM-00 evidence reconciliation: PASS");

function checkGoNoGo(result) {
  eq(result.status, "GO_FOR_INTERNAL_PILOT", "oam00.dorm_int_not_go", "DORM-INT final status 必须是 GO_FOR_INTERNAL_PILOT。");
  eq(result.latestMain?.commitSha, mainHead, "oam00.go_no_go_main_sha_stale", "internal-pilot-go-no-go.latestMain.commitSha 必须等于当前 origin/main。");
  eq(result.latestMain?.ci?.headSha, mainHead, "oam00.go_no_go_ci_sha_stale", "internal-pilot-go-no-go.latestMain.ci.headSha 必须等于当前 origin/main。");
  eq(result.latestMain?.v54ControlPlaneGuards?.headSha, mainHead, "oam00.go_no_go_v54_sha_stale", "internal-pilot-go-no-go.latestMain.v54ControlPlaneGuards.headSha 必须等于当前 origin/main。");
  eq(result.productionAllowed, false, "oam00.production_drift", "DORM-INT GO 不得允许 production。");
  eq(result.dormitoryL2ProductionAllowed, false, "oam00.l2_drift", "DORM-INT GO 不得允许 Dormitory L2 Production。");
  eq(result.repairPartsHrStatus, "L0 Contract Preview", "oam00.downstream_line_drift", "Repair / Parts / HR 必须保持 L0 Contract Preview。");
  assertNoTmp(result.evidenceRefs ?? [], "oam00.go_no_go_tmp_ref", "final go/no-go evidenceRefs 不允许包含 .tmp。");
  assertNoTmp(Object.values(result.readiness ?? {}).map((item) => item.ref), "oam00.readiness_tmp_ref", "final go/no-go readiness refs 不允许包含 .tmp。");
}

function checkGraph(result) {
  oneOf(result.mode, ["CENTRAL_MERGE_COMPLETED", "DORM_INT_PASSED", "L1_INTERNAL_PILOT_OBSERVATION"], "oam00.graph_mode_wrong", "Evidence Graph 必须识别 merge / DORM-INT / L1 observation 状态。");
  eq(result.headSha, mainHead, "oam00.graph_head_stale", "Evidence Graph headSha 必须等于当前 origin/main。");
  eq(result.releaseStates?.centralMerge, "CENTRAL_MERGE_COMPLETED", "oam00.graph_central_merge_missing", "Evidence Graph 必须记录 CENTRAL_MERGE_COMPLETED。");
  eq(result.releaseStates?.dormInt, "DORM_INT_PASSED", "oam00.graph_dorm_int_missing", "Evidence Graph 必须记录 DORM_INT_PASSED。");
  eq(result.releaseStates?.observation, "L1_INTERNAL_PILOT_OBSERVATION", "oam00.graph_observation_missing", "Evidence Graph 必须记录 L1_INTERNAL_PILOT_OBSERVATION。");
  eq(result.releaseStates?.businessProduction, "BLOCKED", "oam00.graph_business_production_drift", "Final System Gate blocked 时 Business Production 必须保持 blocked。");
  eq(result.releaseStates?.dormitoryL2Production, "BLOCKED", "oam00.graph_l2_drift", "DORM-INT GO 不得映射为 L2 Production。");
}

function checkDashboard(result) {
  if (result.mode === "STACKED_PRECONSTRUCTION") violation("oam00.dashboard_still_stacked", "Completion Dashboard 不得再写 STACKED_PRECONSTRUCTION。");
  eq(result.mode, "L1_INTERNAL_PILOT_OBSERVATION", "oam00.dashboard_mode_wrong", "Completion Dashboard 必须进入 L1 observation 状态。");
  eq(result.currentMainHead, mainHead, "oam00.dashboard_head_stale", "Completion Dashboard 必须绑定当前 origin/main。");
  eq(result.centralMergeTrain, "CENTRAL_MERGE_COMPLETED", "oam00.dashboard_merge_not_completed", "Completion Dashboard 必须记录 Central Merge Train completed。");
  eq(result.businessProduction, "BLOCKED", "oam00.dashboard_business_production_drift", "Business Production 必须保持 BLOCKED。");
  eq(result.dormitoryL2Production, "BLOCKED", "oam00.dashboard_l2_drift", "Dormitory L2 必须保持 BLOCKED。");
}

function checkFinalAssurance(result) {
  eq(result.reconciledStatus, "POST_DORM_INT_RECONCILED", "oam00.final_assurance_not_reconciled", "RT-FINAL artifact 必须进入 post DORM-INT reconciled 状态。");
  eq(result.currentMainHead, mainHead, "oam00.final_assurance_head_stale", "RT-FINAL artifact 必须绑定当前 origin/main。");
  if (`${result.dormitoryStatus ?? ""}`.includes("not started")) violation("oam00.final_assurance_dorm_not_started", "RT-FINAL artifact 不得再写 DORM-INT not started。");
  eq(result.businessProductionAllowed, false, "oam00.final_assurance_business_production_drift", "RT-FINAL artifact 不得允许 Business Production。");
  eq(result.dormitoryL2ProductionAllowed, false, "oam00.final_assurance_l2_drift", "RT-FINAL artifact 不得允许 Dormitory L2 Production。");
  eq(result.repairPartsHrStatus, "L0 Contract Preview", "oam00.final_assurance_downstream_drift", "Repair / Parts / HR 必须保持 L0 Contract Preview。");
}

function readCurrentMainHead() {
  const result = spawnSync("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error("BLOCKED: cannot confirm current main.");
  const sha = result.stdout.trim().split(/\s+/)[0];
  if (!sha) throw new Error("BLOCKED: cannot confirm current main.");
  return sha;
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeReport(result) {
  const lines = [
    "# OAM-00 证据重绑定与状态调和报告",
    "",
    `- status: \`${result.status}\``,
    `- current main: \`${result.mainHead}\``,
    `- DORM-INT latestMain: \`${result.checks.goNoGoLatestMain}\``,
    `- Evidence Graph mode: \`${result.checks.graphMode}\``,
    `- Completion Dashboard mode: \`${result.checks.dashboardMode}\``,
    "",
    "## 中文结论",
    result.status === "passed"
      ? "证据与状态已调和到当前 main；宿舍只保持 L1 内测观察，不允许 L2 Production，不允许 Business Production GO。"
      : "证据与状态仍有 P0 blocker，必须修复后重跑 OAM-00。",
    "",
    "## No-Go Items",
    ...(result.noGoItems.length ? result.noGoItems.map((item) => `- ${item.id}: ${item.message}`) : ["- none"]),
    ""
  ];
  const reportPath = path.join(root, "docs/release-state/evidence-reconciliation-report.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}

function eq(actual, expected, id, message) {
  if (actual !== expected) violation(id, message, { actual, expected });
}

function oneOf(actual, allowed, id, message) {
  if (!allowed.includes(actual)) violation(id, message, { actual, allowed });
}

function assertNoTmp(items, id, message) {
  for (const item of items.filter(Boolean)) {
    if (`${item}`.replace(/\\/g, "/").includes(".tmp/")) violation(id, message, { ref: item });
  }
}

function violation(id, message, extra = {}) {
  violations.push({ severity: "P0", id, message, ...extra });
}
