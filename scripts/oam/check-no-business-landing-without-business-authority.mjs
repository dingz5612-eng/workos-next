import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/no-business-landing-without-business-authority-result.json";
const landingPath = "docs/oam/dormitory-first-golden-chain-landing.current.json";
const capabilityPath = "docs/oam/capabilities/dormitory-first-golden-chain.current.json";
const browserResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-real-browser-result.json";
const browserReportPath = "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/first-golden-chain-real-browser-report.json";
const generatedContractsResultPath = "artifacts/oam/checks/generated-contract-consistency-result.json";
const dbProjectionResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-db-projection-proof-result.json";

const failures = [];
const prerequisiteStatuses = [];
const landing = readJson(landingPath);
const capability = readJson(capabilityPath);

for (const script of [
  "scripts/oam/check-dormitory-capability-decision-authority.mjs",
  "scripts/oam/check-dormitory-object-graph-authority.mjs",
  "scripts/oam/check-dormitory-bed-cardinality-authority.mjs",
  "scripts/oam/check-dormitory-invariant-authority.mjs",
  "scripts/oam/check-dormitory-command-contract-authority.mjs",
  "scripts/oam/check-dormitory-failure-semantics-authority.mjs"
]) {
  prerequisiteStatuses.push(runNodeCheck(script));
}

prerequisiteStatuses.push(readStatusCheck("generated contracts", generatedContractsResultPath));
prerequisiteStatuses.push(readStatusCheck("positive browser proof", browserResultPath));
prerequisiteStatuses.push(checkBrowserReportNegativeProof());
prerequisiteStatuses.push(runNodeCheck("scripts/oam/check-db-no-side-effects-proof.mjs", "no-side-effects proof"));
prerequisiteStatuses.push(runNodeCheck("scripts/oam/check-dormitory-first-golden-chain-db-projection-proof.mjs", "DB projection proof"));
prerequisiteStatuses.push(readStatusCheck("DB projection result", dbProjectionResultPath));

const unavailablePrerequisites = prerequisiteStatuses.filter((item) => item.status !== "PASS");
const lifecycleAchieved = capability?.lifecycleAchieved ?? [];
const lifecycleNotAdmitted = capability?.lifecycleNotAdmitted ?? [];
const businessLandingAdmitted =
  lifecycleAchieved.includes("BUSINESS_LANDING_ADMITTED") ||
  landing?.landingStatus === "APPROVED_DORMITORY_L1_FIRST_GOLDEN_CHAIN" ||
  landing?.businessFeatureDevelopmentAllowed === true ||
  landing?.dormitoryFirstGoldenChainLandingGoNoGo === "GO";

requireEqual(lifecycleAchieved.at?.(-1), "RUNTIME_TEST_ADMITTED", "capability.lifecycleAchieved.last");
for (const forbiddenState of ["BUSINESS_LANDING_ADMITTED", "PRODUCTION_CONFIRMED", "RELEASE_AUTHORIZED"]) {
  if (lifecycleAchieved.includes(forbiddenState)) {
    failures.push(`capability.lifecycleAchieved must not include ${forbiddenState}.`);
  }
  if (!lifecycleNotAdmitted.includes(forbiddenState)) {
    failures.push(`capability.lifecycleNotAdmitted must include ${forbiddenState}.`);
  }
}
requireEqual(landing?.landingStatus, "PENDING_BUSINESS_LANDING_REVIEW", "landing.landingStatus");
requireEqual(landing?.businessFeatureDevelopmentAllowed, false, "landing.businessFeatureDevelopmentAllowed");
requireEqual(landing?.productionConfirmAllowed, false, "landing.productionConfirmAllowed");
requireEqual(landing?.releaseAuthority, false, "landing.releaseAuthority");
requireEqual(landing?.finalGoNoGo, "NO_GO", "landing.finalGoNoGo");
requireEqual(capability?.businessFeatureDevelopmentAllowed, false, "capability.businessFeatureDevelopmentAllowed");
requireEqual(capability?.productionConfirmAllowed, false, "capability.productionConfirmAllowed");
requireEqual(capability?.releaseAuthority, false, "capability.releaseAuthority");
requireEqual(capability?.finalGoNoGo, "NO_GO", "capability.finalGoNoGo");

if (businessLandingAdmitted && unavailablePrerequisites.length > 0) {
  failures.push("BUSINESS_LANDING_ADMITTED is forbidden while any business authority prerequisite is unavailable.");
}

writeResult({
  version: "oam.no-business-landing-without-business-authority-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  landingPath,
  capabilityPath,
  businessLandingAdmitted,
  prerequisiteStatuses,
  unavailablePrerequisiteCount: unavailablePrerequisites.length,
  capabilityState: lifecycleAchieved.at?.(-1) ?? "UNKNOWN",
  landingStatus: landing?.landingStatus ?? "MISSING",
  businessFeatureDevelopmentAllowed: landing?.businessFeatureDevelopmentAllowed === true,
  productionConfirmAllowed: landing?.productionConfirmAllowed === true,
  releaseAuthority: landing?.releaseAuthority === true,
  finalGoNoGo: landing?.finalGoNoGo ?? "NO_GO",
  failures
});

if (failures.length) {
  console.error("No business landing without business authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `No business landing without business authority check: PASS (${landing?.landingStatus ?? "MISSING"}, finalGoNoGo=${landing?.finalGoNoGo ?? "NO_GO"})`
);

function runNodeCheck(script, label = script) {
  try {
    execFileSync("node", [script], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { label, status: "PASS", ref: script };
  } catch (error) {
    return {
      label,
      status: "NO_GO",
      ref: script,
      message: String(error.stderr || error.stdout || error.message).trim()
    };
  }
}

function readStatusCheck(label, file) {
  const value = readJson(file);
  const normalizedStatus = normalizeStatus(value?.status);
  return {
    label,
    status: normalizedStatus,
    ref: file,
    rawStatus: value?.status ?? "MISSING"
  };
}

function checkBrowserReportNegativeProof() {
  const report = readJson(browserReportPath);
  const assertions = report?.assertions ?? [];
  const missing = [];
  for (const required of [
    "validation.required_missing_blocks_submit",
    "validation.required_missing_no_confirm",
    "draft.current_step_user_fields_only",
    "draft.submit_success_cleans_current_step",
    "readiness.no_free_text_ready"
  ]) {
    const found = assertions.find((item) => item.id === required && item.status === "passed");
    if (!found) missing.push(required);
  }
  for (const fieldId of ["roomId", "bedId"]) {
    if (!assertions.some((item) => String(item.id ?? "").endsWith(`.${fieldId}.not_editable`) && item.status === "passed")) {
      missing.push(`${fieldId}.not_editable`);
    }
  }
  for (const [field, expected] of Object.entries({
    noForbiddenWorkspaceCardWrites: true,
    noDirectBusinessFactWrites: true,
    noProductionReleaseFinalGoCalls: true
  })) {
    if (report?.networkPolicy?.[field] !== expected) missing.push(`networkPolicy.${field}`);
  }
  if (report?.productionConfirmAllowed !== false) missing.push("productionConfirmAllowed");
  if (report?.releaseAuthority !== false) missing.push("releaseAuthority");
  if (report?.finalGoNoGo !== "NO_GO") missing.push("finalGoNoGo");
  return {
    label: "negative browser proof",
    status: report && missing.length === 0 ? "PASS" : "NO_GO",
    ref: browserReportPath,
    missing
  };
}

function normalizeStatus(status) {
  return status === "PASS" || status === "passed" ? "PASS" : "NO_GO";
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

function writeResult(result) {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({ ...result, checkedAtUtc: new Date().toISOString() }, null, 2)}\n`);
}

function format(value) {
  return JSON.stringify(value);
}
