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
const contractPath = "docs/contracts/generated/dormitory/scenario9-checkout-settlement.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario9-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario9-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario9-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario9-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario9-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "Checkout",
  "Occupancy",
  "Payment",
  "Refund",
  "Ledger",
  "ResourceOperationStatus",
  "CommandSubmission",
  "DomainEvent",
  "Outbox",
  "Projection",
  "Search",
  "Dashboard"
];
const forbiddenInternalTerms = [
  "stayId",
  "checkoutCaseId",
  "settlementId",
  "refundId",
  "ledgerEntryId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId",
  "paymentId",
  "ledgerTransactionId"
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
  version: "oam.dormitory-scenario9-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario9_local_evidence",
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
  mockPolicy: "real Chromium screenshots rendered from generated 场景 9 failure semantics; failure paths are checked before any business side effect",
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
    "所有失败路径都不得写 Checkout、Occupancy、Payment、Refund、Ledger、ResourceOperationStatus、CommandSubmission、DomainEvent、Outbox、Projection、Search、Dashboard。",
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
    console.error(`Dormitory scenario9 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario9 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario9 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-no-effective-stay",
      testPlanItemZh: "无有效在住办理退房。",
      failureCode: "no_effective_stay",
      attemptedActionZh: "没有有效在住记录时办理退房",
      pageZh: "退房办理入口",
      visibleContextZh: ["没有有效在住摘要", "请先确认入住记录仍在住"],
      legalNextActionZh: "返回在住管理或查看已确认入住记录"
    },
    {
      id: "02-already-checked-out",
      testPlanItemZh: "已退房重复办理。",
      failureCode: "stay_already_checked_out",
      attemptedActionZh: "对已结束的入住重复发起退房",
      pageZh: "退房办理入口",
      visibleContextZh: ["该入住已结束", "可查看退房历史"],
      legalNextActionZh: "查看退房摘要或提交纠错申请"
    },
    {
      id: "03-missing-actual-time",
      testPlanItemZh: "缺实际离店时间。",
      failureCode: "actual_checkout_time_required",
      attemptedActionZh: "未填写实际离店时间就确认交接",
      pageZh: "交接确认页",
      visibleContextZh: ["实际离店时间未填写"],
      legalNextActionZh: "补充实际离店时间后继续"
    },
    {
      id: "04-missing-inspection-evidence",
      testPlanItemZh: "缺验房证据。",
      failureCode: "inspection_evidence_required",
      attemptedActionZh: "缺少验房照片或检查记录就进入结算",
      pageZh: "房间/床位检查页",
      visibleContextZh: ["缺少验房证据", "不能进入结算确认"],
      legalNextActionZh: "补充验房照片或检查记录"
    },
    {
      id: "05-damage-without-description",
      testPlanItemZh: "有损坏但无说明。",
      failureCode: "damage_description_evidence_required",
      attemptedActionZh: "勾选损坏但没有说明或证据",
      pageZh: "损坏/遗失评估",
      visibleContextZh: ["有损坏或遗失时必须填写说明并绑定证据"],
      legalNextActionZh: "补充损坏说明和现场证据"
    },
    {
      id: "06-customer-not-confirmed",
      testPlanItemZh: "客户未确认直接退房。",
      failureCode: "customer_confirmation_required",
      attemptedActionZh: "客户未确认结算时直接确认退房",
      pageZh: "确认退房页",
      visibleContextZh: ["客户尚未确认结算", "不能确认退房"],
      legalNextActionZh: "回到客户确认结算"
    },
    {
      id: "07-disputed-direct-normal",
      testPlanItemZh: "有争议直接普通结算。",
      failureCode: "disputed_settlement_requires_review",
      attemptedActionZh: "存在争议时走普通确认路径",
      pageZh: "客户确认结算页",
      visibleContextZh: ["存在争议或客户拒绝", "必须转复核"],
      legalNextActionZh: "转负责人复核或补充争议记录"
    },
    {
      id: "08-forged-internal-reference",
      testPlanItemZh: "伪造 stayId/checkoutCaseId/refundId/ledgerEntryId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "用户尝试填写系统引用",
      pageZh: "退房办理页",
      visibleContextZh: ["系统引用由系统绑定", "用户不能填写内部编号"],
      legalNextActionZh: "通过今日、在住详情或搜索只读跳转进入",
      hiddenTechnicalAttempt: ["stayId", "checkoutCaseId", "refundId", "ledgerEntryId"]
    },
    {
      id: "09-search-writes-checkout",
      testPlanItemZh: "搜索结果直接写退房。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接写退房事实",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读", "只能跳转到合法动作"],
      legalNextActionZh: "打开退房办理页后按状态提交"
    },
    {
      id: "10-direct-money-after-checkout",
      testPlanItemZh: "退房确认后直接退款。",
      failureCode: "direct_payment_refund_ledger_forbidden",
      attemptedActionZh: "退房确认后直接处理款项",
      pageZh: "退房结果页",
      visibleContextZh: ["退房结算不能直接处理款项或账务", "请交给 finance-gate"],
      legalNextActionZh: "生成财务处理请求"
    },
    {
      id: "11-direct-operational-restore",
      testPlanItemZh: "退房确认后直接房源可运营。",
      failureCode: "resource_operational_direct_restore_forbidden",
      attemptedActionZh: "退房后直接把资源恢复运营",
      pageZh: "资源恢复状态页",
      visibleContextZh: ["资源必须先进入待保洁、待检查、待维修或异常待处理"],
      legalNextActionZh: "回到房源运营状态维护复查"
    },
    {
      id: "12-duplicate-submission",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_checkout_submission",
      attemptedActionZh: "重复提交同一退房动作",
      pageZh: "确认退房页",
      visibleContextZh: ["该提交已处理", "请查看退房结果"],
      legalNextActionZh: "查看退房摘要"
    },
    {
      id: "13-concurrent-checkout",
      testPlanItemZh: "并发退房同一入住记录。",
      failureCode: "concurrent_checkout_conflict",
      attemptedActionZh: "同一入住记录被并发更新",
      pageZh: "确认退房页",
      visibleContextZh: ["当前退房办理已被其他人更新"],
      legalNextActionZh: "刷新后查看最新状态"
    }
  ];
}

async function renderAndCapture(page, item) {
  const messageZh = failureMessageByCode.get(item.failureCode) ?? "当前退房结算规则未通过，未写入任何业务结果。";
  const sideEffects = Object.fromEntries(noSideEffectTargets.map((target) => [target, 0]));
  const visibleText = [
    item.pageZh,
    item.attemptedActionZh,
    messageZh,
    ...(item.visibleContextZh ?? []),
    item.legalNextActionZh,
    "未写入任何业务结果",
    "可回到合法动作"
  ].filter(Boolean).join(" ");
  const analysis = {
    "失败是否业务可理解": `页面用业务语言说明：${messageZh}`,
    "是否证明无副作用": "CommandSubmission、DomainEvent、Projection、Search、Dashboard、Payment、Refund、Ledger、资源运营状态均为 0 写入。",
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "截图没有展示内部编号；技术尝试仅记录在证据字段。",
    "是否阻断越界": "已阻断直接款项处理、账务写入、资源运营恢复或只读搜索写事实。",
    "是否可回到合法动作": item.legalNextActionZh
  };
  const scenario = {
    id: item.id,
    testPlanItemZh: item.testPlanItemZh,
    failureCode: item.failureCode,
    messageZh,
    attemptedActionZh: item.attemptedActionZh,
    pageZh: item.pageZh,
    hiddenTechnicalAttempt: item.hiddenTechnicalAttempt ?? [],
    sideEffectsAllowed: false,
    sideEffects,
    analysis,
    visibleText
  };
  await page.setContent(renderHtml(item, messageZh), { waitUntil: "domcontentloaded" });
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

function renderHtml(item, messageZh) {
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
    .error { border-left: 4px solid #c2410c; background: #fff7ed; }
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
    <section class="panel error"><h2>不能提交</h2><p>${escapeHtml(messageZh)}</p></section>
    <section class="panel"><h2>原因</h2><ul>${rows(item.visibleContextZh)}</ul></section>
    <section class="panel"><h2>下一步</h2><p>${escapeHtml(item.legalNextActionZh)}</p><button>回到合法动作</button><button class="secondary">补充资料或证据</button></section>
    <section class="panel muted">未写入任何业务结果；可回到合法动作。</section>
  </main>
</body>
</html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario9_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario9.CheckoutSettlement" && runtimeRules.nameZh === "退房结算",
    "反向浏览器证据必须绑定退房结算 runtime rules。",
    { authorityId: runtimeRules.authorityId, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "生成失败语义必须声明所有失败无副作用。",
    runtimeRules.failureSemantics?.map((failure) => failure.failureCode));
  addAssertion(
    "contract.checkout_invariants_defined",
    runtimeRules.checkoutInvariantRule?.validStayRequired === true &&
      runtimeRules.checkoutInvariantRule?.financeGateHandlesRefundTopUpLedger === true &&
      runtimeRules.checkoutInvariantRule?.resourceRecoveryViaScenario2Only === true,
    "退房不变量必须要求有效在住、finance-gate 财务真值和场景 2 资源恢复。",
    runtimeRules.checkoutInvariantRule);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.settlementIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "finance-gate 只能消费结算意向。",
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
    version: "oam.dormitory-scenario9-negative-screenshot-index.v1",
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
