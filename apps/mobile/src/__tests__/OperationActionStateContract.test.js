import { describe, expect, it } from "vitest";
import { buildOperationActionState } from "../operationActionState.js";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B primary action state machine", () => {
  it("renders one primary submit CTA when the active card is ready", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({ view: "workspace", runtimeStore: store });

    const html = routeView(ctx);

    expect((html.match(/data-submit-card/g) || []).length).toBe(1);
    expect(visibleText(html)).toContain("提交处理");
  });

  it("does not render a second card-internal submit button", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({ view: "workspace", runtimeStore: store });

    const html = routeView(ctx);

    expect(html).not.toContain("submitForReview");
    expect((html.match(/data-submit-card/g) || []).length).toBe(1);
  });

  it.each([
    ["blocked", "查看阻断原因"],
    ["notStarted", "请先完成上一张卡"],
    ["done", "已完成"]
  ])("maps %s card state to the primary CTA", (status, label) => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].status = status;
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({ view: "workspace", runtimeStore: store });

    const html = routeView(ctx);

    expect(visibleText(html)).toContain(label);
    expect((html.match(/data-submit-card/g) || []).length).toBe(0);
  });

  it("maps submitting and submitted states to recovery actions", () => {
    const card = { id: "roomSetup", status: "ready", evidence: [] };
    const workItem = { workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup" };

    expect(buildOperationActionState(workItem, card, { status: "submitting" }).primaryAction.labelKey).toBe("primarySubmitting");
    expect(buildOperationActionState(workItem, card, { status: "committed_projected" }).primaryAction.labelKey).toBe("primaryViewTrace");
    expect(buildOperationActionState(workItem, card, { status: "committed_projection_pending" }).primaryAction.labelKey).toBe("primaryRefreshStatus");
  });

  it("does not show submit labels after a successful submit", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store,
      lastActionResult: { status: "committed_projected", message: "已提交" }
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("查看提交轨迹");
    expect(text).not.toContain("提交处理");
    expect(text).not.toContain("确认办理");
  });

  it("keeps projection pending distinct from failure", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store,
      lastActionResult: { status: "committed_projection_pending", message: "已提交，视图同步中" }
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("刷新状态");
    expect(text).toContain("视图同步中");
    expect(text).not.toContain("提交失败");
  });

  it.each([
    ["permission_blocked_403", "primaryViewPermission"],
    ["idempotency_conflict_409", "primaryViewTrace"],
    ["business_blocked_422", "primaryCompleteEvidence"]
  ])("maps %s to a specific recovery action", (status, labelKey) => {
    const card = { id: "roomSetup", status: "ready", evidence: [] };
    const workItem = { workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup" };

    expect(buildOperationActionState(workItem, card, { status }).primaryAction.labelKey).toBe(labelKey);
  });
});
