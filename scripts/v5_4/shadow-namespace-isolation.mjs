import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const migration = fs.readFileSync(path.join(repoRoot, "infra", "db", "migrations", "015_control_plane_shadow_runtime.sql"), "utf8");
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
