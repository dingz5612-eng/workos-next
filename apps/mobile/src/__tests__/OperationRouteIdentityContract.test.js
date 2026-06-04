import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { openWorkspace, openWorkItem } from "../navigationController.js";
import { resolveOperationPanelTarget, resolvePersistedWorkItem } from "../operationRouteResolver.js";
import { routeView } from "../appRouter.js";
import { applyRuntimeSurfacePayloads } from "../runtime/runtimeStore.js";
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

  it("resolves card identity from Operations WorkItem payload", () => {
    const store = runtimeStore();
    store.operationWorkItems = [{
      workItemId: "wi-started-room",
      workspaceId: "W-STAY-RESOURCE-202606040001",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "available",
      ownerRole: "operator",
      caseId: "W-STAY-RESOURCE-202606040001",
      payload: {
        cardId: "roomSetup",
        templateWorkspaceId: "W-STAY-RESOURCE"
      }
    }];
    store.workspaces = [{
      ...store.workspaces[0],
      id: "W-STAY-RESOURCE-202606040001"
    }];
    const ctx = createSurfaceCtx({ runtimeStore: store });

    const target = resolveOperationPanelTarget({
      workspaceId: "W-STAY-RESOURCE-202606040001",
      cardId: "roomSetup"
    }, ctx.state);

    expect(target.canOpen).toBe(true);
    expect(target.workItem.workItemId).toBe("wi-started-room");
    expect(target.workItem.cardId).toBe("roomSetup");
    expect(target.workItem.lifecycleState).toBe("ready");
  });

  it("projects Operations WorkItem lifecycle states onto the operation progress rail", () => {
    const store = runtimeStore();
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: "roomSetup", status: "ready", title: { "zh-CN": "房间配置卡" } },
      { id: "bedSetup", status: "notStarted", title: { "zh-CN": "床位配置卡" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } },
      { id: "rateSetup", status: "notStarted", title: { "zh-CN": "价格配置卡" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } },
      { id: "roomReadiness", status: "notStarted", title: { "zh-CN": "房间准备度卡" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
    ];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-rate",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "rateSetup",
      runtimeStore: store
    });

    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: [
      { workItemId: "wi-room", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", lifecycleState: "done" },
      { workItemId: "wi-bed", workspaceId: "W-STAY-RESOURCE", cardId: "bedSetup", lifecycleState: "confirmed" },
      { workItemId: "wi-rate", workspaceId: "W-STAY-RESOURCE", cardId: "rateSetup", lifecycleState: "completed" },
      { workItemId: "wi-readiness", workspaceId: "W-STAY-RESOURCE", cardId: "roomReadiness", lifecycleState: "ready" }
    ] });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("房间配置卡 已完成");
    expect(text).toContain("床位配置卡 已完成");
    expect(text).toContain("价格配置卡 已完成");
    expect(text).toContain("房间准备度卡 可办理");
    expect(text).not.toContain("房间配置卡 可办理");
    expect(text).not.toContain("床位配置卡 未开始");
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
    expect(html).toContain(">处理</button>");
  });

  it("routes workspace/card compatibility clicks through the Operations WorkItem adapter", () => {
    const ctx = createSurfaceCtx();

    const target = openWorkspace("W-STAY-RESOURCE", ctx, "roomSetup");

    expect(target.canOpen).toBe(true);
    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
    expect(ctx.state.selectedCardId).toBe("roomSetup");
  });

  it("keeps active command starts on the Operations WorkItem route instead of workspace/card direct URLs", () => {
    const source = fs.readFileSync(new URL("../navigationController.js", import.meta.url), "utf8");
    const startCommandSource = source.slice(source.indexOf("export async function startWorkspaceCommand"));

    expect(startCommandSource).toContain("openOperationPanel");
    expect(startCommandSource).toContain("applyRuntimeSurfacePayloads");
    expect(startCommandSource).toContain("result?.workItem?.workItemId");
    expect(startCommandSource).not.toContain("window.location.href");
    expect(startCommandSource).not.toContain('url.searchParams.set("view", "workspace")');
  });
});
