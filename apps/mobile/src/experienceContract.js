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

export const personalLibraryViews = ["businessRecords", "completedRecords", "evidenceLibrary"];

export const mobileSupportViews = [
  "learning",
  "notes",
  "reminders",
  "permissions",
  ...personalLibraryViews,
  "uploadQueue",
  "submitQueue",
  "drafts",
  "failedSync",
  "recentSubmissions",
  "recentTraces",
  "deviceTrust",
  "feedback",
  "result",
  "confirmPage",
  "permissionDiagnostic"
];

const mobileWorkPlaneViews = ["home", "workbench", "search", "me", "workspace", "operationPanel", ...mobileSupportViews];

export const roleNavigation = {
  frontdesk: mobileWorkPlaneViews,
  operator: mobileWorkPlaneViews,
  finance: ["financeControl", "financeReconciliation", ...mobileWorkPlaneViews],
  housekeeping: mobileWorkPlaneViews,
  manager: ["managerControlTower", "pcManager", ...mobileWorkPlaneViews],
  admin: ["governanceCenter", "pcGovernance", "managerControlTower", "pcManager", ...mobileWorkPlaneViews],
  releaseOwner: ["releaseFlightDeck", "releaseControl", "governanceCenter", "pcGovernance", ...mobileWorkPlaneViews]
};

export const deviceSurfaceMatrix = {
  mobile: mobileWorkPlaneViews,
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
