import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const reportPath = path.join(
  root,
  "artifacts", "oam", "evidence", "dormitory-real-browser",
  process.env.WORKOS_TEN_DORM_SCENARIO_RUN_ID || "ten-dormitory-scenario-real-browser-20260605-post-unified-start",
  "ten-scenario-real-browser-report.json"
);
const outputPath = path.join(root, "artifacts", "oam", "checks", "dormitory-ten-scenario-real-browser-result.json");
const violations = [];
const report = readJson(reportPath);
const currentGit = {
  branch: command("git branch --show-current"),
  headSha: command("git rev-parse HEAD"),
  dirtyStatus: command("git status --short")
};

validateReport();
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("Dormitory ten-scenario real browser audit check failed.");
}

console.log("Dormitory ten-scenario real browser audit check: PASS");

function validateReport() {
  if (report.status !== "passed") {
    violations.push(v("ten_scenario.status", "10 场景真实浏览器审计结果必须 passed。"));
  }
  validateAuditLevel();
  if (!["playwright-chromium-visible", "playwright-chromium-headless"].includes(report.browserMode)) {
    violations.push(v("ten_scenario.browser_mode", "证据必须来自 Playwright Chromium 真实浏览器模式。", { browserMode: report.browserMode }));
  }
  if (!String(report.mockPolicy || "").includes("real browser clicks") ||
      !String(report.mockPolicy || "").includes("no route mocks")) {
    violations.push(v("ten_scenario.mock_policy", "证据策略必须声明真实浏览器点击且不得使用路由 mock。"));
  }
  if (report.git?.headSha !== currentGit.headSha) {
    violations.push(v("ten_scenario.git_head_stale", "10 场景真实浏览器报告不是当前提交生成。", { reportHeadSha: report.git?.headSha || "", currentHeadSha: currentGit.headSha }));
  }
  if (normalizeDirtyStatus(report.git?.dirtyStatus) !== normalizeDirtyStatus(currentGit.dirtyStatus)) {
    violations.push(v("ten_scenario.git_dirty_stale", "10 场景真实浏览器报告不是当前工作区差异生成，必须重跑。"));
  }
  if (!Array.isArray(report.scenarios) || report.scenarios.length !== 10) {
    violations.push(v("ten_scenario.count", "必须覆盖 10 个宿舍业务场景。", { count: report.scenarios?.length || 0 }));
  }
  const expected = new Set([
    "W-STAY-RESOURCE",
    "W-STAY-LEAD-RESERVATION",
    "W-STAY-CHECKIN",
    "W-STAY-LIFECYCLE",
    "W-STAY-DEPOSIT-LEDGER",
    "W-STAY-PAYMENT-LEDGER",
    "W-STAY-SERVICE-TASK",
    "W-STAY-CHECKOUT-SETTLEMENT",
    "W-STAY-EXPENSE-LEDGER",
    "W-STAY-PERIOD-ANALYTICS"
  ]);
  for (const item of report.scenarios || []) {
    const admissionBlocked = item.expectedOutcome === "admission_blocked";
    expected.delete(item.templateWorkspaceId);
    if (item.status !== "passed") violations.push(v("ten_scenario.scenario_status", `${item.title} 必须 passed。`, { scenario: item.id }));
    if (item.negative?.status !== "passed") violations.push(v("ten_scenario.negative", `${item.title} 空提交反例必须通过。`, { scenario: item.id }));
    if (admissionBlocked) {
      if (item.positive?.status !== "not_applicable" || item.positive?.blockedByAdmission !== true || item.positive?.confirmDelta !== 0) {
        violations.push(v("ten_scenario.finance_gate_blocked", `${item.title} 必须证明 finance-gate admission 阻断且不得形成 Confirm。`, { scenario: item.id, positive: item.positive }));
      }
    } else if (item.positive?.status !== "passed") {
      violations.push(v("ten_scenario.positive", `${item.title} 正例提交必须通过。`, { scenario: item.id }));
    }
    const minimumStepCount = admissionBlocked ? 3 : 5;
    if (!Array.isArray(item.steps) || item.steps.length < minimumStepCount) {
      violations.push(v("ten_scenario.step_coverage", `${item.title} 页面证据不足。`, { scenario: item.id, minimumStepCount }));
    }
  }
  for (const missing of expected) {
    violations.push(v("ten_scenario.workspace_missing", `缺少宿舍场景 ${missing}。`, { workspaceId: missing }));
  }
  const policy = report.networkPolicy || {};
  const expectedConfirmCount = (report.scenarios || []).filter((item) => item.expectedOutcome !== "admission_blocked").length;
  if (policy.workspaceStartCount < 10) violations.push(v("ten_scenario.workspace_start_count", "必须至少有 10 次 Operations workspace start。", policy));
  if (policy.operationsConfirmCount !== expectedConfirmCount) {
    violations.push(v("ten_scenario.confirm_count", `${expectedConfirmCount} 个可确认正例必须刚好形成 ${expectedConfirmCount} 次 Operations Confirm，finance-gate 阻断场景不得确认。`, { ...policy, expectedConfirmCount }));
  }
  if (!policy.noForbiddenWorkspaceCardWrites) violations.push(v("ten_scenario.blocked_workspace_card_write", "不得出现旧 Workspace/Card prepare/confirm 写入口。", policy));
  if (!policy.noDirectBusinessFactWrites) violations.push(v("ten_scenario.direct_fact_write", "前端不得直接写业务事实、outbox 或投影。", policy));
  const assertions = new Map((report.assertions || []).map((item) => [item.id, item.status]));
  for (const id of [
    "search.entry.no_start_without_backend_admission",
    "search.entry.learning_without_backend_admission",
    "search.entry.no_resource_special_start",
    "network.workspace_start_count",
    "network.operations_confirm_count",
    "network.no_blocked_workspace_card_writes",
    "network.no_direct_business_fact_writes"
  ]) {
    if (assertions.get(id) !== "passed") violations.push(v("ten_scenario.assertion", `断言 ${id} 必须 passed。`, { assertion: id }));
  }
  for (const shot of report.screenshots || []) {
    if (!shot.path || !exists(shot.path)) violations.push(v("ten_scenario.screenshot_missing", `截图不存在：${shot.path || "(empty)"}`, { shot }));
    if (!shot.sha256) violations.push(v("ten_scenario.screenshot_hash", `截图缺少 sha256：${shot.path || "(empty)"}`, { shot }));
  }
  if ((report.screenshots || []).length < 120) {
    violations.push(v("ten_scenario.screenshot_count", "10 场景每页必须保留完整截图和上下屏证据。", { count: report.screenshots?.length || 0 }));
  }
}

function validateAuditLevel() {
  if (report.auditLevel !== "L1") {
    violations.push(v("ten_scenario.audit_level", "当前阶段 10 场景浏览器审计只能是 L1 架构证据。", { auditLevel: report.auditLevel || "missing" }));
  }
  if (["L2", "L3"].includes(report.auditLevel)) {
    violations.push(v("ten_scenario.l2_l3_forbidden", "当前阶段禁止启用 L2/L3 浏览器审计。"));
  }
  if (report.businessGoAllowed !== false) {
    violations.push(v("ten_scenario.business_go_allowed", "L1 浏览器审计必须保持 businessGoAllowed=false。"));
  }
  if (!/架构|Surface|Operations/.test(String(report.auditPurpose || ""))) {
    violations.push(v("ten_scenario.audit_purpose", "报告必须声明 L1 架构 UI 审计目的。"));
  }
  const forbidden = Array.isArray(report.forbiddenInterpretation)
    ? report.forbiddenInterpretation.join("\n")
    : String(report.forbiddenInterpretation || "");
  if (!/业务|productionConfirmAllowed|releaseAuthority|GO/.test(forbidden)) {
    violations.push(v("ten_scenario.forbidden_interpretation", "报告必须声明 ten-scenario 不能解释为业务 GO、生产确认或发布授权。"));
  }
  if (!report.scenarioScope || report.scenarioScope.businessAcceptance !== false) {
    violations.push(v("ten_scenario.scope", "scenarioScope 必须声明 businessAcceptance=false。"));
  }
  if (!report.currentScenario) violations.push(v("ten_scenario.current_scenario", "报告缺少 currentScenario 进度字段。"));
  if (report.completedScenarioCount !== (report.scenarios || []).length) {
    violations.push(v("ten_scenario.completed_count", "completedScenarioCount 必须等于已写入场景数量。", { completedScenarioCount: report.completedScenarioCount, scenarioCount: report.scenarios?.length || 0 }));
  }
  if (report.totalScenarioCount !== 10) {
    violations.push(v("ten_scenario.total_count", "totalScenarioCount 必须等于 10。", { totalScenarioCount: report.totalScenarioCount }));
  }
  if (!report.lastHeartbeatAt) violations.push(v("ten_scenario.heartbeat", "报告缺少 lastHeartbeatAt。"));
  if (report.screenshotCount !== (report.screenshots || []).length) {
    violations.push(v("ten_scenario.screenshot_progress", "screenshotCount 必须等于 screenshots.length。", { screenshotCount: report.screenshotCount, screenshots: report.screenshots?.length || 0 }));
  }
  if (!report.currentStep) violations.push(v("ten_scenario.current_step", "报告缺少 currentStep。"));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    violations.push(v("ten_scenario.report_missing", `无法读取 10 场景真实浏览器报告：${path.relative(root, filePath)}`, { error: error.message }));
    return {};
  }
}

function writeResult() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs",
    status: violations.length ? "failed" : "passed",
    report: path.relative(root, reportPath).replace(/\\/g, "/"),
    auditLevel: report.auditLevel || "",
    businessGoAllowed: report.businessGoAllowed,
    scenarioCount: report.scenarios?.length || 0,
    screenshotCount: report.screenshots?.length || 0,
    completedScenarioCount: report.completedScenarioCount || 0,
    totalScenarioCount: report.totalScenarioCount || 0,
    workspaceStartCount: report.networkPolicy?.workspaceStartCount || 0,
    operationsConfirmCount: report.networkPolicy?.operationsConfirmCount || 0,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function normalizeDirtyStatus(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort()
    .join("\n");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
