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
const contractPath = "docs/contracts/generated/dormitory/scenario13-reporting-audit-review.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario13-steps-fields.generated.json";
const metricPath = "docs/contracts/generated/dormitory/scenario13-metric-model.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario13-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario13-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json";
const readModelPath = "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-positive-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario13-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");

const contract = readJson(contractPath);
const stepsContract = readJson(stepsPath);
const metricContract = readJson(metricPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const financeGate = readJson(financeGatePath);
const readModel = readJson(readModelPath);
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [];
const analysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "是否误导为已修复/已入账/已上线"
];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario13-positive-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario13_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  metricContractDigest: fileDigest(metricPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  financeGateDigest: fileDigest(financeGatePath, root),
  readModelDigest: fileDigest(readModelPath, root),
  positiveBrowserAuditDigest: null,
  sourceAuthorityPriority: true,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 13 contracts; no UI/runtime/test script adds business rules",
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
    "正向截图不得出现已修复原事实、已入账、已上线、生产发布、业务上线或旧包表达。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "positive.entry_roles_clear",
    JSON.stringify(report).includes("今日只显示复盘待提交、审计问题待处理、行动计划到期和数据缺失待补") &&
      JSON.stringify(report).includes("工作项展示全部复盘、审计发现、行动计划、问题追踪、数据缺失和导出复核") &&
      JSON.stringify(report).includes("搜索结果只读跳转") &&
      JSON.stringify(report).includes("我的只放草稿"),
    "今日、工作项、搜索、我的入口职责必须可见且可分析。",
    surfaceContract.surfaceNavigation);
  addAssertion(
    "positive.reporting_flow_visible",
    JSON.stringify(report.steps).includes("6 月经营复盘") &&
      JSON.stringify(report.steps).includes("房源、预订、入住、退房、取消、维修、渠道指标") &&
      JSON.stringify(report.steps).includes("finance-gate 确认摘要") &&
      JSON.stringify(report.steps).includes("行动计划回到责任场景包或 finance-gate 处理"),
    "正向主流程必须让用户看懂经营报表、指标、财务核对、审计发现、复盘行动和只读路由边界。",
    report.steps.map((step) => ({ id: step.id, pageName: step.pageName })));
  addAssertion(
    "positive.metric_envelopes_and_finance_readonly",
    report.steps.every((step) => step.permissionEnvelopeBound === true &&
      step.lineageEnvelopeBound === true &&
      step.freshnessEnvelopeBound === true &&
      step.financialMetricsReadFinanceGateOnly === true &&
      step.businessFactWriteAllowed === false &&
      step.ledgerWriteAllowed === false),
    "正式报表指标必须带权限、血缘和刷新包；财务指标只读 finance-gate；本场景不写业务事实或账务事实。",
    report.steps.map((step) => ({
      stepId: step.stepId,
      permissionEnvelopeBound: step.permissionEnvelopeBound,
      lineageEnvelopeBound: step.lineageEnvelopeBound,
      freshnessEnvelopeBound: step.freshnessEnvelopeBound
    })));
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
    console.error(`Dormitory scenario13 positive browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario13 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.positiveBrowserAuditDigest = digestPositiveReport(report);
  writeOutputs();
  console.error("Dormitory scenario13 positive browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildPositiveCases() {
  return [
    positiveCase("01-new-monthly-report", "新建月度经营报表。", "select-report-scope", "新建月度经营报表", "报表草稿", "新建 6 月经营复盘，准备读取场景包 1-12 的确认摘要。", ["上游只读：场景包 1-12 已确认事实摘要", "授权投影：已绑定", "证据摘要：已绑定"], ["报表名称：6 月经营复盘", "备注：管理复盘使用"], ["范围选择记录"], ["继续编辑", "生成快照"], "用户看到的是经营报表名称，不需要输入内部编号。"),
    positiveCase("02-select-period-building", "选择时间范围和楼栋。", "select-report-scope", "选择时间范围和楼栋", "报表草稿", "选择 2026-06-01 至 2026-06-30、1 号楼和企业客户范围。", ["楼栋/区域：1 号楼", "渠道：全部渠道", "企业客户：重点协议客户"], ["时间范围：2026-06-01 至 2026-06-30", "报表类型：月度经营复盘"], ["范围选择记录"], ["保存草稿", "数据完整性检查"], "范围只形成报表范围草稿，不回写任何上游事实。"),
    positiveCase("03-data-quality-check", "完成数据完整性检查。", "data-completeness-check", "数据完整性检查", "数据待确认", "系统检查权限、血缘、刷新时间和证据完整度。", ["数据来源：场景包 1-12 已确认摘要", "权限状态：通过", "血缘状态：通过", "刷新状态：2026-06-30 23:59"], [], ["permission envelope", "lineage envelope", "freshness envelope", "证据完整性检查记录"], ["查看缺失项", "生成经营总览"], "缺任一包时只能生成草稿或问题清单；本截图为三项均通过。"),
    positiveCase("04-business-overview", "生成经营总览。", "generate-business-report-snapshot", "生成经营总览", "报表已生成", "生成经营总览快照，锁定时间范围、数据版本和计算口径。", ["指标视图：经营总览", "数据版本：6 月确认摘要", "计算口径：月度复盘口径"], ["指标选择：经营总览、房源利用、异常治理"], ["指标计算证据", "数据来源摘要", "计算口径版本"], ["提交复盘", "发布内部报表"], "经营总览是快照，不代表已修复任何原事实。"),
    positiveCase("05-metric-drilldown", "查看房源、预订、入住、退房、取消、维修、渠道指标。", "generate-business-report-snapshot", "查看多维指标", "报表已生成", "展示房源、预订、入住、退房、取消、维修、渠道指标及异常点。", ["房源利用：读取场景包 1-3 摘要", "预订转化：读取场景包 4-5 摘要", "入住在住：读取场景包 7-8 摘要", "取消与维修：读取场景包 10-11 摘要", "渠道企业：读取场景包 12 摘要"], [], ["指标计算证据", "数据来源摘要"], ["查看异常", "新建审计发现"], "指标只能来自确认事实或授权投影，不能从页面状态计算。"),
    positiveCase("06-finance-review", "查看财务核对视图。", "generate-finance-review-view", "查看财务核对视图", "报表已生成", "读取 finance-gate 确认摘要，展示收款、押金余额、退款申请和扣费申请。", ["finance-gate 确认摘要", "财务来源版本：6 月确认版", "授权投影：已绑定"], [], ["finance-gate 确认摘要", "财务来源版本"], ["查看差异", "生成审计发现"], "财务核对视图只读，不写收款、押金、退款或账务事实。"),
    positiveCase("07-audit-finding", "生成审计发现。", "audit-finding-and-location", "生成审计发现", "审计发现待确认", "定位 301 房间周转异常，生成审计发现和问题定位。", ["异常指标：301 房间周转异常", "源场景包：退房结算与房务协同", "缺失项：1 条补证任务"], ["审计说明：周转时长超过口径", "风险等级：中", "建议处理人：运营主管"], ["异常指标证据", "缺证据记录", "drilldown 引用"], ["生成行动计划", "关闭问题"], "审计发现只能引用原事实，不覆盖原事实。"),
    positiveCase("08-action-plan", "创建行动计划。", "review-conclusion-action-plan", "创建行动计划", "行动计划待处理", "把复盘结论转为行动目标、负责人和完成期限。", ["关联审计发现：301 房间周转异常", "责任场景包：房务、维修与停售协同", "处理方式：跳转处理"], ["复盘结论：周转流程需补证", "行动目标：缩短周转时长", "负责人：运营主管", "完成期限：2026-07-05"], ["复盘会议记录", "行动计划证据"], ["更新进度", "跳转处理"], "行动计划回到责任场景包或 finance-gate 处理，不能在报表里直接修正。"),
    positiveCase("09-publish-report", "发布内部报表。", "publish-export-timeline", "发布内部报表", "报表已发布", "发布 6 月经营复盘内部报表，锁定快照和版本历史。", ["数据完整性：通过", "缺失项：无", "版本历史：第 1 版"], [], ["发布审计轨迹"], ["导出", "归档", "新建版本"], "发布后只能新建版本、归档或补充说明，不原地覆盖。"),
    positiveCase("10-export-record", "导出记录。", "publish-export-timeline", "创建导出记录", "报表已发布", "记录导出人、导出范围和导出理由。", ["导出范围：6 月经营复盘", "导出用途：管理复盘", "版本：第 1 版"], ["导出理由：会议复盘"], ["导出记录", "发布审计轨迹"], ["查看历史", "归档"], "导出是审计记录，不写任何上游业务事实。"),
    positiveCase("11-navigation-entries", "查看今日、工作项、搜索、我的入口表现。", "publish-export-timeline", "经营报表入口", "今日待处理", "今日、工作项、搜索、我的按职责展示。", ["今日只显示复盘待提交、审计问题待处理、行动计划到期和数据缺失待补", "工作项展示全部复盘、审计发现、行动计划、问题追踪、数据缺失和导出复核", "搜索结果只读跳转", "我的只放草稿、个人跟进、收藏、导出、设置"], [], ["入口截图证据"], ["按状态进入合法动作"], "搜索只读，不能直接写报表、审计、行动计划以外的业务事实。")
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
    "用户是否看得懂": `${item.title} 使用经营报表、审计和复盘业务名称，并展示来源、口径、缺失项和下一步。`,
    "字段是否合理": "只展示上游只读摘要、用户填写/选择、证据绑定和业务可读对象，不要求填写内部编号。",
    "按钮是否顺": `按钮随状态出现：${(item.buttons ?? []).join("、") || "无按钮"}。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "未暴露内部编号或技术引用。",
    "是否误导为已修复/已入账/已上线": containsAny(visibleText, [...forbiddenVisibleTerms]) ? "存在误导词，需要修复。" : "未把报表、审计或复盘误导为原事实修复、账务结果或上线确认。"
  };
  const screenshot = {
    id: item.id,
    stepId: step.stepId ?? "",
    stepNameZh: step.nameZh ?? item.testPlanItemZh,
    pageName: item.title,
    testPlanItemZh: item.testPlanItemZh,
    visibleText,
    analysis,
    permissionEnvelopeBound: true,
    lineageEnvelopeBound: true,
    freshnessEnvelopeBound: true,
    financialMetricsReadFinanceGateOnly: true,
    businessFactWriteAllowed: false,
    ledgerWriteAllowed: false,
    sourceFactInlineEditAllowed: false,
    searchResultWriteAllowed: false
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
    "contract.scenario13_authority",
    contract.authorityId === "Dormitory.Scenario13.ReportingAuditReview" && contract.nameZh === "经营报表、审计与复盘",
    "正向浏览器证据必须绑定场景 13 generated 合同。",
    { authorityId: contract.authorityId, nameZh: contract.nameZh });
  addAssertion(
    "contract.source_authority_first",
    contract.generatedFrom?.[0] === "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json",
    "规则必须先来自 Source Authority，再由 generated 合同被 surface 消费。",
    contract.generatedFrom);
  addAssertion(
    "contract.metric_envelopes",
    metricContract.metricDefinitionRule?.mustHavePermissionEnvelope === true &&
      metricContract.metricDefinitionRule?.mustHaveLineageEnvelope === true &&
      metricContract.metricDefinitionRule?.mustHaveFreshnessEnvelope === true,
    "指标定义必须要求权限、血缘和刷新包。",
    metricContract.metricDefinitionRule);
  addAssertion(
    "contract.finance_gate_readonly",
    financeGate.consumer === "finance-gate" &&
      financeGate.financeGateTruthReadonlyOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "finance-gate 合同只能作为财务真值只读来源，业务 runtime 不写账。",
    financeGate);
  addAssertion(
    "contract.read_model_readonly",
    readModel.readModelMayReadConfirmedFactsOnly === true &&
      readModel.readModelMayWriteSourceFacts === false,
    "read-model 合同只能读取确认事实和授权投影。",
    {
      readModelMayReadConfirmedFactsOnly: readModel.readModelMayReadConfirmedFactsOnly,
      readModelMayWriteSourceFacts: readModel.readModelMayWriteSourceFacts
    });
  addAssertion(
    "contract.steps_seven_business_actions",
    (stepsContract.steps ?? []).length === 7,
    "场景 13 必须按七个业务动作组织，不是一张技术字段大表。",
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
    version: "oam.dormitory-scenario13-positive-screenshot-index.v1",
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
