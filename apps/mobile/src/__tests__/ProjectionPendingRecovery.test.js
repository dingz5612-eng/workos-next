import { describe, expect, it } from "vitest";
import { ActionResult } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C projection pending recovery", () => {
  it("does not show projection pending as submit failure", () => {
    const ctx = createSurfaceCtx();
    const html = ActionResult({
      status: "committed_projection_pending",
      message: "已提交成功，视图同步中。"
    }, ctx);

    expect(html).toContain('data-surface="projection-pending"');
    expect(html).toContain("已提交成功，视图同步中。");
    expect(visibleText(html)).not.toContain("提交失败");
  });
});
