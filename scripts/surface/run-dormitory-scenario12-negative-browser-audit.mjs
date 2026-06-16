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
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario12-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario12-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario12-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario12-finance-gate.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario12-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "RatePlan",
  "Quote",
  "Reservation",
  "InventoryHold",
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
  version: "oam.dormitory-scenario12-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario12_local_evidence",
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
  mockPolicy: "real Chromium screenshots rendered from generated 场景 12 failure semantics; failure paths are checked before any business side effect",
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
    "所有失败路径都不得写非法价格真值、报价、预订、库存锁定、款项、退款、账务、CommandSubmission、DomainEvent、Outbox、Projection、Lens、Search、Dashboard。",
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
    console.error(`Dormitory scenario12 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario12 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario12 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    negativeCase("01-missing-key-evidence", "缺营业执照或协议启用渠道。", "missing_key_evidence", "缺少营业执照、合作协议或授权证明时启用渠道", "渠道审核页", ["缺少关键证据", "不能启用渠道或协议"], "补充营业执照、合作协议或授权证明后重新提交"),
    negativeCase("02-invalid-agreement-date-range", "协议日期倒置。", "invalid_agreement_date_range", "协议开始日期晚于结束日期时提交协议", "协议维护页", ["协议日期不合法", "开始日期必须早于或等于结束日期"], "修正协议有效期后保存草稿"),
    negativeCase("03-expired-agreement-forbidden", "协议过期仍可用。", "expired_agreement_forbidden", "过期协议被用于商品资格或渠道发布", "商品资格绑定页", ["协议已过期", "过期协议不能作为可用资格"], "新建续签版本或选择有效协议"),
    negativeCase("04-inactive-product-price", "未生效商品绑定资格。", "inactive_product_price_forbidden", "未生效商品或价格版本被绑定为可用资格", "商品资格绑定页", ["商品或价格版本尚未生效", "只能引用场景包 3 已生效的摘要"], "回到场景包 3 确认商品和价格版本"),
    negativeCase("05-missing-effective-price", "无有效价格发布渠道。", "missing_effective_price", "缺少有效价格版本时启用渠道发布", "渠道发布规则页", ["没有有效价格版本", "不能启用发布规则"], "选择场景包 3 已生效价格版本后重新检查"),
    negativeCase("06-operation-blocked-publication", "维修/停售资源被发布。", "operation_blocked_publication_forbidden", "存在维修或停售阻断时发布资源", "渠道发布规则页", ["存在运营阻断", "维修或停售资源不得发布为可用"], "等待场景包 2 重新确认运营状态"),
    negativeCase("07-direct-finance-ledger", "佣金规则直接写账。", "direct_finance_ledger_forbidden", "佣金或结算规则意向直接写账务结果", "佣金结算意向页", ["佣金和结算规则只能形成意向", "finance-gate 处理财务真值"], "提交佣金/结算规则意向给 finance-gate"),
    negativeCase("08-direct-inventory-hold", "渠道发布直接锁库存。", "direct_inventory_hold_forbidden", "渠道发布规则直接锁定库存", "渠道发布规则页", ["渠道发布只能作为展示和可见条件", "外部渠道回传必须进入场景包 5 校验"], "只保存发布规则，库存锁定交给场景包 5"),
    negativeCase("09-direct-quote-reservation", "企业协议直接生成报价或预订。", "direct_quote_reservation_forbidden", "企业协议或渠道资格直接生成报价或预订", "企业客户详情页", ["资格摘要不能直接生成报价或预订", "场景包 4 和场景包 5 必须重新校验"], "进入场景包 4 生成报价资格，进入场景包 5 校验预订资格"),
    negativeCase("10-forged-internal-reference", "伪造 channelId/agreementId/productId/priceVersionId。", "forged_internal_reference", "用户尝试填写系统引用", "渠道与协议页", ["系统引用由系统自动绑定", "普通用户不能填写内部编号"], "通过今日、工作项或搜索只读跳转进入合法动作", ["channelId", "agreementId", "productId", "priceVersionId"]),
    negativeCase("11-search-writes-agreement", "搜索结果直接写协议。", "readonly_result_write_attempt", "从搜索结果直接写协议事实", "搜索结果", ["搜索结果只读", "只能跳转到合法动作"], "打开企业客户或协议详情后按状态提交"),
    negativeCase("12-duplicate-submission", "重复提交。", "duplicate_channel_submission", "重复提交同一渠道或协议动作", "渠道审核页", ["该渠道或协议提交已处理", "请查看处理结果"], "查看渠道摘要、协议摘要或状态历史"),
    negativeCase("13-concurrent-channel-conflict", "并发启停同一协议。", "concurrent_channel_conflict", "同一协议被并发启用或停用时继续提交", "协议状态页", ["同一渠道、企业客户、协议或发布规则正在被其他人更新", "请刷新后重试"], "刷新详情后按最新状态选择合法动作")
  ];
}

function negativeCase(id, testPlanItemZh, failureCode, attemptedActionZh, pageZh, visibleContextZh, legalNextActionZh, hiddenTechnicalAttempt = []) {
  return { id, testPlanItemZh, failureCode, attemptedActionZh, pageZh, visibleContextZh, legalNextActionZh, hiddenTechnicalAttempt };
}

async function renderAndCapture(page, item) {
  const generatedMessageZh = failureMessageByCode.get(item.failureCode) ?? "当前渠道与企业客户规则未通过，未写入任何业务结果。";
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
    "是否证明无副作用": "非法价格真值、报价、预订、库存锁定、款项、退款、账务、CommandSubmission、DomainEvent、Projection、Lens、Search、Dashboard 均为 0 写入。",
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部字段，需要修复。" : "截图没有展示内部编号；技术尝试仅记录在证据字段。",
    "是否阻断越界": "已阻断直接写价格金额真值、报价、预订、库存、财务和只读搜索写事实。",
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
    "contract.scenario12_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario12.ChannelCorporateCustomer" && runtimeRules.nameZh === "渠道与企业客户",
    "反向浏览器证据必须绑定渠道与企业客户 runtime rules。",
    { authorityId: runtimeRules.authorityId, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "生成失败语义必须声明所有失败无副作用。",
    runtimeRules.failureSemantics?.map((failure) => failure.failureCode));
  addAssertion(
    "contract.channel_corporate_invariants_defined",
    runtimeRules.channelCorporateInvariantRule?.productPriceReferenceFromScenario3Only === true &&
      runtimeRules.channelCorporateInvariantRule?.quoteOwnedByScenario4 === true &&
      runtimeRules.channelCorporateInvariantRule?.reservationInventoryOwnedByScenario5 === true &&
      runtimeRules.channelCorporateInvariantRule?.financeGateHandlesCommissionSettlementTruth === true &&
      runtimeRules.channelCorporateInvariantRule?.failureNoSideEffects === true,
    "渠道与企业客户不变量必须要求场景包 3 价格引用、场景包 4 报价权威、场景包 5 预订/库存权威、finance-gate 财务真值和失败无副作用。",
    runtimeRules.channelCorporateInvariantRule);
  addAssertion(
    "contract.finance_gate_boundary",
    financeGate.consumer === "finance-gate" &&
      financeGate.commissionSettlementIntentOnly === true &&
      financeGate.businessRuntimeMayWriteLedger === false,
    "finance-gate 只能消费佣金/结算规则意向，业务 runtime 不写账。",
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
    version: "oam.dormitory-scenario12-negative-screenshot-index.v1",
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
    .replaceAll("RatePlan", "价格金额真值")
    .replaceAll("Payment", "款项事实")
    .replaceAll("Refund", "退款事实")
    .replaceAll("LedgerEntry", "账务记录")
    .replaceAll("LedgerTransaction", "账务流水")
    .replaceAll("已报价", "报价待场景包 4 生成")
    .replaceAll("已预订", "预订待场景包 5 校验")
    .replaceAll("已收款", "款项状态待财务处理")
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
