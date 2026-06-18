import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-positive-browser/scenario7-positive-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario7-positive-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario7-check-in-processing.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario7-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario7-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const contract = readJsonIfExists(contractPath) ?? {};
const stepsContract = readJsonIfExists(stepsPath) ?? {};
const surfaceContract = readJsonIfExists(surfacePath) ?? {};
const testPlan = readJsonIfExists(testPlanPath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [
  "stayId",
  "residentId",
  "reservationId",
  "credentialId",
  "roomId",
  "bedId",
  "occupancyId",
  "checkInCaseId",
  "identityVerificationId",
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
  "财务状态是否清楚",
  "是否误导为后续结算完成"
];

if (report.status !== "passed") failures.push("positive browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario7.CheckInProcessing") failures.push("positive report must bind scenario7 authority.");
if (report.nameZh !== "入住办理") failures.push("positive report must show business name 入住办理.");
for (const [field, expected] of Object.entries({
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root)
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
if (!Array.isArray(report.steps) || report.steps.length !== 10) failures.push("positive report must include exactly 10 positive screenshots/steps.");
const coveredPlanItems = new Set((report.steps ?? []).map((step) => step.testPlanItemZh));
for (const item of testPlan.positiveBrowserTestPlan ?? []) {
  if (!coveredPlanItems.has(item)) failures.push(`positive report missing test plan item: ${item}`);
}
for (const name of ["进入入住办理", "到店与身份核验", "财务与协议复核", "房间/床位交付复核", "确认入住", "发放入住凭证"]) {
  if (!JSON.stringify(report.steps ?? []).includes(name)) failures.push(`positive report missing business step: ${name}`);
}
for (const expected of contract.upstream?.requiredReadonlyInputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing upstream readonly input: ${expected}`);
}
for (const expected of contract.downstream?.handoffOutputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing downstream handoff output: ${expected}`);
}
for (const assertionId of [
  "contract.scenario7_authority",
  "contract.source_authority_first",
  "contract.upstream_readonly_only",
  "contract.downstream_package8_summaries_only",
  "contract.steps_six_business_actions",
  "positive.all_test_plan_items_covered",
  "positive.no_internal_id_visible",
  "positive.no_forbidden_user_terms_visible",
  "positive.entry_roles_clear",
  "positive.check_in_flow_visible",
  "positive.no_payment_refund_checkout_or_ledger_writes",
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
  if (step.paymentDepositRefundWriteAllowed !== false) failures.push(`positive step must forbid payment/deposit/refund writes: ${step.id ?? step.stepId}.`);
  if (step.checkoutWriteAllowed !== false) failures.push(`positive step must forbid checkout writes: ${step.id ?? step.stepId}.`);
}
if (!JSON.stringify(report).includes("入住记录号") ||
  !JSON.stringify(report).includes("系统生成") ||
  !JSON.stringify(report).includes("房间/床位占用摘要") ||
  !JSON.stringify(report).includes("搜索结果只读跳转") ||
  !JSON.stringify(report).includes("我的只放草稿") ||
  !JSON.stringify(report).includes("下游在住管理只读这些摘要")) {
  failures.push("positive report must prove generated stay number, occupancy summary, readonly search, Mine duties, and downstream summary handoff.");
}
if ((stepsContract.steps ?? []).length !== 6) failures.push("scenario7 generated steps contract must expose six business actions.");

const result = {
  version: "oam.dormitory-scenario7-positive-browser-check.v1",
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
  console.error("Dormitory scenario7 positive browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario7 positive browser audit check: PASS (${result.positiveBrowserAuditDigest})`);

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
