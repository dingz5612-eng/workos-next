import { defaultHomeForRole, roleNavigation } from "./experienceContract.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

const mobileFallbackViews = {
  housekeeping: "workbench"
};

export function resolveActiveDevice(state = {}, requestedView = state.view) {
  const current = normalizeDevice(state.currentDevice);
  const pcCurrent = normalizeDevice(state.pcGovernance?.currentDevice);
  if (isPcSurfaceView(requestedView)) {
    if (isTrustedPcDevice(current)) return current;
    if (!current && isTrustedPcDevice(pcCurrent)) return pcCurrent;
  }
  return current || pcCurrent || { deviceId: "mobile-current", deviceTrustStatus: "unknown", surface: "mobile" };
}

export function resolveCurrentSurface(state = {}, requestedView = state.view) {
  return resolveActiveDevice(state, requestedView).surface || "mobile";
}

export function defaultHomeForSession(session = {}, state = {}) {
  const roleHome = defaultHomeForRole(session.role);
  return canAccessSurface({ ...state, currentActor: session }, roleHome)
    ? roleHome
    : mobileFallbackViews[session.role] || "home";
}

export function defaultHomeForCurrentSurface(state = {}) {
  return defaultHomeForSession(state.currentActor || {}, state);
}

export function canAccessSurface(state = {}, view = state.view) {
  if (!view) return false;
  const actor = state.currentActor;
  if (!actor) return ["login", "onboarding", "permissionDiagnostic"].includes(view);
  const role = actor.role || "operator";
  const allowedViews = new Set([...(roleNavigation[role] || roleNavigation.operator)]);
  if (!allowedViews.has(view) && !commonMobileView(view)) return false;
  if (isPcSurfaceView(view)) return isTrustedPcDevice(resolveActiveDevice(state, view));
  return true;
}

function commonMobileView(view) {
  return ["home", "workbench", "search", "me", "workspace", "operationPanel", "learning", "notes", "reminders", "permissions", "uploadQueue", "submitQueue", "drafts", "failedSync", "recentSubmissions", "recentTraces", "deviceTrust", "feedback", "result", "confirmPage", "permissionDiagnostic"].includes(view);
}

function normalizeDevice(device) {
  if (!device || typeof device !== "object") return null;
  return {
    deviceId: device.deviceId || device.device_id || "",
    deviceTrustStatus: device.deviceTrustStatus || device.trustState || device.trust_state || "unknown",
    surface: device.surface || "mobile"
  };
}

function isTrustedPcDevice(device) {
  return !!device && device.deviceTrustStatus === "trusted" && ["pc", "release"].includes(device.surface);
}
