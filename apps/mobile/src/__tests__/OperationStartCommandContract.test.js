import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient.js", () => ({
  fetchSearchResults: vi.fn(),
  recordMobileClientEvent: vi.fn(),
  startOperationsWorkspace: vi.fn()
}));

import { fetchSearchResults, startOperationsWorkspace } from "../apiClient.js";
import { runSearch, startOperationsWorkspaceCommand } from "../navigationController.js";
import { routeView } from "../appRouter.js";
import { applyRuntimeProjection, applyRuntimeSurfacePayloads } from "../runtime/runtimeStore.js";
import { createSurfaceCtx, internalPilotAdmissionFixture, runtimeStore, source, visibleText } from "./surfaceContractTestHelpers.js";
import { DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS } from "../capabilityProjection.js";

describe("Operations Runtime start command contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lands projection and Operations WorkItem before rendering the operation panel", async () => {
    const store = runtimeStore();
    const workspace = {
      ...store.workspaces[0],
      id: `${DORMITORY_MAINLINE_WORKSPACE_ID}-202606040001`
    };
    const workItem = {
      workItemId: "wi-start-room-001",
      workspaceId: workspace.id,
      caseId: workspace.id,
      workItemType: DORMITORY_SCENARIO1_STEPS[0].workItemType,
      lifecycleState: "available",
      ownerRole: "operator",
      admission: internalPilotAdmissionFixture(),
      payload: {
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
        templateWorkspaceId: DORMITORY_MAINLINE_WORKSPACE_ID
      }
    };
    startOperationsWorkspace.mockResolvedValue({
      workspace,
      workItem,
      operationWorkItems: [workItem],
      projection: {
        workspaces: [workspace],
        events: []
      }
    });
    store.workspaces = [];
    store.workQueue = [];
    store.operationWorkItems = [];
    const ctx = createSurfaceCtx({ view: "search", runtimeStore: store });
    ctx.applyRuntimeProjection = (payload) => applyRuntimeProjection(ctx.state, payload);
    ctx.render = vi.fn();
    ctx.hydrateProjectionFromApi = vi.fn();

    await startOperationsWorkspaceCommand(ctx, DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS[0].cardId, {
      anchorQuery: "D02 / 22 / 01 / 张三 / 13800001234"
    });

    expect(startOperationsWorkspace).toHaveBeenCalledWith(
      DORMITORY_MAINLINE_WORKSPACE_ID,
      "operator-token",
      "operation_workspace_start_failed",
      {
        anchorQuery: "D02 / 22 / 01 / 张三 / 13800001234",
        anchorPayload: null
      }
    );
    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkspace).toBe(workspace.id);
    expect(ctx.state.selectedCardId).toBe(DORMITORY_SCENARIO1_STEPS[0].cardId);
    expect(ctx.state.selectedWorkItemId).toBe("wi-start-room-001");
    expect(ctx.state.operationMessage).toBe("");
    expect(ctx.state.runtimeStore.workspaces).toHaveLength(1);
    expect(ctx.state.runtimeStore.operationWorkItems).toHaveLength(1);
    expect(ctx.render).toHaveBeenCalledWith(true);
    expect(ctx.hydrateProjectionFromApi).not.toHaveBeenCalled();
    expect(routeView(ctx)).toContain('data-surface="operation-panel-route"');
    expect(visibleText(routeView(ctx))).toContain("本步要做");
    expect(visibleText(routeView(ctx))).toContain("填写房间信息");
    expect(visibleText(routeView(ctx))).toContain("提交前检查");
    expect(visibleText(routeView(ctx))).not.toContain("available");
    expect(visibleText(routeView(ctx))).not.toContain("暂不能直接办理");
  });

  it("starts new dormitory work through the Operations Runtime endpoint and clears stale route blockers", async () => {
    const apiClient = source("../apiClient.js");
    expect(apiClient).toContain("operationsWorkspaceStart");
    expect(apiClient).not.toContain('runtimeFetch("/api/workspaces/start"');
    expect(apiClient).not.toContain("startWorkspace(");
    expect(apiClient).not.toContain("startResourceSetup(");
    expect(apiClient).not.toContain("prepareCard(");
    expect(apiClient).not.toContain("confirmCard(");

    const store = runtimeStore();
    const workspace = {
      ...store.workspaces[0],
      id: `${DORMITORY_MAINLINE_WORKSPACE_ID}-202606040002`
    };
    const workItem = {
      workItemId: "wi-start-room-002",
      workspaceId: workspace.id,
      caseId: workspace.id,
      workItemType: DORMITORY_SCENARIO1_STEPS[0].workItemType,
      lifecycleState: "available",
      ownerRole: "operator",
      admission: internalPilotAdmissionFixture(),
      payload: {
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
        templateWorkspaceId: DORMITORY_MAINLINE_WORKSPACE_ID
      }
    };
    startOperationsWorkspace.mockResolvedValue({
      workspace,
      workItem,
      operationWorkItems: [workItem],
      projection: {
        workspaces: [workspace],
        events: []
      }
    });
    store.workspaces = [];
    store.operationWorkItems = [];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store,
      lastActionResult: {
        status: "business_blocked_422",
        reason: "operation_work_item_required",
        message: "需要先生成可办理任务，再提交办理记录。"
      }
    });
    ctx.applyRuntimeProjection = (payload) => applyRuntimeProjection(ctx.state, payload);
    ctx.render = vi.fn();
    ctx.hydrateProjectionFromApi = vi.fn();

    await startOperationsWorkspaceCommand(ctx, DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS[0].cardId);

    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("wi-start-room-002");
    expect(ctx.state.lastActionResult).toBeNull();
    expect(visibleText(routeView(ctx))).toContain("填写房间信息");
    expect(visibleText(routeView(ctx))).not.toContain("查看不能提交原因");
  });

  it("keeps previously opened persisted Operations WorkItems when a new start returns one item", () => {
    const store = runtimeStore();
    store.operationWorkItems = [{
      workItemId: "wi-resource-room",
      workspaceId: "W-STAY-RESOURCE-001",
      cardId: "roomSetup",
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({ runtimeStore: store });

    applyRuntimeSurfacePayloads(ctx.state, {
      operationWorkItems: [{
        workItemId: "wi-lead-capture",
        workspaceId: "W-STAY-LEAD-RESERVATION-001",
        cardId: "leadCapture",
        lifecycleState: "ready",
        ownerRole: "operator"
      }]
    });

    expect(ctx.state.runtimeStore.operationWorkItems.map((item) => item.workItemId)).toEqual([
      "wi-lead-capture",
      "wi-resource-room"
    ]);
    expect(ctx.state.runtimeStore.workQueue.map((item) => item.workItemId)).toEqual([
      "wi-lead-capture",
      "wi-resource-room"
    ]);
  });

  it("removes a stale persisted Operations WorkItem when runtime returns a tombstone", () => {
    const store = runtimeStore();
    store.operationWorkItems = [{
      workItemId: "wi-resource-room",
      workspaceId: "W-STAY-RESOURCE-001",
      cardId: "roomSetup",
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-resource-room",
      selectedWorkspace: "W-STAY-RESOURCE-001",
      selectedCardId: "roomSetup",
      runtimeStore: store
    });

    applyRuntimeSurfacePayloads(ctx.state, {
      operationWorkItems: [{
        workItemId: "wi-resource-room",
        workspaceId: "W-STAY-RESOURCE-001",
        cardId: "roomSetup",
        lifecycleState: "closed",
        tombstone: true
      }]
    });

    expect(ctx.state.runtimeStore.operationWorkItems.map((item) => item.workItemId)).not.toContain("wi-resource-room");
    expect(ctx.state.runtimeStore.workQueue.map((item) => item.workItemId)).not.toContain("wi-resource-room");
    expect(routeView(ctx)).not.toContain("data-submit-card");
  });

  it("removes a stale persisted Operations WorkItem when runtime returns removedWorkItemIds", () => {
    const store = runtimeStore();
    store.operationWorkItems = [{
      workItemId: "wi-resource-room",
      workspaceId: "W-STAY-RESOURCE-001",
      cardId: "roomSetup",
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({ runtimeStore: store });

    applyRuntimeSurfacePayloads(ctx.state, {
      operationWorkItems: [],
      removedWorkItemIds: ["wi-resource-room"]
    });

    expect(ctx.state.runtimeStore.operationWorkItems.map((item) => item.workItemId)).not.toContain("wi-resource-room");
    expect(ctx.state.runtimeStore.workQueue.map((item) => item.workItemId)).not.toContain("wi-resource-room");
  });

  it("does not expose blocked workspace/card write paths to the mobile client", () => {
    const runtimePaths = source("../generated/runtimeApiPaths.js");
    const apiClient = source("../apiClient.js");

    expect(runtimePaths).not.toContain("startWorkspace:");
    expect(runtimePaths).not.toContain("startResourceSetupWorkspace:");
    expect(runtimePaths).not.toContain("prepareCard:");
    expect(runtimePaths).not.toContain("confirmCard:");
    expect(apiClient).not.toContain("startWorkspace(");
    expect(apiClient).not.toContain("startResourceSetup(");
    expect(apiClient).not.toContain("prepareCard(");
    expect(apiClient).not.toContain("confirmCard(");
  });

  it("keeps business anchor query on the shared Operations workspace start request", () => {
    const apiClient = source("../apiClient.js");
    const navigation = source("../navigationController.js");
    const search = source("../views/searchView.js");
    const binder = source("../eventBinder.js");

    expect(apiClient).toContain("anchorQuery: context.anchorQuery");
    expect(apiClient).toContain("anchorPayload: context.anchorPayload");
    expect(navigation).toContain("anchorQuery: options.anchorQuery || ctx.state.query");
    expect(search).toContain("data-anchor-query");
    expect(binder).toContain("node.dataset.anchorQuery || ctx.state.query");
  });

  it("routes forbidden start commands to permission diagnosis instead of API offline copy", async () => {
    startOperationsWorkspace.mockRejectedValue({
      status: 403,
      reason: "admission_role_forbidden:workspace_start",
      code: "operation_workspace_start_forbidden"
    });
    const ctx = createSurfaceCtx({ view: "search" });
    ctx.render = vi.fn();

    await startOperationsWorkspaceCommand(ctx, "W-STAY-RESOURCE", "roomSetup");

    expect(ctx.state.view).toBe("permissionDiagnostic");
    expect(ctx.state.operationMessage).toBe("");
    expect(ctx.state.lastActionResult.status).toBe("permission_blocked_403");
    expect(ctx.state.permissionDiagnostic.requiredPermission).toBe("operations.workspace.start");
    expect(visibleText(routeView(ctx))).toContain("权限诊断");
    expect(visibleText(routeView(ctx))).not.toContain("运行服务未连接");
  });

  it("prevents a stale search response from overriding a later runtime admission decision", async () => {
    let resolveSearch;
    fetchSearchResults.mockReturnValue(new Promise((resolve) => {
      resolveSearch = resolve;
    }));
    startOperationsWorkspace.mockRejectedValue({
      status: 403,
      reason: "admission_role_forbidden:workspace_start",
      code: "operation_workspace_start_forbidden"
    });
    vi.stubGlobal("document", {
      querySelector: (selector) => selector === "#query" ? { value: "新增住宿房源" } : null
    });
    const ctx = createSurfaceCtx({ view: "search" });
    ctx.render = vi.fn();

    const pendingSearch = runSearch(ctx);
    await startOperationsWorkspaceCommand(ctx, "W-STAY-RESOURCE", "roomSetup");
    resolveSearch([]);
    await pendingSearch;

    expect(ctx.state.view).toBe("permissionDiagnostic");
    expect(ctx.state.permissionDiagnostic.reason).toBe("admission_role_forbidden:workspace_start");
    vi.unstubAllGlobals();
  });
});
