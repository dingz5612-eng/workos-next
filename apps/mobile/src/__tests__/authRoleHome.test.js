import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginActor } from "../apiClient.js";
import { setView } from "../navigationController.js";
import { login } from "../authController.js";

vi.mock("../apiClient.js", () => ({
  loginActor: vi.fn(),
  actorSessionForStorage: (session) => session
}));

vi.mock("../navigationController.js", () => ({
  setView: vi.fn((view, ctx) => {
    ctx.state.view = view;
  })
}));

describe("Role Operating System login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map([["workosnext.onboarded", "1"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });
  });

  it.each([
    ["finance"],
    ["manager"],
    ["admin"],
    ["releaseOwner"]
  ])("%s mobile login routes to home", async (role) => {
    vi.stubGlobal("document", {
      querySelector: (selector) => ({
        value: selector === "#loginRole" ? role : "dev"
      })
    });
    loginActor.mockResolvedValue({ role, displayName: role, token: `${role}-token` });
    const ctx = {
      state: {
        apiStatus: "online",
        currentActor: null,
        view: "login",
        currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
        pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } }
      },
      hydrateProjectionFromApi: vi.fn(async () => {}),
      tr: (key) => key,
      render: vi.fn()
    };

    await login(ctx);

    expect(setView).toHaveBeenCalledWith("home", ctx);
    expect(ctx.state.view).toBe("home");
  });

  it.each([
    ["finance", "financeControl"],
    ["manager", "managerControlTower"],
    ["admin", "governanceCenter"],
    ["releaseOwner", "releaseFlightDeck"]
  ])("%s trusted PC login routes to %s", async (role, expectedView) => {
    vi.stubGlobal("document", {
      querySelector: (selector) => ({
        value: selector === "#loginRole" ? role : "dev"
      })
    });
    loginActor.mockResolvedValue({ role, displayName: role, token: `${role}-token` });
    const ctx = {
      state: {
        apiStatus: "online",
        currentActor: null,
        view: "login",
        currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
        pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
      },
      hydrateProjectionFromApi: vi.fn(async () => {}),
      tr: (key) => key,
      render: vi.fn()
    };

    await login(ctx);

    expect(setView).toHaveBeenCalledWith(expectedView, ctx);
    expect(ctx.state.view).toBe(expectedView);
  });
});
