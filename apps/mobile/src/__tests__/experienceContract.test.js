import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { shell } from "../appShell.js";
import {
  actionResultStateMatrix,
  defaultHomeForRole,
  evidenceStateMatrix,
  mobileBottomNavigation,
  workItemCardSchema
} from "../experienceContract.js";
import { confirmSuccessMessage } from "../operationController.js";
import { evaluateSurfaceAccess } from "../surfaceGuard.js";
import {
  ActionResult,
  DeviceTrustPanel,
  EvidenceSheet,
  EvidenceTile,
  LifecycleWorkspace,
  PermissionDiagnostic,
  SubmitQueue,
  UploadQueue,
  WorkItemCard
} from "../views/experienceComponents.js";

describe("RT-5 Experience Contract", () => {
  it("keeps ordinary operator mobile bottom nav to Today Work Search Me", () => {
    vi.stubGlobal("window", { location: { protocol: "http:", hostname: "localhost", port: "5173", origin: "http://localhost:5173" } });
    vi.stubGlobal("localStorage", { getItem: () => null });
    const html = shell("<section></section>", ctx({ role: "operator" }));

    expect(mobileBottomNavigation).toEqual(["home", "workbench", "search", "me"]);
    expect(html).toContain("今天");
    expect(html).toContain("工作");
    expect(html).toContain("搜索");
    expect(html).toContain("我的");
    expect(html).not.toContain("releaseControl");
    expect(html).not.toContain("Release Control");
    vi.unstubAllGlobals();
  });

  it("maps role default homes to control surfaces", () => {
    expect(defaultHomeForRole("finance")).toBe("financeControl");
    expect(defaultHomeForRole("manager")).toBe("managerControlTower");
    expect(defaultHomeForRole("releaseOwner")).toBe("releaseFlightDeck");
  });

  it("hydrates Work from operations work-items and leaves work queue lens out of the main path", () => {
    const main = source("../main.js");

    expect(main).toContain("fetchOperationWorkItems");
    expect(main).not.toContain("fetchWorkQueue");
  });

  it("uses operations prepare and confirm for Operation Panel main submit path", () => {
    const runtime = source("../operationRuntime.js");
    const controller = source("../operationController.js");

    expect(runtime).toContain("prepareOperationWorkItem");
    expect(runtime).toContain("confirmOperationWorkItem");
    expect(controller).toContain("submitWorkItemOperation");
    expect(controller).not.toContain("submitCardOperation({");
  });

  it("keeps workspace/card compatibility fallback out of the mobile runtime", () => {
    const runtime = source("../operationRuntime.js");

    expect(runtime).not.toContain("submitCardOperationCompatibilityFallback");
    expect(runtime).not.toContain("prepareCard");
    expect(runtime).not.toContain("confirmCard");
  });

  it("defines differentiated blocked and pending states", () => {
    expect(actionResultStateMatrix.permission_blocked_403).toBe("PermissionDiagnostic");
    expect(actionResultStateMatrix.idempotency_conflict_409).toContain("duplicate");
    expect(actionResultStateMatrix.business_blocked_422).toContain("next action");
    expect(confirmSuccessMessage({ confirmed: true, commitStatus: "committed", projectionStatus: "pending" }, ctx())).toBe("submitProjectionPending");
  });

  it("blocks confirm for missing or rejected evidence and allows offline draft only", () => {
    expect(evidenceStateMatrix.missing).toBe("blocks confirm");
    expect(evidenceStateMatrix.rejected).toBe("blocks confirm");
    expect(evidenceStateMatrix.draft).toBe("can save draft");
  });

  it("renders WorkItemCard with every contract field", () => {
    const html = WorkItemCard({
      workItemId: "WI-1",
      caseId: "CASE-1",
      workItemType: "Dormitory.CheckIn",
      lifecycleState: "ready",
      ownerRole: "frontdesk",
      SLA: "PT4H",
      requiredEvidence: ["id-card", "deposit-receipt"],
      nextAction: "confirm check-in",
      traceRefs: ["cmd-1"],
      riskLevel: "P1",
      evidenceState: "missing",
      dueAt: "2026-06-02T09:00:00Z",
      businessObject: "Stay ST-1"
    }, ctx());

    expect(html).toContain('data-surface="action-decision-card"');
    expect(workItemCardSchema).toContain("workItemId");
    for (const label of ["当前能否处理", "为什么不能处理", "还缺什么证据", "下一步怎么做", "风险等级", "责任角色", "截止时间", "业务对象"]) {
      expect(html).toContain(label);
    }
    expect(visibleText(html)).not.toMatch(/\b(workItemId|caseId|traceRefs|lifecycleState|ownerRole)\b/);
  });

  it("renders lifecycle workspace as the main object workspace", () => {
    const workspace = workspaceFixture();
    const html = LifecycleWorkspace(workspace, workspace.cards[0], ctx());

    expect(html).toContain('data-surface="lifecycle-workspace"');
    expect(html).toContain("当前办理项");
    expect(html).toContain("当前状态");
    expect(html).toContain("生命周期时间线");
    expect(html).toContain("timeline-step");
    expect(html).toContain('data-workspace="W-DORM-STAY"');
    expect(html).toContain('data-card-id="checkIn"');
    expect(html).not.toContain("必需证据");
    expect(html).not.toContain("审计摘要");
  });

  it("renders trusted result, evidence, queue, device trust, and permission states", () => {
    const workspace = workspaceFixture();
    const activeCard = workspace.cards[0];
    const testCtx = ctx();

    expect(ActionResult({ status: "committed_projection_pending" }, testCtx)).toContain('data-surface="projection-pending"');
    expect(ActionResult({ status: "committed_projection_failed" }, testCtx)).toContain('data-surface="failed-sync"');
    expect(EvidenceTile(activeCard.evidence[0], {}, "", testCtx)).toContain('data-surface="evidence-tile"');
    expect(EvidenceSheet(activeCard, {}, testCtx)).toContain('data-surface="evidence-sheet"');
    expect(UploadQueue({}, testCtx)).toContain("证据上传");
    expect(SubmitQueue({}, testCtx)).toContain("提交队列");
    expect(DeviceTrustPanel({ currentDevice: { deviceId: "D-1", deviceTrustStatus: "trusted", surface: "mobile" } }, testCtx)).toContain("当前设备");
    const permission = PermissionDiagnostic({ reason: "role_surface_not_allowed", owner: "releaseOwner", requiredPermission: "release.flight_deck.view" }, testCtx);
    expect(permission).toContain("发布观察面访问权限");
    expect(permission).not.toContain("release.flight_deck.view");
  });

  it("blocks unauthorized release surfaces with PermissionDiagnostic data", () => {
    const decision = evaluateSurfaceAccess("releaseFlightDeck", {
      currentActor: { role: "operator", displayName: "Operator" },
      pcGovernance: { currentDevice: { deviceTrustStatus: "trusted", surface: "mobile" } }
    });

    expect(decision.allowed).toBe(false);
    expect(decision.component).toBe("PermissionDiagnostic");
    expect(decision.owner).toBe("releaseOwner");
  });
});

function ctx(actor = { role: "operator" }) {
  return {
    state: {
      view: "home",
      apiStatus: "online",
      currentActor: { displayName: "Operator", ...actor },
      lang: "zh-CN"
    },
    tr: (key) => ({
      app: "WorkOSNext",
      subtitle: "subtitle",
      language: "language",
      zh: "zh",
      ru: "ru",
      today: "今天",
      work: "工作",
      search: "搜索",
      me: "我的",
      apiOnline: "online",
      apiChecking: "checking",
      apiOffline: "offline",
      retryApi: "retry",
      feedback: "feedback",
      submitProjectionPending: "submitProjectionPending",
      evidenceUpload: "证据上传",
      submissionQueue: "提交队列",
      currentDevice: "当前设备",
      noPendingEvidenceUpload: "没有待上传证据",
      noPendingSubmission: "没有待提交办理",
      evidenceUploadWaiting: "证据等待上传",
      submissionWaiting: "办理等待提交",
      deviceTrusted: "设备已验证",
      deviceUnknown: "设备状态待确认",
      deviceContextIssue: "设备上下文异常",
      deviceContextIssueBody: "当前移动端读到了 PC 设备上下文，请刷新或重新登录以绑定当前移动设备。",
      canHandleNow: "当前可处理",
      cannotHandleNow: "暂不能处理",
      missingEvidenceBlocks: "缺少可信证据，确认会被阻断",
      noCriticalBlocker: "当前没有新的系统阻断，但关键动作仍需要人工确认。",
      decisionCanHandle: "当前能否处理",
      decisionBlocker: "为什么不能处理",
      decisionMissingEvidence: "还缺什么证据",
      decisionNextAction: "下一步怎么做",
      decisionRisk: "风险等级",
      decisionOwner: "责任角色",
      decisionDueAt: "截止时间",
      decisionBusinessObject: "业务对象",
      objectSummary: "对象摘要",
      currentState: "当前状态",
      lifecycleTimeline: "生命周期时间线",
      currentWorkItem: "当前办理项",
      requiredFields: "必填字段",
      requiredEvidenceCopy: "必需证据",
      businessImpact: "业务影响",
      riskAndBlockers: "风险与阻断",
      auditSummary: "审计摘要",
      traceWillBind: "提交后绑定审计轨迹",
      traceBound: "已绑定审计轨迹",
      nextAction: "下一步",
      projectionPending: "视图同步中",
      projectionPendingBody: "提交已经完成，投影同步中；这不是失败。",
      failedSync: "同步需要支持",
      failedSyncBody: "提交已经记录，但读侧同步需要支持人员跟进。",
      trustedEvidence: "可信证据",
      evidenceMissing: "缺少证据",
      evidenceTrustedDraft: "已选择，待可信校验",
      noRequiredEvidence: "当前动作无必需证据",
      evidenceReady: "证据已就绪",
      evidenceNeedReview: "证据待补齐或复核",
      operatorRole: "运营经办人"
    })[key] || key,
    tx: (value) => typeof value === "string" ? value : value["zh-CN"],
    localTerm: (value) => value?.label?.["zh-CN"] || value?.id || value,
    escapeHtml: (value) => String(value),
    escapeAttr: (value) => String(value)
  };
}

function visibleText(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function workspaceFixture() {
  return {
    id: "W-DORM-STAY",
    domain: "stay",
    taskId: "WI-STAY-1",
    caseId: "CASE-STAY-1",
    title: { "zh-CN": "入住办理", "ru-RU": "Заселение" },
    summary: { "zh-CN": "对象生命周期摘要", "ru-RU": "Сводка" },
    next: { "zh-CN": "确认入住", "ru-RU": "Подтвердить" },
    cards: [{
      id: "checkIn",
      status: "ready",
      title: { "zh-CN": "确认入住", "ru-RU": "Подтвердить" },
      fields: { business: [{ id: "stayId", label: { "zh-CN": "住宿单" } }] },
      evidence: [{ id: "identityEvidence", label: { "zh-CN": "身份证据" } }],
      blockerRules: [],
      confirmation: { requiredRole: "frontdesk" }
    }]
  };
}

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
