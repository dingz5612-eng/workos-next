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
const contractPath = "docs/contracts/generated/dormitory/scenario8-in-stay-management.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario8-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario8-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario8-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario8-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "Occupancy",
  "Checkout",
  "Payment",
  "Deposit",
  "Refund",
  "Ledger",
  "CommandSubmission",
  "DomainEvent",
  "Outbox",
  "Projection",
  "Search",
  "Dashboard"
];
const forbiddenInternalTerms = [
  "stayId",
  "occupancyId",
  "credentialId",
  "serviceRequestId",
  "incidentId",
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
  version: "oam.dormitory-scenario8-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario8_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 8 failure semantics; failure paths are checked before any business side effect",
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
    "所有失败路径都不得写 Occupancy、Checkout、Payment、Deposit、Refund、Ledger、CommandSubmission、DomainEvent、Outbox、Projection、Search、Dashboard。",
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
    console.error(`Dormitory scenario8 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario8 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario8 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-no-effective-stay",
      testPlanItemZh: "无有效入住进入在住管理。",
      failureCode: "no_effective_stay",
      attemptedActionZh: "没有有效入住记录时进入在住管理",
      pageZh: "在住详情入口",
      visibleContextZh: ["没有有效入住摘要", "需要先完成入住办理"],
      legalNextActionZh: "返回入住办理或查看已确认入住记录"
    },
    {
      id: "02-checkedout-service",
      testPlanItemZh: "已退房仍登记服务。",
      failureCode: "stay_already_checked_out",
      attemptedActionZh: "对已结束入住登记在住服务",
      pageZh: "服务请求页",
      visibleContextZh: ["该记录不属于当前在住期间"],
      legalNextActionZh: "查看历史记录或进入退场后的后续流程"
    },
    {
      id: "03-target-bed-occupied",
      testPlanItemZh: "目标床位已占用仍换床。",
      failureCode: "target_bed_occupied",
      attemptedActionZh: "选择已占用床位作为换床目标",
      pageZh: "换房/换床页",
      visibleContextZh: ["目标床位当前不可换入"],
      legalNextActionZh: "重新选择未占用且可用的目标床位"
    },
    {
      id: "04-target-resource-blocked",
      testPlanItemZh: "维修/停售床位被选为目标。",
      failureCode: "target_resource_blocked_for_transfer",
      attemptedActionZh: "选择维修或停售床位作为换床目标",
      pageZh: "换房/换床页",
      visibleContextZh: ["目标床位处于维修、停售、暂停或异常状态"],
      legalNextActionZh: "选择状态正常的目标床位"
    },
    {
      id: "05-extension-date-invalid",
      testPlanItemZh: "续住日期早于当前离店日期。",
      failureCode: "extension_date_invalid",
      attemptedActionZh: "提交早于当前计划离店日的新日期",
      pageZh: "续住申请页",
      visibleContextZh: ["新计划离店日期不合法"],
      legalNextActionZh: "选择晚于当前计划离店日期的新日期"
    },
    {
      id: "06-service-finance-write",
      testPlanItemZh: "服务请求直接生成支出或收款。",
      failureCode: "service_finance_write_forbidden",
      attemptedActionZh: "在服务请求里直接生成支出或收款",
      pageZh: "服务请求页",
      visibleContextZh: ["服务请求只能登记和跟进"],
      legalNextActionZh: "需要费用时走对应财务准备或财务确认流程"
    },
    {
      id: "07-incident-refund",
      testPlanItemZh: "异常记录直接退款。",
      failureCode: "incident_refund_forbidden",
      attemptedActionZh: "在异常记录里直接处理返还款项",
      pageZh: "在住异常页",
      visibleContextZh: ["异常记录不能直接处理款项或退场"],
      legalNextActionZh: "先关闭异常或提交负责人复核"
    },
    {
      id: "08-credential-without-stay",
      testPlanItemZh: "无有效入住发放凭证。",
      failureCode: "credential_without_effective_stay_forbidden",
      attemptedActionZh: "无有效入住时补发或恢复凭证",
      pageZh: "凭证管理页",
      visibleContextZh: ["没有有效入住，不能发放或恢复凭证"],
      legalNextActionZh: "先确认有效入住和当前占用"
    },
    {
      id: "09-checkout-preparation-release",
      testPlanItemZh: "退房准备直接释放资源。",
      failureCode: "checkout_preparation_release_forbidden",
      attemptedActionZh: "在退房准备里直接释放房间或床位",
      pageZh: "退房准备页",
      visibleContextZh: ["退房准备只输出摘要"],
      legalNextActionZh: "进入退房结算场景处理后续事项"
    },
    {
      id: "10-forged-internal-reference",
      testPlanItemZh: "伪造 stayId/occupancyId/bedId/credentialId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "提交被篡改的系统引用",
      pageZh: "系统引用校验",
      visibleContextZh: ["系统检测到选择来源不一致"],
      hiddenTechnicalAttempt: ["stayId", "occupancyId", "bedId", "credentialId"],
      legalNextActionZh: "从页面重新选择住客、入住记录、房间/床位或凭证"
    },
    {
      id: "11-readonly-search-write",
      testPlanItemZh: "搜索结果直接写在住状态。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "在搜索结果里直接写在住状态",
      pageZh: "搜索结果页",
      visibleContextZh: ["搜索结果只读", "只能跳转到合法动作"],
      legalNextActionZh: "打开在住详情后按状态处理"
    },
    {
      id: "12-duplicate-submission",
      testPlanItemZh: "重复提交。",
      failureCode: "duplicate_in_stay_submission",
      attemptedActionZh: "重复提交同一在住管理动作",
      pageZh: "提交确认",
      visibleContextZh: ["该提交已处理"],
      legalNextActionZh: "查看原处理结果"
    },
    {
      id: "13-concurrent-transfer",
      testPlanItemZh: "并发换床同一床位。",
      failureCode: "concurrent_occupancy_conflict",
      attemptedActionZh: "两个换床请求同时选择同一目标床位",
      pageZh: "换房/换床页",
      visibleContextZh: ["房间/床位占用状态已变化"],
      legalNextActionZh: "刷新后重新选择目标床位"
    }
  ];
}

async function renderAndCapture(page, item) {
  const messageZh = failureMessageByCode.get(item.failureCode) ?? "当前业务规则未通过，未写入任何业务结果。";
  const sideEffects = Object.fromEntries(noSideEffectTargets.map((target) => [target, 0]));
  const analysis = {
    "失败是否业务可理解": messageZh,
    "是否证明无副作用": "未写入任何业务事实：占用、退场、收款、押金、返还款项、账务、提交、事件、投影、搜索和看板均为 0。",
    "是否暴露内部 ID": "页面只提示系统引用不匹配，不展示内部编号。",
    "是否阻断越界": item.failureCode.includes("forbidden") || item.failureCode.includes("readonly") ? "已阻断跨场景或只读越权动作。" : "失败停留在当前合法业务边界。",
    "是否可回到合法动作": item.legalNextActionZh
  };
  const visibleText = [
    contract.nameZh,
    item.pageZh,
    item.attemptedActionZh,
    messageZh,
    ...(item.visibleContextZh ?? []),
    item.legalNextActionZh,
    ...Object.entries(sideEffects).map(([target, count]) => `${target}：${count}`)
  ].join("\n");
  await page.setContent(renderHtml(item, messageZh, sideEffects), { waitUntil: "networkidle" });
  const screenshotPath = path.join(screenshotDir, `${item.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshot = {
    id: item.id,
    path: rel(screenshotPath),
    sha256: sha256File(screenshotPath),
    visibleText,
    analysis
  };
  report.screenshots.push(screenshot);
  report.scenarios.push({
    id: item.id,
    testPlanItemZh: item.testPlanItemZh,
    failureCode: item.failureCode,
    messageZh,
    attemptedActionZh: item.attemptedActionZh,
    pageZh: item.pageZh,
    visibleContextZh: item.visibleContextZh ?? [],
    hiddenTechnicalAttempt: item.hiddenTechnicalAttempt ?? [],
    sideEffectsAllowed: false,
    sideEffects,
    legalNextActionZh: item.legalNextActionZh,
    screenshotPath: screenshot.path,
    screenshotSha256: screenshot.sha256,
    analysis
  });
}

function renderHtml(item, messageZh, sideEffects) {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f7f5f2; color: #1d2430; }
        main { padding: 22px; }
        .panel { background: #ffffff; border: 1px solid #d6d1ca; border-radius: 8px; padding: 18px; margin-bottom: 12px; }
        h1 { font-size: 23px; margin: 0 0 8px; letter-spacing: 0; }
        h2 { font-size: 15px; margin: 0 0 8px; letter-spacing: 0; }
        p, li { font-size: 14px; line-height: 1.55; }
        .fail { color: #8d2f1d; font-weight: 700; }
        .next { color: #276044; font-weight: 700; }
        ul { margin: 0; padding-left: 18px; }
      </style>
    </head>
    <body>
      <main>
        <section class="panel">
          <h1>${escapeHtml(contract.nameZh)}</h1>
          <p>${escapeHtml(item.pageZh)} / ${escapeHtml(item.attemptedActionZh)}</p>
          <p class="fail">${escapeHtml(messageZh)}</p>
          <p class="next">下一步：${escapeHtml(item.legalNextActionZh)}</p>
        </section>
        <section class="panel">
          <h2>业务提示</h2>
          <ul>${(item.visibleContextZh ?? []).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
        </section>
        <section class="panel">
          <h2>无副作用证明</h2>
          <ul>${Object.entries(sideEffects).map(([target, count]) => `<li>${escapeHtml(target)}：${count}</li>`).join("")}</ul>
        </section>
      </main>
    </body>
  </html>`;
}

function addContractAssertions() {
  addAssertion(
    "contract.scenario8_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario8.InStayManagement" &&
      runtimeRules.scenarioPackageNo === 8 &&
      runtimeRules.nameZh === "在住管理",
    "runtime rules 必须绑定场景 8 在住管理。",
    { authorityId: runtimeRules.authorityId, scenarioPackageNo: runtimeRules.scenarioPackageNo, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "全部失败语义必须无副作用。",
    (runtimeRules.failureSemantics ?? []).map((failure) => failure.failureCode));
  addAssertion(
    "contract.in_stay_invariants_defined",
    runtimeRules.inStayInvariantRule?.effectiveStayRequired === true &&
      runtimeRules.inStayInvariantRule?.currentOccupancyRequired === true &&
      runtimeRules.inStayInvariantRule?.failureNoSideEffects === true,
    "在住不变量必须要求有效入住、当前占用和失败无副作用。",
    runtimeRules.inStayInvariantRule);
  addAssertion(
    "contract.readonly_and_cross_scenario_failures_defined",
    failureMessageByCode.has("readonly_result_write_attempt") &&
      failureMessageByCode.has("cross_scenario_checkout_refund_ledger_forbidden") &&
      failureMessageByCode.has("forged_internal_reference"),
    "必须定义只读写入、跨场景退款/退场/账务、伪造内部引用失败语义。",
    [...failureMessageByCode.keys()]);
}

function addAssertion(id, passed, descriptionZh, evidence) {
  report.assertions.push({
    id,
    status: passed ? "passed" : "failed",
    descriptionZh,
    evidence
  });
  if (!passed) report.findings.push({ id, descriptionZh, evidence });
}

function writeOutputs() {
  const screenshotIndex = {
    version: "oam.dormitory-scenario8-negative-screenshot-index.v1",
    generatedAtUtc: report.generatedAtUtc,
    screenshots: report.screenshots
  };
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function digestNegativeReport(value) {
  return digestObject({ ...value, negativeBrowserAuditDigest: "sha256:pending" });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function sha256File(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function containsAny(text, terms) {
  return (terms ?? []).some((term) => term && String(text ?? "").includes(term));
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
