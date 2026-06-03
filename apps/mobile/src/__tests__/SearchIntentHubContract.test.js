import { describe, expect, it } from "vitest";
import { openWorkItem, setView } from "../navigationController.js";
import { buildSearchResultVM, rankSearchResults } from "../searchIntentHub.js";
import { searchView } from "../views/searchView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B search intent hub contract", () => {
  it("renders a WorkItem action button and opens the persisted operation panel", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "创建房间" });
    const html = searchView(ctx);

    expect(html).toContain("主动命令");
    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain(">处理</button>");

    openWorkItem("W-STAY-RESOURCE:roomSetup", ctx);

    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
  });

  it("routes evidence and object results through existing data attributes", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    const html = searchView(ctx);

    expect(html).toContain('data-evidence-id="room-duplicate-check"');
    expect(html).toContain('data-workspace="W-STAY-RESOURCE"');

    setView("learning", ctx);
    expect(ctx.state.view).toBe("learning");
  });

  it("routes trace results when the query asks for submission traces", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "提交" });
    const html = searchView(ctx);

    expect(html).toContain('data-trace-id="trace-room"');
    expect(visibleText(html)).toContain("提交轨迹");
  });

  it("routes learning results only when the query asks for learning content", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "证据" });
    const html = searchView(ctx);

    expect(html).toContain('data-learning-id="learnEvidenceFix"');
    expect(html).toContain("证据怎么补");
  });

  it("ranks room creation before generic object results", () => {
    const ctx = createSurfaceCtx({ query: "创建房间" });
    const vm = rankSearchResults([
      { resultType: "room", title: "房间对象", workspaceId: "W-STAY-RESOURCE" },
      { resultType: "workItem", title: "创建房间", workItemId: "W-STAY-RESOURCE:roomSetup" }
    ], ctx.state.query);

    expect(vm[0].resultType).toBe("workItem");
  });

  it("keeps create-room intent focused on room setup instead of checkout inspection evidence", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "创建房间" });
    ctx.state.runtimeStore.workspaces.push({
      id: "W-STAY-CHECKOUT",
      domain: "stay",
      title: { "zh-CN": "我要办理退房" },
      summary: { "zh-CN": "退房检查" },
      next: { "zh-CN": "先发起退房并完成房间检查。" },
      cards: [{
        id: "roomInspection",
        status: "notStarted",
        title: { "zh-CN": "房间检查卡" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "manual-note", label: { "zh-CN": "人工处理记录" } }],
        blockerRules: [],
        confirmation: { required: false }
      }]
    });

    const text = visibleText(searchView(ctx));

    expect(text).toContain("房间床位配置");
    expect(text).not.toContain("我要办理退房");
    expect(text).not.toContain("人工处理记录");
  });

  it("does not dump unrelated queue records for a narrow numeric query", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "21" });
    ctx.state.runtimeStore.workQueue.push({
      queueItemId: "q-unrelated",
      workItemId: "W-STAY-RESOURCE:unrelated",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "Dorm.Other",
      lifecycleState: "ready",
      badges: ["mine"],
      reason: "无关任务"
    });

    const html = searchView(ctx);

    expect(html).not.toContain("W-STAY-RESOURCE:unrelated");
    expect(visibleText(html)).toContain("这条结果暂时没有可跳转目标");
  });

  it("does not render completed WorkItems as processable search results", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    ctx.state.runtimeStore.workQueue = [{
      queueItemId: "q-completed-room",
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "confirmed",
      badges: ["mine"],
      reason: "已完成"
    }];

    const html = searchView(ctx);

    expect(html).not.toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain('data-workspace="W-STAY-RESOURCE"');
    expect(visibleText(html)).toContain("状态: 已完成");
    expect(visibleText(html)).toContain("查看");
  });

  it("keeps localized visible copy and no-action reason without raw object text", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "住宿" });
    const vm = buildSearchResultVM({
      resultType: "object",
      title: { "zh-CN": "住宿资源" },
      subtitle: { "zh-CN": "房间床位" }
    }, ctx);
    const html = searchView(ctx);

    expect(vm.reasonIfNoAction).toContain("这条结果暂时没有可跳转目标");
    expect(visibleText(html)).not.toContain("[object Object]");
    expect(visibleText(html)).not.toMatch(/\b(stay|finance|lead|leadCapture)\b/);
  });
});
