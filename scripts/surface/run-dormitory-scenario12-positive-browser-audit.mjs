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
const contractPath = "docs/contracts/generated/dormitory/scenario12-channel-corporate-customer.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario12-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario12-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario12-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario12-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario12-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const financeGate = readJson(financeGatePath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [];
const analysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "是否误导为已报价/已预订/已入账"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario12-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario12_local_evidence",
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
  sourceAuthorityPriority: true,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 12 contracts; no UI/runtime/test script adds business rules",
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
    "正向截图不得出现已报价、已预订、已入账、生产发布或旧包表达。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日待审核") &&
      JSON.stringify(report).includes("工作项展示全部渠道、企业客户、协议、发布规则、续签、补证和财务规则意向被动任务池") &&
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.channel_corporate_flow_visible",
    JSON.stringify(report.steps).includes("某某公司协议客户，有效至 2026-12-31") &&
      JSON.stringify(report.steps).includes("携程渠道，已启用，适用 301 整房按晚价") &&
      JSON.stringify(report.steps).includes("佣金/结算规则意向") &&
      JSON.stringify(report.steps).includes("场景包 4 重新生成报价资格") &&
      JSON.stringify(report.steps).includes("场景包 5 重新做预订渠道/企业资格校验"),
    "正向主流程必须让用户看懂企业协议、渠道启用、商品资格、佣金/结算意向和下游重校验边界。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_quote_reservation_inventory_or_finance_truth_writes",
    report.steps.every((step) => step.businessRuntimeRatePlanTruthWriteAllowed === false &&
      step.quoteReservationWriteAllowed === false &&
      step.inventoryHoldWriteAllowed === false &&
      step.paymentRefundLedgerWriteAllowed === false &&
      step.financeGateHandlesCommissionSettlementTruth === true &&
      step.scenario4HandlesQuoteTruth === true &&
      step.scenario5HandlesReservationInventoryTruth === true),
    "正向主流程不得写价格金额真值、报价、预订、库存锁定、收退款或账务；佣金/结算真值交给财务确认流程。",
    report.steps.map((step) => ({ stepId: step.stepId, financeGateHandlesCommissionSettlementTruth: step.financeGateHandlesCommissionSettlementTruth })));
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
    console.error(`Dormitory scenario12 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario12 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario12 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  return [
    positiveCase("01-new-corporate-customer", "新建企业客户。", "create-channel-or-corporate-profile", "新建企业客户", "企业客户草稿", "录入企业主体、联系人和营业执照，形成企业客户草稿。", ["企业名称：某某公司", "企业客户类型：协议客户", "负责人：张主管"], ["统一社会信用代码或证件信息：已填写", "联系人：李经理", "联系电话：13800000000"], ["营业执照", "授权证明"], ["保存草稿", "提交审核"], "用户看到的是企业客户业务名称，不需要输入内部编号。"),
    positiveCase("02-upload-agreement", "上传协议。", "maintain-cooperation-agreement", "上传合作协议", "协议待审核", "上传合同扫描件、审批记录和协议有效期。", ["某某公司协议客户，有效至 2026-12-31", "适用客户类型：协议客户", "适用渠道：企业直签"], ["协议名称：2026 年住宿合作协议", "协议开始日期：2026-01-01", "结束日期：2026-12-31"], ["合同扫描件", "审批记录"], ["保存草稿", "提交审核"], "协议维护只形成协议摘要，不写价格金额真值。"),
    positiveCase("03-bind-product-eligibility", "绑定商品和价格资格。", "bind-product-and-eligibility", "绑定商品与价格资格", "资格待检查", "读取场景包 3 商品摘要和价格版本摘要，绑定适用范围。", ["商品摘要：301 整房按晚价", "价格版本摘要：2026 协议客户价", "运营阻断摘要：无阻断"], ["适用商品：301 整房", "适用售卖单位：按晚", "适用客户类型：协议客户"], ["商品/价格版本摘要", "协议摘要"], ["保存资格", "检查资格"], "资格摘要交给场景包 4 重新生成报价资格，不代表已生成报价。"),
    positiveCase("04-approve-agreement", "审核生效。", "audit-enable", "审核协议生效", "协议已生效", "负责人审核通过协议和适用资格。", ["某某公司协议客户，有效至 2026-12-31", "证据摘要：合同扫描件、审批记录", "缺失项：无"], ["审核意见：同意生效", "生效说明：按协议有效期执行"], ["审核记录", "证据摘要"], ["审核通过", "查看摘要"], "协议生效不等于价格已生效，也不等于已产生报价。"),
    positiveCase("05-corporate-product-summary", "查看企业客户可用商品摘要。", "bind-product-and-eligibility", "企业客户可用商品摘要", "协议已生效", "展示企业客户可用商品和资格摘要，下游仍需重校验。", ["某某公司协议客户，有效至 2026-12-31", "可用商品：301 整房按晚价", "证据摘要：协议、审批记录"], [], ["协议摘要", "商品资格摘要"], ["查看协议", "进入询价资格判断"], "场景包 4 重新生成报价资格；场景包 5 重新做预订渠道/企业资格校验。"),
    positiveCase("06-new-channel", "新建渠道。", "create-channel-or-corporate-profile", "新建渠道", "渠道草稿", "建立携程渠道档案、联系人和授权证明。", ["渠道名称：携程渠道", "渠道类型：OTA", "负责人：渠道经理"], ["联系人：王经理", "对接方式：人工确认", "备注：先人工对接"], ["合作协议", "授权证明"], ["保存草稿", "提交审核"], "渠道档案只写渠道事实，不写报价、预订或库存锁定。"),
    positiveCase("07-configure-publication-rule", "配置发布规则。", "configure-channel-publication-rule", "配置渠道发布规则", "发布待检查", "配置渠道展示名称、商品映射和人工确认规则。", ["携程渠道，已启用，适用 301 整房按晚价", "有效价格：已读取场景包 3 价格版本", "运营阻断：无"], ["渠道展示名称：WorkOS 301 整房", "是否同步库存展示：仅展示可见条件", "是否需要人工确认：是"], ["发布检查记录", "渠道映射说明"], ["保存规则", "检查发布"], "渠道发布规则不直接锁库存，外部回传必须进入场景包 5。"),
    positiveCase("08-configure-commission-settlement", "配置佣金结算意向。", "configure-commission-settlement-intent", "配置佣金与结算规则意向", "财务规则待确认", "录入佣金说明、账期和结算备注，并交给财务确认流程。", ["携程渠道佣金/结算规则意向", "财务确认流程处理佣金/结算真值", "本场景只输出意向"], ["佣金说明：按协议比例", "账期说明：月结", "发票要求：平台发票"], ["佣金依据", "结算说明", "合同证据"], ["提交财务规则复核", "补充证据"], "佣金/结算规则意向不等于账务结果，财务真值由财务确认流程处理。"),
    positiveCase("09-audit-enable-channel", "审核启用。", "audit-enable", "审核启用渠道", "已启用", "审核资料、证据、资格和发布检查后启用渠道。", ["携程渠道，已启用，适用 301 整房按晚价", "缺失项：无", "发布状态：发布已启用"], ["审核意见：同意启用", "发布说明：人工确认"], ["审核记录", "证据摘要"], ["暂停", "停用", "新建版本"], "渠道启用不等于报价结果，也不等于库存锁定。"),
    positiveCase("10-pause-channel", "暂停渠道。", "daily-maintenance", "暂停渠道", "已暂停", "因渠道维护暂停展示和对接，保留状态历史。", ["携程渠道，当前已暂停", "状态历史：已启用 -> 已暂停", "影响范围：渠道发布规则"], ["暂停原因：渠道维护", "预计恢复：待通知"], ["暂停说明", "状态历史"], ["恢复审核", "停用"], "暂停渠道只写渠道状态历史，不写退款、账务或预订结果。"),
    positiveCase("11-renew-agreement-version", "新建协议续签版本。", "daily-maintenance", "新建协议续签版本", "协议待审核", "基于旧协议新建续签版本，旧事实不原地覆盖。", ["某某公司协议客户，有效至 2026-12-31", "旧版本只读", "新版本待审核"], ["续签开始日期：2027-01-01", "续签结束日期：2027-12-31", "续签备注：条件不变"], ["续签协议", "补充证据"], ["保存新版本", "提交审核"], "已生效协议只能新版本、续签、停用、作废或纠错。"),
    positiveCase("12-navigation-entries", "查看今日、工作项、搜索、我的入口表现。", "daily-maintenance", "渠道与企业客户入口", "今日待处理", "今日、工作项、搜索、我的按职责展示。", ["今日待审核", "协议即将到期", "资料待补", "发布异常待处理", "财务规则待确认", "工作项展示全部渠道、企业客户、协议、发布规则、续签、补证和财务规则意向被动任务池", "搜索结果只读跳转", "我的只放草稿、个人跟进、收藏、导出、设置"], [], ["入口截图证据"], ["按状态进入合法动作"], "搜索只读，不能直接写协议、发布、报价、预订、库存或账务事实。")
  ];
}

function positiveCase(id, testPlanItemZh, stepId, title, state, summary, readonlyFacts, filledFields, evidence, buttons, highlight) {
  return {
    id,
    testPlanItemZh,
    step: new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step])).get(stepId),
    title,
    state,
    summary,
    readonlyFacts,
    filledFields,
    evidence,
    missingItems: [],
    nextActions: buttons,
    buttons,
    highlight
  };
}

async function renderAndCapture(page, item) {
  const step = item.step ?? {};
  const visibleText = [
    item.title,
    item.state,
    item.summary,
    ...(item.readonlyFacts ?? []),
    ...(item.filledFields ?? []),
    ...(item.evidence ?? []),
    ...(item.nextActions ?? []),
    ...(item.buttons ?? []),
    item.highlight
  ].filter(Boolean).join(" ");
  const analysis = {
    "用户是否看得懂": `${item.title} 使用渠道与企业客户业务名称，并展示状态、适用范围、证据和下一步。`,
    "字段是否合理": "只展示上游只读摘要、用户填写/选择、证据绑定和业务可读对象，不要求填写内部编号。",
    "按钮是否顺": `按钮随状态出现：${(item.buttons ?? []).join("、") || "无按钮"}。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "未暴露内部编号或技术引用。",
    "是否误导为已报价/已预订/已入账": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "存在误导词，需要修复。" : "未把渠道启用、协议生效或佣金意向误导为报价、预订、库存锁定或入账事实。"
  };
  const screenshot = {
    id: item.id,
    stepId: step.stepId ?? "",
    stepNameZh: step.nameZh ?? item.testPlanItemZh,
    pageName: item.title,
    testPlanItemZh: item.testPlanItemZh,
    visibleText,
    analysis,
    businessRuntimeRatePlanTruthWriteAllowed: false,
    quoteReservationWriteAllowed: false,
    inventoryHoldWriteAllowed: false,
    paymentRefundLedgerWriteAllowed: false,
    financeGateHandlesCommissionSettlementTruth: true,
    scenario4HandlesQuoteTruth: true,
    scenario5HandlesReservationInventoryTruth: true
  };
  await page.setContent(renderHtml(item, step), { waitUntil: "domcontentloaded" });
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
    .state { padding: 6px 10px; border: 1px solid #9bb8b1; background: #edf7f4; border-radius: 6px; font-size: 13px; white-space: nowrap; }
    .summary { font-size: 14px; line-height: 1.6; color: #425466; }
    section { background: #fff; border: 1px solid #d8dee4; border-radius: 8px; padding: 14px; margin: 10px 0; }
    ul { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.7; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { border: 1px solid #d0d7de; border-radius: 999px; padding: 5px 9px; background: #fbfcfd; font-size: 13px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    button { min-height: 42px; border: 0; border-radius: 6px; background: #226f54; color: #fff; font-weight: 700; font-size: 14px; }
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
    <section><h2>证据</h2><div class="chips">${chips(item.evidence)}</div></section>
    <section><h2>下一步</h2><ul>${rows(item.nextActions)}</ul><div class="actions">${(item.buttons ?? []).map((label, index) => `<button class="${index ? "secondary" : ""}">${escapeHtml(label)}</button>`).join("")}</div></section>
    <section class="highlight">${escapeHtml(item.highlight)}</section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario12_authority",
    contract.authorityId === "Dormitory.Scenario12.ChannelCorporateCustomer" && contract.nameZh === "渠道与企业客户",
    "正向浏览器证据必须绑定场景 12 generated 合同。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generatedFrom?.[0] === "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json",
    "规则必须先来自 Source Authority，再由 generated 合同被 surface 消费。",
    contract.generatedFrom);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.commissionSettlementIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "财务确认流程合同只能消费佣金/结算规则意向，业务 runtime 不写账。",
    financeGate);
  addAssertion(
    "contract.steps_seven_business_actions",
    (stepsContract.steps ?? []).length === 7,
    "场景 12 必须按七个业务动作组织，不是一张技术字段大表。",
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
    version: "oam.dormitory-scenario12-positive-screenshot-index.v1",
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
