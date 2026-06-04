import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, runtimeStore, source, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C Operation Panel runtime contract", () => {
  it("normalizes legacy task ids and renders only persisted WorkItem runtime identity", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE" });
    const html = routeView(ctx);

    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
    expect(html).toContain("W-STAY-RESOURCE:roomSetup");
    expect(html).not.toContain("T-ROOM-CREATE");
    expect(visibleText(html)).not.toMatch(/\b(commandSubmissionId|payloadHash|workItemId|caseId|OperationPanelView|TrustedConfirmSheet|ActionResult)\b/);
    expect(visibleText(html)).not.toContain("载荷指纹");
    expect(visibleText(html)).not.toContain("operationsPrepare");
    expect(visibleText(html)).not.toContain("operationsConfirm");
  });

  it("keeps runtime proof details available only for debug or audit surfaces", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE", debugSurface: true });
    const html = routeView(ctx);

    expect(html).toContain('data-surface="operation-runtime-proof"');
    expect(html).toContain("提交记录");
    expect(html).toContain("载荷指纹");
  });

  it("blocks submit when a persisted WorkItem is missing", () => {
    const runtime = source("../operationRuntime.js");
    const panel = source("../views/operationPanelView.js");

    expect(runtime).toContain("persisted_work_item_required");
    expect(runtime).not.toContain("allowCompatibilityFallback");
    expect(runtime).not.toContain("submitCardOperationCompatibilityFallback");
    expect(runtime).not.toContain("prepareCard");
    expect(runtime).not.toContain("confirmCard");
    expect(panel).toContain("state.selectedWorkItemId = persistedWorkItemId");
    expect(panel).not.toContain("ctx.workspace()");
  });

  it("publishes machine-readable admission and runtime decisions for browser evidence", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    const html = routeView(ctx);

    expect(html).toContain('data-admission-decision="visible_allowed_confirmable"');
    expect(html).toContain('data-runtime-decision="work_item_confirm_ready"');
    expect(html).toContain('data-lifecycle-state="ready"');
  });

  it("renders a runtime hydration state before WorkItems load instead of a false blocker", () => {
    const store = runtimeStore();
    store.workQueue = [];
    store.operationWorkItems = [];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeHydrating: true,
      runtimeStore: store,
      selectedWorkItemId: "wi-loading",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup"
    });

    const html = routeView(ctx);

    expect(html).toContain('data-surface="runtime-hydration"');
    expect(visibleText(html)).toContain("正在同步真实任务");
    expect(visibleText(html)).not.toContain("暂不能直接办理");
    expect(ctx.state.lastActionResult).toBeUndefined();
  });

  it("uses the current projection card state over stale WorkItem snapshots after commit", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].status = "done";
    store.operationWorkItems[0] = {
      ...store.operationWorkItems[0],
      lifecycleState: "ready",
      card: {
        ...store.workspaces[0].cards[0],
        status: "ready"
      }
    };
    store.workQueue[0] = {
      ...store.workQueue[0],
      lifecycleState: "ready"
    };
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store,
      lastActionResult: {
        status: "committed_projection_pending",
        workspaceId: "W-STAY-RESOURCE",
        cardId: "roomSetup",
        message: "已提交成功，视图同步中。"
      }
    });

    const html = routeView(ctx);

    expect(html).toContain('data-surface="completed-operation-record"');
    expect(html).not.toContain("data-submit-card");
    expect(visibleText(html)).not.toContain("提交处理");
  });
});
