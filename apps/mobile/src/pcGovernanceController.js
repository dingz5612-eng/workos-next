import {
  appendGovernanceExportAudit,
  buildGovernanceExportAuditEvent,
  markDeviceRevoked,
  validateGovernanceExportRequest
} from "./pcGovernancePolicies.js";
import { recordGovernanceAuditEvent } from "./apiClient.js";

export async function requestGovernanceExport(exportType, ctx) {
  const reason = document.querySelector(`[data-export-reason="${exportType}"]`)?.value || "";
  const device = currentDevice(ctx.state);
  const validation = validateGovernanceExportRequest({
    exportType,
    reason,
    actor: ctx.state.currentActor,
    device,
    state: ctx.state
  });
  const audit = buildGovernanceExportAuditEvent({
    exportType,
    reason,
    actor: ctx.state.currentActor,
    device
  }, validation);
  appendGovernanceExportAudit(ctx.state, audit);
  try {
    await recordGovernanceAuditEvent(audit, ctx.state.lang || "zh-CN");
  } catch {
    audit.persistenceStatus = "pending_retry";
  }
  ctx.state.operationMessage = validation.allowed
    ? `Export audited; URL expires at ${validation.expiresAtUtc}.`
    : `Export blocked: ${validation.errors.join(", ")}`;
  ctx.render();
}

export function revokeGovernanceDevice(deviceId, ctx) {
  const actorId = ctx.state.currentActor?.userId || ctx.state.currentActor?.actorId || "runtime";
  markDeviceRevoked(ctx.state, deviceId, actorId);
  ctx.state.operationMessage = `Device ${deviceId} revoked; high-risk actions are blocked.`;
  ctx.render();
}

function currentDevice(state) {
  const governance = state.pcGovernance || {};
  return governance.currentDevice ||
    (governance.deviceSessions || []).find((session) => session.actorId === state.currentActor?.userId) ||
    { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" };
}
