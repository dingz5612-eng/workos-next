import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { evaluateSurfaceAccess } from "../surfaceGuard.js";
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
    expect(pc).toContain("治理中心");
    expect(pc).toContain("surface-pc");
    expect(pc).not.toContain("bottom-nav");
  });

  it.each([
    ["financeControl", "finance"],
    ["governanceCenter", "admin"],
    ["managerControlTower", "manager"],
    ["releaseFlightDeck", "releaseOwner"]
  ])("blocks mobile direct URL to %s with a diagnostic", (view, role) => {
    const ctx = createSurfaceCtx({
      view,
      currentActor: { role, displayName: role, capabilities: ["finance.control.view", "manager.control.view", "governance.center.view", "release.flight_deck.view"] },
      currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
    });
    const decision = evaluateSurfaceAccess(view, ctx.state);
    const html = routeView(ctx);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("pc_surface_requires_pc_device");
    expect(html).toContain("权限诊断");
    expect(html).toContain("这个工作面只能在 PC 或发布设备打开。");
  });

  it.each([
    ["financeControl", "finance", "财务"],
    ["managerControlTower", "manager", "经理控制塔"],
    ["governanceCenter", "admin", "治理中心"],
    ["releaseFlightDeck", "releaseOwner", "发布"]
  ])("allows trusted PC device to open %s", (view, role, expectedCopy) => {
    const ctx = createSurfaceCtx({
      view,
      currentActor: { role, displayName: role, capabilities: ["finance.control.view", "manager.control.view", "governance.center.view", "release.flight_deck.view"] },
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
    });

    expect(evaluateSurfaceAccess(view, ctx.state).allowed).toBe(true);
    expect(routeView(ctx)).toContain(expectedCopy);
  });
});
