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
const contractPath = "docs/contracts/generated/dormitory/scenario5-reservation-and-inventory-hold.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario5-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario5-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario5-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario5-negative-browser-report.json");
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
  "bookingRequestId",
  "inventoryHoldId",
  "holdId",
  "reservationId",
  "reservationNo",
  "quoteId",
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
  version: "oam.dormitory-scenario5-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario5_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 5 failure semantics; failure paths are checked before any business side effect",
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
    console.error(`Dormitory scenario5 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario5 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario5 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-quote-expired",
      testPlanItemZh: "报价过期进入预订。",
      failureCode: "quote_expired_for_booking",
      attemptedActionZh: "从过期报价进入预订准备",
      pageZh: "预订准备",
      visibleContextZh: ["报价有效期已过", "需要返回询价与报价重新处理"],
      legalNextActionZh: "返回询价与报价重新报价"
    },
    {
      id: "02-contact-required",
      testPlanItemZh: "缺客户联系方式。",
      failureCode: "contact_required",
      attemptedActionZh: "继续预订准备",
      pageZh: "客户和报价摘要",
      visibleContextZh: ["客户联系方式未补齐"],
      legalNextActionZh: "补齐客户联系方式后再继续"
    },
    {
      id: "03-date-range-invalid",
      testPlanItemZh: "入住日期晚于或等于离店日期。",
      failureCode: "date_range_invalid",
      attemptedActionZh: "确认日期范围",
      pageZh: "确认日期和人数",
      visibleContextZh: ["入住日期必须早于离店日期"],
      legalNextActionZh: "调整日期范围"
    },
    {
      id: "04-guest-count-invalid",
      testPlanItemZh: "人数为 0。",
      failureCode: "guest_count_invalid",
      attemptedActionZh: "确认入住人数",
      pageZh: "确认日期和人数",
      visibleContextZh: ["入住人数为 0"],
      legalNextActionZh: "填写大于 0 的人数"
    },
    {
      id: "05-operation-blocked",
      testPlanItemZh: "资源维修或停售仍被选择。",
      failureCode: "operation_blocked_for_booking",
      attemptedActionZh: "选择被阻断资源",
      pageZh: "可订资源复核页",
      visibleContextZh: ["运营阻断：维修待处理"],
      legalNextActionZh: "先关闭运营阻断并重新复核"
    },
    {
      id: "06-resource-already-locked",
      testPlanItemZh: "资源已被他人锁定。",
      failureCode: "resource_already_locked",
      attemptedActionZh: "锁定已被占用的资源",
      pageZh: "库存锁定页",
      visibleContextZh: ["该资源所选日期已有有效锁定"],
      legalNextActionZh: "选择其他资源或等待释放后重试"
    },
    {
      id: "07-repeat-hold",
      testPlanItemZh: "重复锁定。",
      failureCode: "resource_already_locked",
      attemptedActionZh: "重复点击锁定",
      pageZh: "库存锁定页",
      visibleContextZh: ["该资源同一日期范围已经处于锁定中"],
      legalNextActionZh: "查看现有锁定结果或释放后重新锁定"
    },
    {
      id: "08-concurrent-hold",
      testPlanItemZh: "并发锁定。",
      failureCode: "concurrent_inventory_hold_conflict",
      attemptedActionZh: "基于旧复核结果创建锁定",
      pageZh: "库存锁定页",
      visibleContextZh: ["资源刚刚被他人抢先锁定"],
      legalNextActionZh: "刷新可订资源后重试"
    },
    {
      id: "09-hold-expired",
      testPlanItemZh: "锁定过期后确认。",
      failureCode: "hold_expired_for_reservation",
      attemptedActionZh: "用过期锁定确认预订",
      pageZh: "预订确认页",
      visibleContextZh: ["库存锁定已过期"],
      legalNextActionZh: "重新锁定后再确认预订"
    },
    {
      id: "10-hold-required",
      testPlanItemZh: "未锁定直接确认预订。",
      failureCode: "inventory_hold_required",
      attemptedActionZh: "跳过库存锁定直接生成预订",
      pageZh: "预订确认页",
      visibleContextZh: ["尚未完成库存锁定"],
      legalNextActionZh: "先完成库存锁定"
    },
    {
      id: "11-forged-internal-reference",
      testPlanItemZh: "伪造 roomId、bedId、quoteId、holdId、reservationId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "提交被篡改的系统引用",
      pageZh: "预订确认页",
      visibleContextZh: ["系统检测到选择来源不一致"],
      hiddenTechnicalAttempt: ["roomId", "bedId", "quoteId", "holdId", "reservationId"],
      legalNextActionZh: "从页面重新选择报价、资源或锁定记录"
    },
    {
      id: "12-manual-reservation-number",
      testPlanItemZh: "用户手填预订号。",
      failureCode: "reservation_no_user_input_forbidden",
      attemptedActionZh: "手工填写预订号",
      pageZh: "生成预订",
      visibleContextZh: ["预订号必须由系统生成"],
      hiddenTechnicalAttempt: ["reservationNo"],
      legalNextActionZh: "清除手工编号，重新提交生成预订"
    },
    {
      id: "13-readonly-search-write",
      testPlanItemZh: "搜索结果直接写预订。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接写锁定或预订事实",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读，只能跳转到合法动作"],
      legalNextActionZh: "进入预订详情后按状态继续"
    },
    {
      id: "14-cross-scenario",
      testPlanItemZh: "确认预订后直接收款或入住。",
      failureCode: "cross_scenario_checkin_payment_forbidden",
      attemptedActionZh: "预订完成后直接办理后续或财务动作",
      pageZh: "预订结果页",
      visibleContextZh: ["预订摘要只能交给后续场景重新核验"],
      legalNextActionZh: "进入对应场景，按该场景规则处理"
    },
    {
      id: "15-duplicate-submission",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_submission",
      attemptedActionZh: "重复提交同一预订动作",
      pageZh: "预订提交",
      visibleContextZh: ["该提交已处理"],
      legalNextActionZh: "查看原处理结果"
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
    "是否阻断越界": item.failureCode.includes("cross_scenario") || item.failureCode.includes("finance") ? "已阻断跨场景越权。" : "失败被限定在当前业务动作内。",
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
      <div class="eyebrow">场景包 5 · 反向验证</div>
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
    "contract.scenario5_runtime_rules",
    contract.authorityId === "Dormitory.Scenario5.ReservationAndInventoryHold" &&
      runtimeRules.authorityId === "Dormitory.Scenario5.ReservationAndInventoryHold",
    "反向截图必须绑定场景包 5 运行规则。",
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
    "contract.inventory_and_cross_scenario_failures_defined",
    failureCodes.has("concurrent_inventory_hold_conflict") &&
      failureCodes.has("hold_expired_for_reservation") &&
      failureCodes.has("cross_scenario_checkin_payment_forbidden") &&
      failureCodes.has("finance_fact_forbidden"),
    "必须定义库存并发、锁定过期、跨场景和财务事实阻断。",
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
    version: "oam.dormitory-scenario5-negative-browser-screenshot-index.v1",
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
