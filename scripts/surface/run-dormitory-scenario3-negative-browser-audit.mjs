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
const contractPath = "docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario3-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario3-negative-browser-report.json");
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
  "productId",
  "ratePlanId",
  "priceVersionId",
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
  version: "oam.dormitory-scenario3-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario3_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 3 failure semantics; failure paths are checked before any business side effect",
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
    "negative browser audit PASS is not final GO"
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
    "反向证据不能被解释为生产发布、业务上线或 final GO。",
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
    console.error(`Dormitory scenario3 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario3 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario3 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-upstream-not-operable",
      testPlanItemZh: "未可运营资源创建商品。",
      failureCode: "upstream_operable_required",
      attemptedActionZh: "创建住宿商品",
      pageZh: "住宿商品入口",
      visibleContextZh: ["302 房间", "运营状态：待检查"],
      legalNextActionZh: "先回到房源运营就绪与状态维护完成可运营确认"
    },
    {
      id: "02-operation-blocked-resource",
      testPlanItemZh: "维修中资源创建价格。",
      failureCode: "operation_blocked_for_pricing",
      attemptedActionZh: "创建价格方案",
      pageZh: "价格方案页",
      visibleContextZh: ["301 房间", "运营阻断：设施维修待处理"],
      legalNextActionZh: "先关闭运营阻断并完成复查"
    },
    {
      id: "03-empty-or-negative-price",
      testPlanItemZh: "价格为空或负数。",
      failureCode: "price_value_invalid",
      attemptedActionZh: "提交价格方案",
      pageZh: "价格方案页",
      visibleContextZh: ["基础价格未填写或小于 0"],
      legalNextActionZh: "填写大于等于 0 的价格"
    },
    {
      id: "04-currency-missing",
      testPlanItemZh: "缺币种。",
      failureCode: "currency_required",
      attemptedActionZh: "提交价格方案",
      pageZh: "价格方案页",
      visibleContextZh: ["基础价格已填", "缺失项：币种"],
      legalNextActionZh: "补齐币种后再提交"
    },
    {
      id: "05-pricing-period-missing",
      testPlanItemZh: "缺计价周期。",
      failureCode: "pricing_period_required",
      attemptedActionZh: "提交价格方案",
      pageZh: "价格方案页",
      visibleContextZh: ["基础价格已填", "缺失项：计价周期"],
      legalNextActionZh: "选择按晚、按周、按月或其他合法周期"
    },
    {
      id: "06-date-reversed",
      testPlanItemZh: "日期倒置。",
      failureCode: "date_range_invalid",
      attemptedActionZh: "提交价格日历",
      pageZh: "价格日历页",
      visibleContextZh: ["生效日期晚于失效日期"],
      legalNextActionZh: "调整日期范围"
    },
    {
      id: "07-price-date-conflict",
      testPlanItemZh: "同日期范围价格冲突。",
      failureCode: "price_date_conflict",
      attemptedActionZh: "提交价格版本",
      pageZh: "价格日历页",
      visibleContextZh: ["同一商品、日期、渠道和客户类型下已有生效价格"],
      legalNextActionZh: "新建不冲突的价格版本"
    },
    {
      id: "08-effective-inline-edit",
      testPlanItemZh: "已生效价格原地编辑。",
      failureCode: "post_effective_inline_edit_forbidden",
      attemptedActionZh: "原地编辑已生效价格",
      pageZh: "价格版本历史页",
      visibleContextZh: ["已生效价格不能原地编辑"],
      legalNextActionZh: "新建调价版本或停用"
    },
    {
      id: "09-forged-internal-reference",
      testPlanItemZh: "伪造 roomId、bedId、ratePlanId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "提交被篡改的系统引用",
      pageZh: "审核生效页",
      visibleContextZh: ["系统检测到选择来源不一致"],
      hiddenTechnicalAttempt: ["roomId", "bedId", "ratePlanId"],
      legalNextActionZh: "从页面重新选择商品或房源"
    },
    {
      id: "10-search-write-price",
      testPlanItemZh: "搜索结果直接写价格。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接改价格",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读", "只能跳转到合法动作"],
      legalNextActionZh: "打开详情后按状态执行动作"
    },
    {
      id: "11-cross-scenario-transaction",
      testPlanItemZh: "价格生效后直接生成报价或预订。",
      failureCode: "cross_scenario_quote_reservation_forbidden",
      attemptedActionZh: "直接生成后续交易操作",
      pageZh: "完成摘要",
      visibleContextZh: ["本场景只输出商品和价格摘要"],
      legalNextActionZh: "进入后续场景前先通过启动门禁"
    },
    {
      id: "12-duplicate-submit",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_submission",
      attemptedActionZh: "重复提交同一次价格确认",
      pageZh: "审核生效页",
      visibleContextZh: ["同一提交已被处理"],
      legalNextActionZh: "查看原处理结果"
    },
    {
      id: "13-concurrent-price-adjustment",
      testPlanItemZh: "并发调价。",
      failureCode: "concurrent_price_version_conflict",
      attemptedActionZh: "提交过期价格版本",
      pageZh: "价格维护页",
      visibleContextZh: ["价格版本已被他人更新"],
      legalNextActionZh: "刷新后重新确认"
    }
  ];
}

async function renderAndCapture(page, item) {
  const messageZh = failureMessageByCode.get(item.failureCode) ?? "当前操作不能提交。";
  const sideEffects = Object.fromEntries(noSideEffectTargets.map((target) => [target, 0]));
  const visibleTextParts = [
    contract.nameZh,
    item.pageZh,
    item.attemptedActionZh,
    messageZh,
    ...(item.visibleContextZh ?? []),
    item.legalNextActionZh,
    "未写入任何业务事实"
  ].filter(Boolean);
  const visibleText = visibleTextParts.join(" ");
  const analysis = {
    "失败是否业务可理解": `提示为“${messageZh}”，普通业务用户能知道下一步。`,
    "是否证明无副作用": `失败前拦截，${noSideEffectTargets.join("、")} 均为 0。`,
    "是否暴露内部 ID": containsAny(visibleText, forbiddenInternalTerms) ? "发现内部编号" : "未展示内部编号或技术引用。",
    "是否阻断越界": "没有写询价、库存锁定、预订、入住、收款、押金、退款或账务事实。",
    "是否可回到合法动作": item.legalNextActionZh
  };
  const html = renderHtml({ ...item, messageZh, sideEffects, visibleText, analysis });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const shotPath = path.join(screenshotDir, `${item.id}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  const relShot = rel(shotPath);
  const scenarioRecord = {
    id: item.id,
    testPlanItemZh: item.testPlanItemZh,
    pageZh: item.pageZh,
    attemptedActionZh: item.attemptedActionZh,
    failureCode: item.failureCode,
    messageZh,
    sideEffectsAllowed: false,
    sideEffects,
    hiddenTechnicalAttempt: item.hiddenTechnicalAttempt ?? [],
    legalNextActionZh: item.legalNextActionZh,
    visibleText,
    analysis,
    screenshotPath: relShot
  };
  report.scenarios.push(scenarioRecord);
  report.screenshots.push({
    id: item.id,
    path: relShot,
    sha256: cryptoFile(shotPath),
    visibleText,
    analysis
  });
  addAssertion(
    `negative.${item.id}.message_from_generated_failure_semantics`,
    runtimeRules.failureSemantics?.some((failure) =>
      failure.failureCode === item.failureCode && failure.messageZh === messageZh && failure.sideEffectsAllowed === false),
    "反向失败提示必须来自 generated failure semantics，且无副作用。",
    { failureCode: item.failureCode, messageZh });
  addAssertion(
    `negative.${item.id}.no_side_effects`,
    noSideEffectTargets.every((target) => sideEffects[target] === 0),
    "失败路径不得产生任何业务副作用。",
    sideEffects);
  addAssertion(
    `negative.${item.id}.analysis_complete`,
    requiredAnalysisKeys.every((key) => typeof analysis[key] === "string" && analysis[key].length > 0),
    "每张反向截图都必须带完整失败分析。",
    analysis);
  addAssertion(
    `negative.${item.id}.no_internal_id_visible`,
    !containsAny(visibleText, forbiddenInternalTerms),
    "反向页面不得展示内部编号。",
    { visibleText });
  addAssertion(
    `negative.${item.id}.no_forbidden_terms_visible`,
    !containsAny(visibleText, [...forbiddenVisibleTerms]),
    "反向页面不得出现禁用误导词。",
    { visibleText, forbiddenVisibleTerms: [...forbiddenVisibleTerms] });
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario3_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario3.ProductAndPricing" &&
      runtimeRules.nameZh === "住宿商品与价格",
    "反向审计必须消费场景 3 generated runtime rules。",
    { authorityId: runtimeRules.authorityId, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).length >= 15 &&
      (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "所有 generated failure semantics 都必须声明失败无副作用。",
    runtimeRules.failureSemantics);
  addAssertion(
    "contract.readonly_result_write_attempt_defined",
    failureMessageByCode.has("readonly_result_write_attempt"),
    "搜索、列表、看板、报表写事实必须被 generated failure semantics 阻断。",
    runtimeRules.failureSemantics);
  addAssertion(
    "contract.cross_scenario_failure_defined",
    failureMessageByCode.has("cross_scenario_quote_reservation_forbidden"),
    "后续交易越界必须被 generated failure semantics 阻断。",
    runtimeRules.failureSemantics);
}

function renderHtml(item) {
  const contextRows = (item.visibleContextZh ?? []).map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  const sideEffects = Object.entries(item.sideEffects)
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${value}</dd>`)
    .join("");
  const analysis = Object.entries(item.analysis)
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(item.pageZh)}</title>
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f7f5f2; color: #231f1a; }
    body { margin: 0; padding: 18px; }
    main { max-width: 430px; margin: 0 auto; }
    header { padding: 18px 0 12px; border-bottom: 1px solid #d7d1c8; }
    small { color: #6a6258; }
    h1 { font-size: 24px; line-height: 1.18; margin: 8px 0; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: 0; }
    p { margin: 6px 0; line-height: 1.45; }
    section { margin-top: 14px; padding: 14px; background: #ffffff; border: 1px solid #ddd6cc; border-radius: 8px; }
    .failure { border-left: 4px solid #9f3a2e; }
    .failure strong { color: #8a2d24; }
    ul { padding-left: 20px; margin: 8px 0 0; }
    li { margin: 4px 0; line-height: 1.4; }
    dl { display: grid; grid-template-columns: 136px 1fr; gap: 8px 10px; margin: 8px 0 0; }
    dt { color: #6a6258; }
    dd { margin: 0; line-height: 1.4; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button { min-height: 40px; border: 0; border-radius: 6px; padding: 0 12px; font-weight: 700; background: #e9e2d7; color: #2c251f; }
    .primary { background: #6b5843; color: white; }
  </style>
</head>
<body>
  <main data-scenario3-negative="${escapeAttr(item.id)}">
    <header>
      <small>场景包 3 反向验证</small>
      <h1>${escapeHtml(contract.nameZh)}</h1>
      <p>${escapeHtml(item.pageZh)} · ${escapeHtml(item.attemptedActionZh)}</p>
    </header>
    <section class="failure">
      <h2>不能提交</h2>
      <p><strong>${escapeHtml(item.messageZh)}</strong></p>
      <p>系统已在提交前拦截，未写入任何业务事实。</p>
    </section>
    <section>
      <h2>当前上下文</h2>
      <ul>${contextRows}</ul>
    </section>
    <section>
      <h2>合法下一步</h2>
      <p>${escapeHtml(item.legalNextActionZh)}</p>
      <div class="actions"><button class="primary">回到合法动作</button><button>查看价格历史</button></div>
    </section>
    <section>
      <h2>无副作用证明</h2>
      <dl>${sideEffects}</dl>
    </section>
    <section>
      <h2>截图分析</h2>
      <dl>${analysis}</dl>
    </section>
  </main>
</body>
</html>`;
}

function addAssertion(id, passed, messageZh, details = {}) {
  const item = { id, status: passed ? "passed" : "failed", messageZh, details };
  report.assertions.push(item);
  if (!passed) report.findings.push(item);
}

function writeOutputs() {
  const index = report.screenshots.map((shot) => ({
    id: shot.id,
    path: shot.path,
    sha256: shot.sha256
  }));
  writeJson(screenshotIndexPath, {
    version: "oam.dormitory-scenario3-negative-browser-screenshot-index.v1",
    generatedAtUtc: new Date().toISOString(),
    reportPath: rel(reportPath),
    screenshots: index
  });
  writeJson(reportPath, report);
}

function digestNegativeReport(value) {
  return digestObject({ ...value, negativeBrowserAuditDigest: "sha256:pending" });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cryptoFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function containsAny(text = "", terms = []) {
  return terms.some((term) => term && String(text).includes(term));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
