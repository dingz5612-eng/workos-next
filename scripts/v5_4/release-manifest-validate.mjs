import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const schemaPath = path.join(repoRoot, "docs", "v5.4", "release-manifest.schema.json");
const manifestPath = path.resolve(args.manifest ?? "docs/v5.4/release-manifest.fixture.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const gateResult = args.gate ? JSON.parse(fs.readFileSync(path.resolve(args.gate), "utf8")) : null;
const rollbackInstruction = args.rollback ? JSON.parse(fs.readFileSync(path.resolve(args.rollback), "utf8")) : null;
const requireCiRunId = parseBool(args["require-ci-run-id"]);

for (const field of schema.required ?? []) {
  if (!(field in manifest)) {
    fail(`release manifest missing required field ${field}`);
  }
}

const statusEnum = schema.properties?.status?.enum ?? [];
if (!statusEnum.includes(manifest.status)) {
  fail(`release manifest status is not allowed: ${manifest.status}`);
}

for (const field of [
  "owners",
  "feature_flag_ids",
  "slice_cutover_state_ids",
  "shadow_compare_report_ids",
  "invariant_check_ids",
  "acceptance_scenarios",
  "go_criteria",
  "no_go_criteria",
  "known_risks"
]) {
  if (!Array.isArray(manifest[field])) {
    fail(`release manifest ${field} must be an array`);
  }
}

if (gateResult && manifest.gate_result_id !== gateResult.gate_result_id) {
  fail(`release manifest gate_result_id ${manifest.gate_result_id} does not match generated gate ${gateResult.gate_result_id}`);
}

if (requireCiRunId && (typeof manifest.ci_run_id !== "string" || !manifest.ci_run_id.trim())) {
  fail("release manifest ci_run_id must be non-empty");
}

if (gateResult) {
  if (manifest.ci_run_id !== gateResult.ci_run_id) {
    fail(`release manifest ci_run_id ${manifest.ci_run_id} does not match generated gate ${gateResult.ci_run_id}`);
  }

  assertSameRefs("invariant_check_ids", manifest.invariant_check_ids, gateResult.invariant_check_refs ?? []);
  assertSameRefs("shadow_compare_report_ids", manifest.shadow_compare_report_ids, gateResult.shadow_compare_report_refs ?? []);
}

if (rollbackInstruction) {
  validateRollbackInstruction(rollbackInstruction);
  if (manifest.rollback_instruction_id !== rollbackInstruction.rollback_instruction_id) {
    fail(`release manifest rollback_instruction_id ${manifest.rollback_instruction_id} does not match rollback instruction ${rollbackInstruction.rollback_instruction_id}`);
  }
}

console.log("release-manifest-validate: PASS");

function parseArgs(items) {
  const parsed = {};
  for (const item of items) {
    if (!item.startsWith("--")) continue;
    const [key, value = "true"] = item.slice(2).split("=");
    parsed[key] = value;
  }
  return parsed;
}

function parseBool(value) {
  return value === "true" || value === "1" || value === "yes";
}

function assertSameRefs(field, manifestRefs, gateRefs) {
  const manifestValues = [...manifestRefs].sort();
  const gateValues = [...gateRefs].sort();
  if (JSON.stringify(manifestValues) !== JSON.stringify(gateValues)) {
    fail(`release manifest ${field} does not match generated gate refs`);
  }
}

function validateRollbackInstruction(rollback) {
  const required = [
    "rollback_instruction_id",
    "release_id",
    "instruction_type",
    "rollback_kind",
    "title",
    "scope",
    "allowed_before_status",
    "allowed_after_status",
    "steps",
    "validation_steps",
    "owner",
    "risk_level"
  ];

  for (const field of required) {
    if (!(field in rollback)) {
      fail(`rollback instruction missing required field ${field}`);
    }
  }

  if (rollback.instruction_type !== "rollback") {
    fail(`rollback instruction_type must be rollback, got ${rollback.instruction_type}`);
  }

  if (!["migration_down", "shadow_cleanup"].includes(rollback.rollback_kind)) {
    fail(`rollback rollback_kind must be migration_down or shadow_cleanup, got ${rollback.rollback_kind}`);
  }

  for (const field of ["allowed_before_status", "allowed_after_status", "steps", "validation_steps"]) {
    if (!Array.isArray(rollback[field]) || rollback[field].length === 0) {
      fail(`rollback ${field} must be a non-empty array`);
    }
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
