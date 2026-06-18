import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario11-housekeeping-maintenance-outofservice-contracts.mjs";
const generatedFiles = [
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));
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
const expectedFailures = [
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
const forbiddenInternalFields = [
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
  if (document.authorityId !== "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService" ||
    document.scenarioPackageNo !== 11 ||
    document.nameZh !== "房务、维修与停售协同") {
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

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [2, 8, 9, 10]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  !JSON.stringify(canonical.downstream ?? {}).includes("场景包 2") ||
  !JSON.stringify(canonical.downstream ?? {}).includes("finance-gate")) {
  failures.push("canonical upstream/downstream boundary mismatch.");
}
if (!arraysContainAll(canonical.objects, expectedObjects)) failures.push("canonical missing scenario 11 object set.");
const stateText = JSON.stringify(objectState.stateLayering ?? {});
for (const required of ["运营状态由场景包 2 确认", "验收通过不等于可运营", "建议恢复不等于已恢复", "维修费用意向不等于账务成本"]) {
  if (!stateText.includes(required)) failures.push(`object state layering missing ${required}.`);
}
if ((stepsFields.steps ?? []).length !== 7 ||
  !JSON.stringify(stepsFields.fields ?? {}).includes("serviceWorkCaseRef") ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, forbiddenInternalFields)) {
  failures.push("steps/fields generated contract missing required work field boundary.");
}
if (crudPolicy.crudRules?.readOnlySurfacesWriteBusinessFactAllowed !== false ||
  crudPolicy.crudRules?.confirmedWorkInlineEditAllowed !== false) {
  failures.push("crud policy must keep readonly surfaces and confirmed work inline edit closed.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), expectedCommands)) {
  failures.push("runtime rules command list mismatch.");
}
for (const code of expectedFailures) {
  const failure = (runtimeRules.failureSemantics ?? []).find((item) => item.failureCode === code);
  if (!failure || failure.sideEffectsAllowed !== false) failures.push(`runtime rules missing no-side-effect failure ${code}.`);
}
const rule = runtimeRules.housekeepingMaintenanceInvariantRule ?? {};
for (const key of ["legalSourceRequired", "sourceSummaryRequired", "resourceScopeRequired", "operationStatusOwnedByScenario2", "completionEvidenceRequired", "verificationAuthorizedRequired", "completionRequiredBeforeVerification", "failedVerificationCreatesReworkOrException", "unresolvedMaintenanceBlocksRecoveryRecommendation", "expenseIntentOnly", "financeGateHandlesExpenseTruth", "failureNoSideEffects", "querySearchListBoardReportReadonly"]) {
  if (rule[key] !== true) failures.push(`runtime rules invariant ${key} must be true.`);
}
const boundary = runtimeRules.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteOperationStatus !== false ||
  boundary.businessRuntimeMayWriteReservation !== false ||
  boundary.businessRuntimeMayWriteStay !== false ||
  boundary.businessRuntimeMayWritePaymentRefund !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.financeGateMayConsumeExpenseIntentOnly !== true ||
  boundary.scenario2MayConsumeRecommendationOnly !== true ||
  boundary.successMayWriteWorkFactsAndRequestsOnly !== true) {
  failures.push("runtime consumption boundary mismatch.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已可预订", "已可运营", "已入账", "已退款", "final GO", "生产发布", "service-task", "maintenance", "resource-saleability"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, ["房务/维修完成摘要", "验收摘要", "停售建议", "恢复运营建议", "费用意向", "作业证据摘要", "状态历史", "只读对象引用"]) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("场景包 2") ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
  failures.push("handoff output or downstream recheck mismatch.");
}
if ((handoff.readSideOutputs ?? []).some((item) => ["RoomOperationStatus=可运营", "Reservation", "Stay", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已可运营", "已可预订", "已入账", "已退款"].includes(item))) {
  failures.push("handoff read side outputs must not include operational, reservation, stay, finance truth or ledger facts.");
}
if (financeGate.consumer !== "finance-gate" ||
  financeGate.expenseIntentOnly !== true ||
  financeGate.businessRuntimeMayWriteLedger !== false ||
  financeGate.businessRuntimeMayWritePaymentRefund !== false ||
  !JSON.stringify(financeGate.allowedInputs ?? []).includes("费用意向")) {
  failures.push("finance-gate generated contract must consume expense intent only and forbid business runtime finance truth writes.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteOperationStatus !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario11-housekeeping-maintenance-outofservice-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 11 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 11 generated contracts check: PASS (${generatedFiles.length} files)`);

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
