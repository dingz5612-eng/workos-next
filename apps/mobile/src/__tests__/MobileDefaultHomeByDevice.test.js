import { describe, expect, it } from "vitest";
import { createInitialState } from "../appState.js";
import { defaultHomeForSession } from "../authController.js";
import { defaultHomeForCurrentSurface } from "../navigationController.js";
import { resolveActiveDevice, resolveCurrentSurface } from "../surfaceResolver.js";

describe("OAM-04B mobile default home by device", () => {
  it("keeps PC-only roles on a mobile-accessible work plane after login", () => {
    const mobile = {
      currentDevice: { deviceId: "mobile-current", surface: "mobile", deviceTrustStatus: "trusted" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", surface: "pc", deviceTrustStatus: "trusted" } }
    };

    expect(defaultHomeForSession({ role: "finance" }, mobile)).toBe("home");
    expect(defaultHomeForSession({ role: "manager" }, mobile)).toBe("home");
    expect(defaultHomeForSession({ role: "admin" }, mobile)).toBe("home");
    expect(defaultHomeForSession({ role: "releaseOwner" }, mobile)).toBe("home");
  });

  it("keeps saved PC-only sessions on home when the active device is mobile", () => {
    for (const role of ["finance", "manager", "admin", "releaseOwner"]) {
      const storage = new Map([
        ["workosnext.actorSession", JSON.stringify({ role, displayName: role, token: `${role}-token` })],
        ["workosnext.onboarded", "1"]
      ]);
      globalThis.localStorage = {
        getItem: (key) => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key)
      };
      globalThis.window = { location: { search: "" } };

      expect(createInitialState().view).toBe("home");
    }
  });

  it("keeps onboarding completion on the active mobile surface", () => {
    const ctx = {
      state: {
        currentActor: { role: "releaseOwner" },
        currentDevice: { deviceId: "mobile-current", surface: "mobile", deviceTrustStatus: "trusted" },
        pcGovernance: { currentDevice: { deviceId: "pc-current", surface: "pc", deviceTrustStatus: "trusted" } }
      }
    };

    expect(defaultHomeForCurrentSurface(ctx)).toBe("home");
  });

  it("uses pcGovernance.currentDevice only for trusted PC routes with an active PC device", () => {
    const mobileState = {
      currentDevice: { deviceId: "mobile-current", surface: "mobile", deviceTrustStatus: "trusted" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", surface: "pc", deviceTrustStatus: "trusted" } }
    };
    const pcState = {
      currentDevice: { deviceId: "pc-current", surface: "pc", deviceTrustStatus: "trusted" },
      pcGovernance: { currentDevice: { deviceId: "pc-current", surface: "pc", deviceTrustStatus: "trusted" } }
    };

    expect(resolveActiveDevice(mobileState, "financeControl").surface).toBe("mobile");
    expect(resolveCurrentSurface(mobileState, "financeControl")).toBe("mobile");
    expect(resolveActiveDevice(pcState, "financeControl").surface).toBe("pc");
    expect(resolveCurrentSurface(pcState, "financeControl")).toBe("pc");
  });
});
