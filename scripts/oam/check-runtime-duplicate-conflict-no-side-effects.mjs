import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/runtime-duplicate-conflict-no-side-effects-result.json";
const failureSemantics = readJsonIfExists("docs/contracts/generated/dormitory/failure-semantics.generated.json", root);
const runtimeRules = read("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs");
const service = read("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
const tests = read("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs");
const failures = [];

if (!runtimeRules.includes("ObjectUniquenessReservation")) fail("runtime must include ObjectUniquenessReservation.");
for (const code of ["room_already_exists", "bed_already_exists"]) {
  const item = (failureSemantics?.failureSemantics ?? []).find((candidate) => candidate.code === code);
  if (!item) fail(`generated failure semantics missing ${code}.`);
  if (item && item.httpStatus !== 409) fail(`${code} must return 409.`);
}
const pipelineIndex = service.indexOf("GeneratedCapabilityRuntimeRulePipeline.Validate");
const commandIndex = service.indexOf("new OperationsCommandRequest");
const commitIndex = service.indexOf("unitOfWork.Commit(command)");
if (pipelineIndex < 0 || commandIndex < 0 || commitIndex < 0 || !(pipelineIndex < commandIndex && commandIndex < commitIndex)) {
  fail("generated duplicate conflict checks must run before command creation and unit of work commit.");
}
for (const marker of [
  "accepted_capability_duplicate_room_is_rejected_by_generated_rules_before_unit_of_work",
  "Assert.IsEmpty(store.Submissions)",
  "Assert.IsEmpty(store.DomainEvents)",
  "Assert.IsEmpty(store.WorkItemEvents)",
  "Assert.IsEmpty(store.OutboxMessages)"
]) {
  if (!tests.includes(marker)) fail(`unit test proof missing ${marker}.`);
}

writeJson(resultPath, {
  version: "oam.runtime-duplicate-conflict-no-side-effects-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  duplicateFailureCodes: ["room_already_exists", "bed_already_exists"],
  sideEffectsForbidden: ["DomainEvent", "WorkItem advance", "Outbox", "DB row", "ReadModel mutation"],
  failures
}, root);

if (failures.length) {
  console.error("Runtime duplicate conflict no side effects check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime duplicate conflict no side effects check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
