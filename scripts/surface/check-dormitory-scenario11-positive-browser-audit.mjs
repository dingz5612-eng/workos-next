import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario11-housekeeping-maintenance-outofservice-positive-browser/scenario11-positive-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario11-positive-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario11-housekeeping-maintenance-outofservice.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario11-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario11-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario11-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario11-finance-gate.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const contract = readJsonIfExists(contractPath) ?? {};
const stepsContract = readJsonIfExists(stepsPath) ?? {};
const surfaceContract = readJsonIfExists(surfacePath) ?? {};
const testPlan = readJsonIfExists(testPlanPath) ?? {};
const financeGate = readJsonIfExists(financeGatePath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [];
const forbiddenVisibleTerms = surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? [];
const requiredAnalysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "是否误导为已可运营/已入账/已预订"
];

if (report.status !== "passed") failures.push("positive browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario11.HousekeepingMaintenanceOutOfService") failures.push("positive report must bind scenario11 authority.");
if (report.nameZh !== "房务、维修与停售协同") failures.push("positive report must show business name 房务、维修与停售协同.");
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
if (!Array.isArray(report.steps) || report.steps.length !== 13) failures.push("positive report must include exactly 13 positive screenshots/steps.");
const coveredPlanItems = new Set((report.steps ?? []).map((step) => step.testPlanItemZh));
for (const item of testPlan.positiveBrowserTestPlan ?? []) {
  if (!coveredPlanItems.has(item)) failures.push(`positive report missing test plan item: ${item}`);
}
for (const name of ["进入房务/维修处理", "派工作业", "执行与进度更新", "完成作业", "验收确认", "停售或恢复建议输出", "费用意向与财务交接"]) {
  if (!JSON.stringify(report.steps ?? []).includes(name)) failures.push(`positive report missing business step: ${name}`);
}
for (const expected of contract.upstream?.requiredReadonlyInputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing upstream readonly input: ${expected}`);
}
for (const expected of contract.downstream?.handoffOutputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing downstream handoff output: ${expected}`);
}
for (const assertionId of [
  "contract.scenario11_authority",
  "contract.source_authority_first",
  "contract.finance_gate_boundary",
  "contract.steps_seven_business_actions",
  "positive.all_test_plan_items_covered",
  "positive.no_internal_id_visible",
  "positive.no_forbidden_user_terms_visible",
  "positive.entry_roles_clear",
  "positive.work_flow_visible",
  "positive.no_operation_or_finance_truth_writes",
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
  if (step.businessRuntimeOperationStatusWriteAllowed !== false) failures.push(`positive step must forbid operational status writes: ${step.id ?? step.stepId}.`);
  if (step.reservationStayWriteAllowed !== false) failures.push(`positive step must forbid reservation/stay writes: ${step.id ?? step.stepId}.`);
  if (step.paymentRefundLedgerWriteAllowed !== false) failures.push(`positive step must forbid payment/refund/ledger writes: ${step.id ?? step.stepId}.`);
  if (step.financeGateHandlesExpenseTruth !== true) failures.push(`positive step must route expense truth to finance-gate: ${step.id ?? step.stepId}.`);
  if (step.scenario2HandlesOperationalTruth !== true) failures.push(`positive step must route operational truth to scenario package 2: ${step.id ?? step.stepId}.`);
}
if (!JSON.stringify(report).includes("301 房间退房后保洁待验收") ||
  !JSON.stringify(report).includes("301-02 床位维修中，预计 18:00 完成") ||
  !JSON.stringify(report).includes("搜索结果只读跳转") ||
  !JSON.stringify(report).includes("我的只放草稿") ||
  !JSON.stringify(report).includes("finance-gate") ||
  !JSON.stringify(report).includes("场景包 2 重新确认运营状态")) {
  failures.push("positive report must prove business-readable resources, readonly search, Mine duties, finance-gate handoff, and scenario 2 recheck.");
}
if ((stepsContract.steps ?? []).length !== 7) failures.push("scenario11 generated steps contract must expose seven business actions.");
if (financeGate.consumer !== "finance-gate" ||
  financeGate.expenseIntentOnly !== true ||
  financeGate.businessRuntimeMayWriteLedger !== false) {
  failures.push("scenario11 finance-gate contract must consume expense intent only.");
}

const result = {
  version: "oam.dormitory-scenario11-positive-browser-check.v1",
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
  console.error("Dormitory scenario11 positive browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario11 positive browser audit check: PASS (${result.positiveBrowserAuditDigest})`);

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
