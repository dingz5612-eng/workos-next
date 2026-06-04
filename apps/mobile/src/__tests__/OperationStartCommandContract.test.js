import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient.js", () => ({
  fetchSearchResults: vi.fn(),
  startResourceSetup: vi.fn(),
  startWorkspace: vi.fn()
}));

import { fetchSearchResults, startResourceSetup } from "../apiClient.js";
import { runSearch, startWorkspaceCommand } from "../navigationController.js";
import { routeView } from "../appRouter.js";
import { applyRuntimeProjection } from "../runtime/runtimeStore.js";
import { createSurfaceCtx, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

describe("Operations Runtime start command contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lands projection and Operations WorkItem before rendering the operation panel", async () => {
    const store = runtimeStore();
    const workspace = {
      ...store.workspaces[0],
      id: "W-STAY-RESOURCE-202606040001"
    };
    const workItem = {
      workItemId: "wi-start-room-001",
      workspaceId: workspace.id,
      caseId: workspace.id,
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "available",
      ownerRole: "operator",
      payload: {
        cardId: "roomSetup",
        templateWorkspaceId: "W-STAY-RESOURCE"
      }
    };
    startResourceSetup.mockResolvedValue({
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

    await startWorkspaceCommand(ctx, "W-STAY-RESOURCE", "roomSetup");

    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkspace).toBe(workspace.id);
    expect(ctx.state.selectedCardId).toBe("roomSetup");
    expect(ctx.state.selectedWorkItemId).toBe("wi-start-room-001");
    expect(ctx.state.operationMessage).toBe("");
    expect(ctx.state.runtimeStore.workspaces).toHaveLength(1);
    expect(ctx.state.runtimeStore.operationWorkItems).toHaveLength(1);
    expect(ctx.render).toHaveBeenCalledWith(true);
    expect(ctx.hydrateProjectionFromApi).not.toHaveBeenCalled();
    expect(routeView(ctx)).toContain('data-surface="operation-panel-route"');
    expect(visibleText(routeView(ctx))).toContain("办理操作");
    expect(visibleText(routeView(ctx))).toContain("提交处理");
    expect(visibleText(routeView(ctx))).toContain("可办理");
    expect(visibleText(routeView(ctx))).not.toContain("available");
    expect(visibleText(routeView(ctx))).not.toContain("暂不能直接办理");
  });

  it("routes forbidden start commands to permission diagnosis instead of API offline copy", async () => {
    startResourceSetup.mockRejectedValue({
      status: 403,
      reason: "role_confirmation_forbidden:workspace_start",
      code: "role_confirmation_forbidden:workspace_start"
    });
    const ctx = createSurfaceCtx({ view: "search" });
    ctx.render = vi.fn();

    await startWorkspaceCommand(ctx, "W-STAY-RESOURCE", "roomSetup");

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
    startResourceSetup.mockRejectedValue({
      status: 403,
      reason: "role_confirmation_forbidden:workspace_start",
      code: "role_confirmation_forbidden:workspace_start"
    });
    vi.stubGlobal("document", {
      querySelector: (selector) => selector === "#query" ? { value: "新增住宿房源" } : null
    });
    const ctx = createSurfaceCtx({ view: "search" });
    ctx.render = vi.fn();

    const pendingSearch = runSearch(ctx);
    await startWorkspaceCommand(ctx, "W-STAY-RESOURCE", "roomSetup");
    resolveSearch([]);
    await pendingSearch;

    expect(ctx.state.view).toBe("permissionDiagnostic");
    expect(ctx.state.permissionDiagnostic.reason).toBe("role_confirmation_forbidden:workspace_start");
    vi.unstubAllGlobals();
  });
});
