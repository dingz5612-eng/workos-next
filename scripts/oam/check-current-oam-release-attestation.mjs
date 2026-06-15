import fs from "node:fs";
import path from "node:path";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH,
  validateGeneratedCandidateAcceptanceAuthority
} from "./lib/generated-candidate-subject.mjs";
import {
  FIELD_BINDING_CLOSURE_RESULT_PATH,
  FIELD_BINDINGS_GENERATED_PATH,
  buildDormitoryGeneratedFieldBindingClosure
} from "./lib/dormitory-generated-field-binding-closure.mjs";
import {
  DORMITORY_RUNTIME_ADMISSION_PATH,
  DORMITORY_RUNTIME_ADMISSION_RESULT_PATH,
  DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH,
  validateDormitoryRuntimeAdmissionAuthority
} from "./lib/dormitory-runtime-admission.mjs";
import {
  DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH,
  DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_RESULT_PATH,
  DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH,
  validateDormitoryFirstGoldenChainLandingAuthority
} from "./lib/dormitory-first-golden-chain-landing.mjs";

const root = process.cwd();
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
const releaseAttestationPath = "artifacts/oam/evidence/current-oam-release-attestation.json";
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";
const finalReportPath = "artifacts/oam/final-report.json";
const resultPath = "artifacts/oam/checks/current-oam-release-attestation-result.json";
const generatedCandidateAcceptancePath = GENERATED_CANDIDATE_ACCEPTANCE_PATH;
const generatedCandidateAcceptanceResultPath = GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH;
const dormitoryRuntimeAdmissionPath = DORMITORY_RUNTIME_ADMISSION_PATH;
const dormitoryRuntimeAdmissionResultPath = DORMITORY_RUNTIME_ADMISSION_RESULT_PATH;
const dormitoryRuntimeTestOnlyProofPath = DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH;
const dormitoryFirstGoldenChainLandingPath = DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH;
const dormitoryFirstGoldenChainLandingResultPath = DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_RESULT_PATH;
const dormitoryFirstGoldenChainLandingProofPath = DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH;
const pendingExternalAttestation = "pending_external_attestation";
const sha256DigestPattern = /^sha256:[a-f0-9]{64}$/;
const ciRunId = env("GITHUB_RUN_ID") || "local";
const expectedArtifactName = artifactNameForRun(ciRunId);

const violations = [];
const releaseObject = readJson(releaseEvidenceObjectPath);
const attestation = readJson(releaseAttestationPath);
const graph = readJson(evidenceGraphPath);
const finalReport = readJson(finalReportPath);
const generatedCandidateAcceptance = readJson(generatedCandidateAcceptancePath);
const generatedCandidateAcceptanceResult = readJson(generatedCandidateAcceptanceResultPath);
const dormitoryRuntimeAdmission = readJson(dormitoryRuntimeAdmissionPath);
const dormitoryRuntimeAdmissionResult = readJson(dormitoryRuntimeAdmissionResultPath);
const dormitoryRuntimeTestOnlyProof = readJson(dormitoryRuntimeTestOnlyProofPath);
const dormitoryFirstGoldenChainLanding = readJson(dormitoryFirstGoldenChainLandingPath);
const dormitoryFirstGoldenChainLandingResult = readJson(dormitoryFirstGoldenChainLandingResultPath);
const dormitoryFirstGoldenChainLandingProof = readJson(dormitoryFirstGoldenChainLandingProofPath);
const generatedFieldBindingClosureResult = readJson(FIELD_BINDING_CLOSURE_RESULT_PATH);
const generatedFieldBindings = readJson(FIELD_BINDINGS_GENERATED_PATH);
const generatedFieldBindingClosure = buildDormitoryGeneratedFieldBindingClosure({ root });
const generatedCandidateAcceptancePredicate = validateGeneratedCandidateAcceptanceAuthority({
  acceptance: generatedCandidateAcceptance,
  root
});
const dormitoryRuntimeAdmissionPredicate = validateDormitoryRuntimeAdmissionAuthority({
  authority: dormitoryRuntimeAdmission,
  root,
  writeProof: false
});
const dormitoryFirstGoldenChainLandingPredicate = validateDormitoryFirstGoldenChainLandingAuthority({
  authority: dormitoryFirstGoldenChainLanding,
  root,
  writeProof: false
});

checkRequiredFields(attestation, "release attestation", [
  "schemaVersion",
  "kind",
  "artifactName",
  "artifactDigest",
  "evidenceRootDigest",
  "githubArtifactMetadataDigest",
  "githubArtifactDigestStatus",
  "externalArtifactAttestation",
  "evidenceLifecycleType",
  "releaseEvidenceReferenceOnly",
  "workspaceDirtyAtGeneration",
  "zipArtifactDigest",
  "releaseAuthority",
  "dormitoryFirstGoldenChainLandingStatus",
  "businessLandingAuthorityRef",
  "businessLandingResultRef",
  "businessLandingProofRef",
  "businessFeatureDevelopmentAllowed",
  "dormitoryFirstGoldenChainLandingGoNoGo",
  "finalGoNoGo",
  "nextStageAllowed"
]);
checkRequiredFields(releaseObject, "release evidence object", [
  "artifactName",
  "artifactDigest",
  "evidenceRootDigest",
  "githubArtifactMetadataDigest",
  "githubArtifactDigestStatus",
  "externalArtifactAttestation",
  "evidenceLifecycleType",
  "releaseEvidenceReferenceOnly",
  "workspaceDirtyAtGeneration",
  "stale",
  "referenceOnly",
  "bindingStatus",
  "zipArtifactDigest",
  "releaseAuthority",
  "dormitoryFirstGoldenChainLandingStatus",
  "businessLandingAuthorityRef",
  "businessLandingResultRef",
  "businessLandingProofRef",
  "businessFeatureDevelopmentAllowed",
  "dormitoryFirstGoldenChainLandingGoNoGo",
  "finalGoNoGo",
  "nextStageAllowed"
]);

if (attestation?.artifactName !== expectedArtifactName) {
  violations.push(`release attestation artifactName must be ${expectedArtifactName}.`);
}
if (releaseObject?.artifactName !== expectedArtifactName) {
  violations.push(`release evidence object artifactName must be ${expectedArtifactName}.`);
}

const graphArtifactDigest = graph?.binding?.artifactDigest ?? graph?.artifactDigest;
const finalReportArtifactDigest = finalReport?.binding?.artifactDigest ?? finalReport?.artifactDigest;
for (const [label, digest] of [
  ["attestation artifactDigest", attestation?.artifactDigest],
  ["release object artifactDigest", releaseObject?.artifactDigest],
  ["evidence graph artifactDigest", graphArtifactDigest],
  ["final report artifactDigest", finalReportArtifactDigest],
  ["attestation evidenceRootDigest", attestation?.evidenceRootDigest],
  ["release object evidenceRootDigest", releaseObject?.evidenceRootDigest]
]) {
  if (!sha256DigestPattern.test(String(digest ?? ""))) {
    violations.push(`${label} must be a sha256 digest.`);
  }
}

if (attestation?.artifactDigest !== releaseObject?.artifactDigest ||
  attestation?.artifactDigest !== graphArtifactDigest ||
  attestation?.artifactDigest !== finalReportArtifactDigest) {
  violations.push("release attestation, release object, evidence graph, and final report must share the internal artifactDigest.");
}
if (attestation?.evidenceRootDigest !== releaseObject?.evidenceRootDigest) {
  violations.push("release attestation evidenceRootDigest must match release evidence object.");
}
if (attestation?.githubArtifactMetadataDigest !== releaseObject?.githubArtifactMetadataDigest) {
  violations.push("release attestation githubArtifactMetadataDigest must match release evidence object.");
}
if (attestation?.githubArtifactDigestStatus !== releaseObject?.githubArtifactDigestStatus) {
  violations.push("release attestation githubArtifactDigestStatus must match release evidence object.");
}
if (attestation?.externalArtifactAttestation !== releaseObject?.externalArtifactAttestation ||
  attestation?.externalArtifactAttestation !== finalReport?.externalArtifactAttestation) {
  violations.push("release attestation externalArtifactAttestation must match release evidence object and final report.");
}
if (attestation?.evidenceLifecycleType !== releaseObject?.evidenceLifecycleType ||
  attestation?.evidenceLifecycleType !== finalReport?.evidenceLifecycleType) {
  violations.push("release attestation evidenceLifecycleType must match release evidence object and final report.");
}
if (attestation?.zipArtifactDigest !== releaseObject?.zipArtifactDigest) {
  violations.push("release attestation zipArtifactDigest must match release evidence object.");
}

checkExternalDigestSeparation("attestation githubArtifactMetadataDigest", attestation?.githubArtifactMetadataDigest, attestation?.artifactDigest, attestation?.evidenceRootDigest);
checkExternalDigestSeparation("release object githubArtifactMetadataDigest", releaseObject?.githubArtifactMetadataDigest, releaseObject?.artifactDigest, releaseObject?.evidenceRootDigest);
checkExternalDigestSeparation("attestation zipArtifactDigest", attestation?.zipArtifactDigest, attestation?.artifactDigest, attestation?.evidenceRootDigest);
checkExternalDigestSeparation("release object zipArtifactDigest", releaseObject?.zipArtifactDigest, releaseObject?.artifactDigest, releaseObject?.evidenceRootDigest);
if (releaseObject?.githubArtifactDigest && releaseObject.githubArtifactDigest !== pendingExternalAttestation) {
  checkExternalDigestSeparation("release object githubArtifactDigest", releaseObject.githubArtifactDigest, releaseObject?.artifactDigest, releaseObject?.evidenceRootDigest);
}

if (attestation?.githubArtifactDigestStatus === pendingExternalAttestation) {
  if (attestation.externalArtifactAttestation !== "PENDING_EXTERNAL_ATTESTATION") {
    violations.push("pending external attestation must keep externalArtifactAttestation=PENDING_EXTERNAL_ATTESTATION.");
  }
  if (attestation.githubArtifactMetadataDigest !== pendingExternalAttestation) {
    violations.push("pending external attestation must keep githubArtifactMetadataDigest=pending_external_attestation.");
  }
  if (releaseObject?.githubArtifactMetadataDigest !== pendingExternalAttestation) {
    violations.push("pending release object must keep githubArtifactMetadataDigest=pending_external_attestation.");
  }
} else if (attestation?.githubArtifactDigestStatus === "attested") {
  if (attestation.externalArtifactAttestation !== "ATTESTED") {
    violations.push("attested release attestation must use externalArtifactAttestation=ATTESTED.");
  }
  if (!sha256DigestPattern.test(String(attestation.githubArtifactMetadataDigest ?? ""))) {
    violations.push("attested release attestation must carry sha256 githubArtifactMetadataDigest.");
  }
} else {
  violations.push(`release attestation githubArtifactDigestStatus invalid: ${attestation?.githubArtifactDigestStatus ?? "missing"}.`);
}

if (attestation?.releaseAuthority !== false || releaseObject?.releaseAuthority !== false) {
  violations.push("current OAM release attestation must keep releaseAuthority=false.");
}
if (attestation?.evidenceLifecycleType !== "ci-release" &&
  (releaseObject?.bindingStatus === "current" || releaseObject?.stale === false || releaseObject?.referenceOnly === false)) {
  violations.push("non-ci release evidence must remain stale/referenceOnly.");
}
if ((attestation?.workspaceDirtyAtGeneration === true || releaseObject?.workspaceDirtyAtGeneration === true) &&
  (attestation?.releaseAuthority !== false || releaseObject?.releaseAuthority !== false)) {
  violations.push("dirty workspace release attestation must force releaseAuthority=false.");
}
if (attestation?.finalGoNoGo !== "NO_GO" || releaseObject?.finalGoNoGo !== "NO_GO" || finalReport?.finalGoNoGo !== "NO_GO") {
  violations.push("release attestation must not convert CI/artifact/final report evidence into GO.");
}
if (generatedCandidateAcceptancePredicate.status !== "PASS" ||
  generatedCandidateAcceptanceResult?.status !== "PASS") {
  violations.push("release attestation must only reference a PASS generated candidate acceptance checker result.");
}
if (generatedFieldBindingClosure.status !== "PASS" ||
  generatedFieldBindingClosureResult?.status !== "PASS" ||
  generatedFieldBindings?.generatedFieldBindingClosureDigest !== generatedFieldBindingClosure.closureDigest) {
  violations.push("release attestation requires generated field binding closure PASS.");
}
if (finalReport?.generatedFieldBindingClosureRequired !== true ||
  finalReport?.generatedFieldBindingClosureStatus !== "PASS" ||
  finalReport?.generatedFieldBindingClosureDigest !== generatedFieldBindingClosure.closureDigest ||
  finalReport?.sourceFieldGapsDecisionDigest !== generatedFieldBindingClosure.sourceFieldGapsDecisionDigest ||
  finalReport?.s4AttestationIsFinalReleaseEvidence !== false ||
  finalReport?.releaseEvidenceRequiredAfterS4 !== true) {
  violations.push("final report must mirror generated field binding closure and S4 attestation/release-evidence separation.");
}
if (finalReport?.generatedCandidateAcceptedBy00 !== generatedCandidateAcceptancePredicate.generatedCandidateAcceptedBy00) {
  violations.push("final report generatedCandidateAcceptedBy00 must mirror generated candidate acceptance authority.");
}
if (dormitoryRuntimeAdmissionPredicate.status !== "PASS" ||
  dormitoryRuntimeAdmissionResult?.status !== "PASS" ||
  dormitoryRuntimeTestOnlyProof?.status !== "PASS") {
  violations.push("release attestation must only reference a PASS dormitory runtime admission checker and proof.");
}
if (finalReport?.runtimeAdmissionStatus !== dormitoryRuntimeAdmissionPredicate.runtimeAdmissionStatus ||
  finalReport?.runtimeConsumptionReady !== dormitoryRuntimeAdmissionPredicate.runtimeConsumptionReady ||
  attestation?.runtimeAdmissionStatus !== dormitoryRuntimeAdmissionPredicate.runtimeAdmissionStatus ||
  releaseObject?.runtimeAdmissionStatus !== dormitoryRuntimeAdmissionPredicate.runtimeAdmissionStatus ||
  attestation?.runtimeAdmissionAuthorityRef !== dormitoryRuntimeAdmissionPath ||
  releaseObject?.runtimeAdmissionAuthorityRef !== dormitoryRuntimeAdmissionPath ||
  attestation?.runtimeAdmissionResultRef !== dormitoryRuntimeAdmissionResultPath ||
  releaseObject?.runtimeAdmissionResultRef !== dormitoryRuntimeAdmissionResultPath ||
  attestation?.testOnlyConsumptionProofRef !== dormitoryRuntimeTestOnlyProofPath ||
  releaseObject?.testOnlyConsumptionProofRef !== dormitoryRuntimeTestOnlyProofPath) {
  violations.push("release attestation, release object, and final report must mirror dormitory runtime admission authority.");
}
if (dormitoryFirstGoldenChainLandingPredicate.status !== "PASS" ||
  dormitoryFirstGoldenChainLandingResult?.status !== "PASS" ||
  dormitoryFirstGoldenChainLandingProof?.status !== "PASS") {
  violations.push("release attestation must only reference a PASS dormitory first golden chain landing checker and proof.");
}
if (finalReport?.dormitoryFirstGoldenChainLandingStatus !== dormitoryFirstGoldenChainLandingPredicate.landingStatus ||
  finalReport?.businessFeatureDevelopmentAllowed !== dormitoryFirstGoldenChainLandingPredicate.businessFeatureDevelopmentAllowed ||
  finalReport?.dormitoryFirstGoldenChainLandingGoNoGo !== dormitoryFirstGoldenChainLandingPredicate.dormitoryFirstGoldenChainLandingGoNoGo ||
  attestation?.dormitoryFirstGoldenChainLandingStatus !== dormitoryFirstGoldenChainLandingPredicate.landingStatus ||
  releaseObject?.dormitoryFirstGoldenChainLandingStatus !== dormitoryFirstGoldenChainLandingPredicate.landingStatus ||
  attestation?.businessLandingAuthorityRef !== dormitoryFirstGoldenChainLandingPath ||
  releaseObject?.businessLandingAuthorityRef !== dormitoryFirstGoldenChainLandingPath ||
  attestation?.businessLandingResultRef !== dormitoryFirstGoldenChainLandingResultPath ||
  releaseObject?.businessLandingResultRef !== dormitoryFirstGoldenChainLandingResultPath ||
  attestation?.businessLandingProofRef !== dormitoryFirstGoldenChainLandingProofPath ||
  releaseObject?.businessLandingProofRef !== dormitoryFirstGoldenChainLandingProofPath ||
  attestation?.businessFeatureDevelopmentAllowed !== dormitoryFirstGoldenChainLandingPredicate.businessFeatureDevelopmentAllowed ||
  releaseObject?.businessFeatureDevelopmentAllowed !== dormitoryFirstGoldenChainLandingPredicate.businessFeatureDevelopmentAllowed ||
  attestation?.dormitoryFirstGoldenChainLandingGoNoGo !== dormitoryFirstGoldenChainLandingPredicate.dormitoryFirstGoldenChainLandingGoNoGo ||
  releaseObject?.dormitoryFirstGoldenChainLandingGoNoGo !== dormitoryFirstGoldenChainLandingPredicate.dormitoryFirstGoldenChainLandingGoNoGo) {
  violations.push("release attestation, release object, and final report must mirror dormitory first golden chain landing authority.");
}
if (generatedCandidateAcceptancePredicate.generatedCandidateAcceptedBy00 === true &&
  (attestation?.releaseAuthority !== false || releaseObject?.releaseAuthority !== false || finalReport?.releaseAuthority !== false)) {
  violations.push("generated candidate acceptance must not grant releaseAuthority.");
}
if (dormitoryRuntimeAdmissionPredicate.runtimeConsumptionReady === true &&
  (attestation?.releaseAuthority !== false || releaseObject?.releaseAuthority !== false || finalReport?.releaseAuthority !== false ||
    finalReport?.productionConfirmAllowed !== false ||
    finalReport?.finalGoNoGo !== "NO_GO")) {
  violations.push("runtime admission must not grant production confirmation, releaseAuthority, or final GO.");
}
if (attestation?.nextStageAllowed !== false || releaseObject?.nextStageAllowed !== false || finalReport?.nextStageAllowed !== false) {
  violations.push("release attestation must keep nextStageAllowed=false.");
}
if (attestation?.details?.ciGreenDoesNotEqualGo !== true ||
  attestation?.details?.finalReportExistsDoesNotEqualGo !== true) {
  violations.push("release attestation must explicitly prove CI green and Final Report exists do not equal GO.");
}

writeResult(violations);
if (violations.length > 0) {
  console.error("Current OAM release attestation check: FAIL");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Current OAM release attestation check: PASS");

function checkRequiredFields(document, label, fields) {
  if (!document || typeof document !== "object") {
    violations.push(`${label} is missing or invalid.`);
    return;
  }
  for (const field of fields) {
    if (document[field] === undefined || document[field] === null || document[field] === "") {
      violations.push(`${label} missing ${field}.`);
    }
  }
}

function checkExternalDigestSeparation(label, digest, artifactDigest, evidenceRootDigest) {
  if (!digest) return;
  if (digest === pendingExternalAttestation) return;
  if (!sha256DigestPattern.test(String(digest))) {
    violations.push(`${label} must be sha256 or pending_external_attestation.`);
    return;
  }
  if (digest === artifactDigest) {
    violations.push(`${label} must not equal internal artifactDigest.`);
  }
  if (digest === evidenceRootDigest) {
    violations.push(`${label} must not equal evidenceRootDigest.`);
  }
}

function writeResult(currentViolations) {
  const result = {
    schemaVersion: "current-oam.release-attestation-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: currentViolations.length === 0 ? "passed" : "failed",
    checkedArtifacts: [
      releaseEvidenceObjectPath,
      releaseAttestationPath,
      evidenceGraphPath,
      finalReportPath
    ],
    proves: [
      "artifactDigest is the internal evidence package digest.",
      "evidenceRootDigest is the evidence root digest.",
      "githubArtifactMetadataDigest is external GitHub artifact metadata evidence and is not reused as internal digest.",
      "zipArtifactDigest is external zip content evidence and is not reused as internal digest.",
      "generated candidate acceptance authority is separate from releaseAuthority.",
      "CI green, artifact exists, browser evidence, and Final Report exists do not equal GO."
    ],
    violations: currentViolations
  };
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify(result, null, 2)}\n`);
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    violations.push(`missing required file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    violations.push(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function artifactNameForRun(runId) {
  return runId === "local" ? "workosnext-current-oam-evidence-local" : `workosnext-current-oam-evidence-${runId}`;
}

function env(name) {
  return process.env[name] || "";
}
