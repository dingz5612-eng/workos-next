import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workos-generated-check-"));
const reportPath = "artifacts/oam/checks/generated-files-not-manually-edited-result.json";
const scope = process.env.OAM_GENERATED_MANUAL_EDIT_SCOPE === "generated_contract_candidate_only"
  ? "generated_contract_candidate_only"
  : "full_runtime_consumption_generated";
const runtimeConsumptionGeneratedFiles = new Set([
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  "apps/mobile/src/generated/oam/capability-projection.generated.json",
  "apps/mobile/src/generated/oam/business-display-language.generated.js",
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
  "artifacts/oam/evidence/capability-digest-chain.json"
]);
const allGeneratedFiles = [
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/field-bindings.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  "apps/mobile/src/generated/oam/capability-projection.generated.json",
  "apps/mobile/src/generated/oam/business-display-language.generated.js",
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json",
  "docs/contracts/generated/dormitory/object-identity.generated.json",
  "docs/contracts/generated/dormitory/bed-cardinality.generated.json",
  "docs/contracts/generated/dormitory/business-invariants.generated.json",
  "docs/contracts/generated/dormitory/command-contracts.generated.json",
  "docs/contracts/generated/dormitory/failure-semantics.generated.json",
  "docs/contracts/generated/dormitory/rule-source-map.generated.json",
  "docs/contracts/generated/dormitory/db-projection-policy.generated.json",
  "docs/contracts/generated/dormitory/test-plan.generated.json",
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
  "docs/contracts/generated/dormitory/13-scenario-test-plan.generated.json",
  "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json",
  "docs/contracts/generated/dormitory/scenario1-object-model.generated.json",
  "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario1-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario1-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json",
  "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json",
  "docs/contracts/generated/dormitory/scenario2-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario2-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario2-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json",
  "docs/contracts/generated/dormitory/scenario3-product-and-pricing.generated.json",
  "docs/contracts/generated/dormitory/scenario3-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario3-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario3-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario3-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario3-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario3-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario3-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario3-product-and-pricing.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario3ProductAndPricing.generated.json",
  "docs/contracts/generated/dormitory/scenario4-inquiry-and-quote.generated.json",
  "docs/contracts/generated/dormitory/scenario4-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario4-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario4-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario4-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario4-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario4-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario4-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario4-inquiry-and-quote.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario4InquiryAndQuote.generated.json",
  "docs/contracts/generated/dormitory/scenario5-reservation-and-inventory-hold.generated.json",
  "docs/contracts/generated/dormitory/scenario5-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario5-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario5-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario5-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario5-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario5-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario5-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario5-reservation-and-inventory-hold.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario5ReservationAndInventoryHold.generated.json",
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
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario6PaymentDepositAndGuarantee.generated.json",
  "docs/contracts/generated/dormitory/scenario7-check-in-processing.generated.json",
  "docs/contracts/generated/dormitory/scenario7-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario7-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario7-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario7-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario7-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario7-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario7-check-in-processing.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario7CheckInProcessing.generated.json",
  "docs/contracts/generated/dormitory/scenario8-in-stay-management.generated.json",
  "docs/contracts/generated/dormitory/scenario8-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario8-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario8-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario8-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario8-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario8-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario8-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario8-in-stay-management.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario8InStayManagement.generated.json",
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
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario9CheckoutSettlement.generated.json",
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
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario10CancelNoShowRefund.generated.json",
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
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json",
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
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario12ChannelCorporateCustomer.generated.json",
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
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario13ReportingAuditReview.generated.json",
  "docs/contracts/generated/dormitory/scenario1-benchmark-inheritance-contract.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-start-gate.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-difference-checklist-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-field-review-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-button-state-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-screenshot-report-template.generated.json",
  "docs/contracts/generated/dormitory/subsequent-scenario-failure-attribution-routing.generated.json",
  "docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-benchmark-inheritance.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1BenchmarkInheritance.generated.json",
  "artifacts/oam/evidence/capability-evidence-subject-chain.json",
  "artifacts/oam/evidence/capability-digest-chain.json"
];
const generatedFiles = scope === "generated_contract_candidate_only"
  ? allGeneratedFiles.filter((file) => !runtimeConsumptionGeneratedFiles.has(file))
  : allGeneratedFiles;
const failures = [];

try {
  execFileSync(process.execPath, ["scripts/oam/compile-current-kernel-graph.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_KERNEL_COMPILE_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  if (scope !== "generated_contract_candidate_only") {
    execFileSync(process.execPath, ["scripts/oam/compile-current-capability.mjs"], {
      cwd: root,
      env: { ...process.env, WORKOS_CAPABILITY_COMPILE_OUTPUT_ROOT: tempRoot },
      stdio: "pipe"
    });
  }
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-13-scenario-control-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_13_CONTROL_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario1-resource-basic-readiness-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO1_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario2-resource-operation-status-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO2_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario3-product-and-pricing-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO3_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario4-inquiry-and-quote-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO4_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario5-reservation-and-inventory-hold-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO5_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario6-payment-deposit-and-guarantee-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO6_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario7-check-in-processing-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO7_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario8-in-stay-management-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO8_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario9-checkout-settlement-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO9_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario10-cancel-noshow-refund-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO10_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario11-housekeeping-maintenance-outofservice-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO11_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario12-channel-corporate-customer-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO12_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario13-reporting-audit-review-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_SCENARIO13_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });
  execFileSync(process.execPath, ["scripts/business/generate-dormitory-scenario1-benchmark-inheritance-contracts.mjs"], {
    cwd: root,
    env: { ...process.env, WORKOS_DORMITORY_BENCHMARK_INHERITANCE_OUTPUT_ROOT: tempRoot },
    stdio: "pipe"
  });

  for (const file of generatedFiles) {
    const actualPath = path.join(root, file);
    const expectedPath = path.join(tempRoot, file);
    if (!fs.existsSync(actualPath)) {
      failures.push(`${file} is missing.`);
      continue;
    }
    if (!fs.existsSync(expectedPath)) {
      failures.push(`${file} was not produced by compiler.`);
      continue;
    }
    const actual = fs.readFileSync(actualPath, "utf8").replace(/\r\n/g, "\n");
    const expected = fs.readFileSync(expectedPath, "utf8").replace(/\r\n/g, "\n");
    if (actual !== expected) {
      failures.push(`${file} differs from compiler output; regenerate instead of editing generated files manually.`);
    }
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

writeReport();

if (failures.length > 0) {
  console.error("Generated files manual edit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated files manual edit check: PASS");

function writeReport() {
  const report = {
    version: "oam.generated-files-not-manually-edited-result.v1",
    checkedAtUtc: new Date().toISOString(),
    status: failures.length === 0 ? "passed" : "failed",
    scope,
    runtimeConsumptionGeneratedFilesExcluded: scope === "generated_contract_candidate_only",
    generatedFileCount: generatedFiles.length,
    failures,
    generatedFiles: generatedFiles.map((file) => ({
      path: file,
      present: fs.existsSync(path.join(root, file)),
      doNotEditVerifiedBy: "scripts/oam/check-generated-files-not-manually-edited.mjs"
    })),
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    runtimeConsumptionReady: false
  };
  fs.mkdirSync(path.dirname(path.join(root, reportPath)), { recursive: true });
  fs.writeFileSync(path.join(root, reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
