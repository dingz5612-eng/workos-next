import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario5-reservation-and-inventory-hold.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario5-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario5-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario5-handoff.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario5-reservation-and-inventory-hold.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario5ReservationAndInventoryHold.generated.json"
};
const runtimeRulesPath = "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs";
const operationsRuntimeServicePath = "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs";
const runtimeTestsPath = "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs";
const commandIds = [
  "Dorm.BookingPreparationStart",
  "Dorm.AvailabilityRecheck",
  "Dorm.InventoryHoldCreate",
  "Dorm.InventoryHoldRelease",
  "Dorm.InventoryHoldExpire",
  "Dorm.ReservationDraftConfirm",
  "Dorm.ReservationConfirm",
  "Dorm.ReservationSummaryOutput"
];
const failures = [];
const scenarioDigest = fileDigest(scenarioPath);
const packageIndexDigest = fileDigest(packageIndexPath);
const docs = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJson(file)]));

for (const [key, file] of Object.entries(generatedPaths)) {
  const document = docs[key];
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated/doNotEdit.`);
  if (document.sourceContentDigest !== scenarioDigest) fail(`${file} must bind scenario Source digest.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) fail(`${file} must bind package index Source digest.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final approval closed.`);
  }
}

if (docs.mobileMirror.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (docs.runtimeMirror.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
if (JSON.stringify(docs.mobileMirror.fields?.forbiddenUserInputFields ?? []) !== JSON.stringify(docs.runtimeMirror.fields?.forbiddenUserInputFields ?? [])) {
  fail("surface and runtime mirrors must consume same forbidden internal fields.");
}
for (const internal of ["bookingRequestId", "inventoryHoldId", "holdId", "reservationId", "reservationNo", "quoteId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
  if (!(docs.mobileMirror.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`mobile mirror missing forbidden field ${internal}.`);
  if ((docs.mobileMirror.fields?.userFilled ?? []).includes(internal) || (docs.mobileMirror.fields?.userSelected ?? []).includes(internal)) {
    fail(`mobile mirror exposes ${internal} as user input.`);
  }
}
if (JSON.stringify((docs.runtimeMirror.commands ?? []).map((item) => item.commandId)) !== JSON.stringify(commandIds)) {
  fail("runtime mirror must expose exactly the eight scenario 5 write commands.");
}
for (const command of docs.runtimeMirror.commands ?? []) {
  if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true || command.requiresGeneratedContract !== true) {
    fail(`${command.commandId} must consume generated idempotency/concurrency rules.`);
  }
  for (const forbidden of ["Stay", "CheckIn", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction"]) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden runtime write ${forbidden}.`);
  }
}
for (const failure of docs.runtimeMirror.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
}
for (const target of ["CommandSubmission", "DomainEvent", "Outbox", "Projection", "Lens", "Search", "Dashboard", "Ledger"]) {
  if (!(docs.runtimeMirror.runtimeConsumptionBoundary?.failureNoSideEffectTargets ?? []).includes(target)) fail(`runtime mirror no-side-effect targets missing ${target}.`);
}
if (docs.runtimeMirror.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true) fail("runtime must read generated only.");
if (docs.runtimeMirror.runtimeConsumptionBoundary?.runtimeMayHardcodeBusinessRules !== false) fail("runtime hardcoded business rules must be forbidden.");
if (docs.runtimeMirror.inventoryInvariantRule?.atomicResourceDateCheckRequired !== true ||
  docs.runtimeMirror.inventoryInvariantRule?.holdUntilRequired !== true ||
  docs.runtimeMirror.inventoryInvariantRule?.reservationNoSystemGenerated !== true) {
  fail("runtime mirror must expose inventory invariant rule.");
}
const runtimeRulesText = readText(runtimeRulesPath);
const operationsRuntimeText = readText(operationsRuntimeServicePath);
const runtimeTestsText = readText(runtimeTestsPath);
if (!runtimeRulesText.includes("DormitoryScenario5ReservationAndInventoryHold.generated.json")) {
  fail("runtime rules must consume DormitoryScenario5ReservationAndInventoryHold.generated.json.");
}
if (!runtimeRulesText.includes("Scenario5ReservationInventoryRuntimeAdapter")) {
  fail("runtime rules must include scenario 5 generated adapter.");
}
for (const commandId of commandIds) {
  if (!runtimeTestsText.includes(commandId)) fail(`runtime tests must cover ${commandId}.`);
}
if (!operationsRuntimeText.includes("[\"refreshProjection\"] = false")) {
  fail("generated rule rejection must not refresh projection on failure.");
}
if (!String(docs.surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must remain readonly.");
if (!String(docs.surfaceNavigation.surfaceNavigation?.mineZh ?? "").includes("草稿")) fail("mine entry must keep personal drafts/follow-ups only.");
if (!String(docs.handoff.downstreamRecheckRuleZh ?? "").includes("重新核验入住所需证件、协议、押金/收款规则")) fail("handoff must require downstream check-in recheck.");
for (const forbidden of ["入住", "已入住", "可入住", "收款", "已收款", "押金", "押金已收", "退款", "账务"]) {
  if ((docs.handoff.readSideOutputs ?? []).includes(forbidden)) fail(`scenario 5 handoff must not output ${forbidden}.`);
}
for (const forbiddenTerm of ["已入住", "已收款", "押金已收", "退款", "final GO", "lead-reservation", "reservationCreate", "reservationConvert", "check-in"]) {
  if (!(docs.mobileMirror.forbiddenUserVisibleTermsZh ?? []).includes(forbiddenTerm)) fail(`mobile mirror missing forbidden user visible term ${forbiddenTerm}.`);
}

const result = {
  version: "oam.dormitory-scenario5-reservation-and-inventory-hold-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedPaths,
  runtimeImplementationPaths: {
    generatedRules: runtimeRulesPath,
    operationsRuntimeService: operationsRuntimeServicePath,
    runtimeTests: runtimeTestsPath
  },
  consumerBoundaries: {
    runtimeConsumesGenerated: true,
    surfaceConsumesGenerated: true,
    searchDashboardReportReadonly: true,
    downstreamCheckInMustRecheck: true,
    failureNoSideEffects: true,
    checkInPaymentDepositRefundLedgerWritesForbidden: true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 5 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 5 consumption boundary check: PASS (${scenarioDigest})`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function fail(message) {
  failures.push(message);
}
