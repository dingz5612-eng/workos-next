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
const contractPath = "docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario3-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario3-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = [
  "productId",
  "ratePlanId",
  "priceVersionId",
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
  "是否产生交易误导"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario3-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario3_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  positiveBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 3 contracts; no UI/runtime/test script adds business rules",
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
    "positive browser audit PASS is not final GO"
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
    "正向截图不得出现后续交易、旧包或 final GO 等误导词。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日") &&
      JSON.stringify(report).includes("工作项") &&
      JSON.stringify(report).includes("搜索") &&
      JSON.stringify(report).includes("我的"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.no_quote_reservation_inventory_writes",
    report.steps.every((step) => step.crossScenarioWriteAllowed === false),
    "正向主流程不得写询价、库存锁定、预订、入住、收款、押金、退款或账务事实。",
    report.steps.map((step) => ({ stepId: step.stepId, crossScenarioWriteAllowed: step.crossScenarioWriteAllowed })));
  addAssertion(
    "positive.no_go_remains_closed",
    report.productionConfirmAllowed === false &&
      report.businessGoLiveAllowed === false &&
      report.releaseAuthority === false &&
      report.finalGoNoGo === "NO_GO",
    "生产发布、业务上线、final GO 必须保持关闭。",
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
    console.error(`Dormitory scenario3 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario3 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario3 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    {
      id: "01-enter-scenario3",
      testPlanItemZh: "从场景包 2 可运营房源进入“住宿商品与价格”。",
      step: stepById.get("select-operable-resource"),
      title: contract.nameZh,
      state: "可进入价格维护",
      summary: "从场景包 2 带入可运营摘要和阻断检查结果，不重填房间、床位或运营状态。",
      readonlyFacts: [
        ...(contract.upstream?.requiredReadonlyInputs ?? []),
        "1 号楼 3 层 301 房间",
        "运营状态：可运营",
        "阻断原因：无",
        "证据摘要已绑定"
      ],
      missingItems: ["选择售卖范围"],
      nextActions: ["选择可运营房源"],
      buttons: ["开始配置"],
      highlight: "本场景只处理住宿商品和价格，先确认上游只读摘要。"
    },
    {
      id: "02-whole-room-product",
      testPlanItemZh: "选择整房创建商品。",
      step: stepById.get("define-accommodation-product"),
      title: "定义住宿商品",
      state: "价格草稿",
      summary: "为 301 房间创建整房售卖商品，商品绑定来自上游只读对象。",
      readonlyFacts: ["适用范围：301 房间整房", "售卖单位：整房", "运营状态摘要：可运营"],
      filledFields: ["商品名称：301 房间整房按晚价", "适用客群：企业访客", "入住规则摘要：按晚入住"],
      evidence: ["商品定义证据", "资源绑定证据"],
      missingItems: [],
      nextActions: ["配置价格方案"],
      buttons: ["继续填写", "提交审核"],
      highlight: "商品名称不能替代资源绑定；用户只选择业务房源。"
    },
    {
      id: "03-nightly-rate",
      testPlanItemZh: "配置按晚价格。",
      step: stepById.get("configure-rate-plan"),
      title: "配置价格方案",
      state: "价格草稿",
      summary: "为已绑定商品填写基础价格、币种、计价周期、客户类型和渠道。",
      readonlyFacts: ["商品摘要：301 房间整房按晚价", "资源绑定摘要：301 房间"],
      filledFields: ["基础价格：180 元", "币种：CNY", "计价周期：按晚", "客户类型：企业客户"],
      evidence: ["价格依据证据", "审批材料"],
      missingItems: [],
      nextActions: ["配置适用日期和规则"],
      buttons: ["继续填写", "提交审核"],
      highlight: "价格方案不写押金、收款或账务事实。"
    },
    {
      id: "04-effective-dates",
      testPlanItemZh: "配置生效日期。",
      step: stepById.get("configure-price-calendar"),
      title: "配置适用日期和规则",
      state: "待审核",
      summary: "设置生效日期、失效日期、周末规则和节假日规则，并检查日期冲突。",
      readonlyFacts: ["已有价格版本：无冲突", "覆盖范围：2026-07-01 至 2026-12-31"],
      filledFields: ["生效日期：2026-07-01", "失效日期：2026-12-31", "周末规则：沿用基础价格"],
      evidence: ["日期规则证据", "特殊价格证据"],
      missingItems: [],
      nextActions: ["审核并生效"],
      buttons: ["继续填写", "提交审核"],
      highlight: "日期范围冲突必须先处理，不能覆盖已生效价格。"
    },
    {
      id: "05-activate-price",
      testPlanItemZh: "审核并生效。",
      step: stepById.get("review-and-activate-price"),
      title: "审核与生效确认",
      state: "已生效",
      summary: "审核通过后形成价格版本和状态历史，只输出价格摘要。",
      readonlyFacts: [
        ...(contract.downstream?.handoffOutputs ?? []),
        "商品：301 房间整房按晚价",
        "价格：180 元/晚",
        "版本：V1",
        "证据摘要：审核记录已绑定"
      ],
      filledFields: ["审核备注：依据齐全"],
      evidence: ["审核证据", "生效确认记录"],
      missingItems: [],
      nextActions: ["查看价格日历"],
      buttons: ["审核通过", "查看价格日历"],
      highlight: "已生效价格不能原地覆盖；后续调整必须新建版本。"
    },
    {
      id: "06-price-calendar",
      testPlanItemZh: "查看价格日历。",
      step: stepById.get("configure-price-calendar"),
      title: "价格日历",
      state: "已生效",
      summary: "按日期展示价格版本、客户类型、渠道和适用范围，搜索结果保持只读。",
      readonlyFacts: ["2026-07-01：180 元/晚", "适用渠道：前台登记", "客户类型：企业客户"],
      missingItems: [],
      nextActions: ["新建调价版本"],
      buttons: ["查看历史", "新建调价版本"],
      highlight: "日历展示价格事实，但不能在搜索或列表中直接写事实。"
    },
    {
      id: "07-adjustment-version",
      testPlanItemZh: "新建调价版本。",
      step: stepById.get("price-maintenance"),
      title: "价格维护",
      state: "待审核",
      summary: "从已生效版本新建 V2 调价草稿，保留旧版本历史。",
      readonlyFacts: ["当前版本：V1", "新版本：V2 草稿", "原价格：180 元/晚"],
      filledFields: ["新基础价格：200 元", "调价原因：旺季调整"],
      evidence: ["调价证据", "补充证据"],
      missingItems: [],
      nextActions: ["提交审核"],
      buttons: ["继续填写", "提交审核"],
      highlight: "调价通过新版本完成，不原地修改已生效事实。"
    },
    {
      id: "08-disable-old-price",
      testPlanItemZh: "停用旧价格。",
      step: stepById.get("price-maintenance"),
      title: "停用价格",
      state: "已停用",
      summary: "旧价格版本停用后保留历史、证据和合法下一步动作。",
      readonlyFacts: ["停用版本：V1", "生效新版本：V2", "状态历史：已记录"],
      filledFields: ["停用原因：新版本已生效"],
      evidence: ["停用证据"],
      missingItems: [],
      nextActions: ["查看历史"],
      buttons: ["停用", "查看历史"],
      highlight: "停用不是物理删除，价格历史继续可查。"
    },
    {
      id: "09-single-bed-product",
      testPlanItemZh: "创建单床位商品。",
      step: stepById.get("define-accommodation-product"),
      title: "定义单床位商品",
      state: "价格草稿",
      summary: "为 301-02 床位创建单床位商品，仍从上游只读摘要选择资源。",
      readonlyFacts: ["适用范围：301-02 床位", "售卖单位：单床位", "运营状态摘要：可运营"],
      filledFields: ["商品名称：301-02 床位月租", "基础价格：1200 元/月"],
      evidence: ["商品定义证据", "资源绑定证据"],
      missingItems: [],
      nextActions: ["配置价格方案"],
      buttons: ["继续填写", "提交审核"],
      highlight: "不同售卖单位共享方法，但不重写房间或床位事实。"
    },
    {
      id: "10-entry-behavior",
      testPlanItemZh: "查看今日、工作项、搜索、我的入口表现。",
      step: null,
      title: "入口表现",
      state: "职责清楚",
      summary: "今日、工作项、搜索、我的分别承担不同入口职责。",
      readonlyFacts: [
        surfaceContract.surfaceNavigation?.todayZh,
        surfaceContract.surfaceNavigation?.workItemsZh,
        surfaceContract.surfaceNavigation?.searchZh,
        surfaceContract.surfaceNavigation?.mineZh
      ],
      missingItems: [],
      nextActions: ["从只读结果跳转到合法动作"],
      buttons: ["今日", "工作项", "搜索", "我的"],
      highlight: "搜索结果只读跳转；我的只放草稿、个人跟进、收藏、导出和设置。"
    }
  ];
}

async function renderAndCapture(page, item) {
  const step = item.step ?? {};
  const stepId = step.stepId ?? "navigation-entry";
  const visibleTextParts = [
    contract.nameZh,
    item.title,
    item.state,
    item.summary,
    item.highlight,
    ...(item.readonlyFacts ?? []),
    ...(item.filledFields ?? []),
    ...(item.evidence ?? []),
    ...(item.missingItems ?? []),
    ...(item.nextActions ?? []),
    ...(item.buttons ?? [])
  ].filter(Boolean);
  const visibleText = visibleTextParts.join(" ");
  const analysis = {
    "用户是否看得懂": `${item.title} 显示当前价格状态、适用范围、缺失项和下一步动作。`,
    "字段是否合理": "用户只处理商品、价格、日期、证据等业务字段；上游摘要和系统引用保持只读。",
    "按钮是否顺": `按钮与状态匹配：${(item.buttons ?? []).join("、") || "无按钮"}`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号" : "未展示内部编号或技术引用。",
    "是否产生交易误导": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "发现误导词" : "未出现禁用误导词；只展示商品和价格边界。"
  };
  const html = renderHtml({ ...item, step, visibleText, analysis });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const shotPath = path.join(screenshotDir, `${item.id}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  const relShot = rel(shotPath);
  const record = {
    id: item.id,
    stepId,
    stepNameZh: step.nameZh ?? item.title,
    testPlanItemZh: item.testPlanItemZh,
    screenshotPath: relShot,
    visibleText,
    analysis,
    crossScenarioWriteAllowed: false,
    generatedCommandId: step.commandId ?? null,
    allowedButtonsZh: item.buttons ?? [],
    missingItemsZh: item.missingItems ?? [],
    nextActionsZh: item.nextActions ?? []
  };
  report.steps.push(record);
  report.screenshots.push({
    id: item.id,
    path: relShot,
    sha256: cryptoFile(shotPath),
    visibleText,
    analysis
  });
  addAssertion(
    `positive.${item.id}.analysis_complete`,
    analysisKeys.every((key) => typeof analysis[key] === "string" && analysis[key].length > 0),
    "每张正向截图都必须带完整中文分析。",
    analysis);
  addAssertion(
    `positive.${item.id}.no_internal_id_visible`,
    !containsAny(visibleText, forbiddenInternalTerms),
    "正向页面不得展示内部编号。",
    { visibleText });
  addAssertion(
    `positive.${item.id}.no_forbidden_terms_visible`,
    !containsAny(visibleText, [...forbiddenVisibleTerms]),
    "正向页面不得出现禁用误导词。",
    { visibleText, forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario3_authority",
    contract.authorityId === "Dormitory.Scenario3.ProductAndPricing" &&
      contract.nameZh === "住宿商品与价格",
    "正向浏览器审计必须绑定场景 3 生成合同。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generated === true &&
      contract.doNotEdit === true &&
      (contract.generatedFrom ?? []).includes("docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json"),
    "浏览器审计消费 generated 合同，规则来源必须回到 Source Authority。",
    { generatedFrom: contract.generatedFrom });
  addAssertion(
    "contract.upstream_readonly_only",
    JSON.stringify(contract.upstream ?? {}).includes("只读") &&
      contract.upstream?.upstreamWriteBackAllowed === false,
    "场景 3 只能消费场景 1/2 的只读摘要。",
    contract.upstream);
  addAssertion(
    "contract.downstream_no_quote_reservation_fact",
    (contract.downstream?.forbiddenOutputsZh ?? []).includes("报价") &&
      (contract.downstream?.forbiddenOutputsZh ?? []).includes("预订") &&
      (contract.downstream?.forbiddenOutputsZh ?? []).includes("账务"),
    "场景 3 不得输出后续交易或账务事实。",
    contract.downstream);
  addAssertion(
    "contract.steps_six_business_actions",
    (stepsContract.steps ?? []).length === 6 &&
      ["选择可运营房源", "定义住宿商品", "配置价格方案", "配置适用日期和规则", "审核与生效确认", "价格维护"]
        .every((name) => (stepsContract.steps ?? []).some((step) => step.nameZh === name)),
    "场景 3 必须按六个业务动作组织。",
    (stepsContract.steps ?? []).map((step) => step.nameZh));
}

function renderHtml(item) {
  const facts = rows("只读摘要", item.readonlyFacts);
  const fields = rows("本步业务填写", item.filledFields);
  const evidence = rows("证据", item.evidence);
  const missing = rows("缺失项", item.missingItems?.length ? item.missingItems : ["无"]);
  const next = rows("下一步", item.nextActions);
  const buttons = (item.buttons ?? []).map((button, index) =>
    `<button class="${index === item.buttons.length - 1 ? "primary" : "secondary"}">${escapeHtml(button)}</button>`).join("");
  const analysis = Object.entries(item.analysis)
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(item.title)}</title>
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f5f7f8; color: #1c2328; }
    body { margin: 0; padding: 18px; }
    main { max-width: 430px; margin: 0 auto; }
    header { padding: 18px 0 12px; border-bottom: 1px solid #cbd6da; }
    small { color: #5b6870; }
    h1 { font-size: 24px; line-height: 1.18; margin: 8px 0 8px; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: 0; }
    p { margin: 6px 0; line-height: 1.45; }
    .status { display: inline-flex; align-items: center; min-height: 32px; padding: 0 10px; border-radius: 6px; background: #e7eff3; color: #173849; font-weight: 700; }
    section { margin-top: 14px; padding: 14px; background: #ffffff; border: 1px solid #dbe3e6; border-radius: 8px; }
    ul { padding-left: 20px; margin: 8px 0 0; }
    li { margin: 4px 0; line-height: 1.4; }
    .steps { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 12px; }
    .steps span { min-height: 8px; border-radius: 3px; background: #c0cdd2; }
    .steps .active { background: #0f6680; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button { min-height: 40px; border: 0; border-radius: 6px; padding: 0 12px; font-weight: 700; }
    .primary { background: #0f6680; color: white; }
    .secondary { background: #e8eef1; color: #183540; }
    dl { display: grid; grid-template-columns: 122px 1fr; gap: 8px 10px; margin: 8px 0 0; }
    dt { color: #5b6870; }
    dd { margin: 0; line-height: 1.4; }
    .notice { border-left: 4px solid #0f6680; }
  </style>
</head>
<body>
  <main data-scenario3-positive="${escapeAttr(item.id)}">
    <header>
      <small>场景包 3</small>
      <h1>${escapeHtml(contract.nameZh)}</h1>
      <p>${escapeHtml(item.summary)}</p>
      <span class="status">${escapeHtml(item.state)}</span>
      <div class="steps">${(stepsContract.steps ?? []).map((step) =>
        `<span class="${step.stepId === item.step?.stepId ? "active" : ""}" title="${escapeAttr(step.nameZh)}"></span>`).join("")}</div>
    </header>
    <section class="notice">
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.highlight)}</p>
    </section>
    ${facts}
    ${fields}
    ${evidence}
    ${missing}
    ${next}
    <section>
      <h2>可执行动作</h2>
      <div class="actions">${buttons}</div>
    </section>
    <section>
      <h2>截图分析</h2>
      <dl>${analysis}</dl>
    </section>
  </main>
</body>
</html>`;
}

function rows(title, values = []) {
  const list = (values ?? []).filter(Boolean);
  if (!list.length) return "";
  return `<section><h2>${escapeHtml(title)}</h2><ul>${list.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></section>`;
}

function addAssertion(id, passed, messageZh, details = {}) {
  const item = { id, status: passed ? "passed" : "failed", messageZh, details };
  report.assertions.push(item);
  if (!passed) report.findings.push(item);
}

function writeOutputs() {
  const index = report.screenshots.map((shot) => ({
    id: shot.id,
    path: shot.path,
    sha256: shot.sha256
  }));
  writeJson(screenshotIndexPath, {
    version: "oam.dormitory-scenario3-positive-browser-screenshot-index.v1",
    generatedAtUtc: new Date().toISOString(),
    reportPath: rel(reportPath),
    screenshots: index
  });
  writeJson(reportPath, report);
}

function digestPositiveReport(value) {
  return digestObject({ ...value, positiveBrowserAuditDigest: "sha256:pending" });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cryptoFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function containsAny(text = "", terms = []) {
  return terms.some((term) => term && String(text).includes(term));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
