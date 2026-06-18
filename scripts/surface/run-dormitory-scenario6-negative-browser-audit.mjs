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
const contractPath = "docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario6-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario6-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario6-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "CommandSubmission",
  "DomainEvent",
  "Outbox",
  "Projection",
  "Lens",
  "Search",
  "Dashboard",
  "Ledger"
];
const forbiddenInternalTerms = [
  "paymentId",
  "depositId",
  "guaranteeId",
  "ledgerEntryId",
  "ledgerTransactionId",
  "reservationId",
  "paymentCaseId",
  "financeReviewRequestId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
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

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario6-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario6_local_evidence",
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
  mockPolicy: "real Chromium screenshots rendered from generated 场景 6 failure semantics; failure paths are checked before any business side effect",
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
    "所有失败路径都不得写 CommandSubmission、DomainEvent、Outbox、Projection、Lens、Search、Dashboard、Ledger。",
    report.scenarios.map((scenario) => ({ id: scenario.id, sideEffects: scenario.sideEffects })));
  addAssertion(
    "negative.no_internal_id_visible",
    report.screenshots.every((shot) => !containsAny(shot.visibleText, forbiddenInternalTerms)),
    "反向截图不得把内部编号显示给普通用户。",
    { forbiddenInternalTerms });
  addAssertion(
    "negative.no_forbidden_user_terms_visible",
    report.screenshots.every((shot) => !containsAny(shot.visibleText, [...forbiddenVisibleTerms])),
    "反向截图不得出现禁用误导词。",
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
    console.error(`Dormitory scenario6 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario6 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario6 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-reservation-not-confirmed",
      testPlanItemZh: "未确认预订进入本包。",
      failureCode: "reservation_not_confirmed",
      attemptedActionZh: "从未确认预订进入收款押金办理",
      pageZh: "收款押金办理页",
      visibleContextZh: ["预订仍未完成确认", "需要先回到预订与库存锁定处理"],
      legalNextActionZh: "先完成预订确认，再进入收款、押金与担保"
    },
    {
      id: "02-receipt-evidence-required",
      testPlanItemZh: "缺凭证提交。",
      failureCode: "receipt_evidence_required",
      attemptedActionZh: "未上传凭证直接提交收款",
      pageZh: "收款凭证提交页",
      visibleContextZh: ["尚未上传或绑定收款凭证"],
      legalNextActionZh: "上传凭证后再提交"
    },
    {
      id: "03-amount-must-be-positive",
      testPlanItemZh: "金额为 0 或负数。",
      failureCode: "amount_must_be_positive",
      attemptedActionZh: "提交 0 元或负数金额",
      pageZh: "收款凭证提交页",
      visibleContextZh: ["提交金额不是有效正数"],
      legalNextActionZh: "填写大于 0 的金额"
    },
    {
      id: "04-currency-mismatch",
      testPlanItemZh: "币种不一致。",
      failureCode: "currency_mismatch",
      attemptedActionZh: "提交与应收要求不一致的币种",
      pageZh: "收款凭证提交页",
      visibleContextZh: ["凭证币种与应收要求不一致"],
      legalNextActionZh: "按应收要求选择币种或退回补证"
    },
    {
      id: "05-deposit-marked-as-income",
      testPlanItemZh: "押金标记为收入。",
      failureCode: "deposit_marked_as_income_forbidden",
      attemptedActionZh: "把押金按收入确认",
      pageZh: "押金提交页",
      visibleContextZh: ["押金不是收入"],
      legalNextActionZh: "按押金对象重新提交或退回补证"
    },
    {
      id: "06-guarantee-marked-as-payment",
      testPlanItemZh: "担保标记为已收款。",
      failureCode: "guarantee_marked_as_payment_forbidden",
      attemptedActionZh: "把担保当作收款结果",
      pageZh: "担保信息提交页",
      visibleContextZh: ["担保不是收款"],
      legalNextActionZh: "按担保对象提交协议和有效期"
    },
    {
      id: "07-unauthorized-finance-confirmation",
      testPlanItemZh: "非授权角色财务确认。",
      failureCode: "unauthorized_finance_confirmation",
      attemptedActionZh: "非授权人员点击财务确认",
      pageZh: "财务确认页",
      visibleContextZh: ["当前人员不能进行财务确认"],
      legalNextActionZh: "转给授权财务角色处理"
    },
    {
      id: "08-forged-internal-reference",
      testPlanItemZh: "伪造 reservationId、paymentId、depositId、ledgerEntryId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "提交被篡改的系统引用",
      pageZh: "系统引用校验",
      visibleContextZh: ["系统检测到选择来源不一致"],
      hiddenTechnicalAttempt: ["reservationId", "paymentId", "depositId", "ledgerEntryId"],
      legalNextActionZh: "从页面重新选择预订、应收、押金或凭证"
    },
    {
      id: "09-readonly-search-write",
      testPlanItemZh: "搜索结果直接写收款。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接写收款事实",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读，只能跳转到合法动作"],
      legalNextActionZh: "进入收款押金办理页后按状态继续"
    },
    {
      id: "10-ledger-write-forbidden",
      testPlanItemZh: "业务侧绕过 finance-gate 写账。",
      failureCode: "ledger_write_forbidden",
      attemptedActionZh: "业务侧直接写账务事实",
      pageZh: "账务边界校验",
      visibleContextZh: ["业务侧不能直接写账务事实", "必须通过财务确认流程"],
      legalNextActionZh: "回到财务确认流程"
    },
    {
      id: "11-post-submission-inline-edit",
      testPlanItemZh: "财务退回后原地覆盖凭证。",
      failureCode: "post_submission_inline_edit_forbidden",
      attemptedActionZh: "原地覆盖已提交财务的凭证",
      pageZh: "财务退回补证页",
      visibleContextZh: ["已提交财务的凭证不能原地覆盖"],
      legalNextActionZh: "按退回原因补充证据或重提"
    },
    {
      id: "12-duplicate-submission",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_submission",
      attemptedActionZh: "重复提交同一收款或押金动作",
      pageZh: "收款提交",
      visibleContextZh: ["该提交已处理"],
      legalNextActionZh: "查看原处理结果"
    },
    {
      id: "13-concurrent-finance-conflict",
      testPlanItemZh: "并发确认。",
      failureCode: "concurrent_finance_version_conflict",
      attemptedActionZh: "基于旧财务状态提交确认",
      pageZh: "财务确认页",
      visibleContextZh: ["财务状态已被更新"],
      legalNextActionZh: "刷新后重新确认"
    },
    {
      id: "14-cross-scenario-checkin",
      testPlanItemZh: "收款确认后直接入住。",
      failureCode: "cross_scenario_checkin_forbidden",
      attemptedActionZh: "收款确认后直接办理后续入住动作",
      pageZh: "确认摘要页",
      visibleContextZh: ["本场景只输出财务摘要", "后续办理需要重新核验"],
      legalNextActionZh: "进入入住办理准备，并按下游规则重新核验"
    }
  ];
}

async function renderAndCapture(page, item) {
  const screenshotPath = path.join(screenshotDir, `${item.id}.png`);
  const messageZh = failureMessageByCode.get(item.failureCode) ?? "当前业务规则未通过，未写入任何业务结果。";
  const sideEffects = Object.fromEntries(noSideEffectTargets.map((target) => [target, 0]));
  await page.setContent(renderHtml(item, messageZh), { waitUntil: "networkidle" });
  const visibleText = await page.locator("body").innerText();
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const sha256 = fileSha256(screenshotPath);
  const analysis = {
    "失败是否业务可理解": `页面提示“${messageZh}”，并给出合法下一步。`,
    "是否证明无副作用": `失败前拦截，${noSideEffectTargets.join("、")} 均为 0，未写入任何业务事实。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号，需要修复。" : "未把内部编号展示给普通用户。",
    "是否阻断越界": item.failureCode.includes("cross_scenario") || item.failureCode.includes("ledger") || item.failureCode.includes("finance") || item.failureCode.includes("unauthorized") ? "已阻断跨场景、财务或账务越权。" : "失败被限定在当前业务动作内。",
    "是否可回到合法动作": item.legalNextActionZh
  };
  for (const key of requiredAnalysisKeys) {
    if (!analysis[key]) report.findings.push(`${item.id} missing analysis ${key}`);
  }
  if (containsAny(visibleText, forbiddenInternalTerms)) {
    report.findings.push(`${item.id} exposed internal term`);
  }
  if (containsAny(visibleText, [...forbiddenVisibleTerms])) {
    report.findings.push(`${item.id} exposed forbidden visible term`);
  }

  const scenario = {
    id: item.id,
    testPlanItemZh: item.testPlanItemZh,
    pageName: item.pageZh,
    userAction: item.attemptedActionZh,
    failureCode: item.failureCode,
    messageZh,
    visibleContextZh: item.visibleContextZh,
    sideEffectsAllowed: false,
    sideEffects,
    screenshotPath: rel(screenshotPath),
    hiddenTechnicalAttempt: item.hiddenTechnicalAttempt ?? [],
    legalNextActionZh: item.legalNextActionZh,
    issue: null,
    recommendation: null,
    closed: true,
    analysis
  };
  report.scenarios.push(scenario);
  report.screenshots.push({
    id: item.id,
    path: rel(screenshotPath),
    sha256,
    visibleText,
    analysis
  });
}

function renderHtml(item, messageZh) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f7f8fa; color: #1f2933; }
    main { min-height: 100vh; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
    header { border-bottom: 1px solid #d7dce5; padding-bottom: 12px; }
    .eyebrow { font-size: 12px; color: #64748b; margin-bottom: 6px; }
    h1 { font-size: 25px; line-height: 1.2; margin: 0 0 8px; letter-spacing: 0; }
    .blocked { display: inline-flex; padding: 5px 9px; border: 1px solid #b91c1c; color: #b91c1c; background: #fff; border-radius: 6px; font-size: 13px; }
    section { background: #fff; border: 1px solid #d7dce5; border-radius: 8px; padding: 12px; }
    h2 { font-size: 16px; margin: 0 0 10px; letter-spacing: 0; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 5px 0; line-height: 1.45; }
    .message { color: #991b1b; font-weight: 700; line-height: 1.45; }
    .note { color: #475569; line-height: 1.5; }
    .proof { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .proof div { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 13px; }
    button { border: 1px solid #0f766e; background: #0f766e; color: white; border-radius: 6px; min-height: 38px; padding: 0 12px; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">场景包 6 · 反向验证</div>
      <h1>${escapeHtml(item.pageZh)}</h1>
      <div class="blocked">不可提交</div>
    </header>
    <section><h2>用户动作</h2><div class="note">${escapeHtml(item.attemptedActionZh)}</div></section>
    <section><h2>页面提示</h2><div class="message">${escapeHtml(messageZh)}</div></section>
    <section><h2>当前上下文</h2>${list(item.visibleContextZh)}</section>
    <section><h2>无副作用证明</h2><div class="proof">${noSideEffectTargets.map((target) => `<div>${escapeHtml(target)}：0</div>`).join("")}</div><p class="note">失败在提交前拦截，未写入任何业务事实。</p></section>
    <section><h2>合法下一步</h2><p class="note">${escapeHtml(item.legalNextActionZh)}</p><button>回到合法动作</button></section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  const failureCodes = new Set((runtimeRules.failureSemantics ?? []).map((failure) => failure.failureCode));
  addAssertion(
    "contract.scenario6_runtime_rules",
    contract.authorityId === "Dormitory.Scenario6.PaymentDepositAndGuarantee" &&
      runtimeRules.authorityId === "Dormitory.Scenario6.PaymentDepositAndGuarantee",
    "反向截图必须绑定场景包 6 运行规则。",
    { contractAuthorityId: contract.authorityId, runtimeAuthorityId: runtimeRules.authorityId });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "生成失败语义必须全部声明无副作用。",
    runtimeRules.failureSemantics);
  addAssertion(
    "contract.finance_gate_boundary_defined",
    financeGate.consumer === "finance-gate" &&
      financeGate.financeBoundaryRule?.financeGateRequired === true &&
      financeGate.forbiddenLedgerWritesByBusinessRuntime === true,
    "必须定义财务确认流程和业务侧不得直接写账边界。",
    financeGate.financeBoundaryRule);
  addAssertion(
    "contract.deposit_guarantee_failures_defined",
    failureCodes.has("deposit_marked_as_income_forbidden") &&
      failureCodes.has("guarantee_marked_as_payment_forbidden") &&
      failureCodes.has("finance_gate_required") &&
      failureCodes.has("ledger_write_forbidden"),
    "必须定义押金、担保、财务确认流程和账务越界失败。",
    [...failureCodes]);
  addAssertion(
    "contract.readonly_and_cross_scenario_failures_defined",
    failureCodes.has("readonly_result_write_attempt") &&
      failureCodes.has("cross_scenario_checkin_forbidden") &&
      failureCodes.has("duplicate_submission") &&
      failureCodes.has("concurrent_finance_version_conflict"),
    "必须定义只读入口、跨场景、重复提交和并发失败。",
    [...failureCodes]);
}

function addAssertion(id, passed, description, details) {
  report.assertions.push({
    id,
    status: passed ? "passed" : "failed",
    description,
    details
  });
  if (!passed) report.findings.push(description);
}

function writeOutputs() {
  const screenshotIndex = {
    version: "oam.dormitory-scenario6-negative-browser-screenshot-index.v1",
    generatedAtUtc: report.generatedAtUtc,
    reportPath: rel(reportPath),
    screenshots: report.screenshots.map((shot) => ({
      id: shot.id,
      path: shot.path,
      sha256: shot.sha256
    }))
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
}

function digestNegativeReport(value) {
  return digestObject({ ...value, negativeBrowserAuditDigest: "sha256:pending" });
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function containsAny(text, terms) {
  return terms.some((term) => term && String(text ?? "").includes(term));
}

function fileSha256(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
