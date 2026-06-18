import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-invariants.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-invariant-authority-result.json";
const failures = [];
const expectedInvariantIds = [
  "room_unique_within_building_context",
  "bed_unique_within_room",
  "bed_count_matches_room_bed_count",
  "bed_requires_existing_room",
  "readiness_requires_existing_room_and_complete_bed_set",
  "readonly_stable_refs",
  "readiness_closed_option_set",
  "not_saleable_requires_reason",
  "maintenance_requires_service_verification",
  "failure_no_side_effects",
  "idempotent_retry_same_command",
  "concurrent_duplicate_conflict_safe"
];
const expectedReadinessStates = [
  "saleable",
  "cleaning_required",
  "maintenance_required",
  "materials_missing",
  "not_saleable"
];
const authority = readJson(authorityPath);

if (authority) {
  requireEqual(authority.version, "oam.dormitory.invariants-authority.v1", "version");
  requireEqual(authority.status, "authoritative", "status");
  requireEqual(authority.authorityType, "dormitory_first_golden_chain_invariants", "authorityType");
  requireEqual(authority.currentCapabilityId, "Dormitory.FirstGoldenChain", "currentCapabilityId");
  requireEqual(authority.objectGraphRef, "docs/business/domains/dormitory/dormitory-object-graph.authority.json", "objectGraphRef");
  requireEqual(authority.bedCardinalityRef, "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json", "bedCardinalityRef");
  requireArrayExact(authority.closedOptionSets?.readinessState, expectedReadinessStates, "closedOptionSets.readinessState");

  const invariantIds = (authority.invariants ?? []).map((item) => item.invariantId);
  requireArrayExact(invariantIds, expectedInvariantIds, "invariants.invariantId");
  const invariantById = new Map((authority.invariants ?? []).map((item) => [item.invariantId, item]));
  for (const id of expectedInvariantIds) {
    const invariant = invariantById.get(id);
    if (!invariant?.rule) failures.push(`${id} must declare rule.`);
  }
  requireEqual(invariantById.get("room_unique_within_building_context")?.failureCode, "room_already_exists", "room_unique_within_building_context.failureCode");
  requireEqual(invariantById.get("bed_unique_within_room")?.failureCode, "bed_already_exists", "bed_unique_within_room.failureCode");
  requireEqual(invariantById.get("bed_count_matches_room_bed_count")?.failureCode, "bed_count_not_satisfied", "bed_count_matches_room_bed_count.failureCode");
  requireEqual(invariantById.get("readonly_stable_refs")?.failureCode, "readonly_stable_ref_violation", "readonly_stable_refs.failureCode");
  requireEqual(invariantById.get("readiness_closed_option_set")?.failureCode, "invalid_readiness_state", "readiness_closed_option_set.failureCode");
  requireEqual(invariantById.get("not_saleable_requires_reason")?.failureCode, "not_saleable_reason_required", "not_saleable_requires_reason.failureCode");
  requireEqual(invariantById.get("maintenance_requires_service_verification")?.failureCode, "service_verification_required", "maintenance_requires_service_verification.failureCode");
}

writeResult({
  version: "oam.dormitory.invariant-authority-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  invariantIds: authority?.invariants?.map((item) => item.invariantId) ?? [],
  failures
});

if (failures.length) {
  console.error("Dormitory invariant authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory invariant authority check: PASS");

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
