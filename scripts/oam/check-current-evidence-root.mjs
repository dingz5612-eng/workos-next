import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { validateFormalGeneratedCompileAuthorization } from "./lib/formal-generated-compile-authorization.mjs";
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
  DORMITORY_L1_LANDING_APPROVED_STATUS,
  allowedDormitoryBusinessLandingWorkItemTypes,
  validateDormitoryFirstGoldenChainLandingAuthority
} from "./lib/dormitory-first-golden-chain-landing.mjs";

const root = process.cwd();
const digestPlaceholder = "__CURRENT_OAM_EVIDENCE_DIGEST__";
const controlPlaneGateResultPath = "artifacts/oam/checks/control-plane-gate-results.json";
const ciRunId = env("GITHUB_RUN_ID") || "local";
const ciRunAttempt = env("GITHUB_RUN_ATTEMPT") || "local";
const expectedRepository = env("GITHUB_REPOSITORY") || "";
const expectedWorkflow = env("GITHUB_WORKFLOW") || "CI";
const expectedArtifactName = artifactNameForRun(ciRunId);
const currentRepositoryHead = env("GITHUB_SHA") || git("rev-parse HEAD") || "local";
const candidateEvidenceObjectPath = "artifacts/oam/evidence/current-oam-candidate-evidence-object.json";
const commitAttestationPath = "artifacts/oam/evidence/current-oam-commit-attestation.json";
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
const releaseAttestationPath = "artifacts/oam/evidence/current-oam-release-attestation.json";
const evidenceLifecycleProofPath = "artifacts/oam/evidence/evidence-lifecycle-proof.json";
const generatedCompileApprovalPath = "docs/oam/generated-compile-approval.current.json";
const generatedCompileCandidateApprovalPath = "docs/oam/generated-compile-candidate-approval.current.json";
const generatedCandidateAcceptancePath = GENERATED_CANDIDATE_ACCEPTANCE_PATH;
const generatedCandidateAcceptanceResultPath = GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH;
const dormitoryRuntimeAdmissionPath = DORMITORY_RUNTIME_ADMISSION_PATH;
const dormitoryRuntimeAdmissionResultPath = DORMITORY_RUNTIME_ADMISSION_RESULT_PATH;
const dormitoryRuntimeTestOnlyProofPath = DORMITORY_RUNTIME_TEST_ONLY_PROOF_PATH;
const dormitoryFirstGoldenChainLandingPath = DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH;
const dormitoryFirstGoldenChainLandingResultPath = DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_RESULT_PATH;
const dormitoryFirstGoldenChainLandingProofPath = DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PROOF_PATH;
const generatedCompileExecutionSnapshotPath = "artifacts/oam/checks/generated-compile-execution-input-snapshot.json";
const generatedCompileExecutionResultPath = "artifacts/oam/checks/generated-compile-execution-result.json";
const generatedCompileExecutionProofPath = "artifacts/oam/evidence/generated-compile-execution-proof.json";
const generatedFieldBindingClosureResultPath = FIELD_BINDING_CLOSURE_RESULT_PATH;
const generatedFieldBindingsPath = FIELD_BINDINGS_GENERATED_PATH;
const firstGoldenChainTestPlanPath = "docs/contracts/generated/dormitory/test-plan.generated.json";
const firstGoldenChainBrowserAuditReportPath =
  "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/first-golden-chain-real-browser-report.json";
const firstGoldenChainBrowserAuditScreenshotIndexPath =
  "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/screenshot-index.json";
const firstGoldenChainBrowserAuditResultPath =
  "artifacts/oam/checks/dormitory-first-golden-chain-real-browser-result.json";
const testPlanGeneratedFromCapabilityResultPath =
  "artifacts/oam/checks/test-plan-generated-from-capability-result.json";
const evidenceDigestChainSingleSourceResultPath =
  "artifacts/oam/checks/evidence-digest-chain-single-source-result.json";
const capabilityStateMachinePath = "docs/oam/capabilities/dormitory-first-golden-chain.state-machine.json";
const gateLaneTaxonomyPath = "docs/oam/control-plane/gate-lane-taxonomy.current.json";
const runtimeStabilityLanePath = "docs/oam/runtime-stability-lane.current.json";
const evidenceProjectionPolicyPath = "docs/oam/evidence-projection-policy.current.json";
const environmentProfilePath = "docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json";
const generatedBundleContentAddressedResultPath = "artifacts/oam/checks/generated-bundle-content-addressed-result.json";
const runtimeConsumesAcceptedBundleResultPath = "artifacts/oam/checks/runtime-consumes-accepted-bundle-result.json";
const environmentProfileAuthorityResultPath = "artifacts/oam/checks/environment-profile-authority-result.json";
const capabilityStateMachineTransitionResultPath = "artifacts/oam/checks/capability-state-machine-transition-result.json";
const capabilityAuthorityStateConsistencyResultPath =
  "artifacts/oam/checks/capability-authority-state-consistency-result.json";
const controlPlaneLaneBoundaryResultPath = "artifacts/oam/checks/control-plane-lane-boundary-result.json";
const gateTaxonomyResultPath = "artifacts/oam/checks/gate-taxonomy-result.json";
const runtimeStabilityLaneResultPath = "artifacts/oam/checks/runtime-stability-lane-result.json";
const runtimeImplementationDriftPolicyResultPath = "artifacts/oam/checks/runtime-implementation-drift-policy-result.json";
const evidenceIsProjectionOnlyResultPath = "artifacts/oam/checks/evidence-is-projection-only-result.json";
const releaseAuthorityFinalGoSourceResultPath = "artifacts/oam/checks/release-authority-is-only-final-go-source-result.json";
const currentHeadAuthoritativeArtifactReconciliationResultPath =
  "artifacts/oam/checks/current-head-authoritative-artifact-reconciliation-result.json";
const pendingExternalAttestation = "pending_external_attestation";
const candidateCompileEvidenceStatuses = new Set(["CURRENT", "STALE_BUT_NO_GO", "STALE_REFERENCE"]);
const sha256DigestPattern = /^sha256:[a-f0-9]{64}$/;
const bareSha256Pattern = /^[a-f0-9]{64}$/;
const currentWorkspaceDirty = git("status --porcelain").trim().length > 0;
const allowedNodeStatuses = new Set(["passed", "blocked", "failed", "missing_or_failed", "bound", "required", "missing"]);
const requiredFiles = [
  "artifacts/oam/evidence/evidence-graph.json",
  candidateEvidenceObjectPath,
  commitAttestationPath,
  releaseEvidenceObjectPath,
  releaseAttestationPath,
  evidenceLifecycleProofPath,
  "artifacts/oam/evidence/execution-log.jsonl",
  "artifacts/oam/evidence/current-oam-final-report.json",
  "artifacts/oam/evidence/admission-p0-proof.json",
  "artifacts/oam/evidence/runtime-proof.json",
  "artifacts/oam/evidence/truth-ownership-proof.json",
  "artifacts/oam/evidence/search-readonly-proof.json",
  "artifacts/oam/proofs/search/search-derived-readmodel-only-proof.json",
  "artifacts/oam/proofs/search/search-no-kernel-direct-read-proof.json",
  "artifacts/oam/proofs/search/search-permission-filter-proof.json",
  "artifacts/oam/proofs/search/search-hidden-result-ranking-proof.json",
  "artifacts/oam/proofs/search/search-sensitive-redaction-proof.json",
  "artifacts/oam/proofs/search/search-lineage-freshness-proof.json",
  "artifacts/oam/proofs/read-intelligence/oam-object-envelope-proof.json",
  "artifacts/oam/evidence/surface-language-proof.json",
  "artifacts/oam/evidence/high-risk-trust-proof.json",
  "artifacts/oam/evidence/master-design-proof.json",
  "artifacts/oam/evidence/master-outline-proof.json",
  "artifacts/oam/proofs/bi-kpi/metric-definition-registry-proof.json",
  "artifacts/oam/proofs/dashboard/dashboard-widget-sourcefacts-proof.json",
  "artifacts/oam/proofs/report/report-dataset-permission-lineage-freshness-proof.json",
  "artifacts/oam/proofs/language/language-glossary-generated-proof.json",
  "docs/oam/current-oam-kernel-responsibility-map.json",
  "docs/oam/current-oam-cross-domain-conflict-rules.json",
  "docs/oam/professional-ai-review-seats.json",
  "docs/oam/codex-execution-channel-policy.json",
  "docs/finance/finance-ledger-kernel.json",
  "docs/contracts/admission/admission-contract.json",
  "docs/business/policies/admission-policy.yml",
  "docs/oam/compiler-generated-contract-kernel.json",
  "docs/oam/file-lifecycle-policy.json",
  "docs/identity/identity-permission-kernel.json",
  "docs/oam/kernel/oam-kernel-source.schema.json",
  "docs/oam/kernel/oam-kernel-generated.schema.json",
  "docs/oam/system-derived-contracts.json",
  "docs/oam/domain-derived-contracts.json",
  "docs/oam/generated-contracts-manifest.json",
  "artifacts/oam/authority-cleanup/source-layer-audit.json",
  "artifacts/oam/authority-cleanup/mutation-tests-result.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  generatedFieldBindingsPath,
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  firstGoldenChainTestPlanPath,
  firstGoldenChainBrowserAuditReportPath,
  firstGoldenChainBrowserAuditResultPath,
  testPlanGeneratedFromCapabilityResultPath,
  evidenceDigestChainSingleSourceResultPath,
  "docs/read-intelligence/read-intelligence-kernel.json",
  "docs/read-intelligence/read-intelligence-kernel.schema.json",
  "docs/oam/db-no-side-effects-proof.json",
  generatedCompileApprovalPath,
  generatedCompileCandidateApprovalPath,
  generatedCandidateAcceptancePath,
  generatedCandidateAcceptanceResultPath,
  dormitoryRuntimeAdmissionPath,
  dormitoryRuntimeAdmissionResultPath,
  dormitoryRuntimeTestOnlyProofPath,
  dormitoryFirstGoldenChainLandingPath,
  dormitoryFirstGoldenChainLandingResultPath,
  dormitoryFirstGoldenChainLandingProofPath,
  "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json",
  "artifacts/oam/checks/generated-compile-authorization-result.json",
  generatedCompileExecutionSnapshotPath,
  generatedCompileExecutionResultPath,
  generatedCompileExecutionProofPath,
  generatedFieldBindingClosureResultPath,
  "artifacts/oam/checks/generated-files-not-manually-edited-result.json",
  "artifacts/oam/checks/generated-contract-consistency-result.json",
  "docs/oam/evidence-attestation-packages/dormitory-golden-chain-2b7bc377.attestation.json",
  "artifacts/oam/checks/dormitory-candidate-artifact-attestation-package-result.json",
  capabilityStateMachinePath,
  gateLaneTaxonomyPath,
  runtimeStabilityLanePath,
  evidenceProjectionPolicyPath,
  environmentProfilePath,
  generatedBundleContentAddressedResultPath,
  runtimeConsumesAcceptedBundleResultPath,
  environmentProfileAuthorityResultPath,
  capabilityStateMachineTransitionResultPath,
  capabilityAuthorityStateConsistencyResultPath,
  controlPlaneLaneBoundaryResultPath,
  gateTaxonomyResultPath,
  runtimeStabilityLaneResultPath,
  runtimeImplementationDriftPolicyResultPath,
  evidenceIsProjectionOnlyResultPath,
  releaseAuthorityFinalGoSourceResultPath,
  currentHeadAuthoritativeArtifactReconciliationResultPath,
  "artifacts/oam/checks/kernel-responsibility-map-result.json",
  "artifacts/oam/checks/professional-ai-review-seats-result.json",
  "artifacts/oam/checks/codex-execution-channel-policy-result.json",
  "artifacts/oam/checks/cross-domain-conflict-rules-result.json",
  "artifacts/oam/checks/dashboard-readonly-report.json",
  "docs/oam/mobile-branch-risk-policy.json",
  "docs/oam/mobile-branch-risk-ledger.json",
  "docs/oam/mobile-critical-branch-scenarios.json",
  "artifacts/oam/test-results/mobile/coverage/coverage-summary.json",
  "artifacts/oam/checks/mobile-coverage-policy-result.json",
  "artifacts/oam/checks/mobile-critical-branch-scenarios-result.json",
  controlPlaneGateResultPath,
  "artifacts/oam/final-report.json"
];

const failures = [];
const documents = new Map();

for (const file of requiredFiles) {
  if (!exists(file)) {
    failures.push(`missing evidence file: ${file}`);
    continue;
  }
  documents.set(file, file.endsWith(".jsonl") ? readJsonl(file) : readJson(file));
}

if (documents.size === requiredFiles.length) {
  const graph = documents.get("artifacts/oam/evidence/evidence-graph.json");
  const finalReport = documents.get("artifacts/oam/final-report.json");
  const candidateObject = documents.get(candidateEvidenceObjectPath);
  const commitAttestation = documents.get(commitAttestationPath);
  const releaseObject = documents.get(releaseEvidenceObjectPath);
  const releaseAttestation = documents.get(releaseAttestationPath);
  const evidenceLifecycleProof = documents.get(evidenceLifecycleProofPath);
  const formalApproval = documents.get(generatedCompileApprovalPath);
  const mutationTestsResult = documents.get("artifacts/oam/authority-cleanup/mutation-tests-result.json");
  const responsibilityMap = documents.get("docs/oam/current-oam-kernel-responsibility-map.json");
  const controlPlaneGateResult = documents.get(controlPlaneGateResultPath);
  const expectedDigest = graph?.binding?.artifactDigest;
  const actualDigest = digestFor(documents);
  const formalAuthorization = validateFormalGeneratedCompileAuthorization({
    approval: formalApproval,
    candidateApproval: documents.get(generatedCompileCandidateApprovalPath),
    currentHead: currentRepositoryHead,
    approvalPath: generatedCompileApprovalPath,
    candidateApprovalPath: generatedCompileCandidateApprovalPath
  });
  const generatedCompileExecution = generatedCompileExecutionState(documents, formalAuthorization);
  const generatedFieldBindingClosure = generatedFieldBindingClosureState(documents);
  const generatedCandidateAcceptance = validateGeneratedCandidateAcceptanceAuthority({
    acceptance: documents.get(generatedCandidateAcceptancePath),
    root,
    currentHead: currentRepositoryHead
  });
  const dormitoryRuntimeAdmission = validateDormitoryRuntimeAdmissionAuthority({
    authority: documents.get(dormitoryRuntimeAdmissionPath),
    root,
    currentHead: currentRepositoryHead,
    writeProof: false
  });
  const dormitoryFirstGoldenChainLanding = validateDormitoryFirstGoldenChainLandingAuthority({
    authority: documents.get(dormitoryFirstGoldenChainLandingPath),
    root,
    currentHead: currentRepositoryHead,
    writeProof: false
  });
  const businessFeatureDevelopmentAllowed =
    dormitoryFirstGoldenChainLanding.businessFeatureDevelopmentAllowed === true;
  const dormitoryFirstGoldenChainLandingGoNoGo =
    dormitoryFirstGoldenChainLanding.dormitoryFirstGoldenChainLandingGoNoGo === "GO" ? "GO" : "NO_GO";

  if (!expectedDigest || expectedDigest !== actualDigest) {
    failures.push(`artifact digest mismatch: expected ${expectedDigest || "missing"}, actual ${actualDigest}`);
  }

  for (const [file, document] of documents) {
    if (!requiresEvidenceBinding(file)) continue;
    checkBinding(file, document, expectedDigest);
    checkSummaries(file, document);
  }
  checkExecutionLog(readJsonl("artifacts/oam/evidence/execution-log.jsonl"), expectedDigest);

  for (const file of requiredFiles) {
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing required file ref: ${file}`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO") {
    failures.push(`final report must remain NO_GO for the current stage, actual: ${finalReport.finalGoNoGo}`);
  }
  if (!["PASS", "FAIL"].includes(finalReport.architectureGateStatus)) {
    failures.push(`final report architectureGateStatus must be PASS or FAIL, actual: ${finalReport.architectureGateStatus ?? "missing"}.`);
  }
  if (finalReport.sourceFinalizationStatus !== "SOURCE_FINALIZED_BY_00" && finalReport.sourceFinalizationStatus !== "CONDITIONAL_NO_PASS") {
    failures.push(`final report sourceFinalizationStatus invalid: ${finalReport.sourceFinalizationStatus ?? "missing"}.`);
  }
  if (finalReport.sourceScenarioPackageReviewStatus !== "SOURCE_FINALIZED_BY_00" && finalReport.sourceScenarioPackageReviewStatus !== "CONDITIONAL_NO_PASS") {
    failures.push(`final report sourceScenarioPackageReviewStatus invalid: ${finalReport.sourceScenarioPackageReviewStatus ?? "missing"}.`);
  }
  if (finalReport.sourceFieldGapsDecisionStatus !== "DECIDED_AND_BOUND") {
    failures.push("final report sourceFieldGapsDecisionStatus must be DECIDED_AND_BOUND.");
  }
  if (finalReport.sourceReadyForCompileDecision !== true) {
    failures.push("final report sourceReadyForCompileDecision must be true for 00 generated compile decision readiness.");
  }
  if (finalReport.compileDecisionStatus !== "READY_FOR_00_COMPILE_DECISION" || finalReport.compilePreparationAllowed !== "READY_FOR_00_COMPILE_DECISION") {
    failures.push("final report compile status must be READY_FOR_00_COMPILE_DECISION.");
  }
  const formalGeneratedCompileAuthorized = formalAuthorization.authorized;
  if (finalReport.generatedCompileAuthorized !== formalGeneratedCompileAuthorized) {
    failures.push(`final report generatedCompileAuthorized must mirror formal approval (${formalGeneratedCompileAuthorized}).`);
  }
  if (finalReport.generatedCompilationAllowed !== formalGeneratedCompileAuthorized) {
    failures.push(`final report generatedCompilationAllowed must mirror formal approval (${formalGeneratedCompileAuthorized}).`);
  }
  const expectedGeneratedCompilationReadiness = generatedCompileExecution.completed
    ? "FORMAL_GENERATED_COMPILE_EXECUTED_PENDING_00_GENERATED_CANDIDATE_ACCEPTANCE"
    : formalGeneratedCompileAuthorized
      ? "AUTHORIZED_PENDING_GENERATED_COMPILE_EXECUTION"
      : "NOT_STARTED_OR_NOT_AUTHORIZED";
  if (finalReport.generatedCompilationReadiness !== expectedGeneratedCompilationReadiness) {
    failures.push(`final report generatedCompilationReadiness must be ${expectedGeneratedCompilationReadiness}.`);
  }
  if (finalReport.generatedCompilationCompleted !== generatedCompileExecution.completed) {
    failures.push(`final report generatedCompilationCompleted must mirror formal compile execution proof (${generatedCompileExecution.completed}).`);
  }
  if (finalReport.generatedCompileCompleted !== generatedCompileExecution.completed) {
    failures.push(`final report generatedCompileCompleted must mirror formal compile execution proof (${generatedCompileExecution.completed}).`);
  }
  const expectedGeneratedContractStatus10B = generatedCompileExecution.completed
    ? "GENERATED_COMPILE_EXECUTED_PENDING_00_CANDIDATE_ACCEPTANCE"
    : "PENDING_GENERATED_CONTRACT";
  if (finalReport.generatedContractStatus10B !== expectedGeneratedContractStatus10B) {
    failures.push(`final report generatedContractStatus10B must be ${expectedGeneratedContractStatus10B}.`);
  }
  if (finalReport.runtimeConsumptionReady !== dormitoryRuntimeAdmission.runtimeConsumptionReady) {
    failures.push("final report runtimeConsumptionReady must mirror dormitory runtime admission authority.");
  }
  if (finalReport.businessFeatureDevelopmentAllowed !== businessFeatureDevelopmentAllowed) {
    failures.push("final report businessFeatureDevelopmentAllowed must mirror dormitory first golden chain landing authority.");
  }
  if (finalReport.dormitoryFirstGoldenChainLandingGoNoGo !== dormitoryFirstGoldenChainLandingGoNoGo) {
    failures.push("final report dormitoryFirstGoldenChainLandingGoNoGo must mirror dormitory first golden chain landing authority.");
  }
  if (!["PENDING_EXTERNAL_ATTESTATION", "ATTESTED"].includes(finalReport.externalArtifactAttestation)) {
    failures.push(`final report externalArtifactAttestation invalid: ${finalReport.externalArtifactAttestation ?? "missing"}.`);
  }
  if (ciRunId === "local" && finalReport.externalArtifactAttestation !== "PENDING_EXTERNAL_ATTESTATION") {
    failures.push("current local final report must keep externalArtifactAttestation=PENDING_EXTERNAL_ATTESTATION.");
  }
  if (finalReport.releaseAuthority !== false) {
    failures.push("final report releaseAuthority must remain false.");
  }
  checkDormitoryGoldenChainSourcePackage(finalReport);
  checkSourceFormalGeneratedCompileSemanticSeparation(finalReport, generatedCompileExecution);
  checkGeneratedCompileCandidate(finalReport, graph, documents);
  checkFormalGeneratedCompileAuthorization(finalReport, graph, documents, formalAuthorization);
  checkGeneratedFieldBindingClosure(finalReport, graph, documents, generatedFieldBindingClosure);
  checkGeneratedCompileExecution(finalReport, graph, documents, generatedCompileExecution);
  checkGeneratedCandidateAcceptance(finalReport, graph, documents, generatedCandidateAcceptance);
  checkDormitoryRuntimeAdmission(finalReport, graph, documents, dormitoryRuntimeAdmission);
  checkDormitoryFirstGoldenChainLanding(finalReport, graph, documents, dormitoryFirstGoldenChainLanding);

  checkArtifactName("final report", finalReport.artifactName);
  checkCandidateEvidenceObject(candidateObject, graph, finalReport);
  checkCommitAttestation(commitAttestation, candidateObject, graph, finalReport);
  checkReleaseEvidenceObject(releaseObject, graph, finalReport, documents, dormitoryRuntimeAdmission, dormitoryFirstGoldenChainLanding);
  checkReleaseAttestation(releaseAttestation, releaseObject, graph, dormitoryRuntimeAdmission, dormitoryFirstGoldenChainLanding);
  checkEvidenceLifecycleProof(evidenceLifecycleProof, graph, finalReport, releaseObject);
  checkReadonlyOrdinaryCheckers();
  checkEvidenceBindingConsistency(graph, releaseObject, finalReport, expectedDigest);
  checkEvidenceGraphNodes(graph, finalReport);
  checkControlPlaneStateMachine(controlPlaneGateResult, finalReport, graph);

  if (Array.isArray(finalReport.unresolvedP0) && finalReport.unresolvedP0.length > 0) {
    failures.push(`final report has unresolved P0: ${finalReport.unresolvedP0.map((item) => item.ruleId).join(", ")}`);
  }

  checkFinalDecision(finalReport);
  checkFinalReportMultiStatus(finalReport, candidateObject, commitAttestation, releaseObject);
  checkMutationTests(finalReport, graph, mutationTestsResult);
  checkFinalReportGoNoGoFields(finalReport, responsibilityMap);
  checkWorkstreamProofNodes(graph, responsibilityMap, finalReport);
  checkRealBrowserEvidence(graph, finalReport);
  checkCapabilityDigestChain(graph, finalReport, releaseObject, documents);

  if (finalReport.businessProductionStatus !== "BLOCKED") {
    failures.push("Business Production must remain BLOCKED.");
  }

  if (finalReport.dormitoryL2Status !== "BLOCKED") {
    failures.push("Dormitory L2 must remain BLOCKED.");
  }

  if (finalReport.productionConfirmAllowed !== false) {
    failures.push("production_confirm must remain false.");
  }

  if (finalReport.businessProductionGoNoGo !== "NO_GO") {
    failures.push("businessProductionGoNoGo must remain NO_GO.");
  }

  if (finalReport.dormitoryL2GoNoGo !== "NO_GO") {
    failures.push("dormitoryL2GoNoGo must remain NO_GO.");
  }

  if (finalReport.productionConfirmGoNoGo !== "NO_GO") {
    failures.push("productionConfirmGoNoGo must remain NO_GO.");
  }

  if (finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("finalGoNoGo must remain NO_GO for the current stage.");
  }

  if (finalReport.nextStageAllowed !== false) {
    failures.push("final report nextStageAllowed must be boolean false.");
  }

  if (graph.nextStageAllowed !== false) {
    failures.push("evidence graph nextStageAllowed must be boolean false.");
  }

  if (!workflowContainsEvidenceUpload()) {
    failures.push("CI workflow must generate, check, and upload current OAM evidence root.");
  }

  if (!controlPlaneContainsEvidenceRoot()) {
    failures.push("Control plane gate must generate and check current OAM evidence root.");
  }

  checkMobileBranchRiskKernel(graph, finalReport);
}

if (failures.length > 0) {
  console.error("Current OAM evidence root check: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Current OAM evidence root check: PASS");

function checkArtifactName(label, artifactName) {
  if (artifactName !== expectedArtifactName) {
    failures.push(`${label} artifactName must be ${expectedArtifactName}, actual: ${artifactName || "missing"}`);
  }
  if (artifactName === "current-oam-evidence") {
    failures.push(`${label} artifactName must not be current-oam-evidence.`);
  }
  if (String(artifactName ?? "").includes("${{")) {
    failures.push(`${label} artifactName must be concrete and must not contain a GitHub expression literal.`);
  }
}

function checkCandidateEvidenceObject(candidateObject, graph, finalReport) {
  if (!candidateObject || typeof candidateObject !== "object") {
    failures.push("candidate evidence object is missing or invalid.");
    return;
  }
  if (candidateObject.proofType !== "candidate-evidence") {
    failures.push("candidate evidence object proofType must be candidate-evidence.");
  }
  if (candidateObject.releaseAuthority !== false) {
    failures.push("candidate evidence object must not grant releaseAuthority.");
  }
  if ("githubArtifactDigest" in candidateObject || "githubArtifactMetadataDigest" in candidateObject) {
    failures.push("candidate evidence object must not bind GitHub artifact digest fields.");
  }
  if (!["PASS", "FAIL"].includes(candidateObject.candidateStatus)) {
    failures.push(`candidate evidence object candidateStatus invalid: ${candidateObject.candidateStatus || "missing"}.`);
  }
  if (candidateObject.candidateReadyForRelease !== false) {
    failures.push("candidate evidence object candidateReadyForRelease must remain false.");
  }
  if (candidateObject.candidateReadyForBusinessImplementation !== false) {
    failures.push("candidate evidence object candidateReadyForBusinessImplementation must remain false for the current stage.");
  }
  for (const field of [
    "sourceAuthorityDigest",
    "generatedContractDigest",
    "fileLifecycleDigest",
    "runtimeBoundaryDigest",
    "readSurfaceFinanceBoundaryDigest",
    "mutationDigest",
    "browserL1Digest",
    "candidateEvidenceDigest",
    "evidenceSubjectDigest"
  ]) {
    if (!sha256DigestPattern.test(String(candidateObject[field] ?? ""))) {
      failures.push(`candidate evidence object ${field} must be sha256.`);
    }
  }
  const expectedSubjectDigest = digestObject(candidateObject.subject ?? {});
  if (candidateObject.evidenceSubjectDigest !== expectedSubjectDigest) {
    failures.push(`candidate evidence object evidenceSubjectDigest mismatch: expected ${expectedSubjectDigest}, actual ${candidateObject.evidenceSubjectDigest || "missing"}.`);
  }
  const expectedCandidateDigest = digestObject({
    kind: "current-oam-candidate-evidence-subject",
    evidenceSubjectDigest: candidateObject.evidenceSubjectDigest,
    subject: candidateObject.subject
  });
  if (candidateObject.candidateEvidenceDigest !== expectedCandidateDigest) {
    failures.push(`candidate evidence object candidateEvidenceDigest mismatch: expected ${expectedCandidateDigest}, actual ${candidateObject.candidateEvidenceDigest || "missing"}.`);
  }
  if (finalReport.candidateEvidence?.candidateEvidenceDigest !== candidateObject.candidateEvidenceDigest) {
    failures.push("final report candidateEvidence must reference candidate evidence digest.");
  }
  const refs = graph.evidenceObjectRefs ?? [];
  if (!refs.some((ref) => ref.path === candidateEvidenceObjectPath && ref.proofType === "candidate-evidence")) {
    failures.push("evidence graph must reference candidate evidence object with proofType=candidate-evidence.");
  }
}

function checkCommitAttestation(attestation, candidateObject, graph, finalReport) {
  if (!attestation || typeof attestation !== "object") {
    failures.push("commit attestation is missing or invalid.");
    return;
  }
  if (attestation.proofType !== "commit-attestation") {
    failures.push("commit attestation proofType must be commit-attestation.");
  }
  const releaseSnapshot = finalReport?.binding?.referenceOnly === true ||
    finalReport?.binding?.stale === true ||
    finalReport?.evidenceLifecycleType !== "ci-release" ||
    finalReport?.releaseAuthority !== true;
  if (!isGitSha(attestation.commitSha) || !isGitSha(attestation.currentRepositoryHead)) {
    failures.push("commit attestation commitSha/currentRepositoryHead must be concrete git SHAs.");
  }
  if (!releaseSnapshot) {
    if (attestation.commitSha !== currentRepositoryHead || attestation.currentRepositoryHead !== currentRepositoryHead) {
      failures.push("ci-release commit attestation must bind the current HEAD.");
    }
    if (attestation.bindingStatus !== "current") {
      failures.push(`ci-release commit attestation bindingStatus must be current, actual: ${attestation.bindingStatus || "missing"}.`);
    }
  }
  if (attestation.releaseAuthority !== false) {
    failures.push("commit attestation must not grant releaseAuthority.");
  }
  if (attestation.candidateEvidenceDigest !== candidateObject?.candidateEvidenceDigest) {
    failures.push("commit attestation candidateEvidenceDigest must match candidate evidence object.");
  }
  if (attestation.evidenceSubjectDigest !== candidateObject?.evidenceSubjectDigest) {
    failures.push("commit attestation evidenceSubjectDigest must match candidate evidence object.");
  }
  if (attestation.candidateBindingStatus !== "current") {
    failures.push(`commit attestation candidateBindingStatus must be current, actual: ${attestation.candidateBindingStatus || "missing"}.`);
  }
  if (!sha256DigestPattern.test(String(attestation.trackedContentDigest ?? "")) ||
    !sha256DigestPattern.test(String(attestation.sourceTreeDigest ?? ""))) {
    failures.push("commit attestation trackedContentDigest/sourceTreeDigest must be sha256.");
  }
  if (!releaseSnapshot) {
    const expectedTrackedContentDigest = trackedContentDigest();
    if (attestation.trackedContentDigest !== expectedTrackedContentDigest || attestation.sourceTreeDigest !== expectedTrackedContentDigest) {
      failures.push("ci-release commit attestation trackedContentDigest/sourceTreeDigest must match current tracked content.");
    }
  }
  if (!releaseSnapshot && finalReport.commitAttestation?.bindingStatus !== "current") {
    failures.push("ci-release final report commitAttestation must be current.");
  }
  const refs = graph.evidenceObjectRefs ?? [];
  if (!refs.some((ref) => ref.path === commitAttestationPath && ref.proofType === "commit-attestation")) {
    failures.push("evidence graph must reference commit attestation with proofType=commit-attestation.");
  }
}

function checkReleaseEvidenceObject(
  releaseObject,
  graph,
  finalReport,
  allDocuments,
  runtimeAdmission,
  businessLanding
) {
  if (!releaseObject || typeof releaseObject !== "object") {
    failures.push("release evidence object is missing or invalid.");
    return;
  }

  checkArtifactName("release evidence object", releaseObject.artifactName);
  for (const field of [
    "repository",
    "workflow",
    "sourceCommitSha",
    "evidenceRunSha",
    "currentRepositoryHead",
    "stale",
    "referenceOnly",
    "bindingStatus",
    "evidenceLifecycleType",
    "evidenceLifecycle",
    "releaseEvidenceReferenceOnly",
    "workspaceDirtyAtGeneration",
    "githubSha",
    "githubRunId",
    "githubRunAttempt",
    "githubRefName",
    "generatedAtUtc",
    "artifactName",
    "artifactDigest",
    "githubArtifactDigestStatus",
    "externalArtifactAttestation",
    "githubArtifactMetadataDigest",
    "zipArtifactDigest",
    "releaseAuthority",
    "evidenceRootDigest",
    "capabilityDigestChain",
    "runtimeProjectionDigest",
    "surfaceProjectionDigest",
    "searchProjectionDigest",
    "testPlanDigest",
    "browserAuditDigest",
    "capabilityAuthorityStateConsistencyStatus",
    "generatedContractsHash",
    "kernelGraphHash",
    "evidenceGraphHash",
    "finalReportDigest",
    "generatedCompileCandidateAuthorized",
    "authorizedSourceRef",
    "authorizedCandidateExecutionHead",
    "candidateSourceRef",
    "evidenceGeneratedAtHead",
    "candidateCompileEvidenceStatus",
    "candidateCompileClosureForCurrentHead",
    "candidateCompileNextAction",
    "runtimeAdmissionStatus",
    "runtimeAdmissionAuthorityRef",
    "runtimeAdmissionResultRef",
    "testOnlyConsumptionProofRef",
    "runtimeConsumptionReady",
    "dormitoryFirstGoldenChainLandingStatus",
    "businessLandingAuthorityRef",
    "businessLandingResultRef",
    "businessLandingProofRef",
    "businessFeatureDevelopmentAllowed",
    "dormitoryFirstGoldenChainLandingGoNoGo",
    "businessProduction",
    "dormitoryL2",
    "productionConfirmAllowed",
    "finalGoNoGo",
    "nextStageAllowed"
  ]) {
    if (releaseObject[field] === undefined || releaseObject[field] === null || releaseObject[field] === "") {
      failures.push(`release evidence object missing ${field}.`);
    }
  }

  if (releaseObject.githubRunId !== ciRunId) {
    failures.push(`release evidence object githubRunId must be ${ciRunId}, actual: ${releaseObject.githubRunId || "missing"}`);
  }
  if (releaseObject.githubRunAttempt !== ciRunAttempt) {
    failures.push(`release evidence object githubRunAttempt must be ${ciRunAttempt}, actual: ${releaseObject.githubRunAttempt || "missing"}`);
  }
  if (expectedRepository && releaseObject.repository !== expectedRepository) {
    failures.push(`release evidence object repository must be ${expectedRepository}, actual: ${releaseObject.repository || "missing"}`);
  }
  if (releaseObject.workflow !== expectedWorkflow) {
    failures.push(`release evidence object workflow must be ${expectedWorkflow}, actual: ${releaseObject.workflow || "missing"}`);
  }
  if (releaseObject.githubSha !== graph?.binding?.commitSha) {
    failures.push("release evidence object githubSha must match evidence graph binding commitSha.");
  }
  if (releaseObject.sourceCommitSha !== graph?.binding?.sourceCommitSha || releaseObject.sourceCommitSha !== finalReport?.binding?.sourceCommitSha) {
    failures.push("release evidence object sourceCommitSha must match evidence graph and final report.");
  }
  if (releaseObject.evidenceRunSha !== graph?.binding?.evidenceRunSha || releaseObject.evidenceRunSha !== finalReport?.binding?.evidenceRunSha) {
    failures.push("release evidence object evidenceRunSha must match evidence graph and final report.");
  }
  if (releaseObject.githubRefName !== graph?.binding?.branch) {
    failures.push("release evidence object githubRefName must match evidence graph binding branch.");
  }
  if (releaseObject.artifactDigest !== graph?.binding?.artifactDigest) {
    failures.push("release evidence object artifactDigest must match evidence graph artifactDigest.");
  }
  if (releaseObject.githubArtifactDigest === releaseObject.artifactDigest) {
    failures.push("release evidence object githubArtifactDigest must not equal internal artifactDigest.");
  }
  if (releaseObject.githubArtifactMetadataDigest === releaseObject.artifactDigest) {
    failures.push("release evidence object githubArtifactMetadataDigest must not equal internal artifactDigest.");
  }
  if (releaseObject.githubArtifactMetadataDigest === releaseObject.evidenceRootDigest) {
    failures.push("release evidence object must distinguish githubArtifactMetadataDigest from evidenceRootDigest.");
  }
  if (releaseObject.githubArtifactDigestStatus === pendingExternalAttestation) {
    if (releaseObject.externalArtifactAttestation !== "PENDING_EXTERNAL_ATTESTATION") {
      failures.push("pending external attestation must use externalArtifactAttestation=PENDING_EXTERNAL_ATTESTATION.");
    }
    if (releaseObject.githubArtifactMetadataDigest !== pendingExternalAttestation) {
      failures.push("pending external attestation must use pending_external_attestation githubArtifactMetadataDigest.");
    }
    if (releaseObject.releaseAuthority !== false) {
      failures.push("pending external attestation must force releaseAuthority=false.");
    }
    if (releaseObject.finalGoNoGo !== "NO_GO") {
      failures.push("pending external attestation must force finalGoNoGo=NO_GO.");
    }
  } else if (releaseObject.githubArtifactDigestStatus === "attested") {
    if (releaseObject.externalArtifactAttestation !== "ATTESTED") {
      failures.push("attested release evidence object must use externalArtifactAttestation=ATTESTED.");
    }
    if (!sha256DigestPattern.test(String(releaseObject.githubArtifactMetadataDigest ?? ""))) {
      failures.push("attested githubArtifactMetadataDigest must be sha256.");
    }
  } else {
    failures.push(`release evidence object githubArtifactDigestStatus invalid: ${releaseObject.githubArtifactDigestStatus || "missing"}`);
  }
  if (releaseObject.workspaceDirtyAtGeneration === true && releaseObject.releaseAuthority !== false) {
    failures.push("dirty workspace release evidence must force releaseAuthority=false.");
  }
  if (releaseObject.finalGoNoGo !== "NO_GO") {
    failures.push("release evidence object finalGoNoGo must remain NO_GO.");
  }
  if (releaseObject.nextStageAllowed !== false) {
    failures.push("release evidence object nextStageAllowed must remain false.");
  }
  if (releaseObject.businessProduction !== "BLOCKED") {
    failures.push("release evidence object businessProduction must remain BLOCKED.");
  }
  if (releaseObject.dormitoryL2 !== "BLOCKED") {
    failures.push("release evidence object dormitoryL2 must remain BLOCKED.");
  }
  if (releaseObject.productionConfirmAllowed !== false) {
    failures.push("release evidence object productionConfirmAllowed must remain false.");
  }
  if (releaseObject.runtimeAdmissionStatus !== runtimeAdmission.runtimeAdmissionStatus ||
    releaseObject.runtimeAdmissionAuthorityRef !== dormitoryRuntimeAdmissionPath ||
    releaseObject.runtimeAdmissionResultRef !== dormitoryRuntimeAdmissionResultPath ||
    releaseObject.testOnlyConsumptionProofRef !== dormitoryRuntimeTestOnlyProofPath ||
    releaseObject.runtimeConsumptionReady !== runtimeAdmission.runtimeConsumptionReady) {
    failures.push("release evidence object runtime admission fields must mirror dormitory runtime admission authority.");
  }
  if (releaseObject.dormitoryFirstGoldenChainLandingStatus !== businessLanding.landingStatus ||
    releaseObject.businessLandingAuthorityRef !== dormitoryFirstGoldenChainLandingPath ||
    releaseObject.businessLandingResultRef !== dormitoryFirstGoldenChainLandingResultPath ||
    releaseObject.businessLandingProofRef !== dormitoryFirstGoldenChainLandingProofPath ||
    releaseObject.businessFeatureDevelopmentAllowed !== businessLanding.businessFeatureDevelopmentAllowed ||
    releaseObject.dormitoryFirstGoldenChainLandingGoNoGo !== businessLanding.dormitoryFirstGoldenChainLandingGoNoGo) {
    failures.push("release evidence object business landing fields must mirror dormitory first golden chain landing authority.");
  }
  if (releaseObject.releaseEvidenceRole !== "ci_release_attestation_only") {
    failures.push("release evidence object must declare role ci_release_attestation_only.");
  }
  if (releaseObject.releaseDoesNotReplaceCandidateEvidence !== true) {
    failures.push("release evidence object must explicitly not replace candidate evidence.");
  }
  if (releaseObject.candidateEvidenceObject !== candidateEvidenceObjectPath || releaseObject.commitAttestation !== commitAttestationPath) {
    failures.push("release evidence object must reference candidate evidence object and commit attestation.");
  }
  const refs = graph.evidenceObjectRefs ?? [];
  if (!refs.some((ref) => ref.path === releaseEvidenceObjectPath && ref.proofType === "release-evidence")) {
    failures.push("evidence graph must reference release evidence object with proofType=release-evidence.");
  }

  const expectedEvidenceRootDigest = digestFor(new Map([...allDocuments.entries()].filter(([file]) => file !== releaseEvidenceObjectPath)));
  if (releaseObject.evidenceRootDigest !== expectedEvidenceRootDigest) {
    failures.push(`release evidence object evidenceRootDigest mismatch: expected ${expectedEvidenceRootDigest}, actual ${releaseObject.evidenceRootDigest || "missing"}`);
  }

  const expectedKernelGraphHash = `sha256:${sha256(readText("docs/oam/oam-kernel-graph.json"))}`;
  if (releaseObject.kernelGraphHash !== expectedKernelGraphHash) {
    failures.push(`release evidence object kernelGraphHash mismatch: expected ${expectedKernelGraphHash}, actual ${releaseObject.kernelGraphHash || "missing"}`);
  }

  const expectedGeneratedContractsHash = digestFor(new Map(generatedContractFiles().map((file) => [file, readJson(file)])));
  if (releaseObject.generatedContractsHash !== expectedGeneratedContractsHash) {
    failures.push(`release evidence object generatedContractsHash mismatch: expected ${expectedGeneratedContractsHash}, actual ${releaseObject.generatedContractsHash || "missing"}`);
  }

  const expectedEvidenceGraphHash = digestFor(new Map([["artifacts/oam/evidence/evidence-graph.json", graph]]));
  if (releaseObject.evidenceGraphHash !== expectedEvidenceGraphHash) {
    failures.push(`release evidence object evidenceGraphHash mismatch: expected ${expectedEvidenceGraphHash}, actual ${releaseObject.evidenceGraphHash || "missing"}`);
  }

  const expectedFinalReportDigest = digestFor(new Map([["artifacts/oam/final-report.json", finalReport]]));
  if (releaseObject.finalReportDigest !== expectedFinalReportDigest) {
    failures.push(`release evidence object finalReportDigest mismatch: expected ${expectedFinalReportDigest}, actual ${releaseObject.finalReportDigest || "missing"}`);
  }
}

function checkReleaseAttestation(attestation, releaseObject, graph, runtimeAdmission, businessLanding) {
  if (!attestation || typeof attestation !== "object") {
    failures.push("release attestation is missing or invalid.");
    return;
  }
  checkArtifactName("release attestation", attestation.artifactName);
  for (const field of [
    "artifactDigest",
    "evidenceRootDigest",
    "evidenceLifecycleType",
    "evidenceLifecycle",
    "releaseEvidenceReferenceOnly",
    "workspaceDirtyAtGeneration",
    "githubArtifactMetadataDigest",
    "githubArtifactDigestStatus",
    "externalArtifactAttestation",
    "zipArtifactDigest",
    "releaseAuthority",
    "generatedCompileCandidateAuthorized",
    "authorizedSourceRef",
    "authorizedCandidateExecutionHead",
    "candidateSourceRef",
    "evidenceGeneratedAtHead",
    "currentRepositoryHead",
    "candidateCompileEvidenceStatus",
    "candidateCompileClosureForCurrentHead",
    "candidateCompileNextAction",
    "runtimeAdmissionStatus",
    "runtimeAdmissionAuthorityRef",
    "runtimeAdmissionResultRef",
    "testOnlyConsumptionProofRef",
    "runtimeConsumptionReady",
    "dormitoryFirstGoldenChainLandingStatus",
    "businessLandingAuthorityRef",
    "businessLandingResultRef",
    "businessLandingProofRef",
    "businessFeatureDevelopmentAllowed",
    "dormitoryFirstGoldenChainLandingGoNoGo",
    "finalGoNoGo",
    "nextStageAllowed"
  ]) {
    if (attestation[field] === undefined || attestation[field] === null || attestation[field] === "") {
      failures.push(`release attestation missing ${field}.`);
    }
  }
  if (attestation.artifactDigest !== graph?.binding?.artifactDigest || attestation.artifactDigest !== releaseObject?.artifactDigest) {
    failures.push("release attestation artifactDigest must match internal evidence package digest.");
  }
  if (attestation.evidenceRootDigest !== releaseObject?.evidenceRootDigest) {
    failures.push("release attestation evidenceRootDigest must match release evidence object.");
  }
  if (attestation.githubArtifactMetadataDigest !== releaseObject?.githubArtifactMetadataDigest) {
    failures.push("release attestation githubArtifactMetadataDigest must match release evidence object.");
  }
  if (attestation.githubArtifactDigestStatus !== releaseObject?.githubArtifactDigestStatus) {
    failures.push("release attestation githubArtifactDigestStatus must match release evidence object.");
  }
  if (attestation.externalArtifactAttestation !== releaseObject?.externalArtifactAttestation) {
    failures.push("release attestation externalArtifactAttestation must match release evidence object.");
  }
  if (attestation.zipArtifactDigest !== releaseObject?.zipArtifactDigest) {
    failures.push("release attestation zipArtifactDigest must match release evidence object.");
  }
  if (attestation.runtimeAdmissionStatus !== runtimeAdmission.runtimeAdmissionStatus ||
    attestation.runtimeAdmissionAuthorityRef !== dormitoryRuntimeAdmissionPath ||
    attestation.runtimeAdmissionResultRef !== dormitoryRuntimeAdmissionResultPath ||
    attestation.testOnlyConsumptionProofRef !== dormitoryRuntimeTestOnlyProofPath ||
    attestation.runtimeConsumptionReady !== runtimeAdmission.runtimeConsumptionReady) {
    failures.push("release attestation runtime admission fields must mirror dormitory runtime admission authority.");
  }
  if (attestation.dormitoryFirstGoldenChainLandingStatus !== businessLanding.landingStatus ||
    attestation.businessLandingAuthorityRef !== dormitoryFirstGoldenChainLandingPath ||
    attestation.businessLandingResultRef !== dormitoryFirstGoldenChainLandingResultPath ||
    attestation.businessLandingProofRef !== dormitoryFirstGoldenChainLandingProofPath ||
    attestation.businessFeatureDevelopmentAllowed !== businessLanding.businessFeatureDevelopmentAllowed ||
    attestation.dormitoryFirstGoldenChainLandingGoNoGo !== businessLanding.dormitoryFirstGoldenChainLandingGoNoGo) {
    failures.push("release attestation business landing fields must mirror dormitory first golden chain landing authority.");
  }
  if (attestation.githubArtifactMetadataDigest === attestation.artifactDigest) {
    failures.push("release attestation githubArtifactMetadataDigest must not equal internal artifactDigest.");
  }
  if (attestation.githubArtifactDigestStatus === pendingExternalAttestation && attestation.releaseAuthority !== false) {
    failures.push("pending release attestation must force releaseAuthority=false.");
  }
  if (attestation.githubArtifactDigestStatus === "attested" && attestation.externalArtifactAttestation !== "ATTESTED") {
    failures.push("attested release attestation must use externalArtifactAttestation=ATTESTED.");
  }
  if (attestation.workspaceDirtyAtGeneration === true && attestation.releaseAuthority !== false) {
    failures.push("dirty workspace release attestation must force releaseAuthority=false.");
  }
  if (attestation.finalGoNoGo !== "NO_GO" || attestation.nextStageAllowed !== false) {
    failures.push("release attestation must keep current stage NO_GO and nextStageAllowed=false.");
  }
}

function checkEvidenceLifecycleProof(proof, graph, finalReport, releaseObject) {
  if (!proof || typeof proof !== "object") {
    failures.push("evidence lifecycle proof is missing or invalid.");
    return;
  }
  if (proof.proofType !== "evidence-lifecycle-proof") {
    failures.push("evidence lifecycle proof proofType must be evidence-lifecycle-proof.");
  }
  const lifecycleType = proof.evidenceLifecycleType ?? proof.evidenceLifecycle?.lifecycleType;
  if (!["local-candidate", "repository-reference-snapshot", "ci-release"].includes(lifecycleType)) {
    failures.push(`evidence lifecycle proof has invalid lifecycle type: ${lifecycleType || "missing"}.`);
  }
  if (finalReport.evidenceLifecycleType !== lifecycleType || releaseObject?.evidenceLifecycleType !== lifecycleType || graph?.binding?.evidenceLifecycleType !== lifecycleType) {
    failures.push("Evidence Graph, Release Evidence Object, Final Report, and lifecycle proof must share evidenceLifecycleType.");
  }
  if (proof.releaseAuthority !== false || finalReport.releaseAuthority !== false || releaseObject?.releaseAuthority !== false) {
    failures.push("evidence lifecycle proof must keep releaseAuthority=false for the current stage.");
  }
  if (lifecycleType !== "ci-release") {
    for (const [label, document] of [
      ["lifecycle proof", proof],
      ["final report", finalReport],
      ["release evidence object", releaseObject],
      ["evidence graph binding", graph?.binding]
    ]) {
      if (document?.externalArtifactAttestation !== "PENDING_EXTERNAL_ATTESTATION") {
        failures.push(`${label} must keep externalArtifactAttestation=PENDING_EXTERNAL_ATTESTATION outside ci-release mode.`);
      }
      if (document?.bindingStatus === "current" || document?.stale === false || document?.referenceOnly === false) {
        failures.push(`${label} must be referenceOnly/stale outside ci-release mode.`);
      }
    }
  }
  if (lifecycleType === "ci-release" && env("GITHUB_ACTIONS") !== "true") {
    failures.push("ci-release lifecycle evidence is only valid inside GitHub Actions.");
  }
  if (proof.githubArtifactDigestStatus === "attested" && proof.externalArtifactAttestation !== "ATTESTED") {
    failures.push("attested lifecycle proof must use externalArtifactAttestation=ATTESTED.");
  }
  if (proof.githubArtifactDigestStatus === pendingExternalAttestation && proof.externalArtifactAttestation !== "PENDING_EXTERNAL_ATTESTATION") {
    failures.push("pending lifecycle proof must use externalArtifactAttestation=PENDING_EXTERNAL_ATTESTATION.");
  }
  if (proof.workspaceDirtyAtGeneration === true && proof.releaseAuthority !== false) {
    failures.push("dirty workspace lifecycle proof must force releaseAuthority=false.");
  }
  const requiredNegativeCases = [
    "old-sha-with-current-binding-fails",
    "dirty-worktree-release-authority-fails",
    "github-artifact-digest-equals-internal-artifact-digest-fails",
    "pending-external-attestation-release-authority-fails",
    "stale-reference-evidence-go-fails",
    "ordinary-checker-default-proof-write-fails"
  ];
  const covered = new Set((proof.negativeTests ?? []).map((item) => item.caseId));
  for (const caseId of requiredNegativeCases) {
    if (!covered.has(caseId)) {
      failures.push(`evidence lifecycle proof missing negative case ${caseId}.`);
    }
  }
  if (!graph.requiredFiles?.includes(evidenceLifecycleProofPath)) {
    failures.push("evidence graph must include evidence lifecycle proof in requiredFiles.");
  }
  if (!(graph.evidenceObjectRefs ?? []).some((ref) => ref.path === evidenceLifecycleProofPath && ref.proofType === "evidence-lifecycle-proof")) {
    failures.push("evidence graph must reference evidence lifecycle proof with proofType=evidence-lifecycle-proof.");
  }
}

function checkReadonlyOrdinaryCheckers() {
  for (const file of [
    "scripts/check-search-kernel.mjs",
    "scripts/oam/check-read-intelligence-kernel.mjs"
  ]) {
    const text = readText(file);
    if (!/process\.argv\.includes\("--write-proof"\)/.test(text) || !/OAM_WRITE_PROOF/.test(text)) {
      failures.push(`${file} must gate proof writes behind --write-proof or OAM_WRITE_PROOF=1.`);
    }
    const unguardedWrite = text
      .split(/\r?\n/)
      .some((line) => /write(?:SearchProofs|OamObjectEnvelopeProof)\(/.test(line)
        && !/if \(writeProof\)/.test(line)
        && !/function write/.test(line));
    if (unguardedWrite) {
      failures.push(`${file} must not write proof artifacts during default readonly checks.`);
    }
  }
}

function checkDormitoryGoldenChainSourcePackage(finalReport) {
  const section = finalReport.dormitoryGoldenChainSourcePackage;
  if (!section || typeof section !== "object") {
    failures.push("final report missing dormitoryGoldenChainSourcePackage section.");
    return;
  }
  for (const field of [
    "gateId",
    "status",
    "sourceFinalizationStatus",
    "sourceScenarioPackageReviewStatus",
    "sourceFieldGapsDecisionStatus",
    "sourceScenarioRef",
    "scope",
    "excluded",
    "sourceFieldGaps",
    "sourceReadyForCompileDecision",
    "compilePreparationDecision",
    "compileDecisionStatus",
    "compilePreparationAllowed",
    "generatedCompileAuthorized",
    "generatedCompilationAllowed",
    "generatedCompilationReadiness",
    "businessFeatureDevelopmentAllowed",
    "generatedCompileCompleted",
    "generatedCompilationCompleted",
    "runtimeConsumptionReady",
    "generatedContractStatus10B",
    "finalGoNoGo",
    "releaseAuthority",
    "nextStageRequires00Review"
  ]) {
    if (section[field] === undefined || section[field] === null || section[field] === "") {
      failures.push(`dormitoryGoldenChainSourcePackage missing ${field}.`);
    }
  }
  if (section.sourceFinalizationStatus !== "SOURCE_FINALIZED_BY_00" || section.sourceScenarioPackageReviewStatus !== "SOURCE_FINALIZED_BY_00") {
    failures.push("dormitoryGoldenChainSourcePackage source finalization statuses must be SOURCE_FINALIZED_BY_00.");
  }
  if (section.sourceFieldGapsDecisionStatus !== "DECIDED_AND_BOUND") {
    failures.push("dormitoryGoldenChainSourcePackage sourceFieldGapsDecisionStatus must be DECIDED_AND_BOUND.");
  }
  if (section.compileDecisionStatus !== "READY_FOR_00_COMPILE_DECISION" || section.compilePreparationAllowed !== "READY_FOR_00_COMPILE_DECISION") {
    failures.push("dormitoryGoldenChainSourcePackage compile status must be READY_FOR_00_COMPILE_DECISION.");
  }
  if (section.generatedCompilationAllowed !== "false_until_00_explicit_generated_compile_approval" || section.generatedCompilationReadiness !== "NOT_STARTED_OR_NOT_AUTHORIZED") {
    failures.push("dormitoryGoldenChainSourcePackage must keep generated compilation not authorized.");
  }
  if (section.sourceScenarioRef !== "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml") {
    failures.push("dormitoryGoldenChainSourcePackage sourceScenarioRef must bind the first golden-chain Source package.");
  }
  if (section.scope !== "compile_preparation_review") {
    failures.push("dormitoryGoldenChainSourcePackage scope must be compile_preparation_review.");
  }
  if (!Array.isArray(section.excluded) || section.excluded.length === 0) {
    failures.push("dormitoryGoldenChainSourcePackage excluded must list forbidden scope.");
  }
  if (section.sourceFieldGaps?.pending00Decision !== false || section.sourceFieldGaps?.compilePreparationAllowed !== "READY_FOR_00_COMPILE_DECISION") {
    failures.push("dormitoryGoldenChainSourcePackage sourceFieldGaps must contain resolved decisions and be ready only for 00 compile decision.");
  }
  if (section.sourceReadyForCompileDecision !== true) {
    failures.push("dormitoryGoldenChainSourcePackage sourceReadyForCompileDecision must be true.");
  }
  const decisions = section.sourceFieldGaps?.decisions ?? {};
  for (const gap of ["buildingId", "roomType", "readinessEvidenceRefs", "readinessNote", "blockedReason", "notSaleableReason", "serviceVerificationRef"]) {
    const decision = decisions[gap];
    if (!decision?.decision || decision.compileBlocking === undefined || !decision.owner || !decision.compilerInputImpact) {
      failures.push(`dormitoryGoldenChainSourcePackage sourceFieldGaps.${gap} decision is incomplete.`);
    }
  }
  if (section.generatedCompileAuthorized !== false || section.generatedCompileCompleted !== false || section.runtimeConsumptionReady !== false) {
    failures.push("dormitoryGoldenChainSourcePackage must keep generated authorization/completion and runtime consumption blocked.");
  }
  if (section.businessFeatureDevelopmentAllowed !== false || section.generatedCompilationCompleted !== false) {
    failures.push("dormitoryGoldenChainSourcePackage must not allow business development or generated compilation.");
  }
  if (section.finalGoNoGo !== "NO_GO" || section.releaseAuthority !== false || section.nextStageRequires00Review !== true) {
    failures.push("dormitoryGoldenChainSourcePackage must keep NO_GO, releaseAuthority=false, and nextStageRequires00Review=true.");
  }
}

function checkSourceFormalGeneratedCompileSemanticSeparation(finalReport, generatedCompileExecution) {
  for (const [label, section] of [
    ["sourcePackageReview", finalReport.sourcePackageReview],
    ["dormitoryGoldenChainSourcePackage", finalReport.dormitoryGoldenChainSourcePackage]
  ]) {
    if (!section || typeof section !== "object") {
      failures.push(`final report missing ${label} source-only section.`);
      continue;
    }
    if (section.generatedCompileAuthorized !== false) {
      failures.push(`${label} must keep generatedCompileAuthorized=false; formal authorization belongs only to the formal authorization/top-level sections.`);
    }
    if (section.generatedCompilationAllowed !== "false_until_00_explicit_generated_compile_approval") {
      failures.push(`${label} must keep generatedCompilationAllowed=false_until_00_explicit_generated_compile_approval.`);
    }
    if (section.generatedCompilationReadiness !== "NOT_STARTED_OR_NOT_AUTHORIZED") {
      failures.push(`${label} must keep generatedCompilationReadiness=NOT_STARTED_OR_NOT_AUTHORIZED.`);
    }
    if ("formalGeneratedCompileAuthorizationStatus" in section ||
      "formalGeneratedCompileAuthorization" in section ||
      "formalGeneratedCompileAuthorized" in section) {
      failures.push(`${label} must not contain formal generated compile authorization fields.`);
    }
  }

  const execution = finalReport.generatedCompileExecution;
  if (!execution || typeof execution !== "object") {
    failures.push("final report missing generatedCompileExecution section.");
  } else if (execution.status !== generatedCompileExecution.status ||
    execution.generatedCompileCompleted !== generatedCompileExecution.completed ||
    execution.generatedCompilationCompleted !== generatedCompileExecution.completed ||
    execution.generatedCandidateAcceptedBy00 !== false ||
    execution.runtimeConsumptionReady !== false ||
    execution.businessFeatureDevelopmentAllowed !== false ||
    execution.productionConfirmAllowed !== false ||
    execution.releaseAuthority !== false ||
    execution.finalGoNoGo !== "NO_GO") {
    failures.push("generatedCompileExecution must mirror formal compile execution completion while keeping candidate acceptance, runtime, business, release, and GO blocked.");
  }
}

function checkGeneratedCompileCandidate(finalReport, graph, documents) {
  const approval = documents.get(generatedCompileCandidateApprovalPath);
  if (!approval || typeof approval !== "object") {
    failures.push(`missing generated compile candidate approval object: ${generatedCompileCandidateApprovalPath}.`);
    return;
  }
  const authorizedSourceRef = approval.authorizedSourceRef ?? approval.candidateSourceRef;
  const authorizedCandidateExecutionHead = approval.authorizedCandidateExecutionHead ?? approval.executionHead;
  if (approval.approvalType !== "generated_compile_candidate_only" ||
    approval.generatedCompileCandidateAuthorized !== true ||
    approval.generatedCompileAuthorized !== false) {
    failures.push("generated compile candidate approval must authorize only the candidate compile path.");
  }
  if (!isGitSha(authorizedSourceRef) || !isGitSha(authorizedCandidateExecutionHead)) {
    failures.push("generated compile candidate approval must bind concrete authorizedSourceRef and authorizedCandidateExecutionHead.");
  }
  if (approval.authorizedSourceRef !== approval.candidateSourceRef) {
    failures.push("generated compile candidate approval authorizedSourceRef must equal candidateSourceRef.");
  }
  if (approval.executionHead !== authorizedCandidateExecutionHead ||
    approval.executionHeadCompatibilityAliasOf !== "authorizedCandidateExecutionHead") {
    failures.push("generated compile candidate approval executionHead may only remain as an alias of authorizedCandidateExecutionHead.");
  }
  if (approval.candidateSourceRefIsAncestorOfExecutionHead !== true) {
    failures.push("generated compile candidate approval must prove candidateSourceRef is ancestor of authorizedCandidateExecutionHead.");
  }
  if (isGitSha(authorizedSourceRef) && isGitSha(authorizedCandidateExecutionHead) &&
    !gitSucceeds(`merge-base --is-ancestor ${authorizedSourceRef} ${authorizedCandidateExecutionHead}`)) {
    failures.push("generated compile candidate approval candidateSourceRef must be an ancestor of authorizedCandidateExecutionHead.");
  }
  if (isGitSha(authorizedCandidateExecutionHead) &&
    currentRepositoryHead !== authorizedCandidateExecutionHead &&
    !gitSucceeds(`merge-base --is-ancestor ${authorizedCandidateExecutionHead} ${currentRepositoryHead}`)) {
    failures.push("current HEAD must equal or descend from authorizedCandidateExecutionHead for candidate evidence.");
  }
  if (approval.generatedReleaseAllowed !== false ||
    approval.runtimeConsumptionAllowed !== "false_until_candidate_accepted_by_00" ||
    approval.releaseAuthority !== false ||
    approval.finalGoNoGo !== "NO_GO") {
    failures.push("generated compile candidate approval must not grant release, runtime consumption, or GO.");
  }

  const expectedFields = {
    generatedCompileCandidateAuthorized: true,
    authorizedSourceRef,
    authorizedCandidateExecutionHead,
    candidateSourceRef: authorizedSourceRef,
    generatedCompileCandidateStatus: "PASS",
    generatedReleaseAllowed: false,
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    productionConfirmAllowed: false,
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmGoNoGo: "NO_GO"
  };
  for (const [field, expected] of Object.entries(expectedFields)) {
    if (finalReport[field] !== expected) {
      failures.push(`final report ${field} must be ${expected}, actual ${finalReport[field] ?? "missing"}.`);
    }
  }
  const expectedEvidenceStatus = expectedCandidateCompileEvidenceStatus(finalReport, documents, authorizedCandidateExecutionHead);
  const expectedClosure = expectedEvidenceStatus === "CURRENT";
  const expectedNextAction = expectedCandidateCompileNextAction(expectedEvidenceStatus);
  if (finalReport.evidenceGeneratedAtHead !== (finalReport.evidenceRunSha ?? finalReport.binding?.evidenceRunSha)) {
    failures.push("final report evidenceGeneratedAtHead must equal the actual evidence run SHA.");
  }
  if (finalReport.currentRepositoryHead !== (finalReport.binding?.currentRepositoryHead ?? currentRepositoryHead)) {
    failures.push("final report currentRepositoryHead must match binding.currentRepositoryHead.");
  }
  if (finalReport.candidateCompileEvidenceStatus !== expectedEvidenceStatus ||
    !candidateCompileEvidenceStatuses.has(finalReport.candidateCompileEvidenceStatus)) {
    failures.push(`final report candidateCompileEvidenceStatus must be ${expectedEvidenceStatus}, actual ${finalReport.candidateCompileEvidenceStatus ?? "missing"}.`);
  }
  if (finalReport.candidateCompileClosureForCurrentHead !== expectedClosure) {
    failures.push(`final report candidateCompileClosureForCurrentHead must be ${expectedClosure}.`);
  }
  if (finalReport.candidateCompileNextAction !== expectedNextAction) {
    failures.push("final report candidateCompileNextAction must explain the current/stale candidate evidence state.");
  }
  if (expectedEvidenceStatus !== "CURRENT" && (finalReport.finalGoNoGo !== "NO_GO" || finalReport.releaseAuthority !== false)) {
    failures.push("stale generated compile candidate evidence must force finalGoNoGo=NO_GO and releaseAuthority=false.");
  }
  const candidateBindingExpectations = {
    generatedCompileCandidateAuthorized: true,
    authorizedSourceRef,
    authorizedCandidateExecutionHead,
    candidateSourceRef: authorizedSourceRef,
    evidenceGeneratedAtHead: finalReport.evidenceGeneratedAtHead,
    currentRepositoryHead: finalReport.currentRepositoryHead,
    candidateCompileEvidenceStatus: expectedEvidenceStatus,
    candidateCompileClosureForCurrentHead: expectedClosure,
    candidateCompileNextAction: expectedNextAction,
    generatedCompileCandidateStatus: "PASS",
    generatedCandidateAcceptedBy00: finalReport.generatedCandidateAcceptedBy00 === true,
    generatedReleaseAllowed: false,
    runtimeConsumptionAllowed: finalReport.runtimeConsumptionAllowed
  };
  for (const [label, state] of [
    ["evidence graph binding", graph?.binding],
    ["final report binding", finalReport.binding],
    ["final report evidenceBinding", finalReport.evidenceBinding],
    ["release evidence object", documents.get(releaseEvidenceObjectPath)],
    ["release attestation", documents.get(releaseAttestationPath)]
  ]) {
    if (!state || typeof state !== "object") {
      failures.push(`${label} missing generated compile candidate binding state.`);
      continue;
    }
    for (const [field, expected] of Object.entries(candidateBindingExpectations)) {
      if (state[field] !== expected) {
        failures.push(`${label} ${field} must be ${expected}, actual ${state[field] ?? "missing"}.`);
      }
    }
  }

  const node = (graph?.nodes ?? []).find((item) => item.id === "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-CANDIDATE");
  if (!node) {
    failures.push("Evidence Graph missing OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-CANDIDATE proof node.");
    return;
  }
  for (const field of [
    "proofType",
    "source",
    "hash",
    "dependsOn",
    "producedBy",
    "verifiedBy",
    "scope",
    "authorizedSourceRef",
    "authorizedCandidateExecutionHead",
    "candidateSourceRef",
    "executionHead",
    "evidenceGeneratedAtHead",
    "currentRepositoryHead",
    "candidateCompileEvidenceStatus",
    "candidateCompileClosureForCurrentHead",
    "candidateCompileNextAction",
    "approvalObjectHash",
    "generatedManifestHash",
    "generatedOutputDigest",
    "finalGoNoGo",
    "releaseAuthority"
  ]) {
    if (isEmptyProofField(node[field])) {
      failures.push(`generated compile candidate proof node missing ${field}.`);
    }
  }
  if (node.proofType !== "generated_compile_candidate" || node.scope !== "generated_compile_candidate_only") {
    failures.push("generated compile candidate proof node must use generated_compile_candidate/generated_compile_candidate_only.");
  }
  if (node.authorizedSourceRef !== authorizedSourceRef ||
    node.candidateSourceRef !== authorizedSourceRef ||
    node.authorizedCandidateExecutionHead !== authorizedCandidateExecutionHead ||
    node.executionHead !== authorizedCandidateExecutionHead) {
    failures.push("generated compile candidate proof node must bind authorized source/execution heads and historical aliases consistently.");
  }
  if (node.evidenceGeneratedAtHead !== finalReport.evidenceGeneratedAtHead ||
    node.currentRepositoryHead !== finalReport.currentRepositoryHead ||
    node.candidateCompileEvidenceStatus !== expectedEvidenceStatus ||
    node.candidateCompileClosureForCurrentHead !== expectedClosure ||
    node.candidateCompileNextAction !== expectedNextAction) {
    failures.push("generated compile candidate proof node must mirror Final Report current/stale evidence binding state.");
  }
  if (node.generatedCompileCandidateAuthorized !== true ||
    node.generatedCandidateAcceptedBy00 !== false ||
    node.generatedReleaseAllowed !== false ||
    node.runtimeConsumptionAllowed !== "false_until_candidate_accepted_by_00" ||
    node.runtimeConsumptionReady !== false) {
    failures.push("generated compile candidate proof node must stay candidate-only and block runtime consumption.");
  }
  if (node.finalGoNoGo !== "NO_GO" || node.goNoGo !== "NO_GO" || node.releaseAuthority !== false || node.businessGoAuthority !== false) {
    failures.push("generated compile candidate proof node must keep NO_GO/releaseAuthority=false/businessGoAuthority=false.");
  }
  if (node.approvalObjectHash !== hashFileText(generatedCompileCandidateApprovalPath)) {
    failures.push("generated compile candidate proof node approvalObjectHash mismatch.");
  }
  if (node.generatedManifestHash !== hashFileText("docs/oam/generated-contracts-manifest.json")) {
    failures.push("generated compile candidate proof node generatedManifestHash mismatch.");
  }
  const expectedOutputDigest = digestFor(new Map(generatedContractFiles().map((file) => [file, readJson(file)])));
  if (node.generatedOutputDigest !== expectedOutputDigest) {
    failures.push(`generated compile candidate proof node generatedOutputDigest mismatch: expected ${expectedOutputDigest}, actual ${node.generatedOutputDigest || "missing"}.`);
  }
  if (!(node.dependsOn ?? []).includes("OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE")) {
    failures.push("generated compile candidate proof node must depend on OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE.");
  }
  if (!(node.source ?? []).includes(generatedCompileCandidateApprovalPath)) {
    failures.push("generated compile candidate proof node must cite the approval object.");
  }
  const nodeBinding = node.binding ?? {};
  for (const [field, expected] of Object.entries({
    authorizedSourceRef,
    authorizedCandidateExecutionHead,
    candidateSourceRef: authorizedSourceRef,
    executionHead: authorizedCandidateExecutionHead,
    evidenceGeneratedAtHead: finalReport.evidenceGeneratedAtHead,
    currentRepositoryHead: finalReport.currentRepositoryHead,
    candidateCompileEvidenceStatus: expectedEvidenceStatus,
    candidateCompileClosureForCurrentHead: expectedClosure,
    candidateCompileNextAction: expectedNextAction,
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false
  })) {
    if (nodeBinding[field] !== expected) {
      failures.push(`generated compile candidate proof node binding ${field} must be ${expected}, actual ${nodeBinding[field] ?? "missing"}.`);
    }
  }
}

function expectedCandidateCompileEvidenceStatus(report, documents, authorizedCandidateExecutionHead) {
  const reportCurrentHead = report.currentRepositoryHead ?? report.binding?.currentRepositoryHead ?? currentRepositoryHead;
  const evidenceGeneratedAtHead = report.evidenceGeneratedAtHead ?? report.evidenceRunSha ?? report.binding?.evidenceRunSha ?? "";
  const controlPlane = documents.get(controlPlaneGateResultPath) ?? report.controlPlaneGateResult ?? {};
  const controlPlaneCurrent = controlPlane.commitSha === reportCurrentHead &&
    controlPlane.status === "passed" &&
    controlPlane.runStatus === "completed" &&
    controlPlane.finalizable === true;
  if (evidenceGeneratedAtHead !== reportCurrentHead || !controlPlaneCurrent) return "STALE_REFERENCE";
  if (reportCurrentHead !== authorizedCandidateExecutionHead) return "STALE_BUT_NO_GO";
  return "CURRENT";
}

function expectedCandidateCompileNextAction(status) {
  if (status === "CURRENT") {
    return "候选编译证据绑定当前 HEAD；仍需 00 后续接受候选后才可进入正式 generated compile 或 Runtime 消费。";
  }
  if (status === "STALE_REFERENCE") {
    return "重新在当前 HEAD 执行候选闭合，或等待外部 CI artifact attestation；保持 NO_GO。";
  }
  return "当前 HEAD 是 00 授权执行头的 descendant；等待 00 更新 authorizedCandidateExecutionHead 或保持 stale-but-no-go。";
}

function checkFormalGeneratedCompileAuthorization(finalReport, graph, documents, formalAuthorization) {
  const approval = documents.get(generatedCompileApprovalPath);
  if (!approval || typeof approval !== "object") {
    failures.push(`missing formal generated compile approval object: ${generatedCompileApprovalPath}.`);
    return;
  }
  const candidateApproval = documents.get(generatedCompileCandidateApprovalPath) ?? {};
  const authorizedCandidateExecutionHead = candidateApproval.authorizedCandidateExecutionHead ?? candidateApproval.executionHead;
  const expectedAuthorized = formalAuthorization.authorized;
  if (!expectedAuthorized) {
    for (const failure of formalAuthorization.failures) failures.push(failure);
  }
  if (approval.candidateSourceRef !== candidateApproval.candidateSourceRef ||
    approval.authorizedCandidateExecutionHead !== authorizedCandidateExecutionHead) {
    failures.push("formal generated compile approval must bind the same candidateSourceRef and authorizedCandidateExecutionHead as the candidate approval.");
  }
  if (!String(approval.artifactDigestDistinction ?? "").includes("GitHub artifact digest differs from internal release evidence artifactDigest")) {
    failures.push("formal generated compile approval must document GitHub artifact digest != internal release evidence artifactDigest.");
  }
  if (finalReport.formalGeneratedCompileAuthorized !== expectedAuthorized ||
    finalReport.formalGeneratedCompilationAllowed !== expectedAuthorized ||
    finalReport.formalGeneratedCompileAuthorizationStatus !== (expectedAuthorized ? "PASS" : "NO_GO")) {
    failures.push(`final report must expose formal generated compile authorization as ${expectedAuthorized ? "PASS/true" : "NO_GO/false"}.`);
  }
  if (finalReport.generatedReleaseAllowed !== false ||
    finalReport.productionConfirmAllowed !== false ||
    finalReport.releaseAuthority !== false ||
    finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("formal approval must not expand into release authority, production_confirm, or GO.");
  }

  const node = (graph.nodes ?? []).find((item) => item.id === "OAM-DORMITORY-GOLDEN-CHAIN-FORMAL-GENERATED-COMPILE-AUTHORIZATION");
  if (!node) {
    failures.push("evidence graph missing formal generated compile authorization proof node.");
    return;
  }
  if (node.status !== (expectedAuthorized ? "passed" : "blocked") ||
    node.scope !== "formal_generated_compile_authorization_only" ||
    node.generatedCompileAuthorized !== expectedAuthorized ||
    node.generatedCompilationAllowed !== expectedAuthorized ||
    node.generatedCompileCompleted !== false ||
    node.generatedCandidateAcceptedBy00 !== false ||
    node.runtimeConsumptionReady !== false ||
    node.releaseAuthority !== false ||
    node.finalGoNoGo !== "NO_GO") {
    failures.push("formal generated compile authorization proof node must pass only authorization and keep completion/runtime/release/GO blocked.");
  }
  if (node.approvalObjectHash !== hashFileText(generatedCompileApprovalPath)) {
    failures.push("formal generated compile authorization proof node approvalObjectHash mismatch.");
  }
  for (const dep of [
    "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-CANDIDATE",
    generatedCompileApprovalPath,
    "artifacts/oam/checks/generated-compile-authorization-result.json"
  ]) {
    if (!(node.dependsOn ?? []).includes(dep)) {
      failures.push(`formal generated compile authorization proof node missing dependency: ${dep}.`);
    }
  }
  const binding = node.binding ?? {};
  for (const [field, expected] of Object.entries({
    approvalObjectHash: hashFileText(generatedCompileApprovalPath),
    candidateSourceRef: approval.candidateSourceRef,
    authorizedCandidateExecutionHead: approval.authorizedCandidateExecutionHead,
    generatedCompileAuthorized: expectedAuthorized,
    generatedCompilationAllowed: expectedAuthorized,
    generatedCompileCompleted: false,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  })) {
    if (binding[field] !== expected) {
      failures.push(`formal generated compile authorization binding ${field} must be ${expected}, actual ${binding[field] ?? "missing"}.`);
    }
  }
}

function generatedCompileExecutionState(documents, formalAuthorization) {
  const result = documents.get(generatedCompileExecutionResultPath);
  const proof = documents.get(generatedCompileExecutionProofPath);
  const snapshot = documents.get(generatedCompileExecutionSnapshotPath);
  const resultPass = result?.status === "PASS" && result?.checkerExecutionStatus === "PASS";
  const proofPass = proof?.status === "PASS";
  const noForbiddenEscalation =
    result?.generatedCandidateAcceptedBy00 === false &&
    result?.runtimeConsumptionReady === false &&
    result?.businessFeatureDevelopmentAllowed === false &&
    result?.productionConfirmAllowed === false &&
    result?.releaseAuthority === false &&
    result?.finalGoNoGo === "NO_GO" &&
    proof?.generatedCandidateAcceptedBy00 === false &&
    proof?.runtimeConsumptionReady === false &&
    proof?.businessFeatureDevelopmentAllowed === false &&
    proof?.productionConfirmAllowed === false &&
    proof?.releaseAuthority === false &&
    proof?.finalGoNoGo === "NO_GO";
  const completed = formalAuthorization.authorized === true &&
    resultPass &&
    proofPass &&
    result?.generatedCompileAuthorized === true &&
    result?.generatedCompilationAllowed === true &&
    result?.generatedCompileCompleted === true &&
    result?.generatedCompilationCompleted === true &&
    proof?.generatedCompileCompleted === true &&
    proof?.generatedCompilationCompleted === true &&
    noForbiddenEscalation;
  if (snapshot?.status !== "PASS") {
    failures.push("generated compile execution input snapshot must be PASS.");
  }
  const resultReviewedExecutionHead = result?.reviewedExecutionHead ?? result?.currentHead;
  const proofReviewedExecutionHead = proof?.reviewedExecutionHead ?? proof?.currentHead;
  if (!isGitSha(resultReviewedExecutionHead) || !isGitSha(proofReviewedExecutionHead)) {
    failures.push("generated compile execution result/proof must bind a concrete reviewedExecutionHead.");
  } else if (resultReviewedExecutionHead !== proofReviewedExecutionHead) {
    failures.push("generated compile execution result/proof reviewedExecutionHead must match.");
  } else if (currentRepositoryHead !== resultReviewedExecutionHead &&
    !gitSucceeds(`merge-base --is-ancestor ${resultReviewedExecutionHead} ${currentRepositoryHead}`)) {
    failures.push("current HEAD must equal or descend from formal compile execution reviewedExecutionHead for evidence writeback.");
  }
  if (result?.proofPath !== generatedCompileExecutionProofPath) {
    failures.push("generated compile execution result must reference generated compile execution proof path.");
  }
  return {
    status: completed ? "PASS" : "NO_GO",
    completed,
    result,
    proof,
    snapshot,
    reviewedExecutionHead: resultReviewedExecutionHead,
    resultPass,
    proofPass,
    noForbiddenEscalation
  };
}

function generatedFieldBindingClosureState(documents) {
  const closure = buildDormitoryGeneratedFieldBindingClosure({ root });
  const result = documents.get(generatedFieldBindingClosureResultPath);
  const contract = documents.get(generatedFieldBindingsPath);
  const resultPass = result?.status === "PASS" &&
    result?.generatedFieldBindingClosureStatus === "PASS" &&
    result?.closureDigest === closure.closureDigest &&
    result?.sourceFieldGapsDecisionDigest === closure.sourceFieldGapsDecisionDigest;
  const contractPass = contract?.generated === true &&
    contract?.doNotEdit === true &&
    contract?.canonicalClosureVersion === closure.canonicalClosureVersion &&
    contract?.generatedFieldBindingClosureDigest === closure.closureDigest &&
    contract?.sourceFieldGapsDecisionDigest === closure.sourceFieldGapsDecisionDigest;
  return {
    status: closure.status === "PASS" && resultPass && contractPass ? "PASS" : "FAIL",
    closure,
    result,
    contract,
    generatedFieldBindingClosureDigest: closure.closureDigest,
    sourceFieldGapsDecisionDigest: closure.sourceFieldGapsDecisionDigest
  };
}

function checkGeneratedFieldBindingClosure(finalReport, graph, documents, state) {
  if (state.status !== "PASS") {
    failures.push("generated field binding closure must PASS and bind generated contract/result digests.");
  }
  if (finalReport.generatedFieldBindingClosureRequired !== true ||
    finalReport.generatedFieldBindingClosureStatus !== "PASS" ||
    finalReport.generatedFieldBindingClosureDigest !== state.generatedFieldBindingClosureDigest ||
    finalReport.sourceFieldGapsDecisionDigest !== state.sourceFieldGapsDecisionDigest ||
    finalReport.candidateAttestationIsReleaseEvidence !== false ||
    finalReport.releaseEvidenceRequiredAfterCandidateEvidence !== true ||
    finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("final report generated field binding closure fields must mirror closure state and keep release/GO blocked.");
  }
  if (finalReport.statusMatrix?.generatedFieldBindingClosureStatus?.status !== "PASS") {
    failures.push("final report statusMatrix.generatedFieldBindingClosureStatus must be PASS.");
  }
  const node = (graph.nodes ?? []).find((item) => item.id === "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-FIELD-BINDING-CLOSURE");
  if (!node) {
    failures.push("evidence graph missing generated field binding closure node.");
    return;
  }
  if (node.scope !== "generated_semantic_closure_only" ||
    node.generatedFieldBindingClosureStatus !== "PASS" ||
    node.generatedFieldBindingClosureDigest !== state.generatedFieldBindingClosureDigest ||
    node.sourceFieldGapsDecisionDigest !== state.sourceFieldGapsDecisionDigest ||
    node.runtimeConsumptionReady !== false ||
    node.releaseAuthority !== false ||
    node.finalGoNoGo !== "NO_GO") {
    failures.push("generated field binding closure node must mirror closure state and keep runtime/release/GO blocked.");
  }
  const binding = node.binding ?? {};
  for (const [field, expected] of Object.entries({
    generatedFieldBindingsRef: generatedFieldBindingsPath,
    generatedFieldBindingClosureResultRef: generatedFieldBindingClosureResultPath,
    generatedFieldBindingClosureRequired: true,
    generatedFieldBindingClosureStatus: "PASS",
    generatedFieldBindingClosureDigest: state.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: state.sourceFieldGapsDecisionDigest,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  })) {
    if (binding[field] !== expected) {
      failures.push(`generated field binding closure binding ${field} must be ${expected}, actual ${binding[field] ?? "missing"}.`);
    }
  }
}

function checkGeneratedCompileExecution(finalReport, graph, documents, state) {
  const result = documents.get(generatedCompileExecutionResultPath);
  const proofDocument = documents.get(generatedCompileExecutionProofPath);
  if (!result || !proofDocument) {
    failures.push("generated compile execution result/proof is missing.");
    return;
  }
  if (!state.completed) {
    failures.push("generated compile execution must be completed/PASS after formal compile execution closure.");
  }
  if (finalReport.generatedCompileExecution?.resultPath !== generatedCompileExecutionResultPath ||
    finalReport.generatedCompileExecution?.proofPath !== generatedCompileExecutionProofPath ||
    finalReport.generatedCompileExecution?.snapshotPath !== generatedCompileExecutionSnapshotPath) {
    failures.push("final report generatedCompileExecution must reference formal compile execution result/proof/snapshot paths.");
  }
  if (finalReport.generatedCompileExecution?.resultDigest !== hashFileText(generatedCompileExecutionResultPath) ||
    finalReport.generatedCompileExecution?.proofDigest !== hashFileText(generatedCompileExecutionProofPath) ||
    finalReport.generatedCompileExecution?.snapshotDigest !== hashFileText(generatedCompileExecutionSnapshotPath)) {
    failures.push("final report generatedCompileExecution digests must match formal compile execution result/proof/snapshot files.");
  }
  if (!sha256DigestPattern.test(String(result.generatedOutputDigest ?? "")) ||
    finalReport.generatedCompileExecution?.generatedOutputDigest !== result.generatedOutputDigest) {
    failures.push("generated compile execution output digest must be sha256 and mirrored in final report.");
  }
  const reviewedExecutionHead = result.reviewedExecutionHead ?? result.currentHead;
  if (finalReport.generatedCompileExecution?.reviewedExecutionHead !== reviewedExecutionHead) {
    failures.push("final report generatedCompileExecution.reviewedExecutionHead must mirror formal compile execution result/proof reviewedExecutionHead.");
  }
  if (result.reproducibility?.sameGeneratedOutputDigest !== true ||
    result.reproducibility?.sameDerivedOutputDigest !== true ||
    result.reproducibility?.sameKernelGraphDigest !== true) {
    failures.push("generated compile execution reproducibility proof must show matching output, derived, and kernel graph digests.");
  }
  if (!["PASS", "passed"].includes(result.noManualEditProof?.status)) {
    failures.push("generated compile execution must bind no-manual-edit proof PASS.");
  }
  for (const [label, status] of Object.entries(result.consistencyProof ?? {})) {
    if (!["PASS", "passed"].includes(status)) {
      failures.push(`generated compile execution consistency proof ${label} must be PASS.`);
    }
  }
  if (result.driftProof?.noSourceBusinessFactChanges !== true ||
    result.driftProof?.noRuntimeImplementationChanges !== true) {
    failures.push("generated compile execution must prove no source business fact or runtime implementation drift.");
  }
  const node = (graph.nodes ?? []).find((item) => item.id === "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-EXECUTION");
  if (!node) {
    failures.push("evidence graph missing generated compile execution proof node.");
    return;
  }
  if (node.scope !== "formal_generated_compile_execution_only" ||
    node.status !== "passed" ||
    node.generatedCompileAuthorized !== true ||
    node.generatedCompilationAllowed !== true ||
    node.generatedCompileCompleted !== true ||
    node.generatedCompilationCompleted !== true ||
    node.generatedCandidateAcceptedBy00 !== false ||
    node.runtimeConsumptionReady !== false ||
    node.businessFeatureDevelopmentAllowed !== false ||
    node.productionConfirmAllowed !== false ||
    node.releaseAuthority !== false ||
    node.finalGoNoGo !== "NO_GO") {
    failures.push("generated compile execution proof node must complete only execution and keep candidate/runtime/business/release/GO blocked.");
  }
  for (const dep of [
    "OAM-DORMITORY-GOLDEN-CHAIN-FORMAL-GENERATED-COMPILE-AUTHORIZATION",
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-CANDIDATE",
    generatedCompileExecutionProofPath,
    "artifacts/oam/checks/generated-files-not-manually-edited-result.json",
    "artifacts/oam/checks/generated-contract-consistency-result.json",
    "artifacts/oam/checks/derived-contract-consistency-result.json",
    "artifacts/oam/checks/oam-kernel-graph-result.json"
  ]) {
    if (!(node.dependsOn ?? []).includes(dep)) {
      failures.push(`generated compile execution proof node missing dependency: ${dep}.`);
    }
  }
  const binding = node.binding ?? {};
  for (const [field, expected] of Object.entries({
    resultDigest: hashFileText(generatedCompileExecutionResultPath),
    proofDigest: hashFileText(generatedCompileExecutionProofPath),
    snapshotDigest: hashFileText(generatedCompileExecutionSnapshotPath),
    generatedOutputDigest: result.generatedOutputDigest,
    generatedCompileAuthorized: true,
    generatedCompilationAllowed: true,
    generatedCompileCompleted: true,
    generatedCompilationCompleted: true,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  })) {
    if (binding[field] !== expected) {
      failures.push(`generated compile execution binding ${field} must be ${expected}, actual ${binding[field] ?? "missing"}.`);
    }
  }
  if (!JSON.stringify(graph).includes(generatedCompileExecutionProofPath)) {
    failures.push("evidence graph must reference generated compile execution proof path.");
  }
}

function checkGeneratedCandidateAcceptance(finalReport, graph, documents, state) {
  const acceptance = documents.get(generatedCandidateAcceptancePath);
  const result = documents.get(generatedCandidateAcceptanceResultPath);
  if (!acceptance || !result) {
    failures.push("generated candidate acceptance authority/result is missing.");
    return;
  }
  if (state.status !== "PASS" || result.status !== "PASS") {
    failures.push("generated candidate acceptance checker must PASS.");
  }
  if (state.decisionStatus !== acceptance.decisionStatus ||
    result.decisionStatus !== acceptance.decisionStatus) {
    failures.push("generated candidate acceptance decisionStatus must match authority, checker result, and predicate state.");
  }
  if (finalReport.generatedCandidateAcceptance?.decisionStatus !== state.decisionStatus ||
    finalReport.generatedCandidateAcceptance?.generatedCandidateAcceptedBy00 !== state.generatedCandidateAcceptedBy00 ||
    finalReport.generatedCandidateAcceptance?.acceptedGeneratedBundleDigest !== state.acceptedGeneratedBundleDigest) {
    failures.push("final report generatedCandidateAcceptance must mirror accepted GeneratedContractBundle authority.");
  }
  if (finalReport.generatedCandidateAcceptedBy00 !== state.generatedCandidateAcceptedBy00) {
    failures.push("final report generatedCandidateAcceptedBy00 must be read from generated-candidate-acceptance.current.json.");
  }
  if (state.decisionStatus === "PENDING_00_DECISION" && finalReport.generatedCandidateAcceptedBy00 !== false) {
    failures.push("PENDING_00_DECISION must keep generatedCandidateAcceptedBy00=false.");
  }
  if (finalReport.productionConfirmAllowed !== false ||
    finalReport.releaseAuthority !== false ||
    finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("generated candidate acceptance authority must not open production/release/GO.");
  }
  const matrixStatus = finalReport.statusMatrix?.generatedCandidateAcceptanceStatus?.status;
  const expectedMatrixStatus = state.generatedCandidateAcceptedBy00 ? "PASS" : "NO_GO";
  if (matrixStatus !== expectedMatrixStatus) {
    failures.push(`generatedCandidateAcceptanceStatus must be ${expectedMatrixStatus}, actual ${matrixStatus ?? "missing"}.`);
  }
  const node = (graph.nodes ?? []).find((item) => item.id === "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-CANDIDATE-ACCEPTANCE");
  if (!node) {
    failures.push("evidence graph missing generated candidate acceptance authority node.");
    return;
  }
  if (node.scope !== "generated_candidate_acceptance_authority_only" ||
    node.decisionStatus !== state.decisionStatus ||
    node.generatedCandidateAcceptedBy00 !== state.generatedCandidateAcceptedBy00 ||
    node.acceptedGeneratedBundleDigest !== state.acceptedGeneratedBundleDigest ||
    node.runtimeConsumptionReady !== false ||
    node.businessFeatureDevelopmentAllowed !== false ||
    node.productionConfirmAllowed !== false ||
    node.releaseAuthority !== false ||
    node.finalGoNoGo !== "NO_GO") {
    failures.push("generated candidate acceptance node must mirror the predicate and keep runtime/business/release/GO blocked.");
  }
  for (const dep of [
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-EXECUTION",
    generatedCompileExecutionProofPath,
    generatedCandidateAcceptancePath,
    generatedCandidateAcceptanceResultPath
  ]) {
    if (!(node.dependsOn ?? []).includes(dep)) {
      failures.push(`generated candidate acceptance node missing dependency: ${dep}.`);
    }
  }
  const binding = node.binding ?? {};
  for (const [field, expected] of Object.entries({
    acceptanceAuthorityRef: generatedCandidateAcceptancePath,
    acceptanceResultRef: generatedCandidateAcceptanceResultPath,
    decisionStatus: state.decisionStatus,
    generatedCandidateAcceptedBy00: state.generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: state.acceptedGeneratedBundleDigest,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  })) {
    if (binding[field] !== expected) {
      failures.push(`generated candidate acceptance binding ${field} must be ${expected}, actual ${binding[field] ?? "missing"}.`);
    }
  }
}

function checkDormitoryRuntimeAdmission(finalReport, graph, documents, state) {
  const authority = documents.get(dormitoryRuntimeAdmissionPath);
  const result = documents.get(dormitoryRuntimeAdmissionResultPath);
  const proof = documents.get(dormitoryRuntimeTestOnlyProofPath);
  if (!authority || !result || !proof) {
    failures.push("dormitory runtime admission authority/result/proof is missing.");
    return;
  }
  if (state.status !== "PASS" || result.status !== "PASS") {
    failures.push("dormitory runtime admission checker must PASS.");
  }
  if (state.runtimeAdmissionStatus !== authority.runtimeAdmissionStatus ||
    result.runtimeAdmissionStatus !== authority.runtimeAdmissionStatus) {
    failures.push("runtimeAdmissionStatus must match authority, checker result, and predicate state.");
  }
  if (authority.runtimeConsumptionReady !== state.runtimeConsumptionReady ||
    result.runtimeConsumptionReady !== state.runtimeConsumptionReady ||
    finalReport.runtimeConsumptionReady !== state.runtimeConsumptionReady) {
    failures.push("runtimeConsumptionReady must be read from dormitory-runtime-admission.current.json.");
  }
  if (finalReport.runtimeAdmissionStatus !== state.runtimeAdmissionStatus ||
    finalReport.dormitoryRuntimeAdmission?.runtimeAdmissionStatus !== state.runtimeAdmissionStatus ||
    finalReport.dormitoryRuntimeAdmission?.acceptedGeneratedBundleDigest !== state.acceptedGeneratedBundleDigest ||
    finalReport.dormitoryRuntimeAdmission?.runtimeConsumedBundleDigest !== state.runtimeConsumedBundleDigest ||
    finalReport.dormitoryRuntimeAdmission?.bundleDigestMatch !== state.bundleDigestMatch) {
    failures.push("Final Report dormitoryRuntimeAdmission must mirror runtime admission predicate.");
  }
  if (finalReport.dormitoryRuntimeAdmission?.businessFeatureDevelopmentAllowed !== false) {
    failures.push("runtime admission section must not open business landing authority.");
  }
  if (finalReport.productionConfirmAllowed !== false ||
    finalReport.releaseAuthority !== false ||
    finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("runtime admission must not open production/release/GO.");
  }
  if (finalReport.statusMatrix?.runtimeAdmissionStatus?.status !== "PASS" ||
    finalReport.statusMatrix?.runtimeConsumptionStatus?.status !== "PASS") {
    failures.push("runtime admission and runtime consumption status entries must PASS after test-only admission approval.");
  }
  const node = (graph.nodes ?? []).find((item) => item.id === "OAM-DORMITORY-GOLDEN-CHAIN-RUNTIME-ADMISSION");
  if (!node) {
    failures.push("evidence graph missing dormitory runtime admission authority node.");
    return;
  }
  if (node.scope !== "dormitory_first_golden_chain_test_only_consumption" ||
    node.runtimeAdmissionStatus !== state.runtimeAdmissionStatus ||
    node.generatedCandidateAcceptedBy00 !== true ||
    node.acceptedGeneratedBundleDigest !== state.acceptedGeneratedBundleDigest ||
    node.runtimeConsumedBundleDigest !== state.runtimeConsumedBundleDigest ||
    !sameJson(node.runtimeConsumedFilesDigestList, state.runtimeConsumedFilesDigestList) ||
    !sameJson(node.acceptedRuntimeConsumableDigests, state.acceptedRuntimeConsumableDigests) ||
    node.bundleDigestMatch !== state.bundleDigestMatch ||
    node.runtimeConsumptionReady !== state.runtimeConsumptionReady ||
    node.businessFeatureDevelopmentAllowed !== false ||
    node.dormitoryFirstGoldenChainLandingGoNoGo !== "NO_GO" ||
    node.productionConfirmAllowed !== false ||
    node.financePostingAllowed !== false ||
    node.dormitoryL2Allowed !== false ||
    node.releaseAuthority !== false ||
    node.finalGoNoGo !== "NO_GO") {
    failures.push("runtime admission node must mirror predicate and keep business/production/finance/L2/release/GO blocked.");
  }
  for (const dep of [
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-CANDIDATE-ACCEPTANCE",
    dormitoryRuntimeAdmissionPath,
    dormitoryRuntimeAdmissionResultPath,
    dormitoryRuntimeTestOnlyProofPath
  ]) {
    if (!(node.dependsOn ?? []).includes(dep)) {
      failures.push(`runtime admission node missing dependency: ${dep}.`);
    }
  }
  const binding = node.binding ?? {};
  for (const [field, expected] of Object.entries({
    runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
    runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
    testOnlyConsumptionProofRef: dormitoryRuntimeTestOnlyProofPath,
    runtimeAdmissionStatus: state.runtimeAdmissionStatus,
    generatedCandidateAcceptedBy00: true,
    acceptedGeneratedBundleDigest: state.acceptedGeneratedBundleDigest,
    runtimeConsumedBundleDigest: state.runtimeConsumedBundleDigest,
    bundleDigestMatch: state.bundleDigestMatch,
    runtimeConsumptionReady: state.runtimeConsumptionReady,
    runtimeConsumptionMode: "test_only_consumption",
    businessFeatureDevelopmentAllowed: false,
    dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  })) {
    if (binding[field] !== expected) {
      failures.push(`runtime admission binding ${field} must be ${expected}, actual ${binding[field] ?? "missing"}.`);
    }
  }
}

function checkDormitoryFirstGoldenChainLanding(finalReport, graph, documents, state) {
  const authority = documents.get(dormitoryFirstGoldenChainLandingPath);
  const result = documents.get(dormitoryFirstGoldenChainLandingResultPath);
  const proof = documents.get(dormitoryFirstGoldenChainLandingProofPath);
  if (!authority || !result || !proof) {
    failures.push("dormitory first golden chain landing authority/result/proof is missing.");
    return;
  }
  if (state.status !== "PASS" || result.status !== "PASS" || proof.status !== "PASS") {
    failures.push("dormitory first golden chain landing checker and proof must PASS.");
  }
  if (state.landingStatus !== authority.landingStatus || result.landingStatus !== authority.landingStatus) {
    failures.push("landingStatus must match authority, checker result, and predicate state.");
  }
  if (authority.runtimeConsumptionReady !== true ||
    result.runtimeConsumptionReady !== true ||
    proof.runtimeConsumptionReady !== true ||
    finalReport.runtimeConsumptionReady !== true) {
    failures.push("business landing admission requires runtime_test_admission runtimeConsumptionReady=true.");
  }
  if (state.landingStatus !== DORMITORY_L1_LANDING_APPROVED_STATUS ||
    finalReport.dormitoryFirstGoldenChainLandingStatus !== state.landingStatus ||
    finalReport.dormitoryFirstGoldenChainLanding?.landingStatus !== state.landingStatus ||
    finalReport.dormitoryFirstGoldenChainLandingStatusEntry?.status !== "PASS") {
    failures.push("Final Report dormitory first golden chain landing status must mirror approved S8 authority.");
  }
  if (finalReport.businessFeatureDevelopmentAllowed !== true ||
    finalReport.dormitoryFirstGoldenChainLandingGoNoGo !== "GO") {
    failures.push("S8 approved authority must be the only source of L1 business landing GO.");
  }
  if (finalReport.businessProductionGoNoGo !== "NO_GO" ||
    finalReport.dormitoryL2GoNoGo !== "NO_GO" ||
    finalReport.productionConfirmAllowed !== false ||
    finalReport.productionConfirmGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("S8 business landing must keep production, Dormitory L2, release, and final GO blocked.");
  }
  if (finalReport.statusMatrix?.dormitoryFirstGoldenChainLandingStatus?.status !== "PASS") {
    failures.push("dormitoryFirstGoldenChainLandingStatus must PASS after S8 approval.");
  }
  if (JSON.stringify(state.allowedLandingWorkItemTypes) !== JSON.stringify(allowedDormitoryBusinessLandingWorkItemTypes) ||
    JSON.stringify(proof.allowedLandingWorkItemTypes) !== JSON.stringify(allowedDormitoryBusinessLandingWorkItemTypes)) {
    failures.push("S8 allowed landing work item types must be exactly RoomSetupConfirm -> BedSetupConfirm -> ResourceReadinessConfirm.");
  }
  if (proof.negativeAuthorities?.financePostingAllowed !== false ||
    proof.negativeAuthorities?.dormitoryL2Allowed !== false ||
    proof.negativeAuthorities?.productionConfirmAllowed !== false ||
    proof.negativeAuthorities?.releaseAuthority !== false ||
    proof.negativeAuthorities?.finalGoNoGo !== "NO_GO") {
    failures.push("S8 proof negative authorities must keep Finance, Dormitory L2, production, release, and final GO blocked.");
  }
  const node = (graph.nodes ?? []).find((item) => item.id === "OAM-DORMITORY-GOLDEN-CHAIN-BUSINESS-LANDING");
  if (!node) {
    failures.push("evidence graph missing dormitory first golden chain business landing node.");
    return;
  }
  if (node.scope !== "dormitory_l1_first_golden_chain_only" ||
    node.landingStatus !== state.landingStatus ||
    node.runtimeAdmissionStatus !== state.runtimeAdmissionStatus ||
    node.generatedCandidateAcceptedBy00 !== true ||
    node.runtimeConsumptionReady !== true ||
    node.businessFeatureDevelopmentAllowed !== true ||
    node.dormitoryFirstGoldenChainLandingGoNoGo !== "GO" ||
    node.businessProductionGoNoGo !== "NO_GO" ||
    node.productionConfirmAllowed !== false ||
    node.financePostingAllowed !== false ||
    node.dormitoryL2Allowed !== false ||
    node.releaseAuthority !== false ||
    node.finalGoNoGo !== "NO_GO") {
    failures.push("S8 business landing node must mirror predicate and keep Finance/L2/production/release/final GO blocked.");
  }
  for (const dep of [
    "OAM-DORMITORY-GOLDEN-CHAIN-RUNTIME-ADMISSION",
    dormitoryFirstGoldenChainLandingPath,
    dormitoryFirstGoldenChainLandingResultPath,
    dormitoryFirstGoldenChainLandingProofPath
  ]) {
    if (!(node.dependsOn ?? []).includes(dep)) {
      failures.push(`S8 business landing node missing dependency: ${dep}.`);
    }
  }
  const binding = node.binding ?? {};
  for (const [field, expected] of Object.entries({
    businessLandingAuthorityRef: dormitoryFirstGoldenChainLandingPath,
    businessLandingResultRef: dormitoryFirstGoldenChainLandingResultPath,
    businessLandingProofRef: dormitoryFirstGoldenChainLandingProofPath,
    runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
    runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
    runtimeAdmissionStatus: state.runtimeAdmissionStatus,
    landingStatus: state.landingStatus,
    generatedCandidateAcceptedBy00: true,
    runtimeConsumptionReady: true,
    acceptedSubjectDigest: state.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: state.generatedCandidateSubjectDigest,
    businessFeatureDevelopmentAllowed: true,
    dormitoryFirstGoldenChainLandingGoNoGo: "GO",
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    businessGoAuthority: true,
    finalGoNoGo: "NO_GO"
  })) {
    if (binding[field] !== expected) {
      failures.push(`S8 business landing binding ${field} must be ${expected}, actual ${binding[field] ?? "missing"}.`);
    }
  }
}

function expectedReleaseReferenceOnly(state, sourceCommitSha, evidenceRunSha) {
  const lifecycleType = state?.evidenceLifecycleType ?? state?.evidenceLifecycle?.lifecycleType;
  const digestStatus = state?.githubArtifactDigestStatus;
  const sourceBindingStale = sourceCommitSha !== currentRepositoryHead || evidenceRunSha !== currentRepositoryHead;
  return sourceBindingStale
    || lifecycleType !== "ci-release"
    || state?.workspaceDirtyAtGeneration === true
    || currentWorkspaceDirty
    || digestStatus !== "attested";
}

function checkEvidenceBindingConsistency(graph, releaseObject, finalReport, expectedDigest) {
  const graphBinding = graph?.binding ?? {};
  const finalBinding = finalReport?.binding ?? {};
  const releaseBinding = releaseObject?.binding ?? {};
  const graphSourceSha = graphBinding.sourceCommitSha ?? graph.sourceCommitSha ?? graphBinding.commitSha;
  const finalSourceSha = finalBinding.sourceCommitSha ?? finalReport.sourceCommitSha ?? finalReport.latestCommit;
  const releaseSourceSha = releaseObject?.sourceCommitSha ?? releaseBinding.sourceCommitSha ?? releaseObject?.githubSha;
  const graphRunSha = graphBinding.evidenceRunSha ?? graph.evidenceRunSha ?? graphBinding.githubSha;
  const finalRunSha = finalBinding.evidenceRunSha ?? finalReport.evidenceRunSha ?? finalBinding.githubSha;
  const releaseRunSha = releaseObject?.evidenceRunSha ?? releaseBinding.evidenceRunSha ?? releaseObject?.githubSha;

  for (const [label, value] of [
    ["evidence graph sourceCommitSha", graphSourceSha],
    ["final report sourceCommitSha", finalSourceSha],
    ["release evidence sourceCommitSha", releaseSourceSha],
    ["evidence graph evidenceRunSha", graphRunSha],
    ["final report evidenceRunSha", finalRunSha],
    ["release evidence evidenceRunSha", releaseRunSha]
  ]) {
    if (!isGitSha(value)) failures.push(`${label} must be a concrete git SHA, actual: ${value || "missing"}`);
  }

  if (graphSourceSha !== finalSourceSha || graphSourceSha !== releaseSourceSha) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report sourceCommitSha must match.");
  }
  if (graphRunSha !== finalRunSha || graphRunSha !== releaseRunSha) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report evidenceRunSha must match.");
  }
  if (finalReport.latestCommit !== graphSourceSha) {
    failures.push("Final Report latestCommit must match sourceCommitSha.");
  }

  for (const [label, digest] of [
    ["evidence graph artifactDigest", graphBinding.artifactDigest ?? graph.artifactDigest],
    ["final report artifactDigest", finalBinding.artifactDigest ?? finalReport.artifactDigest],
    ["release evidence artifactDigest", releaseObject?.artifactDigest ?? releaseBinding.artifactDigest]
  ]) {
    if (digest !== expectedDigest) {
      failures.push(`${label} must match current artifact digest ${expectedDigest}, actual: ${digest || "missing"}`);
    }
  }

  const graphGeneratedHash = graphBinding.generatedContractsHash ?? graph.generatedContractsHash;
  const finalGeneratedHash = finalBinding.generatedContractsHash ?? finalReport.generatedContractsHash;
  const releaseGeneratedHash = releaseObject?.generatedContractsHash ?? releaseBinding.generatedContractsHash;
  if (graphGeneratedHash !== finalGeneratedHash || graphGeneratedHash !== releaseGeneratedHash) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report generatedContractsHash must match.");
  }
  if (!sha256DigestPattern.test(String(graphGeneratedHash ?? ""))) {
    failures.push("generatedContractsHash must be sha256.");
  }

  const graphHash = graphBinding.evidenceGraphHash ?? graph.evidenceGraphHash;
  const finalGraphHash = finalBinding.evidenceGraphHash ?? finalReport.evidenceGraphHash;
  const releaseGraphHash = releaseObject?.evidenceGraphHash ?? releaseBinding.evidenceGraphHash;
  if (graphHash !== finalGraphHash || graphHash !== releaseGraphHash) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report evidenceGraphHash must match.");
  }
  if (!sha256DigestPattern.test(String(graphHash ?? ""))) {
    failures.push("evidenceGraphHash must be sha256.");
  }

  const graphFinalDigest = graphBinding.finalReportDigest ?? graph.finalReportDigest;
  const finalDigest = finalBinding.finalReportDigest ?? finalReport.finalReportDigest;
  const releaseFinalDigest = releaseObject?.finalReportDigest ?? releaseBinding.finalReportDigest;
  if (graphFinalDigest !== finalDigest || graphFinalDigest !== releaseFinalDigest) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report finalReportDigest must match.");
  }
  if (!sha256DigestPattern.test(String(finalDigest ?? ""))) {
    failures.push("finalReportDigest must be sha256.");
  }

  const stale = expectedReleaseReferenceOnly(graphBinding, graphSourceSha, graphRunSha);
  for (const [label, state] of [
    ["evidence graph binding", graphBinding],
    ["final report binding", finalBinding],
    ["release evidence object", releaseObject],
    ["release evidence binding", releaseBinding],
    ["evidence graph evidenceBinding", graph.evidenceBinding],
    ["final report evidenceBinding", finalReport.evidenceBinding]
  ]) {
    if (!state || typeof state !== "object") {
      failures.push(`${label} missing stale/referenceOnly binding state.`);
      continue;
    }
    if (state.stale !== stale) failures.push(`${label} stale must be ${stale}.`);
    if (state.referenceOnly !== stale) failures.push(`${label} referenceOnly must be ${stale}.`);
    if (state.bindingStatus !== (stale ? "stale" : "current")) {
      failures.push(`${label} bindingStatus must be ${stale ? "stale" : "current"}.`);
    }
  }
  if (stale && finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("stale/referenceOnly evidence must never support Final Report release.");
  }
  if (currentWorkspaceDirty) {
    for (const [label, state] of [
      ["evidence graph binding", graphBinding],
      ["final report binding", finalBinding],
      ["release evidence object", releaseObject],
      ["evidence graph evidenceBinding", graph.evidenceBinding],
      ["final report evidenceBinding", finalReport.evidenceBinding]
    ]) {
      if (state?.bindingStatus === "current" || state?.stale === false || state?.referenceOnly === false) {
        failures.push(`${label} must be referenceOnly/stale while the current worktree is dirty.`);
      }
    }
  }
}

function checkEvidenceGraphNodes(graph, finalReport) {
  const nodes = graph?.nodes ?? [];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    failures.push("Evidence Graph must contain proof DAG nodes.");
    return;
  }
  for (const node of nodes) {
    const id = node.id ?? "<missing>";
    for (const field of ["proofType", "source", "hash", "dependsOn", "status", "goNoGo"]) {
      const value = node[field];
      if (isEmptyProofField(value)) {
        failures.push(`evidence graph node ${id} missing ${field}.`);
      }
    }
    if (!sha256DigestPattern.test(String(node.hash ?? ""))) {
      failures.push(`evidence graph node ${id} hash must be sha256.`);
    }
    if (!Array.isArray(node.dependsOn) || node.dependsOn.length === 0) {
      failures.push(`evidence graph node ${id} dependsOn must be a non-empty array.`);
    }
    if (!isNonEmptySource(node.source)) {
      failures.push(`evidence graph node ${id} source must be non-empty.`);
    }
    if (!allowedNodeStatuses.has(node.status)) {
      failures.push(`evidence graph node ${id} status is not controlled: ${node.status || "missing"}`);
    }
    if (!["GO", "NO_GO"].includes(node.goNoGo)) {
      failures.push(`evidence graph node ${id} goNoGo must be GO or NO_GO.`);
    }
    if (node.type === "browser_e2e_evidence") {
      checkBrowserEvidenceNode(node, finalReport);
    }
  }
  checkProofDagResolvableAndAcyclic(nodes);
  checkSourcePackageProofDag(nodes, finalReport);
}

function checkProofDagResolvableAndAcyclic(nodes) {
  const nodeIds = new Set(nodes.map((node) => node.id).filter(Boolean));
  const graph = new Map();
  for (const node of nodes) {
    const id = node.id ?? "<missing>";
    const nodeDeps = [];
    for (const dep of node.dependsOn ?? []) {
      if (nodeIds.has(dep)) {
        nodeDeps.push(dep);
      } else if (typeof dep !== "string" || !exists(dep)) {
        failures.push(`evidence graph node ${id} has unresolved dependsOn: ${dep || "missing"}.`);
      }
    }
    graph.set(id, nodeDeps);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id, path = []) => {
    if (visiting.has(id)) {
      failures.push(`evidence graph proof DAG has a cycle: ${[...path, id].join(" -> ")}.`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of graph.get(id) ?? []) visit(dep, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}

function checkSourcePackageProofDag(nodes, finalReport) {
  const nodeIds = new Set(nodes.map((node) => node.id).filter(Boolean));
  const sourceNode = nodes.find((node) => node.id === "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE");
  if (!sourceNode) {
    failures.push("P0 proof node missing: OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE.");
    return;
  }
  if (sourceNode.decisionState !== "SOURCE_FINALIZED_BY_00") {
    failures.push("source package proof DAG source node decisionState must be SOURCE_FINALIZED_BY_00.");
  }
  if (sourceNode.compileDecisionStatus !== "READY_FOR_00_COMPILE_DECISION") {
    failures.push("source package proof DAG source node compileDecisionStatus must be READY_FOR_00_COMPILE_DECISION.");
  }
  if (sourceNode.sourceReadyForCompileDecision !== true) {
    failures.push("source package proof DAG source node sourceReadyForCompileDecision must be true.");
  }
  if (sourceNode.generatedCompileAuthorized !== false) {
    failures.push("source package proof DAG source node generatedCompileAuthorized must remain false.");
  }
  if (sourceNode.generatedCompilationAllowed !== "false_until_00_explicit_generated_compile_approval") {
    failures.push("source package proof DAG source node generatedCompilationAllowed must remain false_until_00_explicit_generated_compile_approval.");
  }
  if (sourceNode.generatedCompileCompleted !== false || sourceNode.runtimeConsumptionReady !== false) {
    failures.push("source package proof DAG source node must keep generatedCompileCompleted=false and runtimeConsumptionReady=false.");
  }
  const requiredFields = ["proofType", "source", "hash", "dependsOn", "producedBy", "verifiedBy", "scope", "binding", "status", "finalGoNoGo", "releaseAuthority", "businessGoAuthority"];
  for (const node of nodes.filter((item) => item.id === sourceNode.id || item.type === "source_package_dependency_proof")) {
    for (const field of requiredFields) {
      if (isEmptyProofField(node[field])) {
        failures.push(`source package proof node ${node.id ?? "<missing>"} missing ${field}.`);
      }
    }
    if (node.scope !== "compile_preparation_review") {
      failures.push(`source package proof node ${node.id ?? "<missing>"} scope must be compile_preparation_review.`);
    }
    if (node.finalGoNoGo !== "NO_GO" || node.releaseAuthority !== false || node.businessGoAuthority !== false) {
      failures.push(`source package proof node ${node.id ?? "<missing>"} must keep NO_GO/releaseAuthority=false/businessGoAuthority=false.`);
    }
    if (node.binding?.releaseAuthority !== false || node.binding?.businessGoAuthority !== false || node.binding?.finalGoNoGo !== "NO_GO") {
      failures.push(`source package proof node ${node.id ?? "<missing>"} binding must not grant GO or release authority.`);
    }
  }
  const requiredDeps = [
    "source-package-proof.source-package-file-hash",
    "source-package-proof.scenario-matrix-hash",
    "source-package-proof.dormitory-operating-kernel-hash",
    "source-package-proof.source-package-checker-result",
    "source-package-proof.language-copy-proof",
    "source-package-proof.read-side-envelope-proof",
    "source-package-proof.finance-ledger-none-proof",
    "source-package-proof.prior-identity-blocker-proof",
    "source-package-proof.no-side-effects-proof",
    "source-package-proof.mutation-result-proof",
    "source-package-proof.source-field-gaps-decision-proof",
    "source-package-proof.branch-flows-no-side-effects-proof"
  ];
  for (const dep of requiredDeps) {
    if (!nodeIds.has(dep)) {
      failures.push(`source package proof DAG missing dependency node: ${dep}.`);
    }
    if (!(sourceNode.dependsOn ?? []).includes(dep)) {
      failures.push(`source package proof DAG source node missing dependsOn proof: ${dep}.`);
    }
  }
  for (const dep of sourceNode.dependsOn ?? []) {
    if (!nodeIds.has(dep)) {
      failures.push(`source package proof DAG main node must depend on proof node ids, not file refs: ${dep}.`);
    }
  }
  if (finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("Source package proof stale/NO_GO guard requires Final Report finalGoNoGo=NO_GO.");
  }
}

function checkBrowserEvidenceNode(node, finalReport) {
  const id = node.id ?? "<missing>";
  const sourceCommitSha = finalReport.binding?.sourceCommitSha ?? finalReport.sourceCommitSha ?? finalReport.latestCommit;
  if (node.proofType !== "current-oam-browser-e2e-proof") {
    failures.push(`browser evidence node ${id} proofType must distinguish browser E2E proof.`);
  }
  if (!node.reportRef || !exists(node.reportRef)) {
    failures.push(`browser evidence node ${id} must bind an existing report ref.`);
  }
  if (!Array.isArray(node.refs) || !node.refs.includes(node.reportRef)) {
    failures.push(`browser evidence node ${id} refs must include reportRef.`);
  }
  if (!Array.isArray(node.screenshotHashes) || node.screenshotHashes.length === 0) {
    failures.push(`browser evidence node ${id} must bind screenshot hashes.`);
  }
  for (const hash of node.screenshotHashes ?? []) {
    const normalized = String(hash).replace(/^sha256:/, "");
    if (!bareSha256Pattern.test(normalized)) {
      failures.push(`browser evidence node ${id} screenshot hash must be sha256: ${hash}`);
    }
  }
  if (node.headSha !== sourceCommitSha) {
    failures.push(`browser evidence node ${id} headSha must match current verified sourceCommitSha.`);
  }
  if (node.sourceCommitSha !== sourceCommitSha) {
    failures.push(`browser evidence node ${id} sourceCommitSha must match Final Report.`);
  }
  if (!node.refs?.some((ref) => String(ref).includes("screenshot-index"))) {
    failures.push(`browser evidence node ${id} must bind screenshot index ref.`);
  }
  if (!node.checker || !String(node.checker).includes("check-")) {
    failures.push(`browser evidence node ${id} must bind checker ref.`);
  }
}

function generatedContractFiles() {
  return [
    "docs/oam/system-derived-contracts.json",
    "docs/oam/domain-derived-contracts.json",
    "docs/oam/generated-contracts-manifest.json",
    "docs/contracts/admission/admission-contract.json",
    "docs/oam/kernel/oam-kernel-graph.generated.json",
    "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
    "docs/contracts/generated/dormitory/fields.generated.json",
    generatedFieldBindingsPath,
    "docs/contracts/generated/dormitory/workitems.generated.json",
    "docs/contracts/generated/dormitory/surface-input-model.generated.json",
    "docs/contracts/generated/dormitory/read-model.generated.json",
    firstGoldenChainTestPlanPath,
    "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
  ];
}

function checkBinding(file, document, expectedDigest) {
  if (typeof document === "string") return;
  if (Array.isArray(document)) {
    if (document.length === 0) {
      failures.push(`${file} must contain at least one execution event.`);
    }
    for (const [index, item] of document.entries()) {
      checkBinding(`${file}#${index + 1}`, item, expectedDigest);
    }
    return;
  }
  if (document.artifactDigest && document.commitSha) {
    for (const key of ["commitSha", "branch", "ciRunId", "generatedAt", "artifactDigest"]) {
      if (document[key] === undefined || document[key] === null || document[key] === "") {
        failures.push(`${file} missing ${key}.`);
      }
    }
    if (document.artifactDigest !== expectedDigest) {
      failures.push(`${file} digest does not match evidence graph.`);
    }
    return;
  }
  const binding = document.binding;
  if (!binding) {
    failures.push(`${file} missing binding.`);
    return;
  }
  for (const key of [
    "repository",
    "workflow",
    "sourceCommitSha",
    "evidenceRunSha",
    "currentRepositoryHead",
    "stale",
    "referenceOnly",
    "bindingStatus",
    "sourceShaBindingStatus",
    "evidenceLifecycleType",
    "evidenceLifecycle",
    "releaseEvidenceReferenceOnly",
    "workspaceDirtyAtGeneration",
    "commitSha",
    "githubSha",
    "branch",
    "githubRefName",
    "ciRunId",
    "githubRunId",
    "githubRunAttempt",
    "artifactName",
    "generatedAt",
    "generatedAtUtc",
    "artifactDigest",
    "githubArtifactDigestStatus",
    "externalArtifactAttestation",
    "githubArtifactMetadataDigest",
    "zipArtifactDigest",
    "releaseAuthority",
    "evidenceRootDigest",
    "generatedContractsHash",
    "kernelGraphHash",
    "evidenceGraphHash",
    "finalReportDigest",
    "generatedCompileCandidateAuthorized",
    "authorizedSourceRef",
    "authorizedCandidateExecutionHead",
    "candidateSourceRef",
    "evidenceGeneratedAtHead",
    "candidateCompileEvidenceStatus",
    "candidateCompileClosureForCurrentHead",
    "candidateCompileNextAction",
    "generatedCompileCandidateStatus",
    "generatedFieldBindingClosureRequired",
    "generatedFieldBindingClosureStatus",
    "generatedFieldBindingClosureDigest",
    "sourceFieldGapsDecisionDigest",
    "candidateAttestationIsReleaseEvidence",
    "releaseEvidenceRequiredAfterCandidateEvidence",
    "generatedCandidateAcceptedBy00",
    "generatedCandidateAcceptanceDecisionStatus",
    "runtimeAdmissionStatus",
    "runtimeAdmissionAuthorityRef",
    "runtimeAdmissionResultRef",
    "testOnlyConsumptionProofRef",
    "reviewedExecutionHead",
    "decisionRecordHead",
    "generatedOutputDigest",
    "evidenceArtifactDigest",
    "executionProofDigest",
    "generatedReleaseAllowed",
    "runtimeConsumptionAllowed",
    "runtimeConsumptionReady"
  ]) {
    if (key === "decisionRecordHead" && Object.hasOwn(binding, key)) continue;
    if (binding[key] === undefined || binding[key] === null || binding[key] === "") {
      failures.push(`${file} binding missing ${key}.`);
    }
  }
  if (binding.githubSha !== binding.commitSha) {
    failures.push(`${file} binding githubSha must match commitSha.`);
  }
  if (binding.commitSha !== binding.sourceCommitSha) {
    failures.push(`${file} binding commitSha must match sourceCommitSha.`);
  }
  if (binding.evidenceRunSha !== binding.sourceCommitSha) {
    failures.push(`${file} binding evidenceRunSha must match sourceCommitSha for current single-commit evidence runs.`);
  }
  if (!isGitSha(binding.sourceCommitSha)) {
    failures.push(`${file} binding sourceCommitSha must be a concrete git SHA.`);
  }
  const stale = expectedReleaseReferenceOnly(binding, binding.sourceCommitSha, binding.evidenceRunSha);
  if (binding.stale !== stale) {
    failures.push(`${file} binding stale must be ${stale}.`);
  }
  if (binding.referenceOnly !== stale) {
    failures.push(`${file} binding referenceOnly must be ${stale}.`);
  }
  if (binding.bindingStatus !== (stale ? "stale" : "current")) {
    failures.push(`${file} bindingStatus must be ${stale ? "stale" : "current"}.`);
  }
  if (binding.githubRefName !== binding.branch) {
    failures.push(`${file} binding githubRefName must match branch.`);
  }
  if (binding.githubRunId !== binding.ciRunId) {
    failures.push(`${file} binding githubRunId must match ciRunId.`);
  }
  if (binding.githubRunAttempt !== ciRunAttempt) {
    failures.push(`${file} binding githubRunAttempt must be ${ciRunAttempt}.`);
  }
  if (binding.artifactName !== expectedArtifactName) {
    failures.push(`${file} binding artifactName must be ${expectedArtifactName}.`);
  }
  if (binding.githubArtifactMetadataDigest === binding.artifactDigest || binding.githubArtifactDigest === binding.artifactDigest) {
    failures.push(`${file} binding external artifact digest must not match internal artifactDigest.`);
  }
  if (binding.githubArtifactDigestStatus === pendingExternalAttestation && binding.releaseAuthority !== false) {
    failures.push(`${file} pending external attestation must force releaseAuthority=false.`);
  }
  if (binding.githubArtifactDigestStatus === pendingExternalAttestation && binding.externalArtifactAttestation !== "PENDING_EXTERNAL_ATTESTATION") {
    failures.push(`${file} pending external attestation must use externalArtifactAttestation=PENDING_EXTERNAL_ATTESTATION.`);
  }
  if (binding.githubArtifactDigestStatus === "attested" && binding.externalArtifactAttestation !== "ATTESTED") {
    failures.push(`${file} attested artifact must use externalArtifactAttestation=ATTESTED.`);
  }
  if (binding.workspaceDirtyAtGeneration === true && binding.releaseAuthority !== false) {
    failures.push(`${file} dirty workspace binding must force releaseAuthority=false.`);
  }
  if (currentWorkspaceDirty && (binding.bindingStatus === "current" || binding.stale === false || binding.referenceOnly === false)) {
    failures.push(`${file} binding must be referenceOnly/stale while the current worktree is dirty.`);
  }
  if (binding.artifactDigest !== expectedDigest) {
    failures.push(`${file} binding digest does not match evidence graph.`);
  }
}

function requiresEvidenceBinding(file) {
  if (file === firstGoldenChainBrowserAuditReportPath || file === firstGoldenChainBrowserAuditScreenshotIndexPath) {
    return false;
  }
  return (file.startsWith("artifacts/oam/evidence/") && file !== generatedCompileExecutionProofPath) ||
    file === "artifacts/oam/final-report.json";
}

function checkSummaries(file, document) {
  if (typeof document === "string") return;
  if (Array.isArray(document)) return;
  if (!document.gateSummary?.commands?.length) {
    failures.push(`${file} missing gate summary.`);
  }
  if (!document.testSummary?.commands?.length) {
    failures.push(`${file} missing test summary.`);
  }
  if (!document.coverageSummary?.targets) {
    failures.push(`${file} missing coverage summary.`);
  }
  if (!document.summary?.goNoGo && !document.finalGoNoGo) {
    failures.push(`${file} missing go/no-go.`);
  }
}

function digestFor(fileMap) {
  const normalized = {};
  for (const [file, document] of [...fileMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    normalized[file] = normalizeForDigest(document);
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function digestObject(value) {
  return `sha256:${sha256(JSON.stringify(stableForSubjectDigest(value)))}`;
}

function hashFileText(file) {
  return `sha256:${sha256(readText(file))}`;
}

function stableForSubjectDigest(value) {
  if (Array.isArray(value)) return value.map(stableForSubjectDigest);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = stableForSubjectDigest(value[key]);
  }
  return output;
}

function trackedContentDigest() {
  const files = execSync("git ls-files", { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/\\/g, "/"))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const entries = {};
  for (const file of files) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) {
      entries[file] = "missing";
      continue;
    }
    entries[file] = `sha256:${sha256(fs.readFileSync(target))}`;
  }
  return digestObject({
    kind: "tracked-content-digest",
    fileCount: files.length,
    entries
  });
}

function normalizeForDigest(value) {
  if (typeof value === "string") return value.replaceAll(/sha256:[a-f0-9]{64}|__CURRENT_OAM_EVIDENCE_DIGEST__|__CURRENT_OAM_EVIDENCE_ROOT_DIGEST__/g, digestPlaceholder);
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = isDigestOrHashKey(key) ? digestPlaceholder : normalizeForDigest(value[key]);
  }
  return output;
}

function isDigestOrHashKey(key) {
  return [
    "artifactDigest",
    "githubArtifactDigest",
    "githubArtifactMetadataDigest",
    "zipArtifactDigest",
    "evidenceRootDigest",
    "generatedContractsHash",
    "kernelGraphHash",
    "evidenceGraphHash",
    "finalReportDigest"
  ].includes(key);
}

function workflowContainsEvidenceUpload() {
  const workflow = readText(".github/workflows/ci.yml");
  return workflow.includes("node scripts/oam/generate-current-evidence-root.mjs") &&
    workflow.includes("node scripts/oam/check-current-evidence-root.mjs") &&
    workflow.includes("node scripts/oam/generate-mobile-branch-risk-ledger.mjs") &&
    workflow.includes("node scripts/oam/check-mobile-coverage-policy.mjs") &&
    workflow.includes("node scripts/oam/check-mobile-critical-branch-scenarios.mjs") &&
    workflow.includes("node scripts/oam/check-kernel-responsibility-map.mjs") &&
    workflow.includes("node scripts/oam/check-professional-ai-review-seats.mjs") &&
    workflow.includes("node scripts/oam/check-codex-execution-channel-policy.mjs") &&
    workflow.includes("node scripts/oam/check-cross-domain-conflict-rules.mjs") &&
    workflow.includes("node scripts/oam/check-system-operating-kernel.mjs") &&
    workflow.includes("node scripts/oam/generate-authority-source-layer-audit.mjs") &&
    workflow.includes("node scripts/oam/check-authority-source-layer-audit.mjs") &&
    workflow.includes("node scripts/oam/check-authority-cleanup-mutation-tests.mjs") &&
    workflow.includes("node scripts/oam/compile-current-kernel-graph.mjs") &&
    workflow.includes("node scripts/oam/check-generated-contract-consistency.mjs") &&
    workflow.includes("node scripts/oam/check-generated-files-not-manually-edited.mjs") &&
    workflow.includes("node scripts/oam/check-read-intelligence-kernel.mjs") &&
    workflow.includes("node scripts/oam/check-dashboard-readonly.mjs") &&
    workflow.includes("node scripts/oam/check-db-no-side-effects-proof.mjs") &&
    workflow.includes("node scripts/oam/check-oam-kernel-graph.mjs") &&
    workflow.includes("node scripts/oam/check-file-lifecycle-policy.mjs") &&
    workflow.includes("node scripts/oam/check-retired-reference-blocker.mjs") &&
    workflow.includes("node scripts/oam/generate-system-derived-contracts.mjs") &&
    workflow.includes("node scripts/oam/check-derived-contract-consistency.mjs") &&
    workflow.includes("node scripts/oam/check-system-handoff-contract.mjs") &&
    workflow.includes("node scripts/oam/check-system-failure-routing-contract.mjs") &&
    workflow.includes("pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1") &&
    workflow.includes("node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs") &&
    workflow.includes("node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs") &&
    workflow.includes("actions/upload-artifact") &&
    workflow.includes("artifacts/oam/evidence/**") &&
    workflow.includes("artifacts/oam/checks/**") &&
    workflow.includes("artifacts/oam/test-results/**") &&
    workflow.includes("artifacts/oam/final-report.json");
}

function controlPlaneContainsEvidenceRoot() {
  const gate = readText("scripts/oam/run-control-plane-checks.ps1");
  return gate.includes("node scripts/oam/generate-current-evidence-root.mjs") &&
    gate.includes("node scripts/oam/check-current-evidence-root.mjs") &&
    gate.includes("node scripts/oam/generate-mobile-branch-risk-ledger.mjs") &&
    gate.includes("node scripts/oam/check-mobile-coverage-policy.mjs") &&
    gate.includes("node scripts/oam/check-mobile-critical-branch-scenarios.mjs") &&
    gate.includes("node scripts/oam/check-kernel-responsibility-map.mjs") &&
    gate.includes("node scripts/oam/check-professional-ai-review-seats.mjs") &&
    gate.includes("node scripts/oam/check-codex-execution-channel-policy.mjs") &&
    gate.includes("node scripts/oam/check-cross-domain-conflict-rules.mjs") &&
    gate.includes("node scripts/oam/check-system-operating-kernel.mjs") &&
    gate.includes("node scripts/oam/generate-authority-source-layer-audit.mjs") &&
    gate.includes("node scripts/oam/check-authority-source-layer-audit.mjs") &&
    gate.includes("node scripts/oam/check-authority-cleanup-mutation-tests.mjs") &&
    gate.includes("node scripts/oam/compile-current-kernel-graph.mjs") &&
    gate.includes("node scripts/oam/check-generated-contract-consistency.mjs") &&
    gate.includes("node scripts/oam/check-generated-files-not-manually-edited.mjs") &&
    gate.includes("node scripts/oam/check-read-intelligence-kernel.mjs") &&
    gate.includes("node scripts/oam/check-dashboard-readonly.mjs") &&
    gate.includes("node scripts/oam/check-db-no-side-effects-proof.mjs") &&
    gate.includes("node scripts/oam/check-oam-kernel-graph.mjs") &&
    gate.includes("node scripts/oam/check-file-lifecycle-policy.mjs") &&
    gate.includes("node scripts/oam/check-retired-reference-blocker.mjs") &&
    gate.includes("node scripts/oam/generate-system-derived-contracts.mjs") &&
    gate.includes("node scripts/oam/check-derived-contract-consistency.mjs") &&
    gate.includes("node scripts/oam/check-system-handoff-contract.mjs") &&
    gate.includes("node scripts/oam/check-system-failure-routing-contract.mjs") &&
    gate.includes("pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1") &&
    gate.includes("node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs") &&
    gate.includes("node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs");
}

function checkMobileBranchRiskKernel(graph, finalReport) {
  const kernel = finalReport.mobileBranchRiskKernel;
  if (!kernel) {
    failures.push("final report missing mobile branch risk kernel.");
    return;
  }
  if (kernel.status !== "passed") {
    failures.push(`mobile branch risk kernel must be passed, actual: ${kernel.status}`);
  }
  if (kernel.branchRiskLedgerGenerated !== true) {
    failures.push("mobile branch risk ledger must be generated.");
  }
  if (kernel.checks?.coveragePolicy !== "passed") {
    failures.push("mobile coverage policy result must be passed.");
  }
  if (kernel.checks?.criticalScenarios !== "passed") {
    failures.push("mobile critical scenario result must be passed.");
  }
  if (kernel.p0ScenariosCovered !== true) {
    failures.push("mobile P0 critical scenarios must be covered.");
  }
  if (!graph.mobileBranchRiskKernel) {
    failures.push("evidence graph missing mobile branch risk kernel.");
  }
}

function checkRealBrowserEvidence(graph, finalReport) {
  const summary = graph.realBrowserEvidence;
  if (!summary) {
    failures.push("evidence graph missing real browser evidence summary.");
    return;
  }
  const requirePassed = true;
  const reasons = finalReport.finalDecision?.noGoReasons ?? finalReport.noGoReasons ?? [];
  if (summary.status !== "passed" && requirePassed) {
    failures.push(`first golden chain real browser evidence summary must be passed, actual: ${summary.status}`);
  }
  if (summary.status !== "passed" && !reasons.some((reason) => /真实浏览器|real browser/i.test(reason))) {
    failures.push("real browser evidence is not passed but Final Report does not record a NO_GO reason.");
  }
  if (summary.singleWriter !== "scripts/oam/generate-current-evidence-root.mjs") {
    failures.push("real browser evidence must be written by the current evidence root generator.");
  }
  const current = summary.firstGoldenChain ?? summary.l1;
  if (!current) {
    failures.push("real browser evidence missing firstGoldenChain current main audit.");
  } else {
    const gate = "DORMITORY-FIRST-GOLDEN-CHAIN-REAL-BROWSER";
    if (current.status !== "passed") failures.push("first golden chain browser evidence must be passed.");
    if (!current.report || !exists(current.report)) {
      failures.push(`first golden chain browser evidence report is missing: ${current.report || "(empty)"}`);
    }
    if ((current.scenarioCount ?? 0) !== 1) failures.push("first golden chain browser evidence must contain exactly one current capability scenario.");
    if ((current.screenshotHashCount ?? 0) <= 0) failures.push("first golden chain browser evidence has no screenshot hashes.");
    if (current.scenarioScope?.currentMainGate !== true) failures.push("first golden chain browser evidence must be the current main gate.");
    if (current.scenarioScope?.legacyTenScenarioAsMainGate !== false ||
      current.scenarioScope?.legacyAllStepsAsMainGate !== false) {
      failures.push("legacy ten-scenario/all-steps browser audits must not be current main gates.");
    }
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (!node.refs?.includes(current.report)) failures.push(`${gate} node missing report ref.`);
    }
    const browserReport = current.report && exists(current.report) ? readJson(current.report) : null;
    checkFirstGoldenChainBrowserReport(browserReport, current, node);
  }

  for (const [key, gate] of [
    ["tenScenario", "DORMITORY-TEN-SCENARIO-REAL-BROWSER"],
    ["legacyL1", "DORM-L1-BROWSER-E2E"]
  ]) {
    const item = summary[key];
    if (!item) {
      continue;
    }
    if (item.currentMainGate === true || item.scenarioScope?.currentMainGate === true) {
      failures.push(`${key} browser evidence must not be a current main gate.`);
    }
    if (item.lane !== "legacy_regression_only") failures.push(`${key} browser evidence must be legacy_regression_only.`);
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (node?.scenarioScope?.currentMainGate === true) failures.push(`${gate} graph node must not be current main gate.`);
  }
}

function checkFirstGoldenChainBrowserReport(report, summary, node) {
  if (!report || typeof report !== "object") {
    failures.push("first golden chain browser report is missing or invalid.");
    return;
  }
  if (report.status !== "passed") failures.push("first golden chain browser report status must be passed.");
  if (report.capabilityId !== "Dormitory.FirstGoldenChain") {
    failures.push(`first golden chain browser report capabilityId invalid: ${report.capabilityId ?? "missing"}.`);
  }
  if (report.productionConfirmAllowed !== false || report.releaseAuthority !== false || report.finalGoNoGo !== "NO_GO") {
    failures.push("first golden chain browser report must keep production/release/final GO closed.");
  }
  if (report.legacyBrowserAuditLane?.tenScenarioAsMainGate !== false ||
    report.legacyBrowserAuditLane?.allStepsAsMainGate !== false) {
    failures.push("first golden chain browser report must keep legacy audits out of the main gate.");
  }
  const steps = (report.steps ?? [])
    .filter((step) => /-ready$/.test(String(step.stepId ?? "")))
    .map((step) => step.domState?.cardId)
    .filter(Boolean);
  const expectedSteps = ["Dorm.RoomSetupConfirm", "Dorm.BedSetupConfirm", "Dorm.ResourceReadinessConfirm"];
  if (JSON.stringify(steps) !== JSON.stringify(expectedSteps)) {
    failures.push(`first golden chain browser report steps must be exactly ${expectedSteps.join(" -> ")}.`);
  }
  if (!JSON.stringify(report).includes("第一金链内测完成")) {
    failures.push("first golden chain browser report must prove 第一金链内测完成 is visible.");
  }
  if (summary.businessGoAllowed !== false || node?.businessGoAllowed !== false) {
    failures.push("first golden chain browser evidence must keep businessGoAllowed=false.");
  }
}

function checkCapabilityDigestChain(graph, finalReport, releaseObject, docs) {
  const testPlanResult = docs.get(testPlanGeneratedFromCapabilityResultPath);
  const browserResult = docs.get(firstGoldenChainBrowserAuditResultPath);
  const digestChainResult = docs.get(evidenceDigestChainSingleSourceResultPath);
  if (testPlanResult?.status !== "PASS") {
    failures.push("test plan generated-from-capability result must be PASS.");
  }
  if (browserResult?.status !== "PASS") {
    failures.push("first golden chain browser audit result must be PASS.");
  }
  if (digestChainResult?.status !== "PASS") {
    failures.push("evidence digest chain single-source result must be PASS.");
  }
  const graphChain = graph.capabilityDigestChain;
  if (!graphChain) {
    failures.push("evidence graph missing capabilityDigestChain.");
    return;
  }
  for (const [label, chain] of [
    ["final report", finalReport.capabilityDigestChain],
    ["release evidence object", releaseObject?.capabilityDigestChain]
  ]) {
    if (!chain) {
      failures.push(`${label} missing capabilityDigestChain.`);
      continue;
    }
    for (const field of [
      "capabilityId",
      "acceptedGeneratedBundleDigest",
      "runtimeProjectionDigest",
      "surfaceProjectionDigest",
      "searchProjectionDigest",
      "testPlanDigest",
      "browserAuditDigest",
      "evidenceRootDigest",
      "productionConfirmAllowed",
      "releaseAuthority",
      "finalGoNoGo"
    ]) {
      if (chain[field] !== graphChain[field]) {
        failures.push(`${label} capabilityDigestChain.${field} must match evidence graph.`);
      }
    }
  }
  if (graphChain.capabilityId !== "Dormitory.FirstGoldenChain") {
    failures.push("capability digest chain must bind Dormitory.FirstGoldenChain.");
  }
  for (const field of [
    "acceptedGeneratedBundleDigest",
    "runtimeProjectionDigest",
    "surfaceProjectionDigest",
    "searchProjectionDigest",
    "testPlanDigest",
    "browserAuditDigest",
    "evidenceRootDigest"
  ]) {
    if (!sha256DigestPattern.test(String(graphChain[field] ?? ""))) {
      failures.push(`capability digest chain ${field} must be a sha256 digest.`);
    }
  }
  if (graphChain.runtimeConsumptionReady !== false && graphChain.runtimeConsumptionReady !== "test_only") {
    failures.push("capability digest chain runtimeConsumptionReady must be false or test_only.");
  }
  if (graphChain.productionConfirmAllowed !== false ||
    graphChain.releaseAuthority !== false ||
    graphChain.finalGoNoGo !== "NO_GO") {
    failures.push("capability digest chain must keep production/release/final GO closed.");
  }
}

function checkBrowserAuditLevel(label, report, summary, node) {
  if (!report || typeof report !== "object") {
    failures.push(`${label} report is missing or invalid.`);
    return;
  }
  if (report.auditLevel !== "L1" || summary.auditLevel !== "L1" || node.auditLevel !== "L1") {
    failures.push(`${label} must be marked auditLevel=L1 in report, summary, and graph node.`);
  }
  if (["L2", "L3"].includes(report.auditLevel)) {
    failures.push(`${label} must not enable L2/L3 in the current stage.`);
  }
  if (report.businessGoAllowed !== false || summary.businessGoAllowed !== false || node.businessGoAllowed !== false) {
    failures.push(`${label} must keep businessGoAllowed=false.`);
  }
  const forbidden = Array.isArray(report.forbiddenInterpretation)
    ? report.forbiddenInterpretation.join("\n")
    : String(report.forbiddenInterpretation || "");
  if (!/业务|productionConfirmAllowed|releaseAuthority|GO/.test(forbidden)) {
    failures.push(`${label} must forbid business GO / production / release interpretation.`);
  }
  if (!report.scenarioScope || report.scenarioScope.businessAcceptance !== false) {
    failures.push(`${label} scenarioScope must declare businessAcceptance=false.`);
  }
  for (const field of ["currentScenario", "completedScenarioCount", "totalScenarioCount", "lastHeartbeatAt", "screenshotCount", "currentStep"]) {
    if (report[field] === undefined || report[field] === null || report[field] === "") {
      failures.push(`${label} missing progress field ${field}.`);
    }
  }
  if (report.screenshotCount !== (report.screenshots ?? []).length) {
    failures.push(`${label} screenshotCount must match report screenshots length.`);
  }
  if (summary.progress?.screenshotCount !== report.screenshotCount || node.progress?.screenshotCount !== report.screenshotCount) {
    failures.push(`${label} progress screenshotCount must be carried into Evidence Graph summary and node.`);
  }
  const reportHashes = (report.screenshots ?? []).map((shot) => shot.sha256).filter(Boolean);
  const nodeHashes = new Set(node.screenshotHashes ?? []);
  for (const hash of reportHashes) {
    if (!nodeHashes.has(hash)) {
      failures.push(`${label} screenshot hash missing from Evidence Graph node: ${hash}.`);
      break;
    }
  }
}

function checkFinalReportGoNoGoFields(finalReport, responsibilityMap) {
  const requiredFields = responsibilityMap?.finalReportRequiredFields ?? [];
  if (!Array.isArray(requiredFields) || requiredFields.length === 0) {
    failures.push("responsibility map missing finalReportRequiredFields.");
    return;
  }
  for (const field of requiredFields) {
    if (!["GO", "NO_GO"].includes(finalReport[field])) {
      failures.push(`final report missing or invalid Go/No-Go field ${field}: ${finalReport[field] ?? "missing"}`);
    }
  }
  for (const [field, expected] of Object.entries(responsibilityMap?.forcedCurrentStage ?? {})) {
    if (finalReport[field] !== expected) {
      failures.push(`final report ${field} must be ${expected}, actual ${finalReport[field] ?? "missing"}`);
    }
  }
}

function checkWorkstreamProofNodes(graph, responsibilityMap, finalReport) {
  const workstreams = responsibilityMap?.workstreams ?? [];
  const proofNodes = (graph.nodes ?? []).filter((node) => node.type === "workstream_proof");
  const proofByWorkstream = new Map(proofNodes.map((node) => [node.workstreamId, node]));
  if (proofNodes.length !== workstreams.length) {
    failures.push(`evidence graph must contain one proof node per workstream: expected ${workstreams.length}, actual ${proofNodes.length}`);
  }
  for (const workstream of workstreams) {
    const proof = proofByWorkstream.get(workstream.id);
    if (!proof) {
      failures.push(`missing workstream proof node: ${workstream.id}`);
      continue;
    }
    for (const field of ["workstreamId", "proofType", "source", "hash", "dependsOn", "command", "checker", "inputHashes", "outputHashes", "status", "goNoGoImpact", "notesZh", "gateResult", "negativeTestResult", "goNoGo"]) {
      const value = proof[field];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        failures.push(`workstream proof node ${workstream.id} missing ${field}.`);
      }
    }
    if (!String(proof.hash ?? "").startsWith("sha256:")) {
      failures.push(`workstream proof node ${workstream.id} hash must be sha256.`);
    }
    if (proof.goNoGo !== finalReport.finalGoNoGo) {
      failures.push(`workstream proof node ${workstream.id} goNoGo must match final report.`);
    }
    if (!/[\u3400-\u9fff]/.test(String(proof.notesZh ?? ""))) {
      failures.push(`workstream proof node ${workstream.id} must include Chinese notesZh.`);
    }
    if (!Array.isArray(proof.inputHashes) || proof.inputHashes.some((item) => !item.path || !String(item.hash ?? "").startsWith("sha256:"))) {
      failures.push(`workstream proof node ${workstream.id} inputHashes must bind path and sha256 hash.`);
    }
    if (!Array.isArray(proof.outputHashes) || proof.outputHashes.some((item) => !item.path || !String(item.hash ?? "").startsWith("sha256:"))) {
      failures.push(`workstream proof node ${workstream.id} outputHashes must bind path and sha256 hash.`);
    }
    for (const field of workstream.finalReportFields ?? []) {
      if (finalReport[field] !== proof.goNoGo) {
        failures.push(`final report field ${field} does not match proof node ${workstream.id}.`);
      }
    }
  }
  for (const proof of (graph.nodes ?? []).filter((node) => node.type === "p0_closure_proof")) {
    for (const field of ["proofType", "source", "hash", "dependsOn", "command", "checker", "inputHashes", "outputHashes", "status", "goNoGoImpact", "notesZh", "goNoGo"]) {
      const value = proof[field];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        failures.push(`p0 closure proof node ${proof.id ?? "<missing>"} missing ${field}.`);
      }
    }
    if (!/[\u3400-\u9fff]/.test(String(proof.notesZh ?? ""))) {
      failures.push(`p0 closure proof node ${proof.id ?? "<missing>"} must include Chinese notesZh.`);
    }
  }
}

function checkFinalDecision(finalReport) {
  const reasons = finalReport.finalDecision?.noGoReasons ?? finalReport.noGoReasons ?? [];
  const controlPlane = finalReport.controlPlaneGateResult;
  const release = finalReport.releaseReadiness;
  const reasonsText = reasons.join("\n");
  const requireNoGoReason = (predicate, pattern, description) => {
    if (predicate && !pattern.test(reasonsText)) {
      failures.push(`final report missing NO_GO reason for ${description}.`);
    }
  };

  if (!controlPlane) {
    failures.push("final report missing control plane gate result.");
  }
  if (!release) {
    failures.push("final report missing release readiness.");
  }

  if (finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("final report current stage must not claim business/release GO.");
  }

  if (finalReport.finalGoNoGo === "NO_GO" && reasons.length === 0) {
    failures.push("final report is NO_GO but has no noGoReasons.");
  }
  if (finalReport.finalGoNoGo === "NO_GO") {
    requireNoGoReason(
      controlPlane && controlPlane.status !== "passed",
      /Control Plane|OAM 总门禁/i,
      "control plane not passed"
    );
    requireNoGoReason(
      controlPlane && (controlPlane.failedGateCount ?? 0) > 0,
      /Control Plane.*失败|OAM 总门禁.*失败/i,
      "control plane failed gates"
    );
    requireNoGoReason(
      controlPlane && (controlPlane.missingRequiredGates ?? []).length > 0,
      /Control Plane.*缺失|OAM 总门禁.*缺失/i,
      "control plane missing required gates"
    );
    requireNoGoReason(
      controlPlane?.stale === true,
      /Control Plane.*过期|OAM 总门禁.*过期/i,
      "stale control plane gate result"
    );
    requireNoGoReason(
      finalReport.binding?.bindingStatus === "stale" || finalReport.binding?.stale === true,
      /Release Evidence Object 未绑定当前 HEAD|证据绑定过期|stale/i,
      "stale release evidence binding"
    );
    requireNoGoReason(
      finalReport.binding?.githubArtifactDigestStatus === pendingExternalAttestation,
      /pending_external_attestation|外部摘要证明/i,
      "pending GitHub artifact attestation"
    );
    requireNoGoReason(
      finalReport.binding?.releaseAuthority === false,
      /releaseAuthority=false|发布权威/i,
      "releaseAuthority=false"
    );
    requireNoGoReason(
      release?.releaseEligible === false,
      /工作区|未提交/i,
      "dirty workspace release readiness"
    );
    requireNoGoReason(
      finalReport.businessProduction === "BLOCKED" || finalReport.businessProductionStatus === "BLOCKED",
      /Business Production.*BLOCKED|业务落地不允许/i,
      "Business Production BLOCKED"
    );
    requireNoGoReason(
      finalReport.dormitoryL2 === "BLOCKED" || finalReport.dormitoryL2Status === "BLOCKED",
      /Dormitory L2.*BLOCKED|宿舍业务 L2 不允许/i,
      "Dormitory L2 BLOCKED"
    );
    requireNoGoReason(
      finalReport.productionConfirmAllowed === false,
      /productionConfirmAllowed=false|production_confirm.*阻断|生产确认不允许/i,
      "productionConfirmAllowed=false"
    );
  }
}

function checkControlPlaneStateMachine(controlPlane, finalReport, graph) {
  if (!controlPlane || typeof controlPlane !== "object") {
    failures.push("control plane gate result is missing.");
    return;
  }
  if (controlPlane.version !== "oam.control-plane-gate-results.v1") {
    failures.push("control plane gate result version must be oam.control-plane-gate-results.v1.");
  }
  if (!["not_started", "running", "completed", "failed"].includes(controlPlane.runStatus)) {
    failures.push(`control plane runStatus invalid or missing: ${controlPlane.runStatus ?? "missing"}.`);
  }
  const expected = Number(controlPlane.expectedGateCount);
  const completed = Number(controlPlane.completedGateCount);
  const failed = Number(controlPlane.failedGateCount);
  if (!Number.isInteger(expected) || expected <= 0) {
    failures.push("control plane expectedGateCount must be a positive integer.");
  }
  if (!Number.isInteger(completed) || completed < 0) {
    failures.push("control plane completedGateCount must be a non-negative integer.");
  }
  if (!Number.isInteger(failed) || failed < 0) {
    failures.push("control plane failedGateCount must be a non-negative integer.");
  }
  if (controlPlane.requiredGateCount !== controlPlane.expectedGateCount) {
    failures.push("control plane requiredGateCount must equal expectedGateCount.");
  }
  if (!Array.isArray(controlPlane.gates) || controlPlane.gates.length !== completed) {
    failures.push("control plane gates length must equal completedGateCount.");
  }
  if (controlPlane.runStatus !== "completed") {
    failures.push(`control plane runStatus must be completed for Evidence Root PASS, actual: ${controlPlane.runStatus ?? "missing"}.`);
  }
  if (controlPlane.finalizable !== true) {
    failures.push("control plane finalizable must be true for Evidence Root PASS.");
  }
  if (completed !== expected) {
    failures.push(`control plane completedGateCount must equal expectedGateCount: completed=${completed}, expected=${expected}.`);
  }
  if (failed > 0) {
    failures.push(`control plane failedGateCount must be 0, actual: ${failed}.`);
  }
  if (!controlPlane.startedAtUtc || !controlPlane.finishedAtUtc) {
    failures.push("control plane completed result must include startedAtUtc and finishedAtUtc.");
  }
  if (controlPlane.currentStage !== "completed") {
    failures.push(`control plane currentStage must be completed after finalization, actual: ${controlPlane.currentStage ?? "missing"}.`);
  }
  if (controlPlane.runStatus === "running" && controlPlane.finalizable !== false) {
    failures.push("control plane running state must have finalizable=false.");
  }
  if (!Array.isArray(controlPlane.blockingReasons)) {
    failures.push("control plane blockingReasons must be an array.");
  }
  if (finalReport.controlPlaneGateResult?.runStatus !== controlPlane.runStatus) {
    failures.push("final report controlPlaneGateResult.runStatus must match raw control plane result.");
  }
  if (finalReport.controlPlaneGateResult?.finalizable !== controlPlane.finalizable) {
    failures.push("final report controlPlaneGateResult.finalizable must match raw control plane result.");
  }
  if (finalReport.controlPlaneGateResult?.completedGateCount !== controlPlane.completedGateCount) {
    failures.push("final report controlPlaneGateResult.completedGateCount must match raw control plane result.");
  }
  if (finalReport.gateSummary?.runStatus !== controlPlane.runStatus) {
    failures.push("final report gateSummary.runStatus must match raw control plane result.");
  }
  if (graph.controlPlaneGateResult?.runStatus !== controlPlane.runStatus) {
    failures.push("evidence graph controlPlaneGateResult.runStatus must match raw control plane result.");
  }
  if (graph.controlPlaneGateResult?.finalizable !== controlPlane.finalizable) {
    failures.push("evidence graph controlPlaneGateResult.finalizable must match raw control plane result.");
  }
}

function checkFinalReportMultiStatus(finalReport, candidateObject, commitAttestation, releaseObject) {
  const matrix = finalReport.statusMatrix;
  const requiredStatuses = [
    "authorityStatus",
    "fileLifecycleStatus",
    "compileStatus",
    "sourceCompileDecisionReadinessStatus",
    "generatedCompileAuthorizationStatus",
    "generatedCompilationStatus",
    "dormitoryFirstGoldenChainLandingStatus",
    "runtimeAdmissionStatus",
    "runtimeConsumptionStatus",
    "runtimeBoundaryStatus",
    "readSurfaceFinanceStatus",
    "sourcePackageStatus",
    "mutationStatus",
    "browserL1Status",
    "candidateEvidenceStatus",
    "commitAttestationStatus",
    "businessReadinessStatus",
    "releaseReadinessStatus",
    "finalGoNoGo"
  ];
  if (finalReport.multiStatusVersion !== "oam.final-report.multi-status.v1") {
    failures.push("final report missing multiStatusVersion=oam.final-report.multi-status.v1.");
  }
  if (!matrix || typeof matrix !== "object") {
    failures.push("final report missing statusMatrix.");
    return;
  }
  if (matrix.version !== "oam.final-report.multi-status.v1") {
    failures.push("final report statusMatrix version must be oam.final-report.multi-status.v1.");
  }

  for (const field of requiredStatuses) {
    const entry = matrix[field];
    validateFinalReportStatusEntry(`statusMatrix.${field}`, entry);
    if (field !== "finalGoNoGo") {
      const finalReportEntry = field === "runtimeAdmissionStatus"
        ? finalReport.runtimeAdmissionStatusEntry
        : field === "dormitoryFirstGoldenChainLandingStatus"
          ? finalReport.dormitoryFirstGoldenChainLandingStatusEntry
          : finalReport[field];
      const entryLabel = field === "runtimeAdmissionStatus"
        ? "runtimeAdmissionStatusEntry"
        : field === "dormitoryFirstGoldenChainLandingStatus"
          ? "dormitoryFirstGoldenChainLandingStatusEntry"
          : field;
      validateFinalReportStatusEntry(entryLabel, finalReportEntry);
      if (JSON.stringify(finalReportEntry) !== JSON.stringify(entry)) {
        failures.push(`final report ${entryLabel} must mirror statusMatrix.${field}.`);
      }
    }
  }

  validateFinalReportStatusEntry("finalGoNoGoStatus", finalReport.finalGoNoGoStatus);
  if (JSON.stringify(finalReport.finalGoNoGoStatus) !== JSON.stringify(matrix.finalGoNoGo)) {
    failures.push("final report finalGoNoGoStatus must mirror statusMatrix.finalGoNoGo.");
  }
  if (finalReport.finalGoNoGo !== "NO_GO" || matrix.finalGoNoGo?.status !== "NO_GO") {
    failures.push("final report multi-status finalGoNoGo must remain NO_GO.");
  }
  if (matrix.authorityStatus?.status !== "PASS") {
    failures.push("authorityStatus must be PASS for the closed architecture layer.");
  }
  if (matrix.fileLifecycleStatus?.status !== "PASS") {
    failures.push("fileLifecycleStatus must be PASS after File Lifecycle Registry closure.");
  }
  if (matrix.compileStatus?.status !== "PASS") {
    failures.push("compileStatus must be PASS for generated metadata, authorization-gate, graph, and doNotEdit checks.");
  }
  if (matrix.sourceCompileDecisionReadinessStatus?.status !== "PASS") {
    failures.push("sourceCompileDecisionReadinessStatus must be PASS after 00 Source finalization.");
  }
  const expectedGeneratedCompileAuthorizationStatus = finalReport.formalGeneratedCompileAuthorized === true ? "PASS" : "NO_GO";
  if (matrix.generatedCompileAuthorizationStatus?.status !== expectedGeneratedCompileAuthorizationStatus) {
    failures.push(`generatedCompileAuthorizationStatus must be ${expectedGeneratedCompileAuthorizationStatus} for the current formal approval state.`);
  }
  const expectedGeneratedCompilationStatus = finalReport.generatedCompileExecution?.generatedCompileCompleted === true &&
    finalReport.generatedCompileExecution?.generatedCompilationCompleted === true
    ? "PASS"
    : "NO_GO";
  if (matrix.generatedCompilationStatus?.status !== expectedGeneratedCompilationStatus) {
    failures.push(`generatedCompilationStatus must be ${expectedGeneratedCompilationStatus} for the current formal compile execution state.`);
  }
  if (matrix.runtimeAdmissionStatus?.status !== "PASS") {
    failures.push("runtimeAdmissionStatus must be PASS after runtime_test_admission approval.");
  }
  if (matrix.dormitoryFirstGoldenChainLandingStatus?.status !== "PASS") {
    failures.push("dormitoryFirstGoldenChainLandingStatus must be PASS after business_landing_admission approval.");
  }
  if (matrix.runtimeConsumptionStatus?.status !== "PASS") {
    failures.push("runtimeConsumptionStatus must be PASS after runtime_test_admission approval.");
  }
  if (matrix.runtimeBoundaryStatus?.status !== "PASS") {
    failures.push("runtimeBoundaryStatus must be PASS for runtime boundary closure.");
  }
  if (matrix.readSurfaceFinanceStatus?.status !== "PASS") {
    failures.push("readSurfaceFinanceStatus must be PASS for read/surface/finance readonly closure.");
  }
  if (matrix.candidateEvidenceStatus?.status !== candidateObject?.candidateStatus) {
    failures.push("candidateEvidenceStatus must match Candidate Evidence candidateStatus.");
  }
  if (commitAttestation?.bindingStatus === "current" && matrix.commitAttestationStatus?.status !== "PASS") {
    failures.push("commitAttestationStatus must be PASS when Commit Attestation is current.");
  }
  if (finalReport.businessProductionStatus === "BLOCKED" && matrix.businessReadinessStatus?.status !== "NO_GO") {
    failures.push("businessProductionStatus=BLOCKED requires businessReadinessStatus=NO_GO.");
  }
  if (releaseObject?.releaseAuthority === false && matrix.releaseReadinessStatus?.status !== "NO_GO") {
    failures.push("releaseAuthority=false requires releaseReadinessStatus=NO_GO.");
  }
  if (finalReport.binding?.githubArtifactDigestStatus === pendingExternalAttestation && matrix.releaseReadinessStatus?.status !== "NO_GO") {
    failures.push("pending external attestation requires releaseReadinessStatus=NO_GO.");
  }
  if ((matrix.candidateEvidenceStatus?.proofRefs ?? []).includes(releaseEvidenceObjectPath)) {
    failures.push("candidateEvidenceStatus must not use Release Evidence Object as its proofRef.");
  }
  if ((matrix.releaseReadinessStatus?.proofRefs ?? []).includes(candidateEvidenceObjectPath)) {
    failures.push("releaseReadinessStatus must not use Candidate Evidence Object as its proofRef.");
  }
  const releaseReasons = (matrix.releaseReadinessStatus?.blockingReasons ?? []).join("\n");
  const finalReasons = (matrix.finalGoNoGo?.blockingReasons ?? []).join("\n");
  if (!/CI green.*artifact exists.*browser evidence.*Final Report exists.*不等于 GO/.test(`${releaseReasons}\n${finalReasons}`)) {
    failures.push("final report multi-status must state CI green, artifact exists, browser evidence, and Final Report exists do not equal GO.");
  }
}

function validateFinalReportStatusEntry(label, entry) {
  if (!entry || typeof entry !== "object") {
    failures.push(`final report ${label} missing status entry.`);
    return;
  }
  if (!["PASS", "NO_GO"].includes(entry.status)) {
    failures.push(`final report ${label}.status must be PASS or NO_GO, actual: ${entry.status ?? "missing"}.`);
  }
  if (!Array.isArray(entry.inputs) || entry.inputs.length === 0) {
    failures.push(`final report ${label}.inputs must be a non-empty array.`);
  }
  if (!Array.isArray(entry.proofRefs) || entry.proofRefs.length === 0) {
    failures.push(`final report ${label}.proofRefs must be a non-empty array.`);
  }
  if (!Array.isArray(entry.blockingReasons)) {
    failures.push(`final report ${label}.blockingReasons must be an array.`);
  }
  if (entry.status === "NO_GO" && (!Array.isArray(entry.blockingReasons) || entry.blockingReasons.length === 0)) {
    failures.push(`final report ${label}.blockingReasons must explain NO_GO.`);
  }
  if (!/[\u3400-\u9fff]/.test(String(entry.nextAction ?? ""))) {
    failures.push(`final report ${label}.nextAction must be Chinese.`);
  }
}

function checkMutationTests(finalReport, graph, mutationTestsResult) {
  const mutationResultPath = "artifacts/oam/authority-cleanup/mutation-tests-result.json";
  if (!mutationTestsResult) {
    failures.push("mutation tests result artifact is missing.");
    return;
  }
  if (mutationTestsResult.status !== "passed") {
    failures.push(`mutation tests result must be passed, actual: ${mutationTestsResult.status || "missing"}.`);
  }
  if ((mutationTestsResult.failedMutationCount ?? 0) !== 0) {
    failures.push(`mutation tests must have zero failed mutations, actual: ${mutationTestsResult.failedMutationCount}.`);
  }
  if ((mutationTestsResult.mutationCount ?? 0) < 8) {
    failures.push(`mutation tests must cover required negative cases, actual mutationCount=${mutationTestsResult.mutationCount ?? "missing"}.`);
  }
  if (finalReport.mutationTests?.path !== mutationResultPath) {
    failures.push("final report must explicitly reference mutation tests result artifact.");
  }
  if (finalReport.mutationTests?.status !== mutationTestsResult.status) {
    failures.push("final report mutationTests.status must match mutation tests result.");
  }
  if (finalReport.mutationTests?.mutationCount !== mutationTestsResult.mutationCount) {
    failures.push("final report mutationTests.mutationCount must match mutation tests result.");
  }
  if (finalReport.mutationTests?.failedMutationCount !== mutationTestsResult.failedMutationCount) {
    failures.push("final report mutationTests.failedMutationCount must match mutation tests result.");
  }
  if (!graph.requiredFiles?.includes(mutationResultPath)) {
    failures.push("evidence graph must include mutation tests result in requiredFiles.");
  }
  if (!JSON.stringify(graph).includes(mutationResultPath)) {
    failures.push("evidence graph must reference mutation tests result artifact.");
  }
}

function checkExecutionLog(entries, expectedDigest) {
  if (!Array.isArray(entries) || entries.length === 0) {
    failures.push("execution log must contain JSONL entries.");
    return;
  }
  for (const requiredEvent of ["冻结检查", "P0 账本状态", "本地总门禁绑定", "测试验收绑定", "覆盖率绑定", "移动覆盖率治理", "最终裁决"]) {
    if (!entries.some((entry) => entry.event === requiredEvent)) {
      failures.push(`execution log missing event: ${requiredEvent}`);
    }
  }
  for (const entry of entries) {
    if (entry.artifactDigest !== expectedDigest) {
      failures.push(`execution log event ${entry.event || "unknown"} digest does not match evidence graph.`);
    }
    for (const key of ["commitSha", "sourceCommitSha", "evidenceRunSha", "branch", "ciRunId", "generatedAt"]) {
      if (!entry[key]) {
        failures.push(`execution log event ${entry.event || "unknown"} missing ${key}.`);
      }
    }
    if (entry.sourceCommitSha !== entry.commitSha || entry.evidenceRunSha !== entry.commitSha) {
      failures.push(`execution log event ${entry.event || "unknown"} source/evidence SHA must match commitSha for the current evidence run.`);
    }
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function readJsonl(file) {
  try {
    return readText(file)
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          failures.push(`${file}:${index + 1} is not valid JSONL: ${error.message}`);
          return {};
        }
      });
  } catch (error) {
    failures.push(`${file} cannot be read: ${error.message}`);
    return [];
  }
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function env(name) {
  return process.env[name] || "";
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function gitSucceeds(command) {
  try {
    execSync(`git ${command}`, { cwd: root, encoding: "utf8", stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function artifactNameForRun(runId) {
  const normalized = String(runId || "").trim();
  if (!normalized || normalized.includes("${{")) {
    failures.push("GITHUB_RUN_ID must resolve before current OAM evidence artifactName is checked.");
    return "workosnext-current-oam-evidence-invalid";
  }
  return `workosnext-current-oam-evidence-${normalized}`;
}

function isGitSha(value) {
  return /^[a-f0-9]{40}$/i.test(String(value ?? ""));
}

function isEmptyProofField(value) {
  return value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
}

function isNonEmptySource(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every((item) => String(item ?? "").trim().length > 0);
  return String(value ?? "").trim().length > 0;
}

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
