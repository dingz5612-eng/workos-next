import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../appState.js";
import { setQueueFilter } from "../queueController.js";
import { tr } from "../selectors/workspaceSelectors.js";
import { queueTasks } from "../selectors/queueSelectors.js";
import { searchView } from "../views/searchView.js";
import { workspaceView } from "../views/workspaceView.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("UX P0 closure contract", () => {
  it("falls unknown lang back to zh-CN without raw key crash", () => {
    const state = { lang: "xx-XX" };
    expect(tr(state, "today")).toBe("今天");
  });

  it("search result work item renders a clickable operationPanel CTA", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    const html = searchView(ctx);
    expect(html).toContain("data-work-item-id=");
    expect(html).toContain("data-workspace-id=");
    expect(html).not.toContain("[object Object]");
  });

  it("workspace keeps one primary submit CTA", () => {
    const ctx = createSurfaceCtx({ view: "workspace", debugSurface: false });
    const html = workspaceView(ctx);
    expect((html.match(/data-submit-card/g) || []).length).toBe(1);
    expect(html).toContain("提交处理");
  });

  it("advanced filter writes queueFilters and changes visible queue state", () => {
    const state = createSurfaceCtx({}).state;
    const ctx = { state, render: () => {} };
    const before = queueTasks(state).length;
    setQueueFilter("status", "blocked", ctx);
    expect(state.queueFilters.status).toBe("blocked");
    expect(queueTasks(state).length).toBeLessThanOrEqual(before);
  });

  it("saved finance mobile session initializes on home instead of financeControl", () => {
    const storage = new Map([
      ["workosnext.actorSession", JSON.stringify({ role: "finance", displayName: "finance" })],
      ["workosnext.onboarded", "1"]
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });
    vi.stubGlobal("window", { location: { search: "" } });
    const state = createInitialState();
    expect(state.view).toBe("home");
  });
});
