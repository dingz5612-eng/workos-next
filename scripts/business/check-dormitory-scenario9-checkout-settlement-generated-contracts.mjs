import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario9-checkout-settlement-contracts.mjs";
const generatedFiles = [
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));
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
const expectedFailures = [
  "no_effective_stay",
  "stay_already_checked_out",
  "current_occupancy_required",
  "high_risk_incident_blocks_normal_checkout",
  "actual_checkout_time_required",
  "proxy_or_abnormal_handover_evidence_required",
  "credential_return_required",
  "inspection_evidence_required",
  "damage_description_evidence_required",
  "fee_source_invalid",
  "final_ledger_truth_manual_input_forbidden",
  "customer_confirmation_required",
  "disputed_settlement_requires_review",
  "finance_gate_required_for_refund_or_topup",
  "resource_operational_direct_restore_forbidden",
  "direct_payment_refund_ledger_forbidden",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "duplicate_checkout_submission",
  "concurrent_checkout_conflict",
  "confirmed_checkout_inline_edit_forbidden",
  "unauthorized_checkout_action"
];
const expectedReadOutputs = [
  "退房确认摘要",
  "费用核算摘要",
  "押金抵扣摘要",
  "应退/应补意向",
  "客户确认摘要",
  "财务处理请求",
  "资源待恢复请求",
  "证据摘要",
  "只读对象引用"
];
const forbiddenInternalFields = [
  "stayId",
  "checkoutCaseId",
  "settlementId",
  "refundId",
  "ledgerEntryId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId",
  "paymentId",
  "ledgerTransactionId"
];

for (const [file, document] of documents) {
  if (!document) {
    failures.push(`missing generated file: ${file}`);
    continue;
  }
  if (document.generated !== true || document.doNotEdit !== true) failures.push(`${file} must be generated/doNotEdit.`);
  if (document.generatedBy !== generatedBy) failures.push(`${file} generatedBy mismatch.`);
  if (!Array.isArray(document.generatedFrom) ||
    document.generatedFrom[0] !== scenarioPath ||
    document.generatedFrom[1] !== packageIndexPath) failures.push(`${file} generatedFrom mismatch.`);
  if (document.sourceContentDigest !== scenarioDigest) failures.push(`${file} source digest mismatch.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) failures.push(`${file} package index digest mismatch.`);
  if (!isSha256Digest(document.outputContentDigest) || document.outputContentDigest !== digestGenerated(document)) {
    failures.push(`${file} outputContentDigest mismatch.`);
  }
  if (document.authorityId !== "Dormitory.Scenario9.CheckoutSettlement" ||
    document.scenarioPackageNo !== 9 ||
    document.nameZh !== "退房结算") {
    failures.push(`${file} scenario identity mismatch.`);
  }
  if (document.productionConfirmAllowed !== false ||
    document.releaseAuthority !== false ||
    document.finalGoNoGo !== "NO_GO") {
    failures.push(`${file} must keep NO_GO flags.`);
  }
}

const canonical = documents.get(generatedFiles[0]) ?? {};
const objectState = documents.get(generatedFiles[1]) ?? {};
const stepsFields = documents.get(generatedFiles[2]) ?? {};
const crudPolicy = documents.get(generatedFiles[3]) ?? {};
const runtimeRules = documents.get(generatedFiles[4]) ?? {};
const surfaceNavigation = documents.get(generatedFiles[5]) ?? {};
const handoff = documents.get(generatedFiles[6]) ?? {};
const financeGate = documents.get(generatedFiles[8]) ?? {};
const mobileMirror = documents.get(generatedFiles[9]) ?? {};
const runtimeMirror = documents.get(generatedFiles[10]) ?? {};

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [7, 8, 6]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  !JSON.stringify(canonical.downstream ?? {}).includes("finance-gate") ||
  !JSON.stringify(canonical.downstream ?? {}).includes("房源运营就绪与状态维护")) {
  failures.push("canonical upstream/downstream boundary mismatch.");
}
if (!arraysContainAll(canonical.objects, expectedObjects)) failures.push("canonical missing scenario 9 object set.");
const stateText = JSON.stringify(objectState.stateLayering ?? {});
for (const required of ["已退房不等于已退款", "已退房不等于房源可运营", "结算意向不等于账务真值", "资源待保洁", "finance-gate"]) {
  if (!stateText.includes(required)) failures.push(`object state layering missing ${required}.`);
}
if ((stepsFields.steps ?? []).length !== 7 ||
  !JSON.stringify(stepsFields.fields ?? {}).includes("checkoutCaseRef") ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, forbiddenInternalFields)) {
  failures.push("steps/fields generated contract missing required checkout field boundary.");
}
if (crudPolicy.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false ||
  crudPolicy.crudRules?.confirmedCheckoutInlineEditAllowed !== false) {
  failures.push("crud policy must keep readonly surfaces and confirmed checkout inline edit closed.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), expectedCommands)) {
  failures.push("runtime rules command list mismatch.");
}
for (const code of expectedFailures) {
  const failure = (runtimeRules.failureSemantics ?? []).find((item) => item.failureCode === code);
  if (!failure || failure.sideEffectsAllowed !== false) failures.push(`runtime rules missing no-side-effect failure ${code}.`);
}
const rule = runtimeRules.checkoutInvariantRule ?? {};
for (const key of ["validStayRequired", "currentOccupancyRequired", "actualCheckoutAtRequired", "handoverRequired", "credentialReturnRequired", "inspectionEvidenceRequired", "damageRequiresDescriptionAndEvidence", "feeSourcesAuthoritative", "customerConfirmationRequired", "disputedSettlementRequiresReview", "checkoutDoesNotMeanRefunded", "checkoutDoesNotMakeResourceOperational", "financeGateHandlesRefundTopUpLedger", "resourceRecoveryViaScenario2Only", "failureNoSideEffects"]) {
  if (rule[key] !== true) failures.push(`runtime rules invariant ${key} must be true.`);
}
const boundary = runtimeRules.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.businessRuntimeMayWritePaymentRefund !== false ||
  boundary.businessRuntimeMayRestoreOperationalStatus !== false ||
  boundary.financeGateMayConsumeSettlementIntentOnly !== true ||
  boundary.successMayWriteCheckoutFactsAndRequestsOnly !== true) {
  failures.push("runtime consumption boundary mismatch.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已退款", "已入账", "房源已可运营", "final GO", "生产发布", "CheckoutSettlementApprove", "RefundApprove", "RoomInspectionConfirm"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, expectedReadOutputs) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("场景包 2")) {
  failures.push("handoff output or downstream recheck mismatch.");
}
if ((handoff.readSideOutputs ?? []).some((item) => ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "RoomOperationStatus=可运营", "已退款", "已入账", "房源已可运营"].includes(item))) {
  failures.push("handoff read side outputs must not include finance truth, ledger facts, or operational restore.");
}
if (financeGate.consumer !== "finance-gate" ||
  financeGate.settlementIntentOnly !== true ||
  financeGate.businessRuntimeMayWriteLedger !== false ||
  financeGate.businessRuntimeMayWritePaymentRefund !== false ||
  !JSON.stringify(financeGate.allowedInputs ?? []).includes("应退/应补意向")) {
  failures.push("finance-gate generated contract must consume settlement intent only and forbid business runtime finance truth writes.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayRestoreOperationalStatus !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario9-checkout-settlement-generated-contracts-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedFileCount: generatedFiles.length,
  generatedFiles: generatedFiles.map((file) => ({
    path: file,
    outputContentDigest: documents.get(file)?.outputContentDigest ?? null
  })),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 9 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 9 generated contracts check: PASS (${generatedFiles.length} files)`);

function digestGenerated(document) {
  return digestObject({ ...document, outputContentDigest: "sha256:pending" });
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function arraysEqual(actual = [], expected = []) {
  const left = actual ?? [];
  return left.length === expected.length && expected.every((item, index) => left[index] === item);
}

function arraysContainAll(actual = [], expected = []) {
  const values = new Set(actual ?? []);
  return expected.every((item) => values.has(item));
}
