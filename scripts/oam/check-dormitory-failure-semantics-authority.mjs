import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-failure-semantics-authority-result.json";
const failures = [];
const expectedCases = new Map([
  ["duplicate_room", [409, "room_already_exists"]],
  ["duplicate_bed", [409, "bed_already_exists"]],
  ["bed_count_not_satisfied", [422, "bed_count_not_satisfied"]],
  ["forged_stable_ref", [422, "readonly_stable_ref_violation"]],
  ["invalid_readiness_state", [422, "invalid_readiness_state"]],
  ["not_saleable_missing_reason", [422, "not_saleable_reason_required"]],
  ["maintenance_missing_service_verification", [422, "service_verification_required"]]
]);
const authority = readJson(authorityPath);

if (authority) {
  requireEqual(authority.version, "oam.dormitory.failure-semantics-authority.v1", "version");
  requireEqual(authority.status, "authoritative", "status");
  requireEqual(authority.authorityType, "dormitory_first_golden_chain_failure_semantics", "authorityType");
  requireEqual(authority.currentCapabilityId, "Dormitory.FirstGoldenChain", "currentCapabilityId");

  const policy = authority.globalFailurePolicy ?? {};
  for (const field of [
    "sideEffectsAllowedOnFailure",
    "domainEventsAllowedOnFailure",
    "projectionMutationsAllowedOnFailure",
    "workItemStateChangeAllowedOnFailure",
    "ledgerEffectAllowedOnFailure"
  ]) {
    requireEqual(policy[field], false, `globalFailurePolicy.${field}`);
  }

  const caseById = new Map((authority.failureSemantics ?? []).map((item) => [item.caseId, item]));
  requireArrayExact([...caseById.keys()], [...expectedCases.keys()], "failureSemantics.caseId");
  for (const [caseId, [httpStatus, code]] of expectedCases) {
    const item = caseById.get(caseId);
    if (!item) continue;
    requireEqual(item.httpStatus, httpStatus, `${caseId}.httpStatus`);
    requireEqual(item.code, code, `${caseId}.code`);
    if (!Array.isArray(item.appliesTo) || item.appliesTo.length === 0) {
      failures.push(`${caseId}.appliesTo must not be empty.`);
    }
  }
}

writeResult({
  version: "oam.dormitory.failure-semantics-authority-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  caseIds: authority?.failureSemantics?.map((item) => item.caseId) ?? [],
  failures
});

if (failures.length) {
  console.error("Dormitory failure semantics authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory failure semantics authority check: PASS");

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
