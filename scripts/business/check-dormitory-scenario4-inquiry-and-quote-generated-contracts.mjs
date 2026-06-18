import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-generated-contracts-result.json";
const generatedPaths = [
  "docs/contracts/generated/dormitory/scenario4-inquiry-and-quote.generated.json",
  "docs/contracts/generated/dormitory/scenario4-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario4-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario4-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario4-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario4-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario4-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario4-test-plan.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario4-inquiry-and-quote.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario4InquiryAndQuote.generated.json"
];
const failures = [];
const scenarioDigest = digestFile(scenarioPath);
const packageIndexDigest = digestFile(packageIndexPath);
const docs = new Map(generatedPaths.map((file) => [file, readJsonIfExists(file)]));
const commandIds = [
  "Dorm.InquiryRegister",
  "Dorm.StayDemandConfirm",
  "Dorm.QuoteDraftGenerate",
  "Dorm.QuoteVersionConfirm",
  "Dorm.QuoteSend",
  "Dorm.QuoteClose",
  "Dorm.RequoteCreate",
  "Dorm.ReservationPreparationStart"
];
const forbiddenInternal = ["inquiryId", "customerId", "quoteId", "quoteVersionId", "productId", "ratePlanId", "roomId", "bedId", "stableRef", "projectionVersion", "digest", "domainEventId"];
const forbiddenActionUserInput = [
  "saveDraft",
  "backToEdit"
];
const forbiddenRuntimeWrites = ["InventoryHold", "Reservation", "Stay", "Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction"];

for (const [file, document] of docs) {
  if (!document) {
    fail(`${file} is missing.`);
    continue;
  }
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated/doNotEdit.`);
  if (document.generatedBy !== "scripts/business/generate-dormitory-scenario4-inquiry-and-quote-contracts.mjs") fail(`${file} generatedBy mismatch.`);
  if (document.sourceContentDigest !== scenarioDigest) fail(`${file} source digest mismatch.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) fail(`${file} package index digest mismatch.`);
  if (document.authorityId !== "Dormitory.Scenario4.InquiryAndQuote" || document.scenarioPackageNo !== 4 || document.nameZh !== "询价与报价") {
    fail(`${file} must bind Dormitory.Scenario4.InquiryAndQuote package 4.`);
  }
  if (document.outputContentDigest !== digestGenerated(document)) fail(`${file} outputContentDigest mismatch.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
}

const canonical = docs.get("docs/contracts/generated/dormitory/scenario4-inquiry-and-quote.generated.json");
const objectState = docs.get("docs/contracts/generated/dormitory/scenario4-object-state-model.generated.json");
const stepsFields = docs.get("docs/contracts/generated/dormitory/scenario4-steps-fields.generated.json");
const crudPolicy = docs.get("docs/contracts/generated/dormitory/scenario4-crud-policy.generated.json");
const runtimeRules = docs.get("docs/contracts/generated/dormitory/scenario4-runtime-rules.generated.json");
const surfaceNavigation = docs.get("docs/contracts/generated/dormitory/scenario4-surface-navigation.generated.json");
const handoff = docs.get("docs/contracts/generated/dormitory/scenario4-handoff.generated.json");
const mobileMirror = docs.get("apps/mobile/src/generated/oam/dormitory-scenario4-inquiry-and-quote.generated.json");
const runtimeMirror = docs.get("services/core-api/WorkOS.Api/Runtime/DormitoryScenario4InquiryAndQuote.generated.json");

if (JSON.stringify(canonical?.upstream?.allowedSourcePackageNos ?? []) !== JSON.stringify([1, 2, 3])) fail("canonical upstream must be [1,2,3].");
if (canonical?.downstream?.allowedConsumerPackageNo !== 5) fail("canonical downstream must be package 5.");
if (!JSON.stringify(canonical?.readSideOutputs ?? []).includes("转预订准备摘要")) fail("canonical read side outputs must include reservation preparation summary.");
for (const forbidden of ["库存锁定", "预订", "入住", "收款", "押金", "退款", "账务"]) {
  if ((handoff?.readSideOutputs ?? []).includes(forbidden)) fail(`handoff must not output ${forbidden}.`);
  if (!(handoff?.downstream?.forbiddenOutputsZh ?? []).includes(forbidden)) fail(`handoff must forbid ${forbidden}.`);
}
if (!String(handoff?.downstreamRecheckRuleZh ?? "").includes("必须重新校验库存和报价有效期")) fail("handoff must require package 5 recheck.");
if (!JSON.stringify(objectState?.stateLayering ?? {}).includes("可报价来自场景包 4")) fail("object state model must layer 可报价 in scenario 4.");
if (!JSON.stringify(objectState?.stateLayering ?? {}).includes("可锁定和已预订来自场景包 5")) fail("object state model must layer lock/reservation in scenario 5.");
if (objectState?.priceSnapshotRule?.mustUseScenario3EffectivePriceVersion !== true ||
  objectState?.priceSnapshotRule?.userMayOverrideFinalPriceTruth !== false) {
  fail("object state model must enforce scenario 3 effective price snapshot rule.");
}
if ((stepsFields?.steps ?? []).length !== 6) fail("steps fields must contain six business steps.");
for (const stepName of ["客户询价登记", "填写入住需求", "查看可报价商品", "生成报价草稿", "确认并发送报价", "报价跟进与转预订准备"]) {
  if (!(stepsFields?.steps ?? []).some((step) => step.nameZh === stepName)) fail(`steps fields missing ${stepName}.`);
}
assertNoActionUserInputs(stepsFields, "steps-fields generated contract");
for (const internal of forbiddenInternal) {
  if (!(stepsFields?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`steps fields missing forbidden internal ${internal}.`);
  if ((stepsFields?.fields?.userFilled ?? []).includes(internal) || (stepsFields?.fields?.userSelected ?? []).includes(internal)) {
    fail(`steps fields exposes ${internal} to ordinary user input.`);
  }
  if (!(mobileMirror?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`mobile mirror missing forbidden internal ${internal}.`);
  if (!(runtimeMirror?.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`runtime mirror missing forbidden internal ${internal}.`);
}
if (crudPolicy?.crudRules?.confirmedFactEdit?.allowed !== false ||
  crudPolicy?.crudRules?.read?.querySearchListBoardReportReadonly !== true) {
  fail("crud policy must forbid issued quote inline edit and keep read surfaces readonly.");
}
if (JSON.stringify((runtimeRules?.commands ?? []).map((item) => item.commandId)) !== JSON.stringify(commandIds)) {
  fail("runtime rules must expose exactly the scenario 4 write commands.");
}
for (const command of runtimeRules?.commands ?? []) {
  if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true || command.requiresGeneratedContract !== true) {
    fail(`${command.commandId} must require idempotency, concurrency and generated contract.`);
  }
  for (const forbidden of forbiddenRuntimeWrites) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden write ${forbidden}.`);
  }
}
for (const failure of runtimeRules?.failureSemantics ?? []) {
  if (failure.sideEffectsAllowed !== false) fail(`failure ${failure.failureCode} must have no side effects.`);
}
for (const failureCode of ["contact_required", "date_range_invalid", "guest_count_invalid", "valid_product_required", "effective_price_required", "operation_blocked_for_quote", "quote_validity_required", "price_snapshot_mismatch", "quote_expired_for_reservation_preparation", "post_issue_inline_edit_forbidden", "forged_internal_reference", "duplicate_submission", "concurrent_quote_version_conflict", "readonly_result_write_attempt", "cross_scenario_inventory_reservation_forbidden", "finance_fact_forbidden", "quote_evidence_missing"]) {
  if (!(runtimeRules?.failureSemantics ?? []).some((item) => item.failureCode === failureCode)) fail(`runtime rules missing failure ${failureCode}.`);
}
if (runtimeRules?.runtimeConsumptionBoundary?.runtimeMayReadGeneratedOnly !== true ||
  runtimeRules?.runtimeConsumptionBoundary?.runtimeMayHardcodeBusinessRules !== false) {
  fail("runtime rules must require generated-only runtime consumption.");
}
if (!String(surfaceNavigation?.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !String(surfaceNavigation?.surfaceNavigation?.mineZh ?? "").includes("草稿")) {
  fail("surface navigation must keep search readonly and mine personal.");
}
for (const forbidden of ["已锁定", "已预订", "已入住", "已收款", "final GO", "lead-reservation", "reservationCreate", "RatePlanConfirm"]) {
  if (!(surfaceNavigation?.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? []).includes(forbidden)) fail(`surface navigation missing forbidden visible term ${forbidden}.`);
}
if (mobileMirror?.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (runtimeMirror?.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
assertNoActionUserInputs(mobileMirror, "mobile mirror");
assertNoActionUserInputs(runtimeMirror, "runtime mirror");
if (JSON.stringify((runtimeMirror?.commands ?? []).map((item) => item.commandId)) !== JSON.stringify(commandIds)) fail("runtime mirror command list mismatch.");
if (runtimeMirror?.priceSnapshotRule?.mustUseScenario3EffectivePriceVersion !== true) fail("runtime mirror must expose price snapshot rule.");

const result = {
  version: "oam.dormitory-scenario4-inquiry-and-quote-generated-contracts-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedFileCount: generatedPaths.length,
  generatedFiles: generatedPaths.map((file) => ({
    path: file,
    outputContentDigest: docs.get(file)?.outputContentDigest ?? null
  })),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 4 inquiry and quote generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 4 generated contracts check: PASS (${generatedPaths.length} files)`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestGenerated(value) {
  return digestObject(value);
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

function assertNoActionUserInputs(document, label) {
  for (const action of forbiddenActionUserInput) {
    for (const [stepIndex, step] of (document?.steps ?? []).entries()) {
      if ((step.userFilledFields ?? []).includes(action)) fail(`${label} step ${stepIndex + 1} must not expose action ${action} as user-filled input.`);
      if ((step.userSelectedFields ?? []).includes(action)) fail(`${label} step ${stepIndex + 1} must not expose action ${action} as user-selected input.`);
      if ((step.fields ?? []).some((field) => (field.fieldId ?? field.id) === action)) fail(`${label} step ${stepIndex + 1} must not render action ${action} as a field.`);
    }
    if ((document?.fields?.userFilled ?? []).includes(action)) fail(`${label} must not expose action ${action} as global user-filled input.`);
    if ((document?.fields?.userSelected ?? []).includes(action)) fail(`${label} must not expose action ${action} as global user-selected input.`);
  }
}

function fail(message) {
  failures.push(message);
}
