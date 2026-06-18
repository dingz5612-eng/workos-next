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
import {
  CAPABILITY_COMPATIBILITY_BOX_PATH,
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH
} from "./lib/capability-delivery-control-plane.mjs";

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
const firstGoldenChainCapabilityDigestChainPath = "artifacts/oam/evidence/capability-digest-chain.json";
const firstGoldenChainBrowserAuditReportPath =
  "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/first-golden-chain-real-browser-report.json";
const firstGoldenChainBrowserAuditScreenshotIndexPath =
  "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/screenshot-index.json";
const firstGoldenChainBrowserAuditResultPath =
  "artifacts/oam/checks/dormitory-first-golden-chain-real-browser-result.json";
const visibleBusinessCopyContractPath = "docs/oam/visible-business-copy-contract.json";
const testPlanGeneratedFromCapabilityResultPath =
  "artifacts/oam/checks/test-plan-generated-from-capability-result.json";
const firstGoldenChainDbProjectionProofResultPath =
  "artifacts/oam/checks/dormitory-first-golden-chain-db-projection-proof-result.json";
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
  firstGoldenChainTestPlanPath,
  firstGoldenChainCapabilityDigestChainPath,
  firstGoldenChainBrowserAuditReportPath,
  firstGoldenChainBrowserAuditResultPath,
  firstGoldenChainDbProjectionProofResultPath,
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
  "artifacts/oam/final-report.json"
];

const failures = [];
const documents = new Map();

for (const file of requiredFiles) {
  if (!exists(file)) {
    failures.push(`missing evidence file: ${file}`);
    continue;
  }
  documents.set(file, readEvidenceFile(file));
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
  checkDormitory13ScenarioControlEvidence(graph, finalReport, documents);
  checkDormitory13ScenarioIntegrationChainEvidence(graph, finalReport, documents);
  checkDormitoryScenario1Evidence(graph, finalReport, documents);
  checkDormitoryBenchmarkInheritanceEvidence(graph, finalReport, documents);
  checkDormitoryScenario2Evidence(graph, finalReport, documents);
  checkDormitoryScenario3Evidence(graph, finalReport, documents);
  checkDormitoryScenario4Evidence(graph, finalReport, documents);
  checkDormitoryScenario5Evidence(graph, finalReport, documents);
  checkDormitoryScenario6Evidence(graph, finalReport, documents);
  checkDormitoryScenario7Evidence(graph, finalReport, documents);
  checkDormitoryScenario8Evidence(graph, finalReport, documents);
  checkDormitoryScenario9Evidence(graph, finalReport, documents);
  checkDormitoryScenario10Evidence(graph, finalReport, documents);
  checkDormitoryScenario11Evidence(graph, finalReport, documents);
  checkDormitoryScenario12Evidence(graph, finalReport, documents);
  checkDormitoryScenario13Evidence(graph, finalReport, documents);

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
  const landingApproved = state.landingStatus === DORMITORY_L1_LANDING_APPROVED_STATUS &&
    state.businessFeatureDevelopmentAllowed === true &&
    state.dormitoryFirstGoldenChainLandingGoNoGo === "GO";
  const expectedLandingEntryStatus = landingApproved ? "PASS" : "NO_GO";
  const expectedBusinessFeatureDevelopmentAllowed = landingApproved;
  const expectedLandingGoNoGo = landingApproved ? "GO" : "NO_GO";
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
  if (finalReport.dormitoryFirstGoldenChainLandingStatus !== state.landingStatus ||
    finalReport.dormitoryFirstGoldenChainLanding?.landingStatus !== state.landingStatus ||
    finalReport.dormitoryFirstGoldenChainLandingStatusEntry?.status !== expectedLandingEntryStatus) {
    failures.push("Final Report dormitory first golden chain landing status must mirror business landing authority state.");
  }
  if (finalReport.businessFeatureDevelopmentAllowed !== expectedBusinessFeatureDevelopmentAllowed ||
    finalReport.dormitoryFirstGoldenChainLandingGoNoGo !== expectedLandingGoNoGo) {
    failures.push("Business landing GO must only come from approved business landing authority.");
  }
  if (finalReport.businessProductionGoNoGo !== "NO_GO" ||
    finalReport.dormitoryL2GoNoGo !== "NO_GO" ||
    finalReport.productionConfirmAllowed !== false ||
    finalReport.productionConfirmGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("S8 business landing must keep production, Dormitory L2, release, and final GO blocked.");
  }
  if (finalReport.statusMatrix?.dormitoryFirstGoldenChainLandingStatus?.status !== expectedLandingEntryStatus) {
    failures.push(`dormitoryFirstGoldenChainLandingStatus must be ${expectedLandingEntryStatus} for the current business landing authority state.`);
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
    node.businessFeatureDevelopmentAllowed !== expectedBusinessFeatureDevelopmentAllowed ||
    node.dormitoryFirstGoldenChainLandingGoNoGo !== expectedLandingGoNoGo ||
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
    businessFeatureDevelopmentAllowed: expectedBusinessFeatureDevelopmentAllowed,
    dormitoryFirstGoldenChainLandingGoNoGo: expectedLandingGoNoGo,
    businessProductionGoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    financePostingAllowed: false,
    dormitoryL2Allowed: false,
    releaseAuthority: false,
    businessGoAuthority: landingApproved,
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
}

function checkDormitory13ScenarioControlEvidence(graph, finalReport, documents) {
  const source = documents.get(dormitory13ScenarioSourcePath);
  const authorityResult = documents.get(dormitory13ScenarioResultFiles[0]);
  const generatedResult = documents.get(dormitory13ScenarioResultFiles[1]);
  const consumptionResult = documents.get(dormitory13ScenarioResultFiles[2]);
  const sourceDigest = authorityResult?.authorityDigest ?? generatedResult?.sourceDigest ?? consumptionResult?.sourceDigest;

  for (const file of dormitory13ScenarioEvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory 13 scenario evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory 13 scenario evidence file: ${file}`);
    }
  }

  if (source?.authorityId !== "Dormitory.Operating13ScenarioControl" ||
    source?.sourceAuthorityRole !== "lodging_operating_scenario_supply_chain_control" ||
    source?.status !== "authoritative") {
    failures.push("dormitory 13 scenario Source Authority identity must remain authoritative and unique.");
  }
  if ((source?.scenarios ?? []).length !== 13) {
    failures.push("dormitory 13 scenario Source Authority must define exactly 13 scenarios.");
  }
  if ((source?.stateLadder ?? []).length !== 14) {
    failures.push("dormitory 13 scenario Source Authority must define exactly 14 state ladder entries.");
  }
  if (source?.finalSafety?.businessFeatureDevelopmentAllowed !== false ||
    source?.finalSafety?.productionConfirmAllowed !== false ||
    source?.finalSafety?.releaseAuthority !== false ||
    source?.finalSafety?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory 13 scenario Source Authority finalSafety must keep business/release/final GO disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory 13 scenario ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory 13 scenario ${label} result must keep production/release/final GO disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory 13 scenario evidence must expose a sha256 Source digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitory13ScenarioGeneratedFiles.length) {
    failures.push("dormitory 13 scenario generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitory13ScenarioGeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory 13 scenario generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory 13 scenario generated file source digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory 13 scenario generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory 13 scenario generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of [
    "canonical",
    "scenarioIndex",
    "fieldMatrix",
    "pageEntryPolicy",
    "handoffSummaries",
    "financeBoundary",
    "mobileMirror",
    "runtimeMirror"
  ]) {
    if (!dormitory13ScenarioGeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory 13 scenario consumption boundary missing generated path: ${requiredPath}`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory 13 scenario evidence closes.");
  }
}

function checkDormitory13ScenarioIntegrationChainEvidence(graph, finalReport, documents) {
  const result = documents.get(dormitory13ScenarioIntegrationChainResultFiles[0]);

  for (const file of dormitory13ScenarioIntegrationChainEvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory 13 scenario integration chain evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory 13 scenario integration chain evidence file: ${file}`);
    }
  }

  if (result?.status !== "PASS") {
    failures.push("dormitory 13 scenario integration chain result must be PASS.");
  }
  if (result?.chainCount !== 5 || result?.completedChainCount !== 5) {
    failures.push("dormitory 13 scenario integration chain must cover and pass exactly five A-E chains.");
  }
  const chainIds = (result?.chains ?? []).map((item) => item.chainId).sort().join("");
  if (chainIds !== "ABCDE") {
    failures.push(`dormitory 13 scenario integration chain must include chains A-E, actual: ${chainIds || "missing"}.`);
  }
  for (const chain of result?.chains ?? []) {
    if (chain.status !== "PASS" ||
      chain.upstreamSummaryReadonly !== true ||
      chain.downstreamNoReentry !== true ||
      chain.unauthorizedWriteBlocked !== true ||
      chain.productionConfirmAllowed !== false ||
      chain.releaseAuthority !== false ||
      chain.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory integration chain ${chain.chainId ?? "unknown"} must prove readonly handoff, no refill, blocked unauthorized writes, and NO_GO.`);
    }
  }
  const guarantees = result?.guarantees ?? {};
  for (const [key, expected] of Object.entries({
    upstreamSummaryReadonly: true,
    downstreamNoRefill: true,
    unauthorizedWriteBlocked: true,
    financeGateOwnsFinanceTruth: true,
    searchDashboardReportReadonly: true,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  })) {
    if (guarantees[key] !== expected) {
      failures.push(`dormitory 13 scenario integration chain guarantee ${key} must be ${expected}.`);
    }
  }
  if (!sha256DigestPattern.test(result?.resultDigest ?? "")) {
    failures.push("dormitory 13 scenario integration chain resultDigest must be sha256.");
  }
  if (result?.productionConfirmAllowed !== false ||
    result?.releaseAuthority !== false ||
    result?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory 13 scenario integration chain result must keep production/release/final GO disabled.");
  }
  const summary = graph.dormitory13ScenarioIntegrationChain ?? {};
  if (summary.status !== "PASS" ||
    summary.chainCount !== 5 ||
    summary.completedChainCount !== 5 ||
    summary.productionConfirmAllowed !== false ||
    summary.releaseAuthority !== false ||
    summary.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must summarize passed dormitory 13 scenario integration chain with NO_GO closed.");
  }
  if (finalReport.dormitory13ScenarioIntegrationChain?.status !== "PASS" ||
    finalReport.dormitory13ScenarioIntegrationChain?.chainCount !== 5 ||
    finalReport.dormitory13ScenarioIntegrationChain?.completedChainCount !== 5 ||
    finalReport.dormitory13ScenarioIntegrationChain?.productionConfirmAllowed !== false ||
    finalReport.dormitory13ScenarioIntegrationChain?.releaseAuthority !== false ||
    finalReport.dormitory13ScenarioIntegrationChain?.finalGoNoGo !== "NO_GO") {
    failures.push("final report must summarize passed dormitory 13 scenario integration chain with NO_GO closed.");
  }
  const node = (graph.nodes ?? []).find((item) => item.id === "DORMITORY-13-SCENARIO-INTEGRATION-CHAIN");
  if (!node) {
    failures.push("evidence graph missing DORMITORY-13-SCENARIO-INTEGRATION-CHAIN proof node.");
  } else if (node.status !== "passed" ||
    node.proofType !== "dormitory-13-scenario-integration-chain" ||
    node.goNoGo !== "NO_GO" ||
    node.releaseAuthority !== false ||
    node.productionConfirmAllowed !== false) {
    failures.push("DORMITORY-13-SCENARIO-INTEGRATION-CHAIN proof node must be passed and keep production/release/final GO closed.");
  }
}

function checkDormitoryScenario1Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario1SourcePath);
  const authorityResult = documents.get(dormitoryScenario1ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario1ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario1ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario1ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario1ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario1BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario1BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario1BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario1BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario1EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 1 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 1 evidence file: ${file}`);
    }
  }

  if (packageIndex?.authorityId !== "Dormitory.LodgingScenarioPackageIndex" ||
    packageIndex?.status !== "authoritative" ||
    packageIndex?.manualEditAllowed !== true) {
    failures.push("lodging scenario package index must remain authoritative manual Source.");
  }
  const firstFive = (packageIndex?.scenarioPackageOrder ?? []).slice(0, 5).map((item) => item.nameZh);
  if (JSON.stringify(firstFive) !== JSON.stringify(["房源建档与基础就绪", "房源运营就绪与状态维护", "住宿商品与价格", "询价与报价", "预订与库存锁定"])) {
    failures.push("lodging scenario package index must keep the new first five business package order.");
  }
  if (source?.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness" ||
    source?.scenarioPackageNo !== 1 ||
    source?.nameZh !== "房源建档与基础就绪" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 1 Source Authority identity must remain 房源建档与基础就绪.");
  }
  if (JSON.stringify((source?.objects ?? []).map((item) => item.objectName)) !== JSON.stringify(["BuildingContext", "Room", "BedSet", "Bed", "BasicReadiness", "EvidenceBinding", "StatusHistory"])) {
    failures.push("dormitory scenario 1 Source must define BuildingContext/Room/BedSet/Bed/BasicReadiness/EvidenceBinding/StatusHistory.");
  }
  if ((source?.steps ?? []).length !== 3 ||
    source?.steps?.[0]?.nameZh !== "房间建档" ||
    source?.steps?.[1]?.nameZh !== "床位组确认" ||
    source?.steps?.[2]?.nameZh !== "基础就绪确认") {
    failures.push("dormitory scenario 1 Source must keep the three-step business process.");
  }
  if (source?.bedGenerationRule?.onlySourceOfBedQuantity !== "room.bedCount" ||
    source?.bedGenerationRule?.bedNoFormat !== "two_digit_01_to_N") {
    failures.push("dormitory scenario 1 Source must keep room.bedCount -> Bed 01..N generation rule.");
  }
  if (source?.NO_GO?.businessFeatureDevelopmentAllowed !== false ||
    source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 1 Source NO_GO must keep business/release/final GO disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 1 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 1 ${label} result must keep production/release/final GO disabled.`);
    }
  }

  if (positiveBrowserReport?.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness" ||
    positiveBrowserReport?.status !== "passed" ||
    positiveBrowserReport?.currentMainAudit !== true ||
    positiveBrowserReport?.sourceEvidencePolicy?.firstGoldenChainCurrentMainAudit !== false) {
    failures.push("dormitory scenario 1 positive browser report must be current scenario1 evidence and keep FirstGoldenChain out of current main audit.");
  }
  if (negativeBrowserReport?.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness" ||
    negativeBrowserReport?.status !== "passed" ||
    negativeBrowserReport?.currentMainAudit !== true ||
    negativeBrowserReport?.sourceEvidencePolicy?.firstGoldenChainCurrentMainAudit !== false) {
    failures.push("dormitory scenario 1 negative browser report must be current scenario1 evidence and keep FirstGoldenChain out of current main audit.");
  }
  if (positiveBrowserReport?.git?.headSha !== finalReport.latestCommit ||
    negativeBrowserReport?.git?.headSha !== finalReport.latestCommit) {
    failures.push("dormitory scenario 1 browser reports must be fresh for the current evidence root commit.");
  }
  if (!positiveScreenshotIndex?.screenshots?.length || !negativeScreenshotIndex?.screenshots?.length) {
    failures.push("dormitory scenario 1 browser screenshot indexes must be present and nonempty.");
  }
  for (const [label, report] of [
    ["positive", positiveBrowserReport],
    ["negative", negativeBrowserReport]
  ]) {
    if (report?.productionConfirmAllowed !== false ||
      report?.businessGoLiveAllowed !== false ||
      report?.releaseAuthority !== false ||
      report?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 1 ${label} browser report must keep production/release/final GO disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 1 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 1 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario1GeneratedFiles.length) {
    failures.push("dormitory scenario 1 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario1GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 1 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 1 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 1 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 1 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 1 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario1GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 1 consumption boundary missing generated path: ${requiredPath}`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 1 evidence closes.");
  }
}

function checkDormitoryBenchmarkInheritanceEvidence(graph, finalReport, documents) {
  const source = documents.get(dormitoryBenchmarkInheritanceSourcePath);
  const authorityResult = documents.get(dormitoryBenchmarkInheritanceResultFiles[0]);
  const generatedResult = documents.get(dormitoryBenchmarkInheritanceResultFiles[1]);
  const scenario2TrialResult = documents.get(dormitoryBenchmarkInheritanceResultFiles[2]);
  const sourceDigest = authorityResult?.contractDigest ?? generatedResult?.generatedFiles?.[0]?.sourceContentDigest;

  for (const file of dormitoryBenchmarkInheritanceEvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory benchmark inheritance evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory benchmark inheritance evidence file: ${file}`);
    }
  }

  if (source?.authorityId !== "Dormitory.Scenario1BenchmarkInheritanceContract" ||
    source?.nameZh !== "场景 1 标杆继承合同" ||
    source?.status !== "authoritative" ||
    source?.manualEditAllowed !== true) {
    failures.push("dormitory benchmark inheritance Source Authority identity must remain 场景 1 标杆继承合同.");
  }
  if (source?.authorityHierarchy?.highestBusinessAuthorityId !== "Dormitory.Operating13ScenarioControl" ||
    source?.authorityHierarchy?.highestBusinessAuthorityRef !== dormitory13ScenarioSourcePath) {
    failures.push("dormitory benchmark inheritance must keep 13 scenario control as highest business authority.");
  }
  if (!JSON.stringify(source?.authorityHierarchy ?? {}).includes("场景 1 是实现方法标杆，不是后续场景的业务规则总源。")) {
    failures.push("dormitory benchmark inheritance must declare scenario 1 as implementation benchmark only.");
  }
  for (const object of ["Room", "BedSet", "Bed", "BasicReadiness"]) {
    if (!(source?.forbiddenInheritanceItems?.businessObjects ?? []).includes(object)) {
      failures.push(`dormitory benchmark inheritance must forbid copying scenario 1 object ${object}.`);
    }
    if ((source?.scenario2StartGateTrial?.differenceChecklist?.objectDifference?.writes ?? []).includes(object)) {
      failures.push(`scenario 2 start gate trial must not write scenario 1 object ${object}.`);
    }
  }
  if (JSON.stringify(source?.subsequentScenarioStartGate?.appliesToScenarioNos ?? []) !== JSON.stringify([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])) {
    failures.push("dormitory benchmark inheritance start gate must cover exactly scenarios 2-13.");
  }
  if (!String(source?.subsequentScenarioStartGate?.blockingRuleZh ?? "").includes("不得开始本场景开发")) {
    failures.push("dormitory benchmark inheritance start gate must block missing checklist.");
  }
  for (const section of ["对象差异", "状态差异", "字段差异", "证据差异", "财务差异", "页面差异", "测试差异"]) {
    if (!(source?.differenceChecklistTemplate?.requiredSections ?? []).includes(section)) {
      failures.push(`dormitory benchmark inheritance difference checklist missing ${section}.`);
    }
  }
  for (const internalId of ["roomId", "bedId", "ratePlanId", "quoteId", "reservationId", "stayId", "paymentId", "depositId", "refundId", "ledgerEntryId", "stableRef", "digest", "projectionVersion", "domainEventId"]) {
    if (!(source?.fieldReviewGate?.forbiddenUserInputFields ?? []).includes(internalId)) {
      failures.push(`dormitory benchmark inheritance field review must forbid ${internalId}.`);
    }
  }
  if (!String(source?.uxAndButtonGate?.entryRules?.search ?? "").includes("只读")) {
    failures.push("dormitory benchmark inheritance search entry must remain readonly.");
  }
  if (source?.globalReadonlyAndFinanceBoundaries?.businessScenarioDirectLedgerWriteAllowed !== false) {
    failures.push("dormitory benchmark inheritance must forbid business scenario direct ledger writes.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["scenario 2 start gate trial", scenario2TrialResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory benchmark inheritance ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory benchmark inheritance ${label} result must keep production/release/final GO disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory benchmark inheritance evidence must expose a sha256 Source digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryBenchmarkInheritanceGeneratedFiles.length) {
    failures.push("dormitory benchmark inheritance generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryBenchmarkInheritanceGeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory benchmark inheritance generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory benchmark inheritance generated file source digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory benchmark inheritance generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory benchmark inheritance generated result missing generated file: ${file}`);
    }
  }

  const scenario2Trial = documents.get("docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json");
  if (scenario2Trial?.trialResult?.status !== "PASS" ||
    scenario2Trial?.trial?.highRiskBoundaries?.operationStatus !== true ||
    scenario2Trial?.trial?.highRiskBoundaries?.mustNotEnterPriceOrReservation !== true) {
    failures.push("dormitory benchmark inheritance scenario 2 generated trial must pass operation-status startup gate and forbid price/reservation.");
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory benchmark inheritance evidence closes.");
  }
}

function checkDormitoryScenario2Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario2SourcePath);
  const authorityResult = documents.get(dormitoryScenario2ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario2ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario2ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario2ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario2ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario2BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario2BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario2BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario2BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario2EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 2 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 2 evidence file: ${file}`);
    }
  }

  const package2 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 2);
  if (package2?.nameZh !== "房源运营就绪与状态维护" ||
    package2?.scenarioId !== "lodging.resource-operation-status") {
    failures.push("lodging scenario package index must keep scenario 2 as 房源运营就绪与状态维护.");
  }
  if (!arraysContainAll(package2?.handoffInputs, ["房间摘要", "床位组摘要", "基础就绪摘要", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("scenario 2 package index must consume only scenario 1 readonly summaries.");
  }
  if (!arraysContainAll(package2?.handoffOutputs, ["房间/床位运营状态摘要", "阻断原因", "预计恢复时间", "可否进入价格维护", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("scenario 2 package index must output only operation status readonly summaries.");
  }
  if (!arraysContainAll(package2?.mustNotOutputZh, ["价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务", "可报价", "可预订"])) {
    failures.push("scenario 2 package index must forbid price/quote/reservation/stay/payment/deposit/refund/ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario2.ResourceOperationStatus" ||
    source?.scenarioPackageNo !== 2 ||
    source?.nameZh !== "房源运营就绪与状态维护" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 2 Source Authority identity must remain 房源运营就绪与状态维护.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 2 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (source?.upstream?.allowedSourcePackageNo !== 1 ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, ["房间摘要", "床位组摘要", "基础就绪摘要", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("dormitory scenario 2 upstream must be scenario 1 readonly handoff only.");
  }
  if (source?.downstream?.allowedConsumerPackageNo !== 3 ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务", "可报价", "可预订"])) {
    failures.push("dormitory scenario 2 downstream must only hand off readonly operation summaries and forbid downstream business facts.");
  }
  const expectedObjects = [
    "OperationResource",
    "RoomOperationStatus",
    "BedOperationStatus",
    "OperationInspection",
    "OperationBlocker",
    "OperationStatusChange",
    "OperationRestore",
    "OperationEvidence",
    "StatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 2 Source must define all operation status objects.");
  }
  for (const object of source?.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 2 ||
      !arraysContainAll(object.requiredLifecycle, ["currentState", "statusHistory", "evidenceHistory", "legalNextActions"])) {
      failures.push(`scenario 2 object must be owned by package 2 and expose lifecycle/history/legal actions: ${object.objectName ?? "unknown"}`);
    }
  }
  const expectedStatuses = ["可运营", "暂不可运营", "部分不可运营", "暂停开放", "维修中", "保洁中", "停售", "异常待处理", "待复查", "已恢复"];
  if (!arraysContainAll(source?.operationStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 2 Source must keep the required operation status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["选择已基础就绪房源", "运营检查", "设置运营状态", "影响确认", "日常状态维护", "恢复运营"])) {
    failures.push("dormitory scenario 2 Source must keep the six business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["operationStatusId", "inspectionId", "roomId", "bedId", "workItemId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
    failures.push("dormitory scenario 2 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedFailureCodes = [
    "upstream_basic_readiness_missing",
    "inspection_required",
    "operation_evidence_missing",
    "unclosed_blocker_for_operable",
    "invalid_status_transition",
    "concurrent_status_conflict",
    "forged_internal_reference",
    "duplicate_submission",
    "readonly_result_write_attempt",
    "post_confirm_inline_edit_forbidden",
    "cross_scenario_price_reservation_forbidden",
    "restore_without_recheck_pass"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 2 failure semantics must cover all required failures and forbid side effects.");
  }
  if (!JSON.stringify(source?.invariants ?? []).includes("查询、搜索、列表、看板、报表永远只读") ||
    !JSON.stringify(source?.invariants ?? []).includes("确认失败不得写 CommandSubmission")) {
    failures.push("dormitory scenario 2 invariants must keep readonly surfaces and no-side-effects failure rule.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 2 Source NO_GO must keep production/release/final GO disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 2 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 2 ${label} result must keep production/release/final GO disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 2 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 2 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario2GeneratedFiles.length) {
    failures.push("dormitory scenario 2 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario2GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 2 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 2 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 2 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 2 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 2 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario2GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 2 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario2ResourceOperationStatus.generated.json") ||
    !runtimeRulesText.includes("Scenario2ResourceOperationRuntimeAdapter")) {
    failures.push("scenario 2 runtime must consume the generated runtime mirror through Scenario2ResourceOperationRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 2 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of ["Dorm.OperationInspectionConfirm", "Dorm.OperationStatusChangeConfirm", "Dorm.OperationBlockerUpdate", "Dorm.OperationRestoreConfirm"]) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 2 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) < 11 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) < 11) {
    failures.push("scenario 2 positive browser report, result and screenshot index must be PASS and contain at least 11 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) < 12 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) < 12) {
    failures.push("scenario 2 negative browser report, result and screenshot index must be PASS and contain at least 12 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("房源运营就绪与状态维护") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 2 positive browser report must prove business name and navigation entries are visible.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务事实") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("已确认事实不能原地编辑")) {
    failures.push("scenario 2 negative browser report must prove no side effects, readonly search and no inline edit.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["roomId", "bedId", "stableRef", "projectionVersion", "domainEventId", "digest", "可报价", "可预订", "生产发布", "final GO", "resource-saleability", "lead-reservation", "golden-chain"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 2 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario2;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 2 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO2-POSITIVE-BROWSER", "DORMITORY-SCENARIO2-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 2 evidence closes.");
  }
}

function checkDormitoryScenario3Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario3SourcePath);
  const authorityResult = documents.get(dormitoryScenario3ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario3ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario3ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario3ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario3ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario3BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario3BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario3BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario3BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario3EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 3 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 3 evidence file: ${file}`);
    }
  }

  const package3 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 3);
  if (package3?.nameZh !== "住宿商品与价格" ||
    package3?.scenarioId !== "lodging.product-and-rate") {
    failures.push("lodging scenario package index must keep scenario 3 as 住宿商品与价格.");
  }
  if (!arraysContainAll(package3?.handoffInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "阻断原因", "可否进入价格维护", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("scenario 3 package index must consume scenario 1/2 readonly summaries.");
  }
  if (!arraysContainAll(package3?.handoffOutputs, ["商品摘要", "价格方案摘要", "价格日历摘要", "价格版本历史", "可否进入询价报价", "证据摘要", "只读对象引用"])) {
    failures.push("scenario 3 package index must output only product/pricing readonly summaries.");
  }
  if (!arraysContainAll(package3?.mustNotOutputZh, ["报价", "库存锁定", "预订", "入住", "收款", "押金", "退款", "账务", "已预订", "已锁定"])) {
    failures.push("scenario 3 package index must forbid quote/inventory/reservation/stay/payment/deposit/refund/ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario3.ProductAndPricing" ||
    source?.scenarioPackageNo !== 3 ||
    source?.nameZh !== "住宿商品与价格" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 3 Source Authority identity must remain 住宿商品与价格.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 3 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [1, 2]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "阻断原因", "可否进入价格维护", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("dormitory scenario 3 upstream must be scenario 1/2 readonly handoff only.");
  }
  if (source?.downstream?.allowedConsumerPackageNo !== 4 ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["报价", "库存锁定", "预订", "入住", "收款", "押金", "退款", "账务", "已预订", "已锁定"])) {
    failures.push("dormitory scenario 3 downstream must only hand off readonly product/pricing summaries and forbid downstream business facts.");
  }
  const expectedObjects = [
    "AccommodationProduct",
    "SellableUnit",
    "ProductResourceBinding",
    "RatePlan",
    "RateRule",
    "PriceCalendar",
    "PriceVersion",
    "PriceEvidence",
    "PriceStatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 3 Source must define all product and pricing objects.");
  }
  for (const object of source?.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 3 ||
      !arraysContainAll(object.requiredLifecycle, ["currentState", "versionHistory", "evidenceHistory", "legalNextActions"])) {
      failures.push(`scenario 3 object must be owned by package 3 and expose lifecycle/history/legal actions: ${object.objectName ?? "unknown"}`);
    }
  }
  const expectedStatuses = ["价格草稿", "待审核", "已生效", "已停用", "已过期", "已作废", "需补充证据"];
  if (!arraysContainAll(source?.priceStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 3 Source must keep the required price status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["选择可运营房源", "定义住宿商品", "配置价格方案", "配置适用日期和规则", "审核与生效确认", "价格维护"])) {
    failures.push("dormitory scenario 3 Source must keep the six business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["productId", "ratePlanId", "priceVersionId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
    failures.push("dormitory scenario 3 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedFailureCodes = [
    "upstream_operable_required",
    "operation_blocked_for_pricing",
    "product_resource_binding_required",
    "product_name_not_binding",
    "price_value_invalid",
    "currency_required",
    "pricing_period_required",
    "date_range_invalid",
    "price_date_conflict",
    "deposit_payment_forbidden",
    "price_evidence_missing",
    "forged_internal_reference",
    "duplicate_submission",
    "concurrent_price_version_conflict",
    "readonly_result_write_attempt",
    "post_effective_inline_edit_forbidden",
    "cross_scenario_quote_reservation_forbidden"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 3 failure semantics must cover all required failures and forbid side effects.");
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("查询、搜索、列表、看板、报表永远只读") ||
    !invariantText.includes("确认失败不得写 CommandSubmission") ||
    !invariantText.includes("价格方案不得写押金、收款或账务事实")) {
    failures.push("dormitory scenario 3 invariants must keep readonly surfaces, no-side-effects failure rule and finance boundary.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 3 Source NO_GO must keep production/release/final GO disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 3 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 3 ${label} result must keep production/release/final GO disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 3 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 3 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario3GeneratedFiles.length) {
    failures.push("dormitory scenario 3 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario3GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 3 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 3 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 3 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 3 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 3 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario3GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 3 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario3ProductAndPricing.generated.json") ||
    !runtimeRulesText.includes("Scenario3ProductPricingRuntimeAdapter")) {
    failures.push("scenario 3 runtime must consume the generated runtime mirror through Scenario3ProductPricingRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 3 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of ["Dorm.AccommodationProductConfirm", "Dorm.RatePlanDefinitionConfirm", "Dorm.PriceVersionActivate", "Dorm.PriceDisable", "Dorm.PriceDraftVoid"]) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 3 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) < 10 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) < 10) {
    failures.push("scenario 3 positive browser report, result and screenshot index must be PASS and contain at least 10 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) < 13 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) < 13) {
    failures.push("scenario 3 negative browser report, result and screenshot index must be PASS and contain at least 13 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("住宿商品与价格") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 3 positive browser report must prove business name and navigation entries are visible.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务事实") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("已生效价格不能原地编辑")) {
    failures.push("scenario 3 negative browser report must prove no side effects, readonly search and no inline edit.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["productId", "ratePlanId", "priceVersionId", "roomId", "bedId", "stableRef", "projectionVersion", "domainEventId", "digest", "可报价", "可预订", "已预订", "已锁定", "已入住", "已收款", "生产发布", "final GO", "RatePlanConfirm", "resource-saleability", "lead-reservation", "golden-chain"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 3 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario3;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 3 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO3-POSITIVE-BROWSER", "DORMITORY-SCENARIO3-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 3 evidence closes.");
  }
}

function checkDormitoryScenario4Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario4SourcePath);
  const authorityResult = documents.get(dormitoryScenario4ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario4ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario4ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario4ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario4ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario4BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario4BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario4BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario4BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario4EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 4 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 4 evidence file: ${file}`);
    }
  }

  const package4 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 4);
  if (package4?.nameZh !== "询价与报价" ||
    package4?.scenarioId !== "lodging.inquiry-and-quote") {
    failures.push("lodging scenario package index must keep scenario 4 as 询价与报价.");
  }
  if (!arraysEqual(package4?.upstreamPackages, [1, 2, 3]) ||
    !arraysEqual(package4?.downstreamPackages, [5])) {
    failures.push("scenario 4 package index must consume packages 1/2/3 and hand off only to package 5.");
  }
  if (!arraysContainAll(package4?.handoffInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "阻断原因", "商品摘要", "价格方案摘要", "价格日历摘要", "价格版本历史", "可否进入询价报价", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("scenario 4 package index must consume scenario 1/2/3 readonly summaries.");
  }
  if (!arraysContainAll(package4?.handoffOutputs, ["询价摘要", "客户需求摘要", "报价单摘要", "报价版本", "价格快照", "报价有效期", "客户反馈", "转预订准备摘要", "证据摘要", "只读对象引用"])) {
    failures.push("scenario 4 package index must output only inquiry/quote readonly summaries.");
  }
  if (!arraysContainAll(package4?.mustNotOutputZh, ["库存锁定", "预订", "入住", "收款", "押金", "退款", "账务", "已锁定", "已预订", "已入住", "已收款"])) {
    failures.push("scenario 4 package index must forbid inventory/reservation/stay/payment/deposit/refund/ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario4.InquiryAndQuote" ||
    source?.scenarioPackageNo !== 4 ||
    source?.nameZh !== "询价与报价" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 4 Source Authority identity must remain 询价与报价.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 4 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [1, 2, 3]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "阻断原因", "商品摘要", "价格方案摘要", "价格日历摘要", "价格版本历史", "可否进入询价报价", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("dormitory scenario 4 upstream must be scenario 1/2/3 readonly handoff only.");
  }
  if (source?.downstream?.allowedConsumerPackageNo !== 5 ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("必须重新校验库存和报价有效期") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["库存锁定", "预订", "入住", "收款", "押金", "退款", "账务", "已锁定", "已预订", "已入住", "已收款"])) {
    failures.push("dormitory scenario 4 downstream must only hand off readonly quote summaries and force package 5 recheck.");
  }

  const expectedObjects = [
    "Inquiry",
    "CustomerContact",
    "StayDemand",
    "QuoteOption",
    "Quote",
    "QuoteVersion",
    "QuotePriceSnapshot",
    "QuoteValidity",
    "QuoteDeliveryRecord",
    "QuoteEvidence",
    "FollowUpTask",
    "QuoteStatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 4 Source must define all inquiry and quote objects.");
  }
  for (const object of source?.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 4 ||
      !arraysContainAll(object.requiredLifecycle, ["currentState", "versionHistory", "evidenceHistory", "legalNextActions"])) {
      failures.push(`scenario 4 object must be owned by package 4 and expose lifecycle/history/legal actions: ${object.objectName ?? "unknown"}`);
    }
  }
  const expectedStatuses = ["询价草稿", "待补充需求", "可报价", "报价草稿", "已报价", "报价已发送", "客户待确认", "报价过期", "报价关闭", "转预订准备"];
  if (!arraysEqual(source?.quoteStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 4 Source must keep the required quote status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["客户询价登记", "填写入住需求", "查看可报价商品", "生成报价草稿", "确认并发送报价", "报价跟进与转预订准备"])) {
    failures.push("dormitory scenario 4 Source must keep the six business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["inquiryId", "customerId", "quoteId", "quoteVersionId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
    failures.push("dormitory scenario 4 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedCommands = [
    "Dorm.InquiryRegister",
    "Dorm.StayDemandConfirm",
    "Dorm.QuoteDraftGenerate",
    "Dorm.QuoteVersionConfirm",
    "Dorm.QuoteSend",
    "Dorm.QuoteClose",
    "Dorm.RequoteCreate",
    "Dorm.ReservationPreparationStart"
  ];
  const commandIds = (source?.commands ?? []).map((item) => item.commandId);
  if (!arraysEqual(commandIds, expectedCommands)) {
    failures.push("dormitory scenario 4 Source must define exactly the eight write commands.");
  }
  const expectedFailureCodes = [
    "contact_required",
    "date_range_invalid",
    "guest_count_invalid",
    "valid_product_required",
    "effective_price_required",
    "operation_blocked_for_quote",
    "quote_validity_required",
    "discount_approval_required",
    "price_snapshot_mismatch",
    "quote_expired_for_reservation_preparation",
    "post_issue_inline_edit_forbidden",
    "forged_internal_reference",
    "duplicate_submission",
    "concurrent_quote_version_conflict",
    "readonly_result_write_attempt",
    "cross_scenario_inventory_reservation_forbidden",
    "finance_fact_forbidden",
    "quote_evidence_missing"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 4 failure semantics must cover all required failures and forbid side effects.");
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("报价必须来自场景包 3 的已生效商品与价格版本") ||
    !invariantText.includes("报价生成时可以读取当时可报价资源，但不得锁定资源") ||
    !invariantText.includes("场景包 5 必须重新校验并锁定库存") ||
    !invariantText.includes("确认失败不得写 CommandSubmission") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 4 invariants must keep price snapshot, no inventory lock, downstream recheck, no-side-effects and readonly surfaces.");
  }
  if (source?.priceSnapshotRule?.mustUseScenario3EffectivePriceVersion !== true ||
    source?.priceSnapshotRule?.userMayOverrideFinalPriceTruth !== false ||
    source?.priceSnapshotRule?.failureCode !== "price_snapshot_mismatch") {
    failures.push("dormitory scenario 4 price snapshot rule must consume scenario 3 effective price and forbid user override.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 4 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 4 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 4 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 4 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 4 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario4GeneratedFiles.length) {
    failures.push("dormitory scenario 4 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario4GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 4 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 4 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 4 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 4 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 4 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario4GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 4 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario4InquiryAndQuote.generated.json") ||
    !runtimeRulesText.includes("Scenario4InquiryQuoteRuntimeAdapter")) {
    failures.push("scenario 4 runtime must consume the generated runtime mirror through Scenario4InquiryQuoteRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 4 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 4 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 11 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 11) {
    failures.push("scenario 4 positive browser report, result and screenshot index must be PASS and contain 11 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 14 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 14) {
    failures.push("scenario 4 negative browser report, result and screenshot index must be PASS and contain 14 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("询价与报价") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("报价有效期") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("场景包 5 必须重新校验库存和报价有效期") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 4 positive browser report must prove business name, validity, package 5 recheck and navigation entries are visible.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务事实") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("已发送报价不能原地编辑") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("发起转预订准备，由下一场景复核")) {
    failures.push("scenario 4 negative browser report must prove no side effects, readonly search, no inline edit and downstream handoff only.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["inquiryId", "customerId", "quoteId", "quoteVersionId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "domainEventId", "digest", "已锁定", "已预订", "已入住", "已收款", "生产发布", "final GO", "RatePlanConfirm", "reservationCreate", "resource-saleability", "lead-reservation", "golden-chain"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 4 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario4;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 4 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO4-POSITIVE-BROWSER", "DORMITORY-SCENARIO4-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 4 evidence closes.");
  }
}

function checkDormitoryScenario5Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario5SourcePath);
  const authorityResult = documents.get(dormitoryScenario5ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario5ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario5ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario5ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario5ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario5BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario5BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario5BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario5BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario5EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 5 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 5 evidence file: ${file}`);
    }
  }

  const package5 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 5);
  if (package5?.nameZh !== "预订与库存锁定" ||
    package5?.scenarioId !== "lodging.reservation-and-inventory-hold") {
    failures.push("lodging scenario package index must keep scenario 5 as 预订与库存锁定.");
  }
  if (!arraysEqual(package5?.upstreamPackages, [1, 2, 3, 4]) ||
    !arraysEqual(package5?.downstreamPackages, [6])) {
    failures.push("scenario 5 package index must consume packages 1/2/3/4 and hand off only to package 6.");
  }
  if (!arraysContainAll(package5?.handoffInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "商品摘要", "价格方案摘要", "价格版本历史", "询价摘要", "客户需求摘要", "报价单摘要", "报价版本", "价格快照", "报价有效期", "客户选择意向", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("scenario 5 package index must consume scenario 1/2/3/4 readonly summaries.");
  }
  if (!arraysContainAll(package5?.handoffOutputs, ["预订确认摘要", "预订号", "客户信息", "日期范围", "人数", "房间/床位", "价格快照", "库存锁定历史", "预订状态", "证据摘要", "只读对象引用"])) {
    failures.push("scenario 5 package index must output only reservation readonly summaries.");
  }
  if (!arraysContainAll(package5?.mustNotOutputZh, ["入住", "已入住", "可入住", "收款", "已收款", "押金", "押金已收", "退款", "账务", "LedgerEntry", "LedgerTransaction"])) {
    failures.push("scenario 5 package index must forbid stay/payment/deposit/refund/ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario5.ReservationAndInventoryHold" ||
    source?.scenarioPackageNo !== 5 ||
    source?.nameZh !== "预订与库存锁定" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 5 Source Authority identity must remain 预订与库存锁定.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 5 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [1, 2, 3, 4]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, ["房间摘要", "床位组摘要", "房间/床位运营状态摘要", "商品摘要", "价格方案摘要", "价格版本历史", "询价摘要", "客户需求摘要", "报价单摘要", "报价版本", "价格快照", "报价有效期", "客户选择意向", "证据摘要", "状态历史", "只读对象引用"])) {
    failures.push("dormitory scenario 5 upstream must be scenario 1/2/3/4 readonly handoff only.");
  }
  if (source?.downstream?.allowedConsumerPackageNo !== 6 ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("必须重新核验") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["Stay", "CheckIn", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "入住", "已入住", "可入住", "收款", "已收款", "押金", "押金已收", "退款", "账务"])) {
    failures.push("dormitory scenario 5 downstream must only hand off readonly reservation summaries and force package 6 recheck.");
  }

  const expectedObjects = [
    "BookingRequest",
    "AvailabilityCheck",
    "AvailabilitySnapshot",
    "InventoryHold",
    "Reservation",
    "ReservationGuest",
    "ReservationResourceBinding",
    "ReservationPriceSnapshot",
    "ReservationPolicySnapshot",
    "ReservationConfirmation",
    "ReservationEvidence",
    "ReservationStatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 5 Source must define all booking, hold and reservation objects.");
  }
  for (const object of source?.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 5 ||
      !arraysContainAll(object.requiredLifecycle, ["currentState", "versionHistory", "evidenceHistory", "legalNextActions"])) {
      failures.push(`scenario 5 object must be owned by package 5 and expose lifecycle/history/legal actions: ${object.objectName ?? "unknown"}`);
    }
  }
  const expectedStatuses = ["待锁定", "锁定中", "已锁定", "锁定过期", "待确认预订", "已预订", "预订确认失败", "转入住准备"];
  if (!arraysEqual(source?.reservationStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 5 Source must keep the required reservation status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["进入预订确认", "复核可订资源", "锁定库存", "确认预订信息", "生成预订", "预订结果与下游准备"])) {
    failures.push("dormitory scenario 5 Source must keep the six business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["bookingRequestId", "inventoryHoldId", "holdId", "reservationId", "reservationNo", "quoteId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
    failures.push("dormitory scenario 5 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedCommands = [
    "Dorm.BookingPreparationStart",
    "Dorm.AvailabilityRecheck",
    "Dorm.InventoryHoldCreate",
    "Dorm.InventoryHoldRelease",
    "Dorm.InventoryHoldExpire",
    "Dorm.ReservationDraftConfirm",
    "Dorm.ReservationConfirm",
    "Dorm.ReservationSummaryOutput"
  ];
  const commandIds = (source?.commands ?? []).map((item) => item.commandId);
  if (!arraysEqual(commandIds, expectedCommands)) {
    failures.push("dormitory scenario 5 Source must define exactly the eight write commands.");
  }
  const expectedFailureCodes = [
    "quote_expired_for_booking",
    "quote_price_snapshot_required",
    "contact_required",
    "date_range_invalid",
    "guest_count_invalid",
    "operation_blocked_for_booking",
    "effective_price_required",
    "resource_unavailable_or_occupied",
    "resource_already_locked",
    "resource_already_reserved",
    "resource_already_stayed",
    "hold_until_required",
    "concurrent_inventory_hold_conflict",
    "inventory_hold_required",
    "hold_expired_for_reservation",
    "price_snapshot_mismatch",
    "reservation_no_user_input_forbidden",
    "forged_internal_reference",
    "duplicate_submission",
    "concurrent_reservation_version_conflict",
    "readonly_result_write_attempt",
    "cross_scenario_checkin_payment_forbidden",
    "finance_fact_forbidden",
    "reservation_evidence_missing"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 5 failure semantics must cover all required failures and forbid side effects.");
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("库存锁定必须按资源和日期范围原子校验") ||
    !invariantText.includes("同一房间/床位在同一日期范围内") ||
    !invariantText.includes("预订号由系统生成") ||
    !invariantText.includes("确认失败不得写 CommandSubmission") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 5 invariants must keep atomic hold, conflict blocking, system reservation number, no-side-effects and readonly surfaces.");
  }
  if (source?.inventoryInvariantRule?.atomicResourceDateCheckRequired !== true ||
    source?.inventoryInvariantRule?.holdUntilRequired !== true ||
    source?.inventoryInvariantRule?.expiredHoldCannotConfirmReservation !== true ||
    source?.inventoryInvariantRule?.reservationNoSystemGenerated !== true ||
    source?.inventoryInvariantRule?.failureCodeForConcurrency !== "concurrent_inventory_hold_conflict") {
    failures.push("dormitory scenario 5 inventory invariant rule must enforce atomic lock, holdUntil, expiry blocking and system reservation number.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 5 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 5 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 5 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 5 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 5 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario5GeneratedFiles.length) {
    failures.push("dormitory scenario 5 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario5GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 5 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 5 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 5 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 5 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 5 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario5GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 5 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario5ReservationAndInventoryHold.generated.json") ||
    !runtimeRulesText.includes("Scenario5ReservationInventoryRuntimeAdapter")) {
    failures.push("scenario 5 runtime must consume the generated runtime mirror through Scenario5ReservationInventoryRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 5 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 5 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 11 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 11) {
    failures.push("scenario 5 positive browser report, result and screenshot index must be PASS and contain 11 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 15 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 15) {
    failures.push("scenario 5 negative browser report, result and screenshot index must be PASS and contain 15 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("预订与库存锁定") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("锁定截止时间") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("系统生成预订号") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 5 positive browser report must prove business name, hold deadline, system reservation number and navigation entries are visible.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务事实") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("库存锁定已过期") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("预订号由系统生成，不能手工填写")) {
    failures.push("scenario 5 negative browser report must prove no side effects, readonly search, expired hold and system-generated reservation number.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["bookingRequestId", "inventoryHoldId", "holdId", "reservationId", "reservationNo", "quoteId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "domainEventId", "digest", "已入住", "已收款", "押金已收", "退款", "生产发布", "final GO", "lead-reservation", "reservationCreate", "reservationConvert", "check-in", "golden-chain"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 5 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario5;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 5 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO5-POSITIVE-BROWSER", "DORMITORY-SCENARIO5-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 5 evidence closes.");
  }
}

function checkDormitoryScenario6Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario6SourcePath);
  const authorityResult = documents.get(dormitoryScenario6ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario6ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario6ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario6ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario6ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario6BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario6BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario6BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario6BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario6EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 6 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 6 evidence file: ${file}`);
    }
  }

  const package6 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 6);
  if (package6?.nameZh !== "收款、押金与担保" ||
    package6?.scenarioId !== "lodging.payment-deposit-and-guarantee") {
    failures.push("lodging scenario package index must keep scenario 6 as 收款、押金与担保.");
  }
  if (!arraysEqual(package6?.upstreamPackages, [5, 3, 4]) ||
    !arraysEqual(package6?.downstreamPackages, [7])) {
    failures.push("scenario 6 package index must consume packages 5/3/4 and hand off only to package 7.");
  }
  if (!arraysContainAll(package6?.handoffInputs, ["预订确认摘要", "预订号", "客户信息", "日期范围", "人数", "房间/床位", "价格快照", "预订状态", "证据摘要", "只读对象引用", "价格方案摘要", "报价单摘要", "报价版本"])) {
    failures.push("scenario 6 package index must consume reservation, price and quote readonly summaries.");
  }
  if (!arraysContainAll(package6?.handoffOutputs, ["收款确认摘要", "押金确认摘要", "担保确认摘要", "剩余待收", "财务确认状态", "证据摘要", "只读对象引用"])) {
    failures.push("scenario 6 package index must output only finance-ready readonly summaries.");
  }
  if (!arraysContainAll(package6?.mustNotOutputZh, ["入住", "已入住", "可入住", "退房", "已退房", "退款", "已退款", "库存变更", "房源状态变更", "LedgerEntry", "LedgerTransaction"])) {
    failures.push("scenario 6 package index must forbid stay/refund/inventory/resource/ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario6.PaymentDepositAndGuarantee" ||
    source?.scenarioPackageNo !== 6 ||
    source?.nameZh !== "收款、押金与担保" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 6 Source Authority identity must remain 收款、押金与担保.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 6 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [5, 3, 4]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, ["预订确认摘要", "预订号", "客户信息", "日期范围", "人数", "房间/床位", "价格快照", "预订状态", "证据摘要", "只读对象引用", "价格方案摘要", "报价单摘要", "报价版本"])) {
    failures.push("dormitory scenario 6 upstream must be scenario 5/3/4 readonly handoff only.");
  }
  if (source?.downstream?.allowedConsumerPackageNo !== 7 ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("必须重新核验") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["Stay", "CheckIn", "Checkout", "Refund", "InventoryRelease", "ResourceStatusChange", "LedgerEntry", "LedgerTransaction", "入住", "已入住", "可入住", "退房", "已退房", "退款", "已退款", "库存释放", "房源状态变更"])) {
    failures.push("dormitory scenario 6 downstream must only hand off readonly finance summaries and force package 7 recheck.");
  }

  const expectedObjects = [
    "PaymentRequirement",
    "PaymentIntent",
    "PaymentReceiptEvidence",
    "DepositRequirement",
    "DepositIntent",
    "DepositGuarantee",
    "FinanceReviewRequest",
    "FinanceConfirmationSnapshot",
    "PaymentStatusHistory",
    "DepositStatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 6 Source must define all payment, deposit, guarantee, finance review and status history objects.");
  }
  for (const object of source?.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 6 ||
      !arraysContainAll(object.requiredLifecycle, ["currentState", "versionHistory", "evidenceHistory", "financeConfirmationHistory", "legalNextActions"])) {
      failures.push(`scenario 6 object must be owned by package 6 and expose lifecycle/history/legal actions: ${object.objectName ?? "unknown"}`);
    }
  }
  const expectedStatuses = ["待提交凭证", "待财务确认", "财务已确认", "财务退回", "部分确认", "押金已确认", "担保已确认", "需补充证据"];
  if (!arraysEqual(source?.paymentDepositStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 6 Source must keep the required payment/deposit status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["进入收款押金办理", "确认应收与押金要求", "提交收款凭证", "提交押金或担保信息", "财务确认", "输出入住前财务摘要"])) {
    failures.push("dormitory scenario 6 Source must keep the six business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["paymentId", "depositId", "guaranteeId", "ledgerEntryId", "ledgerTransactionId", "reservationId", "paymentCaseId", "financeReviewRequestId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
    failures.push("dormitory scenario 6 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedCommands = [
    "Dorm.PaymentDepositCaseStart",
    "Dorm.PaymentDepositRequirementConfirm",
    "Dorm.PaymentReceiptSubmit",
    "Dorm.DepositGuaranteeSubmit",
    "Dorm.FinanceReviewRequest",
    "Dorm.FinanceGateConfirm",
    "Dorm.FinanceGateReturn",
    "Dorm.FinanceEvidenceSupplement",
    "Dorm.FinanceReadySummaryOutput"
  ];
  const commandIds = (source?.commands ?? []).map((item) => item.commandId);
  if (!arraysEqual(commandIds, expectedCommands)) {
    failures.push("dormitory scenario 6 Source must define exactly the nine write commands.");
  }
  const expectedFailureCodes = [
    "reservation_not_confirmed",
    "reservation_cancelled",
    "price_snapshot_required",
    "payment_requirement_source_invalid",
    "amount_must_be_positive",
    "currency_mismatch",
    "receipt_evidence_required",
    "deposit_marked_as_income_forbidden",
    "guarantee_marked_as_payment_forbidden",
    "finance_gate_required",
    "unauthorized_finance_confirmation",
    "forged_internal_reference",
    "ledger_write_forbidden",
    "readonly_result_write_attempt",
    "post_submission_inline_edit_forbidden",
    "confirmed_finance_inline_edit_forbidden",
    "duplicate_submission",
    "concurrent_finance_version_conflict",
    "cross_scenario_checkin_forbidden",
    "finance_evidence_missing",
    "guarantee_validity_required"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 6 failure semantics must cover all required failures and forbid side effects.");
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("未确认预订不得进入") ||
    !invariantText.includes("押金不是收入") ||
    !invariantText.includes("担保不是收款") ||
    !invariantText.includes("finance-gate") ||
    !invariantText.includes("业务 runtime 不得直接写 LedgerEntry") ||
    !invariantText.includes("确认失败不得写 CommandSubmission") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 6 invariants must keep confirmed-reservation entry, finance-gate, deposit/guarantee semantics, no-ledger, no-side-effects and readonly surfaces.");
  }
  if (source?.financeBoundaryRule?.financeGateRequired !== true ||
    source?.financeBoundaryRule?.businessRuntimeMayWriteLedger !== false ||
    source?.financeBoundaryRule?.ledgerEntryWrittenOnlyByFinanceKernel !== true ||
    source?.financeBoundaryRule?.paymentIntentIsNotFinanceTruth !== true ||
    source?.financeBoundaryRule?.depositIsNotIncome !== true ||
    source?.financeBoundaryRule?.guaranteeIsNotPayment !== true ||
    source?.financeBoundaryRule?.financeConfirmationRequiresAuthorizedRole !== true) {
    failures.push("dormitory scenario 6 finance boundary rule must enforce finance-gate, ledger ownership and deposit/guarantee semantics.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 6 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 6 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 6 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 6 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 6 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario6GeneratedFiles.length) {
    failures.push("dormitory scenario 6 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario6GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 6 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 6 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 6 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 6 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 6 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "financeGate", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario6GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 6 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario6PaymentDepositAndGuarantee.generated.json") ||
    !runtimeRulesText.includes("Scenario6PaymentDepositGuaranteeRuntimeAdapter")) {
    failures.push("scenario 6 runtime must consume the generated runtime mirror through Scenario6PaymentDepositGuaranteeRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 6 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 6 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 11 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 11) {
    failures.push("scenario 6 positive browser report, result and screenshot index must be PASS and contain 11 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 14 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 14) {
    failures.push("scenario 6 negative browser report, result and screenshot index must be PASS and contain 14 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("收款、押金与担保") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("押金不是收入") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("担保不是收款") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("剩余待收") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 6 positive browser report must prove business name, deposit/guarantee boundary, finance-gate, remaining receivable and navigation entries are visible.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务事实") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("押金不是收入") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("担保不是收款") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("后续办理需要重新核验")) {
    failures.push("scenario 6 negative browser report must prove no side effects, deposit/guarantee boundary, readonly search, finance-gate and downstream recheck.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["paymentId", "depositId", "guaranteeId", "ledgerEntryId", "ledgerTransactionId", "reservationId", "paymentCaseId", "financeReviewRequestId", "stableRef", "projectionVersion", "domainEventId", "digest", "已入住", "已退房", "已退款", "生产发布", "final GO", "ordinary-payment", "deposit-liability", "PaymentConfirm", "DepositConfirm"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 6 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario6;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 6 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO6-POSITIVE-BROWSER", "DORMITORY-SCENARIO6-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 6 evidence closes.");
  }
}

function checkDormitoryScenario7Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario7SourcePath);
  const authorityResult = documents.get(dormitoryScenario7ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario7ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario7ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario7ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario7ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario7BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario7BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario7BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario7BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario7EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 7 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 7 evidence file: ${file}`);
    }
  }

  const package7 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 7);
  if (package7?.nameZh !== "入住办理" ||
    package7?.scenarioId !== "lodging.check-in-processing") {
    failures.push("lodging scenario package index must keep scenario 7 as 入住办理.");
  }
  if (!arraysEqual(package7?.upstreamPackages, [5, 6, 2, 3]) ||
    !arraysEqual(package7?.downstreamPackages, [8])) {
    failures.push("scenario 7 package index must consume packages 5/6/2/3 and hand off only to package 8.");
  }
  if (!arraysContainAll(package7?.handoffInputs, ["预订确认摘要", "预订号", "客户信息", "日期范围", "人数", "房间/床位", "价格快照", "预订状态", "收款确认摘要", "押金确认摘要", "担保确认摘要", "剩余待收", "财务确认状态", "财务确认摘要", "房源运营状态摘要", "阻断原因", "证据摘要", "只读对象引用"])) {
    failures.push("scenario 7 package index must consume reservation, finance, price and resource readonly summaries.");
  }
  if (!arraysContainAll(package7?.handoffOutputs, ["入住记录摘要", "住客摘要", "房间/床位占用摘要", "入住凭证摘要", "协议摘要", "身份核验摘要", "证据摘要", "只读对象引用"])) {
    failures.push("scenario 7 package index must output only check-in readonly summaries.");
  }
  if (!arraysContainAll(package7?.mustNotOutputZh, ["价格变更", "报价", "预订变更", "收款", "押金变更", "退房结算", "退款", "已退款", "押金已退", "账务入账", "LedgerEntry", "LedgerTransaction"])) {
    failures.push("scenario 7 package index must forbid price/quote/reservation/finance/refund/checkout/ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario7.CheckInProcessing" ||
    source?.scenarioPackageNo !== 7 ||
    source?.nameZh !== "入住办理" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 7 Source Authority identity must remain 入住办理.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 7 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [5, 6, 2, 3]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, package7?.handoffInputs ?? [])) {
    failures.push("dormitory scenario 7 upstream must be scenario 5/6/2/3 readonly handoff only.");
  }
  if (source?.downstream?.allowedConsumerPackageNo !== 8 ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("不得要求用户重新填写已确认入住字段") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["Payment", "Deposit", "Refund", "CheckoutCase", "LedgerEntry", "LedgerTransaction", "价格变更", "报价", "预订变更", "收款", "押金变更", "退款", "退房", "已退房", "已退款", "押金已退", "账务入账"])) {
    failures.push("dormitory scenario 7 downstream must only hand off readonly stay summaries and forbid finance/refund/checkout/ledger outputs.");
  }

  const expectedObjects = [
    "CheckInCase",
    "ArrivingGuest",
    "ResidentProfile",
    "IdentityVerification",
    "Stay",
    "RoomBedOccupancy",
    "CheckInAgreement",
    "AccessCredential",
    "CheckInSnapshot",
    "CheckInEvidence",
    "CheckInStatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 7 Source must define all check-in, guest, stay, occupancy, credential, evidence and status history objects.");
  }
  for (const object of source?.objects ?? []) {
    if (object.ownedByScenarioPackageNo !== 7 ||
      !arraysContainAll(object.requiredLifecycle, ["currentState", "versionHistory", "evidenceHistory", "credentialHistory", "legalNextActions"])) {
      failures.push(`scenario 7 object must be owned by package 7 and expose lifecycle/history/legal actions: ${object.objectName ?? "unknown"}`);
    }
  }
  const expectedStatuses = ["待到店", "待身份核验", "待协议确认", "待财务补齐", "待房源复核", "可办理入住", "已入住", "入住失败", "需人工复核", "凭证待发放", "凭证已发放"];
  if (!arraysEqual(source?.checkInStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 7 Source must keep the required check-in status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["进入入住办理", "到店与身份核验", "财务与协议复核", "房间/床位交付复核", "确认入住", "发放入住凭证"])) {
    failures.push("dormitory scenario 7 Source must keep the six business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["stayId", "residentId", "reservationId", "credentialId", "roomId", "bedId", "occupancyId", "checkInCaseId", "identityVerificationId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
    failures.push("dormitory scenario 7 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedCommands = [
    "Dorm.CheckInDraftStart",
    "Dorm.GuestIdentityVerify",
    "Dorm.CheckInAgreementFinanceReview",
    "Dorm.RoomBedHandoverRecheck",
    "Dorm.StayConfirm",
    "Dorm.StayCredentialIssue",
    "Dorm.CheckInManualReviewRequest",
    "Dorm.CheckInCorrectionRequest"
  ];
  const commandIds = (source?.commands ?? []).map((item) => item.commandId);
  if (!arraysEqual(commandIds, expectedCommands)) {
    failures.push("dormitory scenario 7 Source must define exactly the eight write commands.");
  }
  const expectedFailureCodes = [
    "reservation_not_valid",
    "reservation_cancelled",
    "reservation_expired",
    "reservation_already_converted",
    "finance_rule_unmet_without_exception",
    "manager_exception_approval_required",
    "identity_evidence_required",
    "identity_verification_failed",
    "guest_mismatch_without_approval",
    "agreement_not_confirmed",
    "resource_not_available_for_checkin",
    "resource_already_occupied",
    "resource_blocked_for_checkin",
    "stay_no_user_input_forbidden",
    "credential_before_checkin_forbidden",
    "forged_internal_reference",
    "readonly_result_write_attempt",
    "duplicate_checkin",
    "concurrent_occupancy_conflict",
    "confirmed_checkin_inline_edit_forbidden",
    "cross_scenario_checkout_refund_forbidden"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 7 failure semantics must cover all required failures and forbid side effects.");
  }
  const invariantRule = source?.checkInInvariantRule ?? {};
  for (const key of ["validReservationRequired", "reservationCancelledBlocked", "reservationExpiredBlocked", "reservationAlreadyConvertedBlocked", "resourceAvailableForCheckInRequired", "resourceOccupiedBlocked", "identityVerificationRequired", "agreementConfirmationRequired", "financeReadinessOrManagerExceptionRequired", "stayNoSystemGenerated", "confirmedStayStartsOccupancy", "reservationConvertedToStayOnSuccess", "credentialRequiresSuccessfulStay", "failureNoSideEffects"]) {
    if (invariantRule[key] !== true) {
      failures.push(`scenario 7 invariant rule must keep ${key}=true.`);
    }
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("不得生成 Stay") ||
    !invariantText.includes("不得占用床位") ||
    !invariantText.includes("不得发放入住凭证") ||
    !invariantText.includes("不得写账") ||
    !invariantText.includes("CommandSubmission") ||
    !invariantText.includes("DomainEvent") ||
    !invariantText.includes("Outbox") ||
    !invariantText.includes("Projection") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 7 invariants must keep no Stay/Occupancy/Credential/ledger side effects and readonly surfaces.");
  }
  if (source?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentDepositRefund !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteCheckout !== false ||
    source?.runtimeConsumptionBoundary?.successMayWriteStayOccupancyCredentialOnly !== true) {
    failures.push("dormitory scenario 7 runtime boundary must enforce generated-only consumption and stay/occupancy/credential-only success writes.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 7 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 7 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 7 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 7 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 7 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario7GeneratedFiles.length) {
    failures.push("dormitory scenario 7 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario7GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 7 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 7 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 7 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 7 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 7 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario7GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 7 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario7CheckInProcessing.generated.json") ||
    !runtimeRulesText.includes("Scenario7CheckInProcessingRuntimeAdapter")) {
    failures.push("scenario 7 runtime must consume the generated runtime mirror through Scenario7CheckInProcessingRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 7 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 7 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 10 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 10) {
    failures.push("scenario 7 positive browser report, result and screenshot index must be PASS and contain 10 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 14 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 14) {
    failures.push("scenario 7 negative browser report, result and screenshot index must be PASS and contain 14 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("入住办理") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("入住记录号") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("系统生成") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("房间/床位占用摘要") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 7 positive browser report must prove business name, generated stay number, occupancy summary and navigation entries are visible.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务事实") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("未成功入住，不能发放有效入住凭证") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("后续业务按在住管理和结算流程处理")) {
    failures.push("scenario 7 negative browser report must prove no side effects, readonly search, credential-before-check-in block and downstream process separation.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["stayId", "residentId", "reservationId", "credentialId", "roomId", "bedId", "occupancyId", "checkInCaseId", "identityVerificationId", "stableRef", "projectionVersion", "domainEventId", "digest", "已退房", "已退款", "押金已退", "生产发布", "final GO", "CheckinConfirm", "reservationConvert", "AccessCredentialIssue"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 7 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario7;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 7 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO7-POSITIVE-BROWSER", "DORMITORY-SCENARIO7-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 7 evidence closes.");
  }
}

function checkDormitoryScenario8Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario8SourcePath);
  const authorityResult = documents.get(dormitoryScenario8ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario8ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario8ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario8ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario8ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario8BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario8BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario8BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario8BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario8EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 8 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 8 evidence file: ${file}`);
    }
  }

  const package8 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 8);
  const package9 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 9);
  if (package8?.nameZh !== "在住管理" ||
    package8?.scenarioId !== "lodging.in-stay-management") {
    failures.push("lodging scenario package index must keep scenario 8 as 在住管理.");
  }
  if (!arraysEqual(package8?.upstreamPackages, [7, 6, 2, 3]) ||
    !arraysEqual(package8?.downstreamPackages, [9])) {
    failures.push("scenario 8 package index must consume packages 7/6/2/3 and hand off only to package 9.");
  }
  const expectedInputs = ["入住记录摘要", "住客摘要", "房间/床位占用摘要", "入住凭证摘要", "协议摘要", "身份核验摘要", "财务确认摘要", "当前房源状态摘要", "当前价格摘要", "证据摘要", "只读对象引用"];
  const expectedOutputs = ["在住状态摘要", "当前占用摘要", "服务请求摘要", "异常摘要", "续住/换房换床结果", "凭证状态", "退房准备摘要", "证据摘要", "只读对象引用"];
  if (!arraysContainAll(package8?.handoffInputs, expectedInputs)) {
    failures.push("scenario 8 package index must consume check-in, finance, resource, price and evidence readonly summaries.");
  }
  if (!arraysContainAll(package8?.handoffOutputs, expectedOutputs) ||
    !arraysContainAll(package9?.handoffInputs, expectedOutputs)) {
    failures.push("scenario 8 package index must output only in-stay summaries for scenario 9.");
  }
  if (!arraysContainAll(package8?.mustNotOutputZh, ["退房结算", "退款", "已释放房源", "Payment", "Deposit", "Refund", "CheckoutSettlement", "CheckoutCase", "RoomRelease", "LedgerEntry", "LedgerTransaction"])) {
    failures.push("scenario 8 package index must forbid finance/refund/checkout/release/ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario8.InStayManagement" ||
    source?.scenarioPackageNo !== 8 ||
    source?.nameZh !== "在住管理" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 8 Source Authority identity must remain 在住管理.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 8 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [7, 6, 2, 3]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, expectedInputs)) {
    failures.push("dormitory scenario 8 upstream must be readonly handoff only.");
  }
  if (source?.downstream?.allowedConsumerPackageNo !== 9 ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("不得要求用户重新填写已确认入住字段") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["Payment", "Deposit", "Refund", "CheckoutSettlement", "CheckoutCase", "RoomRelease", "LedgerEntry", "LedgerTransaction", "已退房", "已退款", "已释放房源"])) {
    failures.push("dormitory scenario 8 downstream must only hand off readonly in-stay summaries and forbid finance/refund/checkout/release/ledger outputs.");
  }

  const expectedObjects = [
    "StayManagementCase",
    "StayStatus",
    "ResidentCurrentProfile",
    "OccupancyStatus",
    "AccessCredentialStatus",
    "StayExtensionRequest",
    "BedTransferRequest",
    "ResidentServiceRequest",
    "ResidentIncident",
    "StayEvidence",
    "StayStatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 8 Source must define all in-stay, occupancy, credential, service, incident, extension, transfer, evidence and history objects.");
  }
  const expectedStatuses = ["正常在住", "待跟进", "服务处理中", "异常待处理", "续住待确认", "换房/换床待确认", "凭证待处理", "退房待准备"];
  if (!arraysEqual(source?.stayStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 8 Source must keep the required in-stay status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["进入在住管理", "维护在住状态", "服务请求与跟进", "在住异常记录", "续住申请", "换房/换床申请", "门禁/入住凭证管理", "退房准备"])) {
    failures.push("dormitory scenario 8 Source must keep the eight business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["stayId", "occupancyId", "credentialId", "serviceRequestId", "incidentId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
    failures.push("dormitory scenario 8 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedCommands = [
    "Dorm.StayManagementContextView",
    "Dorm.StayStatusChange",
    "Dorm.ResidentServiceRequestRegister",
    "Dorm.ResidentServiceProgressUpdate",
    "Dorm.ResidentIncidentRegister",
    "Dorm.ResidentIncidentClose",
    "Dorm.StayExtensionRequestSubmit",
    "Dorm.BedTransferRequestSubmit",
    "Dorm.AccessCredentialStatusChange",
    "Dorm.CheckoutPreparationSnapshotCreate",
    "Dorm.StayManagementCorrectionRequest"
  ];
  const commandIds = (source?.commands ?? []).map((item) => item.commandId);
  if (!arraysEqual(commandIds, expectedCommands)) {
    failures.push("dormitory scenario 8 Source must define exactly the in-stay management commands.");
  }
  const expectedFailureCodes = [
    "no_effective_stay",
    "stay_already_checked_out",
    "current_occupancy_required",
    "target_bed_occupied",
    "target_resource_unavailable",
    "target_resource_blocked_for_transfer",
    "extension_date_invalid",
    "extension_finance_requires_finance_gate",
    "service_finance_write_forbidden",
    "incident_refund_forbidden",
    "high_risk_incident_review_required",
    "credential_without_effective_stay_forbidden",
    "credential_after_checkout_forbidden",
    "checkout_preparation_release_forbidden",
    "forged_internal_reference",
    "readonly_result_write_attempt",
    "duplicate_in_stay_submission",
    "concurrent_occupancy_conflict",
    "confirmed_fact_inline_edit_forbidden",
    "unauthorized_in_stay_action",
    "cross_scenario_checkout_refund_ledger_forbidden"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 8 failure semantics must cover all required failures and forbid side effects.");
  }
  const invariantRule = source?.inStayInvariantRule ?? {};
  for (const key of ["effectiveStayRequired", "currentOccupancyRequired", "singleActiveOccupancyPerBedAtSameTime", "transferAppendOnlyOccupancyChanged", "transferReleasesOldAndBindsNewOnSuccess", "extensionDateMustBeLaterThanCurrentCheckout", "extensionFinanceHandledByFinanceGateOnly", "credentialRequiresEffectiveStayAndOccupancy", "checkoutPreparationNotCheckoutSettlement", "failureNoSideEffects"]) {
    if (invariantRule[key] !== true) {
      failures.push(`scenario 8 invariant rule must keep ${key}=true.`);
    }
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("失败路径不得改变占用") ||
    !invariantText.includes("不得生成退房") ||
    !invariantText.includes("不得直接收款或写账") ||
    !invariantText.includes("不得刷新错误 Projection") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 8 invariants must keep no occupancy/checkout/finance/ledger/projection side effects and readonly surfaces.");
  }
  if (source?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentDepositRefund !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteCheckoutSettlement !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayReleaseRoom !== false ||
    source?.runtimeConsumptionBoundary?.successMayWriteInStayFactsOnly !== true) {
    failures.push("dormitory scenario 8 runtime boundary must enforce generated-only consumption and in-stay-only success writes.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 8 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 8 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 8 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 8 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 8 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario8GeneratedFiles.length) {
    failures.push("dormitory scenario 8 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario8GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 8 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 8 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 8 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 8 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 8 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario8GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 8 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario8InStayManagement.generated.json") ||
    !runtimeRulesText.includes("Scenario8InStayManagementRuntimeAdapter")) {
    failures.push("scenario 8 runtime must consume the generated runtime mirror through Scenario8InStayManagementRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 8 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 8 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 10 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 10) {
    failures.push("scenario 8 positive browser report, result and screenshot index must be PASS and contain 10 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 13 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 13) {
    failures.push("scenario 8 negative browser report, result and screenshot index must be PASS and contain 13 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("在住管理") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("服务请求") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("换房/换床不覆盖原入住事实") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("退房准备摘要") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 8 positive browser report must prove business name, service/transfer semantics, checkout preparation summary and navigation entries are visible.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务事实") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("不能发放或恢复凭证") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("进入退房结算场景处理后续事项")) {
    failures.push("scenario 8 negative browser report must prove no side effects, readonly search, credential block and downstream checkout separation.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["stayId", "occupancyId", "credentialId", "serviceRequestId", "incidentId", "roomId", "bedId", "stableRef", "projectionVersion", "domainEventId", "digest", "已退房", "已退款", "已释放房源", "生产发布", "final GO", "StayLifecycle", "bed-transfer-extend", "service-task", "AccessCredentialIssue", "AccessCredentialRevoke"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 8 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario8;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 8 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO8-POSITIVE-BROWSER", "DORMITORY-SCENARIO8-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 8 evidence closes.");
  }
}

function checkDormitoryScenario9Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario9SourcePath);
  const authorityResult = documents.get(dormitoryScenario9ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario9ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario9ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario9ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario9ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario9BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario9BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario9BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario9BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;

  for (const file of dormitoryScenario9EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 9 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 9 evidence file: ${file}`);
    }
  }

  const package9 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 9);
  if (package9?.nameZh !== "退房结算" ||
    package9?.scenarioId !== "lodging.checkout-and-settlement") {
    failures.push("lodging scenario package index must keep scenario 9 as 退房结算.");
  }
  if (!arraysEqual(package9?.upstreamPackages, [7, 8, 6]) ||
    !arraysEqual(package9?.downstreamPackages, [10, 2])) {
    failures.push("scenario 9 package index must consume packages 7/8/6 and hand off to package 10 plus scenario 2 resource recovery.");
  }
  const expectedInputs = ["入住记录摘要", "住客摘要", "房间/床位占用摘要", "收款确认摘要", "押金确认摘要", "财务确认摘要", "在住状态摘要", "当前占用摘要", "服务请求摘要", "异常摘要", "续住/换房换床结果", "凭证状态", "退房准备摘要", "证据摘要", "只读对象引用"];
  const expectedOutputs = ["退房确认摘要", "费用核算摘要", "押金抵扣摘要", "应退/应补意向", "客户确认摘要", "财务处理请求", "资源待恢复请求", "证据摘要", "只读对象引用"];
  if (!arraysContainAll(package9?.handoffInputs, expectedInputs) ||
    !arraysContainAll(package9?.handoffOutputs, expectedOutputs)) {
    failures.push("scenario 9 package index must consume stay/in-stay/finance summaries and output checkout/settlement/resource request summaries only.");
  }
  if (!arraysContainAll(package9?.mustNotOutputZh, ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "RoomOperationStatus=可运营", "已退款", "已入账", "房源已可运营"])) {
    failures.push("scenario 9 package index must forbid finance truth, ledger and direct operational restore outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario9.CheckoutSettlement" ||
    source?.scenarioPackageNo !== 9 ||
    source?.nameZh !== "退房结算" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 9 Source Authority identity must remain 退房结算.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 9 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [7, 8, 6]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, ["入住记录摘要", "在住状态摘要", "押金确认摘要", "退房准备摘要", "只读对象引用"])) {
    failures.push("dormitory scenario 9 upstream must be readonly stay/in-stay/finance summary handoff only.");
  }
  if (!String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("场景包 2") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "RoomOperationStatus=可运营", "已退款", "已入账", "房源已可运营"])) {
    failures.push("dormitory scenario 9 downstream must route actual money to finance-gate and resource recovery to scenario 2.");
  }

  const expectedObjects = [
    "CheckoutCase",
    "CurrentStaySnapshot",
    "CheckoutInspection",
    "RoomBedHandover",
    "DamageAssessment",
    "FeeSettlementDraft",
    "DepositSettlementDraft",
    "RefundRequestIntent",
    "TopUpRequestIntent",
    "CredentialReturnRecord",
    "CheckoutConfirmation",
    "ResourceRecoveryRequest",
    "CheckoutEvidence",
    "CheckoutStatusHistory"
  ];
  const sourceObjects = (source?.objects ?? []).map((item) => item.objectName);
  if (!arraysContainAll(sourceObjects, expectedObjects)) {
    failures.push("dormitory scenario 9 Source must define all checkout, handover, inspection, fee, deposit, finance request, resource recovery, evidence and history objects.");
  }
  const expectedStatuses = ["待退房", "待验房", "待结算", "待客户确认", "待财务处理", "已退房", "结算有争议", "需补证", "资源待保洁", "资源待检查", "资源待维修", "异常待处理"];
  if (!arraysEqual(source?.checkoutStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 9 Source must keep the required checkout status options.");
  }
  const stepNames = (source?.steps ?? []).map((step) => step.nameZh);
  if (JSON.stringify(stepNames) !== JSON.stringify(["进入退房办理", "确认实际离店与交接", "房间/床位检查", "费用核算", "客户确认结算", "确认退房", "财务处理请求与资源恢复交接"])) {
    failures.push("dormitory scenario 9 Source must keep the seven business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, ["stayId", "checkoutCaseId", "settlementId", "refundId", "ledgerEntryId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId", "paymentId", "ledgerTransactionId"])) {
    failures.push("dormitory scenario 9 field boundary must forbid ordinary users from entering internal IDs.");
  }
  const expectedCommands = [
    "Dorm.CheckoutCaseDraftStart",
    "Dorm.CheckoutHandoverConfirm",
    "Dorm.CheckoutInspectionConfirm",
    "Dorm.CheckoutFeeCalculationGenerate",
    "Dorm.CustomerSettlementConfirm",
    "Dorm.CheckoutConfirm",
    "Dorm.CheckoutFinanceRequestCreate",
    "Dorm.ResourceRecoveryRequestCreate",
    "Dorm.CheckoutCorrectionRequest"
  ];
  const commandIds = (source?.commands ?? []).map((item) => item.commandId);
  if (!arraysEqual(commandIds, expectedCommands)) {
    failures.push("dormitory scenario 9 Source must define exactly the checkout settlement commands.");
  }
  const expectedFailureCodes = [
    "no_effective_stay",
    "stay_already_checked_out",
    "actual_checkout_time_required",
    "inspection_evidence_required",
    "damage_description_evidence_required",
    "customer_confirmation_required",
    "disputed_settlement_requires_review",
    "forged_internal_reference",
    "readonly_result_write_attempt",
    "direct_payment_refund_ledger_forbidden",
    "resource_operational_direct_restore_forbidden",
    "duplicate_checkout_submission",
    "concurrent_checkout_conflict"
  ];
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysContainAll(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 9 failure semantics must cover required failures and forbid side effects.");
  }
  const invariantRule = source?.checkoutInvariantRule ?? {};
  for (const key of ["validStayRequired", "currentOccupancyRequired", "actualCheckoutAtRequired", "inspectionEvidenceRequired", "customerConfirmationRequired", "checkoutDoesNotMeanRefunded", "checkoutDoesNotMakeResourceOperational", "financeGateHandlesRefundTopUpLedger", "resourceRecoveryViaScenario2Only", "failureNoSideEffects"]) {
    if (invariantRule[key] !== true) {
      failures.push(`scenario 9 invariant rule must keep ${key}=true.`);
    }
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("失败路径不得结束入住") ||
    !invariantText.includes("不能直接退款、收款或写账") ||
    !invariantText.includes("不得直接恢复可运营") ||
    !invariantText.includes("不得刷新错误 Projection") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 9 invariants must keep no checkout/finance/ledger/operational/projection side effects and readonly surfaces.");
  }
  if (source?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayRestoreOperationalStatus !== false ||
    source?.runtimeConsumptionBoundary?.financeGateMayConsumeSettlementIntentOnly !== true ||
    source?.runtimeConsumptionBoundary?.successMayWriteCheckoutFactsAndRequestsOnly !== true) {
    failures.push("dormitory scenario 9 runtime boundary must enforce generated-only consumption and checkout/request-only success writes.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 9 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 9 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 9 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 9 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 9 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario9GeneratedFiles.length) {
    failures.push("dormitory scenario 9 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario9GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 9 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 9 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 9 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 9 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 9 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "financeGate", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario9GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 9 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario9CheckoutSettlement.generated.json") ||
    !runtimeRulesText.includes("Scenario9CheckoutSettlementRuntimeAdapter")) {
    failures.push("scenario 9 runtime must consume the generated runtime mirror through Scenario9CheckoutSettlementRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 9 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 9 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 12 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 12) {
    failures.push("scenario 9 positive browser report, result and screenshot index must be PASS and contain 12 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 13 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 13) {
    failures.push("scenario 9 negative browser report, result and screenshot index must be PASS and contain 13 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("退房结算") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("退房单号：CO202606160001") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("资源待恢复不是可运营") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日待退房") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 9 positive browser report must prove checkout settlement naming, checkout number, finance-gate handoff, resource recovery separation and navigation entries.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务结果") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("房源运营状态维护复查")) {
    failures.push("scenario 9 negative browser report must prove no side effects, readonly search, finance-gate handoff and scenario 2 resource recovery separation.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of ["stayId", "checkoutCaseId", "settlementId", "refundId", "ledgerEntryId", "roomId", "bedId", "stableRef", "projectionVersion", "domainEventId", "digest", "paymentId", "ledgerTransactionId", "已退款", "已入账", "房源已可运营", "生产发布", "final GO", "CheckoutSettlementApprove", "RefundApprove", "RoomInspectionConfirm"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 9 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario9;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 9 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO9-POSITIVE-BROWSER", "DORMITORY-SCENARIO9-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 9 evidence closes.");
  }
}

function checkDormitoryScenario10Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario10SourcePath);
  const authorityResult = documents.get(dormitoryScenario10ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario10ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario10ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario10ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario10ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario10BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario10BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario10BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario10BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;
  const expectedInputs = [
    "预订确认摘要",
    "预订号",
    "客户信息",
    "日期范围",
    "房间/床位",
    "价格快照",
    "库存锁定历史",
    "预订状态",
    "收款确认摘要",
    "押金确认摘要",
    "担保确认摘要",
    "财务确认状态",
    "入住状态摘要",
    "退房确认摘要",
    "应退/应补意向",
    "财务处理请求",
    "证据摘要",
    "只读对象引用"
  ];
  const expectedOutputs = [
    "取消/未到店关闭摘要",
    "政策计算摘要",
    "退款/扣费申请",
    "库存释放请求",
    "客户确认摘要",
    "财务处理请求",
    "证据摘要",
    "只读对象引用"
  ];
  const expectedObjects = [
    "CancellationCase",
    "NoShowCase",
    "ReservationClosureSnapshot",
    "CancellationPolicySnapshot",
    "PaymentDepositSnapshot",
    "RefundCalculationDraft",
    "RefundRequestIntent",
    "CancellationFeeIntent",
    "ForfeitOrFeeIntent",
    "InventoryReleaseRequest",
    "CustomerConfirmationRecord",
    "CustomerNotificationRecord",
    "FinanceProcessingRequest",
    "CancellationEvidence",
    "CancellationStatusHistory"
  ];
  const expectedStatuses = [
    "取消草稿",
    "未到店草稿",
    "待客户确认",
    "待政策计算",
    "待负责人复核",
    "待财务处理",
    "已取消",
    "未到店已关闭",
    "退款申请已提交",
    "扣费申请已提交",
    "库存释放已请求",
    "争议处理中",
    "财务退回待补证"
  ];
  const expectedSteps = [
    "进入取消/未到店处理",
    "填写处理原因与客户确认",
    "政策与金额计算",
    "库存释放确认",
    "生成退款/扣费处理请求",
    "确认取消或未到店关闭",
    "处理结果与后续跟进"
  ];
  const expectedCommands = [
    "Dorm.CancelNoShowCaseDraftStart",
    "Dorm.CancellationCaseDraftStart",
    "Dorm.NoShowCaseDraftStart",
    "Dorm.CancelNoShowReasonCustomerConfirm",
    "Dorm.CancelNoShowPolicyCalculationGenerate",
    "Dorm.CancelNoShowInventoryReleaseRequestConfirm",
    "Dorm.CancelNoShowFinanceProcessingRequestCreate",
    "Dorm.CancelNoShowConfirmClosure",
    "Dorm.CancellationConfirm",
    "Dorm.NoShowConfirm",
    "Dorm.CancelNoShowDisputeReview",
    "Dorm.CancelNoShowFollowUpRecord",
    "Dorm.CancelNoShowFinanceEvidenceSupplement",
    "Dorm.CancelNoShowCorrectionRequest"
  ];
  const expectedFailureCodes = [
    "no_effective_reservation",
    "payment_deposit_snapshot_required",
    "settlement_intent_required_for_checkout_refund",
    "reservation_already_checked_in",
    "reservation_already_checked_out",
    "reservation_already_cancelled",
    "noshow_hold_time_not_elapsed",
    "noshow_effective_checkin_exists",
    "customer_confirmation_required",
    "dispute_requires_review",
    "policy_amount_source_missing",
    "final_refund_manual_input_forbidden",
    "inventory_release_scope_invalid",
    "forged_internal_reference",
    "readonly_result_write_attempt",
    "direct_refund_payment_ledger_forbidden",
    "finance_gate_required",
    "duplicate_cancellation_submission",
    "concurrent_cancellation_conflict",
    "confirmed_closure_inline_edit_forbidden",
    "unauthorized_cancellation_action"
  ];
  const forbiddenUserInput = [
    "cancellationCaseId",
    "refundId",
    "paymentId",
    "depositId",
    "ledgerEntryId",
    "reservationId",
    "roomId",
    "bedId",
    "stableRef",
    "projectionVersion",
    "digest",
    "domainEventId",
    "ledgerTransactionId",
    "checkoutCaseId",
    "stayId"
  ];

  for (const file of dormitoryScenario10EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 10 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 10 evidence file: ${file}`);
    }
  }

  const package10 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 10);
  if (package10?.nameZh !== "取消、未到店与退款处理" ||
    package10?.scenarioId !== "lodging.cancel-noshow-refund-intake") {
    failures.push("lodging scenario package index must keep scenario 10 as 取消、未到店与退款处理.");
  }
  if (!arraysEqual(package10?.upstreamPackages, [5, 6, 7, 9])) {
    failures.push("scenario 10 package index must consume packages 5/6/7/9.");
  }
  if (!arraysContainAll(package10?.handoffInputs, expectedInputs) ||
    !arraysContainAll(package10?.handoffOutputs, expectedOutputs)) {
    failures.push("scenario 10 package index must consume reservation/payment/check-in/checkout summaries and output cancellation/no-show/request summaries only.");
  }
  if (!arraysContainAll(package10?.mustNotOutputZh, ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "Stay", "CheckoutCase", "RoomOperationStatus=可运营", "已退款到账", "已入账", "已入住", "已退房"])) {
    failures.push("scenario 10 package index must forbid finance truth, ledger, stay/checkout facts and direct operational restore outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario10.CancelNoShowRefund" ||
    source?.scenarioPackageNo !== 10 ||
    source?.nameZh !== "取消、未到店与退款处理" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 10 Source Authority identity must remain 取消、未到店与退款处理.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 10 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [5, 6, 7, 9]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, expectedInputs)) {
    failures.push("dormitory scenario 10 upstream must be readonly reservation/payment/check-in/checkout summary handoff only.");
  }
  if (!String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("inventory-reservation-read-model") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "Stay", "CheckoutCase", "RoomOperationStatus=可运营", "已退款到账", "已入账", "已入住", "已退房"])) {
    failures.push("dormitory scenario 10 downstream must route actual money to finance-gate, inventory to inventory/reservation read model, and forbid forbidden outputs.");
  }

  if (!arraysEqual((source?.objects ?? []).map((item) => item.objectName), expectedObjects)) {
    failures.push("dormitory scenario 10 Source must define cancellation, no-show, snapshot, policy, refund/fee intent, inventory request, customer, finance, evidence and history objects.");
  }
  if (!arraysEqual(source?.cancellationStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 10 Source must keep the required cancellation/no-show status options.");
  }
  if (!arraysEqual((source?.steps ?? []).map((step) => step.nameZh), expectedSteps)) {
    failures.push("dormitory scenario 10 Source must keep seven business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, forbiddenUserInput)) {
    failures.push("dormitory scenario 10 field boundary must forbid ordinary users from entering internal IDs.");
  }
  if (!arraysEqual((source?.commands ?? []).map((item) => item.commandId), expectedCommands)) {
    failures.push("dormitory scenario 10 Source must define exactly the cancel/no-show/refund handling commands.");
  }
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysEqual(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 10 failure semantics must cover required failures and forbid side effects.");
  }
  const invariantRule = source?.cancelNoShowInvariantRule ?? {};
  for (const key of ["validReservationRequired", "paymentDepositSnapshotRequiredForRefund", "settlementIntentRequiredForCheckoutRefund", "alreadyCheckedInBlocksOrdinaryCancellation", "alreadyCheckedOutBlocksOrdinaryCancellation", "alreadyCancelledBlocksDuplicateCancellation", "noShowRequiresHoldTimeElapsed", "noShowRequiresNoEffectiveCheckin", "customerConfirmationRequired", "disputeRequiresReview", "amountSourcesAuthoritative", "finalFinanceTruthManualInputForbidden", "inventoryReleaseScopeBoundToReservation", "financeGateHandlesRefundFeeLedger", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (invariantRule[key] !== true) {
      failures.push(`scenario 10 invariant rule must keep ${key}=true.`);
    }
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("有效预订") ||
    !invariantText.includes("最晚保留时间") ||
    !invariantText.includes("库存释放只能释放当前预订") ||
    !invariantText.includes("不得由用户手填最终账务真值") ||
    !invariantText.includes("finance-gate") ||
    !invariantText.includes("不得刷新错误 Projection") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 10 invariants must keep valid reservation/no-show/inventory/finance/no-side-effect/readonly guards.");
  }
  if (source?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteStayCheckout !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayRestoreOperationalStatus !== false ||
    source?.runtimeConsumptionBoundary?.financeGateMayConsumeRefundFeeIntentOnly !== true ||
    source?.runtimeConsumptionBoundary?.inventoryReadModelMayConsumeReleaseRequestOnly !== true ||
    source?.runtimeConsumptionBoundary?.successMayWriteCancellationNoShowFactsAndRequestsOnly !== true) {
    failures.push("dormitory scenario 10 runtime boundary must enforce generated-only consumption and cancellation/no-show/request-only success writes.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 10 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 10 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 10 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 10 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 10 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario10GeneratedFiles.length) {
    failures.push("dormitory scenario 10 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario10GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 10 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 10 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 10 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 10 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 10 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "financeGate", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario10GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 10 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario10CancelNoShowRefund.generated.json") ||
    !runtimeRulesText.includes("Scenario10CancelNoShowRefundRuntimeAdapter")) {
    failures.push("scenario 10 runtime must consume the generated runtime mirror through Scenario10CancelNoShowRefundRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 10 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 10 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 12 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 12) {
    failures.push("scenario 10 positive browser report, result and screenshot index must be PASS and contain 12 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 15 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 15) {
    failures.push("scenario 10 negative browser report, result and screenshot index must be PASS and contain 15 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("取消、未到店与退款处理") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("取消单号 C202606200001") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("库存释放请求") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("今日未到店待处理") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("工作项") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的")) {
    failures.push("scenario 10 positive browser report must prove naming, cancellation number, finance-gate handoff, inventory release request and navigation entries.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务结果") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("转负责人复核") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("本预订绑定资源和日期范围")) {
    failures.push("scenario 10 negative browser report must prove no side effects, readonly search, finance-gate handoff, dispute review and bounded inventory release.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of [...forbiddenUserInput, "已退款到账", "已入账", "已入住", "已退房", "生产发布", "业务上线", "final GO", "reservationCancel", "reservationNoShow", "RefundApprove", "CheckoutSettlementApprove"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 10 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario10;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 10 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO10-POSITIVE-BROWSER", "DORMITORY-SCENARIO10-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 10 evidence closes.");
  }
}

function checkDormitoryScenario11Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario11SourcePath);
  const authorityResult = documents.get(dormitoryScenario11ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario11ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario11ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario11ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario11ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario11BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario11BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario11BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario11BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;
  const expectedInputs = [
    "运营阻断摘要",
    "阻断原因",
    "预计恢复时间",
    "在住服务请求",
    "服务请求摘要",
    "异常摘要",
    "退房待恢复请求",
    "资源待恢复请求",
    "取消释放资源摘要",
    "库存释放请求",
    "房间/床位",
    "影响范围",
    "证据摘要",
    "只读对象引用"
  ];
  const expectedOutputs = [
    "房务/维修完成摘要",
    "验收摘要",
    "停售建议",
    "恢复运营建议",
    "费用意向",
    "作业证据摘要",
    "状态历史",
    "只读对象引用"
  ];
  const expectedObjects = [
    "ServiceWorkCase",
    "HousekeepingTask",
    "MaintenanceTask",
    "InspectionTask",
    "OutOfServiceRequest",
    "WorkAssignment",
    "WorkAssignee",
    "WorkSchedule",
    "WorkCompletion",
    "WorkCompletionEvidence",
    "WorkVerification",
    "WorkVerificationResult",
    "RecoveryRecommendation",
    "ExpenseIntent",
    "TaskEvidence",
    "StatusHistory",
    "WorkStatusHistory"
  ];
  const expectedStatuses = [
    "待派工",
    "已派工",
    "处理中",
    "待验收",
    "验收通过",
    "验收不通过",
    "返工中",
    "建议停售",
    "建议恢复",
    "已关闭",
    "需财务处理"
  ];
  const expectedSteps = [
    "进入房务/维修处理",
    "派工作业",
    "执行与进度更新",
    "完成作业",
    "验收确认",
    "停售或恢复建议输出",
    "费用意向与财务交接"
  ];
  const expectedCommands = [
    "Dorm.ServiceWorkCaseDraftStart",
    "Dorm.HousekeepingTaskCreate",
    "Dorm.MaintenanceTaskCreate",
    "Dorm.InspectionTaskCreate",
    "Dorm.OutOfServiceRequestDraftStart",
    "Dorm.WorkAssignmentDispatch",
    "Dorm.WorkProgressUpdate",
    "Dorm.WorkCompletionSubmit",
    "Dorm.WorkVerificationConfirm",
    "Dorm.WorkReworkRequest",
    "Dorm.OutOfServiceOrRecoveryRecommendationCreate",
    "Dorm.ExpenseIntentSubmit",
    "Dorm.TaskEvidenceSupplement",
    "Dorm.ServiceWorkCorrectionRequest"
  ];
  const expectedFailureCodes = [
    "no_legal_work_source",
    "missing_work_assignee",
    "missing_work_scope",
    "missing_source_summary",
    "completion_evidence_required",
    "completion_required_before_verification",
    "verification_failure_requires_rework",
    "unresolved_maintenance_recovery_forbidden",
    "direct_operational_restore_forbidden",
    "direct_expense_ledger_forbidden",
    "forged_internal_reference",
    "readonly_result_write_attempt",
    "duplicate_work_submission",
    "concurrent_work_conflict",
    "unauthorized_work_action",
    "confirmed_work_inline_edit_forbidden",
    "invalid_resource_scope",
    "out_of_service_reason_required",
    "recovery_recommendation_requires_resolution",
    "expense_evidence_required"
  ];
  const forbiddenUserInput = [
    "taskId",
    "workItemId",
    "roomId",
    "bedId",
    "stayId",
    "serviceRequestId",
    "serviceWorkCaseId",
    "workAssignmentId",
    "expenseIntentId",
    "ledgerEntryId",
    "reservationId",
    "stableRef",
    "projectionVersion",
    "digest",
    "domainEventId"
  ];

  for (const file of dormitoryScenario11EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 11 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 11 evidence file: ${file}`);
    }
  }

  const package11 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 11);
  if (package11?.nameZh !== "房务、维修与停售协同" ||
    package11?.scenarioId !== "lodging.housekeeping-maintenance-outofservice") {
    failures.push("lodging scenario package index must keep scenario 11 as 房务、维修与停售协同.");
  }
  if (!arraysEqual(package11?.upstreamPackages, [2, 8, 9, 10])) {
    failures.push("scenario 11 package index must consume packages 2/8/9/10.");
  }
  if (!arraysContainAll(package11?.handoffInputs, expectedInputs) ||
    !arraysContainAll(package11?.handoffOutputs, expectedOutputs)) {
    failures.push("scenario 11 package index must consume upstream summaries and output work/recommendation/expense-intent summaries only.");
  }
  if (!arraysContainAll(package11?.mustNotOutputZh, ["RoomOperationStatus=可运营", "Reservation", "Stay", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已可运营", "已可预订", "已入账", "已退款"])) {
    failures.push("scenario 11 package index must forbid operation truth, reservation/stay facts, finance truth and ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService" ||
    source?.scenarioPackageNo !== 11 ||
    source?.nameZh !== "房务、维修与停售协同" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 11 Source Authority identity must remain 房务、维修与停售协同.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 11 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [2, 8, 9, 10]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, expectedInputs)) {
    failures.push("dormitory scenario 11 upstream must be readonly scenario 2/8/9/10 summary handoff only.");
  }
  if (!String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("场景包 2") ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["RoomOperationStatus=可运营", "Reservation", "Stay", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已可运营", "已可预订", "已入账", "已退款"])) {
    failures.push("dormitory scenario 11 downstream must route operational truth to scenario 2, expense truth to finance-gate, and forbid forbidden outputs.");
  }

  if (!arraysEqual((source?.objects ?? []).map((item) => item.objectName), expectedObjects)) {
    failures.push("dormitory scenario 11 Source must define the required work, assignment, completion, verification, recommendation, expense intent, evidence and history objects.");
  }
  if (!arraysEqual(source?.workStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 11 Source must keep the required work status options.");
  }
  if (!arraysEqual((source?.steps ?? []).map((step) => step.nameZh), expectedSteps)) {
    failures.push("dormitory scenario 11 Source must keep seven business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, forbiddenUserInput)) {
    failures.push("dormitory scenario 11 field boundary must forbid ordinary users from entering internal IDs.");
  }
  if (!arraysEqual((source?.commands ?? []).map((item) => item.commandId), expectedCommands)) {
    failures.push("dormitory scenario 11 Source must define exactly the housekeeping/maintenance/out-of-service commands.");
  }
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysEqual(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 11 failure semantics must cover required failures and forbid side effects.");
  }
  const invariantRule = source?.housekeepingMaintenanceInvariantRule ?? {};
  for (const key of ["legalSourceRequired", "sourceSummaryRequired", "resourceScopeRequired", "operationStatusOwnedByScenario2", "completionEvidenceRequired", "verificationAuthorizedRequired", "completionRequiredBeforeVerification", "failedVerificationCreatesReworkOrException", "unresolvedMaintenanceBlocksRecoveryRecommendation", "expenseIntentOnly", "financeGateHandlesExpenseTruth", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (invariantRule[key] !== true) {
      failures.push(`scenario 11 invariant rule must keep ${key}=true.`);
    }
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("合法来源") ||
    !invariantText.includes("不得建议恢复") ||
    !invariantText.includes("不得直接改为可运营") ||
    !invariantText.includes("finance-gate") ||
    !invariantText.includes("不得刷新错误 Projection") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 11 invariants must keep legal-source/recovery/operation/finance/no-side-effect/readonly guards.");
  }
  if (source?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteOperationStatus !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteReservation !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteStay !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    source?.runtimeConsumptionBoundary?.financeGateMayConsumeExpenseIntentOnly !== true ||
    source?.runtimeConsumptionBoundary?.scenario2MayConsumeRecommendationOnly !== true ||
    source?.runtimeConsumptionBoundary?.successMayWriteWorkFactsAndRequestsOnly !== true) {
    failures.push("dormitory scenario 11 runtime boundary must enforce generated-only consumption and work/request-only success writes.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 11 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 11 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 11 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 11 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 11 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario11GeneratedFiles.length) {
    failures.push("dormitory scenario 11 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario11GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 11 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 11 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 11 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 11 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 11 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "financeGate", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario11GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 11 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json") ||
    !runtimeRulesText.includes("Scenario11HousekeepingMaintenanceOutOfServiceRuntimeAdapter")) {
    failures.push("scenario 11 runtime must consume the generated runtime mirror through Scenario11HousekeepingMaintenanceOutOfServiceRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 11 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 11 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 13 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 13) {
    failures.push("scenario 11 positive browser report, result and screenshot index must be PASS and contain 13 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 12 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 12) {
    failures.push("scenario 11 negative browser report, result and screenshot index must be PASS and contain 12 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("房务、维修与停售协同") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("301 房间退房后保洁待验收") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("301-02 床位维修中，预计 18:00 完成") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("场景包 2 重新确认运营状态") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索结果只读跳转") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的只放草稿")) {
    failures.push("scenario 11 positive browser report must prove naming, readable resources, finance-gate handoff, scenario 2 recheck, readonly search and Mine duties.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务结果") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("场景包 2") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("返工")) {
    failures.push("scenario 11 negative browser report must prove no side effects, readonly search, finance-gate handoff, scenario 2 operation boundary and rework route.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of [...forbiddenUserInput, "已可预订", "已可运营", "已入账", "已退款", "生产发布", "业务上线", "final GO", "service-task", "maintenance", "resource-saleability", "RoomInspectionConfirm"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 11 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario11;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 11 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO11-POSITIVE-BROWSER", "DORMITORY-SCENARIO11-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 11 evidence closes.");
  }
}

function checkDormitoryScenario12Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario12SourcePath);
  const authorityResult = documents.get(dormitoryScenario12ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario12ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario12ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario12ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario12ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario12BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario12BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario12BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario12BrowserEvidenceFiles[3]);
  const sourceDigest = authorityResult?.scenarioDigest ?? generatedResult?.scenarioDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;
  const expectedInputs = [
    "房间/床位运营状态摘要",
    "运营阻断摘要",
    "商品摘要",
    "价格方案摘要",
    "价格版本摘要",
    "适用日期",
    "证据摘要",
    "只读对象引用"
  ];
  const expectedOutputs = [
    "渠道摘要",
    "企业客户摘要",
    "协议摘要",
    "适用商品/价格资格摘要",
    "渠道发布规则摘要",
    "佣金/结算规则意向",
    "证据摘要",
    "只读对象引用"
  ];
  const expectedObjects = [
    "ChannelPartner",
    "ChannelAccount",
    "CorporateAccount",
    "CorporateCustomer",
    "CorporateAgreement",
    "AgreementEligibility",
    "ChannelEligibility",
    "CorporateEligibility",
    "ChannelProductMapping",
    "ChannelPublicationRule",
    "ChannelPublicationStatus",
    "CommissionRuleIntent",
    "SettlementRuleIntent",
    "ChannelContact",
    "CorporateContact",
    "ContactPerson",
    "ContractEvidence",
    "StatusHistory",
    "ChannelStatusHistory"
  ];
  const expectedStatuses = [
    "渠道草稿",
    "待审核",
    "已启用",
    "已暂停",
    "已停用",
    "企业客户草稿",
    "协议待审核",
    "协议已生效",
    "协议已过期",
    "协议已停用",
    "发布待检查",
    "发布已启用",
    "发布已暂停",
    "财务规则待确认"
  ];
  const expectedSteps = [
    "建立渠道或企业客户档案",
    "维护合作协议",
    "绑定商品与适用资格",
    "配置渠道发布规则",
    "配置佣金与结算规则意向",
    "审核启用",
    "日常维护"
  ];
  const expectedCommands = [
    "Dorm.ChannelCorporateProfileDraftStart",
    "Dorm.ChannelPartnerProfileCreate",
    "Dorm.CorporateCustomerProfileCreate",
    "Dorm.CorporateAgreementDraftSubmit",
    "Dorm.CorporateAgreementApproveActivate",
    "Dorm.ChannelProductEligibilityBind",
    "Dorm.ChannelPublicationRuleConfigure",
    "Dorm.ChannelPublicationEnable",
    "Dorm.CommissionSettlementIntentSubmit",
    "Dorm.ChannelCorporateAuditDecision",
    "Dorm.ChannelPause",
    "Dorm.ChannelDisable",
    "Dorm.CorporateAgreementRenew",
    "Dorm.ChannelCorporateDailyMaintenance",
    "Dorm.ChannelCorporateEvidenceSupplement",
    "Dorm.ChannelCorporateCorrectionRequest"
  ];
  const expectedFailureCodes = [
    "missing_required_business_profile",
    "missing_key_evidence",
    "invalid_agreement_date_range",
    "agreement_approval_required",
    "expired_agreement_forbidden",
    "inactive_product_price_forbidden",
    "missing_effective_price",
    "operation_blocked_publication_forbidden",
    "direct_rateplan_truth_write_forbidden",
    "direct_quote_reservation_forbidden",
    "direct_inventory_hold_forbidden",
    "direct_finance_ledger_forbidden",
    "forged_internal_reference",
    "readonly_result_write_attempt",
    "duplicate_channel_submission",
    "concurrent_channel_conflict",
    "unauthorized_channel_action",
    "confirmed_agreement_inline_edit_forbidden",
    "commission_settlement_evidence_required",
    "channel_publish_requires_valid_eligibility"
  ];
  const forbiddenUserInput = [
    "channelId",
    "corporateAccountId",
    "agreementId",
    "productId",
    "priceVersionId",
    "ratePlanId",
    "quoteId",
    "reservationId",
    "inventoryHoldId",
    "paymentId",
    "refundId",
    "ledgerEntryId",
    "ledgerTransactionId",
    "stableRef",
    "projectionVersion",
    "digest",
    "domainEventId"
  ];

  for (const file of dormitoryScenario12EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 12 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 12 evidence file: ${file}`);
    }
  }

  const package12 = (packageIndex?.scenarioPackageOrder ?? []).find((item) => item.packageNo === 12);
  if (package12?.nameZh !== "渠道与企业客户" ||
    package12?.scenarioId !== "lodging.channel-corporate-customer") {
    failures.push("lodging scenario package index must keep scenario 12 as 渠道与企业客户.");
  }
  if (!arraysEqual(package12?.upstreamPackages, [2, 3])) {
    failures.push("scenario 12 package index must consume packages 2/3.");
  }
  if (!arraysContainAll(package12?.handoffInputs, expectedInputs) ||
    !arraysContainAll(package12?.handoffOutputs, expectedOutputs)) {
    failures.push("scenario 12 package index must consume upstream summaries and output channel/corporate/agreement/eligibility/intent summaries only.");
  }
  if (!arraysContainAll(package12?.mustNotOutputZh, ["RatePlan 金额真值", "Quote", "Reservation", "InventoryHold", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已报价", "已预订", "已收款", "已入账"])) {
    failures.push("scenario 12 package index must forbid price truth, quote, reservation, inventory hold, finance truth and ledger outputs.");
  }

  if (source?.authorityId !== "Dormitory.Scenario12.ChannelCorporateCustomer" ||
    source?.scenarioPackageNo !== 12 ||
    source?.nameZh !== "渠道与企业客户" ||
    source?.status !== "authoritative") {
    failures.push("dormitory scenario 12 Source Authority identity must remain 渠道与企业客户.");
  }
  if (source?.highestAuthorityRef !== dormitory13ScenarioSourcePath ||
    source?.methodBenchmarkRef !== dormitoryBenchmarkInheritanceSourcePath) {
    failures.push("dormitory scenario 12 Source must reference 13 scenario control as highest authority and scenario 1 benchmark as method contract.");
  }
  if (!arraysEqual(source?.upstream?.allowedSourcePackageNos, [2, 3]) ||
    source?.upstream?.upstreamWriteBackAllowed !== false ||
    !arraysContainAll(source?.upstream?.requiredReadonlyInputs, expectedInputs)) {
    failures.push("dormitory scenario 12 upstream must be readonly scenario 2/3 summary handoff only.");
  }
  if (!String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("场景包 4") ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("场景包 5") ||
    !String(source?.downstream?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
    !arraysContainAll(source?.downstream?.forbiddenOutputsZh, ["RatePlan 金额真值", "Quote", "Reservation", "InventoryHold", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已报价", "已预订", "已收款", "已入账"])) {
    failures.push("dormitory scenario 12 downstream must route quote truth to scenario 4, reservation/inventory truth to scenario 5, commission/settlement truth to finance-gate, and forbid forbidden outputs.");
  }

  if (!arraysEqual((source?.objects ?? []).map((item) => item.objectName), expectedObjects)) {
    failures.push("dormitory scenario 12 Source must define the required channel, corporate, agreement, eligibility, publication, intent, evidence and history objects.");
  }
  if (!arraysEqual(source?.channelCorporateStatusOptions, expectedStatuses)) {
    failures.push("dormitory scenario 12 Source must keep the required channel/corporate status options.");
  }
  if (!arraysEqual((source?.steps ?? []).map((step) => step.nameZh), expectedSteps)) {
    failures.push("dormitory scenario 12 Source must keep seven business action steps in order.");
  }
  if (!arraysContainAll(source?.fields?.forbiddenUserInputFields, forbiddenUserInput)) {
    failures.push("dormitory scenario 12 field boundary must forbid ordinary users from entering internal IDs.");
  }
  if (!arraysEqual((source?.commands ?? []).map((item) => item.commandId), expectedCommands)) {
    failures.push("dormitory scenario 12 Source must define exactly the channel/corporate commands.");
  }
  const failureCodes = (source?.failureSemantics ?? []).map((item) => item.failureCode);
  if (!arraysEqual(failureCodes, expectedFailureCodes) ||
    !(source?.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
    failures.push("dormitory scenario 12 failure semantics must cover required failures and forbid side effects.");
  }
  const invariantRule = source?.channelCorporateInvariantRule ?? {};
  for (const key of ["businessProfileRequired", "keyEvidenceRequiredBeforeEnable", "agreementDateRangeValid", "agreementApprovalRequiredBeforeEffective", "expiredAgreementCannotBeEligible", "productPriceReferenceFromScenario3Only", "effectivePriceRequiredForPublication", "operationBlockPreventsPublication", "channelPublicationDoesNotLockInventory", "quoteOwnedByScenario4", "reservationInventoryOwnedByScenario5", "financeGateHandlesCommissionSettlementTruth", "appendOnlyVersionHistory", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (invariantRule[key] !== true) {
      failures.push(`scenario 12 invariant rule must keep ${key}=true.`);
    }
  }
  const invariantText = JSON.stringify(source?.invariants ?? []);
  if (!invariantText.includes("场景包 3") ||
    !invariantText.includes("场景包 4") ||
    !invariantText.includes("场景包 5") ||
    !invariantText.includes("finance-gate") ||
    !invariantText.includes("不得刷新错误 Projection") ||
    !invariantText.includes("查询、搜索、列表、看板、报表永远只读")) {
    failures.push("dormitory scenario 12 invariants must keep scenario 3/4/5/finance-gate/no-side-effect/readonly guards.");
  }
  if (source?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteRatePlanTruth !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteQuote !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteReservation !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteInventoryHold !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    source?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    source?.runtimeConsumptionBoundary?.financeGateMayConsumeCommissionSettlementIntentOnly !== true ||
    source?.runtimeConsumptionBoundary?.scenario4MayConsumeEligibilityOnly !== true ||
    source?.runtimeConsumptionBoundary?.scenario5MayConsumeEligibilityOnly !== true ||
    source?.runtimeConsumptionBoundary?.successMayWriteChannelCorporateFactsAndIntentsOnly !== true) {
    failures.push("dormitory scenario 12 runtime boundary must enforce generated-only consumption and channel/corporate fact/intent-only success writes.");
  }
  if (source?.NO_GO?.productionConfirmAllowed !== false ||
    source?.NO_GO?.businessGoLiveAllowed !== false ||
    source?.NO_GO?.releaseAuthority !== false ||
    source?.NO_GO?.finalGoNoGo !== "NO_GO") {
    failures.push("dormitory scenario 12 Source NO_GO must keep production/business/release/final approval disabled.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 12 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 12 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 12 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 12 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario12GeneratedFiles.length) {
    failures.push("dormitory scenario 12 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario12GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 12 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 12 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 12 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 12 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 12 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "financeGate", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario12GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 12 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario12ChannelCorporateCustomer.generated.json") ||
    !runtimeRulesText.includes("Scenario12ChannelCorporateCustomerRuntimeAdapter")) {
    failures.push("scenario 12 runtime must consume the generated runtime mirror through Scenario12ChannelCorporateCustomerRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 12 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 12 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 12 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 12) {
    failures.push("scenario 12 positive browser report, result and screenshot index must be PASS and contain 12 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 13 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 13) {
    failures.push("scenario 12 negative browser report, result and screenshot index must be PASS and contain 13 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("渠道与企业客户") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("某某公司协议客户，有效至 2026-12-31") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("携程渠道，已启用，适用 301 整房按晚价") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("场景包 4 重新生成报价资格") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("场景包 5 重新做预订渠道/企业资格校验") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索结果只读跳转") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的只放草稿")) {
    failures.push("scenario 12 positive browser report must prove naming, readable channel/corporate summaries, finance-gate handoff, scenario 4/5 recheck, readonly search and Mine duties.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务结果") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("场景包 4") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("场景包 5")) {
    failures.push("scenario 12 negative browser report must prove no side effects, readonly search, finance-gate handoff, scenario 4 quote boundary and scenario 5 reservation/inventory boundary.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of [...forbiddenUserInput, "已报价", "已预订", "已收款", "已入账", "生产发布", "业务上线", "final GO", "lead-reservation", "RatePlan", "PaymentConfirm", "channel/OTA 临时字段"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 12 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario12;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 12 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO12-POSITIVE-BROWSER", "DORMITORY-SCENARIO12-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 12 evidence closes.");
  }
}

function checkDormitoryScenario13Evidence(graph, finalReport, documents) {
  const packageIndex = documents.get(lodgingScenarioPackageIndexPath);
  const source = documents.get(dormitoryScenario13SourcePath);
  const authorityResult = documents.get(dormitoryScenario13ResultFiles[0]);
  const generatedResult = documents.get(dormitoryScenario13ResultFiles[1]);
  const consumptionResult = documents.get(dormitoryScenario13ResultFiles[2]);
  const positiveBrowserResult = documents.get(dormitoryScenario13ResultFiles[3]);
  const negativeBrowserResult = documents.get(dormitoryScenario13ResultFiles[4]);
  const positiveBrowserReport = documents.get(dormitoryScenario13BrowserEvidenceFiles[0]);
  const positiveScreenshotIndex = documents.get(dormitoryScenario13BrowserEvidenceFiles[1]);
  const negativeBrowserReport = documents.get(dormitoryScenario13BrowserEvidenceFiles[2]);
  const negativeScreenshotIndex = documents.get(dormitoryScenario13BrowserEvidenceFiles[3]);
  const canonical = documents.get("docs/contracts/generated/dormitory/scenario13-reporting-audit-review.generated.json");
  const metricModel = documents.get("docs/contracts/generated/dormitory/scenario13-metric-model.generated.json");
  const stepsFields = documents.get("docs/contracts/generated/dormitory/scenario13-steps-fields.generated.json");
  const runtimeRules = documents.get("docs/contracts/generated/dormitory/scenario13-runtime-rules.generated.json");
  const handoff = documents.get("docs/contracts/generated/dormitory/scenario13-handoff.generated.json");
  const readModel = documents.get("docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json");
  const financeGate = documents.get("docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json");
  const sourceDigest = authorityResult?.scenarioDigest ?? authorityResult?.authorityDigest ?? generatedResult?.sourceDigest ?? consumptionResult?.scenarioDigest;
  const packageIndexDigest = authorityResult?.packageIndexDigest ?? generatedResult?.packageIndexDigest ?? consumptionResult?.packageIndexDigest;
  const expectedCommands = [
    "Dorm.ReportScopeSelect",
    "Dorm.ReportDataQualityCheck",
    "Dorm.BusinessReportSnapshotGenerate",
    "Dorm.FinanceReviewSnapshotGenerate",
    "Dorm.AuditFindingCreate",
    "Dorm.ReviewConclusionActionPlanCreate",
    "Dorm.ActionPlanCreate",
    "Dorm.IssueTrackingItemCreate",
    "Dorm.ReportPublish",
    "Dorm.ReportExportRecordCreate",
    "Dorm.ReportArchive"
  ];
  const forbiddenUserInput = stepsFields?.fields?.forbiddenUserInputFields ?? [];

  for (const file of dormitoryScenario13EvidenceFiles) {
    if (!requiredFiles.includes(file)) {
      failures.push(`dormitory scenario 13 evidence file missing from checker requiredFiles: ${file}`);
    }
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing dormitory scenario 13 evidence file: ${file}`);
    }
  }

  const packageRow = (packageIndex?.scenarioPackageOrder ?? []).find((row) => row.packageNo === 13);
  if (packageRow?.nameZh !== "经营报表、审计与复盘" ||
    packageRow?.scenarioId !== "lodging.reporting-audit-review") {
    failures.push("lodging scenario package index must keep scenario 13 as 经营报表、审计与复盘.");
  }
  if (JSON.stringify(packageRow?.upstreamPackages ?? []) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) ||
    !JSON.stringify(packageRow?.handoffInputs ?? []).includes("finance-gate 已确认账务事实")) {
    failures.push("scenario 13 package index must read packages 1-12 and finance-gate confirmed facts as readonly inputs.");
  }
  for (const output of ["报表快照", "指标快照", "财务核对视图", "审计发现", "复盘结论", "行动计划", "问题追踪", "导出记录", "证据摘要", "只读对象引用"]) {
    if (!(packageRow?.handoffOutputs ?? []).includes(output)) failures.push(`scenario 13 package index missing handoff output: ${output}`);
  }
  for (const forbidden of ["Room", "Bed", "OperationStatus", "RatePlan", "Quote", "Reservation", "Stay", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "已修复原事实", "已入账", "已上线", "final GO"]) {
    if (!(packageRow?.mustNotOutputZh ?? []).includes(forbidden)) failures.push(`scenario 13 package index must forbid output: ${forbidden}`);
  }

  if (source?.authorityId !== "Dormitory.Scenario13.ReportingAuditReview" ||
    source?.nameZh !== "经营报表、审计与复盘" ||
    source?.scenarioPackageNo !== 13) {
    failures.push("dormitory scenario 13 Source Authority identity must remain 经营报表、审计与复盘.");
  }
  if (!JSON.stringify(source?.upstream ?? {}).includes("场景包 1-12 已确认事实摘要") ||
    !JSON.stringify(source?.upstream ?? {}).includes("finance-gate 已确认账务事实") ||
    source?.upstream?.upstreamWriteBackAllowed !== false) {
    failures.push("dormitory scenario 13 upstream must be readonly packages 1-12 and finance-gate facts.");
  }
  if (!JSON.stringify(source?.downstream ?? {}).includes("对应场景包") ||
    !JSON.stringify(source?.downstream ?? {}).includes("finance-gate")) {
    failures.push("dormitory scenario 13 downstream must route action plans back to responsible scenario packages or finance-gate.");
  }
  const sourceObjectNames = (source?.objects ?? []).map((object) => object.objectName ?? object);
  for (const objectName of ["ReportPeriod", "ReportScope", "MetricDefinition", "MetricSnapshot", "ReportSnapshot", "AuditFinding", "EvidenceReviewRecord", "ReviewMeetingRecord", "ReviewConclusion", "ActionPlan", "IssueTrackingItem", "ReportExportRecord", "ReportStatusTimeline", "StatusTimeline"]) {
    if (!sourceObjectNames.includes(objectName)) failures.push(`dormitory scenario 13 Source must define object ${objectName}.`);
  }
  if ((source?.steps ?? []).length !== 7) failures.push("dormitory scenario 13 Source must keep seven business action steps in order.");
  for (const command of expectedCommands) {
    if (!JSON.stringify(source?.commands ?? []).includes(command)) failures.push(`dormitory scenario 13 Source must expose command ${command}.`);
  }
  for (const key of ["reportDashboardSearchExportReadonly", "permissionRequiredForFormalReport", "lineageRequiredForFormalMetric", "freshnessRequiredForPublish", "metricCalculationFromConfirmedFactsOnly", "uiStateMetricCalculationForbidden", "financialMetricsReadFinanceGateOnly", "auditFindingCannotModifySourceFact", "actionPlanRoutesBackOnly", "publishedReportAppendOnlyVersion", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (runtimeRules?.reportingInvariantRule?.[key] !== true) failures.push(`scenario 13 runtime invariant ${key} must be true.`);
  }
  if ((metricModel?.metricCatalog ?? []).length < 15 ||
    metricModel?.metricDefinitionRule?.mustHavePermissionEnvelope !== true ||
    metricModel?.metricDefinitionRule?.mustHaveLineageEnvelope !== true ||
    metricModel?.metricDefinitionRule?.mustHaveFreshnessEnvelope !== true ||
    metricModel?.metricDefinitionRule?.financialMetricsReadFinanceGateOnly !== true) {
    failures.push("scenario 13 metric model must keep catalog, permission, lineage, freshness and finance-gate-only financial metrics.");
  }
  for (const metricKey of ["recognized_revenue", "deposit_balance", "refund_request_count"]) {
    const metric = (metricModel?.metricCatalog ?? []).find((item) => item.metricKey === metricKey);
    if (!metric || metric.financeGateOnly !== true) failures.push(`scenario 13 financial metric ${metricKey} must be finance-gate only.`);
  }
  if (readModel?.readModelMayReadConfirmedFactsOnly !== true ||
    readModel?.readModelMayWriteSourceFacts !== false ||
    !JSON.stringify(readModel?.requiredEnvelopes ?? []).includes("permission envelope") ||
    !JSON.stringify(readModel?.requiredEnvelopes ?? []).includes("lineage envelope") ||
    !JSON.stringify(readModel?.requiredEnvelopes ?? []).includes("freshness envelope")) {
    failures.push("scenario 13 read-model must read confirmed facts only and require permission/lineage/freshness envelopes.");
  }
  if (financeGate?.consumer !== "finance-gate" ||
    financeGate?.financeGateTruthReadonlyOnly !== true ||
    financeGate?.businessRuntimeMayWriteLedger !== false ||
    financeGate?.businessRuntimeMayWritePaymentDepositRefund !== false ||
    financeGate?.financialMetricsReadFinanceGateOnly !== true) {
    failures.push("scenario 13 finance-gate contract must be readonly and forbid business runtime finance truth writes.");
  }

  for (const [label, result] of [
    ["authority", authorityResult],
    ["generated contracts", generatedResult],
    ["consumption boundary", consumptionResult],
    ["positive browser", positiveBrowserResult],
    ["negative browser", negativeBrowserResult]
  ]) {
    if (result?.status !== "PASS") {
      failures.push(`dormitory scenario 13 ${label} result must be PASS.`);
    }
    if (result?.productionConfirmAllowed !== false ||
      result?.releaseAuthority !== false ||
      result?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 13 ${label} result must keep production/release/final approval disabled.`);
    }
  }

  if (!sha256DigestPattern.test(sourceDigest ?? "")) {
    failures.push("dormitory scenario 13 evidence must expose a sha256 Source digest.");
  }
  if (!sha256DigestPattern.test(packageIndexDigest ?? "")) {
    failures.push("dormitory scenario 13 evidence must expose a sha256 package index digest.");
  }
  if (generatedResult?.generatedFileCount !== dormitoryScenario13GeneratedFiles.length) {
    failures.push("dormitory scenario 13 generated contracts result must cover all generated files.");
  }
  const generatedResultPaths = new Set((generatedResult?.generatedFiles ?? []).map((entry) => entry.path));
  for (const file of dormitoryScenario13GeneratedFiles) {
    const generated = documents.get(file);
    if (generated?.generated !== true || generated?.doNotEdit !== true) {
      failures.push(`dormitory scenario 13 generated file must be marked generated/doNotEdit: ${file}`);
    }
    if (generated?.sourceContentDigest !== sourceDigest) {
      failures.push(`dormitory scenario 13 generated file source digest mismatch: ${file}`);
    }
    if (generated?.packageIndexContentDigest !== packageIndexDigest) {
      failures.push(`dormitory scenario 13 generated file package index digest mismatch: ${file}`);
    }
    if (generated?.productionConfirmAllowed !== false ||
      generated?.releaseAuthority !== false ||
      generated?.finalGoNoGo !== "NO_GO") {
      failures.push(`dormitory scenario 13 generated file must keep NO_GO safety flags: ${file}`);
    }
    if (!generatedResultPaths.has(file)) {
      failures.push(`dormitory scenario 13 generated result missing generated file: ${file}`);
    }
  }

  const generatedPaths = consumptionResult?.generatedPaths ?? {};
  for (const requiredPath of ["canonical", "runtimeRules", "surfaceNavigation", "handoff", "readModel", "financeGate", "mobileMirror", "runtimeMirror"]) {
    if (!dormitoryScenario13GeneratedFiles.includes(generatedPaths[requiredPath])) {
      failures.push(`dormitory scenario 13 consumption boundary missing generated path: ${requiredPath}`);
    }
  }
  const runtimeRulesText = documents.get("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs") || "";
  const operationsRuntimeText = documents.get("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs") || "";
  const runtimeTestsText = documents.get("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs") || "";
  if (!runtimeRulesText.includes("DormitoryScenario13ReportingAuditReview.generated.json") ||
    !runtimeRulesText.includes("Scenario13ReportingAuditReviewRuntimeAdapter")) {
    failures.push("scenario 13 runtime must consume the generated runtime mirror through Scenario13ReportingAuditReviewRuntimeAdapter.");
  }
  if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
    failures.push("scenario 13 generated rule rejection must not refresh Projection on failure.");
  }
  for (const command of expectedCommands) {
    if (!runtimeTestsText.includes(command)) {
      failures.push(`scenario 13 runtime tests must cover command ${command}.`);
    }
  }

  if (positiveBrowserReport?.status !== "passed" ||
    positiveBrowserResult?.positiveBrowserAuditDigest !== positiveBrowserReport?.positiveBrowserAuditDigest ||
    !sha256DigestPattern.test(positiveBrowserReport?.positiveBrowserAuditDigest ?? "") ||
    (positiveBrowserReport?.screenshots?.length ?? 0) !== 11 ||
    (positiveScreenshotIndex?.screenshots?.length ?? 0) !== 11) {
    failures.push("scenario 13 positive browser report, result and screenshot index must be PASS and contain 11 screenshots.");
  }
  if (negativeBrowserReport?.status !== "passed" ||
    negativeBrowserResult?.negativeBrowserAuditDigest !== negativeBrowserReport?.negativeBrowserAuditDigest ||
    !sha256DigestPattern.test(negativeBrowserReport?.negativeBrowserAuditDigest ?? "") ||
    (negativeBrowserReport?.screenshots?.length ?? 0) !== 11 ||
    (negativeScreenshotIndex?.screenshots?.length ?? 0) !== 11) {
    failures.push("scenario 13 negative browser report, result and screenshot index must be PASS and contain 11 screenshots.");
  }
  if (!JSON.stringify(positiveBrowserReport ?? {}).includes("经营报表、审计与复盘") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("6 月经营复盘") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("房源、预订、入住、退房、取消、维修、渠道指标") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("finance-gate 确认摘要") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("行动计划回到责任场景包或 finance-gate 处理") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("搜索结果只读跳转") ||
    !JSON.stringify(positiveBrowserReport ?? {}).includes("我的只放草稿")) {
    failures.push("scenario 13 positive browser report must prove reporting flow, finance-gate readonly handoff, action-plan routing, readonly search and Mine duties.");
  }
  if (!JSON.stringify(negativeBrowserReport ?? {}).includes("未写入任何业务结果") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("搜索结果只读") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("finance-gate") ||
    !JSON.stringify(negativeBrowserReport ?? {}).includes("责任场景包")) {
    failures.push("scenario 13 negative browser report must prove no side effects, readonly search, finance-gate handoff, and source-fix routing.");
  }
  for (const report of [positiveBrowserReport, negativeBrowserReport]) {
    const visibleText = (report?.screenshots ?? []).map((shot) => shot.visibleText ?? "").join("\n");
    for (const forbidden of [...forbiddenUserInput, "已修复原事实", "已入账", "已上线", "生产发布", "业务上线", "final GO", "period-review", "dashboard", "analytics"]) {
      if (visibleText.includes(forbidden)) {
        failures.push(`scenario 13 browser screenshots must not expose forbidden visible term: ${forbidden}`);
      }
    }
  }
  const browserSummary = graph.realBrowserEvidence?.scenario13;
  if (browserSummary?.positive?.status !== "passed" ||
    browserSummary?.negative?.status !== "passed" ||
    browserSummary?.productionConfirmAllowed !== false ||
    browserSummary?.finalGoNoGo !== "NO_GO") {
    failures.push("evidence graph must include passed scenario 13 positive/negative browser evidence with NO_GO closed.");
  }
  for (const gate of ["DORMITORY-SCENARIO13-POSITIVE-BROWSER", "DORMITORY-SCENARIO13-NEGATIVE-BROWSER"]) {
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
    } else {
      if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
      if (node.headSha !== finalReport.latestCommit) failures.push(`${gate} node commit does not match final report.`);
      if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
      if (node.businessGoAllowed !== false) failures.push(`${gate} must keep businessGoAllowed=false.`);
    }
  }

  if (canonical?.nameZh !== "经营报表、审计与复盘" ||
    !JSON.stringify(handoff?.downstreamRecheckRuleZh ?? "").includes("对应场景包")) {
    failures.push("scenario 13 generated canonical/handoff must keep reporting audit review identity and route remediation back.");
  }
  if (finalReport.finalGoNoGo !== "NO_GO" ||
    finalReport.releaseAuthority !== false ||
    finalReport.productionConfirmAllowed !== false) {
    failures.push("Final Report must remain NO_GO after dormitory scenario 13 evidence closes.");
  }
}

function arraysContainAll(actual = [], expected = []) {
  const values = new Set((actual ?? []).map((item) => String(item)));
  return (expected ?? []).every((item) => values.has(String(item)));
}

function arraysEqual(actual = [], expected = []) {
  const left = actual ?? [];
  const right = expected ?? [];
  return left.length === right.length &&
    left.every((item, index) => String(item) === String(right[index]));
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
  if (file === firstGoldenChainCapabilityDigestChainPath ||
    file === firstGoldenChainBrowserAuditReportPath ||
    file === firstGoldenChainBrowserAuditScreenshotIndexPath ||
    dormitoryScenario2BrowserEvidenceFiles.includes(file) ||
    dormitoryScenario3BrowserEvidenceFiles.includes(file) ||
    dormitoryScenario4BrowserEvidenceFiles.includes(file) ||
    dormitoryScenario5BrowserEvidenceFiles.includes(file) ||
    dormitoryScenario6BrowserEvidenceFiles.includes(file)) {
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
  const reasons = finalReport.finalDecision?.noGoReasons ?? finalReport.noGoReasons ?? [];
  if (summary.status !== "passed") {
    failures.push(`13 scenario real browser evidence summary must be passed, actual: ${summary.status}`);
  }
  if (summary.status !== "passed" && !reasons.some((reason) => /真实浏览器|real browser/i.test(reason))) {
    failures.push("real browser evidence is not passed but Final Report does not record a NO_GO reason.");
  }
  if (summary.singleWriter !== "scripts/oam/generate-current-evidence-root.mjs") {
    failures.push("real browser evidence must be written by the current evidence root generator.");
  }

  if (summary.currentMainAudit !== "dormitory_13_scenario_browser_evidence_collection") {
    failures.push("real browser current main audit must be the 13 scenario evidence collection.");
  }

  for (let scenarioNo = 1; scenarioNo <= 13; scenarioNo += 1) {
    const scenario = summary[`scenario${scenarioNo}`];
    if (!scenario) {
      failures.push(`real browser evidence missing scenario ${scenarioNo}.`);
      continue;
    }
    if (scenario.currentMainGate !== true) failures.push(`scenario ${scenarioNo} browser evidence must be a current main gate.`);
    for (const kind of ["positive", "negative"]) {
      const item = scenario[kind];
      if (!item) {
        failures.push(`scenario ${scenarioNo} ${kind} browser evidence missing.`);
        continue;
      }
      const digestField = kind === "positive" ? "positiveBrowserAuditDigest" : "negativeBrowserAuditDigest";
      const gate = `DORMITORY-SCENARIO${scenarioNo}-${kind.toUpperCase()}-BROWSER`;
      if (item.status !== "passed") failures.push(`scenario ${scenarioNo} ${kind} browser evidence must be passed.`);
      if (!item.report || !exists(item.report)) failures.push(`scenario ${scenarioNo} ${kind} browser report missing: ${item.report || "(empty)"}.`);
      if (!item.result || !exists(item.result)) failures.push(`scenario ${scenarioNo} ${kind} browser result missing: ${item.result || "(empty)"}.`);
      if ((item.screenshotHashCount ?? 0) <= 0) failures.push(`scenario ${scenarioNo} ${kind} browser evidence has no screenshot hashes.`);
      if (!sha256DigestPattern.test(item[digestField] ?? "")) failures.push(`scenario ${scenarioNo} ${kind} browser digest missing.`);
      if (item.scenarioScope?.currentMainGate !== true) failures.push(`scenario ${scenarioNo} ${kind} browser scenarioScope must be current main gate.`);
      const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
      if (!node) {
        failures.push(`evidence graph missing node for ${gate}.`);
      } else {
        if (node.status !== "passed") failures.push(`${gate} node must be passed.`);
        if (node.reportFresh !== true || node.reportHeadSha !== finalReport.latestCommit) failures.push(`${gate} browser evidence must be fresh for final report commit.`);
        if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
        if (!node.refs?.includes(item.report)) failures.push(`${gate} node missing report ref.`);
      }
    }
  }

  const performanceRecoverability = summary.performanceRecoverability;
  if (!performanceRecoverability) {
    failures.push("real browser evidence missing performance and recoverability audit.");
  } else {
    if (performanceRecoverability.status !== "passed") failures.push("performance and recoverability browser evidence must be passed.");
    if (performanceRecoverability.currentMainGate !== true) failures.push("performance and recoverability browser evidence must be a current main gate.");
    if (!performanceRecoverability.report || !exists(performanceRecoverability.report)) {
      failures.push(`performance and recoverability browser report missing: ${performanceRecoverability.report || "(empty)"}.`);
    }
    if (!performanceRecoverability.result || !exists(performanceRecoverability.result)) {
      failures.push(`performance and recoverability browser result missing: ${performanceRecoverability.result || "(empty)"}.`);
    }
    if ((performanceRecoverability.screenshotHashCount ?? 0) <= 0) {
      failures.push("performance and recoverability browser evidence has no screenshot hashes.");
    }
    if (!sha256DigestPattern.test(performanceRecoverability.performanceRecoverabilityDigest ?? "")) {
      failures.push("performance and recoverability browser digest missing.");
    }
    const node = (graph.nodes || []).find((candidate) => candidate.gate === "DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER");
    if (!node) {
      failures.push("evidence graph missing node for DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER.");
    } else {
      if (node.status !== "passed") failures.push("DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER node must be passed.");
      if (node.reportFresh !== true || node.reportHeadSha !== finalReport.latestCommit) {
        failures.push("DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER evidence must be fresh for final report commit.");
      }
      if (!node.screenshotHashes?.length) failures.push("DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER node missing screenshot hashes.");
      if (!node.refs?.includes(performanceRecoverability.report)) failures.push("DORMITORY-PERFORMANCE-RECOVERABILITY-BROWSER node missing report ref.");
    }
  }

  const finalFrontendUx = summary.finalFrontendUx;
  if (!finalFrontendUx) {
    failures.push("real browser evidence missing final frontend UX acceptance.");
  } else {
    if (finalFrontendUx.status !== "passed") failures.push("final frontend UX acceptance evidence must be passed.");
    if (finalFrontendUx.currentMainGate !== true) failures.push("final frontend UX acceptance evidence must be a current main gate.");
    if (!finalFrontendUx.report || !exists(finalFrontendUx.report)) {
      failures.push(`final frontend UX acceptance report missing: ${finalFrontendUx.report || "(empty)"}.`);
    }
    if (!finalFrontendUx.result || !exists(finalFrontendUx.result)) {
      failures.push(`final frontend UX acceptance result missing: ${finalFrontendUx.result || "(empty)"}.`);
    }
    if (!finalFrontendUx.checklist || !exists(finalFrontendUx.checklist)) {
      failures.push(`final frontend UX acceptance checklist missing: ${finalFrontendUx.checklist || "(empty)"}.`);
    }
    if ((finalFrontendUx.scenarioCount ?? 0) !== 13) failures.push("final frontend UX acceptance must cover 13 scenarios.");
    if ((finalFrontendUx.scenarioScreenshotCount ?? 0) < 300) failures.push("final frontend UX acceptance must cover complete scenario screenshots.");
    if ((finalFrontendUx.entryScreenshotCount ?? 0) < 5) failures.push("final frontend UX acceptance must cover entry screenshots.");
    if ((finalFrontendUx.unresolvedAnalysisMarkerCount ?? 0) !== 0) failures.push("final frontend UX acceptance unresolved analysis markers must be 0.");
    if ((finalFrontendUx.exposedInternalTermCount ?? 0) !== 0) failures.push("final frontend UX acceptance exposed internal/technical terms must be 0.");
    if ((finalFrontendUx.oldChainVisibleTermCount ?? 0) !== 0) failures.push("final frontend UX acceptance old-chain visible terms must be 0.");
    if (!sha256DigestPattern.test(finalFrontendUx.finalFrontendUxDigest ?? "")) {
      failures.push("final frontend UX acceptance digest missing.");
    }
    const node = (graph.nodes || []).find((candidate) => candidate.gate === "DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE");
    if (!node) {
      failures.push("evidence graph missing node for DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE.");
    } else {
      if (node.status !== "passed") failures.push("DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE node must be passed.");
      if (node.reportFresh !== true || node.reportHeadSha !== finalReport.latestCommit) {
        failures.push("DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE evidence must be fresh for final report commit.");
      }
      if (!node.screenshotHashes?.length) failures.push("DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE node missing screenshot hashes.");
      if (!node.refs?.includes(finalFrontendUx.report)) failures.push("DORMITORY-FINAL-FRONTEND-UX-ACCEPTANCE node missing report ref.");
    }
  }

  const quarantine = summary.legacyQuarantine ?? {};
  for (const [key, gate] of [
    ["firstGoldenChain", "DORMITORY-FIRST-GOLDEN-CHAIN-REAL-BROWSER"],
    ["tenScenario", "DORMITORY-TEN-SCENARIO-REAL-BROWSER"],
    ["legacyL1", "DORM-L1-BROWSER-E2E"]
  ]) {
    const item = quarantine[key] ?? summary[key];
    if (!item) {
      continue;
    }
    if (item.currentMainGate === true || item.scenarioScope?.currentMainGate === true) {
      failures.push(`${key} browser evidence must not be a current main gate.`);
    }
    if (!["legacy_regression_only", "legacy_quarantine"].includes(item.lane)) failures.push(`${key} browser evidence must be legacy-only/quarantined.`);
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
  const reportText = JSON.stringify(report);
  const completionLabels = scenario1CompletionVisibleLabels();
  if (!completionLabels.some((label) => reportText.includes(label))) {
    failures.push(`scenario 1 browser report must prove completion is visible: ${completionLabels.join(" / ")}.`);
  }
  for (const requiredLabel of ["房间建档", "床位组确认", "基础就绪确认", "基础就绪结论", "通过"]) {
    if (!reportText.includes(requiredLabel)) {
      failures.push(`scenario 1 browser report must prove ${requiredLabel} is visible.`);
    }
  }
  for (const requiredBoundary of ["不代表可运营", "可报价", "可预订"]) {
    if (!reportText.includes(requiredBoundary)) {
      failures.push(`scenario 1 browser report must prove ${requiredBoundary} boundary is visible.`);
    }
  }
  if (summary.businessGoAllowed !== false || node?.businessGoAllowed !== false) {
    failures.push("first golden chain browser evidence must keep businessGoAllowed=false.");
  }
}

function checkCapabilityDigestChain(graph, finalReport, releaseObject, docs) {
  const testPlanResult = docs.get(testPlanGeneratedFromCapabilityResultPath);
  const browserResult = docs.get(firstGoldenChainBrowserAuditResultPath);
  const dbProjectionProofResult = docs.get(firstGoldenChainDbProjectionProofResultPath);
  const digestChainResult = docs.get(evidenceDigestChainSingleSourceResultPath);
  const digestChainDocument = docs.get(firstGoldenChainCapabilityDigestChainPath);
  if (testPlanResult?.status !== "PASS") {
    failures.push("test plan generated-from-capability result must be PASS.");
  }
  if (browserResult?.status !== "PASS") {
    failures.push("first golden chain browser audit result must be PASS.");
  }
  if (dbProjectionProofResult?.status !== "PASS") {
    failures.push("first golden chain DB projection proof result must be PASS.");
  }
  if (digestChainResult?.status !== "PASS") {
    failures.push("evidence digest chain single-source result must be PASS.");
  }
  const graphChain = graph.capabilityDigestChain;
  if (!graphChain) {
    failures.push("evidence graph missing capabilityDigestChain.");
    return;
  }
  for (const [label, chain, requiresEvidenceRootDigest] of [
    ["capability digest chain file", digestChainDocument, false],
    ["final report", finalReport.capabilityDigestChain, true],
    ["release evidence object", releaseObject?.capabilityDigestChain, true]
  ]) {
    if (!chain) {
      failures.push(`${label} missing capabilityDigestChain.`);
      continue;
    }
    for (const field of [
      "capabilityId",
      "authorityLedgerDigest",
      "acceptedGeneratedBundleDigest",
      "runtimeProjectionDigest",
      "surfaceProjectionDigest",
      "searchProjectionDigest",
      "environmentProfileDigest",
      "positiveBrowserAuditDigest",
      "negativeBrowserAuditDigest",
      "noSideEffectsProofDigest",
      "subjectChainDigest",
      "testPlanDigest",
      "browserAuditDigest",
      "dbProjectionProofDigest",
      "productionConfirmAllowed",
      "releaseAuthority",
      "finalGoNoGo"
    ]) {
      if (chain[field] !== graphChain[field]) {
        failures.push(`${label} capabilityDigestChain.${field} must match evidence graph.`);
      }
    }
    if (requiresEvidenceRootDigest && chain.evidenceRootDigest !== graphChain.evidenceRootDigest) {
      failures.push(`${label} capabilityDigestChain.evidenceRootDigest must match evidence graph.`);
    }
  }
  if (graphChain.capabilityId !== "Dormitory.FirstGoldenChain") {
    failures.push("capability digest chain must bind Dormitory.FirstGoldenChain.");
  }
  for (const field of [
    "authorityLedgerDigest",
    "acceptedGeneratedBundleDigest",
    "runtimeProjectionDigest",
    "surfaceProjectionDigest",
    "searchProjectionDigest",
    "environmentProfileDigest",
    "positiveBrowserAuditDigest",
    "negativeBrowserAuditDigest",
    "noSideEffectsProofDigest",
    "subjectChainDigest",
    "testPlanDigest",
    "browserAuditDigest",
    "evidenceRootDigest"
  ]) {
    if (!sha256DigestPattern.test(String(graphChain[field] ?? ""))) {
      failures.push(`capability digest chain ${field} must be a sha256 digest.`);
    }
  }
  if (graphChain.dbProjectionProofDigest !== "null_if_runtime_test_only" &&
    !sha256DigestPattern.test(String(graphChain.dbProjectionProofDigest ?? ""))) {
    failures.push("capability digest chain dbProjectionProofDigest must be a sha256 digest or null_if_runtime_test_only.");
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
  const expectedBusinessLandingStatus = finalReport.dormitoryFirstGoldenChainLandingGoNoGo === "GO" ? "PASS" : "NO_GO";
  if (matrix.dormitoryFirstGoldenChainLandingStatus?.status !== expectedBusinessLandingStatus) {
    failures.push(`dormitoryFirstGoldenChainLandingStatus must be ${expectedBusinessLandingStatus} for the current business landing authority state.`);
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

function scenario1CompletionVisibleLabels() {
  const source = "房源建档与基础就绪完成";
  const visibleCopyContract = exists(visibleBusinessCopyContractPath)
    ? readJson(visibleBusinessCopyContractPath)
    : {};
  const replacement = (visibleCopyContract.displayTermReplacementsZh ?? [])
    .find(([from]) => from === source)?.[1];
  return Array.from(new Set([source, replacement].filter(Boolean)));
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

function readEvidenceFile(file) {
  if (file.endsWith(".jsonl")) return readJsonl(file);
  if (file.endsWith(".json")) return readJson(file);
  return readText(file);
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
