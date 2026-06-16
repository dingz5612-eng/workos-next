import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateFormalGeneratedCompileAuthorization } from "./lib/formal-generated-compile-authorization.mjs";

const root = process.cwd();
const snapshotPath = "artifacts/oam/checks/generated-compile-execution-input-snapshot.json";
const resultPath = "artifacts/oam/checks/generated-compile-execution-result.json";
const proofPath = "artifacts/oam/evidence/generated-compile-execution-proof.json";
const formalApprovalPath = "docs/oam/generated-compile-approval.current.json";
const candidateApprovalPath = "docs/oam/generated-compile-candidate-approval.current.json";
const attestationPackagePath = "docs/oam/evidence-attestation-packages/dormitory-golden-chain-2b7bc377.attestation.json";
const sourcePackagePath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const dormitory13ScenarioSourcePath =
  "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const dormitoryScenario1SourcePath =
  "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const dormitoryBenchmarkInheritanceSourcePath =
  "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json";
const lodgingScenarioPackageIndexPath =
  "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const dormitoryScenarioSpecs = [
  {
    id: "dormitoryScenario2ResourceOperationStatus",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json",
    generator: "scripts/business/generate-dormitory-scenario2-resource-operation-status-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario2-resource-operation-status-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario2-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario2-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario2-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario2-resource-operation-status-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario2-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario3ProductAndPricing",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json",
    generator: "scripts/business/generate-dormitory-scenario3-product-and-pricing-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario3-product-and-pricing-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario3-product-and-pricing-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario3-product-and-pricing-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario4InquiryAndQuote",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json",
    generator: "scripts/business/generate-dormitory-scenario4-inquiry-and-quote-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario4-inquiry-and-quote-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario4-inquiry-and-quote-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario4-inquiry-and-quote-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario5ReservationAndInventoryHold",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json",
    generator: "scripts/business/generate-dormitory-scenario5-reservation-and-inventory-hold-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario6PaymentDepositAndGuarantee",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json",
    generator: "scripts/business/generate-dormitory-scenario6-payment-deposit-and-guarantee-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario7CheckInProcessing",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json",
    generator: "scripts/business/generate-dormitory-scenario7-check-in-processing-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario7-check-in-processing-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario7-check-in-processing-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario7-check-in-processing-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario7-check-in-processing-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario7-check-in-processing-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario7-check-in-processing-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario8InStayManagement",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json",
    generator: "scripts/business/generate-dormitory-scenario8-in-stay-management-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario8-in-stay-management-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario8-in-stay-management-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario8-in-stay-management-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario8-in-stay-management-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario8-in-stay-management-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario8-in-stay-management-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario9CheckoutSettlement",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json",
    generator: "scripts/business/generate-dormitory-scenario9-checkout-settlement-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario9-checkout-settlement-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario9-checkout-settlement-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario9-checkout-settlement-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario10CancelNoShowRefund",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json",
    generator: "scripts/business/generate-dormitory-scenario10-cancel-noshow-refund-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario11HousekeepingMaintenanceOutOfService",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json",
    generator: "scripts/business/generate-dormitory-scenario11-housekeeping-maintenance-outofservice-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario12ChannelCorporateCustomer",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json",
    generator: "scripts/business/generate-dormitory-scenario12-channel-corporate-customer-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario12-channel-corporate-customer-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario12-channel-corporate-customer-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario12-channel-corporate-customer-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  },
  {
    id: "dormitoryScenario13ReportingAuditReview",
    sourcePath: "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json",
    generator: "scripts/business/generate-dormitory-scenario13-reporting-audit-review-contracts.mjs",
    authorityCheck: "scripts/business/check-dormitory-scenario13-reporting-audit-review-authority.mjs",
    generatedCheck: "scripts/business/check-dormitory-scenario13-reporting-audit-review-generated-contracts.mjs",
    consumptionCheck: "scripts/business/check-dormitory-scenario13-reporting-audit-review-consumption-boundary.mjs",
    generatedResult: "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-generated-contracts-result.json",
    authorityResult: "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-authority-result.json",
    consumptionResult: "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-consumption-boundary-result.json",
    generatedFiles: [
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
    ]
  }
];
const dormitoryScenarioGeneratedFiles = dormitoryScenarioSpecs.flatMap((scenario) => scenario.generatedFiles);
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
const allowedRuntimeGeneratedDiffs = new Set([
  "apps/mobile/src/generated/oam/capability-projection.generated.json",
  "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-benchmark-inheritance.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json",
  ...dormitoryScenarioSpecs.map((scenario) => scenario.generatedFiles.find((file) => file.startsWith("apps/mobile/"))),
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
    "apps/mobile/src/__tests__/MobileOamHardeningMatrix.test.js",
    "apps/mobile/src/__tests__/OperationRouteIdentityContract.test.js",
    "apps/mobile/src/__tests__/SearchIntentHubContract.test.js",
    "apps/mobile/src/__tests__/SearchLearningSync.test.js",
    "apps/mobile/src/__tests__/workspaceSelectors.test.js",
    "apps/mobile/src/businessAnchorKernel.js",
    "apps/mobile/src/capabilityProjection.js",
    "apps/mobile/src/controls/fieldControls.js",
    "apps/mobile/src/controls/optionSetContract.js",
    "apps/mobile/src/fieldSourceRenderer.js",
    "apps/mobile/src/i18n/operationCopy.js",
  "apps/mobile/src/main.js",
  "apps/mobile/src/operationActionState.js",
  "apps/mobile/src/operationController.js",
  "apps/mobile/src/operationRuntime.js",
  "apps/mobile/src/operationValidation.js",
    "apps/mobile/src/operationFieldKernel.js",
    "apps/mobile/src/runtime/runtimeStore.js",
    "apps/mobile/src/searchIntentHub.js",
    "apps/mobile/src/searchIntentRegistry.js",
    "apps/mobile/src/selectors/surfaceSelectors.js",
    "apps/mobile/src/selectors/workspaceSelectors.js",
    "apps/mobile/src/systemContextContract.js",
    "apps/mobile/src/views/checkoutServiceView.js",
    "apps/mobile/src/views/experienceComponents.js",
    "apps/mobile/src/views/searchView.js",
    "apps/mobile/src/views/workbenchView.js",
    "apps/mobile/src/views/workspaceView.js",
  "services/core-api/WorkOS.Api/Program.cs",
  "services/core-api/WorkOS.Api/Runtime/AcceptedCapabilityRuntimeProjection.cs",
  "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json",
  "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1BenchmarkInheritance.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json",
  ...dormitoryScenarioSpecs.map((scenario) => scenario.generatedFiles.find((file) => file.startsWith("services/core-api/"))),
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeEndpoints.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs",
  "services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeQueryService.cs",
  "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
  "services/core-api/WorkOS.Api/Runtime/SliceRuntimeCapabilityGate.cs",
  "services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs",
  "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs",
  "tests/WorkOS.UnitTests/OperationsRuntimeServiceTests.cs"
]);
const generatedOutputFiles = [
  "docs/oam/system-derived-contracts.json",
  "docs/oam/domain-derived-contracts.json",
  "docs/oam/generated-contracts-manifest.json",
  "docs/contracts/admission/admission-contract.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/field-bindings.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "docs/contracts/generated/dormitory/test-plan.generated.json",
  "docs/contracts/generated/dormitory/db-projection-policy.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  "apps/mobile/src/generated/oam/capability-projection.generated.json",
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json",
  ...dormitory13ScenarioGeneratedFiles,
  ...dormitoryScenario1GeneratedFiles,
  ...dormitoryBenchmarkInheritanceGeneratedFiles,
  ...dormitoryScenarioGeneratedFiles,
  "artifacts/oam/evidence/capability-digest-chain.json"
];
const sourceAuthorityFiles = [
  sourcePackagePath,
  dormitory13ScenarioSourcePath,
  lodgingScenarioPackageIndexPath,
  dormitoryScenario1SourcePath,
  dormitoryBenchmarkInheritanceSourcePath,
  ...dormitoryScenarioSpecs.map((scenario) => scenario.sourcePath),
  "docs/business/domains/dormitory/dormitory-operating-kernel.json",
  "docs/oam/system-operating-kernel.json",
  "docs/oam/oam-kernel-graph.json"
];
const generatorAndCheckerFiles = [
  "scripts/business/generate-dormitory-derived-contracts.mjs",
  "scripts/business/generate-dormitory-13-scenario-control-contracts.mjs",
  "scripts/business/check-dormitory-13-scenario-control-authority.mjs",
  "scripts/business/check-dormitory-13-scenario-generated-contracts.mjs",
  "scripts/business/check-dormitory-13-scenario-consumption-boundary.mjs",
  "scripts/business/generate-dormitory-scenario1-resource-basic-readiness-contracts.mjs",
  "scripts/business/check-dormitory-scenario1-resource-basic-readiness-authority.mjs",
  "scripts/business/check-dormitory-scenario1-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario1-consumption-boundary.mjs",
  "scripts/business/generate-dormitory-scenario1-benchmark-inheritance-contracts.mjs",
  "scripts/business/check-dormitory-scenario1-benchmark-inheritance-authority.mjs",
  "scripts/business/check-dormitory-scenario1-benchmark-inheritance-generated-contracts.mjs",
  "scripts/business/check-dormitory-scenario2-start-gate-trial.mjs",
  ...dormitoryScenarioSpecs.flatMap((scenario) => [
    scenario.generator,
    scenario.authorityCheck,
    scenario.generatedCheck,
    scenario.consumptionCheck
  ]),
  "scripts/oam/compile-current-kernel-graph.mjs",
  "scripts/oam/compile-current-capability.mjs",
  "scripts/oam/generate-system-derived-contracts.mjs",
  "scripts/oam/check-generated-files-not-manually-edited.mjs",
  "scripts/oam/check-generated-field-binding-closure.mjs",
  "scripts/oam/check-generated-contract-consistency.mjs",
  "scripts/oam/check-derived-contract-consistency.mjs",
  "scripts/oam/check-oam-kernel-graph.mjs",
  "scripts/oam/check-generated-compile-authorization.mjs",
  "scripts/oam/check-generated-compile-execution.mjs",
  "scripts/oam/lib/formal-generated-compile-authorization.mjs",
  "scripts/oam/lib/dormitory-generated-field-binding-closure.mjs"
];
const compileCommands = [
  ["node", ["scripts/business/generate-dormitory-derived-contracts.mjs"]],
  ["node", ["scripts/oam/compile-current-kernel-graph.mjs"]],
  ["node", ["scripts/oam/compile-current-capability.mjs"]],
  ["node", ["scripts/oam/generate-system-derived-contracts.mjs"]],
  ["node", ["scripts/business/generate-dormitory-13-scenario-control-contracts.mjs"]],
  ["node", ["scripts/business/generate-dormitory-scenario1-resource-basic-readiness-contracts.mjs"]],
  ["node", ["scripts/business/generate-dormitory-scenario1-benchmark-inheritance-contracts.mjs"]],
  ...dormitoryScenarioSpecs.map((scenario) => ["node", [scenario.generator]])
];
const requiredPreGateResults = [
  ["dormitory13ScenarioControlAuthority", "artifacts/oam/checks/dormitory-13-scenario-control-authority-result.json"],
  ["dormitory13ScenarioGeneratedContracts", "artifacts/oam/checks/dormitory-13-scenario-generated-contracts-result.json"],
  ["dormitory13ScenarioConsumptionBoundary", "artifacts/oam/checks/dormitory-13-scenario-consumption-boundary-result.json"],
  ["dormitoryScenario1ResourceBasicReadinessAuthority", "artifacts/oam/checks/dormitory-scenario1-resource-basic-readiness-authority-result.json"],
  ["dormitoryScenario1GeneratedContracts", "artifacts/oam/checks/dormitory-scenario1-generated-contracts-result.json"],
  ["dormitoryScenario1ConsumptionBoundary", "artifacts/oam/checks/dormitory-scenario1-consumption-boundary-result.json"],
  ["dormitoryScenario1BenchmarkInheritanceAuthority", "artifacts/oam/checks/dormitory-scenario1-benchmark-inheritance-authority-result.json"],
  ["dormitoryScenario1BenchmarkInheritanceGeneratedContracts", "artifacts/oam/checks/dormitory-scenario1-benchmark-inheritance-generated-contracts-result.json"],
  ["dormitoryScenario2StartGateTrial", "artifacts/oam/checks/dormitory-scenario2-start-gate-trial-result.json"],
  ...dormitoryScenarioSpecs.flatMap((scenario) => [
    [`${scenario.id}Authority`, scenario.authorityResult],
    [`${scenario.id}GeneratedContracts`, scenario.generatedResult],
    [`${scenario.id}ConsumptionBoundary`, scenario.consumptionResult]
  ]),
  ["generatedFieldBindingClosure", "artifacts/oam/checks/generated-field-binding-closure-result.json"],
  ["generatedFilesNotManuallyEdited", "artifacts/oam/checks/generated-files-not-manually-edited-result.json"],
  ["generatedContractConsistency", "artifacts/oam/checks/generated-contract-consistency-result.json"],
  ["derivedContractConsistency", "artifacts/oam/checks/derived-contract-consistency-result.json"],
  ["oamKernelGraph", "artifacts/oam/checks/oam-kernel-graph-result.json"]
];

const snapshotOnly = process.argv.includes("--snapshot-only");
const failures = [];
const currentHead = git(["rev-parse", "HEAD"]);
const currentBranch = git(["branch", "--show-current"]);
const formalApproval = readJson(formalApprovalPath);
const candidateApproval = readJson(candidateApprovalPath);
const previousExecutionResult = readJsonIfExists(resultPath);
const previousExecutionProof = readJsonIfExists(proofPath);
const previousAttestationPackage = readJsonIfExists(attestationPackagePath);
const reviewedExecutionHead = previousExecutionResult?.reviewedExecutionHead ??
  previousExecutionProof?.reviewedExecutionHead ??
  previousAttestationPackage?.generatedCompileExecution?.reviewedExecutionHead ??
  previousAttestationPackage?.candidateRefs?.formalGeneratedCompileExecutionHead ??
  previousExecutionResult?.currentHead ??
  previousExecutionProof?.currentHead ??
  currentHead;
const formalAuthorization = validateFormalGeneratedCompileAuthorization({
  approval: formalApproval,
  candidateApproval,
  currentHead,
  approvalPath: formalApprovalPath,
  candidateApprovalPath
});

failures.push(...formalAuthorization.failures);
if (!formalAuthorization.authorized) {
  failures.push("formal generated compile execution requires exact-head 00 formal authorization.");
}

if (snapshotOnly) {
  const snapshot = buildSnapshot("phase1_input_snapshot");
  const finalReport = readJsonIfExists("artifacts/oam/final-report.json");
  if (finalReport) {
    if (finalReport.generatedCompileCompleted !== false || finalReport.generatedCompilationCompleted !== false) {
      failures.push("phase1 snapshot must be taken before generated compile completion is recorded.");
    }
    if ((finalReport.runtimeConsumptionReady === true &&
      finalReport.runtimeAdmissionStatus !== "APPROVED_TEST_ONLY_RUNTIME_CONSUMPTION") ||
      finalReport.releaseAuthority !== false ||
      finalReport.finalGoNoGo !== "NO_GO") {
      failures.push("phase1 snapshot observed forbidden runtime/release/GO state.");
    }
    if (finalReport.businessFeatureDevelopmentAllowed === true &&
      (finalReport.dormitoryFirstGoldenChainLandingStatus !== "APPROVED_DORMITORY_L1_FIRST_GOLDEN_CHAIN" ||
        finalReport.dormitoryFirstGoldenChainLandingGoNoGo !== "GO" ||
        finalReport.businessProductionGoNoGo !== "NO_GO" ||
        finalReport.dormitoryL2GoNoGo !== "NO_GO" ||
        finalReport.productionConfirmAllowed !== false ||
        finalReport.releaseAuthority !== false ||
        finalReport.finalGoNoGo !== "NO_GO")) {
      failures.push("phase1 snapshot observed businessFeatureDevelopmentAllowed=true without S8 L1 business landing authority.");
    }
  }
  writeJson(snapshotPath, {
    version: "oam.generated-compile-execution-input-snapshot.v1",
    recordedAtUtc: new Date().toISOString(),
    status: failures.length === 0 ? "PASS" : "FAIL",
    snapshot,
    formalAuthorization: formalAuthorizationState(),
    failures,
    generatedCompileAuthorized: formalAuthorization.authorized,
    generatedCompilationAllowed: formalAuthorization.authorized,
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  finish("Generated compile execution input snapshot");
  process.exit(0);
}

const inputSnapshotDocument = readJsonIfExists(snapshotPath);
const shouldRebuildInputSnapshot = !inputSnapshotDocument || inputSnapshotDocument.status !== "PASS";
const inputSnapshot = shouldRebuildInputSnapshot
  ? buildSnapshot(inputSnapshotDocument ? "phase1_input_snapshot_invalid_local_rebuilt" : "phase1_input_snapshot_missing_local_rebuilt")
  : inputSnapshotDocument.snapshot;
if (shouldRebuildInputSnapshot) {
  writeJson(snapshotPath, {
    version: "oam.generated-compile-execution-input-snapshot.v1",
    recordedAtUtc: new Date().toISOString(),
    status: "PASS",
    snapshot: inputSnapshot,
    formalAuthorization: formalAuthorizationState(),
    rebuiltBy: "normal generated compile execution",
    replacedSnapshotStatus: inputSnapshotDocument?.status ?? "missing",
    replacedSnapshotFailures: inputSnapshotDocument?.failures ?? [],
    failures: [],
    generatedCompileAuthorized: formalAuthorization.authorized,
    generatedCompilationAllowed: formalAuthorization.authorized,
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
}
runCompileRound("round1");
const round1Snapshot = buildSnapshot("round1_after_compile");
runCompileRound("round2");
const round2Snapshot = buildSnapshot("round2_after_compile");

checkSnapshotEquality(round1Snapshot, round2Snapshot);
checkSourceAndRuntimeNoDrift();
checkPreGateResults();
checkGeneratedMarkers();

const status = failures.length === 0 ? "PASS" : "FAIL";
const proof = {
  version: "oam.generated-compile-execution-proof.v1",
  proofType: "generated-compile-execution",
  generatedAtUtc: new Date().toISOString(),
  status,
  currentHead,
  currentRepositoryHead: currentHead,
  reviewedExecutionHead,
  currentBranch,
  formalAuthorization: formalAuthorizationState(),
  inputSnapshot,
  compileRounds: [
    {
      round: 1,
      commands: commandLines(),
      generatedOutputDigest: round1Snapshot.generatedOutputDigest,
      generatedOutputHashes: round1Snapshot.generatedOutputHashes
    },
    {
      round: 2,
      commands: commandLines(),
      generatedOutputDigest: round2Snapshot.generatedOutputDigest,
      generatedOutputHashes: round2Snapshot.generatedOutputHashes
    }
  ],
  reproducibility: {
    status,
    round1GeneratedOutputDigest: round1Snapshot.generatedOutputDigest,
    round2GeneratedOutputDigest: round2Snapshot.generatedOutputDigest,
    sameGeneratedOutputDigest: round1Snapshot.generatedOutputDigest === round2Snapshot.generatedOutputDigest,
    sameDerivedOutputDigest: round1Snapshot.derivedOutputDigest === round2Snapshot.derivedOutputDigest,
    sameKernelGraphDigest: round1Snapshot.kernelGraphGeneratedDigest === round2Snapshot.kernelGraphGeneratedDigest
  },
  noManualEditProof: {
    status: gateResultStatus("artifacts/oam/checks/generated-files-not-manually-edited-result.json"),
    proofRef: "artifacts/oam/checks/generated-files-not-manually-edited-result.json"
  },
  consistencyProof: {
    generatedContracts: gateResultStatus("artifacts/oam/checks/generated-contract-consistency-result.json"),
    derivedContracts: gateResultStatus("artifacts/oam/checks/derived-contract-consistency-result.json"),
    kernelGraph: gateResultStatus("artifacts/oam/checks/oam-kernel-graph-result.json")
  },
  driftProof: buildDriftProof(),
  generatedCompileAuthorized: formalAuthorization.authorized,
  generatedCompilationAllowed: formalAuthorization.authorized,
  generatedCompileCompleted: status === "PASS",
  generatedCompilationCompleted: status === "PASS",
  generatedCandidateAcceptedBy00: false,
  runtimeConsumptionReady: false,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  nextDecisionFor00: "GENERATED_CANDIDATE_ACCEPTANCE_REVIEW",
  forbiddenInterpretations: [
    "generated compile completion is not generated candidate acceptance",
    "generated compile completion is not runtime consumption",
    "generated compile completion is not business feature development",
    "generated compile completion is not release authority",
    "generated compile completion is not final GO"
  ],
  failures
};

writeJson(proofPath, proof);
writeJson(resultPath, {
  version: "oam.generated-compile-execution-result.v1",
  checkedAtUtc: proof.generatedAtUtc,
  status,
  checkerExecutionStatus: status,
  proofPath,
  currentHead,
  currentRepositoryHead: currentHead,
  reviewedExecutionHead,
  currentBranch,
  formalAuthorization: proof.formalAuthorization,
  generatedOutputDigest: round2Snapshot.generatedOutputDigest,
  generatedOutputHashes: round2Snapshot.generatedOutputHashes,
  manifestDigest: hashFile("docs/oam/generated-contracts-manifest.json"),
  generatedKernelGraphDigest: hashFile("docs/oam/kernel/oam-kernel-graph.generated.json"),
  sourcePackageHash: hashFile(sourcePackagePath),
  inputSnapshotPath: snapshotPath,
  inputSnapshotDigest: digestObject(inputSnapshot),
  proofDigest: digestObject(proof),
  reproducibility: proof.reproducibility,
  noManualEditProof: proof.noManualEditProof,
  consistencyProof: proof.consistencyProof,
  driftProof: proof.driftProof,
  generatedCompileAuthorized: proof.generatedCompileAuthorized,
  generatedCompilationAllowed: proof.generatedCompilationAllowed,
  generatedCompileCompleted: proof.generatedCompileCompleted,
  generatedCompilationCompleted: proof.generatedCompilationCompleted,
  generatedCandidateAcceptedBy00: false,
  runtimeConsumptionReady: false,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  nextDecisionFor00: proof.nextDecisionFor00,
  failures
});

finish("Generated compile execution check");

function runCompileRound(round) {
  for (const [command, args] of compileCommands) {
    let passed = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        sleep(150 * attempt);
        execFileSync(command, args, {
          cwd: root,
          stdio: "inherit",
          env: { ...process.env, ALLOW_GENERATED_COMPILE_CANDIDATE: "true" }
        });
        passed = true;
        break;
      } catch (error) {
        if (attempt === 3) {
          failures.push(`${round} failed: ${command} ${args.join(" ")} exit=${error.status ?? "unknown"}`);
          return;
        }
        sleep(500 * attempt);
      }
    }
    if (!passed) return;
  }
}

function buildSnapshot(label) {
  return {
    label,
    recordedAtUtc: new Date().toISOString(),
    currentHead,
    currentBranch,
    formalApprovalPath,
    formalApprovalHash: hashFile(formalApprovalPath),
    candidateApprovalPath,
    candidateApprovalHash: hashFile(candidateApprovalPath),
    sourcePackagePath,
    sourcePackageHash: hashFile(sourcePackagePath),
    sourceAuthorityDigest: digestForFiles(sourceAuthorityFiles),
    generatorAndCheckerHashes: hashMap(generatorAndCheckerFiles),
    generatedOutputFiles,
    generatedOutputHashes: hashMap(generatedOutputFiles),
    generatedOutputDigest: digestForFiles(generatedOutputFiles),
    derivedOutputDigest: digestForFiles([
      "docs/oam/system-derived-contracts.json",
      "docs/oam/domain-derived-contracts.json",
      "docs/oam/generated-contracts-manifest.json",
      "docs/contracts/admission/admission-contract.json"
    ]),
    kernelGraphSourceDigest: hashFile("docs/oam/oam-kernel-graph.json"),
    kernelGraphGeneratedDigest: hashFile("docs/oam/kernel/oam-kernel-graph.generated.json"),
    gitDiffNames: git(["diff", "--name-only"]).split(/\r?\n/).filter(Boolean),
    gitUntrackedNames: git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean)
  };
}

function formalAuthorizationState() {
  return {
    predicateVersion: formalAuthorization.version,
    predicateStatus: formalAuthorization.status,
    predicateHeadBindingStatus: formalAuthorization.headBindingStatus,
    predicateAuthorized: formalAuthorization.authorized,
    predicateFailures: formalAuthorization.failures,
    approvalPath: formalApprovalPath,
    approvalStatus: formalApproval.approvalStatus ?? null,
    approvalDecision: formalApproval.approvalDecision ?? null,
    approvalScope: formalApproval.approvalScope ?? null,
    currentHEAD: formalApproval.currentHEAD ?? null,
    reviewedRef: formalApproval.reviewedRef ?? null,
    approvedFormalAuthorizationHead: formalApproval.approvedFormalAuthorizationHead ?? null,
    currentHeadDescendantPolicy: formalApproval.currentHeadDescendantPolicy ?? null,
    candidateSourceRef: formalApproval.candidateSourceRef ?? null,
    authorizedCandidateExecutionHead: formalApproval.authorizedCandidateExecutionHead ?? null,
    generatedCompileAuthorized: formalApproval.generatedCompileAuthorized ?? null,
    generatedCompilationAllowed: formalApproval.generatedCompilationAllowed ?? null,
    generatedCompileCompleted: formalApproval.generatedCompileCompleted ?? null,
    generatedCompilationCompleted: formalApproval.generatedCompilationCompleted ?? null,
    candidateArtifactEvidenceCompleted: formalApproval.candidateArtifactEvidenceCompleted ?? null,
    generatedCandidateAcceptedBy00: formalApproval.generatedCandidateAcceptedBy00 ?? null,
    runtimeConsumptionReady: formalApproval.runtimeConsumptionReady ?? null,
    businessFeatureDevelopmentAllowed: formalApproval.businessFeatureDevelopmentAllowed ?? null,
    productionConfirmAllowed: formalApproval.productionConfirmAllowed ?? null,
    releaseAuthority: formalApproval.releaseAuthority ?? null,
    finalGoNoGo: formalApproval.finalGoNoGo ?? null
  };
}

function checkSnapshotEquality(first, second) {
  for (const [label, left, right] of [
    ["generated output digest", first.generatedOutputDigest, second.generatedOutputDigest],
    ["derived output digest", first.derivedOutputDigest, second.derivedOutputDigest],
    ["generated kernel graph digest", first.kernelGraphGeneratedDigest, second.kernelGraphGeneratedDigest]
  ]) {
    if (left !== right) {
      failures.push(`reproducibility mismatch for ${label}: ${left} != ${right}`);
    }
  }
  for (const file of generatedOutputFiles) {
    if (first.generatedOutputHashes[file] !== second.generatedOutputHashes[file]) {
      failures.push(`generated output hash mismatch after repeated compile: ${file}`);
    }
  }
}

function checkSourceAndRuntimeNoDrift() {
  const sourceDiffs = unique([
    ...gitDiffNames(["docs/business/domains/dormitory"]),
    ...gitDiffNames(["docs/business/dormitory"])
  ]);
  if (sourceDiffs.length > 0) {
    failures.push(`Source business facts changed during formal generated compile: ${sourceDiffs.join(", ")}`);
  }

  const runtimeDiffs = unique([
    ...gitDiffNames(["services"]),
    ...gitDiffNames(["infra/db"]),
    ...gitDiffNames(["tests"]),
    ...gitDiffNames(["apps/mobile/src"])
  ]).filter((file) => !allowedRuntimeGeneratedDiffs.has(file));
  const runtimeUntracked = unique([
    ...gitUntrackedNames(["services"]),
    ...gitUntrackedNames(["infra/db"]),
    ...gitUntrackedNames(["tests"]),
    ...gitUntrackedNames(["apps/mobile/src"])
  ]).filter((file) => !allowedRuntimeGeneratedDiffs.has(file));
  if (runtimeDiffs.length > 0 || runtimeUntracked.length > 0) {
    failures.push(`runtime/business implementation drift is forbidden: changed=${runtimeDiffs.join(", ") || "none"} untracked=${runtimeUntracked.join(", ") || "none"}`);
  }
}

function buildDriftProof() {
  const sourceDiffs = unique([
    ...gitDiffNames(["docs/business/domains/dormitory"]),
    ...gitDiffNames(["docs/business/dormitory"])
  ]);
  const runtimeChanged = unique([
    ...gitDiffNames(["services"]),
    ...gitDiffNames(["infra/db"]),
    ...gitDiffNames(["tests"]),
    ...gitDiffNames(["apps/mobile/src"])
  ]);
  const runtimeUntracked = unique([
    ...gitUntrackedNames(["services"]),
    ...gitUntrackedNames(["infra/db"]),
    ...gitUntrackedNames(["tests"]),
    ...gitUntrackedNames(["apps/mobile/src"])
  ]);
  return {
    noSourceBusinessFactChanges: sourceDiffs.length === 0,
    sourceBusinessFactDiffs: sourceDiffs,
    noRuntimeImplementationChanges: runtimeChanged.filter((file) => !allowedRuntimeGeneratedDiffs.has(file)).length === 0 &&
      runtimeUntracked.filter((file) => !allowedRuntimeGeneratedDiffs.has(file)).length === 0,
    runtimeChanged,
    runtimeUntracked,
    allowedRuntimeGeneratedDiffs: [...allowedRuntimeGeneratedDiffs]
  };
}

function checkPreGateResults() {
  for (const [id, file] of requiredPreGateResults) {
    const status = gateResultStatus(file);
    if (!["PASS", "passed"].includes(status)) {
      failures.push(`${id} pre-gate result must be PASS before S4 execution closure: ${file} status=${status || "missing"}`);
    }
  }
}

function checkGeneratedMarkers() {
  for (const file of generatedOutputFiles) {
    const document = readJsonIfExists(file);
    if (!document || document.generated !== true || document.doNotEdit !== true) {
      failures.push(`${file} must remain generated=true and doNotEdit=true.`);
    }
  }
}

function gateResultStatus(file) {
  const document = readJsonIfExists(file);
  return document?.status ?? document?.checkerExecutionStatus ?? document?.result ?? "";
}

function commandLines() {
  return compileCommands.map(([command, args]) => `${command} ${args.join(" ")}`);
}

function gitDiffNames(paths) {
  return git(["diff", "--name-only", "--", ...paths]).split(/\r?\n/).filter(Boolean);
}

function gitUntrackedNames(paths) {
  return git(["ls-files", "--others", "--exclude-standard", "--", ...paths]).split(/\r?\n/).filter(Boolean);
}

function hashMap(files) {
  return Object.fromEntries(files.map((file) => [file, hashFile(file)]));
}

function digestForFiles(files) {
  return digestObject(hashMap(files));
}

function hashFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return "missing";
  const content = isTextFile(file)
    ? fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    : fs.readFileSync(full);
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function isTextFile(file) {
  return /\.(cjs|js|json|md|mjs|ps1|ts|txt|ya?ml)$/i.test(file);
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean).map((item) => item.replaceAll("\\", "/")))].sort();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function finish(label) {
  if (failures.length > 0) {
    console.error(`${label}: FAIL`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`${label}: PASS`);
}
