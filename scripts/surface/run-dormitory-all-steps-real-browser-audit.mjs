import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const baseUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const apiUrl = process.env.WORKOS_API_URL || "http://127.0.0.1:5191";
const runId = process.env.WORKOS_DORM_ALL_STEPS_RUN_ID || "dormitory-all-steps-real-browser-20260605";
const artifactRoot = path.join(root, "artifacts", "oam", "evidence", "dormitory-real-browser", runId);
const screenshotRoot = path.join(artifactRoot, "screenshots");
const reportPath = path.join(artifactRoot, "all-steps-real-browser-report.json");

const accounts = {
  operator: { username: "dormOperator", password: "dev", label: "住宿试点经办人" },
  finance: { username: "dormFinance", password: "dev", label: "住宿试点财务" },
  manager: { username: "dormManager", password: "dev", label: "住宿试点主管" }
};

const scenarios = [
  scenario("01", "resource", "W-STAY-RESOURCE", "新增住宿房源", ["roomSetup", "bedSetup", "rateSetup", "roomReadiness", "roomBlock", "roomRelease"]),
  scenario("02", "lead-reservation", "W-STAY-LEAD-RESERVATION", "登记咨询和预订", ["leadCapture", "leadFollowUp", "reservationCreate", "reservationConvert"], {
    branches: [
      scenario("02b", "lead-reservation-cancel", "W-STAY-LEAD-RESERVATION", "登记咨询和预订（取消分支）", ["leadCapture", "leadFollowUp", "reservationCreate", "reservationCancel"], { parentScenarioId: "lead-reservation", branchKind: "cancel" })
    ],
    branchKind: "convert"
  }),
  scenario("03", "checkin", "W-STAY-CHECKIN", "安排入住和收款", ["lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard"]),
  scenario("04", "lifecycle", "W-STAY-LIFECYCLE", "维护在住信息", ["residentProfile", "checkInBedAssign", "chargeAssessment", "stayExtension"]),
  scenario("05", "deposit-ledger", "W-STAY-DEPOSIT-LEDGER", "处理押金", ["depositAssessment", "depositReceipt", "depositConfirmation", "depositDeduction", "depositRefundApproval", "depositRefundPayment", "depositClose"]),
  scenario("06", "payment-ledger", "W-STAY-PAYMENT-LEDGER", "登记普通收款", ["paymentReceipt", "paymentConfirmation", "paymentAllocation", "paymentAdjustment", "debtFollowUp"]),
  scenario("07", "checkout-settlement", "W-STAY-CHECKOUT-SETTLEMENT", "办理退住结算", ["checkoutStart", "roomInspection", "depositSettlement", "finalBalanceClose", "bedRelease", "postCheckoutCleaning"]),
  scenario("08", "service-task", "W-STAY-SERVICE-TASK", "安排清洁或维修", ["serviceTaskCreate", "serviceTaskAssign", "serviceTaskComplete", "serviceTaskVerify", "roomReleaseAfterService"]),
  scenario("09", "expense-ledger", "W-STAY-EXPENSE-LEDGER", "登记宿舍支出", ["expenseRecord", "expenseApproval", "expenseLink"]),
  scenario("10", "period-analytics", "W-STAY-PERIOD-ANALYTICS", "做周期复盘", ["periodScope", "periodMetricsReview", "periodFinanceReview", "periodOperationsDiagnosis", "periodActionPlan", "periodActionPlanComplete", "periodClose"])
];
const scenarioRuns = scenarios.flatMap((item) => [item, ...(item.branches || [])]);

fs.mkdirSync(screenshotRoot, { recursive: true });

const report = {
  version: "dormitory.all-steps.real-browser.v1",
  status: "running",
  runId,
  generatedAtUtc: new Date().toISOString(),
  browserMode: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1" ? "playwright-chromium-headless" : "playwright-chromium-visible",
  mockPolicy: "real browser clicks, real role login, real form input, real screenshots; no route mocks; no backend simulation; no API substitute for user operations",
  endpoints: { baseUrl, apiUrl },
  expectedScenarioCount: scenarios.length,
  expectedScenarioRunCount: scenarioRuns.length,
  expectedStepCount: scenarioRuns.reduce((sum, item) => sum + item.cards.length, 0),
  scenarios: [],
  screenshots: [],
  networkEvents: [],
  assertions: [],
  findings: []
};

let currentRole = "";

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
    page.on("response", (response) => collectNetwork(response));

    await loginAs(page, "operator");
    await openSearch(page);
    report.scenarios.push(...await runAllScenarios(page));
    await context.close();
  } finally {
    await browser.close();
  }

  report.networkPolicy = analyzeNetwork(report.networkEvents);
  addNetworkAssertions(report.networkPolicy);
  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed") ? "failed" : "passed";
  writeArtifacts();
  if (report.status === "passed") {
    console.log(`Dormitory all-steps real browser audit: PASS (${runId})`);
    console.log(rel(reportPath));
  } else {
    console.error(`Dormitory all-steps real browser audit: FAIL (${report.findings.length} findings)`);
    process.exitCode = 1;
  }
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  writeArtifacts();
  console.error("Dormitory all-steps real browser audit: FAIL");
  console.error(report.failureReason);
  process.exitCode = 1;
}

async function runAllScenarios(page) {
  const results = [];
  for (const item of scenarioRuns) {
    results.push(await runScenario(page, item));
  }
  return results;
}

async function runScenario(page, item) {
  const startNetworkIndex = report.networkEvents.length;
  const result = {
    id: item.id,
    title: item.title,
    templateWorkspaceId: item.workspaceId,
    expectedCards: item.cards,
    status: "running",
    steps: [],
    roleSwitches: [],
    findings: []
  };

  await switchRoleForCard(page, roleForCard(item.cards[0]), result);
  await openSearch(page);
  await fill(page, "#query", item.title);
  await click(page, "#searchNow");
  await waitForHydrated(page);
  result.steps.push(await capture(page, `${item.index}-${item.id}-00-search`, `${item.title} 搜索入口`, { scenario: item.id }));
  await click(page, `[data-start-operations-workspace="${item.workspaceId}"]`);
  await waitForOperationPanel(page);

  for (let index = 0; index < item.cards.length; index += 1) {
    const expectedCardId = item.cards[index];
    const current = await readDomState(page);
    const cardId = current.cardId || expectedCardId;
    const role = roleForCard(cardId);
    await switchRoleForCard(page, role, result);
    await waitForOperationPanel(page);

    const readyState = await readDomState(page);
    if (readyState.cardId !== expectedCardId) {
      addFinding(result, "unexpected_current_card", `${item.title} 第 ${index + 1} 步应为 ${expectedCardId}，实际为 ${readyState.cardId || "(empty)"}。`, readyState);
      break;
    }
    result.steps.push(await capture(page, stepId(item, index, cardId, "01-ready"), `${item.title} ${cardId} 待办理`, { scenario: item.id, cardId, role }));

    if (readyState.emptyRequiredFields.length > 0) {
      const beforeNegativeConfirms = countConfirmWrites();
      if (!await hasVisible(page, "[data-submit-card]")) {
        const noSubmitState = await readDomState(page);
        result.steps.push(await capture(page, stepId(item, index, cardId, "02-submit-missing"), `${item.title} ${cardId} 缺少提交入口`, { scenario: item.id, cardId, role }));
        addFinding(result, "submit_action_missing", `${item.title} ${cardId} 没有可见提交入口，无法完成空提交反例和正例办理。`, noSubmitState);
        break;
      }
      await click(page, "[data-submit-card]");
      await waitForHydrated(page);
      const negativeState = await readDomState(page);
      const negative = {
        status: negativeState.runtimeDecision === "blocked:required_field_missing" && (negativeState.invalidFields.length > 0 || /缺少上游信息/.test(negativeState.textSample || "")) ? "passed" : "failed",
        runtimeDecision: negativeState.runtimeDecision,
        invalidFieldCount: negativeState.invalidFields.length,
        confirmDelta: countConfirmWrites() - beforeNegativeConfirms
      };
      result.steps.push(await capture(page, stepId(item, index, cardId, "02-empty-blocked"), `${item.title} ${cardId} 空提交反例`, { scenario: item.id, cardId, role, negative }));
      if (negative.status !== "passed") {
        addFinding(result, "empty_submit_not_blocked", `${item.title} ${cardId} 空提交没有被必填字段阻断。`, negativeState);
      }
      if (negative.confirmDelta !== 0) {
        addFinding(result, "empty_submit_called_confirm", `${item.title} ${cardId} 空提交不应调用 Operations Confirm。`, negative);
      }
    } else {
      result.steps.push(await capture(page, stepId(item, index, cardId, "02-empty-not-applicable"), `${item.title} ${cardId} 无空必填反例`, { scenario: item.id, cardId, role, negative: { status: "skipped", reason: "no visible empty user-required fields on ready page" } }));
    }

    await fillRequiredOperationFields(page, item, cardId);
    await waitForHydrated(page);
    const filledState = await readDomState(page);
    result.steps.push(await capture(page, stepId(item, index, cardId, "03-filled"), `${item.title} ${cardId} 正例填写`, { scenario: item.id, cardId, role }));
    if (filledState.emptyRequiredFields.length > 0) {
      addFinding(result, "required_fields_still_empty", `${item.title} ${cardId} 填写后仍有必填项为空。`, filledState);
    }

    const beforeSubmitUrl = page.url();
    const beforePositiveConfirms = countConfirmWrites();
    if (!await hasVisible(page, "[data-submit-card]")) {
      const noSubmitState = await readDomState(page);
      result.steps.push(await capture(page, stepId(item, index, cardId, "04-submit-missing"), `${item.title} ${cardId} 正例提交入口消失`, { scenario: item.id, cardId, role }));
      addFinding(result, "positive_submit_action_missing", `${item.title} ${cardId} 填写正例后没有可见提交入口。`, noSubmitState);
      break;
    }
    const responseWait = page.waitForResponse((response) =>
      response.url().includes("/api/operations/work-items/") &&
      response.url().endsWith("/confirm") &&
      response.request().method() === "POST", { timeout: 45_000 }).catch(() => null);
    await click(page, "[data-submit-card]");
    const response = await responseWait;
    await waitForPositiveProgress(page, beforeSubmitUrl);
    const afterState = await readDomState(page);
    const positive = {
      status: response && response.status() < 400 && countConfirmWrites() - beforePositiveConfirms === 1 && isProgressed(afterState, beforeSubmitUrl) ? "passed" : "failed",
      responseStatus: response?.status() || 0,
      confirmDelta: countConfirmWrites() - beforePositiveConfirms,
      beforeSubmitUrl,
      afterSubmitUrl: page.url(),
      nextCardId: afterState.cardId,
      runtimeDecision: afterState.runtimeDecision
    };
    result.steps.push(await capture(page, stepId(item, index, cardId, "04-after-submit"), `${item.title} ${cardId} 正例提交后`, { scenario: item.id, cardId, role, positive }));
    if (positive.status !== "passed") {
      addFinding(result, "positive_submit_not_accepted", `${item.title} ${cardId} 正例提交没有形成一次有效 Operations Confirm。`, positive);
      break;
    }
  }

  result.network = analyzeNetwork(report.networkEvents.slice(startNetworkIndex));
  result.completedStepCount = result.steps.filter((step) => step.kind === "after-submit").length;
  result.status = result.findings.length ? "failed" : "passed";
  return result;
}

async function loginAs(page, role) {
  const account = accounts[role] || accounts.operator;
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
  await page.waitForFunction(() => {
    return !document.querySelector("#loginSubmit") &&
      (document.querySelector("[data-surface]") || document.querySelector("main") || document.querySelector("nav"));
  }, null, { timeout: 30_000 });
  await waitForHydrated(page);
  currentRole = role;
  await capture(page, `00-login-${role}`, `${account.label}登录`, { role });
}

async function switchRoleForCard(page, role, result) {
  if (currentRole === role) return;
  const returnUrl = page.url();
  await loginAs(page, role);
  result.roleSwitches.push({ atUtc: new Date().toISOString(), role, returnUrl });
  if (returnUrl && returnUrl.startsWith(baseUrl) && !returnUrl.includes("view=login")) {
    await page.goto(returnUrl, { waitUntil: "domcontentloaded" });
    await waitForHydrated(page);
  }
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

async function fillRequiredOperationFields(page, item, cardId) {
  for (let pass = 0; pass < 6; pass += 1) {
    const fields = await operationFields(page);
    let changed = 0;

    for (const field of fields.ranges) {
      if (!field.required || field.valuePresent) continue;
      await fill(page, `[data-operation-field-start="${cssEscape(field.id)}"]`, "2026-06-05T10:30");
      await fill(page, `[data-operation-field-end="${cssEscape(field.id)}"]`, "2026-06-05T18:30");
      changed += 1;
    }

    for (const [index, field] of fields.fields.entries()) {
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
        const preferred = preferredSelectValueForField(field, item, cardId);
        const value = preferred || field.options.find((option) => option.value && !/请选择|select/i.test(option.text))?.value || field.options.find((option) => option.value)?.value;
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
      await fill(page, selector, valueForField(field, item, cardId, index));
      changed += 1;
    }
    await waitForHydrated(page);
    if (changed === 0) break;
  }
}

async function operationFields(page) {
  return page.evaluate(() => {
    const seen = new Set();
    const fields = Array.from(document.querySelectorAll("[data-operation-field]")).map((node) => {
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
    const ranges = Array.from(document.querySelectorAll("[data-operation-field-start]")).map((node) => {
      const id = node.dataset.operationFieldStart || "";
      const end = document.querySelector(`[data-operation-field-end="${id}"]`);
      return {
        id,
        required: node.hasAttribute("required") || end?.hasAttribute("required") || false,
        valuePresent: Boolean(String(node.value || "").trim()) && Boolean(String(end?.value || "").trim())
      };
    });
    return { fields, ranges };
  });
}

function valueForField(field, item, cardId, index) {
  const id = String(field.id || "").toLowerCase();
  const suffix = shortSuffix(`${item.id}-${cardId}-${field.id}-${index}`);
  if (/reservationnextaction/.test(id)) return item.branchKind === "cancel" ? "cancel" : "convert";
  if (field.type === "datetime-local") return "2026-06-05T10:30";
  if (field.type === "date") return "2026-06-05";
  if (field.type === "number") {
    const depositAmount = coherentDepositAmountForField(id, cardId);
    if (depositAmount) return depositAmount;
    if (/year|年份/.test(id)) return "2026";
    if (/periodno|周期编号/.test(id)) return "16";
    if (/bed|capacity|count|床位|数量|人数/.test(id)) return "4";
    if (/amount|money|rate|price|deposit|payment|fee|cost|balance|budget|押金|金额|费用|日价|周价|月价|单价|目标值/.test(id)) return "300";
    return "1";
  }
  if (/phone|mobile|联系电话|电话/.test(id)) return "13800000000";
  if (/email/.test(id)) return `audit-${suffix}@example.com`;
  if (/building/.test(id)) return "D02";
  if (/roomno|room_no|roomnumber|房号/.test(id)) return `A${suffix.slice(0, 4)}`;
  if (/roomid|room_id|reservedroom|房间|预留房间/.test(id)) return `D02 / A${suffix.slice(0, 4)}`;
  if (/bedid|bedno|bed_no|bedlabel|reservedbed|床位/.test(id)) return `01`;
  if (/roombed|房间床位/.test(id)) return `D02 / A${suffix.slice(0, 4)} / 01`;
  if (/floor|楼层/.test(id)) return "3";
  if (/stay|入住单/.test(id)) return `stay-${suffix}`;
  if (/resident|入住人|住客/.test(id)) return `测试住客${suffix}`;
  if (/lead|姓名|name/.test(id)) return `测试住客${suffix}`;
  if (/operator|owner|manager|负责人|收款人|确认人/.test(id)) return currentRole || "operator";
  if (/period|经营周期/.test(id)) return `period-${suffix}`;
  if (/date|time|日期|时间|截止/.test(id)) return "2026-06-05T10:30";
  if (/evidence|凭证|材料/.test(id)) return `evidence-${suffix}`;
  if (/reason|remark|note|memo|description|说明|备注|原因|意见|措施|问题|结论|摘要|诊断|标题|类型|状态|分类|结果/.test(id)) return `${item.title}${cardId}真实浏览器审计`;
  return `audit-${field.id || index}-${suffix}`;
}

function coherentDepositAmountForField(id, cardId) {
  if (!/^deposit/i.test(cardId)) return "";
  if (/requireddepositamount|receivedamount|confirmedamount/.test(id)) return "1000";
  if (cardId === "depositDeduction" && /deductionamount/.test(id)) return "100";
  if (cardId === "depositRefundApproval" && /deductionamount|applytobalanceamount/.test(id)) return "100";
  if (cardId === "depositRefundPayment" && /refundamount/.test(id)) return "700";
  return "";
}

function preferredSelectValueForField(field, item, cardId) {
  const id = String(field.id || "").toLowerCase();
  if (cardId === "reservationCreate" && id === "reservationnextaction") {
    return item.branchKind === "cancel" ? "cancel" : "convert";
  }
  return "";
}

async function capture(page, stepId, title, meta = {}) {
  await waitForHydrated(page);
  const domState = await readDomState(page);
  const safe = safeName(stepId);
  const fullPath = path.join(screenshotRoot, `${safe}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const segmentEntries = await captureSegments(page, safe);
  const entry = {
    stepId,
    kind: String(stepId).split("-").slice(-2).join("-"),
    title,
    url: page.url(),
    atUtc: new Date().toISOString(),
    meta,
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
    const url = new URL(window.location.href);
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
    const ranges = Array.from(document.querySelectorAll("[data-operation-field-start]")).map((node) => {
      const id = node.dataset.operationFieldStart || "";
      const end = document.querySelector(`[data-operation-field-end="${id}"]`);
      return {
        id,
        required: node.hasAttribute("required") || end?.hasAttribute("required") || false,
        invalid: node.getAttribute("aria-invalid") === "true" || end?.getAttribute("aria-invalid") === "true",
        valuePresent: Boolean(String(node.value || "").trim()) && Boolean(String(end?.value || "").trim())
      };
    });
    return {
      title: document.querySelector("h1")?.textContent?.trim() || "",
      surface: primary.dataset?.surface || "",
      workspaceId: url.searchParams.get("workspace") || "",
      cardId: url.searchParams.get("card") || "",
      workItemId: url.searchParams.get("workItem") || "",
      admissionDecision: primary.dataset?.admissionDecision || "",
      runtimeDecision: primary.dataset?.runtimeDecision || "",
      lifecycleState: primary.dataset?.lifecycleState || "",
      actionState: primary.dataset?.actionState || "",
      blockerCode: primary.dataset?.blockerCode || "",
      submitCount: document.querySelectorAll("[data-submit-card]").length,
      unifiedStartCount: document.querySelectorAll("[data-start-operations-workspace]").length,
      invalidFields: [...fields.filter((field) => field.invalid).map((field) => field.id), ...ranges.filter((field) => field.invalid).map((field) => field.id)],
      emptyRequiredFields: [
        ...fields.filter((field) => field.required && field.visible && !field.readonly && !field.valuePresent).map((field) => field.id),
        ...ranges.filter((field) => field.required && !field.valuePresent).map((field) => field.id)
      ],
      fields,
      ranges,
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

async function hasVisible(page, selector) {
  const locator = page.locator(selector);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function waitForHydrated(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(180);
  await page.waitForFunction(() => !document.querySelector("[data-surface=\"runtime-hydration\"]"), null, { timeout: 15_000 }).catch(() => {});
}

async function waitForOperationPanel(page) {
  await page.waitForFunction(() => {
    return document.querySelector("[data-surface=\"operation-panel-route\"]") ||
      document.querySelector("[data-surface=\"completed-workspace-record\"]") ||
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

function roleForCard(cardId = "") {
  const id = String(cardId || "");
  if (/^(finance|checkoutFinance|feeMaterial|depositConfirmation|depositDeduction|depositRefundPayment|depositClose|paymentConfirmation|paymentAllocation|paymentAdjustment|debtFollowUp|expenseApproval|periodFinanceReview)$/i.test(id)) return "finance";
  if (/^(depositRefundApproval|serviceTaskVerify|periodScope|periodMetricsReview|periodOperationsDiagnosis|periodActionPlan|periodActionPlanComplete|periodClose|operatingDashboard)$/i.test(id)) return "manager";
  return "operator";
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

function analyzeNetwork(events = []) {
  const workspaceStartCount = events.filter((event) =>
    event.method === "POST" && event.path === "/api/operations/workspaces/start").length;
  const operationsConfirmCount = events.filter((event) =>
    event.method === "POST" && /\/api\/operations\/work-items\/[^/]+\/confirm$/i.test(event.path)).length;
  const forbiddenWrites = events.filter((event) =>
    event.method === "POST" && /\/api\/workspaces\/[^/]+\/cards\/[^/]+\/(prepare|confirm)$/i.test(event.path));
  const directFactWrites = events.filter((event) =>
    event.method === "POST" && /\/api\/(events|outbox|projections|facts)\b/i.test(event.path));
  const errors = events.filter((event) => event.status >= 400);
  return {
    workspaceStartCount,
    operationsConfirmCount,
    errorCount: errors.length,
    errors,
    noForbiddenWorkspaceCardWrites: forbiddenWrites.length === 0,
    noDirectBusinessFactWrites: directFactWrites.length === 0
  };
}

function addNetworkAssertions(policy) {
  addAssertion("network.workspace_start_count", policy.workspaceStartCount >= 10, "必须至少启动 10 个 Operations workspace。", policy);
  addAssertion("network.operations_confirm_count", policy.operationsConfirmCount === report.expectedStepCount, `必须形成 ${report.expectedStepCount} 次 Operations Confirm。`, policy);
  addAssertion("network.no_blocked_workspace_card_writes", policy.noForbiddenWorkspaceCardWrites, "不得出现旧 Workspace/Card prepare/confirm 写入口。", policy);
  addAssertion("network.no_direct_business_fact_writes", policy.noDirectBusinessFactWrites, "前端不得直接写业务事实、outbox 或投影。", policy);
}

function addAssertion(id, ok, message, details = {}) {
  const item = { id, status: ok ? "passed" : "failed", message, details };
  report.assertions.push(item);
  if (!ok) report.findings.push({ severity: "P0", id, message, details });
}

function addFinding(scenarioResult, id, message, details = {}) {
  const finding = { severity: "P0", id, message, details };
  scenarioResult.findings.push(finding);
  report.findings.push({ ...finding, scenario: scenarioResult.id });
}

function scenario(index, id, workspaceId, title, cards, options = {}) {
  return { index, id, workspaceId, title, cards, ...options };
}

function stepId(item, index, cardId, kind) {
  return `${item.index}-${item.id}-${String(index + 1).padStart(2, "0")}-${cardId}-${kind}`;
}

function screenshotEntry(filePath, kind, scrollY = 0) {
  return {
    kind,
    scrollY,
    path: rel(filePath),
    sha256: sha256(filePath),
    bytes: fs.statSync(filePath).size
  };
}

function writeArtifacts() {
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function requireHealthy(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} is not healthy: ${response.status} ${url}`);
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

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function shortSuffix(seed = `${Date.now()}-${Math.random()}`) {
  return crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 8);
}

function cssEscape(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
