import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { evaluateSurfaceAccess } from "../surfaceGuard.js";
import { createSurfaceCtx, source, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C mobile/PC surface boundary", () => {
  it("blocks ordinary mobile roles from PC release, governance, finance, and manager surfaces", () => {
    const ctx = createSurfaceCtx({ view: "releaseControl" });

    for (const view of ["releaseControl", "releaseFlightDeck", "pcGovernance", "governanceCenter", "financeControl", "financeReconciliation", "managerControlTower", "pcManager"]) {
      const decision = evaluateSurfaceAccess(view, ctx.state);
      expect(decision.allowed).toBe(false);
      expect(decision.component).toBe("PermissionDiagnostic");
    }

    const html = routeView(ctx);
    expect(html).toContain("权限诊断");
    expect(visibleText(html)).not.toContain("Release Control");
  });

  it("keeps PC route tree and PC APIs out of the ordinary mobile import path", () => {
    const appRouter = source("../appRouter.js");
    const apiClient = source("../apiClient.js");
    const pcApiClient = source("../pcApiClient.js");

    expect(appRouter).toContain("routePcSurface");
    expect(appRouter).toContain("isPcSurfaceView");
    expect(apiClient).not.toContain("confirmBankStatementImport");
    expect(apiClient).not.toContain("recordGovernanceAuditEvent");
    expect(apiClient).not.toContain("fetchReleaseControlCenter");
    expect(pcApiClient).toContain("confirmBankStatementImport");
    expect(pcApiClient).toContain("recordGovernanceAuditEvent");
  });

  it("uses structured admission fields for preview business-line blocking", () => {
    const ctx = createSurfaceCtx({
      view: "workspace",
      selectedWorkspace: "W-REPAIR-REQUEST",
      businessLineAdmission: {
        repair: {
          surfaceMode: "contract-preview",
          productionAllowed: true,
          productionConfirmAllowed: false
        }
      }
    });

    const decision = evaluateSurfaceAccess("workspace", ctx.state);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("business_line_admission_blocked");
  });

  it("does not use admission mode display text as a mobile surface decision source", () => {
    const admissionSurface = source("../admissionSurface.js");
    const surfaceGuard = source("../surfaceGuard.js");

    expect(admissionSurface).not.toContain("/L0|");
    expect(admissionSurface).not.toContain("/production/i.test");
    expect(surfaceGuard).not.toContain("/L0|Contract Preview/i");
    expect(surfaceGuard).toContain("surfaceMode");
    expect(surfaceGuard).toContain("productionAllowed");
  });
});
