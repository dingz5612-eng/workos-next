import { describe, expect, it } from "vitest";
import { renderSurface } from "./surfaceContractTestHelpers.js";

describe("OAM-04B mobile accessibility contract", () => {
  it("adds bottom nav labels, active state, and advanced filter semantics", () => {
    const home = renderSurface("home");
    const work = renderSurface("workbench");

    expect(home).toContain('aria-label="移动端主导航"');
    expect(home).toContain('aria-current="page"');
    expect(work).toContain('data-work-filter="accommodation"');
    expect(work).toContain('data-mobile-ia="filter"');
  });
});
