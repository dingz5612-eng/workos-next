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

describe("OAM Surface WorkItem route identity", () => {
  it("opens workbench WorkItem with a persisted runtime identity", () => {
    const ctx = createSurfaceCtx();

    const target = openWorkItem("wi-dorm-room-setup", ctx);

    expect(target.canOpen).toBe(true);
    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("wi-dorm-room-setup");
    expect(routeView(ctx)).toContain('data-surface="operation-panel-route"');
  });

  it("resolves workspace/card route input to a persisted WorkItem", () => {
    const ctx = createSurfaceCtx();

    const workItem = resolvePersistedWorkItem({
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm"
    }, ctx.state);

    expect(workItem.workItemId).toBe("wi-dorm-room-setup");
  });

  it("does not treat non-persisted task id as the operation identity", () => {
    const ctx = createSurfaceCtx({
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm"
    });

    const target = resolveOperationPanelTarget({
      workItemId: "T-ROOM-CREATE",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm"
    }, ctx.state);

    expect(target.canOpen).toBe(true);
    expect(target.workItem.workItemId).toBe("wi-dorm-room-setup");
  });

  it("resolves card identity from Operations WorkItem payload", () => {
    const store = runtimeStore();
    store.operationWorkItems = [{
      workItemId: "wi-started-room",
      workspaceId: "W-DORM-MAINLINE-202606040001",
      workItemType: "Dorm.RoomSetupConfirm",
      lifecycleState: "available",
      ownerRole: "operator",
      caseId: "W-DORM-MAINLINE-202606040001",
      payload: {
        cardId: "cert.roomSetupConfirm",
        templateWorkspaceId: "W-DORM-MAINLINE"
      }
    }];
    store.workspaces = [{
      ...store.workspaces[0],
      id: "W-DORM-MAINLINE-202606040001"
    }];
    const ctx = createSurfaceCtx({ runtimeStore: store });

    const target = resolveOperationPanelTarget({
      workspaceId: "W-DORM-MAINLINE-202606040001",
      cardId: "cert.roomSetupConfirm"
    }, ctx.state);

    expect(target.canOpen).toBe(true);
    expect(target.workItem.workItemId).toBe("wi-started-room");
    expect(target.workItem.cardId).toBe("cert.roomSetupConfirm");
    expect(target.workItem.lifecycleState).toBe("ready");
  });

  it("uses the effective WorkItem card contract instead of stale projection fields", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: "W-DORM-MAINLINE-202606040004",
      cards: [{
        id: "cert.bedSetupConfirm",
        status: "ready",
        title: { "zh-CN": "确认床位信息" },
        fields: { business: [field("blockedReason", "阻断原因")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }]
    };
    store.operationWorkItems = [{
      workItemId: "wi-bed-effective-contract",
      workspaceId: "W-DORM-MAINLINE-202606040004",
      cardId: "cert.bedSetupConfirm",
      lifecycleState: "available",
      card: {
        id: "cert.bedSetupConfirm",
        status: "ready",
        title: { "zh-CN": "确认床位信息" },
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
      selectedWorkspace: "W-DORM-MAINLINE-202606040004",
      selectedCardId: "cert.bedSetupConfirm",
      runtimeStore: store
    });

    const target = resolveOperationPanelTarget({
      workItemId: "wi-bed-effective-contract",
      workspaceId: "W-DORM-MAINLINE-202606040004",
      cardId: "cert.bedSetupConfirm"
    }, ctx.state);

    const text = visibleText(routeView(ctx));

    expect(target.workItem.card.fields.business.map((item) => item.id)).toEqual(["bedNo", "bedLabel"]);
    expect(text).toContain("确认床位信息");
    expect(text).toContain("可以提交");
    expect(text).not.toContain("床位号");
    expect(text).not.toContain("床位标签");
    expect(text).not.toContain("阻断原因");
  });

  it("lets active Operations WorkItem readiness override a stale not-started projection", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: "W-DORM-MAINLINE-202606040005",
      cards: [{
        id: "cert.bedSetupConfirm",
        status: "notStarted",
        title: { "zh-CN": "确认床位信息" },
        fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }]
    };
    store.operationWorkItems = [{
      workItemId: "wi-bed-ready-over-projection",
      workspaceId: "W-DORM-MAINLINE-202606040005",
      cardId: "cert.bedSetupConfirm",
      lifecycleState: "available",
      card: {
        id: "cert.bedSetupConfirm",
        status: "ready",
        title: { "zh-CN": "确认床位信息" },
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
      selectedWorkspace: "W-DORM-MAINLINE-202606040005",
      selectedCardId: "cert.bedSetupConfirm",
      runtimeStore: store
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("提交前检查");
    expect(text).toContain("可以提交");
    expect(text).toContain("确认床位信息");
    expect(text).not.toContain("床位号");
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
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      lifecycleState: "available",
      ownerRole: "operator",
      payload: {
        cardId: "cert.roomSetupConfirm",
        correctionMode: "append_only",
        operationMode: "correction",
        sourceWorkItemId: "wi-dorm-room-setup"
      },
      card: {
        ...store.workspaces[0].cards[0],
        status: "ready"
      }
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-correction-room",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
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
    expect(text).toContain("填写房间信息");
    expect(text).not.toContain("只读记录");
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
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      lifecycleState: "ready"
    }] });

    expect(ctx.state.runtimeStore.workspaces[0].cards[0].status).toBe("done");

    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: [{
      workItemId: "wi-correction-room",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
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
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
      runtimeStore: store
    });
    store.operationWorkItems = [{
      workItemId: "wi-completed-room",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      lifecycleState: "confirmed"
    }];

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-step-state="completed"');
    expect(html).toContain('data-step-marker="修"');
    expect(html).toContain('aria-label="填写房间信息 已完成 · 有更正"');
    expect(text).toContain("已完成 · 有更正");
    expect(text).toContain("已完成");
    expect(text).not.toContain("不能提交原因");
    expect(text).not.toContain("当前没有新的系统阻断");
    expect(html).not.toContain('aria-label="填写房间信息 更正中"');
  });

  it("does not let an open correction WorkItem take over an explicit completed record route", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0] = {
      ...store.workspaces[0].cards[0],
      status: "confirmed",
      operationMode: "correction",
      correctionMode: "append_only"
    };
    store.operationWorkItems = [{
      workItemId: "wi-correction-room",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      lifecycleState: "ready",
      payload: {
        cardId: "cert.roomSetupConfirm",
        operationMode: "correction",
        correctionMode: "append_only",
        sourceWorkItemId: "wi-completed-room"
      }
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-completed-room",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
      runtimeStore: store
    });

    const target = resolveOperationPanelTarget({
      workItemId: "wi-completed-room",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm"
    }, ctx.state);
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(target.canOpen).toBe(false);
    expect(target.reason).toBe("missing_persisted_work_item");
    expect(ctx.state.selectedWorkItemId).toBe("wi-completed-room");
    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-step-state="completed"');
    expect(text).toContain("只读记录");
    expect(text).toContain("已完成 · 有更正");
    expect(text).not.toContain("更正中");
    expect(html).not.toContain('data-work-item-id="wi-correction-room"');
  });

  it("projects Operations WorkItem lifecycle states onto the operation progress rail", () => {
    const store = runtimeStore();
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: "cert.roomSetupConfirm", status: "ready", title: { "zh-CN": "填写房间信息" } },
      { id: "cert.bedSetupConfirm", status: "notStarted", title: { "zh-CN": "确认床位信息" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } },
      { id: "cert.resourceReadinessConfirm", status: "notStarted", title: { "zh-CN": "完成基础检查" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
    ];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-readiness",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.resourceReadinessConfirm",
      runtimeStore: store
    });

    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: [
      { workItemId: "wi-room", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm", lifecycleState: "done" },
      { workItemId: "wi-bed", workspaceId: "W-DORM-MAINLINE", cardId: "cert.bedSetupConfirm", lifecycleState: "confirmed" },
      { workItemId: "wi-readiness", workspaceId: "W-DORM-MAINLINE", cardId: "cert.resourceReadinessConfirm", lifecycleState: "ready" }
    ] });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(text).toContain("第 3/3 步");
    expect(html).toContain('aria-label="填写房间信息 已完成"');
    expect(html).toContain('aria-label="确认床位信息 已完成"');
    expect(html).toContain('aria-label="完成基础检查 待处理"');
    expect(text).not.toContain("填写房间信息 待处理");
    expect(text).not.toContain("确认床位信息 未开始");
  });

  it("uses runtime workspace state instead of stale WorkItem workspace snapshots on the progress rail", () => {
    const store = runtimeStore();
    const workspace = {
      ...store.workspaces[0],
      id: "W-DORM-MAINLINE-20260604142817-7a669",
      cards: [
        { ...store.workspaces[0].cards[0], id: "cert.roomSetupConfirm", status: "ready", title: { "zh-CN": "填写房间信息" } },
        { id: "cert.bedSetupConfirm", status: "notStarted", title: { "zh-CN": "确认床位信息" }, fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
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
        cardId: "cert.roomSetupConfirm",
        lifecycleState: "confirmed",
        workspace: staleWorkItemWorkspace
      },
      {
        workItemId: "wi-current-bed",
        workspaceId: workspace.id,
        cardId: "cert.bedSetupConfirm",
        lifecycleState: "available",
        workspace: staleWorkItemWorkspace,
        card: { ...workspace.cards[1], status: "ready" }
      }
    ];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-current-bed",
      selectedWorkspace: workspace.id,
      selectedCardId: "cert.bedSetupConfirm",
      runtimeStore: store
    });

    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems });

    const target = resolveOperationPanelTarget({ workItemId: "wi-current-bed" }, ctx.state);
    const html = routeView(ctx);

    expect(target.workItem.workspace.cards.find((card) => card.id === "cert.roomSetupConfirm").status).toBe("confirmed");
    expect(target.workItem.workspace.cards.find((card) => card.id === "cert.bedSetupConfirm").status).toBe("ready");
    expect(html).toContain('aria-label="填写房间信息 已完成"');
    expect(html).toContain('aria-label="确认床位信息 待处理"');
    expect(visibleText(html)).not.toContain("填写房间信息 待处理");
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

    expect(html).toContain('data-work-item-id="wi-dorm-room-setup"');
    expect(html).toContain(">继续填写</button>");
  });

  it("routes workspace/card display clicks through the Operations WorkItem route", () => {
    const ctx = createSurfaceCtx();

    const target = openWorkspace("W-DORM-MAINLINE", ctx, "cert.roomSetupConfirm");

    expect(target.canOpen).toBe(true);
    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("wi-dorm-room-setup");
    expect(ctx.state.selectedCardId).toBe("cert.roomSetupConfirm");
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
      { ...store.workspaces[0].cards[0], id: "cert.roomSetupConfirm", status: "done", title: { "zh-CN": "填写房间信息" } },
      { id: "cert.bedSetupConfirm", status: "ready", title: { "zh-CN": "确认床位信息" }, fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
    ];
    store.operationWorkItems = [
      { workItemId: "wi-room-done", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm", lifecycleState: "confirmed" },
      { workItemId: "wi-bed-next", workspaceId: "W-DORM-MAINLINE", cardId: "cert.bedSetupConfirm", lifecycleState: "available" }
    ];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-room-done",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
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
      { ...store.workspaces[0].cards[0], id: "cert.roomSetupConfirm", status: "ready", evidence: [], fields: { business: [], system: [], analytics: [] }, title: { "zh-CN": "填写房间信息" } },
      { id: "cert.bedSetupConfirm", status: "ready", title: { "zh-CN": "确认床位信息" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
    ];
    store.operationWorkItems = [
      { workItemId: "wi-room-active", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm", lifecycleState: "ready", ownerRole: "operator" },
      { workItemId: "wi-bed-next", workspaceId: "W-DORM-MAINLINE", cardId: "cert.bedSetupConfirm", lifecycleState: "ready", ownerRole: "operator" }
    ];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-room-active",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
      runtimeStore: store,
      render: vi.fn()
    });

    installSubmitDocument();
    await submitCurrentCard(ctx);
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(ctx.state.selectedWorkItemId).toBe("wi-bed-next");
    expect(ctx.state.selectedCardId).toBe("cert.bedSetupConfirm");
    expect(ctx.state.lastActionResult?.autoAdvanced).toBe(true);
    expect(ctx.state.lastActionResult?.autoAdvancedToCardId).toBe("cert.bedSetupConfirm");
    expect(html).toContain('data-surface="operation-panel-route"');
    expect(html).not.toContain('data-surface="completed-workspace-record"');
    expect(text).toContain("确认床位信息");
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("auto-advances when the next WorkItem is returned by post-submit refresh", async () => {
    vi.useFakeTimers();
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const href = String(url);
      calls.push(href);
      if (href.endsWith("/prepare")) {
        return { ok: true, json: async () => ({ prepared: true, commandSubmissionId: "sub-room" }) };
      }
      if (href.endsWith("/confirm")) {
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
      if (href.includes("/api/operations/work-items")) {
        return {
          ok: true,
          json: async () => ([{
            workItemId: "wi-bed-refresh-next",
            workspaceId: "W-DORM-MAINLINE",
            cardId: "cert.bedSetupConfirm",
            caseId: "case:W-DORM-MAINLINE",
            workItemType: "Dorm.BedSetupConfirm",
            lifecycleState: "available",
            ownerRole: "operator"
          }])
        };
      }
      return { ok: true, json: async () => ({}) };
    }));
    const store = runtimeStore();
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: "cert.roomSetupConfirm", status: "ready", evidence: [], fields: { business: [], system: [], analytics: [] }, title: { "zh-CN": "填写房间信息" } },
      { id: "cert.bedSetupConfirm", status: "notStarted", title: { "zh-CN": "确认床位信息" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
    ];
    store.operationWorkItems = [
      { workItemId: "wi-room-active", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm", lifecycleState: "ready", ownerRole: "operator" }
    ];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-room-active",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
      runtimeStore: store,
      render: vi.fn()
    });

    installSubmitDocument();
    await submitCurrentCard(ctx);

    expect(calls.some((href) => href.includes("/api/operations/work-items") && href.includes("workspaceId=W-DORM-MAINLINE"))).toBe(true);
    expect(ctx.state.selectedWorkItemId).toBe("wi-bed-refresh-next");
    expect(ctx.state.selectedCardId).toBe("cert.bedSetupConfirm");
    expect(ctx.state.lastActionResult?.autoAdvanced).toBe(true);
    expect(ctx.state.lastActionResult?.autoAdvancedToCardId).toBe("cert.bedSetupConfirm");
    expect(routeView(ctx)).toContain('data-surface="operation-panel-route"');
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("auto-advances generated dormitory cards from refreshed WorkItems when the active workspace comes from the WorkItem snapshot", async () => {
    vi.useFakeTimers();
    const workspaceId = "W-DORM-MAINLINE-UNIT-AUTO";
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const href = String(url);
      calls.push(href);
      if (href.endsWith("/prepare")) {
        return { ok: true, json: async () => ({ prepared: true, commandSubmissionId: "sub-generated-room" }) };
      }
      if (href.endsWith("/confirm")) {
        return {
          ok: true,
          json: async () => ({
            confirmed: true,
            commitStatus: "committed",
            projectionStatus: "pending",
            commandSubmissionId: "sub-generated-room",
            resultEventIds: ["evt-generated-room"]
          })
        };
      }
      if (href.includes("/api/operations/work-items")) {
        return {
          ok: true,
          json: async () => ([{
            workItemId: "wi-generated-room-confirmed",
            workspaceId,
            cardId: "Dorm.RoomSetupConfirm",
            workItemType: "Dorm.RoomSetupConfirm",
            lifecycleState: "confirmed",
            ownerRole: "operator",
            workspace: generatedDormitoryWorkspace(workspaceId)
          }, {
            workItemId: "wi-generated-bed-next",
            workspaceId,
            cardId: "Dorm.BedSetupConfirm",
            workItemType: "Dorm.BedSetupConfirm",
            lifecycleState: "available",
            ownerRole: "operator",
            workspace: generatedDormitoryWorkspace(workspaceId)
          }])
        };
      }
      return { ok: true, json: async () => ({}) };
    }));
    const store = runtimeStore();
    store.workspaces = [];
    store.operationWorkItems = [{
      workItemId: "wi-generated-room-active",
      workspaceId,
      cardId: "Dorm.RoomSetupConfirm",
      workItemType: "Dorm.RoomSetupConfirm",
      lifecycleState: "available",
      ownerRole: "operator",
      workspace: generatedDormitoryWorkspace(workspaceId)
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-generated-room-active",
      selectedWorkspace: workspaceId,
      selectedCardId: "Dorm.RoomSetupConfirm",
      runtimeStore: store,
      render: vi.fn()
    });
    ctx.workspace = () => generatedDormitoryWorkspace(workspaceId);

    installSubmitDocument();
    await submitCurrentCard(ctx);
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(calls.some((href) => href.includes("/api/operations/work-items") && href.includes(`workspaceId=${workspaceId}`))).toBe(true);
    expect(ctx.state.selectedWorkItemId).toBe("wi-generated-bed-next");
    expect(ctx.state.selectedCardId).toBe("Dorm.BedSetupConfirm");
    expect(ctx.state.lastActionResult?.autoAdvanced).toBe(true);
    expect(ctx.state.lastActionResult?.autoAdvancedToCardId).toBe("Dorm.BedSetupConfirm");
    expect(html).toContain('data-surface="operation-panel-route"');
    expect(html).not.toContain('data-surface="completed-workspace-record"');
    expect(text).toContain("确认床位信息");
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

function installSubmitDocument() {
  const fields = [
    input("roomNo", "A101"),
    input("floor", "3"),
    input("bedCount", "2"),
    input("buildingContextRef", "1号楼")
  ];
  const fieldById = new Map(fields.map((node) => [node.dataset.operationField, node]));
  vi.stubGlobal("document", {
    querySelectorAll: (selector) => selector === "[data-operation-field]" ? fields : [],
    querySelector: (selector) => {
      const match = selector.match(/^\[data-operation-field="(.+)"\]$/);
      return match ? fieldById.get(match[1]) || null : null;
    }
  });
}

function input(id, value = "") {
  return {
    dataset: { operationField: id },
    value,
    type: "text",
    tagName: "INPUT",
    closest: () => null,
    matches: (selector) => selector.includes("[data-operation-field]")
  };
}

function generatedDormitoryWorkspace(id) {
  return {
    id,
    domain: "stay",
    caseId: `case:${id}`,
    title: { "zh-CN": "新建房间和床位" },
    summary: { "zh-CN": "按页面顺序完成当前办理。" },
    next: { "zh-CN": "确认床位组" },
    blockers: [],
    cards: [{
      id: "Dorm.RoomSetupConfirm",
      status: "ready",
      title: { "zh-CN": "填写房间信息" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    }, {
      id: "Dorm.BedSetupConfirm",
      status: "notStarted",
      title: { "zh-CN": "确认床位信息" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    }, {
      id: "Dorm.ResourceReadinessConfirm",
      status: "notStarted",
      title: { "zh-CN": "完成基础检查" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    }]
  };
}
