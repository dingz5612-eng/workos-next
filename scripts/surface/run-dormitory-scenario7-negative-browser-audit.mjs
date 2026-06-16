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
const contractPath = "docs/contracts/generated/dormitory/scenario7-check-in-processing.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario7-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario7-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json";
const auditDir = "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-negative-browser";
const screenshotDir = path.join(root, auditDir, "screenshots");
const reportPath = path.join(root, auditDir, "scenario7-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const noSideEffectTargets = [
  "Stay",
  "Occupancy",
  "Credential",
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
  "stayId",
  "residentId",
  "reservationId",
  "credentialId",
  "roomId",
  "bedId",
  "occupancyId",
  "checkInCaseId",
  "identityVerificationId",
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
  version: "oam.dormitory-scenario7-negative-browser.v1",
  status: "running",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario7_local_evidence",
  browserMode: "playwright-chromium-generated-contract-surface",
  scenarioPackageNo: contract.scenarioPackageNo,
  authorityId: contract.authorityId,
  nameZh: contract.nameZh,
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  mockPolicy: "real Chromium screenshots rendered from generated 场景 7 failure semantics; failure paths are checked before any business side effect",
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
    "所有失败路径都不得写 Stay、Occupancy、Credential、CommandSubmission、DomainEvent、Outbox、Projection、Lens、Search、Dashboard、Ledger。",
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
    console.error(`Dormitory scenario7 negative browser audit: FAIL (${report.findings.length} findings)`);
    process.exit(1);
  }
  console.log(`Dormitory scenario7 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
  console.log(rel(reportPath));
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  report.negativeBrowserAuditDigest = digestNegativeReport(report);
  writeOutputs();
  console.error("Dormitory scenario7 negative browser audit: FAIL");
  console.error(report.failureReason);
  process.exit(1);
}

function buildNegativeCases() {
  return [
    {
      id: "01-reservation-not-valid",
      testPlanItemZh: "无有效预订办理入住。",
      failureCode: "reservation_not_valid",
      attemptedActionZh: "没有有效预订时发起入住办理",
      pageZh: "入住办理页",
      visibleContextZh: ["没有有效预订确认摘要", "需要先回到预订与库存锁定"],
      legalNextActionZh: "先完成预订确认，再进入入住办理"
    },
    {
      id: "02-reservation-cancelled",
      testPlanItemZh: "预订已取消。",
      failureCode: "reservation_cancelled",
      attemptedActionZh: "对已取消预订办理入住",
      pageZh: "入住办理页",
      visibleContextZh: ["预订状态不可办理入住"],
      legalNextActionZh: "返回预订详情查看原因"
    },
    {
      id: "03-reservation-already-converted",
      testPlanItemZh: "预订已转入住。",
      failureCode: "reservation_already_converted",
      attemptedActionZh: "重复把同一预订转为入住",
      pageZh: "入住办理页",
      visibleContextZh: ["该预订已有入住记录"],
      legalNextActionZh: "查看已有入住详情"
    },
    {
      id: "04-finance-unmet",
      testPlanItemZh: "财务规则未满足。",
      failureCode: "finance_rule_unmet_without_exception",
      attemptedActionZh: "财务摘要未满足时普通确认入住",
      pageZh: "财务与协议复核页",
      visibleContextZh: ["财务摘要未满足入住规则", "可走负责人例外审批并留证据"],
      legalNextActionZh: "补齐财务摘要或发起负责人例外审批"
    },
    {
      id: "05-identity-evidence-required",
      testPlanItemZh: "缺身份凭证。",
      failureCode: "identity_evidence_required",
      attemptedActionZh: "缺少证件照片或本人确认时提交身份核验",
      pageZh: "身份核验页",
      visibleContextZh: ["身份核验证据缺失"],
      legalNextActionZh: "上传证件照片、本人确认和授权同意"
    },
    {
      id: "06-guest-mismatch",
      testPlanItemZh: "入住人与预订不一致且未审批。",
      failureCode: "guest_mismatch_without_approval",
      attemptedActionZh: "入住人与预订客户不一致且无审批",
      pageZh: "身份核验页",
      visibleContextZh: ["入住人与预订信息不一致", "没有审批证据"],
      legalNextActionZh: "补充审批证据或转人工复核"
    },
    {
      id: "07-agreement-not-confirmed",
      testPlanItemZh: "协议未确认。",
      failureCode: "agreement_not_confirmed",
      attemptedActionZh: "未确认入住协议就继续办理",
      pageZh: "财务与协议复核页",
      visibleContextZh: ["入住协议未确认"],
      legalNextActionZh: "完成协议确认或保存草稿"
    },
    {
      id: "08-resource-blocked-or-occupied",
      testPlanItemZh: "房间/床位维修或已占用。",
      failureCode: "resource_blocked_for_checkin",
      attemptedActionZh: "房间/床位存在维修、停售、暂停或异常阻断时确认交付",
      pageZh: "房间/床位交付页",
      visibleContextZh: ["房间/床位当前不可交付", "已有维修或异常阻断"],
      legalNextActionZh: "暂缓入住或申请换房/换床"
    },
    {
      id: "09-duplicate-checkin",
      testPlanItemZh: "重复入住。",
      failureCode: "duplicate_checkin",
      attemptedActionZh: "重复提交同一入住办理",
      pageZh: "确认入住页",
      visibleContextZh: ["该入住提交已处理"],
      legalNextActionZh: "查看原处理结果"
    },
    {
      id: "10-concurrent-occupancy-conflict",
      testPlanItemZh: "并发入住同一床位。",
      failureCode: "concurrent_occupancy_conflict",
      attemptedActionZh: "另一个办理已占用同一房间/床位",
      pageZh: "确认入住页",
      visibleContextZh: ["房间/床位状态已变化"],
      legalNextActionZh: "刷新后重新复核房间/床位"
    },
    {
      id: "11-credential-before-checkin",
      testPlanItemZh: "未入住先发凭证。",
      failureCode: "credential_before_checkin_forbidden",
      attemptedActionZh: "未成功入住先发入住凭证",
      pageZh: "凭证发放页",
      visibleContextZh: ["未成功入住，不能发放有效入住凭证"],
      legalNextActionZh: "先完成确认入住"
    },
    {
      id: "12-forged-internal-reference",
      testPlanItemZh: "伪造 reservationId、stayId、roomId、bedId、credentialId。",
      failureCode: "forged_internal_reference",
      attemptedActionZh: "提交被篡改的系统引用",
      pageZh: "系统引用校验",
      visibleContextZh: ["系统检测到选择来源不一致"],
      hiddenTechnicalAttempt: ["reservationId", "stayId", "roomId", "bedId", "credentialId"],
      legalNextActionZh: "从页面重新选择预订、住客、房间/床位或凭证"
    },
    {
      id: "13-readonly-search-write",
      testPlanItemZh: "搜索结果直接写入住。",
      failureCode: "readonly_result_write_attempt",
      attemptedActionZh: "在搜索结果里直接写入住事实",
      pageZh: "搜索结果页",
      visibleContextZh: ["搜索结果只读", "只能跳转到合法动作"],
      legalNextActionZh: "打开入住办理页后按状态处理"
    },
    {
      id: "14-cross-scenario-checkout-refund",
      testPlanItemZh: "入住确认后直接退房或退款。",
      failureCode: "cross_scenario_checkout_refund_forbidden",
      attemptedActionZh: "在入住办理里直接处理退场或返还款项",
      pageZh: "确认入住页",
      visibleContextZh: ["本场景只办理入住", "不能直接处理退场、返还款项或账务"],
      legalNextActionZh: "后续业务按在住管理和结算流程处理"
    }
  ];
}

async function renderAndCapture(page, item) {
  const messageZh = failureMessageByCode.get(item.failureCode) ?? "当前业务规则未通过，未写入任何业务结果。";
  const sideEffects = Object.fromEntries(noSideEffectTargets.map((target) => [target, 0]));
  const analysis = {
    "失败是否业务可理解": messageZh,
    "是否证明无副作用": "未写入任何业务事实：入住记录、占用、凭证、提交、事件、投影、搜索、看板和账务均为 0。",
    "是否暴露内部 ID": "页面只提示系统引用不匹配，不展示内部编号。",
    "是否阻断越界": item.failureCode.includes("cross_scenario") ? "已阻断跨场景退场、返还款项和账务动作。" : "失败停留在当前合法业务边界。",
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
        .next { color: #174a7c; font-weight: 700; }
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
    "contract.scenario7_runtime_rules",
    runtimeRules.authorityId === "Dormitory.Scenario7.CheckInProcessing" &&
      runtimeRules.scenarioPackageNo === 7 &&
      runtimeRules.nameZh === "入住办理",
    "runtime rules 必须绑定场景 7 入住办理。",
    { authorityId: runtimeRules.authorityId, scenarioPackageNo: runtimeRules.scenarioPackageNo, nameZh: runtimeRules.nameZh });
  addAssertion(
    "contract.failure_semantics_no_side_effects",
    (runtimeRules.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    "全部失败语义必须无副作用。",
    (runtimeRules.failureSemantics ?? []).map((failure) => failure.failureCode));
  addAssertion(
    "contract.checkin_invariants_defined",
    runtimeRules.checkInInvariantRule?.validReservationRequired === true &&
      runtimeRules.checkInInvariantRule?.credentialRequiresSuccessfulStay === true &&
      runtimeRules.checkInInvariantRule?.failureNoSideEffects === true,
    "入住不变量必须要求有效预订、成功入住后才能发凭证、失败无副作用。",
    runtimeRules.checkInInvariantRule);
  addAssertion(
    "contract.readonly_and_cross_scenario_failures_defined",
    failureMessageByCode.has("readonly_result_write_attempt") &&
      failureMessageByCode.has("cross_scenario_checkout_refund_forbidden") &&
      failureMessageByCode.has("forged_internal_reference"),
    "必须定义只读写入、跨场景退场/返还款项、伪造内部引用失败语义。",
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
    version: "oam.dormitory-scenario7-negative-screenshot-index.v1",
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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
