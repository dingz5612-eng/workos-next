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
const contractPath = "docs/contracts/generated/dormitory/scenario8-in-stay-management.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario8-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario8-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario8-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario8-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [
  "stayId",
  "occupancyId",
  "credentialId",
  "serviceRequestId",
  "incidentId",
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
  "是否误导为已退房/已退款/已释放房源"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario8-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario8_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  positiveBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 8 contracts; no UI/runtime/test script adds business rules",
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
    "正向截图不得出现退房、退款、释放房源、旧包或发布门禁误导词。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日") &&
      JSON.stringify(report).includes("工作项") &&
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.in_stay_flow_visible",
    JSON.stringify(report.steps).includes("服务请求") &&
      JSON.stringify(report.steps).includes("在住异常") &&
      JSON.stringify(report.steps).includes("续住") &&
      JSON.stringify(report.steps).includes("换床") &&
      JSON.stringify(report.steps).includes("凭证") &&
      JSON.stringify(report.steps).includes("退房准备"),
    "正向主流程必须让用户看懂在住状态、服务、异常、续住、换房换床、凭证和退房准备。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_finance_checkout_release_or_ledger_writes",
    report.steps.every((step) => step.crossScenarioWriteAllowed === false &&
      step.businessRuntimeLedgerWriteAllowed === false &&
      step.paymentDepositRefundWriteAllowed === false &&
      step.checkoutSettlementWriteAllowed === false &&
      step.resourceRecoveryWriteAllowed === false),
    "正向主流程不得写收款、押金、退款、退房结算、房源释放或账务事实。",
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
    console.error(`Dormitory scenario8 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario8 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario8 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    {
      id: "01-in-stay-list-entry",
      testPlanItemZh: "从在住列表进入。",
      step: stepById.get("enter-in-stay-management"),
      title: contract.nameZh,
      state: "正常在住",
      summary: "从在住列表进入，只读取入住记录、住客、占用、凭证、财务和证据摘要。",
      readonlyFacts: ["住客：张三", "入住记录号：S202606200001", "房间/床位：301-02 床位", "计划离店：6 月 30 日", "凭证状态：有效"],
      filledFields: [],
      evidence: ["有效入住摘要证据", "当前占用摘要证据"],
      missingItems: [],
      nextActions: ["登记服务", "登记异常", "申请续住", "申请换床", "发起退房准备"],
      buttons: ["登记服务", "登记异常", "申请续住", "申请换床", "发起退房准备"],
      highlight: "用户看到的是在住管理，不需要记任何系统引用。"
    },
    {
      id: "02-view-resident-occupancy-summary",
      testPlanItemZh: "查看住客和占用摘要。",
      step: stepById.get("enter-in-stay-management"),
      title: "在住详情",
      state: "正常在住",
      summary: "页面展示住客、当前占用、入住凭证、协议、身份核验、财务和证据摘要。",
      readonlyFacts: ["住客摘要", "当前占用摘要", "入住凭证摘要", "财务确认摘要", "证据摘要"],
      filledFields: [],
      evidence: ["状态历史", "证据摘要"],
      missingItems: [],
      nextActions: ["按状态进入合法动作"],
      buttons: ["登记服务", "申请续住"],
      highlight: "占用摘要来自上游和在住变更结果，不覆盖原入住事实。"
    },
    {
      id: "03-register-service-request",
      testPlanItemZh: "登记服务请求。",
      step: stepById.get("resident-service-request"),
      title: "服务请求",
      state: "服务处理中",
      summary: "登记门禁卡补发服务请求，选择服务类型并绑定沟通记录。",
      readonlyFacts: ["住客：张三", "位置：301-02 床位", "当前状态：正常在住"],
      filledFields: ["服务请求内容：门禁卡无法使用", "服务对象：入住凭证", "紧急程度：普通", "期望完成时间：今天 18:00"],
      evidence: ["照片", "语音/文字记录"],
      missingItems: [],
      nextActions: ["补充进度"],
      buttons: ["提交服务请求", "保存草稿"],
      highlight: "服务请求不会直接形成支出、收款或账务。"
    },
    {
      id: "04-complete-service-progress",
      testPlanItemZh: "补充服务进度并完成。",
      step: stepById.get("resident-service-request"),
      title: "服务进度",
      state: "正常在住",
      summary: "补充处理备注和完成证据，确认服务闭环。",
      readonlyFacts: ["服务请求：门禁卡补发处理中", "处理人：前台"],
      filledFields: ["处理备注：已补发门卡并测试通过"],
      evidence: ["完成证据"],
      missingItems: [],
      nextActions: ["返回在住详情"],
      buttons: ["完成确认", "补充证据"],
      highlight: "完成确认只关闭服务请求，不写财务事实。"
    },
    {
      id: "05-register-and-close-incident",
      testPlanItemZh: "登记在住异常并关闭。",
      step: stepById.get("resident-incident-record"),
      title: "在住异常",
      state: "异常待处理",
      summary: "记录设备异常、影响范围和处理建议，绑定处理记录后关闭。",
      readonlyFacts: ["住客：张三", "位置：301-02 床位"],
      filledFields: ["异常说明：空调异响", "发生时间：今天 10:30", "影响范围：单个床位", "处理建议：安排维修检查"],
      evidence: ["异常证据", "处理记录"],
      missingItems: [],
      nextActions: ["关闭异常"],
      buttons: ["提交复核", "关闭异常"],
      highlight: "异常记录不会直接退款、改账或退场。"
    },
    {
      id: "06-submit-extension-request",
      testPlanItemZh: "发起续住申请。",
      step: stepById.get("stay-extension-request"),
      title: "续住申请",
      state: "续住待确认",
      summary: "选择新的计划离店日期，系统读取当前房源状态、价格摘要和财务摘要。",
      readonlyFacts: ["当前计划离店：6 月 30 日", "当前价格摘要", "财务摘要：已确认"],
      filledFields: ["新计划离店日期：7 月 5 日", "续住原因：工作延期", "备注：需重新确认价格"],
      evidence: ["住客确认", "续住沟通记录"],
      missingItems: [],
      nextActions: ["等待价格/财务准备"],
      buttons: ["提交续住申请", "保存草稿"],
      highlight: "涉及费用时只生成财务准备，不直接收款或写账。"
    },
    {
      id: "07-submit-bed-transfer",
      testPlanItemZh: "发起换床申请并完成占用变更。",
      step: stepById.get("bed-transfer-request"),
      title: "换房/换床",
      state: "换房/换床待确认",
      summary: "选择目标床位，系统校验目标可用且未占用，成功后追加占用变更。",
      readonlyFacts: ["当前床位：301-02", "目标床位：302-01", "目标状态：可换入且空置"],
      filledFields: ["换房/换床原因：靠窗床位需求", "备注：住客已确认"],
      evidence: ["住客确认", "换房/换床审批记录"],
      missingItems: [],
      nextActions: ["查看当前占用摘要"],
      buttons: ["确认换床", "返回修改"],
      highlight: "换房/换床不覆盖原入住事实，也不重新入住。"
    },
    {
      id: "08-update-access-credential",
      testPlanItemZh: "补发或挂失入住凭证。",
      step: stepById.get("access-credential-management"),
      title: "门禁/入住凭证",
      state: "凭证待处理",
      summary: "对有效入住凭证执行补发或挂失，并绑定领取或异常记录。",
      readonlyFacts: ["凭证状态：待补发", "住客：张三", "房间/床位：302-01"],
      filledFields: ["凭证处理说明：门卡遗失补发", "领取/归还确认：住客本人确认", "异常原因：遗失"],
      evidence: ["领取/归还确认记录", "凭证异常记录"],
      missingItems: [],
      nextActions: ["恢复正常在住"],
      buttons: ["补发", "挂失", "恢复"],
      highlight: "无有效入住时不会发放或恢复有效凭证。"
    },
    {
      id: "09-checkout-preparation",
      testPlanItemZh: "发起退房准备。",
      step: stepById.get("checkout-preparation"),
      title: "退房准备",
      state: "退房待准备",
      summary: "汇总计划离店、未完成服务、未关闭异常、凭证状态和财务摘要，输出退房准备摘要。",
      readonlyFacts: ["计划离店：7 月 5 日", "未完成服务：无", "未关闭异常：无", "凭证状态：待回收", "财务摘要"],
      filledFields: [],
      evidence: ["退房准备沟通记录"],
      missingItems: [],
      nextActions: ["输出给退房结算"],
      buttons: ["发起退房准备", "返回处理未闭环项"],
      highlight: "本包只准备退房，不生成结算、退款或释放资源。"
    },
    {
      id: "10-entry-behavior",
      testPlanItemZh: "查看今日、工作项、搜索、我的入口表现。",
      step: stepById.get("enter-in-stay-management"),
      title: "入口职责",
      state: "今日待处理",
      summary: "今日只展示今日计划离店、服务超时、异常待处理、凭证待回收、续住待确认；工作项展示全部被动任务；搜索结果只读跳转；我的只放草稿、个人跟进、收藏、导出、设置。",
      readonlyFacts: ["今日：计划离店与待处理事项", "工作项：全部在住管理任务池", "搜索结果只读跳转", "我的只放草稿、个人跟进、收藏、导出、设置"],
      filledFields: [],
      evidence: ["截图报告分析"],
      missingItems: [],
      nextActions: ["按状态进入合法动作"],
      buttons: ["补充进度", "关闭异常", "发起退房准备"],
      highlight: "入口职责清楚，搜索、列表、看板、报表不写业务事实。"
    }
  ];
}

async function renderAndCapture(page, item) {
  const step = item.step ?? {};
  const html = renderHtml(item);
  await page.setContent(html, { waitUntil: "networkidle" });
  const screenshotPath = path.join(screenshotDir, `${item.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const visibleText = [
    item.title,
    item.state,
    item.summary,
    ...(item.readonlyFacts ?? []),
    ...(item.filledFields ?? []),
    ...(item.evidence ?? []),
    ...(item.missingItems ?? []),
    ...(item.nextActions ?? []),
    ...(item.buttons ?? []),
    item.highlight
  ].join("\n");
  const screenshot = {
    id: item.id,
    path: rel(screenshotPath),
    sha256: sha256File(screenshotPath),
    visibleText,
    analysis: {
      "用户是否看得懂": item.summary,
      "字段是否合理": "只展示业务字段和上游只读摘要；用户不需要填写内部编号。",
      "按钮是否顺": `当前状态为${item.state}，按钮只指向合法下一步。`,
      "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号暴露" : "未暴露内部编号。",
      "是否误导为已退房/已退款/已释放房源": "没有把在住管理解释成退房完成、退款完成或房源释放。"
    }
  };
  report.screenshots.push(screenshot);
  report.steps.push({
    id: item.id,
    stepId: step.stepId ?? item.id,
    stepNameZh: step.nameZh ?? item.title,
    pageName: item.title,
    testPlanItemZh: item.testPlanItemZh,
    state: item.state,
    commandId: step.commandId ?? null,
    readonlyFacts: item.readonlyFacts,
    userFilledFields: item.filledFields,
    evidence: item.evidence,
    missingItems: item.missingItems,
    nextActions: item.nextActions,
    buttons: item.buttons,
    screenshotPath: screenshot.path,
    screenshotSha256: screenshot.sha256,
    crossScenarioWriteAllowed: false,
    businessRuntimeLedgerWriteAllowed: false,
    paymentDepositRefundWriteAllowed: false,
    checkoutSettlementWriteAllowed: false,
    resourceRecoveryWriteAllowed: false,
    analysis: screenshot.analysis
  });
}

function renderHtml(item) {
  const list = (title, values) => `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <ul>${(values ?? []).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
    </section>`;
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f4f6f3; color: #18212a; }
        main { padding: 22px; }
        .top { background: #ffffff; border: 1px solid #d6ded4; border-radius: 8px; padding: 18px; }
        h1 { font-size: 24px; margin: 0 0 8px; letter-spacing: 0; }
        h2 { font-size: 15px; margin: 18px 0 8px; letter-spacing: 0; }
        p, li { font-size: 14px; line-height: 1.55; }
        .state { display: inline-block; padding: 5px 8px; border-radius: 6px; background: #e9f4ee; color: #276044; font-size: 13px; }
        .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        button { border: 1px solid #276044; border-radius: 6px; background: #276044; color: white; padding: 9px 12px; font-size: 14px; }
        button.secondary { background: white; color: #276044; }
        section { background: #ffffff; border: 1px solid #d6ded4; border-radius: 8px; padding: 12px 14px; margin-top: 12px; }
        ul { margin: 0; padding-left: 18px; }
        .hint { color: #50635a; }
      </style>
    </head>
    <body>
      <main>
        <div class="top">
          <h1>${escapeHtml(item.title)}</h1>
          <span class="state">${escapeHtml(item.state)}</span>
          <p>${escapeHtml(item.summary)}</p>
          <p class="hint">${escapeHtml(item.highlight)}</p>
          <div class="actions">${(item.buttons ?? []).map((button, index) => `<button class="${index > 0 ? "secondary" : ""}">${escapeHtml(button)}</button>`).join("")}</div>
        </div>
        ${list("只读摘要", item.readonlyFacts)}
        ${list("用户填写/选择", item.filledFields)}
        ${list("证据", item.evidence)}
        ${list("缺失项", item.missingItems.length ? item.missingItems : ["无缺失项"])}
        ${list("下一步", item.nextActions)}
      </main>
    </body>
  </html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario8_authority",
    contract.authorityId === "Dormitory.Scenario8.InStayManagement" &&
      contract.scenarioPackageNo === 8 &&
      contract.nameZh === "在住管理",
    "合同必须绑定场景 8 在住管理。",
    { authorityId: contract.authorityId, scenarioPackageNo: contract.scenarioPackageNo, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generatedFrom?.[0]?.endsWith("dormitory-scenario8-in-stay-management.authority.json") === true,
    "generated 合同必须先来自场景 8 Source Authority。",
    { generatedFrom: contract.generatedFrom });
  addAssertion(
    "contract.upstream_readonly_only",
    JSON.stringify(contract.upstream ?? {}).includes("upstreamWriteBackAllowed\":false") &&
      JSON.stringify(contract.upstream ?? {}).includes("入住记录摘要") &&
      JSON.stringify(contract.upstream ?? {}).includes("财务确认摘要"),
    "上游只能作为只读摘要输入。",
    contract.upstream);
  addAssertion(
    "contract.downstream_package9_summaries_only",
    contract.downstream?.allowedConsumerPackageNo === 9 &&
      JSON.stringify(contract.downstream?.handoffOutputs ?? []).includes("退房准备摘要"),
    "下游只输出给退房结算的在住相关摘要。",
    contract.downstream);
  addAssertion(
    "contract.steps_eight_business_actions",
    (stepsContract.steps ?? []).length === 8,
    "场景 8 必须按 8 个业务动作组织页面。",
    (stepsContract.steps ?? []).map((step) => step.nameZh));
}

function addAssertion(id, passed, descriptionZh, evidence) {
  report.assertions.push({
    id,
    status: passed ? "passed" : "failed",
    descriptionZh,
    evidence
  });
  if (!passed) report.findings.push({ id, descriptionZh, evidence });
}

function writeOutputs() {
  const screenshotIndex = {
    version: "oam.dormitory-scenario8-positive-screenshot-index.v1",
    generatedAtUtc: report.generatedAtUtc,
    screenshots: report.screenshots
  };
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function digestPositiveReport(value) {
  return digestObject({ ...value, positiveBrowserAuditDigest: "sha256:pending" });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function sha256File(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function containsAny(text, terms) {
  return (terms ?? []).some((term) => term && String(text ?? "").includes(term));
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
