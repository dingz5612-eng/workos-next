import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { writeJson } from "../oam/lib/capability-delivery-control-plane.mjs";
import {
  CAPABILITY_ID,
  FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_RESULT_PATH,
  buildProjectionDigestChain,
  digestObject,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const report = readJsonIfExists(FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH) ?? {};
const chain = buildProjectionDigestChain(root);
const failures = [];
const currentHead = command("git rev-parse HEAD");
const requiredScenarioIds = [
  "capacity_4_single_bed_readiness_blocked",
  "duplicate_room_blocked",
  "duplicate_bed_same_room_blocked",
  "same_bed_no_different_room_allowed",
  "bed_without_room_blocked",
  "roomId_cannot_be_hand_filled",
  "bedId_cannot_be_hand_filled",
  "buildingContextRef_cannot_be_hand_filled",
  "readiness_state_closed_options",
  "needs_supplement_requires_remark",
  "failure_prompt_is_business_language",
  "failure_after_empty_submit_has_no_side_effects",
  "ordinary_object_query_does_not_start_create",
  "old_paths_advisory_only",
  "no_production_release_final_go_calls"
];

if (report.status !== "passed") failures.push("negative browser report status must be passed.");
if (report.capabilityId !== CAPABILITY_ID) failures.push(`negative browser report must bind capabilityId=${CAPABILITY_ID}.`);
for (const [field, expected] of Object.entries({
  acceptedGeneratedBundleDigest: chain.acceptedGeneratedBundleDigest,
  runtimeProjectionDigest: chain.runtimeProjectionDigest,
  surfaceProjectionDigest: chain.surfaceProjectionDigest,
  searchProjectionDigest: chain.searchProjectionDigest,
  dbProjectionPolicyDigest: chain.dbProjectionPolicyDigest
})) {
  if (!isSha256Digest(report[field])) failures.push(`negative browser report ${field} must be sha256.`);
  if (report[field] !== expected) failures.push(`negative browser report ${field} mismatch: expected ${expected}, actual ${report[field]}.`);
}
if (!isSha256Digest(report.negativeBrowserAuditDigest) || report.negativeBrowserAuditDigest !== digestNegativeReport(report)) {
  failures.push("negativeBrowserAuditDigest mismatch.");
}
if (report.git?.headSha !== currentHead) {
  failures.push(`negative browser report headSha must equal current HEAD ${currentHead}, actual ${report.git?.headSha || "missing"}.`);
}
if (report.productionConfirmAllowed !== false ||
  report.releaseAuthority !== false ||
  report.finalGoNoGo !== "NO_GO") {
  failures.push("negative browser report must keep production/release/final GO closed.");
}
if (report.historicalBrowserAuditLane?.wStayResourceAsCurrentProof !== false ||
  report.historicalBrowserAuditLane?.roomSetupAsCurrentProof !== false ||
  report.historicalBrowserAuditLane?.bedSetupAsCurrentProof !== false ||
  report.historicalBrowserAuditLane?.roomReadinessAsCurrentProof !== false ||
  report.historicalBrowserAuditLane?.tenScenarioAsMainGate !== false ||
  report.historicalBrowserAuditLane?.allStepsAsMainGate !== false ||
  report.historicalBrowserAuditLane?.lane !== "historical_advisory_only") {
  failures.push("historical paths must be advisory only and not current proof.");
}
const scenarios = new Map((report.scenarios ?? []).map((item) => [item.id, item]));
for (const id of requiredScenarioIds) {
  const item = scenarios.get(id);
  if (!item) {
    failures.push(`negative browser report missing scenario ${id}.`);
  } else if (item.status !== "passed") {
    failures.push(`negative browser scenario ${id} must PASS.`);
  }
}
if (!Array.isArray(report.screenshots) || report.screenshots.length < 3) {
  failures.push("negative browser report must include login/object-query/failure screenshots.");
}
for (const shot of report.screenshots ?? []) {
  if (!shot.path || !fs.existsSync(path.join(root, shot.path))) failures.push(`negative browser screenshot missing: ${shot.path || "(empty)"}.`);
  if (!/^[a-f0-9]{64}$/.test(String(shot.sha256 ?? ""))) failures.push(`negative browser screenshot sha256 invalid: ${shot.path || "(empty)"}.`);
}

const result = {
  version: "oam.dormitory-first-golden-chain-negative-browser-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  reportPath: FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH,
  acceptedGeneratedBundleDigest: report.acceptedGeneratedBundleDigest ?? null,
  runtimeProjectionDigest: report.runtimeProjectionDigest ?? null,
  surfaceProjectionDigest: report.surfaceProjectionDigest ?? null,
  searchProjectionDigest: report.searchProjectionDigest ?? null,
  dbProjectionPolicyDigest: report.dbProjectionPolicyDigest ?? null,
  negativeBrowserAuditDigest: report.negativeBrowserAuditDigest ?? null,
  scenarioCount: report.scenarios?.length ?? 0,
  screenshotCount: report.screenshots?.length ?? 0,
  historicalProofPolicy: report.historicalBrowserAuditLane ?? {},
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory first golden chain negative browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory first golden chain negative browser audit check: PASS (${result.negativeBrowserAuditDigest})`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function digestNegativeReport(value) {
  return digestObject({ ...value, negativeBrowserAuditDigest: "sha256:pending" });
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
