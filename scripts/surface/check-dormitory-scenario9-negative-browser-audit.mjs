import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario9-checkout-settlement-negative-browser/scenario9-negative-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario9-negative-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario9-checkout-settlement.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario9-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario9-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario9-test-plan.generated.json";
const financeGatePath = "docs/contracts/generated/finance/scenario9-finance-gate.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const runtimeRules = readJsonIfExists(runtimeRulesPath) ?? {};
const surfaceContract = readJsonIfExists(surfacePath) ?? {};
const testPlan = readJsonIfExists(testPlanPath) ?? {};
const financeGate = readJsonIfExists(financeGatePath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const noSideEffectTargets = [
  "Checkout",
  "Occupancy",
  "Payment",
  "Refund",
  "Ledger",
  "ResourceOperationStatus",
  "CommandSubmission",
  "DomainEvent",
  "Outbox",
  "Projection",
  "Search",
  "Dashboard"
];
const forbiddenInternalTerms = [
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
  "失败是否业务可理解",
  "是否证明无副作用",
  "是否暴露内部 ID",
  "是否阻断越界",
  "是否可回到合法动作"
];
const failureSemantics = new Map((runtimeRules.failureSemantics ?? []).map((failure) => [failure.failureCode, failure]));

if (report.status !== "passed") failures.push("negative browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario9.CheckoutSettlement") failures.push("negative report must bind scenario9 authority.");
if (report.nameZh !== "退房结算") failures.push("negative report must show business name 退房结算.");
for (const [field, expected] of Object.entries({
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  financeGateDigest: fileDigest(financeGatePath, root)
})) {
  if (report[field] !== expected) failures.push(`negative report ${field} mismatch: expected ${expected}, actual ${report[field] ?? "missing"}.`);
}
if (!isSha256Digest(report.negativeBrowserAuditDigest) ||
  report.negativeBrowserAuditDigest !== digestNegativeReport(report)) {
  failures.push("negativeBrowserAuditDigest mismatch.");
}
if (report.git?.headSha !== currentHead) {
  failures.push(`negative browser report headSha must equal current HEAD ${currentHead}, actual: ${report.git?.headSha ?? "missing"}.`);
}
if (report.productionConfirmAllowed !== false ||
  report.businessGoLiveAllowed !== false ||
  report.releaseAuthority !== false ||
  report.finalGoNoGo !== "NO_GO") {
  failures.push("negative browser report must keep production/release/final approval closed.");
}
if (!Array.isArray(report.scenarios) || report.scenarios.length !== 13) failures.push("negative report must include exactly 13 failure scenarios.");
const coveredPlanItems = new Set((report.scenarios ?? []).map((scenario) => scenario.testPlanItemZh));
for (const item of testPlan.negativeBrowserTestPlan ?? []) {
  if (!coveredPlanItems.has(item)) failures.push(`negative report missing test plan item: ${item}`);
}
for (const code of [
  "no_effective_stay",
  "stay_already_checked_out",
  "actual_checkout_time_required",
  "inspection_evidence_required",
  "damage_description_evidence_required",
  "customer_confirmation_required",
  "disputed_settlement_requires_review",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "direct_payment_refund_ledger_forbidden",
  "resource_operational_direct_restore_forbidden",
  "duplicate_checkout_submission",
  "concurrent_checkout_conflict"
]) {
  if (!(report.scenarios ?? []).some((scenario) => scenario.failureCode === code)) {
    failures.push(`negative report missing failure code: ${code}`);
  }
}
for (const scenario of report.scenarios ?? []) {
  const failure = failureSemantics.get(scenario.failureCode);
  if (!failure) failures.push(`negative scenario uses unknown generated failure code: ${scenario.failureCode}`);
  if (failure && scenario.messageZh !== failure.messageZh) failures.push(`negative scenario message mismatch for ${scenario.failureCode}.`);
  if (scenario.sideEffectsAllowed !== false) failures.push(`negative scenario sideEffectsAllowed must be false: ${scenario.id}`);
  for (const target of noSideEffectTargets) {
    if (scenario.sideEffects?.[target] !== 0) failures.push(`negative scenario ${scenario.id} wrote ${target}.`);
  }
  for (const key of requiredAnalysisKeys) {
    if (!scenario.analysis?.[key]) failures.push(`negative scenario ${scenario.id} missing analysis key: ${key}.`);
  }
}
for (const assertionId of [
  "contract.scenario9_runtime_rules",
  "contract.failure_semantics_no_side_effects",
  "contract.checkout_invariants_defined",
  "contract.finance_gate_boundary",
  "negative.all_test_plan_items_covered",
  "negative.all_failures_no_side_effects",
  "negative.no_internal_id_visible",
  "negative.no_forbidden_user_terms_visible",
  "negative.no_go_remains_closed"
]) {
  const assertion = (report.assertions ?? []).find((item) => item.id === assertionId);
  if (!assertion) {
    failures.push(`negative report missing assertion ${assertionId}.`);
  } else if (assertion.status !== "passed") {
    failures.push(`negative assertion must pass: ${assertionId}.`);
  }
}
for (const shot of report.screenshots ?? []) {
  if (!shot.path || !fs.existsSync(path.join(root, shot.path))) failures.push(`negative screenshot missing: ${shot.path ?? "(empty)"}.`);
  if (!isSha256Digest(shot.sha256)) failures.push(`negative screenshot sha256 invalid: ${shot.path ?? "(empty)"}.`);
  for (const key of requiredAnalysisKeys) {
    if (!shot.analysis?.[key]) failures.push(`negative screenshot ${shot.id ?? shot.path} missing analysis key: ${key}.`);
  }
  for (const term of forbiddenInternalTerms) {
    if (String(shot.visibleText ?? "").includes(term)) failures.push(`negative screenshot exposed internal term ${term}: ${shot.id ?? shot.path}.`);
  }
  for (const term of forbiddenVisibleTerms) {
    if (String(shot.visibleText ?? "").includes(term)) failures.push(`negative screenshot exposed forbidden user-visible term ${term}: ${shot.id ?? shot.path}.`);
  }
}
if (!JSON.stringify(report.scenarios ?? []).includes("未写入任何业务结果") ||
  !JSON.stringify(report.scenarios ?? []).includes("搜索结果只读") ||
  !JSON.stringify(report.scenarios ?? []).includes("finance-gate") ||
  !JSON.stringify(report.scenarios ?? []).includes("房源运营状态维护复查")) {
  failures.push("negative report must prove no side effects, readonly search, finance-gate handoff, and scenario 2 resource recovery separation.");
}
if (financeGate.consumer !== "finance-gate" || financeGate.settlementIntentOnly !== true) failures.push("scenario9 finance-gate contract must consume settlement intent only.");

const result = {
  version: "oam.dormitory-scenario9-negative-browser-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityId: report.authorityId ?? null,
  nameZh: report.nameZh ?? null,
  reportPath: reportRelPath,
  negativeBrowserAuditDigest: report.negativeBrowserAuditDigest ?? null,
  scenarioCount: report.scenarios?.length ?? 0,
  screenshotCount: report.screenshots?.length ?? 0,
  generatedContractDigest: report.generatedContractDigest ?? null,
  runtimeRulesDigest: report.runtimeRulesDigest ?? null,
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultRelPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario9 negative browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario9 negative browser audit check: PASS (${result.negativeBrowserAuditDigest})`);

function digestNegativeReport(value) {
  return digestObject({ ...value, negativeBrowserAuditDigest: "sha256:pending" });
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
