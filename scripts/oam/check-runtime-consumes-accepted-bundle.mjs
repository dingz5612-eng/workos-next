import { execFileSync } from "node:child_process";
import {
  DORMITORY_RUNTIME_ADMISSION_PATH,
  RUNTIME_CONSUMES_ACCEPTED_BUNDLE_RESULT_PATH,
  validateDormitoryRuntimeAdmissionAuthority
} from "./lib/dormitory-runtime-admission.mjs";
import { readJsonIfExists, writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const authority = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const runtimeAdmission = validateDormitoryRuntimeAdmissionAuthority({
  authority,
  root,
  currentHead: gitHead(),
  writeProof: false
});
const failures = [...runtimeAdmission.failures];

if (!runtimeAdmission.acceptedGeneratedBundleDigest) {
  failures.push("acceptedGeneratedBundleDigest is required.");
}
if (!runtimeAdmission.runtimeConsumedBundleDigest) {
  failures.push("runtimeConsumedBundleDigest is required.");
}
if (runtimeAdmission.runtimeConsumedBundleDigest !== runtimeAdmission.acceptedGeneratedBundleDigest) {
  failures.push("runtimeConsumedBundleDigest must equal acceptedGeneratedBundleDigest.");
}
if (runtimeAdmission.runtimeConsumptionReady === true &&
  runtimeAdmission.runtimeConsumptionReadyDerivedFromBundleMatch !== true) {
  failures.push("runtimeConsumptionReady must derive only from bundle digest match.");
}

const result = {
  version: "oam.runtime-consumes-accepted-bundle-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  runtimeAdmissionStatus: runtimeAdmission.runtimeAdmissionStatus,
  acceptedGeneratedBundleDigest: runtimeAdmission.acceptedGeneratedBundleDigest,
  runtimeConsumedBundleDigest: runtimeAdmission.runtimeConsumedBundleDigest,
  bundleDigestMatch: runtimeAdmission.runtimeConsumedBundleDigest === runtimeAdmission.acceptedGeneratedBundleDigest,
  runtimeConsumedFilesDigestList: runtimeAdmission.runtimeConsumedFilesDigestList,
  acceptedRuntimeConsumableDigests: runtimeAdmission.acceptedRuntimeConsumableDigests,
  runtimeConsumptionReady: runtimeAdmission.runtimeConsumptionReady,
  runtimeConsumptionReadyDerivedFromBundleMatch: runtimeAdmission.runtimeConsumptionReadyDerivedFromBundleMatch,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(RUNTIME_CONSUMES_ACCEPTED_BUNDLE_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Runtime consumes accepted bundle check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Runtime consumes accepted bundle check: PASS (bundleDigestMatch=${result.bundleDigestMatch}, runtimeConsumptionReady=${result.runtimeConsumptionReady})`
);

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8"
    }).trim();
  } catch {
    return null;
  }
}
