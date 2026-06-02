import { describe, expect, it } from "vitest";
import { openWorkItem, setView } from "../navigationController.js";
import { buildSearchResultVM, rankSearchResults } from "../searchIntentHub.js";
import { searchView } from "../views/searchView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B search intent hub contract", () => {
  it("renders a WorkItem action button and opens the persisted operation panel", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "创建房间" });
    const html = searchView(ctx);

    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain(">处理</button>");

    openWorkItem("W-STAY-RESOURCE:roomSetup", ctx);

    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
  });

  it("routes learning, evidence, trace, and object results through existing data attributes", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    const html = searchView(ctx);

    expect(html).toContain('data-learning-id="learnEvidenceFix"');
    expect(html).toContain('data-evidence-id="room-duplicate-check"');
    expect(html).toContain('data-trace-id="trace-room"');
    expect(html).toContain('data-workspace="W-STAY-RESOURCE"');

    setView("learning", ctx);
    expect(ctx.state.view).toBe("learning");
  });

  it("ranks room creation before generic object results", () => {
    const ctx = createSurfaceCtx({ query: "创建房间" });
    const vm = rankSearchResults([
      { resultType: "room", title: "房间对象", workspaceId: "W-STAY-RESOURCE" },
      { resultType: "workItem", title: "创建房间", workItemId: "W-STAY-RESOURCE:roomSetup" }
    ], ctx.state.query);

    expect(vm[0].resultType).toBe("workItem");
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
