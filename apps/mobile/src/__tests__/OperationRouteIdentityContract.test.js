import { describe, expect, it } from "vitest";
import { openWorkItem } from "../navigationController.js";
import { resolveOperationPanelTarget, resolvePersistedWorkItem } from "../operationRouteResolver.js";
import { routeView } from "../appRouter.js";
import { WorkItemCard } from "../views/experienceComponents.js";
import { searchView } from "../views/searchView.js";
import { createSurfaceCtx, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B WorkItem route identity", () => {
  it("opens workbench WorkItem with a persisted runtime identity", () => {
    const ctx = createSurfaceCtx();

    const target = openWorkItem("W-STAY-RESOURCE:roomSetup", ctx);

    expect(target.canOpen).toBe(true);
    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
    expect(routeView(ctx)).toContain('data-surface="operation-panel-route"');
  });

  it("resolves workspace card compatibility input to a persisted WorkItem", () => {
    const ctx = createSurfaceCtx();

    const workItem = resolvePersistedWorkItem({
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup"
    }, ctx.state);

    expect(workItem.workItemId).toBe("W-STAY-RESOURCE:roomSetup");
  });

  it("does not treat legacy task id as the operation identity", () => {
    const ctx = createSurfaceCtx({
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup"
    });

    const target = resolveOperationPanelTarget({
      workItemId: "T-ROOM-CREATE",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup"
    }, ctx.state);

    expect(target.canOpen).toBe(true);
    expect(target.workItem.workItemId).toBe("W-STAY-RESOURCE:roomSetup");
  });

  it("does not render an operation CTA when no persisted WorkItem exists", () => {
    const store = runtimeStore();
    store.workQueue = [];
    store.operationWorkItems = [];
    const ctx = createSurfaceCtx({ runtimeStore: store });
    const workspace = store.workspaces[0];
    const card = workspace.cards[0];

    const html = WorkItemCard({ workspace, card, workspaceId: workspace.id, cardId: card.id }, ctx);

    expect(html).not.toContain("data-work-item-id");
    expect(visibleText(html)).toContain("暂不能直接办理");
    expect(visibleText(html)).toContain("这条记录还没有生成可办理任务");
  });

  it("shows Chinese not-found guidance for a fake Operation Panel id", () => {
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "fake-work-item",
      selectedWorkspace: "",
      selectedCardId: ""
    });

    const html = routeView(ctx);

    expect(visibleText(html)).toContain("暂不能直接办理");
    expect(visibleText(html)).toContain("请从工作队列打开真实任务");
    expect(visibleText(html)).not.toContain("fake-work-item");
  });

  it("renders search WorkItem action with the persisted WorkItem id", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });

    const html = searchView(ctx);

    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain("进入办理面");
  });
});
