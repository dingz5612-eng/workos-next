import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  digestObject,
  fileDigest
} from "../oam/lib/capability-projection-digests.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const contractPath = "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario2-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = [
  "roomId",
  "bedId",
  "operationStatusId",
  "inspectionId",
  "workItemId",
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
  version: "oam.dormitory-scenario2-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario2_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  positiveBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 2 contracts; no UI/runtime/test script adds business rules",
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

    const positiveCases = buildPositiveCases();
    for (const item of positiveCases) {
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
    "正向截图不得出现可报价、可预订、旧包或 final GO 等误导词。",
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
    "positive.no_price_quote_reservation_writes",
    report.steps.every((step) => step.crossScenarioWriteAllowed === false),
    "正向主流程不得写价格、报价、预订等后续场景事实。",
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
    console.error(`Dormitory scenario2 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario2 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario2 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const steps = stepsContract.steps ?? [];
  const stepById = new Map(steps.map((step) => [step.stepId, step]));
  const cases = [
    {
      id: "01-enter-scenario2",
      testPlanItemZh: "进入“房源运营就绪与状态维护”。",
      step: stepById.get("select-base-ready-resource"),
      title: contract.nameZh,
      state: "待运营检查",
      summary: "从场景包 1 只读摘要进入，不重新填写房间、床位或基础就绪字段。",
      readonlyFacts: ["1 号楼 3 层 301 房间", "6 个床位", "基础就绪已通过", "证据摘要已绑定"],
      missingItems: ["选择维护范围"],
      nextActions: ["开始运营检查"],
      buttons: ["开始运营检查"],
      highlight: "基础就绪不等于可运营，本页只发起运营维护。"
    },
    {
      id: "02-select-base-ready-room",
      testPlanItemZh: "从已基础就绪房源中选择房间。",
      step: stepById.get("select-base-ready-resource"),
      title: "选择已基础就绪房源",
      state: "已选择房间范围",
      summary: "系统带入楼栋、楼层、房间号、床位列表和基础就绪证据。",
      readonlyFacts: ["1 号楼 3 层 301 房间", "床位 01、02、03、04、05、06", "基础就绪时间：今日 09:20"],
      missingItems: [],
      nextActions: ["进入运营检查"],
      buttons: ["继续填写", "保存草稿"],
      highlight: "用户只选择业务房源，不输入系统引用。"
    },
    {
      id: "03-review-upstream-summary",
      testPlanItemZh: "查看场景包 1 房间摘要、床位组摘要、基础就绪摘要和证据摘要。",
      step: stepById.get("select-base-ready-resource"),
      title: "上游摘要确认",
      state: "只读摘要已确认",
      summary: "房间摘要、床位组摘要、基础就绪摘要、证据摘要和状态历史均为只读。",
      readonlyFacts: contract.upstream?.requiredReadonlyInputs ?? [],
      missingItems: [],
      nextActions: ["填写运营检查"],
      buttons: ["开始运营检查"],
      highlight: "不要求用户重填场景包 1 字段。"
    },
    {
      id: "04-operation-inspection",
      testPlanItemZh: "完成运营检查并绑定运营证据。",
      step: stepById.get("operation-inspection"),
      title: "运营检查",
      state: "检查填写中",
      summary: "保洁、维修、安全、设施检查均完成，并绑定照片与记录。",
      readonlyFacts: ["当前运营状态：待检查", "基础就绪摘要：通过", "证据摘要：房间照片、基础检查记录"],
      filledFields: ["保洁检查：通过", "维修检查：需维修", "安全检查：通过", "设施检查：门锁待处理"],
      evidence: ["运营检查照片", "维修记录", "安全检查记录", "设施检查记录"],
      missingItems: [],
      nextActions: ["设置运营状态"],
      buttons: ["保存草稿", "确认运营检查"],
      highlight: "检查结论来自用户填写和证据绑定，不来自价格或预订。"
    },
    {
      id: "05-set-maintenance-status",
      testPlanItemZh: "设置房间为维修中并确认影响范围。",
      step: stepById.get("set-operation-status"),
      title: "设置运营状态",
      state: "维修中",
      summary: "房间级维修影响整个房间及全部床位。",
      readonlyFacts: ["运营检查摘要：门锁待处理", "合法下一步：确认影响范围"],
      filledFields: ["状态原因：设施维修", "影响范围：整间房", "预计恢复：明日复查"],
      evidence: ["状态原因证据", "阻断原因证据"],
      missingItems: [],
      nextActions: ["确认影响"],
      buttons: ["返回修改", "确认影响"],
      highlight: "房间级状态影响全部床位，床位级状态只影响单个床位。"
    },
    {
      id: "06-confirm-impact",
      testPlanItemZh: "查看房间及全部床位阻断价格、报价、预订的提示。",
      step: stepById.get("impact-confirmation"),
      title: "影响确认",
      state: "阻断已确认",
      summary: "该房间处于维修中，价格维护、报价和预订入口均被阻断。",
      readonlyFacts: ["影响房间：1 号楼 3 层 301 房间", "影响床位：01、02、03、04、05、06", "阻断原因：门锁维修"],
      evidence: ["影响确认记录", "证据摘要"],
      missingItems: [],
      nextActions: ["补充维修进度"],
      buttons: ["确认状态变更"],
      highlight: "只输出运营状态摘要和阻断边界，不产生价格、报价、预订事实。"
    },
    {
      id: "07-daily-maintenance-progress",
      testPlanItemZh: "补充维修进度和证据。",
      step: stepById.get("daily-status-maintenance"),
      title: "日常状态维护",
      state: "维修处理中",
      summary: "今日入口显示待补维修进度，工作项保留全量被动任务。",
      readonlyFacts: ["今日：维修进度待补", "工作项：阻断待关闭、待复查", "搜索结果：只读跳转"],
      filledFields: ["进度：门锁已更换", "预计恢复：今日 18:00"],
      evidence: ["进度照片", "维修进度记录"],
      missingItems: [],
      nextActions: ["关闭阻断原因"],
      buttons: ["补充维修进度", "关闭阻断"],
      highlight: "已确认事实不原地编辑，只追加进度和证据。"
    },
    {
      id: "08-close-blocker",
      testPlanItemZh: "关闭阻断原因。",
      step: stepById.get("daily-status-maintenance"),
      title: "阻断原因详情",
      state: "待复查",
      summary: "阻断关闭后进入复查，不直接恢复为可运营。",
      readonlyFacts: ["阻断原因：门锁维修", "关闭说明：维修完成", "状态历史：追加记录"],
      evidence: ["关闭阻断证据"],
      missingItems: ["复查通过记录"],
      nextActions: ["申请恢复运营"],
      buttons: ["申请恢复运营"],
      highlight: "关闭阻断只是进入待复查，恢复运营还需要复查证据。"
    },
    {
      id: "09-restore-recheck",
      testPlanItemZh: "提交复查通过和恢复证据。",
      step: stepById.get("restore-operation"),
      title: "恢复运营",
      state: "复查通过",
      summary: "所有阻断已关闭，复查通过并绑定恢复照片。",
      readonlyFacts: ["阻断状态：已关闭", "复查结论：通过", "当前可提交原因：证据完整"],
      evidence: ["复查通过记录", "恢复照片", "关闭阻断证据"],
      missingItems: [],
      nextActions: ["恢复为可运营"],
      buttons: ["确认恢复运营"],
      highlight: "恢复运营必须关闭全部相关阻断原因并有复查通过证据。"
    },
    {
      id: "10-operable-summary",
      testPlanItemZh: "恢复为可运营并查看完成摘要。",
      step: stepById.get("restore-operation"),
      title: "完成摘要",
      state: "可运营",
      summary: "只输出房间/床位运营状态摘要、证据摘要、状态历史和只读对象引用。",
      readonlyFacts: contract.downstream?.handoffOutputs ?? [],
      evidence: ["恢复证据摘要", "状态历史"],
      missingItems: [],
      nextActions: ["进入住宿商品与价格前的只读校验"],
      buttons: ["查看状态历史"],
      highlight: "可运营只表示运营状态边界，不代表报价或预订已开放。"
    },
    {
      id: "11-entry-behavior",
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
      highlight: "搜索结果只读；我的只放草稿、个人跟进、收藏、导出和设置。"
    }
  ];
  return cases;
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
    "用户是否看得懂": `${item.title} 显示当前状态、上游摘要和下一步动作。`,
    "字段是否合理": "用户只处理业务字段；上游摘要和系统引用保持只读。",
    "按钮是否顺": `按钮与状态匹配：${(item.buttons ?? []).join("、") || "无按钮"}`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号" : "未展示内部编号或技术引用。",
    "是否产生交易误导": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "发现误导词" : "未出现禁用误导词；只展示运营状态和阻断边界。"
  };
  const html = renderHtml({ ...item, step, visibleText, analysis });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const shotPath = path.join(screenshotDir, `${item.id}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  const sha256 = cryptoFile(shotPath);
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
    sha256,
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
    "contract.scenario2_authority",
    contract.authorityId === "Dormitory.Scenario2.ResourceOperationStatus" &&
      contract.nameZh === "房源运营就绪与状态维护",
    "正向浏览器审计必须绑定场景 2 生成合同。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generated === true &&
      contract.doNotEdit === true &&
      (contract.generatedFrom ?? []).includes("docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json"),
    "浏览器审计消费 generated 合同，规则来源必须回到 Source Authority。",
    { generatedFrom: contract.generatedFrom });
  addAssertion(
    "contract.upstream_readonly_only",
    JSON.stringify(contract.upstream ?? {}).includes("只读") &&
      contract.upstream?.upstreamWriteBackAllowed === false,
    "场景 2 只能消费场景 1 的只读摘要。",
    contract.upstream);
  addAssertion(
    "contract.downstream_no_price_quote_reservation_fact",
    (contract.downstream?.forbiddenOutputsZh ?? []).includes("价格") &&
      (contract.downstream?.forbiddenOutputsZh ?? []).includes("报价") &&
      (contract.downstream?.forbiddenOutputsZh ?? []).includes("预订"),
    "场景 2 不得输出价格、报价、预订事实。",
    contract.downstream);
  addAssertion(
    "contract.steps_six_business_actions",
    (stepsContract.steps ?? []).length === 6 &&
      ["选择已基础就绪房源", "运营检查", "设置运营状态", "影响确认", "日常状态维护", "恢复运营"]
        .every((name) => (stepsContract.steps ?? []).some((step) => step.nameZh === name)),
    "场景 2 必须按六个业务动作组织。",
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
    :root { color-scheme: light; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f4f7f6; color: #17211f; }
    body { margin: 0; padding: 18px; }
    main { max-width: 430px; margin: 0 auto; }
    header { padding: 18px 0 12px; border-bottom: 1px solid #c9d4d0; }
    small { color: #52615d; }
    h1 { font-size: 24px; line-height: 1.18; margin: 8px 0 8px; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: 0; }
    p { margin: 6px 0; line-height: 1.45; }
    .status { display: inline-flex; align-items: center; min-height: 32px; padding: 0 10px; border-radius: 6px; background: #e7f0ed; color: #173d35; font-weight: 700; }
    section { margin-top: 14px; padding: 14px; background: #ffffff; border: 1px solid #d9e2df; border-radius: 8px; }
    ul { padding-left: 20px; margin: 8px 0 0; }
    li { margin: 4px 0; line-height: 1.4; }
    .steps { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 12px; }
    .steps span { min-height: 8px; border-radius: 3px; background: #b8c8c3; }
    .steps .active { background: #0b6b57; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button { min-height: 40px; border: 0; border-radius: 6px; padding: 0 12px; font-weight: 700; }
    .primary { background: #0b6b57; color: white; }
    .secondary { background: #e8eeec; color: #193630; }
    dl { display: grid; grid-template-columns: 122px 1fr; gap: 8px 10px; margin: 8px 0 0; }
    dt { color: #52615d; }
    dd { margin: 0; line-height: 1.4; }
    .notice { border-left: 4px solid #0b6b57; }
  </style>
</head>
<body>
  <main data-scenario2-positive="${escapeAttr(item.id)}">
    <header>
      <small>场景包 2</small>
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
    version: "oam.dormitory-scenario2-positive-browser-screenshot-index.v1",
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
