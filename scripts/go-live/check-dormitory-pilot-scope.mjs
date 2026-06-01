import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scopePath = readArg("--scope=", "docs/go-live/dormitory/internal-pilot-scope.yml");
const outPath = readArg("--out=", ".tmp/go-live/dormitory/pilot-scope-result.json");

const requiredTopLevel = [
  "pilotId",
  "tenantId",
  "siteId",
  "buildingIds",
  "roomIds",
  "bedIds",
  "enabledRoles",
  "enabledUsers",
  "enabledDevices",
  "enabledWorkItemTypes",
  "enabledMoneyCommands",
  "disabledActions",
  "moneyLimits",
  "featureFlags",
  "cutoverState",
  "stopConditions",
  "rollbackOwner",
  "businessOwner",
  "technicalOwner",
  "supportOwner"
];

const requiredDisabledActions = ["productionBulkImport", "unrestrictedRefund", "periodClose"];
const requiredRoles = ["frontdesk", "finance", "housekeeping", "manager", "admin", "releaseOwner"];
const requiredStopConditions = [
  "money-mismatch-red",
  "duplicate-ledger-entry",
  "bed-double-occupancy",
  "evidence-leak",
  "unable-to-rollback",
  "finance-daily-close-failed",
  "bstage-gate-red",
  "p0-invariant-failed"
];

if (process.argv.includes("--self-test")) {
  const invalid = validateScope({
    pilotId: "bad",
    tenantId: "tenant",
    siteId: "site",
    buildingIds: ["building"],
    roomIds: ["room"],
    bedIds: ["bed"],
    enabledRoles: ["frontdesk"],
    enabledUsers: [],
    enabledDevices: [],
    enabledWorkItemTypes: ["Dorm.CheckinConfirm"],
    enabledMoneyCommands: [],
    disabledActions: [],
    moneyLimits: {},
    featureFlags: { productionBulkImport: true },
    cutoverState: { productionAllowed: true },
    stopConditions: [],
    rollbackOwner: "releaseOwner",
    businessOwner: "business",
    technicalOwner: "tech",
    supportOwner: "support"
  });
  assert(invalid.some((item) => item.id === "dorm_int_scope.disabled_action_missing"), "self-test must catch missing disabled actions");
  assert(invalid.some((item) => item.id === "dorm_int_scope.production_enabled"), "self-test must catch production enablement");
  assert(invalid.some((item) => item.id === "dorm_int_scope.role_missing"), "self-test must catch missing roles");
  console.log("Dormitory pilot scope self-test: PASS");
  process.exit(0);
}

const scope = readJson(scopePath);
const violations = validateScope(scope);
writeReport(scope, violations);

if (violations.length > 0) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory pilot scope check failed.");
}

console.log("Dormitory pilot scope check: PASS");

function validateScope(scope) {
  const violations = [];

  for (const field of requiredTopLevel) {
    if (scope[field] === undefined || isEmpty(scope[field])) {
      violations.push(violation("dorm_int_scope.field_missing", `internal-pilot-scope missing ${field}.`, { field }));
    }
  }

  for (const role of requiredRoles) {
    if (!(scope.enabledRoles ?? []).includes(role)) {
      violations.push(violation("dorm_int_scope.role_missing", `enabledRoles must include ${role}.`, { role }));
    }
  }

  for (const action of requiredDisabledActions) {
    if (!(scope.disabledActions ?? []).includes(action)) {
      violations.push(violation("dorm_int_scope.disabled_action_missing", `${action} must be disabled by default.`, { action }));
    }
    if (scope.featureFlags?.[action] !== false) {
      violations.push(violation("dorm_int_scope.feature_flag_not_disabled", `${action} feature flag must be false.`, { action }));
    }
  }

  if (scope.moneyLimits?.productionBulkImportAllowed !== false || scope.moneyLimits?.unrestrictedRefundAllowed !== false || scope.moneyLimits?.periodCloseAllowed !== false) {
    violations.push(violation("dorm_int_scope.money_limit_escape", "productionBulkImport, unrestrictedRefund, and periodClose must be blocked in moneyLimits."));
  }

  if (scope.cutoverState?.productionAllowed !== false || scope.cutoverState?.l2ProductionAllowed !== false || scope.cutoverState?.internalPilotAllowed !== true) {
    violations.push(violation("dorm_int_scope.production_enabled", "DORM-INT scope must allow only internal pilot and keep production/L2 disabled."));
  }

  validateUsers(scope, violations);
  validateDevices(scope, violations);
  validateMoneyCommands(scope, violations);
  validateStopConditions(scope, violations);
  validateGuardCases(scope, violations);

  return violations;
}

function validateUsers(scope, violations) {
  const roles = new Set(scope.enabledRoles ?? []);
  const userIds = new Set();
  for (const user of scope.enabledUsers ?? []) {
    userIds.add(user.userId);
    if (!user.userId || !roles.has(user.role) || user.tenantId !== scope.tenantId || user.siteId !== scope.siteId || user.canConfirm !== true) {
      violations.push(violation("dorm_int_scope.user_out_of_scope", `Enabled user ${user.userId ?? "unknown"} is incomplete or outside pilot scope.`, { userId: user.userId }));
    }
  }
  if (userIds.size !== (scope.enabledUsers ?? []).length) {
    violations.push(violation("dorm_int_scope.duplicate_user", "enabledUsers must not contain duplicate userId values."));
  }
}

function validateDevices(scope, violations) {
  const users = new Set((scope.enabledUsers ?? []).map((user) => user.userId));
  for (const device of scope.enabledDevices ?? []) {
    if (!device.deviceId || !users.has(device.assignedUserId) || device.trustState !== "trusted") {
      violations.push(violation("dorm_int_scope.device_out_of_scope", `Enabled device ${device.deviceId ?? "unknown"} is incomplete, untrusted, or assigned outside scope.`, { deviceId: device.deviceId }));
    }
  }
}

function validateMoneyCommands(scope, violations) {
  const roles = new Set(scope.enabledRoles ?? []);
  for (const item of scope.enabledMoneyCommands ?? []) {
    if (!item.command || !roles.has(item.ownerRole) || item.requiresEvidence !== true || item.confirmAllowed !== true || !(item.maxSingleAmount > 0)) {
      violations.push(violation("dorm_int_scope.money_command_incomplete", `Money command ${item.command ?? "unknown"} must have ownerRole, limit, evidence, and confirmAllowed=true.`, { command: item.command }));
    }
  }
}

function validateStopConditions(scope, violations) {
  const byId = new Set((scope.stopConditions ?? []).map((item) => item.id));
  for (const id of requiredStopConditions) {
    if (!byId.has(id)) {
      violations.push(violation("dorm_int_scope.stop_condition_missing", `P0 stop condition missing: ${id}.`, { stopCondition: id }));
    }
  }
  for (const condition of scope.stopConditions ?? []) {
    if (condition.severity !== "P0" || !condition.owner || !condition.action) {
      violations.push(violation("dorm_int_scope.stop_condition_incomplete", `Stop condition ${condition.id ?? "unknown"} must have severity=P0, owner, and action.`, { stopCondition: condition.id }));
    }
  }
}

function validateGuardCases(scope, violations) {
  const cases = [
    ...(scope.scopeGuards?.positiveCases ?? []),
    ...(scope.scopeGuards?.negativeCases ?? [])
  ];
  if (cases.length === 0) {
    violations.push(violation("dorm_int_scope.guard_cases_missing", "scopeGuards must include positive and negative cases."));
    return;
  }
  for (const testCase of cases) {
    const allowed = isRequestAllowed(scope, testCase.request ?? {});
    if (testCase.expected === "allowed" && !allowed) {
      violations.push(violation("dorm_int_scope.positive_case_blocked", `Positive scope case ${testCase.id} was blocked.`, { caseId: testCase.id }));
    }
    if (testCase.expected === "blocked" && allowed) {
      violations.push(violation("dorm_int_scope.negative_case_allowed", `Negative scope case ${testCase.id} was allowed.`, { caseId: testCase.id }));
    }
  }
}

function isRequestAllowed(scope, request) {
  if (request.tenantId !== scope.tenantId || request.siteId !== scope.siteId) return false;
  if (request.roomId && !(scope.roomIds ?? []).includes(request.roomId)) return false;
  if (request.bedId && !(scope.bedIds ?? []).includes(request.bedId)) return false;
  if (request.workItemType && !(scope.enabledWorkItemTypes ?? []).includes(request.workItemType)) return false;
  if (request.action && (scope.disabledActions ?? []).includes(request.action)) return false;
  if (request.action && ![...(scope.confirmAllowedActions ?? []), ...(scope.readOnlyActions ?? [])].includes(request.action)) return false;

  const user = (scope.enabledUsers ?? []).find((item) => item.userId === request.userId);
  if (!user || user.canConfirm !== true) return false;

  const device = (scope.enabledDevices ?? []).find((item) => item.deviceId === request.deviceId);
  if (!device || device.trustState !== "trusted" || device.assignedUserId !== user.userId) return false;
  if (request.highRisk === true && device.highRiskAllowed !== true) return false;

  if (request.moneyCommand) {
    const command = (scope.enabledMoneyCommands ?? []).find((item) => item.command === request.moneyCommand);
    if (!command || command.confirmAllowed !== true) return false;
    if (request.amount > command.maxSingleAmount) return false;
    if (user.role !== command.ownerRole && !(command.command === "depositRefundRequest" && user.role === "manager")) return false;
  }

  return true;
}

function readArg(prefix, fallback) {
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeReport(scope, violations) {
  const fullOut = path.join(root, outPath);
  fs.mkdirSync(path.dirname(fullOut), { recursive: true });
  fs.writeFileSync(fullOut, JSON.stringify({
    version: "dorm-int-00.pilot-scope-result.v1",
    pilotId: scope.pilotId,
    status: violations.length === 0 ? "passed" : "blocked",
    scopeRef: scopePath,
    checkedAtUtc: new Date().toISOString(),
    violations
  }, null, 2));
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return value === null || value === "";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
