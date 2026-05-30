import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const migrationPath = path.join(repoRoot, "infra", "db", "migrations", "015_control_plane_shadow_runtime.sql");
const migration = fs.readFileSync(migrationPath, "utf8").toLowerCase();

const requiredTerms = [
  "create schema if not exists control_plane",
  "create schema if not exists shadow_runtime",
  "control_plane.release_manifests",
  "control_plane.feature_flags",
  "control_plane.slice_cutover_states",
  "control_plane.shadow_compare_reports",
  "control_plane.runtime_invariant_checks",
  "control_plane.gate_results",
  "control_plane.rollback_instructions",
  "shadow_runtime.command_submissions",
  "shadow_runtime.domain_events",
  "shadow_runtime.ledger_entries",
  "shadow_runtime.lens_snapshots",
  "shadow_runtime.compare_inputs",
  "uq_feature_flags_release_flag_key unique(release_id, flag_key)",
  "uq_slice_cutover_states_release_tenant_slice unique(release_id, tenant_id, slice_id)",
  "status in ('planned', 'built', 'shadow', 'pilot', 'active', 'locked', 'paused', 'rollback', 'compensating', 'rejected')",
  "grade in ('green', 'yellow', 'red')",
  "mode in ('blocking', 'observing')",
  "instruction_type in ('rollback', 'compensating')",
  "drop schema if exists shadow_runtime cascade",
  "drop schema if exists control_plane cascade"
];

const missing = requiredTerms.filter((term) => !migration.includes(term));
if (missing.length > 0) {
  for (const term of missing) {
    console.error(`control-plane-migration: missing ${term}`);
  }
  process.exit(1);
}

console.log("control-plane-migration: PASS");
