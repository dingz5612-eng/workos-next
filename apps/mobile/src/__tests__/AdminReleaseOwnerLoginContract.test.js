import { describe, expect, it, vi } from "vitest";
import { loginView } from "../views/loginView.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("Stage B dev login role contract", () => {
  it("explains login accounts as job scopes and keeps department as a filter", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const html = loginView(createSurfaceCtx({ view: "login", currentActor: null }));

    expect(html).toContain("住宿经办账号 · 房间/床位/费率");
    expect(html).toContain("财务确认账号 · 收款/押金/对账");
    expect(html).toContain("默认业务线");
    expect(html).toContain("默认业务线只影响筛选和首页内容，不改变这个账号能办理什么。");
    expect(html).toContain("登录页不能临时加权限");
    vi.unstubAllGlobals();
  });

  it("shows admin and dormitory release owner only in dev/local browser context", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const devHtml = loginView(createSurfaceCtx({ view: "login", currentActor: null }));
    expect(devHtml).toContain("<b>admin</b>");
    expect(devHtml).toContain("<b>dormReleaseOwner</b>");

    vi.stubGlobal("window", { location: { hostname: "example.com" } });
    const prodHtml = loginView(createSurfaceCtx({ view: "login", currentActor: null }));
    expect(prodHtml).not.toContain("<b>admin</b>");
    expect(prodHtml).not.toContain("<b>dormReleaseOwner</b>");
    vi.unstubAllGlobals();
  });
});
