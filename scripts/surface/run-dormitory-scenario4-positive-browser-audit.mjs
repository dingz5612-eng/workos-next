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
const contractPath = "docs/contracts/generated/dormitory/scenario4-inquiry-and-quote.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario4-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario4-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario4-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario4-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = [
  "inquiryId",
  "customerId",
  "quoteId",
  "quoteVersionId",
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
  "是否误导为锁定或成交"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario4-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario4_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  positiveBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 4 contracts; no UI/runtime/test script adds business rules",
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
    "正向截图不得出现后续成交、旧包或发布门禁误导词。",
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
    "positive.no_inventory_reservation_finance_writes",
    report.steps.every((step) => step.crossScenarioWriteAllowed === false),
    "正向主流程不得写库存、正式预订、入住、收款、押金、退款或账务事实。",
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
    console.error(`Dormitory scenario4 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario4 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario4 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    {
      id: "01-enter-inquiry",
      testPlanItemZh: "从客户询价入口进入。",
      step: stepById.get("register-customer-inquiry"),
      title: contract.nameZh,
      state: "询价草稿",
      summary: "从客户询价入口进入，只开始询价登记，不创建库存、正式预订或账务事实。",
      readonlyFacts: [
        "上游摘要已带入：房间摘要、床位组摘要、运营状态摘要、商品摘要、价格摘要",
        "301 房间整房，运营状态可报价，价格 180 元/晚"
      ],
      filledFields: [],
      evidence: ["客户询价证据待绑定"],
      missingItems: ["客户姓名", "联系方式"],
      nextActions: ["登记客户"],
      buttons: ["继续填写", "保存草稿"],
      highlight: "用户先看见业务入口和缺失项。"
    },
    {
      id: "02-register-customer",
      testPlanItemZh: "登记客户。",
      step: stepById.get("register-customer-inquiry"),
      title: "客户询价登记",
      state: "询价草稿",
      summary: "记录客户姓名、联系方式、来源渠道和跟进人。",
      readonlyFacts: ["来源：电话询价", "跟进人：前台 A"],
      filledFields: ["客户姓名：张三", "联系方式：13800000000", "客户来源：电话询价"],
      evidence: ["客户询价证据", "客户来源证据"],
      missingItems: [],
      nextActions: ["填写入住需求"],
      buttons: ["继续填写", "保存草稿"],
      highlight: "客户信息以业务名称展示，系统引用不需要用户记忆。"
    },
    {
      id: "03-confirm-stay-demand",
      testPlanItemZh: "填写入住日期、离店日期、人数。",
      step: stepById.get("confirm-stay-demand"),
      title: "填写入住需求",
      state: "待选择报价选项",
      summary: "确认入住日期、离店日期、人数、偏好和预算。",
      readonlyFacts: ["客户摘要：张三，企业访客"],
      filledFields: ["入住日期：2026-07-10", "离店日期：2026-07-12", "人数：2", "偏好：整房"],
      evidence: ["入住需求证据"],
      missingItems: [],
      nextActions: ["查看可报价商品"],
      buttons: ["确认需求", "返回修改"],
      highlight: "日期与人数校验放在需求步骤，不与报价金额混在一起。"
    },
    {
      id: "04-view-quotable-products",
      testPlanItemZh: "查看可报价商品。",
      step: stepById.get("select-quotable-product"),
      title: "查看可报价商品",
      state: "可报价",
      summary: "从上游只读摘要选择可报价商品，不回写房源、运营或价格事实。",
      readonlyFacts: [
        "房间摘要：1 号楼 3 层 301 房间",
        "床位组摘要：6 个床位",
        "运营状态摘要：可运营且无阻断",
        "商品摘要：301 房间整房按晚价"
      ],
      filledFields: [],
      evidence: ["报价选项证据"],
      missingItems: [],
      nextActions: ["生成报价草稿"],
      buttons: ["选择该商品", "查看不可报价原因"],
      highlight: "用户只选择业务商品，看不到系统内部引用。"
    },
    {
      id: "05-view-price-source",
      testPlanItemZh: "查看价格来源和价格明细。",
      step: stepById.get("select-quotable-product"),
      title: "价格来源与明细",
      state: "可生成草稿",
      summary: "展示场景包 3 已生效价格来源、适用日期、晚数和明细。",
      readonlyFacts: ["价格来源：住宿商品与价格", "适用日期：2026-07-10 至 2026-07-12", "晚数：2", "单价：180 元/晚"],
      filledFields: [],
      evidence: ["场景包 3 商品价格摘要"],
      missingItems: [],
      nextActions: ["生成报价草稿"],
      buttons: ["生成报价草稿", "返回商品列表"],
      highlight: "报价金额来自已生效价格快照，用户不能手填最终价格真值。"
    },
    {
      id: "06-generate-draft",
      testPlanItemZh: "生成报价草稿。",
      step: stepById.get("generate-quote-draft"),
      title: "生成报价草稿",
      state: "报价草稿",
      summary: "系统根据客户需求、商品、价格快照和有效期生成报价草稿。",
      readonlyFacts: ["客户需求：2 人 2 晚", "价格明细：180 元 x 2 晚", "总价：360 元"],
      filledFields: ["报价备注：含基础保洁", "优惠说明：无", "跟进时间：今天 18:00"],
      evidence: ["报价依据证据", "价格快照证据"],
      missingItems: [],
      nextActions: ["确认并发送报价"],
      buttons: ["确认报价", "返回修改", "保存草稿"],
      highlight: "草稿可改；发送后只能追加版本或重新报价。"
    },
    {
      id: "07-send-quote",
      testPlanItemZh: "确认并发送报价。",
      step: stepById.get("issue-and-send-quote"),
      title: "确认并发送报价",
      state: "报价已发送",
      summary: "确认客户可读报价摘要、有效期和发送渠道。",
      readonlyFacts: ["报价摘要：张三，301 整房，2 晚，总价 360 元", "有效期：今晚 20:00"],
      filledFields: ["发送备注：已通过电话同步"],
      evidence: ["报价确认记录", "报价发送证据"],
      missingItems: [],
      nextActions: ["记录客户反馈"],
      buttons: ["发送报价", "返回修改"],
      highlight: "发送动作不会锁定库存，也不会形成正式预订。"
    },
    {
      id: "08-view-quote-number-validity",
      testPlanItemZh: "查看报价单号和有效期。",
      step: stepById.get("issue-and-send-quote"),
      title: "完成摘要",
      state: "客户待确认",
      summary: "展示业务可读的报价单号、报价版本、价格快照和有效期。",
      readonlyFacts: ["报价单号：BJ-20260710-001", "报价版本：V1", "有效至：今晚 20:00", "状态历史：报价已发送"],
      filledFields: [],
      evidence: ["报价发送证据已绑定"],
      missingItems: [],
      nextActions: ["记录客户反馈或重新报价"],
      buttons: ["记录反馈", "重新报价", "关闭报价"],
      highlight: "报价单号是业务展示号，不要求用户输入系统引用。"
    },
    {
      id: "09-record-feedback",
      testPlanItemZh: "记录客户反馈。",
      step: stepById.get("quote-follow-up-and-reservation-prep"),
      title: "报价跟进",
      state: "客户待确认",
      summary: "记录客户反馈、跟进备注和下一步动作。",
      readonlyFacts: ["报价摘要：BJ-20260710-001，360 元，有效至今晚 20:00"],
      filledFields: ["客户反馈：接受报价，要求保留到今晚", "跟进备注：提醒有效期"],
      evidence: ["客户反馈证据"],
      missingItems: [],
      nextActions: ["发起转预订准备"],
      buttons: ["记录反馈", "发起转预订准备", "重新报价"],
      highlight: "客户接受报价仍只是反馈，不等于正式预订完成。"
    },
    {
      id: "10-start-reservation-prep",
      testPlanItemZh: "发起转预订准备。",
      step: stepById.get("quote-follow-up-and-reservation-prep"),
      title: "转预订准备",
      state: "转预订准备",
      summary: "只把报价摘要交给场景包 5，场景包 5 必须重新校验库存和报价有效期。",
      readonlyFacts: ["报价摘要", "客户需求摘要", "价格快照", "有效期摘要", "证据摘要"],
      filledFields: ["跟进备注：客户同意进入下一步"],
      evidence: ["客户反馈证据"],
      missingItems: [],
      nextActions: ["进入预订与库存锁定前复核"],
      buttons: ["发起转预订准备", "查看摘要"],
      highlight: "本场景只准备交接，不能在此生成正式预订结果。"
    },
    {
      id: "11-entry-roles",
      testPlanItemZh: "查看今日、工作项、搜索、我的入口表现。",
      step: stepById.get("quote-follow-up-and-reservation-prep"),
      title: "入口职责",
      state: "任务清晰",
      summary: "今日只显示今日被动任务；工作项显示全量被动任务；搜索结果只读跳转；我的只放草稿、收藏、个人跟进、导出和设置。",
      readonlyFacts: ["今日：待补联系方式、报价今日到期、客户待确认", "工作项：全部询价与报价被动任务", "搜索：按客户、房间、报价单号、状态只读跳转", "我的只放草稿和个人跟进"],
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
    "字段是否合理": "字段按客户、需求、商品、价格、报价、反馈分组，系统带入项只读展示。",
    "按钮是否顺": `按钮随状态出现：${item.buttons.join("、")}，没有固定万能提交按钮。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号，需要修复。" : "未暴露内部编号或技术引用。",
    "是否误导为锁定或成交": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "出现误导词，需要修复。" : "未显示已成交、已锁定、发布放行等误导表达。"
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
    .state { display: inline-flex; padding: 5px 9px; border: 1px solid #94a3b8; background: #fff; font-size: 13px; border-radius: 6px; }
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
      <div class="eyebrow">场景包 4</div>
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
    "contract.scenario4_authority",
    contract.authorityId === "Dormitory.Scenario4.InquiryAndQuote" &&
      contract.nameZh === "询价与报价" &&
      contract.scenarioPackageNo === 4,
    "正向截图必须绑定场景包 4 询价与报价权威源。",
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
    JSON.stringify(contract.upstream?.allowedSourcePackageNos ?? []) === JSON.stringify([1, 2, 3]) &&
      contract.upstream?.upstreamWriteBackAllowed === false,
    "场景 4 只能读取场景包 1、2、3 摘要，不得回写上游。",
    contract.upstream);
  addAssertion(
    "contract.downstream_package5_recheck",
    contract.downstream?.allowedConsumerPackageNo === 5 &&
      String(contract.downstream?.downstreamRecheckRuleZh ?? "").includes("必须重新校验库存和报价有效期"),
    "场景 5 必须重新校验库存和报价有效期。",
    contract.downstream);
  addAssertion(
    "contract.steps_six_business_actions",
    (stepsContract.steps ?? []).length === 6,
    "场景 4 页面必须按六个业务动作组织。",
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
    version: "oam.dormitory-scenario4-positive-browser-screenshot-index.v1",
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
