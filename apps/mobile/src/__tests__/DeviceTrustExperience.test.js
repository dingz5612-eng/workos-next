import { describe, expect, it } from "vitest";
import { DeviceTrustPanel } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C device trust experience", () => {
  it("renders trusted mobile device copy without raw device fields", () => {
    const ctx = createSurfaceCtx();
    const html = DeviceTrustPanel(ctx.state, ctx);

    expect(html).toContain("当前设备");
    expect(html).toContain("设备已验证");
    expect(visibleText(html)).not.toMatch(/\b(deviceId|trustState|surface)\b/);
  });

  it("diagnoses PC context leakage instead of showing pc-current", () => {
    const ctx = createSurfaceCtx({
      currentDevice: null,
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } }
    });
    const html = DeviceTrustPanel(ctx.state, ctx);

    expect(html).toContain("设备上下文异常");
    expect(html).not.toContain("pc-current");
    expect(html).not.toContain("surface pc");
  });
});
