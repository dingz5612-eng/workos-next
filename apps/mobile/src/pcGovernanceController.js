import {
  appendGovernanceExportAudit,
  buildGovernanceExportAuditEvent,
  markDeviceRevoked,
  validateGovernanceExportRequest
} from "./pcGovernancePolicies.js";
import {
  createAccountUser,
  disableAccountUser,
  fetchAccountAudit,
  fetchAccountUsers,
  recordGovernanceAuditEvent,
  resetAccountUserPassword,
  revokeRuntimeDeviceSession
} from "./pcApiClient.js";
import { capabilitiesForAccountRole } from "./accountGovernanceCatalog.js";

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
  void revokeRuntimeDeviceSession(deviceId).catch(() => {
    ctx.state.operationMessage = `Device ${deviceId} revoke is pending backend retry.`;
  });
  ctx.state.operationMessage = `Device ${deviceId} revoked; high-risk actions are blocked.`;
  ctx.render();
}

export async function createGovernanceAccountUser(ctx) {
  const lockKey = "accountUserCreate";
  if (isGovernanceActionLocked(ctx, lockKey)) return;
  setGovernanceActionLocked(ctx, lockKey, true);
  const draft = currentAccountUserDraft(ctx);
  const role = value("[data-account-role-select]", draft.role || "operator");
  const capabilities = selectedAccountCapabilities(role, draft);
  const body = {
    username: value("#accountUsername", draft.username),
    displayName: value("#accountDisplayName", draft.displayName),
    password: value("#accountPassword", draft.password),
    tenantId: ctx.state.currentActor?.tenantId || "tenant-1",
    department: value("#accountDepartment", draft.department || "住宿运营部"),
    businessLine: value("#accountBusinessLine", draft.businessLine || "stay"),
    roles: [role],
    capabilities,
    status: "active"
  };
  ctx.state.operationMessage = "正在创建用户...";
  ctx.render();
  try {
    const created = await createAccountUser(body);
    await refreshAccountGovernance(ctx);
    ctx.state.pcGovernanceAccountDraft = {
      ...currentAccountUserDraft(ctx),
      username: "",
      displayName: "",
      password: ""
    };
    ctx.state.operationMessage = `已创建用户 ${created.displayName || created.username}`;
  } catch (error) {
    ctx.state.operationMessage = `创建用户失败：${error.reason || error.code || error.message}`;
  } finally {
    setGovernanceActionLocked(ctx, lockKey, false);
    ctx.render();
  }
}

export function applyAccountRolePreset(role, root = document) {
  const preset = new Set(capabilitiesForAccountRole(role).map((item) => item.toLowerCase()));
  root.querySelectorAll("[data-account-capability]").forEach((node) => {
    node.checked = preset.has(String(node.value || "").toLowerCase());
  });
}

export function updateGovernanceAccountDraft(ctx, patch = {}) {
  ctx.state.pcGovernanceAccountDraft = {
    ...currentAccountUserDraft(ctx),
    ...patch
  };
}

export async function disableGovernanceAccountUser(userId, ctx) {
  const lockKey = `accountUserDisable:${userId}`;
  if (isGovernanceActionLocked(ctx, lockKey)) return;
  setGovernanceActionLocked(ctx, lockKey, true);
  ctx.render();
  try {
    await disableAccountUser(userId);
    await refreshAccountGovernance(ctx);
    ctx.state.operationMessage = "账号已禁用。";
  } catch (error) {
    ctx.state.operationMessage = `禁用失败：${error.reason || error.code || error.message}`;
  } finally {
    setGovernanceActionLocked(ctx, lockKey, false);
    ctx.render();
  }
}

export async function resetGovernanceAccountPassword(userId, ctx) {
  const password = document.querySelector(`[data-account-reset-password="${userId}"]`)?.value || "";
  const lockKey = `accountPasswordReset:${userId}`;
  if (isGovernanceActionLocked(ctx, lockKey)) return;
  setGovernanceActionLocked(ctx, lockKey, true);
  ctx.render();
  try {
    await resetAccountUserPassword(userId, password);
    await refreshAccountGovernance(ctx);
    ctx.state.operationMessage = "密码已重置。";
  } catch (error) {
    ctx.state.operationMessage = `重置失败：${error.reason || error.code || error.message}`;
  } finally {
    setGovernanceActionLocked(ctx, lockKey, false);
    ctx.render();
  }
}

function currentDevice(state) {
  const governance = state.pcGovernance || {};
  return governance.currentDevice ||
    (governance.deviceSessions || []).find((session) => session.actorId === state.currentActor?.userId) ||
    { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" };
}

async function refreshAccountGovernance(ctx) {
  const [accountUsers, accountAudit] = await Promise.all([
    fetchAccountUsers(),
    fetchAccountAudit()
  ]);
  ctx.state.pcGovernance = {
    ...ctx.state.pcGovernance,
    accountUsers,
    accountAudit
  };
}

function value(selector, fallback = "") {
  return (document.querySelector(selector)?.value || fallback).trim();
}

function selectedAccountRole() {
  return (document.querySelector("[data-account-role-select]")?.value || "operator").trim();
}

function selectedAccountCapabilities(role, draft = {}) {
  const checked = Array.from(document.querySelectorAll("[data-account-capability]:checked"))
    .map((node) => String(node.value || "").trim())
    .filter(Boolean);
  if (checked.length) return checked;
  if (asArray(draft.capabilities).length) return asArray(draft.capabilities);
  return capabilitiesForAccountRole(role);
}

function currentAccountUserDraft(ctx) {
  return {
    username: "",
    displayName: "",
    password: "",
    department: "住宿运营部",
    businessLine: "stay",
    role: "operator",
    capabilities: [],
    ...(ctx.state.pcGovernanceAccountDraft || {})
  };
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isGovernanceActionLocked(ctx, key) {
  return Boolean(ctx.state.pcGovernanceActionLocks?.[key]);
}

function setGovernanceActionLocked(ctx, key, locked) {
  ctx.state.pcGovernanceActionLocks = {
    ...(ctx.state.pcGovernanceActionLocks || {}),
    [key]: locked
  };
}
