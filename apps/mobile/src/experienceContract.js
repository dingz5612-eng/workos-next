export const roleDefaultHome = {
  frontdesk: "home",
  operator: "home",
  finance: "financeControl",
  housekeeping: "workbench",
  manager: "managerControlTower",
  admin: "governanceCenter",
  releaseOwner: "releaseFlightDeck"
};

export const mobileBottomNavigation = ["home", "workbench", "search", "me"];

export const actionResultStateMatrix = {
  permission_blocked_403: "PermissionDiagnostic",
  idempotency_conflict_409: "duplicate submission result",
  business_blocked_422: "business blocker + next action",
  committed_projection_pending: "pending, not failed"
};

export const evidenceStateMatrix = {
  missing: "blocks confirm",
  rejected: "blocks confirm",
  wrong_scope: "blocks confirm",
  draft: "can save draft"
};

export function defaultHomeForRole(role = "operator") {
  return roleDefaultHome[role] || roleDefaultHome.operator;
}
