import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { shell } from "../appShell.js";
import {
  actionResultStateMatrix,
  defaultHomeForRole,
  evidenceStateMatrix,
  mobileBottomNavigation,
  workItemCardSchema
} from "../experienceContract.js";
import { confirmSuccessMessage } from "../operationController.js";
import { evaluateSurfaceAccess } from "../surfaceGuard.js";
import {
  ActionResult,
  DeviceTrustPanel,
  EvidenceSheet,
  EvidenceTile,
  LifecycleWorkspace,
  PermissionDiagnostic,
  SubmitQueue,
  UploadQueue,
  WorkItemCard
} from "../views/experienceComponents.js";

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

  it("renders WorkItemCard with every contract field", () => {
    const html = WorkItemCard({
      workItemId: "WI-1",
      caseId: "CASE-1",
      workItemType: "Dormitory.CheckIn",
      lifecycleState: "ready",
      ownerRole: "frontdesk",
      SLA: "PT4H",
      requiredEvidence: ["id-card", "deposit-receipt"],
      nextAction: "confirm check-in",
      traceRefs: ["cmd-1"],
      riskLevel: "P1",
      evidenceState: "missing",
      dueAt: "2026-06-02T09:00:00Z",
      businessObject: "Stay ST-1"
    }, ctx());

    expect(html).toContain('data-component="WorkItemCard"');
    for (const field of workItemCardSchema) {
      expect(html).toContain(field);
    }
  });

  it("renders lifecycle workspace as the main object workspace", () => {
    const workspace = workspaceFixture();
    const html = LifecycleWorkspace(workspace, workspace.cards[0], ctx());

    expect(html).toContain('data-component="LifecycleWorkspace"');
    expect(html).toContain("Object summary");
    expect(html).toContain("Lifecycle timeline");
    expect(html).toContain("Current WorkItem");
    expect(html).toContain("Required evidence");
    expect(html).toContain("Audit summary");
  });

  it("renders trusted result, evidence, queue, device trust, and permission states", () => {
    const workspace = workspaceFixture();
    const activeCard = workspace.cards[0];
    const testCtx = ctx();

    expect(ActionResult({ status: "committed_projection_pending" }, testCtx)).toContain('data-component="ProjectionPendingState"');
    expect(ActionResult({ status: "committed_projection_failed" }, testCtx)).toContain('data-component="FailedSyncState"');
    expect(EvidenceTile(activeCard.evidence[0], {}, "", testCtx)).toContain('data-component="EvidenceTile"');
    expect(EvidenceSheet(activeCard, {}, testCtx)).toContain('data-component="EvidenceSheet"');
    expect(UploadQueue({}, testCtx)).toContain('data-component="UploadQueue"');
    expect(SubmitQueue({}, testCtx)).toContain('data-component="SubmitQueue"');
    expect(DeviceTrustPanel({ pcGovernance: { currentDevice: { deviceId: "D-1", deviceTrustStatus: "trusted", surface: "mobile" } } }, testCtx)).toContain('data-component="DeviceTrustPanel"');
    expect(PermissionDiagnostic({ reason: "role_surface_not_allowed", owner: "releaseOwner", requiredPermission: "release.flight_deck.view" }, testCtx)).toContain("release.flight_deck.view");
  });

  it("blocks unauthorized release surfaces with PermissionDiagnostic data", () => {
    const decision = evaluateSurfaceAccess("releaseFlightDeck", {
      currentActor: { role: "operator", displayName: "Operator" },
      pcGovernance: { currentDevice: { deviceTrustStatus: "trusted", surface: "mobile" } }
    });

    expect(decision.allowed).toBe(false);
    expect(decision.component).toBe("PermissionDiagnostic");
    expect(decision.owner).toBe("releaseOwner");
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
    })[key] || key,
    tx: (value) => typeof value === "string" ? value : value["zh-CN"],
    localTerm: (value) => value?.label?.["zh-CN"] || value?.id || value,
    escapeHtml: (value) => String(value),
    escapeAttr: (value) => String(value)
  };
}

function workspaceFixture() {
  return {
    id: "W-DORM-STAY",
    domain: "stay",
    taskId: "WI-STAY-1",
    caseId: "CASE-STAY-1",
    title: { "zh-CN": "入住办理", "ru-RU": "Заселение" },
    summary: { "zh-CN": "对象生命周期摘要", "ru-RU": "Сводка" },
    next: { "zh-CN": "确认入住", "ru-RU": "Подтвердить" },
    cards: [{
      id: "checkIn",
      status: "ready",
      title: { "zh-CN": "确认入住", "ru-RU": "Подтвердить" },
      fields: { business: [{ id: "stayId", label: { "zh-CN": "住宿单" } }] },
      evidence: [{ id: "identityEvidence", label: { "zh-CN": "身份证据" } }],
      blockerRules: [],
      confirmation: { requiredRole: "frontdesk" }
    }]
  };
}

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
