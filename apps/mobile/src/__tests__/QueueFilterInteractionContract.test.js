import { describe, expect, it, vi } from "vitest";
import { clearQueueFilterState, setQueueFilter, setTodayFilter, setWorkFilter } from "../queueController.js";
import { queueFiltersFromState } from "../queueFilterState.js";
import { countEvidenceState, countTransferable, evidenceStateFor, queueTasks } from "../selectors/queueSelectors.js";
import { selectCompletedWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { workbenchView } from "../views/workbenchView.js";
import { createSurfaceCtx, runtimeStore } from "./surfaceContractTestHelpers.js";

describe("OAM Surface queue filter interaction contract", () => {
  it("Workbench IA chips write queueFilters and change the visible result set", () => {
    const ctx = queueCtx();
    setWorkFilter("accommodation", ctx);

    expect(ctx.state.queueFilters.domain).toBe("stay");
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-STAY-RESOURCE"]);

    ctx.state.runtimeStore.workQueue[0].evidenceState = "missing";
    setWorkFilter("need-evidence", ctx);
    expect(ctx.state.queueFilters.evidenceState).toBe("missing");
    expect(queueTasks(ctx.state)).toHaveLength(1);
  });

  it("advanced filters for domain, blocked, and ownerRole are consumed by queueTasks", () => {
    const ctx = queueCtx({ currentActor: { role: "manager", displayName: "经理" } });

    setQueueFilter("domain", "repair", ctx);
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-REPAIR-TICKET"]);

    setQueueFilter("status", "blocked", ctx);
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-REPAIR-TICKET"]);

    setQueueFilter("ownerRole", "mine", ctx);
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-REPAIR-TICKET"]);
  });

  it("clear filters resets visible results and queueDomain state still works", () => {
    const ctx = queueCtx({ queueDomain: "repair", queueBadge: "mine", currentActor: { role: "manager", displayName: "经理" } });

    expect(queueFiltersFromState(ctx.state).domain).toBe("repair");
    expect(queueTasks(ctx.state)).toHaveLength(1);

    clearQueueFilterState(ctx);

    expect(queueFiltersFromState(ctx.state)).toMatchObject({ domain: "all", badge: "all" });
    expect(queueTasks(ctx.state)).toHaveLength(2);
  });

  it("hides repair and finance WorkItems from an accommodation operator queue", () => {
    const ctx = queueCtx();
    ctx.state.runtimeStore.workQueue.push({
      queueItemId: "q-ledger-correction",
      workItemId: "W-STAY-RESOURCE:ledgerCorrectionApply",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "ledgerCorrectionApply",
      lifecycleState: "ready",
      ownerRole: "operator",
      badges: ["mine"],
      reason: "财务修正"
    });

    const ids = queueTasks(ctx.state).map((item) => item.workItemId);

    expect(ids).toContain("W-STAY-RESOURCE:roomSetup");
    expect(ids).not.toContain("W-REPAIR-TICKET:repairCheck");
    expect(ids).not.toContain("W-STAY-RESOURCE:ledgerCorrectionApply");
  });

  it("renders one visible filter surface and keeps advanced filters out of the default workbench", () => {
    const ctx = queueCtx();
    const html = workbenchView(ctx);

    expect(html).toContain('data-work-filter="all-work"');
    expect(html).toContain('data-work-filter="can-do"');
    expect(html).toContain('data-work-filter="scenario-resource"');
    expect(html).toContain('data-mobile-work-scenario-ia');
    expect(html).toContain('data-mobile-ia="filter"');
    expect(html).toContain('data-queue-filter-state');
    expect(html).toContain("清除筛选");
    expect(html).not.toContain('class="queue-filter"');
    expect(html).not.toContain('id="advanced"');
    expect(html).not.toContain('data-filter-field="evidenceState"');
  });

  it("marks the active sort option", () => {
    const html = workbenchView(queueCtx({ sort: "dueSort" }));

    expect(html).toContain('<option value="dueSort" selected>');
  });

  it("counts only runtime/manual evidence problems as needing operator evidence", () => {
    expect(evidenceStateFor({ evidenceState: "rejected" })).toBe("missing");
    expect(evidenceStateFor({ evidenceDrafts: [{ status: "draft" }] })).toBe("draft");
    expect(evidenceStateFor({ card: { evidence: [{ id: "ev-1" }] } })).toBe("system_ready");

    const ctx = queueCtx();
    expect(countEvidenceState(ctx.state, "missing")).toBe(0);
    expect(workbenchView(ctx)).not.toContain("缺少材料，暂不能提交");
    ctx.state.runtimeStore.workQueue[0].evidenceState = "missing";
    expect(countEvidenceState(ctx.state, "missing")).toBe(1);
  });

  it("Home overview chips filter Today in place instead of opening Workbench", () => {
    const ctx = queueCtx({ view: "home" });

    setTodayFilter("missing-evidence", ctx);

    expect(ctx.state.view).toBe("home");
    expect(ctx.state.todayFilter).toBe("missing-evidence");
    expect(ctx.state.queueFilters).toBeUndefined();
    expect(ctx.render).toHaveBeenCalledWith();
  });

  it("does not infer transferable tasks from owner-role mismatch without runtime permission", () => {
    const ctx = queueCtx({ currentActor: { role: "frontdesk", displayName: "前台" } });

    expect(countTransferable(ctx.state)).toBe(0);
    ctx.state.runtimeStore.workQueue[0].transferable = true;
    expect(countTransferable(ctx.state)).toBe(1);
  });

  it("keeps terminal WorkItems out of the active workbench queue", () => {
    const ctx = queueCtx();
    ctx.state.runtimeStore.workQueue.push({
      queueItemId: "q-completed-room",
      workItemId: "W-STAY-RESOURCE:completedRoomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "confirmed",
      badges: ["mine"],
      reason: "已完成"
    });

    expect(queueTasks(ctx.state).map((item) => item.workItemId)).not.toContain("W-STAY-RESOURCE:completedRoomSetup");
    expect(selectCompletedWorkbenchQueue(ctx.state).map((item) => item.workItemId)).toContain("W-STAY-RESOURCE:completedRoomSetup");
  });

  it("renders completed WorkItems as read-only records", () => {
    const ctx = queueCtx();
    ctx.state.runtimeStore.workQueue.push({
      queueItemId: "q-completed-room",
      workItemId: "W-STAY-RESOURCE:completedRoomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "confirmed",
      badges: ["mine"],
      reason: "已完成"
    });
    const html = workbenchView(ctx);

    expect(html).toContain("已完成记录");
    expect(html).toContain(">查看记录</button>");
    expect(html).not.toContain('data-work-item-id="W-STAY-RESOURCE:completedRoomSetup"');
  });

  it("keeps the workbench quiet when there are no active tasks", () => {
    const ctx = queueCtx();
    ctx.state.runtimeStore.workQueue = [];
    ctx.state.runtimeStore.workspaces = [];
    const html = workbenchView(ctx);

    expect(html).not.toContain("data-mobile-work-ia");
    expect(html).not.toContain("data-queue-filter-state");
    expect(html).not.toContain('id="sort"');
    expect(html).toContain("当前没有分配给你的待办");
  });
});

function queueCtx(overrides = {}) {
  const store = runtimeStore();
  store.workspaces.push({
    id: "W-REPAIR-TICKET",
    domain: "repair",
    title: { "zh-CN": "维修工单" },
    summary: { "zh-CN": "维修处理" },
    next: { "zh-CN": "等待主管确认" },
    cards: [{
      id: "repairCheck",
      status: "blocked",
      title: { "zh-CN": "维修确认" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [],
      blockerRules: [],
      confirmation: { required: false }
    }]
  });
  store.workQueue.push({
    queueItemId: "q-repair",
    workItemId: "W-REPAIR-TICKET:repairCheck",
    workspaceId: "W-REPAIR-TICKET",
    cardId: "repairCheck",
    workItemType: "Dorm.Repair",
    lifecycleState: "blocked",
    ownerRole: "operator",
    badges: ["mine", "blocked"],
    reason: "等待主管确认"
  });
  const ctx = createSurfaceCtx({
    queueFilters: undefined,
    queueDomain: "all",
    queueBadge: "all",
    todayFilter: "must-do",
    runtimeStore: store,
    ...overrides
  });
  ctx.render = vi.fn();
  return ctx;
}
