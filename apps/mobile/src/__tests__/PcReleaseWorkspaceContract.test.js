import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM Surface PC Release Workspace contract", () => {
  it("renders release workspace in PC shell without mobile nav", () => {
    const ctx = createSurfaceCtx({
      view: "releaseFlightDeck",
      currentActor: { role: "releaseOwner", displayName: "发布负责人", capabilities: ["release.flight_deck.view"] },
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } },
      releaseControl: { releases: [], selectedRelease: null }
    });
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain("surface-pc");
    expect(html).not.toContain("bottom-nav");
    expect(text).toContain("发布工作区");
    expect(text).toContain("暂无发布清单");
  });
});

