import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-evidence-chain-separation-result.json";
const acceptancePath = "docs/oam/generated-candidate-acceptance.current.json";
const acceptanceResultPath = "artifacts/oam/checks/generated-candidate-acceptance-result.json";
const bundleResultPath = "artifacts/oam/checks/generated-bundle-content-addressed-result.json";
const runtimeAdmissionPath = "docs/oam/dormitory-runtime-admission.current.json";
const runtimeAdmissionResultPath = "artifacts/oam/checks/dormitory-runtime-admission-result.json";
const finalReportPath = "artifacts/oam/final-report.json";
const releaseObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";
const releaseAttestationPath = "artifacts/oam/evidence/current-oam-release-attestation.json";
const projectionPath = "docs/oam/capabilities/dormitory-first-golden-chain.current.json";
const ledgerPath = "docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json";

const acceptance = readJson(acceptancePath);
const acceptanceResult = readJson(acceptanceResultPath);
const bundleResult = readJson(bundleResultPath);
const runtimeAdmission = readJson(runtimeAdmissionPath);
const runtimeAdmissionResult = readJson(runtimeAdmissionResultPath);
const finalReport = readJson(finalReportPath);
const releaseObject = readJson(releaseObjectPath);
const evidenceGraph = readJson(evidenceGraphPath);
const releaseAttestation = readJsonIfExists(releaseAttestationPath);
const projection = readJson(projectionPath);
const ledger = readJson(ledgerPath);
const failures = [];

const acceptedDigest = acceptance.acceptedGeneratedBundleDigest;
const currentDigest = bundleResult.currentGeneratedBundleDigest;
const finalReportLifecycle = lifecycleOf(finalReport);
const releaseObjectLifecycle = lifecycleOf(releaseObject);
const evidenceRootDigest = releaseObject.evidenceRootDigest ?? releaseObject.binding?.evidenceRootDigest ?? evidenceGraph.binding?.evidenceRootDigest ?? finalReport.evidenceRootDigest ?? finalReport.binding?.evidenceRootDigest;
const releaseAuthorizedEvents = (ledger.events ?? []).filter((event) => event.eventType === "RELEASE_AUTHORIZED");

requireEqual(acceptanceResult.status, "PASS", "acceptanceResult.status");
requireEqual(bundleResult.status, "PASS", "bundleResult.status");
requireEqual(runtimeAdmissionResult.status, "PASS", "runtimeAdmissionResult.status");
requireEqual(acceptance.decisionType, "generated_candidate_acceptance", "acceptance.decisionType");
requireEqual(acceptance.decisionStatus, acceptanceResult.decisionStatus, "acceptance.decisionStatus mirrors checker");
requireEqual(acceptance.acceptedGeneratedBundleDigest, bundleResult.acceptedGeneratedBundleDigest, "acceptedGeneratedBundleDigest");
requireDigest(acceptedDigest, "acceptedGeneratedBundleDigest");
requireNotEqual(acceptedDigest, acceptance.generatedCandidateSubject?.subjectDigest, "accepted bundle digest must not equal subject digest");
requireNotEqual(acceptedDigest, acceptance.evidenceArtifactDigest, "accepted bundle digest must not equal evidence artifact digest");
requireNotEqual(acceptedDigest, acceptance.evidenceRootDigest, "accepted bundle digest must not equal evidence root digest");
requireNotEqual(acceptedDigest, evidenceRootDigest, "accepted bundle digest must not equal current evidence root digest");

for (const item of acceptance.acceptedGeneratedFiles ?? []) {
  const file = normalizePath(item.path);
  if (!file || file.startsWith("artifacts/oam/") || file.includes("/evidence/")) {
    failures.push(`acceptedGeneratedFiles must contain generated contract files only, actual ${file || "missing"}.`);
  }
}
for (const item of acceptance.acceptedRuntimeConsumableDigests ?? []) {
  const file = normalizePath(item.path);
  if (!file || file.startsWith("artifacts/oam/") || file.includes("/evidence/")) {
    failures.push(`acceptedRuntimeConsumableDigests must contain runtime consumable generated files only, actual ${file || "missing"}.`);
  }
}

if (bundleResult.currentSubjectDiffersFromAcceptedSubject === true || currentDigest !== acceptedDigest) {
  requireEqual(
    acceptance.currentGeneratedCandidateDivergence?.acceptedBundleRemainsImmutable,
    true,
    "currentGeneratedCandidateDivergence.acceptedBundleRemainsImmutable"
  );
  requireEqual(
    acceptance.currentGeneratedCandidateDivergence?.runtimeMustNotAutoConsumeCurrentGeneratedFiles,
    true,
    "currentGeneratedCandidateDivergence.runtimeMustNotAutoConsumeCurrentGeneratedFiles"
  );
  requireEqual(
    runtimeAdmission.runtimeConsumedBundleDigest,
    acceptedDigest,
    "runtime must consume accepted bundle when current subject differs"
  );
  requireNotEqual(
    runtimeAdmission.runtimeConsumedBundleDigest,
    currentDigest,
    "runtime must not auto-consume current generated bundle when not accepted"
  );
}

requireEqual(runtimeAdmission.generatedCandidateAcceptedBy00, true, "runtimeAdmission.generatedCandidateAcceptedBy00");
requireEqual(runtimeAdmission.acceptedGeneratedBundleDigest, acceptedDigest, "runtimeAdmission.acceptedGeneratedBundleDigest");
requireEqual(runtimeAdmission.runtimeConsumedBundleDigest, acceptedDigest, "runtimeAdmission.runtimeConsumedBundleDigest");
requireEqual(runtimeAdmission.bundleDigestMatch, true, "runtimeAdmission.bundleDigestMatch");
requireEqual(runtimeAdmission.runtimeConsumptionReadyAuthority, "runtimeConsumedBundleDigest_equals_acceptedGeneratedBundleDigest", "runtimeConsumptionReadyAuthority");
requireEqual(runtimeAdmission.businessFeatureDevelopmentAllowed, false, "runtimeAdmission.businessFeatureDevelopmentAllowed");
requireEqual(runtimeAdmission.productionConfirmAllowed, false, "runtimeAdmission.productionConfirmAllowed");
requireEqual(runtimeAdmission.releaseAuthority, false, "runtimeAdmission.releaseAuthority");
requireEqual(runtimeAdmission.finalGoNoGo, "NO_GO", "runtimeAdmission.finalGoNoGo");

for (const [label, document] of [
  ["finalReport", finalReport],
  ["releaseObject", releaseObject],
  ["evidenceGraph", evidenceGraph],
  ["releaseAttestation", releaseAttestation]
]) {
  if (!document) continue;
  if (document.releaseAuthority === true || document.binding?.releaseAuthority === true) {
    failures.push(`${label} must not grant releaseAuthority.`);
  }
  if (document.productionConfirmAllowed === true || document.binding?.productionConfirmAllowed === true) {
    failures.push(`${label} must not grant productionConfirmAllowed.`);
  }
  if (document.finalGoNoGo === "GO" || document.binding?.finalGoNoGo === "GO") {
    failures.push(`${label} must not grant final GO.`);
  }
}

requireEqual(finalReportLifecycle, "local-candidate", "finalReport.lifecycle");
requireEqual(releaseObjectLifecycle, "local-candidate", "releaseObject.lifecycle");
requireEqual(finalReport.generatedCandidateAcceptance?.acceptedGeneratedBundleDigest, acceptedDigest, "finalReport mirrors generated bundle acceptance");
requireEqual(acceptedBundleDigestOf(releaseObject), acceptedDigest, "releaseObject mirrors generated bundle acceptance");
requireEqual(finalReport.runtimeConsumptionReady, runtimeAdmission.runtimeConsumptionReady, "finalReport runtimeConsumptionReady mirrors runtime admission");
requireEqual(releaseObject.runtimeConsumptionReady, runtimeAdmission.runtimeConsumptionReady, "releaseObject runtimeConsumptionReady mirrors runtime admission");
requireEqual(projection.releaseAuthority, false, "projection.releaseAuthority");
requireEqual(projection.finalGoNoGo, "NO_GO", "projection.finalGoNoGo");
requireEqual(projection.activeAuthority?.releaseAuthorityDigest, null, "projection.activeAuthority.releaseAuthorityDigest");
if (releaseAuthorizedEvents.length > 0) {
  failures.push("ReleaseCandidate must not be treated as GO while RELEASE_AUTHORIZED ledger events exist in this stage.");
}

const result = {
  version: "oam.dormitory-evidence-chain-separation-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  objects: {
    GeneratedBundleAcceptance: {
      authorityRef: acceptancePath,
      checkerRef: acceptanceResultPath,
      decisionStatus: acceptance.decisionStatus,
      acceptedGeneratedBundleDigest: acceptedDigest,
      currentGeneratedBundleDigest: currentDigest,
      currentSubjectDiffersFromAcceptedSubject: bundleResult.currentSubjectDiffersFromAcceptedSubject === true
    },
    RuntimeAdmission: {
      authorityRef: runtimeAdmissionPath,
      checkerRef: runtimeAdmissionResultPath,
      runtimeAdmissionStatus: runtimeAdmission.runtimeAdmissionStatus,
      runtimeConsumedBundleDigest: runtimeAdmission.runtimeConsumedBundleDigest,
      runtimeConsumptionReady: runtimeAdmission.runtimeConsumptionReady,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    EvidenceRun: {
      finalReportRef: finalReportPath,
      evidenceGraphRef: evidenceGraphPath,
      lifecycle: finalReportLifecycle,
      bindingStatus: bindingStatusOf(finalReport),
      sourceCommitSha: finalReport.sourceCommitSha,
      evidenceRunSha: finalReport.evidenceRunSha,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    ReleaseCandidate: {
      releaseObjectRef: releaseObjectPath,
      lifecycle: releaseObjectLifecycle,
      bindingStatus: bindingStatusOf(releaseObject),
      releaseAuthority: false,
      finalGoNoGo: "NO_GO",
      releaseAuthorizedEventPresent: releaseAuthorizedEvents.length > 0
    }
  },
  rules: {
    evidenceRunMayChangeWithoutInvalidatingGeneratedBundleAcceptance: true,
    headMayChangeWithoutChangingAcceptedGeneratedBundleDigest: true,
    unchangedBundleMustNotBeReaccepted: true,
    runtimeAdmissionMustNotInferReleaseGo: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory evidence chain separation check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory evidence chain separation check: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function requireNotEqual(actual, forbidden, label) {
  if (actual === forbidden) failures.push(`${label}; both were ${JSON.stringify(actual)}.`);
}

function requireDigest(value, label) {
  if (!/^sha256:[a-f0-9]{64}$/.test(String(value ?? ""))) failures.push(`${label} must be a sha256 digest.`);
}

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/");
}

function lifecycleOf(document) {
  return document?.lifecycle ??
    document?.evidenceLifecycleType ??
    document?.evidenceLifecycle?.lifecycleType ??
    document?.binding?.evidenceLifecycleType ??
    document?.binding?.evidenceLifecycle?.lifecycleType;
}

function bindingStatusOf(document) {
  return document?.bindingStatus ?? document?.releaseBindingStatus ?? document?.binding?.bindingStatus;
}

function acceptedBundleDigestOf(document) {
  return document?.generatedCandidateAcceptance?.acceptedGeneratedBundleDigest ??
    document?.acceptedGeneratedBundleDigest ??
    document?.candidateEvidence?.acceptedGeneratedBundleDigest ??
    document?.capabilityDigestChain?.acceptedGeneratedBundleDigest;
}
