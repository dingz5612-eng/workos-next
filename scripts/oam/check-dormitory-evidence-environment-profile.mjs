import os from "node:os";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import {
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH,
  digestObject,
  fileDigest
} from "./lib/capability-projection-digests.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-evidence-environment-profile-result.json";
const profilePath = "docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json";
const runtimeAdmissionPath = "docs/oam/dormitory-runtime-admission.current.json";
const profile = readJsonIfExists(profilePath, root);
const runtimeAdmission = readJsonIfExists(runtimeAdmissionPath, root);
const positiveBrowser = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH, root);
const negativeBrowser = readJsonIfExists(FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH, root);
const declaredApiBaseUrl = process.env.WORKOS_API_URL || profile?.apiBaseUrl || "http://127.0.0.1:5191";
const declaredBrowserBaseUrl = process.env.WORKOS_MOBILE_URL || profile?.mobileBaseUrl || "http://127.0.0.1:5175";
const actualStorageMode = process.env.WORKOS_RUNTIME_STORAGE_MODE ||
  runtimeAdmission?.environmentProfile?.runtimeStorageMode ||
  profile?.runtimeStorageMode ||
  "unknown";
const failures = [];

if (profile?.version !== "oam.environment-profile.v1") fail("environment profile version invalid.");
if (profile?.environmentProfileId !== runtimeAdmission?.environmentProfileId) {
  fail("runtime admission must bind the declared environment profile id.");
}
if (profile?.runtimeStorageMode !== actualStorageMode) {
  fail(`actual API storage mode ${actualStorageMode} must match declared profile ${profile?.runtimeStorageMode}.`);
}
if (positiveBrowser?.endpoints?.baseUrl && positiveBrowser.endpoints.baseUrl !== declaredBrowserBaseUrl) {
  fail(`positive browser baseUrl mismatch: ${positiveBrowser.endpoints.baseUrl} vs ${declaredBrowserBaseUrl}.`);
}
if (positiveBrowser?.endpoints?.apiUrl && positiveBrowser.endpoints.apiUrl !== declaredApiBaseUrl) {
  fail(`positive browser apiUrl mismatch: ${positiveBrowser.endpoints.apiUrl} vs ${declaredApiBaseUrl}.`);
}
if (negativeBrowser?.endpoints?.baseUrl && negativeBrowser.endpoints.baseUrl !== declaredBrowserBaseUrl) {
  fail(`negative browser baseUrl mismatch: ${negativeBrowser.endpoints.baseUrl} vs ${declaredBrowserBaseUrl}.`);
}
if (negativeBrowser?.endpoints?.apiUrl && negativeBrowser.endpoints.apiUrl !== declaredApiBaseUrl) {
  fail(`negative browser apiUrl mismatch: ${negativeBrowser.endpoints.apiUrl} vs ${declaredApiBaseUrl}.`);
}
if (profile?.evidenceSemantics?.businessLandingEvidence !== false ||
  profile?.evidenceSemantics?.productionConfirmationEvidence !== false ||
  profile?.evidenceSemantics?.releaseEvidence !== false) {
  fail("environment profile must not claim business landing, production confirmation, or release evidence.");
}

const core = {
  version: "oam.dormitory-evidence-environment-profile-proof.v1",
  capabilityId: CAPABILITY_ID,
  status: failures.length === 0 ? "PASS" : "NO_GO",
  declaredEnvironmentProfileRef: profilePath,
  declaredEnvironmentProfileId: profile?.environmentProfileId ?? null,
  declaredRuntimeStorageMode: profile?.runtimeStorageMode ?? null,
  actualApiStorageMode: actualStorageMode,
  browserAuditBaseUrl: declaredBrowserBaseUrl,
  apiBaseUrl: declaredApiBaseUrl,
  runIdentity: {
    localRunId: process.env.GITHUB_RUN_ID ? null : (profile?.localRunId || os.userInfo().username || "local"),
    ciRunId: process.env.GITHUB_RUN_ID || profile?.ciRunId || null,
    gitHubRepository: process.env.GITHUB_REPOSITORY || null
  },
  evidenceSemantics: profile?.evidenceSemantics ?? {},
  inputDigests: [
    { path: profilePath, digest: fileDigest(profilePath, root) },
    { path: runtimeAdmissionPath, digest: fileDigest(runtimeAdmissionPath, root) },
    { path: FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH, digest: fileDigest(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH, root) },
    { path: FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH, digest: fileDigest(FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH, root) }
  ],
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
const environmentProfileDigest = digestObject(core);
const result = {
  ...core,
  checkedAtUtc: new Date().toISOString(),
  environmentProfileDigest
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory evidence environment profile check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory evidence environment profile check: PASS (${environmentProfileDigest})`);

function fail(message) {
  failures.push(message);
}
