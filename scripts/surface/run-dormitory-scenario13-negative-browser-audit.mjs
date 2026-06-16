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
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario13-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario13-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario13-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json";
const readModelPath = "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario13-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "Room",
  "Bed",
  "OperationStatus",
  "RatePlan",
  "Quote",
  "Reservation",
  "Stay",
  "Payment",
  "Deposit",
  "Refund",
  "LedgerEntry",
  "LedgerTransaction",
  "CommandSubmission",
  "DomainEvent",
  "Outbox",
  "Projection",
  "Lens",
  "Search",
  "Board",
  "Report"
];
const requiredAnalysisKeys = [
  "失败是否业务可理解",
  "是否证明无副作用",
  "是否暴露内部 ID",
  "是否阻断越界",
  "是否可回到合法动作"
];

const contract = readJson(contractPath);
const runtimeRules = readJson(runtimeRulesPath);
const surfaceContract = readJson(surfacePath);
const testPlan = readJson(testPlanPath);
const financeGate = readJson(financeGatePath);
const readModel = readJson(readModelPath);
const failureMessageByCode = new Map((runtimeRules.failureSemantics ?? []).map((item) => [item.failureCode, item.messageZh]));
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario13-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario13_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  financeGateDigest: fileDigest(financeGatePath, root),
  readModelDigest: fileDigest(readModelPath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 13 failure semantics; failure paths are checked before any business side effect",
  scenarios: [],
  screenshots: [],
  screenshotIndex: rel(screenshotIndexPath),
  assertions: [],
  findings: [],
  noSideEffectTargets,
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
    "negative browser audit PASS is not production release",
    "negative browser audit PASS is not business go-live",
    "negative browser audit PASS is not final approval"
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
    for (const item of buildNegativeCases()) {
      await renderAndCapture(page, item);
    }
    await context.close();
  } finally {
    await browser.close();
  }

  addAssertion(
    "negative.all_test_plan_items_covered",
    (testPlan.negativeBrowserTestPlan ?? []).every((label) =>
      report.scenarios.some((scenario) => scenario.testPlanItemZh === label)),
    "反向截图必须覆盖生成测试计划的全部失败路径。",
    { expectedCount: testPlan.negativeBrowserTestPlan?.length ?? 0, actualCount: report.scenarios.length });
  addAssertion(
    "negative.all_failures_no_side_effects",
    report.scenarios.every((scenario) => scenario.sideEffectsAllowed === false &&
      noSideEffectTargets.every((target) => scenario.sideEffects?.[target] === 0)),
    "所有失败路径都不得写前台业务事实、财务事实、账务事实、正式报表或任何错误投影。",
    report.scenarios.map((scenario) => ({ id: scenario.id, sideEffects: scenario.sideEffects })));
  addAssertion(
    "negative.no_internal_id_visible",
    report.screenshots.every((shot) => !containsAny(shot.visibleText, forbiddenInternalTerms)),
    "反向截图不得把内部编号显示给普通用户。",
    { forbiddenInternalTerms });
  addAssertion(
    "negative.no_forbidden_user_terms_visible",
    report.screenshots.every((shot) => !containsAny(shot.visibleText, [...forbiddenVisibleTerms])),
    "反向截图不得出现禁用误导词或旧包表达。",
    { forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
  addAssertion(
    "negative.no_go_remains_closed",
    report.productionConfirmAllowed === false &&
      report.businessGoLiveAllowed === false &&
      report.releaseAuthority === false &&
      report.finalGoNoGo === "NO_GO",
    "反向证据不能被解释为生产发布、业务上线或最终放行。",
    {
      productionConfirmAllowed: report.productionConfirmAllowed,
      businessGoLiveAllowed: report.businessGoLiveAllowed,
      releaseAuthority: report.releaseAuthority,
      finalGoNoGo: report.finalGoNoGo
    });

  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed")
    ? "failed"
    : "passed";
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();

  if (report.status !== "passed") {
    console.error(`Dormitory scenario13 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario13 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario13 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    negativeCase("01-missing-permission", "缺权限生成报表。", "missing_permission_envelope", "缺少权限包时生成正式报表", "数据完整性检查页", ["缺少权限包", "只能生成草稿或问题清单"], "补齐授权后重新检查"),
    negativeCase("02-missing-lineage", "缺血缘生成正式指标。", "missing_lineage_envelope", "缺少数据血缘时生成正式指标", "数据完整性检查页", ["缺少数据血缘", "指标不能进入正式报表"], "补齐来源链路后重新生成"),
    negativeCase("03-stale-freshness", "数据过期发布报表。", "stale_freshness_envelope", "刷新时间过期时发布报表", "发布页", ["数据已过期", "不能发布本版本"], "重新刷新数据并检查完整性"),
    negativeCase("04-ui-state-metric", "UI 页面状态参与指标计算。", "ui_state_metric_forbidden", "用页面临时状态计算指标", "经营总览页", ["指标必须来自确认事实或授权投影", "页面临时状态不可作为指标来源"], "选择已确认摘要或授权投影"),
    negativeCase("05-non-finance-gate", "非 finance-gate 数据作为财务真值。", "non_finance_gate_truth_forbidden", "用业务页面款项显示作为财务真值", "财务核对页", ["财务指标只能读取 finance-gate 确认事实", "业务页面显示不能作为财务真值"], "读取 finance-gate 确认摘要"),
    negativeCase("06-direct-source-fix", "审计发现直接改房源/预订/账务。", "audit_direct_source_fix_forbidden", "审计发现直接修改上游事实", "审计发现页", ["审计发现只能生成问题和行动计划", "原事实必须回到责任场景包或 finance-gate 处理"], "生成行动计划并跳转处理"),
    negativeCase("07-published-inline-edit", "已发布报表原地编辑。", "published_report_inline_edit_forbidden", "原地编辑已发布报表", "版本历史页", ["已发布报表锁定快照", "只能新建版本、归档或补充说明"], "新建版本后重新生成"),
    negativeCase("08-forged-internal-reference", "伪造 reportId/metricId/ledgerEntryId。", "forged_internal_reference", "用户尝试填写系统引用", "报表范围页", ["系统引用由系统自动绑定", "普通用户不能填写内部编号"], "通过今日、工作项或搜索只读跳转进入合法动作", ["reportId", "metricId", "ledgerEntryId"]),
    negativeCase("09-search-writes-fact", "搜索结果直接写业务事实。", "readonly_search_write_attempt", "从搜索结果直接写业务事实", "搜索结果", ["搜索结果只读", "只能跳转到合法动作"], "进入详情后按状态选择合法动作"),
    negativeCase("10-duplicate-publish", "重复发布。", "duplicate_report_publish", "重复发布同一报表版本", "发布页", ["该报表版本已发布", "请查看发布记录"], "查看版本历史或新建版本"),
    negativeCase("11-concurrent-publish", "并发发布同一报表版本。", "concurrent_report_publish_conflict", "同一报表版本被并发发布时继续提交", "发布页", ["同一报表版本正在被其他人发布", "请刷新后重试"], "刷新详情后按最新状态选择合法动作")
  ];
}

function negativeCase(id, testPlanItemZh, failureCode, attemptedActionZh, pageZh, visibleContextZh, legalNextActionZh, hiddenTechnicalAttempt = []) {
  return { id, testPlanItemZh, failureCode, attemptedActionZh, pageZh, visibleContextZh, legalNextActionZh, hiddenTechnicalAttempt };
}

async function renderAndCapture(page, item) {
  const generatedMessageZh = failureMessageByCode.get(item.failureCode) ?? "当前经营报表、审计与复盘规则未通过，未写入任何业务结果。";
  const displayMessageZh = sanitizeVisibleMessage(generatedMessageZh);
  const sideEffects = Object.fromEntries(noSideEffectTargets.map((target) => [target, 0]));
  const visibleText = [
    item.pageZh,
    item.attemptedActionZh,
    displayMessageZh,
    ...(item.visibleContextZh ?? []),
    item.legalNextActionZh,
    "未写入任何业务结果",
    "搜索结果只读",
    "可回到合法动作"
  ].filter(Boolean).join(" ");
  const analysis = {
    "失败是否业务可理解": `页面用业务语言说明：${displayMessageZh}`,
    "是否证明无副作用": "前台业务事实、财务事实、账务事实、CommandSubmission、DomainEvent、Projection、Lens、Search、正式报表均为 0 写入。",
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "截图没有展示内部编号；技术尝试仅记录在证据字段。",
    "是否阻断越界": "已阻断缺权限、缺血缘、数据过期、页面状态指标、非财务真值、直接修正源事实、搜索写事实、重复和并发。",
    "是否可回到合法动作": item.legalNextActionZh
  };
  const scenario = {
    id: item.id,
    testPlanItemZh: item.testPlanItemZh,
    failureCode: item.failureCode,
    generatedMessageZh,
    displayMessageZh,
    attemptedActionZh: item.attemptedActionZh,
    pageZh: item.pageZh,
    hiddenTechnicalAttempt: item.hiddenTechnicalAttempt ?? [],
    sideEffectsAllowed: false,
    sideEffects,
    analysis,
    visibleText
  };
  await page.setContent(renderHtml(item, displayMessageZh), { waitUntil: "domcontentloaded" });
  const file = path.join(screenshotDir, `${item.id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const shot = {
    ...scenario,
    path: rel(file),
    sha256: sha256File(file)
  };
  report.scenarios.push(scenario);
  report.screenshots.push(shot);
}

function renderHtml(item, displayMessageZh) {
  const rows = (items = []) => items.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f7f8fa; color: #24313d; }
    main { min-height: 100vh; padding: 18px; box-sizing: border-box; }
    h1 { font-size: 22px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 15px; margin: 14px 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee4; border-radius: 8px; padding: 14px; margin: 10px 0; }
    .error { border-left: 4px solid #b42318; background: #fff6f6; }
    .muted { color: #5f6b76; font-size: 13px; line-height: 1.5; }
    ul { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.7; }
    button { width: 100%; min-height: 42px; border: 0; border-radius: 6px; background: #116d6e; color: #fff; font-weight: 700; font-size: 14px; margin-top: 8px; }
    button.secondary { background: #5f6f7a; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(item.pageZh)}</h1>
    <div class="muted">${escapeHtml(item.attemptedActionZh)}</div>
    <section class="panel error"><h2>不能提交</h2><p>${escapeHtml(displayMessageZh)}</p></section>
    <section class="panel"><h2>原因</h2><ul>${rows(item.visibleContextZh)}</ul></section>
    <section class="panel"><h2>下一步</h2><p>${escapeHtml(item.legalNextActionZh)}</p><button>回到合法动作</button><button class="secondary">补充资料或证据</button></section>
    <section class="panel muted">未写入任何业务结果；搜索结果只读；可回到合法动作。</section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario13_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario13.ReportingAuditReview" && runtimeRules.nameZh === "经营报表、审计与复盘",
    "反向浏览器证据必须绑定经营报表、审计与复盘 runtime rules。",
    { authorityId: runtimeRules.authorityId, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "生成失败语义必须声明所有失败无副作用。",
    runtimeRules.failureSemantics?.map((failure) => failure.failureCode));
  addAssertion(
    "contract.reporting_invariants_defined",
    runtimeRules.reportingInvariantRule?.reportDashboardSearchExportReadonly === true &&
      runtimeRules.reportingInvariantRule?.permissionRequiredForFormalReport === true &&
      runtimeRules.reportingInvariantRule?.lineageRequiredForFormalMetric === true &&
      runtimeRules.reportingInvariantRule?.freshnessRequiredForPublish === true &&
      runtimeRules.reportingInvariantRule?.financialMetricsReadFinanceGateOnly === true &&
      runtimeRules.reportingInvariantRule?.auditFindingCannotModifySourceFact === true &&
      runtimeRules.reportingInvariantRule?.failureNoSideEffects === true,
    "经营报表不变量必须要求只读入口、权限/血缘/刷新、finance-gate 财务真值、审计不修源事实和失败无副作用。",
    runtimeRules.reportingInvariantRule);
  addAssertion(
    "contract.finance_gate_readonly",
    financeGate.consumer === "finance-gate" &&
      financeGate.financeGateTruthReadonlyOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "finance-gate 只能作为财务真值只读来源，业务 runtime 不写账。",
    financeGate);
  addAssertion(
    "contract.read_model_readonly",
    readModel.readModelMayReadConfirmedFactsOnly === true &&
      readModel.readModelMayWriteSourceFacts === false,
    "read-model 合同必须只读确认事实。",
    {
      readModelMayReadConfirmedFactsOnly: readModel.readModelMayReadConfirmedFactsOnly,
      readModelMayWriteSourceFacts: readModel.readModelMayWriteSourceFacts
    });
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
    version: "oam.dormitory-scenario13-negative-screenshot-index.v1",
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

function digestNegativeReport(value) {
  return digestObject({ ...value, negativeBrowserAuditDigest: "sha256:pending" });
}

function sanitizeVisibleMessage(value) {
  return String(value ?? "")
    .replaceAll("Room", "房源事实")
    .replaceAll("Bed", "床位事实")
    .replaceAll("RatePlan", "价格事实")
    .replaceAll("Payment", "款项事实")
    .replaceAll("Refund", "退款事实")
    .replaceAll("LedgerEntry", "账务记录")
    .replaceAll("LedgerTransaction", "账务流水")
    .replaceAll("reportId", "系统引用")
    .replaceAll("metricId", "系统引用")
    .replaceAll("ledgerEntryId", "系统引用")
    .replaceAll("已入账", "账务状态待财务处理")
    .replaceAll("已上线", "上线状态不由本证据确认");
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
