import {
  CAPABILITY_ID,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  eventDigest,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import { GENERATED_CANDIDATE_ACCEPTANCE_PATH } from "./lib/generated-candidate-subject.mjs";
import { DORMITORY_RUNTIME_ADMISSION_PATH } from "./lib/dormitory-runtime-admission.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/capability-state-machine-transition-result.json";
const stateMachinePath = "docs/oam/capabilities/dormitory-first-golden-chain.state-machine.json";
const stateOrder = [
  "SOURCE_CLOSED",
  "GENERATED_BUNDLE_BUILT",
  "GENERATED_BUNDLE_ACCEPTED",
  "RUNTIME_TEST_ADMITTED",
  "BUSINESS_LANDING_ADMITTED",
  "PRODUCTION_CONFIRMED",
  "RELEASE_AUTHORIZED"
];
const eventToState = {
  SOURCE_CLOSED: "SOURCE_CLOSED",
  GENERATED_BUNDLE_BUILT: "GENERATED_BUNDLE_BUILT",
  GENERATED_BUNDLE_ACCEPTED_BY_00: "GENERATED_BUNDLE_ACCEPTED",
  RUNTIME_TEST_ADMITTED: "RUNTIME_TEST_ADMITTED",
  BUSINESS_LANDING_ADMITTED: "BUSINESS_LANDING_ADMITTED",
  PRODUCTION_CONFIRMED: "PRODUCTION_CONFIRMED",
  RELEASE_AUTHORIZED: "RELEASE_AUTHORIZED"
};

const machine = readJsonIfExists(stateMachinePath, root);
const ledger = readJsonIfExists(CAPABILITY_LEDGER_PATH, root);
const projection = readJsonIfExists(CAPABILITY_PROJECTION_PATH, root);
const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const runtimeAdmission = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const failures = [];

requireEqual(machine?.version, "oam.capability-state-machine.v1", "stateMachine.version", failures);
requireEqual(machine?.capabilityId, CAPABILITY_ID, "stateMachine.capabilityId", failures);
requireJsonEqual(machine?.stateOrder, stateOrder, "stateMachine.stateOrder", failures);
requireEqual(machine?.currentStateSource, CAPABILITY_LEDGER_PATH, "stateMachine.currentStateSource", failures);

let previousDigest = null;
const achievedStates = [];
const stateEvents = new Map();
for (const [index, event] of (ledger?.events ?? []).entries()) {
  if (index === 0) {
    requireEqual(event.previousEventDigest, null, `${event.eventId}.previousEventDigest`, failures);
  } else {
    requireEqual(event.previousEventDigest, previousDigest, `${event.eventId}.previousEventDigest`, failures);
  }
  previousDigest = eventDigest(event);
  const state = eventToState[event.eventType];
  if (!state) continue;
  achievedStates.push(state);
  stateEvents.set(state, event);
}

for (const [index, state] of achievedStates.entries()) {
  const expected = stateOrder[index];
  requireEqual(state, expected, `achievedStates[${index}]`, failures);
}
for (const state of stateOrder.slice(0, achievedStates.length)) {
  if (!stateEvents.has(state)) failures.push(`${state} must be PASS before following states can be active.`);
}

const currentState = achievedStates.at(-1) ?? "MISSING";
requireEqual(machine?.currentState, currentState, "stateMachine.currentState", failures);
requireJsonEqual(projection?.lifecycleAchieved, achievedStates, "projection.lifecycleAchieved", failures);
requireEqual(projection?.activeAuthority?.acceptedGeneratedBundleDigest, acceptance?.acceptedGeneratedBundleDigest, "acceptedGeneratedBundleDigest", failures);
requireEqual(projection?.activeAuthority?.runtimeConsumedBundleDigest, runtimeAdmission?.runtimeConsumedBundleDigest, "activeAuthority.runtimeConsumedBundleDigest", failures);
requireEqual(projection?.activeAuthority?.runtimeAdmissionDigest, stateEvents.get("RUNTIME_TEST_ADMITTED")?.subjectDigest, "runtimeAdmissionDigest", failures);
requireEqual(runtimeAdmission?.runtimeConsumedBundleDigest, acceptance?.acceptedGeneratedBundleDigest, "runtimeConsumedBundleDigest.bundleMatch", failures);

const runtimeEvent = stateEvents.get("RUNTIME_TEST_ADMITTED");
if (runtimeEvent) {
  requireEqual(
    runtimeEvent.inputDigests?.acceptedGeneratedBundleDigest,
    stateEvents.get("GENERATED_BUNDLE_ACCEPTED")?.outputDigests?.acceptedGeneratedBundleDigest,
    "RUNTIME_TEST_ADMITTED.inputDigests.acceptedGeneratedBundleDigest",
    failures
  );
  requireEqual(
    runtimeEvent.outputDigests?.runtimeConsumedBundleDigest,
    runtimeEvent.inputDigests?.acceptedGeneratedBundleDigest,
    "RUNTIME_TEST_ADMITTED.outputDigests.runtimeConsumedBundleDigest",
    failures
  );
}

const builtDigest = stateEvents.get("GENERATED_BUNDLE_BUILT")?.outputDigests?.generatedBundleDigest;
const acceptedDigest = stateEvents.get("GENERATED_BUNDLE_ACCEPTED")?.outputDigests?.acceptedGeneratedBundleDigest;
const runtimeDigest = stateEvents.get("RUNTIME_TEST_ADMITTED")?.outputDigests?.runtimeConsumedBundleDigest;
if (acceptedDigest && builtDigest !== acceptedDigest) {
  failures.push("generatedBundleDigest changed before acceptance; runtime/business/production/release states must be invalid.");
}
if (runtimeDigest && runtimeDigest !== acceptedDigest) {
  failures.push("runtimeConsumedBundleDigest must equal acceptedGeneratedBundleDigest.");
}

for (const forbiddenState of ["PRODUCTION_CONFIRMED", "RELEASE_AUTHORIZED"]) {
  if (achievedStates.includes(forbiddenState)) failures.push(`${forbiddenState} must not be active in this round.`);
}
requireEqual(machine?.nonEquivalenceRules?.runtimeTestAdmittedIsBusinessLanding, false, "runtimeTestAdmittedIsBusinessLanding", failures);
requireEqual(machine?.nonEquivalenceRules?.businessLandingIsProductionConfirmed, false, "businessLandingIsProductionConfirmed", failures);
requireEqual(machine?.nonEquivalenceRules?.productionConfirmedIsReleaseAuthorized, false, "productionConfirmedIsReleaseAuthorized", failures);

const result = {
  version: "oam.capability-state-machine-transition-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  currentState,
  achievedStates,
  blockedFutureStates: stateOrder.slice(achievedStates.length),
  acceptedGeneratedBundleDigest: acceptance?.acceptedGeneratedBundleDigest ?? null,
  runtimeConsumedBundleDigest: runtimeAdmission?.runtimeConsumedBundleDigest ?? null,
  bundleDigestMatch: runtimeAdmission?.runtimeConsumedBundleDigest === acceptance?.acceptedGeneratedBundleDigest,
  businessLandingAdmitted: achievedStates.includes("BUSINESS_LANDING_ADMITTED"),
  productionConfirmed: false,
  releaseAuthorized: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Capability state machine transition check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Capability state machine transition check: PASS (${currentState})`);

function requireEqual(actual, expected, label, foundFailures) {
  if (actual !== expected) foundFailures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function requireJsonEqual(actual, expected, label, foundFailures) {
  if (stableStringify(actual) !== stableStringify(expected)) {
    foundFailures.push(`${label} must equal ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
