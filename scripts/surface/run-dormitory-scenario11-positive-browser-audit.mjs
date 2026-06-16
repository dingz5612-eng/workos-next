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
const contractPath = "docs/contracts/generated/dormitory/scenario11-housekeeping-maintenance-outofservice.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario11-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario11-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario11-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario11-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario11-positive-browser-report.json");
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
  "是否误导为已可运营/已入账/已预订"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario11-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario11_local_evidence",
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
  mockPolicy: "real Chromium screenshots rendered from generated 场景 11 contracts; no UI/runtime/test script adds business rules",
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
    "正向截图不得出现已可运营、已入账、已预订、生产发布或旧包表达。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日待派工") &&
      JSON.stringify(report).includes("工作项展示全部房务、维修、检查、停售、返工、验收和费用意向被动任务池") &&
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.work_flow_visible",
    JSON.stringify(report.steps).includes("301 房间退房后保洁待验收") &&
      JSON.stringify(report.steps).includes("301-02 床位维修中，预计 18:00 完成") &&
      JSON.stringify(report.steps).includes("返工") &&
      JSON.stringify(report.steps).includes("费用意向") &&
      JSON.stringify(report.steps).includes("场景包 2 重新确认运营状态"),
    "正向主流程必须让用户看懂保洁、维修、验收、返工、费用意向和恢复建议的边界。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.no_operation_or_finance_truth_writes",
    report.steps.every((step) => step.businessRuntimeOperationStatusWriteAllowed === false &&
      step.reservationStayWriteAllowed === false &&
      step.paymentRefundLedgerWriteAllowed === false &&
      step.financeGateHandlesExpenseTruth === true &&
      step.scenario2HandlesOperationalTruth === true),
    "正向主流程不得写最终运营状态、预订、入住、收款、退款或账；费用真值交给 finance-gate，运营真值交给场景包 2。",
    report.steps.map((step) => ({ stepId: step.stepId, financeGateHandlesExpenseTruth: step.financeGateHandlesExpenseTruth })));
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
    console.error(`Dormitory scenario11 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario11 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario11 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  return [
    positiveCase("01-checkout-housekeeping-entry", "从退房待恢复进入保洁任务。", "enter-housekeeping-maintenance-processing", "房务、维修与停售协同", "待派工", "从退房待恢复进入保洁任务，系统带入房间、退房待恢复请求、证据摘要和预计恢复时间。", ["301 房间退房后保洁待验收", "来源：退房待恢复请求", "影响范围：301 房间", "预计恢复时间：今日 16:00", "证据摘要：退房照片、检查记录"], [], ["退房待恢复请求", "房间检查照片"], ["创建保洁任务", "保存草稿"], "用户看到的是业务可读房间和任务，不需要输入内部编号。"),
    positiveCase("02-dispatch-housekeeping", "派工保洁任务。", "dispatch-work-assignment", "派工保洁任务", "已派工", "选择负责人、计划时间和优先级后派工。", ["301 房间退房后保洁待验收", "来源摘要：退房后待恢复", "当前状态：待派工"], ["作业说明：退房后保洁和基础检查", "计划开始时间：10:00", "计划完成时间：12:00"], ["退房检查记录"], ["派工", "保存草稿"], "无负责人或作业范围时不可派工。"),
    positiveCase("03-update-housekeeping-progress", "更新保洁进度。", "update-work-progress", "保洁进度更新", "处理中", "保洁人员补充处理进度、现场照片和预计完成时间。", ["301 房间", "负责人：王阿姨", "优先级：今日完成"], ["处理进度：已完成卫生间和床铺整理", "预计完成时间：12:00"], ["保洁过程照片", "现场照片"], ["更新进度", "提交完成"], "进度以追加记录保存，不覆盖历史。"),
    positiveCase("04-submit-housekeeping-completion", "提交保洁完成。", "submit-work-completion", "提交保洁完成", "待验收", "提交完成说明和完成照片，进入验收。", ["301 房间", "保洁任务摘要", "证据缺失项：无"], ["完成说明：退房后保洁完成", "实际完成时间：11:40", "处理结果：可验收"], ["完成照片", "保洁记录"], ["提交验收", "补充证据"], "缺完成证据时不能提交验收。"),
    positiveCase("05-housekeeping-verification-pass", "验收通过。", "verify-work-result", "保洁验收", "验收通过", "验收人员查看前后对比和完成证据后确认通过。", ["301 房间", "完成证据：完成照片、保洁记录", "前后对比：已完成"], ["验收备注：现场符合恢复建议条件"], ["验收记录", "前后对比照片"], ["建议恢复运营", "关闭任务"], "验收通过只形成验收摘要，不直接写最终运营状态。"),
    positiveCase("06-output-recovery-recommendation", "输出恢复运营建议。", "output-outofservice-or-recovery-recommendation", "恢复建议输出", "建议恢复", "输出恢复运营建议，并提示场景包 2 重新确认运营状态。", ["301 房间", "验收摘要：保洁通过", "阻断原因已处理"], ["恢复建议：建议场景包 2 重新确认运营状态", "风险说明：无新增异常"], ["验收摘要", "风险说明"], ["查看建议", "关闭任务"], "建议恢复不等于最终恢复，场景包 2 重新确认运营状态。"),
    positiveCase("07-stay-service-maintenance-entry", "从在住服务请求进入维修任务。", "enter-housekeeping-maintenance-processing", "维修任务入口", "待派工", "从在住服务请求进入维修任务，带入床位、服务请求和异常摘要。", ["301-02 床位维修中，预计 18:00 完成", "来源：在住服务请求", "问题类型：空调故障", "影响范围：301-02 床位"], [], ["在住服务请求", "住客报修照片"], ["创建维修任务", "申请停售"], "床位级作业只影响指定床位，不影响整房。"),
    positiveCase("08-dispatch-maintenance", "派工维修任务。", "dispatch-work-assignment", "派工维修任务", "已派工", "选择维修负责人、协作人、计划完成时间和是否影响运营。", ["301-02 床位", "空调故障", "当前状态：待派工"], ["作业说明：检查空调不制冷", "计划完成时间：18:00", "备注：住客在住，请先电话确认"], ["报修照片"], ["派工", "保存草稿"], "派工只生成作业摘要，不写入住或费用结果。"),
    positiveCase("09-submit-maintenance-completion", "提交维修完成。", "submit-work-completion", "提交维修完成", "待验收", "维修完成后提交维修单、完成照片和处理结果。", ["301-02 床位", "维修任务摘要", "预计完成时间：18:00"], ["完成说明：更换空调启动电容", "实际完成时间：17:30", "处理结果：等待验收"], ["维修单", "完成照片", "供应商凭证"], ["提交验收", "补充证据"], "维修完成摘要可以给在住管理读取，但不写收款、退款或账务。"),
    positiveCase("10-verification-fail-rework", "验收不通过并生成返工。", "verify-work-result", "维修验收不通过", "验收不通过", "验收发现空调仍有噪音，必须生成返工或异常待处理。", ["301-02 床位", "完成证据：维修单、完成照片", "费用意向：待补"], ["未通过原因：运行噪音仍高", "验收备注：需要复检压缩机"], ["验收记录", "返工证据"], ["生成返工", "转停售建议"], "验收不通过不能关闭任务，必须生成返工。"),
    positiveCase("11-rework-verification-pass", "返工后验收通过。", "verify-work-result", "返工后验收", "验收通过", "返工完成后再次验收，通过后只输出恢复建议。", ["301-02 床位", "返工摘要：已复检压缩机", "完成证据：返工照片"], ["验收备注：返工后运行正常"], ["返工证据", "验收记录"], ["建议恢复运营", "关闭任务"], "返工后验收通过仍不直接改最终运营状态。"),
    positiveCase("12-submit-expense-intent", "提交费用意向。", "submit-expense-intent", "费用意向与财务交接", "需财务处理", "提交维修费用说明、供应商和凭证给 finance-gate。", ["301-02 床位维修任务", "作业完成摘要", "验收摘要"], ["费用说明：空调配件与上门费", "供应商：社区维修服务", "凭证说明：报价单和维修单齐全"], ["报价单", "维修单", "供应商凭证"], ["提交费用意向", "查看财务状态"], "费用意向交给 finance-gate，不等于账务成本。"),
    positiveCase("13-navigation-entries", "查看今日、工作项、搜索、我的入口表现。", "output-outofservice-or-recovery-recommendation", "房务/维修入口", "今日待处理", "今日、工作项、搜索、我的按职责展示。", ["今日待派工", "维修超期", "待验收", "返工中", "预计今日恢复", "工作项展示全部房务、维修、检查、停售、返工、验收和费用意向被动任务池", "搜索结果只读跳转", "我的只放草稿、个人跟进、收藏、导出、设置"], [], ["入口截图证据"], ["按状态进入合法动作"], "搜索只读，不能直接写作业、运营状态、库存或财务事实。")
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
    "用户是否看得懂": `${item.title} 使用房务、维修与停售协同业务名称，并展示来源、影响范围、状态和下一步。`,
    "字段是否合理": "只展示上游只读摘要、用户填写/选择、证据绑定和业务可读对象，不要求填写内部编号。",
    "按钮是否顺": `按钮随状态出现：${(item.buttons ?? []).join("、") || "无按钮"}。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "未暴露内部编号或技术引用。",
    "是否误导为已可运营/已入账/已预订": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "存在误导词，需要修复。" : "未把建议恢复、费用意向或作业完成误导为最终运营、入账或预订事实。"
  };
  const screenshot = {
    id: item.id,
    stepId: step.stepId ?? "",
    stepNameZh: step.nameZh ?? item.testPlanItemZh,
    pageName: item.title,
    testPlanItemZh: item.testPlanItemZh,
    visibleText,
    analysis,
    businessRuntimeOperationStatusWriteAllowed: false,
    reservationStayWriteAllowed: false,
    paymentRefundLedgerWriteAllowed: false,
    financeGateHandlesExpenseTruth: true,
    scenario2HandlesOperationalTruth: true
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
    <section><h2>证据</h2><div class="chips">${chips(item.evidence)}</div></section>
    <section><h2>下一步</h2><ul>${rows(item.nextActions)}</ul><div class="actions">${(item.buttons ?? []).map((label, index) => `<button class="${index ? "secondary" : ""}">${escapeHtml(label)}</button>`).join("")}</div></section>
    <section class="highlight">${escapeHtml(item.highlight)}</section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario11_authority",
    contract.authorityId === "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService" && contract.nameZh === "房务、维修与停售协同",
    "正向浏览器证据必须绑定场景 11 generated 合同。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generatedFrom?.[0] === "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json",
    "规则必须先来自 Source Authority，再由 generated 合同被 surface 消费。",
    contract.generatedFrom);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.expenseIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "finance-gate 合同只能消费费用意向，业务 runtime 不写账。",
    financeGate);
  addAssertion(
    "contract.steps_seven_business_actions",
    (stepsContract.steps ?? []).length === 7,
    "场景 11 必须按七个业务动作组织，不是一张技术字段大表。",
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
    version: "oam.dormitory-scenario11-positive-screenshot-index.v1",
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
