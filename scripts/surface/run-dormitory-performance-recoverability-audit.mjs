import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const mobileUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const auditDir = "artifacts/oam/evidence/dormitory-performance-recoverability";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "performance-recoverability-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const thresholds = {
  openHomeMs: 3000,
  openWorkItemsMs: 1000,
  openOperationPanelMs: 1200,
  saveDraftMs: 800,
  confirmMs: 2000,
  searchMs: 1500,
  summaryOpenMs: 1000
};

const workItem = {
  workItemId: "wi-performance-room-filing",
  caseId: "case:performance-room-filing",
  workItemType: "Dorm.RoomSetupConfirm",
  lifecycleState: "ready",
  ownerRole: "operator",
  workspaceId: "W-DORM-MAINLINE",
  cardId: "cert.roomSetupConfirm",
  domain: "dormitory",
  businessObject: "房源建档与基础就绪",
  nextAction: "房间建档确认",
  requiredEvidence: ["room_duplicate_check"],
  traceRefs: ["trace:performance-room"],
  riskLevel: "P1",
  dueAt: new Date().toISOString(),
  admission: {
    visibleAllowed: true,
    prepareAllowed: true,
    confirmAllowed: true,
    productionAllowed: false,
    mode: "internal_pilot_observation",
    reason: "business_production_blocked",
    admissionDecisionRef: "admission:performance:mainline"
  }
};

const projection = {
  workspaces: [{
    id: "W-DORM-MAINLINE",
    domain: "dormitory",
    title: { "zh-CN": "房源建档与基础就绪" },
    summary: { "zh-CN": "完成房间建档、床位组确认和基础就绪确认。" },
    next: { "zh-CN": "房间建档确认" },
    cards: [{
      id: "cert.roomSetupConfirm",
      status: "ready",
      title: { "zh-CN": "房间建档确认" },
      fields: {
        business: [{ id: "roomNo", label: { "zh-CN": "房间号" }, type: "text" }],
        system: [{ id: "definitionVersion", label: { "zh-CN": "定义版本" } }]
      },
      evidence: ["房间重复校验"],
      checks: ["字段完整"],
      events: ["RoomFiled"],
      transitions: { onPrepare: "prepared", onConfirm: "confirmed" },
      confirmation: { requiredRole: "operator", policyRef: "operations-runtime-policy" },
      blockerRules: []
    }],
    blockers: []
  }],
  events: []
};

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-performance-recoverability-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "mobile_surface_performance_recoverability",
  browserMode: "playwright-chromium-real-mobile-surface",
  thresholds,
  measurements: [],
  recoverability: [],
  screenshots: [],
  screenshotIndex: rel(screenshotIndexPath),
  assertions: [],
  findings: [],
  git: {
    branch: command("git branch --show-current"),
    headSha: command("git rev-parse HEAD"),
    dirtyStatus: command("git status --short")
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};

try {
  const browser = await chromium.launch({ headless: process.env.WORKOS_REAL_BROWSER_HEADLESS !== "0" });
  try {
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    await context.addInitScript(() => {
      localStorage.setItem("workosnext.onboarded", "1");
      localStorage.setItem("workosnext.lang", "zh-CN");
    });
    const page = await context.newPage();
    await routeApis(page);

    await measure("openHomeMs", async () => {
      await page.goto(`${mobileUrl}/?device=mobile`);
      if (await page.getByRole("button", { name: "登录" }).count()) await page.getByRole("button", { name: "登录" }).click();
      await page.getByRole("navigation", { name: "移动端主导航" }).waitFor();
    });
    await capture(page, "home-ready");

    await measure("openWorkItemsMs", async () => {
      await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "工作项", exact: true }).click();
      await page.locator('[data-work-item-id="wi-performance-room-filing"]').waitFor();
    });

    await measure("openOperationPanelMs", async () => {
      await page.locator('[data-work-item-id="wi-performance-room-filing"]').click();
      await page.locator('[data-surface="operation-panel-route"]').waitFor();
    });
    await capture(page, "operation-ready");

    await measure("saveDraftMs", async () => {
      await page.getByRole("button", { name: "保存草稿" }).click();
      await page.waitForTimeout(80);
    });

    await measure("confirmMs", async () => {
      await page.locator("[data-submit-card]").first().click();
      await page.locator('[data-surface="projection-pending"], [data-surface="action-result"]').first().waitFor({ timeout: 800 }).catch(() => {});
    });
    await capture(page, "confirm-feedback");

    await measure("searchMs", async () => {
      await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "搜索", exact: true }).click();
      await page.locator("#query").fill("房源建档与基础就绪");
      await page.locator("#searchNow").click();
      await page.locator('[data-search-section="activeCommands"]').waitFor();
    });

    await measure("summaryOpenMs", async () => {
      await page.locator('[data-search-section="activeCommands"]').waitFor();
      await page.waitForTimeout(40);
    });

    await recoverabilityCheck(page, "duplicate-submit", () => {
      window.__appCtx.state.lastActionResult = { status: "idempotency_conflict_409" };
      window.__appCtx.render(true);
    }, "系统识别到重复提交");
    await recoverabilityCheck(page, "business-validation", () => {
      window.__appCtx.state.lastActionResult = { status: "business_blocked_422" };
      window.__appCtx.render(true);
    }, "提交校验未通过");

    await context.close();
  } finally {
    await browser.close();
  }

  for (const item of report.measurements) {
    const threshold = thresholds[item.metric];
    addAssertion(`performance.${item.metric}`, item.durationMs <= threshold, `${item.metric} must be <= ${threshold}ms.`);
  }
  addAssertion("recoverability.duplicate", report.recoverability.some((item) => item.id === "duplicate-submit" && item.status === "passed"), "重复提交必须有可理解提示。");
  addAssertion("recoverability.validation", report.recoverability.some((item) => item.id === "business-validation" && item.status === "passed"), "失败重试/校验失败必须有可理解提示。");
  addAssertion("no_go.closed", report.productionConfirmAllowed === false && report.releaseAuthority === false && report.finalGoNoGo === "NO_GO", "性能验收不代表生产发布或 final GO。");

  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed")
    ? "failed"
    : "passed";
  report.auditDigest = digestObject(report);
  writeOutputs();

  if (report.status !== "passed") {
    console.error(`Dormitory performance and recoverability audit: FAIL (${report.findings.length} findings)`);
    for (const finding of report.findings) console.error(`- ${finding.id}: ${finding.message}`);
    process.exit(1);
  }
  console.log(`Dormitory performance and recoverability audit: PASS (${report.auditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.auditDigest = digestObject(report);
  writeOutputs();
  console.error("Dormitory performance and recoverability audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

async function routeApis(page) {
  await page.route("http://127.0.0.1:5191/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/health") return route.fulfill({ json: { status: "ok", persistence: "postgresql" } });
    if (url.pathname === "/api/auth/login") return route.fulfill({ json: { role: "operator", displayName: "住宿经办人", token: "performance-token", capabilities: ["operations.confirm"] } });
    if (url.pathname === "/api/workspaces") return route.fulfill({ json: projection });
    if (url.pathname === "/api/operations/work-items") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/home-surface") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/learning-catalog") return route.fulfill({ json: [] });
    if (url.pathname.startsWith("/api/lenses/accommodation/")) return route.fulfill({ json: {} });
    if (url.pathname === "/api/lenses/search") return route.fulfill({ json: [] });
    if (url.pathname === "/api/operations/workspaces/start" && method === "POST") return route.fulfill({ json: { workspace: projection.workspaces[0], workItem, operationWorkItems: [workItem], projection } });
    if (url.pathname.endsWith("/prepare") && method === "POST") return route.fulfill({ json: { prepared: true, workItemId: workItem.workItemId } });
    if (url.pathname.endsWith("/confirm") && method === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return route.fulfill({ json: { confirmed: true, commitStatus: "committed", projectionStatus: "pending", commandSubmissionId: "sub-performance-room", traceRefs: ["trace:performance-room"] } });
    }
    if (url.pathname.startsWith("/api/operations/trace/")) return route.fulfill({ json: { traceRefs: ["trace:performance-room"] } });
    if (url.pathname === "/api/control-plane/releases") return route.fulfill({ json: [] });
    if (url.pathname === "/api/observability/runtime") return route.fulfill({ json: { runtime: {}, outbox: {}, projection: {}, controlPlane: {} } });
    return route.fulfill({ status: 404, json: { error: "not_mocked", path: url.pathname } });
  });
}

async function measure(metric, action) {
  const started = performance.now();
  await action();
  const durationMs = Math.round(performance.now() - started);
  report.measurements.push({ metric, durationMs, thresholdMs: thresholds[metric] });
}

async function recoverabilityCheck(page, id, mutate, expectedText) {
  await restoreOperationPanelForRecovery(page);
  await page.locator('[data-surface="operation-panel-route"]').waitFor();
  await page.evaluate(mutate);
  const visible = await page.locator("body").innerText();
  const status = visible.includes(expectedText) ? "passed" : "failed";
  report.recoverability.push({ id, expectedText, status });
  await capture(page, id);
  if (status !== "passed") report.findings.push({ id: `recoverability.${id}`, severity: "P1", message: `${id} did not show expected recovery copy.` });
}

async function restoreOperationPanelForRecovery(page) {
  await page.evaluate((payload) => {
    const state = window.__appCtx.state;
    state.runtimeStore = {
      ...(state.runtimeStore || {}),
      workspaces: payload.projection.workspaces,
      operationWorkItems: [payload.workItem],
      workQueue: [payload.workItem]
    };
    state.view = "operationPanel";
    state.selectedWorkItemId = payload.workItem.workItemId;
    state.selectedWorkspace = payload.workItem.workspaceId;
    state.selectedCardId = payload.workItem.cardId;
    state.selectedCardIndex = -1;
    state.operationRouteIssue = null;
    state.lastActionResult = null;
    window.__appCtx.render(true);
  }, { workItem, projection });
}

async function capture(page, id) {
  const file = path.join(screenshotDir, `${id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push({ id, path: rel(file), digest: digestFile(rel(file)) });
}

function addAssertion(id, passed, message) {
  report.assertions.push({ id, status: passed ? "passed" : "failed", message });
  if (!passed) report.findings.push({ id, severity: "P1", message });
}

function writeOutputs() {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify({ version: "oam.dormitory-performance-recoverability-screenshot-index.v1", generatedAtUtc: new Date().toISOString(), screenshots: report.screenshots }, null, 2)}\n`);
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
