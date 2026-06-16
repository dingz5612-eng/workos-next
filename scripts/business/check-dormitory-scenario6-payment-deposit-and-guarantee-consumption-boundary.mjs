import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario6-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario6-handoff.generated.json",
  financeGate: "docs/contracts/generated/finance/scenario6-finance-gate.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario6-payment-deposit-and-guarantee.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario6PaymentDepositAndGuarantee.generated.json"
};
const runtimeImplementationPaths = {
  generatedRules: "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  operationsRuntimeService: "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  runtimeTests: "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
};
const failures = [];
const scenario = readJson(scenarioPath);
const generated = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJsonIfExists(file)]));
const runtimeRulesText = readText(runtimeImplementationPaths.generatedRules);
const operationsRuntimeText = readText(runtimeImplementationPaths.operationsRuntimeService);
const runtimeTestsText = readText(runtimeImplementationPaths.runtimeTests);
const expectedCommands = [
  "Dorm.PaymentDepositCaseStart",
  "Dorm.PaymentDepositRequirementConfirm",
  "Dorm.PaymentReceiptSubmit",
  "Dorm.DepositGuaranteeSubmit",
  "Dorm.FinanceReviewRequest",
  "Dorm.FinanceGateConfirm",
  "Dorm.FinanceGateReturn",
  "Dorm.FinanceEvidenceSupplement",
  "Dorm.FinanceReadySummaryOutput"
];

for (const [key, file] of Object.entries(generatedPaths)) {
  if (!generated[key]) failures.push(`missing generated ${key}: ${file}`);
  if (generated[key]?.generated !== true || generated[key]?.doNotEdit !== true) failures.push(`${key} must be generated/doNotEdit.`);
  if (generated[key]?.sourceContentDigest !== digestFile(scenarioPath)) failures.push(`${key} source digest mismatch.`);
}
if (generated.runtimeMirror?.consumer !== "runtime") failures.push("runtime mirror must declare consumer=runtime.");
if (generated.mobileMirror?.consumer !== "surface") failures.push("mobile mirror must declare consumer=surface.");
if (generated.financeGate?.consumer !== "finance-gate") failures.push("finance gate projection must declare consumer=finance-gate.");
if (generated.runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
  generated.runtimeRules?.runtimeConsumptionBoundary?.runtimeMayHardcodeBusinessRules !== false ||
  generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
  generated.runtimeRules?.runtimeConsumptionBoundary?.financeGateMayConfirmFinanceFacts !== true) {
  failures.push("runtime generated boundary must force generated-only runtime and finance-gate ledger boundary.");
}
if (generated.financeGate?.financeBoundaryRule?.financeGateRequired !== true ||
  generated.financeGate?.forbiddenLedgerWritesByBusinessRuntime !== true ||
  generated.financeGate?.depositIsNotIncome !== true ||
  generated.financeGate?.guaranteeIsNotPayment !== true) {
  failures.push("finance-gate projection must enforce finance boundary rules.");
}
if (!runtimeRulesText.includes("DormitoryScenario6PaymentDepositAndGuarantee.generated.json") ||
  !runtimeRulesText.includes("Scenario6PaymentDepositGuaranteeRuntimeAdapter")) {
  failures.push("runtime must consume scenario 6 generated runtime mirror through Scenario6PaymentDepositGuaranteeRuntimeAdapter.");
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  failures.push("runtime rejection must not refresh Projection on generated rule failure.");
}
for (const command of expectedCommands) {
  if (!runtimeTestsText.includes(command)) failures.push(`runtime tests must cover scenario 6 command ${command}.`);
}
for (const failure of generated.runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) failures.push(`failure ${failure.failureCode} must have no side effects.`);
}
if (!String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) {
  failures.push("surface generated search entry must be readonly.");
}
if (!String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("不得把收款确认当成已入住")) {
  failures.push("handoff must force scenario 7 recheck and forbid treating payment confirmation as check-in.");
}
if ((generated.handoff?.readSideOutputs ?? []).some((item) => ["入住", "已入住", "退房", "退款", "LedgerEntry", "LedgerTransaction"].includes(item))) {
  failures.push("handoff read side outputs must not include stay/refund/ledger facts.");
}

const result = {
  version: "oam.dormitory-scenario6-payment-deposit-and-guarantee-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  generatedPaths,
  runtimeImplementationPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: runtimeRulesText.includes("DormitoryScenario6PaymentDepositAndGuarantee.generated.json"),
    surfaceConsumesGenerated: generated.mobileMirror?.consumer === "surface",
    financeGateConsumesGenerated: generated.financeGate?.consumer === "finance-gate",
    searchDashboardReportReadonly: String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读"),
    downstreamCheckInMustRecheck: String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("重新核验"),
    failureNoSideEffects: (generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    businessRuntimeLedgerWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger === false,
    depositIsNotIncome: generated.financeGate?.depositIsNotIncome === true,
    guaranteeIsNotPayment: generated.financeGate?.guaranteeIsNotPayment === true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 6 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 6 consumption boundary check: PASS (${result.scenarioDigest})`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

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
