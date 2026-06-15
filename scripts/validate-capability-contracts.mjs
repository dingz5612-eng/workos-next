import fs from "node:fs";
import {
  CAPABILITY_ID,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH,
  loadCapabilityDocuments,
  validateCurrentProjection
} from "./oam/lib/capability-delivery-control-plane.mjs";

const productionManifest = readJson("docs/contracts/production-slice-manifest.json");
const legacyManifest = readJson("docs/oam/compatibility/legacy-slice-manifest.json");
const runtimeAdmission = readJson("docs/oam/dormitory-runtime-admission.current.json");
const landing = readJson("docs/oam/dormitory-first-golden-chain-landing.current.json");
const surfacePolicy = readJson("docs/contracts/runtime-surface-policy.json");
const { registry, ledger, projection } = loadCapabilityDocuments();
const failures = [];

const projectionState = validateCurrentProjection({ registry, ledger, projection });
failures.push(...projectionState.failures);

requireEqual(registry?.authorityLedgerRef, CAPABILITY_LEDGER_PATH, "registry.authorityLedgerRef");
requireEqual(registry?.currentProjectionRef, CAPABILITY_PROJECTION_PATH, "registry.currentProjectionRef");
requireEqual(projection?.capabilityId, CAPABILITY_ID, "projection.capabilityId");
requireEqual(projection?.lifecycleAchieved?.at(-1), "RUNTIME_TEST_ADMITTED", "projection.currentLifecycleState");
requireEqual(projection?.activeAuthority?.businessLandingDigest, null, "projection.activeAuthority.businessLandingDigest");
requireEqual(projection?.businessFeatureDevelopmentAllowed, false, "projection.businessFeatureDevelopmentAllowed");
requireEqual(projection?.businessLandingGoNoGo, "NO_GO", "projection.businessLandingGoNoGo");
requireEqual(projection?.productionConfirmAllowed, false, "projection.productionConfirmAllowed");
requireEqual(projection?.releaseAuthority, false, "projection.releaseAuthority");
requireEqual(projection?.finalGoNoGo, "NO_GO", "projection.finalGoNoGo");

requireEqual(runtimeAdmission?.runtimeConsumptionReady, true, "runtimeAdmission.runtimeConsumptionReady");
requireEqual(runtimeAdmission?.businessFeatureDevelopmentAllowed, false, "runtimeAdmission.businessFeatureDevelopmentAllowed");
requireEqual(runtimeAdmission?.finalGoNoGo, "NO_GO", "runtimeAdmission.finalGoNoGo");
requireEqual(landing?.landingStatus, "PENDING_BUSINESS_LANDING_REVIEW", "landing.landingStatus");
requireEqual(landing?.businessFeatureDevelopmentAllowed, false, "landing.businessFeatureDevelopmentAllowed");
requireEqual(landing?.dormitoryFirstGoldenChainLandingGoNoGo, "NO_GO", "landing.dormitoryFirstGoldenChainLandingGoNoGo");
requireEqual(landing?.productionConfirmAllowed, false, "landing.productionConfirmAllowed");
requireEqual(landing?.releaseAuthority, false, "landing.releaseAuthority");
requireEqual(landing?.finalGoNoGo, "NO_GO", "landing.finalGoNoGo");

if ((productionManifest.slices ?? []).some((slice) => slice.id === CAPABILITY_ID)) {
  failures.push(`${CAPABILITY_ID} must not be present in production-slice-manifest.`);
}
if (!(legacyManifest.slices ?? []).some((slice) => slice.id === CAPABILITY_ID && slice.compatibilityStatus === "migration_read_only")) {
  failures.push(`${CAPABILITY_ID} must remain isolated in compatibility legacy-slice-manifest.`);
}
if (!(surfacePolicy.policies ?? []).some((policy) => policy.sliceId === CAPABILITY_ID)) {
  failures.push(`${CAPABILITY_ID} surface policy is required as capability policy.`);
}

if (failures.length > 0) {
  console.error("Capability contract validation: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Capability contract validation: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
