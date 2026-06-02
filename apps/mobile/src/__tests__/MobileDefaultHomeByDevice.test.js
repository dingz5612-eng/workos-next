import { describe, expect, it } from "vitest";
import { defaultHomeForSession } from "../authController.js";

describe("OAM-04B mobile default home by device", () => {
  it("keeps PC-only roles on a mobile-accessible work plane after login", () => {
    const mobile = { currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" } };

    expect(defaultHomeForSession({ role: "finance" }, mobile)).toBe("home");
    expect(defaultHomeForSession({ role: "manager" }, mobile)).toBe("home");
    expect(defaultHomeForSession({ role: "admin" }, mobile)).toBe("home");
    expect(defaultHomeForSession({ role: "releaseOwner" }, mobile)).toBe("home");
  });
});
