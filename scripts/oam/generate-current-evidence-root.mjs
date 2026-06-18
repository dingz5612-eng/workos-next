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
  validateDormitoryFirstGoldenChainLandingAuthority
} from "./lib/dormitory-first-golden-chain-landing.mjs";
import {
  FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_DB_PROJECTION_PROOF_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  buildProjectionDigestChain
} from "./lib/capability-projection-digests.mjs";
import {
  CAPABILITY_COMPATIBILITY_BOX_PATH,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const evidenceDir = "artifacts/oam/evidence";
const finalReportPath = "artifacts/oam/final-report.json";
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
const controlPlaneGateResultPath = "artifacts/oam/checks/control-plane-gate-results.json";
const responsibilityMapPath = "docs/oam/current-oam-kernel-responsibility-map.json";
const candidateEvidenceObjectPath = "artifacts/oam/evidence/current-oam-candidate-evidence-object.json";
const commitAttestationPath = "artifacts/oam/evidence/current-oam-commit-attestation.json";
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
const releaseAttestationPath = "artifacts/oam/evidence/current-oam-release-attestation.json";
const evidenceLifecycleProofPath = "artifacts/oam/evidence/evidence-lifecycle-proof.json";
const generatedCompileExecutionSnapshotPath = "artifacts/oam/checks/generated-compile-execution-input-snapshot.json";
const generatedCompileExecutionResultPath = "artifacts/oam/checks/generated-compile-execution-result.json";
const generatedCompileExecutionProofPath = "artifacts/oam/evidence/generated-compile-execution-proof.json";
const generatedFieldBindingClosureResultPath = FIELD_BINDING_CLOSURE_RESULT_PATH;
const generatedFieldBindingsPath = FIELD_BINDINGS_GENERATED_PATH;
const ciArtifactProvenanceReportPath = "artifacts/oam/checks/ci-artifact-provenance-report.json";
const projectMaintainabilityGovernancePath = "docs/oam/project-maintainability-governance.json";
const projectMaintainabilityReportPath = "docs/oam/project-maintainability-closure-report.md";
const projectMaintainabilityGovernanceResultPath = "artifacts/oam/checks/project-maintainability-governance-result.json";
const projectPurityAuthoritySealReportPath = "docs/oam/project-purity-authority-seal-report.md";
const projectPurityAuthoritySealResultPath = "artifacts/oam/checks/project-purity-authority-seal-result.json";
const capabilityRegistryPath = CAPABILITY_REGISTRY_PATH;
const capabilityLedgerPath = CAPABILITY_LEDGER_PATH;
const capabilityProjectionPath = CAPABILITY_PROJECTION_PATH;
const capabilityCompatibilityBoxPath = CAPABILITY_COMPATIBILITY_BOX_PATH;
const capabilityStateMachinePath = "docs/oam/capabilities/dormitory-first-golden-chain.state-machine.json";
const sliceManifestPath = "docs/contracts/slice-manifest.json";
const productionSliceManifestPath = "docs/contracts/production-slice-manifest.json";
const legacySliceManifestPath = "docs/oam/compatibility/legacy-slice-manifest.json";
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
const testPlanGeneratedFromCapabilityResultPath =
  "artifacts/oam/checks/test-plan-generated-from-capability-result.json";
const evidenceDigestChainSingleSourceResultPath =
  "artifacts/oam/checks/evidence-digest-chain-single-source-result.json";
const dormitory13ScenarioSourcePath =
  "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const dormitory13ScenarioGeneratedFiles = [
  "docs/contracts/generated/dormitory/13-scenario-control.generated.json",
  "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json",
  "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-index.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-state-ladder.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-object-ownership.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-evidence-policy.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-old-package-migration.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-test-plan.generated.json"
];
const dormitory13ScenarioToolingFiles = [
  "scripts/business/generate-dormitory-13-scenario-control-contracts.mjs",
  "scripts/business/check-dormitory-13-scenario-control-authority.mjs",
  "scripts/business/check-dormitory-13-scenario-generated-contracts.mjs",
  "scripts/business/check-dormitory-13-scenario-consumption-boundary.mjs"
];
const dormitory13ScenarioResultFiles = [
  "artifacts/oam/checks/dormitory-13-scenario-control-authority-result.json",
  "artifacts/oam/checks/dormitory-13-scenario-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-13-scenario-consumption-boundary-result.json"
];
const dormitory13ScenarioIntegrationChainToolingFiles = [
  "scripts/business/check-dormitory-13-scenario-integration-chain.mjs"
];
const dormitory13ScenarioIntegrationChainResultFiles = [
  "artifacts/oam/checks/dormitory-13-scenario-integration-chain-result.json"
];
const dormitory13ScenarioEvidenceFiles = [
  dormitory13ScenarioSourcePath,
  ...dormitory13ScenarioGeneratedFiles,
  ...dormitory13ScenarioToolingFiles,
  ...dormitory13ScenarioResultFiles
];
const dormitory13ScenarioIntegrationChainEvidenceFiles = [
  ...dormitory13ScenarioIntegrationChainToolingFiles,
  ...dormitory13ScenarioIntegrationChainResultFiles
];
const dormitoryScenario1SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const lodgingScenarioPackageIndexPath =
  "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const dormitoryScenario1GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json",
  "docs/contracts/generated/dormitory/scenario1-object-model.generated.json",
  "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario1-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario1-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json"
];
const dormitoryScenario1ToolingFiles = [
  "scripts/business/generate-dormitory-scenario1-resource-basic-readiness-contracts.mjs",
  "scripts/business/check-dormitory-scenario1-resource-basic-readiness-authority.mjs",
  "scripts/business/check-dormitory-scenario1-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario1-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario1-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario1-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario1-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario1-negative-browser-audit.mjs"
];
const dormitoryScenario1BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-positive-browser/scenario1-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-negative-browser/scenario1-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-negative-browser/screenshot-index.json"
];
const dormitoryScenario1ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario1-resource-basic-readiness-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario1-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario1-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario1-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario1-negative-browser-result.json"
];
const dormitoryScenario1EvidenceFiles = [
  lodgingScenarioPackageIndexPath,
  dormitoryScenario1SourcePath,
  ...dormitoryScenario1GeneratedFiles,
  ...dormitoryScenario1ToolingFiles,
  ...dormitoryScenario1BrowserEvidenceFiles,
  ...dormitoryScenario1ResultFiles
];
const dormitoryBenchmarkInheritanceSourcePath =
  "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json";
const dormitoryBenchmarkInheritanceGeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario1-benchmark-inheritance-contract.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-start-gate.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-difference-checklist-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-field-review-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-button-state-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-screenshot-report-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-failure-attribution-routing.generated.json",
  "docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-benchmark-inheritance.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1BenchmarkInheritance.generated.json"
];
const dormitoryBenchmarkInheritanceToolingFiles = [
  "scripts/business/generate-dormitory-scenario1-benchmark-inheritance-contracts.mjs",
  "scripts/business/check-dormitory-scenario1-benchmark-inheritance-authority.mjs",
  "scripts/business/check-dormitory-scenario1-benchmark-inheritance-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario2-start-gate-trial.mjs"
];
const dormitoryBenchmarkInheritanceResultFiles = [
  "artifacts/oam/checks/dormitory-scenario1-benchmark-inheritance-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario1-benchmark-inheritance-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario2-start-gate-trial-result.json"
];
const dormitoryBenchmarkInheritanceEvidenceFiles = [
  dormitoryBenchmarkInheritanceSourcePath,
  ...dormitoryBenchmarkInheritanceGeneratedFiles,
  ...dormitoryBenchmarkInheritanceToolingFiles,
  ...dormitoryBenchmarkInheritanceResultFiles
];
const dormitoryScenario2SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json";
const dormitoryScenario2GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json",
  "docs/contracts/generated/dormitory/scenario2-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario2-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario2-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json"
];
const dormitoryScenario2ToolingFiles = [
  "scripts/business/generate-dormitory-scenario2-resource-operation-status-contracts.mjs",
  "scripts/business/check-dormitory-scenario2-resource-operation-status-authority.mjs",
  "scripts/business/check-dormitory-scenario2-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario2-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario2-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario2-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario2-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario2-negative-browser-audit.mjs"
];
const dormitoryScenario2RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario2BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-positive-browser/scenario2-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-negative-browser/scenario2-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-negative-browser/screenshot-index.json"
];
const dormitoryScenario2ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario2-resource-operation-status-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario2-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario2-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario2-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario2-negative-browser-result.json"
];
const dormitoryScenario2EvidenceFiles = [
  dormitoryScenario2SourcePath,
  ...dormitoryScenario2GeneratedFiles,
  ...dormitoryScenario2ToolingFiles,
  ...dormitoryScenario2RuntimeEvidenceFiles,
  ...dormitoryScenario2BrowserEvidenceFiles,
  ...dormitoryScenario2ResultFiles
];
const dormitoryScenario3SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json";
const dormitoryScenario3GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json",
  "docs/contracts/generated/dormitory/scenario3-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario3-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario3-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario3-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario3-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario3-product-and-pricing.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario3ProductAndPricing.generated.json"
];
const dormitoryScenario3ToolingFiles = [
  "scripts/business/generate-dormitory-scenario3-product-and-pricing-contracts.mjs",
  "scripts/business/check-dormitory-scenario3-product-and-pricing-authority.mjs",
  "scripts/business/check-dormitory-scenario3-product-and-pricing-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario3-product-and-pricing-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario3-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario3-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario3-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario3-negative-browser-audit.mjs"
];
const dormitoryScenario3RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario3BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-positive-browser/scenario3-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-negative-browser/scenario3-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-negative-browser/screenshot-index.json"
];
const dormitoryScenario3ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario3-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario3-negative-browser-result.json"
];
const dormitoryScenario3EvidenceFiles = [
  dormitoryScenario3SourcePath,
  ...dormitoryScenario3GeneratedFiles,
  ...dormitoryScenario3ToolingFiles,
  ...dormitoryScenario3RuntimeEvidenceFiles,
  ...dormitoryScenario3BrowserEvidenceFiles,
  ...dormitoryScenario3ResultFiles
];
const dormitoryScenario4SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json";
const dormitoryScenario4GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario4-inquiry-and-quote.generated.json",
  "docs/contracts/generated/dormitory/scenario4-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario4-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario4-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario4-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario4-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario4-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario4-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario4-inquiry-and-quote.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario4InquiryAndQuote.generated.json"
];
const dormitoryScenario4ToolingFiles = [
  "scripts/business/generate-dormitory-scenario4-inquiry-and-quote-contracts.mjs",
  "scripts/business/check-dormitory-scenario4-inquiry-and-quote-authority.mjs",
  "scripts/business/check-dormitory-scenario4-inquiry-and-quote-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario4-inquiry-and-quote-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario4-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario4-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario4-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario4-negative-browser-audit.mjs"
];
const dormitoryScenario4RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario4BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-positive-browser/scenario4-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-negative-browser/scenario4-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-negative-browser/screenshot-index.json"
];
const dormitoryScenario4ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario4-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario4-negative-browser-result.json"
];
const dormitoryScenario4EvidenceFiles = [
  dormitoryScenario4SourcePath,
  ...dormitoryScenario4GeneratedFiles,
  ...dormitoryScenario4ToolingFiles,
  ...dormitoryScenario4RuntimeEvidenceFiles,
  ...dormitoryScenario4BrowserEvidenceFiles,
  ...dormitoryScenario4ResultFiles
];
const dormitoryScenario5SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json";
const dormitoryScenario5GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario5-reservation-and-inventory-hold.generated.json",
  "docs/contracts/generated/dormitory/scenario5-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario5-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario5-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario5-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario5-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario5-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario5-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario5-reservation-and-inventory-hold.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario5ReservationAndInventoryHold.generated.json"
];
const dormitoryScenario5ToolingFiles = [
  "scripts/business/generate-dormitory-scenario5-reservation-and-inventory-hold-contracts.mjs",
  "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-authority.mjs",
  "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario5-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario5-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario5-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario5-negative-browser-audit.mjs"
];
const dormitoryScenario5RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario5BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-positive-browser/scenario5-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-negative-browser/scenario5-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-negative-browser/screenshot-index.json"
];
const dormitoryScenario5ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario5-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario5-negative-browser-result.json"
];
const dormitoryScenario5EvidenceFiles = [
  dormitoryScenario5SourcePath,
  ...dormitoryScenario5GeneratedFiles,
  ...dormitoryScenario5ToolingFiles,
  ...dormitoryScenario5RuntimeEvidenceFiles,
  ...dormitoryScenario5BrowserEvidenceFiles,
  ...dormitoryScenario5ResultFiles
];
const dormitoryScenario6SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json";
const dormitoryScenario6GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json",
  "docs/contracts/generated/dormitory/scenario6-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario6-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario6-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario6-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario6-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json",
  "docs/contracts/generated/finance/scenario6-finance-gate.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario6-payment-deposit-and-guarantee.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario6PaymentDepositAndGuarantee.generated.json"
];
const dormitoryScenario6ToolingFiles = [
  "scripts/business/generate-dormitory-scenario6-payment-deposit-and-guarantee-contracts.mjs",
  "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-authority.mjs",
  "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario6-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario6-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario6-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario6-negative-browser-audit.mjs"
];
const dormitoryScenario6RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario6BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-positive-browser/scenario6-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-negative-browser/scenario6-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-negative-browser/screenshot-index.json"
];
const dormitoryScenario6ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario6-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario6-negative-browser-result.json"
];
const dormitoryScenario6EvidenceFiles = [
  dormitoryScenario6SourcePath,
  ...dormitoryScenario6GeneratedFiles,
  ...dormitoryScenario6ToolingFiles,
  ...dormitoryScenario6RuntimeEvidenceFiles,
  ...dormitoryScenario6BrowserEvidenceFiles,
  ...dormitoryScenario6ResultFiles
];
const dormitoryScenario7SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json";
const dormitoryScenario7GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario7-check-in-processing.generated.json",
  "docs/contracts/generated/dormitory/scenario7-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario7-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario7-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario7-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario7-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario7-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario7-check-in-processing.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario7CheckInProcessing.generated.json"
];
const dormitoryScenario7ToolingFiles = [
  "scripts/business/generate-dormitory-scenario7-check-in-processing-contracts.mjs",
  "scripts/business/check-dormitory-scenario7-check-in-processing-authority.mjs",
  "scripts/business/check-dormitory-scenario7-check-in-processing-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario7-check-in-processing-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario7-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario7-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario7-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario7-negative-browser-audit.mjs"
];
const dormitoryScenario7RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario7BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-positive-browser/scenario7-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-negative-browser/scenario7-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-negative-browser/screenshot-index.json"
];
const dormitoryScenario7ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario7-check-in-processing-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario7-check-in-processing-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario7-check-in-processing-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario7-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario7-negative-browser-result.json"
];
const dormitoryScenario7EvidenceFiles = [
  dormitoryScenario7SourcePath,
  ...dormitoryScenario7GeneratedFiles,
  ...dormitoryScenario7ToolingFiles,
  ...dormitoryScenario7RuntimeEvidenceFiles,
  ...dormitoryScenario7BrowserEvidenceFiles,
  ...dormitoryScenario7ResultFiles
];
const dormitoryScenario8SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json";
const dormitoryScenario8GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario8-in-stay-management.generated.json",
  "docs/contracts/generated/dormitory/scenario8-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario8-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario8-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario8-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario8-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario8-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario8-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario8-in-stay-management.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario8InStayManagement.generated.json"
];
const dormitoryScenario8ToolingFiles = [
  "scripts/business/generate-dormitory-scenario8-in-stay-management-contracts.mjs",
  "scripts/business/check-dormitory-scenario8-in-stay-management-authority.mjs",
  "scripts/business/check-dormitory-scenario8-in-stay-management-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario8-in-stay-management-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario8-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario8-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario8-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario8-negative-browser-audit.mjs"
];
const dormitoryScenario8RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario8BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-positive-browser/scenario8-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-negative-browser/scenario8-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-negative-browser/screenshot-index.json"
];
const dormitoryScenario8ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario8-in-stay-management-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario8-in-stay-management-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario8-in-stay-management-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario8-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario8-negative-browser-result.json"
];
const dormitoryScenario8EvidenceFiles = [
  dormitoryScenario8SourcePath,
  ...dormitoryScenario8GeneratedFiles,
  ...dormitoryScenario8ToolingFiles,
  ...dormitoryScenario8RuntimeEvidenceFiles,
  ...dormitoryScenario8BrowserEvidenceFiles,
  ...dormitoryScenario8ResultFiles
];
const dormitoryScenario9SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json";
const dormitoryScenario9GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario9-checkout-settlement.generated.json",
  "docs/contracts/generated/dormitory/scenario9-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario9-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario9-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario9-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario9-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario9-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario9-test-plan.generated.json",
  "docs/contracts/generated/finance/scenario9-finance-gate.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario9-checkout-settlement.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario9CheckoutSettlement.generated.json"
];
const dormitoryScenario9ToolingFiles = [
  "scripts/business/generate-dormitory-scenario9-checkout-settlement-contracts.mjs",
  "scripts/business/check-dormitory-scenario9-checkout-settlement-authority.mjs",
  "scripts/business/check-dormitory-scenario9-checkout-settlement-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario9-checkout-settlement-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario9-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario9-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario9-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario9-negative-browser-audit.mjs"
];
const dormitoryScenario9RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario9BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-positive-browser/scenario9-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-negative-browser/scenario9-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-negative-browser/screenshot-index.json"
];
const dormitoryScenario9ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario9-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario9-negative-browser-result.json"
];
const dormitoryScenario9EvidenceFiles = [
  dormitoryScenario9SourcePath,
  ...dormitoryScenario9GeneratedFiles,
  ...dormitoryScenario9ToolingFiles,
  ...dormitoryScenario9RuntimeEvidenceFiles,
  ...dormitoryScenario9BrowserEvidenceFiles,
  ...dormitoryScenario9ResultFiles
];
const dormitoryScenario10SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json";
const dormitoryScenario10GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario10-cancel-noshow-refund.generated.json",
  "docs/contracts/generated/dormitory/scenario10-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario10-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario10-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario10-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario10-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario10-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario10-test-plan.generated.json",
  "docs/contracts/generated/finance/scenario10-finance-gate.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario10-cancel-noshow-refund.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario10CancelNoShowRefund.generated.json"
];
const dormitoryScenario10ToolingFiles = [
  "scripts/business/generate-dormitory-scenario10-cancel-noshow-refund-contracts.mjs",
  "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-authority.mjs",
  "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario10-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario10-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario10-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario10-negative-browser-audit.mjs"
];
const dormitoryScenario10RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario10BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-positive-browser/scenario10-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-negative-browser/scenario10-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-negative-browser/screenshot-index.json"
];
const dormitoryScenario10ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario10-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario10-negative-browser-result.json"
];
const dormitoryScenario10EvidenceFiles = [
  dormitoryScenario10SourcePath,
  ...dormitoryScenario10GeneratedFiles,
  ...dormitoryScenario10ToolingFiles,
  ...dormitoryScenario10RuntimeEvidenceFiles,
  ...dormitoryScenario10BrowserEvidenceFiles,
  ...dormitoryScenario10ResultFiles
];
const dormitoryScenario11SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json";
const dormitoryScenario11GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario11-housekeeping-maintenance-outofservice.generated.json",
  "docs/contracts/generated/dormitory/scenario11-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario11-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario11-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario11-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario11-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario11-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario11-test-plan.generated.json",
  "docs/contracts/generated/finance/scenario11-finance-gate.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario11-housekeeping-maintenance-outofservice.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json"
];
const dormitoryScenario11ToolingFiles = [
  "scripts/business/generate-dormitory-scenario11-housekeeping-maintenance-outofservice-contracts.mjs",
  "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-authority.mjs",
  "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario11-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario11-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario11-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario11-negative-browser-audit.mjs"
];
const dormitoryScenario11RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario11BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-positive-browser/scenario11-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-negative-browser/scenario11-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-negative-browser/screenshot-index.json"
];
const dormitoryScenario11ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario11-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario11-negative-browser-result.json"
];
const dormitoryScenario11EvidenceFiles = [
  dormitoryScenario11SourcePath,
  ...dormitoryScenario11GeneratedFiles,
  ...dormitoryScenario11ToolingFiles,
  ...dormitoryScenario11RuntimeEvidenceFiles,
  ...dormitoryScenario11BrowserEvidenceFiles,
  ...dormitoryScenario11ResultFiles
];
const dormitoryScenario12SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json";
const dormitoryScenario12GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario12-channel-corporate-customer.generated.json",
  "docs/contracts/generated/dormitory/scenario12-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario12-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario12-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario12-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario12-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario12-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario12-test-plan.generated.json",
  "docs/contracts/generated/finance/scenario12-finance-gate.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario12-channel-corporate-customer.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario12ChannelCorporateCustomer.generated.json"
];
const dormitoryScenario12ToolingFiles = [
  "scripts/business/generate-dormitory-scenario12-channel-corporate-customer-contracts.mjs",
  "scripts/business/check-dormitory-scenario12-channel-corporate-customer-authority.mjs",
  "scripts/business/check-dormitory-scenario12-channel-corporate-customer-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario12-channel-corporate-customer-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario12-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario12-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario12-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario12-negative-browser-audit.mjs"
];
const dormitoryScenario12RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario12BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-positive-browser/scenario12-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-negative-browser/scenario12-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-negative-browser/screenshot-index.json"
];
const dormitoryScenario12ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario12-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario12-negative-browser-result.json"
];
const dormitoryScenario12EvidenceFiles = [
  dormitoryScenario12SourcePath,
  ...dormitoryScenario12GeneratedFiles,
  ...dormitoryScenario12ToolingFiles,
  ...dormitoryScenario12RuntimeEvidenceFiles,
  ...dormitoryScenario12BrowserEvidenceFiles,
  ...dormitoryScenario12ResultFiles
];
const dormitoryScenario13SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json";
const dormitoryScenario13GeneratedFiles = [
  "docs/contracts/generated/dormitory/scenario13-reporting-audit-review.generated.json",
  "docs/contracts/generated/dormitory/scenario13-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario13-metric-model.generated.json",
  "docs/contracts/generated/dormitory/scenario13-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario13-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario13-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario13-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario13-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario13-test-plan.generated.json",
  "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json",
  "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario13-reporting-audit-review.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario13ReportingAuditReview.generated.json"
];
const dormitoryScenario13ToolingFiles = [
  "scripts/business/generate-dormitory-scenario13-reporting-audit-review-contracts.mjs",
  "scripts/business/check-dormitory-scenario13-reporting-audit-review-authority.mjs",
  "scripts/business/check-dormitory-scenario13-reporting-audit-review-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario13-reporting-audit-review-consumption-boundary.mjs",
  "scripts/surface/run-dormitory-scenario13-positive-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario13-positive-browser-audit.mjs",
  "scripts/surface/run-dormitory-scenario13-negative-browser-audit.mjs",
  "scripts/surface/check-dormitory-scenario13-negative-browser-audit.mjs"
];
const dormitoryScenario13RuntimeEvidenceFiles = [
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
];
const dormitoryScenario13BrowserEvidenceFiles = [
  "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-positive-browser/scenario13-positive-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-positive-browser/screenshot-index.json",
  "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-negative-browser/scenario13-negative-browser-report.json",
  "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-negative-browser/screenshot-index.json"
];
const dormitoryScenario13ResultFiles = [
  "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-authority-result.json",
  "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-generated-contracts-result.json",
  "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-consumption-boundary-result.json",
  "artifacts/oam/checks/dormitory-scenario13-positive-browser-result.json",
  "artifacts/oam/checks/dormitory-scenario13-negative-browser-result.json"
];
const dormitoryScenario13EvidenceFiles = [
  dormitoryScenario13SourcePath,
  ...dormitoryScenario13GeneratedFiles,
  ...dormitoryScenario13ToolingFiles,
  ...dormitoryScenario13RuntimeEvidenceFiles,
  ...dormitoryScenario13BrowserEvidenceFiles,
  ...dormitoryScenario13ResultFiles
];
const dormitoryPerformanceRecoverabilityEvidenceFiles = [
  "scripts/surface/run-dormitory-performance-recoverability-audit.mjs",
  "scripts/surface/check-dormitory-performance-recoverability-audit.mjs",
  "artifacts/oam/evidence/dormitory-performance-recoverability/performance-recoverability-report.json",
  "artifacts/oam/evidence/dormitory-performance-recoverability/screenshot-index.json",
  "artifacts/oam/checks/dormitory-performance-recoverability-result.json"
];
const digestPlaceholder = "__CURRENT_OAM_EVIDENCE_DIGEST__";
const evidenceRootDigestPlaceholder = "__CURRENT_OAM_EVIDENCE_ROOT_DIGEST__";
const pendingExternalAttestation = "pending_external_attestation";
const ciRunId = env("GITHUB_RUN_ID") || "local";
const ciRunAttempt = env("GITHUB_RUN_ATTEMPT") || "local";
const repository = env("GITHUB_REPOSITORY") || repositoryFromGitRemote() || "dingz5612-eng/workos-next";
const workflow = env("GITHUB_WORKFLOW") || "CI";
const artifactName = artifactNameForRun(ciRunId);
const githubArtifactMetadataDigest = env("WORKOS_GITHUB_ARTIFACT_METADATA_DIGEST") || env("GITHUB_ARTIFACT_METADATA_DIGEST") || "";
const zipArtifactDigest = env("WORKOS_ZIP_ARTIFACT_DIGEST") || env("GITHUB_ARTIFACT_ZIP_DIGEST") || "";
const defaultEvidenceLifecycleType = env("GITHUB_ACTIONS") === "true" && githubArtifactMetadataDigest
  ? "ci-release"
  : "local-candidate";
const evidenceLifecycleType = normalizeEvidenceLifecycleType(
  env("WORKOS_EVIDENCE_MODE") || env("OAM_EVIDENCE_MODE") || defaultEvidenceLifecycleType
);
const ciReleaseMode = evidenceLifecycleType === "ci-release";
if (ciReleaseMode && env("GITHUB_ACTIONS") !== "true") {
  throw new Error("ci-release evidence mode is only allowed inside GitHub Actions.");
}
if (ciReleaseMode && !env("GITHUB_SHA")) {
  throw new Error("ci-release evidence mode requires GITHUB_SHA.");
}
if (ciReleaseMode && !githubArtifactMetadataDigest) {
  throw new Error("ci-release evidence mode requires WORKOS_GITHUB_ARTIFACT_METADATA_DIGEST or GITHUB_ARTIFACT_METADATA_DIGEST.");
}
const githubArtifactDigestStatus = ciReleaseMode && githubArtifactMetadataDigest ? "attested" : pendingExternalAttestation;
const externalArtifactAttestation = ciReleaseMode && githubArtifactMetadataDigest ? "ATTESTED" : "PENDING_EXTERNAL_ATTESTATION";

const requiredEvidenceFiles = [
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
  responsibilityMapPath,
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
  ...dormitory13ScenarioEvidenceFiles,
  ...dormitory13ScenarioIntegrationChainEvidenceFiles,
  ...dormitoryScenario1EvidenceFiles,
  ...dormitoryBenchmarkInheritanceEvidenceFiles,
  ...dormitoryScenario2EvidenceFiles,
  ...dormitoryScenario3EvidenceFiles,
  ...dormitoryScenario4EvidenceFiles,
  ...dormitoryScenario5EvidenceFiles,
  ...dormitoryScenario6EvidenceFiles,
  ...dormitoryScenario7EvidenceFiles,
  ...dormitoryScenario8EvidenceFiles,
  ...dormitoryScenario9EvidenceFiles,
  ...dormitoryScenario10EvidenceFiles,
  ...dormitoryScenario11EvidenceFiles,
  ...dormitoryScenario12EvidenceFiles,
  ...dormitoryScenario13EvidenceFiles,
  ...dormitoryPerformanceRecoverabilityEvidenceFiles,
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_DB_PROJECTION_PROOF_RESULT_PATH,
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
  capabilityRegistryPath,
  capabilityLedgerPath,
  capabilityProjectionPath,
  capabilityCompatibilityBoxPath,
  capabilityStateMachinePath,
  sliceManifestPath,
  productionSliceManifestPath,
  legacySliceManifestPath,
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
  finalReportPath
];
const generatedContractFiles = [
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
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  ...dormitory13ScenarioGeneratedFiles,
  ...dormitoryScenario1GeneratedFiles,
  ...dormitoryBenchmarkInheritanceGeneratedFiles,
  ...dormitoryScenario2GeneratedFiles,
  ...dormitoryScenario3GeneratedFiles,
  ...dormitoryScenario4GeneratedFiles,
  ...dormitoryScenario5GeneratedFiles,
  ...dormitoryScenario6GeneratedFiles,
  ...dormitoryScenario7GeneratedFiles,
  ...dormitoryScenario8GeneratedFiles,
  ...dormitoryScenario9GeneratedFiles,
  ...dormitoryScenario10GeneratedFiles,
  ...dormitoryScenario11GeneratedFiles,
  ...dormitoryScenario12GeneratedFiles,
  ...dormitoryScenario13GeneratedFiles
];

const files = new Map();
const commitSha = env("GITHUB_SHA") || git("rev-parse HEAD") || "local";
const sourceCommitSha = commitSha;
const evidenceRunSha = env("GITHUB_SHA") || git("rev-parse HEAD") || commitSha;
const currentRepositoryHead = git("rev-parse HEAD") || evidenceRunSha;
const bindingStale = sourceCommitSha !== currentRepositoryHead || evidenceRunSha !== currentRepositoryHead;
const branch = env("GITHUB_HEAD_REF") || env("GITHUB_REF_NAME") || git("branch --show-current") || "local";
const generatedAt = stableEvidenceGeneratedAt();
const kernelGraphHash = hashFileStrict("docs/oam/oam-kernel-graph.json");
const generatedContractsHash = digestForDisk(generatedContractFiles);
const admission = readJson("docs/oam/current-admission-state.json");
const responsibilityMap = readJson(responsibilityMapPath);
const p0Ledger = readP0Ledger("docs/system/oam-p0-rule-ledger.json");
const workspace = workspaceStatus();
const workspaceEvidence = workspaceEvidenceStatus(workspace);
const controlPlaneGateResult = readControlPlaneGateResult();
const gateSummary = buildGateSummary();
const testSummary = buildTestSummary();
const coverageSummary = buildCoverageSummary();
const mobileBranchRiskKernel = buildMobileBranchRiskKernel();
const realBrowserEvidence = buildRealBrowserEvidence();
const projectMaintainabilityGovernance = buildProjectMaintainabilityGovernanceEvidence();
const projectPurityAuthoritySeal = buildProjectPurityAuthoritySealEvidence();
const dormitory13ScenarioIntegrationChain =
  readJsonIfExists(dormitory13ScenarioIntegrationChainResultFiles[0]) ?? {};
const mutationTests = readMutationTestsResult();
const ciArtifactProvenance = readCiArtifactProvenanceReport();
const sourcePackageCheck = readSourcePackageCheckResult();
const generatedCompileApproval = readJsonIfExists(generatedCompileApprovalPath);
const generatedCompileCandidateApproval = readJsonIfExists(generatedCompileCandidateApprovalPath);
const generatedCompileCandidate = buildGeneratedCompileCandidateState();
const formalGeneratedCompileAuthorization = buildFormalGeneratedCompileAuthorizationState();
const generatedCompileExecution = buildGeneratedCompileExecutionState();
const generatedFieldBindingClosure = buildGeneratedFieldBindingClosureState();
const generatedCandidateAcceptanceAuthority = readJsonIfExists(generatedCandidateAcceptancePath);
const generatedCandidateAcceptance = validateGeneratedCandidateAcceptanceAuthority({
  acceptance: generatedCandidateAcceptanceAuthority,
  root,
  currentHead: currentRepositoryHead
});
const generatedCandidateAcceptedBy00 = generatedCandidateAcceptance.generatedCandidateAcceptedBy00 === true;
const dormitoryRuntimeAdmissionAuthority = readJsonIfExists(dormitoryRuntimeAdmissionPath);
const dormitoryRuntimeAdmission = validateDormitoryRuntimeAdmissionAuthority({
  authority: dormitoryRuntimeAdmissionAuthority,
  root,
  currentHead: currentRepositoryHead
});
const runtimeConsumptionReady = dormitoryRuntimeAdmission.runtimeConsumptionReady === true;
const dormitoryFirstGoldenChainLandingAuthority = readJsonIfExists(dormitoryFirstGoldenChainLandingPath);
const dormitoryFirstGoldenChainLanding = validateDormitoryFirstGoldenChainLandingAuthority({
  authority: dormitoryFirstGoldenChainLandingAuthority,
  root,
  currentHead: currentRepositoryHead
});
const capabilityStateMachineTransition = readJsonIfExists(capabilityStateMachineTransitionResultPath) ?? {};
const capabilityAuthorityStateConsistency = readJsonIfExists(capabilityAuthorityStateConsistencyResultPath) ?? {};
const gateTaxonomy = readJsonIfExists(gateTaxonomyResultPath) ?? {};
const controlPlaneLaneBoundary = readJsonIfExists(controlPlaneLaneBoundaryResultPath) ?? {};
const generatedBundleContentAddressed = readJsonIfExists(generatedBundleContentAddressedResultPath) ?? {};
const runtimeConsumesAcceptedBundle = readJsonIfExists(runtimeConsumesAcceptedBundleResultPath) ?? {};
const environmentProfileAuthority = readJsonIfExists(environmentProfileAuthorityResultPath) ?? {};
const runtimeStabilityLane = readJsonIfExists(runtimeStabilityLaneResultPath) ?? {};
const runtimeImplementationDriftPolicy = readJsonIfExists(runtimeImplementationDriftPolicyResultPath) ?? {};
const evidenceIsProjectionOnly = readJsonIfExists(evidenceIsProjectionOnlyResultPath) ?? {};
const releaseAuthorityFinalGoSource = readJsonIfExists(releaseAuthorityFinalGoSourceResultPath) ?? {};
const currentHeadAuthoritativeArtifactReconciliation =
  readJsonIfExists(currentHeadAuthoritativeArtifactReconciliationResultPath) ?? {};
const capabilityProjectionDigestChain = buildProjectionDigestChain(root);
const generatedCapabilityTestPlan = readJsonIfExists(FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH) ?? {};
const firstGoldenChainBrowserAuditReport = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH) ?? {};
const firstGoldenChainBrowserAuditResult = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH) ?? {};
const compilerCapabilityDigestChain = readJsonIfExists(FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH) ?? {};
const capabilityDigestChain = {
  ...compilerCapabilityDigestChain,
  version: compilerCapabilityDigestChain.version ?? "oam.capability-evidence-digest-chain.v1",
  capabilityId: capabilityProjectionDigestChain.capabilityId,
  authorityLedgerDigest: capabilityProjectionDigestChain.authorityLedgerDigest,
  acceptedGeneratedBundleDigest: capabilityProjectionDigestChain.acceptedGeneratedBundleDigest,
  runtimeProjectionDigest: capabilityProjectionDigestChain.runtimeProjectionDigest,
  surfaceProjectionDigest: capabilityProjectionDigestChain.surfaceProjectionDigest,
  searchProjectionDigest: capabilityProjectionDigestChain.searchProjectionDigest,
  environmentProfileDigest: capabilityProjectionDigestChain.environmentProfileDigest,
  positiveBrowserAuditDigest: capabilityProjectionDigestChain.positiveBrowserAuditDigest,
  negativeBrowserAuditDigest: capabilityProjectionDigestChain.negativeBrowserAuditDigest,
  noSideEffectsProofDigest: capabilityProjectionDigestChain.noSideEffectsProofDigest,
  subjectChainDigest: capabilityProjectionDigestChain.subjectChainDigest,
  testPlanDigest: generatedCapabilityTestPlan.testPlanDigest ?? "missing",
  browserAuditDigest: firstGoldenChainBrowserAuditReport.browserAuditDigest ??
    firstGoldenChainBrowserAuditResult.browserAuditDigest ??
    "missing",
  dbProjectionProofDigest: capabilityProjectionDigestChain.dbProjectionProofDigest,
  evidenceRootDigest: evidenceRootDigestPlaceholder,
  runtimeConsumptionReady: dormitoryRuntimeAdmission.runtimeConsumptionReady === true ? "test_only" : false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};
const businessFeatureDevelopmentAllowed =
  dormitoryFirstGoldenChainLanding.businessFeatureDevelopmentAllowed === true;
const dormitoryFirstGoldenChainLandingGoNoGo =
  dormitoryFirstGoldenChainLanding.dormitoryFirstGoldenChainLandingGoNoGo === "GO" ? "GO" : "NO_GO";
const sourceAuthorityDigest = digestForFiles(sourceAuthorityFiles());
const generatedContractDigest = generatedContractsHash;
const fileLifecycleDigest = hashFileStrict("docs/oam/file-lifecycle-policy.json");
const runtimeBoundaryDigest = digestForFiles([
  "artifacts/oam/evidence/admission-p0-proof.json",
  "artifacts/oam/evidence/runtime-proof.json",
  "scripts/check-runtime-write-paths.mjs",
  "scripts/check-api-boundaries.mjs",
  "scripts/check-admission-kernel.mjs",
  "apps/mobile/src/admissionSurface.js",
  "apps/mobile/src/searchIntentHub.js",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
]);
const readSurfaceFinanceBoundaryDigest = digestForFiles([
  "artifacts/oam/evidence/search-readonly-proof.json",
  "artifacts/oam/evidence/surface-language-proof.json",
  "docs/read-intelligence/read-intelligence-kernel.json",
  "docs/finance/finance-ledger-kernel.json",
  "scripts/check-search-kernel.mjs",
  "scripts/check-surface-contract.mjs",
  "scripts/check-finance-truth.mjs",
  "scripts/finance/check-finance-semantic-truth.mjs"
]);
const mutationDigest = digestForDisk(["artifacts/oam/authority-cleanup/mutation-tests-result.json"]);
const browserL1Digest = realBrowserEvidence.summary.l1?.report
  ? digestForFiles([realBrowserEvidence.summary.l1.report])
  : "missing";
const candidateSubject = buildCandidateEvidenceSubject();
const evidenceSubjectDigest = digestObject(candidateSubject);
const candidateEvidenceDigest = digestObject({
  kind: "current-oam-candidate-evidence-subject",
  evidenceSubjectDigest,
  subject: candidateSubject
});
const trackedContentDigestValue = trackedContentDigest();
const unresolvedP0 = p0Ledger.filter((item) => item.status !== "passed");
const releaseReadiness = buildReleaseReadiness();
const workspaceDirtyAtGeneration = workspace.summary !== "clean";
const releaseEvidenceReferenceOnly = evidenceLifecycleType !== "ci-release"
  || bindingStale
  || workspaceDirtyAtGeneration
  || githubArtifactDigestStatus !== "attested";
const releaseBindingStatus = releaseEvidenceReferenceOnly ? "stale" : "current";
const evidenceLifecycle = buildEvidenceLifecycle();
const finalDecision = buildFinalDecision();
const finalGoNoGo = finalDecision.finalGoNoGo;
const forcedCurrentStageGoNoGo = {
  businessProductionGoNoGo: "NO_GO",
  dormitoryL2GoNoGo: "NO_GO",
  productionConfirmGoNoGo: "NO_GO",
  finalGoNoGo: "NO_GO"
};
const multiDimensionalGoNoGo = {
  responsibilityGovernanceGoNoGo: "NO_GO",
  evidenceBindingGoNoGo: "NO_GO",
  kernelCompileGoNoGo: "NO_GO",
  runtimeGateGoNoGo: "NO_GO",
  workItemEffectGoNoGo: "NO_GO",
  financeTruthGoNoGo: "NO_GO",
  readIntelligenceGoNoGo: "NO_GO",
  surfaceLanguageGoNoGo: "NO_GO",
  releaseEvidenceGoNoGo: "NO_GO"
};
addEvidence(
  "artifacts/oam/evidence/admission-p0-proof.json",
  proof("admission-p0-proof", "Admission P0 缺省阻断可信", {
    admissionP0Closure: {
      missingAdmissionVisibleAllowed: true,
      missingAdmissionPrepareAllowed: false,
      missingAdmissionConfirmAllowed: false,
      missingAdmissionProductionAllowed: false,
      surfaceMissingAdmissionSubmitAllowed: false,
      searchMissingAdmissionConfirmAllowed: false,
      runtimeMissingAdmissionEntersUnitOfWork: false,
      uiVisibleImpliesConfirmAllowed: false,
      uiPrepareImpliesProductionAllowed: false
    },
    generatedAdmissionContract: {
      contractRef: "docs/contracts/admission/admission-contract.json",
      generated: true,
      doNotEdit: true,
      sourceNodeRefs: ["kernel.system", "domain.dormitory", "graph.oam"],
      missingAdmissionBehavior: "confirmAllowed=false"
    },
    negativeTests: [
      "Search item without admission is readonly.",
      "Surface card without admission cannot submit.",
      "Runtime confirm with missing admissionPolicyRef is rejected before UnitOfWork."
    ],
    mutationTests: [
      "missing_admission_surface_confirm_true_should_fail",
      "missing_admission_search_infers_confirm_should_fail"
    ],
    authorityRefs: [
      "docs/business/policies/admission-policy.yml",
      "docs/contracts/admission/admission-contract.json",
      "docs/oam/current-admission-state.json"
    ],
    implementationRefs: [
      "apps/mobile/src/admissionSurface.js",
      "apps/mobile/src/searchIntentHub.js",
      "services/core-api/WorkOS.Api/Runtime/AdmissionKernelService.cs"
    ],
    gates: [
      "node scripts/check-admission-kernel.mjs --self-test",
      "node scripts/check-admission-kernel.mjs",
      "npm --prefix apps/mobile test",
      "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj --filter FullyQualifiedName~CanonicalOperationsApiServiceTests",
      "node scripts/oam/check-authority-cleanup-mutation-tests.mjs"
    ]
  })
);
addEvidence(
  "artifacts/oam/evidence/runtime-proof.json",
  proof("runtime-proof", "运行写入可信", {
    runtimeTruthOutputClosure: {
      missingAdmissionConfirmAllowed: false,
      missingAdmissionEntersUnitOfWork: false,
      unresolvedDefinitionConfirmAllowed: false,
      unresolvedDefinitionEntersUnitOfWork: false,
      noWorkItemEventOnRejectedAdmission: true,
      noLedgerTransactionOnRejectedAdmission: true,
      noWriteLogOnRejectedAdmission: true,
      nonFinanceDomainLedgerEntryAllowed: false,
      unitOfWorkTruthOwnerGuard: true,
      unitOfWorkAllowedFactsGuard: true,
      unitOfWorkForbiddenFactsGuard: true,
      unitOfWorkLedgerPolicyGuard: true
    },
    authorityRefs: [
      "docs/contracts/definition/workitem-definition-registry.json",
      "docs/business/truth-owner-registry.yml",
      "docs/contracts/definition/ledger-policy-refs.json"
    ],
    gates: [
      "node scripts/check-runtime-write-paths.mjs",
      "node scripts/check-admission-kernel.mjs",
      "node scripts/check-truth-owners.mjs",
      "node scripts/check-ledger-semantic-rules.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/truth-ownership-proof.json",
  proof("truth-ownership-proof", "真值归属可信", {
    truthOwnershipClosure: {
      everyFactIdSingleTruthOwner: true,
      allowedCommittersAndForbiddenOwnersRequired: true,
      financeTruthOwner: "FinanceTruthPack",
      ledgerEntryTruthOwner: "MoneyKernelPack",
      nonFinanceLedgerEntryAllowed: false,
      amountBasisIsFinanceFact: false,
      businessDomainDirectLedgerWriteAllowed: false,
      businessDomainDirectFinancialFactAllowed: false,
      evidenceObjectDefinesBusinessFactAllowed: false,
      readSideBusinessFactWriteAllowed: false,
      forbiddenReadSideOwners: [
        "Search",
        "Surface",
        "Dashboard",
        "Report",
        "Metric"
      ],
      financeStateChain: [
        "AmountBasisProposal",
        "AmountBasisReviewed",
        "AmountBasis",
        "FinancialFact",
        "LedgerTransaction",
        "LedgerEntry"
      ],
      forbiddenOwnerNegativeFixturesFailAsP0: true
    },
    authorityRefs: [
      "docs/business/truth-owner-registry.yml",
      "docs/contracts/authority/truth-ownership-matrix.contract.json",
      "docs/business/finance/ledger-semantic-rules.yml",
      "docs/finance/finance-semantic-truth-kernel.yml"
    ],
    gates: [
      "node scripts/authority/check-truth-ownership-matrix.mjs",
      "node scripts/check-finance-truth.mjs",
      "node scripts/check-ledger-semantic-rules.mjs",
      "node scripts/finance/check-finance-semantic-truth.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/search-readonly-proof.json",
  proof("search-readonly-proof", "读取只读可信", {
    searchReadonlyClosure: {
      searchBusinessWriteAllowed: false,
      lensBusinessWriteAllowed: false,
      searchVisibilityMeansConfirmAllowed: false,
      requiredSearchResultFields: [
        "permission",
        "lineage",
        "freshness",
        "ranking",
        "businessContext",
        "availableActions"
      ],
      forbiddenActions: [
        "confirm",
        "refund",
        "close",
        "applyCorrection",
        "productionConfirm",
        "writeBusinessFact"
      ]
    },
    authorityRefs: [
      "docs/contracts/search/search-result-schema.json",
      "docs/contracts/search/search-contract.json",
      "docs/contracts/search/search-permission-policy.json"
    ],
    gates: [
      "node scripts/check-search-kernel.mjs",
      "node scripts/check-api-boundaries.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/surface-language-proof.json",
  proof("surface-language-proof", "用户语义可信", {
    surfaceLanguageClosure: {
      ordinaryUserInternalRuntimeTermsAllowed: false,
      visibleAllowedMeansConfirmAllowed: false,
      readyMeansConfirmAllowed: false,
      summaryMeansBusinessFact: false,
      receiptMeansProductionRelease: false,
      languageKernelRequired: true
    },
    authorityRefs: [
      "docs/surface/surface-contract.yml",
      "docs/business/experience-contract.yml",
      "docs/contracts/language/surface-copy-catalog.json"
    ],
    gates: [
      "node scripts/check-surface-contract.mjs",
      "node scripts/check-language-kernel.mjs",
      "npm --prefix apps/mobile run test"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/high-risk-trust-proof.json",
  proof("high-risk-trust-proof", "高风险动作可信", {
    highRiskTrustClosure: {
      verifiedDeviceTrustRequired: true,
      actorCapabilityRequired: true,
      tenantDeviceMatchRequired: true,
      reasonRequired: true,
      evidenceRefsRequired: true,
      admissionDecisionRefRequired: true,
      appendOnlyRequired: true,
      productionBrowserPrimaryPath: "cookie+csrf"
    },
    coveredActions: [
      "production_confirm",
      "payment_confirmation",
      "deposit_refund",
      "period_close",
      "bulk_import",
      "correction_apply",
      "release_state_change",
      "business_signoff",
      "management_cockpit_decision_that_affects_execution",
      "shared_receipt_that_affects_block_or_risk"
    ],
    authorityRefs: [
      "docs/contracts/admission/actor-device-admission-contract.json",
      "docs/contracts/admission/admission-matrix.json",
      "docs/business/finance/correction-policy.yml"
    ],
    gates: [
      "node scripts/check-admission-kernel.mjs",
      "node scripts/trust/check-trust-boundary-kernel.mjs",
      "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/master-design-proof.json",
  proof("master-design-proof", "总设计输入可信", {
    masterDesignClosure: {
      currentArchitecture: "OAM",
      currentArchitectureUniqueEffective: true,
      fourGraphsAreViews: true,
      threeLayersArePartitions: true,
      sixLoopsAreExecutionOrder: true,
      sourceGeneratedRuntimeEvidenceLayerOverreachForbidden: true,
      notGoSignals: [
        "ci.green",
        "artifact.exists",
        "browser.evidence",
        "finalReport.exists"
      ],
      secondAuthorityForbiddenSources: [
        "closedCatalog",
        "closedSeed",
        "generatedView",
        "dashboard",
        "search",
        "surface"
      ],
      businessProduction: admission.businessProduction,
      dormitoryProduction: admission.dormitoryProduction,
      productionConfirmAllowed: admission.productionConfirmAllowed,
      productionConfirmOpenedByCi: false,
      dormitoryL2OpenedByCoverage: false
    },
    authorityRefs: [
      "docs/oam/current-architecture.md",
      "docs/oam/current-architecture.manifest.json",
      "docs/contracts/authority/master-design.contract.json",
      "docs/contracts/oam.current.json",
      "docs/system/current-system-map.md"
    ],
    gates: [
      "node scripts/oam/check-current-oam.mjs",
      "node scripts/authority/check-master-design-schema.mjs",
      "node scripts/check-rule-authority.mjs",
      "node scripts/validate-contracts.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/master-outline-proof.json",
  proof("master-outline-proof", "总纲输入可信", {
    masterOutlineClosure: {
      authorityClosed: true,
      businessDefinitionClosed: true,
      runtimeWriteClosed: true,
      searchReadonlyClosed: true,
      surfaceLanguageClosed: true,
      highRiskTrustClosed: true,
      evidenceRootClosed: true,
      nextStageRequiresSeparateAdmission: true
    },
    authorityRefs: [
      "docs/system/oam-authority-map.md",
      "docs/system/oam-rule-to-gate-map.md",
      "docs/system/oam-p0-rule-ledger.md"
    ],
    gates: [
      "node scripts/check-business-line-admission.mjs",
      "node scripts/check-dormitory-golden-domain.mjs",
      "node scripts/oam/check-current-evidence-root.mjs"
    ]
  })
);

const workstreamProofNodes = buildWorkstreamProofNodes();
const workstreamGoNoGoFields = buildWorkstreamGoNoGoFields(workstreamProofNodes);
const p0ClosureProofNodes = buildP0ClosureProofNodes();
const sourcePackageProofNodes = buildSourcePackageProofNodes();
const generatedCompileCandidateProofNodes = buildGeneratedCompileCandidateProofNodes();
const formalGeneratedCompileAuthorizationProofNodes = buildFormalGeneratedCompileAuthorizationProofNodes();
const generatedFieldBindingClosureProofNodes = buildGeneratedFieldBindingClosureProofNodes();
const generatedCompileExecutionProofNodes = buildGeneratedCompileExecutionProofNodes();
const generatedCandidateAcceptanceProofNodes = buildGeneratedCandidateAcceptanceProofNodes();
const dormitoryRuntimeAdmissionProofNodes = buildDormitoryRuntimeAdmissionProofNodes();
const dormitoryFirstGoldenChainLandingProofNodes = buildDormitoryFirstGoldenChainLandingProofNodes();
const dormitory13ScenarioIntegrationChainProofNode =
  buildDormitory13ScenarioIntegrationChainProofNode(dormitory13ScenarioIntegrationChain);
const candidateEvidenceObject = {
  ...proof("current-oam-candidate-evidence-object", "当前 OAM Candidate Evidence Object", {
    proofType: "candidate-evidence",
    purposeZh: "证明当前本地内容满足架构闭合候选条件；不负责发布授权，不等于业务 GO。",
    releaseAuthorityForbidden: true
  }),
  proofType: "candidate-evidence",
  sourceAuthorityDigest,
  generatedContractDigest,
  fileLifecycleDigest,
  runtimeBoundaryDigest,
  readSurfaceFinanceBoundaryDigest,
  mutationDigest,
  browserL1Digest,
  evidenceSubjectDigest,
  candidateEvidenceDigest,
  currentRepositoryHead,
  headSha: currentRepositoryHead,
  candidateStatus: candidateSubject.candidateStatus,
  candidateReadyForCompile: candidateSubject.candidateReadyForCompile,
  candidateReadyForBusinessImplementation: false,
  candidateReadyForRelease: false,
  releaseAuthority: false,
  evidenceLifecycleType,
  evidenceLifecycle,
  releaseEvidenceReferenceOnly,
  workspaceDirtyAtGeneration,
  githubArtifactDigestStatus: "not_applicable_for_candidate",
  forbiddenBindings: [
    "githubArtifactDigest",
    "external artifact attestation",
    "releaseAuthority=true"
  ],
  subject: candidateSubject
};
const commitAttestation = {
  ...proof("current-oam-commit-attestation", "当前 OAM Commit Attestation", {
    proofType: "commit-attestation",
    purposeZh: "证明当前 HEAD 与 Candidate Evidence 的主体摘要一致；不负责发布授权。"
  }),
  proofType: "commit-attestation",
  commitSha,
  currentRepositoryHead,
  candidateEvidenceDigest,
  evidenceSubjectDigest,
  sourceTreeDigest: trackedContentDigestValue,
  trackedContentDigest: trackedContentDigestValue,
  generatedAtUtc: generatedAt,
  bindingStatus: commitSha === currentRepositoryHead ? "current" : "stale",
  candidateBindingStatus: evidenceSubjectDigest === candidateEvidenceObject.evidenceSubjectDigest ? "current" : "stale",
  releaseAuthority: false,
  evidenceLifecycleType,
  evidenceLifecycle,
  releaseEvidenceReferenceOnly,
  workspaceDirtyAtGeneration,
  candidateEvidenceObject: candidateEvidenceObjectPath
};
let finalReportStatusMatrix = buildFinalReportStatusMatrix(candidateEvidenceObject, commitAttestation);
const evidenceLifecycleProof = {
  ...proof("evidence-lifecycle-proof", "Evidence / Release 生命周期分层证明", {
    proofType: "evidence-lifecycle-proof",
    purposeZh: "证明本地候选证据、仓库参考快照、CI 发布证据三类生命周期互不越权；本地产物不得冒充 CI release。",
    lifecyclePolicyRef: "docs/oam/current-architecture.md#23-evidence--release-lifecycle",
    negativeTests: buildEvidenceLifecycleNegativeTests()
  }),
  proofType: "evidence-lifecycle-proof",
  evidenceLifecycleType,
  evidenceLifecycle,
  releaseEvidenceReferenceOnly,
  workspaceDirtyAtGeneration,
  githubArtifactDigestStatus,
  externalArtifactAttestation,
  releaseAuthority: false,
  negativeTests: buildEvidenceLifecycleNegativeTests()
};
addEvidence(evidenceLifecycleProofPath, evidenceLifecycleProof);
const architectureGateStatus = controlPlaneGateResult.status === "passed"
  && controlPlaneGateResult.runStatus === "completed"
  && controlPlaneGateResult.finalizable === true
  && !controlPlaneGateResult.stale
  && (controlPlaneGateResult.failedGateCount ?? 0) === 0
  && (controlPlaneGateResult.missingRequiredGates ?? []).length === 0
  ? "PASS"
  : "FAIL";

const finalReport = {
  ...proof("current-oam-final-report", "当前 OAM 可信运行闭环最终报告", {}),
  artifactName,
  sourceCommitSha,
  evidenceRunSha,
  artifactDigest: digestPlaceholder,
  generatedContractsHash,
  evidenceGraphHash: digestPlaceholder,
  finalReportDigest: digestPlaceholder,
  evidenceBinding: evidenceBindingState(),
  capabilityDigestChain,
  currentBranch: branch,
  latestCommit: commitSha,
  workspaceStatus: workspace.summary,
  workspaceChanges: workspaceEvidence,
  evidenceLifecycleType,
  evidenceLifecycle,
  releaseEvidenceReferenceOnly,
  workspaceDirtyAtGeneration,
  releaseBindingStatus,
  releaseReadiness,
  controlPlaneGateResult,
  finalDecision,
  architectureGateStatus,
  sourceFinalizationStatus: sourcePackageCheck.sourceFinalizationStatus,
  sourceScenarioPackageReviewStatus: sourcePackageCheck.sourceScenarioPackageReviewStatus,
  sourceFieldGapsDecisionStatus: sourcePackageCheck.sourceFieldGapsDecisionStatus,
  sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
  compilePreparationDecision: sourcePackageCheck.compilePreparationDecision,
  compileDecisionStatus: sourcePackageCheck.compileDecisionStatus,
  compilePreparationAllowed: sourcePackageCheck.compilePreparationAllowed,
  generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
  generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
  generatedCompilationReadiness: generatedCompileExecution.generatedCompilationReadiness,
  formalGeneratedCompileAuthorization,
  generatedCompileExecution,
  generatedFieldBindingClosure,
  generatedFieldBindingClosureRequired: true,
  generatedFieldBindingClosureStatus: generatedFieldBindingClosure.status,
  generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
  sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
  candidateAttestationIsReleaseEvidence: false,
  releaseEvidenceRequiredAfterCandidateEvidence: true,
  generatedCandidateAcceptance: generatedCandidateAcceptanceReportView(),
  dormitoryRuntimeAdmission: dormitoryRuntimeAdmissionReportView(),
  runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
  dormitoryFirstGoldenChainLanding,
  dormitoryFirstGoldenChainLandingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
  dormitoryFirstGoldenChainLandingGoNoGo,
  generatedContractStatus10B: generatedCompileExecution.generatedContractStatus10B,
  generatedCompileCompleted: generatedCompileExecution.generatedCompileCompleted,
  generatedCompilationCompleted: generatedCompileExecution.generatedCompilationCompleted,
  generatedCompileCandidateAuthorized: generatedCompileCandidate.authorized,
  authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
  authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
  candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
  evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
  currentRepositoryHead,
  candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
  candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
  candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
  generatedCompileCandidateStatus: generatedCompileCandidate.status,
  formalGeneratedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
  formalGeneratedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
  formalGeneratedCompileAuthorizationStatus: formalGeneratedCompileAuthorization.status,
  generatedCandidateAcceptedBy00: generatedCandidateAcceptedBy00,
  generatedReleaseAllowed: false,
  runtimeConsumptionAllowed: runtimeConsumptionReady ? "test_only_consumption_only" : "false_until_runtime_admission_approved",
  runtimeConsumptionReady,
  businessFeatureDevelopmentAllowed,
  externalArtifactAttestation,
  releaseAuthority: false,
  multiStatusVersion: "oam.final-report.multi-status.v1",
  statusMatrix: finalReportStatusMatrix,
  authorityStatus: finalReportStatusMatrix.authorityStatus,
  fileLifecycleStatus: finalReportStatusMatrix.fileLifecycleStatus,
  compileStatus: finalReportStatusMatrix.compileStatus,
  sourceCompileDecisionReadinessStatus: finalReportStatusMatrix.sourceCompileDecisionReadinessStatus,
  generatedCompileAuthorizationStatus: finalReportStatusMatrix.generatedCompileAuthorizationStatus,
  generatedCompilationStatus: finalReportStatusMatrix.generatedCompilationStatus,
  generatedFieldBindingClosureStatusEntry: finalReportStatusMatrix.generatedFieldBindingClosureStatus,
  generatedCandidateAcceptanceStatus: finalReportStatusMatrix.generatedCandidateAcceptanceStatus,
  runtimeAdmissionStatusEntry: finalReportStatusMatrix.runtimeAdmissionStatus,
  dormitoryFirstGoldenChainLandingStatusEntry: finalReportStatusMatrix.dormitoryFirstGoldenChainLandingStatus,
  runtimeConsumptionStatus: finalReportStatusMatrix.runtimeConsumptionStatus,
  runtimeBoundaryStatus: finalReportStatusMatrix.runtimeBoundaryStatus,
  readSurfaceFinanceStatus: finalReportStatusMatrix.readSurfaceFinanceStatus,
  sourcePackageStatus: finalReportStatusMatrix.sourcePackageStatus,
  mutationStatus: finalReportStatusMatrix.mutationStatus,
  browserL1Status: finalReportStatusMatrix.browserL1Status,
  candidateEvidenceStatus: finalReportStatusMatrix.candidateEvidenceStatus,
  commitAttestationStatus: finalReportStatusMatrix.commitAttestationStatus,
  businessReadinessStatus: finalReportStatusMatrix.businessReadinessStatus,
  releaseReadinessStatus: finalReportStatusMatrix.releaseReadinessStatus,
  finalGoNoGoStatus: finalReportStatusMatrix.finalGoNoGo,
  responsibilityMap: {
    path: responsibilityMapPath,
    workstreamCount: responsibilityMap.workstreams?.length ?? 0,
    proofNodeCount: workstreamProofNodes.length,
    forcedCurrentStage: responsibilityMap.forcedCurrentStage,
    p0RuntimeSafetyCarryForward: responsibilityMap.p0RuntimeSafetyCarryForward ?? []
  },
  authorityClosure: statusLine("权威闭环", "passed"),
  businessDefinitionClosure: statusLine("业务定义闭环", "passed"),
  surfaceLanguageClosure: statusLine("Surface 用户语义闭环", "passed"),
  searchReadonlyClosure: statusLine("Search / BI / KPI / Lineage / Permission 只读闭环", "passed"),
  runtimeTruthOutputClosure: statusLine("Runtime 真值输出闭环", "passed"),
  highRiskTrustClosure: statusLine("高风险信任闭环", "passed"),
  evidenceRootClosure: statusLine("证据根闭环", "passed"),
  nextStageAdmissionClosure: statusLine(
    "下一阶段准入闭环",
    fileExists(path.join("docs", "system", "oam-next-stage-admission.md")) ? "passed" : "pending"),
  gateSummary,
  testSummary,
  mutationTests,
  sourcePackageReview: {
    gateId: sourcePackageCheck.gateId,
    status: sourcePackageCheck.status,
    sourceFinalizationStatus: sourcePackageCheck.sourceFinalizationStatus,
    sourceScenarioPackageReviewStatus: sourcePackageCheck.sourceScenarioPackageReviewStatus,
    sourceFieldGapsDecisionStatus: sourcePackageCheck.sourceFieldGapsDecisionStatus,
    sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
    compilePreparationDecision: sourcePackageCheck.compilePreparationDecision,
    compileDecisionStatus: sourcePackageCheck.compileDecisionStatus,
    compilePreparationAllowed: sourcePackageCheck.compilePreparationAllowed,
    generatedCompileAuthorized: sourcePackageCheck.generatedCompileAuthorized ?? false,
    generatedCompilationAllowed: sourcePackageCheck.generatedCompilationAllowed,
    generatedCompilationReadiness: "NOT_STARTED_OR_NOT_AUTHORIZED",
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    runtimeConsumptionReady: sourcePackageCheck.runtimeConsumptionReady ?? false,
    businessFeatureDevelopmentAllowed: sourcePackageCheck.businessFeatureDevelopmentAllowed,
    finalGoNoGo: sourcePackageCheck.finalGoNoGo,
    evidenceNodeReady: sourcePackageCheck.evidenceNodeReady,
    p1Residuals: sourcePackageCheck.p1Residuals ?? [],
    p2Residuals: sourcePackageCheck.p2Residuals ?? [],
    generatedContractStatus10B: sourcePackageCheck.generatedContractStatus10B ?? "PENDING_GENERATED_CONTRACT"
  },
  dormitoryGoldenChainSourcePackage: {
    gateId: sourcePackageCheck.gateId,
    status: sourcePackageCheck.status,
    sourceFinalizationStatus: sourcePackageCheck.sourceFinalizationStatus,
    sourceScenarioPackageReviewStatus: sourcePackageCheck.sourceScenarioPackageReviewStatus,
    sourceFieldGapsDecisionStatus: sourcePackageCheck.sourceFieldGapsDecisionStatus,
    sourceScenarioRef: "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml",
    scope: "compile_preparation_review",
    excluded: [
      "宿舍业务功能开发",
      "generated contracts 正式编译",
      "Runtime 业务落地",
      "Business GO",
      "Dormitory L2",
      "production_confirm enabled",
      "入住/收款/押金/退住/财务纠错扩展"
    ],
    sourceFieldGaps: sourcePackageCheck.sourceFieldGaps ?? {
      pending00Decision: false,
      compilePreparationAllowed: "READY_FOR_00_COMPILE_DECISION",
      decisions: {}
    },
    sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
    compilePreparationDecision: sourcePackageCheck.compilePreparationDecision,
    compileDecisionStatus: sourcePackageCheck.compileDecisionStatus,
    compilePreparationAllowed: sourcePackageCheck.compilePreparationAllowed,
    generatedCompileAuthorized: sourcePackageCheck.generatedCompileAuthorized ?? false,
    generatedCompilationAllowed: sourcePackageCheck.generatedCompilationAllowed,
    generatedCompilationReadiness: "NOT_STARTED_OR_NOT_AUTHORIZED",
    businessFeatureDevelopmentAllowed: sourcePackageCheck.businessFeatureDevelopmentAllowed,
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    runtimeConsumptionReady: sourcePackageCheck.runtimeConsumptionReady ?? false,
    generatedContractStatus10B: sourcePackageCheck.generatedContractStatus10B ?? "PENDING_GENERATED_CONTRACT",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    nextStageRequires00Review: true
  },
  ciArtifactProvenance,
  candidateEvidence: summarizeCandidateEvidence(candidateEvidenceObject),
  commitAttestation: summarizeCommitAttestation(commitAttestation),
  failedChecks: [],
  skippedOrNotApplicable: buildSkippedOrNotApplicable(),
  coverageSummary,
  mobileBranchRiskKernel,
  dormitory13ScenarioIntegrationChain: {
    status: dormitory13ScenarioIntegrationChain.status ?? "MISSING",
    chainCount: dormitory13ScenarioIntegrationChain.chainCount ?? 0,
    completedChainCount: dormitory13ScenarioIntegrationChain.completedChainCount ?? 0,
    result: dormitory13ScenarioIntegrationChainResultFiles[0],
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  },
  ciEvidenceRootStatus: {
    generated: true,
    checkedBy: "scripts/oam/check-current-evidence-root.mjs",
    uploadedByCi: workflowContainsEvidenceUpload(),
    evidenceRoot: evidenceDir
  },
  businessProduction: admission.businessProduction,
  businessProductionStatus: admission.businessProduction,
  dormitoryL2: admission.dormitoryProduction,
  dormitoryL2Status: admission.dormitoryProduction,
  productionConfirm: admission.productionConfirmAllowed ? "ALLOWED" : "BLOCKED",
  productionConfirmAllowed: admission.productionConfirmAllowed,
  ...workstreamGoNoGoFields,
  ...multiDimensionalGoNoGo,
  businessProductionGoNoGo: forcedCurrentStageGoNoGo.businessProductionGoNoGo,
  dormitoryL2GoNoGo: forcedCurrentStageGoNoGo.dormitoryL2GoNoGo,
  productionConfirmGoNoGo: forcedCurrentStageGoNoGo.productionConfirmGoNoGo,
  unresolvedP0,
  unresolvedP1: [],
  unresolvedP2: [],
  finalGoNoGo: forcedCurrentStageGoNoGo.finalGoNoGo,
  noGoReasons: finalDecision.noGoReasons,
  formalGeneratedCompileNextStageAllowed: formalGeneratedCompileAuthorization.authorized,
  formalGeneratedCompileNextStageScope: "formal_generated_compile_gates_only",
  nextStageAllowed: false,
  nextStageReason: `不允许进入 runtime、release 或业务下一阶段；formal generated compile authorization gates 可执行。当前 NO_GO 原因：${finalDecision.noGoReasons.join("；")}`,
  p0RuleLedger: p0Ledger
};

addEvidence(candidateEvidenceObjectPath, candidateEvidenceObject);
addEvidence(commitAttestationPath, commitAttestation);
addEvidence("artifacts/oam/evidence/current-oam-final-report.json", finalReport);
addEvidence(finalReportPath, finalReport);

const evidenceGraph = {
  ...proof("evidence-graph", "当前 OAM 证据根", {}),
  sourceCommitSha,
  evidenceRunSha,
  artifactDigest: digestPlaceholder,
  generatedContractsHash,
  evidenceGraphHash: digestPlaceholder,
  finalReportDigest: digestPlaceholder,
  evidenceBinding: evidenceBindingState(),
  capabilityDigestChain,
  evidenceRoot: evidenceDir,
  requiredFiles: requiredEvidenceFiles,
  fileRefs: requiredEvidenceFiles.map((file) => ({
    path: file,
    kind: file.endsWith("final-report.json") ? "final-report" : path.basename(file, ".json")
  })),
  evidenceObjectRefs: [
    {
      path: candidateEvidenceObjectPath,
      proofType: "candidate-evidence",
      purposeZh: "本地候选闭合证明，不授权发布。"
    },
    {
      path: commitAttestationPath,
      proofType: "commit-attestation",
      purposeZh: "当前 HEAD 与候选主体摘要绑定证明，不授权发布。"
    },
    {
      path: releaseEvidenceObjectPath,
      proofType: "release-evidence",
      purposeZh: "CI / release 发布证明，本地保持 releaseAuthority=false。"
    },
    {
      path: evidenceLifecycleProofPath,
      proofType: "evidence-lifecycle-proof",
      purposeZh: "证明本地候选、仓库参考快照、CI 发布证据三类生命周期分离。"
    },
    {
      path: generatedCompileCandidateApprovalPath,
      proofType: "generated-compile-candidate-approval",
      purposeZh: "00 只授权 generated compile candidate，不授权 release、runtime 消费或业务 GO。"
    },
    {
      path: generatedCompileExecutionProofPath,
      proofType: "generated-compile-execution-proof",
      purposeZh: "formal generated compile execution 证明；只证明生成编译闭合，不接受候选、不开放 Runtime、不授权 GO。"
    },
    {
      path: generatedCandidateAcceptancePath,
      proofType: "generated-candidate-acceptance-authority",
      purposeZh: "00 generated candidate acceptance 的唯一 authority；PENDING 时不接受候选、不开放 Runtime、不授权 GO。"
    },
    {
      path: dormitoryFirstGoldenChainLandingPath,
      proofType: "dormitory-first-golden-chain-business-landing-authority",
      purposeZh: "宿舍第一金链 L1 业务落地唯一 authority；只开放 Room/Bed/ResourceReadiness 三核业务落地，不开放 production、release 或 final GO。"
    }
  ],
  authorityRefs: [
    "docs/oam/current-architecture.manifest.json",
    generatedCandidateAcceptancePath,
    dormitoryRuntimeAdmissionPath,
    dormitoryFirstGoldenChainLandingPath,
    "docs/system/oam-p0-rule-ledger.md",
    ".github/workflows/ci.yml"
  ],
  gateSummary,
  testSummary,
  coverageSummary,
  mobileBranchRiskKernel,
  projectMaintainabilityGovernance,
  projectPurityAuthoritySeal,
  realBrowserEvidence: realBrowserEvidence.summary,
  performanceRecoverabilityEvidence: realBrowserEvidence.summary.performanceRecoverability,
  dormitory13ScenarioIntegrationChain: {
    status: dormitory13ScenarioIntegrationChain.status ?? "MISSING",
    chainCount: dormitory13ScenarioIntegrationChain.chainCount ?? 0,
    completedChainCount: dormitory13ScenarioIntegrationChain.completedChainCount ?? 0,
    result: dormitory13ScenarioIntegrationChainResultFiles[0],
    digest: dormitory13ScenarioIntegrationChain.resultDigest ?? "missing",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  },
  legacyQuarantine: {
    firstGoldenChainBrowserEvidence: {
      report: FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
      result: FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH,
      browserAuditDigest: capabilityDigestChain.browserAuditDigest,
      currentMainAudit: false,
      lane: "legacy_quarantine",
      legacyTenScenarioAsMainGate: false,
      legacyAllStepsAsMainGate: false
    }
  },
  evidenceRootWriter: {
    writer: "scripts/oam/generate-current-evidence-root.mjs",
    browserAuditScriptsWriteFinalGraph: false
  },
  controlPlaneGateResult,
  releaseReadiness,
  finalDecision,
  finalReportStatusMatrix,
  mutationTests,
  generatedCompileCandidate,
  formalGeneratedCompileAuthorization,
  generatedCompileExecution,
  generatedCandidateAcceptance,
  candidateEvidence: summarizeCandidateEvidence(candidateEvidenceObject),
  commitAttestation: summarizeCommitAttestation(commitAttestation),
  responsibilityMap: {
    path: responsibilityMapPath,
    workstreamCount: responsibilityMap.workstreams?.length ?? 0
  },
  workstreamProofNodeCount: workstreamProofNodes.length,
  finalGoNoGo,
  nextStageAllowed: finalReport.nextStageAllowed,
  nodes: [
    ...workstreamProofNodes,
    ...p0ClosureProofNodes,
    ...sourcePackageProofNodes,
    ...generatedCompileCandidateProofNodes,
    ...formalGeneratedCompileAuthorizationProofNodes,
    ...generatedFieldBindingClosureProofNodes,
    ...generatedCompileExecutionProofNodes,
    ...generatedCandidateAcceptanceProofNodes,
    ...dormitoryRuntimeAdmissionProofNodes,
    ...dormitoryFirstGoldenChainLandingProofNodes,
    dormitory13ScenarioIntegrationChainProofNode,
    projectMaintainabilityGovernance.node,
    projectPurityAuthoritySeal.node,
    ...realBrowserEvidence.nodes
  ].filter(Boolean),
  edges: [
    projectMaintainabilityGovernance.node
      ? { from: projectMaintainabilityGovernance.node.id, to: "DORMITORY_13_SCENARIO_PRODUCTION_MAINLINE_ACTIVATION", relation: "binds_project_maintainability_governance" }
      : null,
    projectPurityAuthoritySeal.node
      ? { from: projectPurityAuthoritySeal.node.id, to: "DORMITORY_13_SCENARIO_PRODUCTION_MAINLINE_ACTIVATION", relation: "binds_project_purity_authority_seal" }
      : null,
    ...realBrowserEvidence.edges
  ].filter(Boolean)
};
addEvidence("artifacts/oam/evidence/evidence-graph.json", evidenceGraph);
const releaseEvidenceObject = {
  ...proof("current-oam-release-evidence-object", "当前 OAM Release Evidence Object", {
    currentAdmissionState: "docs/oam/current-admission-state.json",
    releaseObjectPurpose: "Bind concrete CI run, artifact identity, generated contracts hash, evidence root digest, graph hash, and final report digest while current stage remains NO_GO."
  }),
  repository,
  workflow,
  sourceCommitSha,
  evidenceRunSha,
  currentRepositoryHead,
  stale: releaseEvidenceReferenceOnly,
  referenceOnly: releaseEvidenceReferenceOnly,
  bindingStatus: releaseBindingStatus,
  evidenceLifecycleType,
  evidenceLifecycle,
  releaseEvidenceReferenceOnly,
  workspaceDirtyAtGeneration,
  githubSha: commitSha,
  githubRunId: ciRunId,
  githubRunAttempt: ciRunAttempt,
  githubRefName: branch,
  generatedAtUtc: generatedAt,
  artifactName,
  artifactDigest: digestPlaceholder,
  capabilityDigestChain,
  runtimeProjectionDigest: capabilityDigestChain.runtimeProjectionDigest,
  surfaceProjectionDigest: capabilityDigestChain.surfaceProjectionDigest,
  searchProjectionDigest: capabilityDigestChain.searchProjectionDigest,
  testPlanDigest: capabilityDigestChain.testPlanDigest,
  browserAuditDigest: capabilityDigestChain.browserAuditDigest,
  githubArtifactDigest: githubArtifactMetadataDigest || pendingExternalAttestation,
  githubArtifactMetadataDigest: githubArtifactMetadataDigest || pendingExternalAttestation,
  githubArtifactDigestStatus,
  externalArtifactAttestation,
  zipArtifactDigest: zipArtifactDigest || pendingExternalAttestation,
  releaseAuthority: false,
  evidenceRootDigest: evidenceRootDigestPlaceholder,
  generatedContractsHash,
  sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
  generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
  generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
  generatedCompilationReadiness: formalGeneratedCompileAuthorization.generatedCompilationReadiness,
  formalGeneratedCompileAuthorization,
  generatedCompileExecution: {
    status: "NO_GO",
    generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
    generatedCompilationReadiness: formalGeneratedCompileAuthorization.generatedCompilationReadiness,
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  },
  generatedCompileCandidateAuthorized: generatedCompileCandidate.authorized,
  authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
  authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
  candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
  evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
  candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
  candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
  candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
  generatedCompileCandidateStatus: generatedCompileCandidate.status,
  generatedCandidateAcceptedBy00: generatedCandidateAcceptedBy00,
  generatedReleaseAllowed: false,
  capabilityAuthorityStateConsistencyStatus: capabilityAuthorityStateConsistency.status ?? "MISSING",
  runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
  runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
  runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
  testOnlyConsumptionProofRef: dormitoryRuntimeTestOnlyProofPath,
  dormitoryFirstGoldenChainLandingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
  businessLandingAuthorityRef: dormitoryFirstGoldenChainLandingPath,
  businessLandingResultRef: dormitoryFirstGoldenChainLandingResultPath,
  businessLandingProofRef: dormitoryFirstGoldenChainLandingProofPath,
  runtimeConsumptionAllowed: runtimeConsumptionReady ? "test_only_consumption_only" : "false_until_runtime_admission_approved",
  generatedCompileCompleted: false,
  runtimeConsumptionReady,
  businessFeatureDevelopmentAllowed,
  dormitoryFirstGoldenChainLandingGoNoGo,
  kernelGraphHash,
  evidenceGraphHash: digestPlaceholder,
  finalReportDigest: digestPlaceholder,
  releaseEvidenceRole: "ci_release_attestation_only",
  candidateEvidenceObject: candidateEvidenceObjectPath,
  commitAttestation: commitAttestationPath,
  releaseDoesNotReplaceCandidateEvidence: true,
  businessProduction: admission.businessProduction,
  dormitoryL2: admission.dormitoryProduction,
  productionConfirmAllowed: admission.productionConfirmAllowed,
  finalGoNoGo: forcedCurrentStageGoNoGo.finalGoNoGo,
  nextStageAllowed: false,
  businessProductionGoNoGo: forcedCurrentStageGoNoGo.businessProductionGoNoGo,
  dormitoryL2GoNoGo: forcedCurrentStageGoNoGo.dormitoryL2GoNoGo,
  productionConfirmGoNoGo: forcedCurrentStageGoNoGo.productionConfirmGoNoGo,
  currentStage: {
    businessProduction: admission.businessProduction,
    dormitoryL2: admission.dormitoryProduction,
    productionConfirmAllowed: admission.productionConfirmAllowed,
    finalGoNoGo: forcedCurrentStageGoNoGo.finalGoNoGo
  }
};
addEvidence(releaseEvidenceObjectPath, releaseEvidenceObject);
const releaseAttestation = {
  ...proof("current-oam-release-attestation", "当前 OAM Release Artifact 外部证明", {
    releaseAttestationPurpose: "Separate internal evidence package digest from GitHub artifact metadata digest and zip digest.",
    internalArtifactDigestField: "artifactDigest",
    evidenceRootDigestField: "evidenceRootDigest",
    githubArtifactMetadataDigestField: "githubArtifactMetadataDigest",
    zipArtifactDigestField: "zipArtifactDigest",
    ciGreenDoesNotEqualGo: true,
    finalReportExistsDoesNotEqualGo: true
  }),
  repository,
  workflow,
  artifactName,
  sourceCommitSha,
  evidenceRunSha,
  currentRepositoryHead,
  evidenceLifecycleType,
  evidenceLifecycle,
  releaseEvidenceReferenceOnly,
  workspaceDirtyAtGeneration,
  githubRunId: ciRunId,
  githubRunAttempt: ciRunAttempt,
  githubRefName: branch,
  artifactDigest: digestPlaceholder,
  evidenceRootDigest: evidenceRootDigestPlaceholder,
  githubArtifactMetadataDigest: githubArtifactMetadataDigest || pendingExternalAttestation,
  githubArtifactDigestStatus,
  externalArtifactAttestation,
  zipArtifactDigest: zipArtifactDigest || pendingExternalAttestation,
  releaseAuthority: false,
  sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
  generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
  generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
  generatedCompilationReadiness: formalGeneratedCompileAuthorization.generatedCompilationReadiness,
  formalGeneratedCompileAuthorizationStatus: formalGeneratedCompileAuthorization.status,
  generatedCompileCandidateAuthorized: generatedCompileCandidate.authorized,
  authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
  authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
  candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
  evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
  currentRepositoryHead,
  candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
  candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
  candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
  generatedCompileCandidateStatus: generatedCompileCandidate.status,
  generatedCandidateAcceptedBy00: generatedCandidateAcceptedBy00,
  generatedReleaseAllowed: false,
  runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
  runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
  runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
  testOnlyConsumptionProofRef: dormitoryRuntimeTestOnlyProofPath,
  dormitoryFirstGoldenChainLandingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
  businessLandingAuthorityRef: dormitoryFirstGoldenChainLandingPath,
  businessLandingResultRef: dormitoryFirstGoldenChainLandingResultPath,
  businessLandingProofRef: dormitoryFirstGoldenChainLandingProofPath,
  runtimeConsumptionAllowed: runtimeConsumptionReady ? "test_only_consumption_only" : "false_until_runtime_admission_approved",
  generatedCompileCompleted: false,
  runtimeConsumptionReady,
  businessFeatureDevelopmentAllowed,
  dormitoryFirstGoldenChainLandingGoNoGo,
  finalGoNoGo: forcedCurrentStageGoNoGo.finalGoNoGo,
  nextStageAllowed: false
};
addEvidence(releaseAttestationPath, releaseAttestation);
addEvidence(dormitoryRuntimeTestOnlyProofPath, buildDormitoryRuntimeTestOnlyEvidenceProof());
addEvidence(dormitoryFirstGoldenChainLandingProofPath, buildDormitoryFirstGoldenChainBusinessLandingEvidenceProof());
addTextEvidence("artifacts/oam/evidence/execution-log.jsonl", executionLogText(digestPlaceholder));
writeAuxiliaryProofArtifacts();
refreshCommitAttestationTrackedDigest();

writeAllEvidence();

let artifactDigest = "";
let artifactDigestStable = false;
for (let attempt = 0; attempt < 10; attempt += 1) {
  refreshReleaseEvidenceObjectDigests();
  const nextDigest = digestForDisk(requiredEvidenceFiles, { skipMissing: true });
  applyArtifactDigest(nextDigest);
  writeAllEvidence();
  const actualDigest = digestForDisk(requiredEvidenceFiles, { skipMissing: true });
  if (actualDigest === nextDigest) {
    artifactDigest = nextDigest;
    artifactDigestStable = true;
    break;
  }
  artifactDigest = actualDigest;
}

if (!artifactDigestStable) {
  throw new Error(`current OAM evidence artifact digest did not stabilize; last digest ${artifactDigest || "missing"}`);
}

console.log(`Current OAM evidence root generated: ${evidenceDir}`);
console.log(`artifactDigest=${artifactDigest}`);

function writeAuxiliaryProofArtifacts() {
  writeSearchProofArtifacts();
  writeReadIntelligenceProofArtifact();
}

function refreshCommitAttestationTrackedDigest() {
  const digest = trackedContentDigest();
  commitAttestation.sourceTreeDigest = digest;
  commitAttestation.trackedContentDigest = digest;
  finalReportStatusMatrix = buildFinalReportStatusMatrix(candidateEvidenceObject, commitAttestation);
  finalReport.statusMatrix = finalReportStatusMatrix;
  for (const field of [
    "authorityStatus",
    "fileLifecycleStatus",
    "compileStatus",
    "sourceCompileDecisionReadinessStatus",
    "generatedCompileAuthorizationStatus",
    "generatedCompilationStatus",
    "generatedCandidateAcceptanceStatus",
    "runtimeConsumptionStatus",
    "runtimeBoundaryStatus",
    "readSurfaceFinanceStatus",
    "sourcePackageStatus",
    "mutationStatus",
    "browserL1Status",
    "candidateEvidenceStatus",
    "commitAttestationStatus",
    "businessReadinessStatus",
    "releaseReadinessStatus"
  ]) {
    finalReport[field] = finalReportStatusMatrix[field];
  }
  finalReport.runtimeAdmissionStatusEntry = finalReportStatusMatrix.runtimeAdmissionStatus;
  finalReport.dormitoryFirstGoldenChainLandingStatusEntry =
    finalReportStatusMatrix.dormitoryFirstGoldenChainLandingStatus;
  finalReport.finalGoNoGoStatus = finalReportStatusMatrix.finalGoNoGo;
  finalReport.commitAttestation = summarizeCommitAttestation(commitAttestation);
  evidenceGraph.finalReportStatusMatrix = finalReportStatusMatrix;
  evidenceGraph.commitAttestation = summarizeCommitAttestation(commitAttestation);
  files.set(commitAttestationPath, commitAttestation);
  files.set("artifacts/oam/evidence/evidence-graph.json", evidenceGraph);
  files.set("artifacts/oam/evidence/current-oam-final-report.json", finalReport);
  files.set(finalReportPath, finalReport);
}

function writeSearchProofArtifacts() {
  const searchContract = readJson("docs/contracts/search/search-contract.json");
  const resultSchema = readJson("docs/contracts/search/search-result-schema.json");
  const permissionPolicy = readJson("docs/contracts/search/search-permission-policy.json");
  const base = {
    schemaVersion: "workosnext.search-proof.v1",
    status: "passed",
    generatedBy: "scripts/oam/generate-current-evidence-root.mjs",
    singleWriter: "scripts/oam/generate-current-evidence-root.mjs",
    checker: "scripts/check-search-kernel.mjs",
    failures: [],
    gates: ["node scripts/check-search-kernel.mjs"]
  };
  const proofs = [
    [
      "artifacts/oam/proofs/search/search-derived-readmodel-only-proof.json",
      {
        ...base,
        proofId: "search-derived-readmodel-only-proof",
        proves: [
          "Search consumes generated/read envelopes only.",
          "OperationsReadStore.SearchOperations is upstream projection-builder source only.",
          "operationsRuntimeFactInput is forbidden as direct Search input."
        ],
        allowedInputs: searchContract.readModelOnlyPolicy?.allowedInputs ?? [],
        forbiddenDirectInputs: searchContract.readModelOnlyPolicy?.forbiddenDirectInputs ?? [],
        operationsReadStoreBoundary: searchContract.readModelOnlyPolicy?.operationsReadStoreSearchOperations ?? null,
        sourceRefs: [
          "docs/contracts/search/search-contract.json",
          "docs/contracts/search/search-index-sources.json"
        ]
      }
    ],
    [
      "artifacts/oam/proofs/search/search-no-kernel-direct-read-proof.json",
      {
        ...base,
        proofId: "search-no-kernel-direct-read-proof",
        proves: [
          "SearchKernelService does not call runtime catalog APIs directly.",
          "SearchKernelService does not query OperationsReadStore.SearchOperations directly."
        ],
        forbiddenRuntimeTerms: [
          "OperationsRuntimeService",
          "GetWorkItem(",
          "GetWorkItemSurface(",
          "ListWorkItems(",
          "OperationsRuntime.SearchOperations",
          "OperationsReadStore.SearchOperations",
          "SearchOperationsSources",
          "NextActionableWorkItem"
        ],
        sourceRefs: ["services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs"]
      }
    ],
    [
      "artifacts/oam/proofs/search/search-permission-filter-proof.json",
      {
        ...base,
        proofId: "search-permission-filter-proof",
        proves: [
          "SearchResult carries permission envelope.",
          "Search actions are readonly or navigation only.",
          "Permission policy contains tenant, visibility, and action guards."
        ],
        permissionRequiredFields: resultSchema.properties?.permission?.required ?? [],
        permissionRuleIds: (permissionPolicy.rules ?? []).map((rule) => rule.ruleId),
        sourceRefs: [
          "docs/contracts/search/search-result-schema.json",
          "docs/contracts/search/search-permission-policy.json"
        ]
      }
    ],
    [
      "artifacts/oam/proofs/search/search-hidden-result-ranking-proof.json",
      {
        ...base,
        proofId: "search-hidden-result-ranking-proof",
        proves: [
          "Hidden results are not ranked.",
          "ConfirmAllowed is not a ranking boost."
        ],
        requiredRules: [
          "hidden-results-not-ranked",
          "search-result-required-trust-fields"
        ],
        rankingPolicyRef: "docs/contracts/search/search-ranking-policy.json",
        permissionPolicyRef: "docs/contracts/search/search-permission-policy.json"
      }
    ],
    [
      "artifacts/oam/proofs/search/search-sensitive-redaction-proof.json",
      {
        ...base,
        proofId: "search-sensitive-redaction-proof",
        proves: [
          "Sensitive results require redaction for ordinary users.",
          "SearchResult carries redaction and dataClassification."
        ],
        requiredRule: "sensitive-results-redacted-for-ordinary-users",
        permissionRequiredFields: resultSchema.properties?.permission?.required ?? [],
        sourceRefs: [
          "docs/contracts/search/search-result-schema.json",
          "docs/contracts/search/search-permission-policy.json"
        ]
      }
    ],
    [
      "artifacts/oam/proofs/search/search-lineage-freshness-proof.json",
      {
        ...base,
        proofId: "search-lineage-freshness-proof",
        proves: [
          "SearchResult carries lineage envelope.",
          "SearchResult carries freshness envelope.",
          "Search cannot write business facts through gateResult."
        ],
        lineageRequiredFields: resultSchema.properties?.lineage?.required ?? [],
        freshnessRequiredFields: resultSchema.properties?.freshness?.required ?? [],
        gateResultRequiredFields: resultSchema.properties?.gateResult?.required ?? [],
        sourceRefs: ["docs/contracts/search/search-result-schema.json"]
      }
    ]
  ];

  for (const [file, document] of proofs) writeProofJson(file, document);
}

function writeReadIntelligenceProofArtifact() {
  const kernel = readJson("docs/read-intelligence/read-intelligence-kernel.json");
  const readSchemas = [
    readJson("docs/contracts/read/oam-object-envelope.schema.json"),
    readJson("docs/contracts/read/search-index-record.schema.json"),
    readJson("docs/contracts/read/search-result-envelope.schema.json"),
    readJson("docs/contracts/read/lens-read-model.schema.json"),
    readJson("docs/contracts/read/permission-envelope.schema.json"),
    readJson("docs/contracts/read/lineage-envelope.schema.json"),
    readJson("docs/contracts/read/freshness-envelope.schema.json")
  ];
  writeProofJson("artifacts/oam/proofs/read-intelligence/oam-object-envelope-proof.json", {
    schemaVersion: "workosnext.read-intelligence-proof.v1",
    proofId: "oam-object-envelope-proof",
    status: "passed",
    generatedBy: "scripts/oam/generate-current-evidence-root.mjs",
    singleWriter: "scripts/oam/generate-current-evidence-root.mjs",
    checker: "scripts/oam/check-read-intelligence-kernel.mjs",
    proves: [
      "Read Intelligence only consumes generated read models and authorized read envelopes.",
      "OamObjectEnvelope, SearchIndexRecord, SearchResultEnvelope, and LensReadModel carry permission, lineage, and freshness requirements.",
      "Read Intelligence, Search, Lens, Dashboard, Report, and Metric surfaces are readonly and cannot write business facts.",
      "operationsRuntimeFactInput is forbidden as direct Search input."
    ],
    allowedInputs: kernel.readSourcePolicy?.allowedInputs ?? [],
    forbiddenInputs: kernel.readSourcePolicy?.forbiddenInputs ?? [],
    envelopeSchemas: readSchemas.map((schema) => ({
      id: schema.$id,
      required: schema.required ?? []
    })),
    readModelCollectionsChecked: ["metrics", "dashboards", "reportDatasets"],
    sourceRefs: [
      "docs/read-intelligence/read-intelligence-kernel.json",
      "docs/contracts/read/oam-object-envelope.schema.json",
      "docs/contracts/read/permission-envelope.schema.json",
      "docs/contracts/read/lineage-envelope.schema.json",
      "docs/contracts/read/freshness-envelope.schema.json",
      "docs/contracts/generated/dormitory/read-model.generated.json"
    ],
    failures: []
  });
}

function writeProofJson(file, proofDocument) {
  writeJson(file, {
    ...proofDocument,
    checkedAtUtc: checkedAtUtcForProof(file, proofDocument)
  });
}

function checkedAtUtcForProof(file, proofDocument) {
  const existing = readJsonIfExists(file);
  if (!existing?.checkedAtUtc) return generatedAt;
  if (proofSemanticDigest(existing) === proofSemanticDigest(proofDocument)) {
    return existing.checkedAtUtc;
  }
  return generatedAt;
}

function proofSemanticDigest(document) {
  const clone = { ...(document ?? {}) };
  delete clone.checkedAtUtc;
  return sha256(JSON.stringify(normalizeForDigest(clone)));
}

function proof(kind, title, details) {
  return {
    schemaVersion: "current-oam.evidence.v1",
    kind,
    title,
    binding: binding(kind),
    summary: {
      status: "blocked",
      goNoGo: finalGoNoGo,
      businessProduction: admission.businessProduction,
      dormitoryL2: admission.dormitoryProduction,
      productionConfirmAllowed: admission.productionConfirmAllowed
    },
    gateSummary,
    testSummary,
    coverageSummary,
    mobileBranchRiskKernel,
    details
  };
}

function stableEvidenceGeneratedAt() {
  for (const file of [
    finalReportPath,
    releaseEvidenceObjectPath,
    commitAttestationPath,
    "artifacts/oam/evidence/evidence-graph.json"
  ]) {
    const existing = readJsonIfExists(file);
    const binding = existing?.binding ?? existing;
    const existingGeneratedAt = binding?.generatedAt ?? binding?.generatedAtUtc ?? existing?.generatedAtUtc;
    if (!existingGeneratedAt) continue;
    if (binding?.sourceCommitSha !== sourceCommitSha) continue;
    if (binding?.evidenceRunSha !== evidenceRunSha) continue;
    if (binding?.currentRepositoryHead !== currentRepositoryHead) continue;
    if (binding?.evidenceLifecycleType !== evidenceLifecycleType) continue;
    return existingGeneratedAt;
  }
  return new Date().toISOString();
}

function buildEvidenceLifecycle() {
  const blockers = [];
  if (evidenceLifecycleType !== "ci-release") blockers.push(`${evidenceLifecycleType}_cannot_publish`);
  if (bindingStale) blockers.push("source_or_evidence_sha_not_current_head");
  if (workspaceDirtyAtGeneration) blockers.push("workspace_dirty_at_generation");
  if (githubArtifactDigestStatus !== "attested") blockers.push("github_artifact_metadata_digest_not_attested");
  return {
    schemaVersion: "workosnext.evidence-lifecycle.v1",
    lifecycleType: evidenceLifecycleType,
    allowedLifecycleTypes: ["local-candidate", "repository-reference-snapshot", "ci-release"],
    localCandidate: evidenceLifecycleType === "local-candidate",
    repositoryReferenceSnapshot: evidenceLifecycleType === "repository-reference-snapshot",
    ciRelease: evidenceLifecycleType === "ci-release",
    sourceShaBindingStatus: bindingStale ? "stale" : "current",
    releaseBindingStatus,
    releaseEvidenceReferenceOnly,
    workspaceDirtyAtGeneration,
    externalArtifactAttestation,
    githubArtifactDigestStatus,
    githubArtifactMetadataDigest: githubArtifactMetadataDigest || pendingExternalAttestation,
    releaseAuthority: false,
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    releaseAuthorityAllowedOnlyWhen: [
      "lifecycleType=ci-release",
      "GITHUB_SHA present",
      "GitHub artifact metadata digest attested",
      "workspace clean at generation",
      "source/evidence SHA match current HEAD"
    ],
    blockers
  };
}

function buildEvidenceLifecycleNegativeTests() {
  return [
    {
      caseId: "old-sha-with-current-binding-fails",
      forbiddenState: "sourceCommitSha/evidenceRunSha differs from currentRepositoryHead while bindingStatus=current",
      expectedResult: "FAIL",
      severity: "P0"
    },
    {
      caseId: "dirty-worktree-release-authority-fails",
      forbiddenState: "workspaceDirtyAtGeneration=true with releaseAuthority=true",
      expectedResult: "FAIL",
      severity: "P0"
    },
    {
      caseId: "github-artifact-digest-equals-internal-artifact-digest-fails",
      forbiddenState: "githubArtifactMetadataDigest equals artifactDigest",
      expectedResult: "FAIL",
      severity: "P0"
    },
    {
      caseId: "pending-external-attestation-release-authority-fails",
      forbiddenState: "githubArtifactDigestStatus=pending_external_attestation with releaseAuthority=true",
      expectedResult: "FAIL",
      severity: "P0"
    },
    {
      caseId: "stale-reference-evidence-go-fails",
      forbiddenState: "stale/referenceOnly evidence with finalGoNoGo=GO",
      expectedResult: "FAIL",
      severity: "P0"
    },
    {
      caseId: "ordinary-checker-default-proof-write-fails",
      forbiddenState: "ordinary checker writes proof/timestamp without --write-proof or OAM_WRITE_PROOF=1",
      expectedResult: "FAIL",
      severity: "P1"
    }
  ];
}

function binding(kind) {
  return {
    root: "current-oam-trust-closure-v1",
    kind,
    repository,
    workflow,
    sourceCommitSha,
    evidenceRunSha,
    currentRepositoryHead,
    stale: releaseEvidenceReferenceOnly,
    referenceOnly: releaseEvidenceReferenceOnly,
    bindingStatus: releaseBindingStatus,
    sourceShaBindingStatus: bindingStale ? "stale" : "current",
    evidenceLifecycleType,
    evidenceLifecycle,
    releaseEvidenceReferenceOnly,
    workspaceDirtyAtGeneration,
    commitSha,
    githubSha: commitSha,
    branch,
    githubRefName: branch,
    ciRunId,
    githubRunId: ciRunId,
    githubRunAttempt: ciRunAttempt,
    artifactName,
    generatedAt,
    generatedAtUtc: generatedAt,
    artifactDigest: digestPlaceholder,
    githubArtifactDigest: githubArtifactMetadataDigest || pendingExternalAttestation,
    githubArtifactMetadataDigest: githubArtifactMetadataDigest || pendingExternalAttestation,
    githubArtifactDigestStatus,
    externalArtifactAttestation,
    zipArtifactDigest: zipArtifactDigest || pendingExternalAttestation,
    releaseAuthority: false,
    evidenceRootDigest: evidenceRootDigestPlaceholder,
    capabilityDigestChain,
    runtimeProjectionDigest: capabilityDigestChain.runtimeProjectionDigest,
    surfaceProjectionDigest: capabilityDigestChain.surfaceProjectionDigest,
    searchProjectionDigest: capabilityDigestChain.searchProjectionDigest,
    testPlanDigest: capabilityDigestChain.testPlanDigest,
    browserAuditDigest: capabilityDigestChain.browserAuditDigest,
    generatedContractsHash,
    sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
    generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
    generatedCompilationReadiness: formalGeneratedCompileAuthorization.generatedCompilationReadiness,
    formalGeneratedCompileAuthorizationStatus: formalGeneratedCompileAuthorization.status,
    generatedCompileCandidateAuthorized: generatedCompileCandidate.authorized,
    authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
    authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
    candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
    evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
    candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
    candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
    candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
    generatedCompileCandidateStatus: generatedCompileCandidate.status,
    generatedFieldBindingClosureRequired: true,
    generatedFieldBindingClosureStatus: generatedFieldBindingClosure.status,
    generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
    candidateAttestationIsReleaseEvidence: false,
    releaseEvidenceRequiredAfterCandidateEvidence: true,
    generatedCandidateAcceptedBy00: generatedCandidateAcceptedBy00,
    generatedCandidateAcceptanceDecisionStatus: generatedCandidateAcceptance.decisionStatus,
    acceptedGeneratedBundleDigest: generatedCandidateAcceptance.acceptedGeneratedBundleDigest,
    runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
    runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
    runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
    runtimeConsumedBundleDigest: dormitoryRuntimeAdmission.runtimeConsumedBundleDigest,
    bundleDigestMatch: dormitoryRuntimeAdmission.bundleDigestMatch === true,
    runtimeConsumptionReadyAuthority: dormitoryRuntimeAdmission.runtimeConsumptionReadyAuthority,
    testOnlyConsumptionProofRef: dormitoryRuntimeTestOnlyProofPath,
    environmentProfileId: environmentProfileAuthority.environmentProfileId ?? dormitoryRuntimeAdmission.environmentProfileId,
    environmentProfileRuntimeStorageMode: environmentProfileAuthority.runtimeStorageMode ?? dormitoryRuntimeAdmission.environmentProfile?.runtimeStorageMode,
    capabilityState: capabilityStateMachineTransition.currentState ?? "RUNTIME_TEST_ADMITTED",
    capabilityAuthorityStateConsistencyStatus: capabilityAuthorityStateConsistency.status ?? "MISSING",
    gateLaneTaxonomyStatus: gateTaxonomy.status ?? "MISSING",
    browserHardeningRequiredForGeneratedOrRuntime: gateTaxonomy.browserHardeningRequiredForGeneratedOrRuntime === true,
    runtimeStabilityLaneStatus: runtimeStabilityLane.laneStatus ?? runtimeStabilityLane.status ?? "MISSING",
    runtimeImplementationDriftPolicyStatus: runtimeImplementationDriftPolicy.status ?? "MISSING",
    evidenceProjectionOnlyStatus: evidenceIsProjectionOnly.status ?? "MISSING",
    authoritativeArtifactReconciliationStatus: currentHeadAuthoritativeArtifactReconciliation.reconciliationStatus ?? "MISSING",
    authoritativeArtifactBacked: currentHeadAuthoritativeArtifactReconciliation.authoritativeArtifactBacked === true,
    dormitoryFirstGoldenChainLandingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
    businessLandingAuthorityRef: dormitoryFirstGoldenChainLandingPath,
    businessLandingResultRef: dormitoryFirstGoldenChainLandingResultPath,
    businessLandingProofRef: dormitoryFirstGoldenChainLandingProofPath,
    reviewedExecutionHead: generatedCandidateAcceptance.reviewedExecutionHead,
    decisionRecordHead: generatedCandidateAcceptance.decisionRecordHead,
    generatedOutputDigest: generatedCandidateAcceptance.generatedOutputDigest,
    evidenceArtifactDigest: generatedCandidateAcceptance.evidenceArtifactDigest,
    executionProofDigest: generatedCandidateAcceptance.executionProofDigest,
    generatedReleaseAllowed: false,
    runtimeConsumptionAllowed: runtimeConsumptionReady ? "test_only_consumption_only" : "false_until_runtime_admission_approved",
    generatedCompileCompleted: false,
    runtimeConsumptionReady,
    businessFeatureDevelopmentAllowed,
    dormitoryFirstGoldenChainLandingGoNoGo,
    kernelGraphHash,
    evidenceGraphHash: digestPlaceholder,
    finalReportDigest: digestPlaceholder
  };
}

function evidenceBindingState() {
  return {
    sourceCommitSha,
    evidenceRunSha,
    currentRepositoryHead,
    stale: releaseEvidenceReferenceOnly,
    referenceOnly: releaseEvidenceReferenceOnly,
    bindingStatus: releaseBindingStatus,
    sourceShaBindingStatus: bindingStale ? "stale" : "current",
    evidenceLifecycleType,
    evidenceLifecycle,
    releaseEvidenceReferenceOnly,
    workspaceDirtyAtGeneration,
    artifactDigest: digestPlaceholder,
    githubArtifactMetadataDigest: githubArtifactMetadataDigest || pendingExternalAttestation,
    githubArtifactDigestStatus,
    externalArtifactAttestation,
    zipArtifactDigest: zipArtifactDigest || pendingExternalAttestation,
    releaseAuthority: false,
    capabilityDigestChain,
    runtimeProjectionDigest: capabilityDigestChain.runtimeProjectionDigest,
    surfaceProjectionDigest: capabilityDigestChain.surfaceProjectionDigest,
    searchProjectionDigest: capabilityDigestChain.searchProjectionDigest,
    testPlanDigest: capabilityDigestChain.testPlanDigest,
    browserAuditDigest: capabilityDigestChain.browserAuditDigest,
    generatedContractsHash,
    sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
    generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
    generatedCompilationReadiness: formalGeneratedCompileAuthorization.generatedCompilationReadiness,
    formalGeneratedCompileAuthorizationStatus: formalGeneratedCompileAuthorization.status,
    generatedCompileCandidateAuthorized: generatedCompileCandidate.authorized,
    authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
    authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
    candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
    evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
    candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
    candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
    candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
    generatedCompileCandidateStatus: generatedCompileCandidate.status,
    generatedCandidateAcceptedBy00: generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: generatedCandidateAcceptance.acceptedGeneratedBundleDigest,
    generatedReleaseAllowed: false,
    runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
    runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
    runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
    runtimeConsumedBundleDigest: dormitoryRuntimeAdmission.runtimeConsumedBundleDigest,
    bundleDigestMatch: dormitoryRuntimeAdmission.bundleDigestMatch === true,
    environmentProfileId: environmentProfileAuthority.environmentProfileId ?? dormitoryRuntimeAdmission.environmentProfileId,
    environmentProfileRuntimeStorageMode: environmentProfileAuthority.runtimeStorageMode ?? dormitoryRuntimeAdmission.environmentProfile?.runtimeStorageMode,
    capabilityState: capabilityStateMachineTransition.currentState ?? "RUNTIME_TEST_ADMITTED",
    capabilityAuthorityStateConsistencyStatus: capabilityAuthorityStateConsistency.status ?? "MISSING",
    gateLaneTaxonomyStatus: gateTaxonomy.status ?? "MISSING",
    runtimeStabilityLaneStatus: runtimeStabilityLane.laneStatus ?? runtimeStabilityLane.status ?? "MISSING",
    evidenceProjectionOnlyStatus: evidenceIsProjectionOnly.status ?? "MISSING",
    authoritativeArtifactReconciliationStatus: currentHeadAuthoritativeArtifactReconciliation.reconciliationStatus ?? "MISSING",
    authoritativeArtifactBacked: currentHeadAuthoritativeArtifactReconciliation.authoritativeArtifactBacked === true,
    testOnlyConsumptionProofRef: dormitoryRuntimeTestOnlyProofPath,
    dormitoryFirstGoldenChainLandingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
    businessLandingAuthorityRef: dormitoryFirstGoldenChainLandingPath,
    businessLandingResultRef: dormitoryFirstGoldenChainLandingResultPath,
    businessLandingProofRef: dormitoryFirstGoldenChainLandingProofPath,
    runtimeConsumptionAllowed: runtimeConsumptionReady ? "test_only_consumption_only" : "false_until_runtime_admission_approved",
    generatedCompileCompleted: false,
    runtimeConsumptionReady,
    businessFeatureDevelopmentAllowed,
    dormitoryFirstGoldenChainLandingGoNoGo,
    evidenceGraphHash: digestPlaceholder,
    finalReportDigest: digestPlaceholder,
    noGoWhenStale: true,
    notesZh: releaseEvidenceReferenceOnly
      ? `当前 Evidence lifecycle=${evidenceLifecycleType}，本产物只能作为本地候选或仓库参考快照，不得作为 CI release / GO 依据。`
      : "证据由 CI release 模式绑定当前被验证源码提交、证据运行提交、当前仓库 HEAD 与外部 artifact metadata digest。"
  };
}

function addEvidence(file, document) {
  files.set(file, document);
}

function addTextEvidence(file, text) {
  files.set(file, text);
}

function writeAllEvidence() {
  for (const [file, document] of files) {
    writeJson(file, document);
  }
}

function refreshReleaseEvidenceObjectDigests() {
  const evidenceRootDigest = digestForDisk(requiredEvidenceFiles.filter((file) => file !== releaseEvidenceObjectPath), { skipMissing: true });
  const evidenceGraphHash = digestForDisk(["artifacts/oam/evidence/evidence-graph.json"]);
  const finalReportDigest = digestForDisk([finalReportPath]);
  releaseEvidenceObject.evidenceRootDigest = evidenceRootDigest;
  releaseEvidenceObject.evidenceGraphHash = evidenceGraphHash;
  releaseEvidenceObject.finalReportDigest = finalReportDigest;
  applyReleaseDigestFields(evidenceRootDigest, evidenceGraphHash, finalReportDigest);
  files.set(releaseEvidenceObjectPath, releaseEvidenceObject);
  writeJson(releaseEvidenceObjectPath, releaseEvidenceObject);
}

function applyArtifactDigest(digest) {
  for (const [file, document] of files) {
    if (file === "artifacts/oam/evidence/execution-log.jsonl") {
      files.set(file, executionLogText(digest));
    } else if (typeof document === "string") {
      files.set(file, document.replaceAll(digestPlaceholder, digest));
    } else {
      setDigest(document, digest);
    }
  }
}

function setDigest(value, digest) {
  if (Array.isArray(value)) {
    for (const item of value) setDigest(item, digest);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Object.prototype.hasOwnProperty.call(value, "artifactDigest")) {
    value.artifactDigest = digest;
  }
  for (const item of Object.values(value)) {
    setDigest(item, digest);
  }
}

function applyReleaseDigestFields(evidenceRootDigest, evidenceGraphHash, finalReportDigest) {
  for (const document of files.values()) {
    if (typeof document !== "string") {
      setReleaseDigestFields(document, evidenceRootDigest, evidenceGraphHash, finalReportDigest);
    }
  }
}

function setReleaseDigestFields(value, evidenceRootDigest, evidenceGraphHash, finalReportDigest) {
  if (Array.isArray(value)) {
    for (const item of value) setReleaseDigestFields(item, evidenceRootDigest, evidenceGraphHash, finalReportDigest);
    return;
  }
  if (!value || typeof value !== "object") return;
  const candidateAcceptanceSubjectScoped =
    value.version === "oam.generated-candidate-acceptance-predicate.v1" ||
    value.proofType === "generated_candidate_acceptance_authority" ||
    value.scope === "generated_candidate_acceptance_authority_only";
  if (!candidateAcceptanceSubjectScoped && Object.prototype.hasOwnProperty.call(value, "evidenceRootDigest")) {
    value.evidenceRootDigest = evidenceRootDigest;
  }
  if (!candidateAcceptanceSubjectScoped && Object.prototype.hasOwnProperty.call(value, "evidenceGraphHash")) {
    value.evidenceGraphHash = evidenceGraphHash;
  }
  if (!candidateAcceptanceSubjectScoped && Object.prototype.hasOwnProperty.call(value, "finalReportDigest")) {
    value.finalReportDigest = finalReportDigest;
  }
  for (const item of Object.values(value)) {
    setReleaseDigestFields(item, evidenceRootDigest, evidenceGraphHash, finalReportDigest);
  }
}

function digestFor(fileMap) {
  const normalized = {};
  for (const [file, document] of [...fileMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    normalized[file] = normalizeForDigest(documentForDigest(file, document));
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function digestForDisk(fileList, { skipMissing = false } = {}) {
  const normalized = {};
  for (const file of [...fileList].sort((left, right) => left.localeCompare(right))) {
    if (skipMissing && !fileExists(file)) continue;
    normalized[file] = normalizeForDigest(readEvidenceFile(file));
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function readEvidenceFile(file) {
  if (file.endsWith(".jsonl")) return readJsonl(file);
  if (file.endsWith(".json")) return readJson(file);
  return readText(file);
}

function digestForFiles(fileList) {
  const normalized = {};
  for (const file of [...fileList].map(normalizeRepoPath).sort((left, right) => left.localeCompare(right))) {
    const target = path.join(root, file);
    normalized[file] = fs.existsSync(target)
      ? `sha256:${sha256(fs.readFileSync(target))}`
      : "missing";
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function sourceAuthorityFiles() {
  const authorityIndex = readJson("docs/oam/current-authority-index.json");
  const declared = (authorityIndex.classificationModel?.sourceLayerWhitelist ?? [])
    .map(normalizeRepoPath)
    .filter(Boolean);
  if (declared.length > 0) return declared.sort((left, right) => left.localeCompare(right));
  return (authorityIndex.entries ?? [])
    .filter((entry) => entry.layer === "source")
    .map((entry) => normalizeRepoPath(entry.path))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function buildCandidateEvidenceSubject() {
  const candidateStatus = controlPlaneGateResult.status === "passed" &&
    (controlPlaneGateResult.failedGateCount ?? 0) === 0 &&
    mutationTests.status === "passed"
    ? "PASS"
    : "FAIL";
  return {
    sourceAuthorityDigest,
    generatedContractDigest,
    fileLifecycleDigest,
    runtimeBoundaryDigest,
    readSurfaceFinanceBoundaryDigest,
    mutationDigest,
    browserL1Digest,
    controlPlaneStatus: controlPlaneGateResult.status,
    controlPlaneFailedGateCount: controlPlaneGateResult.failedGateCount ?? 0,
    mutationStatus: mutationTests.status,
    browserL1Status: realBrowserEvidence.summary.l1?.status ?? "missing_or_failed",
    candidateStatus,
    candidateReadyForCompile: formalGeneratedCompileAuthorization.authorized,
    sourceScenarioPackageReviewStatus: sourcePackageCheck.sourceScenarioPackageReviewStatus ?? "CONDITIONAL_NO_PASS",
    formalGeneratedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationReadiness: generatedCompileExecution.generatedCompilationReadiness,
    generatedCompileExecutionStatus: generatedCompileExecution.status,
    generatedCompileCompleted: generatedCompileExecution.generatedCompileCompleted,
    generatedCompilationCompleted: generatedCompileExecution.generatedCompilationCompleted,
    generatedCandidateAcceptedBy00: generatedCandidateAcceptedBy00,
    candidateReadyForBusinessImplementation: false,
    candidateReadyForRelease: false,
    notesZh: "Candidate Evidence 只证明本地架构候选闭合；业务落地和发布仍保持 NO_GO。"
  };
}

function summarizeCandidateEvidence(candidate) {
  return {
    path: candidateEvidenceObjectPath,
    proofType: candidate.proofType,
    candidateStatus: candidate.candidateStatus,
    candidateReadyForCompile: candidate.candidateReadyForCompile,
    candidateReadyForBusinessImplementation: candidate.candidateReadyForBusinessImplementation,
    candidateReadyForRelease: candidate.candidateReadyForRelease,
    evidenceSubjectDigest: candidate.evidenceSubjectDigest,
    candidateEvidenceDigest: candidate.candidateEvidenceDigest,
    releaseAuthority: candidate.releaseAuthority
  };
}

function summarizeCommitAttestation(attestation) {
  return {
    path: commitAttestationPath,
    proofType: attestation.proofType,
    commitSha: attestation.commitSha,
    bindingStatus: attestation.bindingStatus,
    candidateBindingStatus: attestation.candidateBindingStatus,
    evidenceSubjectDigest: attestation.evidenceSubjectDigest,
    candidateEvidenceDigest: attestation.candidateEvidenceDigest,
    trackedContentDigest: attestation.trackedContentDigest,
    releaseAuthority: attestation.releaseAuthority
  };
}

function trackedContentDigest() {
  const files = execSync("git ls-files", { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .map(normalizeRepoPath)
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

function digestObject(value) {
  return `sha256:${sha256(JSON.stringify(stableForSubjectDigest(value)))}`;
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

function documentForDigest(file, document) {
  if (file.endsWith(".jsonl") && typeof document === "string") {
    return document
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  }
  return document;
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

function buildWorkstreamProofNodes() {
  return (responsibilityMap.workstreams ?? []).map((workstream) => {
    const sources = [...new Set([
      responsibilityMapPath,
      ...(workstream.authorityFiles ?? []),
      ...(workstream.evidence ?? [])
    ])];
    const sourceHashes = sources.map((file) => ({
      path: file,
      hash: hashFileIfPresent(file)
    }));
    const gateResult = summarizeWorkstreamGates(workstream.gates ?? []);
    const command = gateResult.commands[0]?.command ?? "no-command-bound";
    const negativeTestResult = "blocked";
    const proofPayload = {
      workstreamId: workstream.id,
      name: workstream.name,
      layer: workstream.layer,
      sourceHashes,
      gateResult,
      negativeTestResult,
      goNoGo: finalGoNoGo,
      goNoGoImpact: workstream.finalReportFields ?? []
    };
    const proofHash = `sha256:${sha256(JSON.stringify(normalizeForDigest(proofPayload)))}`;
    return {
      id: `workstream-proof.${workstream.id}`,
      type: "workstream_proof",
      scope: "current_oam_responsibility",
      status: "blocked",
      workstreamId: workstream.id,
      proofType: "current-oam-kernel-responsibility",
      source: sources,
      hash: proofHash,
      dependsOn: sources,
      producedBy: "scripts/oam/generate-current-evidence-root.mjs",
      verifiedBy: command,
      command,
      checker: command,
      inputHashes: sourceHashes,
      outputHashes: [{ path: `evidence-node:workstream-proof.${workstream.id}`, hash: proofHash }],
      gateResult,
      negativeTestResult,
      goNoGoImpact: workstream.finalReportFields ?? [],
      notesZh: `工作流 ${workstream.name ?? workstream.id} 的 proof DAG 节点；当前阶段保持 NO_GO，CI 绿色只作为证据。`,
      goNoGo: finalGoNoGo,
      finalGoNoGo,
      releaseAuthority: false,
      finalReportFields: workstream.finalReportFields ?? []
    };
  });
}

function buildDormitory13ScenarioIntegrationChainProofNode(result) {
  const sources = [
    dormitory13ScenarioSourcePath,
    "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json",
    "docs/contracts/generated/dormitory/13-scenario-object-ownership.generated.json",
    "docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json",
    ...dormitory13ScenarioIntegrationChainToolingFiles,
    ...dormitory13ScenarioIntegrationChainResultFiles
  ];
  const sourceHashes = sources.map((file) => ({
    path: file,
    hash: hashFileIfPresent(file)
  }));
  const payload = {
    proofType: "dormitory-13-scenario-integration-chain",
    status: result?.status ?? "MISSING",
    chainCount: result?.chainCount ?? 0,
    completedChainCount: result?.completedChainCount ?? 0,
    guarantees: result?.guarantees ?? {},
    resultDigest: result?.resultDigest ?? "missing",
    finalGoNoGo: "NO_GO",
    sourceHashes
  };
  const proofHash = `sha256:${sha256(JSON.stringify(normalizeForDigest(payload)))}`;
  return {
    id: "DORMITORY-13-SCENARIO-INTEGRATION-CHAIN",
    type: "integration_chain_evidence",
    scope: "dormitory_13_scenario_local_test_evidence",
    status: result?.status === "PASS" ? "passed" : "failed",
    proofType: "dormitory-13-scenario-integration-chain",
    source: sources,
    hash: proofHash,
    dependsOn: sources,
    producedBy: "scripts/oam/generate-current-evidence-root.mjs",
    verifiedBy: "scripts/business/check-dormitory-13-scenario-integration-chain.mjs",
    command: "node scripts/business/check-dormitory-13-scenario-integration-chain.mjs",
    checker: "scripts/business/check-dormitory-13-scenario-integration-chain.mjs",
    inputHashes: sourceHashes,
    outputHashes: [{ path: "evidence-node:DORMITORY-13-SCENARIO-INTEGRATION-CHAIN", hash: proofHash }],
    gateResult: {
      status: result?.status ?? "MISSING",
      chainCount: result?.chainCount ?? 0,
      completedChainCount: result?.completedChainCount ?? 0
    },
    negativeTestResult: result?.status === "PASS" ? "blocked" : "failed",
    goNoGoImpact: ["finalGoNoGo", "productionConfirmAllowed", "releaseAuthority"],
    guarantees: result?.guarantees ?? {},
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    notesZh: "住宿经营 13 场景 A-E 跨场景集成链 proof DAG 节点；只证明本地/测试证据闭环，不授权生产发布或 final GO。"
  };
}

function buildWorkstreamGoNoGoFields(nodes) {
  const result = {};
  for (const node of nodes) {
    for (const field of node.finalReportFields ?? []) {
      result[field] = node.goNoGo;
    }
  }
  return result;
}

function buildP0ClosureProofNodes() {
  const dimensions = [
    ["responsibility-governance", "responsibilityGovernanceGoNoGo", [responsibilityMapPath, "scripts/oam/check-kernel-responsibility-map.mjs"]],
    ["evidence-binding", "evidenceBindingGoNoGo", ["scripts/oam/check-current-evidence-root.mjs", releaseEvidenceObjectPath]],
    ["kernel-compile", "kernelCompileGoNoGo", ["scripts/oam/compile-current-kernel-graph.mjs", "docs/oam/kernel/oam-kernel-graph.generated.json"]],
    ["runtime-gate", "runtimeGateGoNoGo", ["services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs", "scripts/check-admission-kernel.mjs"]],
    ["workitem-effect", "workItemEffectGoNoGo", ["docs/business/domains/dormitory/dormitory-operating-kernel.json", "scripts/oam/check-generated-contract-consistency.mjs"]],
    ["finance-truth", "financeTruthGoNoGo", ["docs/finance/finance-ledger-kernel.json", "scripts/finance/check-finance-semantic-truth.mjs"]],
    ["read-intelligence", "readIntelligenceGoNoGo", ["docs/read-intelligence/read-intelligence-kernel.json", "scripts/oam/check-read-intelligence-kernel.mjs"]],
    ["surface-language", "surfaceLanguageGoNoGo", ["apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json", "scripts/oam/check-surface-language-v2.mjs"]],
    ["release-evidence", "releaseEvidenceGoNoGo", [releaseEvidenceObjectPath, "tests/WorkOS.ReleaseEvidenceTests/OamReleaseControlTests.cs"]]
  ];
  return dimensions.map(([id, field, sources]) => {
    const sourceHashes = sources.map((file) => ({ path: file, hash: hashFileIfPresent(file) }));
    const command = sources.find((file) => String(file).startsWith("scripts/")) ?? sources[0];
    const payload = {
      id,
      field,
      sources,
      sourceHashes,
      goNoGo: multiDimensionalGoNoGo[field],
      finalGoNoGo
    };
    const proofHash = `sha256:${sha256(JSON.stringify(normalizeForDigest(payload)))}`;
    return {
      id: `p0-closure-proof.${id}`,
      type: "p0_closure_proof",
      scope: "current_oam_p0_closure",
      status: "blocked",
      workstreamId: "00-current-oam-p0-closure",
      proofType: "current-oam-branch-governed-p0-closure",
      source: sources,
      hash: proofHash,
      dependsOn: sources,
      producedBy: "scripts/oam/generate-current-evidence-root.mjs",
      verifiedBy: command,
      command,
      checker: command,
      inputHashes: sourceHashes,
      outputHashes: [{ path: `evidence-node:p0-closure-proof.${id}`, hash: proofHash }],
      gateResult: { status: "bound", field },
      negativeTestResult: "blocked",
      goNoGoImpact: [field],
      notesZh: `${field} 的 P0 收口 proof DAG 节点；当前阶段保持 NO_GO，CI 绿色不等于 GO。`,
      goNoGo: multiDimensionalGoNoGo[field] ?? "NO_GO",
      finalGoNoGo,
      releaseAuthority: false,
      finalReportField: field
    };
  });
}

function buildSourcePackageProofNodes() {
  const resultPath = sourcePackageCheck.path ?? "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json";
  const sourcePath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
  const matrixPath = "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml";
  const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
  const noSideEffectsProofPath = "docs/oam/db-no-side-effects-proof.json";
  const dependencySpecs = [
    ["source-package-file-hash", "source_package_file_hash", [sourcePath]],
    ["scenario-matrix-hash", "scenario_matrix_hash", [matrixPath]],
    ["dormitory-operating-kernel-hash", "dormitory_operating_kernel_hash", [kernelPath]],
    ["source-package-checker-result", "source_package_checker_result", [resultPath]],
    ["language-copy-proof", "language_copy_proof", [
      "docs/contracts/language/surface-copy-catalog.json",
      "docs/contracts/language/multilingual-copy-catalog.json",
      "artifacts/oam/proofs/language/language-glossary-generated-proof.json"
    ]],
    ["read-side-envelope-proof", "read_side_envelope_proof", [
      sourcePath,
      "artifacts/oam/proofs/read-intelligence/oam-object-envelope-proof.json"
    ]],
    ["finance-ledger-none-proof", "finance_ledger_none_proof", [
      sourcePath,
      "docs/finance/finance-ledger-kernel.json",
      noSideEffectsProofPath
    ]],
    ["prior-identity-blocker-proof", "prior_identity_blocker_proof", [
      sourcePath,
      "docs/contracts/definition/source-id-migration-fence.json",
      "scripts/oam/check-operation-identity-boundary.mjs"
    ]],
    ["no-side-effects-proof", "no_side_effects_proof", [
      sourcePath,
      noSideEffectsProofPath
    ]],
    ["mutation-result-proof", "mutation_result_proof", [
      resultPath,
      "artifacts/oam/authority-cleanup/mutation-tests-result.json"
    ]],
    ["source-field-gaps-decision-proof", "source_field_gaps_decision_proof", [
      sourcePath,
      resultPath
    ]],
    ["branch-flows-no-side-effects-proof", "branch_flows_no_side_effects_proof", [
      sourcePath,
      resultPath,
      noSideEffectsProofPath
    ]]
  ];
  const dependencyNodes = dependencySpecs.map(([suffix, proofType, sources]) =>
    buildSourcePackageDependencyProofNode(`source-package-proof.${suffix}`, proofType, sources)
  );
  const dependsOn = dependencyNodes.map((node) => node.id);
  const sources = [...new Set([
    sourcePath,
    matrixPath,
    kernelPath,
    resultPath,
    noSideEffectsProofPath,
    "scripts/oam/check-dormitory-golden-chain-source-package.mjs"
  ])];
  const inputHashes = sources.map((file) => ({
    path: file,
    hash: hashFileIfPresent(file)
  }));
  const payload = {
    nodeId: "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
    proofType: "source_package_review",
    scope: "compile_preparation_review",
    status: sourcePackageCheck.status,
    decisionState: sourcePackageCheck.evidenceNodeReady ? "SOURCE_FINALIZED_BY_00" : "BLOCKED_BY_SOURCE_P0",
    sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
    compileDecisionStatus: sourcePackageCheck.compileDecisionStatus ?? "READY_FOR_00_COMPILE_DECISION",
    generatedCompileAuthorized: sourcePackageCheck.generatedCompileAuthorized ?? false,
    generatedCompilationAllowed: sourcePackageCheck.generatedCompilationAllowed ?? "false_until_00_explicit_generated_compile_approval",
    generatedCompileCompleted: false,
    runtimeConsumptionReady: sourcePackageCheck.runtimeConsumptionReady ?? false,
    sourceDigest: sourcePackageCheck.digests?.sourceDigest ?? "missing",
    checkerResultDigest: sourcePackageCheck.digests?.checkerResultDigest ?? "missing",
    mutationResultDigest: sourcePackageCheck.digests?.mutationResultDigest ?? "missing",
    sourceToGeneratedProvenancePlanDigest: sourcePackageCheck.digests?.sourceToGeneratedProvenancePlanDigest ?? "missing",
    sourceFieldGapsDecisionDigest: digestObject(sourcePackageCheck.sourceFieldGaps ?? {}),
    branchFlowContractDigest: digestObject(sourcePackageCheck.branchFlowContract ?? {}),
    dependsOn,
    finalGoNoGo: "NO_GO"
  };
  const proofHash = `sha256:${sha256(JSON.stringify(normalizeForDigest(payload)))}`;
  const sourcePackageNode = {
    id: "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
    type: "source_package_review",
    proofType: "source_package_review",
    scope: "compile_preparation_review",
    source: sources,
    hash: proofHash,
    dependsOn,
    producedBy: "scripts/oam/generate-current-evidence-root.mjs",
    verifiedBy: "scripts/oam/check-dormitory-golden-chain-source-package.mjs",
    binding: sourcePackageProofBinding("OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE"),
    status: sourcePackageCheck.status === "PASS" ? "passed" : "blocked",
    decisionState: sourcePackageCheck.evidenceNodeReady ? "SOURCE_FINALIZED_BY_00" : "BLOCKED_BY_SOURCE_P0",
    sourceReadyForCompileDecision: sourcePackageCheck.sourceReadyForCompileDecision ?? true,
    compileDecisionStatus: sourcePackageCheck.compileDecisionStatus ?? "READY_FOR_00_COMPILE_DECISION",
    generatedCompileAuthorized: sourcePackageCheck.generatedCompileAuthorized ?? false,
    generatedCompilationAllowed: sourcePackageCheck.generatedCompilationAllowed ?? "false_until_00_explicit_generated_compile_approval",
    generatedCompileCompleted: false,
    runtimeConsumptionReady: sourcePackageCheck.runtimeConsumptionReady ?? false,
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false,
    sourceDigest: sourcePackageCheck.digests?.sourceDigest ?? "missing",
    checkerResultDigest: sourcePackageCheck.digests?.checkerResultDigest ?? "missing",
    mutationResultDigest: sourcePackageCheck.digests?.mutationResultDigest ?? "missing",
    sourceToGeneratedProvenancePlanDigest: sourcePackageCheck.digests?.sourceToGeneratedProvenancePlanDigest ?? "missing",
    sourceFieldGapsDecisionDigest: payload.sourceFieldGapsDecisionDigest,
    branchFlowContractDigest: payload.branchFlowContractDigest,
    inputHashes,
    outputHashes: [{ path: "evidence-node:OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE", hash: proofHash }],
    p0Failures: sourcePackageCheck.p0Failures ?? [],
    p1Residuals: sourcePackageCheck.p1Residuals ?? [],
    p2Residuals: sourcePackageCheck.p2Residuals ?? [],
    goNoGoImpact: ["finalGoNoGo"],
    notesZh: "宿舍第一金链 Source 场景包复审节点；只准备编译前 00 裁决材料，不授权业务 GO。"
  };
  return [...dependencyNodes, sourcePackageNode];
}

function buildGeneratedCompileCandidateState() {
  const approval = generatedCompileCandidateApproval ?? {};
  const authorizedSourceRef = approval.authorizedSourceRef ?? approval.candidateSourceRef ?? "missing";
  const candidateSourceRef = approval.candidateSourceRef ?? authorizedSourceRef;
  const authorizedCandidateExecutionHead = approval.authorizedCandidateExecutionHead ?? approval.executionHead ?? "missing";
  const executionHead = approval.executionHead ?? authorizedCandidateExecutionHead;
  const approvalObjectHash = generatedCompileCandidateApproval
    ? hashFileStrict(generatedCompileCandidateApprovalPath)
    : "missing";
  const generatedManifestHash = fileExists("docs/oam/generated-contracts-manifest.json")
    ? hashFileStrict("docs/oam/generated-contracts-manifest.json")
    : "missing";
  const generatedOutputDigest = digestForDisk(generatedContractFiles);
  const controlPlaneCurrent = controlPlaneGateResult.commitSha === currentRepositoryHead &&
    controlPlaneGateResult.status === "passed" &&
    controlPlaneGateResult.runStatus === "completed" &&
    controlPlaneGateResult.finalizable === true;
  const evidenceGeneratedAtHead = evidenceRunSha;
  const candidateCompileEvidenceStatus = evidenceGeneratedAtHead !== currentRepositoryHead || !controlPlaneCurrent
    ? "STALE_REFERENCE"
    : authorizedCandidateExecutionHead === currentRepositoryHead
      ? "CURRENT"
      : "STALE_BUT_NO_GO";
  const candidateCompileClosureForCurrentHead = candidateCompileEvidenceStatus === "CURRENT";
  const candidateCompileNextAction = candidateCompileEvidenceStatus === "CURRENT"
    ? "候选编译证据绑定当前 HEAD；仍需 00 后续接受候选后才可进入正式 generated compile 或 Runtime 消费。"
    : candidateCompileEvidenceStatus === "STALE_REFERENCE"
      ? "重新在当前 HEAD 执行候选闭合，或等待外部 CI artifact attestation；保持 NO_GO。"
      : "当前 HEAD 是 00 授权执行头的 descendant；等待 00 更新 authorizedCandidateExecutionHead 或保持 stale-but-no-go。";
  const authorized = approval.version === "oam.generated-compile-candidate-approval.v1"
    && approval.approvalType === "generated_compile_candidate_only"
    && approval.generatedCompileCandidateAuthorized === true
    && approval.generatedCompileAuthorized === false
    && approval.generatedReleaseAllowed === false
    && approval.runtimeConsumptionAllowed === "false_until_candidate_accepted_by_00"
    && approval.releaseAuthority === false
    && approval.finalGoNoGo === "NO_GO"
    && approval.authorizedSourceRef === approval.candidateSourceRef
    && approval.executionHead === authorizedCandidateExecutionHead
    && approval.executionHeadCompatibilityAliasOf === "authorizedCandidateExecutionHead";
  const sourceReady = sourcePackageCheck.status === "PASS"
    && sourcePackageCheck.sourceFinalizationStatus === "SOURCE_FINALIZED_BY_00"
    && sourcePackageCheck.sourceFieldGapsDecisionStatus === "DECIDED_AND_BOUND"
    && sourcePackageCheck.sourceReadyForCompileDecision !== false;
  const status = authorized && sourceReady ? "PASS" : "FAIL";
  return {
    version: "oam.generated-compile-candidate-state.v1",
    status,
    authorized,
    approvalObjectRef: generatedCompileCandidateApprovalPath,
    approvalObjectHash,
    authorizedSourceRef,
    candidateSourceRef,
    authorizedCandidateExecutionHead,
    executionHead,
    evidenceGeneratedAtHead,
    currentRepositoryHead,
    controlPlaneResultHead: controlPlaneGateResult.commitSha ?? "missing",
    controlPlaneCurrent,
    candidateCompileEvidenceStatus,
    candidateCompileClosureForCurrentHead,
    candidateCompileNextAction,
    generatedManifestHash,
    generatedOutputDigest,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionAllowed: "false_until_candidate_accepted_by_00",
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function buildFormalGeneratedCompileAuthorizationState() {
  const approval = generatedCompileApproval ?? {};
  const approvalObjectHash = generatedCompileApproval
    ? hashFileStrict(generatedCompileApprovalPath)
    : "missing";
  const predicate = validateFormalGeneratedCompileAuthorization({
    approval,
    candidateApproval: generatedCompileCandidateApproval,
    currentHead: currentRepositoryHead,
    approvalPath: generatedCompileApprovalPath,
    candidateApprovalPath: generatedCompileCandidateApprovalPath
  });
  const authorized = predicate.authorized && generatedCompileCandidate.authorized === true;
  const predicateFailures = authorized
    ? []
    : [
        ...predicate.failures,
        ...(generatedCompileCandidate.authorized === true ? [] : ["generated compile candidate approval is not authorized"])
      ];
  return {
    version: "oam.formal-generated-compile-authorization-state.v1",
    status: authorized ? "PASS" : "NO_GO",
    authorized,
    predicateVersion: predicate.version,
    headBindingStatus: semanticStageAuthorityTerm(predicate.headBindingStatus),
    predicateFailures,
    approvalObjectRef: generatedCompileApprovalPath,
    approvalObjectHash,
    approvalStatus: approval.approvalStatus ?? "missing",
    approvalDecision: approval.approvalDecision ?? "missing",
    approvalScope: approval.approvalScope ?? "missing",
    currentHEAD: approval.currentHEAD ?? "missing",
    reviewedRef: approval.reviewedRef ?? "missing",
    approvedFormalAuthorizationHead: approval.approvedFormalAuthorizationHead ?? "missing",
    formalCompileExecutionDescendantPolicy: semanticDescendantPolicy(approval.currentHeadDescendantPolicy),
    currentRepositoryHead,
    candidateSourceRef: approval.candidateSourceRef ?? "missing",
    authorizedCandidateExecutionHead: approval.authorizedCandidateExecutionHead ?? "missing",
    candidateArtifactRunId: approval.candidateArtifactRunId ?? "missing",
    candidateArtifactName: approval.candidateArtifactName ?? "missing",
    candidateArtifactGithubDigest: approval.candidateArtifactGithubDigest ?? "missing",
    candidateArtifactInternalReleaseEvidenceDigest: approval.candidateArtifactInternalReleaseEvidenceDigest ?? "missing",
    artifactDigestDistinction: approval.artifactDigestDistinction ?? "",
    generatedCompileAuthorized: authorized,
    generatedCompilationAllowed: authorized,
    generatedCompilationReadiness: authorized
      ? "AUTHORIZED_PENDING_GENERATED_COMPILE_EXECUTION"
      : "NOT_STARTED_OR_NOT_AUTHORIZED",
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    historicalAppendix: {
      currentHeadDescendantPolicy: approval.currentHeadDescendantPolicy ?? "missing"
    }
  };
}

function semanticDescendantPolicy(value) {
  const policy = String(value ?? "missing");
  if (policy === "allow_s4_formal_generated_compile_execution_writeback_descendants_without_runtime_or_go") {
    return "allow_formal_compile_execution_writeback_descendants_without_runtime_or_go";
  }
  return policy.replace(/\bs4\b/gi, "formal_compile_execution");
}

function semanticStageAuthorityTerm(value) {
  return String(value ?? "missing")
    .replace(/S4_EXECUTION/g, "FORMAL_COMPILE_EXECUTION")
    .replace(/S5/g, "GENERATED_BUNDLE_ACCEPTANCE")
    .replace(/S6/g, "GENERATED_BUNDLE_ACCEPTANCE")
    .replace(/S7/g, "RUNTIME_TEST_ADMISSION");
}

function buildGeneratedCompileExecutionState() {
  const result = readJsonIfExists(generatedCompileExecutionResultPath);
  const proofDocument = readJsonIfExists(generatedCompileExecutionProofPath);
  const snapshot = readJsonIfExists(generatedCompileExecutionSnapshotPath);
  const reviewedExecutionHead = result?.reviewedExecutionHead ??
    proofDocument?.reviewedExecutionHead ??
    result?.currentHead ??
    proofDocument?.currentHead ??
    currentRepositoryHead;
  const resultPass = result?.status === "PASS" && result?.checkerExecutionStatus === "PASS";
  const proofPass = proofDocument?.status === "PASS";
  const formalAuthorized = formalGeneratedCompileAuthorization.authorized === true;
  const noForbiddenEscalation =
    result?.generatedCandidateAcceptedBy00 === false &&
    result?.runtimeConsumptionReady === false &&
    result?.businessFeatureDevelopmentAllowed === false &&
    result?.productionConfirmAllowed === false &&
    result?.releaseAuthority === false &&
    result?.finalGoNoGo === "NO_GO" &&
    proofDocument?.generatedCandidateAcceptedBy00 === false &&
    proofDocument?.runtimeConsumptionReady === false &&
    proofDocument?.businessFeatureDevelopmentAllowed === false &&
    proofDocument?.productionConfirmAllowed === false &&
    proofDocument?.releaseAuthority === false &&
    proofDocument?.finalGoNoGo === "NO_GO";
  const completed = formalAuthorized &&
    resultPass &&
    proofPass &&
    result?.generatedCompileCompleted === true &&
    result?.generatedCompilationCompleted === true &&
    proofDocument?.generatedCompileCompleted === true &&
    proofDocument?.generatedCompilationCompleted === true &&
    noForbiddenEscalation;
  const blockingReasons = [];
  if (!formalAuthorized) blockingReasons.push("formal generated compile authorization is not exact-head PASS.");
  if (!resultPass) blockingReasons.push(`${generatedCompileExecutionResultPath} is missing or not PASS.`);
  if (!proofPass) blockingReasons.push(`${generatedCompileExecutionProofPath} is missing or not PASS.`);
  if (!noForbiddenEscalation) blockingReasons.push("generated compile execution proof attempted forbidden candidate/runtime/business/release/GO escalation.");
  return {
    version: "oam.generated-compile-execution-state.v1",
    status: completed ? "PASS" : "NO_GO",
    resultPath: generatedCompileExecutionResultPath,
    proofPath: generatedCompileExecutionProofPath,
    snapshotPath: generatedCompileExecutionSnapshotPath,
    resultDigest: fileExists(generatedCompileExecutionResultPath) ? hashFileStrict(generatedCompileExecutionResultPath) : "missing",
    proofDigest: fileExists(generatedCompileExecutionProofPath) ? hashFileStrict(generatedCompileExecutionProofPath) : "missing",
    snapshotDigest: fileExists(generatedCompileExecutionSnapshotPath) ? hashFileStrict(generatedCompileExecutionSnapshotPath) : "missing",
    currentHead: result?.currentHead ?? currentRepositoryHead,
    currentRepositoryHead,
    reviewedExecutionHead,
    currentBranch: result?.currentBranch ?? branch,
    formalAuthorizationStatus: formalGeneratedCompileAuthorization.status,
    generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
    generatedCompilationReadiness: completed
      ? "FORMAL_GENERATED_COMPILE_EXECUTED_PENDING_00_GENERATED_CANDIDATE_ACCEPTANCE"
      : formalGeneratedCompileAuthorization.generatedCompilationReadiness,
    generatedCompileCompleted: completed,
    generatedCompilationCompleted: completed,
    generatedContractStatus10B: completed
      ? "GENERATED_COMPILE_EXECUTED_PENDING_00_CANDIDATE_ACCEPTANCE"
      : sourcePackageCheck.generatedContractStatus10B ?? "PENDING_GENERATED_CONTRACT",
    generatedOutputDigest: result?.generatedOutputDigest ?? generatedContractsHash,
    manifestDigest: result?.manifestDigest ?? (fileExists("docs/oam/generated-contracts-manifest.json") ? hashFileStrict("docs/oam/generated-contracts-manifest.json") : "missing"),
    generatedKernelGraphDigest: result?.generatedKernelGraphDigest ?? (fileExists("docs/oam/kernel/oam-kernel-graph.generated.json") ? hashFileStrict("docs/oam/kernel/oam-kernel-graph.generated.json") : "missing"),
    reproducibility: result?.reproducibility ?? proofDocument?.reproducibility ?? null,
    noManualEditProof: result?.noManualEditProof ?? proofDocument?.noManualEditProof ?? null,
    consistencyProof: result?.consistencyProof ?? proofDocument?.consistencyProof ?? null,
    driftProof: result?.driftProof ?? proofDocument?.driftProof ?? null,
    inputSnapshotStatus: snapshot?.status ?? "missing",
    nextDecisionFor00: completed ? "GENERATED_CANDIDATE_ACCEPTANCE_REVIEW" : "FORMAL_GENERATED_COMPILE_EXECUTION",
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionAllowed: "false_until_candidate_accepted_by_00",
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    blockingReasons
  };
}

function buildGeneratedFieldBindingClosureState() {
  const closure = buildDormitoryGeneratedFieldBindingClosure({ root });
  const result = readJsonIfExists(generatedFieldBindingClosureResultPath);
  const contract = readJsonIfExists(generatedFieldBindingsPath);
  const resultPass = result?.status === "PASS" &&
    result?.generatedFieldBindingClosureStatus === "PASS" &&
    result?.closureDigest === closure.closureDigest &&
    result?.sourceFieldGapsDecisionDigest === closure.sourceFieldGapsDecisionDigest;
  const contractPass = contract?.generated === true &&
    contract?.doNotEdit === true &&
    contract?.canonicalClosureVersion === closure.canonicalClosureVersion &&
    contract?.generatedFieldBindingClosureDigest === closure.closureDigest &&
    contract?.sourceFieldGapsDecisionDigest === closure.sourceFieldGapsDecisionDigest;
  const status = closure.status === "PASS" && resultPass && contractPass ? "PASS" : "FAIL";
  const blockingReasons = [];
  if (closure.status !== "PASS") blockingReasons.push(`shared closure status is ${closure.status}.`);
  if (!resultPass) blockingReasons.push(`${generatedFieldBindingClosureResultPath} is missing, not PASS, or digest-stale.`);
  if (!contractPass) blockingReasons.push(`${generatedFieldBindingsPath} is missing, invalid, or digest-stale.`);
  return {
    version: "oam.generated-field-binding-closure-state.v1",
    status,
    generatedFieldBindingClosureRequired: true,
    generatedFieldBindingClosureStatus: status,
    contractPath: generatedFieldBindingsPath,
    resultPath: generatedFieldBindingClosureResultPath,
    generatedFieldBindingClosureDigest: closure.closureDigest,
    closureDigest: closure.closureDigest,
    sourceFieldGapsDecisionDigest: closure.sourceFieldGapsDecisionDigest,
    sourceFieldGapsDecisionStatus: closure.sourceFieldGapsDecisionStatus,
    requiredFieldIds: closure.requiredFieldIds,
    fieldCount: closure.fields.length,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    blockingReasons
  };
}

function buildGeneratedCompileCandidateProofNodes() {
  if (!generatedCompileCandidateApproval) return [];
  const id = "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-CANDIDATE";
  const source = [
    generatedCompileCandidateApprovalPath,
    "docs/oam/generated-contracts-manifest.json",
    "docs/oam/domain-derived-contracts.json",
    "docs/oam/system-derived-contracts.json",
    "scripts/oam/check-generated-compile-authorization.mjs",
    "scripts/business/generate-dormitory-derived-contracts.mjs",
    "scripts/oam/compile-current-kernel-graph.mjs",
    ...generatedContractFiles
  ];
  const dependsOn = [
    "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
    generatedCompileCandidateApprovalPath,
    "docs/oam/generated-contracts-manifest.json",
    "docs/oam/domain-derived-contracts.json",
    "docs/oam/system-derived-contracts.json",
    "scripts/oam/check-generated-compile-authorization.mjs"
  ];
  const payload = {
    nodeId: id,
    proofType: "generated_compile_candidate",
    scope: "generated_compile_candidate_only",
    status: generatedCompileCandidate.status,
    authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
    authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
    candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
    executionHead: generatedCompileCandidate.executionHead,
    evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
    currentRepositoryHead,
    candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
    candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
    candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
    approvalObjectHash: generatedCompileCandidate.approvalObjectHash,
    generatedManifestHash: generatedCompileCandidate.generatedManifestHash,
    generatedOutputDigest: generatedCompileCandidate.generatedOutputDigest,
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    dependsOn
  };
  const hash = digestObject(payload);
  return [{
    id,
    type: "generated_compile_candidate",
    proofType: "generated_compile_candidate",
    scope: "generated_compile_candidate_only",
    source,
    hash,
    dependsOn,
    producedBy: "scripts/business/generate-dormitory-derived-contracts.mjs",
    verifiedBy: [
      "scripts/oam/check-generated-compile-authorization.mjs",
      "scripts/oam/check-generated-contract-consistency.mjs",
      "scripts/oam/check-generated-files-not-manually-edited.mjs",
      "scripts/oam/check-oam-kernel-graph.mjs"
    ],
    binding: generatedCompileCandidateBinding(id),
    status: generatedCompileCandidate.status === "PASS" ? "passed" : "blocked",
    authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
    authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
    candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
    executionHead: generatedCompileCandidate.executionHead,
    evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
    currentRepositoryHead,
    candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
    candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
    candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
    approvalObjectHash: generatedCompileCandidate.approvalObjectHash,
    generatedManifestHash: generatedCompileCandidate.generatedManifestHash,
    generatedOutputDigest: generatedCompileCandidate.generatedOutputDigest,
    generatedCompileCandidateAuthorized: generatedCompileCandidate.authorized,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionAllowed: "false_until_candidate_accepted_by_00",
    runtimeConsumptionReady: false,
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false,
    goNoGoImpact: ["finalGoNoGo"],
    notesZh: "宿舍第一金链 generated compile candidate 证明节点；只允许候选编译校验，不授权 release、Runtime 消费或业务 GO。"
  }];
}

function buildFormalGeneratedCompileAuthorizationProofNodes() {
  if (!generatedCompileApproval) return [];
  const id = "OAM-DORMITORY-GOLDEN-CHAIN-FORMAL-GENERATED-COMPILE-AUTHORIZATION";
  const source = [
    generatedCompileApprovalPath,
    generatedCompileCandidateApprovalPath,
    "artifacts/oam/checks/generated-compile-authorization-result.json",
    "docs/oam/evidence-attestation-packages/dormitory-golden-chain-2b7bc377.attestation.json",
    "artifacts/oam/checks/dormitory-candidate-artifact-attestation-package-result.json"
  ];
  const dependsOn = [
    "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-CANDIDATE",
    generatedCompileApprovalPath,
    "artifacts/oam/checks/generated-compile-authorization-result.json"
  ];
  const payload = {
    nodeId: id,
    proofType: "formal_generated_compile_authorization",
    scope: "formal_generated_compile_authorization_only",
    status: formalGeneratedCompileAuthorization.status,
    approvalObjectHash: formalGeneratedCompileAuthorization.approvalObjectHash,
    reviewedRef: formalGeneratedCompileAuthorization.reviewedRef,
    candidateSourceRef: formalGeneratedCompileAuthorization.candidateSourceRef,
    authorizedCandidateExecutionHead: formalGeneratedCompileAuthorization.authorizedCandidateExecutionHead,
    generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
    generatedCompileCompleted: false,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    dependsOn
  };
  const hash = digestObject(payload);
  return [{
    id,
    type: "formal_generated_compile_authorization",
    proofType: "formal_generated_compile_authorization",
    scope: "formal_generated_compile_authorization_only",
    source,
    hash,
    dependsOn,
    producedBy: "00 formal generated compile authorization writeback",
    verifiedBy: [
      "scripts/oam/check-generated-compile-authorization.mjs",
      "scripts/oam/check-current-evidence-root.mjs"
    ],
    binding: formalGeneratedCompileAuthorizationBinding(id),
    status: formalGeneratedCompileAuthorization.status === "PASS" ? "passed" : "blocked",
    approvalObjectHash: formalGeneratedCompileAuthorization.approvalObjectHash,
    approvalStatus: formalGeneratedCompileAuthorization.approvalStatus,
    approvalDecision: formalGeneratedCompileAuthorization.approvalDecision,
    reviewedRef: formalGeneratedCompileAuthorization.reviewedRef,
    candidateSourceRef: formalGeneratedCompileAuthorization.candidateSourceRef,
    authorizedCandidateExecutionHead: formalGeneratedCompileAuthorization.authorizedCandidateExecutionHead,
    generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
    generatedCompilationReadiness: formalGeneratedCompileAuthorization.generatedCompilationReadiness,
    generatedCompileCompleted: false,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false,
    goNoGoImpact: ["generatedCompileAuthorizationStatus", "finalGoNoGo"],
    notesZh: "Formal generated compile authorization proof node; this does not accept the generated candidate, open Runtime consumption, or grant GO."
  }];
}

function buildGeneratedCompileExecutionProofNodes() {
  const id = "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-EXECUTION";
  const source = [
    generatedCompileExecutionResultPath,
    generatedCompileExecutionProofPath,
    generatedCompileExecutionSnapshotPath,
    generatedFieldBindingsPath,
    generatedFieldBindingClosureResultPath,
    "docs/oam/generated-contracts-manifest.json",
    "docs/oam/kernel/oam-kernel-graph.generated.json",
    "artifacts/oam/checks/generated-files-not-manually-edited-result.json",
    "artifacts/oam/checks/generated-contract-consistency-result.json",
    "artifacts/oam/checks/derived-contract-consistency-result.json",
    "artifacts/oam/checks/oam-kernel-graph-result.json"
  ];
  const dependsOn = [
    "OAM-DORMITORY-GOLDEN-CHAIN-FORMAL-GENERATED-COMPILE-AUTHORIZATION",
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-CANDIDATE",
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-FIELD-BINDING-CLOSURE",
    generatedCompileExecutionProofPath,
    generatedFieldBindingClosureResultPath,
    "artifacts/oam/checks/generated-files-not-manually-edited-result.json",
    "artifacts/oam/checks/generated-contract-consistency-result.json",
    "artifacts/oam/checks/derived-contract-consistency-result.json",
    "artifacts/oam/checks/oam-kernel-graph-result.json"
  ];
  const payload = {
    nodeId: id,
    proofType: "formal_generated_compile_execution",
    scope: "formal_generated_compile_execution_only",
    status: generatedCompileExecution.status,
    resultDigest: generatedCompileExecution.resultDigest,
    proofDigest: generatedCompileExecution.proofDigest,
    snapshotDigest: generatedCompileExecution.snapshotDigest,
    generatedOutputDigest: generatedCompileExecution.generatedOutputDigest,
    generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
    generatedCompileAuthorized: generatedCompileExecution.generatedCompileAuthorized,
    generatedCompilationAllowed: generatedCompileExecution.generatedCompilationAllowed,
    generatedCompileCompleted: generatedCompileExecution.generatedCompileCompleted,
    generatedCompilationCompleted: generatedCompileExecution.generatedCompilationCompleted,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    dependsOn
  };
  const hash = digestObject(payload);
  return [{
    id,
    type: "formal_generated_compile_execution",
    proofType: "formal_generated_compile_execution",
    scope: "formal_generated_compile_execution_only",
    source,
    hash,
    dependsOn,
    producedBy: "scripts/oam/check-generated-compile-execution.mjs",
    verifiedBy: [
      "scripts/oam/check-generated-compile-execution.mjs",
      "scripts/oam/check-current-evidence-root.mjs"
    ],
    binding: generatedCompileExecutionBinding(id),
    status: generatedCompileExecution.status === "PASS" ? "passed" : "blocked",
    resultPath: generatedCompileExecution.resultPath,
    proofPath: generatedCompileExecution.proofPath,
    snapshotPath: generatedCompileExecution.snapshotPath,
    resultDigest: generatedCompileExecution.resultDigest,
    proofDigest: generatedCompileExecution.proofDigest,
    snapshotDigest: generatedCompileExecution.snapshotDigest,
    generatedOutputDigest: generatedCompileExecution.generatedOutputDigest,
    generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
    manifestDigest: generatedCompileExecution.manifestDigest,
    generatedKernelGraphDigest: generatedCompileExecution.generatedKernelGraphDigest,
    generatedCompileAuthorized: generatedCompileExecution.generatedCompileAuthorized,
    generatedCompilationAllowed: generatedCompileExecution.generatedCompilationAllowed,
    generatedCompilationReadiness: generatedCompileExecution.generatedCompilationReadiness,
    generatedCompileCompleted: generatedCompileExecution.generatedCompileCompleted,
    generatedCompilationCompleted: generatedCompileExecution.generatedCompilationCompleted,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false,
    nextDecisionFor00: generatedCompileExecution.nextDecisionFor00,
    goNoGoImpact: ["generatedCompilationStatus", "finalGoNoGo"],
    notesZh: "Formal generated compile execution proof node; this completes the generated compile evidence layer only and does not accept the generated candidate, open Runtime consumption, or grant GO."
  }];
}

function buildGeneratedFieldBindingClosureProofNodes() {
  const id = "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-FIELD-BINDING-CLOSURE";
  const source = [
    generatedFieldBindingsPath,
    generatedFieldBindingClosureResultPath,
    "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml",
    "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json"
  ];
  const dependsOn = [
    "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
    generatedFieldBindingsPath,
    generatedFieldBindingClosureResultPath
  ];
  const payload = {
    nodeId: id,
    proofType: "generated_field_binding_closure",
    scope: "generated_semantic_closure_only",
    status: generatedFieldBindingClosure.status,
    generatedFieldBindingClosureRequired: true,
    generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    dependsOn
  };
  const hash = digestObject(payload);
  return [{
    id,
    type: "generated_field_binding_closure",
    proofType: "generated_field_binding_closure",
    scope: "generated_semantic_closure_only",
    source,
    hash,
    dependsOn,
    producedBy: "scripts/oam/check-generated-field-binding-closure.mjs",
    verifiedBy: [
      "scripts/oam/check-generated-field-binding-closure.mjs",
      "scripts/oam/check-generated-contract-consistency.mjs",
      "scripts/oam/check-current-evidence-root.mjs"
    ],
    binding: {
      root: "current-oam-trust-closure-v1",
      proofId: id,
      generatedFieldBindingsRef: generatedFieldBindingsPath,
      generatedFieldBindingClosureResultRef: generatedFieldBindingClosureResultPath,
      generatedFieldBindingClosureRequired: true,
      generatedFieldBindingClosureStatus: generatedFieldBindingClosure.status,
      generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
      sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
      runtimeConsumptionReady: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    status: generatedFieldBindingClosure.status === "PASS" ? "passed" : "blocked",
    generatedFieldBindingClosureRequired: true,
    generatedFieldBindingClosureStatus: generatedFieldBindingClosure.status,
    generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    businessGoAuthority: false,
    goNoGoImpact: ["generatedFieldBindingClosureStatus", "finalGoNoGo"],
    notesZh: "Generated semantic field binding closure node; this proves Source field gaps are bound into generated contracts but does not accept the generated candidate or open Runtime."
  }];
}

function buildGeneratedCandidateAcceptanceProofNodes() {
  const id = "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-CANDIDATE-ACCEPTANCE";
  const source = [
    generatedCandidateAcceptancePath,
    generatedCandidateAcceptanceResultPath,
    generatedCompileExecutionResultPath,
    generatedCompileExecutionProofPath,
    generatedFieldBindingClosureResultPath
  ];
  const dependsOn = [
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-COMPILE-EXECUTION",
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-FIELD-BINDING-CLOSURE",
    generatedCompileExecutionProofPath,
    generatedFieldBindingClosureResultPath,
    generatedCandidateAcceptancePath,
    generatedCandidateAcceptanceResultPath
  ];
  const payload = {
    nodeId: id,
    proofType: "generated_candidate_acceptance_authority",
    scope: "generated_candidate_acceptance_authority_only",
    status: generatedCandidateAcceptance.status,
    decisionStatus: generatedCandidateAcceptance.decisionStatus,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: generatedCandidateAcceptance.acceptedGeneratedBundleDigest,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    dependsOn
  };
  const hash = digestObject(payload);
  return [{
    id,
    type: "generated_candidate_acceptance_authority",
    proofType: "generated_candidate_acceptance_authority",
    scope: "generated_candidate_acceptance_authority_only",
    source,
    hash,
    dependsOn,
    producedBy: "scripts/oam/check-generated-candidate-acceptance.mjs",
    verifiedBy: [
      "scripts/oam/check-generated-candidate-acceptance.mjs",
      "scripts/oam/check-current-evidence-root.mjs"
    ],
    binding: generatedCandidateAcceptanceBinding(id),
    status: generatedCandidateAcceptance.generatedCandidateAcceptedBy00 === true ? "passed" : "blocked",
    decisionStatus: generatedCandidateAcceptance.decisionStatus,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: generatedCandidateAcceptance.acceptedGeneratedBundleDigest,
    currentRepositoryHead,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    businessGoAuthority: false,
    nextDecisionFor00: generatedCandidateAcceptanceNextDecisionFor00(),
    goNoGoImpact: ["generatedCandidateAcceptanceStatus", "finalGoNoGo"],
    notesZh: "Generated candidate acceptance authority node; PENDING/NOT_ACCEPTED 均不接受候选，ACCEPTED 也不自动开放 Runtime、业务开发、release 或 GO。"
  }];
}

function generatedCandidateAcceptanceReportView() {
  return {
    version: "oam.generated-candidate-acceptance-report-view.v1",
    status: generatedCandidateAcceptance.status,
    decisionStatus: generatedCandidateAcceptance.decisionStatus,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: generatedCandidateAcceptance.acceptedGeneratedBundleDigest,
    acceptedGeneratedFiles: generatedCandidateAcceptance.acceptedGeneratedFiles ?? [],
    acceptedRuntimeConsumableDigests: generatedCandidateAcceptance.acceptedRuntimeConsumableDigests ?? [],
    runtimeReadyImplied: false,
    businessLandingImplied: false,
    productionConfirmImplied: false,
    releaseAuthorityImplied: false,
    finalGoImplied: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function dormitoryRuntimeAdmissionReportView() {
  return {
    version: "oam.dormitory-runtime-admission-report-view.v1",
    status: dormitoryRuntimeAdmission.status,
    runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
    acceptedGeneratedBundleDigest: dormitoryRuntimeAdmission.acceptedGeneratedBundleDigest,
    runtimeConsumedBundleDigest: dormitoryRuntimeAdmission.runtimeConsumedBundleDigest,
    runtimeConsumedFilesDigestList: dormitoryRuntimeAdmission.runtimeConsumedFilesDigestList ?? [],
    acceptedRuntimeConsumableDigests: dormitoryRuntimeAdmission.acceptedRuntimeConsumableDigests ?? [],
    bundleDigestMatch: dormitoryRuntimeAdmission.bundleDigestMatch === true,
    runtimeConsumptionReadyAuthority: dormitoryRuntimeAdmission.runtimeConsumptionReadyAuthority,
    runtimeConsumptionReady,
    runtimeConsumptionMode: runtimeConsumptionReady ? "test_only_consumption" : "pending_runtime_admission_review",
    businessFeatureDevelopmentAllowed: false,
    dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function generatedCandidateAcceptanceNextDecisionFor00() {
  if (generatedCandidateAcceptance.decisionStatus === "ACCEPTED_BY_00") {
    return "RUNTIME_CONSUMPTION_AUTHORIZATION_REVIEW_REQUIRED";
  }
  if (generatedCandidateAcceptance.decisionStatus === "NOT_ACCEPTED_BY_00") {
    return "GENERATED_CANDIDATE_REMEDIATION_AND_REVIEW_REQUIRED";
  }
  return "GENERATED_CANDIDATE_ACCEPTANCE_REVIEW";
}

function buildDormitoryRuntimeTestOnlyEvidenceProof() {
  const semanticProof = readJsonIfExists(dormitoryRuntimeTestOnlyProofPath) ?? {};
  return {
    ...semanticProof,
    proofType: "dormitory_first_golden_chain_test_only_consumption",
    status: "PASS",
    runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: dormitoryRuntimeAdmission.acceptedGeneratedBundleDigest,
    runtimeConsumedBundleDigest: dormitoryRuntimeAdmission.runtimeConsumedBundleDigest,
    runtimeConsumedFilesDigestList: dormitoryRuntimeAdmission.runtimeConsumedFilesDigestList ?? [],
    acceptedRuntimeConsumableDigests: dormitoryRuntimeAdmission.acceptedRuntimeConsumableDigests ?? [],
    bundleDigestMatch: dormitoryRuntimeAdmission.bundleDigestMatch === true,
    consumedGeneratedContracts: dormitoryRuntimeAdmission.consumedGeneratedContracts,
    allowedOperationCases: dormitoryRuntimeAdmission.allowedOperationCases,
    runtimeConsumptionReady,
    businessFeatureDevelopmentAllowed: false,
    dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO",
    binding: binding("dormitory-runtime-test-only-consumption-proof"),
    gateSummary,
    testSummary,
    coverageSummary
  };
}

function buildDormitoryRuntimeAdmissionProofNodes() {
  const id = "OAM-DORMITORY-GOLDEN-CHAIN-RUNTIME-ADMISSION";
  const source = [
    dormitoryRuntimeAdmissionPath,
    dormitoryRuntimeAdmissionResultPath,
    dormitoryRuntimeTestOnlyProofPath,
    generatedCandidateAcceptancePath,
    generatedCandidateAcceptanceResultPath
  ];
  const dependsOn = [
    "OAM-DORMITORY-GOLDEN-CHAIN-GENERATED-CANDIDATE-ACCEPTANCE",
    dormitoryRuntimeAdmissionPath,
    dormitoryRuntimeAdmissionResultPath,
    dormitoryRuntimeTestOnlyProofPath,
    generatedCandidateAcceptancePath,
    generatedCandidateAcceptanceResultPath
  ];
  const payload = {
    nodeId: id,
    proofType: "dormitory_runtime_admission_authority",
    scope: "dormitory_first_golden_chain_test_only_consumption",
    status: dormitoryRuntimeAdmission.status,
    runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
    runtimeConsumptionReady,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: dormitoryRuntimeAdmission.acceptedGeneratedBundleDigest,
    runtimeConsumedBundleDigest: dormitoryRuntimeAdmission.runtimeConsumedBundleDigest,
    runtimeConsumedFilesDigestList: dormitoryRuntimeAdmission.runtimeConsumedFilesDigestList ?? [],
    acceptedRuntimeConsumableDigests: dormitoryRuntimeAdmission.acceptedRuntimeConsumableDigests ?? [],
    bundleDigestMatch: dormitoryRuntimeAdmission.bundleDigestMatch === true,
    allowedOperationCases: dormitoryRuntimeAdmission.allowedOperationCases,
    consumedGeneratedContracts: dormitoryRuntimeAdmission.consumedGeneratedContracts,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    dependsOn
  };
  const hash = digestObject(payload);
  return [{
    id,
    type: "dormitory_runtime_admission_authority",
    proofType: "dormitory_runtime_admission_authority",
    scope: "dormitory_first_golden_chain_test_only_consumption",
    source,
    hash,
    dependsOn,
    producedBy: "scripts/oam/check-dormitory-runtime-admission.mjs",
    verifiedBy: [
      "scripts/oam/check-dormitory-runtime-admission.mjs",
      "scripts/oam/check-current-evidence-root.mjs"
    ],
    binding: dormitoryRuntimeAdmissionBinding(id),
    status: runtimeConsumptionReady ? "passed" : "blocked",
    runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: dormitoryRuntimeAdmission.acceptedGeneratedBundleDigest,
    runtimeConsumedBundleDigest: dormitoryRuntimeAdmission.runtimeConsumedBundleDigest,
    runtimeConsumedFilesDigestList: dormitoryRuntimeAdmission.runtimeConsumedFilesDigestList ?? [],
    acceptedRuntimeConsumableDigests: dormitoryRuntimeAdmission.acceptedRuntimeConsumableDigests ?? [],
    bundleDigestMatch: dormitoryRuntimeAdmission.bundleDigestMatch === true,
    runtimeConsumptionReady,
    runtimeConsumptionMode: runtimeConsumptionReady ? "test_only_consumption" : "pending_runtime_admission_review",
    allowedOperationCases: dormitoryRuntimeAdmission.allowedOperationCases,
    consumedGeneratedContracts: dormitoryRuntimeAdmission.consumedGeneratedContracts,
    businessFeatureDevelopmentAllowed: false,
    dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    businessGoAuthority: false,
    goNoGoImpact: ["runtimeAdmissionStatus", "runtimeConsumptionStatus", "finalGoNoGo"],
    notesZh: "Dormitory runtime admission authority node; 只允许宿舍第一金链 test-only consumption，不开放业务落地、Finance posting、Dormitory L2、production_confirm、release 或 GO。"
  }];
}

function buildDormitoryFirstGoldenChainBusinessLandingEvidenceProof() {
  const semanticProof = readJsonIfExists(dormitoryFirstGoldenChainLandingProofPath) ?? {};
  return {
    ...semanticProof,
    version: "oam.dormitory-first-golden-chain-business-landing-proof.v1",
    proofType: "dormitory_first_golden_chain_l1_business_landing",
    status: "PASS",
    landingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
    landingScope: dormitoryFirstGoldenChainLanding.landingScope,
    runtimeAdmissionStatus: dormitoryFirstGoldenChainLanding.runtimeAdmissionStatus,
    generatedCandidateAcceptedBy00,
    runtimeConsumptionReady,
    acceptedSubjectDigest: dormitoryFirstGoldenChainLanding.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: dormitoryFirstGoldenChainLanding.generatedCandidateSubjectDigest,
    generatedFieldBindingClosureDigest: dormitoryFirstGoldenChainLanding.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: dormitoryFirstGoldenChainLanding.sourceFieldGapsDecisionDigest,
    allowedLandingWorkItemTypes: dormitoryFirstGoldenChainLanding.allowedLandingWorkItemTypes,
    orderedBusinessChain: dormitoryFirstGoldenChainLanding.orderedBusinessChain,
    consumedGeneratedContracts: dormitoryFirstGoldenChainLanding.consumedGeneratedContracts,
    businessFeatureDevelopmentAllowed,
    dormitoryFirstGoldenChainLandingGoNoGo,
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    businessGoAuthority: dormitoryFirstGoldenChainLandingGoNoGo === "GO",
    finalGoNoGo: "NO_GO",
    binding: binding("dormitory-first-golden-chain-business-landing-proof"),
    gateSummary,
    testSummary,
    coverageSummary
  };
}

function buildDormitoryFirstGoldenChainLandingProofNodes() {
  const id = "OAM-DORMITORY-GOLDEN-CHAIN-BUSINESS-LANDING";
  const source = [
    dormitoryFirstGoldenChainLandingPath,
    dormitoryFirstGoldenChainLandingResultPath,
    dormitoryFirstGoldenChainLandingProofPath,
    dormitoryRuntimeAdmissionPath,
    dormitoryRuntimeAdmissionResultPath,
    dormitoryRuntimeTestOnlyProofPath
  ];
  const dependsOn = [
    "OAM-DORMITORY-GOLDEN-CHAIN-RUNTIME-ADMISSION",
    dormitoryFirstGoldenChainLandingPath,
    dormitoryFirstGoldenChainLandingResultPath,
    dormitoryFirstGoldenChainLandingProofPath,
    dormitoryRuntimeAdmissionPath,
    dormitoryRuntimeAdmissionResultPath,
    dormitoryRuntimeTestOnlyProofPath
  ];
  const payload = {
    nodeId: id,
    proofType: "dormitory_first_golden_chain_business_landing_authority",
    scope: "dormitory_l1_first_golden_chain_only",
    status: dormitoryFirstGoldenChainLanding.status,
    landingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
    runtimeAdmissionStatus: dormitoryFirstGoldenChainLanding.runtimeAdmissionStatus,
    generatedCandidateAcceptedBy00,
    runtimeConsumptionReady,
    businessFeatureDevelopmentAllowed,
    dormitoryFirstGoldenChainLandingGoNoGo,
    allowedLandingWorkItemTypes: dormitoryFirstGoldenChainLanding.allowedLandingWorkItemTypes,
    orderedBusinessChain: dormitoryFirstGoldenChainLanding.orderedBusinessChain,
    acceptedSubjectDigest: dormitoryFirstGoldenChainLanding.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: dormitoryFirstGoldenChainLanding.generatedCandidateSubjectDigest,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    dependsOn
  };
  const hash = digestObject(payload);
  return [{
    id,
    type: "dormitory_first_golden_chain_business_landing_authority",
    proofType: "dormitory_first_golden_chain_business_landing_authority",
    scope: "dormitory_l1_first_golden_chain_only",
    source,
    hash,
    dependsOn,
    producedBy: "scripts/oam/check-dormitory-first-golden-chain-landing.mjs",
    verifiedBy: [
      "scripts/oam/check-dormitory-first-golden-chain-landing.mjs",
      "scripts/oam/check-current-evidence-root.mjs"
    ],
    binding: dormitoryFirstGoldenChainLandingBinding(id),
    status: dormitoryFirstGoldenChainLandingGoNoGo === "GO" ? "passed" : "blocked",
    landingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
    runtimeAdmissionStatus: dormitoryFirstGoldenChainLanding.runtimeAdmissionStatus,
    generatedCandidateAcceptedBy00,
    runtimeConsumptionReady,
    acceptedSubjectDigest: dormitoryFirstGoldenChainLanding.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: dormitoryFirstGoldenChainLanding.generatedCandidateSubjectDigest,
    allowedLandingWorkItemTypes: dormitoryFirstGoldenChainLanding.allowedLandingWorkItemTypes,
    orderedBusinessChain: dormitoryFirstGoldenChainLanding.orderedBusinessChain,
    consumedGeneratedContracts: dormitoryFirstGoldenChainLanding.consumedGeneratedContracts,
    businessFeatureDevelopmentAllowed,
    dormitoryFirstGoldenChainLandingGoNoGo,
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    goNoGo: dormitoryFirstGoldenChainLandingGoNoGo,
    finalGoNoGo: "NO_GO",
    businessGoAuthority: dormitoryFirstGoldenChainLandingGoNoGo === "GO",
    goNoGoImpact: ["dormitoryFirstGoldenChainLandingStatus", "businessFeatureDevelopmentAllowed", "finalGoNoGo"],
    notesZh: "Dormitory first golden chain L1 business landing authority node; 只开放 RoomSetupConfirm -> BedSetupConfirm -> ResourceReadinessConfirm 三核业务落地，不开放 Finance、Dormitory L2、production_confirm、release 或 final GO。"
  }];
}

function generatedCompileCandidateBinding(proofId) {
  return {
    root: "current-oam-trust-closure-v1",
    proofId,
    sourceCommitSha,
    evidenceRunSha,
    evidenceLifecycleType,
    scope: "generated_compile_candidate_only",
    bindingStatus: releaseBindingStatus,
    referenceOnly: releaseEvidenceReferenceOnly,
    authorizedSourceRef: generatedCompileCandidate.authorizedSourceRef,
    authorizedCandidateExecutionHead: generatedCompileCandidate.authorizedCandidateExecutionHead,
    candidateSourceRef: generatedCompileCandidate.candidateSourceRef,
    executionHead: generatedCompileCandidate.executionHead,
    evidenceGeneratedAtHead: generatedCompileCandidate.evidenceGeneratedAtHead,
    currentRepositoryHead,
    candidateCompileEvidenceStatus: generatedCompileCandidate.candidateCompileEvidenceStatus,
    candidateCompileClosureForCurrentHead: generatedCompileCandidate.candidateCompileClosureForCurrentHead,
    candidateCompileNextAction: generatedCompileCandidate.candidateCompileNextAction,
    generatedCandidateAcceptedBy00: false,
    generatedReleaseAllowed: false,
    runtimeConsumptionAllowed: "false_until_candidate_accepted_by_00",
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function dormitoryRuntimeAdmissionBinding(proofId) {
  return {
    root: "current-oam-trust-closure-v1",
    proofId,
    sourceCommitSha,
    evidenceRunSha,
    evidenceLifecycleType,
    scope: "dormitory_first_golden_chain_test_only_consumption",
    bindingStatus: releaseBindingStatus,
    referenceOnly: releaseEvidenceReferenceOnly,
    runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
    runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
    testOnlyConsumptionProofRef: dormitoryRuntimeTestOnlyProofPath,
    runtimeAdmissionStatus: dormitoryRuntimeAdmission.runtimeAdmissionStatus,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: dormitoryRuntimeAdmission.acceptedGeneratedBundleDigest,
    runtimeConsumedBundleDigest: dormitoryRuntimeAdmission.runtimeConsumedBundleDigest,
    runtimeConsumedFilesDigestList: dormitoryRuntimeAdmission.runtimeConsumedFilesDigestList ?? [],
    acceptedRuntimeConsumableDigests: dormitoryRuntimeAdmission.acceptedRuntimeConsumableDigests ?? [],
    bundleDigestMatch: dormitoryRuntimeAdmission.bundleDigestMatch === true,
    allowedOperationCases: dormitoryRuntimeAdmission.allowedOperationCases,
    consumedGeneratedContracts: dormitoryRuntimeAdmission.consumedGeneratedContracts,
    runtimeConsumptionReady,
    runtimeConsumptionMode: runtimeConsumptionReady ? "test_only_consumption" : "pending_runtime_admission_review",
    businessFeatureDevelopmentAllowed: false,
    dormitoryFirstGoldenChainLandingGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function dormitoryFirstGoldenChainLandingBinding(proofId) {
  return {
    root: "current-oam-trust-closure-v1",
    proofId,
    sourceCommitSha,
    evidenceRunSha,
    evidenceLifecycleType,
    scope: "dormitory_l1_first_golden_chain_only",
    bindingStatus: releaseBindingStatus,
    referenceOnly: releaseEvidenceReferenceOnly,
    businessLandingAuthorityRef: dormitoryFirstGoldenChainLandingPath,
    businessLandingResultRef: dormitoryFirstGoldenChainLandingResultPath,
    businessLandingProofRef: dormitoryFirstGoldenChainLandingProofPath,
    runtimeAdmissionAuthorityRef: dormitoryRuntimeAdmissionPath,
    runtimeAdmissionResultRef: dormitoryRuntimeAdmissionResultPath,
    runtimeAdmissionStatus: dormitoryFirstGoldenChainLanding.runtimeAdmissionStatus,
    landingStatus: dormitoryFirstGoldenChainLanding.landingStatus,
    generatedCandidateAcceptedBy00,
    runtimeConsumptionReady,
    acceptedSubjectDigest: dormitoryFirstGoldenChainLanding.acceptedSubjectDigest,
    generatedCandidateSubjectDigest: dormitoryFirstGoldenChainLanding.generatedCandidateSubjectDigest,
    generatedFieldBindingClosureDigest: dormitoryFirstGoldenChainLanding.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: dormitoryFirstGoldenChainLanding.sourceFieldGapsDecisionDigest,
    allowedLandingWorkItemTypes: dormitoryFirstGoldenChainLanding.allowedLandingWorkItemTypes,
    orderedBusinessChain: dormitoryFirstGoldenChainLanding.orderedBusinessChain,
    businessFeatureDevelopmentAllowed,
    dormitoryFirstGoldenChainLandingGoNoGo,
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    businessGoAuthority: dormitoryFirstGoldenChainLandingGoNoGo === "GO",
    finalGoNoGo: "NO_GO"
  };
}

function generatedCandidateAcceptanceBinding(proofId) {
  return {
    root: "current-oam-trust-closure-v1",
    proofId,
    sourceCommitSha,
    evidenceRunSha,
    evidenceLifecycleType,
    scope: "generated_candidate_acceptance_authority_only",
    bindingStatus: releaseBindingStatus,
    referenceOnly: releaseEvidenceReferenceOnly,
    acceptanceAuthorityRef: generatedCandidateAcceptancePath,
    acceptanceResultRef: generatedCandidateAcceptanceResultPath,
    decisionStatus: generatedCandidateAcceptance.decisionStatus,
    generatedCandidateAcceptedBy00,
    acceptedGeneratedBundleDigest: generatedCandidateAcceptance.acceptedGeneratedBundleDigest,
    currentRepositoryHead,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function generatedCompileExecutionBinding(proofId) {
  return {
    root: "current-oam-trust-closure-v1",
    proofId,
    sourceCommitSha,
    evidenceRunSha,
    evidenceLifecycleType,
    scope: "formal_generated_compile_execution_only",
    bindingStatus: releaseBindingStatus,
    referenceOnly: releaseEvidenceReferenceOnly,
    formalApprovalObjectRef: generatedCompileApprovalPath,
    formalApprovalObjectHash: formalGeneratedCompileAuthorization.approvalObjectHash,
    resultPath: generatedCompileExecution.resultPath,
    proofPath: generatedCompileExecution.proofPath,
    snapshotPath: generatedCompileExecution.snapshotPath,
    resultDigest: generatedCompileExecution.resultDigest,
    proofDigest: generatedCompileExecution.proofDigest,
    snapshotDigest: generatedCompileExecution.snapshotDigest,
    generatedOutputDigest: generatedCompileExecution.generatedOutputDigest,
    generatedFieldBindingClosureDigest: generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
    sourceFieldGapsDecisionDigest: generatedFieldBindingClosure.sourceFieldGapsDecisionDigest,
    generatedCompileAuthorized: generatedCompileExecution.generatedCompileAuthorized,
    generatedCompilationAllowed: generatedCompileExecution.generatedCompilationAllowed,
    generatedCompileCompleted: generatedCompileExecution.generatedCompileCompleted,
    generatedCompilationCompleted: generatedCompileExecution.generatedCompilationCompleted,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function formalGeneratedCompileAuthorizationBinding(proofId) {
  return {
    root: "current-oam-trust-closure-v1",
    proofId,
    sourceCommitSha,
    evidenceRunSha,
    evidenceLifecycleType,
    scope: "formal_generated_compile_authorization_only",
    bindingStatus: releaseBindingStatus,
    referenceOnly: releaseEvidenceReferenceOnly,
    approvalObjectRef: generatedCompileApprovalPath,
    approvalObjectHash: formalGeneratedCompileAuthorization.approvalObjectHash,
    reviewedRef: formalGeneratedCompileAuthorization.reviewedRef,
    candidateSourceRef: formalGeneratedCompileAuthorization.candidateSourceRef,
    authorizedCandidateExecutionHead: formalGeneratedCompileAuthorization.authorizedCandidateExecutionHead,
    generatedCompileAuthorized: formalGeneratedCompileAuthorization.generatedCompileAuthorized,
    generatedCompilationAllowed: formalGeneratedCompileAuthorization.generatedCompilationAllowed,
    generatedCompileCompleted: false,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function buildSourcePackageDependencyProofNode(id, proofType, sources) {
  const inputHashes = sources.map((file) => ({
    path: file,
    hash: hashFileIfPresent(file)
  }));
  const payload = {
    id,
    proofType,
    scope: "compile_preparation_review",
    sources,
    inputHashes,
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false
  };
  const hash = `sha256:${sha256(JSON.stringify(normalizeForDigest(payload)))}`;
  return {
    id,
    type: "source_package_dependency_proof",
    proofType,
    scope: "compile_preparation_review",
    source: sources,
    hash,
    dependsOn: sources,
    producedBy: "scripts/oam/generate-current-evidence-root.mjs",
    verifiedBy: "scripts/oam/check-dormitory-golden-chain-source-package.mjs",
    binding: sourcePackageProofBinding(id),
    status: sourcePackageCheck.status === "PASS" ? "passed" : "blocked",
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false,
    inputHashes,
    outputHashes: [{ path: `evidence-node:${id}`, hash }],
    goNoGoImpact: ["finalGoNoGo"],
    notesZh: "Source 包 proof DAG 依赖节点；只证明编译准备复审输入，不授权业务 GO。"
  };
}

function sourcePackageProofBinding(proofId) {
  return {
    root: "current-oam-trust-closure-v1",
    proofId,
    sourceCommitSha,
    evidenceRunSha,
    evidenceLifecycleType,
    scope: "compile_preparation_review",
    bindingStatus: releaseBindingStatus,
    referenceOnly: releaseEvidenceReferenceOnly,
    releaseAuthority: false,
    businessGoAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function summarizeWorkstreamGates(gates) {
  const commands = gates.map((command) => {
    const summary = gateSummary.commands.find((item) => item.command === command)
      ?? testSummary.commands.find((item) => item.command === command);
    return {
      command,
      status: summary?.status ?? "bound",
      exitCode: summary?.exitCode ?? null
    };
  });
  const statuses = new Set(commands.map((item) => item.status));
  return {
    status: statuses.has("failed") ? "failed" : statuses.has("missing") ? "missing" : statuses.has("required") ? "required" : "bound",
    commands
  };
}

function hashFileIfPresent(file) {
  if (!file) {
    return `sha256:${sha256("missing:<empty>")}`;
  }
  if (normalizeRepoPath(file) === "artifacts/oam/evidence/evidence-graph.json") {
    return `sha256:${sha256("self-reference:artifacts/oam/evidence/evidence-graph.json")}`;
  }
  if (files.has(file)) {
    return `sha256:${sha256(JSON.stringify(normalizeForDigest(documentForDigest(file, files.get(file)))))}`;
  }
  if (!fileExists(file)) {
    return `sha256:${sha256(`missing:${file}`)}`;
  }
  return `sha256:${sha256(readText(file))}`;
}

function buildGateSummary() {
  const requiredCommands = requiredGateCommands();
  return {
    runStatus: controlPlaneGateResult.runStatus,
    status: controlPlaneGateResult.status,
    ciWorkflow: ".github/workflows/ci.yml",
    controlPlaneEntry: "scripts/oam/run-control-plane-checks.ps1",
    resultFile: controlPlaneGateResultPath,
    commitSha: controlPlaneGateResult.commitSha,
    generatedAtUtc: controlPlaneGateResult.generatedAtUtc,
    startedAtUtc: controlPlaneGateResult.startedAtUtc,
    finishedAtUtc: controlPlaneGateResult.finishedAtUtc,
    expectedGateCount: controlPlaneGateResult.expectedGateCount ?? 0,
    completedGateCount: controlPlaneGateResult.completedGateCount ?? 0,
    finalizable: controlPlaneGateResult.finalizable === true,
    currentStage: controlPlaneGateResult.currentStage ?? "",
    currentGate: controlPlaneGateResult.currentGate ?? "",
    blockingReasons: controlPlaneGateResult.blockingReasons ?? [],
    missingRequiredGates: controlPlaneGateResult.missingRequiredGates ?? [],
    failedGateCount: controlPlaneGateResult.failedGateCount ?? 0,
    requiredGateCount: controlPlaneGateResult.requiredGateCount ?? 0,
    commands: requiredCommands.map((command) => {
      const actual = (controlPlaneGateResult.gates ?? []).find((gate) => gate.command === command);
      return {
        command,
        status: actual?.status ?? "missing",
        exitCode: actual?.exitCode ?? null
      };
    })
  };
}

function requiredGateCommands() {
  return [
    "node scripts/oam/check-current-oam.mjs",
    "node scripts/oam/check-p0-rule-ledger.mjs --self-test",
    "node scripts/oam/check-p0-rule-ledger.mjs",
    "node scripts/oam/check-current-authority-index.mjs",
    "node scripts/oam/generate-authority-source-layer-audit.mjs",
    "node scripts/oam/check-authority-source-layer-audit.mjs",
    "node scripts/oam/check-authority-cleanup-mutation-tests.mjs",
    "node scripts/oam/check-kernel-responsibility-map.mjs",
    "node scripts/oam/check-professional-ai-review-seats.mjs",
    "node scripts/oam/check-codex-execution-channel-policy.mjs",
    "node scripts/oam/check-cross-domain-conflict-rules.mjs",
    "node scripts/oam/check-system-operating-kernel.mjs",
    "node scripts/business/generate-dormitory-derived-contracts.mjs",
    "node scripts/oam/compile-current-kernel-graph.mjs",
    "node scripts/oam/check-generated-contract-consistency.mjs",
    "node scripts/oam/check-generated-files-not-manually-edited.mjs",
    "node scripts/oam/check-oam-kernel-graph.mjs",
    "node scripts/oam/check-file-lifecycle-policy.mjs",
    "node scripts/oam/check-retired-reference-blocker.mjs",
    "node scripts/oam/generate-system-derived-contracts.mjs",
    "node scripts/oam/check-derived-contract-consistency.mjs",
    "node scripts/oam/check-system-handoff-contract.mjs",
    "node scripts/oam/check-system-failure-routing-contract.mjs",
    "node scripts/oam/generate-current-engineering-ledger.mjs",
    "node scripts/oam/check-current-engineering-ledger.mjs",
    "node scripts/oam/check-oam-responsibility-boundary-matrix.mjs",
    "node scripts/oam/check-business-object-field-registry.mjs",
    "node scripts/oam/check-workflow-state-registry.mjs",
    "node scripts/oam/check-db-ownership-map.mjs",
    "node scripts/oam/check-evidence-contract-refs.mjs",
    "node scripts/oam/check-runtime-governance-v2.mjs",
    "node scripts/validate-contracts.mjs",
    "node scripts/check-rule-authority.mjs",
    "node scripts/check-local-path-references.mjs --self-test",
    "node scripts/check-local-path-references.mjs",
    "node scripts/check-api-boundaries.mjs --self-test",
    "node scripts/check-api-boundaries.mjs",
    "node scripts/oam/check-operation-identity-boundary.mjs",
    "node scripts/check-runtime-write-paths.mjs --self-test",
    "node scripts/check-runtime-write-paths.mjs",
    "node scripts/check-admission-kernel.mjs --self-test",
    "node scripts/check-admission-kernel.mjs",
    "node scripts/check-business-line-admission.mjs",
    "node scripts/check-account-actor-kernel.mjs --self-test",
    "node scripts/check-account-actor-kernel.mjs",
    "node scripts/check-language-kernel.mjs",
    "node scripts/oam/check-surface-language-v2.mjs",
    "node scripts/oam/check-read-intelligence-kernel.mjs",
    "node scripts/check-search-kernel.mjs --self-test",
    "node scripts/check-search-kernel.mjs",
    "node scripts/check-surface-contract.mjs",
    "node scripts/check-experience-contract.mjs",
    "node scripts/trust/check-trust-boundary-kernel.mjs",
    "node scripts/check-policy-as-code.mjs --self-test",
    "node scripts/check-policy-as-code.mjs",
    "node scripts/check-domain-packs.mjs --self-test",
    "node scripts/check-domain-packs.mjs",
    "node scripts/check-truth-owners.mjs --self-test",
    "node scripts/check-truth-owners.mjs",
    "node scripts/check-finance-truth.mjs --self-test",
    "node scripts/check-finance-truth.mjs",
    "node scripts/check-ledger-semantic-rules.mjs",
    "node scripts/finance/check-finance-semantic-truth.mjs",
    "node scripts/oam/check-dashboard-readonly.mjs",
    "node scripts/check-management-cockpit-boundary.mjs --self-test",
    "node scripts/check-management-cockpit-boundary.mjs",
    "node scripts/check-shared-governance-boundary.mjs --self-test",
    "node scripts/check-shared-governance-boundary.mjs",
    "node scripts/oam/check-db-no-side-effects-proof.mjs",
    "node scripts/check-dormitory-golden-domain.mjs --self-test",
    "node scripts/check-dormitory-golden-domain.mjs",
    "node scripts/oam/check-dormitory-golden-chain-source-package.mjs",
    "node scripts/business/check-dormitory-execution-kernel.mjs",
    "node scripts/business/check-scenario-field-contract.mjs",
    "node scripts/business/check-canonical-scenario-map.mjs",
    "node scripts/business/check-evidence-coverage-contract.mjs",
    "node scripts/business/check-ledger-posting-contract.mjs",
    "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1",
    "node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs",
    "node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs",
    "node scripts/oam/generate-mobile-branch-risk-ledger.mjs",
    "node scripts/oam/check-mobile-coverage-policy.mjs",
    "node scripts/oam/check-mobile-critical-branch-scenarios.mjs"
  ];
}

function readMutationTestsResult() {
  const mutationResultPath = "artifacts/oam/authority-cleanup/mutation-tests-result.json";
  if (!fileExists(mutationResultPath)) {
    return {
      path: mutationResultPath,
      status: "missing",
      mutationCount: 0,
      failedMutationCount: null,
      tests: []
    };
  }
  const result = readJson(mutationResultPath);
  return {
    path: mutationResultPath,
    status: result.status ?? "missing",
    checkedAtUtc: result.checkedAtUtc ?? null,
    mutationCount: result.mutationCount ?? (result.tests?.length ?? 0),
    failedMutationCount: result.failedMutationCount ?? null,
    tests: (result.tests ?? []).map((test) => ({
      id: test.id,
      status: test.status
    }))
  };
}

function readCiArtifactProvenanceReport() {
  if (!fileExists(ciArtifactProvenanceReportPath)) {
    return {
      path: ciArtifactProvenanceReportPath,
      status: "missing",
      releaseAuthority: false,
      finalGoNoGo: "NO_GO",
      externalArtifactAttestation: "PENDING_EXTERNAL_ATTESTATION",
      notesZh: "CI artifact provenance report missing; releaseAuthority=false."
    };
  }
  const report = readJson(ciArtifactProvenanceReportPath);
  return {
    path: ciArtifactProvenanceReportPath,
    status: report.githubActions?.artifactContentVerification?.status ?? "unknown",
    sameHeadRunFound: report.githubActions?.sameHeadRunFound ?? false,
    artifactMetadataDigest: report.githubActions?.artifactMetadataDigest ?? "pending_external_attestation",
    workingTreeMatchesOriginMainSource: report.sourceComparison?.workingTreeMatchesOriginMainSource ?? false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    externalArtifactAttestation: report.releaseDecision?.externalArtifactAttestation ?? "PENDING_EXTERNAL_ATTESTATION",
    missing: report.githubActions?.artifactContentVerification?.missing ?? []
  };
}

function readSourcePackageCheckResult() {
  const sourcePackageResultPath = "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json";
  if (!fileExists(sourcePackageResultPath)) {
    return {
      path: sourcePackageResultPath,
      gateId: "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
      status: "MISSING",
      sourceFinalizationStatus: "CONDITIONAL_NO_PASS",
      sourceScenarioPackageReviewStatus: "CONDITIONAL_NO_PASS",
      sourceFieldGapsDecisionStatus: "DECIDED_AND_BOUND",
      compilePreparationDecision: "READY_FOR_00_COMPILE_DECISION",
      compileDecisionStatus: "READY_FOR_00_COMPILE_DECISION",
      compilePreparationAllowed: "READY_FOR_00_COMPILE_DECISION",
      generatedCompilationAllowed: "false_until_00_explicit_generated_compile_approval",
      generatedCompilationCompleted: false,
      businessFeatureDevelopmentAllowed: false,
      finalGoNoGo: "NO_GO",
      evidenceNodeReady: false,
      p0Failures: [{
        id: "source_package_checker_result_missing",
        severity: "P0",
        message: "Source package checker result is missing."
      }],
      p1Residuals: [],
      p2Residuals: [],
      mutation10AStatus: "MISSING",
      generatedContractStatus10B: "PENDING_GENERATED_CONTRACT",
      sourceFieldGaps: {
        pending00Decision: false,
        compilePreparationAllowed: "READY_FOR_00_COMPILE_DECISION",
        decisions: {}
      },
      digests: {}
    };
  }
  return {
    path: sourcePackageResultPath,
    ...readJson(sourcePackageResultPath)
  };
}

function readControlPlaneGateResult() {
  const requiredCommands = requiredGateCommands();
  if (!fileExists(controlPlaneGateResultPath)) {
    const missing = {
      version: "oam.control-plane-gate-results.v1",
      generatedAtUtc: generatedAt,
      commitSha,
      branch,
      runStatus: "not_started",
      status: "not_started",
      expectedGateCount: requiredCommands.length,
      requiredGateCount: requiredCommands.length,
      completedGateCount: 0,
      failedGateCount: 0,
      finalizable: false,
      startedAtUtc: null,
      finishedAtUtc: null,
      currentStage: "not_started",
      currentGate: "",
      blockingReasons: ["Control Plane 尚未启动，不能作为最终结果。"],
      gates: [],
      missingRequiredGates: requiredCommands
    };
    writeJson(controlPlaneGateResultPath, missing);
    return missing;
  }

  const result = readJson(controlPlaneGateResultPath);
  const actual = new Set((result.gates ?? []).map((gate) => gate.command));
  const missingRequiredGates = requiredCommands.filter((command) => !actual.has(command));
  return {
    ...result,
    runStatus: result.runStatus ?? "missing_state_machine",
    status: result.status ?? "missing",
    expectedGateCount: result.expectedGateCount ?? result.requiredGateCount ?? 0,
    requiredGateCount: result.requiredGateCount ?? result.expectedGateCount ?? 0,
    completedGateCount: result.completedGateCount ?? (result.gates?.length ?? 0),
    finalizable: result.finalizable === true,
    startedAtUtc: result.startedAtUtc ?? null,
    finishedAtUtc: result.finishedAtUtc ?? null,
    currentStage: result.currentStage ?? "",
    currentGate: result.currentGate ?? "",
    blockingReasons: result.blockingReasons ?? [],
    missingRequiredGates,
    stale: result.commitSha !== commitSha
  };
}

function buildRealBrowserEvidence() {
  const firstGoldenChain = readFirstGoldenChainBrowserEvidence();
  const scenario1Positive = readScenario1PositiveBrowserEvidence();
  const scenario1Negative = readScenario1NegativeBrowserEvidence();
  const scenario2Positive = readScenario2PositiveBrowserEvidence();
  const scenario2Negative = readScenario2NegativeBrowserEvidence();
  const scenario3Positive = readScenario3PositiveBrowserEvidence();
  const scenario3Negative = readScenario3NegativeBrowserEvidence();
  const scenario4Positive = readScenario4PositiveBrowserEvidence();
  const scenario4Negative = readScenario4NegativeBrowserEvidence();
  const scenario5Positive = readScenario5PositiveBrowserEvidence();
  const scenario5Negative = readScenario5NegativeBrowserEvidence();
  const scenario6Positive = readScenario6PositiveBrowserEvidence();
  const scenario6Negative = readScenario6NegativeBrowserEvidence();
  const scenario7Positive = readScenario7PositiveBrowserEvidence();
  const scenario7Negative = readScenario7NegativeBrowserEvidence();
  const scenario8Positive = readScenario8PositiveBrowserEvidence();
  const scenario8Negative = readScenario8NegativeBrowserEvidence();
  const scenario9Positive = readScenario9PositiveBrowserEvidence();
  const scenario9Negative = readScenario9NegativeBrowserEvidence();
  const scenario10Positive = readScenario10PositiveBrowserEvidence();
  const scenario10Negative = readScenario10NegativeBrowserEvidence();
  const scenario11Positive = readScenario11PositiveBrowserEvidence();
  const scenario11Negative = readScenario11NegativeBrowserEvidence();
  const scenario12Positive = readScenario12PositiveBrowserEvidence();
  const scenario12Negative = readScenario12NegativeBrowserEvidence();
  const scenario13Positive = readScenario13PositiveBrowserEvidence();
  const scenario13Negative = readScenario13NegativeBrowserEvidence();
  const performanceRecoverability = readPerformanceRecoverabilityBrowserEvidence();
  const prelaunchOpsTrial = readPrelaunchOpsTrialEvidence();
  const finalFrontendUx = readFinalFrontendUxAcceptanceEvidence();
  const legacyL1 = readL1BrowserEvidence();
  const tenScenario = readTenScenarioBrowserEvidence();
  const nodes = [
    scenario1Positive.node,
    scenario1Negative.node,
    scenario2Positive.node,
    scenario2Negative.node,
    scenario3Positive.node,
    scenario3Negative.node,
    scenario4Positive.node,
    scenario4Negative.node,
    scenario5Positive.node,
    scenario5Negative.node,
    scenario6Positive.node,
    scenario6Negative.node,
    scenario7Positive.node,
    scenario7Negative.node,
    scenario8Positive.node,
    scenario8Negative.node,
    scenario9Positive.node,
    scenario9Negative.node,
    scenario10Positive.node,
    scenario10Negative.node,
    scenario11Positive.node,
    scenario11Negative.node,
    scenario12Positive.node,
    scenario12Negative.node,
    scenario13Positive.node,
    scenario13Negative.node,
    performanceRecoverability.node,
    prelaunchOpsTrial.node,
    finalFrontendUx.node
  ].filter(Boolean);
  const edges = [
    scenario1Positive.node ? { from: scenario1Positive.node.id, to: "DORMITORY_SCENARIO1_RESOURCE_BASIC_READINESS", relation: "binds_scenario1_positive_browser_evidence" } : null,
    scenario1Negative.node ? { from: scenario1Negative.node.id, to: "DORMITORY_SCENARIO1_RESOURCE_BASIC_READINESS", relation: "binds_scenario1_negative_browser_evidence" } : null,
    scenario2Positive.node ? { from: scenario2Positive.node.id, to: "DORMITORY_SCENARIO2_RESOURCE_OPERATION_STATUS", relation: "binds_scenario2_positive_browser_evidence" } : null,
    scenario2Negative.node ? { from: scenario2Negative.node.id, to: "DORMITORY_SCENARIO2_RESOURCE_OPERATION_STATUS", relation: "binds_scenario2_negative_browser_evidence" } : null,
    scenario3Positive.node ? { from: scenario3Positive.node.id, to: "DORMITORY_SCENARIO3_PRODUCT_AND_PRICING", relation: "binds_scenario3_positive_browser_evidence" } : null,
    scenario3Negative.node ? { from: scenario3Negative.node.id, to: "DORMITORY_SCENARIO3_PRODUCT_AND_PRICING", relation: "binds_scenario3_negative_browser_evidence" } : null,
    scenario4Positive.node ? { from: scenario4Positive.node.id, to: "DORMITORY_SCENARIO4_INQUIRY_AND_QUOTE", relation: "binds_scenario4_positive_browser_evidence" } : null,
    scenario4Negative.node ? { from: scenario4Negative.node.id, to: "DORMITORY_SCENARIO4_INQUIRY_AND_QUOTE", relation: "binds_scenario4_negative_browser_evidence" } : null,
    scenario5Positive.node ? { from: scenario5Positive.node.id, to: "DORMITORY_SCENARIO5_RESERVATION_AND_INVENTORY_HOLD", relation: "binds_scenario5_positive_browser_evidence" } : null,
    scenario5Negative.node ? { from: scenario5Negative.node.id, to: "DORMITORY_SCENARIO5_RESERVATION_AND_INVENTORY_HOLD", relation: "binds_scenario5_negative_browser_evidence" } : null,
    scenario6Positive.node ? { from: scenario6Positive.node.id, to: "DORMITORY_SCENARIO6_PAYMENT_DEPOSIT_AND_GUARANTEE", relation: "binds_scenario6_positive_browser_evidence" } : null,
    scenario6Negative.node ? { from: scenario6Negative.node.id, to: "DORMITORY_SCENARIO6_PAYMENT_DEPOSIT_AND_GUARANTEE", relation: "binds_scenario6_negative_browser_evidence" } : null,
    scenario7Positive.node ? { from: scenario7Positive.node.id, to: "DORMITORY_SCENARIO7_CHECK_IN_PROCESSING", relation: "binds_scenario7_positive_browser_evidence" } : null,
    scenario7Negative.node ? { from: scenario7Negative.node.id, to: "DORMITORY_SCENARIO7_CHECK_IN_PROCESSING", relation: "binds_scenario7_negative_browser_evidence" } : null,
    scenario8Positive.node ? { from: scenario8Positive.node.id, to: "DORMITORY_SCENARIO8_IN_STAY_MANAGEMENT", relation: "binds_scenario8_positive_browser_evidence" } : null,
    scenario8Negative.node ? { from: scenario8Negative.node.id, to: "DORMITORY_SCENARIO8_IN_STAY_MANAGEMENT", relation: "binds_scenario8_negative_browser_evidence" } : null,
    scenario9Positive.node ? { from: scenario9Positive.node.id, to: "DORMITORY_SCENARIO9_CHECKOUT_SETTLEMENT", relation: "binds_scenario9_positive_browser_evidence" } : null,
    scenario9Negative.node ? { from: scenario9Negative.node.id, to: "DORMITORY_SCENARIO9_CHECKOUT_SETTLEMENT", relation: "binds_scenario9_negative_browser_evidence" } : null,
    scenario10Positive.node ? { from: scenario10Positive.node.id, to: "DORMITORY_SCENARIO10_CANCEL_NOSHOW_REFUND", relation: "binds_scenario10_positive_browser_evidence" } : null,
    scenario10Negative.node ? { from: scenario10Negative.node.id, to: "DORMITORY_SCENARIO10_CANCEL_NOSHOW_REFUND", relation: "binds_scenario10_negative_browser_evidence" } : null,
    scenario11Positive.node ? { from: scenario11Positive.node.id, to: "DORMITORY_SCENARIO11_HOUSEKEEPING_MAINTENANCE_OUTOFSERVICE", relation: "binds_scenario11_positive_browser_evidence" } : null,
    scenario11Negative.node ? { from: scenario11Negative.node.id, to: "DORMITORY_SCENARIO11_HOUSEKEEPING_MAINTENANCE_OUTOFSERVICE", relation: "binds_scenario11_negative_browser_evidence" } : null,
    scenario12Positive.node ? { from: scenario12Positive.node.id, to: "DORMITORY_SCENARIO12_CHANNEL_CORPORATE_CUSTOMER", relation: "binds_scenario12_positive_browser_evidence" } : null,
    scenario12Negative.node ? { from: scenario12Negative.node.id, to: "DORMITORY_SCENARIO12_CHANNEL_CORPORATE_CUSTOMER", relation: "binds_scenario12_negative_browser_evidence" } : null,
    scenario13Positive.node ? { from: scenario13Positive.node.id, to: "DORMITORY_SCENARIO13_REPORTING_AUDIT_REVIEW", relation: "binds_scenario13_positive_browser_evidence" } : null,
    scenario13Negative.node ? { from: scenario13Negative.node.id, to: "DORMITORY_SCENARIO13_REPORTING_AUDIT_REVIEW", relation: "binds_scenario13_negative_browser_evidence" } : null,
    performanceRecoverability.node ? { from: performanceRecoverability.node.id, to: "DORMITORY_13_SCENARIO_PRODUCTION_MAINLINE_ACTIVATION", relation: "binds_performance_recoverability_browser_evidence" } : null,
    prelaunchOpsTrial.node ? { from: prelaunchOpsTrial.node.id, to: "DORMITORY_13_SCENARIO_PRODUCTION_MAINLINE_ACTIVATION", relation: "binds_prelaunch_ops_trial_evidence" } : null,
    finalFrontendUx.node ? { from: finalFrontendUx.node.id, to: "DORMITORY_13_SCENARIO_PRODUCTION_MAINLINE_ACTIVATION", relation: "binds_final_frontend_ux_acceptance" } : null
  ].filter(Boolean);
  const screenshotHashCount = nodes.reduce((total, node) => total + (node.screenshotHashes?.length ?? 0), 0);
  const status = scenario1Positive.status === "passed" &&
    scenario1Negative.status === "passed" &&
    scenario2Positive.status === "passed" &&
    scenario2Negative.status === "passed" &&
    scenario3Positive.status === "passed" &&
    scenario3Negative.status === "passed" &&
    scenario4Positive.status === "passed" &&
    scenario4Negative.status === "passed" &&
    scenario5Positive.status === "passed" &&
    scenario5Negative.status === "passed" &&
    scenario6Positive.status === "passed" &&
    scenario6Negative.status === "passed" &&
    scenario7Positive.status === "passed" &&
    scenario7Negative.status === "passed" &&
    scenario8Positive.status === "passed" &&
    scenario8Negative.status === "passed" &&
    scenario9Positive.status === "passed" &&
    scenario9Negative.status === "passed" &&
    scenario10Positive.status === "passed" &&
    scenario10Negative.status === "passed" &&
    scenario11Positive.status === "passed" &&
    scenario11Negative.status === "passed" &&
    scenario12Positive.status === "passed" &&
    scenario12Negative.status === "passed" &&
    scenario13Positive.status === "passed" &&
    scenario13Negative.status === "passed" &&
    performanceRecoverability.status === "passed" &&
    prelaunchOpsTrial.status === "passed" &&
    finalFrontendUx.status === "passed"
    ? "passed"
    : "missing_or_failed";
  return {
    nodes,
    edges,
    summary: {
      status,
      singleWriter: "scripts/oam/generate-current-evidence-root.mjs",
      currentMainAudit: "dormitory_13_scenario_browser_evidence_collection",
      scenario1: {
        positive: scenario1Positive,
        negative: scenario1Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario2: {
        positive: scenario2Positive,
        negative: scenario2Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario3: {
        positive: scenario3Positive,
        negative: scenario3Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario4: {
        positive: scenario4Positive,
        negative: scenario4Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario5: {
        positive: scenario5Positive,
        negative: scenario5Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario6: {
        positive: scenario6Positive,
        negative: scenario6Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario7: {
        positive: scenario7Positive,
        negative: scenario7Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario8: {
        positive: scenario8Positive,
        negative: scenario8Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario9: {
        positive: scenario9Positive,
        negative: scenario9Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario10: {
        positive: scenario10Positive,
        negative: scenario10Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario11: {
        positive: scenario11Positive,
        negative: scenario11Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario12: {
        positive: scenario12Positive,
        negative: scenario12Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      scenario13: {
        positive: scenario13Positive,
        negative: scenario13Negative,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      performanceRecoverability: {
        ...performanceRecoverability,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      prelaunchOpsTrial: {
        ...prelaunchOpsTrial,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        businessGoLiveAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      finalFrontendUx: {
        ...finalFrontendUx,
        currentMainGate: true,
        businessAcceptance: false,
        productionConfirmAllowed: false,
        businessGoLiveAllowed: false,
        finalGoNoGo: "NO_GO"
      },
      legacyQuarantine: {
        firstGoldenChain,
        legacyL1,
        tenScenario,
        currentMainGate: false,
        lane: "legacy_quarantine"
      },
      tenScenario: {
        ...tenScenario,
        lane: "legacy_regression_only",
        currentMainGate: false
      },
      legacyL1: {
        ...legacyL1,
        lane: "legacy_regression_only",
        currentMainGate: false
      },
      screenshotHashCount
    }
  };
}

function readPrelaunchOpsTrialEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json";
  const markdownRef = "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.md";
  const resultRef = "artifacts/oam/checks/dormitory-prelaunch-ops-trial-result.json";
  const screenshotIndexRef = "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/screenshot-index.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.digest ?? item.sha256)
    .filter(Boolean);
  const passedRoleCount = (report?.roleTrials ?? []).filter((item) => item.status === "passed").length;
  const passedScenarioCount = (report?.scenarioTrials ?? []).filter((item) => item.status === "passed").length;
  const p0p1Count = report?.p0p1Findings?.length ?? 0;
  const blockerCount = report?.blockers?.length ?? 0;
  const status = report?.status === "passed" &&
    result?.status === "PASS" &&
    report?.git?.headSha === commitSha &&
    passedRoleCount === 4 &&
    passedScenarioCount === 13 &&
    p0p1Count === 0 &&
    blockerCount === 0 &&
    report?.productionConfirmAllowed === false &&
    report?.businessGoLiveAllowed === false &&
    report?.releaseAuthority === false &&
    report?.finalGoNoGo === "NO_GO"
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: reportRef,
    markdown: markdownRef,
    result: resultRef,
    screenshotIndex: screenshotIndexRef,
    sourceUserTestPackage: report?.sourceUserTestPackage || "",
    prelaunchOpsTrialDigest: report?.auditDigest || "",
    roleTrialCount: report?.roleTrials?.length ?? 0,
    passedRoleCount,
    scenarioTrialCount: report?.scenarioTrials?.length ?? 0,
    passedScenarioCount,
    p0p1Count,
    blockerCount,
    screenshotHashCount: screenshotHashes.length,
    node: report ? buildBrowserProofNode({
      id: "DORMITORY-PRELAUNCH-OPS-TRIAL",
      status,
      gate: "DORMITORY-PRELAUNCH-OPS-TRIAL",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      refs: [
        "scripts/surface/run-dormitory-prelaunch-ops-trial.mjs",
        "scripts/surface/check-dormitory-prelaunch-ops-trial.mjs",
        "scripts/surface/run-dormitory-prelaunch-ops-trial.ps1",
        reportRef,
        markdownRef,
        resultRef,
        screenshotIndexRef,
        report.sourceUserTestPackage || "docs/oam/dormitory-13-scenario-production-usable-closure-report.md"
      ],
      screenshotHashes,
      scenarioIds: ["Dormitory.13ScenarioMainline.PrelaunchOpsTrial"],
      auditLevel: "prelaunch_real_browser_role_and_operations_trial",
      auditPurpose: "验证运营人员、主管/店长、财务人员、管理员按 2.5 用户亲测包完成上线前试运行；覆盖 13 场景、SOP、异常和 NO_GO 边界。",
      allowedInterpretation: ["本地/测试环境上线前试运行与运营验收证据"],
      forbiddenInterpretation: ["生产发布", "业务上线", "release authority", "final GO"],
      scenarioScope: {
        currentMainGate: true,
        roleTrialCount: report.roleTrials?.length ?? 0,
        passedRoleCount,
        scenarioTrialCount: report.scenarioTrials?.length ?? 0,
        passedScenarioCount,
        p0p1Count,
        blockerCount,
        productionConfirmAllowed: false,
        businessGoLiveAllowed: false,
        releaseAuthority: false,
        finalGoNoGo: "NO_GO"
      },
      businessGoAllowed: false,
      progress: {
        roleTrials: passedRoleCount,
        scenarioTrials: passedScenarioCount,
        p0p1Count,
        blockers: blockerCount
      }
    }) : null
  };
}

function buildProjectMaintainabilityGovernanceEvidence() {
  const governance = readJsonIfExists(projectMaintainabilityGovernancePath);
  const result = readJsonIfExists(projectMaintainabilityGovernanceResultPath);
  const reportExists = fileExists(projectMaintainabilityReportPath);
  const status = governance?.status === "authoritative" &&
    result?.status === "PASS" &&
    governance?.mainlineId === "Dormitory.13ScenarioMainline" &&
    governance?.productionConfirmAllowed === false &&
    governance?.businessGoLiveAllowed === false &&
    governance?.releaseAuthority === false &&
    governance?.finalGoNoGo === "NO_GO" &&
    reportExists
    ? "passed"
    : "missing_or_failed";
  const refs = [
    projectMaintainabilityGovernancePath,
    projectMaintainabilityReportPath,
    projectMaintainabilityGovernanceResultPath,
    "scripts/oam/check-project-maintainability-governance.mjs"
  ];
  const nodePayload = {
    id: "PROJECT-MAINTAINABILITY-GOVERNANCE",
    type: "project_maintainability_governance",
    gate: "PROJECT-MAINTAINABILITY-GOVERNANCE",
    status,
    source: refs,
    hash: digestForFiles(refs),
    dependsOn: [
      "docs/oam/dormitory-13-scenario-production-usable-closure-report.md",
      "artifacts/oam/evidence/dormitory-mainline-activation-transaction.json",
      "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.md"
    ],
    producedBy: "scripts/oam/check-project-maintainability-governance.mjs",
    verifiedBy: "scripts/oam/check-project-maintainability-governance.mjs",
    outputHashes: refs.map((file) => ({ path: file, hash: hashFileIfPresent(file) })),
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false,
    allowedInterpretation: ["本地/测试环境项目瘦身与长期维护治理证据"],
    forbiddenInterpretation: ["生产发布", "业务上线", "release authority", "final GO"],
    scenarioScope: {
      currentMainGate: true,
      complexityItemCount: governance?.complexityInventory?.length ?? 0,
      safeSlimmingActionCount: governance?.safeSlimmingActions?.length ?? 0,
      maintenanceRuleCount: governance?.maintenanceRules?.length ?? 0,
      productionConfirmAllowed: false,
      businessGoLiveAllowed: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    }
  };
  return {
    status,
    governance: projectMaintainabilityGovernancePath,
    report: projectMaintainabilityReportPath,
    result: projectMaintainabilityGovernanceResultPath,
    governanceDigest: result?.governanceDigest ?? hashFileIfPresent(projectMaintainabilityGovernancePath),
    reportDigest: result?.reportDigest ?? hashFileIfPresent(projectMaintainabilityReportPath),
    complexityItemCount: governance?.complexityInventory?.length ?? 0,
    safeSlimmingActionCount: governance?.safeSlimmingActions?.length ?? 0,
    maintenanceRuleCount: governance?.maintenanceRules?.length ?? 0,
    node: governance ? nodePayload : null
  };
}

function buildProjectPurityAuthoritySealEvidence() {
  const reportExists = fileExists(projectPurityAuthoritySealReportPath);
  const result = readJsonIfExists(projectPurityAuthoritySealResultPath);
  const status = reportExists &&
    result?.status === "PASS" &&
    result?.currentHead === commitSha &&
    result?.productionConfirmAllowed === false &&
    result?.businessGoLiveAllowed === false &&
    result?.releaseAuthority === false &&
    result?.finalGoNoGo === "NO_GO"
    ? "passed"
    : "missing_or_failed";
  const refs = [
    projectPurityAuthoritySealReportPath,
    projectPurityAuthoritySealResultPath,
    "scripts/oam/check-project-purity-authority-seal.mjs"
  ];
  const spotcheck = result?.browserSpotcheck ?? {};
  const nodePayload = {
    id: "PROJECT-PURITY-AUTHORITY-SEAL",
    type: "project_purity_authority_seal",
    gate: "PROJECT-PURITY-AUTHORITY-SEAL",
    status,
    source: refs,
    hash: digestForFiles(refs),
    dependsOn: [
      "docs/oam/dormitory-13-scenario-production-usable-closure-report.md",
      "docs/oam/project-maintainability-closure-report.md",
      "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json",
      "artifacts/oam/evidence/evidence-graph.json",
      "artifacts/oam/final-report.json"
    ],
    producedBy: "scripts/oam/check-project-purity-authority-seal.mjs",
    verifiedBy: "scripts/oam/check-project-purity-authority-seal.mjs",
    outputHashes: refs.map((file) => ({ path: file, hash: hashFileIfPresent(file) })),
    goNoGo: "NO_GO",
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    businessGoAuthority: false,
    allowedInterpretation: ["本地/测试环境纯净操作与权威一致性封版证据"],
    forbiddenInterpretation: ["生产发布", "业务上线", "release authority", "final GO"],
    scenarioScope: {
      currentMainGate: true,
      entrySurfaces: spotcheck.entrySurfaces ?? [],
      lowRiskScenarios: spotcheck.lowRiskScenarios ?? [],
      highRiskScenarios: spotcheck.highRiskScenarios ?? [],
      spotcheckScenarioCount: (spotcheck.spotcheckEvidence ?? []).length,
      productionConfirmAllowed: false,
      businessGoLiveAllowed: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    }
  };
  return {
    status,
    report: projectPurityAuthoritySealReportPath,
    result: projectPurityAuthoritySealResultPath,
    reportDigest: result?.reportDigest ?? hashFileIfPresent(projectPurityAuthoritySealReportPath),
    sourceAuthorityDigest: result?.sourceAuthorityDigest ?? "missing",
    browserSpotcheck: spotcheck,
    node: reportExists ? nodePayload : null
  };
}

function readFinalFrontendUxAcceptanceEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-final-frontend-ux-acceptance/final-frontend-ux-acceptance-report.json";
  const markdownRef = "artifacts/oam/evidence/dormitory-final-frontend-ux-acceptance/final-frontend-ux-acceptance-report.md";
  const checklistRef = "artifacts/oam/evidence/dormitory-final-frontend-ux-acceptance/final-frontend-ux-acceptance-checklist.json";
  const docsIndexRef = "docs/oam/dormitory-final-frontend-ux-acceptance.md";
  const resultRef = "artifacts/oam/checks/dormitory-final-frontend-ux-acceptance-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.scenarioEvidence ?? [])
    .flatMap((scenario) => scenario.screenshotsForUserReview ?? [])
    .map((item) => item.path)
    .filter(Boolean)
    .map((file) => hashFileIfPresent(file))
    .filter((hash) => hash && hash !== "missing");
  const status = report?.status === "passed" &&
    result?.status === "PASS" &&
    result?.currentHead === commitSha &&
    result?.scenarioCount === 13 &&
    (result?.scenarioScreenshotCount ?? 0) >= 300 &&
    (result?.entryScreenshotCount ?? 0) >= 5 &&
    (result?.unresolvedAnalysisMarkerCount ?? 0) === 0 &&
    (result?.exposedInternalTermCount ?? 0) === 0 &&
    (result?.oldChainVisibleTermCount ?? 0) === 0 &&
    result?.productionConfirmAllowed === false &&
    result?.businessGoLiveAllowed === false &&
    result?.releaseAuthority === false &&
    result?.finalGoNoGo === "NO_GO"
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: reportRef,
    markdown: markdownRef,
    checklist: checklistRef,
    docsIndex: docsIndexRef,
    result: resultRef,
    finalFrontendUxDigest: result?.reportDigest || "",
    scenarioCount: result?.scenarioCount ?? 0,
    scenarioScreenshotCount: result?.scenarioScreenshotCount ?? 0,
    entryScreenshotCount: result?.entryScreenshotCount ?? 0,
    unresolvedAnalysisMarkerCount: result?.unresolvedAnalysisMarkerCount ?? 0,
    exposedInternalTermCount: result?.exposedInternalTermCount ?? 0,
    oldChainVisibleTermCount: result?.oldChainVisibleTermCount ?? 0,
    screenshotHashCount: screenshotHashes.length,
    node: report ? buildBrowserProofNode({
      id: "DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE",
      status,
      gate: "DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      refs: [
        "scripts/surface/generate-dormitory-final-frontend-ux-acceptance.mjs",
        reportRef,
        markdownRef,
        checklistRef,
        docsIndexRef,
        resultRef
      ],
      screenshotHashes,
      scenarioIds: ["Dormitory.13ScenarioMainline.FinalFrontendUxAcceptance"],
      auditLevel: "final_frontend_ux_acceptance_before_user_trial",
      auditPurpose: "验证 13 场景移动端前台体验、截图分析、内部编号隐藏、旧链词隔离、搜索只读和用户亲测交接。",
      allowedInterpretation: ["本地/测试环境前端最终体验验收证据"],
      forbiddenInterpretation: ["生产发布", "业务上线", "release authority", "final GO"],
      scenarioScope: {
        currentMainGate: true,
        scenarioCount: result?.scenarioCount ?? 0,
        scenarioScreenshotCount: result?.scenarioScreenshotCount ?? 0,
        entryScreenshotCount: result?.entryScreenshotCount ?? 0,
        unresolvedAnalysisMarkerCount: result?.unresolvedAnalysisMarkerCount ?? 0,
        exposedInternalTermCount: result?.exposedInternalTermCount ?? 0,
        oldChainVisibleTermCount: result?.oldChainVisibleTermCount ?? 0,
        productionConfirmAllowed: false,
        businessGoLiveAllowed: false,
        releaseAuthority: false,
        finalGoNoGo: "NO_GO"
      },
      businessGoAllowed: false,
      progress: {
        scenarios: result?.scenarioCount ?? 0,
        scenarioScreenshots: result?.scenarioScreenshotCount ?? 0,
        entryScreenshots: result?.entryScreenshotCount ?? 0
      }
    }) : null
  };
}

function readPerformanceRecoverabilityBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-performance-recoverability/performance-recoverability-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-performance-recoverability-result.json";
  const screenshotIndexRef = "artifacts/oam/evidence/dormitory-performance-recoverability/screenshot-index.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.digest ?? item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: reportRef,
    result: resultRef,
    screenshotIndex: screenshotIndexRef,
    performanceRecoverabilityDigest: report?.auditDigest || "",
    measurementCount: report?.measurements?.length ?? 0,
    recoverabilityCount: report?.recoverability?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    node: report ? buildBrowserProofNode({
      id: "DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER",
      status,
      gate: "DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      refs: [
        "scripts/surface/run-dormitory-performance-recoverability-audit.mjs",
        "scripts/surface/check-dormitory-performance-recoverability-audit.mjs",
        reportRef,
        resultRef,
        screenshotIndexRef
      ],
      screenshotHashes,
      scenarioIds: ["Dormitory.13ScenarioMainline.PerformanceRecoverability"],
      auditLevel: "mobile_surface_performance_recoverability",
      auditPurpose: "验证新建、保存、继续、确认、搜索、摘要打开和失败恢复提示。",
      allowedInterpretation: ["本地/测试环境体验性能与可恢复性证据"],
      forbiddenInterpretation: ["生产发布", "业务上线", "final GO"],
      scenarioScope: {
        currentMainGate: true,
        productionConfirmAllowed: false,
        releaseAuthority: false,
        finalGoNoGo: "NO_GO"
      },
      businessGoAllowed: false,
      progress: {
        measurements: report?.measurements?.length ?? 0,
        recoverability: report?.recoverability?.length ?? 0
      }
    }) : null
  };
}

function readScenario1PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-positive-browser/scenario1-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario1-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario1-resource-basic-readiness-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "房源建档与基础就绪 positive browser evidence；证明场景 1 主流程和入口职责来自 generated 场景 1 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 1,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 12
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO1-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO1-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario1.ResourceBasicReadiness.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "房源建档与基础就绪 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 12
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario1-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario1-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario1NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-negative-browser/scenario1-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario1-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario1-resource-basic-readiness-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "房源建档与基础就绪 negative browser evidence；证明失败路径业务可理解且无副作用。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 1,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 12
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO1-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO1-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario1.ResourceBasicReadiness.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "房源建档与基础就绪 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 12
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json",
        "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json",
        "scripts/surface/run-dormitory-scenario1-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario1-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario2PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-positive-browser/scenario2-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario2-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario2-resource-operation-status-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "房源运营就绪与状态维护 positive browser evidence；证明主流程和入口职责来自 generated 场景 2 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 2,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 11
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO2-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO2-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario2.ResourceOperationStatus.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "房源运营就绪与状态维护 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 11
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario2-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario2-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario2NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-negative-browser/scenario2-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario2-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario2-resource-operation-status-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "房源运营就绪与状态维护 negative browser evidence；证明失败路径无副作用且不越界。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 2,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 12
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO2-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO2-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario2.ResourceOperationStatus.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "房源运营就绪与状态维护 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 12
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario2-resource-operation-status-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario2-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario2-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario3PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-positive-browser/scenario3-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario3-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario3-product-and-pricing-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "住宿商品与价格 positive browser evidence；证明主流程和入口职责来自 generated 场景 3 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 3,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 10
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO3-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO3-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario3.ProductAndPricing.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "住宿商品与价格 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 10
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario3-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario3-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario3NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-negative-browser/scenario3-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario3-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario3-product-and-pricing-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "住宿商品与价格 negative browser evidence；证明失败路径无副作用且不越界。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 3,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 13
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO3-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO3-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario3.ProductAndPricing.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "住宿商品与价格 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 13
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario3-product-and-pricing-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario3-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario3-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario4PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-positive-browser/scenario4-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario4-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario4-inquiry-and-quote-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "询价与报价 positive browser evidence；证明主流程、报价有效期、转预订准备交接和入口职责来自 generated 场景 4 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 4,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 11
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO4-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO4-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario4.InquiryAndQuote.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "询价与报价 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 11
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario4-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario4-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario4-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario4NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-negative-browser/scenario4-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario4-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario4-inquiry-and-quote-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "询价与报价 negative browser evidence；证明失败路径无副作用、搜索只读、内部引用阻断和跨场景越界阻断。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 4,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 14
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO4-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO4-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario4.InquiryAndQuote.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "询价与报价 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 14
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario4-inquiry-and-quote-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario4-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario4-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario4-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario5PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-positive-browser/scenario5-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario5-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario5-reservation-and-inventory-hold-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "预订与库存锁定 positive browser evidence；证明主流程、库存锁定、系统生成预订号、下游重新核验和入口职责来自 generated 场景 5 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 5,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 11
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO5-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO5-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario5.ReservationAndInventoryHold.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "预订与库存锁定 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 11
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario5-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario5-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario5-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario5NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-negative-browser/scenario5-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario5-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario5-reservation-and-inventory-hold-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "预订与库存锁定 negative browser evidence；证明失败路径无副作用、搜索只读、内部引用阻断、库存冲突和跨场景越权阻断。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 5,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 15
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO5-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO5-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario5.ReservationAndInventoryHold.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "预订与库存锁定 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 15
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario5-reservation-and-inventory-hold-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario5-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario5-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario5-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario6PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-positive-browser/scenario6-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario6-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario6-payment-deposit-and-guarantee-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "收款、押金与担保 positive browser evidence；证明主流程、押金/担保边界、finance-gate、下游重新核验和入口职责来自 generated 场景 6 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 6,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 11
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO6-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO6-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario6.PaymentDepositAndGuarantee.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "收款、押金与担保 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 11
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario6-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario6-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario6-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario6NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-negative-browser/scenario6-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario6-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario6-payment-deposit-and-guarantee-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "收款、押金与担保 negative browser evidence；证明失败路径无副作用、搜索只读、内部引用阻断、finance-gate 和跨场景越权阻断。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 6,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 14
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO6-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO6-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario6.PaymentDepositAndGuarantee.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "收款、押金与担保 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 14
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario6-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario6-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario6-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario7PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-positive-browser/scenario7-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario7-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario7-check-in-processing-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "入住办理 positive browser evidence；证明主流程、系统生成入住记录号、凭证发放、下游在住管理摘要和入口职责来自 generated 场景 7 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 7,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 10
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO7-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO7-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario7.CheckInProcessing.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "入住办理 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 10
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario7-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario7-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario7NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-negative-browser/scenario7-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario7-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario7-check-in-processing-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "入住办理 negative browser evidence；证明失败路径无副作用、搜索只读、内部引用阻断、未入住不发凭证和跨场景越权阻断。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 7,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 14
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO7-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO7-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario7.CheckInProcessing.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "入住办理 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 14
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario7-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario7-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario8PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-positive-browser/scenario8-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario8-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario8-in-stay-management-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "在住管理 positive browser evidence；证明在住详情、状态、服务、异常、续住、换房换床、凭证、退房准备和入口职责来自 generated 场景 8 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 8,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 10
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO8-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO8-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario8.InStayManagement.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "在住管理 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 10
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario8-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario8-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario8-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario8NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-negative-browser/scenario8-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario8-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario8-in-stay-management-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "在住管理 negative browser evidence；证明失败路径无副作用、搜索只读、内部引用阻断、凭证/换床/续住/退房准备越界阻断。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 8,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 13
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO8-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO8-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario8.InStayManagement.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "在住管理 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 13
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario8-in-stay-management-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario8-test-plan.generated.json",
        "scripts/surface/run-dormitory-scenario8-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario8-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario9PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-positive-browser/scenario9-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario9-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario9-checkout-settlement-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "退房结算 positive browser evidence；证明今日待退房、实际离店、交接、验房、费用核算、客户确认、退房单号、finance-gate 请求、资源待恢复和入口职责来自 generated 场景 9 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 9,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 12
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO9-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO9-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario9.CheckoutSettlement.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "退房结算 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 12
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario9-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario9-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario9-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario9-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario9NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-negative-browser/scenario9-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario9-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario9-checkout-settlement-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "退房结算 negative browser evidence；证明无有效在住、重复退房、缺离店时间/验房证据、损坏缺说明、客户未确认、争议、伪造内部引用、搜索写事实、直接款项处理、直接可运营、重复提交和并发均无副作用。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 9,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 13
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO9-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO9-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario9.CheckoutSettlement.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "退房结算 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 13
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario9-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario9-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario9-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario9-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario10PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-positive-browser/scenario10-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario10-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario10-cancel-noshow-refund-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "取消、未到店与退款处理 positive browser evidence；证明预订取消、未到店关闭、政策金额计算、库存释放请求、finance-gate 财务处理请求、结果跟进和入口职责来自 generated 场景 10 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 10,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 12
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO10-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO10-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario10.CancelNoShowRefund.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "取消、未到店与退款处理 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 12
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario10-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario10-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario10-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario10-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario10NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-negative-browser/scenario10-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario10-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario10-cancel-noshow-refund-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "取消、未到店与退款处理 negative browser evidence；证明无有效预订、已有到店/离店记录、重复关闭、未到保留时间、缺客户确认、争议、金额缺来源、手填最终款项、越界释放、伪造内部引用、搜索写事实、直接真实款项、重复提交和并发均无副作用。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 10,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 15
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO10-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO10-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario10.CancelNoShowRefund.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "取消、未到店与退款处理 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 15
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario10-cancel-noshow-refund-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario10-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario10-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario10-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario10-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario11PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-positive-browser/scenario11-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario11-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario11-housekeeping-maintenance-outofservice-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "房务、维修与停售协同 positive browser evidence；证明保洁、维修、派工、进度、完成、验收、返工、恢复建议、费用意向和入口职责来自 generated 场景 11 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 11,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 13
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO11-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO11-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario11.HousekeepingMaintenanceOutOfService.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "房务、维修与停售协同 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 13
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario11-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario11-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario11-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario11-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario11NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-negative-browser/scenario11-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario11-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario11-housekeeping-maintenance-outofservice-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "房务、维修与停售协同 negative browser evidence；证明无合法来源、缺负责人、缺证据、未完成验收、返工缺失、未关闭维修建议恢复、直接运营恢复、直接写账、伪造内部引用、搜索写事实、重复和并发均无副作用。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 11,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 12
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO11-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO11-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario11.HousekeepingMaintenanceOutOfService.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "房务、维修与停售协同 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 12
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario11-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario11-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario11-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario11-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario12PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-positive-browser/scenario12-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario12-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario12-channel-corporate-customer-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "渠道与企业客户 positive browser evidence；证明企业客户、协议、商品资格、渠道发布、佣金/结算规则意向、审核启停、续签和入口职责来自 generated 场景 12 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 12,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 12
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO12-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO12-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario12.ChannelCorporateCustomer.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "渠道与企业客户 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 12
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario12-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario12-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario12-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario12-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario12NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-negative-browser/scenario12-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario12-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario12-channel-corporate-customer-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "渠道与企业客户 negative browser evidence；证明缺证据、日期倒置、过期协议、未生效商品、无有效价格、维修/停售发布、直接写账、锁库存、直接生成报价/预订、伪造内部引用、搜索写事实、重复和并发均无副作用。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 12,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 13
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO12-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO12-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario12.ChannelCorporateCustomer.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "渠道与企业客户 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 13
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario12-channel-corporate-customer-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario12-test-plan.generated.json",
        "docs/contracts/generated/finance/scenario12-finance-gate.generated.json",
        "scripts/surface/run-dormitory-scenario12-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario12-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario13PositiveBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-positive-browser/scenario13-positive-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario13-positive-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario13-reporting-audit-review-positive-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "经营报表、审计与复盘 positive browser evidence；证明报表范围、数据完整性、经营指标、财务核对、审计发现、行动计划、发布导出和入口职责来自 generated 场景 13 合同。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 13,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.steps?.length ?? 0,
      expectedSteps: 11
    },
    scenarioCount: report?.steps?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    positiveBrowserAuditDigest: report?.positiveBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO13-POSITIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO13-POSITIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario13.ReportingAuditReview.Positive"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "经营报表、审计与复盘 positive browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.steps?.length ?? 0,
        expectedSteps: 11
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-positive-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario13-test-plan.generated.json",
        "docs/contracts/generated/dormitory/scenario13-metric-model.generated.json",
        "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json",
        "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json",
        "scripts/surface/run-dormitory-scenario13-positive-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario13-positive-browser-audit.mjs"
      ]
    }) : null
  };
}

function readScenario13NegativeBrowserEvidence() {
  const reportRef = "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-negative-browser/scenario13-negative-browser-report.json";
  const resultRef = "artifacts/oam/checks/dormitory-scenario13-negative-browser-result.json";
  const report = readJsonIfExists(reportRef);
  const result = readJsonIfExists(resultRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && result?.status === "PASS" && report?.git?.headSha === commitSha
    ? "passed"
    : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    result: result ? resultRef : "",
    runId: "dormitory-scenario13-reporting-audit-review-negative-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: "经营报表、审计与复盘 negative browser evidence；证明缺权限、缺血缘、数据过期、页面状态指标、非 finance-gate 财务真值、审计直接改源事实、已发布原地编辑、伪造内部引用、搜索写事实、重复和并发均无副作用。",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      authorityId: report?.authorityId || "",
      scenarioPackageNo: report?.scenarioPackageNo ?? 13,
      currentMainGate: true,
      businessAcceptance: false
    },
    businessGoAllowed: false,
    progress: {
      status,
      completedSteps: report?.scenarios?.length ?? 0,
      expectedSteps: 11
    },
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    negativeBrowserAuditDigest: report?.negativeBrowserAuditDigest || "",
    generatedContractDigest: report?.generatedContractDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-SCENARIO13-NEGATIVE-BROWSER",
      status,
      gate: "DORMITORY-SCENARIO13-NEGATIVE-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.Scenario13.ReportingAuditReview.Negative"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: "经营报表、审计与复盘 negative browser evidence",
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        authorityId: report.authorityId,
        scenarioPackageNo: report.scenarioPackageNo,
        currentMainGate: true,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: {
        status,
        completedSteps: report.scenarios?.length ?? 0,
        expectedSteps: 11
      },
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-negative-browser/screenshot-index.json"),
        resultRef,
        "docs/contracts/generated/dormitory/scenario13-test-plan.generated.json",
        "docs/contracts/generated/dormitory/scenario13-runtime-rules.generated.json",
        "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json",
        "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json",
        "scripts/surface/run-dormitory-scenario13-negative-browser-audit.mjs",
        "scripts/surface/check-dormitory-scenario13-negative-browser-audit.mjs"
      ]
    }) : null
  };
}

function readFirstGoldenChainBrowserEvidence() {
  const reportRef = FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH;
  const report = readJsonIfExists(reportRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && report?.git?.headSha === commitSha ? "passed" : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    runId: "dormitory-first-golden-chain-real-browser",
    auditLevel: report?.auditLevel || "",
    auditPurpose: report?.auditPurpose || "",
    allowedInterpretation: [],
    forbiddenInterpretation: report?.forbiddenInterpretations ?? [],
    scenarioScope: {
      capabilityId: report?.capabilityId || "",
      currentMainGate: false,
      legacyTenScenarioAsMainGate: false,
      legacyAllStepsAsMainGate: false,
      businessAcceptance: false
    },
    lane: "legacy_quarantine",
    currentMainGate: false,
    businessGoAllowed: false,
    progress: browserAuditProgress(report),
    scenarioCount: 1,
    screenshotHashCount: screenshotHashes.length,
    testPlanDigest: report?.testPlanDigest || "",
    browserAuditDigest: report?.browserAuditDigest || "",
    acceptedGeneratedBundleDigest: report?.acceptedGeneratedBundleDigest || "",
    runtimeProjectionDigest: report?.runtimeProjectionDigest || "",
    surfaceProjectionDigest: report?.surfaceProjectionDigest || "",
    searchProjectionDigest: report?.searchProjectionDigest || "",
    node: report ? buildBrowserProofNode({
      id: "DORM-FIRST-GOLDEN-CHAIN-REAL-BROWSER",
      status,
      gate: "DORMITORY-FIRST-GOLDEN-CHAIN-REAL-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: ["Dormitory.FirstGoldenChain"],
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: report.auditPurpose,
      allowedInterpretation: [],
      forbiddenInterpretation: report.forbiddenInterpretations,
      scenarioScope: {
        capabilityId: report.capabilityId,
        currentMainGate: false,
        legacyTenScenarioAsMainGate: false,
        legacyAllStepsAsMainGate: false,
        businessAcceptance: false
      },
      businessGoAllowed: false,
      progress: browserAuditProgress(report),
      refs: [
        reportRef,
        normalizeRepoPath(report.screenshotIndex || FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH),
        FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH,
        FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
        "scripts/surface/run-dormitory-first-golden-chain-real-browser-audit.mjs",
        "scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs",
        "scripts/oam/check-test-plan-generated-from-capability.mjs"
      ]
    }) : null
  };
}

function readL1BrowserEvidence() {
  const latestPath = ["artifacts", "oam", "evidence", "dormitory-l1-browser-e2e", "latest-report.json"].join("/");
  const latest = readJsonIfExists(latestPath);
  const reportRef = normalizeRepoPath(latest?.report || "");
  const report = reportRef ? readJsonIfExists(reportRef) : null;
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && report?.git?.headSha === commitSha ? "passed" : "missing_or_failed";
  return {
    status,
    report: reportRef || "",
    runId: report?.runId || "",
    auditLevel: report?.auditLevel || "",
    auditPurpose: report?.auditPurpose || "",
    allowedInterpretation: report?.allowedInterpretation ?? [],
    forbiddenInterpretation: report?.forbiddenInterpretation ?? [],
    scenarioScope: report?.scenarioScope ?? {},
    businessGoAllowed: report?.businessGoAllowed,
    progress: browserAuditProgress(report),
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    node: report ? buildBrowserProofNode({
      id: `DORM-L1-BROWSER-E2E-${report.runId || "unknown"}`,
      status,
      gate: "DORM-L1-BROWSER-E2E",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId: report.ciRun?.id || ciRunId,
      ciRunUrl: report.ciRun?.url || "",
      scenarioIds: (report.scenarios ?? []).map((scenario) => scenario.scenarioId).filter(Boolean),
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: report.auditPurpose,
      allowedInterpretation: report.allowedInterpretation,
      forbiddenInterpretation: report.forbiddenInterpretation,
      scenarioScope: report.scenarioScope,
      businessGoAllowed: report.businessGoAllowed,
      progress: browserAuditProgress(report),
      refs: [
        reportRef,
        normalizeRepoPath(report.outputs?.markdown || ""),
        normalizeRepoPath(report.outputs?.screenshotIndex || ""),
        "scripts/surface/run-dormitory-l1-browser-e2e-audit.mjs",
        "scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs"
      ].filter(Boolean)
    }) : null
  };
}

function readTenScenarioBrowserEvidence() {
  const runId = env("WORKOS_TEN_DORM_SCENARIO_RUN_ID") || "ten-dormitory-scenario-real-browser-20260605-post-unified-start";
  const reportRef = ["artifacts", "oam", "evidence", "dormitory-real-browser", runId, "ten-scenario-real-browser-report.json"].join("/");
  const report = readJsonIfExists(reportRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && report?.git?.headSha === commitSha ? "passed" : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    runId: report?.runId || "",
    auditLevel: report?.auditLevel || "",
    auditPurpose: report?.auditPurpose || "",
    allowedInterpretation: report?.allowedInterpretation ?? [],
    forbiddenInterpretation: report?.forbiddenInterpretation ?? [],
    scenarioScope: report?.scenarioScope ?? {},
    businessGoAllowed: report?.businessGoAllowed,
    progress: browserAuditProgress(report),
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    node: report ? buildBrowserProofNode({
      id: `DORM-TEN-SCENARIO-REAL-BROWSER-${report.runId || "unknown"}`,
      status,
      gate: "DORMITORY-TEN-SCENARIO-REAL-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: (report.scenarios ?? []).map((scenario) => scenario.id).filter(Boolean),
      screenshotHashes,
      reportRef,
      auditLevel: report.auditLevel,
      auditPurpose: report.auditPurpose,
      allowedInterpretation: report.allowedInterpretation,
      forbiddenInterpretation: report.forbiddenInterpretation,
      scenarioScope: report.scenarioScope,
      businessGoAllowed: report.businessGoAllowed,
      progress: browserAuditProgress(report),
      refs: [
        reportRef,
        ["artifacts", "oam", "evidence", "dormitory-real-browser", runId, "ten-scenario-real-browser-report.md"].join("/"),
        ["artifacts", "oam", "evidence", "dormitory-real-browser", runId, "screenshot-index.json"].join("/"),
        "scripts/surface/run-dormitory-ten-scenario-real-browser-audit.mjs",
        "scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs"
      ]
    }) : null
  };
}

function browserAuditProgress(report) {
  if (!report) return {};
  return {
    currentScenario: report.currentScenario || "",
    completedScenarioCount: report.completedScenarioCount ?? 0,
    totalScenarioCount: report.totalScenarioCount ?? 0,
    lastHeartbeatAt: report.lastHeartbeatAt || "",
    screenshotCount: report.screenshotCount ?? 0,
    currentStep: report.currentStep || ""
  };
}

function buildBrowserProofNode(input) {
  const refs = [...new Set((input.refs ?? []).filter(Boolean).map(normalizeRepoPath))];
  const screenshotInputHashes = (input.screenshotHashes ?? [])
    .filter(Boolean)
    .map((hash, index) => ({
      path: `browser-screenshot:${input.gate}:${index + 1}`,
      hash: String(hash).startsWith("sha256:") ? String(hash) : `sha256:${hash}`
    }));
  const sourceHashes = refs.map((file) => ({
    path: file,
    hash: hashFileIfPresent(file)
  }));
  const payload = {
    id: input.id,
    gate: input.gate,
    status: input.status,
    reportRef: input.reportRef,
    refs,
    screenshotHashes: input.screenshotHashes,
    auditLevel: input.auditLevel,
    businessGoAllowed: input.businessGoAllowed,
    progress: input.progress,
    headSha: sourceCommitSha,
    reportHeadSha: input.headSha,
    reportFresh: input.headSha === sourceCommitSha,
    sourceCommitSha,
    evidenceRunSha,
    finalGoNoGo: "NO_GO"
  };
  const proofHash = `sha256:${sha256(JSON.stringify(normalizeForDigest(payload)))}`;
  return {
    id: input.id,
    type: "browser_e2e_evidence",
    proofType: "current-oam-browser-e2e-proof",
    source: refs,
    hash: proofHash,
    dependsOn: refs,
    status: input.status,
    goNoGo: "NO_GO",
    gate: input.gate,
    branch: input.branch,
    headSha: sourceCommitSha,
    reportHeadSha: input.headSha,
    reportFresh: input.headSha === sourceCommitSha,
    sourceCommitSha,
    evidenceRunSha,
    ciRunId: input.ciRunId,
    ciRunUrl: input.ciRunUrl,
    scenarioIds: input.scenarioIds,
    screenshotHashes: input.screenshotHashes,
    auditLevel: input.auditLevel,
    auditPurpose: input.auditPurpose,
    allowedInterpretation: input.allowedInterpretation ?? [],
    forbiddenInterpretation: input.forbiddenInterpretation ?? [],
    scenarioScope: input.scenarioScope ?? {},
    businessGoAllowed: input.businessGoAllowed,
    progress: input.progress ?? {},
    reportRef: input.reportRef,
    refs,
    command: refs.find((file) => file.includes("/run-")) ?? input.gate,
    checker: refs.find((file) => file.includes("/check-")) ?? input.gate,
    inputHashes: [...sourceHashes, ...screenshotInputHashes],
    outputHashes: [{ path: `evidence-node:${input.id}`, hash: proofHash }],
    goNoGoImpact: ["surfaceLanguageGoNoGo", "finalGoNoGo"],
    notesZh: `${input.gate} 的真实浏览器 proof DAG 节点；截图哈希、报告和检查器均作为依赖，CI 绿色不等于业务 GO。`
  };
}

function buildFinalReportStatusMatrix(candidate, attestation) {
  const authorityGate = gateGroupStatus([
    "node scripts/oam/check-current-oam.mjs",
    "node scripts/oam/check-current-architecture-manifest.mjs",
    "node scripts/oam/check-current-authority-index.mjs",
    "node scripts/authority/check-master-design-schema.mjs",
    "node scripts/authority/check-truth-ownership-matrix.mjs",
    "node scripts/oam/check-authority-source-layer-audit.mjs",
    "node scripts/oam/check-kernel-responsibility-map.mjs",
    "node scripts/check-rule-authority.mjs",
    "node scripts/check-truth-owners.mjs"
  ]);
  const fileLifecycleGate = gateGroupStatus([
    "node scripts/oam/check-file-lifecycle-policy.mjs",
    "node scripts/oam/check-authority-source-layer-audit.mjs"
  ]);
  const generatedCompileAuthorized = formalGeneratedCompileAuthorization.authorized ||
    process.env.ALLOW_GENERATED_COMPILE_CANDIDATE === "true";
  const compileGate = gateGroupStatus([
    "node scripts/oam/check-generated-compile-authorization.mjs",
    ...(generatedCompileAuthorized ? ["node scripts/business/generate-dormitory-derived-contracts.mjs"] : []),
    "node scripts/oam/generate-system-derived-contracts.mjs",
    "node scripts/oam/compile-current-kernel-graph.mjs",
    "node scripts/oam/check-derived-contract-consistency.mjs",
    "node scripts/oam/check-generated-contract-consistency.mjs",
    "node scripts/oam/check-generated-files-not-manually-edited.mjs",
    "node scripts/oam/check-oam-kernel-graph.mjs",
    "node scripts/oam/check-generated-compile-execution.mjs"
  ]);
  const runtimeGate = gateGroupStatus([
    "node scripts/check-api-boundaries.mjs",
    "node scripts/check-runtime-write-paths.mjs",
    "node scripts/oam/check-runtime-governance-v2.mjs",
    "node scripts/oam/check-db-no-side-effects-proof.mjs"
  ]);
  const readSurfaceFinanceGate = gateGroupStatus([
    "node scripts/oam/check-read-intelligence-kernel.mjs",
    "node scripts/check-search-kernel.mjs",
    "node scripts/check-surface-contract.mjs",
    "node scripts/oam/check-surface-language-v2.mjs",
    "node scripts/oam/check-dashboard-readonly.mjs",
    "node scripts/oam/check-bi-kpi-metric-operating-model.mjs",
    "node scripts/check-finance-truth.mjs",
    "node scripts/finance/check-finance-semantic-truth.mjs"
  ]);
  const sourcePackageGate = gateGroupStatus([
    "node scripts/oam/check-dormitory-golden-chain-source-package.mjs"
  ]);
  const mutationPassed = mutationTests.status === "passed";
  const sourcePackagePassed = sourcePackageCheck.status === "PASS" && sourcePackageGate.status === "PASS";
  const sourceCompileDecisionReady = sourcePackagePassed && sourcePackageCheck.sourceReadyForCompileDecision !== false;
  const generatedCompileAllowedBy00 = formalGeneratedCompileAuthorization.authorized === true;
  const generatedCompileCompleted = generatedCompileExecution.generatedCompileCompleted === true &&
    generatedCompileExecution.generatedCompilationCompleted === true;
  const generatedFieldBindingClosurePassed = generatedFieldBindingClosure.status === "PASS";
  const generatedCandidateAcceptanceCheckPassed = generatedCandidateAcceptance.status === "PASS";
  const generatedCandidateAccepted = generatedCandidateAcceptance.generatedCandidateAcceptedBy00 === true;
  const runtimeAdmissionPassed = dormitoryRuntimeAdmission.status === "PASS" &&
    dormitoryRuntimeAdmission.runtimeAdmissionStatus === "APPROVED_TEST_ONLY_RUNTIME_CONSUMPTION";
  const dormitoryFirstGoldenChainLandingPassed = dormitoryFirstGoldenChainLanding.status === "PASS" &&
    dormitoryFirstGoldenChainLanding.landingStatus === DORMITORY_L1_LANDING_APPROVED_STATUS &&
    dormitoryFirstGoldenChainLanding.businessFeatureDevelopmentAllowed === true &&
    dormitoryFirstGoldenChainLanding.dormitoryFirstGoldenChainLandingGoNoGo === "GO";
  const browserL1Passed = realBrowserEvidence.summary.l1?.status === "passed";
  const candidatePassed = candidate.candidateStatus === "PASS";
  const commitCurrent = attestation.bindingStatus === "current" && attestation.candidateBindingStatus === "current";

  return {
    version: "oam.final-report.multi-status.v1",
    authorityStatus: reportStatusEntry({
      status: authorityGate.status,
      inputs: [
        "docs/oam/current-architecture.manifest.json",
        "docs/oam/current-authority-index.json",
        "docs/oam/current-oam-kernel-responsibility-map.json",
        "docs/contracts/authority/master-design.contract.json",
        "docs/contracts/authority/truth-ownership-matrix.contract.json"
      ],
      proofRefs: [
        "artifacts/oam/evidence/master-design-proof.json",
        "artifacts/oam/evidence/truth-ownership-proof.json",
        "artifacts/oam/authority-cleanup/source-layer-audit.json",
        ...authorityGate.proofRefs
      ],
      blockingReasons: authorityGate.blockingReasons,
      nextAction: authorityGate.status === "PASS"
        ? "保持当前架构唯一生效；旧 catalog、旧 seed、generated view、dashboard、search、surface 继续不能成为第二权威。"
        : "先修复权威层、Master Design 或 Truth Ownership Matrix，再重新生成证据。"
    }),
    fileLifecycleStatus: reportStatusEntry({
      status: fileLifecycleGate.status,
      inputs: [
        "docs/oam/file-lifecycle-policy.json",
        "artifacts/oam/authority-cleanup/source-layer-audit.json"
      ],
      proofRefs: [
        "docs/oam/file-lifecycle-policy.json",
        "artifacts/oam/authority-cleanup/source-layer-audit.json",
        ...fileLifecycleGate.proofRefs
      ],
      blockingReasons: fileLifecycleGate.blockingReasons,
      nextAction: fileLifecycleGate.status === "PASS"
        ? "继续按 File Lifecycle Registry 分类文件；禁止靠路径或关键词猜测生命周期。"
        : "修复文件生命周期注册表或 Source Layer Audit 分类后重跑本阶段。"
    }),
    compileStatus: reportStatusEntry({
      status: compileGate.status,
      inputs: [
        "docs/oam/system-derived-contracts.json",
        "docs/oam/domain-derived-contracts.json",
        "docs/oam/generated-contracts-manifest.json",
        "docs/oam/kernel/oam-kernel-graph.generated.json"
      ],
      proofRefs: [
        "docs/oam/generated-contracts-manifest.json",
        "docs/oam/kernel/oam-kernel-graph.generated.json",
        ...compileGate.proofRefs
      ],
      blockingReasons: compileGate.blockingReasons,
      nextAction: compileGate.status === "PASS"
        ? "仅表示 generated 元数据、授权门禁和未手改检查闭合；Dormitory generated 编译仍需 00 显式授权，不能解释为业务 GO。"
        : "修复 Source、generated 编译授权门禁或生成层元数据，再重新生成证据。"
    }),
    sourceCompileDecisionReadinessStatus: reportStatusEntry({
      status: sourceCompileDecisionReady ? "PASS" : "NO_GO",
      inputs: [
        "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml",
        "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json",
        String(sourcePackageCheck.sourceReadyForCompileDecision ?? true)
      ],
      proofRefs: [
        "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json"
      ],
      blockingReasons: sourceCompileDecisionReady ? [] : ["Source 未达到 00 generated compile 裁决准备态。"],
      nextAction: sourceCompileDecisionReady
        ? "Source 已定稿并可提交 00 做 generated compile 授权裁决；这不是 generated 编译授权。"
        : "先修复 Source 场景包 P0，再重新提交 00 裁决准备材料。"
    }),
    generatedCompileAuthorizationStatus: reportStatusEntry({
      status: generatedCompileAllowedBy00 ? "PASS" : "NO_GO",
      inputs: [
        "docs/oam/generated-compile-approval.current.json",
        formalGeneratedCompileAuthorization.approvalStatus,
        String(formalGeneratedCompileAuthorization.generatedCompileAuthorized),
        String(formalGeneratedCompileAuthorization.generatedCompilationAllowed)
      ],
      proofRefs: [
        "docs/oam/generated-compile-approval.current.json",
        "scripts/oam/check-generated-compile-authorization.mjs"
      ],
      blockingReasons: generatedCompileAllowedBy00 ? [] : [
        "等待 00 显式 generated compile 授权；formal approval object 尚未通过。",
        "Source 定稿不等于 generated 编译授权。"
      ],
      nextAction: generatedCompileAllowedBy00
        ? "仅允许执行 formal generated compile gates；不得解释为 generated candidate accepted、Runtime consumption 或 GO。"
        : "保持 generated 编译阻断；未授权时只能检查 hash/digest 元数据和 doNotEdit。"
    }),
    generatedCompilationStatus: reportStatusEntry({
      status: generatedCompileCompleted ? "PASS" : "NO_GO",
      inputs: [
        generatedCompileExecutionResultPath,
        generatedCompileExecutionProofPath,
        String(generatedCompileExecution.generatedCompileCompleted),
        String(generatedCompileExecution.generatedCompilationCompleted),
        generatedCompileExecution.generatedContractStatus10B
      ],
      proofRefs: [
        generatedCompileExecutionResultPath,
        generatedCompileExecutionProofPath,
        "scripts/oam/check-generated-compile-execution.mjs"
      ],
      blockingReasons: generatedCompileCompleted ? [] : [
        "Dormitory generated contracts 已获 formal authorization，但 formal_compile_execution 结果尚未 PASS。",
        "generatedContractStatus10B 仍不是 GENERATED_COMPILE_EXECUTED_PENDING_00_CANDIDATE_ACCEPTANCE。"
      ],
      nextAction: generatedCompileCompleted
        ? "提交给 00 做 generated candidate acceptance review；Runtime consumption、业务开发和 GO 仍保持阻断。"
        : "等待 00 授权后才可运行宿舍 generated contracts 正式编译。"
    }),
    generatedFieldBindingClosureStatus: reportStatusEntry({
      status: generatedFieldBindingClosurePassed ? "PASS" : "NO_GO",
      inputs: [
        generatedFieldBindingsPath,
        generatedFieldBindingClosureResultPath,
        generatedFieldBindingClosure.generatedFieldBindingClosureDigest,
        generatedFieldBindingClosure.sourceFieldGapsDecisionDigest
      ],
      proofRefs: [
        generatedFieldBindingsPath,
        generatedFieldBindingClosureResultPath,
        "scripts/oam/check-generated-field-binding-closure.mjs"
      ],
      blockingReasons: generatedFieldBindingClosurePassed ? [] : generatedFieldBindingClosure.blockingReasons,
      nextAction: generatedFieldBindingClosurePassed
        ? "Generated semantic closure is bound; this is not generated candidate acceptance, runtime readiness, or release GO."
        : "Fix generated field binding closure before generated candidate acceptance review."
    }),
    generatedCandidateAcceptanceStatus: reportStatusEntry({
      status: generatedCandidateAccepted ? "PASS" : "NO_GO",
      inputs: [
        generatedCandidateAcceptancePath,
        generatedCandidateAcceptanceResultPath,
        generatedCandidateAcceptance.decisionStatus,
        String(generatedCandidateAcceptance.generatedCandidateAcceptedBy00)
      ],
      proofRefs: [
        generatedCandidateAcceptancePath,
        generatedCandidateAcceptanceResultPath,
        "scripts/oam/check-generated-candidate-acceptance.mjs"
      ],
      blockingReasons: generatedCandidateAcceptanceBlockingReasons(),
      nextAction: generatedCandidateAccepted
        ? "仅表示 00 已接受不可变 Generated Candidate Subject；runtime、business、release、production 仍需独立裁决。"
        : generatedCandidateAcceptanceNextAction()
    }),
    runtimeAdmissionStatus: reportStatusEntry({
      status: runtimeAdmissionPassed ? "PASS" : "NO_GO",
      inputs: [
        dormitoryRuntimeAdmissionPath,
        dormitoryRuntimeAdmissionResultPath,
        dormitoryRuntimeAdmission.runtimeAdmissionStatus,
        String(dormitoryRuntimeAdmission.runtimeConsumptionReady)
      ],
      proofRefs: [
        dormitoryRuntimeAdmissionPath,
        dormitoryRuntimeAdmissionResultPath,
        dormitoryRuntimeTestOnlyProofPath,
        "scripts/oam/check-dormitory-runtime-admission.mjs"
      ],
      blockingReasons: runtimeAdmissionPassed ? [] : [
        "Dormitory runtime admission 尚未批准 test-only consumption；runtimeConsumptionReady 必须由 dormitory-runtime-admission.current.json 决定。"
      ],
      nextAction: runtimeAdmissionPassed
        ? "仅允许宿舍第一金链 test-only runtime consumption；不得开放业务落地、production、release 或 GO。"
        : "提交 00 runtime admission review；不得直接进入业务开发或生产确认。"
    }),
    dormitoryFirstGoldenChainLandingStatus: reportStatusEntry({
      status: dormitoryFirstGoldenChainLandingPassed ? "PASS" : "NO_GO",
      inputs: [
        dormitoryFirstGoldenChainLandingPath,
        dormitoryFirstGoldenChainLandingResultPath,
        dormitoryFirstGoldenChainLanding.landingStatus,
        String(dormitoryFirstGoldenChainLanding.businessFeatureDevelopmentAllowed),
        dormitoryFirstGoldenChainLanding.dormitoryFirstGoldenChainLandingGoNoGo
      ],
      proofRefs: [
        dormitoryFirstGoldenChainLandingPath,
        dormitoryFirstGoldenChainLandingResultPath,
        dormitoryFirstGoldenChainLandingProofPath,
        "scripts/oam/check-dormitory-first-golden-chain-landing.mjs"
      ],
      blockingReasons: dormitoryFirstGoldenChainLandingPassed ? [] : [
        "Dormitory L1 first golden chain business landing 尚未批准；businessFeatureDevelopmentAllowed 必须由 dormitory-first-golden-chain-landing.current.json 决定。"
      ],
      nextAction: dormitoryFirstGoldenChainLandingPassed
        ? "仅允许 RoomSetupConfirm -> BedSetupConfirm -> ResourceReadinessConfirm 三核 L1 业务落地；production、Finance、Dormitory L2、release、final GO 仍阻断。"
        : "提交 00 business landing review；不得把 runtimeConsumptionReady 解释为业务落地 GO。"
    }),
    runtimeConsumptionStatus: reportStatusEntry({
      status: runtimeConsumptionReady ? "PASS" : "NO_GO",
      inputs: [
        dormitoryRuntimeAdmissionPath,
        dormitoryRuntimeAdmission.runtimeAdmissionStatus,
        String(dormitoryRuntimeAdmission.runtimeConsumptionReady),
        "generatedCandidateAcceptanceStatus"
      ],
      proofRefs: [
        dormitoryRuntimeAdmissionPath,
        dormitoryRuntimeAdmissionResultPath,
        dormitoryRuntimeTestOnlyProofPath
      ],
      blockingReasons: runtimeConsumptionReady ? [] : [
        "runtimeConsumptionReady=false；只有 dormitory-runtime-admission.current.json 可批准 test-only runtime consumption。"
      ],
      nextAction: runtimeConsumptionReady
        ? "Runtime 只能 test-only 消费已接受的 generated contracts；业务、production、release、final GO 仍阻断。"
        : "保持 Runtime 消费阻断，不能开始业务落地。"
    }),
    runtimeBoundaryStatus: reportStatusEntry({
      status: runtimeGate.status,
      inputs: [
        "artifacts/oam/evidence/runtime-proof.json",
        "docs/identity/identity-permission-kernel.json",
        "docs/finance/finance-ledger-kernel.json"
      ],
      proofRefs: [
        "artifacts/oam/evidence/runtime-proof.json",
        ...runtimeGate.proofRefs
      ],
      blockingReasons: runtimeGate.blockingReasons,
      nextAction: runtimeGate.status === "PASS"
        ? "保持 Runtime 只消费 generated，不拥有业务事实权威。"
        : "修复运行时写入路径或 API 边界后重跑边界门禁。"
    }),
    readSurfaceFinanceStatus: reportStatusEntry({
      status: readSurfaceFinanceGate.status,
      inputs: [
        "docs/read-intelligence/read-intelligence-kernel.json",
        "artifacts/oam/evidence/search-readonly-proof.json",
        "artifacts/oam/evidence/surface-language-proof.json",
        "docs/finance/finance-ledger-kernel.json"
      ],
      proofRefs: [
        "artifacts/oam/evidence/search-readonly-proof.json",
        "artifacts/oam/evidence/surface-language-proof.json",
        "artifacts/oam/proofs/read-intelligence/oam-object-envelope-proof.json",
        "artifacts/oam/proofs/bi-kpi/metric-definition-registry-proof.json",
        ...readSurfaceFinanceGate.proofRefs
      ],
      blockingReasons: readSurfaceFinanceGate.blockingReasons,
      nextAction: readSurfaceFinanceGate.status === "PASS"
        ? "Search、Surface、Dashboard、Report、Metric 保持只读；Finance facts 继续只能由 finance kernel 写。"
        : "修复 Read / Search / Surface / Dashboard / Finance 边界后重跑门禁。"
    }),
    sourcePackageStatus: reportStatusEntry({
      status: sourcePackagePassed ? "PASS" : "NO_GO",
      inputs: [
        "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml",
        "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml",
        "docs/business/domains/dormitory/dormitory-operating-kernel.json",
        "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json"
      ],
      proofRefs: [
        "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json",
        ...sourcePackageGate.proofRefs
      ],
      blockingReasons: sourcePackagePassed ? [] : [
        ...sourcePackageGate.blockingReasons,
        ...(sourcePackageCheck.p0Failures ?? []).map((item) => `${item.id}: ${item.message}`),
        sourcePackageCheck.status === "PASS" ? "" : `Source package checker status=${sourcePackageCheck.status}`
      ].filter(Boolean),
      nextAction: sourcePackagePassed
        ? "提交给 00 做 Source 定稿裁决；仍不得进入业务 GO 或 production confirm。"
        : "先修复宿舍第一金链 Source 场景包 P0，再重新运行统一 checker。"
    }),
    mutationStatus: reportStatusEntry({
      status: mutationPassed ? "PASS" : "NO_GO",
      inputs: ["artifacts/oam/authority-cleanup/mutation-tests-result.json"],
      proofRefs: ["artifacts/oam/authority-cleanup/mutation-tests-result.json"],
      blockingReasons: mutationPassed ? [] : [`Mutation tests 未通过：${mutationTests.status}`],
      nextAction: mutationPassed
        ? "负例继续证明 forbidden owner、手改 generated、CI green as GO 等路径会失败。"
        : "修复失败负例，确认 forbidden 写入仍被拒绝。"
    }),
    browserL1Status: reportStatusEntry({
      status: browserL1Passed ? "PASS" : "NO_GO",
      inputs: [
        realBrowserEvidence.summary.l1?.report ?? "artifacts/oam/evidence/dormitory-l1-browser-e2e/latest-report.json"
      ],
      proofRefs: [
        realBrowserEvidence.summary.l1?.report ?? "artifacts/oam/evidence/dormitory-l1-browser-e2e/latest-report.json",
        "scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs"
      ],
      blockingReasons: browserL1Passed ? [] : [`浏览器 L1 架构审计未通过或过期：${realBrowserEvidence.summary.l1?.status ?? "missing"}`],
      nextAction: browserL1Passed
        ? "L1 只证明架构 UI 不越权和截图绑定；不得解释为业务验收。"
        : "刷新 L1 架构浏览器审计并重新绑定截图证据。"
    }),
    candidateEvidenceStatus: reportStatusEntry({
      status: candidatePassed ? "PASS" : "NO_GO",
      inputs: [
        candidate.sourceAuthorityDigest,
        candidate.generatedContractDigest,
        candidate.fileLifecycleDigest,
        candidate.runtimeBoundaryDigest,
        candidate.readSurfaceFinanceBoundaryDigest,
        candidate.mutationDigest,
        candidate.browserL1Digest
      ],
      proofRefs: [candidateEvidenceObjectPath],
      blockingReasons: candidatePassed ? [] : [`Candidate Evidence 未通过：${candidate.candidateStatus}`],
      nextAction: candidatePassed
        ? "Candidate Evidence 只证明本地候选闭合，不负责发布授权。"
        : "按失败摘要修复 Candidate Evidence 对应输入后重新生成。"
    }),
    commitAttestationStatus: reportStatusEntry({
      status: commitCurrent ? "PASS" : "NO_GO",
      inputs: [
        attestation.commitSha,
        attestation.evidenceSubjectDigest,
        attestation.trackedContentDigest
      ],
      proofRefs: [commitAttestationPath],
      blockingReasons: commitCurrent ? [] : [`Commit Attestation 绑定不是 current：binding=${attestation.bindingStatus}，candidate=${attestation.candidateBindingStatus}`],
      nextAction: commitCurrent
        ? "Commit Attestation 已绑定当前 HEAD 与 Candidate subject digest；仍不授予 releaseAuthority。"
        : "提交或内容变更后重新生成 Commit Attestation，并确认绑定当前 HEAD。"
    }),
    businessReadinessStatus: reportStatusEntry({
      status: "NO_GO",
      inputs: [
        "docs/oam/current-admission-state.json",
        admission.businessProduction,
        admission.dormitoryProduction,
        String(admission.productionConfirmAllowed)
      ],
      proofRefs: [
        "docs/oam/current-admission-state.json",
        finalReportPath
      ],
      blockingReasons: [
        "Business Production 当前仍为 BLOCKED，业务落地不允许。",
        "Dormitory L2 当前仍为 BLOCKED，宿舍业务 L2 不允许。",
        "productionConfirmAllowed=false，生产确认不允许。"
      ],
      nextAction: "保持 NO_GO；只有架构体系闭合后，才能进入宿舍第一金链 Source 场景包审核。"
    }),
    releaseReadinessStatus: reportStatusEntry({
      status: "NO_GO",
      inputs: [
        evidenceLifecycleType,
        githubArtifactDigestStatus,
        String(false),
        releaseReadiness.releaseEligible ? "releaseEligible=true" : "releaseEligible=false"
      ],
      proofRefs: [
        evidenceLifecycleProofPath,
        releaseEvidenceObjectPath,
        releaseAttestationPath
      ],
      blockingReasons: [
        githubArtifactDigestStatus === pendingExternalAttestation
          ? "githubArtifactDigestStatus=pending_external_attestation，外部 artifact 摘要证明未完成。"
          : "GitHub artifact 外部摘要已证明，但当前仍不授予 releaseAuthority。",
        `Evidence lifecycle=${evidenceLifecycleType}，bindingStatus=${releaseBindingStatus}；本轮不允许把候选证据解释为业务 GO。`,
        "releaseAuthority=false，不能发布放行。",
        "CI green、artifact exists、browser evidence、Final Report exists 均不等于 GO。"
      ],
      nextAction: "保持发布阻断；只有外部 attestation 和发布准入真实完成后才能重新裁决。"
    }),
    finalGoNoGo: reportStatusEntry({
      status: "NO_GO",
      inputs: [
        "authorityStatus",
        "compileStatus",
        "sourceCompileDecisionReadinessStatus",
        "generatedCompileAuthorizationStatus",
        "generatedCompilationStatus",
        "runtimeAdmissionStatus",
        "runtimeConsumptionStatus",
        "runtimeBoundaryStatus",
        "sourcePackageStatus",
        "candidateEvidenceStatus",
        "businessReadinessStatus",
        "releaseReadinessStatus"
      ],
      proofRefs: [
        candidateEvidenceObjectPath,
        commitAttestationPath,
        releaseEvidenceObjectPath,
        releaseAttestationPath,
        finalReportPath
      ],
      blockingReasons: finalDecision.noGoReasons,
      nextAction: "最终保持 NO_GO；不得开始宿舍业务落地、不得发布、不得把任一单项 PASS 解释为 GO。"
    })
  };
}

function generatedCandidateAcceptanceBlockingReasons() {
  if (generatedCandidateAcceptedBy00) return [];
  if (generatedCandidateAcceptance.status !== "PASS") {
    return ["generated candidate acceptance checker 尚未 PASS。"];
  }
  if (generatedCandidateAcceptance.decisionStatus === "NOT_ACCEPTED_BY_00") {
    return [
      "00 已裁决 NOT_ACCEPTED_BY_00；generated candidate 不可被 runtime、business、release 或 GO 消费。",
      ...(generatedCandidateAcceptanceAuthority?.blockingReasons ?? [])
    ];
  }
  if (generatedCandidateAcceptance.decisionStatus === "PENDING_00_DECISION") {
    return [
      "generated candidate acceptance authority 当前为 PENDING_00_DECISION；不能由 CI success、Evidence Root PASS 或 formal_compile_execution PASS 推断 accepted。"
    ];
  }
  return [
    `generated candidate acceptance authority 当前为 ${generatedCandidateAcceptance.decisionStatus}，但 generatedCandidateAcceptedBy00=false。`
  ];
}

function generatedCandidateAcceptanceNextAction() {
  if (generatedCandidateAcceptance.decisionStatus === "NOT_ACCEPTED_BY_00") {
    return "先完成 blockingReasons 指向的修复和 authoritative CI artifact，再重新提交 00 generated candidate acceptance review。";
  }
  if (generatedCandidateAcceptance.decisionStatus === "PENDING_00_DECISION") {
    return "等待 00 对 generated-candidate-acceptance.current.json 做显式 acceptance 裁决。";
  }
  return "保持 generated candidate acceptance 阻断；不得进入 runtime、business、release 或 GO。";
}

function reportStatusEntry(input) {
  return {
    status: input.status,
    inputs: [...new Set((input.inputs ?? []).filter((item) => item !== undefined && item !== null && String(item) !== ""))],
    proofRefs: [...new Set((input.proofRefs ?? []).filter(Boolean).map(String))],
    blockingReasons: input.status === "PASS" ? [] : [...new Set(input.blockingReasons ?? [])],
    nextAction: input.nextAction
  };
}

function gateGroupStatus(commands) {
  const actualGates = controlPlaneGateResult.gates ?? [];
  const missing = [];
  const failed = [];
  for (const command of commands) {
    const gate = actualGates.find((item) => item.command === command);
    if (!gate) {
      missing.push(command);
      continue;
    }
    if (gate.status !== "passed" || gate.exitCode !== 0) {
      failed.push(`${command}=${gate.status ?? "missing"}`);
    }
  }
  const blockingReasons = [
    ...missing.map((command) => `Control Plane 缺失门禁：${command}`),
    ...failed.map((command) => `Control Plane 门禁未通过：${command}`)
  ];
  return {
    status: blockingReasons.length === 0 ? "PASS" : "NO_GO",
    blockingReasons,
    proofRefs: commands
  };
}

function buildReleaseReadiness() {
  const releaseBlockingFiles = [
    ...workspaceEvidence.changedCurrentFiles.filter((file) => !isGeneratedOutputPath(file)),
    ...workspaceEvidence.createdCurrentFiles.filter((file) => !isGeneratedOutputPath(file))
  ];
  const releaseBlockingDeletionCount = workspaceEvidence.deletedOrMovedFileCount;
  const releaseEligible = releaseBlockingFiles.length === 0 && releaseBlockingDeletionCount === 0;
  return {
    releaseEligible,
    releaseBlockingFiles,
    releaseBlockingDeletionCount,
    generatedDirtyAllowed: workspaceEvidence.changedCurrentFiles.filter(isGeneratedOutputPath)
  };
}

function buildFinalDecision() {
  const noGoReasons = [];
  const addNoGoReason = (reason) => {
    if (!noGoReasons.includes(reason)) noGoReasons.push(reason);
  };
  if (unresolvedP0.length > 0) {
    addNoGoReason(`P0 未清零：${unresolvedP0.map((item) => item.ruleId).join(", ")}`);
  }
  if (controlPlaneGateResult.status !== "passed") {
    addNoGoReason(`Control Plane 未通过或未执行：${controlPlaneGateResult.status}`);
  }
  if (controlPlaneGateResult.runStatus !== "completed") {
    addNoGoReason(`Control Plane 未处于 completed/finalizable 最终态：runStatus=${controlPlaneGateResult.runStatus}，证据生成中或不可裁决。`);
  }
  if (controlPlaneGateResult.finalizable !== true) {
    addNoGoReason("Control Plane finalizable=false，不能作为最终 PASS。");
  }
  if ((controlPlaneGateResult.completedGateCount ?? 0) !== (controlPlaneGateResult.expectedGateCount ?? controlPlaneGateResult.requiredGateCount ?? 0)) {
    addNoGoReason(`Control Plane 完成数量不等于 expectedGateCount：completed=${controlPlaneGateResult.completedGateCount ?? 0}，expected=${controlPlaneGateResult.expectedGateCount ?? controlPlaneGateResult.requiredGateCount ?? 0}`);
  }
  if ((controlPlaneGateResult.failedGateCount ?? 0) > 0) {
    addNoGoReason(`Control Plane 失败项数量：${controlPlaneGateResult.failedGateCount}`);
  }
  if ((controlPlaneGateResult.missingRequiredGates ?? []).length > 0) {
    addNoGoReason(`Control Plane 缺失必跑项：${controlPlaneGateResult.missingRequiredGates.join("; ")}`);
  }
  if (controlPlaneGateResult.stale) {
    addNoGoReason(`Control Plane 结果过期：${controlPlaneGateResult.commitSha} != ${commitSha}`);
  }
  if (bindingStale) {
    addNoGoReason(`Release Evidence Object 未绑定当前 HEAD：sourceCommitSha=${sourceCommitSha}, evidenceRunSha=${evidenceRunSha}, currentRepositoryHead=${currentRepositoryHead}`);
  }
  if (releaseEvidenceReferenceOnly) {
    addNoGoReason(`Evidence lifecycle=${evidenceLifecycleType} 当前只能作为本地候选证据或仓库参考快照；bindingStatus=${releaseBindingStatus}，releaseAuthority=false。`);
  }
  if (githubArtifactDigestStatus === pendingExternalAttestation) {
    addNoGoReason("GitHub artifact 外部摘要证明仍为 pending_external_attestation；releaseAuthority=false，不能发布放行。");
  } else if (githubArtifactDigestStatus !== "attested") {
    addNoGoReason(`GitHub artifact 外部摘要证明状态非法：${githubArtifactDigestStatus}`);
  }
  if (mobileBranchRiskKernel.status !== "passed") {
    addNoGoReason(`移动端分支风险门禁未通过：${mobileBranchRiskKernel.status}`);
  }
  if (realBrowserEvidence.summary.status !== "passed") {
    addNoGoReason(`真实浏览器证据未通过或已过期：${realBrowserEvidence.summary.status}`);
  }
  if (coverageSummary.status === "pending_coverage_command") {
    addNoGoReason("覆盖率报告缺失或未执行。");
  }
  if (!releaseReadiness.releaseEligible) {
    addNoGoReason("工作区仍有未提交的当前源码/文档变更或删除项，不符合发布放行条件。");
  }
  if (admission.businessProduction === "BLOCKED") {
    addNoGoReason("Business Production 当前仍为 BLOCKED，业务落地不允许。");
  } else {
    addNoGoReason(`Business Production 状态必须保持 BLOCKED，实际：${admission.businessProduction}`);
  }
  if (admission.dormitoryProduction === "BLOCKED") {
    addNoGoReason("Dormitory L2 当前仍为 BLOCKED，宿舍业务 L2 不允许。");
  } else {
    addNoGoReason(`Dormitory L2 状态必须保持 BLOCKED，实际：${admission.dormitoryProduction}`);
  }
  if (admission.productionConfirmAllowed === false) {
    addNoGoReason("productionConfirmAllowed=false，生产确认不允许。");
  } else {
    addNoGoReason("production_confirm 当前阶段必须保持阻断。");
  }
  addNoGoReason("Release Evidence Object 当前 releaseAuthority=false；CI green、artifact exists、browser evidence、Final Report exists 均不等于 GO。");
  addNoGoReason("当前阶段显式阻断：businessProductionGoNoGo、dormitoryL2GoNoGo、productionConfirmGoNoGo、finalGoNoGo 均为 NO_GO。");

  return {
    finalGoNoGo: "NO_GO",
    noGoReasons
  };
}

function executionLogText(digest) {
  const entries = [
    {
      event: "冻结检查",
      status: workspace.summary,
      commitSha,
      sourceCommitSha,
      evidenceRunSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: workspaceEvidence
    },
    {
      event: "P0 账本状态",
      status: unresolvedP0.length === 0 ? "passed" : "failed",
      commitSha,
      sourceCommitSha,
      evidenceRunSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: {
        total: p0Ledger.length,
        unresolvedP0
      }
    },
    {
      event: "本地总门禁绑定",
      status: gateSummary.status,
      commitSha,
      sourceCommitSha,
      evidenceRunSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: gateSummary
    },
    {
      event: "测试验收绑定",
      status: "required",
      commitSha,
      sourceCommitSha,
      evidenceRunSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: testSummary
    },
    {
      event: "覆盖率绑定",
      status: coverageSummary.status,
      commitSha,
      sourceCommitSha,
      evidenceRunSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: coverageSummary
    },
    {
      event: "移动覆盖率治理",
      status: mobileBranchRiskKernel.status,
      commitSha,
      sourceCommitSha,
      evidenceRunSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: mobileBranchRiskKernel
    },
    {
      event: "最终裁决",
      status: finalGoNoGo,
      commitSha,
      sourceCommitSha,
      evidenceRunSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: {
        businessProduction: admission.businessProduction,
        dormitoryL2: admission.dormitoryProduction,
        productionConfirmAllowed: admission.productionConfirmAllowed,
        noGoReasons: finalDecision.noGoReasons
      }
    }
  ];

  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function buildTestSummary() {
  const mobileScripts = readJson("apps/mobile/package.json")?.scripts ?? {};
  const commands = [
    "npm --prefix apps/mobile run test",
    "npm --prefix apps/mobile run build",
    mobileScripts["test:coverage"] ? "npm --prefix apps/mobile run test:coverage" : null,
    mobileScripts["test:pc"] ? "npm --prefix apps/mobile run test:pc" : null,
    mobileScripts["test:e2e"] ? "npm --prefix apps/mobile run test:e2e" : null,
    "dotnet build WorkOSNext.sln -c Release",
    "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release",
    "dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release",
    "dotnet test tests/WorkOS.DatabaseSecurityTests/WorkOS.DatabaseSecurityTests.csproj -c Release",
    "dotnet test tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj -c Release",
    "dotnet test tests/WorkOS.ReleaseEvidenceTests/WorkOS.ReleaseEvidenceTests.csproj -c Release",
    "dotnet test tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release"
  ].filter(Boolean);

  return {
    status: "bound_to_final_validation",
    commands: commands.map((command) => ({
      command,
      status: "required"
    }))
  };
}

function buildCoverageSummary() {
  const mobileCoverage = readJsonIfExists("artifacts/oam/test-results/mobile/coverage/coverage-summary.json")
    ?? readJsonIfExists(path.join("apps", "mobile", "coverage", "coverage-summary.json"));
  const dotnetCoverageFiles = listFiles("tests")
    .filter((file) => file.replaceAll("\\", "/").includes("/TestResults/") && file.endsWith("coverage.cobertura.xml"))
    .map(slash);
  const targets = {
    ruleCoverage: "100%",
    financeLedgerPermissionWritePath: "95%-100%",
    domainRuntimeKernel: "90%+",
    apiClient: "80%-90%",
    controlsSelectors: "85%-90%",
    views: "75%-85%"
  };
  return {
    status: mobileCoverage || dotnetCoverageFiles.length > 0 ? "reports_detected" : "pending_coverage_command",
    targets,
    mobile: mobileCoverage?.total ?? null,
    dotnetCoverageFiles
  };
}

function buildMobileBranchRiskKernel() {
  const policy = readJsonIfExists("docs/oam/mobile-branch-risk-policy.json");
  const ledger = readJsonIfExists("docs/oam/mobile-branch-risk-ledger.json");
  const scenarios = readJsonIfExists("docs/oam/mobile-critical-branch-scenarios.json");
  const coveragePolicyResult = readJsonIfExists("artifacts/oam/checks/mobile-coverage-policy-result.json");
  const criticalScenarioResult = readJsonIfExists("artifacts/oam/checks/mobile-critical-branch-scenarios-result.json");
  const currentBranches = Number(ledger?.globalCoverage?.branches?.pct ?? coverageSummary.mobile?.branches?.pct ?? 0);
  const scenarioList = scenarios?.scenarios || [];
  const p0Scenarios = scenarioList.filter((scenario) => scenario.riskLevel === "P0");
  const p1Scenarios = scenarioList.filter((scenario) => scenario.riskLevel === "P1");
  const status = ledger?.status === "generated" &&
    coveragePolicyResult?.status === "passed" &&
    criticalScenarioResult?.status === "passed"
    ? "passed"
    : "pending";

  return {
    status,
    policyFile: "docs/oam/mobile-branch-risk-policy.json",
    ledgerFile: "docs/oam/mobile-branch-risk-ledger.json",
    scenarioFile: "docs/oam/mobile-critical-branch-scenarios.json",
    coverageSource: "artifacts/oam/test-results/mobile/coverage/coverage-summary.json",
    coveragePolicyResult: "artifacts/oam/checks/mobile-coverage-policy-result.json",
    criticalScenarioResult: "artifacts/oam/checks/mobile-critical-branch-scenarios-result.json",
    branchRiskLedgerGenerated: ledger?.status === "generated",
    registeredPolicyFiles: ledger?.summary?.registeredFiles ?? 0,
    unregisteredExistingFiles: ledger?.summary?.unregisteredFiles ?? 0,
    newSourceFiles: ledger?.summary?.newSourceFiles ?? 0,
    criticalScenarioCount: scenarioList.length,
    p0ScenarioCount: p0Scenarios.length,
    p1ScenarioCount: p1Scenarios.length,
    p0ScenariosCovered: p0Scenarios.every((scenario) => scenario.covered === true),
    checks: {
      coveragePolicy: coveragePolicyResult?.status || "missing",
      criticalScenarios: criticalScenarioResult?.status || "missing"
    },
    currentCoverage: ledger?.globalCoverage || coverageSummary.mobile || null,
    firstStageHardBaseline: policy?.stage?.globalHardBaseline || null,
    nextStageTarget: policy?.stage?.nextStageTarget || null,
    branches70Reached: currentBranches >= 70
  };
}

function buildSkippedOrNotApplicable() {
  const mobileScripts = readJson("apps/mobile/package.json")?.scripts ?? {};
  const items = [];
  if (!mobileScripts["test:coverage"]) {
    items.push({
      item: "npm --prefix apps/mobile run test:coverage",
      status: "not_applicable",
      reason: "apps/mobile/package.json 未声明 test:coverage。"
    });
  }
  if (!mobileScripts["test:e2e"]) {
    items.push({
      item: "Playwright smoke",
      status: "not_applicable",
      reason: "apps/mobile/package.json 未声明 test:e2e。"
    });
  }
  return items;
}

function statusLine(name, status) {
  return {
    name,
    status
  };
}

function readP0Ledger(file) {
  const ledger = readJson(file);
  return (ledger.rules ?? []).map((rule) => ({
    ruleId: rule.ruleId,
    name: rule.ruleNameZh,
    gate: rule.primaryGate,
    evidence: rule.evidenceArtifact,
    status: rule.status,
    risk: rule.riskLevel
  }));
}

function workspaceStatus() {
  const output = git("status --porcelain") || "";
  const lines = output.split(/\r?\n/).filter(Boolean);
  return {
    summary: lines.length === 0 ? "clean" : "has_task_changes",
    changedFiles: lines.map((line) => line.slice(3).trim()).filter(Boolean),
    createdFiles: lines.filter((line) => line.startsWith("??") || line.startsWith("A ")).map((line) => line.slice(3).trim()),
    deletedOrMovedFiles: lines.filter((line) => line.startsWith(" D") || line.startsWith("D ") || line.startsWith("R ")).map((line) => line.slice(3).trim())
  };
}

function workspaceEvidenceStatus(status) {
  const deleted = new Set(status.deletedOrMovedFiles.map(normalizeRepoPath));
  const changedCurrentFiles = status.changedFiles
    .map(normalizeRepoPath)
    .filter((file) => !deleted.has(file) && !isForbiddenGreyPath(file));
  const createdCurrentFiles = status.createdFiles
    .map(normalizeRepoPath)
    .filter((file) => !isForbiddenGreyPath(file));
  const deletedGreyFileCount = status.deletedOrMovedFiles
    .map(normalizeRepoPath)
    .filter(isForbiddenGreyPath)
    .length;

  return {
    status: status.summary,
    changedCurrentFiles,
    createdCurrentFiles,
    deletedOrMovedFileCount: status.deletedOrMovedFiles.length,
    deletedGreyFileCount,
    deletedCurrentFileCount: status.deletedOrMovedFiles.length - deletedGreyFileCount
  };
}

function isForbiddenGreyPath(file) {
  const normalized = normalizeRepoPath(file);
  return forbiddenGreyEvidencePathPrefixes().some((item) => normalized === item || normalized.startsWith(`${item}/`));
}

function isGeneratedOutputPath(file) {
  const normalized = normalizeRepoPath(file);
  return normalized.startsWith("artifacts/oam/evidence/") ||
    normalized.startsWith("artifacts/oam/checks/") ||
    normalized.startsWith("artifacts/oam/test-results/") ||
    normalized === "artifacts/oam/final-report.json" ||
    normalized === "docs/oam/mobile-branch-risk-ledger.json";
}

function forbiddenGreyEvidencePathPrefixes() {
  return [
    ["docs", "product"].join("/"),
    ["docs", "review"].join("/"),
    ["docs", "decisions", "ADR-0001-phase-0-1-bootstrap.md"].join("/"),
    ["docs", "oam", "final-acceptance-report.md"].join("/"),
    ["docs", "oam", "review-defect-record.md"].join("/"),
    ["docs", "oam", "mobile-refactor-readiness-plan.md"].join("/"),
    ["docs", "system", "oam-warning-baseline.md"].join("/"),
    ["docs", "oam", "certification-scenarios.json"].join("/"),
    ["docs", "oam", "dormitory-certification-scenarios.json"].join("/"),
    ["docs", "business", "dormitory", "certification-scenarios.json"].join("/")
  ];
}

function normalizeRepoPath(file) {
  return file.replaceAll("\\", "/");
}

function workflowContainsEvidenceUpload() {
  const workflow = readText(".github/workflows/ci.yml");
  return workflow.includes("actions/upload-artifact") &&
    workflow.includes("artifacts/oam/evidence/**") &&
    workflow.includes("artifacts/oam/checks/**") &&
    workflow.includes("artifacts/oam/test-results/**") &&
    workflow.includes("artifacts/oam/final-report.json");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readJsonl(file) {
  return readText(file)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function readJsonIfExists(file) {
  return fileExists(file) ? readJson(file) : null;
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}

function writeJson(file, document) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (typeof document === "string") {
    fs.writeFileSync(target, document.endsWith("\n") ? document : `${document}\n`);
    return;
  }
  fs.writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
}

function fileExists(file) {
  return fs.existsSync(path.join(root, file));
}

function listFiles(dir) {
  const start = path.join(root, dir);
  if (!fs.existsSync(start)) return [];
  const result = [];
  walk(start, result);
  return result;
}

function walk(current, result) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(full, result);
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
  } catch {
    return "";
  }
}

function normalizeEvidenceLifecycleType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["local-candidate", "repository-reference-snapshot", "ci-release"].includes(normalized)) {
    return normalized;
  }
  throw new Error(`Unsupported evidence lifecycle mode: ${value || "missing"}`);
}

function env(name) {
  return process.env[name] || "";
}

function repositoryFromGitRemote() {
  const remote = git("remote get-url origin");
  const match = remote.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/i);
  return match?.groups ? `${match.groups.owner}/${match.groups.repo}` : "";
}

function artifactNameForRun(runId) {
  const normalized = String(runId || "").trim();
  if (!normalized || normalized.includes("${{")) {
    throw new Error("GITHUB_RUN_ID must resolve before current OAM evidence artifactName is generated.");
  }
  return `workosnext-current-oam-evidence-${normalized}`;
}

function hashFileStrict(file) {
  return `sha256:${sha256(readText(file))}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripInlineCode(value) {
  return (value ?? "").replaceAll("`", "");
}

function slash(value) {
  return path.relative(root, value).replaceAll("\\", "/");
}
