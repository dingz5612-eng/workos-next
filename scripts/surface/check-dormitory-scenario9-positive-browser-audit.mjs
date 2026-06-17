import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-positive-browser/scenario9-positive-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario9-positive-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario9-checkout-settlement.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario9-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario9-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario9-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario9-finance-gate.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const contract = readJsonIfExists(contractPath) ?? {};
const stepsContract = readJsonIfExists(stepsPath) ?? {};
const surfaceContract = readJsonIfExists(surfacePath) ?? {};
const testPlan = readJsonIfExists(testPlanPath) ?? {};
const financeGate = readJsonIfExists(financeGatePath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [
  "stayId",
  "checkoutCaseId",
  "settlementId",
  "refundId",
  "ledgerEntryId",
  "roomId",
  "bedId",
  "stableRef",
  "projectionVersion",
  "digest",
  "domainEventId",
  "paymentId",
  "ledgerTransactionId"
];
const forbiddenVisibleTerms = surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? [];
const requiredAnalysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "是否要求用户记入住记录号",
  "费用来源是否清楚",
  "是否误导为已退款/已入账/房源可运营"
];

if (report.status !== "passed") failures.push("positive browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario9.CheckoutSettlement") failures.push("positive report must bind scenario9 authority.");
if (report.nameZh !== "退房结算") failures.push("positive report must show business name 退房结算.");
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
if (!Array.isArray(report.steps) || report.steps.length !== 12) failures.push("positive report must include exactly 12 positive screenshots/steps.");
const coveredPlanItems = new Set((report.steps ?? []).map((step) => step.testPlanItemZh));
for (const item of testPlan.positiveBrowserTestPlan ?? []) {
  if (!coveredPlanItems.has(item)) failures.push(`positive report missing test plan item: ${item}`);
}
for (const name of ["进入退房办理", "确认实际离店与交接", "房间/床位检查", "费用核算", "客户确认结算", "确认退房", "财务处理请求与资源恢复交接"]) {
  if (!JSON.stringify(report.steps ?? []).includes(name)) failures.push(`positive report missing business step: ${name}`);
}
for (const expected of contract.upstream?.requiredReadonlyInputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing upstream readonly input: ${expected}`);
}
for (const expected of contract.downstream?.handoffOutputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing downstream handoff output: ${expected}`);
}
for (const assertionId of [
  "contract.scenario9_authority",
  "contract.source_authority_first",
  "contract.finance_gate_boundary",
  "contract.steps_seven_business_actions",
  "positive.all_test_plan_items_covered",
  "positive.no_internal_id_visible",
  "positive.no_forbidden_user_terms_visible",
  "positive.entry_roles_clear",
  "positive.checkout_flow_visible",
  "positive.no_finance_or_operational_truth_writes",
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
  if (step.businessRuntimeLedgerWriteAllowed !== false) failures.push(`positive step must forbid business runtime ledger writes: ${step.id ?? step.stepId}.`);
  if (step.paymentRefundWriteAllowed !== false) failures.push(`positive step must forbid payment/refund writes: ${step.id ?? step.stepId}.`);
  if (step.operationalRestoreWriteAllowed !== false) failures.push(`positive step must forbid direct operational restore: ${step.id ?? step.stepId}.`);
  if (step.financeGateHandlesActualMoney !== true) failures.push(`positive step must route actual money to finance-gate: ${step.id ?? step.stepId}.`);
  if (step.scenario2HandlesOperationalRestore !== true) failures.push(`positive step must route operational restore to scenario 2: ${step.id ?? step.stepId}.`);
}
if (!JSON.stringify(report).includes("退房单号：CO202606160001") ||
  !JSON.stringify(report).includes("财务确认流程") ||
  !JSON.stringify(report).includes("资源待恢复不是可运营") ||
  !JSON.stringify(report).includes("搜索结果只读跳转") ||
  !JSON.stringify(report).includes("我的只放草稿")) {
  failures.push("positive report must prove checkout number, finance confirmation handoff, resource recovery separation, readonly search, and Mine duties.");
}
if ((stepsContract.steps ?? []).length !== 7) failures.push("scenario9 generated steps contract must expose seven business actions.");
if (financeGate.consumer !== "finance-gate" || financeGate.settlementIntentOnly !== true) failures.push("scenario9 finance-gate contract must consume settlement intent only.");

const result = {
  version: "oam.dormitory-scenario9-positive-browser-check.v1",
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
  console.error("Dormitory scenario9 positive browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario9 positive browser audit check: PASS (${result.positiveBrowserAuditDigest})`);

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
