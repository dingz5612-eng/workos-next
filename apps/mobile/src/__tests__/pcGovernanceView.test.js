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
import { accountCapabilityOptions, accountRoleOptions } from "../accountGovernanceCatalog.js";
import { pcGovernanceView } from "../views/pcGovernanceView.js";

describe("PC Governance Full", () => {
  it("pc_governance_navigation_loads", () => {
    const html = routeView(ctx());
    const root = repoRoot();
    const css = readFileSync(resolve(root, "apps/mobile/src/styles/pc-governance.css"), "utf8");

    expect(html).toContain("data-pc-governance-full");
    expect(html).toContain("data-pc-governance-nav");
    for (const item of pcGovernanceNavItems) {
      expect(html).toContain(item);
    }
    expect(html).toContain("总览");
    expect(html).toContain("生产观测");
    expect(html).toContain("Lens 健康");
    expect(html).toContain("办理管理");
    expect(html).toContain("发布工作区");
    expect(html).toContain("data-governance-nav-group=\"read\"");
    expect(html).toContain("data-governance-nav-group=\"admin\"");
    expect(html).toContain("data-governance-section-mode=\"read\"");
    expect(html).toContain("data-governance-section-mode=\"admin\"");
    expect(html).toContain("data-governance-help");
    expect(html).toContain("能做什么");
    expect(html).toContain("不能做什么");
    expect(html).toContain("权限与证据");
    expect(css).toContain("position: sticky");
    expect(css).toContain(".pc-governance-nav-group");
    expect(css).toContain(".governance-help");
    expect(css).toContain(".pc-governance-full[data-pc-governance-full] .governance-panel:target");
    expect(css).toContain(".governance-panel.is-active-section");
    expect(css).toContain("governance-grid:not(:has(.governance-panel:target))");
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
    expect(html).toContain("账务导出");
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
    const apiClient = readFileSync(resolve(root, "apps/mobile/src/pcApiClient.js"), "utf8");
    const controller = readFileSync(resolve(root, "apps/mobile/src/pcGovernanceController.js"), "utf8");
    expect(apiClient).toContain("recordGovernanceAuditEvent");
    expect(apiClient).toContain("runtimeApiPaths.behaviorEvents");
    expect(apiClient).toContain("fetchProductionObservability");
    expect(apiClient).toContain("runtimeApiPaths.observability");
    expect(controller).toContain("await recordGovernanceAuditEvent");
  });

  it("release_control_center_visible", () => {
    const html = pcGovernanceView(ctx());

    expect(html).toContain("发布工作区");
    expect(html).toContain("RR-10");
    expect(html).toContain("GateResult 状态");
    expect(html).toContain("发布证据链");
    expect(html).toContain("GateResult");
    expect(html).toContain("Invariant");
    expect(html).toContain("ShadowCompare");
    expect(html).toContain("RollbackInstruction");
    expect(html).toContain("打开发布工作区");
  });

  it("lens_health_shows_projection_source_and_degraded_reason", () => {
    const html = pcGovernanceView(ctx());

    expect(html).toContain("Lens 健康");
    expect(html).toContain("来源命名空间");
    expect(html).toContain("投影延迟秒数");
    expect(html).toContain("最后事件");
    expect(html).toContain("降级原因");
    expect(html).toContain("official_runtime");
    expect(html).toContain("projection_lag_exceeds_1h");
  });

  it("production_observability_panel_shows_required_metrics", () => {
    const html = pcGovernanceView(ctx());

    expect(html).toContain("data-production-observability");
    expect(html).toContain("确认延迟 p95");
    expect(html).toContain("403 / 409 / 422 次数");
    expect(html).toContain("死信数量");
    expect(html).toContain("Projection 延迟");
    expect(html).toContain("WorkItemBundle p95");
    expect(html).toContain("缺证据确认付款违规");
    expect(html).toContain("可退金额为负次数");
    expect(html).toContain("虚假关闭尝试");
    expect(html).toContain("红色 Shadow 报告数");
  });

  it("risk_command_renders_operator_cards_instead_of_technical_url_table", () => {
    const html = pcGovernanceView(ctx());
    const text = visibleText(html);

    expect(html).toContain("risk-command-card");
    expect(html).toContain('data-risk-id="risk-1"');
    expect(text).toContain("在住欠款风险");
    expect(text).toContain("影响");
    expect(text).toContain("负责人");
    expect(text).toContain("建议动作");
    expect(text).toContain("进入处理");
    expect(text).not.toContain("风险编号");
    expect(text).not.toContain("详情入口");
    expect(text).not.toContain("/pc/risk/risk-1");
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
    expect(html).toContain("阻断");
    expect(html).toContain("data-governance-export=\"ledger\" disabled");
  });

  it("account_user_management_uses_governed_role_and_capability_controls", () => {
    const html = pcGovernanceView(ctx());
    const root = repoRoot();
    const controller = readFileSync(resolve(root, "apps/mobile/src/pcGovernanceController.js"), "utf8");

    expect(html).toContain("data-account-role-select");
    expect(html).toContain("data-account-capability");
    expect(html).toContain("account-capability-grid");
    expect(html).toContain("operations.confirm");
    expect(accountRoleOptions.map((item) => item.value)).toContain("operator");
    expect(accountCapabilityOptions.map((item) => item.value)).toContain("account.user.manage");
    expect(html).not.toContain("<input id=\"accountRoles\"");
    expect(html).not.toContain("id=\"accountCapabilities\"");
    expect(controller).toContain("capabilitiesForAccountRole");
    expect(controller).not.toContain("splitCsv");
  });

  it("account_user_actions_are_locked_against_duplicate_submits", () => {
    const testCtx = ctx();
    testCtx.state.pcGovernance.accountUsers = [{
      userId: "u-1",
      username: "audited-operator",
      displayName: "Audited Operator",
      department: "住宿运营部",
      businessLine: "stay",
      roles: ["operator"],
      capabilities: ["operations.confirm"],
      status: "active"
    }];
    testCtx.state.pcGovernanceActionLocks = {
      accountUserCreate: true,
      "accountPasswordReset:u-1": true,
      "accountUserDisable:u-1": true
    };
    const html = pcGovernanceView(testCtx);

    expect(html).toContain("data-account-user-create disabled");
    expect(html).toContain("正在创建...");
    expect(html).toContain("data-account-password-reset=\"u-1\" disabled");
    expect(html).toContain("重置中...");
    expect(html).toContain("data-account-user-disable=\"u-1\" disabled");
    expect(html).toContain("禁用中...");
  });

  it("account_user_form_renders_from_draft_state", () => {
    const testCtx = ctx({
      pcGovernanceAccountDraft: {
        username: "draft-user",
        displayName: "草稿用户",
        password: "DraftPassword123",
        department: "住宿运营部",
        businessLine: "stay",
        role: "manager",
        capabilities: ["operations.confirm", "account.user.manage"]
      }
    });
    const html = pcGovernanceView(testCtx);

    expect(html).toContain("value=\"draft-user\"");
    expect(html).toContain("value=\"草稿用户\"");
    expect(html).toContain("value=\"DraftPassword123\"");
    expect(html).toContain("data-account-draft-field=\"username\"");
    expect(html).toContain("data-account-draft-field=\"role\"");
    expect(html).toContain("value=\"manager\" selected");
    expect(html).toContain("value=\"account.user.manage\" checked");
  });

  it("pc_event_binding_is_generation_guarded_and_idempotent", () => {
    const root = repoRoot();
    const eventBinder = readFileSync(resolve(root, "apps/mobile/src/eventBinder.js"), "utf8");
    const pcEventBinder = readFileSync(resolve(root, "apps/mobile/src/pcEventBinder.js"), "utf8");
    const controller = readFileSync(resolve(root, "apps/mobile/src/pcGovernanceController.js"), "utf8");

    expect(eventBinder).toContain("currentBindPass !== bindPass");
    expect(pcEventBinder).toContain("const boundPcEvents = new WeakMap()");
    expect(pcEventBinder).toContain("function bindOnce");
    expect(pcEventBinder).toContain("syncGovernanceNavigationState");
    expect(pcEventBinder).toContain("is-active-section");
    expect(pcEventBinder).toContain("bindAccountDraftEvents");
    expect(pcEventBinder).toContain("updateGovernanceAccountDraft");
    expect(controller).toContain("pcGovernanceActionLocks");
    expect(controller).toContain("isGovernanceActionLocked");
    expect(controller).toContain("currentAccountUserDraft");
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
      definitionVersions: [{ definitionVersion: "oam.current", contractHash: "hash-1", status: "active", activatedAtUtc: "2026-05-30T00:00:00Z" }],
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
        overview: { releaseId: "rel-10", mrId: "RR-10", gateResultStatus: "warning", shadowGrade: "green" },
        gateResult: {
          gateResultId: "gate-10",
          status: "warning",
          severity: "P1",
          generatedAtUtc: "2026-05-30T02:00:00Z",
          invariantCheckRefs: ["inv-10"],
          shadowCompareReportRefs: ["shadow-10"],
          businessSignoffRefs: []
        },
        shadowReports: [{ shadowCompareReportId: "shadow-10", grade: "green", mismatchCount: 0, ciRunId: "ci-10" }],
        invariantChecks: [{ invariantCheckId: "inv-10", invariantKey: "runtime.no_shadow", status: "passed", severity: "P0", checkRef: "runtime-write-path" }],
        rollbackInstruction: { rollbackInstructionId: "rollback-10", instructionType: "rollback", riskLevel: "high", steps: ["disable flag"], validationSteps: ["rerun gate"], createdAtUtc: "2026-05-30T02:00:00Z" }
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
          lens: "RiskCommandLens",
          riskId: "risk-1",
          riskType: "debt_risk",
          severity: "P1",
          ownerRole: "finance",
          resolveAction: "createBalanceCloseWorkItem",
          drilldownUrl: "/pc/risk/risk-1",
          relatedLedgerRefs: ["stay-balance:stay-1"],
          sourceNamespace: "official_runtime",
          projectionLagSeconds: 7200,
          lastEventId: "evt-risk-1",
          degradedReason: "projection_lag_exceeds_1h"
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

function visibleText(value) {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
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
