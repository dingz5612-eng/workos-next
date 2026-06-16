import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario11-housekeeping-maintenance-outofservice.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario11-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario11-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario11-handoff.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario11-finance-gate.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario11-housekeeping-maintenance-outofservice.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json"
};
const runtimeImplementationPaths = {
  generatedRules: "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  operationsRuntimeService: "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  runtimeTests: "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
};
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
const failures = [];
const generated = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJsonIfExists(file)]));
const runtimeRulesText = readText(runtimeImplementationPaths.generatedRules);
const operationsRuntimeText = readText(runtimeImplementationPaths.operationsRuntimeService);
const runtimeTestsText = readText(runtimeImplementationPaths.runtimeTests);

for (const [key, file] of Object.entries(generatedPaths)) {
  if (!generated[key]) failures.push(`missing generated ${key}: ${file}`);
  if (generated[key]?.generated !== true || generated[key]?.doNotEdit !== true) failures.push(`${key} must be generated/doNotEdit.`);
  if (generated[key]?.sourceContentDigest !== digestFile(scenarioPath)) failures.push(`${key} source digest mismatch.`);
  if (generated[key]?.scenarioPackageNo !== 11 || generated[key]?.nameZh !== "房务、维修与停售协同") failures.push(`${key} scenario identity mismatch.`);
}
if (generated.runtimeMirror?.consumer !== "runtime") failures.push("runtime mirror must declare consumer=runtime.");
if (generated.mobileMirror?.consumer !== "surface") failures.push("mobile mirror must declare consumer=surface.");
if (generated.financeGate?.consumer !== "finance-gate" || generated.financeGate?.expenseIntentOnly !== true) {
  failures.push("finance-gate mirror must consume expense intent only.");
}
const boundary = generated.runtimeRules?.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteOperationStatus !== false ||
  boundary.businessRuntimeMayWriteReservation !== false ||
  boundary.businessRuntimeMayWriteStay !== false ||
  boundary.businessRuntimeMayWritePaymentRefund !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.financeGateMayConsumeExpenseIntentOnly !== true ||
  boundary.scenario2MayConsumeRecommendationOnly !== true ||
  boundary.failurePathBusinessSideEffectsAllowed !== false ||
  boundary.successMayWriteWorkFactsAndRequestsOnly !== true) {
  failures.push("runtime generated boundary must force generated-only runtime and forbid operation/reservation/stay/finance/ledger writes.");
}
if (!runtimeRulesText.includes("DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json") ||
  !runtimeRulesText.includes("Scenario11HousekeepingMaintenanceOutOfServiceRuntimeAdapter")) {
  failures.push("runtime must consume scenario 11 generated runtime mirror through Scenario11HousekeepingMaintenanceOutOfServiceRuntimeAdapter.");
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  failures.push("runtime rejection must not refresh Projection on generated rule failure.");
}
for (const command of expectedCommands) {
  if (!runtimeTestsText.includes(command)) failures.push(`runtime tests must cover scenario 11 command ${command}.`);
}
for (const failure of generated.runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) failures.push(`failure ${failure.failureCode} must have no side effects.`);
}
if (!String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) {
  failures.push("surface generated search entry must be readonly.");
}
if (!String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 2") ||
  !String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
  failures.push("handoff must route operational truth to scenario 2 and expense truth to finance-gate.");
}
if ((generated.handoff?.readSideOutputs ?? []).some((item) => ["RoomOperationStatus=可运营", "Reservation", "Stay", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已可运营", "已可预订", "已入账", "已退款"].includes(item))) {
  failures.push("handoff read side outputs must not include operation truth, reservation/stay facts, finance truth or ledger facts.");
}

const result = {
  version: "oam.dormitory-scenario11-housekeeping-maintenance-outofservice-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  generatedPaths,
  runtimeImplementationPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: runtimeRulesText.includes("DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json"),
    surfaceConsumesGenerated: generated.mobileMirror?.consumer === "surface",
    financeGateConsumesExpenseIntentOnly: generated.financeGate?.expenseIntentOnly === true,
    scenario2ConsumesRecommendationOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.scenario2MayConsumeRecommendationOnly === true,
    searchDashboardReportReadonly: String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读"),
    downstreamScenario2FinanceRouting: String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 2") &&
      String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate"),
    failureNoSideEffects: (generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    businessRuntimeOperationWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteOperationStatus === false,
    businessRuntimeLedgerWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger === false,
    businessRuntimePaymentRefundForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund === false,
    successMayWriteWorkFactsAndRequestsOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.successMayWriteWorkFactsAndRequestsOnly === true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 11 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 11 consumption boundary check: PASS (${result.scenarioDigest})`);

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
