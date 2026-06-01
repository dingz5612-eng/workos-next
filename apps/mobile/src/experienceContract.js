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

export const roleNavigation = {
  frontdesk: ["home", "workbench", "search", "me", "workspace", "operationPanel"],
  operator: ["home", "workbench", "search", "me", "workspace", "operationPanel"],
  finance: ["financeControl", "financeReconciliation", "workbench", "search", "me", "workspace", "operationPanel"],
  housekeeping: ["workbench", "home", "search", "me", "workspace", "operationPanel"],
  manager: ["managerControlTower", "pcManager", "workbench", "search", "me", "workspace", "operationPanel"],
  admin: ["governanceCenter", "pcGovernance", "managerControlTower", "pcManager", "workbench", "search", "me", "workspace", "operationPanel"],
  releaseOwner: ["releaseFlightDeck", "releaseControl", "governanceCenter", "pcGovernance", "workbench", "me", "workspace", "operationPanel"]
};

export const deviceSurfaceMatrix = {
  mobile: ["home", "workbench", "search", "me", "workspace", "operationPanel"],
  pc: ["financeControl", "managerControlTower", "governanceCenter", "workbench", "workspace", "operationPanel"],
  release: ["releaseFlightDeck", "governanceCenter", "releaseControl"]
};

export const workItemCardSchema = [
  "workItemId",
  "caseId",
  "workItemType",
  "lifecycleState",
  "ownerRole",
  "SLA",
  "requiredEvidence",
  "nextAction",
  "traceRefs",
  "riskLevel",
  "evidenceState",
  "dueAt",
  "businessObject"
];

export const actionResultStateMatrix = {
  committed_projected: "trace refs",
  permission_blocked_403: "PermissionDiagnostic",
  idempotency_conflict_409: "duplicate submission result",
  business_blocked_422: "business blocker + next action",
  committed_projection_pending: "pending, not failed",
  committed_projection_failed: "requires support"
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
