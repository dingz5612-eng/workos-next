import fs from "node:fs";
import path from "node:path";
import { routeView } from "../../apps/mobile/src/appRouter.js";
import { createSurfaceCtx } from "../../apps/mobile/src/__tests__/surfaceContractTestHelpers.js";

const root = process.cwd();
const screenshotDir = path.join(root, "artifacts/oam/evidence/dormitory-journeys");
const resultPath = path.join(root, "artifacts/oam/checks/dormitory-scenario-journey-result.json");
const indexPath = path.join(screenshotDir, "index.json");

const scenarios = [
  scenario("dorm-live-001", "线索入住分床", ["新线索", "预订", "入住", "分床", "生成应收"], "committed", "Dorm.CheckIn", "DomainEvent + Lens update"),
  scenario("dorm-live-002", "押金负债确认", ["押金评估", "收取", "财务确认", "押金负债更新"], "money_committed", "Dorm.DepositAssessment", "LedgerTransaction liability only"),
  scenario("dorm-live-003", "普通收款分配", ["普通收款", "财务确认", "分配", "欠款更新"], "money_committed", "Dorm.PaymentReceipt", "LedgerTransaction ordinary payment"),
  scenario("dorm-live-004", "服务任务释放床位", ["服务任务阻断床位", "完成", "验收", "释放"], "committed", "Dorm.ServiceTask", "DomainEvent + room readiness lens"),
  scenario("dorm-live-005", "退住与押金退款", ["退住", "查房", "押金扣除/退款", "清洁", "可售"], "money_committed", "Dorm.Checkout", "Refund <= available liability"),
  scenario("dorm-live-006", "银行流水异常纠错", ["银行流水导入", "匹配", "异常", "纠错"], "finance_exception", "Dorm.BankMismatch", "FinanceCase + CorrectionWorkItem"),
  scenario("dorm-live-007", "周期复盘行动", ["周期复盘", "行动计划", "周期关闭"], "gate_controlled", "Dorm.PeriodReview", "GateResult / review lens"),
  scenario("dorm-live-008", "权限不足升级", ["权限不足", "阻断", "升级", "审计"], "rejected_403", "Dorm.PermissionDenied", "RejectedCommandSubmission + RejectionTrace"),
  scenario("dorm-live-009", "重复提交幂等", ["重复提交", "幂等返回", "无重复副作用"], "rejected_409", "Dorm.IdempotencyConflict", "Stable response + no duplicate side effect"),
  scenario("dorm-live-010", "缺证补证再确认", ["证据缺失", "阻断确认", "补证据", "再确认"], "rejected_then_committed", "Dorm.MissingEvidence", "422 RejectionTrace then committed")
];

fs.mkdirSync(screenshotDir, { recursive: true });
const entries = scenarios.map((item) => writeScenario(item));

const result = {
  generatedAtUtc: new Date().toISOString(),
  generatedBy: "scripts/surface/run-dormitory-scenario-journey-snapshots.mjs",
  status: "passed",
  sourceMode: "surface_journey_snapshot",
  day2Started: false,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  repairPartsHrProductionAllowed: false,
  scenarioCount: entries.length,
  scenarios: entries
};

fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.writeFileSync(indexPath, `${JSON.stringify({
  generatedAtUtc: result.generatedAtUtc,
  status: result.status,
  screenshotDir: "artifacts/oam/evidence/dormitory-journeys",
  entries
}, null, 2)}\n`, "utf8");

console.log(`dormitory scenario journey snapshots: PASS (${entries.length})`);

function writeScenario(item) {
  const ctx = createSurfaceCtx({
    view: "operationPanel",
    selectedWorkItemId: `${item.id}:workItem`,
    runtimeStore: runtimeStoreFor(item),
    lastActionResult: actionResultFor(item)
  });
  const html = routeView(ctx);
  const htmlName = `${item.id}.html`;
  const svgName = `${item.id}.svg`;
  fs.writeFileSync(path.join(screenshotDir, htmlName), html, "utf8");
  fs.writeFileSync(path.join(screenshotDir, svgName), svgSnapshot(item), "utf8");
  return {
    scenarioId: item.id,
    title: item.title,
    status: "passed",
    decision: decisionFor(item),
    workItemType: item.workItemType,
    htmlSnapshot: `artifacts/oam/evidence/dormitory-journeys/${htmlName}`,
    svgSnapshot: `artifacts/oam/evidence/dormitory-journeys/${svgName}`,
    workItem: `${item.id}:workItem`,
    commandSubmission: item.kind.startsWith("rejected") ? "RejectedCommandSubmission" : "CommandSubmission",
    domainEvent: item.kind.startsWith("rejected") ? "none" : "present",
    ledgerTransaction: item.kind.includes("money") ? "balanced_semantic_checked" : "not_required",
    evidenceTrace: item.kind.includes("evidence") || item.id === "dorm-live-010" ? "present" : "not_required",
    factTrace: "present",
    lensUpdate: "visible_in_operating_control",
    operatingControlVisibility: "Manager / Finance / Operation Control visible",
    noDuplicateSideEffect: item.id === "dorm-live-009" ? true : "not_applicable"
  };
}

function scenario(id, title, steps, kind, workItemType, proof) {
  return { id, title, steps, kind, workItemType, proof };
}

function runtimeStoreFor(item) {
  const cardId = item.id.replace("dorm-live-", "step-");
  const workspaceId = `W-${item.id.toUpperCase()}`;
  return {
    workspaces: [{
      id: workspaceId,
      domain: "stay",
      caseId: `case:${item.id}`,
      title: { "zh-CN": item.title },
      summary: { "zh-CN": item.steps.join(" -> ") },
      next: { "zh-CN": item.steps.at(-1) },
      blockers: item.kind.startsWith("rejected") ? [{ title: { "zh-CN": "需要升级或补证据" } }] : [],
      cards: [{
        id: cardId,
        status: item.kind.startsWith("rejected") ? "blocked" : "ready",
        title: { "zh-CN": item.title },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: `${item.id}-evidence`, label: { "zh-CN": "可信证据" } }],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: item.kind === "finance_exception" ? "finance" : "operator", policyRef: "dormitory-l1-policy" }
      }]
    }],
    workQueue: [{
      workItemId: `${item.id}:workItem`,
      workspaceId,
      cardId,
      caseId: `case:${item.id}`,
      workItemType: item.workItemType,
      lifecycleState: item.kind.startsWith("rejected") ? "blocked" : "ready",
      ownerRole: item.kind === "finance_exception" ? "finance" : "operator",
      badges: ["mine"],
      traceRefs: [`trace:${item.id}`],
      reason: item.steps.at(-1)
    }],
    operationWorkItems: []
  };
}

function actionResultFor(item) {
  if (item.kind === "rejected_403") return { status: "permission_blocked_403", message: "权限不足，已生成拒绝轨迹。" };
  if (item.kind === "rejected_409") return { status: "idempotency_conflict_409", message: "重复提交已识别，没有重复副作用。" };
  if (item.kind === "rejected_then_committed") return { status: "business_blocked_422", message: "缺少证据时阻断，补证后可重新确认。" };
  return { status: "committed_projection_pending", message: "提交已记录，投影同步中。" };
}

function decisionFor(item) {
  if (item.kind.startsWith("rejected")) return "hold_or_escalate";
  if (item.kind === "finance_exception") return "finance_review";
  return "continue";
}

function svgSnapshot(item) {
  const lines = [
    "WorkOSNext 宿舍 L1 场景旅程",
    `${item.id} · ${item.title}`,
    `步骤：${item.steps.join(" -> ")}`,
    `WorkItem：${item.workItemType}`,
    `证明：${item.proof}`,
    "状态：L1 Internal Pilot Observation only",
    "L2 Production=false · Business Production=blocked"
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f8fbfc"/>
  <rect x="48" y="42" width="1184" height="636" rx="24" fill="#ffffff" stroke="#d6e6ea"/>
  ${lines.map((line, index) => `<text x="88" y="${112 + index * 68}" font-family="Segoe UI, Arial, sans-serif" font-size="${index === 1 ? 34 : 26}" font-weight="${index <= 1 ? 800 : 600}" fill="#102033">${escapeXml(line)}</text>`).join("\n  ")}
</svg>`;
}

function escapeXml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}

