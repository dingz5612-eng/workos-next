import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario12-channel-corporate-customer-contracts.mjs";
const generatedFiles = [
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));
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
const expectedFailures = [
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
const forbiddenInternalFields = [
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
  if (document.authorityId !== "Dormitory.Scenario12.ChannelCorporateCustomer" ||
    document.scenarioPackageNo !== 12 ||
    document.nameZh !== "渠道与企业客户") {
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

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [2, 3]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  !JSON.stringify(canonical.downstream ?? {}).includes("场景包 4") ||
  !JSON.stringify(canonical.downstream ?? {}).includes("场景包 5") ||
  !JSON.stringify(canonical.downstream ?? {}).includes("finance-gate")) {
  failures.push("canonical upstream/downstream boundary mismatch.");
}
if (!arraysContainAll(canonical.objects, expectedObjects)) failures.push("canonical missing scenario 12 object set.");
const stateText = JSON.stringify(objectState.stateLayering ?? {});
for (const required of ["商品和价格金额真值来自场景包 3", "报价来自场景包 4", "预订和库存锁定来自场景包 5", "财务真值来自 finance-gate", "维修/停售资源不得发布为可用"]) {
  if (!stateText.includes(required)) failures.push(`object state layering missing ${required}.`);
}
if ((stepsFields.steps ?? []).length !== 7 ||
  !JSON.stringify(stepsFields.fields ?? {}).includes("agreementRef") ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, forbiddenInternalFields)) {
  failures.push("steps/fields generated contract missing required channel/corporate field boundary.");
}
if (crudPolicy.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false ||
  crudPolicy.crudRules?.confirmedInlineEditAllowed !== false ||
  crudPolicy.crudRules?.physicalDeleteConfirmedFactAllowed !== false) {
  failures.push("crud policy must keep readonly surfaces, inline edit, and physical delete closed.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), expectedCommands)) {
  failures.push("runtime rules command list mismatch.");
}
for (const code of expectedFailures) {
  const failure = (runtimeRules.failureSemantics ?? []).find((item) => item.failureCode === code);
  if (!failure || failure.sideEffectsAllowed !== false) failures.push(`runtime rules missing no-side-effect failure ${code}.`);
}
const rule = runtimeRules.channelCorporateInvariantRule ?? {};
for (const key of ["businessProfileRequired", "keyEvidenceRequiredBeforeEnable", "agreementDateRangeValid", "agreementApprovalRequiredBeforeEffective", "expiredAgreementCannotBeEligible", "productPriceReferenceFromScenario3Only", "effectivePriceRequiredForPublication", "operationBlockPreventsPublication", "channelPublicationDoesNotLockInventory", "quoteOwnedByScenario4", "reservationInventoryOwnedByScenario5", "financeGateHandlesCommissionSettlementTruth", "appendOnlyVersionHistory", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
  if (rule[key] !== true) failures.push(`runtime rules invariant ${key} must be true.`);
}
const boundary = runtimeRules.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteRatePlanTruth !== false ||
  boundary.businessRuntimeMayWriteQuote !== false ||
  boundary.businessRuntimeMayWriteReservation !== false ||
  boundary.businessRuntimeMayWriteInventoryHold !== false ||
  boundary.businessRuntimeMayWritePaymentRefund !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.financeGateMayConsumeCommissionSettlementIntentOnly !== true ||
  boundary.scenario4MayConsumeEligibilityOnly !== true ||
  boundary.scenario5MayConsumeEligibilityOnly !== true ||
  boundary.successMayWriteChannelCorporateFactsAndIntentsOnly !== true) {
  failures.push("runtime consumption boundary mismatch.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已报价", "已预订", "已收款", "已入账", "final GO", "生产发布", "业务上线", "lead-reservation", "RatePlan", "PaymentConfirm", "channel/OTA 临时字段"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, ["渠道摘要", "企业客户摘要", "协议摘要", "适用商品/价格资格摘要", "渠道发布规则摘要", "佣金/结算规则意向", "证据摘要", "只读对象引用"]) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("场景包 4") ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("场景包 5") ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
  failures.push("handoff output or downstream recheck mismatch.");
}
if ((handoff.readSideOutputs ?? []).some((item) => ["RatePlan 金额真值", "Quote", "Reservation", "InventoryHold", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已报价", "已预订", "已收款", "已入账"].includes(item))) {
  failures.push("handoff read side outputs must not include price truth, quote, reservation, inventory hold, finance truth, or ledger facts.");
}
if (financeGate.consumer !== "finance-gate" ||
  financeGate.commissionSettlementIntentOnly !== true ||
  financeGate.businessRuntimeMayWriteLedger !== false ||
  financeGate.businessRuntimeMayWritePaymentRefund !== false ||
  !JSON.stringify(financeGate.allowedInputs ?? []).includes("佣金/结算规则意向")) {
  failures.push("finance-gate generated contract must consume commission/settlement intent only and forbid business runtime finance truth writes.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteRatePlanTruth !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario12-channel-corporate-customer-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 12 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 12 generated contracts check: PASS (${generatedFiles.length} files)`);

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
