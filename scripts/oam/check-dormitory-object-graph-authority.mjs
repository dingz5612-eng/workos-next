import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-object-graph.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-object-graph-authority-result.json";
const failures = [];
const expectedObjects = new Map([
  ["Dormitory.BuildingContext", ["tenantStableRef", "campusStableRef", "buildingStableRef"]],
  ["Dormitory.Room", ["buildingContextRef", "normalizedRoomNo"]],
  ["Dormitory.BedSet", ["roomStableRef", "bedSetVersion"]],
  ["Dormitory.Bed", ["roomStableRef", "normalizedBedNo"]],
  ["Dormitory.RoomReadiness", ["roomStableRef", "readinessSnapshotVersion"]]
]);
const expectedForbiddenRules = [
  "roomNo_global_unique",
  "bedNo_global_unique",
  "user_submitted_roomId_as_trusted_source",
  "user_submitted_bedId_as_trusted_source",
  "user_submitted_buildingContextRef_as_trusted_source",
  "runtime_ui_test_invent_object_graph_rules",
  "w_stay_resource_as_current_proof"
];
const authority = readJson(authorityPath);

if (authority) {
  requireEqual(authority.version, "oam.dormitory.object-graph-authority.v1", "version");
  requireEqual(authority.status, "authoritative", "status");
  requireEqual(authority.authorityType, "dormitory_first_golden_chain_object_graph", "authorityType");
  requireEqual(authority.currentCapabilityId, "Dormitory.FirstGoldenChain", "currentCapabilityId");
  requireEqual(
    authority.capabilityDecisionRef,
    "docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json",
    "capabilityDecisionRef"
  );

  const objectById = new Map((authority.objects ?? []).map((item) => [item.objectId, item]));
  for (const [objectId, uniqueKey] of expectedObjects) {
    const object = objectById.get(objectId);
    if (!object) {
      failures.push(`${objectId} object is missing.`);
      continue;
    }
    requireArrayExact(object.uniqueKey, uniqueKey, `${objectId}.uniqueKey`);
    requireEqual(object.userSubmittedAsTrustedSource, false, `${objectId}.userSubmittedAsTrustedSource`);
  }
  requireEqual(objectById.get("Dormitory.Room")?.createdBy, "Dorm.RoomSetupConfirm", "Dormitory.Room.createdBy");
  requireArrayIncludes(objectById.get("Dormitory.Room")?.declares, "room.bedCount", "Dormitory.Room.declares");
  requireEqual(objectById.get("Dormitory.BedSet")?.configuredBy, "Dorm.BedSetupConfirm", "Dormitory.BedSet.configuredBy");
  requireEqual(objectById.get("Dormitory.Bed")?.createdBy, "Dorm.BedSetupConfirm", "Dormitory.Bed.createdBy");
  requireEqual(
    objectById.get("Dormitory.RoomReadiness")?.createdOrUpdatedBy,
    "Dorm.ResourceReadinessConfirm",
    "Dormitory.RoomReadiness.createdOrUpdatedBy"
  );
  requireArrayIncludes(
    objectById.get("Dormitory.RoomReadiness")?.requires,
    "complete Dormitory.BedSet",
    "Dormitory.RoomReadiness.requires"
  );

  const policy = authority.trustedSourcePolicy ?? {};
  requireEqual(policy.buildingContextRefTrustedSource, "Source Layer context", "trustedSourcePolicy.buildingContextRefTrustedSource");
  requireEqual(policy.roomStableRefDerivedByAuthority, true, "trustedSourcePolicy.roomStableRefDerivedByAuthority");
  requireEqual(policy.bedStableRefDerivedByAuthority, true, "trustedSourcePolicy.bedStableRefDerivedByAuthority");
  requireEqual(policy.buildingContextRefUserSubmittedAsTruthAllowed, false, "trustedSourcePolicy.buildingContextRefUserSubmittedAsTruthAllowed");
  requireEqual(policy.roomIdUserSubmittedAsTruthAllowed, false, "trustedSourcePolicy.roomIdUserSubmittedAsTruthAllowed");
  requireEqual(policy.bedIdUserSubmittedAsTruthAllowed, false, "trustedSourcePolicy.bedIdUserSubmittedAsTruthAllowed");
  requireArraySet(authority.forbiddenRules, expectedForbiddenRules, "forbiddenRules");
}

writeResult({
  version: "oam.dormitory.object-graph-authority-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  objectIds: authority?.objects?.map((item) => item.objectId) ?? [],
  failures
});

if (failures.length) {
  console.error("Dormitory object graph authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory object graph authority check: PASS");

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function requireArrayExact(actual, expected, label) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label} must equal ${format(expected)}, actual ${format(actual)}.`);
  }
}

function requireArraySet(actual, expected, label) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    failures.push(`${label} must equal ${format(right)}, actual ${format(left)}.`);
  }
}

function requireArrayIncludes(actual, expected, label) {
  if (!Array.isArray(actual) || !actual.includes(expected)) {
    failures.push(`${label} must include ${format(expected)}.`);
  }
}

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`${file} is missing.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function writeResult(result) {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({ ...result, checkedAtUtc: new Date().toISOString() }, null, 2)}\n`);
}

function format(value) {
  return JSON.stringify(value);
}
