import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, renderSurface, source, visibleText } from "./surfaceContractTestHelpers.js";

describe("OMA Surface layout, mission control, and PC shell contract", () => {
  it("uses fixed-layer tokens and keeps the primary action in flow above bottom nav", () => {
    const shellCss = source("../styles/shell.css");
    const operationCss = source("../styles/operation.css");
    const html = renderSurface("operationPanel");

    expect(shellCss).toContain("--bottom-nav-height: 64px");
    expect(shellCss).toContain("--sticky-action-height: 64px");
    expect(shellCss).toContain("--safe-bottom: env(safe-area-inset-bottom, 0px)");
    expect(shellCss).toContain("calc(var(--bottom-nav-height) + var(--sticky-action-height) + var(--safe-bottom)");
    expect(operationCss).toContain("position: static");
    expect(operationCss).toContain("min-height: var(--bottom-nav-height)");
    expect(operationCss).toContain("bottom: calc(var(--bottom-nav-height) + var(--safe-bottom) + 18px)");
    expect(operationCss).toContain("focus-visible");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("sticky-action");
    expect(html).toContain("feedback-fab");
    expect(renderSurface("home")).toContain("feedback-fab");
    expect(renderSurface("feedback")).not.toContain("feedback-fab");
  });

  it("derives home mission control from runtime queue and shows real empty state", () => {
    const ctx = createSurfaceCtx({ view: "home" });
    let text = visibleText(routeView(ctx));

    expect(text).toContain("今日工作");
    expect(text).toContain("缺证据 0");
    expect(text).toContain("房间");
    expect(text).not.toContain("globalReason");

    ctx.state.runtimeStore.workQueue[0].evidenceState = "missing";
    text = visibleText(routeView(ctx));

    expect(text).toContain("缺证据 1");

    ctx.state.runtimeStore.workQueue = [];
    ctx.state.runtimeStore.operationWorkItems = [];
    ctx.state.runtimeStore.workspaces = [];
    text = visibleText(routeView(ctx));

    expect(text).toContain("今天没有新的具体事项");
    expect(text).not.toContain("住宿/维修");
  });

  it("keeps PC shell desktop width and hides mobile nav on PC surfaces", () => {
    const css = source("../styles/shell.css");
    const pcCtx = createSurfaceCtx({
      view: "financeControl",
      currentActor: { role: "finance", displayName: "财务确认人", capabilities: ["finance.control.view"] },
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
    });
    const html = routeView(pcCtx);

    expect(css).toContain(".app-shell.surface-pc");
    expect(css).toContain("width: min(100%, 1200px)");
    expect(html).toContain("surface-pc");
    expect(html).not.toContain("bottom-nav");
    expect(visibleText(html)).toContain("财务");
  });

  it("blocks mobile PC governance content and allows releaseOwner on trusted PC", () => {
    const mobileCtx = createSurfaceCtx({
      view: "governanceCenter",
      currentActor: { role: "admin", displayName: "治理管理员", capabilities: ["governance.center.view"] },
      currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" }
    });
    const mobile = routeView(mobileCtx);
    expect(visibleText(mobile)).toContain("权限诊断");
    expect(visibleText(mobile)).not.toContain("治理中心");

    const pcCtx = createSurfaceCtx({
      view: "releaseFlightDeck",
      currentActor: { role: "releaseOwner", displayName: "发布负责人", capabilities: ["release.flight_deck.view"] },
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } },
      releaseControl: { releases: [], selectedRelease: null }
    });
    expect(routeView(pcCtx)).toContain("surface-pc");
    expect(visibleText(routeView(pcCtx))).toContain("发布工作区");
  });
});
