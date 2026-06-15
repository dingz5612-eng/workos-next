import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  CAPABILITY_ID,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH,
  FIRST_GOLDEN_CHAIN_STEPS,
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  buildProjectionDigestChain,
  digestBrowserAuditReport
} from "../oam/lib/capability-projection-digests.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const baseUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const apiUrl = process.env.WORKOS_API_URL || "http://127.0.0.1:5191";
const screenshotRoot = path.join(root, FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR, "screenshots");
const reportPath = path.join(root, FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH);
const screenshotIndexPath = path.join(root, FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH);
const account = { username: "dormOperator", password: "dev" };
const projectionChain = buildProjectionDigestChain(root);
const testPlan = readJson(FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH);
const forbiddenVisibleTerms = [
  "价格配置",
  "房间床位阻断",
  "房间床位释放",
  "生产确认",
  "发布确认",
  "Final GO"
];

fs.mkdirSync(screenshotRoot, { recursive: true });

const report = {
  version: "dormitory.first-golden-chain.real-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest: projectionChain.acceptedGeneratedBundleDigest,
  runtimeProjectionDigest: projectionChain.runtimeProjectionDigest,
  surfaceProjectionDigest: projectionChain.surfaceProjectionDigest,
  searchProjectionDigest: projectionChain.searchProjectionDigest,
  testPlanDigest: testPlan.testPlanDigest,
  browserAuditDigest: null,
  auditLevel: "runtime_test_only",
  auditPurpose: "当前第一金链 capability browser audit；只证明 accepted capability bundle projection 可被 runtime/mobile/search test-only 消费。",
  mainGate: "dormitory_first_golden_chain_capability_only",
  legacyBrowserAuditLane: {
    tenScenarioAsMainGate: false,
    allStepsAsMainGate: false,
    lane: "legacy_regression_only"
  },
  account: account.username,
  endpoints: { baseUrl, apiUrl },
  mockPolicy: "real Playwright Chromium browser clicks and form input only; no route mocks; no backend simulation; no API substitute for user operations",
  steps: [],
  screenshots: [],
  screenshotIndex: rel(screenshotIndexPath),
  networkEvents: [],
  assertions: [],
  findings: [],
  git: {
    branch: command("git branch --show-current"),
    headSha: command("git rev-parse HEAD"),
    dirtyStatus: command("git status --short")
  },
  runtimeConsumptionReady: false,
  runtimeConsumptionMode: "test-only",
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  forbiddenInterpretations: [
    "browser audit PASS is not business landing",
    "browser audit PASS is not production confirmation",
    "browser audit PASS is not release authority",
    "browser audit PASS is not final GO"
  ]
};

try {
  await requireHealthy(`${apiUrl}/health`, "Core API");
  await requireHealthy(baseUrl, "Mobile frontend");

  const browser = await chromium.launch({
    headless: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1",
    slowMo: Number(process.env.WORKOS_REAL_BROWSER_SLOWMO_MS || 35)
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
    await capture(page, "01-search-room-object-d01", "搜索 D01 不误启动新增命令");
    let searchState = await readDomState(page);
    addAssertion("search.object_query_d01_no_command", searchState.currentStartCount === 0, "搜索 D01 必须是对象查询，不得启动 current command。", searchState);

    await fill(page, "#query", "101房间");
    await click(page, "#searchNow");
    await waitForHydrated(page);
    await capture(page, "02-search-room-object-101", "搜索 101房间 不误启动新增命令");
    searchState = await readDomState(page);
    addAssertion("search.object_query_101_room_no_command", searchState.currentStartCount === 0, "搜索 101房间 必须是对象查询，不得启动 current command。", searchState);

    await fill(page, "#query", "新增房间");
    await click(page, "#searchNow");
    await waitForHydrated(page);
    await capture(page, "03-search-current-capability", "搜索新增房间只返回当前 capability 入口");
    searchState = await readDomState(page);
    addAssertion("search.only_current_capability_entry", searchState.currentStartCount === 1 && searchState.legacyStartCount === 0, "搜索新增房间必须只暴露当前 capability start。", searchState);

    await click(page, `[data-start-operations-workspace="${CAPABILITY_ID}"]`);
    await waitForOperationPanel(page);

    for (const [index, expected] of FIRST_GOLDEN_CHAIN_STEPS.entries()) {
      const ready = await readDomState(page);
      addAssertion(`step.${index + 1}.card_id`, ready.cardId === expected.cardId, `${expected.step} 必须停在 ${expected.cardId}。`, ready);
      addAssertion(`step.${index + 1}.label_visible`, ready.text.includes(expected.step), `${expected.step} 必须可见。`, ready);
      addAssertion(`step.${index + 1}.technical_details_collapsed`, ready.technicalDetailsOpen === false, "技术详情默认必须折叠。", ready);
      const readyFields = await operationFields(page);
      addSystemRefReadonlyAssertions(index, expected, readyFields);
      if (expected.workItemType === "Dorm.ResourceReadinessConfirm") {
        addReadinessOptionSetAssertions(readyFields);
      }
      addNoForbiddenVisibleTerms(`step.${index + 1}.ready`, ready);
      await capture(page, `${String(index + 4).padStart(2, "0")}-${expected.title}-ready`, `${expected.step} ${expected.title} ready`);

      if (index === 0) {
        const beforeConfirmCount = countConfirmWrites();
        await click(page, "[data-submit-card]");
        await waitForHydrated(page);
        const missing = await readDomState(page);
        addAssertion("validation.required_missing_blocks_submit", missing.text.includes("请先补齐必填项") || missing.text.includes("还需填写"), "字段缺失时必须显示失败态，且不得提交。", missing);
        addAssertion("validation.required_missing_no_confirm", countConfirmWrites() === beforeConfirmCount, "字段缺失失败态不得产生 Operations Confirm。", { beforeConfirmCount, afterConfirmCount: countConfirmWrites() });
        await capture(page, "04-required-missing-failure-state", "字段缺失失败态");
      }

      await fillRequiredOperationFields(page, expected);
      await waitForHydrated(page);
      if (index === 0) {
        await click(page, "[data-save-draft]");
        await waitForHydrated(page);
        const savedDraft = await draftSnapshot(page, expected.cardId);
        addAssertion("draft.current_step_user_fields_only", savedDraft.hasDraft && !savedDraft.fieldIds.includes("roomId") && !savedDraft.fieldIds.includes("bedId"), "草稿只能保存当前步骤用户输入字段，不得保存系统字段。", savedDraft);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForOperationPanel(page);
        const restored = await readDomState(page);
        addAssertion("draft.restore_current_step", restored.text.includes("请先补齐必填项") || (await operationFields(page)).some((field) => field.id === "roomNo" && field.valuePresent), "草稿刷新后必须恢复当前步骤输入。", restored);
        await capture(page, "05-draft-restore-current-step", "草稿当前步保存恢复");
      }
      await capture(page, `${String(index + 6).padStart(2, "0")}-${expected.title}-filled`, `${expected.step} ${expected.title} filled`);

      const submitResult = await submitCurrentStep(page, index);
      const after = submitResult.after;
      addAssertion(`step.${index + 1}.confirm_once`, submitResult.confirmDelta === 1 && submitResult.progressed, `${expected.step} 必须形成一次有效 Operations Confirm。`, submitResult);
      if (index === 0) {
        const cleanedDraft = await draftSnapshot(page, expected.cardId);
        addAssertion("draft.submit_success_cleans_current_step", cleanedDraft.hasDraft === false, "提交成功后必须清理当前步骤草稿。", cleanedDraft);
      }
      addNoForbiddenVisibleTerms(`step.${index + 1}.after_submit`, after);
      await capture(page, `${String(index + 6).padStart(2, "0")}-${expected.title}-after-submit`, `${expected.step} ${expected.title} after submit`);
    }

    const completed = await readDomState(page);
    addAssertion("completion.first_golden_chain_visible", completed.text.includes("第一金链内测完成"), "完成后必须显示第一金链内测完成。", completed);
    addAssertion("completion.business_values_visible", /A[0-9a-f]{4}/i.test(completed.text) && /-01/.test(completed.text) && completed.text.includes("可分配"), "完成页必须显示房间、床位、可分配等业务值。", completed);
    addAssertion("completion.no_raw_stable_id", !/\b(room|bed)-[a-f0-9]{8}\b/i.test(completed.text), "完成页不得显示 raw roomId/bedId。", completed);
    addAssertion("completion.technical_details_collapsed", completed.technicalDetailsOpen === false, "完成页技术详情默认必须折叠。", completed);
    addNoForbiddenVisibleTerms("completion", completed);
    await capture(page, "10-first-golden-chain-completed", "第一金链内测完成");

    await context.close();
  } finally {
    await browser.close();
  }

  const policy = analyzeNetwork(report.networkEvents);
  report.networkPolicy = policy;
  addAssertion("network.workspace_start_count", policy.workspaceStartCount === 1, "当前主审计必须只启动第一金链一次。", policy);
  addAssertion("network.operations_confirm_count", policy.operationsConfirmCount === 3, "当前主审计必须完成三次 Operations Confirm。", policy);
  addAssertion("network.no_old_workspace_card_writes", policy.noForbiddenWorkspaceCardWrites, "不得调用旧 workspace/card prepare/confirm 写入口。", policy);
  addAssertion("network.no_direct_business_fact_writes", policy.noDirectBusinessFactWrites, "前端不得直接写业务事实、outbox 或投影。", policy);
  addAssertion("network.no_production_release_final_go", policy.noProductionReleaseFinalGoCalls, "不得调用生产、发布或 Final GO 端点。", policy);
  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed") ? "failed" : "passed";
  report.browserAuditDigest = digestBrowserAuditReport(report);
  writeReport();
  if (report.status !== "passed") {
    console.error(`Dormitory first golden chain real browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log("Dormitory first golden chain real browser audit: PASS");
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.browserAuditDigest = digestBrowserAuditReport(report);
  writeReport();
  console.error("Dormitory first golden chain real browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
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

async function fillRequiredOperationFields(page, step) {
  for (let pass = 0; pass < 6; pass += 1) {
    const fields = await operationFields(page);
    let changed = 0;
    for (const field of fields) {
      if (!field.required || field.readonly || field.valuePresent || !field.visible) continue;
      const selector = `[data-operation-field="${cssEscape(field.id)}"]`;
      if (field.tag === "select") {
        const preferred = preferredSelectValue(field, step);
        const value = preferred || field.options.find((option) => option.value)?.value;
        if (value) {
          await select(page, selector, value);
          changed += 1;
        }
        continue;
      }
      await fill(page, selector, valueForField(field, step));
      changed += 1;
    }
    await waitForHydrated(page);
    if (changed === 0) break;
  }
}

async function operationFields(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll("[data-operation-field]")).map((node) => ({
    id: node.dataset.operationField || node.getAttribute("name") || node.id || "",
    tag: node.tagName.toLowerCase(),
    type: node.getAttribute("type") || "",
    required: node.hasAttribute("required") || node.dataset.requiredField === "true",
    readonly: node.hasAttribute("readonly") || node.getAttribute("aria-readonly") === "true",
    visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
    valuePresent: node.type === "checkbox" || node.type === "radio" ? node.checked : Boolean(String(node.value || "").trim()),
    options: node.tagName.toLowerCase() === "select"
      ? Array.from(node.options).map((option) => ({ value: option.value, text: option.textContent || "" })).filter((option) => option.value)
      : []
  })));
}

function addSystemRefReadonlyAssertions(index, expected, fields) {
  const systemRefs = fields.filter((field) => ["roomId", "bedId"].includes(field.id));
  for (const field of systemRefs) {
    addAssertion(
      `step.${index + 1}.${field.id}.not_editable`,
      field.readonly || !field.visible || field.type === "hidden",
      `${expected.step} ${field.id} 必须 readonly 或 hidden-submit-only。`,
      field);
  }
}

function addReadinessOptionSetAssertions(fields) {
  const readiness = fields.find((field) => field.id === "readinessState");
  const labels = (readiness?.options ?? []).map((option) => option.text);
  for (const label of ["可分配", "待清洁", "待维修", "待补材料", "暂不可用"]) {
    addAssertion(`readiness.closed_option.${safeName(label)}`, labels.includes(label), `readinessState 必须包含闭合选项 ${label}。`, { labels });
  }
  addAssertion("readiness.no_free_text_ready", readiness?.tag === "select" && !(readiness?.options ?? []).some((option) => option.value === "ready"), "readinessState 必须是闭合 select，且不得保留 ready 自由文本值。", readiness);
}

async function draftSnapshot(page, cardId) {
  return page.evaluate((targetCardId) => {
    const entries = Object.entries(localStorage)
      .filter(([key]) => key.startsWith("workosnext.operationDraft.") && key.endsWith(`.${targetCardId}`))
      .map(([key, raw]) => {
        try {
          const parsed = JSON.parse(raw);
          return { key, fieldIds: Object.keys(parsed.values || {}), values: parsed.values || {} };
        } catch {
          return { key, fieldIds: [], values: {} };
        }
      });
    return {
      cardId: targetCardId,
      hasDraft: entries.length > 0,
      fieldIds: entries.flatMap((entry) => entry.fieldIds),
      entries
    };
  }, cardId);
}

function valueForField(field, step) {
  const id = String(field.id || "").toLowerCase();
  const suffix = shortSuffix(`${step.cardId}-${field.id}`);
  if (/roomno|room_no|房号/.test(id)) return `A${suffix.slice(0, 4)}`;
  if (/floor|楼层/.test(id)) return "3";
  if (/capacity|bedcount|床位数/.test(id)) return "1";
  if (/bedno|bed_no|床位号/.test(id)) return "01";
  if (/roomid|room_id|所属房间/.test(id)) return `room-${suffix}`;
  if (/bedid|bed_id|床位/.test(id)) return `bed-${suffix}`;
  if (/readiness|就绪/.test(id)) return "ready";
  if (field.type === "number") return "1";
  return `audit-${suffix}`;
}

function preferredSelectValue(field, step) {
  const id = String(field.id || "").toLowerCase();
  if (/bedtype|床位类型/.test(id)) return "whole";
  if (/readiness|就绪/.test(id)) {
    return field.options.find((option) => /ready|pass|complete|可|就绪/.test(`${option.value} ${option.text}`))?.value || "";
  }
  return "";
}

async function capture(page, stepId, title) {
  await waitForHydrated(page);
  const domState = await readDomState(page);
  const safe = safeName(stepId);
  const fullPath = path.join(screenshotRoot, `${safe}.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const entry = {
    stepId,
    title,
    url: page.url(),
    atUtc: new Date().toISOString(),
    domState,
    screenshot: screenshotEntry(fullPath)
  };
  report.steps.push(entry);
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
      workItemId: url.searchParams.get("workItem") || "",
      currentStartCount: document.querySelectorAll('[data-start-operations-workspace="Dormitory.FirstGoldenChain"]').length,
      legacyStartCount: document.querySelectorAll('[data-start-operations-workspace="W-STAY-RESOURCE"]').length,
      submitCount: document.querySelectorAll("[data-submit-card]").length,
      technicalDetailsOpen: Array.from(document.querySelectorAll(".operation-technical-details, .system-check-details"))
        .some((node) => node.hasAttribute("open")),
      stepRailText: Array.from(document.querySelectorAll("[data-component='operation-step-rail'], .operation-step-rail")).map((node) => node.textContent || "").join(" "),
      text,
      url: window.location.href
    };
  });
}

function addNoForbiddenVisibleTerms(id, domState) {
  for (const term of forbiddenVisibleTerms) {
    addAssertion(`${id}.forbidden.${safeName(term)}`, !domState.text.includes(term), `当前第一金链不得出现 ${term}。`, { term, textSample: domState.text.slice(0, 1200) });
  }
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
  await page.waitForTimeout(120);
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
  await page.waitForFunction(() => document.querySelector("[data-surface=\"operation-panel-route\"], [data-surface=\"operation-panel-runtime\"], [data-surface=\"completed-workspace-record\"]"), null, { timeout: 30_000 });
  await waitForHydrated(page);
}

async function submitCurrentStep(page, index) {
  const beforeUrl = page.url();
  const beforeConfirmCount = countConfirmWrites();
  const next = FIRST_GOLDEN_CHAIN_STEPS[index + 1];

  let lastAfter = null;
  let attempts = 0;
  for (; attempts < 3; attempts += 1) {
    const beforeAttemptConfirmCount = countConfirmWrites();
    await click(page, "[data-submit-card]");
    const confirmObserved = await waitForConfirmEventCount(beforeAttemptConfirmCount + 1, 30_000);
    if (confirmObserved) {
      await waitForExpectedProgress(page, next, 45_000);
    } else {
      await waitForExpectedProgress(page, next, 10_000);
    }
    await waitForHydrated(page);
    lastAfter = await readDomState(page);

    const confirmDelta = countConfirmWrites() - beforeConfirmCount;
    const progressed = isExpectedProgress(lastAfter, next);
    if (progressed || confirmObserved) {
      return {
        confirmDelta,
        progressed,
        attempts: attempts + 1,
        expectedNextCardId: next?.cardId ?? "completed-workspace-record",
        beforeUrl,
        afterUrl: page.url(),
        after: lastAfter
      };
    }
    if (confirmDelta === 0) {
      await page.waitForTimeout(500);
      continue;
    }
  }

  const after = lastAfter || await readDomState(page);
  const confirmDelta = countConfirmWrites() - beforeConfirmCount;
  return {
    confirmDelta,
    progressed: isExpectedProgress(after, next),
    attempts,
    expectedNextCardId: next?.cardId ?? "completed-workspace-record",
    beforeUrl,
    afterUrl: page.url(),
    after
  };
}

async function waitForConfirmEventCount(targetCount, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (countConfirmWrites() >= targetCount) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function waitForExpectedProgress(page, next, timeoutMs) {
  if (next) {
    return page.waitForFunction((nextCardId) =>
      new URL(window.location.href).searchParams.get("card") === nextCardId,
    next.cardId, { timeout: timeoutMs }).then(() => true).catch(() => false);
  }
  return page.waitForFunction(() =>
    (document.body.innerText || "").includes("第一金链内测完成") ||
    document.querySelector("[data-surface=\"completed-workspace-record\"]"),
  null, { timeout: timeoutMs }).then(() => true).catch(() => false);
}

function isExpectedProgress(domState, next) {
  return next
    ? domState.cardId === next.cardId
    : domState.text.includes("第一金链内测完成") || domState.surface === "completed-workspace-record";
}

async function collectNetwork(response) {
  const url = response.url();
  if (!url.startsWith(apiUrl)) return;
  const request = response.request();
  const item = {
    atUtc: new Date().toISOString(),
    method: request.method(),
    url,
    path: safePath(url),
    status: response.status()
  };
  if (response.status() >= 400) {
    item.responseBody = await response.text().catch(() => "");
  }
  report.networkEvents.push(item);
}

function countConfirmWrites() {
  return report.networkEvents.filter((event) =>
    event.method === "POST" && /\/api\/operations\/work-items\/[^/]+\/confirm$/i.test(event.path)).length;
}

function analyzeNetwork(events = []) {
  const workspaceStartCount = events.filter((event) => event.method === "POST" && event.path === "/api/operations/workspaces/start").length;
  const operationsConfirmCount = events.filter((event) => event.method === "POST" && /\/api\/operations\/work-items\/[^/]+\/confirm$/i.test(event.path)).length;
  const forbiddenWorkspaceCardWrites = events.filter((event) => event.method === "POST" && /\/api\/workspaces\/[^/]+\/cards\/[^/]+\/(prepare|confirm)$/i.test(event.path));
  const directBusinessFactWrites = events.filter((event) => event.method === "POST" && /\/api\/(events|outbox|projections|facts)\b/i.test(event.path));
  const productionReleaseFinalGoCalls = events.filter((event) => /production|release|final-go|finalGoNoGo/i.test(event.path));
  return {
    workspaceStartCount,
    operationsConfirmCount,
    noForbiddenWorkspaceCardWrites: forbiddenWorkspaceCardWrites.length === 0,
    noDirectBusinessFactWrites: directBusinessFactWrites.length === 0,
    noProductionReleaseFinalGoCalls: productionReleaseFinalGoCalls.length === 0,
    errorCount: events.filter((event) => event.status >= 400).length,
    errors: events.filter((event) => event.status >= 400)
  };
}

function addAssertion(id, ok, message, details = {}) {
  const item = { id, status: ok ? "passed" : "failed", message, details };
  report.assertions.push(item);
  if (!ok) report.findings.push({ severity: "P0", id, message, details });
}

function screenshotEntry(filePath) {
  return {
    path: rel(filePath),
    sha256: sha256File(filePath),
    bytes: fs.statSync(filePath).size
  };
}

function writeReport() {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const screenshotIndex = {
    version: "dormitory.first-golden-chain.screenshot-index.v1",
    capabilityId: CAPABILITY_ID,
    report: rel(reportPath),
    generatedAtUtc: report.generatedAtUtc,
    screenshots: report.screenshots
  };
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function requireHealthy(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} is not healthy: ${response.status} ${url}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
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

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function shortSuffix(seed = `${Date.now()}-${Math.random()}`) {
  return crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 8);
}

function cssEscape(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
