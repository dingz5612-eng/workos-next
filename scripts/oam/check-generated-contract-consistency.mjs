import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  FIELD_BINDING_CLOSURE_RESULT_PATH,
  FIELD_BINDINGS_GENERATED_PATH,
  REQUIRED_GENERATED_FIELD_BINDINGS,
  buildDormitoryGeneratedFieldBindingClosure
} from "./lib/dormitory-generated-field-binding-closure.mjs";

const root = process.cwd();
const reportPath = "artifacts/oam/checks/generated-contract-consistency-result.json";
const failures = [];
const p0 = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const requiredGeneratedFiles = [
  "docs/oam/kernel/oam-kernel-source.schema.json",
  "docs/oam/kernel/oam-kernel-generated.schema.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  FIELD_BINDINGS_GENERATED_PATH,
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  "apps/mobile/src/generated/oam/capability-projection.generated.json",
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json",
  "docs/contracts/generated/dormitory/object-identity.generated.json",
  "docs/contracts/generated/dormitory/bed-cardinality.generated.json",
  "docs/contracts/generated/dormitory/business-invariants.generated.json",
  "docs/contracts/generated/dormitory/command-contracts.generated.json",
  "docs/contracts/generated/dormitory/failure-semantics.generated.json",
  "docs/contracts/generated/dormitory/rule-source-map.generated.json",
  "docs/contracts/generated/dormitory/db-projection-policy.generated.json",
  "docs/contracts/generated/dormitory/test-plan.generated.json",
  "artifacts/oam/evidence/capability-evidence-subject-chain.json",
  "artifacts/oam/evidence/capability-digest-chain.json",
  FIELD_BINDING_CLOSURE_RESULT_PATH
];
const requiredClassifications = [
  "clientSubmitted",
  "selectedStableRef",
  "contextReadonly",
  "systemGenerated",
  "derived",
  "forbidden"
];
const financeBlockedPattern = /Payment|Deposit|Refund|Expense/i;
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
requiredGeneratedFiles.push(...dormitory13ScenarioGeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario1GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario2GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario3GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario4GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario5GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario6GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario7GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario8GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario9GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario10GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario11GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario12GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryScenario13GeneratedFiles);
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
requiredGeneratedFiles.push(...dormitoryBenchmarkInheritanceGeneratedFiles);

for (const file of requiredGeneratedFiles) {
  if (!exists(file)) fail(`${file} is missing.`);
}

const source = readJson("docs/business/domains/dormitory/dormitory-operating-kernel.json");
const graph = readJson("docs/oam/kernel/oam-kernel-graph.generated.json");
const manifest = readJson("docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json");
const fields = readJson("docs/contracts/generated/dormitory/fields.generated.json");
const fieldBindings = readJson(FIELD_BINDINGS_GENERATED_PATH);
const workitems = readJson("docs/contracts/generated/dormitory/workitems.generated.json");
const surface = readJson("docs/contracts/generated/dormitory/surface-input-model.generated.json");
const mobileSurface = readJson("apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json");
const capabilityProjection = readJson("apps/mobile/src/generated/oam/capability-projection.generated.json");
const runtimeProjection = readJson("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json");
const objectIdentity = readJson("docs/contracts/generated/dormitory/object-identity.generated.json");
const bedCardinality = readJson("docs/contracts/generated/dormitory/bed-cardinality.generated.json");
const businessInvariants = readJson("docs/contracts/generated/dormitory/business-invariants.generated.json");
const commandContracts = readJson("docs/contracts/generated/dormitory/command-contracts.generated.json");
const failureSemantics = readJson("docs/contracts/generated/dormitory/failure-semantics.generated.json");
const ruleSourceMap = readJson("docs/contracts/generated/dormitory/rule-source-map.generated.json");
const dbProjectionPolicy = readJson("docs/contracts/generated/dormitory/db-projection-policy.generated.json");
const testPlan = readJson("docs/contracts/generated/dormitory/test-plan.generated.json");
const subjectChain = readJson("artifacts/oam/evidence/capability-evidence-subject-chain.json");
const capabilityDigestChain = readJson("artifacts/oam/evidence/capability-digest-chain.json");
const readModel = readJson("docs/contracts/generated/dormitory/read-model.generated.json");
const fieldBindingClosureResult = readJson(FIELD_BINDING_CLOSURE_RESULT_PATH);
const fieldBindingClosure = buildDormitoryGeneratedFieldBindingClosure({ root });
const dormitory13ScenarioGeneratedContracts = new Map(dormitory13ScenarioGeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario1GeneratedContracts = new Map(dormitoryScenario1GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario2GeneratedContracts = new Map(dormitoryScenario2GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario3GeneratedContracts = new Map(dormitoryScenario3GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario4GeneratedContracts = new Map(dormitoryScenario4GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario5GeneratedContracts = new Map(dormitoryScenario5GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario6GeneratedContracts = new Map(dormitoryScenario6GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario7GeneratedContracts = new Map(dormitoryScenario7GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario8GeneratedContracts = new Map(dormitoryScenario8GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario9GeneratedContracts = new Map(dormitoryScenario9GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario10GeneratedContracts = new Map(dormitoryScenario10GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario11GeneratedContracts = new Map(dormitoryScenario11GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario12GeneratedContracts = new Map(dormitoryScenario12GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryScenario13GeneratedContracts = new Map(dormitoryScenario13GeneratedFiles.map((file) => [file, readJson(file)]));
const dormitoryBenchmarkInheritanceGeneratedContracts = new Map(dormitoryBenchmarkInheritanceGeneratedFiles.map((file) => [file, readJson(file)]));

for (const [file, document] of [
  ["docs/oam/kernel/oam-kernel-graph.generated.json", graph],
  ["docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json", manifest],
  ["docs/contracts/generated/dormitory/fields.generated.json", fields],
  [FIELD_BINDINGS_GENERATED_PATH, fieldBindings],
  ["docs/contracts/generated/dormitory/workitems.generated.json", workitems],
  ["docs/contracts/generated/dormitory/surface-input-model.generated.json", surface],
  ["docs/contracts/generated/dormitory/read-model.generated.json", readModel]
]) {
  checkGeneratedMetadata(file, document);
}
for (const [file, document] of [
  ["apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json", mobileSurface],
  ["apps/mobile/src/generated/oam/capability-projection.generated.json", capabilityProjection],
  ["services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", runtimeProjection],
  ["docs/contracts/generated/dormitory/object-identity.generated.json", objectIdentity],
  ["docs/contracts/generated/dormitory/bed-cardinality.generated.json", bedCardinality],
  ["docs/contracts/generated/dormitory/business-invariants.generated.json", businessInvariants],
  ["docs/contracts/generated/dormitory/command-contracts.generated.json", commandContracts],
  ["docs/contracts/generated/dormitory/failure-semantics.generated.json", failureSemantics],
  ["docs/contracts/generated/dormitory/rule-source-map.generated.json", ruleSourceMap],
  ["docs/contracts/generated/dormitory/db-projection-policy.generated.json", dbProjectionPolicy],
  ["docs/contracts/generated/dormitory/test-plan.generated.json", testPlan],
  ["artifacts/oam/evidence/capability-evidence-subject-chain.json", subjectChain],
  ["artifacts/oam/evidence/capability-digest-chain.json", capabilityDigestChain]
]) {
  checkCapabilityGeneratedMetadata(file, document);
}

if ((graph.nodes ?? []).length === 0 || (graph.edges ?? []).length === 0 || graph.nodeCount <= 0 || graph.edgeCount <= 0) {
  fail("generated kernel graph must not be empty.");
}

checkGeneratedFieldBindingClosure();
checkDormitory13ScenarioControlContracts();
checkDormitoryScenario1Contracts();
checkDormitoryScenario2Contracts();
checkDormitoryScenario3Contracts();
checkDormitoryScenario4Contracts();
checkDormitoryScenario5Contracts();
checkDormitoryScenario6Contracts();
checkDormitoryScenario7Contracts();
checkDormitoryScenario8Contracts();
checkDormitoryScenario9Contracts();
checkDormitoryScenario10Contracts();
checkDormitoryScenario11Contracts();
checkDormitoryScenario12Contracts();
checkDormitoryScenario13Contracts();
checkDormitoryBenchmarkInheritanceContracts();

const sourceP0 = source.p0GeneratedCandidates ?? [];
const sourceP0Types = sourceP0.map((item) => item.workItemType).sort();
if (JSON.stringify(sourceP0Types) !== JSON.stringify([...p0].sort())) {
  fail(`source p0GeneratedCandidates must be exactly ${p0.join(", ")}.`);
}

for (const item of source.workItems ?? []) {
  if (p0.includes(item.workItemType)) {
    if (item.p0GeneratedCandidate !== true || item.generatedStage !== "P0_ACTIVE") {
      fail(`${item.workItemType} must be P0_ACTIVE generated candidate.`);
    }
    if (item.ledgerEffect?.mode !== "none" || item.ledgerEffect?.financeKernelEffectType !== null) {
      fail(`${item.workItemType} must have ledgerEffect.mode=none and financeKernelEffectType=null.`);
    }
    for (const classification of requiredClassifications) {
      if (!Array.isArray(item.fieldClassification?.[classification])) {
        fail(`${item.workItemType} missing fieldClassification.${classification}.`);
      }
    }
    continue;
  }

  if (/RatePlan|Lead|Checkin|Payment|Deposit|Expense/i.test(item.workItemType) && item.generatedStage !== "P1_BLOCKED") {
    fail(`${item.workItemType} must be P1_BLOCKED and excluded from P0 generated contracts.`);
  }
  if (financeBlockedPattern.test(item.workItemType) && item.p0GeneratedCandidate === true) {
    fail(`${item.workItemType} must not enter P0 generated contracts; finance truth belongs to Finance / Ledger Kernel.`);
  }
}

const generatedTypes = (workitems.workItems ?? []).map((item) => item.workItemType).sort();
if (JSON.stringify(generatedTypes) !== JSON.stringify([...p0].sort())) {
  fail(`generated workitems must contain only ${p0.join(", ")}.`);
}
checkCapabilityCompilerOutputs();
checkMobileSurfaceCompilerProjection();

writeReport();

if (failures.length > 0) {
  console.error("Generated contract consistency check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated contract consistency check: PASS");

function checkGeneratedMetadata(file, document) {
  if (document.generated !== true) fail(`${file} must include generated=true.`);
  if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
  if (document.deterministicSort !== true) fail(`${file} must include deterministicSort=true.`);
  for (const field of ["kernelGraphHash", "sourceNodeRefs", "sourceRefs", "sourceHash", "sourceContentDigest", "compilerInputDigest", "outputContentDigest", "generatorVersion", "generatedFrom"]) {
    if (!document[field] || (Array.isArray(document[field]) && document[field].length === 0)) {
      fail(`${file} missing generated metadata ${field}.`);
    }
  }
  const expectedOutputDigest = digest({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedOutputDigest) {
    fail(`${file} outputContentDigest does not match content.`);
  }
}

function readJson(file) {
  if (!exists(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function fail(message) {
  failures.push(message);
}

function checkCapabilityGeneratedMetadata(file, document) {
  if (document.generated !== true) fail(`${file} must include generated=true.`);
  if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
  for (const field of ["kind", "generatorVersion", "generatedBy", "generatedFrom", "inputDigest", "inputDigests", "outputContentDigest", "capabilityId", "acceptedGeneratedBundleDigest"]) {
    if (!document[field] || (Array.isArray(document[field]) && document[field].length === 0)) {
      fail(`${file} missing capability compiler metadata ${field}.`);
    }
  }
  if (document.generatedBy !== "scripts/oam/compile-current-capability.mjs") {
    fail(`${file} must be generated by scripts/oam/compile-current-capability.mjs.`);
  }
  if (document.capabilityId !== "Dormitory.FirstGoldenChain") {
    fail(`${file} must bind Dormitory.FirstGoldenChain.`);
  }
  const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedOutputDigest) {
    fail(`${file} outputContentDigest does not match stable content.`);
  }
}

function checkDormitory13ScenarioControlContracts() {
  for (const [file, document] of dormitory13ScenarioGeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-13-scenario-control-contracts.mjs") {
      fail(`${file} must be generated by dormitory 13 scenario control generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(["docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json"])) {
      fail(`${file} must be generated from dormitory-13-scenario-control.authority.json only.`);
    }
    if (document.authorityId !== "Dormitory.Operating13ScenarioControl") {
      fail(`${file} must bind Dormitory.Operating13ScenarioControl.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const scenarioIndex = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-index.generated.json");
  const stateLadder = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-state-ladder.generated.json");
  const fieldMatrix = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json");
  const financeBoundary = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json");
  const pageEntryPolicy = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json");
  const handoff = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json");
  const oldPackage = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-old-package-migration.generated.json");
  const testPlan13 = dormitory13ScenarioGeneratedContracts.get("docs/contracts/generated/dormitory/13-scenario-test-plan.generated.json");

  if ((scenarioIndex.scenarios ?? []).length !== 13) fail("13 scenario index must contain exactly 13 scenarios.");
  if ((stateLadder.stateLadder ?? []).length !== 14) fail("13 scenario state ladder must contain 14 states.");
  for (const internal of fieldMatrix.forbiddenUserInputFields ?? []) {
    if ((fieldMatrix.fieldSourceMatrix?.userFilled ?? []).includes(internal) ||
      (fieldMatrix.fieldSourceMatrix?.userSelected ?? []).includes(internal)) {
      fail(`13 scenario field matrix exposes forbidden internal field ${internal} as user input.`);
    }
  }
  if (!String(financeBoundary.financeBoundary?.exclusiveTruthWriters ?? "").includes("finance-gate")) {
    fail("13 scenario finance boundary must keep finance-gate as exclusive truth writer.");
  }
  if (!String(pageEntryPolicy.pageEntryPolicy?.search ?? "").includes("只读")) {
    fail("13 scenario search entry must be readonly.");
  }
  if ((handoff.summaries ?? []).length !== 13) fail("13 scenario handoff summaries must cover 13 scenarios.");
  if (oldPackage.oldPackageIsolationPolicy?.mustBeLabeledAs !== "migration_reference_only") {
    fail("13 scenario oldPackage migration must label old packages migration_reference_only.");
  }
  if ((testPlan13.scenarioTestMatrix ?? []).length !== 13) fail("13 scenario test plan must cover 13 scenarios.");
}

function checkDormitoryScenario1Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario1GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario1-resource-basic-readiness-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 1 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 1 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness" || document.scenarioPackageNo !== 1) {
      fail(`${file} must bind Dormitory.Scenario1.ResourceBasicReadiness package 1.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario1GeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json");
  const objectModel = dormitoryScenario1GeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-object-model.generated.json");
  const stepsFields = dormitoryScenario1GeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario1GeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario1GeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario1GeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json");
  const handoff = dormitoryScenario1GeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-handoff.generated.json");
  const mobileMirror = dormitoryScenario1GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json");
  const runtimeMirror = dormitoryScenario1GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json");

  if (canonical?.nameZh !== "房源建档与基础就绪") fail("scenario 1 canonical contract must expose 房源建档与基础就绪.");
  if (JSON.stringify(objectModel?.objects?.map((item) => item.objectName) ?? []) !== JSON.stringify(["BuildingContext", "Room", "BedSet", "Bed", "BasicReadiness", "EvidenceBinding", "StatusHistory"])) {
    fail("scenario 1 object model must contain BuildingContext/Room/BedSet/Bed/BasicReadiness/EvidenceBinding/StatusHistory.");
  }
  if (objectModel?.bedGenerationRule?.onlySourceOfBedQuantity !== "room.bedCount") fail("scenario 1 bed generation must use room.bedCount only.");
  const readinessLabels = stepsFields?.steps?.find((step) => step.stepId === "basic-readiness-confirmation")?.conclusionOptions?.map((item) => item.labelZh) ?? [];
  if (JSON.stringify(readinessLabels) !== JSON.stringify(["通过", "不通过", "需补充"])) fail("scenario 1 readiness labels must be 通过/不通过/需补充.");
  if (crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("scenario 1 query/search/list/board/report must be readonly.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 1 failure ${failure.failureCode} must have no side effects.`);
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 1 search page must remain readonly.");
  if (!String(handoff?.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("scenario 1 handoff must forbid downstream refill.");
  if (mobileMirror?.consumer !== "surface") fail("scenario 1 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 1 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario2Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario2GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario2-resource-operation-status-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 2 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 2 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario2.ResourceOperationStatus" || document.scenarioPackageNo !== 2) {
      fail(`${file} must bind Dormitory.Scenario2.ResourceOperationStatus package 2.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario2GeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json");
  const objectState = dormitoryScenario2GeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-object-state-model.generated.json");
  const stepsFields = dormitoryScenario2GeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario2GeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario2GeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario2GeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json");
  const handoff = dormitoryScenario2GeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-handoff.generated.json");
  const mobileMirror = dormitoryScenario2GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json");
  const runtimeMirror = dormitoryScenario2GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json");

  if (canonical?.nameZh !== "房源运营就绪与状态维护") fail("scenario 2 canonical contract must expose 房源运营就绪与状态维护.");
  if (canonical?.upstream?.allowedSourcePackageNo !== 1 || canonical?.downstream?.allowedConsumerPackageNo !== 3) {
    fail("scenario 2 canonical must read package 1 and hand off to package 3 only.");
  }
  if (JSON.stringify(objectState?.operationStatusOptions ?? []) !== JSON.stringify(["可运营", "暂不可运营", "部分不可运营", "暂停开放", "维修中", "保洁中", "停售", "异常待处理", "待复查", "已恢复"])) {
    fail("scenario 2 generated status options mismatch.");
  }
  if ((stepsFields?.steps ?? []).length !== 6) fail("scenario 2 steps-fields must contain exactly 6 steps.");
  if (crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("scenario 2 query/search/list/board/report must be readonly.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 2 failure ${failure.failureCode} must have no side effects.`);
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 2 search page must remain readonly.");
  if (!String(handoff?.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("scenario 2 handoff must forbid downstream refill.");
  if ((handoff?.readSideOutputs ?? []).includes("可报价") || (handoff?.readSideOutputs ?? []).includes("可预订")) {
    fail("scenario 2 handoff must not output 可报价 or 可预订.");
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 2 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 2 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario3Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario3GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario3-product-and-pricing-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 3 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 3 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario3.ProductAndPricing" || document.scenarioPackageNo !== 3) {
      fail(`${file} must bind Dormitory.Scenario3.ProductAndPricing package 3.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario3GeneratedContracts.get("docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json");
  const objectState = dormitoryScenario3GeneratedContracts.get("docs/contracts/generated/dormitory/scenario3-object-state-model.generated.json");
  const stepsFields = dormitoryScenario3GeneratedContracts.get("docs/contracts/generated/dormitory/scenario3-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario3GeneratedContracts.get("docs/contracts/generated/dormitory/scenario3-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario3GeneratedContracts.get("docs/contracts/generated/dormitory/scenario3-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario3GeneratedContracts.get("docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json");
  const handoff = dormitoryScenario3GeneratedContracts.get("docs/contracts/generated/dormitory/scenario3-handoff.generated.json");
  const mobileMirror = dormitoryScenario3GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario3-product-and-pricing.generated.json");
  const runtimeMirror = dormitoryScenario3GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario3ProductAndPricing.generated.json");

  if (canonical?.nameZh !== "住宿商品与价格") fail("scenario 3 canonical contract must expose 住宿商品与价格.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([1, 2]) ||
    canonical?.downstream?.allowedConsumerPackageNo !== 4) {
    fail("scenario 3 canonical must read packages 1/2 and hand off to package 4 only.");
  }
  if (JSON.stringify(objectState?.priceStatusOptions ?? []) !== JSON.stringify(["价格草稿", "待审核", "已生效", "已停用", "已过期", "已作废", "需补充证据"])) {
    fail("scenario 3 generated price status options mismatch.");
  }
  if (!JSON.stringify(objectState?.stateLayering ?? {}).includes("可运营来自场景包 2")) fail("scenario 3 state model must inherit operation state from package 2.");
  if (objectState?.priceConflictRule?.effectiveOverlapAllowed !== false) fail("scenario 3 price conflict rule must block overlapping effective prices.");
  if ((stepsFields?.steps ?? []).length !== 6) fail("scenario 3 steps-fields must contain exactly 6 steps.");
  for (const internal of ["productId", "ratePlanId", "priceVersionId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 3 forbidden field missing ${internal}.`);
  }
  if (crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("scenario 3 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedFactEdit?.allowed !== false) fail("scenario 3 effective price inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 3 failure ${failure.failureCode} must have no side effects.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("确认失败不得刷新报价可用读模型")) fail("scenario 3 runtime rules must forbid refreshing quote availability on failure.");
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 3 search page must remain readonly.");
  if (!String(handoff?.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("scenario 3 handoff must forbid downstream refill.");
  for (const forbidden of ["报价", "库存锁定", "预订", "入住", "收款", "押金", "退款", "账务"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 3 handoff must not output ${forbidden}.`);
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 3 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 3 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario4Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario4GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario4-inquiry-and-quote-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 4 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 4 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario4.InquiryAndQuote" || document.scenarioPackageNo !== 4) {
      fail(`${file} must bind Dormitory.Scenario4.InquiryAndQuote package 4.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario4GeneratedContracts.get("docs/contracts/generated/dormitory/scenario4-inquiry-and-quote.generated.json");
  const objectState = dormitoryScenario4GeneratedContracts.get("docs/contracts/generated/dormitory/scenario4-object-state-model.generated.json");
  const stepsFields = dormitoryScenario4GeneratedContracts.get("docs/contracts/generated/dormitory/scenario4-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario4GeneratedContracts.get("docs/contracts/generated/dormitory/scenario4-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario4GeneratedContracts.get("docs/contracts/generated/dormitory/scenario4-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario4GeneratedContracts.get("docs/contracts/generated/dormitory/scenario4-surface-navigation.generated.json");
  const handoff = dormitoryScenario4GeneratedContracts.get("docs/contracts/generated/dormitory/scenario4-handoff.generated.json");
  const mobileMirror = dormitoryScenario4GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario4-inquiry-and-quote.generated.json");
  const runtimeMirror = dormitoryScenario4GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario4InquiryAndQuote.generated.json");

  if (canonical?.nameZh !== "询价与报价") fail("scenario 4 canonical contract must expose 询价与报价.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([1, 2, 3]) ||
    canonical?.downstream?.allowedConsumerPackageNo !== 5) {
    fail("scenario 4 canonical must read packages 1/2/3 and hand off to package 5 only.");
  }
  if (JSON.stringify(objectState?.quoteStatusOptions ?? []) !== JSON.stringify(["询价草稿", "待补充需求", "可报价", "报价草稿", "已报价", "报价已发送", "客户待确认", "报价过期", "报价关闭", "转预订准备"])) {
    fail("scenario 4 generated quote status options mismatch.");
  }
  if (!JSON.stringify(objectState?.stateLayering ?? {}).includes("价格已生效来自场景包 3")) fail("scenario 4 state model must inherit effective price from package 3.");
  if (!JSON.stringify(objectState?.stateLayering ?? {}).includes("可锁定和已预订来自场景包 5")) fail("scenario 4 state model must keep lock/reservation in package 5.");
  if (objectState?.priceSnapshotRule?.mustUseScenario3EffectivePriceVersion !== true ||
    objectState?.priceSnapshotRule?.userMayOverrideFinalPriceTruth !== false) {
    fail("scenario 4 price snapshot rule must bind scenario 3 effective price version and forbid user price truth override.");
  }
  if ((stepsFields?.steps ?? []).length !== 6) fail("scenario 4 steps-fields must contain exactly 6 steps.");
  for (const internal of ["inquiryId", "customerId", "quoteId", "quoteVersionId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 4 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 4 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) fail("scenario 4 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedFactEdit?.allowed !== false) fail("scenario 4 issued quote inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 4 failure ${failure.failureCode} must have no side effects.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("确认失败不得刷新下游预订读模型")) fail("scenario 4 runtime rules must forbid refreshing downstream reservation read model on failure.");
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 4 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("必须重新校验库存和报价有效期")) fail("scenario 4 handoff must require package 5 recheck.");
  for (const forbidden of ["库存锁定", "预订", "入住", "收款", "押金", "退款", "账务"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 4 handoff must not output ${forbidden}.`);
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 4 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 4 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario5Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario5GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario5-reservation-and-inventory-hold-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 5 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 5 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario5.ReservationAndInventoryHold" || document.scenarioPackageNo !== 5) {
      fail(`${file} must bind Dormitory.Scenario5.ReservationAndInventoryHold package 5.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario5GeneratedContracts.get("docs/contracts/generated/dormitory/scenario5-reservation-and-inventory-hold.generated.json");
  const objectState = dormitoryScenario5GeneratedContracts.get("docs/contracts/generated/dormitory/scenario5-object-state-model.generated.json");
  const stepsFields = dormitoryScenario5GeneratedContracts.get("docs/contracts/generated/dormitory/scenario5-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario5GeneratedContracts.get("docs/contracts/generated/dormitory/scenario5-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario5GeneratedContracts.get("docs/contracts/generated/dormitory/scenario5-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario5GeneratedContracts.get("docs/contracts/generated/dormitory/scenario5-surface-navigation.generated.json");
  const handoff = dormitoryScenario5GeneratedContracts.get("docs/contracts/generated/dormitory/scenario5-handoff.generated.json");
  const mobileMirror = dormitoryScenario5GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario5-reservation-and-inventory-hold.generated.json");
  const runtimeMirror = dormitoryScenario5GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario5ReservationAndInventoryHold.generated.json");

  if (canonical?.nameZh !== "预订与库存锁定") fail("scenario 5 canonical contract must expose 预订与库存锁定.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([1, 2, 3, 4]) ||
    canonical?.downstream?.allowedConsumerPackageNo !== 6) {
    fail("scenario 5 canonical must read packages 1/2/3/4 and hand off to package 6 only.");
  }
  if (JSON.stringify(objectState?.reservationStatusOptions ?? []) !== JSON.stringify(["待锁定", "锁定中", "已锁定", "锁定过期", "待确认预订", "已预订", "预订确认失败", "转入住准备"])) {
    fail("scenario 5 generated reservation status options mismatch.");
  }
  if (!JSON.stringify(objectState?.stateLayering ?? {}).includes("可入住")) fail("scenario 5 state model must keep check-in state downstream.");
  if (objectState?.inventoryInvariantRule?.atomicResourceDateCheckRequired !== true ||
    objectState?.inventoryInvariantRule?.holdUntilRequired !== true ||
    objectState?.inventoryInvariantRule?.expiredHoldCannotConfirmReservation !== true ||
    objectState?.inventoryInvariantRule?.reservationNoSystemGenerated !== true) {
    fail("scenario 5 inventory invariant rule must expose atomic lock, holdUntil, expired hold block and system reservation number.");
  }
  if ((stepsFields?.steps ?? []).length !== 6) fail("scenario 5 steps-fields must contain exactly 6 steps.");
  for (const internal of ["bookingRequestId", "inventoryHoldId", "holdId", "reservationId", "reservationNo", "quoteId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 5 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 5 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 5 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedReservationInlineEditAllowed !== false) fail("scenario 5 confirmed reservation inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 5 failure ${failure.failureCode} must have no side effects.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("确认失败不得写 CommandSubmission")) fail("scenario 5 runtime rules must forbid side effects on failure.");
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 5 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("重新核验入住所需证件、协议、押金/收款规则")) fail("scenario 5 handoff must require downstream check-in recheck.");
  for (const forbidden of ["入住", "已入住", "可入住", "收款", "已收款", "押金", "押金已收", "退款", "账务"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 5 handoff must not output ${forbidden}.`);
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 5 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 5 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario6Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario6GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario6-payment-deposit-and-guarantee-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 6 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 6 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario6.PaymentDepositAndGuarantee" || document.scenarioPackageNo !== 6) {
      fail(`${file} must bind Dormitory.Scenario6.PaymentDepositAndGuarantee package 6.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json");
  const objectState = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/dormitory/scenario6-object-state-model.generated.json");
  const stepsFields = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/dormitory/scenario6-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/dormitory/scenario6-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/dormitory/scenario6-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json");
  const handoff = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/dormitory/scenario6-handoff.generated.json");
  const financeGate = dormitoryScenario6GeneratedContracts.get("docs/contracts/generated/finance/scenario6-finance-gate.generated.json");
  const mobileMirror = dormitoryScenario6GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario6-payment-deposit-and-guarantee.generated.json");
  const runtimeMirror = dormitoryScenario6GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario6PaymentDepositAndGuarantee.generated.json");

  if (canonical?.nameZh !== "收款、押金与担保") fail("scenario 6 canonical contract must expose 收款、押金与担保.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([5, 3, 4]) ||
    canonical?.downstream?.allowedConsumerPackageNo !== 7) {
    fail("scenario 6 canonical must read packages 5/3/4 and hand off to package 7 only.");
  }
  if (!JSON.stringify(canonical?.commands ?? []).includes("Dorm.FinanceGateConfirm")) {
    fail("scenario 6 canonical must expose finance-gate confirmation command.");
  }
  if (objectState?.financeBoundaryRule?.financeGateRequired !== true ||
    objectState?.financeBoundaryRule?.businessRuntimeMayWriteLedger !== false ||
    objectState?.financeBoundaryRule?.depositIsNotIncome !== true ||
    objectState?.financeBoundaryRule?.guaranteeIsNotPayment !== true) {
    fail("scenario 6 finance boundary rule must expose finance-gate, no business ledger write, deposit non-income and guarantee non-payment.");
  }
  if ((stepsFields?.steps ?? []).length !== 6) fail("scenario 6 steps-fields must contain exactly 6 steps.");
  for (const internal of ["paymentId", "depositId", "guaranteeId", "ledgerEntryId", "ledgerTransactionId", "reservationId", "paymentCaseId", "financeReviewRequestId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 6 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 6 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 6 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedFinanceInlineEditAllowed !== false) fail("scenario 6 confirmed finance inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 6 failure ${failure.failureCode} must have no side effects.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("确认失败不得写 CommandSubmission")) fail("scenario 6 runtime rules must forbid side effects on confirmation failure.");
  if (runtimeRules?.runtimeConsumptionBoundary?.financeGateMayConfirmFinanceFacts !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false) {
    fail("scenario 6 runtime boundary must keep finance-gate confirmation and forbid business ledger writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 6 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("不得把收款确认当成已入住")) fail("scenario 6 handoff must forbid treating payment confirmation as check-in.");
  for (const forbidden of ["入住", "已入住", "可入住", "退房", "退款", "已退款", "LedgerEntry", "LedgerTransaction"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 6 handoff must not output ${forbidden}.`);
  }
  if (financeGate?.consumer !== "finance-gate") fail("scenario 6 finance-gate projection must declare consumer=finance-gate.");
  if (financeGate?.financeBoundaryRule?.financeGateRequired !== true ||
    financeGate?.forbiddenLedgerWritesByBusinessRuntime !== true ||
    financeGate?.depositIsNotIncome !== true ||
    financeGate?.guaranteeIsNotPayment !== true) {
    fail("scenario 6 finance-gate projection must enforce ledger, deposit and guarantee boundaries.");
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 6 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 6 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario7Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario7GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario7-check-in-processing-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 7 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 7 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario7.CheckInProcessing" || document.scenarioPackageNo !== 7) {
      fail(`${file} must bind Dormitory.Scenario7.CheckInProcessing package 7.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario7GeneratedContracts.get("docs/contracts/generated/dormitory/scenario7-check-in-processing.generated.json");
  const objectState = dormitoryScenario7GeneratedContracts.get("docs/contracts/generated/dormitory/scenario7-object-state-model.generated.json");
  const stepsFields = dormitoryScenario7GeneratedContracts.get("docs/contracts/generated/dormitory/scenario7-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario7GeneratedContracts.get("docs/contracts/generated/dormitory/scenario7-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario7GeneratedContracts.get("docs/contracts/generated/dormitory/scenario7-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario7GeneratedContracts.get("docs/contracts/generated/dormitory/scenario7-surface-navigation.generated.json");
  const handoff = dormitoryScenario7GeneratedContracts.get("docs/contracts/generated/dormitory/scenario7-handoff.generated.json");
  const mobileMirror = dormitoryScenario7GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario7-check-in-processing.generated.json");
  const runtimeMirror = dormitoryScenario7GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario7CheckInProcessing.generated.json");

  if (canonical?.nameZh !== "入住办理") fail("scenario 7 canonical contract must expose 入住办理.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([5, 6, 2, 3]) ||
    canonical?.downstream?.allowedConsumerPackageNo !== 8) {
    fail("scenario 7 canonical must read packages 5/6/2/3 and hand off to package 8 only.");
  }
  for (const command of ["Dorm.StayConfirm", "Dorm.StayCredentialIssue"]) {
    if (!JSON.stringify(canonical?.commands ?? []).includes(command)) fail(`scenario 7 canonical must expose ${command}.`);
  }
  const stateText = JSON.stringify(objectState?.stateLayering ?? {});
  for (const required of ["已预订", "财务已确认", "可办理入住", "已入住", "在住服务", "退房", "已结清", "押金可退", "房源恢复"]) {
    if (!stateText.includes(required)) fail(`scenario 7 state layering missing ${required}.`);
  }
  if ((stepsFields?.steps ?? []).length !== 6) fail("scenario 7 steps-fields must contain exactly 6 steps.");
  for (const internal of ["stayId", "residentId", "reservationId", "credentialId", "roomId", "bedId", "occupancyId", "checkInCaseId", "identityVerificationId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 7 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 7 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 7 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedCheckInInlineEditAllowed !== false) fail("scenario 7 confirmed check-in inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 7 failure ${failure.failureCode} must have no side effects.`);
  }
  const invariantRule = runtimeRules?.checkInInvariantRule ?? {};
  for (const key of ["validReservationRequired", "resourceAvailableForCheckInRequired", "identityVerificationRequired", "agreementConfirmationRequired", "financeReadinessOrManagerExceptionRequired", "stayNoSystemGenerated", "confirmedStayStartsOccupancy", "reservationConvertedToStayOnSuccess", "credentialRequiresSuccessfulStay", "failureNoSideEffects"]) {
    if (invariantRule[key] !== true) fail(`scenario 7 invariant ${key} must be true.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("确认失败不得写 Stay")) fail("scenario 7 runtime rules must forbid side effects on check-in failure.");
  if (runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentDepositRefund !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteCheckout !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.successMayWriteStayOccupancyCredentialOnly !== true) {
    fail("scenario 7 runtime boundary must keep generated-only consumption and forbid payment/deposit/refund/checkout/ledger writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 7 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("不得要求用户重新填写已确认入住字段")) fail("scenario 7 handoff must forbid downstream refilling confirmed check-in fields.");
  for (const forbidden of ["Payment", "Deposit", "Refund", "CheckoutCase", "LedgerEntry", "LedgerTransaction", "收款", "押金变更", "退款", "退房结算"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 7 handoff must not output ${forbidden}.`);
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 7 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 7 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario8Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario8GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario8-in-stay-management-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 8 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 8 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario8.InStayManagement" || document.scenarioPackageNo !== 8) {
      fail(`${file} must bind Dormitory.Scenario8.InStayManagement package 8.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario8GeneratedContracts.get("docs/contracts/generated/dormitory/scenario8-in-stay-management.generated.json");
  const objectState = dormitoryScenario8GeneratedContracts.get("docs/contracts/generated/dormitory/scenario8-object-state-model.generated.json");
  const stepsFields = dormitoryScenario8GeneratedContracts.get("docs/contracts/generated/dormitory/scenario8-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario8GeneratedContracts.get("docs/contracts/generated/dormitory/scenario8-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario8GeneratedContracts.get("docs/contracts/generated/dormitory/scenario8-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario8GeneratedContracts.get("docs/contracts/generated/dormitory/scenario8-surface-navigation.generated.json");
  const handoff = dormitoryScenario8GeneratedContracts.get("docs/contracts/generated/dormitory/scenario8-handoff.generated.json");
  const mobileMirror = dormitoryScenario8GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario8-in-stay-management.generated.json");
  const runtimeMirror = dormitoryScenario8GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario8InStayManagement.generated.json");

  if (canonical?.nameZh !== "在住管理") fail("scenario 8 canonical contract must expose 在住管理.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([7, 6, 2, 3]) ||
    canonical?.downstream?.allowedConsumerPackageNo !== 9) {
    fail("scenario 8 canonical must read packages 7/6/2/3 and hand off to package 9 only.");
  }
  for (const command of ["Dorm.StayStatusChange", "Dorm.ResidentServiceRequestRegister", "Dorm.ResidentIncidentRegister", "Dorm.StayExtensionRequestSubmit", "Dorm.BedTransferRequestSubmit", "Dorm.AccessCredentialStatusChange", "Dorm.CheckoutPreparationSnapshotCreate"]) {
    if (!JSON.stringify(canonical?.commands ?? []).includes(command)) fail(`scenario 8 canonical must expose ${command}.`);
  }
  const stateText = JSON.stringify(objectState?.stateLayering ?? {});
  for (const required of ["已入住", "正常在住", "退房待准备", "可退房", "已结清", "已退房", "重新入住"]) {
    if (!stateText.includes(required)) fail(`scenario 8 state layering missing ${required}.`);
  }
  if ((stepsFields?.steps ?? []).length !== 8) fail("scenario 8 steps-fields must contain exactly 8 steps.");
  for (const internal of ["stayId", "occupancyId", "credentialId", "serviceRequestId", "incidentId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 8 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 8 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 8 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedInStayFactInlineEditAllowed !== false) fail("scenario 8 confirmed in-stay fact inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 8 failure ${failure.failureCode} must have no side effects.`);
  }
  const invariantRule = runtimeRules?.inStayInvariantRule ?? {};
  for (const key of ["effectiveStayRequired", "currentOccupancyRequired", "singleActiveOccupancyPerBedAtSameTime", "transferAppendOnlyOccupancyChanged", "transferReleasesOldAndBindsNewOnSuccess", "extensionDateMustBeLaterThanCurrentCheckout", "extensionFinanceHandledByFinanceGateOnly", "credentialRequiresEffectiveStayAndOccupancy", "checkoutPreparationNotCheckoutSettlement", "failureNoSideEffects"]) {
    if (invariantRule[key] !== true) fail(`scenario 8 invariant ${key} must be true.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("失败路径不得改变占用")) fail("scenario 8 runtime rules must forbid side effects on in-stay failure.");
  if (runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentDepositRefund !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteCheckoutSettlement !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayReleaseRoom !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.successMayWriteInStayFactsOnly !== true) {
    fail("scenario 8 runtime boundary must keep generated-only consumption and forbid payment/deposit/refund/checkout/release/ledger writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 8 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("不得要求用户重新填写已确认入住字段")) fail("scenario 8 handoff must forbid downstream refilling confirmed check-in fields.");
  for (const forbidden of ["Payment", "Deposit", "Refund", "CheckoutCase", "CheckoutSettlement", "LedgerEntry", "LedgerTransaction", "RoomRelease", "收款", "押金确认", "退款", "退房结算", "房源释放"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 8 handoff must not output ${forbidden}.`);
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 8 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 8 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario9Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario9GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario9-checkout-settlement-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 9 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 9 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario9.CheckoutSettlement" || document.scenarioPackageNo !== 9) {
      fail(`${file} must bind Dormitory.Scenario9.CheckoutSettlement package 9.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/dormitory/scenario9-checkout-settlement.generated.json");
  const objectState = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/dormitory/scenario9-object-state-model.generated.json");
  const stepsFields = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/dormitory/scenario9-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/dormitory/scenario9-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/dormitory/scenario9-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/dormitory/scenario9-surface-navigation.generated.json");
  const handoff = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/dormitory/scenario9-handoff.generated.json");
  const financeGate = dormitoryScenario9GeneratedContracts.get("docs/contracts/generated/finance/scenario9-finance-gate.generated.json");
  const mobileMirror = dormitoryScenario9GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario9-checkout-settlement.generated.json");
  const runtimeMirror = dormitoryScenario9GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario9CheckoutSettlement.generated.json");

  if (canonical?.nameZh !== "退房结算") fail("scenario 9 canonical contract must expose 退房结算.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([7, 8, 6]) ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("finance-gate") ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("房源运营就绪与状态维护")) {
    fail("scenario 9 canonical must read packages 7/8/6 and hand off only to finance-gate, scenario 2 and later finance processing.");
  }
  for (const command of ["Dorm.CheckoutCaseDraftStart", "Dorm.CheckoutHandoverConfirm", "Dorm.CheckoutInspectionConfirm", "Dorm.CheckoutFeeCalculationGenerate", "Dorm.CustomerSettlementConfirm", "Dorm.CheckoutConfirm", "Dorm.CheckoutFinanceRequestCreate", "Dorm.ResourceRecoveryRequestCreate"]) {
    if (!JSON.stringify(canonical?.commands ?? []).includes(command)) fail(`scenario 9 canonical must expose ${command}.`);
  }
  const stateText = JSON.stringify(objectState?.stateLayering ?? {});
  for (const required of ["已退房不等于已退款", "已退房不等于房源可运营", "结算意向不等于账务真值", "资源待保洁", "finance-gate"]) {
    if (!stateText.includes(required)) fail(`scenario 9 state layering missing ${required}.`);
  }
  if ((stepsFields?.steps ?? []).length !== 7) fail("scenario 9 steps-fields must contain exactly 7 steps.");
  for (const internal of ["stayId", "checkoutCaseId", "settlementId", "refundId", "ledgerEntryId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId", "paymentId", "ledgerTransactionId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 9 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 9 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 9 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedCheckoutInlineEditAllowed !== false) fail("scenario 9 confirmed checkout inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 9 failure ${failure.failureCode} must have no side effects.`);
  }
  const invariantRule = runtimeRules?.checkoutInvariantRule ?? {};
  for (const key of ["validStayRequired", "currentOccupancyRequired", "actualCheckoutAtRequired", "handoverRequired", "credentialReturnRequired", "inspectionEvidenceRequired", "damageRequiresDescriptionAndEvidence", "feeSourcesAuthoritative", "customerConfirmationRequired", "disputedSettlementRequiresReview", "checkoutDoesNotMeanRefunded", "checkoutDoesNotMakeResourceOperational", "financeGateHandlesRefundTopUpLedger", "resourceRecoveryViaScenario2Only", "failureNoSideEffects"]) {
    if (invariantRule[key] !== true) fail(`scenario 9 invariant ${key} must be true.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("失败路径不得结束入住")) fail("scenario 9 runtime rules must forbid side effects on checkout failure.");
  if (runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayRestoreOperationalStatus !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.financeGateMayConsumeSettlementIntentOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.successMayWriteCheckoutFactsAndRequestsOnly !== true) {
    fail("scenario 9 runtime boundary must keep generated-only consumption and forbid payment/refund/operational restore/ledger writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 9 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
    !String(handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 2")) {
    fail("scenario 9 handoff must route finance truth to finance-gate and resource restore to scenario 2.");
  }
  for (const forbidden of ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "RoomOperationStatus=可运营", "已退款", "已入账", "房源已可运营"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 9 handoff must not output ${forbidden}.`);
  }
  if (financeGate?.consumer !== "finance-gate" ||
    financeGate?.settlementIntentOnly !== true ||
    financeGate?.businessRuntimeMayWriteLedger !== false ||
    financeGate?.businessRuntimeMayWritePaymentRefund !== false) {
    fail("scenario 9 finance-gate contract must consume settlement intent only and forbid business runtime finance truth writes.");
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 9 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 9 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario10Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario10GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario10-cancel-noshow-refund-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 10 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 10 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario10.CancelNoShowRefund" || document.scenarioPackageNo !== 10) {
      fail(`${file} must bind Dormitory.Scenario10.CancelNoShowRefund package 10.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/dormitory/scenario10-cancel-noshow-refund.generated.json");
  const objectState = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/dormitory/scenario10-object-state-model.generated.json");
  const stepsFields = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/dormitory/scenario10-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/dormitory/scenario10-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/dormitory/scenario10-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/dormitory/scenario10-surface-navigation.generated.json");
  const handoff = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/dormitory/scenario10-handoff.generated.json");
  const financeGate = dormitoryScenario10GeneratedContracts.get("docs/contracts/generated/finance/scenario10-finance-gate.generated.json");
  const mobileMirror = dormitoryScenario10GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario10-cancel-noshow-refund.generated.json");
  const runtimeMirror = dormitoryScenario10GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario10CancelNoShowRefund.generated.json");

  if (canonical?.nameZh !== "取消、未到店与退款处理") fail("scenario 10 canonical contract must expose 取消、未到店与退款处理.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([5, 6, 7, 9]) ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("finance-gate") ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("inventory-reservation-read-model")) {
    fail("scenario 10 canonical must read packages 5/6/7/9 and hand off to finance-gate and inventory/reservation read model.");
  }
  for (const command of ["Dorm.CancelNoShowCaseDraftStart", "Dorm.CancellationCaseDraftStart", "Dorm.NoShowCaseDraftStart", "Dorm.CancelNoShowReasonCustomerConfirm", "Dorm.CancelNoShowPolicyCalculationGenerate", "Dorm.CancelNoShowInventoryReleaseRequestConfirm", "Dorm.CancelNoShowFinanceProcessingRequestCreate", "Dorm.CancelNoShowConfirmClosure"]) {
    if (!JSON.stringify(canonical?.commands ?? []).includes(command)) fail(`scenario 10 canonical must expose ${command}.`);
  }
  const stateText = JSON.stringify(objectState?.stateLayering ?? {});
  for (const required of ["已取消不等于已退款", "未到店关闭不等于已退款", "退款申请不等于退款到账", "扣费申请不等于扣费入账", "finance-gate"]) {
    if (!stateText.includes(required)) fail(`scenario 10 state layering missing ${required}.`);
  }
  if ((stepsFields?.steps ?? []).length !== 7) fail("scenario 10 steps-fields must contain exactly 7 steps.");
  for (const internal of ["cancellationCaseId", "refundId", "paymentId", "depositId", "ledgerEntryId", "reservationId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId", "ledgerTransactionId", "checkoutCaseId", "stayId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 10 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 10 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 10 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedClosureInlineEditAllowed !== false) fail("scenario 10 confirmed closure inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 10 failure ${failure.failureCode} must have no side effects.`);
  }
  const invariantRule = runtimeRules?.cancelNoShowInvariantRule ?? {};
  for (const key of ["validReservationRequired", "paymentDepositSnapshotRequiredForRefund", "settlementIntentRequiredForCheckoutRefund", "alreadyCheckedInBlocksOrdinaryCancellation", "alreadyCheckedOutBlocksOrdinaryCancellation", "alreadyCancelledBlocksDuplicateCancellation", "noShowRequiresHoldTimeElapsed", "noShowRequiresNoEffectiveCheckin", "customerConfirmationRequired", "disputeRequiresReview", "amountSourcesAuthoritative", "finalFinanceTruthManualInputForbidden", "inventoryReleaseScopeBoundToReservation", "financeGateHandlesRefundFeeLedger", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (invariantRule[key] !== true) fail(`scenario 10 invariant ${key} must be true.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("失败路径不得关闭预订")) fail("scenario 10 runtime rules must forbid side effects on cancellation failure.");
  if (runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteStayCheckout !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.financeGateMayConsumeRefundFeeIntentOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.inventoryReadModelMayConsumeReleaseRequestOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.successMayWriteCancellationNoShowFactsAndRequestsOnly !== true) {
    fail("scenario 10 runtime boundary must keep generated-only consumption and forbid payment/refund/stay/checkout/ledger writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 10 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
    !String(handoff?.downstreamRecheckRuleZh ?? "").includes("库存/预订读模型")) {
    fail("scenario 10 handoff must route finance truth to finance-gate and inventory release to read model.");
  }
  for (const forbidden of ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "Stay", "CheckoutCase", "RoomOperationStatus=可运营", "已退款到账", "已入账", "已入住", "已退房"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 10 handoff must not output ${forbidden}.`);
  }
  if (financeGate?.consumer !== "finance-gate" ||
    financeGate?.refundFeeIntentOnly !== true ||
    financeGate?.businessRuntimeMayWriteLedger !== false ||
    financeGate?.businessRuntimeMayWritePaymentRefund !== false) {
    fail("scenario 10 finance-gate contract must consume refund/fee intent only and forbid business runtime finance truth writes.");
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 10 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 10 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario11Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario11GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario11-housekeeping-maintenance-outofservice-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 11 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 11 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService" || document.scenarioPackageNo !== 11) {
      fail(`${file} must bind Dormitory.Scenario11.HousekeepingMaintenanceOutOfService package 11.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/dormitory/scenario11-housekeeping-maintenance-outofservice.generated.json");
  const objectState = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/dormitory/scenario11-object-state-model.generated.json");
  const stepsFields = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/dormitory/scenario11-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/dormitory/scenario11-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/dormitory/scenario11-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/dormitory/scenario11-surface-navigation.generated.json");
  const handoff = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/dormitory/scenario11-handoff.generated.json");
  const financeGate = dormitoryScenario11GeneratedContracts.get("docs/contracts/generated/finance/scenario11-finance-gate.generated.json");
  const mobileMirror = dormitoryScenario11GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario11-housekeeping-maintenance-outofservice.generated.json");
  const runtimeMirror = dormitoryScenario11GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json");

  if (canonical?.nameZh !== "房务、维修与停售协同") fail("scenario 11 canonical contract must expose 房务、维修与停售协同.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([2, 8, 9, 10]) ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("场景包 2") ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("finance-gate")) {
    fail("scenario 11 canonical must read packages 2/8/9/10 and hand off to scenario 2 plus finance-gate.");
  }
  for (const command of ["Dorm.ServiceWorkCaseDraftStart", "Dorm.WorkAssignmentDispatch", "Dorm.WorkProgressUpdate", "Dorm.WorkCompletionSubmit", "Dorm.WorkVerificationConfirm", "Dorm.WorkReworkRequest", "Dorm.OutOfServiceOrRecoveryRecommendationCreate", "Dorm.ExpenseIntentSubmit"]) {
    if (!JSON.stringify(canonical?.commands ?? []).includes(command)) fail(`scenario 11 canonical must expose ${command}.`);
  }
  const stateText = JSON.stringify(objectState?.stateLayering ?? {});
  for (const required of ["运营状态由场景包 2 确认", "验收通过不等于可运营", "建议恢复不等于已恢复", "维修费用意向不等于账务成本"]) {
    if (!stateText.includes(required)) fail(`scenario 11 state layering missing ${required}.`);
  }
  if ((stepsFields?.steps ?? []).length !== 7) fail("scenario 11 steps-fields must contain exactly 7 steps.");
  for (const internal of ["taskId", "workItemId", "roomId", "bedId", "stayId", "serviceRequestId", "serviceWorkCaseId", "workAssignmentId", "expenseIntentId", "ledgerEntryId", "reservationId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 11 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 11 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 11 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedWorkInlineEditAllowed !== false) fail("scenario 11 confirmed work inline edit must be forbidden.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 11 failure ${failure.failureCode} must have no side effects.`);
  }
  const invariantRule = runtimeRules?.housekeepingMaintenanceInvariantRule ?? {};
  for (const key of ["legalSourceRequired", "sourceSummaryRequired", "resourceScopeRequired", "operationStatusOwnedByScenario2", "completionEvidenceRequired", "verificationAuthorizedRequired", "completionRequiredBeforeVerification", "failedVerificationCreatesReworkOrException", "unresolvedMaintenanceBlocksRecoveryRecommendation", "expenseIntentOnly", "financeGateHandlesExpenseTruth", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (invariantRule[key] !== true) fail(`scenario 11 invariant ${key} must be true.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("失败路径不得关闭阻断")) fail("scenario 11 runtime rules must forbid side effects on work failure.");
  if (runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteOperationStatus !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteReservation !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteStay !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.financeGateMayConsumeExpenseIntentOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.scenario2MayConsumeRecommendationOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.successMayWriteWorkFactsAndRequestsOnly !== true) {
    fail("scenario 11 runtime boundary must keep generated-only consumption and forbid operation/reservation/stay/payment/refund/ledger writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 11 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 2") ||
    !String(handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
    fail("scenario 11 handoff must route operation truth to scenario 2 and expense truth to finance-gate.");
  }
  for (const forbidden of ["RoomOperationStatus=可运营", "Reservation", "Stay", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已可运营", "已可预订", "已入账", "已退款"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 11 handoff must not output ${forbidden}.`);
  }
  if (financeGate?.consumer !== "finance-gate" ||
    financeGate?.expenseIntentOnly !== true ||
    financeGate?.businessRuntimeMayWriteLedger !== false ||
    financeGate?.businessRuntimeMayWritePaymentRefund !== false) {
    fail("scenario 11 finance-gate contract must consume expense intent only and forbid business runtime finance truth writes.");
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 11 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 11 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario12Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario12GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario12-channel-corporate-customer-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 12 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 12 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario12.ChannelCorporateCustomer" || document.scenarioPackageNo !== 12) {
      fail(`${file} must bind Dormitory.Scenario12.ChannelCorporateCustomer package 12.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/dormitory/scenario12-channel-corporate-customer.generated.json");
  const objectState = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/dormitory/scenario12-object-state-model.generated.json");
  const stepsFields = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/dormitory/scenario12-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/dormitory/scenario12-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/dormitory/scenario12-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/dormitory/scenario12-surface-navigation.generated.json");
  const handoff = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/dormitory/scenario12-handoff.generated.json");
  const financeGate = dormitoryScenario12GeneratedContracts.get("docs/contracts/generated/finance/scenario12-finance-gate.generated.json");
  const mobileMirror = dormitoryScenario12GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario12-channel-corporate-customer.generated.json");
  const runtimeMirror = dormitoryScenario12GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario12ChannelCorporateCustomer.generated.json");

  if (canonical?.nameZh !== "渠道与企业客户") fail("scenario 12 canonical contract must expose 渠道与企业客户.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([2, 3]) ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("场景包 4") ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("场景包 5") ||
    !JSON.stringify(canonical?.downstream ?? {}).includes("finance-gate")) {
    fail("scenario 12 canonical must read packages 2/3 and hand off to scenarios 4/5 plus finance-gate.");
  }
  for (const objectName of ["ChannelPartner", "CorporateCustomer", "CorporateAgreement", "AgreementEligibility", "ChannelProductMapping", "ChannelPublicationStatus", "CommissionRuleIntent", "SettlementRuleIntent", "ContractEvidence"]) {
    if (!(canonical?.objects ?? []).includes(objectName)) fail(`scenario 12 canonical must expose ${objectName}.`);
  }
  for (const command of ["Dorm.ChannelCorporateProfileDraftStart", "Dorm.CorporateAgreementDraftSubmit", "Dorm.CorporateAgreementApproveActivate", "Dorm.ChannelProductEligibilityBind", "Dorm.ChannelPublicationRuleConfigure", "Dorm.ChannelPublicationEnable", "Dorm.CommissionSettlementIntentSubmit", "Dorm.ChannelPause", "Dorm.CorporateAgreementRenew"]) {
    if (!JSON.stringify(canonical?.commands ?? []).includes(command)) fail(`scenario 12 canonical must expose ${command}.`);
  }
  const stateText = JSON.stringify(objectState?.stateLayering ?? {});
  for (const required of ["商品和价格金额真值来自场景包 3", "报价来自场景包 4", "预订和库存锁定来自场景包 5", "财务真值来自 finance-gate", "维修/停售资源不得发布为可用"]) {
    if (!stateText.includes(required)) fail(`scenario 12 state layering missing ${required}.`);
  }
  if ((stepsFields?.steps ?? []).length !== 7) fail("scenario 12 steps-fields must contain exactly 7 steps.");
  for (const internal of ["channelId", "corporateAccountId", "agreementId", "productId", "priceVersionId", "ratePlanId", "quoteId", "reservationId", "inventoryHoldId", "paymentId", "refundId", "ledgerEntryId", "ledgerTransactionId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 12 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 12 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false) fail("scenario 12 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.confirmedInlineEditAllowed !== false) fail("scenario 12 confirmed channel/corporate facts inline edit must be forbidden.");
  if (crudPolicy?.crudRules?.physicalDeleteConfirmedFactAllowed !== false) fail("scenario 12 confirmed facts must not be physically deleted.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 12 failure ${failure.failureCode} must have no side effects.`);
  }
  const invariantRule = runtimeRules?.channelCorporateInvariantRule ?? {};
  for (const key of ["businessProfileRequired", "keyEvidenceRequiredBeforeEnable", "agreementDateRangeValid", "agreementApprovalRequiredBeforeEffective", "expiredAgreementCannotBeEligible", "productPriceReferenceFromScenario3Only", "effectivePriceRequiredForPublication", "operationBlockPreventsPublication", "channelPublicationDoesNotLockInventory", "quoteOwnedByScenario4", "reservationInventoryOwnedByScenario5", "financeGateHandlesCommissionSettlementTruth", "appendOnlyVersionHistory", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (invariantRule[key] !== true) fail(`scenario 12 invariant ${key} must be true.`);
  }
  if (!JSON.stringify(runtimeRules?.invariants ?? []).includes("失败路径不得启用渠道")) fail("scenario 12 runtime rules must forbid side effects on channel/corporate failure.");
  if (runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteRatePlanTruth !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteQuote !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteReservation !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteInventoryHold !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
    runtimeRules?.runtimeConsumptionBoundary?.financeGateMayConsumeCommissionSettlementIntentOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.scenario4MayConsumeEligibilityOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.scenario5MayConsumeEligibilityOnly !== true ||
    runtimeRules?.runtimeConsumptionBoundary?.successMayWriteChannelCorporateFactsAndIntentsOnly !== true) {
    fail("scenario 12 runtime boundary must keep generated-only consumption and forbid price truth/quote/reservation/inventory/payment/refund/ledger writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 12 search page must remain readonly.");
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 4") ||
    !String(handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 5") ||
    !String(handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
    fail("scenario 12 handoff must route quote truth to scenario 4, reservation/inventory truth to scenario 5, and commission/settlement truth to finance-gate.");
  }
  for (const forbidden of ["RatePlan 金额真值", "Quote", "Reservation", "InventoryHold", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已报价", "已预订", "已收款", "已入账"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 12 handoff must not output ${forbidden}.`);
  }
  if (financeGate?.consumer !== "finance-gate" ||
    financeGate?.commissionSettlementIntentOnly !== true ||
    financeGate?.businessRuntimeMayWriteLedger !== false ||
    financeGate?.businessRuntimeMayWritePaymentRefund !== false) {
    fail("scenario 12 finance-gate contract must consume commission/settlement intent only and forbid business runtime finance truth writes.");
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 12 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 12 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryScenario13Contracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryScenario13GeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario13-reporting-audit-review-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 13 generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from scenario 13 Source and package index only.`);
    }
    if (document.authorityId !== "Dormitory.Scenario13.ReportingAuditReview" || document.scenarioPackageNo !== 13) {
      fail(`${file} must bind Dormitory.Scenario13.ReportingAuditReview package 13.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const canonical = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-reporting-audit-review.generated.json");
  const objectState = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-object-state-model.generated.json");
  const metricModel = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-metric-model.generated.json");
  const stepsFields = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-steps-fields.generated.json");
  const crudPolicy = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-crud-policy.generated.json");
  const runtimeRules = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-runtime-rules.generated.json");
  const surfaceNavigation = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-surface-navigation.generated.json");
  const handoff = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/dormitory/scenario13-handoff.generated.json");
  const readModel = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json");
  const financeGate = dormitoryScenario13GeneratedContracts.get("docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json");
  const mobileMirror = dormitoryScenario13GeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario13-reporting-audit-review.generated.json");
  const runtimeMirror = dormitoryScenario13GeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario13ReportingAuditReview.generated.json");

  if (canonical?.nameZh !== "经营报表、审计与复盘") fail("scenario 13 canonical contract must expose 经营报表、审计与复盘.");
  if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) ||
    canonical?.upstream?.upstreamWriteBackAllowed !== false ||
    !JSON.stringify(canonical?.upstream ?? {}).includes("finance-gate 已确认账务事实")) {
    fail("scenario 13 canonical must read packages 1-12 plus finance-gate as readonly inputs only.");
  }
  for (const objectName of ["ReportPeriod", "ReportScope", "MetricDefinition", "MetricSnapshot", "ReportSnapshot", "AuditFinding", "EvidenceReviewRecord", "ReviewMeetingRecord", "ReviewConclusion", "ActionPlan", "IssueTrackingItem", "ReportExportRecord", "ReportStatusTimeline", "StatusTimeline"]) {
    if (!(canonical?.objects ?? []).includes(objectName)) fail(`scenario 13 canonical must expose ${objectName}.`);
  }
  for (const command of ["Dorm.ReportScopeSelect", "Dorm.ReportDataQualityCheck", "Dorm.BusinessReportSnapshotGenerate", "Dorm.FinanceReviewSnapshotGenerate", "Dorm.AuditFindingCreate", "Dorm.ReviewConclusionActionPlanCreate", "Dorm.ActionPlanCreate", "Dorm.IssueTrackingItemCreate", "Dorm.ReportPublish", "Dorm.ReportExportRecordCreate", "Dorm.ReportArchive"]) {
    if (!JSON.stringify(canonical?.commands ?? []).includes(command)) fail(`scenario 13 canonical must expose ${command}.`);
  }
  const objectNames = (objectState?.objects ?? []).map((item) => item.objectName);
  for (const objectName of ["ReportSnapshot", "MetricSnapshot", "AuditFinding", "ActionPlan", "IssueTrackingItem"]) {
    if (!objectNames.includes(objectName)) fail(`scenario 13 object state model missing ${objectName}.`);
  }
  if ((stepsFields?.steps ?? []).length !== 7) fail("scenario 13 steps-fields must contain exactly 7 steps.");
  for (const internal of ["reportId", "metricId", "ledgerEntryId", "reservationId", "stayId", "roomId", "bedId", "paymentId", "depositId", "refundId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
    if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`scenario 13 forbidden field missing ${internal}.`);
    if ((mobileMirror?.fields?.userFilled ?? []).includes(internal) || (mobileMirror?.fields?.userSelected ?? []).includes(internal)) {
      fail(`scenario 13 mobile mirror exposes internal field ${internal}.`);
    }
  }
  if ((metricModel?.metricCatalog ?? []).length < 15) fail("scenario 13 metric model must expose the reporting metric catalog.");
  for (const key of ["mustHaveFormula", "mustHaveSourcePackages", "mustHaveTimeRange", "mustHavePermissionEnvelope", "mustHaveLineageEnvelope", "mustHaveFreshnessEnvelope", "mustHaveCalculationVersion", "financialMetricsReadFinanceGateOnly"]) {
    if (metricModel?.metricDefinitionRule?.[key] !== true) fail(`scenario 13 metric rule ${key} must be true.`);
  }
  for (const metricKey of ["recognized_revenue", "deposit_balance", "refund_request_count"]) {
    const metric = (metricModel?.metricCatalog ?? []).find((item) => item.metricKey === metricKey);
    if (!metric || metric.financeGateOnly !== true) fail(`scenario 13 financial metric ${metricKey} must be finance-gate only.`);
  }
  if (crudPolicy?.crudRules?.readOnlySurfacesWriteSourceFactAllowed !== false) fail("scenario 13 query/search/list/board/report must be readonly.");
  if (crudPolicy?.crudRules?.publishedInlineEditAllowed !== false) fail("scenario 13 published reports must not be inline edited.");
  if (crudPolicy?.crudRules?.physicalDeletePublishedAllowed !== false) fail("scenario 13 published reports must not be physically deleted.");
  for (const failure of runtimeRules?.failureSemantics ?? []) {
    if (failure.sideEffectsAllowed !== false) fail(`scenario 13 failure ${failure.failureCode} must have no side effects.`);
  }
  const invariantRule = runtimeRules?.reportingInvariantRule ?? {};
  for (const key of ["reportDashboardSearchExportReadonly", "permissionRequiredForFormalReport", "lineageRequiredForFormalMetric", "freshnessRequiredForPublish", "metricCalculationFromConfirmedFactsOnly", "uiStateMetricCalculationForbidden", "financialMetricsReadFinanceGateOnly", "auditFindingCannotModifySourceFact", "actionPlanRoutesBackOnly", "publishedReportAppendOnlyVersion", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
    if (invariantRule[key] !== true) fail(`scenario 13 invariant ${key} must be true.`);
  }
  const boundary = runtimeRules?.runtimeConsumptionBoundary ?? {};
  if (boundary.runtimeMayReadGeneratedOnly !== true ||
    boundary.runtimeMayHardcodeBusinessRules !== false ||
    boundary.readModelMayReadConfirmedFactsOnly !== true ||
    boundary.readModelMayWriteSourceFacts !== false ||
    boundary.businessRuntimeMayWriteRoomBedOperation !== false ||
    boundary.businessRuntimeMayWritePriceQuoteReservationStay !== false ||
    boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
    boundary.businessRuntimeMayWriteLedger !== false ||
    boundary.financeGateTruthReadonlyOnly !== true ||
    boundary.failurePathBusinessSideEffectsAllowed !== false ||
    boundary.successMayWriteReportingAuditReviewFactsOnly !== true) {
    fail("scenario 13 runtime boundary must keep generated-only consumption, read-only upstream/finance-gate, and reporting/audit/review-only success writes.");
  }
  if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("scenario 13 search page must remain readonly.");
  if (!String(surfaceNavigation?.surfaceNavigation?.todayZh ?? "").includes("今天需要处理的被动任务")) fail("scenario 13 Today entry must show passive tasks only.");
  if (readModel?.consumer !== "read-model/reporting" ||
    readModel?.readModelMayReadConfirmedFactsOnly !== true ||
    readModel?.readModelMayWriteSourceFacts !== false ||
    !JSON.stringify(readModel?.requiredEnvelopes ?? []).includes("permission envelope") ||
    !JSON.stringify(readModel?.requiredEnvelopes ?? []).includes("lineage envelope") ||
    !JSON.stringify(readModel?.requiredEnvelopes ?? []).includes("freshness envelope")) {
    fail("scenario 13 read-model contract must read confirmed facts only and require permission/lineage/freshness envelopes.");
  }
  if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("对应场景包") ||
    !String(handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
    fail("scenario 13 handoff must route action plans back to responsible scenario packages or finance-gate.");
  }
  for (const forbidden of ["Room", "Bed", "OperationStatus", "RatePlan", "Quote", "Reservation", "Stay", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "已修复原事实", "已入账", "已上线", "final GO"]) {
    if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 13 handoff must not output ${forbidden}.`);
  }
  if (financeGate?.consumer !== "finance-gate" ||
    financeGate?.financeGateTruthReadonlyOnly !== true ||
    financeGate?.businessRuntimeMayWriteLedger !== false ||
    financeGate?.businessRuntimeMayWritePaymentDepositRefund !== false ||
    financeGate?.financialMetricsReadFinanceGateOnly !== true) {
    fail("scenario 13 finance-gate contract must be readonly and forbid business runtime finance truth writes.");
  }
  if (mobileMirror?.consumer !== "surface") fail("scenario 13 mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("scenario 13 runtime mirror must declare consumer=runtime.");
}

function checkDormitoryBenchmarkInheritanceContracts() {
  const generatedFrom = [
    "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json",
    "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json"
  ];
  for (const [file, document] of dormitoryBenchmarkInheritanceGeneratedContracts) {
    if (document.generated !== true) fail(`${file} must include generated=true.`);
    if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
    if (document.generatedBy !== "scripts/business/generate-dormitory-scenario1-benchmark-inheritance-contracts.mjs") {
      fail(`${file} must be generated by dormitory scenario 1 benchmark inheritance generator.`);
    }
    if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify(generatedFrom)) {
      fail(`${file} must be generated from benchmark contract, 13 scenario control, scenario 1 and package index.`);
    }
    if (document.authorityId !== "Dormitory.Scenario1BenchmarkInheritanceContract") {
      fail(`${file} must bind Dormitory.Scenario1BenchmarkInheritanceContract.`);
    }
    const expectedOutputDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
    if (document.outputContentDigest !== expectedOutputDigest) {
      fail(`${file} outputContentDigest does not match stable content.`);
    }
    if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
      fail(`${file} must keep production/release/final GO closed.`);
    }
  }

  const contract = dormitoryBenchmarkInheritanceGeneratedContracts.get("docs/contracts/generated/dormitory/scenario1-benchmark-inheritance-contract.generated.json");
  const startGate = dormitoryBenchmarkInheritanceGeneratedContracts.get("docs/contracts/generated/dormitory/subsequent-scenario-start-gate.generated.json");
  const difference = dormitoryBenchmarkInheritanceGeneratedContracts.get("docs/contracts/generated/dormitory/subsequent-scenario-difference-checklist-template.generated.json");
  const fieldReview = dormitoryBenchmarkInheritanceGeneratedContracts.get("docs/contracts/generated/dormitory/subsequent-scenario-field-review-template.generated.json");
  const buttonState = dormitoryBenchmarkInheritanceGeneratedContracts.get("docs/contracts/generated/dormitory/subsequent-scenario-button-state-template.generated.json");
  const scenario2Trial = dormitoryBenchmarkInheritanceGeneratedContracts.get("docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json");
  const mobileMirror = dormitoryBenchmarkInheritanceGeneratedContracts.get("apps/mobile/src/generated/oam/dormitory-scenario1-benchmark-inheritance.generated.json");
  const runtimeMirror = dormitoryBenchmarkInheritanceGeneratedContracts.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario1BenchmarkInheritance.generated.json");

  if (contract?.highestBusinessAuthorityId !== "Dormitory.Operating13ScenarioControl") fail("benchmark inheritance must keep 13 scenario control as highest authority.");
  if (!JSON.stringify(contract?.authorityHierarchy ?? {}).includes("场景 1 是实现方法标杆，不是后续场景的业务规则总源。")) {
    fail("benchmark inheritance must declare scenario 1 as method benchmark only.");
  }
  if (JSON.stringify(startGate?.gate?.appliesToScenarioNos ?? []) !== JSON.stringify([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])) {
    fail("subsequent scenario start gate must cover exactly scenarios 2-13.");
  }
  for (const object of ["Room", "BedSet", "Bed", "BasicReadiness"]) {
    if (!(difference?.forbiddenScenario1BusinessObjects ?? []).includes(object)) fail(`difference template must forbid copied ${object}.`);
    if ((scenario2Trial?.trial?.differenceChecklist?.objectDifference?.writes ?? []).includes(object)) fail(`scenario 2 trial must not write ${object}.`);
  }
  for (const internalId of ["roomId", "bedId", "ratePlanId", "quoteId", "reservationId", "stayId", "paymentId", "depositId", "refundId", "ledgerEntryId", "stableRef", "digest", "projectionVersion", "domainEventId"]) {
    if (!(fieldReview?.gate?.forbiddenUserInputFields ?? []).includes(internalId)) fail(`field review template must forbid ${internalId}.`);
  }
  if (!String(buttonState?.uxAndButtonGate?.entryRules?.search ?? "").includes("只读")) fail("benchmark search entry must be readonly.");
  if (scenario2Trial?.trialResult?.status !== "PASS") fail("scenario 2 start gate trial must PASS.");
  if (scenario2Trial?.trial?.highRiskBoundaries?.mustNotEnterPriceOrReservation !== true) fail("scenario 2 trial must forbid direct price/reservation.");
  if (mobileMirror?.consumer !== "surface") fail("benchmark mobile mirror must declare consumer=surface.");
  if (runtimeMirror?.consumer !== "runtime") fail("benchmark runtime mirror must declare consumer=runtime.");
}

function checkCapabilityCompilerOutputs() {
  const acceptedDigest = capabilityProjection.acceptedGeneratedBundleDigest;
  if (!/^sha256:[a-f0-9]{64}$/.test(String(acceptedDigest ?? ""))) {
    fail("capability projection must bind acceptedGeneratedBundleDigest.");
  }
  for (const [label, document] of [
    ["mobile surface model", mobileSurface],
    ["runtime projection", runtimeProjection],
    ["object identity", objectIdentity],
    ["bed cardinality", bedCardinality],
    ["business invariants", businessInvariants],
    ["command contracts", commandContracts],
    ["failure semantics", failureSemantics],
    ["rule source map", ruleSourceMap],
    ["db projection policy", dbProjectionPolicy],
    ["test plan", testPlan],
    ["capability evidence subject chain", subjectChain],
    ["capability digest chain", capabilityDigestChain]
  ]) {
    if (document.acceptedGeneratedBundleDigest !== acceptedDigest) {
      fail(`${label} acceptedGeneratedBundleDigest must match capability projection.`);
    }
  }
  const projectionTypes = (capabilityProjection.steps ?? []).map((item) => item.workItemType);
  if (JSON.stringify(projectionTypes) !== JSON.stringify(p0)) {
    fail(`capability projection steps must be exactly ${p0.join(" -> ")}.`);
  }
  const runtimeTypes = (runtimeProjection.steps ?? []).map((item) => item.workItemType);
  if (JSON.stringify(runtimeTypes) !== JSON.stringify(p0)) {
    fail(`runtime projection steps must be exactly ${p0.join(" -> ")}.`);
  }
  if (runtimeProjection.runtimeProjectionDigest !== capabilityDigestChain.runtimeProjectionDigest ||
    capabilityProjection.surfaceProjectionDigest !== capabilityDigestChain.surfaceProjectionDigest ||
    capabilityProjection.searchProjectionDigest !== capabilityDigestChain.searchProjectionDigest ||
    dbProjectionPolicy.outputContentDigest !== capabilityDigestChain.dbProjectionPolicyDigest) {
    fail("capability digest chain must bind runtime/surface/search/db projection digests.");
  }
  if (capabilityDigestChain.subjectChainRef !== "artifacts/oam/evidence/capability-evidence-subject-chain.json" ||
    capabilityDigestChain.subjectChainDigest !== subjectChain.outputContentDigest) {
    fail("capability digest chain must bind the capability evidence subject chain.");
  }
  if (subjectChain.objectIdentityGeneratedDigest !== objectIdentity.outputContentDigest ||
    subjectChain.bedCardinalityGeneratedDigest !== bedCardinality.outputContentDigest ||
    subjectChain.businessInvariantsGeneratedDigest !== businessInvariants.outputContentDigest ||
    subjectChain.commandContractsGeneratedDigest !== commandContracts.outputContentDigest ||
    subjectChain.failureSemanticsGeneratedDigest !== failureSemantics.outputContentDigest ||
    subjectChain.ruleSourceMapGeneratedDigest !== ruleSourceMap.outputContentDigest) {
    fail("capability evidence subject chain must bind all generated business contract digests.");
  }
  for (const field of [
    "capabilityDecisionDigest",
    "objectGraphDigest",
    "bedCardinalityDigest",
    "invariantAuthorityDigest",
    "commandContractDigest",
    "failureSemanticsDigest",
    "environmentProfileDigest",
    "positiveBrowserAuditDigest",
    "negativeBrowserAuditDigest",
    "noSideEffectsProofDigest",
    "dbProjectionProofDigest"
  ]) {
    if (!subjectChain[field]) fail(`capability evidence subject chain missing ${field}.`);
  }
  if (JSON.stringify(subjectChain).includes("evidenceRootDigest")) {
    fail("capability evidence subject chain must not contain evidenceRootDigest.");
  }
  if (JSON.stringify(subjectChain).includes("BUSINESS_LANDING_ADMITTED")) {
    fail("capability evidence subject chain must not contain BUSINESS_LANDING_ADMITTED.");
  }
  for (const [label, document] of [
    ["mobile surface model", mobileSurface],
    ["capability projection", capabilityProjection],
    ["runtime projection", runtimeProjection],
    ["db projection policy", dbProjectionPolicy],
    ["test plan", testPlan]
  ]) {
    checkGeneratedBusinessRuleRefs(label, document);
  }
  if (dbProjectionPolicy.policyMode !== "null_if_runtime_test_only" ||
    (dbProjectionPolicy.activeDbProjectionMappings ?? []).length !== 0) {
    fail("DB projection policy must remain null_if_runtime_test_only while business landing is pending.");
  }
  if (capabilityProjection.productionConfirmAllowed !== false ||
    capabilityProjection.releaseAuthority !== false ||
    capabilityProjection.finalGoNoGo !== "NO_GO") {
    fail("capability projection must keep production/release/final GO closed.");
  }
}

function checkGeneratedBusinessRuleRefs(label, document) {
  const refs = document.generatedBusinessRuleRefs;
  if (!refs) {
    fail(`${label} must carry generatedBusinessRuleRefs.`);
    return;
  }
  const requiredRefs = [
    ["objectIdentity", "docs/contracts/generated/dormitory/object-identity.generated.json", objectIdentity],
    ["bedCardinality", "docs/contracts/generated/dormitory/bed-cardinality.generated.json", bedCardinality],
    ["businessInvariants", "docs/contracts/generated/dormitory/business-invariants.generated.json", businessInvariants],
    ["commandContracts", "docs/contracts/generated/dormitory/command-contracts.generated.json", commandContracts],
    ["failureSemantics", "docs/contracts/generated/dormitory/failure-semantics.generated.json", failureSemantics],
    ["ruleSourceMap", "docs/contracts/generated/dormitory/rule-source-map.generated.json", ruleSourceMap]
  ];
  for (const [key, expectedRef, generatedDocument] of requiredRefs) {
    if (refs[key]?.ref !== expectedRef) fail(`${label} generatedBusinessRuleRefs.${key}.ref must be ${expectedRef}.`);
    if (refs[key]?.digest !== generatedDocument.outputContentDigest) fail(`${label} generatedBusinessRuleRefs.${key}.digest must bind generated output.`);
    if (!Array.isArray(refs[key]?.ruleIds) || refs[key].ruleIds.length === 0) fail(`${label} generatedBusinessRuleRefs.${key}.ruleIds must not be empty.`);
  }
}

function checkMobileSurfaceCompilerProjection() {
  if (mobileSurface.sourceContentDigest !== surface.outputContentDigest) {
    fail("mobile generated surface input model must bind sourceContentDigest to generated surface contract outputContentDigest.");
  }
  if (mobileSurface.surfaceOnlyConsumesGeneratedSurfaceModel !== true) {
    fail("mobile generated surface input model must declare surfaceOnlyConsumesGeneratedSurfaceModel=true.");
  }
  const sourceKeys = new Set((surface.controls ?? []).map((control) => `${control.workItemType}:${control.fieldId}`));
  const mobileKeys = new Set((mobileSurface.controls ?? []).map((control) => `${control.workItemType}:${control.fieldId}`));
  for (const key of sourceKeys) {
    if (!mobileKeys.has(key)) fail(`mobile generated surface input model missing source control ${key}.`);
  }
  for (const key of [
    "Dorm.RoomSetupConfirm:roomId",
    "Dorm.BedSetupConfirm:bedId",
    "Dorm.ResourceReadinessConfirm:bedId"
  ]) {
    if (!mobileKeys.has(key)) fail(`mobile generated surface input model missing capability compiler control ${key}.`);
  }
}

function checkGeneratedFieldBindingClosure() {
  if (fieldBindingClosure.status !== "PASS") {
    fail(`generated field binding closure source model must PASS, actual ${fieldBindingClosure.status}.`);
  }
  if (fieldBindingClosureResult.status !== "PASS" ||
    fieldBindingClosureResult.generatedFieldBindingClosureStatus !== "PASS") {
    fail("generated field binding closure result must PASS before generated contract consistency can PASS.");
  }
  if (fieldBindingClosureResult.closureDigest !== fieldBindingClosure.closureDigest ||
    fieldBindingClosureResult.sourceFieldGapsDecisionDigest !== fieldBindingClosure.sourceFieldGapsDecisionDigest) {
    fail("generated field binding closure result digests must match shared closure model.");
  }
  if (fieldBindings.canonicalClosureVersion !== fieldBindingClosure.canonicalClosureVersion ||
    fieldBindings.generatedFieldBindingClosureDigest !== fieldBindingClosure.closureDigest ||
    fieldBindings.sourceFieldGapsDecisionDigest !== fieldBindingClosure.sourceFieldGapsDecisionDigest) {
    fail("field-bindings.generated.json must bind the shared generated field binding closure.");
  }
  const bindingIds = new Set((fieldBindings.fieldBindings ?? []).map((item) => item.fieldId));
  for (const spec of REQUIRED_GENERATED_FIELD_BINDINGS) {
    if (!bindingIds.has(spec.fieldId)) fail(`field-bindings.generated.json missing ${spec.fieldId}.`);
  }
}

function writeReport() {
  const report = {
    version: "oam.generated-contract-consistency-result.v1",
    checkedAtUtc: new Date().toISOString(),
    status: failures.length === 0 ? "passed" : "failed",
    requiredGeneratedFiles: requiredGeneratedFiles.map((file) => ({
      path: file,
      present: exists(file)
    })),
    p0GeneratedCandidateTypes: p0,
    generatedWorkItemTypes: failures.length === 0 ? generatedTypes : [],
    failures,
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    runtimeConsumptionReady: false
  };
  fs.mkdirSync(path.dirname(path.join(root, reportPath)), { recursive: true });
  fs.writeFileSync(path.join(root, reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function stableDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
