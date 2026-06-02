import { describe, expect, it } from "vitest";
import { setView } from "../navigationController.js";
import { createSurfaceCtx, renderSurface } from "./surfaceContractTestHelpers.js";

describe("Stage B mobile Me entry route contract", () => {
  it("keeps Me entries reachable under SurfaceGuard for ordinary mobile users", () => {
    const html = renderSurface("me");
    for (const label of ["学习中心", "我的权限", "最近提交", "最近轨迹", "设备可信状态"]) {
      expect(html).toContain(label);
    }

    const ctx = createSurfaceCtx({ view: "me" });
    setView("learning", ctx);
    expect(ctx.state.view).toBe("learning");
    setView("permissions", ctx);
    expect(ctx.state.view).toBe("permissions");
  });
});
