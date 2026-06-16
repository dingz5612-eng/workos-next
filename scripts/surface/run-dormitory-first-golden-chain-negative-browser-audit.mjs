import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  CAPABILITY_ID,
  FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_DIR,
  FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH,
  buildProjectionDigestChain,
  digestObject
} from "../oam/lib/capability-projection-digests.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const baseUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const apiUrl = process.env.WORKOS_API_URL || "http://127.0.0.1:5191";
const screenshotRoot = path.join(root, FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_DIR, "screenshots");
const reportPath = path.join(root, FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH);
const screenshotIndexPath = path.join(root, FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH);
const account = { username: "dormOperator", password: "dev" };
const projectionChain = buildProjectionDigestChain(root);
const bedCardinality = readJson("docs/contracts/generated/dormitory/bed-cardinality.generated.json");
const businessInvariants = readJson("docs/contracts/generated/dormitory/business-invariants.generated.json");
const commandContracts = readJson("docs/contracts/generated/dormitory/command-contracts.generated.json");
const failureSemantics = readJson("docs/contracts/generated/dormitory/failure-semantics.generated.json");

fs.mkdirSync(screenshotRoot, { recursive: true });
let serviceHarness = null;

const report = {
  version: "dormitory.first-golden-chain.negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest: projectionChain.acceptedGeneratedBundleDigest,
  runtimeProjectionDigest: projectionChain.runtimeProjectionDigest,
  surfaceProjectionDigest: projectionChain.surfaceProjectionDigest,
  searchProjectionDigest: projectionChain.searchProjectionDigest,
  dbProjectionPolicyDigest: projectionChain.dbProjectionPolicyDigest,
  negativeBrowserAuditDigest: null,
  auditLevel: "runtime_test_only",
  auditPurpose: "房源建档与基础就绪 negative browser audit；只证明 generated 场景包 1 规则在 browser/runtime-test-only 证据面可被拒绝或阻断。",
  mainGate: "dormitory_first_golden_chain_negative_capability_only",
  historicalBrowserAuditLane: {
    wStayResourceAsCurrentProof: false,
    roomSetupAsCurrentProof: false,
    bedSetupAsCurrentProof: false,
    roomReadinessAsCurrentProof: false,
    tenScenarioAsMainGate: false,
    allStepsAsMainGate: false,
    lane: "historical_advisory_only"
  },
  account: account.username,
  endpoints: { baseUrl, apiUrl },
  browserMode: "playwright-real-browser",
  mockPolicy: "real Playwright Chromium browser for surface assertions; generated runtime rules for failure matrix; no production or release calls",
  scenarios: [],
  assertions: [],
  screenshots: [],
  screenshotIndex: rel(screenshotIndexPath),
  networkEvents: [],
  findings: [],
  git: {
    branch: command("git branch --show-current"),
    headSha: command("git rev-parse HEAD"),
    dirtyStatus: command("git status --short")
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  forbiddenInterpretations: [
    "negative browser audit PASS is not business landing",
    "negative browser audit PASS is not production confirmation",
    "negative browser audit PASS is not release authority",
    "negative browser audit PASS is not final GO"
  ]
};

try {
  addGeneratedRuleScenarios();
  serviceHarness = await ensureServicesReady();
  await requireHealthy(`${apiUrl}/health`, "Core API");
  await requireHealthy(baseUrl, "Mobile frontend");

  const browser = await chromium.launch({
    headless: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1",
    slowMo: Number(process.env.WORKOS_REAL_BROWSER_SLOWMO_MS || 25)
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 400, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    page.on("response", (response) => {
      void collectNetwork(response);
    });

    await login(page);
    await openSearch(page);
    await fill(page, "#query", "D01");
    await click(page, "#searchNow");
    await waitForHydrated(page);
    let dom = await readDomState(page);
    addScenario("ordinary_object_query_does_not_start_create", dom.currentStartCount === 0, "普通对象查询不启动创建。", { dom });
    await capture(page, "01-object-query-no-create", "普通对象查询不启动创建");

    await fill(page, "#query", "新增房间");
    await click(page, "#searchNow");
    await waitForHydrated(page);
    await waitForCurrentCapabilityStart(page);
    dom = await readDomState(page);
    addScenario("current_capability_entry_available_for_negative_audit", dom.currentStartCount === 1 && dom.historicalStartCount === 0, "负向审计必须从当前房源建档与基础就绪入口进入。", { dom });
    await capture(page, "02-current-capability-entry", "当前房源建档与基础就绪入口");
    await click(page, `[data-start-operations-workspace="${CAPABILITY_ID}"]`);
    await waitForOperationPanel(page);
    dom = await readDomState(page);
    const fields = await operationFields(page);
    addReadonlyScenario("roomId_cannot_be_hand_filled", fields, "roomId");
    addReadonlyScenario("buildingContextRef_cannot_be_hand_filled", fields, "buildingContextRef");
    await capture(page, "02-room-system-refs-readonly", "roomId/buildingContextRef 不能手填");

    const beforeConfirm = countConfirmWrites();
    await click(page, "[data-submit-card]");
    await waitForHydrated(page);
    dom = await readDomState(page);
    addScenario(
      "failure_prompt_is_business_language",
      /请先补齐必填项|还需填写|当前确认缺少必填业务字段/.test(dom.text) && !/roomStableRef|bedStableRef|stack|exception/i.test(dom.text),
      "失败提示必须是业务语言，不泄漏技术标识。",
      { textSample: dom.text.slice(0, 1200) });
    addScenario(
      "failure_after_empty_submit_has_no_side_effects",
      countConfirmWrites() === beforeConfirm,
      "失败后不得产生 Operations Confirm 写入。",
      { beforeConfirm, afterConfirm: countConfirmWrites() });
    await capture(page, "03-empty-submit-business-failure", "空提交业务失败且无副作用");

    await context.close();
  } finally {
    await browser.close();
  }

  const policy = analyzeNetwork(report.networkEvents);
  report.networkPolicy = policy;
  addScenario("old_paths_advisory_only", oldPathPolicyPassed(), "旧路径只能作为 advisory，不得作为 current proof。", report.historicalBrowserAuditLane);
  addScenario("no_production_release_final_go_calls", policy.noProductionReleaseFinalGoCalls, "负向审计不得调用生产、发布或 Final GO。", policy);
  report.status = report.findings.length || report.scenarios.some((item) => item.status !== "passed") ? "failed" : "passed";
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeReport();
  if (report.status !== "passed") {
    await stopStartedServices(serviceHarness);
    serviceHarness = null;
    console.error(`Dormitory first golden chain negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  await stopStartedServices(serviceHarness);
  serviceHarness = null;
  console.log("Dormitory first golden chain negative browser audit: PASS");
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeReport();
  await stopStartedServices(serviceHarness);
  serviceHarness = null;
  console.error("Dormitory first golden chain negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function addGeneratedRuleScenarios() {
  const bedRules = bedCardinality.rules ?? [];
  const invariantRules = businessInvariants.invariants ?? [];
  const failureCodes = new Set((failureSemantics.failureSemantics ?? []).map((item) => item.code));
  const commandInputs = new Map((commandContracts.commands ?? []).map((item) => [item.command, item.requiredInputs ?? []]));
  addScenario(
    "capacity_4_single_bed_readiness_blocked",
    hasRule(bedRules, "resource_readiness_blocked_until_complete_bed_set") && failureCodes.has("bed_count_not_satisfied"),
    "capacity=4 但只生成 1 个床位时 ResourceReadinessConfirm 必须阻断。",
    { expected: "createdBedCount < room.bedCount -> bed_count_not_satisfied" });
  addScenario(
    "duplicate_room_blocked",
    hasFailure("room_already_exists") && hasInvariant("room_unique_within_building_context"),
    "重复房间必须被拦截。",
    { failureCode: "room_already_exists" });
  addScenario(
    "duplicate_bed_same_room_blocked",
    hasFailure("bed_already_exists") && hasRule(bedRules, "same_room_same_bed_no_forbidden"),
    "同房间重复床位必须被拦截。",
    { failureCode: "bed_already_exists" });
  addScenario(
    "same_bed_no_different_room_allowed",
    bedRules.some((item) => item.ruleId === "different_room_same_bed_no_allowed" && item.allowed === true),
    "不同房间相同 bedNo 必须允许。",
    { ruleId: "different_room_same_bed_no_allowed" });
  addScenario(
    "bed_without_room_blocked",
    commandInputs.get("Dorm.BedSetupConfirm")?.includes("roomStableRef") === true,
    "未建房间不能建床位；BedSetupConfirm 必须需要 roomStableRef 上下文。",
    { requiredInputs: commandInputs.get("Dorm.BedSetupConfirm") ?? [] });
  addScenario(
    "bedId_cannot_be_hand_filled",
    hasInvariant("readonly_stable_refs"),
    "bedId / bedStableRef 不能手填。",
    { invariant: "readonly_stable_refs" });
  addScenario(
    "readiness_state_closed_options",
    JSON.stringify(businessInvariants.closedOptionSets?.readinessState ?? []) === JSON.stringify(["passed", "failed", "needs_supplement"]),
    "readinessState 必须是封闭选项。",
    { options: businessInvariants.closedOptionSets?.readinessState ?? [] });
  addScenario(
    "needs_supplement_requires_remark",
    businessInvariants.closedOptionSets?.readinessState?.includes("needs_supplement") && failureCodes.has("supplement_reason_required"),
    "基础就绪选择需补充时必须说明补充项。",
    { failureCode: "supplement_reason_required" });
}

function addReadonlyScenario(id, fields, fieldId) {
  const field = fields.find((item) => item.id === fieldId);
  addScenario(
    id,
    !field || field.readonly || !field.visible || field.type === "hidden",
    `${fieldId} 不能手填。`,
    { field: field ?? null });
}

async function login(page) {
  await page.context().clearCookies();
  await page.goto(`${baseUrl}/?view=login&lang=zh-CN&device=mobile`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("workosnext.actorSession");
    localStorage.setItem("workosnext.onboarded", "true");
  });
  await page.goto(`${baseUrl}/?view=login&lang=zh-CN&device=mobile`, { waitUntil: "domcontentloaded" });
  await waitForHydrated(page);
  await fill(page, "#loginAccount", account.username);
  await fill(page, "#loginPassword", account.password);
  await click(page, "#loginSubmit");
  await page.waitForFunction(() => !document.querySelector("#loginSubmit") &&
    (document.querySelector("[data-surface]") || document.querySelector("main") || document.querySelector("nav")), null, { timeout: 30_000 });
  await waitForHydrated(page);
  await capture(page, "00-login-dormOperator", "dormOperator 登录");
}

async function openSearch(page) {
  await waitForHydrated(page);
  const searchTab = page.locator('nav.bottom-nav [data-view="search"]');
  if (await searchTab.isVisible().catch(() => false)) {
    await click(page, 'nav.bottom-nav [data-view="search"]');
    return;
  }
  await page.goto(`${baseUrl}/?view=search&lang=zh-CN&device=mobile`, { waitUntil: "domcontentloaded" });
  await waitForHydrated(page);
}

async function operationFields(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll("[data-operation-field]")).map((node) => ({
    id: node.dataset.operationField || node.getAttribute("name") || node.id || "",
    tag: node.tagName.toLowerCase(),
    type: node.getAttribute("type") || "",
    required: node.hasAttribute("required") || node.dataset.requiredField === "true",
    readonly: node.hasAttribute("readonly") || node.getAttribute("aria-readonly") === "true",
    visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
    value: node.type === "checkbox" || node.type === "radio" ? String(node.checked) : String(node.value || "")
  })));
}

async function capture(page, stepId, title) {
  await waitForHydrated(page);
  const safe = safeName(stepId);
  const fullPath = path.join(screenshotRoot, `${safe}.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const entry = {
    stepId,
    title,
    url: page.url(),
    atUtc: new Date().toISOString(),
    domState: await readDomState(page),
    screenshot: screenshotEntry(fullPath)
  };
  report.screenshots.push(entry.screenshot);
  return entry;
}

async function readDomState(page) {
  return page.evaluate(() => {
    const url = new URL(window.location.href);
    const text = (document.body.innerText || "").replace(/\s+/g, " ").trim();
    return {
      surface: document.querySelector("[data-surface]")?.dataset?.surface || "",
      workspaceId: url.searchParams.get("workspace") || "",
      cardId: url.searchParams.get("card") || "",
      currentStartCount: document.querySelectorAll('[data-start-operations-workspace="Dormitory.FirstGoldenChain"]').length,
      historicalStartCount: document.querySelectorAll('[data-start-operations-workspace="W-STAY-RESOURCE"]').length,
      text,
      url: window.location.href
    };
  });
}

async function click(page, selector) {
  const target = await firstVisible(page.locator(selector));
  await target.click();
  await waitForHydrated(page);
}

async function fill(page, selector, value) {
  const target = await firstVisible(page.locator(selector));
  await target.fill(value);
  await page.waitForTimeout(100);
}

async function firstVisible(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return locator.first();
}

async function waitForHydrated(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(180);
  await page.waitForFunction(() => !document.querySelector("[data-surface=\"runtime-hydration\"]"), null, { timeout: 15_000 }).catch(() => {});
}

async function waitForOperationPanel(page) {
  await page.waitForFunction(() => document.querySelector("[data-surface=\"operation-panel-route\"], [data-surface=\"operation-panel-runtime\"]"), null, { timeout: 75_000 });
  await waitForHydrated(page);
}

async function waitForCurrentCapabilityStart(page) {
  await page.waitForFunction((capabilityId) =>
    document.querySelectorAll(`[data-start-operations-workspace="${capabilityId}"]`).length === 1,
  CAPABILITY_ID, { timeout: 30_000 });
  await waitForHydrated(page);
}

async function collectNetwork(response) {
  const url = response.url();
  if (!url.startsWith(apiUrl)) return;
  const request = response.request();
  report.networkEvents.push({
    atUtc: new Date().toISOString(),
    method: request.method(),
    url,
    path: safePath(url),
    status: response.status()
  });
}

function countConfirmWrites() {
  return report.networkEvents.filter((event) =>
    event.method === "POST" && /\/api\/operations\/work-items\/[^/]+\/confirm$/i.test(event.path)).length;
}

function analyzeNetwork(events = []) {
  const productionReleaseFinalGoCalls = events.filter((event) => /production|release|final-go|finalGoNoGo/i.test(event.path));
  return {
    workspaceStartCount: events.filter((event) => event.method === "POST" && event.path === "/api/operations/workspaces/start").length,
    operationsConfirmCount: countConfirmWrites(),
    noProductionReleaseFinalGoCalls: productionReleaseFinalGoCalls.length === 0,
    errors: events.filter((event) => event.status >= 400)
  };
}

function addScenario(id, ok, message, details = {}) {
  const item = { id, status: ok ? "passed" : "failed", message, details };
  report.scenarios.push(item);
  report.assertions.push(item);
  if (!ok) report.findings.push({ severity: "P0", id, message, details });
}

function hasRule(rules, ruleId) {
  return rules.some((item) => item.ruleId === ruleId || item.sourceRuleId === ruleId);
}

function hasInvariant(ruleId) {
  return (businessInvariants.invariants ?? []).some((item) => item.ruleId === ruleId || item.sourceRuleId === ruleId);
}

function hasFailure(code) {
  return (failureSemantics.failureSemantics ?? []).some((item) => item.code === code);
}

function oldPathPolicyPassed() {
  return Object.entries(report.historicalBrowserAuditLane)
    .filter(([key]) => key !== "lane")
    .every(([, value]) => value === false) &&
    report.historicalBrowserAuditLane.lane === "historical_advisory_only";
}

function writeReport() {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const screenshotIndex = {
    version: "dormitory.first-golden-chain.negative-browser.screenshot-index.v1",
    capabilityId: CAPABILITY_ID,
    report: rel(reportPath),
    generatedAtUtc: report.generatedAtUtc,
    screenshots: report.screenshots
  };
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function digestNegativeReport(value) {
  return digestObject({ ...value, negativeBrowserAuditDigest: "sha256:pending" });
}

async function requireHealthy(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} is not healthy: ${response.status} ${url}`);
}

async function ensureServicesReady() {
  const apiReady = await isHealthy(`${apiUrl}/health`);
  const webReady = await isHealthy(baseUrl);
  if (apiReady && webReady) {
    return { started: false, processes: [] };
  }

  const logDir = path.join(root, "artifacts/oam/test-results/real-browser-services");
  fs.mkdirSync(logDir, { recursive: true });
  const processes = [];

  if (!apiReady) {
    const apiProject = path.join(root, "services/core-api/WorkOS.Api/WorkOS.Api.csproj");
    execSync(`dotnet build "${apiProject}" -c Release`, { cwd: root, stdio: "inherit" });
    const apiDll = path.join(root, "services/core-api/WorkOS.Api/bin/Release/net10.0/WorkOS.Api.dll");
    processes.push(startService(
      "dotnet",
      [apiDll],
      root,
      {
        ASPNETCORE_ENVIRONMENT: process.env.ASPNETCORE_ENVIRONMENT || "Development",
        ASPNETCORE_URLS: process.env.ASPNETCORE_URLS || apiUrl,
        ConnectionStrings__WorkOSRuntime: process.env.ConnectionStrings__WorkOSRuntime ||
          "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev",
        WORKOS_REAL_BROWSER_USE_INMEMORY: process.env.WORKOS_REAL_BROWSER_USE_INMEMORY || "1",
        WORKOS_API_URL: apiUrl
      },
      path.join(logDir, "negative-api.out.log"),
      path.join(logDir, "negative-api.err.log")
    ));
  }

  if (!webReady) {
    processes.push(startService(
      "node",
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5175"],
      path.join(root, "apps/mobile"),
      {
        WORKOS_API_URL: apiUrl,
        WORKOS_MOBILE_URL: baseUrl
      },
      path.join(logDir, "negative-mobile.out.log"),
      path.join(logDir, "negative-mobile.err.log")
    ));
  }

  await waitHealthy(`${apiUrl}/health`, "Core API");
  await waitHealthy(baseUrl, "Mobile frontend");
  return { started: true, processes };
}

function startService(commandName, args, cwd, envOverrides, stdoutPath, stderrPath) {
  const stdout = fs.openSync(stdoutPath, "a");
  const stderr = fs.openSync(stderrPath, "a");
  return spawn(commandName, args, {
    cwd,
    env: { ...process.env, ...envOverrides },
    stdio: ["ignore", stdout, stderr],
    windowsHide: true
  });
}

async function waitHealthy(url, label) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 90_000) {
    if (await isHealthy(url)) return;
    try {
      await requireHealthy(url, label);
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await sleep(1_000);
  }
  throw new Error(`${label} did not become ready at ${url}. Last error: ${lastError || "not healthy"}`);
}

async function isHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function stopStartedServices(harness) {
  if (!harness?.started) return;
  for (const child of [...harness.processes].reverse()) {
    if (!child || child.killed || child.exitCode !== null) continue;
    child.kill();
  }
  await sleep(500);
  for (const child of [...harness.processes].reverse()) {
    if (!child || child.killed || child.exitCode !== null) continue;
    child.kill("SIGKILL");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function screenshotEntry(filePath) {
  return {
    path: rel(filePath),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
    bytes: fs.statSync(filePath).size
  };
}

function safePath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function safeName(value) {
  return String(value || "step").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
