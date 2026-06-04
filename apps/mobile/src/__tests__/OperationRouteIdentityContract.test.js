import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { openWorkspace, openWorkItem } from "../navigationController.js";
import { submitCurrentCard } from "../operationController.js";
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

  it("resolves workspace/card route input to a persisted WorkItem", () => {
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

  it("uses the effective WorkItem card contract instead of stale projection fields", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: "W-STAY-RESOURCE-202606040004",
      cards: [{
        id: "bedSetup",
        status: "ready",
        title: { "zh-CN": "床位配置卡" },
        fields: { business: [field("blockedReason", "阻断原因")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }]
    };
    store.operationWorkItems = [{
      workItemId: "wi-bed-effective-contract",
      workspaceId: "W-STAY-RESOURCE-202606040004",
      cardId: "bedSetup",
      lifecycleState: "available",
      card: {
        id: "bedSetup",
        status: "ready",
        title: { "zh-CN": "床位配置卡" },
        fields: { business: [field("bedNo", "床位号"), field("bedLabel", "床位标签")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-bed-effective-contract",
      selectedWorkspace: "W-STAY-RESOURCE-202606040004",
      selectedCardId: "bedSetup",
      runtimeStore: store
    });

    const target = resolveOperationPanelTarget({
      workItemId: "wi-bed-effective-contract",
      workspaceId: "W-STAY-RESOURCE-202606040004",
      cardId: "bedSetup"
    }, ctx.state);

    const text = visibleText(routeView(ctx));

    expect(target.workItem.card.fields.business.map((item) => item.id)).toEqual(["bedNo", "bedLabel"]);
    expect(text).toContain("床位号");
    expect(text).not.toContain("阻断原因");
  });

  it("lets active Operations WorkItem readiness override a stale not-started projection", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: "W-STAY-RESOURCE-202606040005",
      cards: [{
        id: "bedSetup",
        status: "notStarted",
        title: { "zh-CN": "床位配置卡" },
        fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }]
    };
    store.operationWorkItems = [{
      workItemId: "wi-bed-ready-over-projection",
      workspaceId: "W-STAY-RESOURCE-202606040005",
      cardId: "bedSetup",
      lifecycleState: "available",
      card: {
        id: "bedSetup",
        status: "ready",
        title: { "zh-CN": "床位配置卡" },
        fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-bed-ready-over-projection",
      selectedWorkspace: "W-STAY-RESOURCE-202606040005",
      selectedCardId: "bedSetup",
      runtimeStore: store
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("填写信息");
    expect(text).toContain("提交处理");
    expect(text).not.toContain("这张卡还没轮到办理");
  });

  it("opens append-only correction WorkItems even when the original card is completed", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0] = {
      ...store.workspaces[0].cards[0],
      status: "done",
      fields: { business: [field("roomNo", "房间号")], system: [], analytics: [] }
    };
    store.operationWorkItems = [{
      workItemId: "wi-correction-room",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      lifecycleState: "available",
      ownerRole: "operator",
      payload: {
        cardId: "roomSetup",
        correctionMode: "append_only",
        operationMode: "correction",
        sourceWorkItemId: "W-STAY-RESOURCE:roomSetup"
      },
      card: {
        ...store.workspaces[0].cards[0],
        status: "ready"
      }
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-correction-room",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup",
      runtimeStore: store
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(resolveOperationPanelTarget({ workItemId: "wi-correction-room" }, ctx.state).workItem.lifecycleState).toBe("ready");
    expect(html).toContain('data-step-state="correction"');
    expect(html).toContain('data-card-status="ready"');
    expect(html).toContain('data-step-marker="修"');
    expect(text).toContain("填写信息");
    expect(text).toContain("更正中");
    expect(text).toContain("提交处理");
    expect(text).not.toContain("办理记录");
    expect(html).not.toContain("intent-card");
    expect(html).toContain('data-operation-field="roomNo"');
  });

  it("does not let stale nonterminal WorkItems reopen completed cards unless they are append-only corrections", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0] = {
      ...store.workspaces[0].cards[0],
      status: "done"
    };
    const ctx = createSurfaceCtx({ runtimeStore: store });

    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: [{
      workItemId: "wi-stale-room",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      lifecycleState: "ready"
    }] });

    expect(ctx.state.runtimeStore.workspaces[0].cards[0].status).toBe("done");

    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: [{
      workItemId: "wi-correction-room",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      lifecycleState: "ready",
      payload: {
        operationMode: "correction",
        correctionMode: "append_only"
      }
    }] });

    expect(ctx.state.runtimeStore.workspaces[0].cards[0].status).toBe("ready");
    expect(ctx.state.runtimeStore.workspaces[0].cards[0].operationMode).toBe("correction");
    expect(ctx.state.runtimeStore.workspaces[0].cards[0].correctionMode).toBe("append_only");
  });

  it("keeps readonly completed records completed when a correction marker exists", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0] = {
      ...store.workspaces[0].cards[0],
      status: "confirmed",
      operationMode: "correction",
      correctionMode: "append_only"
    };
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-completed-room",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup",
      runtimeStore: store
    });
    store.operationWorkItems = [{
      workItemId: "wi-completed-room",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      lifecycleState: "confirmed"
    }];

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-step-state="completed"');
    expect(html).toContain('data-step-marker="修"');
    expect(html).toContain('aria-label="房间床位配置 已完成 · 有更正"');
    expect(text).toContain("已完成 · 有更正");
    expect(text).toContain("已完成");
    expect(html).not.toContain('aria-label="房间床位配置 更正中"');
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

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(text).toContain("第 3/4 步");
    expect(html).toContain('aria-label="房间配置卡 已完成"');
    expect(html).toContain('aria-label="床位配置卡 已完成"');
    expect(html).toContain('aria-label="价格配置卡 已完成"');
    expect(html).toContain('aria-label="房间准备度卡 可办理"');
    expect(text).not.toContain("房间配置卡 可办理");
    expect(text).not.toContain("床位配置卡 未开始");
  });

  it("uses runtime workspace state instead of stale WorkItem workspace snapshots on the progress rail", () => {
    const store = runtimeStore();
    const workspace = {
      ...store.workspaces[0],
      id: "W-STAY-RESOURCE-20260604142817-7a669",
      cards: [
        { ...store.workspaces[0].cards[0], id: "roomSetup", status: "ready", title: { "zh-CN": "房间配置卡" } },
        { id: "bedSetup", status: "notStarted", title: { "zh-CN": "床位配置卡" }, fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
      ]
    };
    const staleWorkItemWorkspace = {
      ...workspace,
      cards: workspace.cards.map((card) => ({ ...card }))
    };
    store.workspaces = [workspace];
    const operationWorkItems = [
      {
        workItemId: "wi-confirmed-room",
        workspaceId: workspace.id,
        cardId: "roomSetup",
        lifecycleState: "confirmed",
        workspace: staleWorkItemWorkspace
      },
      {
        workItemId: "wi-current-bed",
        workspaceId: workspace.id,
        cardId: "bedSetup",
        lifecycleState: "available",
        workspace: staleWorkItemWorkspace,
        card: { ...workspace.cards[1], status: "ready" }
      }
    ];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-current-bed",
      selectedWorkspace: workspace.id,
      selectedCardId: "bedSetup",
      runtimeStore: store
    });

    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems });

    const target = resolveOperationPanelTarget({ workItemId: "wi-current-bed" }, ctx.state);
    const html = routeView(ctx);

    expect(target.workItem.workspace.cards.find((card) => card.id === "roomSetup").status).toBe("confirmed");
    expect(target.workItem.workspace.cards.find((card) => card.id === "bedSetup").status).toBe("ready");
    expect(html).toContain('aria-label="房间配置卡 已完成"');
    expect(html).toContain('aria-label="床位配置卡 可办理"');
    expect(visibleText(html)).not.toContain("房间配置卡 可办理");
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

  it("routes workspace/card display clicks through the Operations WorkItem route", () => {
    const ctx = createSurfaceCtx();

    const target = openWorkspace("W-STAY-RESOURCE", ctx, "roomSetup");

    expect(target.canOpen).toBe(true);
    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
    expect(ctx.state.selectedCardId).toBe("roomSetup");
  });

  it("canonicalizes stale card URL params to the selected Operations WorkItem card", () => {
    const store = runtimeStore();
    const workspaceId = "W-STAY-SERVICE-TASK-ROUTE-001";
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      title: { "zh-CN": "清洁维修任务" },
      cards: [
        {
          id: "serviceTaskCreate",
          status: "ready",
          title: { "zh-CN": "服务任务创建卡" },
          fields: { business: [field("resourceScope", "服务范围")], system: [], analytics: [] },
          evidence: [],
          checks: [],
          blockerRules: [],
          confirmation: { required: true, requiredRole: "operator" }
        },
        {
          id: "roomReleaseAfterService",
          status: "notStarted",
          title: { "zh-CN": "服务后释放卡" },
          fields: { business: [field("releaseAvailableAt", "恢复可售时间")], system: [], analytics: [] },
          evidence: [],
          checks: [],
          blockerRules: [],
          confirmation: { required: true, requiredRole: "operator" }
        }
      ]
    };
    store.operationWorkItems = [{
      workItemId: "wi-service-create-route",
      workspaceId,
      cardId: "serviceTaskCreate",
      lifecycleState: "available",
      ownerRole: "operator"
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-service-create-route",
      selectedWorkspace: workspaceId,
      selectedCardId: "roomReleaseAfterService",
      runtimeStore: store,
      operationMessage: "旧步骤提示",
      fieldValidation: { workspaceId, cardId: "roomReleaseAfterService", missingLabels: ["恢复可售时间"] }
    });

    const text = visibleText(routeView(ctx));

    expect(ctx.state.selectedWorkItemId).toBe("wi-service-create-route");
    expect(ctx.state.selectedWorkspace).toBe(workspaceId);
    expect(ctx.state.selectedCardId).toBe("serviceTaskCreate");
    expect(ctx.state.fieldValidation).toBeNull();
    expect(ctx.state.operationMessage).toBe("");
    expect(text).toContain("服务任务创建卡");
    expect(text).not.toContain("服务后释放卡");
  });

  it("clears stale submit result when routing to a different WorkItem", () => {
    const store = runtimeStore();
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: "roomSetup", status: "done", title: { "zh-CN": "房间配置卡" } },
      { id: "bedSetup", status: "ready", title: { "zh-CN": "床位配置卡" }, fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
    ];
    store.operationWorkItems = [
      { workItemId: "wi-room-done", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", lifecycleState: "confirmed" },
      { workItemId: "wi-bed-next", workspaceId: "W-STAY-RESOURCE", cardId: "bedSetup", lifecycleState: "available" }
    ];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-room-done",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup",
      runtimeStore: store,
      operationMessage: "已提交成功，视图同步中。",
      lastActionResult: { status: "committed_projection_pending", message: "已提交成功，视图同步中。" }
    });

    openWorkItem("wi-bed-next", ctx);

    expect(ctx.state.selectedWorkItemId).toBe("wi-bed-next");
    expect(ctx.state.operationMessage).toBe("");
    expect(ctx.state.lastActionResult).toBeNull();
    expect(visibleText(routeView(ctx))).not.toContain("已提交成功，视图同步中");
  });

  it("keeps active command starts on the Operations WorkItem route instead of workspace/card direct URLs", () => {
    const source = fs.readFileSync(new URL("../navigationController.js", import.meta.url), "utf8");
    const startCommandSource = source.slice(source.indexOf("export async function startOperationsWorkspaceCommand"));

    expect(startCommandSource).toContain("openOperationPanel");
    expect(startCommandSource).toContain("applyRuntimeSurfacePayloads");
    expect(startCommandSource).toContain("result?.workItem?.workItemId");
    expect(startCommandSource).not.toContain("window.location.href");
    expect(startCommandSource).not.toContain('url.searchParams.set("view", "workspace")');
  });

  it("auto-advances to the next actionable WorkItem after a successful active submit", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).endsWith("/prepare")) {
        return { ok: true, json: async () => ({ prepared: true, commandSubmissionId: "sub-room" }) };
      }
      if (String(url).endsWith("/confirm")) {
        return {
          ok: true,
          json: async () => ({
            confirmed: true,
            commitStatus: "committed",
            projectionStatus: "projected",
            commandSubmissionId: "sub-room",
            resultEventIds: ["evt-room"]
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    }));
    const store = runtimeStore();
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: "roomSetup", status: "ready", evidence: [], title: { "zh-CN": "房间配置卡" } },
      { id: "bedSetup", status: "ready", title: { "zh-CN": "床位配置卡" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
    ];
    store.operationWorkItems = [
      { workItemId: "wi-room-active", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", lifecycleState: "ready", ownerRole: "operator" },
      { workItemId: "wi-bed-next", workspaceId: "W-STAY-RESOURCE", cardId: "bedSetup", lifecycleState: "ready", ownerRole: "operator" }
    ];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-room-active",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "roomSetup",
      runtimeStore: store,
      render: vi.fn()
    });

    await submitCurrentCard(ctx);
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(ctx.state.selectedWorkItemId).toBe("wi-bed-next");
    expect(ctx.state.selectedCardId).toBe("bedSetup");
    expect(ctx.state.lastActionResult?.autoAdvanced).toBe(true);
    expect(ctx.state.lastActionResult?.autoAdvancedToCardId).toBe("bedSetup");
    expect(html).toContain('data-surface="operation-panel-route"');
    expect(html).not.toContain('data-surface="completed-workspace-record"');
    expect(text).toContain("床位配置卡");
    expect(text).toContain("提交处理");
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

function field(id, zh) {
  return {
    id,
    label: { "zh-CN": zh },
    layer: "business",
    type: "text",
    required: true,
    source: "userInput",
    visibleToUser: true,
    ui: { control: "text", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false },
    help: { "zh-CN": "请输入本步需要的信息。" }
  };
}
