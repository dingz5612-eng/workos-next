import fs from "node:fs";
import path from "node:path";

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
  if (report.browserMode !== "playwright-chromium-visible" && process.env.WORKOS_REAL_BROWSER_HEADLESS !== "1") {
    violations.push(v("ten_scenario.browser_mode", "本地用户可见证据必须使用可见真实浏览器模式。", { browserMode: report.browserMode }));
  }
  if (!String(report.mockPolicy || "").includes("real browser clicks") ||
      !String(report.mockPolicy || "").includes("no route mocks")) {
    violations.push(v("ten_scenario.mock_policy", "证据策略必须声明真实浏览器点击且不得使用路由 mock。"));
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
    expected.delete(item.templateWorkspaceId);
    if (item.status !== "passed") violations.push(v("ten_scenario.scenario_status", `${item.title} 必须 passed。`, { scenario: item.id }));
    if (item.negative?.status !== "passed") violations.push(v("ten_scenario.negative", `${item.title} 空提交反例必须通过。`, { scenario: item.id }));
    if (item.positive?.status !== "passed") violations.push(v("ten_scenario.positive", `${item.title} 正例提交必须通过。`, { scenario: item.id }));
    if (!Array.isArray(item.steps) || item.steps.length < 5) {
      violations.push(v("ten_scenario.step_coverage", `${item.title} 至少需要搜索、打开、空提交、填充、提交后 5 个页面证据。`, { scenario: item.id }));
    }
  }
  for (const missing of expected) {
    violations.push(v("ten_scenario.workspace_missing", `缺少宿舍场景 ${missing}。`, { workspaceId: missing }));
  }
  const policy = report.networkPolicy || {};
  if (policy.workspaceStartCount < 10) violations.push(v("ten_scenario.workspace_start_count", "必须至少有 10 次 Operations workspace start。", policy));
  if (policy.operationsConfirmCount !== 10) violations.push(v("ten_scenario.confirm_count", "10 个正例必须刚好形成 10 次 Operations Confirm。", policy));
  if (!policy.noForbiddenWorkspaceCardWrites) violations.push(v("ten_scenario.blocked_workspace_card_write", "不得出现旧 Workspace/Card prepare/confirm 写入口。", policy));
  if (!policy.noDirectBusinessFactWrites) violations.push(v("ten_scenario.direct_fact_write", "前端不得直接写业务事实、outbox 或投影。", policy));
  const assertions = new Map((report.assertions || []).map((item) => [item.id, item.status]));
  for (const id of [
    "search.entry.unified_count",
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
    scenarioCount: report.scenarios?.length || 0,
    screenshotCount: report.screenshots?.length || 0,
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
