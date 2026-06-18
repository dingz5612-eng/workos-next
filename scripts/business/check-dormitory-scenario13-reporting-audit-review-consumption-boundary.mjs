import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario13-reporting-audit-review.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario13-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario13-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario13-handoff.generated.json",
  readModel: "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario13-reporting-audit-review.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario13ReportingAuditReview.generated.json"
};
const runtimeImplementationPaths = {
  generatedRules: "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  operationsRuntimeService: "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  runtimeTests: "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
};
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
const failures = [];
const generated = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJsonIfExists(file)]));
const runtimeRulesText = readText(runtimeImplementationPaths.generatedRules);
const operationsRuntimeText = readText(runtimeImplementationPaths.operationsRuntimeService);
const runtimeTestsText = readText(runtimeImplementationPaths.runtimeTests);

for (const [key, file] of Object.entries(generatedPaths)) {
  if (!generated[key]) failures.push(`missing generated ${key}: ${file}`);
  if (generated[key]?.generated !== true || generated[key]?.doNotEdit !== true) failures.push(`${key} must be generated/doNotEdit.`);
  if (generated[key]?.sourceContentDigest !== digestFile(scenarioPath)) failures.push(`${key} source digest mismatch.`);
  if (generated[key]?.scenarioPackageNo !== 13 || generated[key]?.nameZh !== "经营报表、审计与复盘") failures.push(`${key} scenario identity mismatch.`);
}
if (generated.runtimeMirror?.consumer !== "runtime") failures.push("runtime mirror must declare consumer=runtime.");
if (generated.mobileMirror?.consumer !== "surface") failures.push("mobile mirror must declare consumer=surface.");
if (generated.readModel?.consumer !== "read-model/reporting" ||
  generated.readModel?.readModelMayWriteSourceFacts !== false ||
  generated.readModel?.readModelMayReadConfirmedFactsOnly !== true) {
  failures.push("read model must be readonly and consume confirmed facts only.");
}
if (generated.financeGate?.consumer !== "finance-gate" ||
  generated.financeGate?.financeGateTruthReadonlyOnly !== true ||
  generated.financeGate?.businessRuntimeMayWriteLedger !== false) {
  failures.push("finance-gate mirror must be readonly for finance truth.");
}
const boundary = generated.runtimeRules?.runtimeConsumptionBoundary ?? {};
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
  failures.push("runtime generated boundary must force generated-only runtime and forbid all source/finance writes.");
}
if (!runtimeRulesText.includes("DormitoryScenario13ReportingAuditReview.generated.json") ||
  !runtimeRulesText.includes("Scenario13ReportingAuditReviewRuntimeAdapter")) {
  failures.push("runtime must consume scenario 13 generated runtime mirror through Scenario13ReportingAuditReviewRuntimeAdapter.");
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  failures.push("runtime rejection must not refresh Projection on generated rule failure.");
}
for (const command of expectedCommands) {
  if (!runtimeTestsText.includes(command)) failures.push(`runtime tests must cover scenario 13 command ${command}.`);
}
if (!(generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false)) {
  failures.push("all generated scenario 13 failures must have no side effects.");
}
if (!String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) {
  failures.push("surface generated search entry must be readonly.");
}
if (!String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
  !String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("对应场景包")) {
  failures.push("handoff must route action plans back to source packages or finance-gate.");
}
if ((generated.handoff?.readSideOutputs ?? []).some((item) => ["Room", "Bed", "OperationStatus", "RatePlan", "Quote", "Reservation", "Stay", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "已修复原事实", "已入账", "已上线", "final GO"].includes(item))) {
  failures.push("handoff read side outputs must not include source business facts, finance facts, ledger facts or release claims.");
}

const result = {
  version: "oam.dormitory-scenario13-reporting-audit-review-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  generatedPaths,
  runtimeImplementationPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: runtimeRulesText.includes("DormitoryScenario13ReportingAuditReview.generated.json"),
    surfaceConsumesGenerated: generated.mobileMirror?.consumer === "surface",
    readModelConsumesConfirmedFactsOnly: generated.readModel?.readModelMayReadConfirmedFactsOnly === true,
    financeGateReadonlyTruth: generated.financeGate?.financeGateTruthReadonlyOnly === true,
    searchDashboardReportReadonly: String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读"),
    actionPlanRoutesBackOnly: String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("对应场景包"),
    failureNoSideEffects: (generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    businessRuntimeSourceFactWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteRoomBedOperation === false &&
      generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePriceQuoteReservationStay === false,
    businessRuntimeFinanceWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentDepositRefund === false &&
      generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger === false,
    successMayWriteReportingAuditReviewFactsOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.successMayWriteReportingAuditReviewFactsOnly === true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 13 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 13 consumption boundary check: PASS (${result.scenarioDigest})`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function readText(file) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    return "";
  }
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}
