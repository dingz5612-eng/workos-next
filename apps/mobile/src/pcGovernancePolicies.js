export const pcGovernanceNavItems = [
  "Dashboard",
  "Production Observability",
  "Work Management",
  "Objects",
  "Cases",
  "Ledgers",
  "Evidence Review",
  "Reconciliation",
  "Correction Center",
  "Period Review",
  "RiskCommand",
  "Admin",
  "Audit",
  "Export",
  "Release Control Center"
];

export const governanceExportDefinitions = [
  { key: "ledger", label: "Ledger export", capability: "pc.export.ledger", highRisk: true },
  { key: "caseTimeline", label: "Case timeline export", capability: "pc.export.case_timeline", highRisk: false },
  { key: "evidenceAudit", label: "Evidence audit export", capability: "pc.export.evidence_audit", highRisk: true },
  { key: "periodSnapshot", label: "Period snapshot export", capability: "pc.export.period_snapshot", highRisk: true }
];

export function canEditRoleCapability(state) {
  const actor = state?.currentActor || {};
  return hasAnyCapability(actor, state, ["admin.role_capability.edit", "pc.governance.admin"]) ||
    String(actor.role || "").toLowerCase() === "admin";
}

export function canRevokeDevice(state) {
  const actor = state?.currentActor || {};
  return hasAnyCapability(actor, state, ["admin.device_session.revoke", "pc.governance.admin"]) ||
    String(actor.role || "").toLowerCase() === "admin";
}

export function deviceCanPerformHighRiskAction(device) {
  if (!device || isDeviceRevoked(device)) return false;
  return normalized(device.deviceTrustStatus || device.trustStatus || device.deviceTrust) === "trusted" &&
    normalized(device.surface || device.deviceType || device.clientType || "pc") === "pc";
}

export function validateGovernanceExportRequest(request) {
  const definition = governanceExportDefinitions.find((item) => item.key === request.exportType);
  const actor = request.actor || {};
  const state = request.state || {};
  const reason = String(request.reason || "").trim();
  const errors = [];

  if (!definition) {
    errors.push("EXPORT_TYPE_UNKNOWN");
  }

  if (!reason) {
    errors.push("EXPORT_REASON_REQUIRED");
  }

  if (definition && !hasAnyCapability(actor, state, [definition.capability, "pc.export.all", "pc.governance.admin"])) {
    errors.push("EXPORT_CAPABILITY_REQUIRED");
  }

  if (definition?.highRisk && !deviceCanPerformHighRiskAction(request.device)) {
    errors.push("TRUSTED_PC_REQUIRED");
  }

  const now = request.now instanceof Date ? request.now : new Date(request.now || Date.now());
  const expiresAtUtc = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  return {
    allowed: errors.length === 0,
    errors,
    exportType: request.exportType,
    label: definition?.label || request.exportType,
    reason,
    expiresAtUtc,
    highRisk: Boolean(definition?.highRisk),
    downloadUrl: `/api/pc-governance/exports/${encodeURIComponent(request.exportType || "unknown")}/download?expiresAtUtc=${encodeURIComponent(expiresAtUtc)}`
  };
}

export function buildGovernanceExportAuditEvent(request, validation) {
  const now = request.now instanceof Date ? request.now : new Date(request.now || Date.now());
  const actor = request.actor || {};
  const device = request.device || {};
  return {
    auditEventId: `export-audit-${stableToken([
      request.exportType,
      actor.userId || actor.actorId || "actor",
      validation.expiresAtUtc,
      validation.reason
    ].join("|"))}`,
    auditType: "export",
    eventType: "PCGovernanceExportRequested",
    exportType: request.exportType,
    status: validation.allowed ? "accepted" : "blocked",
    reason: validation.reason,
    errors: validation.errors,
    actorId: actor.userId || actor.actorId || "",
    deviceId: device.deviceId || "",
    deviceTrustStatus: device.deviceTrustStatus || device.trustStatus || "",
    surface: device.surface || device.deviceType || "pc",
    downloadUrl: validation.allowed ? validation.downloadUrl : "",
    expiresAtUtc: validation.expiresAtUtc,
    occurredAtUtc: now.toISOString()
  };
}

export function appendGovernanceExportAudit(state, auditEvent) {
  const current = state.pcGovernance || {};
  state.pcGovernance = {
    ...current,
    exportAudits: [auditEvent, ...(current.exportAudits || [])],
    exports: auditEvent.status === "accepted"
      ? [auditEvent, ...(current.exports || [])]
      : (current.exports || [])
  };
  return state.pcGovernance;
}

export function markDeviceRevoked(state, deviceId, actorId = "") {
  const current = state.pcGovernance || {};
  const sessions = (current.deviceSessions || []).map((session) =>
    session.deviceId === deviceId
      ? { ...session, deviceTrustStatus: "revoked", revokedAtUtc: new Date().toISOString(), revokedBy: actorId }
      : session);
  const audit = {
    auditEventId: `device-revoke-${stableToken(`${deviceId}|${actorId}|${sessions.length}`)}`,
    auditType: "device_session",
    eventType: "DeviceSessionRevoked",
    actorId,
    deviceId,
    occurredAtUtc: new Date().toISOString()
  };
  state.pcGovernance = {
    ...current,
    deviceSessions: sessions,
    evidenceAccessAudits: [audit, ...(current.evidenceAccessAudits || [])]
  };
  return state.pcGovernance;
}

function hasAnyCapability(actor, state, required) {
  const values = [
    ...(actor.capabilities || []),
    ...(state?.pcGovernance?.capabilities || []),
    ...(state?.capabilities || [])
  ].map((item) => String(item).toLowerCase());
  const set = new Set(values);
  return required.some((item) => set.has(String(item).toLowerCase()));
}

function isDeviceRevoked(device) {
  return normalized(device.deviceTrustStatus || device.trustStatus || device.deviceTrust) === "revoked" ||
    Boolean(device.revokedAtUtc);
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function stableToken(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(16);
}
