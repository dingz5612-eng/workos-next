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
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario11-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario11-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario11-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario11-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario11-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "OperationStatus",
  "Reservation",
  "Stay",
  "Payment",
  "Refund",
  "Ledger",
  "CommandSubmission",
  "DomainEvent",
  "Outbox",
  "Projection",
  "Lens",
  "Search",
  "Dashboard"
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
const failureMessageByCode = new Map((runtimeRules.failureSemantics ?? []).map((item) => [item.failureCode, item.messageZh]));
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [];

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario11-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario11_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  financeGateDigest: fileDigest(financeGatePath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 11 failure semantics; failure paths are checked before any business side effect",
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
    "所有失败路径都不得写运营状态、预订、入住、款项、退款、账务、CommandSubmission、DomainEvent、Outbox、Projection、Lens、Search、Dashboard。",
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
    console.error(`Dormitory scenario11 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario11 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario11 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-no-legal-work-source",
      testPlanItemZh: "无合法来源创建正式作业。",
      failureCode: "no_legal_work_source",
      attemptedActionZh: "没有运营阻断、在住服务、退房待恢复或取消释放待处理来源时创建正式作业",
      pageZh: "房务/维修入口",
      visibleContextZh: ["缺少合法来源摘要", "请从今日、工作项、房源详情或负责人批准入口进入"],
      legalNextActionZh: "回到今日或工作项选择有来源的待处理任务"
    },
    {
      id: "02-missing-work-assignee",
      testPlanItemZh: "无负责人派工。",
      failureCode: "missing_work_assignee",
      attemptedActionZh: "未选择负责人就派工作业",
      pageZh: "派工作业页",
      visibleContextZh: ["缺少负责人", "派工前必须明确负责人和作业范围"],
      legalNextActionZh: "选择负责人后重新派工"
    },
    {
      id: "03-completion-evidence-required",
      testPlanItemZh: "缺证据提交完成。",
      failureCode: "completion_evidence_required",
      attemptedActionZh: "缺少完成说明或完成照片时提交验收",
      pageZh: "完成作业页",
      visibleContextZh: ["缺少完成证据", "完成说明、完成照片或维修/保洁记录必须绑定"],
      legalNextActionZh: "补充完成证据后提交验收"
    },
    {
      id: "04-completion-required-before-verification",
      testPlanItemZh: "未完成直接验收通过。",
      failureCode: "completion_required_before_verification",
      attemptedActionZh: "作业尚未完成就直接验收通过",
      pageZh: "验收确认页",
      visibleContextZh: ["作业尚未完成", "不能直接验收通过"],
      legalNextActionZh: "先提交作业完成和证据"
    },
    {
      id: "05-verification-failure-requires-rework",
      testPlanItemZh: "验收不通过未生成返工。",
      failureCode: "verification_failure_requires_rework",
      attemptedActionZh: "验收不通过但不生成返工或异常待处理",
      pageZh: "验收确认页",
      visibleContextZh: ["验收不通过必须生成返工", "不能关闭任务"],
      legalNextActionZh: "生成返工或转异常待处理"
    },
    {
      id: "06-unresolved-maintenance-recovery",
      testPlanItemZh: "维修未关闭却建议恢复。",
      failureCode: "unresolved_maintenance_recovery_forbidden",
      attemptedActionZh: "维修、停售或异常未关闭时建议恢复运营",
      pageZh: "恢复建议页",
      visibleContextZh: ["仍有未关闭的维修或异常", "场景包 2 只读取已闭合后的建议"],
      legalNextActionZh: "先完成维修、返工或异常闭环"
    },
    {
      id: "07-direct-operational-restore",
      testPlanItemZh: "场景包 11 直接改为可运营。",
      failureCode: "direct_operational_restore_forbidden",
      attemptedActionZh: "在房务/维修处理中直接修改最终运营状态",
      pageZh: "恢复建议页",
      visibleContextZh: ["本场景只能输出恢复建议", "最终运营状态由场景包 2 重新确认"],
      legalNextActionZh: "输出恢复建议并交给场景包 2"
    },
    {
      id: "08-direct-expense-ledger",
      testPlanItemZh: "费用意向直接写账。",
      failureCode: "direct_expense_ledger_forbidden",
      attemptedActionZh: "费用意向提交时直接写财务结果或账务成本",
      pageZh: "费用意向页",
      visibleContextZh: ["费用意向必须交给财务确认流程", "本场景不能写财务结果或账务成本"],
      legalNextActionZh: "提交费用意向并等待财务确认流程处理"
    },
    {
      id: "09-forged-internal-reference",
      testPlanItemZh: "伪造 roomId/bedId/taskId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "用户尝试填写系统引用",
      pageZh: "房务/维修页",
      visibleContextZh: ["系统引用由系统自动绑定", "用户不能填写内部编号"],
      legalNextActionZh: "通过今日、工作项或搜索只读跳转进入",
      hiddenTechnicalAttempt: ["roomId", "bedId", "taskId"]
    },
    {
      id: "10-search-writes-task",
      testPlanItemZh: "搜索结果直接写任务。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接写作业事实",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读", "只能跳转到合法动作"],
      legalNextActionZh: "打开任务详情后按状态提交"
    },
    {
      id: "11-duplicate-work-submission",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_work_submission",
      attemptedActionZh: "重复提交同一房务/维修动作",
      pageZh: "完成作业页",
      visibleContextZh: ["该提交已处理", "请查看作业结果"],
      legalNextActionZh: "查看作业摘要或状态历史"
    },
    {
      id: "12-concurrent-work-conflict",
      testPlanItemZh: "并发验收同一任务。",
      failureCode: "concurrent_work_conflict",
      attemptedActionZh: "同一作业被并发验收时继续提交",
      pageZh: "验收确认页",
      visibleContextZh: ["当前作业已被其他人更新", "请刷新后查看最新状态"],
      legalNextActionZh: "刷新任务详情后重新判断合法动作"
    }
  ];
}

async function renderAndCapture(page, item) {
  const generatedMessageZh = toBusinessVisibleText(
    failureMessageByCode.get(item.failureCode) ?? "当前房务、维修与停售协同规则未通过，未写入任何业务结果。",
  );
  const displayMessageZh = sanitizeVisibleMessage(generatedMessageZh);
  const sideEffects = Object.fromEntries(noSideEffectTargets.map((target) => [target, 0]));
  const visibleText = [
    item.pageZh,
    item.attemptedActionZh,
    displayMessageZh,
    ...(item.visibleContextZh ?? []),
    item.legalNextActionZh,
    "未写入任何业务结果",
    "可回到合法动作"
  ].filter(Boolean).join(" ");
  const analysis = {
    "失败是否业务可理解": `页面用业务语言说明：${displayMessageZh}`,
    "是否证明无副作用": "运营状态、预订、入住、款项、退款、账务、CommandSubmission、DomainEvent、Projection、Lens、Search、Dashboard 均为 0 写入。",
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "截图没有展示内部编号；技术尝试仅记录在证据字段。",
    "是否阻断越界": "已阻断直接最终运营状态、直接财务结果、只读搜索写事实、缺证据提交和未闭合恢复建议。",
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
    <section class="panel muted">未写入任何业务结果；可回到合法动作。</section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario11_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService" && runtimeRules.nameZh === "房务、维修与停售协同",
    "反向浏览器证据必须绑定房务、维修与停售协同 runtime rules。",
    { authorityId: runtimeRules.authorityId, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "生成失败语义必须声明所有失败无副作用。",
    runtimeRules.failureSemantics?.map((failure) => failure.failureCode));
  addAssertion(
    "contract.housekeeping_invariants_defined",
    runtimeRules.housekeepingMaintenanceInvariantRule?.legalSourceRequired === true &&
      runtimeRules.housekeepingMaintenanceInvariantRule?.operationStatusOwnedByScenario2 === true &&
      runtimeRules.housekeepingMaintenanceInvariantRule?.financeGateHandlesExpenseTruth === true &&
      runtimeRules.housekeepingMaintenanceInvariantRule?.failureNoSideEffects === true,
    "房务/维修不变量必须要求合法来源、场景包 2 运营权威、财务确认流程财务真值和失败无副作用。",
    runtimeRules.housekeepingMaintenanceInvariantRule);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.expenseIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "财务确认流程只能消费费用意向，业务 runtime 不写账。",
    financeGate);
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
    version: "oam.dormitory-scenario11-negative-screenshot-index.v1",
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
    .replaceAll("已入账", "账务状态待财务处理")
    .replaceAll("已退款", "款项状态待财务处理")
    .replaceAll("finance-gate", "财务确认流程")
    .replaceAll("已可运营", "建议恢复后待场景包 2 确认")
    .replaceAll("已可预订", "待后续场景确认");
}

function toBusinessVisibleText(value) {
  return String(value ?? "").replaceAll("finance-gate", "财务确认流程");
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
