import { describe, expect, it, vi } from "vitest";
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

  it("keeps browser URL view in sync with in-memory route changes", () => {
    let replacedUrl = "";
    vi.stubGlobal("window", {
      location: {
        href: "http://localhost:5175/?view=login&lang=zh-CN&device=mobile",
        origin: "http://localhost:5175"
      },
      history: {
        replaceState: vi.fn((state, title, url) => {
          replacedUrl = url;
        })
      }
    });
    const ctx = createSurfaceCtx({ view: "login" });

    setView("home", ctx);

    expect(ctx.state.view).toBe("home");
    expect(replacedUrl).toContain("view=home");
    expect(replacedUrl).toContain("lang=zh-CN");
    vi.unstubAllGlobals();
  });
});
