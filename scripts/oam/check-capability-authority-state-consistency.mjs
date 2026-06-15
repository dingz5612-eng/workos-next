import {
  CAPABILITY_ID,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import {
  DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH,
  DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH,
  DORMITORY_L1_LANDING_APPROVED_STATUS,
  digestBusinessLandingEvidence
} from "./lib/dormitory-first-golden-chain-landing.mjs";
import { DORMITORY_RUNTIME_ADMISSION_PATH } from "./lib/dormitory-runtime-admission.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/capability-authority-state-consistency-result.json";
const browserAuditResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-real-browser-result.json";
const controlPlaneResultPath = "artifacts/oam/checks/control-plane-gate-results.json";

const projection = readJsonIfExists(CAPABILITY_PROJECTION_PATH, root);
const ledger = readJsonIfExists(CAPABILITY_LEDGER_PATH, root);
const landing = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH, root);
const landingProof = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH, root);
const runtimeAdmission = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const browserAudit = readJsonIfExists(browserAuditResultPath, root);
const controlPlane = readJsonIfExists(controlPlaneResultPath, root);

const failures = [];
const lifecycleAchieved = projection?.lifecycleAchieved ?? [];
const capabilityHasBusinessLanding = lifecycleAchieved.includes("BUSINESS_LANDING_ADMITTED");
const landingCurrentIsGo =
  landing?.landingStatus === DORMITORY_L1_LANDING_APPROVED_STATUS ||
  landing?.dormitoryFirstGoldenChainLandingGoNoGo === "GO" ||
  landing?.businessFeatureDevelopmentAllowed === true;
const businessLandingDigest = projection?.activeAuthority?.businessLandingDigest ?? null;
const businessLandingEvent = (ledger?.events ?? []).find((event) => event.eventType === "BUSINESS_LANDING_ADMITTED");
const landingEvidenceDigest = landingProof ? digestBusinessLandingEvidence(landingProof) : null;
const runtimeAdmissionReady = runtimeAdmission?.runtimeConsumptionReady === true;
const browserAuditPassed = browserAudit?.status === "PASS" || browserAudit?.status === "passed";
const controlPlaneCompleted = controlPlane?.runStatus === "completed" && controlPlane?.status === "passed";

requireEqual(projection?.capabilityId, CAPABILITY_ID, "projection.capabilityId", failures);
requireEqual(ledger?.capabilityId, CAPABILITY_ID, "ledger.capabilityId", failures);
requireEqual(landing?.version, "oam.dormitory-first-golden-chain-landing.v1", "landing.version", failures);

if (!capabilityHasBusinessLanding) {
  if (landingCurrentIsGo) {
    failures.push("landing current must not be GO when capability current does not contain BUSINESS_LANDING_ADMITTED.");
  }
  requireEqual(landing?.businessFeatureDevelopmentAllowed, false, "landing.businessFeatureDevelopmentAllowed", failures);
  requireEqual(projection?.businessFeatureDevelopmentAllowed, false, "projection.businessFeatureDevelopmentAllowed", failures);
}

if (capabilityHasBusinessLanding) {
  requireEqual(landing?.landingStatus, DORMITORY_L1_LANDING_APPROVED_STATUS, "landing.landingStatus", failures);
  requireEqual(landing?.dormitoryFirstGoldenChainLandingGoNoGo, "GO", "landing.dormitoryFirstGoldenChainLandingGoNoGo", failures);
  requireEqual(landing?.businessFeatureDevelopmentAllowed, true, "landing.businessFeatureDevelopmentAllowed", failures);
  requireEqual(projection?.businessFeatureDevelopmentAllowed, true, "projection.businessFeatureDevelopmentAllowed", failures);
  requireEqual(projection?.businessLandingGoNoGo, "GO", "projection.businessLandingGoNoGo", failures);
}

if (landingCurrentIsGo) {
  requireEqual(capabilityHasBusinessLanding, true, "capability.lifecycleAchieved includes BUSINESS_LANDING_ADMITTED", failures);
  if (!businessLandingDigest) {
    failures.push("projection.activeAuthority.businessLandingDigest must be non-null when landing current is GO.");
  }
  if (!businessLandingEvent) {
    failures.push("ledger must contain BUSINESS_LANDING_ADMITTED when landing current is GO.");
  }
  if (!landingEvidenceDigest) {
    failures.push(`${DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH} is required when landing current is GO.`);
  }
  if (businessLandingDigest && landingEvidenceDigest) {
    requireEqual(businessLandingDigest, landingEvidenceDigest, "projection.activeAuthority.businessLandingDigest", failures);
    requireEqual(projection?.businessLandingDigestActive, landingEvidenceDigest, "projection.businessLandingDigestActive", failures);
  }
  if (businessLandingEvent && landingEvidenceDigest) {
    requireEqual(businessLandingEvent.subjectDigest, landingEvidenceDigest, "BUSINESS_LANDING_ADMITTED.subjectDigest", failures);
    requireEqual(
      businessLandingEvent.outputDigests?.businessLandingDigest,
      landingEvidenceDigest,
      "BUSINESS_LANDING_ADMITTED.outputDigests.businessLandingDigest",
      failures
    );
  }
}

if (runtimeAdmissionReady && !capabilityHasBusinessLanding && landingCurrentIsGo) {
  failures.push("runtime admission true must not imply business landing true.");
}
if (browserAuditPassed && !capabilityHasBusinessLanding && landingCurrentIsGo) {
  failures.push("browser audit PASS must not imply business landing true.");
}
if (controlPlaneCompleted && !capabilityHasBusinessLanding && landingCurrentIsGo) {
  failures.push("control-plane completed must not imply business landing true.");
}

for (const [field, expected] of Object.entries({
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
})) {
  requireEqual(landing?.[field], expected, `landing.${field}`, failures);
  requireEqual(projection?.[field], expected, `projection.${field}`, failures);
}

const result = {
  version: "oam.capability-authority-state-consistency-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  capabilityHasBusinessLanding,
  landingCurrentIsGo,
  businessFeatureDevelopmentAllowed: landing?.businessFeatureDevelopmentAllowed === true,
  runtimeAdmissionReady,
  browserAuditPassed,
  controlPlaneCompleted,
  businessLandingDigest,
  landingEvidenceDigest,
  businessLandingLedgerEventPresent: Boolean(businessLandingEvent),
  runtimeAdmissionTrueIsBusinessLandingTrue: false,
  browserAuditPassIsBusinessLandingTrue: false,
  controlPlaneCompletedIsBusinessLandingTrue: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Capability authority state consistency check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Capability authority state consistency check: PASS (businessLandingAdmitted=${capabilityHasBusinessLanding}, landingGo=${landingCurrentIsGo})`
);

function requireEqual(actual, expected, label, foundFailures) {
  if (actual !== expected) {
    foundFailures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
  }
}
