import {
  DORMITORY_RUNTIME_ADMISSION_PATH,
  DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH
} from "./lib/dormitory-runtime-admission.mjs";
import {
  ENVIRONMENT_PROFILE_PATH,
  ENVIRONMENT_PROFILE_RESULT_PATH,
  readJsonIfExists,
  validateEnvironmentProfileAuthority,
  writeJson
} from "./lib/environment-profile-authority.mjs";

const root = process.cwd();
const profile = readJsonIfExists(ENVIRONMENT_PROFILE_PATH, root);
const runtimeAuthority = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const runtimeProof = readJsonIfExists(DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH, root);
const validation = validateEnvironmentProfileAuthority({
  profile,
  runtimeAuthority,
  runtimeProof
});
const result = {
  version: "oam.environment-profile-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: validation.status,
  environmentProfileId: profile?.environmentProfileId ?? null,
  environmentKind: profile?.environmentKind ?? null,
  runtimeStorageMode: profile?.runtimeStorageMode ?? null,
  backgroundWorkerMode: profile?.backgroundWorkerMode ?? null,
  browserMode: profile?.browserMode ?? null,
  apiBaseUrl: profile?.apiBaseUrl ?? null,
  mobileBaseUrl: profile?.mobileBaseUrl ?? null,
  ciRunId: profile?.ciRunId ?? null,
  localRunId: profile?.localRunId ?? null,
  artifactDigest: profile?.artifactDigest ?? null,
  workspaceDirtyStatus: profile?.workspaceDirtyStatus ?? null,
  evidenceSemantics: profile?.evidenceSemantics ?? null,
  localInMemoryBrowserPassIsOnlyLocalTestEvidence:
    profile?.runtimeStorageMode === "in_memory" &&
    profile?.evidenceSemantics?.localTestOnlyEvidence === true &&
    profile?.evidenceSemantics?.ciEvidence === false &&
    profile?.evidenceSemantics?.postgresEvidence === false &&
    profile?.evidenceSemantics?.productionLikeEvidence === false,
  runtimeAuthorityProfileBound: runtimeAuthority?.environmentProfileId === profile?.environmentProfileId,
  runtimeProofProfileBound: runtimeProof?.environmentProfileId === profile?.environmentProfileId,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures: validation.failures
};

writeJson(ENVIRONMENT_PROFILE_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Environment Profile authority check: FAIL");
  for (const failure of result.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Environment Profile authority check: PASS (${result.environmentProfileId}, runtimeStorageMode=${result.runtimeStorageMode}, environmentKind=${result.environmentKind})`
);
