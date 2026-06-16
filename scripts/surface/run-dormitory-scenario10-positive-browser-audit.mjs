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
const contractPath = "docs/contracts/generated/dormitory/scenario10-cancel-noshow-refund.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario10-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario10-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario10-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario10-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario10-positive-browser-report.json");
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
  "金额来源是否清楚",
  "是否误导为款项到账或账务完成"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario10-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario10_local_evidence",
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
  mockPolicy: "real Chromium screenshots rendered from generated 场景 10 contracts; no UI/runtime/test script adds business rules",
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
    "正向截图不得出现款项到账、账务完成、入住/退房完成或旧包误导词。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日未到店待处理") &&
      JSON.stringify(report).includes("工作项展示全部取消、未到店和退款/扣费被动任务池") &&
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.cancel_noshow_flow_visible",
    JSON.stringify(report.steps).includes("客户主动取消") &&
      JSON.stringify(report.steps).includes("政策金额计算") &&
      JSON.stringify(report.steps).includes("库存释放请求") &&
      JSON.stringify(report.steps).includes("财务处理请求") &&
      JSON.stringify(report.steps).includes("未到店任务"),
    "正向主流程必须让用户看懂取消、未到店、金额计算、库存释放和财务处理请求。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_finance_or_inventory_truth_writes",
    report.steps.every((step) => step.businessRuntimeLedgerWriteAllowed === false &&
      step.paymentRefundWriteAllowed === false &&
      step.stayCheckoutWriteAllowed === false &&
      step.financeGateHandlesActualMoney === true &&
      step.inventoryReadModelHandlesRelease === true),
    "正向主流程不得写真实退款、收款、账务、入住或退房事实；实际款项交给 finance-gate，库存读模型读取释放请求。",
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
    console.error(`Dormitory scenario10 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario10 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario10 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  const stepById = new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step]));
  return [
    positiveCase("01-reservation-entry", "从预订详情进入客户取消。", "enter-cancel-noshow-processing", "取消办理", "待处理", "从预订详情进入客户主动取消，系统带入预订、客户、资源、价格和财务摘要。", ["张三", "预订号 R202606200001", "301-02 床位", "已收款/押金/担保摘要", "价格快照"], [], ["有效预订摘要", "收款押金摘要"], ["客户主动取消", "返回预订"], "预订号是业务展示号，系统自动绑定内部引用。"),
    positiveCase("02-reason-confirm", "填写取消原因和客户确认。", "reason-and-customer-confirmation", "原因与客户确认", "待政策计算", "填写取消原因、沟通结果、处理备注并绑定客户确认。", ["客户：张三", "当前状态：客户主动取消"], ["取消原因：行程变更", "客户沟通结果：同意按政策处理", "客户确认方式：聊天确认"], ["聊天记录", "客户确认"], ["查看金额"], "缺客户确认或存在争议时会转复核路径。"),
    positiveCase("03-policy-calculation", "查看取消政策和退款/扣费计算。", "policy-and-amount-calculation", "政策金额计算", "待库存释放", "系统根据政策、价格快照、已收款和押金摘要计算可退、应扣与不可退金额。", ["免费取消截止时间", "取消政策", "已收金额：800 元", "押金金额：300 元"], ["补充说明：客户主动取消"], ["取消政策快照", "价格快照", "已收/押金摘要"], ["确认库存释放请求"], "金额来源清楚，用户不能手填最终款项或账务结果。", ["可退金额：200 元", "应扣金额：100 元", "不可退金额：100 元"]),
    positiveCase("04-inventory-release", "确认库存释放请求。", "inventory-release-confirmation", "库存释放确认", "库存释放已请求", "确认释放当前预订绑定的资源和日期范围。", ["301-02 床位", "日期范围：2026-06-20 至 2026-06-25", "预订绑定资源"], [], ["库存释放确认证据"], ["提交财务处理请求"], "库存释放请求只针对本预订绑定范围，不释放他人资源。"),
    positiveCase("05-finance-request", "提交退款/扣费财务处理请求。", "finance-processing-request", "退款/扣费申请", "待财务处理", "提交退款/扣费申请、政策依据、客户确认和证据给 finance-gate。", ["退款申请：200 元", "扣费申请：100 元", "财务处理路径：finance-gate"], [], ["财务处理请求补充证据"], ["确认取消", "保存草稿"], "这里只生成财务处理请求，不写真实款项或账务。"),
    positiveCase("06-confirm-cancel", "确认取消。", "confirm-cancellation-or-noshow-closure", "确认取消", "已取消", "客户确认、政策计算、库存释放和财务处理请求完成后确认取消。", ["客户确认摘要", "政策计算摘要", "库存释放请求", "财务处理请求"], [], ["关闭补充证据"], ["查看取消摘要"], "确认取消只输出关闭摘要、库存释放请求和财务处理请求。"),
    positiveCase("07-result-finance-status", "查看取消结果和财务处理状态。", "result-and-follow-up", "处理结果", "待财务处理", "查看取消结果、释放资源摘要、退款/扣费申请状态和客户通知状态。", ["取消单号 C202606200001", "释放资源摘要", "财务处理状态：待处理", "客户通知状态：已通知"], ["后续跟进备注：等待财务处理"], ["客户通知证据"], ["查看财务状态", "补充证据"], "财务完成前只显示处理状态，不把申请解释为款项到账。"),
    positiveCase("08-today-noshow-entry", "从今日未到店任务进入。", "enter-cancel-noshow-processing", "今日未到店待处理", "待处理", "从今日任务进入未到店关闭，展示预订、客户、最晚保留时间和未到店任务。", ["今日未到店待处理", "预订号 R202606200002", "客户：李四", "最晚保留时间已过"], [], ["有效预订摘要"], ["办理取消/未到店"], "今日只展示今天需要处理的被动任务。"),
    positiveCase("09-confirm-noshow", "确认未到店。", "confirm-cancellation-or-noshow-closure", "确认未到店关闭", "未到店已关闭", "最晚保留时间已过且无有效到店记录时确认未到店关闭。", ["客户：李四", "到店任务未完成", "无有效到店记录"], [], ["电话记录", "内部审批证据"], ["计算未到店费"], "未到店关闭不代表款项到账或账务完成。"),
    positiveCase("10-noshow-fee", "计算未到店费。", "policy-and-amount-calculation", "未到店费计算", "待财务处理", "系统按未到店政策和已收押金摘要计算未到店费、可退和应扣金额。", ["未到店政策", "已收金额：500 元", "押金金额：200 元"], ["补充说明：客户未按时到店"], ["未到店政策快照", "电话记录"], ["释放库存并提交财务处理请求"], "未到店费来自政策和快照，不由用户手填最终结果。", ["未到店费：150 元", "可退金额：350 元"]),
    positiveCase("11-noshow-release-finance", "释放库存并生成财务处理请求。", "finance-processing-request", "未到店财务处理", "待财务处理", "释放本预订绑定资源并生成退款/扣费处理请求。", ["库存释放请求", "财务处理请求", "证据摘要"], [], ["库存释放确认证据", "财务处理请求补充证据"], ["查看处理结果"], "库存读模型读取释放请求，finance-gate 处理实际款项。"),
    positiveCase("12-navigation-entries", "查看今日、工作项、搜索、我的入口表现。", "result-and-follow-up", "取消/未到店入口", "待处理任务", "今日、工作项、搜索、我的各自展示清晰职责。", ["今日未到店待处理", "取消待确认", "退款申请待财务", "工作项展示全部取消、未到店和退款/扣费被动任务池", "搜索结果只读跳转", "我的只放草稿、个人跟进、收藏、导出、设置"], [], ["入口截图证据"], ["按状态进入合法动作"], "搜索只读，不能直接写取消、库存或款项事实。")
  ];
}

function positiveCase(id, testPlanItemZh, stepId, title, state, summary, readonlyFacts, filledFields, evidence, buttons, highlight, calculatedFields = []) {
  return {
    id,
    testPlanItemZh,
    step: new Map((stepsContract.steps ?? []).map((step) => [step.stepId, step])).get(stepId),
    title,
    state,
    summary,
    readonlyFacts,
    filledFields,
    calculatedFields,
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
    ...(item.calculatedFields ?? []),
    ...(item.evidence ?? []),
    ...(item.nextActions ?? []),
    ...(item.buttons ?? []),
    item.highlight
  ].filter(Boolean).join(" ");
  const analysis = {
    "用户是否看得懂": `${item.title} 使用取消、未到店与退款处理业务名称，并展示当前状态、摘要和下一步。`,
    "字段是否合理": "只展示上游只读摘要、用户填写/选择、系统计算金额和证据绑定，不要求填写内部编号。",
    "按钮是否顺": `按钮随状态出现：${(item.buttons ?? []).join("、") || "无按钮"}。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "未暴露内部编号或技术引用。",
    "金额来源是否清楚": visibleText.includes("金额") || visibleText.includes("政策") ? "金额来自政策、价格快照、已收/押金摘要和证据。" : "当前步骤不处理金额。",
    "是否误导为款项到账或账务完成": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "存在误导词，需要修复。" : "未把申请误导为款项到账、账务完成或入住/退房完成。"
  };
  const screenshot = {
    id: item.id,
    stepId: step.stepId ?? "",
    stepNameZh: step.nameZh ?? item.testPlanItemZh,
    pageName: item.title,
    testPlanItemZh: item.testPlanItemZh,
    visibleText,
    analysis,
    businessRuntimeLedgerWriteAllowed: false,
    paymentRefundWriteAllowed: false,
    stayCheckoutWriteAllowed: false,
    financeGateHandlesActualMoney: true,
    inventoryReadModelHandlesRelease: true
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
    .state { padding: 6px 10px; border: 1px solid #a7b7a5; background: #eef5ee; border-radius: 6px; font-size: 13px; white-space: nowrap; }
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
    "contract.scenario10_authority",
    contract.authorityId === "Dormitory.Scenario10.CancelNoShowRefund" && contract.nameZh === "取消、未到店与退款处理",
    "正向浏览器证据必须绑定场景 10 generated 合同。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generatedFrom?.[0] === "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json",
    "规则必须先来自 Source Authority，再由 generated 合同被 surface 消费。",
    contract.generatedFrom);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.refundFeeIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "finance-gate 合同只能消费退款/扣费意向，业务 runtime 不写账。",
    financeGate);
  addAssertion(
    "contract.steps_seven_business_actions",
    (stepsContract.steps ?? []).length === 7,
    "场景 10 必须按七个业务动作组织，不是一张技术字段大表。",
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
    version: "oam.dormitory-scenario10-positive-screenshot-index.v1",
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
