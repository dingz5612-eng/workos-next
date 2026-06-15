import { execFileSync } from "node:child_process";
import { GENERATED_CANDIDATE_ACCEPTANCE_PATH, readJsonIfExists, writeJson } from "./lib/generated-candidate-subject.mjs";
import { DORMITORY_RUNTIME_ADMISSION_PATH } from "./lib/dormitory-runtime-admission.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/runtime-implementation-drift-policy-result.json";
const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const runtimeAdmission = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const failures = [];
const diffNames = gitDiffNames();
const singleBundleResult = readJsonIfExists("artifacts/oam/checks/single-capability-bundle-digest-result.json", root);
const generatedBundleDigestIsStable =
  singleBundleResult?.status === "PASS" &&
  singleBundleResult?.generatedBundleDigestIsSingleAuthority === true;
const generatedAcceptanceAuthorityStable =
  acceptance?.decisionStatus === "ACCEPTED_BY_00" &&
  acceptance?.generatedCandidateAcceptedBy00 === true &&
  acceptance?.acceptedGeneratedBundleDigest === runtimeAdmission?.runtimeConsumedBundleDigest &&
  acceptance?.businessFeatureDevelopmentAllowed === false &&
  acceptance?.productionConfirmAllowed === false &&
  acceptance?.releaseAuthority === false &&
  acceptance?.finalGoNoGo === "NO_GO";
const generatedContractDiffs = diffNames.filter((file) =>
  file.startsWith("docs/contracts/generated/") ||
  file.startsWith("apps/mobile/src/generated/") ||
  file === "docs/oam/generated-contracts-manifest.json" ||
  file === "docs/oam/kernel/oam-kernel-graph.generated.json"
);
const generatedAcceptanceDrift = diffNames.filter((file) =>
  file === "docs/oam/generated-candidate-acceptance.current.json" &&
  runtimeImplementationDiffs(diffNames).length > 0
);

if (!acceptance?.acceptedGeneratedBundleDigest) failures.push("acceptedGeneratedBundleDigest is required.");
if (runtimeAdmission?.runtimeConsumedBundleDigest !== acceptance?.acceptedGeneratedBundleDigest) {
  failures.push("runtimeConsumedBundleDigest must equal acceptedGeneratedBundleDigest.");
}
if (generatedContractDiffs.length > 0 && !generatedBundleDigestIsStable) {
  failures.push(
    `handwritten runtime stability lane generated contracts changed without stable single bundle digest authority: ${generatedContractDiffs.join(", ")}.`
  );
}
if (generatedAcceptanceDrift.length > 0 && !generatedAcceptanceAuthorityStable) {
  failures.push("runtime implementation patch must not be mixed into generated candidate acceptance authority.");
}
if (runtimeAdmission?.businessFeatureDevelopmentAllowed !== false ||
  runtimeAdmission?.productionConfirmAllowed !== false ||
  runtimeAdmission?.releaseAuthority !== false ||
  runtimeAdmission?.finalGoNoGo !== "NO_GO") {
  failures.push("runtime implementation drift policy must keep business/production/release/final GO closed.");
}

const result = {
  version: "oam.runtime-implementation-drift-policy-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  acceptedGeneratedBundleDigest: acceptance?.acceptedGeneratedBundleDigest ?? null,
  runtimeConsumedBundleDigest: runtimeAdmission?.runtimeConsumedBundleDigest ?? null,
  bundleDigestUnchanged: runtimeAdmission?.runtimeConsumedBundleDigest === acceptance?.acceptedGeneratedBundleDigest,
  generatedBundleDigestIsStable,
  generatedAcceptanceAuthorityStable,
  handwrittenRuntimeImplementationDiffs: runtimeImplementationDiffs(diffNames),
  generatedContractDiffs,
  generatedContractDiffsAllowedAsReproducibleOutputs: generatedContractDiffs.length > 0 && generatedBundleDigestIsStable,
  generatedAcceptanceDrift,
  runtimeImplementationPatchMixedIntoGeneratedAcceptance: generatedAcceptanceDrift.length > 0 && !generatedAcceptanceAuthorityStable,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Runtime implementation drift policy check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime implementation drift policy check: PASS");

function runtimeImplementationDiffs(files) {
  return files.filter((file) =>
    file.startsWith("services/core-api/") ||
    (file.startsWith("apps/mobile/src/") && !file.startsWith("apps/mobile/src/generated/"))
  );
}

function gitDiffNames() {
  try {
    return execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/\\/g, "/"))
      .filter(Boolean);
  } catch {
    return [];
  }
}
