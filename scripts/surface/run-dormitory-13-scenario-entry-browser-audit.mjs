import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { businessDisplayZh } from "../../apps/mobile/src/businessDisplayLanguage.js";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const mobileUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const controlPath = "docs/contracts/generated/dormitory/13-scenario-index.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-13-scenario-entry-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "entry-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const control = readJson(controlPath);

const forbiddenVisibleTerms = [
  "W-STAY-RESOURCE",
  "Dormitory.FirstGoldenChain",
  "golden-chain",
  "resource-saleability",
  "roomSetup",
  "bedSetup",
  "提交观察记录",
  "提交内测",
  "技术详情",
  "production",
  "final GO",
  "roomId",
  "bedId",
  "workItemId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];

const workItem = {
  workItemId: "wi-entry-mainline-room-filing",
  caseId: "case:entry-mainline-room-filing",
  workItemType: "Dorm.RoomSetupConfirm",
  lifecycleState: "ready",
  ownerRole: "operator",
  workspaceId: "W-DORM-MAINLINE",
  cardId: "cert.roomSetupConfirm",
  domain: "dormitory",
  businessObject: "房源建档与基础就绪",
  nextAction: "房间建档确认",
  requiredEvidence: ["room_duplicate_check"],
  traceRefs: ["trace:entry-room-filing"],
  riskLevel: "P1",
  dueAt: new Date().toISOString(),
  admission: {
    visibleAllowed: true,
    prepareAllowed: true,
    confirmAllowed: true,
    productionAllowed: false,
    mode: "internal_pilot_observation",
    reason: "business_production_blocked",
    admissionDecisionRef: "admission:entry:mainline"
  }
};

const projection = {
  workspaces: [
    {
      id: "W-DORM-MAINLINE",
      domain: "dormitory",
      title: { "zh-CN": "房源建档与基础就绪" },
      summary: { "zh-CN": "完成房间建档、床位组确认和基础就绪确认。" },
      next: { "zh-CN": "房间建档确认" },
      cards: [
        {
          id: "cert.roomSetupConfirm",
          status: "ready",
          title: { "zh-CN": "房间建档确认" },
          fields: {
            business: [
              { id: "roomNo", label: { "zh-CN": "房间号" }, type: "text" }
            ],
            system: [{ id: "definitionVersion", label: { "zh-CN": "定义版本" } }]
          },
          evidence: ["房间重复校验"],
          checks: ["字段完整"],
          events: ["RoomFiled"],
          transitions: { onPrepare: "prepared", onConfirm: "confirmed" },
          confirmation: { requiredRole: "operator", policyRef: "operations-runtime-policy" },
          blockerRules: []
        }
      ],
      blockers: []
    }
  ],
  events: []
};

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-13-scenario-entry-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "mobile_surface_entry_evidence",
  browserMode: "playwright-chromium-real-mobile-surface",
  controlDigest: digestFile(controlPath),
  scenarioCount: scenarioList().length,
  entrySurfaces: [],
  scenarios: [],
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
  businessGoLiveAllowed: false,
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

    await page.goto(`${mobileUrl}/?device=mobile`);
    if (await page.getByRole("button", { name: "登录" }).count()) {
      await page.getByRole("button", { name: "登录" }).click();
    }
    await page.waitForLoadState("networkidle").catch(() => {});

    await captureSurface(page, "home", "首页/今日入口", ["今天", "工作项", "搜索", "我的"]);
    await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "今天", exact: true }).click();
    await captureSurface(page, "today", "今日入口", displayTerms(["今日", "房源建档与基础就绪"]));
    await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "工作项", exact: true }).click();
    await captureSurface(page, "work-items", "工作项入口", displayTerms(["房源建档与基础就绪", "房间建档确认"]));
    await page.locator('[data-work-item-id="wi-entry-mainline-room-filing"]').click();
    await captureSurface(page, "operation-panel", "当前办理入口", displayTerms(["房源建档与基础就绪", "房间建档确认", "保存草稿"]));
    await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "我的", exact: true }).click();
    await captureSurface(page, "mine", "我的入口", ["学习中心", "我的权限", "当前设备"]);

    for (const scenario of scenarioList()) {
      await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "搜索", exact: true }).click();
      await page.locator("#query").fill(scenario.nameZh);
      await page.locator("#searchNow").click();
      await page.waitForTimeout(120);
      const text = await visibleText(page);
      const screenshot = await capture(page, `scenario-${String(scenario.scenarioNo).padStart(2, "0")}`);
      const displayNameZh = businessDisplayZh(scenario.nameZh);
      const expectedButton = "查看详情";
      const hasExpectedButton = text.includes(expectedButton);
      const hasName = text.includes(displayNameZh);
      const hasLearningMisroute = text.includes("开始学习");
      const hasForbidden = containsAny(text, forbiddenVisibleTerms);
      const analysis = {
        "用户是否看得懂": hasName ? `能看到 ${displayNameZh}` : "未看到场景名称",
        "按钮是否顺": hasExpectedButton ? `按钮为 ${expectedButton}` : `未看到 ${expectedButton}`,
        "是否误入学习中心": hasLearningMisroute ? "误入学习中心" : "未误入学习中心",
        "是否暴露旧身份或内部 ID": hasForbidden ? "存在风险" : "未发现",
        "下一步是否清楚": hasExpectedButton ? "下一步明确" : "下一步不明确"
      };
      const item = {
        scenarioNo: scenario.scenarioNo,
        scenarioId: scenario.scenarioId,
        nameZh: scenario.nameZh,
        displayNameZh,
        expectedButton,
        status: hasName && hasExpectedButton && !hasLearningMisroute && !hasForbidden ? "passed" : "failed",
        hasForbidden,
        visibleTextDigest: digestText(text),
        screenshot,
        analysis
      };
      if (item.status !== "passed") {
        report.findings.push({
          id: `scenario-${scenario.scenarioNo}-entry`,
          severity: "P1",
          message: `${scenario.nameZh} 入口未满足真实前台要求。`,
          analysis
        });
      }
      report.scenarios.push(item);
    }

    await context.close();
  } finally {
    await browser.close();
  }

  addAssertion("entry.scenario_count", report.scenarios.length === 13, "必须覆盖 13 个场景入口。");
  addAssertion("entry.all_scenarios_passed", report.scenarios.every((item) => item.status === "passed"), "13 场景入口必须全部通过。");
  addAssertion("entry.surfaces_passed", report.entrySurfaces.every((item) => item.status === "passed"), "首页、今日、工作项、搜索、我的必须可用。");
  addAssertion("entry.no_forbidden_visible_terms", [...report.entrySurfaces, ...report.scenarios].every((item) => item.hasForbidden !== true), "入口不得暴露旧身份或内部 ID。");
  addAssertion("entry.no_go_closed", report.productionConfirmAllowed === false && report.releaseAuthority === false && report.finalGoNoGo === "NO_GO", "入口验收不代表生产发布或 final GO。");

  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed")
    ? "failed"
    : "passed";
  report.entryBrowserAuditDigest = digestObject(report);
  writeOutputs();

  if (report.status !== "passed") {
    console.error(`Dormitory 13 scenario entry browser audit: FAIL (${report.findings.length} findings)`);
    for (const finding of report.findings) console.error(`- ${finding.id}: ${finding.message}`);
    process.exit(1);
  }
  console.log(`Dormitory 13 scenario entry browser audit: PASS (${report.entryBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.entryBrowserAuditDigest = digestObject(report);
  writeOutputs();
  console.error("Dormitory 13 scenario entry browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

async function routeApis(page) {
  await page.route("http://127.0.0.1:5191/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/health") return route.fulfill({ json: { status: "ok", persistence: "postgresql" } });
    if (url.pathname === "/api/auth/login") return route.fulfill({ json: actorFor("operator") });
    if (url.pathname === "/api/workspaces") return route.fulfill({ json: projection });
    if (url.pathname === "/api/operations/work-items") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/home-surface") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/learning-catalog") return route.fulfill({ json: [] });
    if (url.pathname.startsWith("/api/lenses/accommodation/")) return route.fulfill({ json: {} });
    if (url.pathname === "/api/lenses/search") return route.fulfill({ json: [] });
    if (url.pathname === "/api/operations/workspaces/start" && method === "POST") {
      return route.fulfill({ json: { workspace: projection.workspaces[0], workItem, operationWorkItems: [workItem], projection } });
    }
    if (url.pathname.endsWith("/prepare") && method === "POST") return route.fulfill({ json: { prepared: true, workItemId: workItem.workItemId } });
    if (url.pathname.endsWith("/confirm") && method === "POST") {
      return route.fulfill({
        json: {
          confirmed: true,
          commitStatus: "committed",
          projectionStatus: "pending",
          commandSubmissionId: "sub-entry-room",
          traceRefs: ["trace:entry-room"]
        }
      });
    }
    if (url.pathname.startsWith("/api/operations/trace/")) return route.fulfill({ json: { traceRefs: ["trace:entry-room"] } });
    if (url.pathname === "/api/control-plane/releases") return route.fulfill({ json: [] });
    if (url.pathname === "/api/observability/runtime") return route.fulfill({ json: { runtime: {}, outbox: {}, projection: {}, controlPlane: {} } });
    return route.fulfill({ status: 404, json: { error: "not_mocked", path: url.pathname } });
  });
}

function actorFor(role) {
  return {
    role,
    displayName: "住宿经办人",
    token: "entry-browser-token",
    capabilities: ["operations.confirm"]
  };
}

function scenarioList() {
  return control.scenarios ?? control.scenarioIndex ?? control.scenarioPackages ?? [];
}

async function captureSurface(page, id, nameZh, expectedTexts) {
  await page.waitForTimeout(120);
  const text = await visibleText(page);
  const screenshot = await capture(page, id);
  const missing = expectedTexts.filter((item) => !text.includes(item));
  const hasForbidden = containsAny(text, forbiddenVisibleTerms);
  const expectedButtons = buttonTermsForSurface(id);
  const hasExpectedButton = expectedButtons.length === 0 || expectedButtons.some((item) => text.includes(item));
  const missingButtons = hasExpectedButton ? [] : expectedButtons;
  const item = {
    id,
    nameZh,
    status: missing.length === 0 && !hasForbidden && hasExpectedButton ? "passed" : "failed",
    expectedTexts,
    expectedButtons,
    missing,
    missingButtons,
    hasForbidden,
    visibleTextDigest: digestText(text),
    screenshot,
    analysis: {
      "用户是否看得懂": missing.length === 0 ? "关键入口文案可见" : `缺少 ${missing.join("、")}`,
      "按钮是否顺": hasExpectedButton ? "入口按钮可理解" : `缺少 ${expectedButtons.join("、")} 中至少一个动作`,
      "是否暴露旧身份或内部 ID": hasForbidden ? "存在风险" : "未发现",
      "职责是否清楚": `${nameZh} 职责已显示`
    }
  };
  if (item.status !== "passed") {
    report.findings.push({
      id: `surface-${id}`,
      severity: "P1",
      message: `${nameZh} 未满足真实入口要求。`,
      missing,
      missingButtons,
      hasForbidden
    });
  }
  report.entrySurfaces.push(item);
}

function buttonTermsForSurface(id) {
  if (id === "work-items") return ["开始办理", "继续办理", "查看详情"];
  if (id === "operation-panel") return ["保存草稿", "提交处理", "提交办理记录", "查看不能提交原因"];
  return [];
}

function displayTerms(terms = []) {
  return terms.map((term) => businessDisplayZh(term));
}

async function capture(page, id) {
  const file = path.join(screenshotDir, `${id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const entry = {
    id,
    path: rel(file),
    digest: digestFile(rel(file))
  };
  report.screenshots.push(entry);
  return entry;
}

async function visibleText(page) {
  return page.locator("body").innerText({ timeout: 5000 });
}

function addAssertion(id, passed, message) {
  report.assertions.push({ id, status: passed ? "passed" : "failed", message });
  if (!passed) report.findings.push({ id, severity: "P1", message });
}

function writeOutputs() {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify({
    version: "oam.dormitory-13-scenario-entry-browser-screenshot-index.v1",
    generatedAtUtc: new Date().toISOString(),
    screenshots: report.screenshots
  }, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function digestText(text) {
  return `sha256:${crypto.createHash("sha256").update(String(text)).digest("hex")}`;
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestObject(value) {
  return digestText(JSON.stringify(value));
}

function containsAny(text, terms) {
  return terms.some((term) => String(text).includes(term));
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
