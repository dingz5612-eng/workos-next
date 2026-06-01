export const mobileOrdinarySurfaces = new Set([
  "home",
  "workbench",
  "search",
  "me",
  "workspace",
  "operationPanel",
  "learning",
  "notes",
  "reminders",
  "feedback",
  "result",
  "confirmPage",
  "permissionDiagnostic"
]);

export const pcSurfaceViews = new Set([
  "releaseControl",
  "releaseFlightDeck",
  "pcGovernance",
  "governanceCenter",
  "managerControlTower",
  "pcManager",
  "financeReconciliation",
  "financeControl"
]);

export function isMobileOrdinaryView(view) {
  return mobileOrdinarySurfaces.has(view);
}

export function isPcSurfaceView(view) {
  return pcSurfaceViews.has(view);
}
