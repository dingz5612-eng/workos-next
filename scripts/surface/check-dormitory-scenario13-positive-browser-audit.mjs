import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario13-reporting-audit-review-positive-browser/scenario13-positive-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario13-positive-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario13-reporting-audit-review.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario13-steps-fields.generated.json";
const metricPath = "docs/contracts/generated/dormitory/scenario13-metric-model.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario13-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario13-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario13-finance-gate-readonly.generated.json";
const readModelPath = "docs/contracts/generated/read-model/scenario13-reporting-read-model.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const contract = readJsonIfExists(contractPath) ?? {};
const stepsContract = readJsonIfExists(stepsPath) ?? {};
const metricContract = readJsonIfExists(metricPath) ?? {};
const surfaceContract = readJsonIfExists(surfacePath) ?? {};
const testPlan = readJsonIfExists(testPlanPath) ?? {};
const financeGate = readJsonIfExists(financeGatePath) ?? {};
const readModel = readJsonIfExists(readModelPath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const forbiddenInternalTerms = surfaceContract.forbiddenUserInputFields ?? [];
const forbiddenVisibleTerms = surfaceContract.surfaceNavigation?.forbiddenUserVisibleTermsZh ?? [];
const requiredAnalysisKeys = [
  "用户是否看得懂",
  "字段是否合理",
  "按钮是否顺",
  "是否暴露内部 ID",
  "是否误导为已修复/已入账/已上线"
];

if (report.status !== "passed") failures.push("positive browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario13.ReportingAuditReview") failures.push("positive report must bind scenario13 authority.");
if (report.nameZh !== "经营报表、审计与复盘") failures.push("positive report must show business name 经营报表、审计与复盘.");
for (const [field, expected] of Object.entries({
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  metricContractDigest: fileDigest(metricPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  financeGateDigest: fileDigest(financeGatePath, root),
  readModelDigest: fileDigest(readModelPath, root)
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
for (const name of ["选择报表范围", "数据完整性检查", "生成经营报表快照", "生成财务核对视图", "审计发现与问题定位", "复盘结论与行动计划", "发布、导出与历史"]) {
  if (!JSON.stringify(report.steps ?? []).includes(name)) failures.push(`positive report missing business step: ${name}`);
}
for (const expected of contract.upstream?.requiredReadonlyInputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing upstream readonly input: ${expected}`);
}
for (const expected of contract.downstream?.handoffOutputs ?? []) {
  if (!JSON.stringify(report).includes(expected)) failures.push(`positive report missing downstream handoff output: ${expected}`);
}
for (const assertionId of [
  "contract.scenario13_authority",
  "contract.source_authority_first",
  "contract.metric_envelopes",
  "contract.finance_gate_readonly",
  "contract.read_model_readonly",
  "contract.steps_seven_business_actions",
  "positive.all_test_plan_items_covered",
  "positive.no_internal_id_visible",
  "positive.no_forbidden_user_terms_visible",
  "positive.entry_roles_clear",
  "positive.reporting_flow_visible",
  "positive.metric_envelopes_and_finance_readonly",
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
  if (step.permissionEnvelopeBound !== true) failures.push(`positive step must bind permission envelope: ${step.id ?? step.stepId}.`);
  if (step.lineageEnvelopeBound !== true) failures.push(`positive step must bind lineage envelope: ${step.id ?? step.stepId}.`);
  if (step.freshnessEnvelopeBound !== true) failures.push(`positive step must bind freshness envelope: ${step.id ?? step.stepId}.`);
  if (step.financialMetricsReadFinanceGateOnly !== true) failures.push(`positive step must read finance-gate only for financial metrics: ${step.id ?? step.stepId}.`);
  if (step.businessFactWriteAllowed !== false) failures.push(`positive step must forbid business fact writes: ${step.id ?? step.stepId}.`);
  if (step.ledgerWriteAllowed !== false) failures.push(`positive step must forbid ledger writes: ${step.id ?? step.stepId}.`);
}
if (!JSON.stringify(report).includes("6 月经营复盘") ||
  !JSON.stringify(report).includes("房源、预订、入住、退房、取消、维修、渠道指标") ||
  !JSON.stringify(report).includes("财务确认摘要") ||
  !JSON.stringify(report).includes("搜索结果只读跳转") ||
  !JSON.stringify(report).includes("我的只放草稿") ||
  !JSON.stringify(report).includes("行动计划回到责任场景包或财务确认流程处理")) {
  failures.push("positive report must prove readable reporting flow, finance confirmation readonly handoff, readonly search, Mine duties, and action-plan routing.");
}
if ((stepsContract.steps ?? []).length !== 7) failures.push("scenario13 generated steps contract must expose seven business actions.");
if (metricContract.metricDefinitionRule?.financialMetricsReadFinanceGateOnly !== true) failures.push("scenario13 metric contract must require finance-gate only for financial metrics.");
if (financeGate.consumer !== "finance-gate" ||
  financeGate.financeGateTruthReadonlyOnly !== true ||
  financeGate.businessRuntimeMayWriteLedger !== false) {
  failures.push("scenario13 finance-gate contract must be readonly.");
}
if (readModel.readModelMayReadConfirmedFactsOnly !== true ||
  readModel.readModelMayWriteSourceFacts !== false) {
  failures.push("scenario13 read model must read confirmed facts only and forbid source fact writes.");
}

const result = {
  version: "oam.dormitory-scenario13-positive-browser-check.v1",
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
  console.error("Dormitory scenario13 positive browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario13 positive browser audit check: PASS (${result.positiveBrowserAuditDigest})`);

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
