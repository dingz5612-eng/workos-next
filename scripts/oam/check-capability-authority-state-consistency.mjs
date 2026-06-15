import {
  CAPABILITY_ID,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  buildProjectionFromLedger,
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
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";
const finalReportPath = "artifacts/oam/final-report.json";
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
const releaseAttestationPath = "artifacts/oam/evidence/current-oam-release-attestation.json";

const projection = readJsonIfExists(CAPABILITY_PROJECTION_PATH, root);
const ledger = readJsonIfExists(CAPABILITY_LEDGER_PATH, root);
const landing = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH, root);
const landingProof = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH, root);
const runtimeAdmission = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const browserAudit = readJsonIfExists(browserAuditResultPath, root);
const controlPlane = readJsonIfExists(controlPlaneResultPath, root);
const evidenceGraph = readJsonIfExists(evidenceGraphPath, root);
const finalReport = readJsonIfExists(finalReportPath, root);
const releaseEvidenceObject = readJsonIfExists(releaseEvidenceObjectPath, root);
const releaseAttestation = readJsonIfExists(releaseAttestationPath, root);

const failures = [];
const lifecycleAchieved = projection?.lifecycleAchieved ?? [];
const capabilityHasBusinessLanding = lifecycleAchieved.includes("BUSINESS_LANDING_ADMITTED");
const landingCurrentIsGo =
  landing?.landingStatus === DORMITORY_L1_LANDING_APPROVED_STATUS ||
  landing?.dormitoryFirstGoldenChainLandingGoNoGo === "GO" ||
  landing?.businessFeatureDevelopmentAllowed === true;
const businessLandingDigest = projection?.activeAuthority?.businessLandingDigest ?? null;
const ledgerBusinessLanding = activeLedgerBusinessLanding(ledger);
const businessLandingEvent = ledgerBusinessLanding.event;
const landingEvidenceDigest = landingProof ? digestBusinessLandingEvidence(landingProof) : null;
const runtimeAdmissionReady = runtimeAdmission?.runtimeConsumptionReady === true;
const browserAuditPassed = browserAudit?.status === "PASS" || browserAudit?.status === "passed";
const controlPlaneCompleted = controlPlane?.runStatus === "completed" && controlPlane?.status === "passed";
const evidenceRootPassed = Boolean(evidenceGraph?.evidenceRoot || evidenceGraph?.artifactDigest) &&
  evidenceGraph?.finalGoNoGo === "NO_GO";

requireEqual(projection?.capabilityId, CAPABILITY_ID, "projection.capabilityId", failures);
requireEqual(ledger?.capabilityId, CAPABILITY_ID, "ledger.capabilityId", failures);
requireEqual(landing?.version, "oam.dormitory-first-golden-chain-landing.v1", "landing.version", failures);
requireEqual(projection?.projectionSource, CAPABILITY_LEDGER_PATH, "projection.projectionSource", failures);
requireEqual(projection?.currentFilesMode, "ledger_replay_projection_only", "projection.currentFilesMode", failures);

if (ledger) {
  const replayedProjection = buildProjectionFromLedger(ledger, root);
  for (const field of [
    "activeAuthority",
    "lifecycleAchieved",
    "lifecycleNotAdmitted",
    "runtimeTestConsumptionAdmitted",
    "runtimeConsumptionReady",
    "businessFeatureDevelopmentAllowed",
    "businessLandingGoNoGo",
    "businessLandingDigestActive",
    "productionConfirmAllowed",
    "releaseAuthority",
    "finalGoNoGo"
  ]) {
    if (!sameJson(projection?.[field], replayedProjection[field])) {
      failures.push(`projection.${field} must be a ledger replay value, not landing/current/evidence-derived.`);
    }
  }
}

if (capabilityHasBusinessLanding !== ledgerBusinessLanding.active) {
  failures.push("capability lifecycle BUSINESS_LANDING_ADMITTED must match active, non-revoked ledger event state.");
}
if (businessLandingDigest !== (ledgerBusinessLanding.digest ?? null)) {
  failures.push("projection.activeAuthority.businessLandingDigest must equal active ledger business landing digest or null.");
}

if (!capabilityHasBusinessLanding) {
  if (landingCurrentIsGo) {
    failures.push("landing current must not be GO when capability current does not contain BUSINESS_LANDING_ADMITTED.");
  }
  requireEqual(landing?.businessFeatureDevelopmentAllowed, false, "landing.businessFeatureDevelopmentAllowed", failures);
  requireEqual(projection?.businessFeatureDevelopmentAllowed, false, "projection.businessFeatureDevelopmentAllowed", failures);
  requireEqual(projection?.businessLandingGoNoGo, "NO_GO", "projection.businessLandingGoNoGo", failures);
  requireEqual(projection?.businessLandingDigestActive, null, "projection.businessLandingDigestActive", failures);
  if (ledgerBusinessLanding.revokedEventId && landing?.previousLandingInput?.status !== "HISTORICAL_REJECTED_OR_PENDING_INPUT_ONLY") {
    failures.push("revoked business landing input must remain only as landing.previousLandingInput historical/pending record.");
  }
}

if (capabilityHasBusinessLanding) {
  if (!ledgerBusinessLanding.active) {
    failures.push("capability current cannot admit business landing without an active non-revoked BUSINESS_LANDING_ADMITTED ledger event.");
  }
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
if (runtimeAdmissionReady && !capabilityHasBusinessLanding) {
  requireEqual(projection?.businessFeatureDevelopmentAllowed, false, "runtimeAdmissionReady cannot set projection.businessFeatureDevelopmentAllowed", failures);
  requireEqual(projection?.businessLandingGoNoGo, "NO_GO", "runtimeAdmissionReady cannot set projection.businessLandingGoNoGo", failures);
}
if (browserAuditPassed && !capabilityHasBusinessLanding) {
  requireEqual(landing?.businessFeatureDevelopmentAllowed, false, "browserAuditPassed cannot set landing.businessFeatureDevelopmentAllowed", failures);
  requireEqual(landing?.dormitoryFirstGoldenChainLandingGoNoGo, "NO_GO", "browserAuditPassed cannot set landing.dormitoryFirstGoldenChainLandingGoNoGo", failures);
}
if (controlPlaneCompleted && !capabilityHasBusinessLanding) {
  requireEqual(projection?.businessFeatureDevelopmentAllowed, false, "controlPlaneCompleted cannot set projection.businessFeatureDevelopmentAllowed", failures);
  requireEqual(projection?.businessLandingGoNoGo, "NO_GO", "controlPlaneCompleted cannot set projection.businessLandingGoNoGo", failures);
}

for (const [field, expected] of Object.entries({
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
})) {
  requireEqual(landing?.[field], expected, `landing.${field}`, failures);
  requireEqual(projection?.[field], expected, `projection.${field}`, failures);
  if (evidenceGraph) requireOptionalEqual(evidenceGraph, field, expected, `evidenceGraph.${field}`, failures);
  if (finalReport) requireOptionalEqual(finalReport, field, expected, `finalReport.${field}`, failures);
  if (releaseEvidenceObject) requireOptionalEqual(releaseEvidenceObject, field, expected, `releaseEvidenceObject.${field}`, failures);
  if (releaseAttestation) requireOptionalEqual(releaseAttestation, field, expected, `releaseAttestation.${field}`, failures);
}
if (evidenceRootPassed) {
  requireEqual(releaseEvidenceObject?.releaseAuthority, false, "Evidence Root PASS cannot set releaseEvidenceObject.releaseAuthority", failures);
  requireOptionalEqual(releaseAttestation, "releaseAuthority", false, "Evidence Root PASS cannot set releaseAttestation.releaseAuthority", failures);
  requireEqual(finalReport?.finalGoNoGo, "NO_GO", "Evidence Root PASS cannot set finalReport.finalGoNoGo", failures);
  if (evidenceGraph?.finalDecision?.finalGoNoGo === "GO" || evidenceGraph?.releaseReadiness?.releaseAuthority === true) {
    failures.push("Evidence Root PASS must remain projection-only and cannot express release/final GO.");
  }
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
  evidenceRootPassed,
  businessLandingDigest,
  landingEvidenceDigest,
  businessLandingLedgerEventPresent: Boolean(businessLandingEvent),
  businessLandingLedgerEventActive: ledgerBusinessLanding.active,
  revokedBusinessLandingEventId: ledgerBusinessLanding.revokedEventId,
  authoritySource: CAPABILITY_LEDGER_PATH,
  readProjection: CAPABILITY_PROJECTION_PATH,
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

function requireOptionalEqual(document, field, expected, label, foundFailures) {
  if (document && Object.prototype.hasOwnProperty.call(document, field)) {
    requireEqual(document[field], expected, label, foundFailures);
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function activeLedgerBusinessLanding(authorityLedger) {
  let event = null;
  let digest = null;
  let revokedEventId = null;
  for (const item of authorityLedger?.events ?? []) {
    if (item.eventType === "BUSINESS_LANDING_ADMITTED") {
      event = item;
      digest = item.outputDigests?.businessLandingDigest ?? item.subjectDigest ?? null;
      revokedEventId = null;
    }
    if (item.eventType === "AUTHORITY_REVOKED" && item.revokedEventType === "BUSINESS_LANDING_ADMITTED") {
      event = null;
      digest = null;
      revokedEventId = item.revokedEventId ?? item.eventId ?? null;
    }
  }
  return {
    active: Boolean(event),
    event,
    digest,
    revokedEventId
  };
}
