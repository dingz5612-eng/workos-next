import { beforeEach, describe, expect, it, vi } from "vitest";

function stubBrowser({ href = "https://mobile.workosnext.local/?api=http://127.0.0.1:5180", cookie = "" } = {}) {
  const storage = new Map();
  const location = new URL(href);
  vi.stubGlobal("window", { location });
  vi.stubGlobal("document", { cookie });
  vi.stubGlobal("localStorage", {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  });
  return storage;
}

describe("frontend trust boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ignores unsafe Production ?api overrides and falls back to same origin", async () => {
    const storage = stubBrowser();
    vi.stubEnv("VITE_WORKOS_RUNTIME_ENV", "production");
    const { createInitialState } = await import("../appState.js");
    const { resolveApiBaseUrl } = await import("../apiClient.js");

    createInitialState();

    expect(storage.get("workosnext.apiBaseUrl")).toBeUndefined();
    expect(resolveApiBaseUrl()).toBe("https://mobile.workosnext.local");
  });

  it("does not persist actor token in Production actor session storage", async () => {
    stubBrowser();
    vi.stubEnv("VITE_WORKOS_RUNTIME_ENV", "production");
    const { actorSessionForStorage } = await import("../apiClient.js");

    expect(actorSessionForStorage({ role: "operator", token: "secret-token" })).toEqual({ role: "operator" });
  });

  it("sends cookie credentials and CSRF while omitting the development actor header in Production", async () => {
    stubBrowser({ cookie: "workosnext_csrf=csrf-production" });
    vi.stubEnv("VITE_WORKOS_RUNTIME_ENV", "production");
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ confirmed: true }) });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("AbortSignal", { timeout: () => "timeout" });
    const { confirmOperationWorkItem } = await import("../apiClient.js");

    await confirmOperationWorkItem("wi-1", "dev-token", { submissionId: "sub-1" });

    const [, options] = fetch.mock.calls[0];
    expect(options.credentials).toBe("include");
    expect(options.headers["X-CSRF-Token"]).toBe("csrf-production");
    expect(options.headers["X-WorkOS-Actor-Token"]).toBeUndefined();
  });

  it("keeps the Development actor header while still sending credentials", async () => {
    stubBrowser();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ confirmed: true }) });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("AbortSignal", { timeout: () => "timeout" });
    const { confirmOperationWorkItem } = await import("../apiClient.js");

    await confirmOperationWorkItem("wi-1", "dev-token", { submissionId: "sub-1" });

    const [, options] = fetch.mock.calls[0];
    expect(options.credentials).toBe("include");
    expect(options.headers["X-WorkOS-Actor-Token"]).toBe("dev-token");
  });

  it("gives login enough time for runtime-backed local authentication", async () => {
    stubBrowser({ href: "http://localhost:5176/" });
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: true }) });
    const timeout = vi.fn((value) => `timeout-${value}`);
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("AbortSignal", { timeout });
    const { loginActor } = await import("../apiClient.js");

    await loginActor("dormOperator", "dev");

    expect(timeout).toHaveBeenCalledWith(8000);
    expect(fetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("does not hydrate protected surfaces before login and defaults device trust to unknown", async () => {
    stubBrowser({ href: "http://localhost:5180/" });
    const { createInitialState, shouldHydrateProtectedSurfaces } = await import("../appState.js");

    const state = createInitialState();

    expect(shouldHydrateProtectedSurfaces(state)).toBe(false);
    expect(state.currentDevice.deviceTrustStatus).toBe("unknown");
  });

  it("does not hydrate protected surfaces on the login route even when stale actor storage exists", async () => {
    const storage = stubBrowser({ href: "http://localhost:5175/?view=login&lang=zh-CN&device=mobile" });
    storage.set("workosnext.actorSession", JSON.stringify({ role: "operator", token: "stale-token" }));
    const { createInitialState, shouldHydrateProtectedSurfaces } = await import("../appState.js");

    const state = createInitialState();

    expect(state.view).toBe("login");
    expect(state.currentActor?.token).toBe("stale-token");
    expect(shouldHydrateProtectedSurfaces(state)).toBe(false);
  });
});
