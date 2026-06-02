import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B Manager Control Tower IA contract", () => {
  it("does not reuse Governance Command Center as manager first screen", () => {
    const ctx = createSurfaceCtx({
      view: "managerControlTower",
      currentActor: { role: "manager", displayName: "经理", capabilities: ["manager.control.view"] },
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
    });
    const html = routeView(ctx);

    expect(html).toContain("Manager Control Tower");
    expect(html).not.toContain("Governance Command Center");
    expect(visibleText(html)).not.toMatch(/今天\s+工作\s+搜索\s+我的/);
  });
});
