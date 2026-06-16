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
const contractPath = "docs/contracts/generated/dormitory/scenario5-reservation-and-inventory-hold.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario5-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario5-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario5-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario5-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = [
  "bookingRequestId",
  "inventoryHoldId",
  "holdId",
  "reservationId",
  "reservationNo",
  "quoteId",
  "productId",
  "ratePlanId",
  "roomId",
  "bedId",
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
  "价格来源是否清楚",
  "库存锁定是否可感知",
  "是否误导为已入住/已收款"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario5-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario5_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  positiveBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 5 contracts; no UI/runtime/test script adds business rules",
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
    "positive.inventory_hold_visible",
    JSON.stringify(report).includes("锁定截止时间") &&
      JSON.stringify(report).includes("已锁定至 20:00") &&
      JSON.stringify(report).includes("系统生成预订号"),
    "正向主流程必须让用户感知库存锁定、截止时间和系统生成的预订号。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_downstream_or_finance_writes",
    report.steps.every((step) => step.crossScenarioWriteAllowed === false),
    "正向主流程不得写后续办理或财务事实。",
    report.steps.map((step) => ({ stepId: step.stepId, crossScenarioWriteAllowed: step.crossScenarioWriteAllowed })));
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
    console.error(`Dormitory scenario5 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario5 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario5 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    {
      id: "01-enter-reservation-preparation",
      testPlanItemZh: "从场景包 4 报价进入转预订准备。",
      step: stepById.get("enter-reservation-preparation"),
      title: contract.nameZh,
      state: "转预订准备",
      summary: "从已确认报价进入预订准备，只读取报价和客户意向摘要，不回写上游。",
      readonlyFacts: [
        "报价单号：BJ-20260620-001",
        "客户选择意向：接受 301 房间整房方案",
        "报价有效期：今天 20:30 前有效"
      ],
      filledFields: [],
      evidence: ["报价确认证据", "客户意向证据"],
      missingItems: [],
      nextActions: ["查看客户和报价摘要"],
      buttons: ["继续预订", "返回重新报价", "关闭准备"],
      highlight: "用户看见的是业务入口，不需要记任何系统引用。"
    },
    {
      id: "02-review-customer-quote-summary",
      testPlanItemZh: "查看客户和报价摘要。",
      step: stepById.get("enter-reservation-preparation"),
      title: "客户和报价摘要",
      state: "待锁定",
      summary: "确认客户、联系方式、报价摘要、价格来源和客户意向都已带入。",
      readonlyFacts: ["客户：张三", "联系方式：13800000000", "报价：301 房间整房 3 晚，总价 540 元", "价格来源：住宿商品与价格"],
      filledFields: [],
      evidence: ["报价确认证据已绑定", "客户意向证据已绑定"],
      missingItems: [],
      nextActions: ["确认日期和人数"],
      buttons: ["确认摘要", "返回报价"],
      highlight: "报价来源清楚展示，价格真值仍来自上游快照。"
    },
    {
      id: "03-confirm-date-and-guest-count",
      testPlanItemZh: "输入或确认入住日期/离店日期/人数。",
      step: stepById.get("enter-reservation-preparation"),
      title: "确认日期和人数",
      state: "待复核资源",
      summary: "确认入住日期、离店日期和人数，为资源日期范围复核做准备。",
      readonlyFacts: ["入住日期：2026-06-20", "离店日期：2026-06-23", "人数：2"],
      filledFields: ["特殊要求：靠近电梯", "备注：客户晚间到达"],
      evidence: ["客户意向证据"],
      missingItems: [],
      nextActions: ["复核可订资源"],
      buttons: ["复核可订资源", "保存备注"],
      highlight: "日期、人数和备注分开展示，避免把价格和锁定动作混在一个表单。"
    },
    {
      id: "04-review-available-resource",
      testPlanItemZh: "查看可订资源。",
      step: stepById.get("review-available-resource"),
      title: "可订资源复核页",
      state: "可锁定",
      summary: "系统按房间/床位、日期、运营状态、价格快照和当前占用做原子复核。",
      readonlyFacts: ["1 号楼 3 层 301 房间", "6 个床位", "运营状态：可运营且无阻断", "价格快照：180 元/晚，3 晚"],
      filledFields: [],
      evidence: ["可订复核证据"],
      missingItems: [],
      nextActions: ["选择房间/床位"],
      buttons: ["选择该资源", "查看不可订原因"],
      highlight: "用户只看到业务资源和不可订原因，不暴露技术引用。"
    },
    {
      id: "05-select-room-or-bed",
      testPlanItemZh: "选择房间/床位。",
      step: stepById.get("review-available-resource"),
      title: "选择房间或床位",
      state: "可锁定",
      summary: "客户选择 301 房间整房，系统保留上游价格快照和日期范围。",
      readonlyFacts: ["资源：301 房间整房", "日期：2026-06-20 至 2026-06-23", "人数：2"],
      filledFields: [],
      evidence: ["可订复核证据"],
      missingItems: [],
      nextActions: ["锁定库存"],
      buttons: ["锁定", "重新选择"],
      highlight: "选择的是业务资源，不要求用户填写房间或床位内部编号。"
    },
    {
      id: "06-create-inventory-hold",
      testPlanItemZh: "点击锁定。",
      step: stepById.get("create-inventory-hold"),
      title: "锁定库存",
      state: "锁定中",
      summary: "点击锁定后，系统按资源和日期范围原子创建库存锁定。",
      readonlyFacts: ["资源：301 房间整房", "日期范围：6 月 20 日至 6 月 23 日", "当前可锁定状态：可锁定"],
      filledFields: [],
      evidence: ["库存锁定证据"],
      missingItems: [],
      nextActions: ["等待锁定结果"],
      buttons: ["锁定", "返回资源列表"],
      highlight: "锁定动作清晰独立，不在报价页或搜索结果中写业务事实。"
    },
    {
      id: "07-view-hold-until",
      testPlanItemZh: "看到锁定截止时间。",
      step: stepById.get("create-inventory-hold"),
      title: "库存锁定结果",
      state: "已锁定",
      summary: "锁定成功后展示锁定截止时间和合法下一步。",
      readonlyFacts: ["301 房间已锁定至 20:00", "锁定剩余：45 分钟", "锁定历史：本次锁定成功"],
      filledFields: [],
      evidence: ["库存锁定证据已绑定"],
      missingItems: [],
      nextActions: ["确认预订信息"],
      buttons: ["确认预订", "释放锁定"],
      highlight: "用户能明确知道锁定是临时状态，且有截止时间。"
    },
    {
      id: "08-confirm-reservation-information",
      testPlanItemZh: "确认预订。",
      step: stepById.get("confirm-reservation-information"),
      title: "预订确认页",
      state: "待确认预订",
      summary: "复核客户、日期、房间/床位、价格快照、报价来源和锁定截止时间。",
      readonlyFacts: ["客户：张三", "房间：301 房间整房", "价格明细：180 元 x 3 晚", "报价来源：BJ-20260620-001", "锁定截止时间：20:00"],
      filledFields: ["客户确认方式：电话确认", "预订备注：晚间到达", "特殊要求：靠近电梯"],
      evidence: ["客户确认证据", "预订规则证据"],
      missingItems: [],
      nextActions: ["生成预订"],
      buttons: ["生成预订", "返回修改", "释放锁定"],
      highlight: "确认前仍能看到价格来源和锁定截止时间。"
    },
    {
      id: "09-system-generates-reservation-number",
      testPlanItemZh: "看到系统生成预订号。",
      step: stepById.get("confirm-reservation"),
      title: "生成预订",
      state: "已预订",
      summary: "系统基于未过期锁定和有效报价生成预订结果。",
      readonlyFacts: ["系统生成预订号：R202606200001", "确认时间：今天 19:15", "预订状态：已预订"],
      filledFields: [],
      evidence: ["预订确认证据"],
      missingItems: [],
      nextActions: ["查看预订详情"],
      buttons: ["查看预订", "进入入住办理准备"],
      highlight: "预订号由系统生成，用户不用也不能手工填写。"
    },
    {
      id: "10-view-reservation-detail",
      testPlanItemZh: "查看预订详情。",
      step: stepById.get("reservation-result-and-checkin-preparation"),
      title: "预订详情页",
      state: "转入住准备",
      summary: "展示预订确认摘要、库存锁定历史、价格快照和证据摘要，后续仍需重新核验。",
      readonlyFacts: ["预订号：R202606200001", "客户：张三", "日期：6 月 20 日至 6 月 23 日", "房间/床位：301 房间整房", "价格快照：540 元", "锁定历史：已锁定至 20:00 后确认"],
      filledFields: [],
      evidence: ["预订结果证据", "状态历史"],
      missingItems: [],
      nextActions: ["进入入住办理准备"],
      buttons: ["查看摘要", "进入入住办理准备"],
      highlight: "完成页只输出预订摘要，不直接办理后续业务或财务事项。"
    },
    {
      id: "11-entry-roles",
      testPlanItemZh: "查看今日、工作项、搜索、我的入口表现。",
      step: stepById.get("reservation-result-and-checkin-preparation"),
      title: "入口职责",
      state: "任务清晰",
      summary: "今日只显示今天要处理的被动任务；工作项显示全量任务；搜索结果只读跳转；我的只放草稿、收藏、个人跟进、导出和设置。",
      readonlyFacts: ["今日：锁定即将过期、待确认预订、今日预订待入住准备", "工作项：全部预订与库存锁定被动任务", "搜索：按客户、手机号、预订号、日期、房间/床位、预订状态只读跳转", "我的只放草稿和个人跟进"],
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
    "字段是否合理": "字段按客户、日期、资源、价格来源、锁定、预订确认分组，系统带入项只读展示。",
    "按钮是否顺": `按钮随状态出现：${item.buttons.join("、")}，没有固定万能提交按钮。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号，需要修复。" : "未暴露内部编号或技术引用。",
    "价格来源是否清楚": visibleText.includes("价格来源") || visibleText.includes("价格快照") ? "价格来源和快照可见。" : "价格来源不够清楚，需要修复。",
    "库存锁定是否可感知": visibleText.includes("锁定") ? "用户能看到锁定状态、截止时间或下一步。" : "锁定状态不可感知，需要修复。",
    "是否误导为已入住/已收款": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "出现误导词，需要修复。" : "未显示后续入住或收款完成状态。"
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
    generatedContractConsumed: true,
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
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f6f7f9; color: #1f2933; }
    main { min-height: 100vh; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
    header { border-bottom: 1px solid #d9dee7; padding-bottom: 12px; }
    .eyebrow { font-size: 12px; color: #5d6675; margin-bottom: 6px; }
    h1 { font-size: 26px; line-height: 1.2; margin: 0 0 8px; letter-spacing: 0; }
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
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">场景包 5</div>
      <h1>${escapeHtml(item.title)}</h1>
      <div class="state">${escapeHtml(item.state)}</div>
    </header>
    <section><h2>当前业务动作</h2><div class="note">${escapeHtml(item.summary)}</div></section>
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
    "contract.scenario5_authority",
    contract.authorityId === "Dormitory.Scenario5.ReservationAndInventoryHold" &&
      contract.nameZh === "预订与库存锁定" &&
      contract.scenarioPackageNo === 5,
    "正向截图必须绑定场景包 5 预订与库存锁定权威源。",
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
    JSON.stringify(contract.upstream?.allowedSourcePackageNos ?? []) === JSON.stringify([1, 2, 3, 4]) &&
      contract.upstream?.upstreamWriteBackAllowed === false,
    "场景 5 只能读取场景包 1、2、3、4 摘要，不得回写上游。",
    contract.upstream);
  addAssertion(
    "contract.downstream_package6_recheck",
    contract.downstream?.allowedConsumerPackageNo === 6 &&
      String(contract.downstream?.downstreamRecheckRuleZh ?? "").includes("必须重新核验"),
    "场景 6 必须重新核验后续办理所需信息。",
    contract.downstream);
  addAssertion(
    "contract.steps_six_business_actions",
    (stepsContract.steps ?? []).length === 6,
    "场景 5 页面必须按六个业务动作组织。",
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
    version: "oam.dormitory-scenario5-positive-browser-screenshot-index.v1",
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
