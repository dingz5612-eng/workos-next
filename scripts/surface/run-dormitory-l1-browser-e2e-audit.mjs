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
const runId = process.env.WORKOS_DORM_L1_AUDIT_RUN_ID || timestampId();
const artifactRoot = path.join(root, "artifacts", "oam", "evidence", "dormitory-l1-browser-e2e");
const runDir = path.join(artifactRoot, runId);
const screenshotDir = path.join(runDir, "screenshots");
const reportPath = path.join(runDir, "dormitory-l1-browser-e2e-report.json");
const mdPath = path.join(runDir, "dormitory-l1-browser-e2e-report.md");
const screenshotIndexPath = path.join(runDir, "screenshot-index.json");
const latestPath = path.join(artifactRoot, "latest-report.json");

fs.mkdirSync(screenshotDir, { recursive: true });

const git = {
  repository: "dingz5612-eng/workos-next",
  branch: command("git branch --show-current"),
  headSha: command("git rev-parse HEAD"),
  dirtyStatus: command("git status --short")
};
const ciRun = await latestCiRun(git.branch);
const report = {
  version: "dormitory-l1.browser-e2e-audit.v1",
  status: "running",
  runId,
  generatedAtUtc: new Date().toISOString(),
  browserMode: "playwright-real-browser",
  mockPolicy: "no route mocks, no backend simulation, no API substitute for user operations, no localStorage injection",
  scope: {
    included: ["Dormitory L1 observation flow"],
    excluded: ["Repair", "Parts", "HR"]
  },
  endpoints: { baseUrl, apiUrl },
  git,
  ciRun,
  scenarios: [],
  screenshots: [],
  networkPolicy: {},
  architectureAssertions: [],
  violations: [],
  outputs: {}
};

try {
  await requireHealthy(`${apiUrl}/health`, "Core API");
  await requireHealthy(baseUrl, "Mobile frontend");

  const browser = await chromium.launch({
    headless: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1",
    slowMo: Number(process.env.WORKOS_REAL_BROWSER_SLOWMO_MS || 40)
  });
  const allNetworkEvents = [];
  let completedUrl = "";

  try {
    const positive = await runPositiveScenario(browser, allNetworkEvents);
    report.scenarios.push(positive.scenario);
    completedUrl = positive.completedUrl;

    report.scenarios.push(await runIllegalAccessScenario(browser, allNetworkEvents));
    report.scenarios.push(await runUnauthorizedScenario(browser, allNetworkEvents));
    report.scenarios.push(await runWrongStatusScenario(browser, allNetworkEvents, completedUrl));
  } finally {
    await browser.close();
  }

  report.networkPolicy = analyzeNetwork(allNetworkEvents);
  report.architectureAssertions = architectureAssertions(report);
  report.violations.push(...report.architectureAssertions.filter((item) => item.status !== "passed"));
  report.status = report.violations.length ? "failed" : "passed";
  report.outputs = outputRefs();
  writeArtifacts();
  if (report.status !== "passed") {
    console.error(`Dormitory L1 browser E2E audit: FAIL (${report.violations.length} violations)`);
    process.exitCode = 1;
  } else {
    console.log(`Dormitory L1 browser E2E audit: PASS (${runId})`);
    console.log(rel(reportPath));
  }
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.outputs = outputRefs();
  writeArtifacts();
  console.error("Dormitory L1 browser E2E audit: FAIL");
  console.error(report.failureReason);
  process.exitCode = 1;
}

async function runPositiveScenario(browser, allNetworkEvents) {
  const scenario = createScenario("dormitory_l1_positive_normal", "positive", "Dormitory L1 normal room setup", "operator", "zh-CN");
  const { context, page } = await newMobilePage(browser, scenario, allNetworkEvents);
  try {
    await goto(page, scenario, "/?view=login&lang=zh-CN&device=mobile");
    await capture(page, scenario, "01-login", "Login page before operator sign-in");
    await fill(page, scenario, "#loginAccount", "dormOperator", "enter dormitory operator account");
    await fill(page, scenario, "#loginPassword", "dev", "fill password");
    await click(page, scenario, "#loginSubmit", "click login");
    await completeOnboardingIfNeeded(page, scenario);
    await waitForLoggedIn(page);
    await capture(page, scenario, "02-home", "Home after operator login");

    await click(page, scenario, "nav.bottom-nav [data-view=\"search\"]", "open search tab");
    await fill(page, scenario, "#query", "新增住宿房源", "search active dormitory command");
    await click(page, scenario, "#searchNow", "run search");
    await waitForHydrated(page);
    await capture(page, scenario, "03-search-command", "Search result with start command");

    await click(page, scenario, "[data-start-operations-workspace='W-STAY-RESOURCE']", "start accommodation resource setup");
    await waitForOperationPanel(page);
    const ready = await capture(page, scenario, "04-operation-ready", "Operation panel ready before validation");
    assertScenario(scenario, ready.domState.surface === "operation-panel-route", "positive.opened_operation_panel", "Operation panel must open from Operations WorkItem route.");
    assertScenario(scenario, ready.runtimeDecision === "work_item_confirm_ready:production_blocked", "positive.ready_runtime_decision", "L1 operation must expose confirm-ready observation with production blocked.");

    await click(page, scenario, "[data-submit-card]", "submit empty form to validate blockers");
    await waitForHydrated(page);
    const blocked = await capture(page, scenario, "05-empty-submit-blocked", "Required field blocker after empty submit");
    assertScenario(scenario, blocked.runtimeDecision === "blocked:required_field_missing", "positive.required_fields_blocked", "Empty required fields must block before runtime confirm.");
    assertScenario(scenario, blocked.domState.invalidFields.length > 0, "positive.required_fields_marked", "Blocked fields must be marked in DOM.");

    const lifecycleCards = ["roomSetup", "bedSetup", "roomReadiness"];
    let completed = null;
    for (const [index, cardId] of lifecycleCards.entries()) {
      if (index > 0) {
        await waitForOperationPanel(page);
        const current = await capture(page, scenario, `${String(7 + index * 3).padStart(2, "0")}-${cardId}-ready`, `${cardId} ready from ProcessManager WorkItem`);
        assertScenario(scenario, current.domState.fields.some((field) => field.id === cardIdPrimaryField(cardId) && field.required), `positive.${cardId}.business_fields`, `${cardId} must expose required business fields.`);
      }

      await fillRequiredOperationFields(page, scenario);
      await waitForHydrated(page);
      await capture(page, scenario, `${String(6 + index * 3).padStart(2, "0")}-${cardId}-filled-before-submit`, `${cardId} required business fields filled from DOM contract`);
      const nextCardId = lifecycleCards[index + 1] || "";
      await click(page, scenario, "[data-submit-card]", `submit completed ${cardId}`);
      if (nextCardId) {
        await page.waitForFunction((expectedCardId) => {
          const route = document.querySelector("[data-surface=\"operation-panel-route\"]");
          return route?.dataset.runtimeDecision === "work_item_confirm_ready:production_blocked" &&
            new URL(window.location.href).searchParams.get("card") === expectedCardId;
        }, nextCardId, { timeout: 45_000 });
        const advanced = await capture(page, scenario, `${String(7 + index * 3).padStart(2, "0")}-${cardId}-auto-advanced-next`, `${cardId} submit auto-advanced to ${nextCardId}`);
        assertScenario(scenario, new URL(advanced.url).searchParams.get("card") === nextCardId, `positive.${cardId}.auto_advanced_next`, `${cardId} submit must auto-advance to next actionable persisted WorkItem.`);
        assertScenario(scenario, advanced.runtimeDecision === "work_item_confirm_ready:production_blocked", `positive.${cardId}.next_ready_runtime`, `${nextCardId} must be ready for observation after auto-advance with production blocked.`);
      } else {
        await page.waitForFunction(() => {
          const route = document.querySelector("[data-surface=\"operation-panel-route\"], [data-surface=\"completed-workspace-record\"]");
          return route?.dataset.admissionDecision === "visible_readonly_completed" ||
            document.querySelector("[data-surface=\"completed-workspace-record\"]");
        }, null, { timeout: 45_000 });
        completed = await capture(page, scenario, `${String(7 + index * 3).padStart(2, "0")}-${cardId}-completed-readonly`, `${cardId} completed record is read-only`);
        assertScenario(scenario, completed.admissionDecision === "visible_readonly_completed", `positive.${cardId}.completed_readonly_admission`, `${cardId} final WorkItem must be visible but read-only.`);
        assertScenario(scenario, completed.domState.submitCount === 0, `positive.${cardId}.no_submit_after_completion`, `${cardId} completed WorkItem must not expose submit CTA.`);
      }
    }

    return { scenario, completedUrl: page.url() };
  } finally {
    await context.close();
  }
}

async function runIllegalAccessScenario(browser, allNetworkEvents) {
  const scenario = createScenario("dormitory_l1_negative_illegal_access", "negative", "Fake WorkItem URL cannot open a business write", "operator", "zh-CN");
  const { context, page } = await newMobilePage(browser, scenario, allNetworkEvents);
  try {
    await loginAs(page, scenario, "dormOperator");
    await goto(page, scenario, "/?view=operationPanel&lang=zh-CN&device=mobile&workspace=W-STAY-RESOURCE&card=roomSetup&workItem=wi-does-not-exist-browser-audit");
    await waitForHydrated(page);
    const step = await capture(page, scenario, "01-fake-work-item-blocked", "Illegal fake WorkItem route is blocked");
    assertScenario(scenario, step.domState.surface === "operation-panel-runtime", "illegal.blocked_surface", "Fake WorkItem must render runtime blocked state.");
    assertScenario(scenario, step.domState.blockerCode === "operation_work_item_required", "illegal.work_item_required", "Fake WorkItem must require a persisted Operations WorkItem.");
    assertScenario(scenario, step.domState.submitCount === 0, "illegal.no_submit", "Fake WorkItem route must not expose submit CTA.");
    return scenario;
  } finally {
    await context.close();
  }
}

async function runUnauthorizedScenario(browser, allNetworkEvents) {
  const scenario = createScenario("dormitory_l1_negative_unauthorized", "negative", "Finance account cannot start room setup", "finance", "zh-CN");
  const { context, page } = await newMobilePage(browser, scenario, allNetworkEvents);
  try {
    await loginAs(page, scenario, "dormFinance");
    await click(page, scenario, "nav.bottom-nav [data-view=\"search\"]", "open search tab as finance");
    await fill(page, scenario, "#query", "新增住宿房源", "search room setup command as finance");
    await click(page, scenario, "#searchNow", "run finance search");
    await waitForHydrated(page);
    await capture(page, scenario, "01-finance-search-command", "Finance can see visible command but is not allowed to start it");
    const forbiddenResponse = page.waitForResponse((response) =>
      response.url().includes("/api/operations/workspaces/start") && response.request().method() === "POST", { timeout: 30_000 }).catch(() => null);
    await click(page, scenario, "[data-start-operations-workspace='W-STAY-RESOURCE']", "finance clicks start command");
    await forbiddenResponse;
    await page.waitForFunction(() => {
      return document.querySelector("[data-surface=\"permission-diagnostic\"]") ||
        !/正在提交|Отправка|тапшырылууда/i.test(document.body.innerText || "");
    }, null, { timeout: 20_000 }).catch(() => {});
    await waitForHydrated(page);
    const step = await capture(page, scenario, "02-finance-forbidden", "Unauthorized start routes to permission diagnostic");
    assertScenario(scenario, step.domState.surface === "permission-diagnostic", "unauthorized.permission_diagnostic", "Unauthorized start must route to permission diagnostic.");
    assertScenario(scenario, step.domState.submitCount === 0, "unauthorized.no_submit", "Unauthorized actor must not receive a submit CTA.");
    assertScenario(scenario, !/运行服务未连接/.test(step.domState.textSample), "unauthorized.not_api_offline_copy", "403 must not be presented as API offline.");
    return scenario;
  } finally {
    await context.close();
  }
}

async function runWrongStatusScenario(browser, allNetworkEvents, completedUrl) {
  const scenario = createScenario("dormitory_l1_negative_wrong_status", "negative", "Completed WorkItem cannot be submitted again", "operator", "zh-CN");
  const { context, page } = await newMobilePage(browser, scenario, allNetworkEvents);
  try {
    await loginAs(page, scenario, "dormOperator", "stay");
    if (!completedUrl) {
      addViolation(scenario, "wrong_status.no_completed_url", "Positive scenario did not produce a completed URL.");
      return scenario;
    }
    await page.goto(completedUrl);
    scenario.clickSequence.push({ type: "navigate", label: "open completed WorkItem URL", target: completedUrl, afterUrl: page.url() });
    await waitForHydrated(page);
    const step = await capture(page, scenario, "01-completed-reopen-readonly", "Reopening completed WorkItem remains read-only");
    assertScenario(scenario, step.admissionDecision === "visible_readonly_completed", "wrong_status.readonly", "Completed state must stay read-only after reload.");
    assertScenario(scenario, String(step.runtimeDecision).startsWith("work_item_terminal:"), "wrong_status.terminal_runtime", "Runtime decision must be terminal.");
    assertScenario(scenario, step.domState.submitCount === 0, "wrong_status.no_submit", "Wrong status transition must not expose submit CTA.");
    return scenario;
  } finally {
    await context.close();
  }
}

async function loginAs(page, scenario, account) {
  await goto(page, scenario, "/?view=login&lang=zh-CN&device=mobile");
  await fill(page, scenario, "#loginAccount", account, `enter ${account}`);
  await fill(page, scenario, "#loginPassword", "dev", "fill password");
  await click(page, scenario, "#loginSubmit", "click login");
  await completeOnboardingIfNeeded(page, scenario);
  await waitForLoggedIn(page);
  await capture(page, scenario, "00-login-complete", `Logged in as ${account}`);
}

async function newMobilePage(browser, scenario, allNetworkEvents) {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(apiUrl)) return;
    const request = response.request();
    const event = {
      atUtc: new Date().toISOString(),
      scenarioId: scenario.scenarioId,
      method: request.method(),
      url,
      path: safePath(url),
      status: response.status()
    };
    scenario.networkEvents.push(event);
    allNetworkEvents.push(event);
  });
  return { context, page };
}

async function goto(page, scenario, targetPath) {
  const url = targetPath.startsWith("http") ? targetPath : `${baseUrl}${targetPath}`;
  scenario.clickSequence.push({ type: "navigate", label: "navigate", target: url });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForHydrated(page);
  scenario.clickSequence.at(-1).afterUrl = page.url();
}

async function click(page, scenario, selector, label) {
  const target = await firstVisible(page.locator(selector));
  scenario.clickSequence.push({ type: "click", label, selector, beforeUrl: page.url() });
  await target.click();
  await waitForHydrated(page);
  scenario.clickSequence.at(-1).afterUrl = page.url();
}

async function fill(page, scenario, selector, value, label) {
  const target = await firstVisible(page.locator(selector));
  scenario.clickSequence.push({ type: "fill", label, selector, value: redact(value), beforeUrl: page.url() });
  await target.fill(value);
  await page.waitForTimeout(100);
  scenario.clickSequence.at(-1).afterUrl = page.url();
}

async function select(page, scenario, selector, value, label) {
  const target = await firstVisible(page.locator(selector));
  scenario.clickSequence.push({ type: "select", label, selector, value, beforeUrl: page.url() });
  await target.selectOption(value);
  await page.waitForTimeout(100);
  scenario.clickSequence.at(-1).afterUrl = page.url();
}

async function completeOnboardingIfNeeded(page, scenario) {
  await page.waitForFunction(() => {
    return document.querySelector("#start") || document.querySelector("nav.bottom-nav");
  }, null, { timeout: 20_000 }).catch(() => {});
  await waitForHydrated(page);
  const start = page.locator("#start");
  if (await start.isVisible().catch(() => false)) {
    await click(page, scenario, "#start", "complete onboarding guide");
  }
}

async function fillRequiredOperationFields(page, scenario) {
  for (let pass = 0; pass < 5; pass += 1) {
    const fields = await operationFields(page);
    let changed = 0;
    for (const [index, field] of fields.entries()) {
      if (!field.required || !field.id || field.valuePresent) continue;
      if (field.readonly) {
        addViolation(scenario, `field.${field.id}.readonly_empty`, `Required field ${field.id} is readonly and empty.`);
        continue;
      }
      const segmentedButton = page.locator(`[data-operation-field-button="${cssEscape(field.id)}"]`).first();
      if (await segmentedButton.isVisible().catch(() => false)) {
        scenario.clickSequence.push({ type: "click", label: `fill segmented field ${field.id}`, selector: `[data-operation-field-button="${field.id}"]`, beforeUrl: page.url() });
        await segmentedButton.click();
        await waitForHydrated(page);
        scenario.clickSequence.at(-1).afterUrl = page.url();
        changed += 1;
        continue;
      }
      if (!field.visible) continue;
      const selector = `[data-operation-field="${cssEscape(field.id)}"]`;
      if (field.tag === "select") {
        const option = field.options.find((item) => item.value && !/请选择|select/i.test(item.text)) || field.options.find((item) => item.value);
        if (!option) {
          addViolation(scenario, `field.${field.id}.no_select_option`, `Required select ${field.id} has no usable option.`);
          continue;
        }
        await select(page, scenario, selector, option.value, `fill required select ${field.id}`);
        changed += 1;
        continue;
      }
      if (field.type === "checkbox" || field.type === "radio") {
        const target = await firstVisible(page.locator(selector));
        scenario.clickSequence.push({ type: "check", label: `fill required option ${field.id}`, selector, beforeUrl: page.url() });
        await target.check().catch(async () => target.click());
        await waitForHydrated(page);
        scenario.clickSequence.at(-1).afterUrl = page.url();
        changed += 1;
        continue;
      }
      await fill(page, scenario, selector, valueForField(field.id, field.type, index), `fill required field ${field.id}`);
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

async function capture(page, scenario, stepId, title) {
  await waitForHydrated(page);
  const domState = await readDomState(page);
  const safe = safeName(`${scenario.steps.length + 1}-${scenario.scenarioId}-${stepId}`);
  const fullPath = path.join(screenshotDir, `${safe}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const segments = await captureSegments(page, safe);
  const screenshotMeta = {
    scenarioId: scenario.scenarioId,
    stepId,
    role: scenario.role,
    language: scenario.language,
    url: page.url(),
    admissionState: domState.admissionDecision,
    runtimeDecision: domState.runtimeDecision,
    commitSha: git.headSha,
    ciRun: ciRun?.id || "not_available"
  };
  const full = screenshotEntry(fullPath, "fullPage", screenshotMeta);
  const segmentEntries = segments.map((item) => screenshotEntry(item.path, item.kind, { ...screenshotMeta, segmentPosition: item.kind }, item.scrollY));
  report.screenshots.push(full, ...segmentEntries);
  const step = {
    stepId,
    title,
    atUtc: new Date().toISOString(),
    url: page.url(),
    clickSequence: [...scenario.clickSequence],
    domState,
    admissionDecision: domState.admissionDecision,
    runtimeDecision: domState.runtimeDecision,
    screenshot: {
      fullPage: full,
      segments: segmentEntries
    },
    networkEvents: scenario.networkEvents.slice(scenario.networkCursor)
  };
  scenario.networkCursor = scenario.networkEvents.length;
  scenario.steps.push(step);
  return step;
}

async function captureSegments(page, safe) {
  const viewport = page.viewportSize() || { width: 430, height: 932 };
  const height = Math.max(1, viewport.height);
  const scrollHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const entries = [];
  const seen = new Set();
  const positions = scrollHeight > height
    ? [
        { kind: "top", scrollY: 0 },
        { kind: "middle", scrollY: Math.max(0, Math.floor((scrollHeight - height) / 2)) },
        { kind: "bottom", scrollY: Math.max(0, scrollHeight - height) }
      ]
    : [{ kind: "top", scrollY: 0 }];
  for (const position of positions) {
    const scrollY = position.scrollY;
    if (seen.has(scrollY)) continue;
    seen.add(scrollY);
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(120);
    const segmentPath = path.join(screenshotDir, `${safe}-${position.kind}.png`);
    await page.screenshot({ path: segmentPath, fullPage: false });
    entries.push({ path: segmentPath, kind: position.kind, scrollY });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return entries;
}

async function readDomState(page) {
  return page.evaluate(() => {
    const primary = document.querySelector("[data-surface=\"completed-workspace-record\"], [data-surface=\"operation-panel-route\"], [data-surface=\"operation-panel-runtime\"], [data-surface=\"permission-diagnostic\"], [data-surface=\"workos-search\"], [data-surface=\"today-mission-control\"], [data-surface=\"runtime-hydration\"], [data-surface]") || document.body;
    const invalidFields = Array.from(document.querySelectorAll("[data-operation-field][aria-invalid=\"true\"], [data-operation-field][data-validation-state=\"missing\"]"))
      .map((node) => node.dataset.operationField || node.getAttribute("name") || "");
    const fields = Array.from(document.querySelectorAll("[data-operation-field]")).map((node) => ({
      id: node.dataset.operationField || "",
      tag: node.tagName.toLowerCase(),
      type: node.getAttribute("type") || "",
      required: node.hasAttribute("required") || node.dataset.requiredField === "true",
      invalid: node.getAttribute("aria-invalid") === "true" || node.dataset.validationState === "missing",
      readonly: node.hasAttribute("readonly") || node.getAttribute("aria-readonly") === "true",
      visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
      valuePresent: Boolean(String(node.value || "").trim())
    }));
    const surface = primary.dataset?.surface || "";
    const admissionDecision = primary.dataset?.admissionDecision ||
      (surface ? "visible_readonly_surface" : "visible_public_surface");
    const runtimeDecision = primary.dataset?.runtimeDecision ||
      (surface ? "readonly:surface_no_business_confirm" : "readonly:public_surface_no_business_confirm");
    return {
      title: document.querySelector("h1")?.textContent?.trim() || "",
      surface,
      admissionDecision,
      runtimeDecision,
      lifecycleState: primary.dataset?.lifecycleState || "",
      actionState: primary.dataset?.actionState || "",
      blockerCode: primary.dataset?.blockerCode || "",
      submitCount: document.querySelectorAll("[data-submit-card]").length,
      nextStageCount: document.querySelectorAll("[data-work-item-id][data-card-id]").length,
      startResourceCount: document.querySelectorAll("[data-start-operations-workspace='W-STAY-RESOURCE']").length,
      invalidFields,
      fields,
      textSample: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1800),
      url: window.location.href,
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      viewportHeight: window.innerHeight
    };
  });
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
  await page.waitForTimeout(150);
  await page.waitForFunction(() => !document.querySelector("[data-surface=\"runtime-hydration\"]"), null, { timeout: 15_000 }).catch(() => {});
}

async function waitForLoggedIn(page) {
  await page.waitForFunction(() => {
    return document.querySelector("nav.bottom-nav") && !document.querySelector("#loginSubmit");
  }, null, { timeout: 20_000 });
  await waitForHydrated(page);
}

async function waitForOperationPanel(page) {
  await page.waitForFunction(() => {
    return document.querySelector("[data-surface=\"operation-panel-route\"]") ||
      document.querySelector("[data-surface=\"operation-panel-runtime\"]") ||
      document.querySelector("[data-surface=\"permission-diagnostic\"]");
  }, null, { timeout: 30_000 });
  await waitForHydrated(page);
}

function createScenario(scenarioId, caseType, title, role, language) {
  return {
    scenarioId,
    caseType,
    title,
    role,
    language,
    status: "running",
    steps: [],
    clickSequence: [],
    networkEvents: [],
    networkCursor: 0,
    violations: []
  };
}

function assertScenario(scenario, condition, id, message) {
  if (condition) return;
  addViolation(scenario, id, message);
}

function addViolation(scenario, id, message) {
  const violation = {
    id,
    scenarioId: scenario.scenarioId,
    status: "failed",
    blockerLevel: "P0",
    message
  };
  scenario.violations.push(violation);
  report.violations.push(violation);
}

function analyzeNetwork(events) {
  const writes = events.filter((event) => event.method !== "GET");
  const forbiddenWorkspaceCardWrites = writes.filter((event) => /\/api\/workspaces\/[^/]+\/cards\/[^/]+\/(prepare|confirm)$/i.test(event.path));
  const operationsRuntimeWrites = writes.filter((event) => /\/api\/operations\/work-items\/[^/]+\/(prepare|confirm)$/i.test(event.path));
  const directBusinessFactWrites = writes.filter((event) =>
    /\/api\/(audit-events|outbox|projections\/process-outbox)$/i.test(event.path));
  return {
    totalApiEvents: events.length,
    writeCount: writes.length,
    writes,
    operationsRuntimeWrites,
    forbiddenWorkspaceCardWrites,
    directBusinessFactWrites,
    noForbiddenWorkspaceCardWrites: forbiddenWorkspaceCardWrites.length === 0,
    noDirectBusinessFactWrites: directBusinessFactWrites.length === 0
  };
}

function architectureAssertions(currentReport) {
  const scenarioIds = new Set(currentReport.scenarios.map((scenario) => scenario.scenarioId));
  const steps = currentReport.scenarios.flatMap((scenario) => scenario.steps);
  return [
    assertion("coverage.positive", scenarioIds.has("dormitory_l1_positive_normal"), "Positive Dormitory L1 scenario is present."),
    assertion("coverage.illegal_access", scenarioIds.has("dormitory_l1_negative_illegal_access"), "Illegal access scenario is present."),
    assertion("coverage.unauthorized", scenarioIds.has("dormitory_l1_negative_unauthorized"), "Unauthorized role scenario is present."),
    assertion("coverage.wrong_status", scenarioIds.has("dormitory_l1_negative_wrong_status"), "Wrong status scenario is present."),
    assertion("coverage.resource_lifecycle", resourceLifecycleCaptured(steps), "P0 generated dormitory resource lifecycle is captured with post-submit auto-advance and final readonly completion."),
    assertion("admission.visible_not_allowed", steps.some((step) => /visible_blocked|visible_allowed_requires/.test(step.admissionDecision)), "Visible blocked/required admission state is captured."),
    assertion("admission.completed_readonly", steps.some((step) => step.admissionDecision === "visible_readonly_completed"), "Completed WorkItem is visible but read-only."),
    assertion("runtime.blocked_required", steps.some((step) => step.runtimeDecision === "blocked:required_field_missing"), "Required field blocker is enforced before runtime confirm."),
    assertion("runtime.terminal", steps.some((step) => String(step.runtimeDecision).startsWith("work_item_terminal:")), "Terminal runtime state is captured."),
    assertion("runtime.only_write_entry", currentReport.networkPolicy.operationsRuntimeWrites.length > 0, "Operations Runtime prepare/confirm write path is used."),
    assertion("network.no_blocked_card_write", currentReport.networkPolicy.noForbiddenWorkspaceCardWrites, "UI does not call blocked workspace/card prepare or confirm writes."),
    assertion("ui.no_submit_terminal", steps.filter((step) => step.admissionDecision === "visible_readonly_completed").every((step) => step.domState.submitCount === 0), "Terminal surfaces expose no submit CTA."),
    assertion("evidence.screenshots_hashed", currentReport.screenshots.length > 0 && currentReport.screenshots.every((item) => item.sha256), "Screenshots are hashed for Evidence Graph binding."),
    assertion("ci.bound", Boolean(currentReport.ciRun?.id), "CI run id is bound.")
  ];
}

function assertion(id, passed, message) {
  return {
    id,
    status: passed ? "passed" : "failed",
    blockerLevel: passed ? "none" : "P0",
    message
  };
}

function resourceLifecycleCaptured(steps) {
  const cards = ["roomSetup", "bedSetup", "roomReadiness"];
  const filled = cards.every((cardId) => steps.some((step) => step.stepId.includes(`${cardId}-filled-before-submit`)));
  const autoAdvanced = cards.slice(0, -1).every((cardId) => steps.some((step) => step.stepId.includes(`${cardId}-auto-advanced-next`)));
  const finalReadonly = steps.some((step) => step.stepId.includes("roomReadiness-completed-readonly") &&
    step.admissionDecision === "visible_readonly_completed");
  return filled && autoAdvanced && finalReadonly;
}

function writeArtifacts() {
  for (const scenario of report.scenarios) {
    if (scenario.status === "running") scenario.status = scenario.violations.length ? "failed" : "passed";
  }
  const screenshotIndex = {
    version: "dormitory-l1.screenshot-index.v1",
    runId,
    generatedAtUtc: new Date().toISOString(),
    screenshots: report.screenshots
  };
  fs.writeFileSync(screenshotIndexPath, JSON.stringify(screenshotIndex, null, 2));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdownReport(report));
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(latestPath, JSON.stringify({
    runId,
    status: report.status,
    report: rel(reportPath),
    markdown: rel(mdPath),
    screenshotIndex: rel(screenshotIndexPath),
    generatedAtUtc: report.generatedAtUtc
  }, null, 2));
}

function markdownReport(currentReport) {
  const lines = [
    "# Dormitory L1 Browser E2E Audit",
    "",
    `- Run ID: ${currentReport.runId}`,
    `- Status: ${currentReport.status}`,
    `- Browser mode: ${currentReport.browserMode}`,
    `- Commit SHA: ${currentReport.git.headSha}`,
    `- CI run ID: ${currentReport.ciRun?.id || "not_available"}`,
    `- Scope: Dormitory L1 only; Repair / Parts / HR excluded`,
    "",
    "## Scenarios",
    "",
    "| Scenario | Type | Status | Steps | Violations |",
    "| --- | --- | --- | ---: | ---: |",
    ...currentReport.scenarios.map((scenario) =>
      `| ${scenario.scenarioId} | ${scenario.caseType} | ${scenario.status} | ${scenario.steps.length} | ${scenario.violations.length} |`),
    "",
    "## Architecture Assertions",
    "",
    "| Assertion | Status |",
    "| --- | --- |",
    ...currentReport.architectureAssertions.map((item) => `| ${item.id} | ${item.status} |`),
    "",
    "## Evidence",
    "",
    `- Report: ${rel(reportPath)}`,
    `- Screenshot index: ${rel(screenshotIndexPath)}`,
    `- Screenshot count: ${currentReport.screenshots.length}`
  ];
  if (currentReport.violations.length) {
    lines.push("", "## Violations", "");
    for (const violation of currentReport.violations) {
      lines.push(`- ${violation.id}: ${violation.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function screenshotEntry(filePath, kind, metadata, scrollY = null) {
  return {
    kind,
    scenarioId: metadata.scenarioId,
    stepId: metadata.stepId,
    role: metadata.role,
    language: metadata.language,
    url: metadata.url,
    admissionState: metadata.admissionState,
    runtimeDecision: metadata.runtimeDecision,
    commitSha: metadata.commitSha,
    ciRun: metadata.ciRun,
    segmentPosition: metadata.segmentPosition || null,
    path: rel(filePath),
    absolutePath: filePath,
    sha256: sha256(filePath),
    bytes: fs.statSync(filePath).size,
    scrollY
  };
}

function outputRefs() {
  return {
    report: rel(reportPath),
    markdown: rel(mdPath),
    screenshotIndex: rel(screenshotIndexPath)
  };
}

async function latestCiRun(branch) {
  if (process.env.GITHUB_RUN_ID) {
    return {
      id: process.env.GITHUB_RUN_ID,
      source: "env:GITHUB_RUN_ID",
      headSha: process.env.GITHUB_SHA || "",
      url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : ""
    };
  }
  try {
    const url = `https://api.github.com/repos/dingz5612-eng/workos-next/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`;
    const response = await fetch(url, { headers: { "User-Agent": "Codex-WorkOSNext-Dormitory-L1-Audit" } });
    if (!response.ok) throw new Error(`github_actions_${response.status}`);
    const body = await response.json();
    const run = body.workflow_runs?.[0];
    if (!run) return localCiRun("github_actions_api_not_available");
    return {
      id: String(run.id),
      source: "github_actions_api",
      workflowName: run.name,
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha,
      url: run.html_url,
      createdAtUtc: run.created_at,
      updatedAtUtc: run.updated_at
    };
  } catch (error) {
    return localCiRun(error?.message || String(error));
  }
}

function localCiRun(reason) {
  return {
    id: `local-${runId}`,
    source: "local-control-plane",
    status: "local",
    headSha: git.headSha,
    url: "",
    reason
  };
}

async function requireHealthy(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} is not reachable: ${url} (${response.status})`);
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function valueForField(fieldId, type, index) {
  const suffix = runId.replace(/[^0-9]/g, "").slice(-8) || String(Date.now()).slice(-8);
  const known = {
    buildingName: "L1-A",
    buildingId: "L1-A",
    floor: "3",
    roomId: `room-l1-${suffix}`,
    roomNo: `L1-${suffix}`,
    roomNote: "L1 browser audit room setup",
    bedId: `bed-l1-${suffix}`,
    bedNo: `L1-${suffix}-01`,
    bedLabel: "01",
    blockedReason: "maintenance",
    blockReason: "maintenance",
    ratePlanId: `rate-l1-${suffix}`,
    dailyRatePerBed: "350",
    weeklyRatePerBed: "2100",
    monthlyRatePerBed: "9300",
    effectiveFrom: "2026-06-04T10:00",
    availabilityStatus: "available",
    operatorId: "dorm-operator",
    blockId: `block-l1-${suffix}`,
    resourceScope: "room",
    blockStartAt: "2026-06-04T11:00",
    expectedReleaseAt: "2026-06-04T18:00",
    releaseId: `release-l1-${suffix}`,
    releaseAvailableAt: "2026-06-04T18:30",
    bedCount: "4",
    capacity: "4"
  };
  if (known[fieldId]) return known[fieldId];
  if (type === "number") return "1";
  if (type === "datetime-local") return "2026-06-04T10:00";
  return `audit-${fieldId || index}-${suffix}`;
}

function cardIdPrimaryField(cardId) {
  return {
    roomSetup: "roomNo",
    bedSetup: "bedType",
    rateSetup: "dailyRatePerBed",
    roomReadiness: "availabilityStatus",
    roomBlock: "resourceScope",
    roomRelease: "releaseAvailableAt"
  }[cardId] || "";
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function redact(value) {
  return value === "dev" ? "***" : value;
}

function safePath(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
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

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}
