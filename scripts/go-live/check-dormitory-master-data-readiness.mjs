import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scopePath = readArg("--scope=", "docs/go-live/dormitory/internal-pilot-scope.yml");
const masterDataPath = readArg("--master-data=", "docs/go-live/dormitory/master-data.yml");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/master-data-readiness.json");

if (process.argv.includes("--self-test")) {
  const invalid = validateMasterData({
    scope: {
      tenantId: "tenant-1",
      siteId: "site-1",
      roomIds: ["room-1"],
      bedIds: ["bed-1"],
      enabledRoles: ["frontdesk"],
      enabledUsers: [{ userId: "user-1", role: "frontdesk" }],
      enabledDevices: [{ deviceId: "device-1", assignedUserId: "user-1", trustState: "trusted" }],
      enabledWorkItemTypes: ["Dorm.CheckinConfirm"],
      enabledMoneyCommands: [{ command: "depositReceive" }],
      featureFlags: { dormitoryInternalPilot: true },
      cutoverState: { sourceMode: "real" }
    },
    masterData: {
      sourceMode: "real",
      rooms: [{ roomId: "room-1", siteId: "site-1" }],
      beds: [{ bedId: "bed-1", roomId: "room-1", status: "available" }],
      roles: [{ role: "frontdesk" }]
    }
  });
  assert(invalid.some((item) => item.id === "dorm_int_01.rate_plan_missing"), "self-test must catch missing RatePlan.");
  assert(invalid.some((item) => item.id === "dorm_int_01.role_without_user"), "self-test must catch missing role user.");
  console.log("Dormitory master data readiness self-test: PASS");
  process.exit(0);
}

const violations = [];
let scope = null;
let masterData = null;

try {
  scope = readJson(scopePath);
} catch (error) {
  violations.push(violation("dorm_int_01.scope_missing", `Cannot read pilot scope: ${scopePath}.`, { path: scopePath, error: error.message }));
}

try {
  masterData = readJson(masterDataPath);
} catch (error) {
  violations.push(violation(
    "dorm_int_01.master_data_source_missing",
    `Cannot read real master data source: ${masterDataPath}.`,
    { path: masterDataPath, error: error.message }
  ));
}

if (scope && masterData) {
  violations.push(...validateMasterData({ scope, masterData }));
}

const report = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "check-dormitory-master-data-readiness",
  stage: "DORM-INT-01",
  status: violations.length ? "blocked" : "passed",
  sourceMode: masterData?.sourceMode || "missing",
  scopePath,
  masterDataPath,
  validation: {
    room: statusFor(violations, "room"),
    bed: statusFor(violations, "bed"),
    ratePlan: statusFor(violations, "rate_plan"),
    subjectResident: statusFor(violations, "subject"),
    stay: statusFor(violations, "stay"),
    bedOccupancy: statusFor(violations, "bed_occupancy"),
    depositAccount: statusFor(violations, "deposit_account"),
    paymentMethod: statusFor(violations, "payment_method"),
    evidenceRequirement: statusFor(violations, "evidence"),
    userRoleCapability: statusFor(violations, "role"),
    deviceTrust: statusFor(violations, "device"),
    tenantRuntimeConfig: statusFor(violations, "tenant_runtime"),
    featureFlag: statusFor(violations, "feature_flag"),
    sliceCutoverState: statusFor(violations, "cutover")
  },
  noGoItems: violations,
  nextAction: violations.length
    ? "补入 docs/go-live/dormitory/master-data.yml，并确保每个内测 room/bed/user/device/money/workItem 都有真实主数据、证据要求、财务路径和 runtime config。"
    : "DORM-INT-01 passed; DORM-INT-02 may be evaluated next."
};

writeJson(outPath, report);

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory master data readiness: BLOCKED");
}

console.log("Dormitory master data readiness: PASS");

export function validateMasterData({ scope, masterData }) {
  const violations = [];
  if (masterData.sourceMode !== "real") {
    violations.push(violation("dorm_int_01.source_mode_not_real", "Master data sourceMode must be real.", { sourceMode: masterData.sourceMode }));
  }

  const rooms = array(masterData.rooms);
  const beds = array(masterData.beds);
  const ratePlans = array(masterData.ratePlans);
  const subjects = array(masterData.subjects);
  const residents = array(masterData.residents);
  const stays = array(masterData.stays);
  const occupancies = array(masterData.bedOccupancies);
  const depositAccounts = array(masterData.depositAccounts);
  const paymentMethods = array(masterData.paymentMethods);
  const evidenceRequirements = array(masterData.evidenceRequirements);
  const users = array(masterData.users);
  const roles = array(masterData.roles);
  const capabilities = array(masterData.capabilities);
  const devices = array(masterData.deviceTrust);
  const tenantConfigs = array(masterData.tenantRuntimeConfigs);
  const featureFlags = array(masterData.featureFlags);
  const cutoverStates = array(masterData.sliceCutoverStates);
  const workItemTypes = array(masterData.workItemTypes);
  const financePaths = array(masterData.financeTruthPaths);

  const roomIds = new Set(rooms.map((item) => item.roomId));
  const bedIds = new Set(beds.map((item) => item.bedId));
  const userIds = new Set(users.map((item) => item.userId));
  const deviceIds = new Set(devices.map((item) => item.deviceId));
  const roleIds = new Set(roles.map((item) => item.role));
  const workItemTypeIds = new Set(workItemTypes.map((item) => item.workItemType));
  const moneyCommands = new Set(financePaths.map((item) => item.moneyCommand));

  for (const roomId of array(scope.roomIds)) {
    if (!roomIds.has(roomId)) {
      violations.push(violation("dorm_int_01.room_missing", `Pilot room missing from master data: ${roomId}.`, { roomId }));
      continue;
    }
    const roomBeds = beds.filter((item) => item.roomId === roomId);
    if (!roomBeds.length) {
      violations.push(violation("dorm_int_01.room_without_beds", `Pilot room has no beds: ${roomId}.`, { roomId }));
    }
  }

  for (const bedId of array(scope.bedIds)) {
    const bed = beds.find((item) => item.bedId === bedId);
    if (!bed) {
      violations.push(violation("dorm_int_01.bed_missing", `Pilot bed missing from master data: ${bedId}.`, { bedId }));
      continue;
    }
    if (!["available", "occupied", "blocked", "cleaning"].includes(bed.status)) {
      violations.push(violation("dorm_int_01.bed_status_missing", `Pilot bed must have usable status: ${bedId}.`, { bedId, status: bed.status }));
    }
    if (!roomIds.has(bed.roomId)) {
      violations.push(violation("dorm_int_01.bed_room_missing", `Pilot bed references unknown room: ${bedId}.`, { bedId, roomId: bed.roomId }));
    }
  }

  if (!ratePlans.length) violations.push(violation("dorm_int_01.rate_plan_missing", "At least one RatePlan is required."));
  if (!subjects.length || !residents.length) violations.push(violation("dorm_int_01.subject_resident_missing", "Subject / Resident master data is required."));
  if (!stays.length) violations.push(violation("dorm_int_01.stay_missing", "At least one Stay is required for internal pilot readiness."));
  if (!occupancies.length) violations.push(violation("dorm_int_01.bed_occupancy_missing", "BedOccupancy readiness data is required."));
  if (!depositAccounts.length) violations.push(violation("dorm_int_01.deposit_account_missing", "DepositAccount readiness data is required."));
  if (!paymentMethods.length) violations.push(violation("dorm_int_01.payment_method_missing", "PaymentMethod readiness data is required."));

  for (const role of array(scope.enabledRoles)) {
    if (!roleIds.has(role)) {
      violations.push(violation("dorm_int_01.role_missing", `Enabled role missing from master data: ${role}.`, { role }));
    }
    if (!users.some((item) => item.role === role && item.realTestUser === true)) {
      violations.push(violation("dorm_int_01.role_without_user", `Enabled role has no real test user: ${role}.`, { role }));
    }
  }

  for (const user of array(scope.enabledUsers)) {
    if (!userIds.has(user.userId)) {
      violations.push(violation("dorm_int_01.user_missing", `Scope user missing from master data: ${user.userId}.`, { userId: user.userId }));
    }
  }

  for (const user of users) {
    if (!array(user.capabilities).length) {
      violations.push(violation("dorm_int_01.user_without_capability", `User has no capability: ${user.userId}.`, { userId: user.userId }));
    }
  }

  for (const capability of capabilities) {
    if (!capability.capability || !capability.role) {
      violations.push(violation("dorm_int_01.capability_incomplete", "Capability must bind role and capability id.", { capability }));
    }
  }

  for (const device of array(scope.enabledDevices)) {
    if (!deviceIds.has(device.deviceId)) {
      violations.push(violation("dorm_int_01.device_missing", `Scope device missing from master data: ${device.deviceId}.`, { deviceId: device.deviceId }));
    }
  }
  for (const device of devices) {
    if (!["trusted", "limited", "revoked"].includes(device.trustState)) {
      violations.push(violation("dorm_int_01.device_trust_missing", `Device has invalid trust state: ${device.deviceId}.`, { deviceId: device.deviceId, trustState: device.trustState }));
    }
  }

  for (const workItemType of array(scope.enabledWorkItemTypes)) {
    if (!workItemTypeIds.has(workItemType)) {
      violations.push(violation("dorm_int_01.workitem_type_missing", `Enabled WorkItemType missing from master data: ${workItemType}.`, { workItemType }));
    }
    if (!evidenceRequirements.some((item) => item.workItemType === workItemType)) {
      violations.push(violation("dorm_int_01.evidence_requirement_missing", `WorkItemType has no EvidenceRequirement: ${workItemType}.`, { workItemType }));
    }
  }

  for (const money of array(scope.enabledMoneyCommands)) {
    if (!moneyCommands.has(money.command)) {
      violations.push(violation("dorm_int_01.finance_path_missing", `Money action has no FinanceTruth / Ledger path: ${money.command}.`, { command: money.command }));
    }
  }

  if (!tenantConfigs.some((item) => item.tenantId === scope.tenantId)) {
    violations.push(violation("dorm_int_01.tenant_runtime_config_missing", `TenantRuntimeConfig missing: ${scope.tenantId}.`, { tenantId: scope.tenantId }));
  }
  if (!featureFlags.some((item) => item.flagKey === "dormitoryInternalPilot" && item.enabled === true)) {
    violations.push(violation("dorm_int_01.feature_flag_missing", "FeatureFlag dormitoryInternalPilot=true is required."));
  }
  if (!cutoverStates.some((item) => item.slice === "Dormitory" && item.state === scope.cutoverState?.state)) {
    violations.push(violation("dorm_int_01.cutover_state_missing", "SliceCutoverState must match DORM-INT scope cutover state.", { expected: scope.cutoverState?.state }));
  }

  return violations;
}

function statusFor(violations, token) {
  return violations.some((item) => item.id.includes(token)) ? "blocked" : "passed";
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
