import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario9-checkout-settlement.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario9-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario9-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario9-handoff.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario9-finance-gate.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario9-checkout-settlement.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario9CheckoutSettlement.generated.json"
};
const runtimeImplementationPaths = {
  generatedRules: "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  operationsRuntimeService: "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  runtimeTests: "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
};
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
const failures = [];
const generated = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJsonIfExists(file)]));
const runtimeRulesText = readText(runtimeImplementationPaths.generatedRules);
const operationsRuntimeText = readText(runtimeImplementationPaths.operationsRuntimeService);
const runtimeTestsText = readText(runtimeImplementationPaths.runtimeTests);

for (const [key, file] of Object.entries(generatedPaths)) {
  if (!generated[key]) failures.push(`missing generated ${key}: ${file}`);
  if (generated[key]?.generated !== true || generated[key]?.doNotEdit !== true) failures.push(`${key} must be generated/doNotEdit.`);
  if (generated[key]?.sourceContentDigest !== digestFile(scenarioPath)) failures.push(`${key} source digest mismatch.`);
  if (generated[key]?.scenarioPackageNo !== 9 || generated[key]?.nameZh !== "退房结算") failures.push(`${key} scenario identity mismatch.`);
}
if (generated.runtimeMirror?.consumer !== "runtime") failures.push("runtime mirror must declare consumer=runtime.");
if (generated.mobileMirror?.consumer !== "surface") failures.push("mobile mirror must declare consumer=surface.");
if (generated.financeGate?.consumer !== "finance-gate" || generated.financeGate?.settlementIntentOnly !== true) {
  failures.push("finance-gate mirror must consume settlement intent only.");
}
const boundary = generated.runtimeRules?.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.businessRuntimeMayWritePaymentRefund !== false ||
  boundary.businessRuntimeMayRestoreOperationalStatus !== false ||
  boundary.financeGateMayConsumeSettlementIntentOnly !== true ||
  boundary.failurePathBusinessSideEffectsAllowed !== false ||
  boundary.successMayWriteCheckoutFactsAndRequestsOnly !== true) {
  failures.push("runtime generated boundary must force generated-only runtime and forbid finance truth/operational restore/ledger writes.");
}
if (!runtimeRulesText.includes("DormitoryScenario9CheckoutSettlement.generated.json") ||
  !runtimeRulesText.includes("Scenario9CheckoutSettlementRuntimeAdapter")) {
  failures.push("runtime must consume scenario 9 generated runtime mirror through Scenario9CheckoutSettlementRuntimeAdapter.");
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  failures.push("runtime rejection must not refresh Projection on generated rule failure.");
}
for (const command of expectedCommands) {
  if (!runtimeTestsText.includes(command)) failures.push(`runtime tests must cover scenario 9 command ${command}.`);
}
for (const failure of generated.runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) failures.push(`failure ${failure.failureCode} must have no side effects.`);
}
if (!String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) {
  failures.push("surface generated search entry must be readonly.");
}
if (!String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate") ||
  !String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 2")) {
  failures.push("handoff must route finance truth to finance-gate and resource recovery to scenario 2.");
}
if ((generated.handoff?.readSideOutputs ?? []).some((item) => ["Payment", "Refund", "LedgerEntry", "LedgerTransaction", "RoomOperationStatus=可运营", "已退款", "已入账", "房源已可运营"].includes(item))) {
  failures.push("handoff read side outputs must not include finance truth, ledger facts, or direct operational restore.");
}

const result = {
  version: "oam.dormitory-scenario9-checkout-settlement-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  generatedPaths,
  runtimeImplementationPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: runtimeRulesText.includes("DormitoryScenario9CheckoutSettlement.generated.json"),
    surfaceConsumesGenerated: generated.mobileMirror?.consumer === "surface",
    financeGateConsumesIntentOnly: generated.financeGate?.settlementIntentOnly === true,
    searchDashboardReportReadonly: String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读"),
    downstreamFinanceAndResourceRouting: String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate") &&
      String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 2"),
    failureNoSideEffects: (generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    businessRuntimeLedgerWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger === false,
    businessRuntimePaymentRefundForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund === false,
    businessRuntimeRestoreOperationalForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayRestoreOperationalStatus === false,
    successMayWriteCheckoutFactsAndRequestsOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.successMayWriteCheckoutFactsAndRequestsOnly === true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 9 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 9 consumption boundary check: PASS (${result.scenarioDigest})`);

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
