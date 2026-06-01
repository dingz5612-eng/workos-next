import { describe, expect, it } from "vitest";
import { evaluateSurfaceAccess } from "../surfaceGuard.js";
import { PermissionDiagnostic } from "../views/experienceComponents.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C permission explainability", () => {
  it("shows reason, owner, required permission, and next action", () => {
    const ctx = createSurfaceCtx();
    const decision = evaluateSurfaceAccess("releaseFlightDeck", ctx.state);
    const html = PermissionDiagnostic(decision, ctx);

    expect(decision.allowed).toBe(false);
    expect(html).toContain("权限诊断");
    expect(html).toContain("为什么不能访问");
    expect(html).toContain("谁能处理");
    expect(html).toContain("需要的权限");
    expect(html).toContain("下一步动作");
  });
});
