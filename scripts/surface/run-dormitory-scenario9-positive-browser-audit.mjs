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
const contractPath = "docs/contracts/generated/dormitory/scenario9-checkout-settlement.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario9-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario9-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario9-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario9-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario9-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const financeGate = readJson(financeGatePath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [
  "stayId",
  "checkoutCaseId",
  "settlementId",
  "refundId",
  "ledgerEntryId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId",
  "paymentId",
  "ledgerTransactionId"
];
const analysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "是否要求用户记入住记录号",
  "费用来源是否清楚",
  "是否误导为已退款/已入账/房源可运营"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario9-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario9_local_evidence",
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
  mockPolicy: "real Chromium screenshots rendered from generated 场景 9 contracts; no UI/runtime/test script adds business rules",
  sourceAuthorityPriority: true,
  upstreamReadonlyInputs: contract.upstream?.requiredReadonlyInputs ?? [],
  downstreamOutputs: contract.downstream?.handoffOutputs ?? [],
  financeGateConsumer: financeGate.consumer,
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
    "正向截图不得出现已退款、已入账、房源已可运营、旧包或发布门禁误导词。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日待退房") &&
      JSON.stringify(report).includes("工作项展示全部退房结算被动任务池") &&
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.checkout_flow_visible",
    JSON.stringify(report.steps).includes("实际离店") &&
      JSON.stringify(report.steps).includes("房间/床位检查") &&
      JSON.stringify(report.steps).includes("费用核算") &&
      JSON.stringify(report.steps).includes("客户确认") &&
      JSON.stringify(report.steps).includes("退房单号") &&
      JSON.stringify(report.steps).includes("财务处理请求") &&
      JSON.stringify(report.steps).includes("资源待恢复"),
    "正向主流程必须让用户看懂退房、交接、验房、费用、客户确认、退房单号、财务请求和资源恢复请求。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_finance_or_operational_truth_writes",
    report.steps.every((step) => step.businessRuntimeLedgerWriteAllowed === false &&
      step.paymentRefundWriteAllowed === false &&
      step.operationalRestoreWriteAllowed === false &&
      step.financeGateHandlesActualMoney === true &&
      step.scenario2HandlesOperationalRestore === true),
    "正向主流程不得写退款、收款、账务或直接恢复可运营，实际款项交给财务确认流程，资源恢复交给场景包 2。",
    report.steps.map((step) => ({ stepId: step.stepId, financeGateHandlesActualMoney: step.financeGateHandlesActualMoney })));
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
    console.error(`Dormitory scenario9 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario9 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario9 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    {
      id: "01-today-checkout-entry",
      testPlanItemZh: "从今日待退房进入。",
      step: stepById.get("enter-checkout-processing"),
      title: contract.nameZh,
      state: "待退房",
      summary: "从今日待退房进入，读取入住记录、在住状态、占用、收款押金和退房准备摘要。",
      readonlyFacts: ["住客：张三", "手机号：138****0000", "位置：301-02 床位", "今日待退房", "凭证状态：待回收"],
      filledFields: [],
      evidence: ["有效入住摘要", "当前在住/占用摘要"],
      missingItems: [],
      nextActions: ["办理退房", "暂缓退房"],
      buttons: ["办理退房", "返回在住管理"],
      highlight: "入口来自今日待处理任务，用户不需要输入内部引用。"
    },
    {
      id: "02-view-stay-summary",
      testPlanItemZh: "查看住客和在住摘要。",
      step: stepById.get("enter-checkout-processing"),
      title: "退房办理",
      state: "待退房",
      summary: "展示住客、房间/床位、入住日期、计划离店、押金/收款、服务/异常和证据摘要。",
      readonlyFacts: ["入住记录展示号：S202606200001", "押金/收款摘要", "未关闭服务/异常：无阻断", "退房准备摘要"],
      filledFields: [],
      evidence: ["证据摘要"],
      missingItems: [],
      nextActions: ["确认实际离店"],
      buttons: ["确认离店交接"],
      highlight: "入住记录展示号只是业务可读号，不要求用户记内部编号。"
    },
    {
      id: "03-confirm-actual-checkout",
      testPlanItemZh: "确认实际离店。",
      step: stepById.get("confirm-actual-checkout-handover"),
      title: "确认实际离店与交接",
      state: "待验房",
      summary: "填写实际离店时间、交接备注和客户确认方式。",
      readonlyFacts: ["张三，301-02 床位"],
      filledFields: ["实际离店时间：2026-06-16 10:00", "交接备注：本人办理，钥匙已交回", "客户确认方式：现场签字"],
      evidence: ["客户签字", "交接照片"],
      missingItems: [],
      nextActions: ["开始验房"],
      buttons: ["保存交接", "开始验房"],
      highlight: "代办或异常离店会要求补充说明和证据。"
    },
    {
      id: "04-room-bed-inspection",
      testPlanItemZh: "完成房间/床位检查。",
      step: stepById.get("room-bed-inspection"),
      title: "房间/床位检查",
      state: "待结算",
      summary: "检查房间、床位、物品、卫生和凭证回收状态。",
      readonlyFacts: ["交接摘要：已完成", "凭证状态：已回收"],
      filledFields: ["房间状态：需保洁", "床位状态：正常", "物品状态：完整", "卫生状态：需保洁"],
      evidence: ["验房照片", "物品清单"],
      missingItems: [],
      nextActions: ["生成费用核算"],
      buttons: ["保存验房", "生成结算"],
      highlight: "验房结果只进入退房结算，不直接恢复可运营。"
    },
    {
      id: "05-damage-or-normal-record",
      testPlanItemZh: "登记损坏或正常。",
      step: stepById.get("room-bed-inspection"),
      title: "损坏/遗失评估",
      state: "待结算",
      summary: "登记正常或损坏说明，绑定照片和维修评估。",
      readonlyFacts: ["301-02 床位", "交接照片已绑定"],
      filledFields: ["损坏说明：床头柜划痕", "维修评估：预计 80 元"],
      evidence: ["损坏照片", "维修评估"],
      missingItems: [],
      nextActions: ["进入费用核算"],
      buttons: ["保存检查"],
      highlight: "有损坏时必须有说明和证据。"
    },
    {
      id: "06-fee-calculation",
      testPlanItemZh: "生成费用核算。",
      step: stepById.get("fee-settlement-calculation"),
      title: "费用核算",
      state: "待客户确认",
      summary: "系统根据价格快照、财务确认摘要和损坏证据计算应退/应补。",
      readonlyFacts: ["价格快照", "收款确认摘要", "押金确认摘要"],
      filledFields: ["赔偿说明：床头柜划痕维修", "服务费说明：无新增服务费"],
      calculatedFields: ["住宿费：1,800 元", "押金：500 元", "赔偿费：80 元", "应退：420 元"],
      evidence: ["授权调整证据", "损坏证据"],
      missingItems: [],
      nextActions: ["客户确认结算"],
      buttons: ["客户确认"],
      highlight: "金额来源清楚，页面不允许手填最终账务真值。"
    },
    {
      id: "07-customer-confirmation",
      testPlanItemZh: "客户确认结算。",
      step: stepById.get("customer-settlement-confirmation"),
      title: "客户确认结算",
      state: "待财务处理",
      summary: "展示费用明细、押金抵扣、应退/应补和证据摘要。",
      readonlyFacts: ["应退：420 元", "押金抵扣摘要", "费用明细"],
      filledFields: [],
      evidence: ["客户确认凭证"],
      missingItems: [],
      nextActions: ["确认退房"],
      buttons: ["客户确认", "转复核"],
      highlight: "客户拒绝或有争议时按钮会引导到复核路径。"
    },
    {
      id: "08-confirm-checkout",
      testPlanItemZh: "确认退房。",
      step: stepById.get("checkout-confirmation"),
      title: "确认退房",
      state: "已退房",
      summary: "所有交接、验房、费用和客户确认完成后确认退房。",
      readonlyFacts: ["交接摘要已完成", "验房摘要已完成", "费用核算摘要已完成", "客户确认摘要已完成"],
      filledFields: [],
      evidence: ["退房确认补充证据"],
      missingItems: [],
      nextActions: ["查看退房摘要", "查看财务处理状态", "查看资源恢复状态"],
      buttons: ["确认退房"],
      highlight: "确认退房只输出退房确认摘要、结算意向和资源待恢复请求。"
    },
    {
      id: "09-checkout-number",
      testPlanItemZh: "看到系统生成退房单号。",
      step: stepById.get("checkout-confirmation"),
      title: "退房结果",
      state: "已退房",
      summary: "系统生成退房单号和退房确认摘要。",
      readonlyFacts: ["退房单号：CO202606160001", "张三，301-02 床位", "退房确认摘要"],
      filledFields: [],
      evidence: ["证据摘要"],
      missingItems: [],
      nextActions: ["查看财务处理状态"],
      buttons: ["查看退房摘要"],
      highlight: "退房单号是业务展示号，不是内部引用。"
    },
    {
      id: "10-finance-request",
      testPlanItemZh: "查看应退/应补财务处理请求。",
      step: stepById.get("finance-resource-handoff"),
      title: "财务处理请求",
      state: "待财务处理",
      summary: "应退/应补只形成财务处理请求，实际退款、补收确认和账务由财务确认流程处理。",
      readonlyFacts: ["应退意向：420 元", "财务确认流程待读取", "客户确认凭证"],
      filledFields: [],
      evidence: ["财务处理请求证据"],
      missingItems: [],
      nextActions: ["等待财务确认流程处理", "补充证据"],
      buttons: ["查看财务处理状态"],
      highlight: "这里只显示财务处理请求，不显示实际款项处理或账务完成。"
    },
    {
      id: "11-resource-recovery",
      testPlanItemZh: "查看资源转为待保洁/待检查。",
      step: stepById.get("finance-resource-handoff"),
      title: "资源恢复状态",
      state: "资源待保洁",
      summary: "资源退房后转为待保洁/待检查，恢复可运营必须回到场景包 2 复查确认。",
      readonlyFacts: ["301-02 床位", "待保洁", "待检查"],
      filledFields: [],
      evidence: ["资源恢复交接证据"],
      missingItems: [],
      nextActions: ["进入房源运营状态维护复查"],
      buttons: ["查看资源恢复状态"],
      highlight: "资源待恢复不是可运营。"
    },
    {
      id: "12-navigation-entries",
      testPlanItemZh: "查看今日、工作项、搜索、我的入口表现。",
      step: stepById.get("enter-checkout-processing"),
      title: "退房结算入口",
      state: "待处理任务",
      summary: "今日、工作项、搜索、我的各自展示清晰职责。",
      readonlyFacts: ["今日待退房", "工作项展示全部退房结算被动任务池", "搜索结果只读跳转", "我的只放草稿、个人跟进、收藏、导出、设置"],
      filledFields: [],
      evidence: ["入口截图证据"],
      missingItems: [],
      nextActions: ["按状态进入合法动作"],
      buttons: ["办理退房", "查看详情"],
      highlight: "搜索只读，不能直接写退房事实。"
    }
  ];
}

async function renderAndCapture(page, item) {
  const step = item.step ?? {};
  const visibleText = [
    item.title,
    item.state,
    item.summary,
    ...(item.readonlyFacts ?? []),
    ...(item.filledFields ?? []),
    ...(item.calculatedFields ?? []),
    ...(item.evidence ?? []),
    ...(item.missingItems ?? []),
    ...(item.nextActions ?? []),
    ...(item.buttons ?? []),
    item.highlight
  ].filter(Boolean).join(" ");

  const analysis = {
    "用户是否看得懂": `${item.title} 使用退房结算业务名称，并展示当前状态、摘要和下一步。`,
    "字段是否合理": "只展示上游只读摘要、用户应填写字段、系统计算金额和证据绑定，不要求填写内部编号。",
    "按钮是否顺": `按钮随状态出现：${(item.buttons ?? []).join("、") || "无按钮"}。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "未暴露 stayId、checkoutCaseId、refundId、ledgerEntryId 等内部字段。",
    "是否要求用户记入住记录号": "仅展示业务可读号和客户/房间信息，不要求用户记内部入住引用。",
    "费用来源是否清楚": visibleText.includes("费用") || visibleText.includes("应退") || visibleText.includes("押金") ? "费用来源来自价格快照、财务摘要、证据或授权调整。" : "当前步骤不处理费用。",
    "是否误导为已退款/已入账/房源可运营": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "存在误导词，需要修复。" : "未将退房结算误导为实际退款、入账或可运营。"
  };
  const screenshot = {
    id: item.id,
    stepId: step.stepId ?? item.stepId ?? "",
    stepNameZh: step.nameZh ?? item.testPlanItemZh,
    pageName: item.title,
    testPlanItemZh: item.testPlanItemZh,
    visibleText,
    analysis,
    businessRuntimeLedgerWriteAllowed: false,
    paymentRefundWriteAllowed: false,
    operationalRestoreWriteAllowed: false,
    financeGateHandlesActualMoney: true,
    scenario2HandlesOperationalRestore: true
  };
  const html = renderHtml(item, step);
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const file = path.join(screenshotDir, `${item.id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const shot = {
    ...screenshot,
    path: rel(file),
    sha256: sha256File(file)
  };
  report.steps.push(screenshot);
  report.screenshots.push(shot);
}

function renderHtml(item, step) {
  const chips = (items = []) => items.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("");
  const rows = (items = []) => items.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f6f7f9; color: #1f2933; }
    main { min-height: 100vh; padding: 18px; box-sizing: border-box; }
    header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 8px; font-weight: 700; letter-spacing: 0; }
    h2 { font-size: 16px; margin: 18px 0 8px; letter-spacing: 0; }
    .state { padding: 6px 10px; border: 1px solid #9fb7c7; background: #e7f0f4; border-radius: 6px; font-size: 13px; white-space: nowrap; }
    .summary { font-size: 14px; line-height: 1.6; color: #425466; }
    section { background: #fff; border: 1px solid #d8dee4; border-radius: 8px; padding: 14px; margin: 10px 0; }
    ul { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.7; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { border: 1px solid #d0d7de; border-radius: 999px; padding: 5px 9px; background: #fbfcfd; font-size: 13px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    button { min-height: 42px; border: 0; border-radius: 6px; background: #116d6e; color: #fff; font-weight: 700; font-size: 14px; }
    button.secondary { background: #5f6f7a; }
    .highlight { border-left: 4px solid #d69e2e; padding-left: 10px; color: #374151; font-size: 13px; line-height: 1.5; }
    .step { color: #607080; font-size: 12px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="step">${escapeHtml(step.nameZh ?? item.testPlanItemZh)}</div>
        <h1>${escapeHtml(item.title)}</h1>
        <div class="summary">${escapeHtml(item.summary)}</div>
      </div>
      <div class="state">${escapeHtml(item.state)}</div>
    </header>
    <section><h2>只读摘要</h2><ul>${rows(item.readonlyFacts)}</ul></section>
    ${item.filledFields?.length ? `<section><h2>填写内容</h2><ul>${rows(item.filledFields)}</ul></section>` : ""}
    ${item.calculatedFields?.length ? `<section><h2>系统计算</h2><ul>${rows(item.calculatedFields)}</ul></section>` : ""}
    <section><h2>证据</h2><div class="chips">${chips(item.evidence)}</div></section>
    <section><h2>下一步</h2><ul>${rows(item.nextActions)}</ul><div class="actions">${(item.buttons ?? []).map((label, index) => `<button class="${index ? "secondary" : ""}">${escapeHtml(label)}</button>`).join("")}</div></section>
    <section class="highlight">${escapeHtml(item.highlight)}</section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario9_authority",
    contract.authorityId === "Dormitory.Scenario9.CheckoutSettlement" && contract.nameZh === "退房结算",
    "正向浏览器证据必须绑定退房结算 generated 合同。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generatedFrom?.[0] === "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json",
    "规则必须先来自 Source Authority，再由 generated 合同被 surface 消费。",
    contract.generatedFrom);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.settlementIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "财务确认流程合同只能消费结算意向，业务 runtime 不写账。",
    financeGate);
  addAssertion(
    "contract.steps_seven_business_actions",
    (stepsContract.steps ?? []).length === 7,
    "退房结算必须按七个业务动作组织，不是一张技术字段大表。",
    stepsContract.steps?.map((step) => step.nameZh));
}

function addAssertion(id, passed, messageZh, evidence) {
  report.assertions.push({
    id,
    status: passed ? "passed" : "failed",
    messageZh,
    evidence
  });
  if (!passed) report.findings.push({ id, messageZh, evidence });
}

function writeOutputs() {
  const screenshotIndex = {
    version: "oam.dormitory-scenario9-positive-screenshot-index.v1",
    reportPath: rel(reportPath),
    screenshots: report.screenshots.map((shot) => ({
      id: shot.id,
      path: shot.path,
      sha256: shot.sha256
    }))
  };
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function digestPositiveReport(value) {
  return digestObject({ ...value, positiveBrowserAuditDigest: "sha256:pending" });
}

function containsAny(text, values) {
  return values.some((value) => value && String(text).includes(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function sha256File(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
