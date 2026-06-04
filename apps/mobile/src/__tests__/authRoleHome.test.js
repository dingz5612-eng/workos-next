import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginActor } from "../apiClient.js";
import { setView } from "../navigationController.js";
import { login } from "../authController.js";

vi.mock("../apiClient.js", () => ({
  loginActor: vi.fn(),
  logoutActor: vi.fn(),
  registerDeviceSession: vi.fn(async (device) => device),
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
    ["finance", "home"],
    ["manager", "home"],
    ["admin", "home"],
    ["releaseOwner", "home"]
  ])("%s mobile login routes to %s", async (role, expectedView) => {
    vi.stubGlobal("document", {
      querySelector: (selector) => ({
        value: selector === "#loginAccount" ? role : "dev"
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

  it.each([
    ["finance", "financeControl"],
    ["manager", "managerControlTower"],
    ["admin", "governanceCenter"],
    ["releaseOwner", "releaseFlightDeck"]
  ])("%s trusted PC login routes to %s", async (role, expectedView) => {
    vi.stubGlobal("document", {
      querySelector: (selector) => ({
        value: selector === "#loginAccount" ? role : "dev"
      })
    });
    loginActor.mockResolvedValue({ role, displayName: role, token: `${role}-token` });
    const ctx = {
      state: {
        apiStatus: "online",
        currentActor: null,
        view: "login",
        currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" },
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

  it("keeps the selected login account when projection hydration re-renders login controls", async () => {
    let selectedAccount = "dormOperator";
    vi.stubGlobal("document", {
      querySelector: (selector) => {
        if (selector === "#loginAccount") {
          return { value: selectedAccount };
        }
        if (selector === "#loginPassword") {
          return { value: "dev" };
        }
        return { value: "" };
      }
    });
    loginActor.mockResolvedValue({
      role: "operator",
      displayName: "Dorm Operator",
      token: "operator-token",
      actorId: "u-dorm-operator",
      tenantId: "tenant-dorm-int-001",
      department: "住宿运营部",
      businessLine: "stay",
      capabilities: ["operations.confirm", "search.read", "mobile.work"]
    });
    const ctx = {
      state: {
        apiStatus: "online",
        currentActor: null,
        view: "login",
        currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
        pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } }
      },
      hydrateProjectionFromApi: vi.fn(async () => {
        selectedAccount = "dormFrontdesk";
      }),
      tr: (key) => key,
      render: vi.fn()
    };

    await login(ctx);

    expect(loginActor).toHaveBeenCalledWith("dormOperator", "dev");
    expect(ctx.state.currentActor.department).toBe("住宿运营部");
    expect(ctx.state.currentActor.capabilities).toContain("operations.confirm");
  });

  it("shows a pending login state immediately and does not pre-hydrate when the API is already online", async () => {
    vi.stubGlobal("document", {
      querySelector: (selector) => {
        if (selector === "#loginAccount") return { value: "dormOperator" };
        if (selector === "#loginPassword") return { value: "dev" };
        return { value: "" };
      }
    });
    let resolveLogin;
    loginActor.mockReturnValue(new Promise((resolve) => {
      resolveLogin = resolve;
    }));
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

    const pending = login(ctx);
    await Promise.resolve();

    expect(ctx.state.loginSubmitting).toBe(true);
    expect(ctx.state.loginMessage).toBe("loginSubmitting");
    expect(ctx.render).toHaveBeenCalled();
    expect(ctx.hydrateProjectionFromApi).not.toHaveBeenCalled();

    resolveLogin({ role: "operator", displayName: "Dorm Operator", token: "operator-token", actorId: "u-operator", tenantId: "tenant-1" });
    await pending;

    expect(ctx.state.loginSubmitting).toBe(false);
    expect(setView).toHaveBeenCalledWith("home", ctx);
  });
});
