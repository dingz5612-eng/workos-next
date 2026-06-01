import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { mobileBottomNavigation } from "../experienceContract.js";
import { openWorkItem } from "../navigationController.js";
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
    expect(html).toContain("commandSubmissionId");
    expect(html).toContain("payloadHash");
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
    expect(html).not.toContain("T-ROOM-CREATE");
    vi.unstubAllGlobals();
  });

  it("renders Today as WorkItem Mission Control and Me as Personal Ops Center", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const todayCtx = ctx({ view: "home" });
    const meCtx = ctx({ view: "me" });

    expect(routeView(todayCtx)).toContain("WorkItem Mission Control");
    expect(routeView(todayCtx)).toContain('data-component="WorkItemMissionControl"');
    expect(routeView(meCtx)).toContain("Personal Ops Center");
    expect(routeView(meCtx)).toContain('data-component="PersonalOpsCenter"');
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
    expect(apiClient).toContain("fetchOperationWorkItem");
    expect(apiClient).toContain("fetchSubmissionTrace");
    expect(apiClient).toContain("fetchWorkItemTrace");
    expect(apiClient).toContain("fetchCaseTrace");
    expect(runtime).toContain("prepareOperationWorkItem");
    expect(runtime).toContain("confirmOperationWorkItem");
    expect(runtime).toContain("submitCardOperationCompatibilityFallback");
    expect(eventBinder).toContain("[data-work-item-id]");
    expect(eventBinder).toContain("openWorkItem");
    expect(operationPanel).toContain("payloadHash");
    expect(operationPanel).toContain("commandSubmissionId");
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
    tr: (key) => key,
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

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
