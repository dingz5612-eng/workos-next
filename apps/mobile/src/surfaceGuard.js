import { roleNavigation } from "./experienceContract.js";

const publicViews = new Set(["login", "onboarding", "permissionDiagnostic"]);
const commonViews = new Set(["home", "workbench", "search", "me", "workspace", "operationPanel", "learning", "notes", "reminders", "feedback", "result", "confirmPage", "permissionDiagnostic"]);
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

  const device = state.pcGovernance?.currentDevice || state.currentDevice || {};
  if (["revoked", "blocked", "untrusted"].includes(device.deviceTrustStatus)) {
    return denied(view, "device_not_trusted", "admin", "trusted_device", "Ask admin to restore device trust before continuing.");
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
    title: "PermissionDiagnostic",
    reason: decision.reason || "surface_not_allowed",
    owner: decision.owner || "manager",
    requiredPermission: decision.requiredPermission || "surface_access",
    nextAction: decision.nextAction || "Ask the responsible owner to grant access or move the work item to an allowed surface."
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

function nextActionFor(view) {
  return `Request ${requiredCapabilityFor(view)} or switch to an allowed role home before opening ${view}.`;
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
