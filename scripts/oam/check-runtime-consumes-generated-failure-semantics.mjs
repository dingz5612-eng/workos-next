import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/runtime-consumes-generated-failure-semantics-result.json";
const runtimeProjection = readJsonIfExists("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", root);
const failureSemantics = readJsonIfExists("docs/contracts/generated/dormitory/failure-semantics.generated.json", root);
const runtimeRules = read("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs");
const operationsResult = read("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs");
const tests = read("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs");
const failures = [];

if (runtimeProjection?.failureSemanticsRef !== "docs/contracts/generated/dormitory/failure-semantics.generated.json") {
  fail("runtime projection must reference generated failure semantics.");
}
for (const marker of [
  "GeneratedFailureSemanticsRuntimeAdapter",
  "FailureSemanticsPath",
  "HttpStatusForFailureCode",
  "BusinessMessage",
  "GeneratedRuleRejected"
]) {
  if (!`${runtimeRules}\n${operationsResult}`.includes(marker)) fail(`runtime failure semantics path missing ${marker}.`);
}
const policy = failureSemantics?.globalFailurePolicy ?? {};
for (const key of [
  "sideEffectsAllowedOnFailure",
  "domainEventsAllowedOnFailure",
  "projectionMutationsAllowedOnFailure",
  "workItemStateChangeAllowedOnFailure",
  "ledgerEffectAllowedOnFailure"
]) {
  if (policy[key] !== false) fail(`generated globalFailurePolicy.${key} must be false.`);
}
for (const item of failureSemantics?.failureSemantics ?? []) {
  if (!runtimeRules.includes(`"${item.code}"`)) fail(`runtime must map failure code ${item.code}.`);
  if (!Number.isInteger(item.httpStatus)) fail(`${item.caseId}.httpStatus must be an integer.`);
}
for (const expectedTest of [
  "accepted_capability_duplicate_room_is_rejected_by_generated_rules_before_unit_of_work",
  "accepted_capability_forged_stable_ref_is_rejected_by_generated_rules",
  "accepted_capability_readiness_state_is_closed_by_generated_invariants"
]) {
  if (!tests.includes(expectedTest)) fail(`unit tests missing ${expectedTest}.`);
}

writeJson(resultPath, {
  version: "oam.runtime-consumes-generated-failure-semantics-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  failureSemanticsRef: runtimeProjection?.failureSemanticsRef ?? null,
  failureCaseCount: failureSemantics?.failureSemantics?.length ?? 0,
  failures
}, root);

if (failures.length) {
  console.error("Runtime consumes generated failure semantics check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime consumes generated failure semantics check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
