import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario7-check-in-processing-negative-browser/scenario7-negative-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario7-negative-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario7-check-in-processing.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario7-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario7-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario7-test-plan.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const runtimeRules = readJsonIfExists(runtimeRulesPath) ?? {};
const surfaceContract = readJsonIfExists(surfacePath) ?? {};
const testPlan = readJsonIfExists(testPlanPath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const noSideEffectTargets = [
  "Stay",
  "Occupancy",
  "Credential",
  "CommandSubmission",
  "DomainEvent",
  "Outbox",
  "Projection",
  "Lens",
  "Search",
  "Dashboard",
  "Ledger"
];
const forbiddenInternalTerms = [
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
  "失败是否业务可理解",
  "是否证明无副作用",
  "是否暴露内部 ID",
  "是否阻断越界",
  "是否可回到合法动作"
];
const failureSemantics = new Map((runtimeRules.failureSemantics ?? []).map((failure) => [failure.failureCode, failure]));

if (report.status !== "passed") failures.push("negative browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario7.CheckInProcessing") failures.push("negative report must bind scenario7 authority.");
if (report.nameZh !== "入住办理") failures.push("negative report must show business name 入住办理.");
for (const [field, expected] of Object.entries({
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root)
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
if (!Array.isArray(report.scenarios) || report.scenarios.length !== 14) failures.push("negative report must include exactly 14 failure scenarios.");
const coveredPlanItems = new Set((report.scenarios ?? []).map((scenario) => scenario.testPlanItemZh));
for (const item of testPlan.negativeBrowserTestPlan ?? []) {
  if (!coveredPlanItems.has(item)) failures.push(`negative report missing test plan item: ${item}`);
}
for (const code of [
  "reservation_not_valid",
  "reservation_cancelled",
  "reservation_already_converted",
  "finance_rule_unmet_without_exception",
  "identity_evidence_required",
  "guest_mismatch_without_approval",
  "agreement_not_confirmed",
  "resource_blocked_for_checkin",
  "duplicate_checkin",
  "concurrent_occupancy_conflict",
  "credential_before_checkin_forbidden",
  "forged_internal_reference",
  "readonly_result_write_attempt",
  "cross_scenario_checkout_refund_forbidden"
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
  "contract.scenario7_runtime_rules",
  "contract.failure_semantics_no_side_effects",
  "contract.checkin_invariants_defined",
  "contract.readonly_and_cross_scenario_failures_defined",
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
if (!JSON.stringify(report.scenarios ?? []).includes("未写入任何业务事实") ||
  !JSON.stringify(report.scenarios ?? []).includes("搜索结果只读") ||
  !JSON.stringify(report.scenarios ?? []).includes("未成功入住，不能发放有效入住凭证") ||
  !JSON.stringify(report.scenarios ?? []).includes("后续业务按在住管理和结算流程处理")) {
  failures.push("negative report must prove no side effects, readonly search, credential-before-check-in block, and downstream process separation.");
}

const result = {
  version: "oam.dormitory-scenario7-negative-browser-check.v1",
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
  console.error("Dormitory scenario7 negative browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario7 negative browser audit check: PASS (${result.negativeBrowserAuditDigest})`);

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
