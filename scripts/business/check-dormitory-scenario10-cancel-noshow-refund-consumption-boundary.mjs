import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario10-cancel-noshow-refund.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario10-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario10-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario10-handoff.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario10-finance-gate.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario10-cancel-noshow-refund.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario10CancelNoShowRefund.generated.json"
};
const runtimeImplementationPaths = {
  generatedRules: "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  operationsRuntimeService: "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  runtimeTests: "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
};
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
const failures = [];
const generated = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJsonIfExists(file)]));
const runtimeRulesText = readText(runtimeImplementationPaths.generatedRules);
const operationsRuntimeText = readText(runtimeImplementationPaths.operationsRuntimeService);
const runtimeTestsText = readText(runtimeImplementationPaths.runtimeTests);

for (const [key, file] of Object.entries(generatedPaths)) {
  if (!generated[key]) failures.push(`missing generated ${key}: ${file}`);
  if (generated[key]?.generated !== true || generated[key]?.doNotEdit !== true) failures.push(`${key} must be generated/doNotEdit.`);
  if (generated[key]?.sourceContentDigest !== digestFile(scenarioPath)) failures.push(`${key} source digest mismatch.`);
  if (generated[key]?.scenarioPackageNo !== 10 || generated[key]?.nameZh !== "取消、未到店与退款处理") failures.push(`${key} scenario identity mismatch.`);
}
if (generated.runtimeMirror?.consumer !== "runtime") failures.push("runtime mirror must declare consumer=runtime.");
if (generated.mobileMirror?.consumer !== "surface") failures.push("mobile mirror must declare consumer=surface.");
if (generated.financeGate?.consumer !== "finance-gate" || generated.financeGate?.refundFeeIntentOnly !== true) {
  failures.push("finance-gate mirror must consume refund/fee intent only.");
}
const boundary = generated.runtimeRules?.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.businessRuntimeMayWritePaymentRefund !== false ||
  boundary.businessRuntimeMayWriteStayCheckout !== false ||
  boundary.businessRuntimeMayRestoreOperationalStatus !== false ||
  boundary.financeGateMayConsumeRefundFeeIntentOnly !== true ||
  boundary.inventoryReadModelMayConsumeReleaseRequestOnly !== true ||
  boundary.failurePathBusinessSideEffectsAllowed !== false ||
  boundary.successMayWriteCancellationNoShowFactsAndRequestsOnly !== true) {
  failures.push("runtime generated boundary must force generated-only runtime and forbid finance truth/stay/checkout/operational restore/ledger writes.");
}
if (!runtimeRulesText.includes("DormitoryScenario10CancelNoShowRefund.generated.json") ||
  !runtimeRulesText.includes("Scenario10CancelNoShowRefundRuntimeAdapter")) {
  failures.push("runtime must consume scenario 10 generated runtime mirror through Scenario10CancelNoShowRefundRuntimeAdapter.");
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  failures.push("runtime rejection must not refresh Projection on generated rule failure.");
}
for (const command of expectedCommands) {
  if (!runtimeTestsText.includes(command)) failures.push(`runtime tests must cover scenario 10 command ${command}.`);
}
for (const failure of generated.runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) failures.push(`failure ${failure.failureCode} must have no side effects.`);
}
if (!String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) {
  failures.push("surface generated search entry must be readonly.");
}
if (!String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
  !String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("库存/预订读模型")) {
  failures.push("handoff must route finance truth to finance-gate and inventory updates to inventory/reservation read model.");
}
if ((generated.handoff?.readSideOutputs ?? []).some((item) => ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "Stay", "CheckoutCase", "RoomOperationStatus=可运营", "已退款到账", "已入账", "已入住", "已退房"].includes(item))) {
  failures.push("handoff read side outputs must not include finance truth, ledger facts, stay/checkout facts, or direct operational restore.");
}

const result = {
  version: "oam.dormitory-scenario10-cancel-noshow-refund-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  generatedPaths,
  runtimeImplementationPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: runtimeRulesText.includes("DormitoryScenario10CancelNoShowRefund.generated.json"),
    surfaceConsumesGenerated: generated.mobileMirror?.consumer === "surface",
    financeGateConsumesIntentOnly: generated.financeGate?.refundFeeIntentOnly === true,
    inventoryReadModelConsumesReleaseRequestOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.inventoryReadModelMayConsumeReleaseRequestOnly === true,
    searchDashboardReportReadonly: String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读"),
    downstreamFinanceAndInventoryRouting: String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate") &&
      String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("库存/预订读模型"),
    failureNoSideEffects: (generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    businessRuntimeLedgerWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger === false,
    businessRuntimePaymentRefundForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund === false,
    businessRuntimeStayCheckoutForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteStayCheckout === false,
    successMayWriteCancellationNoShowFactsAndRequestsOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.successMayWriteCancellationNoShowFactsAndRequestsOnly === true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 10 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 10 consumption boundary check: PASS (${result.scenarioDigest})`);

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
