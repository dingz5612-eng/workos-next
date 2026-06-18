import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario7-check-in-processing-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario7-check-in-processing-contracts.mjs";
const generatedFiles = [
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));
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
const expectedFailures = [
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
  if (document.authorityId !== "Dormitory.Scenario7.CheckInProcessing" ||
    document.scenarioPackageNo !== 7 ||
    document.nameZh !== "入住办理") {
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
const runtimeRules = documents.get(generatedFiles[4]) ?? {};
const surfaceNavigation = documents.get(generatedFiles[5]) ?? {};
const handoff = documents.get(generatedFiles[6]) ?? {};
const mobileMirror = documents.get(generatedFiles[8]) ?? {};
const runtimeMirror = documents.get(generatedFiles[9]) ?? {};

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [5, 6, 2, 3]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  canonical.downstream?.allowedConsumerPackageNo !== 8) {
  failures.push("canonical upstream/downstream boundary mismatch.");
}
if (!arraysContainAll(canonical.objects, expectedObjects)) failures.push("canonical missing scenario 7 object set.");
const stateText = JSON.stringify(objectState.stateLayering ?? {});
for (const required of ["已预订", "财务已确认", "可办理入住", "已入住", "在住服务", "退房", "已结清", "押金可退", "房源恢复"]) {
  if (!stateText.includes(required)) failures.push(`object state layering missing ${required}.`);
}
if ((stepsFields.steps ?? []).length !== 6 ||
  !JSON.stringify(stepsFields.fields ?? {}).includes("stayNo") ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, ["stayId", "residentId", "reservationId", "credentialId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
  failures.push("steps/fields generated contract missing required check-in field boundary.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), expectedCommands)) {
  failures.push("runtime rules command list mismatch.");
}
for (const code of expectedFailures) {
  const failure = (runtimeRules.failureSemantics ?? []).find((item) => item.failureCode === code);
  if (!failure || failure.sideEffectsAllowed !== false) failures.push(`runtime rules missing no-side-effect failure ${code}.`);
}
const rule = runtimeRules.checkInInvariantRule ?? {};
for (const key of ["validReservationRequired", "resourceAvailableForCheckInRequired", "identityVerificationRequired", "agreementConfirmationRequired", "financeReadinessOrManagerExceptionRequired", "stayNoSystemGenerated", "confirmedStayStartsOccupancy", "reservationConvertedToStayOnSuccess", "credentialRequiresSuccessfulStay", "failureNoSideEffects"]) {
  if (rule[key] !== true) failures.push(`runtime rules invariant ${key} must be true.`);
}
const boundary = runtimeRules.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
  boundary.businessRuntimeMayWriteCheckout !== false ||
  boundary.successMayWriteStayOccupancyCredentialOnly !== true) {
  failures.push("runtime consumption boundary mismatch.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已退房", "已退款", "押金已退", "final GO", "生产发布", "CheckinConfirm", "reservationConvert", "AccessCredentialIssue"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, ["入住记录摘要", "住客摘要", "房间/床位占用摘要", "入住凭证摘要", "协议摘要", "身份核验摘要", "证据摘要", "只读对象引用"]) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("不得要求用户重新填写已确认入住字段")) {
  failures.push("handoff output or downstream recheck mismatch.");
}
if ((handoff.readSideOutputs ?? []).some((item) => ["Payment", "Deposit", "Refund", "CheckoutCase", "LedgerEntry", "LedgerTransaction", "收款", "押金变更", "退款", "退房结算"].includes(item))) {
  failures.push("handoff read side outputs must not include finance/refund/checkout/ledger facts.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario7-check-in-processing-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 7 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 7 generated contracts check: PASS (${generatedFiles.length} files)`);

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
