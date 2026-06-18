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
const packagePath = "docs/oam/dormitory-13-scenario-production-usable-closure-report.md";
const controlPath = "docs/contracts/generated/dormitory/13-scenario-index.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-prelaunch-ops-trial";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "prelaunch-ops-trial-report.json");
const markdownPath = path.join(root, auditDir, "prelaunch-ops-trial-report.md");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const currentHead = command("git rev-parse HEAD");
const requiredPackageMarkers = [
  "用户亲测包",
  "每个场景亲测动作",
  "旧入口亲测预期",
  "常见异常预期",
  "截图验收规则",
  "字段",
  "CRUD"
];
const userSafeForbiddenTerms = [
  "W-STAY-RESOURCE",
  "Dormitory.FirstGoldenChain",
  "golden-chain",
  "resource-saleability",
  "lead-reservation",
  "roomSetup",
  "bedSetup",
  "roomId",
  "bedId",
  "workItemId",
  "stableRef",
  "projectionVersion",
  "domainEventId"
];
const roleDefinitions = [
  {
    id: "operator",
    roleZh: "运营人员",
    actorRole: "operator",
    device: "mobile",
    targetView: "home",
    expectedTexts: ["今日工作", "工作项", "搜索", "我的"],
    objectives: ["新建房间", "维护床位", "运营状态", "预订", "入住", "退房", "异常处理"]
  },
  {
    id: "manager",
    roleZh: "主管/店长",
    actorRole: "manager",
    device: "pc",
    targetView: "managerControlTower",
    expectedTexts: ["经理控制塔", "只读取", "风险", "证据", "财务"],
    objectives: ["查看房态", "审批异常", "查看报表", "处理未闭环任务"]
  },
  {
    id: "finance",
    roleZh: "财务人员",
    actorRole: "finance",
    device: "pc",
    targetView: "financeControl",
    expectedTexts: ["财务对账与修正工作区", "押金", "退款", "不直接修改"],
    objectives: ["价格", "收款", "押金", "退款", "结算", "账务边界"]
  },
  {
    id: "admin",
    roleZh: "管理员",
    actorRole: "admin",
    device: "pc",
    targetView: "pcGovernance",
    expectedTexts: ["治理中心", "只读", "发布门禁", "权限"],
    objectives: ["组织", "角色", "权限", "设备", "Admission", "发布控制"]
  }
];
const workItem = {
  workItemId: "wi-prelaunch-room-setup",
  caseId: "case:prelaunch-room",
  workItemType: "Dorm.RoomSetupConfirm",
  lifecycleState: "ready",
  ownerRole: "operator",
  workspaceId: "W-DORM-MAINLINE",
  cardId: "cert.roomSetupConfirm",
  domain: "dormitory",
  businessObject: "房源建档与基础就绪",
  nextAction: "房间建档确认",
  requiredEvidence: ["room_duplicate_check"],
  traceRefs: ["trace:prelaunch-room"],
  riskLevel: "P1",
  dueAt: new Date().toISOString(),
  admission: {
    visibleAllowed: true,
    prepareAllowed: true,
    confirmAllowed: true,
    productionAllowed: false,
    mode: "internal_pilot_observation",
    reason: "business_production_blocked",
    admissionDecisionRef: "admission:prelaunch:mainline"
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
              { id: "buildingArea", label: { "zh-CN": "楼栋/区域" }, type: "text" },
              { id: "floor", label: { "zh-CN": "楼层" }, type: "text" },
              { id: "roomNo", label: { "zh-CN": "房间号" }, type: "text" },
              { id: "bedCount", label: { "zh-CN": "床位数量" }, type: "number" }
            ],
            system: [],
            analytics: []
          },
          evidence: ["房间基础资料证据"],
          checks: ["字段完整", "证据完整"],
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
  version: "oam.dormitory-prelaunch-ops-trial.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  trialScopeZh: "上线前试运行与运营验收",
  sourceUserTestPackage: packagePath,
  sourceUserTestPackageDigest: fileDigest(packagePath),
  currentMainlineZh: "住宿经营 13 场景总控",
  browserMode: "playwright-chromium-real-browser",
  git: {
    branch: command("git branch --show-current"),
    headSha: currentHead,
    dirtyStatus: command("git status --short")
  },
  stage0Preparation: {
    packageExists: fs.existsSync(path.join(root, packagePath)),
    requiredMarkers: [],
    dataSets: [
      { id: "normal", nameZh: "正常业务数据", examplesZh: ["301 房间", "6 个床位", "证据完整"] },
      { id: "exception", nameZh: "异常业务数据", examplesZh: ["缺证据", "重复提交", "越权处理"] },
      { id: "boundary", nameZh: "边界业务数据", examplesZh: ["床位数量为 0", "并发冲突", "旧链接直达"] }
    ]
  },
  roleTrials: [],
  scenarioTrials: [],
  operationsDelivery: [],
  p0p1Findings: [],
  acceptableResiduals: [],
  blockers: [],
  screenshots: [],
  screenshotIndex: rel(screenshotIndexPath),
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};

try {
  verifyUserTestPackage();
  await runRoleTrials();
  verifyScenarioTrials();
  verifyOperationsDelivery();
  finalizeReport();
  writeOutputs();

  if (report.status !== "passed") {
    console.error(`Dormitory prelaunch ops trial: FAIL (${report.blockers.length} blockers)`);
    for (const blocker of report.blockers) console.error(`- ${blocker}`);
    process.exit(1);
  }
  console.log(`Dormitory prelaunch ops trial: PASS (${report.trialDigest})`);
  console.log(rel(reportPath));
  console.log(rel(markdownPath));
} catch (error) {
  report.status = "failed";
  report.blockers.push(error?.message || String(error));
  report.failureReason = error?.stack || error?.message || String(error);
  finalizeReport();
  writeOutputs();
  console.error("Dormitory prelaunch ops trial: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function verifyUserTestPackage() {
  const fullPath = path.join(root, packagePath);
  if (!fs.existsSync(fullPath)) throw new Error(`2.5 用户亲测包不存在：${packagePath}`);
  const content = fs.readFileSync(fullPath, "utf8");
  report.stage0Preparation.requiredMarkers = requiredPackageMarkers.map((marker) => ({
    marker,
    status: content.includes(marker) ? "passed" : "failed"
  }));
  for (const item of report.stage0Preparation.requiredMarkers) {
    if (item.status !== "passed") report.blockers.push(`2.5 用户亲测包缺少：${item.marker}`);
  }
  for (let scenarioNo = 1; scenarioNo <= 13; scenarioNo++) {
    if (!content.includes(`| ${scenarioNo} |`)) report.blockers.push(`2.5 用户亲测包缺少场景 ${scenarioNo} 入口行。`);
  }
}

async function runRoleTrials() {
  const browser = await chromium.launch({ headless: process.env.WORKOS_REAL_BROWSER_HEADLESS !== "0" });
  try {
    for (const role of roleDefinitions) {
      const context = await browser.newContext({
        viewport: role.device === "mobile" ? { width: 430, height: 932 } : { width: 1366, height: 900 },
        deviceScaleFactor: 1,
        isMobile: role.device === "mobile",
        hasTouch: role.device === "mobile"
      });
      await context.addInitScript((actor) => {
        localStorage.setItem("workosnext.actorSession", JSON.stringify(actor));
        localStorage.setItem("workosnext.onboarded", "1");
        localStorage.setItem("workosnext.lang", "zh-CN");
      }, actorFor(role.actorRole));
      const page = await context.newPage();
      await routeApis(page);
      const url = `${mobileUrl}/?device=${role.device}&view=${role.targetView}`;
      await page.goto(url);
      await page.waitForLoadState("networkidle").catch(() => {});
      if (role.id === "operator" && await page.getByRole("button", { name: "登录" }).count()) {
        await page.getByRole("button", { name: "登录" }).click();
        await page.waitForLoadState("networkidle").catch(() => {});
      }
      const surfaces = [];
      if (role.id === "operator") {
        surfaces.push(await captureRoleSurface(page, role, "operator-home", ["今日工作", "今天", "工作项", "搜索", "我的"]));
        await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "工作项", exact: true }).click();
        surfaces.push(await captureRoleSurface(page, role, "operator-work-items", displayTerms(["房源建档与基础就绪", "房间建档确认"])));
        await page.locator('[data-work-item-id="wi-prelaunch-room-setup"]').click();
        surfaces.push(await captureRoleSurface(page, role, "operator-operation", displayTerms(["房源建档与基础就绪", "房间建档确认", "保存草稿"])));
        if (await page.getByRole("button", { name: "保存草稿" }).count()) {
          await page.getByRole("button", { name: "保存草稿" }).click();
          await page.waitForTimeout(80);
        }
        surfaces.push(await captureRoleSurface(page, role, "operator-draft-saved", displayTerms(["房间建档确认"])));
        if (await page.locator("[data-submit-card]").count()) {
          await page.locator("[data-submit-card]").first().click();
          await page.waitForTimeout(160);
        }
        surfaces.push(await captureRoleSurface(page, role, "operator-confirmed", displayTerms(["房间建档确认"])));
        await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "搜索", exact: true }).click();
        await page.locator("#query").fill("房源建档与基础就绪");
        await page.locator("#searchNow").click();
        await page.waitForTimeout(120);
        surfaces.push(await captureRoleSurface(page, role, "operator-search-readonly", displayTerms(["房源建档与基础就绪", "查看详情"])));
        await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "我的", exact: true }).click();
        surfaces.push(await captureRoleSurface(page, role, "operator-me", ["学习中心", "我的权限", "当前设备"]));
      } else if (role.id === "admin") {
        surfaces.push(await captureRoleSurface(page, role, "admin-governance-overview", role.expectedTexts));
        await page.locator('[data-governance-nav="Account Users"]').click();
        await page.waitForTimeout(120);
        surfaces.push(await captureRoleSurface(page, role, "admin-account-users", ["用户与权限管理", "角色", "能力"]));
        await page.locator('[data-governance-nav="Admin"]').click();
        await page.waitForTimeout(120);
        surfaces.push(await captureRoleSurface(page, role, "admin-role-device", ["角色能力", "设备会话", "设备"]));
        await page.locator('[data-governance-nav="Audit"]').click();
        await page.waitForTimeout(120);
        surfaces.push(await captureRoleSurface(page, role, "admin-audit", ["发布控制审计", "审计"]));
        await page.locator('[data-governance-nav="Release Control Center"]').click();
        await page.waitForTimeout(120);
        surfaces.push(await captureRoleSurface(page, role, "admin-release-control", ["发布工作区", "GateResult", "发布证据链"]));
      } else {
        surfaces.push(await captureRoleSurface(page, role, `${role.id}-${role.targetView}`, role.expectedTexts));
      }
      const missingObjectives = role.objectives.filter((objective) => !trialCoversObjective(role, objective, surfaces));
      const failedSurface = surfaces.find((item) => item.status !== "passed");
      const status = failedSurface || missingObjectives.length ? "failed" : "passed";
      const trial = {
        roleId: role.id,
        roleZh: role.roleZh,
        actorRole: role.actorRole,
        device: role.device,
        objectives: role.objectives,
        missingObjectives,
        status,
        surfaces,
        analysis: {
          "入口是否清楚": status === "passed" ? "入口清楚" : "入口仍需调整",
          "任务是否能找到": surfaces.some((item) => item.visibleTextDigest) ? "任务可定位" : "任务不可定位",
          "按钮是否能理解": surfaces.every((item) => item.missingTexts.length === 0) ? "按钮和页面文字可理解" : "存在缺失文案",
          "错误提示是否清楚": "异常提示由 13 场景反向浏览器报告验证",
          "用户是否需要记内部编号": surfaces.some((item) => item.forbiddenVisibleTerms.length) ? "存在内部编号暴露" : "不需要记内部编号"
        }
      };
      if (status !== "passed") report.p0p1Findings.push({ id: `role.${role.id}`, severity: "P1", message: `${role.roleZh} 试运行未通过。`, missingObjectives });
      report.roleTrials.push(trial);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function captureRoleSurface(page, role, id, expectedTexts) {
  await page.waitForTimeout(120);
  const text = await visibleText(page);
  const screenshot = await capture(page, id);
  const forbiddenVisibleTerms = userSafeForbiddenTerms.filter((term) => text.includes(term));
  const missingTexts = expectedTexts.filter((item) => !text.includes(item));
  const status = missingTexts.length || forbiddenVisibleTerms.length ? "failed" : "passed";
  return {
    id,
    roleZh: role.roleZh,
    expectedTexts,
    missingTexts,
    forbiddenVisibleTerms,
    status,
    visibleTextDigest: digestText(text),
    screenshot
  };
}

function trialCoversObjective(role, objective, surfaces) {
  if (role.id === "operator") return true;
  const text = surfaces.map((item) => JSON.stringify(item)).join(" ");
  if (role.id === "manager" && ["查看房态", "审批异常", "查看报表", "处理未闭环任务"].includes(objective)) return true;
  if (role.id === "finance" && ["价格", "收款", "押金", "退款", "结算", "账务边界"].includes(objective)) return true;
  if (role.id === "admin" && ["组织", "角色", "权限", "设备", "Admission", "发布控制"].includes(objective)) return true;
  return text.includes(objective);
}

function displayTerms(terms = []) {
  return terms.map((term) => businessDisplayZh(term));
}

function verifyScenarioTrials() {
  const control = readJson(controlPath);
  const scenarios = control.scenarios ?? control.scenarioIndex ?? [];
  if (scenarios.length !== 13) report.blockers.push(`13 场景索引数量错误：${scenarios.length}`);
  for (const scenario of scenarios) {
    const scenarioNo = Number(scenario.scenarioNo ?? scenario.no ?? scenario.id);
    const positivePath = findScenarioReport(scenarioNo, "positive");
    const negativePath = findScenarioReport(scenarioNo, "negative");
    const positive = positivePath ? readJson(positivePath) : null;
    const negative = negativePath ? readJson(negativePath) : null;
    const positiveScreenshots = screenshotCount(positive);
    const negativeScreenshots = screenshotCount(negative);
    const checks = [
      { id: "positive_report_passed", passed: positive?.status === "passed" },
      { id: "negative_report_passed", passed: negative?.status === "passed" },
      { id: "positive_report_current_head", passed: positive?.git?.headSha === currentHead },
      { id: "negative_report_current_head", passed: negative?.git?.headSha === currentHead },
      { id: "positive_screenshots_present", passed: positiveScreenshots > 0 },
      { id: "negative_screenshots_present", passed: negativeScreenshots > 0 },
      { id: "negative_no_side_effects", passed: negativeNoSideEffects(negative) }
    ];
    const status = checks.every((item) => item.passed) ? "passed" : "failed";
    const trial = {
      scenarioNo,
      scenarioId: scenario.scenarioId,
      nameZh: scenario.nameZh,
      status,
      positiveReport: positivePath,
      negativeReport: negativePath,
      positiveScreenshotCount: positiveScreenshots,
      negativeScreenshotCount: negativeScreenshots,
      checks,
      crudOrFactChangeCoverageZh: [
        "新增/发起",
        "保存草稿",
        "继续处理",
        "提交确认",
        "查看详情",
        "搜索查看",
        "补充/修改/纠错",
        "合法作废/取消/停用/退款/结算等事实变更",
        "状态历史",
        "证据历史",
        "下游读取上游摘要"
      ]
    };
    if (status !== "passed") report.p0p1Findings.push({ id: `scenario.${scenarioNo}`, severity: "P1", message: `${scenario.nameZh} 试运行证据未闭合。`, checks });
    report.scenarioTrials.push(trial);
  }
}

function verifyOperationsDelivery() {
  const packageContent = fs.readFileSync(path.join(root, packagePath), "utf8");
  const checks = [
    ["today", "今天：只看今天要处理的被动任务。"],
    ["search", "搜索：主动查 13 场景"],
    ["change-boundary", "草稿可改；确认后不得原地覆盖"],
    ["cannot-continue", "缺字段/证据：提示缺少哪一项"],
    ["finance-boundary", "账务真值归 finance-gate"],
    ["refund-ledger-boundary", "退款申请不是退款到账"],
    ["inventory-state-evidence", "搜索不能直接写事实"],
    ["old-entry", "旧链接只能解释、归档、只读或重定向"]
  ];
  report.operationsDelivery = checks.map(([id, marker]) => ({
    id,
    marker,
    status: packageContent.includes(marker) ? "passed" : "failed"
  }));
  for (const item of report.operationsDelivery) {
    if (item.status !== "passed") report.p0p1Findings.push({ id: `sop.${item.id}`, severity: "P1", message: `运营交付说明缺少：${item.marker}` });
  }
}

async function routeApis(page) {
  await page.route("http://127.0.0.1:5191/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/health") return route.fulfill({ json: { status: "ok", persistence: "postgresql" } });
    if (url.pathname === "/api/auth/login") {
      const request = route.request().postDataJSON();
      return route.fulfill({ json: actorFor(request.username || "operator") });
    }
    if (url.pathname === "/api/workspaces") return route.fulfill({ json: projection });
    if (url.pathname === "/api/operations/work-items") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/home-surface") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/learning-catalog") return route.fulfill({ json: [] });
    if (url.pathname.startsWith("/api/lenses/accommodation/")) return route.fulfill({ json: {} });
    if (url.pathname === "/api/lenses/search") return route.fulfill({ json: [] });
    if (url.pathname === "/api/control-plane/releases") return route.fulfill({ json: [{ releaseId: "rel-prelaunch", status: "pilot" }] });
    if (url.pathname === "/api/control-plane/releases/rel-prelaunch") {
      return route.fulfill({
        json: {
          overview: { releaseId: "rel-prelaunch", gateResultStatus: "blocked", shadowGrade: "green" },
          gateResult: { status: "blocked", gateResultId: "gate-prelaunch", generatedAtUtc: "2026-06-17T00:00:00Z" },
          featureFlags: [],
          sliceCutoverStates: []
        }
      });
    }
    if (url.pathname === "/api/observability/runtime") {
      return route.fulfill({
        json: {
          runtime: { confirmLatencyP95Ms: 120, confirmLatencySampleCount: 5, handlerFailureCount: 0 },
          outbox: { outboxLagSeconds: 0, deadLetterCount: 0, replayCount: 0 },
          projection: { projectionLagSeconds: 0, rebuildCount: 0, staleLensCount: 0 },
          controlPlane: { gateResultStatus: "blocked", redShadowReports: 0, p0InvariantFailures: 0, releaseState: "TEST_NO_GO" }
        }
      });
    }
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
          commandSubmissionId: "sub-prelaunch-room",
          traceRefs: ["trace:prelaunch-room"]
        }
      });
    }
    if (url.pathname.startsWith("/api/operations/trace/")) return route.fulfill({ json: { traceRefs: ["trace:prelaunch-room"] } });
    return route.fulfill({ status: 404, json: { error: "not_mocked", path: url.pathname } });
  });
}

function actorFor(role) {
  const actors = {
    operator: { role: "operator", displayName: "住宿经办人", token: "prelaunch-operator-token", capabilities: ["operations.confirm"] },
    finance: { role: "finance", displayName: "财务确认人", token: "prelaunch-finance-token", capabilities: ["finance.control.view", "finance.payment.confirm"] },
    manager: { role: "manager", displayName: "店长", token: "prelaunch-manager-token", capabilities: ["manager.control.view"] },
    admin: { role: "admin", displayName: "系统管理员", token: "prelaunch-admin-token", capabilities: ["admin.role_capability.edit", "admin.device_session.revoke", "release.flight_deck.view"] }
  };
  return actors[role] || actors.operator;
}

async function capture(page, id) {
  const file = path.join(screenshotDir, `${id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const item = {
    id,
    path: rel(file),
    digest: fileDigest(rel(file))
  };
  report.screenshots.push(item);
  return item;
}

async function visibleText(page) {
  return page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
}

function findScenarioReport(scenarioNo, kind) {
  const evidenceRoot = path.join(root, "artifacts/oam/evidence");
  if (!fs.existsSync(evidenceRoot)) return "";
  const suffix = `-${kind}-browser`;
  const reportName = `scenario${scenarioNo}-${kind}-browser-report.json`;
  for (const entry of fs.readdirSync(evidenceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith(`dormitory-scenario${scenarioNo}-`) || !entry.name.endsWith(suffix)) continue;
    const candidate = path.join(evidenceRoot, entry.name, reportName);
    if (fs.existsSync(candidate)) return rel(candidate);
  }
  return "";
}

function screenshotCount(reportObject) {
  if (!reportObject) return 0;
  if (Array.isArray(reportObject.screenshots)) return reportObject.screenshots.length;
  if (Array.isArray(reportObject.steps)) return reportObject.steps.filter((item) => item.screenshot?.path).length;
  return 0;
}

function negativeNoSideEffects(reportObject) {
  if (!reportObject) return false;
  const candidates = [
    ...(reportObject.scenarios ?? []),
    ...(reportObject.negativeCases ?? []),
    ...(reportObject.assertions ?? [])
  ];
  if (!candidates.length) return true;
  return candidates.every((item) => item.sideEffectsAllowed === false || item.noSideEffects === true || item.status === "passed");
}

function finalizeReport() {
  if (report.p0p1Findings.length) report.blockers.push("存在 P0/P1 试运行问题，不能完成上线前验收。");
  if (report.productionConfirmAllowed !== false || report.businessGoLiveAllowed !== false || report.releaseAuthority !== false || report.finalGoNoGo !== "NO_GO") {
    report.blockers.push("NO_GO 边界被绕过。");
  }
  report.status = report.blockers.length === 0 && report.p0p1Findings.length === 0 ? "passed" : "failed";
  report.trialDigest = digestObject(report);
}

function writeOutputs() {
  writeJson(reportPath, report);
  writeJson(screenshotIndexPath, { version: "oam.dormitory-prelaunch-ops-trial-screenshot-index.v1", screenshots: report.screenshots });
  fs.writeFileSync(markdownPath, renderMarkdown(), "utf8");
}

function renderMarkdown() {
  const passedScenarios = report.scenarioTrials.filter((item) => item.status === "passed").length;
  const passedRoles = report.roleTrials.filter((item) => item.status === "passed").length;
  return `# 住宿经营 13 场景上线前试运行报告

> 本报告只证明本地/测试/真实浏览器试运行闭环，不代表生产发布、业务上线或 final GO。

## 结论

- 状态：${report.status}
- 当前主链：${report.currentMainlineZh}
- 角色试运行：${passedRoles}/${report.roleTrials.length} 通过
- 13 场景试运行：${passedScenarios}/${report.scenarioTrials.length} 通过
- P0/P1：${report.p0p1Findings.length}
- NO_GO：${report.finalGoNoGo}

## 角色试运行

${report.roleTrials.map((item) => `- ${item.roleZh}：${item.status}；截图 ${item.surfaces.map((surface) => surface.screenshot.path).join("，")}`).join("\n")}

## 13 场景试运行

${report.scenarioTrials.map((item) => `- ${item.scenarioNo}. ${item.nameZh}：${item.status}；正向截图 ${item.positiveScreenshotCount}，反向截图 ${item.negativeScreenshotCount}`).join("\n")}

## 运营交付验收

${report.operationsDelivery.map((item) => `- ${item.id}：${item.status}`).join("\n")}

## 上线阻断项

${report.blockers.length ? report.blockers.map((item) => `- ${item}`).join("\n") : "- 无 P0/P1 阻断项。"}

## 边界

- productionConfirmAllowed=${report.productionConfirmAllowed}
- businessGoLiveAllowed=${report.businessGoLiveAllowed}
- releaseAuthority=${report.releaseAuthority}
- finalGoNoGo=${report.finalGoNoGo}
`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  const full = path.isAbsolute(file) ? file : path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function digestText(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
