import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync("docs/contracts/legacy-ledger-migration-registry.json", "utf8"));
const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--apply");

if (!dryRun) {
  throw new Error("Legacy ledger backfill apply mode is intentionally disabled until an operator supplies an audited mapping plan.");
}

console.log(JSON.stringify({
  dryRun: true,
  phase: registry.phase,
  sourceSlice: registry.sourceSlice,
  authoritativeOwners: registry.authoritativeOwners,
  legacyTables: registry.legacyTables.map((item) => ({
    table: item.table,
    replacement: item.replacement,
    mode: item.mode
  }))
}, null, 2));
