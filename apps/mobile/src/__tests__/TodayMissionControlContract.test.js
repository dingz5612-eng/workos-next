import { describe, expect, it } from "vitest";
import { renderSurface } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C Today Mission Control contract", () => {
  it("renders localized mission control and today learning on the mobile home surface", () => {
    const html = renderSurface("home");

    expect(html).toContain("今天");
    expect(html).toContain("今日任务中心");
    expect(html).toContain("今日待办");
    expect(html).toContain("今日必学");
    expect(html).toContain("证据怎么补");
    expect(html).not.toContain("WorkItemMissionControl");
  });
});
