import {
  CAPABILITY_ID,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH,
  readJsonIfExists,
  stableStringify,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import { GENERATED_CANDIDATE_ACCEPTANCE_PATH } from "./lib/generated-candidate-subject.mjs";
import { DORMITORY_RUNTIME_ADMISSION_PATH } from "./lib/dormitory-runtime-admission.mjs";
import { GENERATED_BUNDLE_CONTENT_ADDRESSED_RESULT_PATH } from "./lib/generated-contract-bundle.mjs";

const root = process.cwd();
const boundaryPath = "docs/oam/capabilities/dormitory-first-golden-chain.active-path-boundary.json";
const resultPath = "artifacts/oam/checks/no-current-capability-uses-legacy-seed-result.json";
const legacySeedTerms = [
  "WorkspaceSeedCatalog",
  "rateSetup",
  "roomBlock",
  "roomRelease",
  "sourceCardId",
  "workspaceCardId"
];
const failures = [];
const boundary = readJsonIfExists(boundaryPath, root);
const projection = readJsonIfExists(CAPABILITY_PROJECTION_PATH, root);
const registry = readJsonIfExists(CAPABILITY_REGISTRY_PATH, root);
const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const runtimeAdmission = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const generatedBundleResult = readJsonIfExists(GENERATED_BUNDLE_CONTENT_ADDRESSED_RESULT_PATH, root);

if (!boundary) failures.push(`${boundaryPath} is missing.`);
for (const [label, value] of [
  ["capability.current.activeAuthority", projection?.activeAuthority],
  ["capability.current.generatedBundle", projection?.generatedBundle],
  ["capability.registry.activeAuthority", registry?.activeAuthority],
  ["generated-candidate-acceptance.acceptedGeneratedBundleDigest", acceptance?.acceptedGeneratedBundleDigest],
  ["generated-candidate-acceptance.acceptedGeneratedFiles", acceptance?.acceptedGeneratedFiles],
  ["generated-candidate-acceptance.acceptedRuntimeConsumableDigests", acceptance?.acceptedRuntimeConsumableDigests],
  ["generated-candidate-acceptance.acceptedGeneratedContractBundle", acceptance?.acceptedGeneratedContractBundle],
  ["dormitory-runtime-admission.runtimeConsumedBundleDigest", runtimeAdmission?.runtimeConsumedBundleDigest],
  ["dormitory-runtime-admission.runtimeConsumedFilesDigestList", runtimeAdmission?.runtimeConsumedFilesDigestList],
  ["dormitory-runtime-admission.acceptedRuntimeConsumableDigests", runtimeAdmission?.acceptedRuntimeConsumableDigests],
  ["generated-bundle-content-addressed.acceptedBundle", generatedBundleResult?.acceptedBundle]
]) {
  const text = stableStringify(value ?? {});
  for (const term of legacySeedTerms) {
    if (text.includes(term)) failures.push(`${label} uses legacy seed/current-six-card identity term: ${term}.`);
  }
}

requireEqual(projection?.capabilityId, CAPABILITY_ID, "projection.capabilityId", failures);
requireEqual(registry?.capabilityId, CAPABILITY_ID, "registry.capabilityId", failures);
requireEqual(generatedBundleResult?.capabilityId, CAPABILITY_ID, "generatedBundleResult.capabilityId", failures);

const allowedZones = flattenAllowedZones(boundary?.allowedReferenceZones ?? {});
for (const requiredLegacyFile of [
  "services/core-api/WorkOS.Api/Runtime/WorkspaceSeedCatalog.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "apps/mobile/src/capabilityProjection.js"
]) {
  const zone = allowedZoneFor(requiredLegacyFile, allowedZones);
  if (!zone) failures.push(`${requiredLegacyFile} must be classified outside current capability active authority.`);
}

const acceptedGeneratedFiles = acceptance?.acceptedGeneratedFiles ?? [];
const runtimeConsumedFiles = runtimeAdmission?.runtimeConsumedFilesDigestList ?? [];
for (const item of [...acceptedGeneratedFiles, ...runtimeConsumedFiles]) {
  if (!String(item?.path ?? "").includes("generated") && item?.path !== "docs/oam/domain-derived-contracts.json" &&
    item?.path !== "docs/oam/system-derived-contracts.json") {
    failures.push(`current capability bundle file must be generated/derived contract authority, actual ${item?.path}.`);
  }
}

const result = {
  version: "oam.no-current-capability-uses-legacy-seed-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: projection?.capabilityId ?? registry?.capabilityId ?? CAPABILITY_ID,
  legacySeedTerms,
  currentCapabilityUsesWorkspaceSeedCatalog: false,
  currentCapabilityUsesSixCardSeedFlow: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("No current capability legacy seed check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`No current capability legacy seed check: PASS (${result.capabilityId})`);

function flattenAllowedZones(zones) {
  const entries = [];
  for (const [zone, prefixes] of Object.entries(zones)) {
    for (const prefix of prefixes ?? []) entries.push({ zone, prefix: slash(prefix) });
  }
  return entries;
}

function allowedZoneFor(file, zones) {
  const normalized = slash(file);
  return zones.find(({ prefix }) => normalized === prefix || normalized.startsWith(prefix))?.zone ?? null;
}

function slash(value) {
  return value.replace(/\\/g, "/");
}

function requireEqual(actual, expected, label, target) {
  if (actual !== expected) target.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
