import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { shell } from "../appShell.js";
import { actionResultStateMatrix, defaultHomeForRole, evidenceStateMatrix, mobileBottomNavigation } from "../experienceContract.js";
import { confirmSuccessMessage } from "../operationController.js";

describe("RT-5 Experience Contract", () => {
  it("keeps ordinary operator mobile bottom nav to Today Work Search Me", () => {
    vi.stubGlobal("window", { location: { protocol: "http:", hostname: "localhost", port: "5173", origin: "http://localhost:5173" } });
    vi.stubGlobal("localStorage", { getItem: () => null });
    const html = shell("<section></section>", ctx({ role: "operator" }));

    expect(mobileBottomNavigation).toEqual(["home", "workbench", "search", "me"]);
    expect(html).toContain("Today");
    expect(html).toContain("Work");
    expect(html).toContain("Search");
    expect(html).toContain("Me");
    expect(html).not.toContain("releaseControl");
    expect(html).not.toContain("Release Control");
    vi.unstubAllGlobals();
  });

  it("maps role default homes to control surfaces", () => {
    expect(defaultHomeForRole("finance")).toBe("financeControl");
    expect(defaultHomeForRole("manager")).toBe("managerControlTower");
    expect(defaultHomeForRole("releaseOwner")).toBe("releaseFlightDeck");
  });

  it("hydrates Work from operations work-items and leaves work queue lens out of the main path", () => {
    const main = source("../main.js");

    expect(main).toContain("fetchOperationWorkItems");
    expect(main).not.toContain("fetchWorkQueue");
  });

  it("uses operations prepare and confirm for Operation Panel main submit path", () => {
    const runtime = source("../operationRuntime.js");
    const controller = source("../operationController.js");

    expect(runtime).toContain("prepareOperationWorkItem");
    expect(runtime).toContain("confirmOperationWorkItem");
    expect(controller).toContain("submitWorkItemOperation");
    expect(controller).not.toContain("submitCardOperation({");
  });

  it("keeps prepareCard and confirmCard only in compatibility fallback", () => {
    const runtime = source("../operationRuntime.js");

    expect(runtime).toContain("submitCardOperationCompatibilityFallback");
    expect(runtime).toContain("prepareCard");
    expect(runtime).toContain("confirmCard");
  });

  it("defines differentiated blocked and pending states", () => {
    expect(actionResultStateMatrix.permission_blocked_403).toBe("PermissionDiagnostic");
    expect(actionResultStateMatrix.idempotency_conflict_409).toContain("duplicate");
    expect(actionResultStateMatrix.business_blocked_422).toContain("next action");
    expect(confirmSuccessMessage({ confirmed: true, commitStatus: "committed", projectionStatus: "pending" }, ctx())).toBe("submitProjectionPending");
  });

  it("blocks confirm for missing or rejected evidence and allows offline draft only", () => {
    expect(evidenceStateMatrix.missing).toBe("blocks confirm");
    expect(evidenceStateMatrix.rejected).toBe("blocks confirm");
    expect(evidenceStateMatrix.draft).toBe("can save draft");
  });
});

function ctx(actor = { role: "operator" }) {
  return {
    state: {
      view: "home",
      apiStatus: "online",
      currentActor: { displayName: "Operator", ...actor },
      lang: "zh-CN"
    },
    tr: (key) => ({
      app: "WorkOSNext",
      subtitle: "subtitle",
      language: "language",
      zh: "zh",
      ru: "ru",
      today: "Today",
      work: "Work",
      search: "Search",
      me: "Me",
      apiOnline: "online",
      apiChecking: "checking",
      apiOffline: "offline",
      retryApi: "retry",
      feedback: "feedback",
      submitProjectionPending: "submitProjectionPending"
    })[key] || key
  };
}

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
