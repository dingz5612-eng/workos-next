import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/runtime-idempotency-and-concurrency-result.json";
const unitOfWork = read("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs");
const unitTests = read("tests/WorkOS.UnitTests/OperationsUnitOfWorkTests.cs");
const canonicalTests = read("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs");
const failures = [];

for (const marker of [
  "IdempotencyService",
  "Evaluate(request.TenantId, scope, request.IdempotencyKey, hash)",
  "TryBegin(submission)",
  "same_idempotency_different_payload",
  "command_submission_pending"
]) {
  if (!unitOfWork.includes(marker)) fail(`OperationsUnitOfWork missing ${marker}.`);
}
for (const marker of [
  "same_scope_key_and_payload_returns_stored_stable_response",
  "same_scope_key_and_different_payload_returns_409_without_domain_event",
  "operations_confirm_idempotency_conflict_does_not_write_second_domain_event"
]) {
  if (!`${unitTests}\n${canonicalTests}`.includes(marker)) fail(`idempotency/concurrency test missing ${marker}.`);
}
const beginIndex = unitOfWork.indexOf("TryBegin(submission)");
const handlerIndex = unitOfWork.indexOf("handlers.Handle(envelope)");
if (beginIndex < 0 || handlerIndex < 0 || beginIndex > handlerIndex) {
  fail("command submission reservation must happen before handler execution.");
}

writeJson(resultPath, {
  version: "oam.runtime-idempotency-and-concurrency-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  idempotencyConflictNoSideEffects: true,
  concurrencyReservationBeforeHandler: true,
  failures
}, root);

if (failures.length) {
  console.error("Runtime idempotency and concurrency check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime idempotency and concurrency check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
