import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/runtime-consumes-generated-invariants-result.json";
const runtimeProjection = readJsonIfExists("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", root);
const businessInvariants = readJsonIfExists("docs/contracts/generated/dormitory/business-invariants.generated.json", root);
const commandContracts = readJsonIfExists("docs/contracts/generated/dormitory/command-contracts.generated.json", root);
const runtimeRules = read("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs");
const service = read("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
const tests = read("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs");
const failures = [];
const expectedOrder = [
  "capability_admission",
  "field_normalization",
  "required_validation",
  "readonly_system_derived_validation",
  "object_identity_resolution",
  "bed_cardinality_validation",
  "business_invariant_validation",
  "uniqueness_reservation",
  "idempotency_concurrency_validation",
  "permission_device_evidence_validation",
  "transaction_commit",
  "projection_outbox"
];

if (runtimeProjection?.capabilityId !== CAPABILITY_ID) fail("runtime projection must bind current capability.");
if (runtimeProjection?.businessInvariantsRef !== "docs/contracts/generated/dormitory/business-invariants.generated.json") {
  fail("runtime projection must reference generated business invariants.");
}
if (JSON.stringify(runtimeProjection?.confirmExecutionOrder ?? []) !== JSON.stringify(expectedOrder)) {
  fail("runtime projection confirmExecutionOrder must match fixed generated rule order.");
}
for (const name of [
  "ObjectIdentityResolver",
  "CapabilityInvariantValidator",
  "GeneratedInvariantRuntimeAdapter",
  "GeneratedBedCardinalityRuntimeAdapter",
  "GeneratedRuleSourceMapRuntimeAdapter"
]) {
  if (!runtimeRules.includes(name)) fail(`runtime rules missing ${name}.`);
}
for (const marker of [
  "BusinessInvariantsPath",
  "CommandContractsPath",
  "ClosedReadinessStates",
  "ValidateRequiredInputs",
  "ValidateReadonlySystemDerivedFields"
]) {
  if (!runtimeRules.includes(marker)) fail(`runtime generated invariant adapter missing ${marker}.`);
}
if (!service.includes("GeneratedCapabilityRuntimeRulePipeline.Validate(workItem, normalized, definition)")) {
  fail("CanonicalOperationsApiService must invoke generated rule pipeline before unit of work.");
}
const pipelineIndex = service.indexOf("GeneratedCapabilityRuntimeRulePipeline.Validate");
const commandIndex = service.indexOf("new OperationsCommandRequest");
if (pipelineIndex < 0 || commandIndex < 0 || pipelineIndex > commandIndex) {
  fail("generated rule pipeline must run before command request creation.");
}
const invariantIds = new Set((businessInvariants?.invariants ?? []).map((item) => item.generatedRuleId));
for (const command of commandContracts?.commands ?? []) {
  for (const invariantRuleId of command.invariantRuleIds ?? []) {
    if (!invariantIds.has(invariantRuleId)) fail(`${command.command} references missing generated invariant ${invariantRuleId}.`);
  }
}
if (!tests.includes("accepted_capability_readiness_state_is_closed_by_generated_invariants")) {
  fail("unit tests must cover generated readiness invariant rejection.");
}

writeJson(resultPath, {
  version: "oam.runtime-consumes-generated-invariants-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  businessInvariantsRef: runtimeProjection?.businessInvariantsRef ?? null,
  commandContractsRef: runtimeProjection?.commandContractsRef ?? null,
  fixedConfirmExecutionOrder: expectedOrder,
  failures
}, root);

if (failures.length) {
  console.error("Runtime consumes generated invariants check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime consumes generated invariants check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
