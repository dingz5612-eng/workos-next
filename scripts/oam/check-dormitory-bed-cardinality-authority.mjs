import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-bed-cardinality-authority-result.json";
const failures = [];
const expectedRuleIds = [
  "capacity_1_exactly_bed_01",
  "capacity_n_exactly_bed_01_to_n",
  "generated_bed_count_matches_room_bed_count",
  "resource_readiness_blocked_until_complete_bed_set",
  "same_room_same_bed_no_forbidden",
  "different_room_same_bed_no_allowed"
];
const authority = readJson(authorityPath);

if (authority) {
  requireEqual(authority.version, "oam.dormitory.bed-cardinality-authority.v1", "version");
  requireEqual(authority.status, "authoritative", "status");
  requireEqual(authority.authorityType, "dormitory_first_golden_chain_bed_cardinality", "authorityType");
  requireEqual(authority.currentCapabilityId, "Dormitory.FirstGoldenChain", "currentCapabilityId");
  requireEqual(authority.objectGraphRef, "docs/business/domains/dormitory/dormitory-object-graph.authority.json", "objectGraphRef");
  requireEqual(authority.canonicalBedQuantity, "room.bedCount", "canonicalBedQuantity");

  const aliasByField = new Map((authority.acceptedInputAliases ?? []).map((item) => [item.field, item.normalizesTo]));
  requireEqual(aliasByField.get("capacity"), "room.bedCount", "acceptedInputAliases.capacity");
  requireEqual(aliasByField.get("bedCount"), "room.bedCount", "acceptedInputAliases.bedCount");

  const rules = authority.cardinalityRules ?? [];
  const ruleById = new Map(rules.map((item) => [item.ruleId, item]));
  requireArrayExact(rules.map((item) => item.ruleId), expectedRuleIds, "cardinalityRules.ruleId");
  requireEqual(ruleById.get("capacity_1_exactly_bed_01")?.when, "room.bedCount == 1", "capacity_1_exactly_bed_01.when");
  requireArrayExact(ruleById.get("capacity_1_exactly_bed_01")?.creates, ["Dormitory.Bed[01]"], "capacity_1_exactly_bed_01.creates");
  requireEqual(ruleById.get("capacity_1_exactly_bed_01")?.generatedBedCount, 1, "capacity_1_exactly_bed_01.generatedBedCount");
  requireEqual(ruleById.get("capacity_n_exactly_bed_01_to_n")?.when, "room.bedCount == N", "capacity_n_exactly_bed_01_to_n.when");
  requireArrayExact(ruleById.get("capacity_n_exactly_bed_01_to_n")?.creates, ["Dormitory.Bed[01..N]"], "capacity_n_exactly_bed_01_to_n.creates");
  requireEqual(ruleById.get("generated_bed_count_matches_room_bed_count")?.expression, "generatedBedCount == room.bedCount", "generated_bed_count_matches_room_bed_count.expression");
  requireEqual(ruleById.get("resource_readiness_blocked_until_complete_bed_set")?.blockedCommand, "Dorm.ResourceReadinessConfirm", "resource_readiness_blocked_until_complete_bed_set.blockedCommand");
  requireEqual(ruleById.get("resource_readiness_blocked_until_complete_bed_set")?.when, "createdBedCount < room.bedCount", "resource_readiness_blocked_until_complete_bed_set.when");
  requireEqual(ruleById.get("resource_readiness_blocked_until_complete_bed_set")?.failureCode, "bed_count_not_satisfied", "resource_readiness_blocked_until_complete_bed_set.failureCode");
  requireEqual(ruleById.get("same_room_same_bed_no_forbidden")?.allowed, false, "same_room_same_bed_no_forbidden.allowed");
  requireEqual(ruleById.get("different_room_same_bed_no_allowed")?.allowed, true, "different_room_same_bed_no_allowed.allowed");

  const boundaries = authority.authorityBoundaries ?? {};
  for (const field of [
    "roomNoGlobalUniqueAllowed",
    "bedNoGlobalUniqueAllowed",
    "userSubmittedRoomIdTrusted",
    "userSubmittedBedIdTrusted",
    "userSubmittedBuildingContextRefTrusted",
    "runtimeUiTestMayInventBedCardinalityRules",
    "wStayResourceAsCurrentProofAllowed"
  ]) {
    requireEqual(boundaries[field], false, `authorityBoundaries.${field}`);
  }
}

writeResult({
  version: "oam.dormitory.bed-cardinality-authority-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  canonicalBedQuantity: authority?.canonicalBedQuantity ?? null,
  ruleIds: authority?.cardinalityRules?.map((item) => item.ruleId) ?? [],
  failures
});

if (failures.length) {
  console.error("Dormitory bed cardinality authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory bed cardinality authority check: PASS");

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
