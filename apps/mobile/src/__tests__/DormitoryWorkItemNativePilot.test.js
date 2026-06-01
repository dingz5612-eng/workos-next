import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { mobileBottomNavigation } from "../experienceContract.js";
import { openWorkItem } from "../navigationController.js";
import { submitWorkItemOperation } from "../operationRuntime.js";
import { routeView } from "../appRouter.js";
import { evaluateSurfaceAccess } from "../surfaceGuard.js";

describe("DORM-INT-02 WorkItem-native pilot", () => {
  it("keeps ordinary mobile shell to Today Work Search Me and blocks admin surfaces", () => {
    expect(mobileBottomNavigation).toEqual(["home", "workbench", "search", "me"]);

    const state = {
      currentActor: { role: "operator", displayName: "Operator" },
      pcGovernance: { currentDevice: { deviceTrustStatus: "trusted", surface: "mobile" } }
    };

    for (const surface of ["releaseFlightDeck", "releaseControl", "governanceCenter", "pcGovernance", "financeControl", "financeReconciliation"]) {
      const decision = evaluateSurfaceAccess(surface, state);
      expect(decision.allowed).toBe(false);
      expect(decision.component).toBe("PermissionDiagnostic");
    }
  });

  it("opens [data-work-item-id] into Operation Panel", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const testCtx = ctx();

    openWorkItem("WI-DORM-001", testCtx);
    const html = routeView(testCtx);

    expect(testCtx.state.view).toBe("operationPanel");
    expect(testCtx.state.selectedWorkItemId).toBe("WI-DORM-001");
    expect(html).toContain('data-component="operationPanelRoute"');
    expect(html).toContain("operationsPrepare");
    expect(html).toContain("operationsConfirm");
    expect(html).toContain("提交记录");
    expect(html).toContain("载荷指纹");
    expect(visibleText(html)).not.toMatch(/\b(commandSubmissionId|payloadHash)\b/);
    vi.unstubAllGlobals();
  });

  it("normalizes legacy task ids to persisted Operations WorkItem ids", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const testCtx = ctx({
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup",
      runtimeStore: {
        workQueue: [],
        operationWorkItems: [{
          workItemId: "W-STAY-RESOURCE:roomSetup",
          caseId: "W-STAY-RESOURCE",
          workItemType: "roomSetup",
          lifecycleState: "ready",
          ownerRole: "operator",
          workspaceId: "W-STAY-RESOURCE"
        }],
        workspaces: [resourceWorkspaceFixture()]
      }
    });

    openWorkItem("T-ROOM-CREATE", testCtx, { workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup" });
    const html = routeView(testCtx);

    expect(testCtx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
    expect(html).toContain("W-STAY-RESOURCE:roomSetup");
    expect(html).toContain('data-component="TrustedConfirmSheet"');
    expect(html).not.toContain("T-ROOM-CREATE");
    vi.unstubAllGlobals();
  });

  it("renders persisted WorkItem ids when Operation Panel reopens with a legacy task id", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const testCtx = ctx({
      selectedWorkItemId: "T-ROOM-CREATE",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup",
      runtimeStore: {
        workQueue: [],
        operationWorkItems: [{
          workItemId: "W-STAY-RESOURCE:roomSetup",
          caseId: "W-STAY-RESOURCE",
          workItemType: "roomSetup",
          lifecycleState: "ready",
          ownerRole: "operator",
          workspaceId: "W-STAY-RESOURCE"
        }],
        workspaces: [resourceWorkspaceFixture()]
      },
    });
    testCtx.workspace = () => resourceWorkspaceFixture();

    const html = routeView(testCtx);

    expect(html).toContain("W-STAY-RESOURCE:roomSetup");
    expect(html).toContain('data-component="TrustedConfirmSheet"');
    expect(html).not.toContain("T-ROOM-CREATE");
    vi.unstubAllGlobals();
  });

  it("posts prepare and confirm with the selected persisted WorkItem id", async () => {
    const calls = [];
    vi.stubGlobal("window", { location: { protocol: "http:", hostname: "localhost", port: "5175", origin: "http://localhost:5175" } });
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => String(url).endsWith("/prepare")
          ? { prepared: true, commandSubmissionId: "sub-room-setup" }
          : { confirmed: false, commitStatus: "blocked", projectionStatus: "not_started", commandSubmissionId: "sub-room-setup" }
      };
    }));

    await submitWorkItemOperation({
      workspace: resourceWorkspaceFixture(),
      card: resourceWorkspaceFixture().cards[0],
      workItemId: "W-STAY-RESOURCE:roomSetup",
      actor: { token: "operator-token" },
      language: "zh-CN",
      fieldValues: { roomId: "R-101" },
      evidenceIds: ["evd-room-check"],
      submissionProtocol: {
        idempotencyKey: "idem-room-setup",
        submissionId: "sub-room-setup",
        cardInstanceId: "ci-room-setup",
        aggregateRef: "roomId:R-101"
      }
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/api/operations/work-items/W-STAY-RESOURCE:roomSetup/prepare");
    expect(calls[1].url).toContain("/api/operations/work-items/W-STAY-RESOURCE:roomSetup/confirm");
    expect(calls.map((call) => call.url).join(" ")).not.toContain("T-ROOM-CREATE");
    expect(calls[1].options.body).toContain("sub-room-setup");
    vi.unstubAllGlobals();
  });

  it("renders localized Today Mission Control and Personal Ops Center without component names", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const todayCtx = ctx({ view: "home" });
    const meCtx = ctx({ view: "me" });

    const todayHtml = routeView(todayCtx);
    const meHtml = routeView(meCtx);
    expect(todayHtml).toContain("今日任务中心");
    expect(todayHtml).not.toContain("WorkItemMissionControl");
    expect(todayHtml).not.toContain("WorkItem Mission Control");
    expect(meHtml).toContain("个人运营中心");
    expect(meHtml).toContain("证据上传");
    expect(meHtml).toContain("提交队列");
    expect(meHtml).toContain("当前设备");
    expect(meHtml).toContain("学习中心");
    expect(meHtml).not.toContain("PersonalOpsCenter");
    expect(meHtml).not.toContain("UploadQueue");
    expect(meHtml).not.toContain("SubmitQueue");
    expect(meHtml).not.toContain("DeviceTrustPanel");
    expect(meHtml).not.toContain("pc-current");
    expect(meHtml).not.toContain("surface pc");
    vi.unstubAllGlobals();
  });

  it("keeps Work and Operation Panel on WorkItem-native APIs", () => {
    const main = source("../main.js");
    const apiClient = source("../apiClient.js");
    const runtime = source("../operationRuntime.js");
    const eventBinder = source("../eventBinder.js");
    const operationPanel = source("../views/operationPanelView.js");

    expect(main).toContain("fetchOperationWorkItems");
    expect(main).not.toContain("fetchWorkQueue");
    expect(main).not.toContain("fetchReleaseControlCenter");
    expect(main).not.toContain("fetchProductionObservability");
    expect(apiClient).toContain("fetchOperationWorkItem");
    expect(apiClient).toContain("fetchSubmissionTrace");
    expect(apiClient).toContain("fetchWorkItemTrace");
    expect(apiClient).toContain("fetchCaseTrace");
    expect(apiClient).not.toContain("confirmBankStatementImport");
    expect(apiClient).not.toContain("recordGovernanceAuditEvent");
    expect(runtime).toContain("prepareOperationWorkItem");
    expect(runtime).toContain("confirmOperationWorkItem");
    expect(runtime).toContain("submitCardOperationCompatibilityFallback");
    expect(eventBinder).toContain("[data-work-item-id]");
    expect(eventBinder).toContain("openWorkItem");
    expect(eventBinder).not.toContain("financeReconciliationController");
    expect(eventBinder).not.toContain("pcGovernanceController");
    expect(operationPanel).toContain("payloadFingerprint");
    expect(operationPanel).toContain("submissionRecord");
    expect(operationPanel).not.toContain("ctx.workspace()");
  });
});

function ctx(overrides = {}) {
  const state = {
    view: "operationPanel",
    selectedWorkItemId: "WI-DORM-001",
    selectedWorkspace: "W-DORM-STAY",
    selectedCardId: "checkIn",
    selectedCardIndex: -1,
    apiStatus: "online",
    currentActor: { role: "operator", displayName: "Operator", token: "operator-token" },
    lang: "zh-CN",
    lastActionResult: {
      status: "committed_projection_pending",
      commandSubmissionId: "cmd-WI-DORM-001",
      payloadHash: "payload:abc123"
    },
    pcGovernance: { currentDevice: { deviceTrustStatus: "trusted", surface: "mobile" } },
    runtimeStore: {
      workQueue: [{
        workItemId: "WI-DORM-001",
        caseId: "CASE-DORM-001",
        workItemType: "Dormitory.CheckIn",
        lifecycleState: "ready",
        ownerRole: "frontdesk",
        workspaceId: "W-DORM-STAY",
        cardId: "checkIn",
        domain: "stay",
        badges: ["mine", "ready"],
        nextAction: "Confirm check-in",
        dueAt: "2026-06-02T09:00:00Z",
        traceRefs: ["trace-WI-DORM-001"]
      }],
      operationWorkItems: [],
      workspaces: [workspaceFixture()]
    },
    ...overrides
  };

  return {
    state,
    shell: (content) => content,
    tr: (key) => ({
      todayMissionControlEyebrow: "今天",
      todayMissionControl: "今日任务中心",
      assignedWorkItems: "今日待办",
      todayLearning: "今日必学",
      personalOpsCenter: "个人运营中心",
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
      learningCenter: "学习中心",
      learningCenterBody: "查看当前角色的办理说明和阻断处理。",
      myPermissions: "我的权限",
      myPermissionsBody: "查看我能办理的动作和需要升级的权限。",
      recentSubmissions: "最近提交",
      recentSubmissionsBody: "查看最近提交状态和重复提交结果。",
      recentTraces: "最近轨迹",
      recentTracesBody: "从 WorkItem 追踪提交、事件、证据和投影。",
      deviceTrustStatus: "设备可信状态",
      deviceTrustStatusBody: "查看当前设备是否可执行高风险动作。",
      submissionRecord: "提交记录",
      submissionRecordHelp: "确认后的稳定审计引用。",
      payloadFingerprint: "载荷指纹",
      payloadFingerprintHelp: "草稿字段和证据的提交指纹。",
      nextAction: "下一步",
      searchWorkItems: "WorkItem",
      searchOperationCases: "OperationCase",
      searchRooms: "房间",
      searchBeds: "床位",
      searchStays: "入住",
      searchEvidence: "证据",
      searchSubmissionTrace: "提交轨迹",
      searchLearning: "学习内容",
      learnEvidenceFix: "证据怎么补",
      learnEvidenceFixBody: "先确认必需证据，再补传并等待证据可信状态通过。",
      learnRejectedReason: "为什么被拒绝",
      learnRejectedReasonBody: "查看拒绝原因、责任人和下一步动作，不要重复提交。",
      openWorkspace: "进入办理面",
      coachNoMatch: "没有匹配结果",
      workbench: "工作台"
    })[key] || key,
    tx: (value) => typeof value === "string" ? value : value?.["zh-CN"] || "",
    localTerm: (value) => value?.label?.["zh-CN"] || value?.id || value,
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${label}</span><strong>${value}</strong></article>`,
    workspace: () => workspaceFixture(),
    render: vi.fn()
  };
}

function workspaceFixture() {
  return {
    id: "W-DORM-STAY",
    domain: "stay",
    taskId: "WI-DORM-001",
    caseId: "CASE-DORM-001",
    title: { "zh-CN": "宿舍入住", "ru-RU": "Заселение" },
    summary: { "zh-CN": "宿舍对象工作区", "ru-RU": "Рабочая область" },
    next: { "zh-CN": "确认入住", "ru-RU": "Подтвердить" },
    cards: [{
      id: "checkIn",
      status: "ready",
      workItemId: "WI-DORM-001",
      title: { "zh-CN": "确认入住", "ru-RU": "Подтвердить" },
      fields: { business: [{ id: "stayId", label: { "zh-CN": "住宿单" } }], system: [], analytics: [] },
      evidence: [{ id: "identityEvidence", label: { "zh-CN": "身份证据" } }],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "frontdesk", policyRef: "dormitory-evidence-policy" }
    }],
    blockers: []
  };
}

function resourceWorkspaceFixture() {
  return {
    id: "W-STAY-RESOURCE",
    domain: "stay",
    taskId: "T-ROOM-CREATE",
    title: { "zh-CN": "我要创建住宿资源" },
    summary: { "zh-CN": "房间床位配置" },
    next: { "zh-CN": "先配置房间和床位，再配置价格、准备度、阻断和释放。" },
    cards: [{
      id: "roomSetup",
      status: "ready",
      workItemId: "T-ROOM-CREATE",
      title: { "zh-CN": "房间配置卡" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    }],
    blockers: []
  };
}

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function visibleText(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
