import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-generated-contracts-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario5-reservation-and-inventory-hold.generated.json",
  objectStateModel: "docs/contracts/generated/dormitory/scenario5-object-state-model.generated.json",
  stepsFields: "docs/contracts/generated/dormitory/scenario5-steps-fields.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/scenario5-crud-policy.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario5-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario5-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario5-handoff.generated.json",
  testPlan: "docs/contracts/generated/dormitory/scenario5-test-plan.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario5-reservation-and-inventory-hold.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario5ReservationAndInventoryHold.generated.json"
};
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
const reservationStatuses = [
  "待锁定",
  "锁定中",
  "已锁定",
  "锁定过期",
  "待确认预订",
  "已预订",
  "预订确认失败",
  "转入住准备"
];
const forbiddenUserInputFields = [
  "bookingRequestId",
  "inventoryHoldId",
  "holdId",
  "reservationId",
  "reservationNo",
  "quoteId",
  "productId",
  "ratePlanId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const failures = [];
const scenarioDigest = fileDigest(scenarioPath);
const packageIndexDigest = fileDigest(packageIndexPath);
const docs = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJson(file)]));

for (const [key, file] of Object.entries(generatedPaths)) {
  const document = docs[key];
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated/doNotEdit.`);
  if (document.generatedBy !== "scripts/business/generate-dormitory-scenario5-reservation-and-inventory-hold-contracts.mjs") fail(`${file} generatedBy mismatch.`);
  if (!(document.generatedFrom ?? []).includes(scenarioPath) || !(document.generatedFrom ?? []).includes(packageIndexPath)) fail(`${file} must bind Source and package index.`);
  if (document.sourceContentDigest !== scenarioDigest) fail(`${file} must bind scenario Source digest.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) fail(`${file} must bind package index digest.`);
  if (document.authorityId !== "Dormitory.Scenario5.ReservationAndInventoryHold" || document.scenarioPackageNo !== 5 || document.nameZh !== "预订与库存锁定") {
    fail(`${file} identity mismatch.`);
  }
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final approval closed.`);
  }
  if (document.outputContentDigest !== digestObject(document)) fail(`${file} outputContentDigest mismatch.`);
}

if (docs.canonical.packageIndexRow?.packageNo !== 5 ||
  JSON.stringify(docs.canonical.packageIndexRow?.upstreamPackages ?? []) !== JSON.stringify([1, 2, 3, 4]) ||
  JSON.stringify(docs.canonical.packageIndexRow?.downstreamPackages ?? []) !== JSON.stringify([6])) {
  fail("canonical package index row must bind package 5 upstream/downstream.");
}
if (JSON.stringify(docs.canonical.reservationStatusOptions ?? []) !== JSON.stringify(reservationStatuses)) fail("canonical reservation statuses mismatch.");
if (JSON.stringify(docs.objectStateModel.reservationStatusOptions ?? []) !== JSON.stringify(reservationStatuses)) fail("object state model reservation statuses mismatch.");
if (docs.objectStateModel.inventoryInvariantRule?.atomicResourceDateCheckRequired !== true ||
  docs.objectStateModel.inventoryInvariantRule?.holdUntilRequired !== true ||
  docs.objectStateModel.inventoryInvariantRule?.reservationNoSystemGenerated !== true) {
  fail("object state model must expose inventory invariant rule.");
}
if ((docs.stepsFields.steps ?? []).length !== 6) fail("stepsFields must expose six business steps.");
if (!String(docs.crudPolicy.crudRules?.deletePolicyZh ?? "").includes("不得物理删除已确认预订")) fail("crud policy must forbid physical deletion of confirmed reservations.");
if (JSON.stringify((docs.runtimeRules.commands ?? []).map((item) => item.commandId)) !== JSON.stringify(commandIds)) fail("runtime rules command list mismatch.");
if (JSON.stringify((docs.runtimeMirror.commands ?? []).map((item) => item.commandId)) !== JSON.stringify(commandIds)) fail("runtime mirror command list mismatch.");
for (const command of docs.runtimeMirror.commands ?? []) {
  if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true || command.requiresGeneratedContract !== true) {
    fail(`${command.commandId} must require idempotency/concurrency/generated contract.`);
  }
  for (const forbidden of ["Stay", "CheckIn", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction"]) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden write ${forbidden}.`);
  }
}
for (const failure of docs.runtimeMirror.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
}
for (const code of ["concurrent_inventory_hold_conflict", "hold_expired_for_reservation", "reservation_no_user_input_forbidden", "cross_scenario_checkin_payment_forbidden", "finance_fact_forbidden"]) {
  if (!(docs.runtimeMirror.failureSemantics ?? []).some((item) => item.failureCode === code)) fail(`runtime mirror missing failure code ${code}.`);
}
if (docs.mobileMirror.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (docs.runtimeMirror.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
if (JSON.stringify(docs.mobileMirror.fields?.forbiddenUserInputFields ?? []) !== JSON.stringify(forbiddenUserInputFields) ||
  JSON.stringify(docs.runtimeMirror.fields?.forbiddenUserInputFields ?? []) !== JSON.stringify(forbiddenUserInputFields)) {
  fail("surface/runtime mirrors must expose identical forbidden user input fields.");
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
  version: "oam.dormitory-scenario5-reservation-and-inventory-hold-generated-contracts-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedFileCount: Object.keys(generatedPaths).length,
  generatedFiles: Object.values(generatedPaths).map((file) => ({
    path: file,
    outputContentDigest: docs[Object.keys(generatedPaths).find((key) => generatedPaths[key] === file)]?.outputContentDigest ?? null
  })),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 5 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 5 generated contracts check: PASS (${result.generatedFileCount} files)`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestObject(value) {
  const normalized = stableStringify(replaceOutputDigest(value));
  return `sha256:${crypto.createHash("sha256").update(normalized).digest("hex")}`;
}

function replaceOutputDigest(value) {
  if (Array.isArray(value)) return value.map(replaceOutputDigest);
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      output[key] = key === "outputContentDigest" ? "sha256:pending" : replaceOutputDigest(child);
    }
    return output;
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fail(message) {
  failures.push(message);
}
