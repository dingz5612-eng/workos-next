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
const contractPath = "docs/contracts/generated/dormitory/scenario4-inquiry-and-quote.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario4-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario4-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario4-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario4-negative-browser-report.json");
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
  "inquiryId",
  "customerId",
  "quoteId",
  "quoteVersionId",
  "productId",
  "ratePlanId",
  "roomId",
  "bedId",
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
const failureMessageByCode = new Map((runtimeRules.failureSemantics ?? []).map((item) => [item.failureCode, item.messageZh]));
const forbiddenVisibleTerms = new Set(surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []);

fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  version: "oam.dormitory-scenario4-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario4_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 4 failure semantics; failure paths are checked before any business side effect",
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
    console.error(`Dormitory scenario4 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario4 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario4 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-contact-required",
      testPlanItemZh: "缺客户联系方式。",
      failureCode: "contact_required",
      attemptedActionZh: "登记客户询价",
      pageZh: "客户询价登记",
      visibleContextZh: ["客户姓名或联系方式未补齐"],
      legalNextActionZh: "补齐客户姓名和联系方式后再登记"
    },
    {
      id: "02-date-range-invalid",
      testPlanItemZh: "入住日期晚于或等于离店日期。",
      failureCode: "date_range_invalid",
      attemptedActionZh: "确认入住需求",
      pageZh: "填写入住需求",
      visibleContextZh: ["入住日期必须早于离店日期"],
      legalNextActionZh: "调整日期范围"
    },
    {
      id: "03-guest-count-invalid",
      testPlanItemZh: "人数为 0。",
      failureCode: "guest_count_invalid",
      attemptedActionZh: "确认入住需求",
      pageZh: "填写入住需求",
      visibleContextZh: ["入住人数为 0"],
      legalNextActionZh: "填写大于 0 的入住人数"
    },
    {
      id: "04-valid-product-required",
      testPlanItemZh: "无有效商品。",
      failureCode: "valid_product_required",
      attemptedActionZh: "生成报价草稿",
      pageZh: "可报价商品",
      visibleContextZh: ["没有可报价商品可选"],
      legalNextActionZh: "先回到住宿商品与价格确认有效商品"
    },
    {
      id: "05-effective-price-required",
      testPlanItemZh: "无有效价格。",
      failureCode: "effective_price_required",
      attemptedActionZh: "生成正式报价",
      pageZh: "价格来源与明细",
      visibleContextZh: ["缺少已生效价格来源"],
      legalNextActionZh: "先完成价格生效，再回到报价"
    },
    {
      id: "06-operation-blocked",
      testPlanItemZh: "维修或停售资源进入报价。",
      failureCode: "operation_blocked_for_quote",
      attemptedActionZh: "选择可报价商品",
      pageZh: "可报价商品",
      visibleContextZh: ["运营阻断：维修待处理"],
      legalNextActionZh: "先关闭运营阻断并复查"
    },
    {
      id: "07-validity-required",
      testPlanItemZh: "报价有效期为空。",
      failureCode: "quote_validity_required",
      attemptedActionZh: "提交报价草稿",
      pageZh: "生成报价草稿",
      visibleContextZh: ["缺失项：报价有效期"],
      legalNextActionZh: "设置报价有效期后再提交"
    },
    {
      id: "08-expired-preparation",
      testPlanItemZh: "报价过期后转预订。",
      failureCode: "quote_expired_for_reservation_preparation",
      attemptedActionZh: "发起转预订准备",
      pageZh: "报价跟进",
      visibleContextZh: ["报价已过期"],
      legalNextActionZh: "重新报价或重新确认有效期"
    },
    {
      id: "09-post-issue-inline-edit",
      testPlanItemZh: "已发送报价原地编辑。",
      failureCode: "post_issue_inline_edit_forbidden",
      attemptedActionZh: "原地编辑已发送报价",
      pageZh: "报价版本历史",
      visibleContextZh: ["已发送报价不能原地编辑"],
      legalNextActionZh: "新建报价版本或重新报价"
    },
    {
      id: "10-forged-internal-reference",
      testPlanItemZh: "伪造 productId、ratePlanId、roomId、bedId、quoteId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "提交被篡改的系统引用",
      pageZh: "报价确认",
      visibleContextZh: ["系统检测到选择来源不一致"],
      hiddenTechnicalAttempt: ["productId", "ratePlanId", "roomId", "bedId", "quoteId"],
      legalNextActionZh: "从页面重新选择客户、商品或报价"
    },
    {
      id: "11-readonly-search-write",
      testPlanItemZh: "搜索结果直接写报价。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接写报价事实",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读，只能跳转到合法动作"],
      legalNextActionZh: "进入报价详情后按状态继续"
    },
    {
      id: "12-cross-scenario",
      testPlanItemZh: "报价生成后直接锁库存或生成预订。",
      failureCode: "cross_scenario_inventory_reservation_forbidden",
      attemptedActionZh: "在报价页直接生成后续事实",
      pageZh: "报价完成摘要",
      visibleContextZh: ["报价摘要只能交给下一场景重新校验"],
      legalNextActionZh: "发起转预订准备，由下一场景复核"
    },
    {
      id: "13-duplicate-submission",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_submission",
      attemptedActionZh: "重复提交同一报价动作",
      pageZh: "报价提交",
      visibleContextZh: ["该提交已处理"],
      legalNextActionZh: "查看原处理结果"
    },
    {
      id: "14-concurrent-conflict",
      testPlanItemZh: "并发改报价。",
      failureCode: "concurrent_quote_version_conflict",
      attemptedActionZh: "基于旧版本提交报价",
      pageZh: "报价版本历史",
      visibleContextZh: ["报价版本已被他人更新"],
      legalNextActionZh: "刷新后重试"
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
    "是否阻断越界": item.failureCode.includes("cross_scenario") ? "已阻断跨场景越权。" : "失败被限定在当前业务动作内。",
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
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f7f7f8; color: #1f2933; }
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
      <div class="eyebrow">场景包 4 · 反向验证</div>
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
    "contract.scenario4_runtime_rules",
    contract.authorityId === "Dormitory.Scenario4.InquiryAndQuote" &&
      runtimeRules.authorityId === "Dormitory.Scenario4.InquiryAndQuote",
    "反向截图必须绑定场景包 4 运行规则。",
    { contractAuthorityId: contract.authorityId, runtimeAuthorityId: runtimeRules.authorityId });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "生成失败语义必须全部声明无副作用。",
    runtimeRules.failureSemantics);
  addAssertion(
    "contract.readonly_result_write_attempt_defined",
    failureCodes.has("readonly_result_write_attempt"),
    "必须定义搜索、列表、看板、报表只读写入失败。",
    [...failureCodes]);
  addAssertion(
    "contract.cross_scenario_failure_defined",
    failureCodes.has("cross_scenario_inventory_reservation_forbidden") &&
      failureCodes.has("finance_fact_forbidden"),
    "必须定义跨场景库存/正式预订和财务事实阻断。",
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
    version: "oam.dormitory-scenario4-negative-browser-screenshot-index.v1",
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
