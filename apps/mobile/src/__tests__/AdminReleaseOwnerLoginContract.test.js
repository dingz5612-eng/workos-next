import { describe, expect, it, vi } from "vitest";
import { loginView } from "../views/loginView.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("Account Actor Kernel login contract", () => {
  it("keeps login to username and password only", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const html = loginView(createSurfaceCtx({ view: "login", currentActor: null }));

    expect(html).toContain("id=\"loginAccount\"");
    expect(html).toContain("id=\"loginPassword\"");
    expect(html).toContain("部门、业务线、角色和权限由管理员在 PC 治理面分配");
    expect(html).not.toContain("id=\"loginDepartment\"");
    expect(html).not.toContain("住宿经办账号 · 房间/床位/费率");
    expect(html).not.toContain("财务确认账号 · 收款/押金/对账");
    vi.unstubAllGlobals();
  });

  it("does not expose dev admin or release-owner account choices on the login page", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const devHtml = loginView(createSurfaceCtx({ view: "login", currentActor: null }));
    expect(devHtml).not.toContain("<b>admin</b>");
    expect(devHtml).not.toContain("<b>dormReleaseOwner</b>");

    vi.stubGlobal("window", { location: { hostname: "example.com" } });
    const prodHtml = loginView(createSurfaceCtx({ view: "login", currentActor: null }));
    expect(prodHtml).not.toContain("<b>admin</b>");
    expect(prodHtml).not.toContain("<b>dormReleaseOwner</b>");
    vi.unstubAllGlobals();
  });
});
