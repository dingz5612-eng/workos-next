import fs from "node:fs";

const rulePath = "docs/rules/v5.5/gate-result-hardening.yml";
const migrationPath = "infra/db/migrations/029_v5_5_gate_result_hardening.sql";

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

const violations = [];
for (const file of [rulePath, migrationPath]) {
  if (!fs.existsSync(file)) {
    violations.push(`Missing GateResult hardening file: ${file}`);
  }
}

const rules = fs.existsSync(rulePath) ? fs.readFileSync(rulePath, "utf8") : "";
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";

for (const term of [
  "control_plane.business_signoffs",
  "gate.generated_by_gate_runner",
  "gate.passed_requires_ci_run",
  "gate.immutable_evidence_columns",
  "signoff.locked_requires_business_signoff",
  "requiredFields: [owner, reason, expiresAt]"
]) {
  if (!rules.includes(term)) {
    violations.push(`${rulePath} missing ${term}`);
  }
}

for (const term of [
  "create table if not exists control_plane.business_signoffs",
  "ck_gate_results_generated_by_gate_runner",
  "status <> 'passed' or generated_by = 'gate-runner'",
  "not valid",
  "ck_gate_results_passed_requires_ci_run",
  "status <> 'passed' or nullif(ci_run_id, '') is not null",
  "prevent_gate_results_immutable_update",
  "trg_gate_results_immutable_columns",
  "input_hash",
  "result_hash"
]) {
  if (!migration.includes(term)) {
    violations.push(`${migrationPath} missing ${term}`);
  }
}

if (violations.length > 0) {
  fail("GateResult hardening check failed.", violations);
}

console.log("GateResult hardening check: PASS");
