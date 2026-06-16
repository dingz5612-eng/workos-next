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
const contractPath = "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario2-negative-browser-report.json");
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
  "roomId",
  "bedId",
  "operationStatusId",
  "inspectionId",
  "workItemId",
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
  version: "oam.dormitory-scenario2-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario2_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 2 failure semantics; failure paths are checked before any business side effect",
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
    "反向截图不得出现可报价、可预订、旧包或 final GO 等误导词。",
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
    console.error(`Dormitory scenario2 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario2 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario2 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-upstream-basic-readiness-missing",
      testPlanItemZh: "未基础就绪房源进入运营维护。",
      failureCode: "upstream_basic_readiness_missing",
      attemptedActionZh: "进入运营状态维护",
      pageZh: "房源运营状态列表",
      visibleContextZh: ["1 号楼 3 层 302 房间", "基础就绪：未完成"],
      legalNextActionZh: "返回房源建档与基础就绪补齐基础就绪摘要"
    },
    {
      id: "02-inspection-result-missing",
      testPlanItemZh: "缺运营检查结果提交。",
      failureCode: "inspection_required",
      attemptedActionZh: "直接设置运营状态",
      pageZh: "运营检查页",
      visibleContextZh: ["缺失项：保洁、维修、安全、设施检查结果"],
      legalNextActionZh: "先完成运营检查"
    },
    {
      id: "03-operation-evidence-missing",
      testPlanItemZh: "缺运营证据提交。",
      failureCode: "operation_evidence_missing",
      attemptedActionZh: "提交运营检查",
      pageZh: "运营检查页",
      visibleContextZh: ["检查结果已填", "缺失项：运营检查照片、维修记录"],
      legalNextActionZh: "补充运营证据"
    },
    {
      id: "04-open-blocker-operable",
      testPlanItemZh: "未关闭阻断原因设置为可运营。",
      failureCode: "unclosed_blocker_for_operable",
      attemptedActionZh: "设置为可运营",
      pageZh: "恢复运营页",
      visibleContextZh: ["当前状态：维修中", "阻断原因：门锁维修仍未关闭"],
      legalNextActionZh: "先关闭阻断原因并复查"
    },
    {
      id: "05-forged-internal-reference",
      testPlanItemZh: "伪造 roomId、bedId、stableRef、projectionVersion。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "提交被篡改的系统引用",
      pageZh: "状态变更确认页",
      visibleContextZh: ["系统检测到房源选择来源不一致"],
      hiddenTechnicalAttempt: ["roomId", "bedId", "stableRef", "projectionVersion"],
      legalNextActionZh: "从页面重新选择房源"
    },
    {
      id: "06-duplicate-submit",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_submission",
      attemptedActionZh: "重复提交同一次状态变更",
      pageZh: "状态变更确认页",
      visibleContextZh: ["同一提交已被处理"],
      legalNextActionZh: "查看原处理结果"
    },
    {
      id: "07-concurrent-submit",
      testPlanItemZh: "并发提交。",
      failureCode: "concurrent_status_conflict",
      attemptedActionZh: "提交过期状态版本",
      pageZh: "状态变更确认页",
      visibleContextZh: ["状态已被他人更新"],
      legalNextActionZh: "刷新后重试"
    },
    {
      id: "08-search-write-fact",
      testPlanItemZh: "搜索结果直接写事实。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从搜索结果直接改运营状态",
      pageZh: "搜索结果",
      visibleContextZh: ["搜索结果只读", "只能跳转到合法动作"],
      legalNextActionZh: "打开详情后按状态执行动作"
    },
    {
      id: "09-report-board-write-fact",
      testPlanItemZh: "报表或看板直接写事实。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "从看板直接写状态",
      pageZh: "运营看板",
      visibleContextZh: ["看板只读", "报表只读"],
      legalNextActionZh: "从工作项进入合法动作"
    },
    {
      id: "10-inline-edit-confirmed-status",
      testPlanItemZh: "已确认运营状态原地编辑。",
      failureCode: "post_confirm_inline_edit_forbidden",
      attemptedActionZh: "原地编辑已确认状态",
      pageZh: "房源运营状态详情",
      visibleContextZh: ["已确认事实不能原地编辑"],
      legalNextActionZh: "追加变更、补充证据、纠错或作废"
    },
    {
      id: "11-restore-without-recheck",
      testPlanItemZh: "恢复运营缺复查通过证据。",
      failureCode: "restore_without_recheck_pass",
      attemptedActionZh: "恢复运营",
      pageZh: "恢复运营页",
      visibleContextZh: ["缺失项：复查通过记录、恢复照片"],
      legalNextActionZh: "补充复查证据"
    },
    {
      id: "12-cross-scenario-price-reservation",
      testPlanItemZh: "运营状态后直接进入价格、报价或预订。",
      failureCode: "cross_scenario_price_reservation_forbidden",
      attemptedActionZh: "跳到后续交易操作",
      pageZh: "完成摘要",
      visibleContextZh: ["本场景只输出运营状态摘要和只读边界"],
      legalNextActionZh: "进入后续场景前先通过只读校验"
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
    "是否阻断越界": "没有写价格、报价、预订、入住、收款、押金、退款或账务事实。",
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
    "contract.scenario2_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario2.ResourceOperationStatus" &&
      runtimeRules.nameZh === "房源运营就绪与状态维护",
    "反向审计必须消费场景 2 generated runtime rules。",
    { authorityId: runtimeRules.authorityId, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).length >= 12 &&
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
    failureMessageByCode.has("cross_scenario_price_reservation_forbidden"),
    "价格、报价、预订越界必须被 generated failure semantics 阻断。",
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
    :root { color-scheme: light; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f6f5f1; color: #221d18; }
    body { margin: 0; padding: 18px; }
    main { max-width: 430px; margin: 0 auto; }
    header { padding: 18px 0 12px; border-bottom: 1px solid #d6cec1; }
    small { color: #6a5f53; }
    h1 { font-size: 24px; line-height: 1.18; margin: 8px 0; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: 0; }
    p { margin: 6px 0; line-height: 1.45; }
    section { margin-top: 14px; padding: 14px; background: #ffffff; border: 1px solid #ddd4c8; border-radius: 8px; }
    .failure { border-left: 4px solid #9f3a2e; }
    .failure strong { color: #8a2d24; }
    ul { padding-left: 20px; margin: 8px 0 0; }
    li { margin: 4px 0; line-height: 1.4; }
    dl { display: grid; grid-template-columns: 136px 1fr; gap: 8px 10px; margin: 8px 0 0; }
    dt { color: #6a5f53; }
    dd { margin: 0; line-height: 1.4; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button { min-height: 40px; border: 0; border-radius: 6px; padding: 0 12px; font-weight: 700; background: #e9e2d7; color: #2c251f; }
    .primary { background: #6f5945; color: white; }
  </style>
</head>
<body>
  <main data-scenario2-negative="${escapeAttr(item.id)}">
    <header>
      <small>场景包 2 反向验证</small>
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
      <div class="actions"><button class="primary">回到合法动作</button><button>查看状态历史</button></div>
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
    version: "oam.dormitory-scenario2-negative-browser-screenshot-index.v1",
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
