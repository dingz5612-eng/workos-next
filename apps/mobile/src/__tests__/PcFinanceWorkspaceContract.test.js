import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM Surface PC Finance Workspace contract", () => {
  it("renders finance workspace in PC shell without mobile nav", () => {
    const ctx = createSurfaceCtx({
      view: "financeControl",
      currentActor: { role: "finance", displayName: "财务确认人", capabilities: ["finance.control.view"] },
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
    });
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain("surface-pc");
    expect(html).not.toContain("bottom-nav");
    expect(text).toContain("财务对账与修正工作区");
    expect(text).toContain("银行流水导入");
    expect(text).toContain("Operations Runtime");
  });
});

