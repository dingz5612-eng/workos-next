import fs from "node:fs";
import {
  CAPABILITY_COMPATIBILITY_BOX_PATH,
  CAPABILITY_ID,
  readJsonIfExists,
  validateCompatibilityBox
} from "./oam/lib/capability-delivery-control-plane.mjs";

const legacyManifestPath = "docs/oam/compatibility/legacy-slice-manifest.json";
const shimPath = "docs/contracts/slice-manifest.json";
const compatibilityBox = readJsonIfExists(CAPABILITY_COMPATIBILITY_BOX_PATH);
const legacyManifest = readJson(legacyManifestPath);
const shim = readJson(shimPath);
const failures = [];
const compatibilityState = validateCompatibilityBox({ compatibilityBox });
failures.push(...compatibilityState.failures);

requireEqual(legacyManifest.version, "workos.legacy-slice-manifest.v1", "legacyManifest.version");
requireEqual(legacyManifest.manifestMode, "compatibility_lane_only", "legacyManifest.manifestMode");
requireEqual(legacyManifest.allowedLane, "compatibility", "legacyManifest.allowedLane");
requireEqual(legacyManifest.forbiddenRuntimeAuthority, true, "legacyManifest.forbiddenRuntimeAuthority");

for (const slice of legacyManifest.slices ?? []) {
  requireEqual(slice.compatibilityStatus, "migration_read_only", `${slice.id}.compatibilityStatus`);
  requireEqual(slice.forbiddenAuthorityForCurrentCapability, true, `${slice.id}.forbiddenAuthorityForCurrentCapability`);
  if (slice.status === "production-slice") failures.push(`Legacy slice ${slice.id} must not be production-slice.`);
}
if (!(legacyManifest.slices ?? []).some((slice) => slice.id === CAPABILITY_ID)) {
  failures.push(`${legacyManifestPath} must contain ${CAPABILITY_ID} as compatibility-only legacy slice input.`);
}

requireEqual(shim.manifestMode, "production_slice_compatibility_shim", "slice-manifest.manifestMode");
requireEqual(shim.forbiddenCurrentCapabilityAuthority, true, "slice-manifest.forbiddenCurrentCapabilityAuthority");
if ((shim.slices ?? []).some((slice) => slice.id === CAPABILITY_ID)) {
  failures.push(`${shimPath} must not carry ${CAPABILITY_ID} as active slice.`);
}

if (failures.length > 0) {
  console.error("Compatibility contract validation: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Compatibility contract validation: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
