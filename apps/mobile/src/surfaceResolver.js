import { defaultHomeForRole } from "./experienceContract.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

const mobileFallbackHome = {
  housekeeping: "workbench"
};

export function resolveActiveDevice(state = {}, requestedView = state.view) {
  const current = state.currentDevice || { deviceId: "mobile-current", deviceTrustStatus: "unknown", surface: "mobile" };
  const pcDevice = state.pcGovernance?.currentDevice;
  if (isPcSurfaceView(requestedView) && isTrustedPcDevice(pcDevice)) {
    return pcDevice;
  }
  return current;
}

export function resolveCurrentSurface(state = {}, requestedView = state.view) {
  return resolveActiveDevice(state, requestedView)?.surface || "mobile";
}

export function resolveDefaultHome(state = {}) {
  return defaultHomeForSession(state.currentActor, state);
}

export function defaultHomeForSession(session = {}, state = {}) {
  const roleHome = defaultHomeForRole(session?.role);
  if (isPcSurfaceView(roleHome) && !isTrustedPcDeviceForState(state, roleHome)) {
    return mobileFallbackHome[session?.role] || "home";
  }
  return roleHome;
}

function isTrustedPcDeviceForState(state, requestedView) {
  const pcDevice = state.pcGovernance?.currentDevice;
  if (isPcSurfaceView(requestedView) && isTrustedPcDevice(pcDevice)) return true;
  return false;
}

function isTrustedPcDevice(device = {}) {
  return ["pc", "release"].includes(device.surface) && device.deviceTrustStatus === "trusted";
}
