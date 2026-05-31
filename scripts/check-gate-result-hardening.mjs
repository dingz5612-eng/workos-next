import fs from "node:fs";

const rulePath = "docs/rules/v5.5/gate-result-hardening.yml";
const migrationPath = "infra/db/migrations/029_v5_5_gate_result_hardening.sql";
const writeStorePath = "services/core-api/WorkOS.Api/Runtime/ControlPlaneWriteStore.cs";

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

const violations = [];
for (const file of [rulePath, migrationPath, writeStorePath]) {
  if (!fs.existsSync(file)) {
    violations.push(`Missing GateResult hardening file: ${file}`);
  }
}

const rules = fs.existsSync(rulePath) ? fs.readFileSync(rulePath, "utf8") : "";
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";
const writeStore = fs.existsSync(writeStorePath) ? fs.readFileSync(writeStorePath, "utf8") : "";

for (const term of [
  "control_plane.business_signoffs",
  "gate.generated_by_gate_runner",
  "gate.passed_requires_ci_run",
  "gate.immutable_evidence_columns",
  "formal gate_results are insert-only",
  "update_go_no_go_items",
  "delete_row",
  "on_conflict_do_update",
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
  "ck_gate_results_passed_requires_ci_run",
  "status <> 'passed' or nullif(ci_run_id, '') is not null",
  "validate constraint ck_gate_results_generated_by_gate_runner",
  "validate constraint ck_gate_results_passed_requires_ci_run",
  "prevent_gate_results_immutable_update",
  "trg_gate_results_immutable_columns",
  "before update or delete on control_plane.gate_results",
  "create a new gate_result_id or gate_result_revisions row",
  "cannot be deleted",
  "automated_test_refs",
  "business_signoff_refs",
  "no_go_items",
  "go_items",
  "ci_run_id",
  "input_hash",
  "result_hash"
]) {
  if (!migration.includes(term)) {
    violations.push(`${migrationPath} missing ${term}`);
  }
}

const writeGateResultBody = writeStore.match(/public void WriteGateResult\(GateResultWrite result\)[\s\S]*?\n    public void WriteRuntimeInvariantCheck/)?.[0] ?? "";
if (writeGateResultBody.includes("on conflict")) {
  violations.push(`${writeStorePath} WriteGateResult must be insert-only and must not use on conflict update`);
}

if (violations.length > 0) {
  fail("GateResult hardening check failed.", violations);
}

console.log("GateResult hardening check: PASS");
