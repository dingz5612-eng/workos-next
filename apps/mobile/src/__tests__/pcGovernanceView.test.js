import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeView } from "../appRouter.js";
import {
  appendGovernanceExportAudit,
  buildGovernanceExportAuditEvent,
  canEditRoleCapability,
  deviceCanPerformHighRiskAction,
  markDeviceRevoked,
  pcGovernanceNavItems,
  validateGovernanceExportRequest
} from "../pcGovernancePolicies.js";
import { pcGovernanceView } from "../views/pcGovernanceView.js";

describe("PC Governance Full", () => {
  it("pc_governance_navigation_loads", () => {
    const html = routeView(ctx());

    expect(html).toContain("data-pc-governance-full");
    expect(html).toContain("data-pc-governance-nav");
    for (const item of pcGovernanceNavItems) {
      expect(html).toContain(item);
    }
    expect(html).toContain("Dashboard");
    expect(html).toContain("Production Observability");
    expect(html).toContain("Work Management");
    expect(html).toContain("Release Control Center");
  });

  it("role_capability_admin_guarded", () => {
    const guarded = ctx({
      currentActor: { userId: "auditor-1", role: "auditor", capabilities: ["pc.export.ledger"] }
    });
    const guardedHtml = pcGovernanceView(guarded);

    expect(canEditRoleCapability(guarded.state)).toBe(false);
    expect(guardedHtml).toContain("admin.role_capability.edit");
    expect(guardedHtml).toContain("data-role-capability-edit disabled");

    const allowed = ctx({
      currentActor: { userId: "admin-1", role: "admin", capabilities: ["admin.role_capability.edit"] }
    });
    expect(canEditRoleCapability(allowed.state)).toBe(true);
    expect(pcGovernanceView(allowed)).not.toContain("data-role-capability-edit disabled");
  });

  it("ledger_export_requires_capability_and_reason", () => {
    const state = ctx({
      currentActor: { userId: "viewer-1", role: "viewer", capabilities: [] }
    }).state;
    const result = validateGovernanceExportRequest({
      exportType: "ledger",
      reason: "",
      actor: state.currentActor,
      device: state.pcGovernance.currentDevice,
      state,
      now: new Date("2026-05-30T00:00:00Z")
    });
    const html = pcGovernanceView({ ...ctx({ currentActor: state.currentActor }), state });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("EXPORT_REASON_REQUIRED");
    expect(result.errors).toContain("EXPORT_CAPABILITY_REQUIRED");
    expect(html).toContain("Ledger export");
    expect(html).toContain("data-governance-export=\"ledger\" disabled");
  });

  it("export_generates_audit_event", () => {
    const testCtx = ctx();
    const validation = validateGovernanceExportRequest({
      exportType: "ledger",
      reason: "monthly finance review",
      actor: testCtx.state.currentActor,
      device: testCtx.state.pcGovernance.currentDevice,
      state: testCtx.state,
      now: new Date("2026-05-30T00:00:00Z")
    });
    const audit = buildGovernanceExportAuditEvent({
      exportType: "ledger",
      reason: "monthly finance review",
      actor: testCtx.state.currentActor,
      device: testCtx.state.pcGovernance.currentDevice,
      now: new Date("2026-05-30T00:00:00Z")
    }, validation);
    appendGovernanceExportAudit(testCtx.state, audit);
    const html = pcGovernanceView(testCtx);

    expect(validation.allowed).toBe(true);
    expect(audit.eventType).toBe("PCGovernanceExportRequested");
    expect(audit.status).toBe("accepted");
    expect(audit.reason).toBe("monthly finance review");
    expect(audit.downloadUrl).toContain("expiresAtUtc=");
    expect(audit.expiresAtUtc).toBe("2026-05-30T00:15:00.000Z");
    expect(html).toContain("PCGovernanceExportRequested");
    expect(html).toContain("monthly finance review");

    const root = repoRoot();
    const apiClient = readFileSync(resolve(root, "apps/mobile/src/apiClient.js"), "utf8");
    const controller = readFileSync(resolve(root, "apps/mobile/src/pcGovernanceController.js"), "utf8");
    expect(apiClient).toContain("recordGovernanceAuditEvent");
    expect(apiClient).toContain("runtimeApiPaths.behaviorEvents");
    expect(apiClient).toContain("fetchProductionObservability");
    expect(apiClient).toContain("runtimeApiPaths.observability");
    expect(controller).toContain("await recordGovernanceAuditEvent");
  });

  it("release_control_center_visible", () => {
    const html = pcGovernanceView(ctx());

    expect(html).toContain("Release Control Center");
    expect(html).toContain("MR-10");
    expect(html).toContain("GateResult status");
    expect(html).toContain("Open Release Control Center");
  });

  it("production_observability_panel_shows_required_metrics", () => {
    const html = pcGovernanceView(ctx());

    expect(html).toContain("data-production-observability");
    expect(html).toContain("confirm latency p95");
    expect(html).toContain("403 / 409 / 422 count");
    expect(html).toContain("dead-letter count");
    expect(html).toContain("projection lag");
    expect(html).toContain("WorkItemBundle p95");
    expect(html).toContain("paymentConfirmWithoutEvidenceViolations");
    expect(html).toContain("availableRefundNegativeCount");
    expect(html).toContain("fakeCloseAttempts");
    expect(html).toContain("redShadowReports");
  });

  it("device_revoke_blocks_high_risk_actions", () => {
    const testCtx = ctx();
    expect(deviceCanPerformHighRiskAction(testCtx.state.pcGovernance.currentDevice)).toBe(true);

    markDeviceRevoked(testCtx.state, "pc-device-1", "admin-1");
    testCtx.state.pcGovernance.currentDevice = testCtx.state.pcGovernance.deviceSessions[0];
    const result = validateGovernanceExportRequest({
      exportType: "ledger",
      reason: "post-revoke export",
      actor: testCtx.state.currentActor,
      device: testCtx.state.pcGovernance.currentDevice,
      state: testCtx.state
    });
    const html = pcGovernanceView(testCtx);

    expect(deviceCanPerformHighRiskAction(testCtx.state.pcGovernance.currentDevice)).toBe(false);
    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("TRUSTED_PC_REQUIRED");
    expect(html).toContain("revoked");
    expect(html).toContain("blocked");
    expect(html).toContain("data-governance-export=\"ledger\" disabled");
  });
});

function ctx(overrides = {}) {
  const state = {
    view: "pcGovernance",
    currentActor: { userId: "admin-1", role: "admin", capabilities: ["admin.role_capability.edit", "admin.device_session.revoke", "pc.export.ledger", "pc.export.evidence_audit", "pc.export.period_snapshot"] },
    pcGovernance: {
      roleCapabilities: [{ role: "finance", capability: "payment.confirm", effect: "allow", source: "seed" }],
      featureFlags: [{ flagKey: "pc.governance_full.enabled", status: "pilot", scope: "tenant-1" }],
      sliceCutoverStates: [{ sliceId: "PCGovernance", runtimeMode: "pilot", tenantId: "tenant-1", dependencyStatus: "green" }],
      definitionVersions: [{ definitionVersion: "v5.4", contractHash: "hash-1", status: "active", activatedAtUtc: "2026-05-30T00:00:00Z" }],
      deviceSessions: [{ deviceId: "pc-device-1", actorId: "admin-1", deviceTrustStatus: "trusted", surface: "pc" }],
      currentDevice: { deviceId: "pc-device-1", actorId: "admin-1", deviceTrustStatus: "trusted", surface: "pc" },
      evidenceAccessAudits: [{ auditEventId: "evidence-audit-1", eventType: "EvidenceSignedUrlViewed", actorId: "finance-1", deviceId: "pc-device-1", occurredAtUtc: "2026-05-30T01:00:00Z" }],
      domainEvents: [{ eventId: "evt-1", eventType: "Accommodation.PaymentConfirmed", actorId: "finance-1", occurredAtUtc: "2026-05-30T01:00:00Z" }],
      commandSubmissions: [{ submissionId: "sub-1", workItemId: "wi-1", status: "committed", idempotencyKey: "idem-1" }],
      releaseControlAudits: [{ auditEventId: "gate-1", eventType: "GateResultGenerated", releaseId: "rel-10", occurredAtUtc: "2026-05-30T01:00:00Z" }],
      correctionAudit: [{ auditEventId: "corr-audit-1", operationName: "correction.apply", status: "applied", recordedAtUtc: "2026-05-30T01:00:00Z" }],
      periodReviews: [{ periodReviewId: "period-1", periodKey: "2026-05", status: "open", sourceHighWatermark: "evt-1" }],
      ledgerSummaries: [{ ledger: "payment", status: "verified", refs: "pay-1", amount: 1200 }],
      capabilities: [],
      productionObservability: {
        productionMetrics: {
          generatedAtUtc: "2026-05-30T02:30:00Z",
          runtime: {
            confirmLatencyP95Ms: 42,
            confirmLatencySampleCount: 12,
            confirmFailureCount: 3,
            idempotencyConflictCount: 1,
            forbiddenCount403: 1,
            conflictCount409: 1,
            validationCount422: 1,
            handlerFailureCount: 0
          },
          outbox: { outboxLagSeconds: 8, deadLetterCount: 2, replayCount: 4 },
          projection: { projectionLagSeconds: 7, rebuildCount: 5, staleLensCount: 1 },
          mobile: { workItemBundleP95Ms: 110, workItemBundleSampleCount: 9, uploadFailureCount: 1, submitRetryCount: 2, draftRecoveryCount: 3 },
          money: { paymentConfirmWithoutEvidenceViolations: 0, allocationOverAvailableViolations: 0, stayBalanceMismatchCount: 0 },
          deposit: { availableRefundNegativeCount: 0, refundFailedDoubleCount: 0, heldAmountNegativeCount: 0 },
          checkout: { openBlockers: 2, duplicateBlockers: 0, fakeCloseAttempts: 0 },
          controlPlane: { gateResultStatus: "warning", redShadowReports: 0, blockingInvariantFailures: 0, releaseState: "pilot" }
        }
      },
      exports: [],
      exportAudits: []
    },
    releaseControl: {
      selectedRelease: {
        overview: { releaseId: "rel-10", mrId: "MR-10", gateResultStatus: "warning", shadowGrade: "green" },
        gateResult: { gateResultId: "gate-10", status: "warning", generatedAtUtc: "2026-05-30T02:00:00Z" },
        shadowReports: [{ shadowCompareReportId: "shadow-10", grade: "green" }],
        rollbackInstruction: { rollbackInstructionId: "rollback-10", createdAtUtc: "2026-05-30T02:00:00Z" }
      }
    },
    bankStatementImport: {
      candidates: { candidates: [{ candidateId: "cand-1", candidateType: "payment", paymentId: "pay-1", score: 0.9, reason: "same_amount" }] },
      mismatchCases: { cases: [{ caseId: "rcase-1", mismatchType: "amount_mismatch", ownerRole: "finance", blockerSeverity: "P1" }] },
      correctionRequests: [{ correctionRequestId: "corr-1", targetLedgerType: "payment", correctionType: "allocation_reversal", riskLevel: "high", status: "pending" }],
      operationAudit: [{ auditEventId: "corr-audit-1", operationName: "correction.request", status: "requested", recordedAtUtc: "2026-05-30T02:00:00Z" }]
    },
    runtimeStore: {
      workQueue: [{ workItemId: "wi-1", title: "Review payment", status: "ready", assignedRole: "finance", dueAtUtc: "2026-05-31T00:00:00Z" }],
      accommodationLenses: {
        "risk-command": [{
          riskId: "risk-1",
          riskType: "debt_risk",
          severity: "P1",
          ownerRole: "finance",
          resolveAction: "createBalanceCloseWorkItem",
          drilldownUrl: "/pc/risk/risk-1",
          relatedLedgerRefs: ["stay-balance:stay-1"]
        }]
      }
    },
    ...overrides
  };
  return {
    state,
    shell: (content) => content,
    escapeHtml: escape,
    escapeAttr: escape
  };
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function repoRoot() {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (readFileExists(resolve(current, "WorkOSNext.sln"))) return current;
    current = resolve(current, "..");
  }
  throw new Error("Could not locate repo root");
}

function readFileExists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
