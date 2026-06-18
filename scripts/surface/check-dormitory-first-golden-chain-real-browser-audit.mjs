import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { writeJson } from "../oam/lib/capability-delivery-control-plane.mjs";
import {
  CAPABILITY_ID,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_STEPS,
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  buildProjectionDigestChain,
  digestBrowserAuditReport,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const report = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH) ?? {};
const testPlan = readJsonIfExists(FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH) ?? {};
const visibleCopyContract = readJsonIfExists("docs/oam/visible-business-copy-contract.json") ?? {};
const chain = buildProjectionDigestChain(root);
const failures = [];
const currentHead = command("git rev-parse HEAD");
const currentRouteCardIds = {
  "Dorm.RoomSetupConfirm": "cert.roomSetupConfirm",
  "Dorm.BedSetupConfirm": "cert.bedSetupConfirm",
  "Dorm.ResourceReadinessConfirm": "cert.resourceReadinessConfirm"
};

if (report.status !== "passed") failures.push("browser report status must be passed.");
if (report.capabilityId !== CAPABILITY_ID) failures.push(`browser report must bind capabilityId=${CAPABILITY_ID}.`);
for (const [field, expected] of Object.entries({
  acceptedGeneratedBundleDigest: chain.acceptedGeneratedBundleDigest,
  runtimeProjectionDigest: chain.runtimeProjectionDigest,
  surfaceProjectionDigest: chain.surfaceProjectionDigest,
  searchProjectionDigest: chain.searchProjectionDigest,
  testPlanDigest: testPlan.testPlanDigest
})) {
  if (!isSha256Digest(report[field])) failures.push(`browser report ${field} must be sha256.`);
  if (report[field] !== expected) failures.push(`browser report ${field} mismatch: expected ${expected}, actual ${report[field]}.`);
}
if (!isSha256Digest(report.browserAuditDigest) || report.browserAuditDigest !== digestBrowserAuditReport(report)) {
  failures.push("browserAuditDigest mismatch.");
}
if (report.git?.headSha !== currentHead) {
  failures.push(`browser report headSha must equal current HEAD ${currentHead}, actual ${report.git?.headSha || "missing"}.`);
}
if (report.legacyBrowserAuditLane?.tenScenarioAsMainGate !== false ||
  report.legacyBrowserAuditLane?.allStepsAsMainGate !== false) {
  failures.push("legacy browser audits must not be current main gates.");
}
if (report.productionConfirmAllowed !== false ||
  report.releaseAuthority !== false ||
  report.finalGoNoGo !== "NO_GO") {
  failures.push("browser report must keep production/release/final GO closed.");
}
const stepIds = (report.steps ?? []).map((step) => step.domState?.cardId).filter(Boolean);
for (const expected of FIRST_GOLDEN_CHAIN_STEPS) {
  if (!stepIds.map(routeCardId).includes(routeCardId(expected.cardId))) failures.push(`browser report missing step ${routeCardId(expected.cardId)}.`);
  if (!JSON.stringify(report).includes(expected.step)) failures.push(`browser report missing visible step label ${expected.step}.`);
}
if (!scenario1CompletionVisibleLabels().some((label) => JSON.stringify(report).includes(label))) {
  failures.push(`browser report must prove scenario 1 completion is visible: ${scenario1CompletionVisibleLabels().join(" / ")}.`);
}
for (const requiredAssertion of [
  "search.object_query_d01_no_command",
  "search.object_query_101_room_no_command",
  "validation.required_missing_blocks_submit",
  "validation.required_missing_no_confirm",
  "draft.current_step_user_fields_only",
  "draft.restore_current_step",
  "draft.submit_success_cleans_current_step",
  "capacity.1.exact_beds_01",
  "capacity.4.exact_beds_01_02_03_04",
  "completion.business_values_visible",
  "completion.scenario1_visible",
  "completion.no_raw_stable_id",
  "completion.technical_details_collapsed",
  "readiness.no_free_text_ready"
]) {
  const assertion = (report.assertions ?? []).find((item) => item.id === requiredAssertion);
  if (!assertion) {
    failures.push(`browser report missing assertion ${requiredAssertion}.`);
  } else if (assertion.status !== "passed") {
    failures.push(`browser report assertion ${requiredAssertion} must PASS.`);
  }
}
for (const fieldId of ["roomId", "bedId"]) {
  const matching = (report.assertions ?? []).filter((item) => item.id?.endsWith(`.${fieldId}.not_editable`));
  if (!matching.length) {
    failures.push(`browser report missing ${fieldId} readonly/hidden-submit assertion.`);
  }
  if (matching.some((item) => item.status !== "passed")) {
    failures.push(`browser report ${fieldId} readonly/hidden-submit assertions must PASS.`);
  }
}
for (const label of ["通过", "不通过", "需补充"]) {
  const id = `readiness.closed_option.${safeName(label)}`;
  const assertion = (report.assertions ?? []).find((item) => item.id === id);
  if (!assertion || assertion.status !== "passed") {
    failures.push(`browser report readiness option assertion must PASS: ${label}.`);
  }
}
for (const term of ["价格配置", "房间床位阻断", "房间床位释放", "生产确认", "发布确认", "Final GO"]) {
  const assertionFailed = (report.assertions ?? []).some((item) => item.id?.includes(`forbidden.${safeName(term)}`) && item.status !== "passed");
  if (assertionFailed) failures.push(`browser report found forbidden visible term: ${term}.`);
}
if ((report.networkPolicy?.workspaceStartCount ?? 0) !== 1) failures.push("browser report must have exactly one workspace start.");
if ((report.networkPolicy?.operationsConfirmCount ?? 0) !== 3) failures.push("browser report must have exactly three operation confirms.");
if (report.networkPolicy?.noForbiddenWorkspaceCardWrites !== true) failures.push("browser report must not call old workspace/card writes.");
if (report.networkPolicy?.noDirectBusinessFactWrites !== true) failures.push("browser report must not directly write business facts.");
if (report.networkPolicy?.noProductionReleaseFinalGoCalls !== true) failures.push("browser report must not call production/release/final GO endpoints.");
if (!Array.isArray(report.screenshots) || report.screenshots.length < 12) {
  failures.push("browser report must include screenshots for login/search/object-query/failure/draft/three-step/final evidence.");
}
for (const shot of report.screenshots ?? []) {
  if (!shot.path || !fs.existsSync(path.join(root, shot.path))) failures.push(`screenshot missing: ${shot.path || "(empty)"}.`);
  if (!/^[a-f0-9]{64}$/.test(String(shot.sha256 ?? ""))) failures.push(`screenshot sha256 invalid: ${shot.path || "(empty)"}.`);
}

const result = {
  version: "oam.dormitory-first-golden-chain-real-browser-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  reportPath: FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  acceptedGeneratedBundleDigest: report.acceptedGeneratedBundleDigest ?? null,
  runtimeProjectionDigest: report.runtimeProjectionDigest ?? null,
  surfaceProjectionDigest: report.surfaceProjectionDigest ?? null,
  searchProjectionDigest: report.searchProjectionDigest ?? null,
  testPlanDigest: report.testPlanDigest ?? null,
  browserAuditDigest: report.browserAuditDigest ?? null,
  screenshotCount: report.screenshots?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory first golden chain real browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory first golden chain real browser audit check: PASS (${result.browserAuditDigest})`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function safeName(value) {
  return String(value || "step").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function routeCardId(cardId) {
  return currentRouteCardIds[cardId] || cardId;
}

function scenario1CompletionVisibleLabels() {
  const source = "房源建档与基础就绪完成";
  const replacement = (visibleCopyContract.displayTermReplacementsZh ?? [])
    .find(([from]) => from === source)?.[1];
  return Array.from(new Set([source, replacement].filter(Boolean)));
}
