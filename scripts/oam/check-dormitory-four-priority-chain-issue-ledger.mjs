import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const indexPath = "artifacts/oam/evidence/dormitory-four-priority-chains-in-app-browser/index.json";
const baselinePath = "artifacts/oam/evidence/dormitory-four-priority-chains-in-app-browser/baseline-freeze.json";
const ledgerPath = "artifacts/oam/evidence/dormitory-four-priority-chains-in-app-browser/issue-ledger.json";
const resultPath = "artifacts/oam/checks/dormitory-four-priority-chain-issue-ledger-result.json";
const allowedStatuses = new Set([
  "activeBlocker",
  "resolvedNeedsRegression",
  "harnessOrSessionNoise",
  "superseded",
  "deferred",
  "undiscoveredRisk"
]);
const requiredUndiscoveredRisks = new Set([
  "undiscovered-A301-s13-after-checkout",
  "undiscovered-A302-main-chain",
  "undiscovered-B401-cancel-chain",
  "undiscovered-B402-maintenance-chain"
]);
const forbiddenUndiscoveredRisks = new Set([
  "undiscovered-A301-8-9-13"
]);
const failures = [];

const index = readJson(indexPath, root);
const baseline = readJson(baselinePath, root);
const ledger = readJson(ledgerPath, root);
const records = Array.isArray(index.records) ? index.records : [];
const blockedRecords = records
  .map((record, index) => ({ record, index, key: blockedRecordKey(record, index) }))
  .filter(({ record }) => isBlockedRecord(record));
const issues = Array.isArray(ledger.issues) ? ledger.issues : [];
const activeBlockers = issues.filter((item) => item.status === "activeBlocker");
const issueIds = new Set();
const blockedIssueKeys = new Set();
const indexDigest = fileDigest(indexPath, root);

for (const issue of issues) {
  const key = issue.evidence?.sourceBlockedRecordKey;
  if (key) blockedIssueKeys.add(key);
  for (const item of issue.evidence?.sourceBlockedRecordKeys ?? []) blockedIssueKeys.add(item);
}

if (baseline.version !== "oam.dormitory-four-priority-chain-baseline-freeze.v1") fail("baseline.version mismatch.");
if (ledger.version !== "oam.dormitory-four-priority-chain-issue-ledger.v1") fail("ledger.version mismatch.");
if (baseline.finalGoNoGo !== "NO_GO" || ledger.finalGoNoGo !== "NO_GO") fail("baseline/ledger finalGoNoGo must remain NO_GO.");
if (baseline.productionConfirmAllowed !== false || ledger.productionConfirmAllowed !== false ||
  baseline.releaseAuthority !== false || ledger.releaseAuthority !== false) {
  fail("baseline/ledger must not allow production confirmation or release authority.");
}
if (ledger.sourceIndexPath !== indexPath) fail("ledger.sourceIndexPath mismatch.");
if (ledger.baselineFreezePath !== baselinePath) fail("ledger.baselineFreezePath mismatch.");
if (baseline.sourceIndexPath !== indexPath) fail("baseline.sourceIndexPath mismatch.");
if (baseline.sourceIndexDigest !== indexDigest) fail("baseline.sourceIndexDigest must match current evidence index.");
if (ledger.sourceIndexDigest !== indexDigest) fail("ledger.sourceIndexDigest must match current evidence index.");
if (ledger.baselineSourceIndexDigest !== baseline.sourceIndexDigest) fail("ledger.baselineSourceIndexDigest must match baseline.");
if (baseline.recordCount !== records.length) fail("baseline recordCount mismatch.");
if (baseline.blockedRecordCount !== blockedRecords.length) fail("baseline blockedRecordCount mismatch.");
if (baseline.deferredIssueCount !== (index.deferredIssues ?? []).length) fail("baseline deferredIssueCount mismatch.");
if (ledger.counts?.records !== records.length) fail("ledger records count mismatch.");
if (ledger.counts?.blockedRecords !== blockedRecords.length) fail("ledger blockedRecords count mismatch.");
if (ledger.counts?.deferredIssues !== (index.deferredIssues ?? []).length) fail("ledger deferredIssues count mismatch.");
if (ledger.counts?.activeBlockers !== activeBlockers.length) fail("ledger activeBlockers count mismatch.");
if (ledger.currentSliceClosureAllowed !== (activeBlockers.length === 0 && !hasUndiscoveredRisk("A301-main-1"))) {
  fail("ledger.currentSliceClosureAllowed must reflect active blockers and A301 undiscovered risks.");
}
if (ledger.fourChainClosureAllowed !== false) fail("ledger.fourChainClosureAllowed must remain false until A302/B401/B402 are closed.");
if (baseline.fourChainClosureAllowed !== ledger.fourChainClosureAllowed) fail("baseline and ledger fourChainClosureAllowed mismatch.");
if (baseline.currentSliceClosureAllowed !== ledger.currentSliceClosureAllowed) fail("baseline and ledger currentSliceClosureAllowed mismatch.");
if (ledger.rules?.officialScreenshotsRequired !== true ||
  ledger.rules?.domOrOsFallbackForbidden !== true ||
  ledger.rules?.activeBlockerPreventsChainPass !== true ||
  ledger.rules?.staleActiveBlockerForbiddenWhenLaterPassExists !== true ||
  ledger.rules?.baselineLedgerIndexDigestMustMatch !== true ||
  ledger.rules?.finalGoNoGoAlwaysNoGo !== true) {
  fail("ledger rules must enforce official screenshots, no fallback, stale blocker prevention, digest lock, and NO_GO.");
}

for (const { key } of blockedRecords) {
  if (!blockedIssueKeys.has(key)) fail(`blocked record missing issue classification: ${key}.`);
}

for (const issue of issues) {
  const id = issue.id ?? "<missing>";
  if (!issue.id) fail("issue.id is required.");
  if (issueIds.has(issue.id)) fail(`duplicate issue id: ${issue.id}.`);
  issueIds.add(issue.id);
  if (!["P0", "P1", "P2", "P3"].includes(issue.severity)) fail(`${id}.severity invalid.`);
  if (!allowedStatuses.has(issue.status)) fail(`${id}.status invalid.`);
  for (const field of ["layer", "owningLayer", "blockingStatus", "decision", "fixPlan", "checkpoint"]) {
    if (!issue[field]) fail(`${id}.${field} is required.`);
  }
  if (!issue.evidence || typeof issue.evidence !== "object") fail(`${id}.evidence is required.`);
  if (!Array.isArray(issue.reverifyGate) || issue.reverifyGate.length === 0) fail(`${id}.reverifyGate required.`);
  if (issue.status === "activeBlocker") {
    if (!["P0", "P1"].includes(issue.severity)) fail(`${id} active blocker must be P0 or P1.`);
    if (issue.resolvedBy) fail(`${id} active blocker must not be resolved.`);
    if (hasLaterPassingEvidence(issue)) fail(`${id} cannot remain active because later passing evidence exists.`);
  }
  if (issue.status === "resolvedNeedsRegression") {
    if (!issue.resolvedBy) fail(`${id} resolvedNeedsRegression requires resolvedBy.`);
    if (!issue.resolutionEvidence) fail(`${id} resolvedNeedsRegression requires resolutionEvidence.`);
  }
  if (issue.status === "superseded") {
    if (!issue.supersededBy) fail(`${id} superseded requires supersededBy.`);
    if (!issue.resolutionEvidence) fail(`${id} superseded requires resolutionEvidence.`);
  }
  if (issue.status === "deferred" && issue.severity === "P0") {
    fail(`${id} P0 cannot be deferred.`);
  }
}

for (const risk of requiredUndiscoveredRisks) {
  const item = issues.find((issue) => issue.id === risk);
  if (!item || item.status !== "undiscoveredRisk") fail(`required undiscovered risk missing: ${risk}.`);
}
for (const risk of forbiddenUndiscoveredRisks) {
  if (issues.some((issue) => issue.id === risk)) fail(`obsolete undiscovered risk must be removed: ${risk}.`);
}

const currentSliceClosureAllowed = activeBlockers.length === 0 && !hasUndiscoveredRisk("A301-main-1");
const fourChainClosureAllowed = currentSliceClosureAllowed &&
  !["A302-main-2", "B401-abnormal-cancel-1", "B402-abnormal-maintenance-1"].some(hasUndiscoveredRisk);
const result = {
  version: "oam.dormitory-four-priority-chain-issue-ledger-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  baselinePath,
  baselineDigest: fileDigest(baselinePath, root),
  ledgerPath,
  ledgerDigest: fileDigest(ledgerPath, root),
  sourceIndexDigest: indexDigest,
  issueCount: issues.length,
  blockedRecordCount: blockedRecords.length,
  activeBlockerCount: activeBlockers.length,
  currentSliceClosureAllowed,
  fourChainClosureAllowed,
  officialBrowserEvidenceRequired: true,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory four-priority chain issue ledger check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory four-priority chain issue ledger check: PASS (${issues.length} issues, ${activeBlockers.length} active blocker(s), fourChainClosureAllowed=false)`);

function hasUndiscoveredRisk(chainId) {
  return issues.some((issue) => issue.status === "undiscoveredRisk" && issue.chainId === chainId);
}

function hasLaterPassingEvidence(issue) {
  const recordIndex = Number(issue.evidence?.recordIndex);
  if (!Number.isFinite(recordIndex)) return false;
  const scenarioNo = normalizeScenario(issue.scenario);
  const stepKey = normalizeStep(issue.step);
  return records.slice(recordIndex + 1).some((record) =>
    sameChainResource(record, issue) &&
    normalizeScenario(record.scenario) === scenarioNo &&
    isPositiveRecord(record) &&
    (normalizeStep(record.step) === stepKey ||
      stepRank(normalizeStep(record.step)) >= stepRank(stepKey) ||
      normalizeStep(record.step) === "scenario-complete"));
}

function sameChainResource(record, issue) {
  return String(record.chainId ?? "") === String(issue.chainId ?? "") &&
    String(record.resource ?? "") === String(issue.resource ?? "");
}

function isPositiveRecord(record) {
  const result = String(record.result ?? record.status ?? "").toLowerCase();
  const action = String(record.action ?? "").toLowerCase();
  return ["submitted", "passed", "started"].includes(result) ||
    action.includes("complete scenario") ||
    record.step === "scenario-complete";
}

function isBlockedRecord(record) {
  const result = String(record.result ?? record.status ?? "");
  const action = String(record.action ?? "");
  return /BLOCKED|NO_GO|blocked/i.test(result) || /blocked/i.test(action);
}

function blockedRecordKey(record, index) {
  return `blocked-${String(index + 1).padStart(2, "0")}-${slug(record.chainId)}-${slug(record.scenario)}-${slug(record.step)}`;
}

function normalizeScenario(value) {
  const text = String(value ?? "");
  const match = text.match(/scenario\s*([0-9]+)/i) ?? text.match(/^([0-9]+)/);
  return match ? Number(match[1]) : null;
}

function normalizeStep(value) {
  const text = String(value ?? "").trim();
  if (!text) return "missing";
  if (/^scenario-complete$/i.test(text)) return "scenario-complete";
  const fraction = text.match(/^([0-9]+)\s*\/\s*[0-9]+$/);
  if (fraction) return fraction[1];
  const step = text.match(/^step[-_\s]*([0-9]+)$/i);
  if (step) return step[1];
  return text;
}

function stepRank(stepKey) {
  if (stepKey === "scenario-complete") return Number.MAX_SAFE_INTEGER;
  const value = Number(stepKey);
  return Number.isFinite(value) ? value : -1;
}

function slug(value) {
  return String(value ?? "missing")
    .replace(/[^0-9A-Za-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "missing";
}

function fail(message) {
  failures.push(message);
}
