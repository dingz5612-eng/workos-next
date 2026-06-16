import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario6-payment-deposit-and-guarantee-positive-browser/scenario6-positive-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario6-positive-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario6-payment-deposit-and-guarantee.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario6-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario6-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario6-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario6-finance-gate.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const contract = readJsonIfExists(contractPath) ?? {};
const stepsContract = readJsonIfExists(stepsPath) ?? {};
const surfaceContract = readJsonIfExists(surfacePath) ?? {};
const testPlan = readJsonIfExists(testPlanPath) ?? {};
const financeGate = readJsonIfExists(financeGatePath) ?? {};
const failures = [];
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [
  "paymentId",
  "depositId",
  "guaranteeId",
  "ledgerEntryId",
  "ledgerTransactionId",
  "reservationId",
  "paymentCaseId",
  "financeReviewRequestId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId"
];
const forbiddenVisibleTerms = surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? [];
const requiredAnalysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "押金是否被误当收入",
  "担保是否被误当收款",
  "是否误导为已完成入住"
];
const currentHead = command("git rev-parse HEAD");

if (report.status !== "passed") failures.push("positive browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario6.PaymentDepositAndGuarantee") failures.push("positive report must bind scenario6 authority.");
if (report.nameZh !== "收款、押金与担保") failures.push("positive report must show business name 收款、押金与担保.");
for (const [field, expected] of Object.entries({
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  financeGateDigest: fileDigest(financeGatePath, root)
})) {
  if (report[field] !== expected) failures.push(`positive report ${field} mismatch: expected ${expected}, actual ${report[field] ?? "missing"}.`);
}
if (!isSha256Digest(report.positiveBrowserAuditDigest) ||
  report.positiveBrowserAuditDigest !== digestPositiveReport(report)) {
  failures.push("positiveBrowserAuditDigest mismatch.");
}
if (report.git?.headSha !== currentHead) {
  failures.push(`positive browser report headSha must equal current HEAD ${currentHead}, actual: ${report.git?.headSha ?? "missing"}.`);
}
if (report.productionConfirmAllowed !== false ||
  report.businessGoLiveAllowed !== false ||
  report.releaseAuthority !== false ||
  report.finalGoNoGo !== "NO_GO") {
  failures.push("positive browser report must keep production/release/final approval closed.");
}
if (report.sourceAuthorityPriority !== true) failures.push("positive report must declare Source Authority priority.");
if (!Array.isArray(report.steps) || report.steps.length !== 11) failures.push("positive report must include exactly 11 positive screenshots/steps.");
const coveredPlanItems = new Set((report.steps ?? []).map((step) => step.testPlanItemZh));
for (const item of testPlan.positiveBrowserTestPlan ?? []) {
  if (!coveredPlanItems.has(item)) failures.push(`positive report missing test plan item: ${item}`);
}
for (const name of ["进入收款押金办理", "确认应收与押金要求", "提交收款凭证", "提交押金或担保信息", "财务确认", "输出入住前财务摘要"]) {
  if (!JSON.stringify(report.steps ?? []).includes(name)) failures.push(`positive report missing business step: ${name}`);
}
for (const expected of contract.upstream?.requiredReadonlyInputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing upstream readonly input: ${expected}`);
}
for (const expected of contract.downstream?.handoffOutputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing downstream handoff output: ${expected}`);
}
for (const assertionId of [
  "contract.scenario6_authority",
  "contract.source_authority_first",
  "contract.upstream_readonly_only",
  "contract.finance_gate_boundary",
  "contract.downstream_package7_recheck",
  "contract.steps_six_business_actions",
  "positive.all_test_plan_items_covered",
  "positive.no_internal_id_visible",
  "positive.no_forbidden_user_terms_visible",
  "positive.entry_roles_clear",
  "positive.finance_boundary_visible",
  "positive.no_downstream_or_ledger_writes",
  "positive.no_go_remains_closed"
]) {
  const assertion = (report.assertions ?? []).find((item) => item.id === assertionId);
  if (!assertion) {
    failures.push(`positive report missing assertion ${assertionId}.`);
  } else if (assertion.status !== "passed") {
    failures.push(`positive assertion must pass: ${assertionId}.`);
  }
}
for (const shot of report.screenshots ?? []) {
  if (!shot.path || !fs.existsSync(path.join(root, shot.path))) failures.push(`positive screenshot missing: ${shot.path ?? "(empty)"}.`);
  if (!isSha256Digest(shot.sha256)) failures.push(`positive screenshot sha256 invalid: ${shot.path ?? "(empty)"}.`);
  for (const key of requiredAnalysisKeys) {
    if (!shot.analysis?.[key]) failures.push(`positive screenshot ${shot.id ?? shot.path} missing analysis key: ${key}.`);
  }
  for (const term of forbiddenInternalTerms) {
    if (String(shot.visibleText ?? "").includes(term)) failures.push(`positive screenshot exposed internal term ${term}: ${shot.id ?? shot.path}.`);
  }
  for (const term of forbiddenVisibleTerms) {
    if (String(shot.visibleText ?? "").includes(term)) failures.push(`positive screenshot exposed forbidden user-visible term ${term}: ${shot.id ?? shot.path}.`);
  }
}
for (const step of report.steps ?? []) {
  if (step.crossScenarioWriteAllowed !== false) failures.push(`positive step must forbid cross-scenario writes: ${step.id ?? step.stepId}.`);
  if (step.businessRuntimeLedgerWriteAllowed !== false) failures.push(`positive step must forbid business runtime ledger writes: ${step.id ?? step.stepId}.`);
}
if (!JSON.stringify(report).includes("押金不是收入") ||
  !JSON.stringify(report).includes("担保不是收款") ||
  !JSON.stringify(report).includes("finance-gate") ||
  !JSON.stringify(report).includes("搜索结果只读跳转") ||
  !JSON.stringify(report).includes("我的只放草稿") ||
  !JSON.stringify(report).includes("下游仍需重新核验")) {
  failures.push("positive report must prove deposit/guarantee boundary, finance-gate, readonly search, Mine duties, and downstream recheck.");
}
if ((stepsContract.steps ?? []).length !== 6) failures.push("scenario6 generated steps contract must expose six business actions.");
if (financeGate.financeBoundaryRule?.financeGateRequired !== true ||
  financeGate.forbiddenLedgerWritesByBusinessRuntime !== true ||
  financeGate.depositIsNotIncome !== true ||
  financeGate.guaranteeIsNotPayment !== true) {
  failures.push("finance-gate generated contract must enforce scenario6 finance boundary.");
}

const result = {
  version: "oam.dormitory-scenario6-positive-browser-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityId: report.authorityId ?? null,
  nameZh: report.nameZh ?? null,
  reportPath: reportRelPath,
  positiveBrowserAuditDigest: report.positiveBrowserAuditDigest ?? null,
  screenshotCount: report.screenshots?.length ?? 0,
  generatedContractDigest: report.generatedContractDigest ?? null,
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultRelPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario6 positive browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario6 positive browser audit check: PASS (${result.positiveBrowserAuditDigest})`);

function digestPositiveReport(value) {
  return digestObject({ ...value, positiveBrowserAuditDigest: "sha256:pending" });
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

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
