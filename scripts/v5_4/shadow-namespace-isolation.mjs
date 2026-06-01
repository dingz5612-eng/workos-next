import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const migration = fs.readFileSync(path.join(repoRoot, "infra", "db", "migrations", "015_control_plane_shadow_runtime.sql"), "utf8");
const roleMigrationPath = path.join(repoRoot, "infra", "db", "migrations", "034_next_control_plane_runtime_roles.sql");
const roleMigration = fs.readFileSync(roleMigrationPath, "utf8");
const permissionContract = fs.readFileSync(path.join(repoRoot, "docs", "v5.4", "db-permission-contract.md"), "utf8");

const shadowTables = [
  "shadow_runtime.command_submissions",
  "shadow_runtime.domain_events",
  "shadow_runtime.ledger_entries",
  "shadow_runtime.lens_snapshots",
  "shadow_runtime.compare_inputs"
];

for (const table of shadowTables) {
  if (!migration.includes(`create table if not exists ${table}`)) {
    console.error(`shadow-namespace-isolation: migration missing isolated table ${table}`);
    process.exit(1);
  }
}

if (!/official projector must not read (from )?`?shadow_runtime\.\*`?/i.test(permissionContract)) {
  console.error("shadow-namespace-isolation: permission contract must forbid official projector reads from shadow_runtime.*");
  process.exit(1);
}

const requiredRoles = [
  "workos_official_projector",
  "workos_shadow_runner",
  "workos_gate_runner",
  "workos_invariant_runner",
  "workos_shadow_compare_runner",
  "workos_release_operator"
];

for (const role of requiredRoles) {
  if (!roleMigration.includes(role) || !permissionContract.includes(role)) {
    console.error(`shadow-namespace-isolation: missing DB role contract for ${role}`);
    process.exit(1);
  }
}

const roleBoundaryTerms = [
  "revoke all on schema shadow_runtime from",
  "grant usage on schema shadow_runtime to",
  "grant insert, select on table control_plane.gate_results to workos_gate_runner",
  "grant insert, select on table control_plane.runtime_invariant_checks to workos_invariant_runner",
  "grant insert, select on table control_plane.shadow_compare_reports to workos_shadow_compare_runner",
  "grant select on table",
  "control_plane.gate_results",
  "to workos_release_operator"
];

for (const term of roleBoundaryTerms) {
  if (!roleMigration.includes(term)) {
    console.error(`shadow-namespace-isolation: role migration missing boundary term: ${term}`);
    process.exit(1);
  }
}

const roleTestFiles = [
  "tests/WorkOS.DatabaseSecurityTests/RealDbRolePermissionTests.cs",
  "tests/WorkOS.DatabaseSecurityTests/ShadowPollutionIntegrationTests.cs"
];

for (const relativePath of roleTestFiles) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    console.error(`shadow-namespace-isolation: missing RT-DB database security test ${relativePath}`);
    process.exit(1);
  }
}

const officialProjectorFiles = [
  "services/core-api/WorkOS.Api/Runtime/OutboxProjector.cs",
  "services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs",
  "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeQueryService.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs"
];

for (const relativePath of officialProjectorFiles) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  if (source.includes("shadow_runtime")) {
    console.error(`shadow-namespace-isolation: official projector path reads shadow_runtime: ${relativePath}`);
    process.exit(1);
  }
}

console.log("shadow-namespace-isolation: PASS");
