import { mobileSupportViews, roleNavigation } from "./experienceContract.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";
import { resolveActiveDevice } from "./surfaceResolver.js";

const publicViews = new Set(["login", "onboarding", "permissionDiagnostic"]);
const commonViews = new Set(["home", "workbench", "search", "me", "workspace", "operationPanel", ...mobileSupportViews]);
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
    return denied(view, "actor_session_required", "operator", "login", "permission.next.login");
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
    return denied(view, "device_not_trusted", "admin", "trusted_device", "permission.next.contactOwner");
  }
  if (isPcSurfaceView(view) && (device.deviceTrustStatus !== "trusted" || !["pc", "release"].includes(device.surface))) {
    return denied(view, "pc_surface_requires_pc_device", ownerFor(view), "pc_or_release_surface", "permission.next.switchAllowedSurface");
  }

  if (isReleaseSurface(view) && role !== "releaseOwner") {
    return denied(view, "release_surface_restricted", "releaseOwner", "release.flight_deck.view", "permission.next.contactOwner");
  }

  const admission = state.businessLineAdmission || state.runtimeStore?.businessLineAdmission;
  if (admission && violatesAdmission(view, state, admission)) {
    return denied(view, "business_line_admission_blocked", "manager", "business_line_admission", "permission.next.businessAdmission");
  }

  const pilotScope = state.pilotScope || state.runtimeStore?.pilotScope;
  if (pilotScope?.status === "blocked") {
    return denied(view, "pilot_scope_blocked", "supportOwner", "pilot_scope", "permission.next.contactOwner");
  }

  return allowed(view);
}

export function permissionDiagnosticCopy(decision = {}, tr = (key) => key) {
  return {
    title: tr("permissionDiagnostic"),
    reason: tr(reasonCopyKey(decision.reason)),
    owner: tr(ownerCopyKey(decision.owner || "manager")),
    requiredPermission: tr(permissionCopyKey(decision.requiredPermission || "surface_access")),
    nextAction: tr(decision.nextAction || "permission.next.contactOwner")
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

function ownerCopyKey(owner) {
  const map = {
    releaseOwner: "permission.owner.releaseOwner",
    admin: "permission.owner.admin",
    finance: "permission.owner.finance",
    manager: "permission.owner.manager",
    operator: "permission.owner.operator",
    supportOwner: "permission.owner.supportOwner"
  };
  return map[owner] || "permission.owner.default";
}

function permissionCopyKey(permission) {
  if (String(permission || "").includes("pc_or_release_surface")) return "permission.scope.surface";
  if (String(permission || "").includes("finance")) return "permission.scope.finance";
  if (String(permission || "").includes("manager")) return "permission.scope.manager";
  if (String(permission || "").includes("governance")) return "permission.scope.governance";
  if (String(permission || "").includes("release")) return "permission.scope.release";
  return "permission.scope.surface";
}

function nextActionFor(view) {
  return "permission.next.switchAllowedSurface";
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
  const decision = admission[line] || {};
  const mode = normalizeSurfaceMode(decision.mode || decision.surfaceMode || decision.admissionMode || decision.level || decision.status);
  const productionAllowed = decision.productionAllowed === true || decision.productionConfirmAllowed === true;
  return mode === "contract_preview" && productionAllowed;
}

function normalizeSurfaceMode(value = "") {
  const token = String(value || "")
    .trim()
    .replaceAll("-", "_")
    .replaceAll(".", "_")
    .replace(/\s+/g, "_")
    .toLocaleLowerCase();
  const map = {
    contract_preview: "contract_preview",
    l0_contract_preview: "contract_preview",
    internal_pilot: "internal_pilot_observation",
    internal_pilot_scope: "internal_pilot_observation",
    internal_pilot_observation: "internal_pilot_observation",
    l1_internal_pilot: "internal_pilot_observation"
  };
  return map[token] || token;
}

function reasonCopyKey(reason = "surface_not_allowed") {
  const copy = {
    actor_session_required: "permission.reason.actor_session_required",
    role_surface_not_allowed: "permission.reason.role_surface_not_allowed",
    capability_missing: "permission.reason.capability_missing",
    device_not_trusted: "permission.reason.device_not_trusted",
    pc_surface_requires_pc_device: "permission.reason.pc_surface_requires_pc_device",
    release_surface_restricted: "permission.reason.release_surface_restricted",
    business_line_admission_blocked: "permission.reason.business_line_admission_blocked",
    pilot_scope_blocked: "permission.reason.pilot_scope_blocked",
    surface_not_allowed: "permission.reason.surface_not_allowed"
  };
  return copy[reason] || copy.surface_not_allowed;
}
