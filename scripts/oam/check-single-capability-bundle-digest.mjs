import {
  CAPABILITY_ID,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import { GENERATED_CANDIDATE_ACCEPTANCE_PATH } from "./lib/generated-candidate-subject.mjs";
import { DORMITORY_RUNTIME_ADMISSION_PATH } from "./lib/dormitory-runtime-admission.mjs";
import { GENERATED_BUNDLE_CONTENT_ADDRESSED_RESULT_PATH } from "./lib/generated-contract-bundle.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/single-capability-bundle-digest-result.json";
const projection = readJsonIfExists(CAPABILITY_PROJECTION_PATH, root);
const registry = readJsonIfExists(CAPABILITY_REGISTRY_PATH, root);
const ledger = readJsonIfExists(CAPABILITY_LEDGER_PATH, root);
const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const runtimeAdmission = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const generatedBundleResult = readJsonIfExists(GENERATED_BUNDLE_CONTENT_ADDRESSED_RESULT_PATH, root);
const failures = [];

const digestFields = [
  ["capability.current.activeAuthority.generatedBundleDigest", projection?.activeAuthority?.generatedBundleDigest],
  ["capability.current.activeAuthority.acceptedGeneratedBundleDigest", projection?.activeAuthority?.acceptedGeneratedBundleDigest],
  ["capability.current.activeAuthority.runtimeConsumedBundleDigest", projection?.activeAuthority?.runtimeConsumedBundleDigest],
  ["capability.registry.activeAuthority.generatedBundleDigest", registry?.activeAuthority?.generatedBundleDigest],
  ["capability.registry.activeAuthority.acceptedGeneratedBundleDigest", registry?.activeAuthority?.acceptedGeneratedBundleDigest],
  ["capability.registry.activeAuthority.runtimeConsumedBundleDigest", registry?.activeAuthority?.runtimeConsumedBundleDigest],
  ["generated-bundle-content-addressed-result.acceptedGeneratedBundleDigest", generatedBundleResult?.acceptedGeneratedBundleDigest],
  ["generated-candidate-acceptance.current.acceptedGeneratedBundleDigest", acceptance?.acceptedGeneratedBundleDigest],
  ["dormitory-runtime-admission.current.runtimeConsumedBundleDigest", runtimeAdmission?.runtimeConsumedBundleDigest],
  ["ledger.GENERATED_BUNDLE_BUILT.bundleDigest", eventDigest("GENERATED_BUNDLE_BUILT")],
  ["ledger.GENERATED_BUNDLE_ACCEPTED_BY_00.bundleDigest", eventDigest("GENERATED_BUNDLE_ACCEPTED_BY_00")],
  ["ledger.RUNTIME_TEST_ADMITTED.bundleDigest", eventDigest("RUNTIME_TEST_ADMITTED")],
  ["ledger.RUNTIME_TEST_ADMITTED.outputDigests.runtimeConsumedBundleDigest", event("RUNTIME_TEST_ADMITTED")?.outputDigests?.runtimeConsumedBundleDigest]
];
const canonicalDigest = acceptance?.acceptedGeneratedBundleDigest;

if (projection?.capabilityId !== CAPABILITY_ID ||
  registry?.capabilityId !== CAPABILITY_ID ||
  ledger?.capabilityId !== CAPABILITY_ID ||
  generatedBundleResult?.capabilityId !== CAPABILITY_ID) {
  failures.push(`all capability documents/results must bind capabilityId=${CAPABILITY_ID}.`);
}
if (!isDigest(canonicalDigest)) failures.push("acceptedGeneratedBundleDigest must be a sha256 digest.");
for (const [label, value] of digestFields) {
  if (!isDigest(value)) {
    failures.push(`${label} must be a sha256 digest.`);
  } else if (value !== canonicalDigest) {
    failures.push(`${label} must equal acceptedGeneratedBundleDigest ${canonicalDigest}, actual ${value}.`);
  }
}
if (generatedBundleResult?.acceptedBundle?.generatedBundleDigest !== canonicalDigest) {
  failures.push("generated-bundle-content-addressed-result.acceptedBundle.generatedBundleDigest must match canonical digest.");
}
if (runtimeAdmission?.bundleDigestMatch !== true) {
  failures.push("runtime admission bundleDigestMatch must be true.");
}

const result = {
  version: "oam.single-capability-bundle-digest-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  canonicalBundleDigest: canonicalDigest ?? null,
  comparedDigestFields: Object.fromEntries(digestFields),
  generatedBundleAlgorithmSource: "scripts/oam/lib/generated-contract-bundle.mjs",
  generatedBundleDigestIsSingleAuthority: failures.length === 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Single capability bundle digest check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Single capability bundle digest check: PASS (${canonicalDigest})`);

function event(type) {
  return (ledger?.events ?? []).find((item) => item.eventType === type);
}

function eventDigest(type) {
  return event(type)?.bundleDigest ?? event(type)?.outputDigests?.generatedBundleDigest ?? event(type)?.outputDigests?.acceptedGeneratedBundleDigest;
}

function isDigest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value ?? ""));
}
