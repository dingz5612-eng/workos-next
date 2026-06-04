import { describe, expect, it, vi } from "vitest";
import { loginView } from "../views/loginView.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("Stage B dev login role contract", () => {
  it("shows admin and dormitory release owner only in dev/local browser context", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const devHtml = loginView(createSurfaceCtx({ view: "login", currentActor: null }));
    expect(devHtml).toContain('value="admin"');
    expect(devHtml).toContain('value="dormReleaseOwner"');

    vi.stubGlobal("window", { location: { hostname: "example.com" } });
    const prodHtml = loginView(createSurfaceCtx({ view: "login", currentActor: null }));
    expect(prodHtml).not.toContain('value="admin"');
    expect(prodHtml).not.toContain('value="dormReleaseOwner"');
    vi.unstubAllGlobals();
  });
});
