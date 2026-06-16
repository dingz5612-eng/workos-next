import fs from "node:fs";
import path from "node:path";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-scenario6-payment-deposit-and-guarantee-contracts.mjs";
const generatedFiles = [
  "docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json",
  "docs/contracts/generated/dormitory/scenario6-object-state-model.generated.json",
  "docs/contracts/generated/dormitory/scenario6-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario6-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/scenario6-runtime-rules.generated.json",
  "docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json",
  "docs/contracts/generated/dormitory/scenario6-handoff.generated.json",
  "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json",
  "docs/contracts/generated/finance/scenario6-finance-gate.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario6-payment-deposit-and-guarantee.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario6PaymentDepositAndGuarantee.generated.json"
];
const failures = [];
const scenarioDigest = fileDigest(scenarioPath, root);
const packageIndexDigest = fileDigest(packageIndexPath, root);
const documents = new Map(generatedFiles.map((file) => [file, readJsonIfExists(file)]));

for (const [file, document] of documents) {
  if (!document) {
    failures.push(`missing generated file: ${file}`);
    continue;
  }
  if (document.generated !== true || document.doNotEdit !== true) failures.push(`${file} must be generated/doNotEdit.`);
  if (document.generatedBy !== generatedBy) failures.push(`${file} generatedBy mismatch.`);
  if (!Array.isArray(document.generatedFrom) ||
    document.generatedFrom[0] !== scenarioPath ||
    document.generatedFrom[1] !== packageIndexPath) failures.push(`${file} generatedFrom mismatch.`);
  if (document.sourceContentDigest !== scenarioDigest) failures.push(`${file} source digest mismatch.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) failures.push(`${file} package index digest mismatch.`);
  if (!isSha256Digest(document.outputContentDigest) || document.outputContentDigest !== digestGenerated(document)) {
    failures.push(`${file} outputContentDigest mismatch.`);
  }
  if (document.authorityId !== "Dormitory.Scenario6.PaymentDepositAndGuarantee" ||
    document.scenarioPackageNo !== 6 ||
    document.nameZh !== "收款、押金与担保") {
    failures.push(`${file} scenario identity mismatch.`);
  }
  if (document.productionConfirmAllowed !== false ||
    document.releaseAuthority !== false ||
    document.finalGoNoGo !== "NO_GO") {
    failures.push(`${file} must keep NO_GO flags.`);
  }
}

const canonical = documents.get(generatedFiles[0]) ?? {};
const objectState = documents.get(generatedFiles[1]) ?? {};
const stepsFields = documents.get(generatedFiles[2]) ?? {};
const runtimeRules = documents.get(generatedFiles[4]) ?? {};
const surfaceNavigation = documents.get(generatedFiles[5]) ?? {};
const handoff = documents.get(generatedFiles[6]) ?? {};
const financeGate = documents.get(generatedFiles[8]) ?? {};
const mobileMirror = documents.get(generatedFiles[9]) ?? {};
const runtimeMirror = documents.get(generatedFiles[10]) ?? {};

if (!arraysEqual(canonical.upstream?.allowedSourcePackageNos, [5, 3, 4]) ||
  canonical.upstream?.upstreamWriteBackAllowed !== false ||
  canonical.downstream?.allowedConsumerPackageNo !== 7) {
  failures.push("canonical upstream/downstream boundary mismatch.");
}
for (const expected of ["PaymentRequirement", "PaymentIntent", "PaymentReceiptEvidence", "DepositRequirement", "DepositIntent", "DepositGuarantee", "FinanceReviewRequest", "FinanceConfirmationSnapshot", "PaymentStatusHistory", "DepositStatusHistory"]) {
  if (!(canonical.objects ?? []).includes(expected)) failures.push(`canonical missing object ${expected}.`);
}
if (objectState.financeBoundaryRule?.financeGateRequired !== true ||
  objectState.financeBoundaryRule?.businessRuntimeMayWriteLedger !== false ||
  objectState.financeBoundaryRule?.depositIsNotIncome !== true ||
  objectState.financeBoundaryRule?.guaranteeIsNotPayment !== true) {
  failures.push("object state finance boundary rule mismatch.");
}
if ((stepsFields.steps ?? []).length !== 6 ||
  !JSON.stringify(stepsFields.fields ?? {}).includes("financeConfirmed") ||
  !arraysContainAll(stepsFields.fields?.forbiddenUserInputFields, ["paymentId", "depositId", "ledgerEntryId", "reservationId", "stableRef", "projectionVersion", "digest", "domainEventId"])) {
  failures.push("steps/fields generated contract missing required field boundary.");
}
if (!arraysEqual((runtimeRules.commands ?? []).map((item) => item.commandId), [
  "Dorm.PaymentDepositCaseStart",
  "Dorm.PaymentDepositRequirementConfirm",
  "Dorm.PaymentReceiptSubmit",
  "Dorm.DepositGuaranteeSubmit",
  "Dorm.FinanceReviewRequest",
  "Dorm.FinanceGateConfirm",
  "Dorm.FinanceGateReturn",
  "Dorm.FinanceEvidenceSupplement",
  "Dorm.FinanceReadySummaryOutput"
])) {
  failures.push("runtime rules command list mismatch.");
}
for (const code of ["finance_gate_required", "unauthorized_finance_confirmation", "ledger_write_forbidden", "deposit_marked_as_income_forbidden", "guarantee_marked_as_payment_forbidden", "readonly_result_write_attempt", "cross_scenario_checkin_forbidden"]) {
  const failure = (runtimeRules.failureSemantics ?? []).find((item) => item.failureCode === code);
  if (!failure || failure.sideEffectsAllowed !== false) failures.push(`runtime rules missing no-side-effect failure ${code}.`);
}
if (runtimeRules.runtimeConsumptionBoundary?.businessRuntimeMayWriteLedger !== false ||
  runtimeRules.runtimeConsumptionBoundary?.financeGateMayConfirmFinanceFacts !== true) {
  failures.push("runtime consumption boundary must force finance-gate and forbid business ledger writes.");
}
if (!String(surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读") ||
  !arraysContainAll(surfaceNavigation.surfaceNavigation?.forbiddenUserVisibleTermsZh, ["已入住", "已退房", "已退款", "final GO", "ordinary-payment", "deposit-liability", "PaymentConfirm", "DepositConfirm"])) {
  failures.push("surface navigation must keep readonly search and forbidden visible terms.");
}
if (!arraysEqual(handoff.readSideOutputs, ["收款确认摘要", "押金确认摘要", "担保确认摘要", "剩余待收", "财务确认状态", "证据摘要", "只读对象引用"]) ||
  !String(handoff.downstreamRecheckRuleZh ?? "").includes("不得把收款确认当成已入住")) {
  failures.push("handoff output or downstream recheck mismatch.");
}
if (financeGate.consumer !== "finance-gate" ||
  financeGate.financeBoundaryRule?.financeGateRequired !== true ||
  financeGate.forbiddenLedgerWritesByBusinessRuntime !== true ||
  financeGate.depositIsNotIncome !== true ||
  financeGate.guaranteeIsNotPayment !== true ||
  !arraysContainAll(financeGate.financeCommands, ["Dorm.FinanceReviewRequest", "Dorm.FinanceGateConfirm", "Dorm.FinanceGateReturn"])) {
  failures.push("finance-gate generated projection mismatch.");
}
if (mobileMirror.consumer !== "surface" ||
  runtimeMirror.consumer !== "runtime" ||
  runtimeMirror.financeBoundaryRule?.businessRuntimeMayWriteLedger !== false) {
  failures.push("mobile/runtime mirror consumer boundary mismatch.");
}

const result = {
  version: "oam.dormitory-scenario6-payment-deposit-and-guarantee-generated-contracts-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedFileCount: generatedFiles.length,
  generatedFiles: generatedFiles.map((file) => ({
    path: file,
    outputContentDigest: documents.get(file)?.outputContentDigest ?? null
  })),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 6 generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 6 generated contracts check: PASS (${generatedFiles.length} files)`);

function digestGenerated(document) {
  return digestObject({ ...document, outputContentDigest: "sha256:pending" });
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function arraysEqual(actual = [], expected = []) {
  const left = actual ?? [];
  return left.length === expected.length && expected.every((item, index) => left[index] === item);
}

function arraysContainAll(actual = [], expected = []) {
  const values = new Set(actual ?? []);
  return expected.every((item) => values.has(item));
}
