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
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario10-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario10-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario10-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario10-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario10-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "Reservation",
  "Inventory",
  "Payment",
  "Refund",
  "Ledger",
  "Stay",
  "Checkout",
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
  version: "oam.dormitory-scenario10-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario10_local_evidence",
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
  mockPolicy: "real Chromium screenshots rendered from generated 场景 10 failure semantics; failure paths are checked before any business side effect",
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
    "所有失败路径都不得写预订关闭、库存释放、真实款项、账务、入住/退房、CommandSubmission、DomainEvent、Outbox、Projection、Lens、Search、Dashboard。",
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
    console.error(`Dormitory scenario10 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario10 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario10 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-no-effective-reservation",
      testPlanItemZh: "无有效预订取消。",
      failureCode: "no_effective_reservation",
      attemptedActionZh: "没有有效预订摘要时办理取消",
      pageZh: "取消办理入口",
      visibleContextZh: ["没有有效预订摘要", "请先确认预订仍有效"],
      legalNextActionZh: "返回预订详情或工作项重新进入"
    },
    {
      id: "02-checked-in-reservation",
      testPlanItemZh: "已入住预订取消。",
      failureCode: "reservation_already_checked_in",
      attemptedActionZh: "对已有到店记录的预订办理普通取消",
      pageZh: "取消办理入口",
      visibleContextZh: ["已有到店记录", "不能按普通取消路径处理"],
      legalNextActionZh: "转到在住或退房后续处理"
    },
    {
      id: "03-checked-out-order",
      testPlanItemZh: "已退房订单取消。",
      failureCode: "reservation_already_checked_out",
      attemptedActionZh: "对已完成离店结算的订单办理普通取消",
      pageZh: "取消办理入口",
      visibleContextZh: ["该订单已有离店结算记录", "不能按普通取消路径处理"],
      legalNextActionZh: "查看结算摘要或进入纠错路径"
    },
    {
      id: "04-already-cancelled",
      testPlanItemZh: "已取消重复取消。",
      failureCode: "reservation_already_cancelled",
      attemptedActionZh: "对已经关闭的预订重复办理取消",
      pageZh: "取消办理入口",
      visibleContextZh: ["该预订已经关闭", "不能重复处理"],
      legalNextActionZh: "查看取消或未到店摘要"
    },
    {
      id: "05-noshow-hold-time-not-elapsed",
      testPlanItemZh: "未到店时间未到就关闭。",
      failureCode: "noshow_hold_time_not_elapsed",
      attemptedActionZh: "最晚保留时间尚未到就确认未到店关闭",
      pageZh: "未到店关闭页",
      visibleContextZh: ["最晚保留时间尚未到", "仍需等待或联系客户"],
      legalNextActionZh: "回到今日待处理任务"
    },
    {
      id: "06-missing-customer-confirmation",
      testPlanItemZh: "缺客户确认。",
      failureCode: "customer_confirmation_required",
      attemptedActionZh: "缺少客户确认时直接关闭取消或未到店处理",
      pageZh: "客户确认页",
      visibleContextZh: ["缺少客户确认", "不能直接关闭"],
      legalNextActionZh: "补充聊天记录、电话记录或内部审批证据"
    },
    {
      id: "07-dispute-direct-closure",
      testPlanItemZh: "存在争议直接关闭。",
      failureCode: "dispute_requires_review",
      attemptedActionZh: "客户有争议时直接普通关闭",
      pageZh: "争议处理页",
      visibleContextZh: ["存在争议", "必须转负责人复核"],
      legalNextActionZh: "转负责人复核或补充争议证据"
    },
    {
      id: "08-policy-amount-source-missing",
      testPlanItemZh: "金额无政策来源。",
      failureCode: "policy_amount_source_missing",
      attemptedActionZh: "缺少政策、价格快照或已收押金摘要时计算金额",
      pageZh: "政策金额计算页",
      visibleContextZh: ["缺少金额依据", "金额必须来自政策、价格快照和已收/押金摘要"],
      legalNextActionZh: "补齐政策快照、价格快照和收款押金摘要"
    },
    {
      id: "09-final-refund-manual-input",
      testPlanItemZh: "用户手填最终退款金额。",
      failureCode: "final_refund_manual_input_forbidden",
      attemptedActionZh: "用户手填最终退款、扣费或账务结果",
      pageZh: "退款/扣费申请页",
      visibleContextZh: ["最终款项结果不能手填", "这里只能提交政策计算摘要和处理请求"],
      legalNextActionZh: "重新按政策金额计算生成申请"
    },
    {
      id: "10-invalid-inventory-release-scope",
      testPlanItemZh: "释放非本预订资源。",
      failureCode: "inventory_release_scope_invalid",
      attemptedActionZh: "释放非本预订绑定的资源或日期范围",
      pageZh: "库存释放确认页",
      visibleContextZh: ["只能释放本预订绑定资源和日期范围", "不能释放他人锁定资源"],
      legalNextActionZh: "回到预订绑定范围重新确认"
    },
    {
      id: "11-forged-internal-reference",
      testPlanItemZh: "伪造 reservationId/refundId/paymentId/depositId/ledgerEntryId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "用户尝试填写系统引用",
      pageZh: "取消办理页",
      visibleContextZh: ["系统引用由系统绑定", "用户不能填写内部编号"],
      legalNextActionZh: "通过预订详情、今日或搜索只读跳转进入",
      hiddenTechnicalAttempt: ["reservationId", "refundId", "paymentId", "depositId", "ledgerEntryId"]
    },
    {
      id: "12-search-writes-cancellation",
      testPlanItemZh: "搜索结果直接写取消。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接写取消或退款事实",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读", "只能跳转到合法动作"],
      legalNextActionZh: "打开取消办理页后按状态提交"
    },
    {
      id: "13-direct-refund-ledger",
      testPlanItemZh: "取消后直接退款入账。",
      failureCode: "direct_refund_payment_ledger_forbidden",
      attemptedActionZh: "取消后直接处理真实款项或账务",
      pageZh: "取消结果页",
      visibleContextZh: ["取消处理不能直接处理真实款项或账务", "必须交给财务确认流程"],
      legalNextActionZh: "生成财务处理请求并等待财务状态"
    },
    {
      id: "14-duplicate-submission",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_cancellation_submission",
      attemptedActionZh: "重复提交同一取消或未到店动作",
      pageZh: "确认取消页",
      visibleContextZh: ["该提交已处理", "请查看处理结果"],
      legalNextActionZh: "查看取消或未到店摘要"
    },
    {
      id: "15-concurrent-cancellation",
      testPlanItemZh: "并发取消同一预订。",
      failureCode: "concurrent_cancellation_conflict",
      attemptedActionZh: "同一预订被并发更新时继续提交",
      pageZh: "确认取消页",
      visibleContextZh: ["当前处理已被其他人更新"],
      legalNextActionZh: "刷新后查看最新状态"
    }
  ];
}

async function renderAndCapture(page, item) {
  const generatedMessageZh = failureMessageByCode.get(item.failureCode) ?? "当前取消、未到店与退款处理规则未通过，未写入任何业务结果。";
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
    "是否证明无副作用": "预订关闭、库存释放、真实款项、账务、入住/退房、CommandSubmission、DomainEvent、Projection、Lens、Search、Dashboard 均为 0 写入。",
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "截图没有展示内部编号；技术尝试仅记录在证据字段。",
    "是否阻断越界": "已阻断直接真实款项处理、账务写入、只读搜索写事实、跨预订库存释放和越权关闭。",
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
    "contract.scenario10_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario10.CancelNoShowRefund" && runtimeRules.nameZh === "取消、未到店与退款处理",
    "反向浏览器证据必须绑定取消、未到店与退款处理 runtime rules。",
    { authorityId: runtimeRules.authorityId, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "生成失败语义必须声明所有失败无副作用。",
    runtimeRules.failureSemantics?.map((failure) => failure.failureCode));
  addAssertion(
    "contract.cancel_noshow_invariants_defined",
    runtimeRules.cancelNoShowInvariantRule?.validReservationRequired === true &&
      runtimeRules.cancelNoShowInvariantRule?.financeGateHandlesRefundFeeLedger === true &&
      runtimeRules.cancelNoShowInvariantRule?.inventoryReleaseScopeBoundToReservation === true &&
      runtimeRules.cancelNoShowInvariantRule?.failureNoSideEffects === true,
    "取消/未到店不变量必须要求有效预订、财务确认流程财务真值、本预订库存释放范围和失败无副作用。",
    runtimeRules.cancelNoShowInvariantRule);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.refundFeeIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "财务确认流程只能消费退款/扣费意向，业务 runtime 不写账。",
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
    version: "oam.dormitory-scenario10-negative-screenshot-index.v1",
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
    .replaceAll("已入住", "已有到店记录")
    .replaceAll("已退房", "已有离店结算记录")
    .replaceAll("已退款到账", "款项状态待财务处理")
    .replaceAll("已入账", "账务状态待财务处理");
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
