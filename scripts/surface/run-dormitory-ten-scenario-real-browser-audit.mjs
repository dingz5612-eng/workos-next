import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const baseUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const apiUrl = process.env.WORKOS_API_URL || "http://127.0.0.1:5191";
const runId = process.env.WORKOS_TEN_DORM_SCENARIO_RUN_ID || "ten-dormitory-scenario-real-browser-20260605-post-unified-start";
const artifactRoot = path.join(root, "artifacts", "oam", "evidence", "dormitory-real-browser", runId);
const screenshotRoot = path.join(artifactRoot, "screenshots");
const reportPath = path.join(artifactRoot, "ten-scenario-real-browser-report.json");
const markdownPath = path.join(artifactRoot, "ten-scenario-real-browser-report.md");
const screenshotIndexPath = path.join(artifactRoot, "screenshot-index.json");

const scenarios = [
  scenario("01", "resource", "W-STAY-RESOURCE", "roomSetup", "新增住宿房源"),
  scenario("02", "lead-reservation", "W-STAY-LEAD-RESERVATION", "leadCapture", "登记咨询和预订"),
  scenario("03", "checkin", "W-STAY-CHECKIN", "lead", "安排入住和收款"),
  scenario("04", "lifecycle", "W-STAY-LIFECYCLE", "residentProfile", "维护在住信息"),
  scenario("05", "deposit-ledger", "W-STAY-DEPOSIT-LEDGER", "depositAssessment", "处理押金"),
  scenario("06", "payment-ledger", "W-STAY-PAYMENT-LEDGER", "paymentReceipt", "登记普通收款"),
  scenario("07", "checkout-settlement", "W-STAY-CHECKOUT-SETTLEMENT", "checkoutStart", "办理退住结算"),
  scenario("08", "service-task", "W-STAY-SERVICE-TASK", "serviceTaskCreate", "安排清洁或维修"),
  scenario("09", "expense-ledger", "W-STAY-EXPENSE-LEDGER", "expenseRecord", "登记宿舍支出"),
  scenario("10", "period-analytics", "W-STAY-PERIOD-ANALYTICS", "periodScope", "做周期复盘")
];

fs.mkdirSync(screenshotRoot, { recursive: true });

const report = {
  version: "dormitory.ten-scenario.real-browser.v1",
  status: "running",
  runId,
  generatedAtUtc: new Date().toISOString(),
  browserMode: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1" ? "playwright-chromium-headless" : "playwright-chromium-visible",
  mockPolicy: "real browser clicks and form input only; no route mocks; no backend simulation; no API substitute for user operations",
  endpoints: { baseUrl, apiUrl },
  scenarios: [],
  screenshots: [],
  networkEvents: [],
  git: {
    branch: command("git branch --show-current"),
    headSha: command("git rev-parse HEAD"),
    dirtyStatus: command("git status --short")
  },
  networkPolicy: {},
  assertions: [],
  findings: []
};

try {
  await requireHealthy(`${apiUrl}/health`, "Core API");
  await requireHealthy(baseUrl, "Mobile frontend");

  const browser = await chromium.launch({
    headless: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1",
    slowMo: Number(process.env.WORKOS_REAL_BROWSER_SLOWMO_MS || 40)
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 400, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    page.on("response", (response) => collectNetwork(response));

    await login(page);
    await openSearch(page);
    const entry = await capture(page, "00-search-entry", "搜索入口和 10 个统一新建入口");
    addAssertion("search.entry.unified_count", entry.domState.unifiedStartCount === 10, "搜索页必须暴露 10 个统一 Operations workspace 启动入口。", entry.domState);
    addAssertion("search.entry.no_resource_special_start", entry.domState.suppressedResourceStartCount === 0, "房源入口不得继续使用旧的专用启动分支。", entry.domState);

    for (const item of scenarios) {
      const scenarioResult = await runScenario(page, item);
      report.scenarios.push(scenarioResult);
    }

    await context.close();
  } finally {
    await browser.close();
  }

  report.networkPolicy = analyzeNetwork(report.networkEvents);
  report.assertions.push(...networkAssertions(report.networkPolicy));
  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed") ? "failed" : "passed";
  writeArtifacts();
  if (report.status !== "passed") {
    console.error(`Dormitory ten-scenario real browser audit: FAIL (${report.findings.length} findings)`);
    process.exitCode = 1;
  } else {
    console.log(`Dormitory ten-scenario real browser audit: PASS (${runId})`);
    console.log(rel(reportPath));
  }
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  writeArtifacts();
  console.error("Dormitory ten-scenario real browser audit: FAIL");
  console.error(report.failureReason);
  process.exitCode = 1;
}

async function runScenario(page, item) {
  const startedAt = Date.now();
  const result = {
    id: item.id,
    title: item.title,
    templateWorkspaceId: item.workspaceId,
    firstCardId: item.firstCardId,
    status: "running",
    negative: {},
    positive: {},
    steps: [],
    findings: []
  };

  const startNetworkIndex = report.networkEvents.length;
  await openSearch(page);
  await fill(page, "#query", item.title);
  await click(page, "#searchNow");
  await waitForHydrated(page);
  result.steps.push(await capture(page, `${item.index}-${item.id}-01-search`, `${item.title} 搜索结果`));

  const commandState = await readDomState(page);
  if (commandState.suppressedResourceStartCount > 0) {
    addFinding(result, "suppressed_resource_start_visible", "页面仍然出现旧房源专用启动入口。", commandState);
  }
  if (commandState.unifiedStartCount < 1) {
    addFinding(result, "unified_start_missing", `${item.title} 没有统一 Operations workspace 启动入口。`, commandState);
  }

  await click(page, `[data-start-operations-workspace="${item.workspaceId}"]`);
  await waitForOperationPanel(page);
  result.steps.push(await capture(page, `${item.index}-${item.id}-02-ready`, `${item.title} 新建步骤页`));

  const beforeEmptyConfirms = countConfirmWrites();
  await click(page, "[data-submit-card]");
  await waitForHydrated(page);
  result.steps.push(await capture(page, `${item.index}-${item.id}-03-empty-blocked`, `${item.title} 空提交反例`));
  const blocked = await readDomState(page);
  result.negative = {
    status: blocked.runtimeDecision === "blocked:required_field_missing" && blocked.invalidFields.length > 0 ? "passed" : "failed",
    runtimeDecision: blocked.runtimeDecision,
    invalidFieldCount: blocked.invalidFields.length
  };
  if (result.negative.status !== "passed") {
    addFinding(result, "empty_submit_not_blocked", `${item.title} 空提交没有被必填字段阻断。`, blocked);
  }
  if (countConfirmWrites() !== beforeEmptyConfirms) {
    addFinding(result, "empty_submit_called_confirm", `${item.title} 空提交不应调用 Operations Confirm。`, blocked);
  }

  await fillRequiredOperationFields(page, item);
  await waitForHydrated(page);
  result.steps.push(await capture(page, `${item.index}-${item.id}-04-filled`, `${item.title} 正例填写完成`));
  const beforeSubmitUrl = page.url();
  const beforePositiveConfirms = countConfirmWrites();
  const confirmResponse = page.waitForResponse((response) =>
    response.url().includes("/api/operations/work-items/") &&
    response.url().endsWith("/confirm") &&
    response.request().method() === "POST", { timeout: 45_000 }).catch(() => null);
  await click(page, "[data-submit-card]");
  const response = await confirmResponse;
  await waitForPositiveProgress(page, beforeSubmitUrl);
  result.steps.push(await capture(page, `${item.index}-${item.id}-05-positive-after-submit`, `${item.title} 正例提交后`));
  const after = await readDomState(page);
  const confirmDelta = countConfirmWrites() - beforePositiveConfirms;
  result.positive = {
    status: response && response.status() < 500 && confirmDelta === 1 && isProgressed(after, beforeSubmitUrl) ? "passed" : "failed",
    responseStatus: response?.status() || 0,
    confirmDelta,
    beforeSubmitUrl,
    afterSubmitUrl: page.url(),
    admissionDecision: after.admissionDecision,
    runtimeDecision: after.runtimeDecision
  };
  if (result.positive.status !== "passed") {
    addFinding(result, "positive_submit_not_accepted", `${item.title} 正例提交没有形成一次有效 Operations Confirm。`, result.positive);
  }

  const scenarioNetwork = report.networkEvents.slice(startNetworkIndex);
  result.network = analyzeNetwork(scenarioNetwork);
  result.durationMs = Date.now() - startedAt;
  result.status = result.findings.length ? "failed" : "passed";
  return result;
}

async function login(page) {
  await page.goto(`${baseUrl}/?view=login&lang=zh-CN&device=mobile`, { waitUntil: "domcontentloaded" });
  await waitForHydrated(page);
  await fill(page, "#loginAccount", "admin");
  await fill(page, "#loginPassword", "dev");
  await click(page, "#loginSubmit");
  await page.waitForFunction(() => {
    return !document.querySelector("#loginSubmit") &&
      (document.querySelector("[data-surface]") || document.querySelector("main") || document.querySelector("nav"));
  }, null, { timeout: 30_000 });
  await waitForHydrated(page);
  await capture(page, "00-login-complete", "管理员登录完成");
}

async function openSearch(page) {
  await waitForHydrated(page);
  const searchTab = page.locator('nav.bottom-nav [data-view="search"]');
  if (await searchTab.isVisible().catch(() => false)) {
    await click(page, 'nav.bottom-nav [data-view="search"]');
  } else {
    await page.goto(`${baseUrl}/?view=search&lang=zh-CN&device=mobile`, { waitUntil: "domcontentloaded" });
    await waitForHydrated(page);
  }
}

async function fillRequiredOperationFields(page, item) {
  for (let pass = 0; pass < 5; pass += 1) {
    const fields = await operationFields(page);
    let changed = 0;
    for (const [index, field] of fields.entries()) {
      if (!field.required || field.readonly || field.valuePresent) continue;
      const segmentedButton = page.locator(`[data-operation-field-button="${cssEscape(field.id)}"]`).first();
      if (await segmentedButton.isVisible().catch(() => false)) {
        await segmentedButton.click();
        await waitForHydrated(page);
        changed += 1;
        continue;
      }
      if (!field.visible) continue;
      const selector = `[data-operation-field="${cssEscape(field.id)}"]`;
      if (field.tag === "select") {
        const value = field.options.find((option) => option.value && !/请选择|select/i.test(option.text))?.value || field.options.find((option) => option.value)?.value;
        if (value) {
          await select(page, selector, value);
          changed += 1;
        }
        continue;
      }
      if (field.type === "checkbox" || field.type === "radio") {
        const target = await firstVisible(page.locator(selector));
        await target.check().catch(async () => target.click());
        changed += 1;
        continue;
      }
      await fill(page, selector, valueForField(field, item, index));
      changed += 1;
    }
    await waitForHydrated(page);
    if (changed === 0) break;
  }
}

async function operationFields(page) {
  return page.locator("[data-operation-field]").evaluateAll((nodes) => {
    const seen = new Set();
    return nodes.map((node) => {
      const id = node.dataset.operationField || node.getAttribute("name") || node.id || "";
      const key = `${id}:${node.tagName}:${node.getAttribute("type") || ""}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id,
        tag: node.tagName.toLowerCase(),
        type: node.getAttribute("type") || "",
        required: node.hasAttribute("required") || node.dataset.requiredField === "true",
        readonly: node.hasAttribute("readonly") || node.getAttribute("aria-readonly") === "true",
        visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
        valuePresent: node.type === "checkbox" || node.type === "radio"
          ? node.checked
          : Boolean(String(node.value || "").trim()),
        options: node.tagName.toLowerCase() === "select"
          ? Array.from(node.options).map((option) => ({ value: option.value, text: option.textContent || "" }))
          : []
      };
    }).filter(Boolean);
  });
}

function valueForField(field, item, index) {
  const id = String(field.id || "").toLowerCase();
  const suffix = shortSuffix();
  if (field.type === "datetime-local") return "2026-06-05T10:30";
  if (field.type === "date") return "2026-06-05";
  if (field.type === "number") {
    if (/year|年份|period/.test(id)) return "2026";
    if (/amount|money|rate|price|deposit|payment|fee|cost|balance|budget|押金|金额|费用|日价|周价|月价/.test(id)) return "300";
    if (/bed|capacity|count|床位|数量|人数/.test(id)) return "4";
    return "1";
  }
  if (/phone|mobile|联系电话|电话/.test(id)) return "13800000000";
  if (/email/.test(id)) return `audit-${suffix}@example.com`;
  if (/roomno|room_no|roomnumber|房号/.test(id)) return `A-${suffix}`;
  if (/roomid|room_id|房间/.test(id)) return `room-${suffix}`;
  if (/bedno|bed_no|bedlabel|床位/.test(id)) return `bed-${suffix}-01`;
  if (/building/.test(id)) return "A";
  if (/floor|楼层/.test(id)) return "3";
  if (/stay|resident|入住|住客/.test(id)) return `stay-${suffix}`;
  if (/lead|姓名|name/.test(id)) return `测试住客${suffix}`;
  if (/operator|owner|manager|负责人|收款人|确认人/.test(id)) return "admin";
  if (/period/.test(id)) return `period-${suffix}`;
  if (/date|time|日期|时间|截止/.test(id)) return "2026-06-05T10:30";
  if (/reason|remark|note|memo|description|说明|备注|原因|意见|措施|问题/.test(id)) return `${item.title}真实浏览器审计`;
  if (/evidence|凭证|材料/.test(id)) return `evidence-${suffix}`;
  return `audit-${field.id || index}-${suffix}`;
}

async function capture(page, stepId, title) {
  await waitForHydrated(page);
  const domState = await readDomState(page);
  const safe = safeName(stepId);
  const fullPath = path.join(screenshotRoot, `${safe}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const segmentEntries = await captureSegments(page, safe);
  const entry = {
    stepId,
    title,
    url: page.url(),
    atUtc: new Date().toISOString(),
    domState,
    screenshot: screenshotEntry(fullPath, "full"),
    segments: segmentEntries
  };
  report.screenshots.push(entry.screenshot, ...segmentEntries);
  return entry;
}

async function captureSegments(page, safe) {
  const viewport = page.viewportSize() || { width: 400, height: 844 };
  const scrollHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const maxY = Math.max(0, scrollHeight - viewport.height);
  const positions = maxY > 0 ? [{ kind: "top", y: 0 }, { kind: "bottom", y: maxY }] : [{ kind: "top", y: 0 }];
  const entries = [];
  const seen = new Set();
  for (const position of positions) {
    if (seen.has(position.y)) continue;
    seen.add(position.y);
    await page.evaluate((y) => window.scrollTo(0, y), position.y);
    await page.waitForTimeout(120);
    const filePath = path.join(screenshotRoot, `${safe}-${position.kind}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    entries.push(screenshotEntry(filePath, position.kind, position.y));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return entries;
}

async function readDomState(page) {
  return page.evaluate(() => {
    const primary = document.querySelector("[data-surface=\"completed-workspace-record\"], [data-surface=\"operation-panel-route\"], [data-surface=\"operation-panel-runtime\"], [data-surface=\"permission-diagnostic\"], [data-surface=\"workos-search\"], [data-surface]") || document.body;
    const fields = Array.from(document.querySelectorAll("[data-operation-field]")).map((node) => ({
      id: node.dataset.operationField || node.getAttribute("name") || node.id || "",
      tag: node.tagName.toLowerCase(),
      type: node.getAttribute("type") || "",
      required: node.hasAttribute("required") || node.dataset.requiredField === "true",
      invalid: node.getAttribute("aria-invalid") === "true" || node.dataset.validationState === "missing",
      readonly: node.hasAttribute("readonly") || node.getAttribute("aria-readonly") === "true",
      visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
      valuePresent: node.type === "checkbox" || node.type === "radio" ? node.checked : Boolean(String(node.value || "").trim())
    }));
    return {
      title: document.querySelector("h1")?.textContent?.trim() || "",
      surface: primary.dataset?.surface || "",
      admissionDecision: primary.dataset?.admissionDecision || "",
      runtimeDecision: primary.dataset?.runtimeDecision || "",
      lifecycleState: primary.dataset?.lifecycleState || "",
      actionState: primary.dataset?.actionState || "",
      blockerCode: primary.dataset?.blockerCode || "",
      submitCount: document.querySelectorAll("[data-submit-card]").length,
      nextStageCount: document.querySelectorAll("[data-work-item-id][data-card-id]").length,
      unifiedStartCount: document.querySelectorAll("[data-start-operations-workspace]").length,
      suppressedResourceStartCount: document.querySelectorAll("[data-start-operations-resource-setup]").length,
      invalidFields: fields.filter((field) => field.invalid).map((field) => field.id),
      emptyRequiredFields: fields.filter((field) => field.required && field.visible && !field.readonly && !field.valuePresent).map((field) => field.id),
      fields,
      textSample: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1600),
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      viewportHeight: window.innerHeight,
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

async function select(page, selector, value) {
  const target = await firstVisible(page.locator(selector));
  await target.selectOption(value);
  await page.waitForTimeout(160);
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
  await page.waitForTimeout(160);
  await page.waitForFunction(() => !document.querySelector("[data-surface=\"runtime-hydration\"]"), null, { timeout: 15_000 }).catch(() => {});
}

async function waitForOperationPanel(page) {
  await page.waitForFunction(() => {
    return document.querySelector("[data-surface=\"operation-panel-route\"]") ||
      document.querySelector("[data-surface=\"operation-panel-runtime\"]") ||
      document.querySelector("[data-surface=\"permission-diagnostic\"]");
  }, null, { timeout: 30_000 });
  await waitForHydrated(page);
}

async function waitForPositiveProgress(page, beforeUrl) {
  await page.waitForFunction((url) => {
    const primary = document.querySelector("[data-surface=\"completed-workspace-record\"], [data-surface=\"operation-panel-route\"], [data-surface=\"operation-panel-runtime\"], [data-surface]");
    const decision = primary?.dataset?.admissionDecision || "";
    const runtime = primary?.dataset?.runtimeDecision || "";
    const hrefChanged = window.location.href !== url;
    const completed = decision === "visible_readonly_completed" || document.querySelector("[data-surface=\"completed-workspace-record\"]");
    const readyNext = hrefChanged && primary?.dataset?.surface === "operation-panel-route" && runtime !== "blocked:required_field_missing";
    return completed || readyNext;
  }, beforeUrl, { timeout: 45_000 }).catch(() => {});
  await waitForHydrated(page);
}

function isProgressed(domState, beforeUrl) {
  if (domState.admissionDecision === "visible_readonly_completed") return true;
  if (domState.surface === "completed-workspace-record") return true;
  if (domState.url !== beforeUrl && domState.runtimeDecision !== "blocked:required_field_missing") return true;
  return domState.submitCount === 0 && domState.runtimeDecision !== "blocked:required_field_missing";
}

function collectNetwork(response) {
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
    event.method === "POST" &&
    /\/api\/operations\/work-items\/[^/]+\/confirm$/i.test(event.path)).length;
}

function analyzeNetwork(events) {
  const writes = events.filter((event) => event.method !== "GET");
  const workspaceStarts = writes.filter((event) => event.method === "POST" && event.path === "/api/operations/workspaces/start");
  const operationsConfirms = writes.filter((event) => event.method === "POST" && /\/api\/operations\/work-items\/[^/]+\/confirm$/i.test(event.path));
  const forbiddenWorkspaceCardWrites = writes.filter((event) => /\/api\/workspaces\/[^/]+\/cards\/[^/]+\/(prepare|confirm)$/i.test(event.path));
  const directBusinessFactWrites = writes.filter((event) => /\/api\/(audit-events|outbox|projections\/process-outbox)$/i.test(event.path));
  return {
    apiRequestCount: events.length,
    writeCount: writes.length,
    workspaceStartCount: workspaceStarts.length,
    operationsConfirmCount: operationsConfirms.length,
    forbiddenWorkspaceCardWrites,
    directBusinessFactWrites,
    noForbiddenWorkspaceCardWrites: forbiddenWorkspaceCardWrites.length === 0,
    noDirectBusinessFactWrites: directBusinessFactWrites.length === 0,
    writes
  };
}

function networkAssertions(policy) {
  return [
    assertion("network.workspace_start_count", policy.workspaceStartCount >= scenarios.length, "10 个场景必须通过 Operations workspace start 进入。", policy),
    assertion("network.operations_confirm_count", policy.operationsConfirmCount === scenarios.length, "10 个正例必须各形成一次 Operations Confirm。", policy),
    assertion("network.no_blocked_workspace_card_writes", policy.noForbiddenWorkspaceCardWrites, "不得调用旧 Workspace/Card prepare/confirm 写入口。", policy),
    assertion("network.no_direct_business_fact_writes", policy.noDirectBusinessFactWrites, "前端不得直接写业务事实、outbox 或投影。", policy)
  ];
}

function addAssertion(id, passed, message, details = {}) {
  report.assertions.push(assertion(id, passed, message, details));
  if (!passed) {
    report.findings.push({ id, severity: "P0", message, details });
  }
}

function assertion(id, passed, message, details = {}) {
  return { id, status: passed ? "passed" : "failed", severity: passed ? "none" : "P0", message, details };
}

function addFinding(result, id, message, details = {}) {
  const finding = { id: `${result.id}.${id}`, severity: "P0", message, details };
  result.findings.push(finding);
  report.findings.push(finding);
}

function writeArtifacts() {
  const screenshotIndex = {
    version: "dormitory.ten-scenario.screenshot-index.v1",
    runId,
    generatedAtUtc: report.generatedAtUtc,
    screenshots: report.screenshots
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, markdownReport(report), "utf8");
}

function markdownReport(current) {
  return [
    "# Dormitory Ten Scenario Real Browser Audit",
    "",
    `- Run ID: ${current.runId}`,
    `- Status: ${current.status}`,
    `- Browser mode: ${current.browserMode}`,
    `- Mock policy: ${current.mockPolicy}`,
    `- Scenario count: ${current.scenarios.length}`,
    `- Screenshot count: ${current.screenshots.length}`,
    `- Operations workspace starts: ${current.networkPolicy.workspaceStartCount || 0}`,
    `- Operations confirms: ${current.networkPolicy.operationsConfirmCount || 0}`,
    `- Blocked workspace/card writes: ${current.networkPolicy.forbiddenWorkspaceCardWrites?.length || 0}`,
    "",
    "| Scenario | Negative | Positive | Findings |",
    "| --- | --- | --- | ---: |",
    ...current.scenarios.map((item) => `| ${item.title} | ${item.negative?.status || "-"} | ${item.positive?.status || "-"} | ${item.findings?.length || 0} |`),
    "",
    "## Assertions",
    "",
    "| Assertion | Status |",
    "| --- | --- |",
    ...current.assertions.map((item) => `| ${item.id} | ${item.status} |`)
  ].join("\n") + "\n";
}

function screenshotEntry(filePath, kind, scrollY = null) {
  return {
    kind,
    path: rel(filePath),
    absolutePath: filePath,
    sha256: sha256(filePath),
    bytes: fs.statSync(filePath).size,
    scrollY
  };
}

async function requireHealthy(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} is not reachable: ${url} (${response.status})`);
}

function scenario(index, id, workspaceId, firstCardId, title) {
  return { index, id, workspaceId, firstCardId, title };
}

function shortSuffix() {
  return crypto.createHash("sha1").update(`${runId}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 8);
}

function safePath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function cssEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
