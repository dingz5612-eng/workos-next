import { describe, expect, it } from "vitest";
import { renderSurface, source, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C Today Mission Control contract", () => {
  it("renders Today as shell title, compact overview, and concrete work items only", () => {
    const html = renderSurface("home");

    expect(html).toContain("今日工作");
    expect(html).toContain('data-today-filter="must-do"');
    expect(html).toContain('data-today-filter="missing-evidence"');
    expect(html).not.toContain('data-work-filter="mine"');
    expect(html).not.toContain('data-work-filter="need-evidence"');
    expect(html).toContain('data-queue-state="ready"');
    expect(html).toContain('data-queue-state="blocked"');
    expect(html).toContain('data-surface="today-focus-item"');
    expect(html).toContain('data-surface="business-task-overview"');
    expect(source("../views/homeView.js")).toContain("todayFocusItems");
    expect(source("../selectors/queueSelectors.js")).toContain("selectTodayFocusQueue");
    expect(html).not.toContain("今日待办");
    expect(html).not.toContain("今日必学");
    expect(html).not.toContain("home-learning-card");
    expect(html).not.toContain("search-result-card learning");
    expect(html).not.toContain("WorkItemMissionControl");
    expect(html).not.toContain('data-surface="today-mission-control"');
  });

  it("keeps the overview compact and uses metric clicks instead of explanation rows", () => {
    const html = renderSurface("home");
    const text = visibleText(html);

    expect(html).toContain('data-surface="today-focus-overview"');
    expect(html).toContain('data-today-filter="must-do"');
    expect(html).toContain('data-today-filter="risk-reminder"');
    expect(html).not.toContain('data-view="workbench" data-work-filter');
    expect(html).not.toContain('<span>今天</span>');
    expect(text).not.toContain("原因 已有可办理任务等待处理");
    expect(text).not.toContain("影响 住宿资源");
    expect(text).not.toContain("下一步 提交处理 工作台");
  });

  it("uses shared status colors for overview and work chips", () => {
    const css = source("../styles/shell.css");

    expect(css).toContain('.ia-chip[data-queue-state="ready"]');
    expect(css).toContain('.ia-chip[data-queue-state="due-soon"]');
    expect(css).toContain('.ia-chip[data-queue-state="waiting"]');
    expect(css).toContain('.ia-chip[data-queue-state="blocked"]');
  });

  it("does not duplicate the queue total as both metrics and must-do chips", () => {
    const text = visibleText(renderSurface("home"));

    expect(text).toContain("必须做");
    expect((text.match(/今日工作/g) || []).length).toBe(1);
    expect(text).not.toContain("必须做 必须做");
    expect(text).not.toContain("待我处理");
  });

  it("does not count system-bound submit checks as missing evidence on Home", () => {
    const text = visibleText(renderSurface("home"));

    expect(text).toContain("缺材料/缺证据 0");
    expect(text).not.toContain("有办理项缺少可信证据");
    expect(text).not.toContain("已有可办理任务等待处理");
  });

  it("does not render six zero chips when today has no assigned work", () => {
    const html = renderSurface("home", {
      runtimeStore: {
        workspaces: [],
        workQueue: [],
        operationWorkItems: [],
        homeSurface: [],
        learningCatalog: [],
        searchResultsByQuery: {}
      }
    });

    expect(html).not.toContain('data-mobile-today-ia');
    expect(visibleText(html)).not.toContain("必须做 0 即将超时 0");
  });

  it("renders at most one focused scenario instead of a workspace directory", () => {
    const html = renderSurface("home");

    expect((html.match(/class="today-scenario-card/g) || []).length).toBeLessThanOrEqual(1);
    expect(html).not.toContain("workspace-card-strip");
    expect(html).not.toContain('data-workspace="W-STAY-RESOURCE"');
    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).not.toContain("进入办理面");
    expect(html).not.toContain('data-surface="action-decision-card"');
  });

  it("does not expose a workspace/card direct action when Home has no persisted WorkItem", () => {
    const store = {
      ...sourceRuntimeStoreWithoutWorkItems(),
      workQueue: [],
      operationWorkItems: []
    };
    const html = renderSurface("home", { runtimeStore: store });
    const text = visibleText(html);

    expect(html).not.toContain("data-work-item-id");
    expect(html).not.toContain('data-workspace="W-STAY-RESOURCE"');
    expect(html).toContain('data-view="search"');
    expect(text).toContain("搜索");
    expect(text).not.toContain("暂不能直接办理");
  });

  it("keeps blocked work item recovery copy from squeezing mobile task titles", () => {
    const css = source("../styles/workspace.css");

    expect(css).toContain(".workitem-card-head {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".workitem-card-head > div {\n  min-width: 0;");
    expect(css).toContain(".workitem-route-blocked {\n  display: grid;");
    expect(css).toContain(".trusted-confirm-sheet dl,\n.permission-diagnostic dl,\n.device-trust-panel dl {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".app-shell.surface-pc .workitem-card-head");
    expect(css).toContain(".business-anchor-fields");
    expect(css).toContain(".queue-filter-state");
    expect(css).not.toContain("@media (min-width: 520px)");
    expect(css).not.toContain(".task-card");
    expect(css).not.toContain(".loop-steps");
  });
});

function sourceRuntimeStoreWithoutWorkItems() {
  return {
    workspaces: [{
      id: "W-STAY-RESOURCE",
      domain: "stay",
      caseId: "case:W-STAY-RESOURCE",
      title: { "zh-CN": "我要创建住宿资源" },
      summary: { "zh-CN": "房间床位入住资源" },
      next: { "zh-CN": "先配置房间和床位" },
      blockers: [],
      cards: [{
        id: "roomSetup",
        status: "ready",
        title: { "zh-CN": "房间配置卡" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
      }]
    }],
    workQueue: [],
    operationWorkItems: [],
    homeSurface: [],
    learningCatalog: [],
    searchResultsByQuery: {}
  };
}
