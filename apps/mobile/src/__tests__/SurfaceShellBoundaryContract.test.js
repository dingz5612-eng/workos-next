import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, renderSurface } from "./surfaceContractTestHelpers.js";

describe("Stage B surface shell boundary contract", () => {
  it("keeps mobile shell out of PC surfaces and PC governance out of mobile shell", () => {
    const mobile = renderSurface("home");
    expect(mobile).not.toContain("PC Governance");

    const pcCtx = createSurfaceCtx({
      view: "governanceCenter",
      currentActor: { role: "admin", displayName: "管理员", capabilities: ["admin.role_capability.edit"] },
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
    });
    const pc = routeView(pcCtx);
    expect(pc).toContain("Governance Command Center");
    expect(pc).not.toContain("bottom-nav");
  });
});
