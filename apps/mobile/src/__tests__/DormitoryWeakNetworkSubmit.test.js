import { describe, expect, it, vi } from "vitest";
import { submitCurrentCard } from "../operationController.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C weak network submit contract", () => {
  it("can keep a local draft posture but cannot confirm while offline", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    vi.stubGlobal("document", {
      querySelectorAll: (selector) => selector === "[data-operation-field]"
        ? [
            { dataset: { operationField: "buildingContextRef" }, value: "1 号楼" },
            { dataset: { operationField: "floor" }, value: "3 层" },
            { dataset: { operationField: "roomNo" }, value: "301" },
            { dataset: { operationField: "bedCount" }, value: "6" }
          ]
        : [],
      querySelector: () => null
    });
    const ctx = createSurfaceCtx({
      apiStatus: "offline",
      hydrateProjectionFromApi: vi.fn(async () => {}),
      render: vi.fn()
    });

    await submitCurrentCard(ctx);

    expect(ctx.state.operationMessage).toContain("暂不能提交");
    expect(ctx.state.operationMessage).toContain("草稿已保留");
    expect(ctx.state.lastActionResult?.status).not.toBe("committed_projected");
    vi.unstubAllGlobals();
  });
});
