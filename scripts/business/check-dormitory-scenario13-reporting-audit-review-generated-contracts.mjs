import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario13-reporting-audit-review-contracts.mjs";
const generatedFiles = [
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
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));
const expectedObjects = [
  "ReportPeriod",
  "ReportScope",
  "MetricDefinition",
  "MetricSnapshot",
  "ReportSnapshot",
  "AuditFinding",
  "EvidenceReviewRecord",
  "ReviewMeetingRecord",
  "ReviewConclusion",
  "ActionPlan",
  "IssueTrackingItem",
  "ReportExportRecord",
  "ReportStatusTimeline",
  "StatusTimeline"
];
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
const forbiddenInternalFields = [
  "reportId",
  "metricId",
  "ledgerEntryId",
  "reservationId",
  "stayId",
  "roomId",
  "bedId",
  "paymentId",
  "depositId",
  "refundId",
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
  if (document.authorityId !== "Dormitory.Scenario13.ReportingAuditReview" ||
    document.scenarioPackageNo !== 13 ||
    document.nameZh !== "经营报表、审计与复盘") {
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
const metricModel = documents.get(generatedFiles[2]) ?? {};
const stepsFields = documents.get(generatedFiles[3]) ?? {};
const crudPolicy = documents.get(generatedFiles[4]) ?? {};
const runtimeRules = documents.get(generatedFiles[5]) ?? {};
const surfaceNavigation = documents.get(generatedFiles[6]) ?? {};
const handoff = documents.get(generatedFiles[7]) ?? {};
const readModel = documents.get(generatedFiles[9]) ?? {};
const financeGate = documents.get(generatedFiles[10]) ?? {};
const mobileMirror = documents.get(generatedFiles[11]) ?? {};
const runtimeMirror = documents.get(generatedFiles[12]) ?? {};

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  !arraysContainAll(canonical.objects, expectedObjects)) {
  failures.push("canonical upstream/object boundary mismatch.");
}
const invariantRule = objectState.reportingInvariantRule ?? {};
for (const key of ["reportDashboardSearchExportReadonly", "permissionRequiredForFormalReport", "lineageRequiredForFormalMetric", "freshnessRequiredForPublish", "financialMetricsReadFinanceGateOnly", "auditFindingCannotModifySourceFact", "actionPlanRoutesBackOnly", "failureNoSideEffects"]) {
  if (invariantRule[key] !== true) failures.push(`object state invariant ${key} must be true.`);
}
if (!arraysContainAll((metricModel.metricCatalog ?? []).map((item) => item.nameZh), ["收入确认", "押金余额", "退款申请", "异常闭环率"]) ||
  metricModel.metricDefinitionRule?.mustHavePermissionEnvelope !== true ||
  metricModel.metricDefinitionRule?.mustHaveLineageEnvelope !== true ||
  metricModel.metricDefinitionRule?.mustHaveFreshnessEnvelope !== true ||
  metricModel.metricDefinitionRule?.financialMetricsReadFinanceGateOnly !== true) {
  failures.push("metric model must include required metrics and permission/lineage/freshness/finance-gate rules.");
}
if ((stepsFields.steps ?? []).length !== 7 ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, forbiddenInternalFields)) {
  failures.push("steps/fields generated contract missing seven steps or internal field boundary.");
}
if (crudPolicy.crudRules?.readOnlySurfacesWriteSourceFactAllowed !== false ||
  crudPolicy.crudRules?.publishedInlineEditAllowed !== false ||
  crudPolicy.crudRules?.physicalDeletePublishedAllowed !== false) {
  failures.push("crud policy must keep readonly surfaces, published inline edit, and physical delete closed.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), expectedCommands)) {
  failures.push("runtime rules command list mismatch.");
}
if (!(runtimeRules.failureSemantics ?? []).every((item) => item.sideEffectsAllowed === false)) {
  failures.push("runtime rules must keep all failure paths no-side-effect.");
}
const boundary = runtimeRules.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.readModelMayReadConfirmedFactsOnly !== true ||
  boundary.readModelMayWriteSourceFacts !== false ||
  boundary.businessRuntimeMayWriteRoomBedOperation !== false ||
  boundary.businessRuntimeMayWritePriceQuoteReservationStay !== false ||
  boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.financeGateTruthReadonlyOnly !== true ||
  boundary.successMayWriteReportingAuditReviewFactsOnly !== true) {
  failures.push("runtime consumption boundary mismatch.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已修复原事实", "已入账", "已上线", "final GO", "生产发布", "业务上线", "period-review", "dashboard", "analytics"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, ["报表快照", "指标快照", "财务核对视图", "审计发现", "复盘结论", "行动计划", "问题追踪", "导出记录", "证据摘要", "只读对象引用"]) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
  failures.push("handoff output or downstream route mismatch.");
}
if (readModel.consumer !== "read-model/reporting" ||
  readModel.readModelMayReadConfirmedFactsOnly !== true ||
  readModel.readModelMayWriteSourceFacts !== false ||
  !arraysContainAll(readModel.requiredEnvelopes, ["permission envelope", "lineage envelope", "freshness envelope"])) {
  failures.push("read-model generated contract must be readonly and require permission/lineage/freshness.");
}
if (financeGate.consumer !== "finance-gate" ||
  financeGate.financeGateTruthReadonlyOnly !== true ||
  !arraysEqual(financeGate.exclusiveTruthWriters, ["finance-gate", "finance-kernel"]) ||
  financeGate.businessRuntimeMayWriteLedger !== false ||
  financeGate.businessRuntimeMayWritePaymentDepositRefund !== false ||
  financeGate.financialMetricsReadFinanceGateOnly !== true) {
  failures.push("finance-gate readonly contract must keep exclusive finance truth and forbid business runtime finance writes.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
  runtimeMirror.runtimeConsumptionBoundary?.readModelMayWriteSourceFacts !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario13-reporting-audit-review-generated-contracts-check.v1",
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
  console.error("Dormitory scenario 13 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 13 generated contracts check: PASS (${generatedFiles.length} files)`);

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
