import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(path.join(repoRoot, "apps/mobile/package.json"));
const { chromium } = require("playwright");
const outRoot = path.join(repoRoot, "artifacts/local-demo/ten-dormitory-browser-demo");
const baseUrl = process.env.WORKOS_DEMO_URL || "http://127.0.0.1:5173/?api=http%3A%2F%2F127.0.0.1%3A5191";
const dryRun = process.argv.includes("--dry-run");
const runId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

const flows = [
  { template: "W-STAY-RESOURCE", query: "创建房间", firstCard: "roomSetup", prefix: "resource" },
  { template: "W-STAY-LEAD-RESERVATION", query: "线索", firstCard: "leadCapture", prefix: "lead" },
  { template: "W-STAY-CHECKIN", query: "入住收款", firstCard: "lead", prefix: "checkin" },
  { template: "W-STAY-LIFECYCLE", query: "在住", firstCard: "residentProfile", prefix: "lifecycle" },
  { template: "W-STAY-DEPOSIT-LEDGER", query: "押金账本", firstCard: "depositAssessment", prefix: "deposit" },
  { template: "W-STAY-PAYMENT-LEDGER", query: "普通收款", firstCard: "paymentReceipt", prefix: "payment" },
  { template: "W-STAY-SERVICE-TASK", query: "清洁维修任务", firstCard: "serviceTaskCreate", prefix: "service" },
  { template: "W-STAY-CHECKOUT", query: "退房", firstCard: "checkoutStart", prefix: "checkout" },
  { template: "W-STAY-CHECKOUT-SETTLEMENT", query: "退住结算", firstCard: "checkoutStart", prefix: "settlement" },
  { template: "W-STAY-PERIOD-ANALYTICS", query: "周期经营复盘", firstCard: "periodScope", prefix: "period" }
];

const financeCards = new Set([
  "finance",
  "checkoutFinance",
  "review",
  "feeMaterial",
  "depositConfirmation",
  "paymentConfirmation",
  "periodMetricsReview",
  "periodFinanceReview"
]);

const result = {
  runId,
  baseUrl,
  dryRun,
  startedAt: new Date().toISOString(),
  flows: [],
  failures: []
};

await fs.mkdir(outRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });

try {
  await loginAs("operator");
  const selectedFlows = selectFlows();
  for (const flow of selectedFlows) {
    await runFlow(flow.definition, flow.index);
  }
} catch (error) {
  result.failures.push({ error: String(error?.stack || error) });
  await saveState("fatal", "failure");
  throw error;
} finally {
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(outRoot, "run-result.json"), JSON.stringify(result, null, 2), "utf8");
  await browser.close();
}

function selectFlows() {
  if (dryRun) return [{ definition: flows[0], index: 0 }];
  const only = process.env.WORKOS_DEMO_ONLY_FLOW;
  if (!only) return flows.map((definition, index) => ({ definition, index }));
  const selected = flows
    .map((definition, index) => ({ definition, index }))
    .filter((flow) => flow.definition.prefix === only || flow.definition.template === only || String(flow.index + 1) === only);
  if (!selected.length) throw new Error(`Unknown WORKOS_DEMO_ONLY_FLOW=${only}`);
  return selected;
}

async function runFlow(flow, flowIndex) {
  const flowDir = path.join(outRoot, `${String(flowIndex + 1).padStart(2, "0")}-${flow.prefix}`);
  await fs.mkdir(flowDir, { recursive: true });
  const flowResult = { ...flow, flowDir, workspaceId: "", steps: [], status: "started" };
  result.flows.push(flowResult);

  await searchAndStart(flow, flowDir);
  flowResult.workspaceId = workspaceIdFromUrl();
  await saveState(path.join(flowDir, "00-started"), "started");

  let previousCard = "";
  const maxSteps = dryRun ? 1 : 14;
  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const cardId = await activeCardId();
    if (!cardId) {
      const completed = await isCompletedWorkspace();
      if (completed) {
        flowResult.status = "completed";
        await saveState(path.join(flowDir, `${String(stepIndex + 1).padStart(2, "0")}-completed`), "completed");
        return;
      }
      throw new Error(`${flow.template}: active card not found`);
    }

    const stepDirName = `${String(stepIndex + 1).padStart(2, "0")}-${cardId}`;
    const stepBase = path.join(flowDir, stepDirName);
    const role = financeCards.has(cardId) ? "finance" : "operator";
    await ensureRole(role);
    await openWorkspaceCard(flowResult.workspaceId, cardId);
    await saveState(`${stepBase}-open`, "open");
    const filled = await fillVisibleOperationFields(flow, flowIndex, stepIndex, cardId);
    await saveState(`${stepBase}-input`, "input");
    const submitted = await submitActiveCard();
    await saveState(`${stepBase}-submitted`, "submitted");
    flowResult.steps.push({ cardId, role, filled, submitted });

    if (dryRun) return;
    await page.waitForTimeout(900);
    const completed = await isCompletedWorkspace();
    if (completed) {
      flowResult.status = "completed";
      await saveState(`${stepBase}-completed`, "completed");
      return;
    }
    const nextCard = await activeCardId();
    if (!nextCard || nextCard === previousCard && nextCard === cardId) {
      const body = await page.locator("body").innerText().catch(() => "");
      throw new Error(`${flow.template}/${cardId}: did not advance. ${body.slice(0, 800)}`);
    }
    previousCard = cardId;
  }

  throw new Error(`${flow.template}: exceeded max steps without completion`);
}

async function searchAndStart(flow, flowDir) {
  await loginAs("operator");
  await page.goto(`${baseUrl}&view=search&q=${encodeURIComponent(flow.query)}&lang=zh-CN`, { waitUntil: "networkidle" });
  await waitForOnlineSurface();
  await page.waitForTimeout(600);
  await saveState(path.join(flowDir, "00-search"), "search");
  let command = page.locator(`[data-start-workspace="${flow.template}"]`);
  if (await command.count() === 0 && flow.template === "W-STAY-RESOURCE") {
    command = page.locator("[data-start-resource-setup]");
  }
  if (await command.count() === 0) throw new Error(`${flow.template}: active command start button not found for query "${flow.query}"`);
  await command.waitFor({ state: "visible", timeout: 10000 });
  await command.click();
  await page.waitForURL(/view=workspace/, { timeout: 20000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await waitForOnlineSurface();
  await waitForBodyText();
  const workspaceId = workspaceIdFromUrl();
  if (!workspaceId || !workspaceId.startsWith(`${flow.template}-`)) {
    throw new Error(`${flow.template}: expected a new workspace url, got ${page.url()}`);
  }
}

async function loginAs(role) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${baseUrl}&view=login&lang=zh-CN&loginAttempt=${attempt}`, { waitUntil: "networkidle" });
    await waitForOnlineSurface();
    await page.waitForTimeout(400);
    await page.locator("#loginRole").selectOption(role);
    await page.locator("#loginPassword").fill("dev");
    await page.locator("#loginSubmit").click();
    await page.waitForTimeout(1600 + attempt * 700);
    const skip = page.locator("#skip");
    if (await skip.count()) {
      await skip.click();
      await page.waitForTimeout(600);
    }
    const matched = await actorRoleMatches(role);
    if (matched) return;
  }
  await page.evaluate(async ({ expectedRole, apiRoot }) => {
    const response = await fetch(`${apiRoot}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: expectedRole, password: "dev" })
    });
    if (!response.ok) throw new Error(`login_api_failed:${response.status}`);
    const session = await response.json();
    localStorage.setItem("workosnext.actorSession", JSON.stringify(session));
  }, { expectedRole: role, apiRoot: "http://127.0.0.1:5191" });
  if (await actorRoleMatches(role)) return;
  const actor = await page.evaluate(() => localStorage.getItem("workosnext.actorSession")).catch(() => "");
  throw new Error(`login_failed_for_role:${role}:${actor}`);
}

async function ensureRole(role) {
  await loginAs(role);
  await page.waitForFunction((expected) => {
    try {
      const actor = JSON.parse(localStorage.getItem("workosnext.actorSession") || "{}");
      return [actor.role, actor.Role, actor.roleId, actor.RoleId, actor.actorRole].filter(Boolean).includes(expected);
    } catch {
      return false;
    }
  }, role, { timeout: 10000 });
}

async function actorRoleMatches(role) {
  return await page.evaluate((expected) => {
    try {
      const actor = JSON.parse(localStorage.getItem("workosnext.actorSession") || "{}");
      return [actor.role, actor.Role, actor.roleId, actor.RoleId, actor.actorRole].filter(Boolean).includes(expected);
    } catch {
      return false;
    }
  }, role).catch(() => false);
}

async function openWorkspaceCard(workspaceId, cardId) {
  await page.goto(`${baseUrl}&view=workspace&workspace=${encodeURIComponent(workspaceId)}&card=${encodeURIComponent(cardId)}&lang=zh-CN`, { waitUntil: "networkidle" });
  await waitForOnlineSurface();
  await waitForBodyText();
}

async function activeCardId() {
  return await page.evaluate(() => {
    const titleToId = {
      "房间配置卡": "roomSetup",
      "床位配置卡": "bedSetup",
      "价格配置卡": "rateSetup",
      "房间准备度卡": "roomReadiness",
      "房间床位阻断卡": "roomBlock",
      "房间床位释放卡": "roomRelease",
      "线索捕获卡": "leadCapture",
      "线索跟进卡": "leadFollowUp",
      "预订创建卡": "reservationCreate",
      "预订取消卡": "reservationCancel",
      "预订转入住卡": "reservationConvert",
      "线索登记卡": "lead",
      "预订确认卡": "booking",
      "入住人建档卡": "resident",
      "分配床位卡": "bedAssign",
      "计费确认卡": "tariff",
      "押金要求卡": "depositRequirement",
      "收款登记卡": "payment",
      "财务到账确认卡": "finance",
      "入住确认卡": "checkin",
      "经营驾驶舱卡": "operatingDashboard",
      "住客资料卡": "residentProfile",
      "入住分床卡": "checkInBedAssign",
      "应收评估卡": "chargeAssessment",
      "续住调整卡": "stayExtension",
      "押金评估卡": "depositAssessment",
      "押金收取卡": "depositReceipt",
      "押金财务确认卡": "depositConfirmation",
      "押金扣除卡": "depositDeduction",
      "押金退款审批卡": "depositRefundApproval",
      "押金退款支付卡": "depositRefundPayment",
      "押金关闭卡": "depositClose",
      "普通收款登记卡": "paymentReceipt",
      "普通收款确认卡": "paymentConfirmation",
      "收款分配卡": "paymentAllocation",
      "收款调整卡": "paymentAdjustment",
      "欠款跟进卡": "debtFollowUp",
      "服务任务创建卡": "serviceTaskCreate",
      "服务任务分派卡": "serviceTaskAssign",
      "服务任务完成卡": "serviceTaskComplete",
      "服务任务验收卡": "serviceTaskVerify",
      "服务后释放卡": "roomReleaseAfterService",
      "退房发起卡": "checkoutStart",
      "房间检查卡": "roomInspection",
      "费用结算卡": "feeSettlement",
      "财务确认卡": "checkoutFinance",
      "退房关闭卡": "checkoutClose",
      "退住开始卡": "checkoutStart",
      "查房卡": "roomInspection",
      "押金结算卡": "depositSettlement",
      "最终余额关闭卡": "finalBalanceClose",
      "床位释放卡": "bedRelease",
      "退住后清洁卡": "postCheckoutCleaning",
      "周期范围卡": "periodScope",
      "周期指标复核卡": "periodMetricsReview",
      "周期财务复核卡": "periodFinanceReview",
      "周期运营诊断卡": "periodOperationsDiagnosis",
      "周期行动计划卡": "periodActionPlan",
      "周期行动完成卡": "periodActionPlanComplete",
      "周期关闭卡": "periodClose"
    };
    const submit = document.querySelector("[data-submit-card]");
    const fields = Array.from(document.querySelectorAll("[data-operation-field], [data-operation-field-start]"));
    const activeTitle = document.querySelector(".card-operation h3")?.textContent?.trim() || "";
    const mapped = titleToId[activeTitle] || "";
    return submit && fields.length ? mapped : "";
  });
}

async function isCompletedWorkspace() {
  return await page.evaluate(() => Boolean(document.querySelector('[data-surface="completed-workspace-record"]')));
}

async function fillVisibleOperationFields(flow, flowIndex, stepIndex, cardId) {
  const context = { runId, flowIndex, stepIndex, cardId, prefix: flow.prefix };
  return await page.evaluate((ctx) => {
    const filled = [];
    const setNativeValue = (element, value) => {
      const descriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value");
      descriptor?.set ? descriptor.set.call(element, value) : element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const textFor = (fieldId, type) => demoValue(fieldId, type, ctx);
    for (const element of document.querySelectorAll("[data-operation-field]")) {
      if (element.disabled || element.readOnly) continue;
      const fieldId = element.getAttribute("data-operation-field") || "";
      if (element.tagName === "SELECT") {
        const option = preferredOption(element, fieldId);
        if (option) {
          element.value = option;
          element.dispatchEvent(new Event("change", { bubbles: true }));
          filled.push({ fieldId, value: option });
        }
        continue;
      }
      const type = element.getAttribute("type") || "text";
      const value = textFor(fieldId, type);
      setNativeValue(element, value);
      filled.push({ fieldId, value });
    }
    for (const start of document.querySelectorAll("[data-operation-field-start]")) {
      if (start.disabled || start.readOnly) continue;
      const fieldId = start.getAttribute("data-operation-field-start") || "";
      const end = document.querySelector(`[data-operation-field-end="${fieldId}"]`);
      setNativeValue(start, dateTimeValue(ctx, 9));
      if (end && !end.disabled && !end.readOnly) setNativeValue(end, dateTimeValue(ctx, 18));
      filled.push({ fieldId, value: `${start.value} 至 ${end?.value || ""}` });
    }
    return filled;

    function preferredOption(select, fieldId) {
      const options = Array.from(select.options).map((option) => option.value).filter(Boolean);
      const preferred = {
        roomType: ["four_bed", "double", "single"],
        genderPolicy: ["unrestricted", "mixed"],
        furnitureStatus: ["complete", "ready"],
        technicalState: ["ready", "available"],
        currency: ["KGS", "CNY"],
        paymentMethod: ["bank_transfer", "cash", "wallet"],
        refundMethod: ["bank_transfer", "cash", "wallet"],
        paymentPurpose: ["rent", "ordinary_rent", "room_fee"],
        confirmationResult: ["confirmed", "matched", "approved"],
        closeResult: ["closed", "normal_close"],
        actionStatus: ["pending", "committed"],
        priority: ["medium", "normal"],
        taskType: ["cleaning", "maintenance"],
        urgency: ["normal", "medium"],
        roomStatus: ["normal", "clean"],
        bedStatus: ["available", "released"],
        damageFound: ["false", "no"],
        cleaningRequired: ["true", "yes"],
        releaseBed: ["true", "yes"],
        salesBlocked: ["false", "no"],
        depositWaiverAllowed: ["false", "no"],
        reservationDepositRequired: ["false", "no"]
      }[fieldId] || [];
      return preferred.find((value) => options.includes(value)) || options[0] || "";
    }

    function demoValue(fieldId, type, current) {
      const key = `${current.prefix}-${current.runId}-${current.stepIndex + 1}`;
      if (type === "number") return numberValue(fieldId, current);
      if (type === "datetime-local") {
        if (/start|from/i.test(fieldId)) return dateTimeValue(current, 9);
        if (/end|until|checkout/i.test(fieldId)) return dateTimeValue(current, 18);
        return dateTimeValue(current, 10 + current.stepIndex);
      }
      if (fieldId.toLowerCase().includes("date") || fieldId.toLowerCase().includes("time") || fieldId.toLowerCase().includes("at") || fieldId.toLowerCase().includes("deadline")) {
        return dateTimeValue(current, 10 + current.stepIndex);
      }
      const values = {
        buildingId: "A",
        roomId: `A${300 + current.flowIndex}${current.stepIndex}`,
        bedId: `A${300 + current.flowIndex}${current.stepIndex}-B1`,
        roomBed: `A${300 + current.flowIndex}${current.stepIndex}-B1`,
        ratePlanId: `rate-${key}`,
        blockId: `block-${key}`,
        releaseId: `release-${key}`,
        leadId: `lead-${key}`,
        operatorId: "operator",
        managerId: "manager",
        financeReviewId: `fin-${key}`,
        bookingId: `booking-${key}`,
        residentId: `resident-${key}`,
        stayId: `stay-${key}`,
        stayOrderId: `stay-${key}`,
        folioId: `folio-${key}`,
        depositId: `deposit-${current.prefix}-${current.runId}`,
        depositReceiptId: `deposit-receipt-${current.prefix}-${current.runId}`,
        depositTransactionId: `deposit-txn-${key}`,
        depositRefundApprovalId: `deposit-approval-${key}`,
        depositRefundPaymentId: `deposit-refund-${key}`,
        paymentId: `payment-${current.prefix}-${current.runId}`,
        paymentReceiptId: `payment-receipt-${current.prefix}-${current.runId}`,
        allocationId: `allocation-${key}`,
        paymentAdjustmentId: `payment-adjust-${key}`,
        reservationId: `reservation-${key}`,
        checkoutId: `checkout-${key}`,
        inspectionId: `inspection-${key}`,
        settlementId: `settlement-${key}`,
        serviceTaskId: `service-${key}`,
        taskId: `task-${key}`,
        actionPlanId: `action-${key}`,
        periodId: `period-${current.prefix}-${current.runId}`,
        actionPlanWorkItemId: `action-${key}`,
        year: "2026",
        periodNo: `${current.flowIndex + 1}`,
        payerName: "Demo payer",
        payeeName: "Stay operations",
        collectorName: "Stay operations",
        ownerName: "operator",
        ownerRole: "operator",
        reviewerId: "finance",
        phone: "13800138000",
        contactChannel: "phone",
        sourceChannel: "walk_in",
        residentName: "Demo resident",
        leadName: "Demo lead",
        customerName: "Demo customer",
        note: `Browser demo ${key}`,
        roomNote: `Room setup demo ${key}`,
        readinessNote: `Readiness checked ${key}`,
        blockNote: `Block demo ${key}`,
        releaseNote: `Release demo ${key}`,
        leadNote: `Lead note ${key}`,
        reservationNote: `Reservation note ${key}`,
        conversionNote: `Conversion note ${key}`,
        residentNote: `Resident note ${key}`,
        bedLockNote: `Bed lock note ${key}`,
        chargeNote: `Charge note ${key}`,
        depositRuleDescription: "Deposit follows stay policy",
        depositReceiptNote: "Deposit receipt checked",
        financeNote: "Finance review passed",
        deductionReason: "Room key wear",
        handlingOpinion: "Approved",
        refundReceiver: "Demo resident",
        manualConfirmationSummary: "Object, amount, evidence, and impact scope checked",
        paymentEvidence: `PAY-EVD-${key}`,
        depositEvidence: `DEP-EVD-${key}`,
        receiptNo: `RCPT-${key}`,
        voucherNo: `VCH-${key}`,
        evidenceNo: `EVD-${key}`,
        issueDescription: "Cleaning and maintenance check",
        handlingMeasure: "Cleaned and saleable status reviewed",
        completionResult: "Completed and accepted",
        acceptanceResult: "Passed",
        reviewResult: "Passed",
        closeSummary: "Flow closed",
        managementConclusion: "Scope, metrics, finance, diagnosis, and action plan confirmed",
        nextPeriodFocus: "Keep evidence freshness, room readiness, and ordinary payment allocation in focus",
        periodDescription: "10-day operating review",
        metricSnapshotNote: "Metric snapshot reviewed",
        financeReviewResult: "Passed",
        financeReviewNote: "Finance review has no blocking exception",
        mainIssueCategory: "occupancy",
        mainIssue: "Some rooms turn over slowly",
        rootCauseAnalysis: "Cleaning release and rate setup need earlier coordination",
        diagnosisConfidence: "0.8",
        actionTitle: "Improve room release efficiency",
        actionType: "occupancy",
        targetMetric: "occupancy_rate",
        actionPlan: `action-${key}`,
        completeNote: "Action completed and recorded",
        checkoutReason: "Normal checkout",
        damageDescription: "No major damage",
        inspectionEvidence: `inspection-${key}`,
        refundOrSupplementConfirm: "Confirmed",
        financialVoucher: `FIN-${key}`,
        confirmerName: "finance",
        closeStayOrder: "Closed",
        area: "Area A",
        responsiblePerson: "operator",
        assignedOwner: "operator"
      };
      return values[fieldId] || `${fieldId}-${key}`;
    }

    function numberValue(fieldId, current) {
      const numbers = {
        bedCount: "4",
        periodYear: "2026",
        requiredBedCount: "1",
        reservedBedCount: "1",
        budgetAmount: "1200",
        unitRate: "90",
        tariffQuantity: "10",
        amount: "900",
        requiredDepositAmount: "500",
        receivedAmount: "500",
        confirmedAmount: current.cardId === "paymentConfirmation" ? "930" : "500",
        deductionAmount: current.cardId.includes("depositDeduction") ? "50" : "0",
        applyToBalanceAmount: "0",
        refundAmount: "450",
        paymentAmount: "930",
        allocatedAmount: "930",
        adjustmentAmount: "0",
        dailyRate: "90",
        weeklyRate: "560",
        monthlyRate: "2200",
        actualCost: "80",
        targetValue: "0.86",
        damageDeductionAmount: "0",
        depositDeductionAmount: "0",
        depositApplyToBalanceAmount: "0",
        accommodationFee: "900",
        extraFee: "0",
        refundOrSupplementAmount: "0",
        discountAmount: "0",
        receivedDepositAmount: "500",
        expectedCost: "80"
      };
      return numbers[fieldId] || "1";
    }

    function dateTimeValue(current, hour) {
      const day = String(3 + current.flowIndex).padStart(2, "0");
      return `2026-06-${day}T${String(hour).padStart(2, "0")}:00`;
    }
  }, context);
}

async function submitActiveCard() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const button = page.locator("[data-submit-card]");
    await waitForOnlineSurface();
    await button.waitFor({ state: "attached", timeout: 15000 });
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.waitFor({ state: "visible", timeout: 10000 });
    await button.click();
    await page.waitForFunction(() => {
      const text = document.body?.innerText || "";
      return !/正在提交|Submitting|submitting/i.test(text);
    }, null, { timeout: 70000 }).catch(() => {});
    await waitForOnlineSurface({ soft: true });
    await page.waitForTimeout(1200);
    const body = await page.locator("body").innerText().catch(() => "");
    if (!/提交失败：请求未完成|request did not complete|请求未完成/.test(body)) break;
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    await waitForOnlineSurface({ soft: true });
  }
  const body = await page.locator("body").innerText().catch(() => "");
  return body.match(/提交结果|已完成|确认成功|Ready to prepare|完成/g)?.slice(-3) || [];
}

function workspaceIdFromUrl() {
  return new URL(page.url()).searchParams.get("workspace") || "";
}

async function saveState(basePath, label) {
  await waitForBodyText().catch(() => {});
  const target = String(basePath).endsWith(label) ? basePath : `${basePath}-${label}`;
  await page.screenshot({ path: `${target}.png`, fullPage: false });
  const text = await page.locator("body").innerText().catch(() => "");
  await fs.writeFile(`${target}.txt`, text, "utf8");
}

async function waitForBodyText() {
  await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 0, null, { timeout: 20000 });
}

async function waitForOnlineSurface(options = {}) {
  const attempts = options.soft ? 2 : 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await waitForBodyText().catch(() => {});
    const offline = await page.evaluate(() => {
      const status = document.querySelector(".api-status");
      const text = document.body?.innerText || "";
      if (text.includes("已连接内测运行服务")) return false;
      if (/后端 API 已连接|Backend API connected|API туташты|API подключен/.test(text)) return false;
      if (status?.classList.contains("online")) return false;
      if (status?.classList.contains("offline")) return true;
      return /后端 API 未连接|API not connected|API не подключен|API туташкан жок/.test(text);
    });
    if (!offline) return;
    const retry = page.locator("button", { hasText: /重试连接|Retry|Повторить|Кайра/ }).first();
    if (await retry.count()) {
      await retry.click().catch(() => {});
    }
    await page.waitForTimeout(800 + attempt * 700);
  }
  if (options.soft) {
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    await waitForBodyText().catch(() => {});
    const stillOffline = await page.evaluate(() => /后端 API 未连接/.test(document.body?.innerText || "") && !/已连接内测运行服务/.test(document.body?.innerText || ""));
    if (!stillOffline) return;
  }
  const body = await page.locator("body").innerText().catch(() => "");
  throw new Error(`frontend_api_offline: ${body.slice(0, 500)}`);
}
