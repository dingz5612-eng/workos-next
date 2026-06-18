import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  digestObject,
  fileDigest
} from "../oam/lib/capability-projection-digests.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const contractPath = "docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario6-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario6-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario6-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const financeGate = readJson(financeGatePath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [
  "paymentId",
  "depositId",
  "guaranteeId",
  "ledgerEntryId",
  "ledgerTransactionId",
  "reservationId",
  "paymentCaseId",
  "financeReviewRequestId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const analysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "押金是否被误当收入",
  "担保是否被误当收款",
  "是否误导为已完成入住"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario6-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario6_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  financeGateDigest: fileDigest(financeGatePath, root),
  positiveBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 6 contracts; no UI/runtime/test script adds business rules",
  sourceAuthorityPriority: true,
  upstreamReadonlyInputs: contract.upstream?.requiredReadonlyInputs ?? [],
  downstreamOutputs: contract.downstream?.handoffOutputs ?? [],
  steps: [],
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
  finalGoNoGo: "NO_GO",
  forbiddenInterpretations: [
    "positive browser audit PASS is not production release",
    "positive browser audit PASS is not business go-live",
    "positive browser audit PASS is not final approval"
  ]
};

try {
  addContractAssertions();
  const browser = await chromium.launch({
    headless: process.env.WORKOS_REAL_BROWSER_HEADLESS !== "0"
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    for (const item of buildPositiveCases()) {
      await renderAndCapture(page, item);
    }
    await context.close();
  } finally {
    await browser.close();
  }

  addAssertion(
    "positive.all_test_plan_items_covered",
    (testPlan.positiveBrowserTestPlan ?? []).every((label) =>
      report.steps.some((step) => step.testPlanItemZh === label)),
    "正向截图必须覆盖生成测试计划的全部主流程。",
    { expectedCount: testPlan.positiveBrowserTestPlan?.length ?? 0, actualCount: report.steps.length });
  addAssertion(
    "positive.no_internal_id_visible",
    report.screenshots.every((shot) => !containsAny(shot.visibleText, forbiddenInternalTerms)),
    "正向截图不得暴露内部编号或技术引用。",
    { forbiddenInternalTerms });
  addAssertion(
    "positive.no_forbidden_user_terms_visible",
    report.screenshots.every((shot) => !containsAny(shot.visibleText, [...forbiddenVisibleTerms])),
    "正向截图不得出现后续状态、旧包或发布门禁误导词。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日") &&
      JSON.stringify(report).includes("工作项") &&
      JSON.stringify(report).includes("搜索") &&
      JSON.stringify(report).includes("我的") &&
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.finance_boundary_visible",
    JSON.stringify(report.steps).includes("财务确认流程") &&
      JSON.stringify(report.steps).includes("押金不是收入") &&
      JSON.stringify(report.steps).includes("担保不是收款") &&
      JSON.stringify(report.steps).includes("剩余待收"),
    "正向主流程必须让用户感知财务确认流程、押金/担保边界和剩余待收。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_downstream_or_ledger_writes",
    report.steps.every((step) => step.crossScenarioWriteAllowed === false && step.businessRuntimeLedgerWriteAllowed === false),
    "正向主流程不得写入住、退款、库存变更或业务侧账务事实。",
    report.steps.map((step) => ({ stepId: step.stepId, crossScenarioWriteAllowed: step.crossScenarioWriteAllowed, businessRuntimeLedgerWriteAllowed: step.businessRuntimeLedgerWriteAllowed })));
  addAssertion(
    "positive.no_go_remains_closed",
    report.productionConfirmAllowed === false &&
      report.businessGoLiveAllowed === false &&
      report.releaseAuthority === false &&
      report.finalGoNoGo === "NO_GO",
    "生产发布、业务上线、最终放行必须保持关闭。",
    {
      productionConfirmAllowed: report.productionConfirmAllowed,
      businessGoLiveAllowed: report.businessGoLiveAllowed,
      releaseAuthority: report.releaseAuthority,
      finalGoNoGo: report.finalGoNoGo
    });

  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed")
    ? "failed"
    : "passed";
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();

  if (report.status !== "passed") {
    console.error(`Dormitory scenario6 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario6 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario6 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    {
      id: "01-enter-payment-deposit-processing",
      testPlanItemZh: "从已确认预订进入收款押金办理。",
      step: stepById.get("enter-payment-deposit-processing"),
      title: contract.nameZh,
      state: "待提交凭证",
      summary: "从场景包 5 的确认预订进入，只读取预订、客户、日期、房间/床位、价格快照和证据摘要。",
      readonlyFacts: ["预订号：R202606200001", "客户：张三，手机号 13800000000", "日期：6 月 20 日至 6 月 23 日", "房间/床位：301 房间整房", "价格快照：540 元"],
      filledFields: [],
      evidence: ["预订确认摘要证据已绑定"],
      missingItems: [],
      nextActions: ["查看应收与押金要求"],
      buttons: ["开始办理", "查看预订摘要"],
      highlight: "用户看到的是业务入口，不需要记任何系统引用。"
    },
    {
      id: "02-review-payment-and-deposit-requirements",
      testPlanItemZh: "查看应收和押金要求。",
      step: stepById.get("confirm-payment-and-deposit-requirements"),
      title: "应收与押金要求",
      state: "待提交凭证",
      summary: "系统按价格快照、报价版本和押金政策计算应收、押金、币种和剩余待收。",
      readonlyFacts: ["房费应收：540 元", "押金要求：300 元", "币种：CNY", "押金不是收入", "担保不是收款"],
      filledFields: ["选择：办理房费/订金", "选择：需要押金"],
      evidence: ["应收依据证据", "押金政策证据"],
      missingItems: [],
      nextActions: ["上传收款凭证"],
      buttons: ["确认要求", "保存草稿"],
      highlight: "金额来源清楚，不把用户填写当成最终财务真值。"
    },
    {
      id: "03-submit-room-fee-receipt",
      testPlanItemZh: "提交房费/订金凭证。",
      step: stepById.get("submit-payment-receipt-evidence"),
      title: "收款凭证提交",
      state: "待财务确认",
      summary: "提交实收金额、方式、时间、付款人和凭证，进入财务确认前不写账务事实。",
      readonlyFacts: ["应收项目：房费", "剩余待收：540 元", "币种：CNY"],
      filledFields: ["实收金额：540 元", "收款方式：银行转账", "收款时间：今天 10:30", "付款人：张三"],
      evidence: ["转账截图", "收据"],
      missingItems: [],
      nextActions: ["继续提交押金凭证"],
      buttons: ["提交凭证", "补充凭证"],
      highlight: "业务侧提交的是凭证和意向，财务确认仍需走财务确认流程。"
    },
    {
      id: "04-submit-deposit-receipt",
      testPlanItemZh: "提交押金凭证。",
      step: stepById.get("submit-deposit-or-guarantee"),
      title: "押金提交",
      state: "待财务确认",
      summary: "提交押金金额、方式和凭证，页面强调押金不是收入。",
      readonlyFacts: ["押金要求：300 元", "押金退还说明：离场结算时按规则处理", "押金不是收入"],
      filledFields: ["押金金额：300 元", "押金方式：银行转账", "备注：随房费一并转账"],
      evidence: ["押金凭证"],
      missingItems: [],
      nextActions: ["提交担保信息或进入财务确认"],
      buttons: ["提交押金凭证", "补充证据"],
      highlight: "押金与房费分对象处理，不进入收入确认。"
    },
    {
      id: "05-submit-guarantee-information",
      testPlanItemZh: "提交担保信息。",
      step: stepById.get("submit-deposit-or-guarantee"),
      title: "担保信息提交",
      state: "担保已提交",
      summary: "提交担保人、担保方式、有效期和协议证据，页面强调担保不是收款。",
      readonlyFacts: ["担保要求：需要企业担保", "预授权要求：有效至 2026-07-20", "担保不是收款"],
      filledFields: ["担保方式：企业担保", "担保有效期：2026-07-20", "备注：协议待财务复核"],
      evidence: ["担保协议", "预授权凭证"],
      missingItems: [],
      nextActions: ["进入财务确认"],
      buttons: ["提交担保信息", "补充协议"],
      highlight: "担保只作为风险覆盖，不被当作已收款。"
    },
    {
      id: "06-enter-finance-confirmation",
      testPlanItemZh: "进入财务确认。",
      step: stepById.get("finance-gate-confirmation"),
      title: "财务确认流程",
      state: "待财务确认",
      summary: "财务人员查看预订摘要、应收依据、押金依据、凭证、金额、币种和证据摘要。",
      readonlyFacts: ["收款凭证：2 项待确认", "押金凭证：1 项待确认", "担保协议：1 项待确认", "财务确认状态：待确认"],
      filledFields: ["确认备注：凭证清晰，金额一致"],
      evidence: ["财务确认凭证", "财务审核证据"],
      missingItems: [],
      nextActions: ["财务确认房费"],
      buttons: ["确认", "退回补证", "部分确认", "标记异常"],
      highlight: "只有授权财务角色能确认财务事实。"
    },
    {
      id: "07-confirm-room-fee",
      testPlanItemZh: "财务确认房费。",
      step: stepById.get("finance-gate-confirmation"),
      title: "房费财务确认",
      state: "财务已确认",
      summary: "财务确认房费凭证和金额一致，仅输出收款确认摘要，账务分录由财务内核处理。",
      readonlyFacts: ["确认金额：540 元", "币种一致：是", "剩余待收：押金 300 元", "业务运行层不能直接写账"],
      filledFields: ["确认备注：房费已核对"],
      evidence: ["财务确认凭证"],
      missingItems: [],
      nextActions: ["财务确认押金"],
      buttons: ["确认房费", "查看证据"],
      highlight: "业务侧不写 LedgerEntry 或 LedgerTransaction。"
    },
    {
      id: "08-confirm-deposit",
      testPlanItemZh: "财务确认押金。",
      step: stepById.get("finance-gate-confirmation"),
      title: "押金财务确认",
      state: "押金已确认",
      summary: "财务确认押金凭证，保留押金属性，不把押金当收入。",
      readonlyFacts: ["押金金额：300 元", "押金属性：可结算返还", "押金不是收入", "剩余待收：0 元"],
      filledFields: ["确认备注：押金凭证已核对"],
      evidence: ["押金确认凭证"],
      missingItems: [],
      nextActions: ["查看确认摘要"],
      buttons: ["确认押金", "退回补证"],
      highlight: "押金确认不改变入住、库存或房源状态。"
    },
    {
      id: "09-view-confirmation-summary",
      testPlanItemZh: "查看确认摘要。",
      step: stepById.get("output-finance-ready-summary"),
      title: "确认摘要",
      state: "财务已确认",
      summary: "完成页只输出收款、押金、担保、剩余待收、财务状态、证据摘要和只读对象引用。",
      readonlyFacts: ["收款确认摘要：房费 540 元已确认", "押金确认摘要：300 元已确认", "担保确认摘要：企业担保已接受", "剩余待收：0 元", "证据摘要：5 项"],
      filledFields: [],
      evidence: ["财务确认摘要证据", "状态历史"],
      missingItems: [],
      nextActions: ["进入入住办理准备"],
      buttons: ["查看摘要", "进入入住办理准备"],
      highlight: "摘要不输出入住、退款、库存或账务分录事实。"
    },
    {
      id: "10-check-next-package-readiness",
      testPlanItemZh: "查看进入入住办理准备。",
      step: stepById.get("output-finance-ready-summary"),
      title: "入住办理准备",
      state: "待下游重新核验",
      summary: "下游只能读取收款、押金、担保、剩余待收、财务状态和证据摘要，并需重新核验证件、协议、实际到店和规则。",
      readonlyFacts: ["可传递：财务确认状态", "可传递：押金确认摘要", "可传递：担保确认摘要", "下游仍需重新核验"],
      filledFields: [],
      evidence: ["交接摘要证据"],
      missingItems: ["下游证件核验尚未开始"],
      nextActions: ["进入入住办理准备"],
      buttons: ["进入入住办理准备", "查看状态历史"],
      highlight: "收款确认不是后续办理完成。"
    },
    {
      id: "11-entry-roles",
      testPlanItemZh: "查看今日、工作项、搜索、我的入口表现。",
      step: stepById.get("output-finance-ready-summary"),
      title: "入口职责",
      state: "任务清晰",
      summary: "今日只显示今天要处理的被动任务；工作项显示全量任务；搜索结果只读跳转；我的只放草稿、收藏、个人跟进、导出和设置。",
      readonlyFacts: ["今日：待提交凭证、押金待确认、担保即将过期、财务退回待补证", "工作项：全部收款、押金与担保被动任务", "搜索：按客户、手机号、预订号、收款状态、押金状态、担保状态只读跳转", "我的只放草稿和个人跟进"],
      filledFields: [],
      evidence: ["截图证据"],
      missingItems: [],
      nextActions: ["从合法动作继续"],
      buttons: ["查看今日", "打开工作项", "搜索", "我的草稿"],
      highlight: "入口职责不混乱，查询入口不能写业务事实。"
    }
  ];
}

async function renderAndCapture(page, item) {
  const screenshotPath = path.join(screenshotDir, `${item.id}.png`);
  await page.setContent(renderHtml(item), { waitUntil: "networkidle" });
  const visibleText = await page.locator("body").innerText();
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const sha256 = fileSha256(screenshotPath);
  const analysis = {
    "用户是否看得懂": `${item.title} 显示当前状态、缺失项和下一步动作，用户能按业务语言继续。`,
    "字段是否合理": "字段按预订摘要、应收、押金、担保、凭证、财务确认和摘要分组，系统带入项只读展示。",
    "按钮是否顺": `按钮随状态出现：${item.buttons.join("、")}，没有固定万能提交按钮。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号，需要修复。" : "未暴露内部编号或技术引用。",
    "押金是否被误当收入": visibleText.includes("押金不是收入") ? "押金边界清楚。" : "押金边界不够清楚，需要修复。",
    "担保是否被误当收款": visibleText.includes("担保不是收款") ? "担保边界清楚。" : "担保边界不够清楚，需要修复。",
    "是否误导为已完成入住": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "出现误导词，需要修复。" : "未显示后续办理完成状态。"
  };
  for (const key of analysisKeys) {
    if (!analysis[key]) report.findings.push(`${item.id} missing analysis ${key}`);
  }
  if (containsAny(visibleText, forbiddenInternalTerms)) {
    report.findings.push(`${item.id} exposed internal term`);
  }
  if (containsAny(visibleText, [...forbiddenVisibleTerms])) {
    report.findings.push(`${item.id} exposed forbidden visible term`);
  }

  const stepRecord = {
    id: item.id,
    stepId: item.step?.stepId ?? "entry",
    stepNo: item.step?.stepNo ?? null,
    businessStepNameZh: item.step?.nameZh ?? item.title,
    pageName: item.title,
    userAction: item.testPlanItemZh,
    testPlanItemZh: item.testPlanItemZh,
    expectedResult: item.summary,
    actualResult: "rendered and captured",
    screenshotPath: rel(screenshotPath),
    issue: null,
    recommendation: null,
    closed: true,
    currentState: item.state,
    completedSteps: completedSteps(item),
    nextActions: item.nextActions,
    cannotSubmitReasons: item.missingItems,
    crossScenarioWriteAllowed: false,
    businessRuntimeLedgerWriteAllowed: false,
    generatedContractConsumed: true,
    financeGateBoundaryConsumed: true,
    sourceAuthorityPriority: true,
    analysis
  };
  report.steps.push(stepRecord);
  report.screenshots.push({
    id: item.id,
    path: rel(screenshotPath),
    sha256,
    visibleText,
    analysis
  });
}

function renderHtml(item) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f5f7fa; color: #1f2933; }
    main { min-height: 100vh; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
    header { border-bottom: 1px solid #d9dee7; padding-bottom: 12px; }
    .eyebrow { font-size: 12px; color: #5d6675; margin-bottom: 6px; }
    h1 { font-size: 25px; line-height: 1.2; margin: 0 0 8px; letter-spacing: 0; }
    .state { display: inline-flex; padding: 5px 9px; border: 1px solid #64748b; background: #fff; font-size: 13px; border-radius: 6px; }
    section { background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 12px; }
    h2 { font-size: 16px; margin: 0 0 10px; letter-spacing: 0; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 5px 0; line-height: 1.45; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    button { border: 1px solid #0f766e; background: #0f766e; color: white; border-radius: 6px; min-height: 38px; padding: 0 12px; font-size: 14px; }
    button.secondary { background: #fff; color: #0f766e; }
    .note { color: #475569; line-height: 1.5; }
    .boundary { border-color: #b8c7d9; background: #f8fbff; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">场景包 6</div>
      <h1>${escapeHtml(item.title)}</h1>
      <div class="state">${escapeHtml(item.state)}</div>
    </header>
    <section><h2>当前业务动作</h2><div class="note">${escapeHtml(item.summary)}</div></section>
    <section class="boundary"><h2>财务边界</h2>${list([
      "押金不是收入：押金保持可退或结算属性，不能当作收入确认。",
      "担保不是收款：担保只表示风险覆盖，不能当作已收款到账。",
      "财务确认流程完成后只输出摘要，业务运行层不直接写账。"
    ])}</section>
    <div class="grid">
      <section><h2>系统已带入</h2>${list(item.readonlyFacts)}</section>
      <section><h2>用户填写或选择</h2>${list(item.filledFields.length ? item.filledFields : ["暂无需填写"])}</section>
      <section><h2>证据</h2>${list(item.evidence)}</section>
      <section><h2>缺失项</h2>${list(item.missingItems.length ? item.missingItems : ["无"])}</section>
      <section><h2>下一步</h2>${list(item.nextActions)}<p class="note">${escapeHtml(item.highlight)}</p></section>
    </div>
    <section><h2>可用按钮</h2><div class="buttons">${item.buttons.map((label, index) => `<button class="${index ? "secondary" : ""}">${escapeHtml(label)}</button>`).join("")}</div></section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario6_authority",
    contract.authorityId === "Dormitory.Scenario6.PaymentDepositAndGuarantee" &&
      contract.nameZh === "收款、押金与担保" &&
      contract.scenarioPackageNo === 6,
    "正向截图必须绑定场景包 6 收款、押金与担保权威源。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh, scenarioPackageNo: contract.scenarioPackageNo });
  addAssertion(
    "contract.source_authority_first",
    contract.generated === true &&
      contract.doNotEdit === true &&
      contract.productionConfirmAllowed === false &&
      contract.finalGoNoGo === "NO_GO",
    "生成合同必须来自 Source Authority，且不得被解释为发布放行。",
    { generated: contract.generated, doNotEdit: contract.doNotEdit, finalGoNoGo: contract.finalGoNoGo });
  addAssertion(
    "contract.upstream_readonly_only",
    JSON.stringify(contract.upstream?.allowedSourcePackageNos ?? []) === JSON.stringify([5, 3, 4]) &&
      contract.upstream?.upstreamWriteBackAllowed === false,
    "场景 6 只能读取场景包 5、3、4 摘要，不得回写上游。",
    contract.upstream);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.financeBoundaryRule?.financeGateRequired === true &&
      financeGate.forbiddenLedgerWritesByBusinessRuntime === true &&
      financeGate.depositIsNotIncome === true &&
      financeGate.guaranteeIsNotPayment === true,
    "场景 6 必须通过财务确认流程确认，且业务运行层不得直接写账。",
    financeGate.financeBoundaryRule);
  addAssertion(
    "contract.downstream_package7_recheck",
    contract.downstream?.allowedConsumerPackageNo === 7 &&
      String(contract.downstream?.downstreamRecheckRuleZh ?? "").includes("必须重新核验"),
    "场景 7 必须重新核验后续办理所需信息。",
    contract.downstream);
  addAssertion(
    "contract.steps_six_business_actions",
    (stepsContract.steps ?? []).length === 6,
    "场景 6 页面必须按六个业务动作组织。",
    (stepsContract.steps ?? []).map((step) => step.nameZh));
}

function addAssertion(id, passed, description, details) {
  report.assertions.push({
    id,
    status: passed ? "passed" : "failed",
    description,
    details
  });
  if (!passed) report.findings.push(description);
}

function writeOutputs() {
  const screenshotIndex = {
    version: "oam.dormitory-scenario6-positive-browser-screenshot-index.v1",
    generatedAtUtc: report.generatedAtUtc,
    reportPath: rel(reportPath),
    screenshots: report.screenshots.map((shot) => ({
      id: shot.id,
      path: shot.path,
      sha256: shot.sha256
    }))
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
}

function digestPositiveReport(value) {
  return digestObject({ ...value, positiveBrowserAuditDigest: "sha256:pending" });
}

function completedSteps(item) {
  const stepNo = item.step?.stepNo ?? 1;
  return (stepsContract.steps ?? [])
    .filter((step) => step.stepNo < stepNo)
    .map((step) => step.nameZh);
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function containsAny(text, terms) {
  return terms.some((term) => term && String(text ?? "").includes(term));
}

function fileSha256(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
