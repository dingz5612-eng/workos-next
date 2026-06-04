import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { saveCompletedRecordSnapshot } from "../operationDrafts.js";
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

  it("renders route metadata on the progress rail without a repeated context container", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    const html = routeView(ctx);
    const text = visibleText(html);
    const saveDraftActionRow = html.match(/<div class="operation-actions">[\s\S]*?data-save-draft[\s\S]*?<\/div>/)?.[0] || "";

    expect(html).toContain('class="operation-step-rail"');
    expect(html).toContain('data-surface="operation-panel-route"');
    expect(html).toContain('class="feedback-fab"');
    expect(html).not.toContain('class="operation-feedback-link secondary"');
    expect(saveDraftActionRow).not.toContain("feedback");
    expect(html).not.toContain('class="operation-panel-page"');
    expect(html).not.toContain('class="operation-context-title"');
    expect(text).toContain("住宿资源");
    expect(text).toContain("房间床位配置");
    expect(text).not.toContain("办理进度");
    expect(text).not.toContain("当前办理 我要创建住宿资源");
    expect(text).not.toContain("当前可处理");
    expect(text).not.toContain("先配置房间和床位，再配置价格");
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

  it("does not render editable fields or submit checks for a not-started step", () => {
    const store = runtimeStore();
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: "roomSetup", status: "ready", title: { "zh-CN": "房间配置卡" } },
      {
        id: "bedSetup",
        status: "notStarted",
        title: { "zh-CN": "床位配置卡" },
        fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }
    ];
    store.operationWorkItems = [{
      workItemId: "wi-bed-not-started",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "bedSetup",
      lifecycleState: "notStarted",
      ownerRole: "operator"
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-bed-not-started",
      selectedWorkspace: "W-STAY-RESOURCE",
      selectedCardId: "bedSetup",
      runtimeStore: store
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(text).toContain("这张卡还没轮到办理");
    expect(text).toContain("第 2/2 步");
    expect(text).not.toContain("填写信息");
    expect(text).not.toContain("提交前检查");
    expect((text.match(/床位配置卡/g) || []).length).toBe(1);
    expect((text.match(/这张卡还没轮到办理。请先完成前一张卡。/g) || []).length).toBe(1);
    expect(html).not.toContain('data-operation-field="bedNo"');
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
    expect(visibleText(html)).not.toContain("业务对象");
    expect(visibleText(html)).not.toContain("完成后");
    expect((visibleText(html).match(/已完成/g) || []).length).toBeLessThanOrEqual(2);
  });

  it("makes completed operation records route through readonly view before correction", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    ctx.state.runtimeStore.workspaces[0].cards[0].status = "done";

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-operation-record"');
    expect(html).toContain('data-view-completed-record="true"');
    expect(html).not.toContain('data-correction-work-item="true"');
    expect(text).toContain("先查看记录");
    expect(text).toContain("从记录页发起更正");
    expect(text).not.toContain("不能重复提交");
    expect(html).not.toContain("data-submit-card");
  });

  it("shows submitted values on the readonly completed record before offering correction", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: "W-STAY-RESOURCE-READONLY-001",
      cards: [{
        ...store.workspaces[0].cards[0],
        status: "done",
        fields: { business: [field("buildingName", "楼栋"), field("roomNo", "房间号"), field("bedCount", "床位数")], system: [], analytics: [] }
      }]
    };
    saveCompletedRecordSnapshot({
      workspaceId: "W-STAY-RESOURCE-READONLY-001",
      cardId: "roomSetup",
      values: {
        buildingName: "A栋",
        roomNo: "301",
        bedCount: "4"
      }
    });
    const ctx = createSurfaceCtx({
      view: "workspace",
      selectedWorkspace: "W-STAY-RESOURCE-READONLY-001",
      selectedCardId: "roomSetup",
      selectedWorkItemId: "",
      runtimeStore: store
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(text).toContain("只读记录");
    expect(text).toContain("A栋");
    expect(text).toContain("301");
    expect(text).toContain("4");
    expect(html).toContain('data-correction-work-item="true"');
    expect(text).toContain("请先核对已提交的业务内容");
  });

  it("reads nested OperationsWorkItemConfirmed payload values for completed records", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: "W-STAY-RESOURCE-READONLY-002",
      cards: [{
        ...store.workspaces[0].cards[0],
        status: "done",
        fields: { business: [field("roomNo", "房间号")], system: [], analytics: [] }
      }]
    };
    const ctx = createSurfaceCtx({
      view: "workspace",
      selectedWorkspace: "W-STAY-RESOURCE-READONLY-002",
      selectedCardId: "roomSetup",
      selectedWorkItemId: "",
      runtimeStore: store,
      projectionEvents: [{
        workspaceId: "W-STAY-RESOURCE-READONLY-002",
        cardId: "roomSetup",
        eventType: "OperationsWorkItemConfirmed",
        payload: {
          input: {
            fieldValues: {
              roomNo: "302"
            }
          }
        }
      }]
    });
    ctx.state.runtimeStore.events = ctx.state.projectionEvents;

    const text = visibleText(routeView(ctx));

    expect(text).toContain("302");
    expect(text).not.toContain("提交内容还没有同步");
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
