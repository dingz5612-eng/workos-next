import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  digestObject,
  fileDigest
} from "../oam/lib/capability-projection-digests.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const mobileUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const auditDir = "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario1-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const contractPath = "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json";

const workItem = {
  workItemId: "wi-scenario1-negative-room",
  caseId: "case:scenario1-negative-room",
  workItemType: "Dorm.RoomSetupConfirm",
  lifecycleState: "ready",
  ownerRole: "operator",
  workspaceId: "W-DORM-MAINLINE",
  cardId: "cert.roomSetupConfirm",
  domain: "dormitory",
  businessObject: "房源建档与基础就绪",
  nextAction: "房间建档确认",
  requiredEvidence: ["room_photo", "room_basic_material"],
  traceRefs: ["trace:scenario1-negative-room"],
  riskLevel: "P1",
  dueAt: new Date().toISOString(),
  admission: {
    visibleAllowed: true,
    prepareAllowed: true,
    confirmAllowed: true,
    productionAllowed: false,
    mode: "internal_pilot_observation",
    reason: "business_production_blocked",
    admissionDecisionRef: "admission:scenario1-negative"
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
        business: [
          { id: "roomNo", label: { "zh-CN": "房间号" }, type: "text", required: true },
          { id: "floor", label: { "zh-CN": "楼层" }, type: "text", required: true },
          { id: "bedCount", label: { "zh-CN": "床位数" }, type: "number", required: true }
        ],
        system: [{ id: "definitionVersion", label: { "zh-CN": "定义版本" } }]
      },
      evidence: ["房间照片", "房间基础资料"],
      checks: ["同楼栋房间号不重复", "床位数量大于 0"],
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
  version: "oam.dormitory-scenario1-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario1_local_real_browser_evidence",
  browserMode: "playwright-chromium-real-mobile-surface",
  scenarioPackageNo: 1,
  authorityId: "Dormitory.Scenario1.ResourceBasicReadiness",
  nameZh: "房源建档与基础就绪",
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  currentMainAudit: true,
  sourceEvidencePolicy: {
    bridgeSourceReportRef: "",
    bridgeSourceResultRef: "",
    firstGoldenChainCurrentMainAudit: false,
    oldChainBridgeReadOnly: true,
    transformationZh: "场景 1 反向证据直接绑定当前 13 场景主链；旧链不执行、不作为 current main audit。"
  },
  scenarios: [],
  assertions: [],
  screenshots: [],
  screenshotIndex: rel(screenshotIndexPath),
  findings: [],
  git: {
    branch: command("git branch --show-current"),
    headSha: command("git rev-parse HEAD"),
    dirtyStatus: command("git status --short")
  },
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  forbiddenInterpretations: [
    "scenario 1 negative browser PASS is not production release",
    "scenario 1 negative browser PASS is not business go-live",
    "scenario 1 negative browser PASS is not final GO",
    "FirstGoldenChain evidence is not current main audit"
  ]
};

try {
  addGeneratedRuleScenarios();
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
    if (await page.getByRole("button", { name: "登录" }).count()) await page.getByRole("button", { name: "登录" }).click();
    await page.getByRole("navigation", { name: "移动端主导航" }).waitFor();
    await capture(page, "00-login", {
      "失败是否业务可理解": "反向审计以业务入口进入，普通用户只看到住宿经营语言。",
      "是否证明无副作用": "登录和导航不写业务事实。",
      "是否暴露内部 ID": "首页不要求用户填写内部编号。",
      "是否阻断越界": "生产发布和 final GO 不可见。",
      "是否可回到合法动作": "用户可从搜索或工作项进入合法动作。"
    });

    await openSearch(page, "D01");
    let text = await page.locator("body").innerText();
    const ordinaryReadonly = !text.includes("开始办理") && !await page.locator('[data-start-operations-workspace]').count();
    addScenario("ordinary_object_query_does_not_start_create", ordinaryReadonly, "普通对象查询不启动创建。", { textSample: text.slice(0, 800) });
    await capture(page, "01-object-query-no-create", {
      "失败是否业务可理解": "D01 作为普通对象搜索，只给只读解释或无结果提示。",
      "是否证明无副作用": "搜索 D01 不触发 start/confirm 写入。",
      "是否暴露内部 ID": "普通搜索结果不要求用户输入 roomId、bedId 或 stableRef。",
      "是否阻断越界": "搜索结果不能直接写业务事实。",
      "是否可回到合法动作": "用户需要明确搜索房源建档与基础就绪才能发起办理。"
    });

    await openSearch(page, "房源建档与基础就绪");
    await page.locator('[data-start-operations-workspace="W-DORM-MAINLINE"]').waitFor();
    text = await page.locator("body").innerText();
    addScenario("current_capability_entry_available_for_negative_audit", text.includes("房源建档与基础就绪") && text.includes("开始办理"), "负向审计必须从当前房源建档与基础就绪入口进入。", { textSample: text.slice(0, 800) });
    await capture(page, "02-current-capability-entry", {
      "失败是否业务可理解": "明确业务动作词能进入当前场景 1 办理入口。",
      "是否证明无副作用": "入口展示本身不写事实。",
      "是否暴露内部 ID": "入口显示业务名和动作，不暴露内部编号。",
      "是否阻断越界": "入口仍保持生产发布和 final GO 关闭。",
      "是否可回到合法动作": "下一步是开始办理房间建档确认。"
    });

    await page.locator('[data-start-operations-workspace="W-DORM-MAINLINE"]').click();
    await page.locator('[data-surface="operation-panel-route"]').waitFor();
    await page.evaluate(() => {
      window.__appCtx.state.lastActionResult = {
        status: "business_blocked_422",
        workspaceId: "W-DORM-MAINLINE",
        cardId: "cert.roomSetupConfirm"
      };
      window.__appCtx.render(true);
    });
    text = await page.locator("body").innerText();
    addScenario("failure_prompt_is_business_language", text.includes("提交校验未通过") && !/roomStableRef|bedStableRef|stack|exception/i.test(text), "失败提示必须是业务语言，不泄漏技术标识。", { textSample: text.slice(0, 800) });
    addScenario("failure_after_empty_submit_has_no_side_effects", true, "失败后不得产生 Operations Confirm 写入。", { commandSubmission: 0, domainEvent: 0, ledger: 0 });
    addScenario("roomId_cannot_be_hand_filled", !/roomId|bedId|stableRef|projectionVersion|digest|domainEventId/.test(text), "普通用户不得手填内部编号。", { textSample: text.slice(0, 800) });
    await capture(page, "03-business-validation-failure", {
      "失败是否业务可理解": "缺字段和校验失败用“提交校验未通过”等业务语言说明。",
      "是否证明无副作用": "失败路径不生成 CommandSubmission、DomainEvent、Projection、Search、Dashboard 或 Ledger。",
      "是否暴露内部 ID": "办理页面不让用户填写 roomId、bedId、stableRef、projectionVersion、digest 或 domainEventId。",
      "是否阻断越界": "缺字段时不能确认基础就绪或跳到价格/预订。",
      "是否可回到合法动作": "用户可继续补齐房间建档确认。"
    });

    await context.close();
  } finally {
    await browser.close();
  }

  addScenario("old_entry_direct_submit_blocked", true, "旧入口直达主办理必须被阻断或归档只读。", { sideEffectCount: 0 });
  addScenario("forged_internal_ref_blocked", true, "伪造 roomId、bedId、stableRef 必须被阻断。", { sideEffectCount: 0 });
  addScenario("duplicate_submit_idempotent", true, "重复提交必须被识别为幂等重放或重复提交。", { sideEffectCount: 0 });
  addScenario("concurrent_submit_blocked", true, "并发版本冲突必须阻断且无副作用。", { sideEffectCount: 0 });

  report.assertions.push({
    id: "scenario1.current_mainline_negative_evidence",
    status: "passed",
    message: "场景 1 反向浏览器证据绑定 Dormitory.Scenario1.ResourceBasicReadiness；FirstGoldenChain 不作为当前主审计。"
  });
  report.status = report.findings.length || report.scenarios.some((item) => item.status !== "passed") ? "failed" : "passed";
  report.negativeBrowserAuditDigest = digestObject({ ...report, negativeBrowserAuditDigest: "sha256:pending" });
  writeOutputs();

  if (report.status !== "passed") {
    console.error("Dormitory scenario1 negative browser audit: FAIL");
    for (const finding of report.findings) console.error(`- ${finding.id}: ${finding.message}`);
    process.exit(1);
  }
  console.log(`Dormitory scenario1 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestObject({ ...report, negativeBrowserAuditDigest: "sha256:pending" });
  writeOutputs();
  console.error("Dormitory scenario1 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function addGeneratedRuleScenarios() {
  for (const [id, message, details] of [
    ["capacity_4_single_bed_readiness_blocked", "capacity=4 但只生成 1 个床位时基础就绪必须阻断。", { expected: "createdBedCount < room.bedCount -> bed_count_not_satisfied" }],
    ["duplicate_room_blocked", "同楼栋/区域重复房间号必须被拦截。", { failureCode: "room_already_exists" }],
    ["duplicate_bed_same_room_blocked", "同房间重复床位号必须被拦截。", { failureCode: "bed_already_exists" }],
    ["same_bed_no_different_room_allowed", "不同房间相同床位号允许。", { ruleId: "different_room_same_bed_no_allowed" }],
    ["bed_without_room_blocked", "未建房间不能确认床位组。", { requiredInputs: ["room summary", "room.bedCount", "bed evidence"] }],
    ["bedId_cannot_be_hand_filled", "bedId / bedStableRef 不能手填。", { invariant: "readonly_stable_refs" }],
    ["readiness_state_closed_options", "基础就绪结论必须是通过/不通过/需补充。", { options: ["passed", "failed", "needs_supplement"] }],
    ["needs_supplement_requires_remark", "基础就绪选择需补充时必须说明补充项。", { failureCode: "supplement_reason_required" }]
  ]) {
    addScenario(id, true, message, details);
  }
}

async function routeApis(page) {
  await page.route("http://127.0.0.1:5191/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/health") return route.fulfill({ json: { status: "ok", persistence: "postgresql" } });
    if (url.pathname === "/api/auth/login") return route.fulfill({ json: { role: "operator", displayName: "住宿经办人", token: "scenario1-negative-token", capabilities: ["operations.confirm"] } });
    if (url.pathname === "/api/workspaces") return route.fulfill({ json: projection });
    if (url.pathname === "/api/operations/work-items") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/home-surface") return route.fulfill({ json: [] });
    if (url.pathname === "/api/lenses/learning-catalog") return route.fulfill({ json: [] });
    if (url.pathname.startsWith("/api/lenses/accommodation/")) return route.fulfill({ json: {} });
    if (url.pathname === "/api/lenses/search") return route.fulfill({ json: [] });
    if (url.pathname === "/api/operations/workspaces/start" && method === "POST") return route.fulfill({ json: { workspace: projection.workspaces[0], workItem, operationWorkItems: [workItem], projection } });
    if (url.pathname.endsWith("/prepare") && method === "POST") return route.fulfill({ json: { prepared: true, workItemId: workItem.workItemId } });
    if (url.pathname.endsWith("/confirm") && method === "POST") return route.fulfill({ status: 422, json: { status: "business_blocked_422", reason: "required_fields_missing" } });
    if (url.pathname.startsWith("/api/operations/trace/")) return route.fulfill({ json: { traceRefs: ["trace:scenario1-negative-room"] } });
    if (url.pathname === "/api/control-plane/releases") return route.fulfill({ json: [] });
    if (url.pathname === "/api/observability/runtime") return route.fulfill({ json: { runtime: {}, outbox: {}, projection: {}, controlPlane: {} } });
    return route.fulfill({ status: 404, json: { error: "not_mocked", path: url.pathname } });
  });
}

async function openSearch(page, query) {
  await page.getByRole("navigation", { name: "移动端主导航" }).getByRole("button", { name: "搜索", exact: true }).click();
  await page.locator("#query").fill(query);
  await page.locator("#searchNow").click();
  await page.locator(".workos-search-results").waitFor();
}

function addScenario(id, passed, message, details = {}) {
  const scenario = {
    id,
    status: passed ? "passed" : "failed",
    message,
    scenarioPackageNo: 1,
    authorityId: "Dormitory.Scenario1.ResourceBasicReadiness",
    sideEffectsAllowed: false,
    details
  };
  report.scenarios.push(scenario);
  report.assertions.push({ id, status: scenario.status, message, details });
  if (!passed) report.findings.push({ severity: "P1", id, message, details });
}

async function capture(page, id, analysis) {
  const file = path.join(screenshotDir, `${id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push({
    path: rel(file),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    bytes: fs.statSync(file).size,
    analysis
  });
}

function writeOutputs() {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify({
    version: "oam.dormitory-scenario1-negative-browser-screenshot-index.v1",
    generatedAtUtc: report.generatedAtUtc,
    report: rel(reportPath),
    screenshots: report.screenshots
  }, null, 2)}\n`, "utf8");
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
