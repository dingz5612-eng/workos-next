import { readJsonIfExists, writeJson } from "./lib/capability-delivery-control-plane.mjs";
import {
  CAPABILITY_ID,
  FIRST_GOLDEN_CHAIN_STEPS,
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  buildCapabilityTestPlan,
  digestTestPlan,
  isSha256Digest
} from "./lib/capability-projection-digests.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/test-plan-generated-from-capability-result.json";
const plan = readJsonIfExists(FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH, root);
const expected = buildCapabilityTestPlan(root);
const failures = [];

if (!plan) {
  failures.push(`${FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH} is missing.`);
} else {
  if (plan.version !== expected.version) failures.push("test plan version mismatch.");
  if (plan.capabilityId !== CAPABILITY_ID) failures.push(`test plan must bind capabilityId=${CAPABILITY_ID}.`);
  for (const field of [
    "acceptedGeneratedBundleDigest",
    "runtimeProjectionDigest",
    "surfaceProjectionDigest",
    "searchProjectionDigest",
    "testPlanDigest"
  ]) {
    if (!isSha256Digest(plan[field])) failures.push(`${field} must be a sha256 digest.`);
    if (plan[field] !== expected[field]) failures.push(`${field} mismatch: expected ${expected[field]}, actual ${plan[field]}.`);
  }
  const workItems = (plan.scope?.includedWorkItems ?? []).map((item) => item.workItemType);
  const expectedWorkItems = FIRST_GOLDEN_CHAIN_STEPS.map((item) => item.workItemType);
  if (JSON.stringify(workItems) !== JSON.stringify(expectedWorkItems)) {
    failures.push(`test plan includedWorkItems must be exactly ${expectedWorkItems.join(" -> ")}.`);
  }
  const serialized = JSON.stringify(plan);
  for (const forbidden of ["rateSetup", "roomBlock", "roomRelease", "ten-scenario", "all-steps"]) {
    if (serialized.includes(forbidden)) failures.push(`${forbidden} must not appear in the current generated test plan.`);
  }
  if (plan.mainGatePolicy?.legacyScenarioMainGate !== false ||
    plan.mainGatePolicy?.legacyFullPathAuditMainGate !== false) {
    failures.push("legacy browser audits must not be current main gates.");
  }
  if (plan.scope?.productionConfirmAllowed !== false ||
    plan.scope?.releaseAuthority !== false ||
    plan.scope?.finalGoNoGo !== "NO_GO") {
    failures.push("test plan must keep production/release/final GO closed.");
  }
  if (plan.testPlanDigest !== digestTestPlan(plan)) {
    failures.push("testPlanDigest does not match canonical test plan payload.");
  }
}

const result = {
  version: "oam.test-plan-generated-from-capability-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  testPlanPath: FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  acceptedGeneratedBundleDigest: plan?.acceptedGeneratedBundleDigest ?? null,
  runtimeProjectionDigest: plan?.runtimeProjectionDigest ?? null,
  surfaceProjectionDigest: plan?.surfaceProjectionDigest ?? null,
  searchProjectionDigest: plan?.searchProjectionDigest ?? null,
  testPlanDigest: plan?.testPlanDigest ?? null,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Test plan generated from capability check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Test plan generated from capability check: PASS (${result.testPlanDigest})`);
