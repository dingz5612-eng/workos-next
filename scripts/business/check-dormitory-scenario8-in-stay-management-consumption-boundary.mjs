import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario8-in-stay-management-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario8-in-stay-management.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario8-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario8-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario8-handoff.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario8-in-stay-management.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario8InStayManagement.generated.json"
};
const runtimeImplementationPaths = {
  generatedRules: "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
  operationsRuntimeService: "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  runtimeTests: "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
};
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
const failures = [];
const generated = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJsonIfExists(file)]));
const runtimeRulesText = readText(runtimeImplementationPaths.generatedRules);
const operationsRuntimeText = readText(runtimeImplementationPaths.operationsRuntimeService);
const runtimeTestsText = readText(runtimeImplementationPaths.runtimeTests);

for (const [key, file] of Object.entries(generatedPaths)) {
  if (!generated[key]) failures.push(`missing generated ${key}: ${file}`);
  if (generated[key]?.generated !== true || generated[key]?.doNotEdit !== true) failures.push(`${key} must be generated/doNotEdit.`);
  if (generated[key]?.sourceContentDigest !== digestFile(scenarioPath)) failures.push(`${key} source digest mismatch.`);
  if (generated[key]?.scenarioPackageNo !== 8 || generated[key]?.nameZh !== "在住管理") failures.push(`${key} scenario identity mismatch.`);
}
if (generated.runtimeMirror?.consumer !== "runtime") failures.push("runtime mirror must declare consumer=runtime.");
if (generated.mobileMirror?.consumer !== "surface") failures.push("mobile mirror must declare consumer=surface.");
const boundary = generated.runtimeRules?.runtimeConsumptionBoundary ?? {};
if (boundary.runtimeMayReadGeneratedOnly !== true ||
  boundary.runtimeMayHardcodeBusinessRules !== false ||
  boundary.businessRuntimeMayWriteLedger !== false ||
  boundary.businessRuntimeMayWritePaymentDepositRefund !== false ||
  boundary.businessRuntimeMayWriteCheckoutSettlement !== false ||
  boundary.businessRuntimeMayReleaseRoom !== false ||
  boundary.failurePathBusinessSideEffectsAllowed !== false ||
  boundary.successMayWriteInStayFactsOnly !== true) {
  failures.push("runtime generated boundary must force generated-only runtime and forbid finance/checkout/release/ledger writes.");
}
if (!runtimeRulesText.includes("DormitoryScenario8InStayManagement.generated.json") ||
  !runtimeRulesText.includes("Scenario8InStayManagementRuntimeAdapter")) {
  failures.push("runtime must consume scenario 8 generated runtime mirror through Scenario8InStayManagementRuntimeAdapter.");
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  failures.push("runtime rejection must not refresh Projection on generated rule failure.");
}
for (const command of expectedCommands) {
  if (!runtimeTestsText.includes(command)) failures.push(`runtime tests must cover scenario 8 command ${command}.`);
}
for (const failure of generated.runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) failures.push(`failure ${failure.failureCode} must have no side effects.`);
}
if (!String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读")) {
  failures.push("surface generated search entry must be readonly.");
}
if (!String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("不得要求用户重新填写已确认入住字段")) {
  failures.push("handoff must force scenario 9 to read summaries and not refill confirmed check-in fields.");
}
if ((generated.handoff?.readSideOutputs ?? []).some((item) => ["Payment", "Deposit", "Refund", "CheckoutCase", "CheckoutSettlement", "LedgerEntry", "LedgerTransaction", "RoomRelease", "收款", "押金确认", "退款", "退房结算", "房源释放"].includes(item))) {
  failures.push("handoff read side outputs must not include finance/refund/checkout/release/ledger facts.");
}

const result = {
  version: "oam.dormitory-scenario8-in-stay-management-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest: digestFile(scenarioPath),
  packageIndexDigest: digestFile(packageIndexPath),
  generatedPaths,
  runtimeImplementationPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: runtimeRulesText.includes("DormitoryScenario8InStayManagement.generated.json"),
    surfaceConsumesGenerated: generated.mobileMirror?.consumer === "surface",
    searchDashboardReportReadonly: String(generated.surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读"),
    downstreamCheckoutReadsSummariesOnly: String(generated.handoff?.downstreamRecheckRuleZh ?? "").includes("只读对象引用"),
    failureNoSideEffects: (generated.runtimeRules?.failureSemantics ?? []).every((failure) => failure.sideEffectsAllowed === false),
    businessRuntimeLedgerWritesForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger === false,
    businessRuntimePaymentDepositRefundForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWritePaymentDepositRefund === false,
    businessRuntimeCheckoutForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayWriteCheckoutSettlement === false,
    businessRuntimeReleaseForbidden: generated.runtimeRules?.runtimeConsumptionBoundary?.businessRuntimeMayReleaseRoom === false,
    successMayWriteInStayFactsOnly: generated.runtimeRules?.runtimeConsumptionBoundary?.successMayWriteInStayFactsOnly === true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 8 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 8 consumption boundary check: PASS (${result.scenarioDigest})`);

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
