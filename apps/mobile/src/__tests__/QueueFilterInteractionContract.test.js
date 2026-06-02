import { describe, expect, it, vi } from "vitest";
import { clearQueueFilterState, setQueueFilter, setWorkFilter } from "../queueController.js";
import { queueFiltersFromState } from "../queueFilterState.js";
import { evidenceStateFor, queueTasks } from "../selectors/queueSelectors.js";
import { workbenchView } from "../views/workbenchView.js";
import { createSurfaceCtx, runtimeStore } from "./surfaceContractTestHelpers.js";

describe("OAM-04B queue filter interaction contract", () => {
  it("Workbench IA chips write queueFilters and change the visible result set", () => {
    const ctx = queueCtx();
    setWorkFilter("accommodation", ctx);

    expect(ctx.state.queueFilters.domain).toBe("stay");
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-STAY-RESOURCE"]);

    setWorkFilter("need-evidence", ctx);
    expect(ctx.state.queueFilters.evidenceState).toBe("missing");
    expect(queueTasks(ctx.state)).toHaveLength(1);
  });

  it("advanced filters for domain, blocked, and ownerRole are consumed by queueTasks", () => {
    const ctx = queueCtx();

    setQueueFilter("domain", "repair", ctx);
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-REPAIR-TICKET"]);

    setQueueFilter("status", "blocked", ctx);
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-REPAIR-TICKET"]);

    setQueueFilter("ownerRole", "mine", ctx);
    expect(queueTasks(ctx.state).map((item) => item.workspaceId)).toEqual(["W-REPAIR-TICKET"]);
  });

  it("clear filters resets visible results and old queueDomain compatibility still works", () => {
    const ctx = queueCtx({ queueDomain: "repair", queueBadge: "mine" });

    expect(queueFiltersFromState(ctx.state).domain).toBe("repair");
    expect(queueTasks(ctx.state)).toHaveLength(1);

    clearQueueFilterState(ctx);

    expect(queueFiltersFromState(ctx.state)).toMatchObject({ domain: "all", badge: "mine" });
    expect(queueTasks(ctx.state)).toHaveLength(2);
  });

  it("renders clickable data-work-filter and visible filter state", () => {
    const ctx = queueCtx();
    ctx.state.advancedOpen = true;
    const html = workbenchView(ctx);

    expect(html).toContain('data-work-filter="accommodation"');
    expect(html).toContain('data-mobile-ia="filter"');
    expect(html).toContain('data-filter-field="evidenceState"');
    expect(html).toContain('data-queue-filter-state');
    expect(html).toContain("清除筛选");
  });

  it("evidence count uses evidenceState missing, draft, and rejected", () => {
    expect(evidenceStateFor({ evidenceState: "rejected" })).toBe("rejected");
    expect(evidenceStateFor({ evidenceDrafts: [{ status: "draft" }] })).toBe("draft");
    expect(evidenceStateFor({ card: { evidence: [{ id: "ev-1" }] } })).toBe("missing");
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
    queueBadge: "mine",
    runtimeStore: store,
    ...overrides
  });
  ctx.render = vi.fn();
  return ctx;
}
