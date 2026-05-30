import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const schemaPath = path.join(repoRoot, "docs", "v5.4", "release-manifest.schema.json");
const manifestPath = path.resolve(args.manifest ?? "docs/v5.4/release-manifest.fixture.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const gateResult = args.gate ? JSON.parse(fs.readFileSync(path.resolve(args.gate), "utf8")) : null;

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

function fail(message) {
  console.error(message);
  process.exit(1);
}
