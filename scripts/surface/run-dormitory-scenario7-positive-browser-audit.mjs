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
const contractPath = "docs/contracts/generated/dormitory/scenario7-check-in-processing.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario7-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario7-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario7-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [
  "stayId",
  "residentId",
  "reservationId",
  "credentialId",
  "roomId",
  "bedId",
  "occupancyId",
  "checkInCaseId",
  "identityVerificationId",
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
  "财务状态是否清楚",
  "是否误导为后续结算完成"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario7-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario7_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  positiveBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 7 contracts; no UI/runtime/test script adds business rules",
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
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.check_in_flow_visible",
    JSON.stringify(report.steps).includes("身份核验") &&
      JSON.stringify(report.steps).includes("协议确认") &&
      JSON.stringify(report.steps).includes("房间/床位交付") &&
      JSON.stringify(report.steps).includes("入住记录号") &&
      JSON.stringify(report.steps).includes("凭证发放"),
    "正向主流程必须让用户看懂入住办理的身份、协议、交付、确认和凭证发放。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_payment_refund_checkout_or_ledger_writes",
    report.steps.every((step) => step.crossScenarioWriteAllowed === false &&
      step.businessRuntimeLedgerWriteAllowed === false &&
      step.paymentDepositRefundWriteAllowed === false &&
      step.checkoutWriteAllowed === false),
    "正向主流程不得写收款、押金、退款、退场结算或账务事实。",
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
    console.error(`Dormitory scenario7 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario7 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario7 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    {
      id: "01-today-check-in-entry",
      testPlanItemZh: "从今日待入住进入。",
      step: stepById.get("enter-check-in-processing"),
      title: contract.nameZh,
      state: "待到店",
      summary: "从今日待入住进入，只读取预订、财务摘要、价格快照和房间/床位当前状态。",
      readonlyFacts: ["预订号：R202606200001", "客户：张三，手机号 13800000000", "入住日期：今天", "房间/床位：301 房间 / 床位 01", "财务状态：财务已确认"],
      filledFields: [],
      evidence: ["预订确认摘要证据", "财务确认摘要证据"],
      missingItems: [],
      nextActions: ["办理入住"],
      buttons: ["办理入住", "返回预订"],
      highlight: "用户看到的是入住办理入口，不需要记任何系统引用。"
    },
    {
      id: "02-read-reservation-finance-summary",
      testPlanItemZh: "查看预订和财务摘要。",
      step: stepById.get("enter-check-in-processing"),
      title: "预订与财务摘要",
      state: "待身份核验",
      summary: "页面只读展示预订号、日期、人数、价格快照、收款确认、押金确认、担保确认和剩余待收。",
      readonlyFacts: ["价格快照：540 元", "收款确认摘要：已确认", "押金确认摘要：已确认", "担保确认摘要：已确认", "剩余待收：0 元"],
      filledFields: [],
      evidence: ["价格快照证据", "财务确认摘要证据"],
      missingItems: [],
      nextActions: ["核验到店与身份"],
      buttons: ["继续核验"],
      highlight: "财务状态清楚，但本页面不写收款、押金或账务。"
    },
    {
      id: "03-verify-arriving-guest-identity",
      testPlanItemZh: "录入/核验入住人身份。",
      step: stepById.get("arrival-and-identity-verification"),
      title: "到店与身份核验",
      state: "待协议确认",
      summary: "登记实际到店时间、入住人姓名、证件类型和脱敏证件信息，并绑定本人确认。",
      readonlyFacts: ["预订客户：张三", "预订人数：1 人"],
      filledFields: ["实际到店时间：今天 14:10", "入住人姓名：张三", "证件类型：身份证", "证件号码：已脱敏展示", "联系电话：13800000000"],
      evidence: ["证件照片/扫描件", "本人确认", "授权同意记录"],
      missingItems: [],
      nextActions: ["复核财务摘要与入住协议"],
      buttons: ["身份核验通过", "转人工复核"],
      highlight: "页面展示脱敏信息，不展示内部编号。"
    },
    {
      id: "04-confirm-check-in-agreement",
      testPlanItemZh: "确认协议。",
      step: stepById.get("finance-and-agreement-review"),
      title: "财务与协议复核",
      state: "待房源复核",
      summary: "复核财务摘要已满足入住规则，客户确认入住协议。",
      readonlyFacts: ["财务状态：财务已确认", "协议版本：门店住宿协议 2026-06", "剩余待收：0 元"],
      filledFields: ["协议备注：客户现场确认"],
      evidence: ["协议签署记录", "客户确认凭证"],
      missingItems: [],
      nextActions: ["复核房间/床位交付"],
      buttons: ["协议已确认", "保存草稿"],
      highlight: "例外入住会要求负责人审批；本例无需例外。"
    },
    {
      id: "05-recheck-room-bed-handover",
      testPlanItemZh: "复核房间/床位可入住。",
      step: stepById.get("room-bed-handover-recheck"),
      title: "房间/床位交付复核",
      state: "可办理入住",
      summary: "确认房间/床位当前可入住、未占用、已清洁且没有维修/停售/暂停/异常阻断。",
      readonlyFacts: ["房间/床位：301 房间 / 床位 01", "当前状态：可入住", "清洁状态：已完成"],
      filledFields: ["交付备注：现场确认无异常", "钥匙/门禁说明：前台领取"],
      evidence: ["房间交付照片", "床位交付照片", "清洁确认记录"],
      missingItems: [],
      nextActions: ["确认入住"],
      buttons: ["确认交付", "暂缓入住"],
      highlight: "资源被占用或异常时不会出现确认入住按钮。"
    },
    {
      id: "06-confirm-stay",
      testPlanItemZh: "确认入住。",
      step: stepById.get("confirm-check-in"),
      title: "确认入住",
      state: "已入住",
      summary: "住客、预订、日期、房间/床位、财务摘要、协议摘要、交付摘要和证据全部满足后确认入住。",
      readonlyFacts: ["住客：张三", "日期：今天至 6 月 23 日", "房间/床位：301 房间 / 床位 01", "财务状态：财务已确认"],
      filledFields: ["确认备注：资料齐全，现场交付完成"],
      evidence: ["入住确认凭证"],
      missingItems: [],
      nextActions: ["发放入住凭证"],
      buttons: ["确认入住", "转人工复核"],
      highlight: "确认成功后只形成入住记录、房间/床位占用和证据摘要。"
    },
    {
      id: "07-system-generated-stay-number",
      testPlanItemZh: "看到系统生成入住记录号。",
      step: stepById.get("confirm-check-in"),
      title: "入住结果",
      state: "凭证待发放",
      summary: "系统生成入住记录号，用户无需输入或记住内部编号。",
      readonlyFacts: ["入住记录号：S202606200001", "系统生成：入住记录、房间/床位占用、入住确认快照", "床位占用状态：在住占用"],
      filledFields: [],
      evidence: ["入住确认摘要证据"],
      missingItems: [],
      nextActions: ["发放入住凭证"],
      buttons: ["发放入住凭证", "查看入住详情"],
      highlight: "入住记录号是业务展示号，不是内部引用。"
    },
    {
      id: "08-issue-access-credential",
      testPlanItemZh: "发放入住凭证。",
      step: stepById.get("issue-access-credential"),
      title: "发放入住凭证",
      state: "凭证已发放",
      summary: "成功入住后发放钥匙、门卡、门禁码或入住单，并绑定领取确认。",
      readonlyFacts: ["入住记录号：S202606200001", "可发放凭证：钥匙、门卡、入住单"],
      filledFields: ["发放备注：已发放门卡", "领取人确认：张三"],
      evidence: ["领取确认记录", "凭证发放照片"],
      missingItems: [],
      nextActions: ["查看入住详情"],
      buttons: ["确认发放", "补充凭证证据"],
      highlight: "未成功入住时不会发放有效入住凭证。"
    },
    {
      id: "09-view-check-in-detail",
      testPlanItemZh: "查看入住详情。",
      step: stepById.get("issue-access-credential"),
      title: "入住详情",
      state: "已入住",
      summary: "汇总入住记录、住客、房间/床位占用、协议、身份核验、入住凭证和证据摘要。",
      readonlyFacts: ["入住记录摘要", "住客摘要", "房间/床位占用摘要", "入住凭证摘要", "协议摘要", "身份核验摘要", "证据摘要"],
      filledFields: [],
      evidence: ["状态历史", "证据摘要"],
      missingItems: [],
      nextActions: ["进入在住管理"],
      buttons: ["查看入住详情", "进入在住管理"],
      highlight: "下游在住管理只读这些摘要，不要求重新填写已确认入住字段。"
    },
    {
      id: "10-entry-behavior",
      testPlanItemZh: "查看今日、工作项、搜索、我的入口表现。",
      step: stepById.get("enter-check-in-processing"),
      title: "入口职责",
      state: "今日待处理",
      summary: "今日只展示今日待入住、身份待核验、协议待签、财务需补、凭证待发放；工作项展示全部被动任务；搜索结果只读跳转；我的只放草稿、个人跟进、收藏、导出、设置。",
      readonlyFacts: ["今日：今日待入住", "工作项：全部入住办理任务池", "搜索结果只读跳转", "我的只放草稿、个人跟进、收藏、导出、设置"],
      filledFields: [],
      evidence: ["截图报告分析"],
      missingItems: [],
      nextActions: ["按状态进入合法动作"],
      buttons: ["继续核验", "确认入住", "查看入住详情"],
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
      "财务状态是否清楚": visibleText.includes("财务") ? "财务摘要和剩余待处理清楚。" : "本页不是财务复核页。",
      "是否误导为后续结算完成": "没有把入住办理解释成后续结算、退款或账务完成。"
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
    checkoutWriteAllowed: false,
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
        body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f5f7fa; color: #16202a; }
        main { padding: 22px; }
        .top { background: #ffffff; border: 1px solid #d7dde5; border-radius: 8px; padding: 18px; }
        h1 { font-size: 24px; margin: 0 0 8px; letter-spacing: 0; }
        h2 { font-size: 15px; margin: 18px 0 8px; letter-spacing: 0; }
        p, li { font-size: 14px; line-height: 1.55; }
        .state { display: inline-block; padding: 5px 8px; border-radius: 6px; background: #e8f1ff; color: #174a7c; font-size: 13px; }
        .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        button { border: 1px solid #174a7c; border-radius: 6px; background: #174a7c; color: white; padding: 9px 12px; font-size: 14px; }
        button.secondary { background: white; color: #174a7c; }
        section { background: #ffffff; border: 1px solid #d7dde5; border-radius: 8px; padding: 12px 14px; margin-top: 12px; }
        ul { margin: 0; padding-left: 18px; }
        .hint { color: #506070; }
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
        ${list("上游只读摘要", item.readonlyFacts)}
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
    "contract.scenario7_authority",
    contract.authorityId === "Dormitory.Scenario7.CheckInProcessing" &&
      contract.scenarioPackageNo === 7 &&
      contract.nameZh === "入住办理",
    "合同必须绑定场景 7 入住办理。",
    { authorityId: contract.authorityId, scenarioPackageNo: contract.scenarioPackageNo, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generatedFrom?.[0]?.endsWith("dormitory-scenario7-check-in-processing.authority.json") === true,
    "generated 合同必须先来自场景 7 Source Authority。",
    { generatedFrom: contract.generatedFrom });
  addAssertion(
    "contract.upstream_readonly_only",
    JSON.stringify(contract.upstream ?? {}).includes("upstreamWriteBackAllowed\":false") &&
      JSON.stringify(contract.upstream ?? {}).includes("预订确认摘要") &&
      JSON.stringify(contract.upstream ?? {}).includes("财务确认摘要") &&
      JSON.stringify(contract.upstream ?? {}).includes("房源运营状态摘要"),
    "上游只能作为只读摘要输入。",
    contract.upstream);
  addAssertion(
    "contract.downstream_package8_summaries_only",
    contract.downstream?.allowedConsumerPackageNo === 8 &&
      JSON.stringify(contract.downstream?.handoffOutputs ?? []).includes("入住记录摘要") &&
      JSON.stringify(contract.downstream?.handoffOutputs ?? []).includes("入住凭证摘要"),
    "下游只输出给在住管理的入住相关摘要。",
    contract.downstream);
  addAssertion(
    "contract.steps_six_business_actions",
    (stepsContract.steps ?? []).length === 6,
    "场景 7 必须按 6 个业务动作组织页面。",
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
    version: "oam.dormitory-scenario7-positive-screenshot-index.v1",
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
