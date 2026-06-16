import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/db-projection-policy-matches-object-graph-result.json";
const dbPolicy = readJsonIfExists("docs/contracts/generated/dormitory/db-projection-policy.generated.json", root);
const objectGraph = readJsonIfExists("docs/business/domains/dormitory/dormitory-object-graph.authority.json", root);
const objectIdentity = readJsonIfExists("docs/contracts/generated/dormitory/object-identity.generated.json", root);
const bedCardinality = readJsonIfExists("docs/contracts/generated/dormitory/bed-cardinality.generated.json", root);
const ruleSourceMap = readJsonIfExists("docs/contracts/generated/dormitory/rule-source-map.generated.json", root);
const environmentProfile = readJsonIfExists("docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json", root);
const failures = [];

if (dbPolicy?.capabilityId !== CAPABILITY_ID) fail("DB policy must bind current capability.");
if (dbPolicy?.policyMode !== "null_if_runtime_test_only") fail("DB policy must remain null_if_runtime_test_only.");
if (dbPolicy?.businessLandingBlockedBecause !== "db_projection_not_active") fail("DB policy must state db_projection_not_active while runtime-test-only.");
if ((dbPolicy?.activeDbProjectionMappings ?? []).length !== 0) fail("DB policy must not activate DB mappings before business landing.");
for (const profile of [
  "local.in_memory.browser_evidence",
  "local.postgres.browser_evidence",
  "ci.postgres.browser_evidence"
]) {
  if (!(dbPolicy?.supportedEnvironmentProfiles ?? []).includes(profile)) fail(`DB policy missing environment profile ${profile}.`);
}
if (dbPolicy?.currentEnvironmentProfileId !== environmentProfile?.environmentProfileId) {
  fail("DB policy currentEnvironmentProfileId must match current environment profile.");
}
for (const [field, expected] of [
  ["objectIdentityRef", "docs/contracts/generated/dormitory/object-identity.generated.json"],
  ["bedCardinalityRef", "docs/contracts/generated/dormitory/bed-cardinality.generated.json"],
  ["businessInvariantsRef", "docs/contracts/generated/dormitory/business-invariants.generated.json"],
  ["commandContractsRef", "docs/contracts/generated/dormitory/command-contracts.generated.json"],
  ["failureSemanticsRef", "docs/contracts/generated/dormitory/failure-semantics.generated.json"],
  ["ruleSourceMapRef", "docs/contracts/generated/dormitory/rule-source-map.generated.json"]
]) {
  if (dbPolicy?.[field] !== expected) fail(`DB policy ${field} must be ${expected}.`);
}
const objectIds = (objectGraph?.objects ?? []).map((item) => item.objectId).sort();
const generatedObjectIds = (objectIdentity?.objectRules ?? []).map((item) => item.objectId).sort();
if (JSON.stringify(objectIds) !== JSON.stringify(generatedObjectIds)) {
  fail("generated object identity rules must match object graph authority objects.");
}
const sourceMapRuleIds = new Set((ruleSourceMap?.sourceMapEntries ?? []).map((item) => item.generatedRuleId));
for (const group of Object.values(dbPolicy?.generatedRuleRefs ?? {})) {
  for (const ruleId of group ?? []) {
    if (!sourceMapRuleIds.has(ruleId)) fail(`DB policy references rule not in source map: ${ruleId}.`);
  }
}
if ((bedCardinality?.rules ?? []).length === 0) fail("bed cardinality generated rules must not be empty.");

writeJson(resultPath, {
  version: "oam.db-projection-policy-matches-object-graph-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  policyMode: dbPolicy?.policyMode ?? null,
  currentEnvironmentProfileId: dbPolicy?.currentEnvironmentProfileId ?? null,
  objectCount: objectIds.length,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
}, root);

if (failures.length) {
  console.error("DB projection policy matches object graph check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("DB projection policy matches object graph check: PASS");

function fail(message) {
  failures.push(message);
}
