import { describe, expect, it, vi } from "vitest";
import { submitCurrentCard } from "../operationController.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C weak network submit contract", () => {
  it("can keep a local draft posture but cannot confirm while offline", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const ctx = createSurfaceCtx({
      apiStatus: "offline",
      hydrateProjectionFromApi: vi.fn(async () => {}),
      render: vi.fn()
    });

    await submitCurrentCard(ctx);

    expect(ctx.state.operationMessage).toContain("后端 API 未连接");
    expect(ctx.state.lastActionResult?.status).not.toBe("committed_projected");
    vi.unstubAllGlobals();
  });
});
