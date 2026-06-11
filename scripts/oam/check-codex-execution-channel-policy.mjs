import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const policyPath = "docs/oam/codex-execution-channel-policy.json";
const seatsPath = "docs/oam/professional-ai-review-seats.json";
const admissionPath = "docs/oam/current-admission-state.json";
const resultPath = "artifacts/oam/checks/codex-execution-channel-policy-result.json";
const violations = [];
const policy = readJson(policyPath);
const seats = readJson(seatsPath);
const admission = readJson(admissionPath);

if (policy.version !== "oam.codex-execution-channel-policy.v1" || policy.status !== "authoritative") {
  fail("codex_policy_identity", "Codex execution channel policy must be authoritative oam.codex-execution-channel-policy.v1.");
}
if (policy.channel !== "Codex Execution" || policy.governanceDomain !== false) {
  fail("codex_channel_identity", "Codex must be an execution channel only, not a governance domain.");
}
if (policy.accountable !== "00-OAM-Total-Control") {
  fail("codex_policy_accountable", "Codex execution channel policy must be accountable to 00.");
}
const rules = policy.rules ?? {};
const requiredBooleans = {
  codexOnlyExecutes00ExplicitInstructions: "Codex only executes explicit 00 instructions.",
  codexDoesNotInterpretArchitectureDirection: "Codex must not interpret architecture direction by itself.",
  codexDoesNotModifyGoNoGoByItself: "Codex must not modify GO/NO_GO by itself.",
  codexRejectsIndividual0106Instruction: "Codex must not accept standalone 01-06 instructions.",
  codexDoesNotExpandTaskScope: "Codex must not expand task scope."
};
for (const [field, message] of Object.entries(requiredBooleans)) {
  if (rules[field] !== true) fail("codex_policy_rule_missing", `${message} Missing ${field}.`);
}
if (policy.allowedInput?.finalExecutionInstructionSource !== "00-OAM-Total-Control") {
  fail("codex_final_instruction_source", "Codex final execution instruction source must be 00.");
}
if (policy.allowedInput?.reviewInputIsNotFinalInstruction !== true) {
  fail("codex_review_input_final_instruction", "01-06 review input must not be final instruction.");
}
for (const seat of seats.seats ?? []) {
  if (seat.finalInstructionToCodexAllowed !== false) {
    fail("seat_can_instruct_codex", `${seat.label ?? seat.id} must not directly instruct Codex.`);
  }
}
if (admission.businessProduction !== "BLOCKED") {
  fail("business_production_opened", "Codex policy check requires Business Production to remain BLOCKED.");
}
if (admission.dormitoryProduction !== "BLOCKED") {
  fail("dormitory_l2_opened", "Codex policy check requires Dormitory L2 to remain BLOCKED.");
}
if (admission.productionConfirmAllowed !== false) {
  fail("production_confirm_opened", "Codex policy check requires production_confirm to remain blocked.");
}

writeResult();

if (violations.length > 0) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log("Codex execution channel policy check: PASS");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.codex-execution-channel-policy-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
