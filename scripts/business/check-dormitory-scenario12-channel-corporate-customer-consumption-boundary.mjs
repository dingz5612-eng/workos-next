import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario12-channel-corporate-customer.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario12-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario12-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario12-handoff.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario12-finance-gate.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario12-channel-corporate-customer.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario12ChannelCorporateCustomer.generated.json"
};
const runtimeImplementationPaths = {
  generatedRules: "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  operationsRuntimeService: "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  runtimeTests: "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
};
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
const failures = [];
const generated = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJsonIfExists(file)]));
const runtimeRulesText = readText(runtimeImplementationPaths.generatedRules);
const operationsRuntimeText = readText(runtimeImplementationPaths.operationsRuntimeService);
const runtimeTestsText = readText(runtimeImplementationPaths.runtimeTests);

for (const [key, file] of Object.entries(generatedPaths)) {
  if (!generated[key]) failures.push(`missing generated ${key}: ${file}`);
  if (generated[key]?.generated !== true || generated[key]?.doNotEdit !== true) failures.push(`${key} must be generated/doNotEdit.`);
  if (generated[key]?.sourceContentDigest !== digestFile(scenarioPath)) failures.push(`${key} source digest mismatch.`);
  if (generated[key]?.scenarioPackageNo !== 12 || generated[key]?.nameZh !== "渠道与企业客户") failures.push(`${key} scenario identity mismatch.`);
}
if (generated.runtimeMirror?.consumer !== "runtime") failures.push("runtime mirror must declare consumer=runtime.");
if (generated.mobileMirror?.consumer !== "surface") failures.push("mobile mirror must declare consumer=surface.");
if (generated.financeGate?.consumer !== "finance-gate" || generated.financeGate?.commissionSettlementIntentOnly !== true) {
  failures.push("finance-gate mirror must consume commission/settlement intent only.");
}
const boundary = generated.runtimeRules?.runtimeConsumptionBoundary ?? {};
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
  boundary.failurePathBusinessSideEffectsAllowed !== false ||
  boundary.successMayWriteChannelCorporateFactsAndIntentsOnly !== true) {
  failures.push("runtime generated boundary must force generated-only runtime and forbid price truth/quote/reservation/inventory/finance/ledger writes.");
}
if (!runtimeRulesText.includes("DormitoryScenario12ChannelCorporateCustomer.generated.json") ||
  !runtimeRulesText.includes("Scenario12ChannelCorporateCustomerRuntimeAdapter")) {
  failures.push("runtime must consume scenario 12 generated runtime mirror through Scenario12ChannelCorporateCustomerRuntimeAdapter.");
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  failures.push("runtime rejection must not refresh Projection on generated rule failure.");
}
for (const command of expectedCommands) {
  if (!runtimeTestsText.includes(command)) failures.push(`runtime tests must cover scenario 12 command ${command}.`);
}
for (const failure of generated.runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) failures.push(`failure ${failure.failureCode} must have no side effects.`);
}
if (!String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) {
  failures.push("surface generated search entry must be readonly.");
}
if (!String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 4") ||
  !String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 5") ||
  !String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate")) {
  failures.push("handoff must route quote truth to scenario 4, reservation/inventory truth to scenario 5, and commission/settlement truth to finance-gate.");
}
if ((generated.handoff?.readSideOutputs ?? []).some((item) => ["RatePlan 金额真值", "Quote", "Reservation", "InventoryHold", "Payment", "Refund", "LedgerEntry", "LedgerTransaction", "已报价", "已预订", "已收款", "已入账"].includes(item))) {
  failures.push("handoff read side outputs must not include price truth, quote/reservation/inventory facts, finance truth or ledger facts.");
}

const result = {
  version: "oam.dormitory-scenario12-channel-corporate-customer-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  generatedPaths,
  runtimeImplementationPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: runtimeRulesText.includes("DormitoryScenario12ChannelCorporateCustomer.generated.json"),
    surfaceConsumesGenerated: generated.mobileMirror?.consumer === "surface",
    financeGateConsumesCommissionSettlementIntentOnly: generated.financeGate?.commissionSettlementIntentOnly === true,
    scenario4ConsumesEligibilityOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.scenario4MayConsumeEligibilityOnly === true,
    scenario5ConsumesEligibilityOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.scenario5MayConsumeEligibilityOnly === true,
    searchDashboardReportReadonly: String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读"),
    downstreamScenario4Scenario5FinanceRouting: String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 4") &&
      String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("场景包 5") &&
      String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("finance-gate"),
    failureNoSideEffects: (generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    businessRuntimeRatePlanTruthWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteRatePlanTruth === false,
    businessRuntimeQuoteWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteQuote === false,
    businessRuntimeReservationWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteReservation === false,
    businessRuntimeInventoryHoldWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteInventoryHold === false,
    businessRuntimeLedgerWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger === false,
    businessRuntimePaymentRefundForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentRefund === false,
    successMayWriteChannelCorporateFactsAndIntentsOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.successMayWriteChannelCorporateFactsAndIntentsOnly === true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 12 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 12 consumption boundary check: PASS (${result.scenarioDigest})`);

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
