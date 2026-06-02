import { roleNavigation } from "./experienceContract.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";
import { resolveActiveDevice } from "./surfaceResolver.js";

const publicViews = new Set(["login", "onboarding", "permissionDiagnostic"]);
const commonViews = new Set(["home", "workbench", "search", "me", "workspace", "operationPanel", "learning", "notes", "reminders", "permissions", "recentSubmissions", "recentTraces", "deviceTrust", "feedback", "result", "confirmPage", "permissionDiagnostic"]);
const viewCapabilities = {
  financeControl: "finance.control.view",
  financeReconciliation: "finance.control.view",
  managerControlTower: "manager.control.view",
  pcManager: "manager.control.view",
  governanceCenter: "governance.center.view",
  pcGovernance: "governance.center.view",
  releaseFlightDeck: "release.flight_deck.view",
  releaseControl: "release.flight_deck.view"
};

export function evaluateSurfaceAccess(view, state = {}) {
  if (publicViews.has(view)) return allowed(view);

  const actor = state.currentActor;
  if (!actor) {
    return denied(view, "actor_session_required", "operator", "login", "Login is required before opening this surface.");
  }

  const role = actor.role || "operator";
  const allowedViews = new Set([...(roleNavigation[role] || roleNavigation.operator), ...commonViews]);
  if (!allowedViews.has(view)) {
    return denied(view, "role_surface_not_allowed", ownerFor(view), requiredCapabilityFor(view), nextActionFor(view));
  }

  const requiredCapability = viewCapabilities[view];
  const capabilities = actor.capabilities || actor.capabilityIds || [];
  if (requiredCapability && capabilities.length && !surfaceCapabilitySatisfied(view, capabilities, requiredCapability)) {
    return denied(view, "capability_missing", ownerFor(view), requiredCapability, nextActionFor(view));
  }

  const device = resolveActiveDevice(state, view);
  if (["revoked", "blocked", "untrusted"].includes(device.deviceTrustStatus)) {
    return denied(view, "device_not_trusted", "admin", "trusted_device", "Ask admin to restore device trust before continuing.");
  }
  if (isPcSurfaceView(view) && (device.deviceTrustStatus !== "trusted" || !["pc", "release"].includes(device.surface))) {
    return denied(view, "pc_surface_requires_pc_device", ownerFor(view), "pc_or_release_surface", `Switch to an allowed PC/release surface before opening ${view}.`);
  }

  if (isReleaseSurface(view) && role !== "releaseOwner") {
    return denied(view, "release_surface_restricted", "releaseOwner", "release.flight_deck.view", "Only releaseOwner can operate Release Flight Deck.");
  }

  const admission = state.businessLineAdmission || state.runtimeStore?.businessLineAdmission;
  if (admission && violatesAdmission(view, state, admission)) {
    return denied(view, "business_line_admission_blocked", "manager", "business_line_admission", "Move the business line through admission before production-like work.");
  }

  const pilotScope = state.pilotScope || state.runtimeStore?.pilotScope;
  if (pilotScope?.status === "blocked") {
    return denied(view, "pilot_scope_blocked", "supportOwner", "pilot_scope", "Resolve pilot scope blocker before opening this surface.");
  }

  return allowed(view);
}

export function permissionDiagnosticCopy(decision = {}) {
  return {
    title: "权限诊断",
    reason: reasonCopy(decision.reason),
    owner: ownerCopy(decision.owner || "manager"),
    requiredPermission: permissionCopy(decision.requiredPermission || "surface_access"),
    nextAction: decision.nextAction || "请联系对应负责人授权，或切换到当前角色允许访问的工作面。"
  };
}

function allowed(view) {
  return { allowed: true, view };
}

function denied(view, reason, owner, requiredPermission, nextAction) {
  return {
    allowed: false,
    view,
    reason,
    owner,
    requiredPermission,
    nextAction,
    component: "PermissionDiagnostic"
  };
}

function requiredCapabilityFor(view) {
  return viewCapabilities[view] || "surface_access";
}

function ownerFor(view) {
  if (isReleaseSurface(view)) return "releaseOwner";
  if (["governanceCenter", "pcGovernance"].includes(view)) return "admin";
  if (["financeControl", "financeReconciliation"].includes(view)) return "finance";
  if (["managerControlTower", "pcManager"].includes(view)) return "manager";
  return "operator";
}

function ownerCopy(owner) {
  const map = {
    releaseOwner: "发布负责人",
    admin: "治理管理员",
    finance: "财务确认人",
    manager: "主管",
    operator: "运营经办人",
    supportOwner: "支持负责人"
  };
  return map[owner] || "对应负责人";
}

function permissionCopy(permission) {
  if (String(permission || "").includes("finance")) return "财务工作台访问权限";
  if (String(permission || "").includes("manager")) return "主管工作台访问权限";
  if (String(permission || "").includes("governance")) return "治理中心访问权限";
  if (String(permission || "").includes("release")) return "发布观察面访问权限";
  return "当前工作面访问权限";
}

function nextActionFor(view) {
  return `申请 ${requiredCapabilityFor(view)}，或切换到当前角色允许访问的工作面后再打开 ${view}。`;
}

function isReleaseSurface(view) {
  return ["releaseFlightDeck", "releaseControl"].includes(view);
}

function surfaceCapabilitySatisfied(view, capabilities, requiredCapability) {
  if (capabilities.includes(requiredCapability)) return true;
  if (["governanceCenter", "pcGovernance"].includes(view)) {
    return capabilities.some((item) => item.startsWith("admin.") || item.startsWith("pc."));
  }
  if (["financeControl", "financeReconciliation"].includes(view)) {
    return capabilities.some((item) => item.startsWith("finance.") || item.includes("payment"));
  }
  if (["managerControlTower", "pcManager"].includes(view)) {
    return capabilities.some((item) => item.startsWith("manager.") || item.includes("workItem") || item.includes("work_item"));
  }
  if (isReleaseSurface(view)) {
    return capabilities.some((item) => item.startsWith("release.") || item.startsWith("gate."));
  }
  return false;
}

function violatesAdmission(view, state, admission) {
  if (view !== "workspace") return false;
  const selected = state.selectedWorkspace || "";
  const line = selected.toLowerCase().includes("repair") ? "repair" : selected.toLowerCase().includes("parts") ? "parts" : "";
  if (!line) return false;
  const status = admission[line]?.level || admission[line]?.status || "";
  return /L0|Contract Preview/i.test(status) && admission[line]?.productionAllowed === true;
}

function reasonCopy(reason = "surface_not_allowed") {
  const copy = {
    actor_session_required: "请先登录后再访问这个工作面。",
    role_surface_not_allowed: "当前角色不能访问这个工作面。",
    capability_missing: "当前账号缺少访问这个工作面的权限。",
    device_not_trusted: "当前设备未通过可信校验。",
    pc_surface_requires_pc_device: "这个工作面只能在 PC 或发布设备打开。",
    release_surface_restricted: "发布工作面只允许 releaseOwner 访问。",
    business_line_admission_blocked: "当前业务线尚未通过准入门禁。",
    pilot_scope_blocked: "当前内测范围处于阻断状态。",
    surface_not_allowed: "当前工作面不可访问。"
  };
  return copy[reason] || copy.surface_not_allowed;
}
