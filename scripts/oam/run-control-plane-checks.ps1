$ErrorActionPreference = "Stop"

node scripts/oam/check-current-oam.mjs
node scripts/validate-contracts.mjs
node scripts/check-api-boundaries.mjs
node scripts/check-runtime-write-paths.mjs
node scripts/check-policy-as-code.mjs
