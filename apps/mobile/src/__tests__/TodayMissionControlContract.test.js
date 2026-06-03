import { describe, expect, it } from "vitest";
import { renderSurface, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C Today Mission Control contract", () => {
  it("renders localized mission control and today learning on the mobile home surface", () => {
    const html = renderSurface("home");

    expect(html).toContain("今天");
    expect(html).toContain("今日任务中心");
    expect(html).toContain("今日待办");
    expect(html).toContain("今日必学");
    expect(html).toContain("证据怎么补");
    expect(html).toContain("home-learning-card");
    expect(html).not.toContain("search-result-card learning");
    expect(html).not.toContain("WorkItemMissionControl");
  });

  it("does not duplicate the queue total as both metrics and must-do chips", () => {
    const text = visibleText(renderSurface("home"));

    expect(text).toContain("必须做");
    expect(text).not.toContain("待我处理");
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
  });
});
