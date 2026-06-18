import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario10-cancel-noshow-refund-contracts.mjs";
const generatedFiles = [
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));
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
const expectedFailures = [
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
const expectedReadOutputs = [
  "取消/未到店关闭摘要",
  "政策计算摘要",
  "退款/扣费申请",
  "库存释放请求",
  "客户确认摘要",
  "财务处理请求",
  "证据摘要",
  "只读对象引用"
];
const forbiddenInternalFields = [
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
  if (document.authorityId !== "Dormitory.Scenario10.CancelNoShowRefund" ||
    document.scenarioPackageNo !== 10 ||
    document.nameZh !== "取消、未到店与退款处理") {
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

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [5, 6, 7, 9]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  !JSON.stringify(canonical.downstream ?? {}).includes("finance-gate") ||
  !JSON.stringify(canonical.downstream ?? {}).includes("inventory-reservation-read-model")) {
  failures.push("canonical upstream/downstream boundary mismatch.");
}
if (!arraysContainAll(canonical.objects, expectedObjects)) failures.push("canonical missing scenario 10 object set.");
const stateText = JSON.stringify(objectState.stateLayering ?? {});
for (const required of ["已取消不等于已退款", "未到店关闭不等于已退款", "退款申请不等于退款到账", "扣费申请不等于扣费入账", "finance-gate"]) {
  if (!stateText.includes(required)) failures.push(`object state layering missing ${required}.`);
}
if ((stepsFields.steps ?? []).length !== 7 ||
  !JSON.stringify(stepsFields.fields ?? {}).includes("cancellationCaseRef") ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, forbiddenInternalFields)) {
  failures.push("steps/fields generated contract missing required cancellation field boundary.");
}
if (crudPolicy.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false ||
  crudPolicy.crudRules?.confirmedClosureInlineEditAllowed !== false) {
  failures.push("crud policy must keep readonly surfaces and confirmed closure inline edit closed.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), expectedCommands)) {
  failures.push("runtime rules command list mismatch.");
}
for (const code of expectedFailures) {
  const failure = (runtimeRules.failureSemantics ?? []).find((item) => item.failureCode === code);
  if (!failure || failure.sideEffectsAllowed !== false) failures.push(`runtime rules missing no-side-effect failure ${code}.`);
}
const rule = runtimeRules.cancelNoShowInvariantRule ?? {};
for (const key of ["validReservationRequired", "paymentDepositSnapshotRequiredForRefund", "settlementIntentRequiredForCheckoutRefund", "alreadyCheckedInBlocksOrdinaryCancellation", "alreadyCheckedOutBlocksOrdinaryCancellation", "alreadyCancelledBlocksDuplicateCancellation", "noShowRequiresHoldTimeElapsed", "noShowRequiresNoEffectiveCheckin", "customerConfirmationRequired", "disputeRequiresReview", "amountSourcesAuthoritative", "finalFinanceTruthManualInputForbidden", "inventoryReleaseScopeBoundToReservation", "financeGateHandlesRefundFeeLedger", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
  if (rule[key] !== true) failures.push(`runtime rules invariant ${key} must be true.`);
}
const boundary = runtimeRules.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.businessRuntimeMayWritePaymentRefund !== false ||
  boundary.businessRuntimeMayWriteStayCheckout !== false ||
  boundary.businessRuntimeMayRestoreOperationalStatus !== false ||
  boundary.financeGateMayConsumeRefundFeeIntentOnly !== true ||
  boundary.inventoryReadModelMayConsumeReleaseRequestOnly !== true ||
  boundary.successMayWriteCancellationNoShowFactsAndRequestsOnly !== true) {
  failures.push("runtime consumption boundary mismatch.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已退款到账", "已入账", "已入住", "已退房", "final GO", "生产发布", "reservationCancel", "reservationNoShow", "RefundApprove", "CheckoutSettlementApprove"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, expectedReadOutputs) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("库存/预订读模型")) {
  failures.push("handoff output or downstream recheck mismatch.");
}
if ((handoff.readSideOutputs ?? []).some((item) => ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "Stay", "CheckoutCase", "RoomOperationStatus=可运营", "已退款到账", "已入账", "已入住", "已退房"].includes(item))) {
  failures.push("handoff read side outputs must not include finance truth, ledger facts, stay/checkout facts, or operational restore.");
}
if (financeGate.consumer !== "finance-gate" ||
  financeGate.refundFeeIntentOnly !== true ||
  financeGate.businessRuntimeMayWriteLedger !== false ||
  financeGate.businessRuntimeMayWritePaymentRefund !== false ||
  !JSON.stringify(financeGate.allowedInputs ?? []).includes("退款/扣费申请")) {
  failures.push("finance-gate generated contract must consume refund/fee intent only and forbid business runtime finance truth writes.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteStayCheckout !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario10-cancel-noshow-refund-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 10 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 10 generated contracts check: PASS (${generatedFiles.length} files)`);

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
