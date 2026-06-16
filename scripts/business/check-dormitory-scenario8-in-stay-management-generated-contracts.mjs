import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario8-in-stay-management-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario8-in-stay-management-contracts.mjs";
const generatedFiles = [
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));
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
const expectedFailures = [
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
const expectedReadOutputs = [
  "在住状态摘要",
  "当前占用摘要",
  "服务请求摘要",
  "异常摘要",
  "续住/换房换床结果",
  "凭证状态",
  "退房准备摘要",
  "证据摘要",
  "只读对象引用"
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
  if (document.authorityId !== "Dormitory.Scenario8.InStayManagement" ||
    document.scenarioPackageNo !== 8 ||
    document.nameZh !== "在住管理") {
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
const mobileMirror = documents.get(generatedFiles[8]) ?? {};
const runtimeMirror = documents.get(generatedFiles[9]) ?? {};

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [7, 6, 2, 3]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  canonical.downstream?.allowedConsumerPackageNo !== 9) {
  failures.push("canonical upstream/downstream boundary mismatch.");
}
if (!arraysContainAll(canonical.objects, expectedObjects)) failures.push("canonical missing scenario 8 object set.");
const stateText = JSON.stringify(objectState.stateLayering ?? {});
for (const required of ["已入住", "正常在住", "退房待准备", "可退房", "已结清", "已退房", "重新入住"]) {
  if (!stateText.includes(required)) failures.push(`object state layering missing ${required}.`);
}
if ((stepsFields.steps ?? []).length !== 8 ||
  !JSON.stringify(stepsFields.fields ?? {}).includes("stayManagementCaseRef") ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, ["stayId", "occupancyId", "credentialId", "serviceRequestId", "incidentId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
  failures.push("steps/fields generated contract missing required in-stay field boundary.");
}
if (crudPolicy.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false ||
  crudPolicy.crudRules?.confirmedInStayFactInlineEditAllowed !== false) {
  failures.push("crud policy must keep readonly surfaces and confirmed fact inline edit closed.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), expectedCommands)) {
  failures.push("runtime rules command list mismatch.");
}
for (const code of expectedFailures) {
  const failure = (runtimeRules.failureSemantics ?? []).find((item) => item.failureCode === code);
  if (!failure || failure.sideEffectsAllowed !== false) failures.push(`runtime rules missing no-side-effect failure ${code}.`);
}
const rule = runtimeRules.inStayInvariantRule ?? {};
for (const key of ["effectiveStayRequired", "currentOccupancyRequired", "singleActiveOccupancyPerBedAtSameTime", "transferAppendOnlyOccupancyChanged", "transferReleasesOldAndBindsNewOnSuccess", "extensionDateMustBeLaterThanCurrentCheckout", "extensionFinanceHandledByFinanceGateOnly", "credentialRequiresEffectiveStayAndOccupancy", "checkoutPreparationNotCheckoutSettlement", "failureNoSideEffects"]) {
  if (rule[key] !== true) failures.push(`runtime rules invariant ${key} must be true.`);
}
const boundary = runtimeRules.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
  boundary.businessRuntimeMayWriteCheckoutSettlement !== false ||
  boundary.businessRuntimeMayReleaseRoom !== false ||
  boundary.successMayWriteInStayFactsOnly !== true) {
  failures.push("runtime consumption boundary mismatch.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已退房", "已退款", "已释放房源", "final GO", "生产发布", "StayLifecycle", "bed-transfer-extend", "service-task", "AccessCredentialIssue", "AccessCredentialRevoke"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, expectedReadOutputs) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("不得要求用户重新填写已确认入住字段")) {
  failures.push("handoff output or downstream recheck mismatch.");
}
if ((handoff.readSideOutputs ?? []).some((item) => ["Payment", "Deposit", "Refund", "CheckoutCase", "CheckoutSettlement", "LedgerEntry", "LedgerTransaction", "RoomRelease", "收款", "押金确认", "退款", "退房结算", "房源释放"].includes(item))) {
  failures.push("handoff read side outputs must not include finance/refund/checkout/release/ledger facts.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario8-in-stay-management-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 8 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 8 generated contracts check: PASS (${generatedFiles.length} files)`);

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
